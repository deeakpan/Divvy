"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "../components/WalletContext";
import { WalletConnectOptions } from "../components/WalletConnectOptions";
import { RPC_URL } from "../lib/constants";

type Market = {
  id: string;
  question: string;
  asset: string;
  logo: string;
  expiry_at: string;
  yes_pool: number;
  no_pool: number;
  status: string;
};

const ASSET_LOGO: Record<string, string> = {
  ETH:  "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  BTC:  "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  STRK: "https://assets.coingecko.com/coins/images/26433/small/starknet.png",
};

function round(n: number, sig: number) {
  const m = Math.pow(10, Math.floor(Math.log10(n)) - sig + 1);
  return Math.round(n / m) * m;
}

function fmtPrice(n: number) {
  return n >= 1000
    ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function daysFromNow(d: number) {
  const t = new Date(Date.now() + d * 86_400_000);
  t.setUTCHours(20, 0, 0, 0);
  return t.toISOString();
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtUTC(iso: string) {
  const d = new Date(iso);
  return `${ordinal(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")} UTC`;
}
function ordinal(n: number) {
  if (n === 1 || n === 21 || n === 31) return `${n}st`;
  if (n === 2 || n === 22) return `${n}nd`;
  if (n === 3 || n === 23) return `${n}rd`;
  return `${n}th`;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function fmtCountdown(expiry: string) {
  const ms = new Date(expiry).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d:${String(h).padStart(2,"0")}h:${String(m).padStart(2,"0")}m`;
  return `${String(h).padStart(2,"0")}h:${String(m).padStart(2,"0")}m`;
}

function fmtPool(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n/1_000).toFixed(1)}K`;
  return String(n);
}

function CornerArc({ pct, color }: { pct: number; color: string }) {
  const size = 190;
  const r = 76;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const filled = (pct / 100) * C;
  // Center the circle exactly on the card's top-right corner so the
  // bottom-left quadrant is fully visible inside the card.
  return (
    <div style={{
      position: "absolute",
      top: -(size / 2),
      right: -(size / 2),
      width: size,
      height: size,
      pointerEvents: "none",
      zIndex: 2,
    }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}>
        {/* track — light blue tint */}
        <circle cx={cx} cy={cy} r={r} fill="rgba(219,234,254,0.35)"
          stroke="rgba(147,197,253,0.3)" strokeWidth="7" />
        {/* filled arc */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="7" opacity="0.65"
          strokeDasharray={`${filled} ${C - filled}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color}60)` }} />
      </svg>
      <div style={{
        position: "absolute", bottom: 52, left: 48,
        display: "flex", alignItems: "baseline",
      }}>
        <span style={{
          fontSize: 15, fontWeight: 800, color,
          letterSpacing: "-0.04em", opacity: 0.85,
        }}>{pct}<span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>%</span></span>
      </div>
    </div>
  );
}

// ── Market card ───────────────────────────────────────────────────────────────

function MarketCard({
  market, showButtons, onVote, style, onTouchStart, onTouchMove, onTouchEnd,
}: {
  market: Market; showButtons: boolean; onVote: (yes: boolean) => void;
  style?: React.CSSProperties;
  onTouchStart?: React.TouchEventHandler;
  onTouchMove?: React.TouchEventHandler;
  onTouchEnd?: React.TouchEventHandler;
}) {
  const total = (market.yes_pool ?? 0) + (market.no_pool ?? 0);
  const yesPct = total > 0 ? Math.round((market.yes_pool / total) * 100) : 50;
  const noPct = 100 - yesPct;
  const yesLeads = yesPct >= noPct;
  const arcPct = yesLeads ? yesPct : noPct;
  const arcColor = yesLeads ? "#16a34a" : "#dc2626";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 28,
        border: hovered ? "1px solid rgba(147,197,253,0.9)" : "1px solid rgba(186,230,253,0.7)",
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: hovered
          ? "0 12px 48px rgba(96,165,250,0.2), inset 0 1px 0 rgba(255,255,255,1)"
          : "0 4px 24px rgba(96,165,250,0.1), inset 0 1px 0 rgba(255,255,255,0.9)",
        overflow: "hidden",
        position: "relative",
        userSelect: "none",
        transition: "border-color 0.18s, box-shadow 0.18s, transform 0.18s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        cursor: "pointer",
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Arc gauge — centered on top-right corner, bleeds off edge */}
      <CornerArc pct={arcPct} color={arcColor} />

      <div style={{ padding: "22px 22px 20px", position: "relative", zIndex: 2 }}>
        {/* Top row: asset logo + name + timer pill (left-aligned) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={market.logo}
            alt={market.asset}
            width={36}
            height={36}
            style={{ borderRadius: "50%", border: "1.5px solid rgba(186,230,253,0.7)", flexShrink: 0 }}
          />
          <span style={{
            fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
            color: "#1e40af", textTransform: "uppercase",
            fontFamily: "var(--font-geist-mono)",
          }}>
            {market.asset}
          </span>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px 4px 8px",
            borderRadius: 999,
            border: "1px solid rgba(186,230,253,0.7)",
            background: "rgba(219,234,254,0.5)",
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="rgba(30,64,175,0.4)" strokeWidth="1.2"/>
              <path d="M5 2.5V5L6.5 6.5" stroke="rgba(30,64,175,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(30,64,175,0.7)", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.04em" }}>
              {fmtCountdown(market.expiry_at)}
            </span>
          </div>
        </div>

        {/* Volume + closes */}
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "#2563eb", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.03em" }}>
          <span style={{ fontWeight: 700 }}>{fmtPool(total)} USDC Vol.</span>
          <span style={{ color: "#94a3b8", marginLeft: 8 }}>Closes {fmtUTC(market.expiry_at)}</span>
        </p>

        {/* Question */}
        <p style={{
          margin: "0 0 20px",
          fontSize: 19, fontWeight: 800, color: "#0f2d6b",
          lineHeight: 1.4, letterSpacing: "-0.02em",
          paddingRight: 48,
        }}>
          {market.question}
        </p>

        {/* Buttons */}
        {showButtons && (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => onVote(true)} style={{
              flex: 1, padding: "13px 8px", borderRadius: 14,
              border: "1px solid rgba(34,197,94,0.4)",
              background: "rgba(220,252,231,0.8)",
              color: "#15803d", fontWeight: 800, fontSize: 15,
              letterSpacing: "0.06em", cursor: "pointer",
              transition: "background 0.15s, box-shadow 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 2px 8px rgba(34,197,94,0.12)",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(187,247,208,0.95)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(34,197,94,0.22)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,252,231,0.8)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(34,197,94,0.12)"; }}
            >
              YES
              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75, fontFamily: "var(--font-geist-mono)" }}>{yesPct}%</span>
            </button>
            <button onClick={() => onVote(false)} style={{
              flex: 1, padding: "13px 8px", borderRadius: 14,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(254,226,226,0.7)",
              color: "#dc2626", fontWeight: 800, fontSize: 15,
              letterSpacing: "0.06em", cursor: "pointer",
              transition: "background 0.15s, box-shadow 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 2px 8px rgba(239,68,68,0.1)",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(254,202,202,0.9)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(239,68,68,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(254,226,226,0.7)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(239,68,68,0.1)"; }}
            >
              NO
              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75, fontFamily: "var(--font-geist-mono)" }}>{noPct}%</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Swipeable wrapper (mobile) ────────────────────────────────────────────────

function SwipeCard({ market, onVote }: { market: Market; onVote: (yes: boolean) => void }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);
  const THRESHOLD = 90;

  const yesOpacity = Math.min(1, Math.max(0, offset / THRESHOLD));
  const noOpacity  = Math.min(1, Math.max(0, -offset / THRESHOLD));

  return (
    <div style={{ position: "relative", width: "100%", touchAction: "pan-y" }}>
      {/* hint labels */}
      <div style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", opacity: yesOpacity, pointerEvents: "none", zIndex: 2 }}>
        <span style={{ color: "#15803d", fontWeight: 800, fontSize: 20, letterSpacing: 3 }}>YES →</span>
      </div>
      <div style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", opacity: noOpacity, pointerEvents: "none", zIndex: 2 }}>
        <span style={{ color: "#dc2626", fontWeight: 800, fontSize: 20, letterSpacing: 3 }}>← NO</span>
      </div>

      <MarketCard
        market={market}
        showButtons={false}
        onVote={onVote}
        style={{
          transform: `translateX(${offset}px) rotate(${offset * 0.018}deg)`,
          transition: dragging.current ? "none" : "transform 0.28s ease",
          willChange: "transform",
          border: offset > 20
            ? "1px solid rgba(34,197,94,0.5)"
            : offset < -20
            ? "1px solid rgba(239,68,68,0.5)"
            : "1px solid rgba(186,230,253,0.7)",
        }}
        onTouchStart={e => {
          startX.current = e.touches[0].clientX;
          dragging.current = true;
        }}
        onTouchMove={e => {
          if (!dragging.current) return;
          setOffset(e.touches[0].clientX - startX.current);
        }}
        onTouchEnd={() => {
          dragging.current = false;
          if (Math.abs(offset) > THRESHOLD) onVote(offset > 0);
          setOffset(0);
        }}
      />
    </div>
  );
}

// ── Default trade amount ──────────────────────────────────────────────────────

const TRADE_AMOUNT_KEY = "divvy_default_trade";

function useDefaultTradeAmount(): [string, (v: string) => void] {
  const [amount, setAmountState] = useState("1.00");

  useEffect(() => {
    const saved = localStorage.getItem(TRADE_AMOUNT_KEY);
    if (saved) setAmountState(saved);
  }, []);

  const setAmount = (v: string) => {
    setAmountState(v);
    localStorage.setItem(TRADE_AMOUNT_KEY, v);
  };

  return [amount, setAmount];
}

// ── Header ────────────────────────────────────────────────────────────────────

const USDC_ADDRESS = "0x0715649d4c493ca350743e43915b88d2e6838b1c78ddc23d6d9385446b9d6844";

function parseUsdcToRaw(input: string): bigint {
  const s = input.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(s)) throw new Error("Enter a valid USDC amount (up to 6 decimals).");
  const [whole, frac = ""] = s.split(".");
  const w = BigInt(whole || "0");
  const f = BigInt((frac + "000000").slice(0, 6));
  return w * 1_000_000n + f;
}

function useUSDCBalance(address: string | null) {
  const [balance, setBalance] = useState<string | null>(null);
  useEffect(() => {
    if (!address) { setBalance(null); return; }
    let cancelled = false;
    const poll = () => {
      const qs = new URLSearchParams({ token: USDC_ADDRESS, account: address });
      fetch(`/api/balance?${qs}`, { cache: "no-store" })
        .then(r => r.json())
        .then((d: { low?: string; high?: string }) => {
          if (cancelled) return;
          const wei = BigInt(d.low ?? "0x0") + (BigInt(d.high ?? "0x0") << 128n);
          const num = Number(wei) / 1e6;
          setBalance(num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [address]);
  return balance;
}

function Header({
  onBack,
  onConnect,
  tradeAmount,
  setTradeAmount,
}: {
  onBack: () => void;
  onConnect: () => void;
  tradeAmount: string;
  setTradeAmount: (v: string) => void;
}) {
  const { address, wallet, method, disconnect, connecting } = useWallet();
  const isMobile = useIsMobile();
  const usdcBalance = useUSDCBalance(address);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [faucetOpen, setFaucetOpen] = useState(false);
  const [faucetAmount, setFaucetAmount] = useState("100");
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;
  const sep = <span style={{ width: 1, height: 16, background: "rgba(147,197,253,0.5)", flexShrink: 0 }} />;

  const h1 = address ? parseInt(address.slice(2,  6), 16) % 360 : 220;
  const h2 = address ? parseInt(address.slice(6, 10), 16) % 360 : 260;
  const h3 = address ? parseInt(address.slice(10,14), 16) % 360 : 200;
  const s1 = address ? 55 + (parseInt(address.slice(14,16), 16) % 25) : 70;
  const avatarGrad = address
    ? `linear-gradient(135deg, hsl(${h1},${s1}%,55%) 0%, hsl(${h2},${s1+10}%,42%) 50%, hsl(${h3},${s1+5}%,35%) 100%)`
    : "rgba(200,220,255,0.5)";
  const avatarGlow = address ? `hsla(${h1},${s1}%,55%,0.4)` : "rgba(96,165,250,0.1)";

  // Close on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleMintFaucet = async () => {
    if (!address || !wallet || !method) {
      setFaucetMsg("Connect wallet first.");
      return;
    }
    let raw: bigint;
    try {
      raw = parseUsdcToRaw(faucetAmount);
    } catch (e) {
      setFaucetMsg(e instanceof Error ? e.message : "Invalid amount.");
      return;
    }
    const maxRaw = 1000n * 1_000_000n;
    if (raw <= 0n) {
      setFaucetMsg("Amount must be greater than 0.");
      return;
    }
    if (raw > maxRaw) {
      setFaucetMsg("Max faucet mint is 1000 USDC.");
      return;
    }

    setFaucetBusy(true);
    setFaucetMsg(null);
    const low = (raw & ((1n << 128n) - 1n)).toString();
    const high = (raw >> 128n).toString();
    const call = {
      contractAddress: USDC_ADDRESS,
      entrypoint: "mint",
      calldata: [address, low, high],
    };
    try {
      if (method === "cartridge") {
        const cw = wallet as { execute: (c: Array<{ contractAddress: string; entrypoint: string; calldata: string[] }>) => Promise<{ hash: string }> };
        await cw.execute([call]);
      } else {
        const { WalletAccount, RpcProvider: Provider } = await import("starknet");
        const provider = new Provider({ nodeUrl: RPC_URL });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = new WalletAccount({ provider, walletProvider: wallet as any, address });
        await account.execute([call]);
      }
      setFaucetMsg(`Successfully minted ${faucetAmount} USDC.`);
    } catch (e) {
      setFaucetMsg(e instanceof Error ? e.message : "Mint failed.");
    } finally {
      setFaucetBusy(false);
    }
  };

  return (
    <div style={{
      position: "sticky", top: 16, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "auto",
      padding: "0 16px",
    }}>
      {/* Centred pill nav */}
      <nav style={{
        pointerEvents: "auto",
        display: "flex", alignItems: "center", gap: isMobile ? 7 : 10,
        padding: isMobile ? "7px 10px" : "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(186,230,253,0.8)",
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 4px 24px rgba(96,165,250,0.15), inset 0 1px 0 rgba(255,255,255,1)",
        maxWidth: "calc(100vw - 100px)",
        minWidth: 0,
      }}>
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bluedivvy.png" alt="" width={24} height={24} style={{ borderRadius: 4, objectFit: "contain" }} />
          {!isMobile && (
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", color: "#1e3a5f" }}>Divvy</span>
          )}
        </button>

        {sep}

        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          color: "#2563eb", textTransform: "uppercase",
          fontFamily: "var(--font-geist-mono)", flexShrink: 0,
        }}>
          Sepolia
        </span>
        {sep}
        <button
          onClick={() => { setFaucetOpen(true); setFaucetMsg(null); }}
          disabled={!address}
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            color: address ? "#1d4ed8" : "rgba(30,64,175,0.3)",
            background: "none", border: "none", cursor: address ? "pointer" : "default",
            padding: 0, textTransform: "uppercase", fontFamily: "var(--font-geist-mono)",
          }}
          onMouseEnter={e => { if (address) e.currentTarget.style.color = "#1e40af"; }}
          onMouseLeave={e => { e.currentTarget.style.color = address ? "#1d4ed8" : "rgba(30,64,175,0.3)"; }}
        >
          Faucet
        </button>

        {address ? (
          <>
            {sep}
            <span style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontFamily: "var(--font-geist-mono)",
              color: "#1e3a5f", flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 5px rgba(52,211,153,0.6)", flexShrink: 0 }} />
              {short}
            </span>
            <button
              onClick={disconnect}
              style={{
                fontSize: isMobile ? 14 : 10,
                fontWeight: 600, color: "rgba(30,64,175,0.4)",
                background: "none", border: "none", cursor: "pointer",
                padding: isMobile ? "0 2px" : "2px 6px",
                borderRadius: 6, transition: "color 0.15s", flexShrink: 0, lineHeight: 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#dc2626")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(30,64,175,0.4)")}
            >
              {isMobile ? "×" : "Disconnect"}
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
              color: connecting ? "rgba(30,64,175,0.3)" : "#1d4ed8",
              background: "none", border: "none",
              cursor: connecting ? "default" : "pointer",
              padding: 0, transition: "color 0.15s", flexShrink: 0,
            }}
            onMouseEnter={e => { if (!connecting) e.currentTarget.style.color = "#1e40af"; }}
            onMouseLeave={e => { e.currentTarget.style.color = connecting ? "rgba(30,64,175,0.3)" : "#1d4ed8"; }}
          >
            {connecting ? "Connecting…" : "Connect"}
          </button>
        )}
      </nav>

      {/* Avatar + profile modal */}
      <div ref={profileRef} style={{
        pointerEvents: "auto",
        position: "absolute", right: 16,
        display: "flex", alignItems: "center",
      }}>
        {/* Avatar button */}
        <button
          onClick={() => setProfileOpen(o => !o)}
          style={{
            position: "relative", width: 40, height: 40, borderRadius: "50%",
            background: avatarGrad,
            border: "1.5px solid rgba(186,230,253,0.8)",
            boxShadow: address
              ? `0 0 0 2px rgba(255,255,255,0.8), 0 4px 18px ${avatarGlow}`
              : "0 0 0 2px rgba(255,255,255,0.8), 0 4px 16px rgba(96,165,250,0.15)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "box-shadow 0.18s, transform 0.18s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          {!address && (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="7" r="3.2" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/>
              <path d="M2.5 16c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
          {address && (
            <span style={{
              position: "absolute", bottom: 1, right: 1,
              width: 9, height: 9, borderRadius: "50%",
              background: "#34d399",
              border: "1.5px solid rgba(255,255,255,0.9)",
              boxShadow: "0 0 6px rgba(52,211,153,0.7)",
            }} />
          )}
        </button>

        {/* Profile dropdown */}
        {profileOpen && (
          <div style={{
            position: "absolute", top: 50, right: 0,
            width: 260,
            background: "rgba(255,255,255,0.97)",
            border: "1px solid rgba(186,230,253,0.8)",
            borderRadius: 20,
            boxShadow: "0 12px 40px rgba(96,165,250,0.2), inset 0 1px 0 rgba(255,255,255,1)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            overflow: "hidden",
            animation: "profileIn 0.18s cubic-bezier(0.34,1.2,0.64,1)",
          }}>
            <style>{`@keyframes profileIn { from { opacity:0; transform:scale(0.92) translateY(-6px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>

            {/* Gradient header */}
            <div style={{
              padding: "18px 16px 14px",
              background: `linear-gradient(160deg, rgba(219,234,254,0.6) 0%, rgba(255,255,255,0) 100%)`,
              borderBottom: "1px solid rgba(186,230,253,0.5)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Mini avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: avatarGrad,
                  border: "2px solid rgba(255,255,255,0.9)",
                  boxShadow: `0 0 0 1.5px rgba(186,230,253,0.7), 0 4px 14px ${avatarGlow}`,
                  flexShrink: 0,
                  position: "relative",
                }}>
                  <span style={{
                    position: "absolute", bottom: 1, right: 1,
                    width: 9, height: 9, borderRadius: "50%",
                    background: "#34d399",
                    border: "1.5px solid rgba(255,255,255,0.9)",
                  }} />
                </div>
                {/* Address + copy */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    onClick={copyAddress}
                    title="Click to copy full address"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      cursor: "pointer", userSelect: "none",
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.opacity = "0.65")}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.opacity = "1")}
                  >
                    <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "#1e3a5f", fontWeight: 600 }}>
                      {address ? `${address.slice(0, 8)}…${address.slice(-6)}` : "—"}
                    </span>
                    {copied
                      ? <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>✓</span>
                      : <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ color: "#94a3b8" }}>
                          <rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M3 11V3a2 2 0 0 1 2-2h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                    }
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: "#94a3b8", fontFamily: "var(--font-geist-mono)", marginTop: 1 }}>Starknet Sepolia</p>
                </div>
                {/* Settings gear */}
                <button
                  onClick={() => setSettingsOpen(o => !o)}
                  title="Settings"
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    border: settingsOpen ? "1px solid rgba(147,197,253,0.9)" : "1px solid rgba(186,230,253,0.6)",
                    background: settingsOpen ? "rgba(219,234,254,0.8)" : "rgba(239,246,255,0.5)",
                    color: "#2563eb", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s", flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(219,234,254,0.8)"; e.currentTarget.style.borderColor = "rgba(147,197,253,0.9)"; }}
                  onMouseLeave={e => { if (!settingsOpen) { e.currentTarget.style.background = "rgba(239,246,255,0.5)"; e.currentTarget.style.borderColor = "rgba(186,230,253,0.6)"; }}}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Stats section */}
            {!settingsOpen && (
              <div style={{ padding: "4px 0 0" }}>
                {[
                  { label: "Balance", value: usdcBalance !== null ? `$${usdcBalance}` : "—", unit: "USDC", color: "#0f2d6b" },
                  { label: "Yield earned", value: "—", unit: "USDC", color: "#16a34a" },
                  { label: "PNL", value: "—", unit: "", color: "#0f2d6b" },
                  { label: "Win rate", value: "—", unit: "", color: "#0f2d6b" },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 16px",
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(186,230,253,0.35)" : "none",
                  }}>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, letterSpacing: "0.01em" }}>{row.label}</span>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: row.color, fontFamily: "var(--font-geist-mono)" }}>{row.value}</span>
                      {row.unit && <span style={{ fontSize: 9, fontWeight: 600, color: "#2563eb", fontFamily: "var(--font-geist-mono)", opacity: 0.7 }}>{row.unit}</span>}
                    </span>
                  </div>
                ))}

                {/* Trades nav row */}
                <div style={{ borderTop: "1px solid rgba(186,230,253,0.35)", margin: "0 0 0 0" }}>
                  {[{ icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, label: "Trades" }].map(item => (
                    <div key={item.label} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "11px 16px",
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "rgba(219,234,254,0.35)")}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {item.icon}
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#1e3a5f" }}>{item.label}</span>
                      </span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  ))}
                </div>

                {/* Sign out */}
                <div style={{ padding: "8px 10px 10px" }}>
                  <button
                    onClick={() => { disconnect(); setProfileOpen(false); }}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 10,
                      border: "1px solid rgba(239,68,68,0.2)",
                      background: "rgba(254,226,226,0.5)",
                      color: "#dc2626", fontSize: 11, fontWeight: 700,
                      letterSpacing: "0.02em", cursor: "pointer",
                      transition: "background 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(254,202,202,0.8)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(254,226,226,0.5)")}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}

            {/* Settings panel */}
            {settingsOpen && (
              <div style={{ padding: "10px 16px 14px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase", fontFamily: "var(--font-geist-mono)" }}>Settings</p>

                {/* Default trade row */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 0",
                  borderBottom: "1px solid rgba(186,230,253,0.4)",
                }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Default trade</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", fontFamily: "var(--font-geist-mono)" }}>$</span>
                    <input
                      type="number" min="0.01" step="0.5"
                      value={tradeAmount}
                      onChange={e => setTradeAmount(e.target.value)}
                      style={{
                        width: 52, border: "none", background: "transparent",
                        fontSize: 13, fontWeight: 700, color: "#0f2d6b",
                        outline: "none", fontFamily: "var(--font-geist-mono)",
                        textAlign: "right", padding: 0,
                      }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#2563eb", fontFamily: "var(--font-geist-mono)", marginLeft: 3 }}>USDC</span>
                  </span>
                </div>

                <p style={{ margin: "10px 0 0", fontSize: 10, color: "#94a3b8", fontFamily: "var(--font-geist-mono)", lineHeight: 1.5 }}>
                  This amount is used when you swipe on a market.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {faucetOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !faucetBusy) setFaucetOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 120,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
            background: "rgba(219,234,254,0.58)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div style={{
            width: "100%", maxWidth: 360,
            background: "rgba(255,255,255,0.98)",
            border: "1px solid rgba(186,230,253,0.8)",
            borderRadius: 18,
            padding: "18px 16px 14px",
            boxShadow: "0 24px 60px rgba(96,165,250,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f2d6b" }}>USDC Faucet</p>
              <button
                onClick={() => { if (!faucetBusy) setFaucetOpen(false); }}
                style={{ background: "none", border: "none", color: "rgba(30,64,175,0.45)", fontSize: 18, cursor: faucetBusy ? "default" : "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: "#64748b", fontFamily: "var(--font-geist-mono)" }}>
              Enter amount (max 1000 USDC)
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                min="0.000001"
                max="1000"
                step="0.000001"
                value={faucetAmount}
                onChange={(e) => setFaucetAmount(e.target.value)}
                disabled={faucetBusy}
                style={{
                  flex: 1, borderRadius: 10, border: "1px solid rgba(186,230,253,0.9)",
                  background: "rgba(255,255,255,0.9)", padding: "10px 12px",
                  fontSize: 13, color: "#0f2d6b", outline: "none",
                }}
              />
              <button
                onClick={() => void handleMintFaucet()}
                disabled={faucetBusy}
                style={{
                  border: "none", borderRadius: 10, padding: "0 14px",
                  fontSize: 12, fontWeight: 700, color: "#fff",
                  background: faucetBusy ? "rgba(37,99,235,0.45)" : "#2563eb",
                  cursor: faucetBusy ? "default" : "pointer",
                }}
              >
                {faucetBusy ? "Minting…" : "Mint"}
              </button>
            </div>
            {faucetMsg && (
              <p style={{
                margin: "10px 0 0", fontSize: 11, lineHeight: 1.45,
                color: faucetMsg.toLowerCase().includes("successfully") ? "#16a34a" : "#dc2626",
                fontFamily: "var(--font-geist-mono)",
              }}>
                {faucetMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bottom nav ────────────────────────────────────────────────────────────────

type Tab = "markets" | "yield" | "trades" | "leaderboard";

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "markets",
    label: "Markets",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="9" width="3" height="7" rx="1" fill="currentColor" opacity="0.9"/>
        <rect x="7.5" y="5" width="3" height="11" rx="1" fill="currentColor"/>
        <rect x="13" y="2" width="3" height="14" rx="1" fill="currentColor" opacity="0.9"/>
      </svg>
    ),
  },
  {
    id: "yield",
    label: "Yield",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 13 C5 13 5 5 9 5 C13 5 13 13 16 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <circle cx="9" cy="5" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "trades",
    label: "Trades",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 6h12M3 6l3-3M3 6l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 12H3M15 12l-3-3M15 12l-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "leaderboard",
    label: "Ranks",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2l1.8 3.6L15 6.3l-3 2.9.7 4.1L9 11.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7L9 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
];

function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80,
      display: "flex", justifyContent: "center",
      padding: "0 16px 0",
      background: "linear-gradient(to top, rgba(240,247,255,0.98) 60%, rgba(240,247,255,0) 100%)",
      paddingBottom: "max(16px, env(safe-area-inset-bottom))",
    }}>
      <div style={{
        display: "flex",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(186,230,253,0.8)",
        borderRadius: 999,
        padding: "6px 6px",
        gap: 2,
        boxShadow: "0 4px 24px rgba(96,165,250,0.15), inset 0 1px 0 rgba(255,255,255,1)",
      }}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                background: isActive ? "#2563eb" : "transparent",
                color: isActive ? "#fff" : "rgba(30,64,175,0.45)",
                cursor: "pointer",
                transition: "background 0.18s, color 0.18s",
                boxShadow: isActive ? "0 4px 14px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.2)" : "none",
                minWidth: 64,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "#1d4ed8"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "rgba(30,64,175,0.45)"; }}
            >
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em" }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Tab content placeholders ───────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "80px 24px", textAlign: "center",
    }}>
      <p style={{ fontSize: 28, fontWeight: 800, color: "rgba(30,64,175,0.12)", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
        {label}
      </p>
      <p style={{ fontSize: 12, color: "rgba(30,64,175,0.28)", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.08em" }}>
        COMING SOON
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppPage() {
  const { address, wallet, method } = useWallet();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("markets");
  const [tradeAmount, setTradeAmount] = useDefaultTradeAmount();
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeMarket, setTradeMarket] = useState<Market | null>(null);
  const [tradeYes, setTradeYes] = useState(true);
  const [tradeInput, setTradeInput] = useState("");
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeMsg, setTradeMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/markets")
      .then(r => r.json())
      .then((mData: { markets?: Array<Omit<Market, "logo"> & { logo?: string }> }) => {
        const apiMarkets = (mData.markets ?? []).map((m) => ({
          ...m,
          logo: m.logo || ASSET_LOGO[m.asset] || ASSET_LOGO.ETH,
        }));
        setMarkets(apiMarkets);
      })
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, []);

  const executeBuy = async (market: Market, yes: boolean, amountInput: string, fromDrawer = false) => {
    if (!address || !wallet || !method) {
      setConnectOpen(true);
      return;
    }
    let raw: bigint;
    try {
      raw = parseUsdcToRaw(amountInput);
    } catch (e) {
      setTradeMsg(e instanceof Error ? e.message : "Invalid amount.");
      return;
    }
    if (raw <= 0n) {
      setTradeMsg("Amount must be greater than 0.");
      return;
    }

    const low = (raw & ((1n << 128n) - 1n)).toString();
    const high = (raw >> 128n).toString();
    const calls = [
      {
        contractAddress: USDC_ADDRESS,
        entrypoint: "approve",
        calldata: [process.env.NEXT_PUBLIC_DIVVY_FPMM ?? "", low, high],
      },
      {
        contractAddress: process.env.NEXT_PUBLIC_DIVVY_FPMM ?? "",
        entrypoint: "buy",
        calldata: [market.id, yes ? "0x1" : "0x0", low, high, "0", "0"],
      },
    ];

    if (!calls[0].contractAddress) {
      setTradeMsg("Missing NEXT_PUBLIC_DIVVY_FPMM in env.");
      return;
    }

    setTradeBusy(true);
    setTradeMsg(null);
    try {
      if (method === "cartridge") {
        const cw = wallet as { execute: (c: Array<{ contractAddress: string; entrypoint: string; calldata: string[] }>) => Promise<{ hash: string }> };
        await cw.execute(calls);
      } else {
        const { WalletAccount, RpcProvider: Provider } = await import("starknet");
        const provider = new Provider({ nodeUrl: RPC_URL });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = new WalletAccount({ provider, walletProvider: wallet as any, address });
        await account.execute(calls);
      }
      const side = yes ? "YES" : "NO";
      const success = `Trade submitted: ${side} ${amountInput} USDC on "${market.asset}"`;
      setTradeMsg(success);
      if (fromDrawer) setTradeOpen(false);
    } catch (e) {
      setTradeMsg(e instanceof Error ? e.message : "Trade failed.");
    } finally {
      setTradeBusy(false);
    }
  };

  const handleVote = (market: Market, yes: boolean) => {
    if (!address || !wallet || !method) {
      setConnectOpen(true);
      return;
    }
    // If a default amount exists, execute immediately (sign only).
    try {
      const raw = parseUsdcToRaw(tradeAmount);
      if (raw > 0n) {
        void executeBuy(market, yes, tradeAmount);
        return;
      }
    } catch {
      // Fall back to drawer input.
    }
    if (!isMobile) {
      setTradeMarket(market);
      setTradeYes(yes);
      setTradeInput("");
      setTradeMsg(null);
      setTradeOpen(true);
      return;
    }
    setTradeMsg("Set a default trade amount in profile settings for swipe trading.");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 100% 60% at 50% -10%, #bfdbfe 0%, transparent 60%), radial-gradient(ellipse 80% 50% at 10% 20%, #dbeafe 0%, transparent 55%), linear-gradient(175deg, #f0f7ff 0%, #f8fbff 40%, #ffffff 100%)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }} />

      <BottomNav active={activeTab} onChange={setActiveTab} />

      <div style={{ position: "relative", zIndex: 1, padding: "16px 16px 100px" }}>
        <Header
          onBack={() => router.push("/")}
          onConnect={() => setConnectOpen(true)}
          tradeAmount={tradeAmount}
          setTradeAmount={setTradeAmount}
        />

        {tradeMsg && (
          <p
            style={{
              maxWidth: 520,
              margin: "12px auto 0",
              fontSize: 11,
              lineHeight: 1.45,
              color: tradeMsg.toLowerCase().includes("submitted") ? "#15803d" : "#dc2626",
              fontFamily: "var(--font-geist-mono)",
              textAlign: "center",
            }}
          >
            {tradeMsg}
          </p>
        )}

        {connectOpen && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setConnectOpen(false); }}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
              background: "rgba(219,234,254,0.6)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              animation: "cwOverlayIn 0.18s ease",
            }}
          >
            <style>{`@keyframes cwOverlayIn { from { opacity:0 } to { opacity:1 } }`}</style>
            <div style={{
              position: "relative", width: "100%", maxWidth: 400,
              background: "rgba(255,255,255,0.97)",
              border: "1px solid rgba(186,230,253,0.8)",
              borderRadius: 20,
              padding: "28px 24px 22px",
              boxShadow: "0 0 0 1px rgba(186,230,253,0.5), 0 32px 80px rgba(96,165,250,0.2), inset 0 1px 0 rgba(255,255,255,1)",
              animation: "cwCardIn 0.22s cubic-bezier(0.34,1.1,0.64,1)",
            }}>
              <style>{`@keyframes cwCardIn { from { opacity:0; transform:scale(0.94) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "#0f2d6b" }}>Connect wallet</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Choose your Starknet wallet</p>
                </div>
                <button onClick={() => setConnectOpen(false)} style={{ background: "none", border: "none", color: "rgba(30,64,175,0.35)", cursor: "pointer", padding: 4, lineHeight: 1, fontSize: 18, marginTop: 2 }}>×</button>
              </div>
              <WalletConnectOptions onSuccess={() => setConnectOpen(false)} showFootnote />
            </div>
          </div>
        )}

        {!isMobile && tradeOpen && tradeMarket && (
          <div style={{ position: "fixed", inset: 0, zIndex: 110, pointerEvents: "none" }}>
            <div
              onClick={() => { if (!tradeBusy) setTradeOpen(false); }}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(15,23,42,0.18)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
                pointerEvents: "auto",
              }}
            />
            <aside
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                height: "100%",
                width: "min(92vw, 360px)",
                background: "rgba(255,255,255,0.98)",
                borderLeft: "1px solid rgba(186,230,253,0.8)",
                boxShadow: "-18px 0 44px rgba(96,165,250,0.2)",
                padding: "18px 16px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                pointerEvents: "auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f2d6b" }}>Place trade</p>
                <button
                  onClick={() => { if (!tradeBusy) setTradeOpen(false); }}
                  style={{ border: "none", background: "none", fontSize: 18, lineHeight: 1, color: "rgba(30,64,175,0.45)", cursor: tradeBusy ? "default" : "pointer" }}
                >
                  ×
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                {tradeMarket.question}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: "#64748b", fontFamily: "var(--font-geist-mono)" }}>
                Side: <strong style={{ color: tradeYes ? "#15803d" : "#dc2626" }}>{tradeYes ? "YES" : "NO"}</strong>
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  placeholder="USDC amount"
                  value={tradeInput}
                  disabled={tradeBusy}
                  onChange={(e) => setTradeInput(e.target.value)}
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
                <button
                  onClick={() => void executeBuy(tradeMarket, tradeYes, tradeInput, true)}
                  disabled={tradeBusy}
                  style={{
                    border: "none",
                    borderRadius: 10,
                    padding: "0 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    background: tradeBusy ? "rgba(37,99,235,0.45)" : "#2563eb",
                    cursor: tradeBusy ? "default" : "pointer",
                  }}
                >
                  {tradeBusy ? "Signing…" : "Sign"}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 10, color: "#64748b", fontFamily: "var(--font-geist-mono)" }}>
                Tip: set a default amount in profile settings to skip this panel next time.
              </p>
            </aside>
          </div>
        )}

        {activeTab !== "markets" && <ComingSoon label={NAV_ITEMS.find(n => n.id === activeTab)!.label} />}

        {activeTab === "markets" && <div style={{
          maxWidth: 520, margin: "32px auto 0",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {loading && (
            <p style={{ textAlign: "center", color: "rgba(30,64,175,0.4)", fontFamily: "var(--font-geist-mono)", fontSize: 12, letterSpacing: "0.1em" }}>
              LOADING MARKETS…
            </p>
          )}

          {!loading && markets.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 24px",
              border: "1px solid rgba(186,230,253,0.5)",
              borderRadius: 20,
              background: "rgba(255,255,255,0.5)",
              backdropFilter: "blur(16px)",
            }}>
              <p style={{ color: "#475569", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No active markets</p>
              <p style={{ color: "#94a3b8", fontSize: 12, fontFamily: "var(--font-geist-mono)" }}>Check back soon.</p>
            </div>
          )}

          {markets.map(m => isMobile ? (
            <SwipeCard key={m.id} market={m} onVote={yes => handleVote(m, yes)} />
          ) : (
            <MarketCard key={m.id} market={m} showButtons onVote={yes => handleVote(m, yes)} />
          ))}

          {!loading && markets.length > 0 && isMobile && (
            <p style={{
              textAlign: "center", color: "rgba(30,64,175,0.35)",
              fontSize: 11, fontFamily: "var(--font-geist-mono)",
              letterSpacing: "0.08em", marginTop: 8,
            }}>
              SWIPE RIGHT FOR YES · LEFT FOR NO
            </p>
          )}
        </div>}
      </div>
    </div>
  );
}
