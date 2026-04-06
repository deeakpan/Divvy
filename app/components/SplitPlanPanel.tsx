"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { APP_CHAIN, SEPOLIA_WALLET_ERC20, TOKENS, type TokenSymbol } from "../lib/constants";
import {
  DEFAULT_SPLIT_CONFIG,
  formatTokenAmount,
  parseSplitPlanConfig,
  SPLIT_TOTAL_BPS,
  SPLIT_VALIDATION_SUM_MSG,
  strkSliceForBps,
  u256ToBigInt,
  validateSplitConfig,
  type SplitPlanBalanceSnapshot,
  type SplitPlanConfig,
} from "../lib/splitPlan";
import { getVesuApy } from "../lib/starkzap";

type Props = { address: string };

type WalletRowKey = "STRK" | "ETH" | "USDC";

type WalletRow = {
  key: WalletRowKey;
  address: string;
  symbol: string;
  decimals: number;
  logo: string;
};

const WALLET_ROWS: WalletRow[] =
  APP_CHAIN === "sepolia"
    ? [
        { key: "STRK", ...SEPOLIA_WALLET_ERC20.STRK, logo: "/starknet.webp" },
        { key: "ETH", ...SEPOLIA_WALLET_ERC20.ETH, logo: "/ethereum.webp" },
        { key: "USDC", ...SEPOLIA_WALLET_ERC20.USDC, logo: "/usdc.webp" },
      ]
    : [
        { key: "STRK", address: TOKENS.STRK.address, symbol: "STRK", decimals: 18, logo: "/starknet.webp" },
        { key: "ETH", address: TOKENS.ETH.address, symbol: "ETH", decimals: 18, logo: "/ethereum.webp" },
        { key: "USDC", address: TOKENS.USDC.address, symbol: "USDC", decimals: 6, logo: "/usdc.webp" },
      ];

type BucketDef = {
  label: string;
  enKey: keyof Pick<
    SplitPlanConfig,
    "stake_enabled" | "vesu_yield_enabled" | "cold_wallet_enabled" | "liquid_enabled"
  >;
  bpsKey: keyof Pick<SplitPlanConfig, "stake_bps" | "vesu_yield_bps" | "cold_wallet_bps" | "liquid_bps">;
  forwarding: boolean;
};

const BUCKETS: BucketDef[] = [
  { label: "Stake", enKey: "stake_enabled", bpsKey: "stake_bps", forwarding: false },
  { label: "Vesu yield", enKey: "vesu_yield_enabled", bpsKey: "vesu_yield_bps", forwarding: false },
  { label: "Forwarding", enKey: "cold_wallet_enabled", bpsKey: "cold_wallet_bps", forwarding: true },
  { label: "Liquid", enKey: "liquid_enabled", bpsKey: "liquid_bps", forwarding: false },
];

