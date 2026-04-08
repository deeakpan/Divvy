"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "../components/WalletContext";
import { WalletConnectOptions } from "../components/WalletConnectOptions";

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

function buildDemoMarkets(eth: number, btc: number, strk: number): Market[] {
  return [
    {
      id: "demo-eth-above",
      asset: "ETH",
      logo: ASSET_LOGO.ETH,
      question: `Will ETH close above $${fmtPrice(round(eth * 1.04, 2))} in the next 24h?`,
      expiry_at: daysFromNow(1),
      yes_pool: 18400,
      no_pool: 11200,
      status: "active",
    },
    {
      id: "demo-btc-above",
      asset: "BTC",
      logo: ASSET_LOGO.BTC,
      question: `Will BTC break $${fmtPrice(round(btc * 1.03, 3))} this week?`,
      expiry_at: daysFromNow(7),
      yes_pool: 52000,
      no_pool: 31000,
      status: "active",
    },
    {
      id: "demo-eth-below",
      asset: "ETH",
      logo: ASSET_LOGO.ETH,
      question: `Will ETH drop below $${fmtPrice(round(eth * 0.94, 2))} in 48h?`,
      expiry_at: daysFromNow(2),
      yes_pool: 6800,
      no_pool: 24500,
      status: "active",
    },
    {
      id: "demo-strk-above",
      asset: "STRK",
      logo: ASSET_LOGO.STRK,
      question: `Will STRK hit $${fmtPrice(round(strk * 1.12, 2))} before the weekend?`,
      expiry_at: daysFromNow(4),
      yes_pool: 9100,
      no_pool: 7300,
      status: "active",
    },
  ];
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
        <circle cx={cx} cy={cy} r={r} fill="rgba(0,0,0,0.3)"
          stroke="rgba(255,255,255,0.07)" strokeWidth="11" />
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="11"
          strokeDasharray={`${filled} ${C - filled}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
      </svg>
      {/* Percent centered inside the arc hollow.
          Div is 190×190, circle center = card corner at (95,95).
          left:48 bottom:76 → div coords (48,114) → 33px from corner at ~45° = inside the ring. */}
      <div style={{
        position: "absolute", bottom: 52, left: 48,
        display: "flex", alignItems: "baseline",
      }}>
        <span style={{
          fontSize: 17, fontWeight: 900, color: "#fff",
          letterSpacing: "-0.04em",
          textShadow: `0 0 14px ${color}, 0 0 4px rgba(0,0,0,0.8)`,
        }}>{pct}<span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>%</span></span>
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
  const arcColor = yesLeads ? "#22c55e" : "#ef4444";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 28,
        border: hovered ? "1px solid rgba(99,120,200,0.38)" : "1px solid rgba(99,120,200,0.18)",
        background: "rgba(8, 14, 40, 0.68)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: hovered
          ? "0 12px 56px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)"
          : "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
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
            style={{ borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.12)", flexShrink: 0 }}
          />
          <span style={{
            fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
            fontFamily: "var(--font-geist-mono)",
          }}>
            {market.asset}
          </span>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px 4px 8px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/>
              <path d="M5 2.5V5L6.5 6.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.65)", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.04em" }}>
              {fmtCountdown(market.expiry_at)}
            </span>
          </div>
        </div>

        {/* Volume + closes */}
        <p style={{ margin: "0 0 10px", fontSize: 11, color: "rgba(56,215,255,0.65)", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.03em" }}>
          <span style={{ fontWeight: 700 }}>{fmtPool(total)} USDC Vol.</span>
          <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>Closes {fmtUTC(market.expiry_at)}</span>
        </p>

        {/* Question */}
        <p style={{
          margin: "0 0 20px",
          fontSize: 19, fontWeight: 800, color: "#fff",
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
              border: "1px solid rgba(34,197,94,0.35)",
              background: "rgba(22,163,74,0.7)",
              color: "#fff", fontWeight: 800, fontSize: 15,
              letterSpacing: "0.06em", cursor: "pointer",
              transition: "background 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(22,163,74,0.92)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(22,163,74,0.7)"; }}
            >
              YES
              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, fontFamily: "var(--font-geist-mono)" }}>{yesPct}%</span>
            </button>
            <button onClick={() => onVote(false)} style={{
              flex: 1, padding: "13px 8px", borderRadius: 14,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444", fontWeight: 800, fontSize: 15,
              letterSpacing: "0.06em", cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
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
        <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 20, letterSpacing: 3 }}>YES →</span>
      </div>
      <div style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", opacity: noOpacity, pointerEvents: "none", zIndex: 2 }}>
        <span style={{ color: "#ef4444", fontWeight: 800, fontSize: 20, letterSpacing: 3 }}>← NO</span>
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
            ? "1px solid rgba(34,197,94,0.35)"
            : offset < -20
            ? "1px solid rgba(239,68,68,0.35)"
            : "1px solid rgba(255,255,255,0.1)",
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

// ── Header ────────────────────────────────────────────────────────────────────

const USDC_ADDRESS = "0x0715649d4c493ca350743e43915b88d2e6838b1c78ddc23d6d9385446b9d6844";

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

function Header({ onBack, onConnect }: { onBack: () => void; onConnect: () => void }) {
  const { address, disconnect, connecting } = useWallet();
  const isMobile = useIsMobile();
  const usdcBalance = useUSDCBalance(address);
  // Shorter address on mobile
  const short = address
    ? isMobile
      ? `${address.slice(0, 4)}…${address.slice(-3)}`
      : `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  const sep = <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />;

  // Deterministic gradient from wallet address bytes
  const h1 = address ? parseInt(address.slice(2,  6), 16) % 360 : 220;
  const h2 = address ? parseInt(address.slice(6, 10), 16) % 360 : 260;
  const h3 = address ? parseInt(address.slice(10,14), 16) % 360 : 200;
  const s1 = address ? 55 + (parseInt(address.slice(14,16), 16) % 25) : 70;
  const avatarGrad = address
    ? `linear-gradient(135deg, hsl(${h1},${s1}%,55%) 0%, hsl(${h2},${s1+10}%,42%) 50%, hsl(${h3},${s1+5}%,35%) 100%)`
    : "rgba(255,255,255,0.08)";
  const avatarGlow = address ? `hsla(${h1},${s1}%,55%,0.4)` : "rgba(255,255,255,0.1)";

  return (
    <div style={{
      position: "sticky", top: 16, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
      padding: "0 16px",
    }}>
      {/* Centred pill nav */}
      <nav style={{
        pointerEvents: "auto",
        display: "flex", alignItems: "center", gap: isMobile ? 7 : 10,
        padding: isMobile ? "7px 10px" : "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.22)",
        background: "linear-gradient(155deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 12px 40px rgba(15,40,90,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
        maxWidth: "calc(100vw - 100px)",
        minWidth: 0,
      }}>
        {/* Logo + name */}
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={22} height={22} style={{ borderRadius: 6 }} />
          {!isMobile && (
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>Divvy</span>
          )}
        </button>

        {sep}

        {/* Network badge — always shown */}
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          color: "rgba(147,197,253,0.9)", textTransform: "uppercase",
          fontFamily: "var(--font-geist-mono)", flexShrink: 0,
        }}>
          Sepolia
        </span>

        {address ? (
          <>
            {sep}
            {/* Address */}
            <span style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontFamily: "var(--font-geist-mono)",
              color: "rgba(255,255,255,0.75)", flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 5px rgba(52,211,153,0.6)", flexShrink: 0 }} />
              {short}
            </span>

            {/* Balance — desktop only */}
            {!isMobile && usdcBalance !== null && (
              <>
                {sep}
                <span style={{
                  fontSize: 11, fontFamily: "var(--font-geist-mono)",
                  color: "rgba(255,255,255,0.85)", fontWeight: 600, flexShrink: 0,
                }}>
                  ${usdcBalance} <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>USDC</span>
                </span>
              </>
            )}

            {/* Disconnect */}
            <button
              onClick={disconnect}
              style={{
                fontSize: isMobile ? 14 : 10,
                fontWeight: 600, color: "rgba(255,255,255,0.4)",
                background: "none", border: "none", cursor: "pointer",
                padding: isMobile ? "0 2px" : "2px 6px",
                borderRadius: 6, transition: "color 0.15s", flexShrink: 0, lineHeight: 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(239,68,68,0.85)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
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
              color: connecting ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.7)",
              background: "none", border: "none",
              cursor: connecting ? "default" : "pointer",
              padding: 0, transition: "color 0.15s", flexShrink: 0,
            }}
            onMouseEnter={e => { if (!connecting) e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.color = connecting ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.7)"; }}
          >
            {connecting ? "Connecting…" : "Connect"}
          </button>
        )}
      </nav>

      {/* Profile avatar — pinned to the right of the header row */}
      <div style={{
        pointerEvents: "auto",
        position: "absolute", right: 16,
        display: "flex", alignItems: "center",
      }}>
        <button style={{
          position: "relative",
          width: 40, height: 40,
          borderRadius: "50%",
          background: avatarGrad,
          border: "1.5px solid rgba(255,255,255,0.18)",
          boxShadow: address
            ? `0 0 0 2px rgba(0,0,0,0.35), 0 4px 18px ${avatarGlow}`
            : "0 0 0 2px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.3)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          transition: "box-shadow 0.18s, transform 0.18s",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "scale(1.08)";
            e.currentTarget.style.boxShadow = `0 0 0 2px rgba(0,0,0,0.35), 0 6px 24px ${avatarGlow}`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = address
              ? `0 0 0 2px rgba(0,0,0,0.35), 0 4px 18px ${avatarGlow}`
              : "0 0 0 2px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.3)";
          }}
        >
          {!address && (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="7" r="3.2" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>
              <path d="M2.5 16c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
          {/* Online dot */}
          {address && (
            <span style={{
              position: "absolute", bottom: 1, right: 1,
              width: 9, height: 9, borderRadius: "50%",
              background: "#34d399",
              border: "1.5px solid rgba(3,8,24,0.9)",
              boxShadow: "0 0 6px rgba(52,211,153,0.7)",
            }} />
          )}
        </button>
      </div>
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
      background: "linear-gradient(to top, rgba(3,8,24,0.98) 60%, rgba(3,8,24,0) 100%)",
      paddingBottom: "max(16px, env(safe-area-inset-bottom))",
    }}>
      <div style={{
        display: "flex",
        background: "rgba(10,16,44,0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(99,120,200,0.2)",
        borderRadius: 999,
        padding: "6px 6px",
        gap: 2,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
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
                background: isActive ? "rgba(37,99,235,0.85)" : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                transition: "background 0.18s, color 0.18s",
                boxShadow: isActive ? "0 0 16px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.15)" : "none",
                minWidth: 64,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
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
      <p style={{ fontSize: 28, fontWeight: 800, color: "rgba(255,255,255,0.12)", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
        {label}
      </p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.08em" }}>
        COMING SOON
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("markets");

  useEffect(() => {
    Promise.all([
      fetch("/api/markets").then(r => r.json()).catch(() => ({ markets: [] })),
      fetch("/api/spot-prices").then(r => r.json()).catch(() => ({})),
    ]).then(([mData, prices]: [{ markets?: Market[] }, { ethUsd?: number; btcUsd?: number; strkUsd?: number }]) => {
      const apiMarkets: Market[] = mData.markets ?? [];
      if (apiMarkets.length > 0) {
        setMarkets(apiMarkets);
      } else {
        const eth = prices.ethUsd ?? 3000;
        const btc = prices.btcUsd ?? 65000;
        const strk = prices.strkUsd ?? 0.4;
        setMarkets(buildDemoMarkets(eth, btc, strk));
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleVote = (market: Market, yes: boolean) => {
    // TODO: submit vote transaction
    console.log("vote", market.id, yes ? "YES" : "NO");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "rgb(3, 8, 24)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }} />

      <BottomNav active={activeTab} onChange={setActiveTab} />

      <div style={{ position: "relative", zIndex: 1, padding: "16px 16px 100px" }}>
        <Header onBack={() => router.push("/")} onConnect={() => setConnectOpen(true)} />

        {connectOpen && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setConnectOpen(false); }}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
              background: "rgba(2,5,18,0.75)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              animation: "cwOverlayIn 0.18s ease",
            }}
          >
            <style>{`@keyframes cwOverlayIn { from { opacity:0 } to { opacity:1 } }`}</style>
            <div style={{
              position: "relative", width: "100%", maxWidth: 400,
              background: "rgba(6,12,36,0.97)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "28px 24px 22px",
              boxShadow: "0 0 0 1px rgba(59,130,246,0.1), 0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)",
              animation: "cwCardIn 0.22s cubic-bezier(0.34,1.1,0.64,1)",
            }}>
              <style>{`@keyframes cwCardIn { from { opacity:0; transform:scale(0.94) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>Connect wallet</p>
                  <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.38)" }}>Choose your Starknet wallet</p>
                </div>
                <button onClick={() => setConnectOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 4, lineHeight: 1, fontSize: 18, marginTop: 2 }}>×</button>
              </div>
              <WalletConnectOptions onSuccess={() => setConnectOpen(false)} showFootnote />
            </div>
          </div>
        )}

        {activeTab !== "markets" && <ComingSoon label={NAV_ITEMS.find(n => n.id === activeTab)!.label} />}

        {activeTab === "markets" && <div style={{
          maxWidth: 600, margin: "32px auto 0",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {loading && (
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-geist-mono)", fontSize: 12, letterSpacing: "0.1em" }}>
              LOADING MARKETS…
            </p>
          )}

          {!loading && markets.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 24px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(16px)",
            }}>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No active markets</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontFamily: "var(--font-geist-mono)" }}>Check back soon.</p>
            </div>
          )}

          {markets.map(m => isMobile ? (
            <SwipeCard key={m.id} market={m} onVote={yes => handleVote(m, yes)} />
          ) : (
            <MarketCard key={m.id} market={m} showButtons onVote={yes => handleVote(m, yes)} />
          ))}

          {!loading && markets.length > 0 && isMobile && (
            <p style={{
              textAlign: "center", color: "rgba(255,255,255,0.3)",
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
