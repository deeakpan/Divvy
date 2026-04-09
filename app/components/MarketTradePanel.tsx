"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { buildFpmmBuyCalls, sendWalletCalls } from "@/app/lib/marketTradeExecute";
import {
  formatCollateralRaw,
  getDivvyFpmmAddress,
  mulBpsDown,
  parseCollateralToRaw,
  splitU256,
} from "@/app/lib/trading";

export type MarketTradePanelMarket = {
  id: string;
  question: string;
  expiry_at: string;
};

const SLIPPAGE_OPTIONS = [50, 100, 200] as const;

function formatTxError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function fmtRatio(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

async function readDivvy(body: object) {
  const res = await fetch("/api/divvy-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const j = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !j.ok) throw new Error(j.error || "Read failed");
  return j as Record<string, string>;
}

export function MarketTradePanel({
  open,
  market,
  initialOutcomeYes,
  defaultAmount,
  address,
  wallet,
  method,
  isMobile,
  rpcUrl,
  onClose,
  onNeedConnect,
  onNotify,
  onMarketsUpdated,
}: {
  open: boolean;
  market: MarketTradePanelMarket | null;
  initialOutcomeYes: boolean;
  defaultAmount: string;
  address: string | null;
  wallet: unknown;
  method: "cartridge" | "browser" | null;
  isMobile: boolean;
  rpcUrl: string;
  onClose: () => void;
  onNeedConnect: () => void;
  onNotify: (message: string) => void;
  /** Called after a successful buy/sell so the parent can refetch pool sizes. */
  onMarketsUpdated?: () => void;
}) {
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [outcomeYes, setOutcomeYes] = useState(true);
  const [amountStr, setAmountStr] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [quoteOut, setQuoteOut] = useState<bigint | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [yesBal, setYesBal] = useState<bigint>(0n);
  const [noBal, setNoBal] = useState<bigint>(0n);
  const [usdcBal, setUsdcBal] = useState<bigint>(0n);
  const [usdcBalLoading, setUsdcBalLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expired = market ? Date.now() >= new Date(market.expiry_at).getTime() : true;

  useEffect(() => {
    if (!open || !market) return;
    setMode("buy");
    setOutcomeYes(initialOutcomeYes);
    setAmountStr(defaultAmount.trim() || "");
    setQuoteOut(null);
    setSlippageBps(100);
    setPanelError(null);
  }, [open, market?.id, initialOutcomeYes, defaultAmount, market]);

  const refreshBalances = useCallback(async () => {
    if (!open || !address) {
      setYesBal(0n);
      setNoBal(0n);
      setUsdcBal(0n);
      return;
    }
    setUsdcBalLoading(true);
    try {
      const uj = await readDivvy({ op: "erc20_balance", user: address });
      setUsdcBal(BigInt((uj as { balanceRaw?: string }).balanceRaw || "0"));
    } catch {
      setUsdcBal(0n);
    } finally {
      setUsdcBalLoading(false);
    }
    if (!market) {
      setYesBal(0n);
      setNoBal(0n);
      return;
    }
    try {
      const j = await readDivvy({
        op: "user_balances",
        marketId: market.id,
        user: address,
      });
      setYesBal(BigInt(j.yesRaw || "0"));
      setNoBal(BigInt(j.noRaw || "0"));
    } catch {
      setYesBal(0n);
      setNoBal(0n);
    }
  }, [open, market, address]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  useEffect(() => {
    setPanelError(null);
  }, [mode, outcomeYes]);

  useEffect(() => {
    if (!open || !market) return;
    const id = setInterval(() => void refreshBalances(), 25_000);
    return () => clearInterval(id);
  }, [open, market, refreshBalances]);

  useEffect(() => {
    if (!open || !market || expired) {
      setQuoteOut(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void (async () => {
        let raw: bigint;
        try {
          raw = parseCollateralToRaw(amountStr || "0");
        } catch {
          setQuoteOut(null);
          return;
        }
        if (raw <= 0n) {
          setQuoteOut(null);
          return;
        }

        setQuoteLoading(true);
        try {
          if (mode === "buy") {
            const j = await readDivvy({
              op: "preview_buy",
              marketId: market.id,
              outcomeYes,
              usdcRaw: raw.toString(),
            });
            setQuoteOut(BigInt(j.tokensOut || "0"));
          } else {
            const j = await readDivvy({
              op: "preview_sell",
              marketId: market.id,
              outcomeYes,
              tokensRaw: raw.toString(),
            });
            setQuoteOut(BigInt(j.usdcOut || "0"));
          }
        } catch {
          setQuoteOut(null);
        } finally {
          setQuoteLoading(false);
        }
      })();
    }, 320);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, market, amountStr, mode, outcomeYes, expired]);

  const sideBalance = mode === "buy" ? null : outcomeYes ? yesBal : noBal;

  const setMaxSell = () => {
    if (!sideBalance || sideBalance <= 0n) return;
    setAmountStr(formatCollateralRaw(sideBalance, 6));
  };

  const setMaxBuy = () => {
    if (usdcBal <= 0n) return;
    setAmountStr(formatCollateralRaw(usdcBal, 6));
  };

  const execute = async () => {
    setPanelError(null);
    if (!market || expired) return;
    if (!address || !wallet || !method) {
      onNeedConnect();
      return;
    }

    let raw: bigint;
    try {
      raw = parseCollateralToRaw(amountStr);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Invalid amount.";
      setPanelError(m);
      onNotify(m);
      return;
    }
    if (raw <= 0n) {
      const m = "Enter an amount greater than zero.";
      setPanelError(m);
      onNotify(m);
      return;
    }

    if (mode === "buy" && raw > usdcBal) {
      const m = `Insufficient USDC — wallet has ${formatCollateralRaw(usdcBal)} USDC.`;
      setPanelError(m);
      onNotify(m);
      return;
    }

    if (mode === "sell") {
      if (raw > sideBalance!) {
        const m = "Amount exceeds your position balance.";
        setPanelError(m);
        onNotify(m);
        return;
      }
    }

    const fpmm = getDivvyFpmmAddress();
    const idFelt = `0x${BigInt(market.id).toString(16)}`;
    const yesFelt = outcomeYes ? "0x1" : "0x0";

    if (quoteOut === null || quoteOut <= 0n) {
      const m = "No valid quote yet — wait a moment or adjust the amount.";
      setPanelError(m);
      onNotify(m);
      return;
    }

    if (quoteLoading) {
      const m = "Quote is updating — try again in a second.";
      setPanelError(m);
      onNotify(m);
      return;
    }

    const minOut = mulBpsDown(quoteOut, slippageBps);

    setBusy(true);

    try {
      if (mode === "buy") {
        const calls = buildFpmmBuyCalls(market.id, outcomeYes, raw, minOut);
        const tx = await sendWalletCalls(wallet, method, rpcUrl, address, calls);
        if (tx.switchedToUserPaysThisSession) {
          onNotify("Cartridge sponsorship unavailable for this account/session; switched to user-paid gas (STRK) for the rest of this session.");
        }
        onNotify(`Buy submitted (~${formatCollateralRaw(quoteOut)} tokens for ${amountStr} USDC).`);
      } else {
        const [inL, inH] = splitU256(raw);
        const [minL, minH] = splitU256(minOut);
        const calls = [
          {
            contractAddress: fpmm,
            entrypoint: "sell",
            calldata: [idFelt, yesFelt, inL, inH, minL, minH],
          },
        ];
        const tx = await sendWalletCalls(wallet, method, rpcUrl, address, calls);
        if (tx.switchedToUserPaysThisSession) {
          onNotify("Cartridge sponsorship unavailable for this account/session; switched to user-paid gas (STRK) for the rest of this session.");
        }
        onNotify(`Sell submitted (~${formatCollateralRaw(quoteOut)} USDC out).`);
      }

      void refreshBalances();
      onMarketsUpdated?.();
      onClose();
    } catch (e) {
      const m = formatTxError(e);
      setPanelError(m);
      onNotify(m);
    } finally {
      setBusy(false);
    }
  };

  if (!open || !market) return null;

  let parsedAmountRaw = 0n;
  const trimmedAmt = amountStr.trim();
  if (trimmedAmt) {
    try {
      parsedAmountRaw = parseCollateralToRaw(trimmedAmt);
    } catch {
      parsedAmountRaw = 0n;
    }
  }

  const quoteOk = quoteOut !== null && quoteOut > 0n && !quoteLoading;
  const usdcPerOutcomeBuy =
    mode === "buy" && quoteOk && parsedAmountRaw > 0n
      ? Number(parsedAmountRaw) / Number(quoteOut)
      : null;
  const usdcPerOutcomeSell =
    mode === "sell" && quoteOk && parsedAmountRaw > 0n
      ? Number(quoteOut) / Number(parsedAmountRaw)
      : null;

  const canSubmit = !busy && !expired && quoteOk && parsedAmountRaw > 0n;

  const shell = (
    <>
      <div
        onClick={() => {
          if (!busy) onClose();
        }}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15,23,42,0.18)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          pointerEvents: "auto",
        }}
      />
      <div
        style={
          isMobile
            ? {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "min(92dvh, 640px)",
                background: "rgba(255,255,255,0.98)",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                border: "1px solid rgba(186,230,253,0.85)",
                boxShadow: "0 -12px 40px rgba(96,165,250,0.18)",
                padding: "16px 16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                pointerEvents: "auto",
                overflow: "auto",
              }
            : {
                position: "absolute",
                top: 0,
                right: 0,
                height: "100%",
                width: "min(92vw, 380px)",
                background: "rgba(255,255,255,0.98)",
                borderLeft: "1px solid rgba(186,230,253,0.8)",
                boxShadow: "-18px 0 44px rgba(96,165,250,0.2)",
                padding: "18px 16px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                pointerEvents: "auto",
                overflow: "auto",
              }
        }
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f2d6b" }}>Trade</p>
          <button
            type="button"
            onClick={() => {
              if (!busy) onClose();
            }}
            style={{
              border: "none",
              background: "none",
              fontSize: 20,
              lineHeight: 1,
              color: "rgba(30,64,175,0.45)",
              cursor: busy ? "default" : "pointer",
            }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{market.question}</p>

        {expired && (
          <p style={{ margin: 0, fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
            This market has expired — trading is closed.
          </p>
        )}

        {address ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(248,250,252,0.95)",
              border: "1px solid rgba(226,232,240,0.95)",
              fontSize: 11,
              color: "#475569",
              fontFamily: "var(--font-geist-mono)",
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>Wallet USDC</span>{" "}
                <strong style={{ color: "#0f2d6b" }}>
                  {usdcBalLoading ? "…" : formatCollateralRaw(usdcBal)}
                </strong>
              </span>
              {mode === "sell" && (
                <span style={{ color: "#64748b" }}>
                  YES <strong style={{ color: "#15803d" }}>{formatCollateralRaw(yesBal)}</strong>
                  <span style={{ margin: "0 6px", color: "#cbd5e1" }}>·</span>
                  NO <strong style={{ color: "#dc2626" }}>{formatCollateralRaw(noBal)}</strong>
                </span>
              )}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Connect a wallet to trade.</p>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            fontFamily: "var(--font-geist-mono)",
          }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("buy")}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              cursor: busy ? "default" : "pointer",
              color: mode === "buy" ? "#1d4ed8" : "#94a3b8",
              textDecoration: mode === "buy" ? "underline" : "none",
              textUnderlineOffset: 4,
              textDecorationThickness: 2,
            }}
          >
            Buy
          </button>
          <span style={{ color: "rgba(148,163,184,0.6)", fontWeight: 400, userSelect: "none" }}>·</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("sell")}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              cursor: busy ? "default" : "pointer",
              color: mode === "sell" ? "#1d4ed8" : "#94a3b8",
              textDecoration: mode === "sell" ? "underline" : "none",
              textUnderlineOffset: 4,
              textDecorationThickness: 2,
            }}
          >
            Sell
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOutcomeYes(true)}
            style={{
              flex: 1,
              padding: "12px 8px",
              borderRadius: 12,
              border: outcomeYes ? "none" : "1px solid rgba(187,247,208,0.9)",
              background: outcomeYes ? "#16a34a" : "rgba(255,255,255,0.95)",
              color: outcomeYes ? "#ffffff" : "#15803d",
              fontWeight: 800,
              fontSize: 14,
              cursor: busy ? "default" : "pointer",
              boxShadow: outcomeYes ? "0 2px 12px rgba(22,163,74,0.35)" : "none",
            }}
          >
            YES
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOutcomeYes(false)}
            style={{
              flex: 1,
              padding: "12px 8px",
              borderRadius: 12,
              border: !outcomeYes ? "none" : "1px solid rgba(254,202,202,0.95)",
              background: !outcomeYes ? "#dc2626" : "rgba(255,255,255,0.95)",
              color: !outcomeYes ? "#ffffff" : "#dc2626",
              fontWeight: 800,
              fontSize: 14,
              cursor: busy ? "default" : "pointer",
              boxShadow: !outcomeYes ? "0 2px 12px rgba(220,38,38,0.35)" : "none",
            }}
          >
            NO
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder={mode === "buy" ? "USDC amount" : "Token amount"}
            value={amountStr}
            disabled={busy || expired}
            onChange={(e) => {
              setPanelError(null);
              setAmountStr(e.target.value);
            }}
            style={{
              flex: 1,
              borderRadius: 10,
              border: "1px solid rgba(186,230,253,0.9)",
              background: "rgba(255,255,255,0.95)",
              padding: "10px 12px",
              fontSize: 13,
              color: "#0f2d6b",
              outline: "none",
            }}
          />
          {mode === "buy" && (
            <button
              type="button"
              disabled={busy || expired || usdcBal <= 0n}
              onClick={setMaxBuy}
              style={{
                border: "1px solid rgba(37,99,235,0.35)",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 700,
                color: "#2563eb",
                background: "rgba(239,246,255,0.9)",
                cursor: busy || expired || usdcBal <= 0n ? "default" : "pointer",
                fontFamily: "var(--font-geist-mono)",
              }}
            >
              MAX
            </button>
          )}
          {mode === "sell" && (
            <button
              type="button"
              disabled={busy || expired}
              onClick={setMaxSell}
              style={{
                border: "1px solid rgba(37,99,235,0.35)",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 700,
                color: "#2563eb",
                background: "rgba(239,246,255,0.9)",
                cursor: busy || expired ? "default" : "pointer",
                fontFamily: "var(--font-geist-mono)",
              }}
            >
              MAX
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginRight: 4 }}>Slippage</span>
          {SLIPPAGE_OPTIONS.map((b) => (
            <button
              key={b}
              type="button"
              disabled={busy || expired}
              onClick={() => setSlippageBps(b)}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                border: slippageBps === b ? "1px solid rgba(37,99,235,0.5)" : "1px solid rgba(226,232,240,0.9)",
                background: slippageBps === b ? "rgba(219,234,254,0.7)" : "white",
                fontSize: 10,
                fontWeight: 700,
                color: "#475569",
                cursor: busy || expired ? "default" : "pointer",
                fontFamily: "var(--font-geist-mono)",
              }}
            >
              {b / 100}%
            </button>
          ))}
        </div>

        <div
          style={{
            padding: "12px 12px",
            borderRadius: 12,
            background: "rgba(239,246,255,0.65)",
            border: "1px solid rgba(186,230,253,0.6)",
            fontSize: 11,
            color: "#334155",
            fontFamily: "var(--font-geist-mono)",
            lineHeight: 1.55,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {quoteLoading && <span style={{ color: "#64748b" }}>Updating quote…</span>}
          {!quoteLoading && mode === "buy" && quoteOut !== null && quoteOut > 0n && parsedAmountRaw > 0n && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#64748b" }}>You pay</span>
                <strong>{formatCollateralRaw(parsedAmountRaw)} USDC</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#64748b" }}>You receive (est.)</span>
                <strong>
                  {formatCollateralRaw(quoteOut)} {outcomeYes ? "YES" : "NO"} tokens
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#64748b" }}>Avg. price</span>
                <span>
                  <strong>{fmtRatio(usdcPerOutcomeBuy ?? 0)}</strong> USDC / token
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, color: "#64748b" }}>
                <span>Min. after {slippageBps / 100}% slip</span>
                <span>{formatCollateralRaw(mulBpsDown(quoteOut, slippageBps))} tokens</span>
              </div>
            </>
          )}
          {!quoteLoading && mode === "sell" && quoteOut !== null && quoteOut > 0n && parsedAmountRaw > 0n && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#64748b" }}>You sell</span>
                <strong>
                  {formatCollateralRaw(parsedAmountRaw)} {outcomeYes ? "YES" : "NO"} tokens
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#64748b" }}>You receive (est.)</span>
                <strong>{formatCollateralRaw(quoteOut)} USDC</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#64748b" }}>Avg. price</span>
                <span>
                  <strong>{fmtRatio(usdcPerOutcomeSell ?? 0)}</strong> USDC / token
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, color: "#64748b" }}>
                <span>Min. USDC after {slippageBps / 100}% slip</span>
                <span>{formatCollateralRaw(mulBpsDown(quoteOut, slippageBps))}</span>
              </div>
            </>
          )}
          {!quoteLoading && (quoteOut === null || quoteOut <= 0n) && !expired && (
            <span style={{ color: "#94a3b8" }}>Enter an amount to preview.</span>
          )}
        </div>

        {panelError && (
          <p
            style={{
              margin: 0,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(254,242,242,0.9)",
              border: "1px solid rgba(252,165,165,0.7)",
              fontSize: 11,
              lineHeight: 1.45,
              color: "#b91c1c",
              fontFamily: "var(--font-geist-mono)",
              wordBreak: "break-word",
            }}
          >
            {panelError}
          </p>
        )}

        {method === "cartridge" && (
          <p style={{ margin: 0, fontSize: 10, color: "#94a3b8", lineHeight: 1.45 }}>
            Policies are agreed at connect (session). After an app update, disconnect and connect once if trades fail.
            Matching txs try Cartridge paymaster first (often gasless on testnet), then fall back to your STRK balance.
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void execute()}
          style={{
            marginTop: 4,
            border: "none",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 13,
            fontWeight: 800,
            color: "#fff",
            background: !canSubmit ? "rgba(37,99,235,0.35)" : "#2563eb",
            cursor: !canSubmit ? "default" : "pointer",
            letterSpacing: "0.04em",
          }}
        >
          {busy ? "Signing…" : mode === "buy" ? "Approve & buy" : "Sell"}
        </button>
      </div>
    </>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 110, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>{shell}</div>
    </div>
  );
}