function abbrevContract(addr: string) {
  if (addr.length < 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function formatUsdApprox(n: number | null) {
  if (n === null || !Number.isFinite(n)) return null;
  if (n >= 100) return `≈ $${n.toFixed(0)}`;
  if (n >= 1) return `≈ $${n.toFixed(2)}`;
  return `≈ $${n.toFixed(4)}`;
}

function balanceTimesUsd(raw: bigint | null, decimals: number, usdPerToken: number | null): number | null {
  if (raw === null || usdPerToken === null || usdPerToken <= 0) return null;
  const human = Number(raw) / 10 ** decimals;
  if (!Number.isFinite(human)) return null;
  return human * usdPerToken;
}

function parseSpotApiNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type BpsKey = BucketDef["bpsKey"];

function bpsToPctFieldString(bps: number): string {
  if (bps === 0) return "";
  const x = bps / 100;
  return Number.isInteger(x)
    ? String(x)
    : String(Number(x.toFixed(4))).replace(/\.?0+$/, "");
}

async function fetchTokenBalance(tokenAddress: string, account: string) {
  const u = new URL("/api/balance", window.location.origin);
  u.searchParams.set("token", tokenAddress);
  u.searchParams.set("account", account);
  let res: Response;
  try {
    res = await fetch(u.toString(), { cache: "no-store" });
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error("Could not reach the app (is the dev server running?) or the request was blocked.");
    }
    throw e;
  }
  const data = (await res.json().catch(() => ({}))) as { low?: string; high?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Balance request failed");
  return { low: data.low ?? "0x0", high: data.high ?? "0x0" };
}

function snapshotFromLive(
  STRK: { low: string; high: string },
  ETH: { low: string; high: string },
  USDC: { low: string; high: string }
): SplitPlanBalanceSnapshot {
  return {
    STRK,
    ETH,
    USDC,
    captured_at: new Date().toISOString(),
  };
}

export function SplitPlanPanel({ address }: Props) {
  const [config, setConfig] = useState<SplitPlanConfig>(DEFAULT_SPLIT_CONFIG);
  const [loadedSnapshot, setLoadedSnapshot] = useState<SplitPlanBalanceSnapshot | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [live, setLive] = useState<SplitPlanBalanceSnapshot | null>(null);
  const [balanceErr, setBalanceErr] = useState<string | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [copiedKey, setCopiedKey] = useState<WalletRowKey | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState(() => String(DEFAULT_SPLIT_CONFIG.threshold_strk));
  const [spotEth, setSpotEth] = useState<number | null>(null);
  const [spotStrk, setSpotStrk] = useState<number | null>(null);
  const [pctDrafts, setPctDrafts] = useState<Partial<Record<BpsKey, string>>>({});
  const [vesuStrkSupplyApy, setVesuStrkSupplyApy] = useState<number | null>(null);

  const refreshBalances = useCallback(async () => {
    setBalanceErr(null);
    setLoadingBalances(true);
    try {
      const byKey = Object.fromEntries(
        await Promise.all(
          WALLET_ROWS.map(async (row) => {
            const bal = await fetchTokenBalance(row.address, address);
            return [row.key, bal] as const;
          })
        )
      ) as Record<WalletRowKey, { low: string; high: string }>;
      setLive(snapshotFromLive(byKey.STRK, byKey.ETH, byKey.USDC));
    } catch (e) {
      setLive(null);
      setBalanceErr(
        e instanceof TypeError
          ? "Network error loading balances."
          : e instanceof Error
            ? e.message
            : "Could not load balances."
      );
    } finally {
      setLoadingBalances(false);
    }
  }, [address]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadErr(null);
      const u = new URL("/api/split-plans", window.location.origin);
      u.searchParams.set("wallet", address);
      const res = await fetch(u.toString(), { cache: "no-store" });
      const data = (await res.json()) as {
        plan?: { config: unknown; balance_snapshot: unknown; updated_at?: string } | null;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setLoadErr(data.error ?? "Could not load saved plan.");
        return;
      }
      if (data.plan?.config) {
        const parsed = parseSplitPlanConfig(data.plan.config);
        if (parsed) {
          setConfig(parsed);
          setThresholdDraft(String(parsed.threshold_strk));
          setPctDrafts({});
        }
      }
      if (data.plan?.balance_snapshot) {
        const s = data.plan.balance_snapshot as SplitPlanBalanceSnapshot;
        if (s?.STRK && s?.ETH && s?.USDC && s?.captured_at) setLoadedSnapshot(s);
      }
      if (data.plan?.updated_at) setUpdatedAt(data.plan.updated_at);
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/spot-prices", { cache: "no-store" });
        const j = (await res.json()) as { ethUsd?: unknown; strkUsd?: unknown };
        if (cancelled) return;
        const e = parseSpotApiNumber(j.ethUsd);
        const s = parseSpotApiNumber(j.strkUsd);
        if (e != null) setSpotEth(e);
        if (s != null) setSpotStrk(s);
      } catch {
        if (!cancelled) {
          setSpotEth(null);
          setSpotStrk(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getVesuApy("STRK").then((apy) => {
      if (!cancelled) setVesuStrkSupplyApy(apy);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const strkWei = useMemo(() => {
    if (!live?.STRK) return 0n;
    return u256ToBigInt(live.STRK.low, live.STRK.high);
  }, [live]);

  const sumBps = useMemo(() => {
    let s = 0;
    if (config.stake_enabled) s += config.stake_bps;
    if (config.vesu_yield_enabled) s += config.vesu_yield_bps;
    if (config.cold_wallet_enabled) s += config.cold_wallet_bps;
    if (config.liquid_enabled) s += config.liquid_bps;
    return s;
  }, [config]);

  const sumOk = sumBps === SPLIT_TOTAL_BPS;

  const effectiveConfig = useMemo((): SplitPlanConfig => {
    const td = thresholdDraft.trim();
    if (td === "") return config;
    const n = Number(td);
    if (Number.isFinite(n) && n > 0) return { ...config, threshold_strk: n };
    return config;
  }, [config, thresholdDraft]);

  const validationMsg = useMemo(() => validateSplitConfig(effectiveConfig), [effectiveConfig]);

  const setBps = (bpsKey: BpsKey, bps: number) => {
    setConfig((c) => ({ ...c, [bpsKey]: Math.max(0, Math.min(SPLIT_TOTAL_BPS, Math.round(bps))) }));
  };

  const setEnabled = (enKey: BucketDef["enKey"], bpsKey: BpsKey, on: boolean) => {
    setConfig((c) => (on ? { ...c, [enKey]: true } : { ...c, [enKey]: false, [bpsKey]: 0 }));
    if (!on) {
      setPctDrafts((d) => {
        const next = { ...d };
        delete next[bpsKey];
        return next;
      });
    }
  };

  const save = async () => {
    setSaveErr(null);
    const effective = effectiveConfig;
    const v = validateSplitConfig(effective);
    if (v) {
      return;
    }
    if (!live) {
      setSaveErr("Wait for balances to load, or tap Refresh.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/split-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: address,
          config: { ...effective, cold_wallet_address: effective.cold_wallet_address.trim() },
          balance_snapshot: live,
        }),
      });
      const data = (await res.json()) as {
        plan?: { updated_at?: string; balance_snapshot?: SplitPlanBalanceSnapshot };
        error?: string;
      };
      if (!res.ok) {
        setSaveErr(data.error ?? "Save failed.");
        return;
      }
      setConfig(effective);
      setThresholdDraft(String(effective.threshold_strk));
      if (data.plan?.balance_snapshot) setLoadedSnapshot(data.plan.balance_snapshot as SplitPlanBalanceSnapshot);
      if (data.plan?.updated_at) setUpdatedAt(data.plan.updated_at);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = sumOk && !validationMsg && !!live && !saving;

  const copyContract = (key: WalletRowKey, contract: string) => {
    void navigator.clipboard.writeText(contract);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1400);
  };

  const displayRow = (sym: TokenSymbol, snap: SplitPlanBalanceSnapshot | null) => {
    const t = TOKENS[sym];
    const cell = snap?.[sym];
    const raw = cell ? u256ToBigInt(cell.low, cell.high) : 0n;
    const formatted = formatTokenAmount(raw, t.decimals);
    return (
      <div key={sym} className="app-split-balance-row">
        <span className="app-split-balance-label">{t.symbol}</span>
        <span className="app-split-balance-value font-mono">{snap ? formatted : "—"}</span>
      </div>
    );
  };

  const showAllocExtraError = Boolean(validationMsg && validationMsg !== SPLIT_VALIDATION_SUM_MSG);

  return (
    <div className="app-split">
      <header className="app-split-hero">
        <h2 className="app-split-title font-display">Split plan</h2>
        <p className="app-split-sub">
          This page configures Divvy&apos;s split plan: which share of STRK goes to stake, Vesu yield, forwarding, and
          liquid; and how much STRK must move (vs the last saved snapshot) before the next automation pass should run.
          <button type="button" className="app-split-learn-link" onClick={() => setDetailsOpen((o) => !o)}>
            {detailsOpen ? " Hide details." : " More detail."}
          </button>
          {detailsOpen && (
            <span className="app-split-learn-inline">
              {" "}
              Cartridge session policies will read this once routes execute on-chain. Forwarding with share &gt; 0% needs a
              valid Starknet <span className="font-mono">0x</span> address. Only toggled-on rows count; their
              percentages must total 100%. Spot USD for ETH/STRK below uses Pragma&apos;s public API (Chainlink-backed
              feeds on Starknet), with CoinGecko if Pragma fails.
            </span>
          )}
        </p>
        <div className="app-split-toolbar">
          <button
            type="button"
            className="app-split-save app-connect-cta font-display"
            onClick={() => void save()}
            disabled={!canSave}
          >
            {saving ? "Saving…" : "Save plan"}
          </button>
          <button
            type="button"
            className="app-split-refresh app-split-refresh--ghost"
            onClick={() => void refreshBalances()}
            disabled={loadingBalances}
          >
            {loadingBalances ? "…" : "Refresh"}
          </button>
          {!canSave && (
            <span className="app-split-toolbar-hint">
              {!live
                ? loadingBalances
                  ? "Loading balances…"
                  : balanceErr
                    ? "Fix error below."
                    : "Loading…"
                : !sumOk || validationMsg
                  ? "Fix allocation below."
                  : saving
                    ? "…"
                    : ""}
            </span>
          )}
        </div>
        {loadErr && <p className="app-split-banner app-split-banner--warn">{loadErr}</p>}
        {saveErr && <p className="app-split-banner app-split-banner--warn">{saveErr}</p>}
      </header>

      <div className="app-split-bal-compact">
        <p className="app-split-spot-line">
          Spot USD (off-chain):{" "}
          <span className="font-mono">
            ETH {spotEth != null ? `$${spotEth < 1 ? spotEth.toFixed(4) : spotEth.toFixed(2)}` : "—"} · STRK{" "}
            {spotStrk != null ? `$${spotStrk < 1 ? spotStrk.toFixed(4) : spotStrk.toFixed(2)}` : "—"}
          </span>
        </p>
        {balanceErr && <p className="app-split-banner app-split-banner--warn app-split-banner--inline">{balanceErr}</p>}
        <ul className="app-split-bal-inline">
          {WALLET_ROWS.map((row) => {
            const cell = live?.[row.key];
            const raw = cell ? u256ToBigInt(cell.low, cell.high) : null;
            const px = row.key === "ETH" ? spotEth : row.key === "STRK" ? spotStrk : 1;
            const usdN =
              row.key === "USDC"
                ? raw !== null
                  ? Number(raw) / 10 ** row.decimals
                  : null
                : balanceTimesUsd(raw, row.decimals, px);
            const usdLabel = formatUsdApprox(usdN);
            return (
              <li key={row.key} className="app-split-bal-item">
                <button
                  type="button"
                  className="app-split-bal-hit"
                  title={`Copy ${row.symbol} contract`}
                  onClick={() => copyContract(row.key, row.address)}
                >
                  <Image
                    src={row.logo}
                    alt=""
                    width={44}
                    height={44}
                    className="app-split-token-img app-split-token-img--lg"
                  />
                  <div className="app-split-bal-textcol">
                    <span className="app-split-asset-name-lg">{row.symbol}</span>
                    <span className="app-split-asset-addr font-mono">{abbrevContract(row.address)}</span>
                  </div>
                </button>
                <div className="app-split-bal-right">
                  {copiedKey === row.key && <span className="app-split-copied">copied</span>}
                  <span className="app-split-bal-amt font-mono">
                    {raw !== null ? formatTokenAmount(raw, row.decimals, 5) : loadingBalances ? "…" : "—"}
                  </span>
                  {usdLabel && <span className="app-split-bal-usd font-mono">{usdLabel}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {(loadedSnapshot || updatedAt) && (
        <section className="app-split-saved-strip" aria-labelledby="split-saved-heading">
          <h3 id="split-saved-heading" className="app-split-section-plain-title">
            Last saved
          </h3>
          {updatedAt && (
            <p className="app-split-meta">
              <time dateTime={updatedAt}>{new Date(updatedAt).toLocaleString()}</time>
            </p>
          )}
          {loadedSnapshot && (
            <div className="app-split-balance-grid">
              {displayRow("STRK", loadedSnapshot)}
              {displayRow("ETH", loadedSnapshot)}
              {displayRow("USDC", loadedSnapshot)}
            </div>
          )}
        </section>
      )}

      <section className="app-split-alloc-wrap" aria-labelledby="split-alloc-heading">
        <h3 id="split-alloc-heading" className="app-split-section-plain-title">
          Allocation
        </h3>
        <label className="app-split-threshold">
          <span>STRK threshold (new cycle)</span>
          <input
            type="text"
            inputMode="decimal"
            className="app-split-threshold-input font-mono"
            autoComplete="off"
            value={thresholdDraft}
            onChange={(e) => setThresholdDraft(e.target.value)}
            onBlur={() => {
              const t = thresholdDraft.trim();
              if (t === "") {
                setThresholdDraft(String(config.threshold_strk));
                return;
              }
              const n = Number(t);
              if (Number.isFinite(n) && n > 0) {
                setConfig((c) => ({ ...c, threshold_strk: n }));
                setThresholdDraft(String(n));
              } else {
                setThresholdDraft(String(config.threshold_strk));
              }
            }}
          />
        </label>

        <div className="app-split-alloc-stack">
          {BUCKETS.map((b) => {
            const enabled = config[b.enKey];
            const bps = config[b.bpsKey];
            const slice = enabled ? strkSliceForBps(strkWei, bps) : 0n;
            const pctDisplay =
              pctDrafts[b.bpsKey] !== undefined ? pctDrafts[b.bpsKey]! : bpsToPctFieldString(bps);
            return (
              <div key={b.enKey} className="app-split-alloc-item">
                <div className="app-split-alloc-item-top">
                  <span className="app-split-alloc-label">{b.label}</span>
                  <label className="app-split-switch">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(b.enKey, b.bpsKey, e.target.checked)}
                    />
                    <span className="app-split-switch-ui" aria-hidden />
                  </label>
                </div>
                {enabled && (
                  <div className="app-split-alloc-item-body">
                    {b.bpsKey === "vesu_yield_bps" && (
                      <p
                        className="app-split-vesu-apy"
                        title="From Vesu market stats (same lending protocol StarkZap exposes as wallet.lending() on Starknet)."
                      >
                        Vesu STRK supply APY:{" "}
                        <span className="font-mono">
                          {vesuStrkSupplyApy != null && Number.isFinite(vesuStrkSupplyApy)
                            ? `${(vesuStrkSupplyApy * 100).toFixed(2)}%`
                            : "—"}
                        </span>
                      </p>
                    )}
                    <label className="app-split-pct-field">
                      <span className="app-split-pct-field-label">Share %</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="app-split-pct-input-wide font-mono"
                        autoComplete="off"
                        value={pctDisplay}
                        onChange={(e) =>
                          setPctDrafts((d) => ({ ...d, [b.bpsKey]: e.target.value }))
                        }
                        onBlur={() => {
                          const key = b.bpsKey;
                          const draft = pctDrafts[key];
                          const raw = (draft !== undefined ? draft : bpsToPctFieldString(bps)).trim();
                          setPctDrafts((d) => {
                            const next = { ...d };
                            delete next[key];
                            return next;
                          });
                          if (raw === "") {
                            setBps(key, 0);
                            return;
                          }
                          const v = Number(raw);
                          if (Number.isFinite(v)) {
                            setBps(key, Math.round(Math.min(100, Math.max(0, v)) * 100));
                          }
                        }}
                      />
                    </label>
                    <p className="app-split-strk-slice font-mono">
                      ≈ {formatTokenAmount(slice, 18, 5)} STRK
                    </p>
                    {b.forwarding && (
                      <input
                        type="text"
                        className="app-split-fwd-input font-mono"
                        placeholder="Forward to 0x…"
                        value={config.cold_wallet_address}
                        onChange={(e) => setConfig((c) => ({ ...c, cold_wallet_address: e.target.value }))}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p
          className={`app-split-sum ${sumOk && !validationMsg ? "app-split-sum--ok" : "app-split-sum--bad"}`}
        >
          Enabled total {(sumBps / 100).toFixed(2)}%{sumOk && !validationMsg ? "" : " — need 100%"}
        </p>
        {showAllocExtraError && <p className="app-split-alloc-err">{validationMsg}</p>}
        <button
          type="button"
          className="app-split-secondary"
          onClick={() => {
            setConfig(DEFAULT_SPLIT_CONFIG);
            setThresholdDraft(String(DEFAULT_SPLIT_CONFIG.threshold_strk));
            setPctDrafts({});
          }}
        >
          Reset defaults
        </button>
      </section>
    </div>
  );
}
