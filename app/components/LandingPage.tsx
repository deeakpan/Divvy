"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useWallet } from "./WalletContext";

/* ── tiny decorative market card shown in the background ── */
function GhostCard({
  asset, logo, question, yes, no, timer, style,
}: {
  asset: string; logo: string; question: string;
  yes: number; no: number; timer: string;
  style?: React.CSSProperties;
}) {
  return (
    <div aria-hidden style={{
      position: "absolute",
      width: "clamp(200px, 28vw, 270px)",
      background: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(186,230,253,0.7)",
      borderRadius: 22,
      padding: "16px 18px",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      boxShadow: "0 8px 32px rgba(96,165,250,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
      opacity: 0.78,
      ...style,
    }}>
      {/* top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid rgba(186,230,253,0.6)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#1e40af", textTransform: "uppercase", fontFamily: "var(--font-geist-mono)" }}>
          {asset}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "rgba(30,64,175,0.55)", fontFamily: "var(--font-geist-mono)", background: "rgba(219,234,254,0.8)", padding: "2px 7px", borderRadius: 999, border: "1px solid rgba(186,230,253,0.7)" }}>
          {timer}
        </span>
      </div>
      {/* question */}
      <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "#1e3a5f", lineHeight: 1.4 }}>
        {question}
      </p>
      {/* bar */}
      <div style={{ display: "flex", height: 5, borderRadius: 999, overflow: "hidden", gap: 2, marginBottom: 6 }}>
        <div style={{ width: `${yes}%`, background: "linear-gradient(90deg,#34d399,#10b981)", borderRadius: 999 }} />
        <div style={{ width: `${no}%`,  background: "linear-gradient(90deg,#fca5a5,#f87171)", borderRadius: 999 }} />
      </div>
      {/* labels */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 700, fontFamily: "var(--font-geist-mono)", letterSpacing: "0.04em" }}>
        <span style={{ color: "#059669" }}>YES {yes}%</span>
        <span style={{ color: "#dc2626" }}>NO {no}%</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { connectCartridge, connectBrowser, connecting } = useWallet();
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectErr, setConnectErr] = useState<string | null>(null);

  const goApp = useCallback(() => {
    setConnectOpen(false);
    setConnectErr(null);
    router.push("/app");
  }, [router]);

  const pickCartridge = useCallback(async () => {
    setConnectErr(null);
    try { await connectCartridge(); goApp(); }
    catch (e) { setConnectErr(e instanceof Error ? e.message : "Could not connect"); }
  }, [connectCartridge, goApp]);

  const pickArgent = useCallback(async () => {
    setConnectErr(null);
    try { await connectBrowser("argentX"); goApp(); }
    catch (e) { setConnectErr(e instanceof Error ? e.message : "Could not connect"); }
  }, [connectBrowser, goApp]);

  const pickBraavos = useCallback(async () => {
    setConnectErr(null);
    try { await connectBrowser("braavos"); goApp(); }
    catch (e) { setConnectErr(e instanceof Error ? e.message : "Could not connect"); }
  }, [connectBrowser, goApp]);

  return (
    <main className="lp">

      {/* ── sky + orbs ── */}
      <div className="lp__bg" aria-hidden>
        <div className="lp__sky" />
        <div className="lp__orb lp__orb--a" />
        <div className="lp__orb lp__orb--b" />
        <div className="lp__orb lp__orb--c" />
        <div className="lp__orb lp__orb--d" />
        <div className="lp__grid" />
        <div className="lp__rays" />
      </div>

      {/* ── floating ghost cards ── */}
      <div className="lp__ghosts" aria-hidden>
        <GhostCard
          asset="ETH" logo="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
          question="Will ETH break $3,400 this week?"
          yes={62} no={38} timer="2d:14h"
          style={{ transform: "rotate(-7deg)", top: "22%", left: "-120px" }}
        />
        <GhostCard
          asset="BTC" logo="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
          question="Will BTC hit $72K before April?"
          yes={47} no={53} timer="5d:09h"
          style={{ transform: "rotate(7deg)", top: "15%", right: "-110px" }}
        />
        <GhostCard
          asset="STRK" logo="https://assets.coingecko.com/coins/images/26433/small/starknet.png"
          question="Will STRK reach $0.55 this month?"
          yes={71} no={29} timer="11d:02h"
          style={{ transform: "rotate(-5deg)", bottom: "18%", right: "-100px" }}
        />
      </div>

      {/* ── top nav ── */}
      <div className="lp__nav-wrap">
        <nav className="lp__nav font-mono" aria-label="Primary">
          <a className="lp__nav-link" href="/app">Markets</a>
          <span className="lp__nav-dot" aria-hidden />
          <a className="lp__nav-link" href="/app">Yield</a>
          <span className="lp__nav-dot" aria-hidden />
          <a className="lp__nav-link" href="/app">Leaderboard</a>
          <span className="lp__nav-dot" aria-hidden />
          <a className="lp__nav-link" href="/app">Docs</a>
        </nav>
      </div>

      {/* ── hero ── */}
      <div className="lp__hero">

        {/* wordmark */}
        <h1 className="lp__word">Divvy</h1>

        {/* sub */}
        <p className="lp__sub">
          Swipe yes or no on crypto price predictions.<br />
          <span className="lp__sub-em">Earn yield on every position, win or lose.</span>
        </p>


        {/* CTA / wallet connect */}
        <div className={`lp__cta-wrap${connectOpen ? " lp__cta-wrap--open" : ""}`}>
          {!connectOpen ? (
            <button type="button" className="lp__cta" onClick={() => setConnectOpen(true)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="lp__cta-logo" />
              <span>Start trading</span>
              <svg className="lp__cta-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : (
            <div className="cw">
              <div className="cw-top">
                <p className="cw-title font-mono">SIGN IN WITH</p>
                <button type="button" className="cw-x" onClick={() => { setConnectOpen(false); setConnectErr(null); }} aria-label="Close">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div className="cw-row">
                <button type="button" className="cw-btn" disabled={connecting} onClick={() => void pickCartridge()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/catridge.png" alt="" className="cw-logo" />
                  <span className="cw-name">Cartridge</span>
                  <span className="cw-star">★</span>
                </button>
                <button type="button" className="cw-btn" disabled={connecting} onClick={() => void pickArgent()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/wallet-argent.svg" alt="" className="cw-logo" />
                  <span className="cw-name">Argent</span>
                </button>
                <button type="button" className="cw-btn" disabled={connecting} onClick={() => void pickBraavos()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/wallet-braavos.svg" alt="" className="cw-logo" />
                  <span className="cw-name">Braavos</span>
                </button>
              </div>
              <p className="cw-powered font-mono">Powered by StarkZap</p>
              {connectErr && <p className="cw-err font-mono">{connectErr}</p>}
            </div>
          )}
        </div>

        {/* how it works — 3 steps */}
        <div className="lp__steps font-mono">
          <div className="lp__step">
            <span className="lp__step-n">01</span>
            <span className="lp__step-l">Connect wallet</span>
          </div>
          <div className="lp__step-line" aria-hidden />
          <div className="lp__step">
            <span className="lp__step-n">02</span>
            <span className="lp__step-l">Swipe to vote</span>
          </div>
          <div className="lp__step-line" aria-hidden />
          <div className="lp__step">
            <span className="lp__step-n">03</span>
            <span className="lp__step-l">Earn yield</span>
          </div>
        </div>
      </div>

      {/* ── footer ── */}
      <footer className="lp__footer font-mono">
        <a className="lp__footer-link" href="/how-it-works">How it works</a>
        <span className="lp__footer-dot" aria-hidden />
        <a className="lp__footer-link" href="https://x.com/divvyfi" target="_blank" rel="noopener noreferrer">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Twitter
        </a>
        <span className="lp__footer-dot" aria-hidden />
        <a className="lp__footer-link" href="/terms">Terms</a>
      </footer>

      <style jsx>{`

        /* ── reset / base ── */
        .lp {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding:
            max(20px, env(safe-area-inset-top, 0px) + 12px)
            max(20px, env(safe-area-inset-right, 0px) + 16px)
            max(24px, env(safe-area-inset-bottom, 0px) + 16px)
            max(20px, env(safe-area-inset-left, 0px) + 16px);
        }

        /* ── background ── */
        .lp__bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .lp__sky {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 100% 60% at 50% -10%, #bfdbfe 0%, transparent 65%),
            radial-gradient(ellipse 80% 50% at 10% 20%,  #dbeafe 0%, transparent 55%),
            radial-gradient(ellipse 70% 40% at 90% 30%,  #e0e7ff 0%, transparent 50%),
            linear-gradient(175deg, #f0f7ff 0%, #f8fbff 40%, #ffffff 100%);
        }

        /* sunray streaks from top */
        .lp__rays {
          position: absolute;
          inset: 0;
          background: repeating-conic-gradient(
            from 270deg at 50% -20%,
            rgba(186,230,253,0.07) 0deg,
            transparent 2deg,
            transparent 14deg,
            rgba(186,230,253,0.05) 16deg,
            transparent 18deg
          );
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 55%);
        }

        .lp__orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          mix-blend-mode: multiply;
          animation: lpDrift 24s ease-in-out infinite;
        }
        .lp__orb--a {
          width: min(60vw, 500px); height: min(60vw, 500px);
          top: -15%; left: -10%;
          background: radial-gradient(circle, rgba(96,165,250,0.35) 0%, transparent 70%);
          animation-delay: 0s;
        }
        .lp__orb--b {
          width: min(55vw, 460px); height: min(55vw, 460px);
          bottom: -20%; right: -10%;
          background: radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 68%);
          animation-delay: -8s; animation-duration: 28s;
        }
        .lp__orb--c {
          width: min(40vw, 340px); height: min(40vw, 340px);
          top: 35%; right: 5%;
          background: radial-gradient(circle, rgba(56,189,248,0.2) 0%, transparent 65%);
          opacity: 0.7; animation-delay: -16s; animation-duration: 20s;
        }
        .lp__orb--d {
          width: min(35vw, 280px); height: min(35vw, 280px);
          bottom: 5%; left: 8%;
          background: radial-gradient(circle, rgba(99,179,237,0.2) 0%, transparent 65%);
          animation-delay: -5s; animation-duration: 22s;
        }

        @keyframes lpDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(2%, 3%) scale(1.06); }
          66%       { transform: translate(-1.5%, 1.5%) scale(0.97); }
        }

        .lp__grid {
          position: absolute;
          inset: 0;
          opacity: 0.045;
          background-image:
            linear-gradient(rgba(30,64,175,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30,64,175,0.5) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black 10%, transparent 72%);
        }

        /* ── ghost cards ── */
        .lp__ghosts {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }


        /* ── nav ── */
        .lp__nav-wrap {
          position: relative;
          z-index: 10;
          flex-shrink: 0;
          width: 100%;
          max-width: min(400px, 100%);
          box-sizing: border-box;
        }

        .lp__nav {
          display: flex; align-items: center; justify-content: center;
          flex-wrap: nowrap; gap: clamp(4px, 2vw, 12px);
          padding: 8px clamp(10px, 3vw, 20px);
          border-radius: 999px;
          border: 1px solid rgba(186,230,253,0.8);
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 4px 24px rgba(96,165,250,0.15), inset 0 1px 0 rgba(255,255,255,0.95);
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        .lp__nav:hover {
          border-color: rgba(147,197,253,0.9);
          box-shadow: 0 8px 32px rgba(96,165,250,0.22), inset 0 1px 0 rgba(255,255,255,0.95);
        }

        .lp__nav-link {
          font-size: clamp(8px, 2.2vw, 12px);
          font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
          text-decoration: none; white-space: nowrap;
          color: rgba(30,64,175,0.7);
          padding: 3px clamp(2px, 1.2vw, 7px);
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }
        .lp__nav-link:hover { color: #1d4ed8; background: rgba(219,234,254,0.6); }

        .lp__nav-dot {
          width: 3px; height: 3px; border-radius: 50%;
          background: rgba(147,197,253,0.7); flex-shrink: 0;
        }

        /* ── hero ── */
        .lp__hero {
          position: relative;
          z-index: 5;
          flex: 1;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          width: 100%; max-width: 680px;
          gap: 0;
          padding-top: clamp(8px, 2vw, 20px);
          text-align: center;
        }

        /* live badge */
        .lp__badge {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #1d4ed8;
          background: rgba(219,234,254,0.8);
          border: 1px solid rgba(147,197,253,0.7);
          border-radius: 999px;
          padding: 5px 14px;
          box-shadow: 0 2px 12px rgba(96,165,250,0.15);
          margin-bottom: clamp(20px, 3.5vw, 32px);
        }
        .lp__badge-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 2px rgba(34,197,94,0.3);
          animation: lpPulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes lpPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
          50%       { box-shadow: 0 0 0 5px rgba(34,197,94,0.12); }
        }

        /* wordmark */
        .lp__word {
          margin: 0 0 clamp(16px, 2.8vw, 24px);
          font-family: var(--font-brand), sans-serif;
          font-size: clamp(72px, 18vw, 148px);
          font-weight: 700;
          letter-spacing: -0.04em;
          line-height: 0.95;
          background: linear-gradient(
            135deg,
            #0f2d6b 0%,
            #1d4ed8 30%,
            #3b82f6 55%,
            #60a5fa 75%,
            #93c5fd 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 4px 24px rgba(37,99,235,0.18));
        }

        /* subtitle */
        .lp__sub {
          margin: 0 0 clamp(28px, 4vw, 40px);
          font-size: clamp(14px, 2.8vw, 18px);
          line-height: 1.6;
          color: #475569;
          max-width: 460px;
          padding: 0 max(8px, 2vw);
        }
        .lp__sub-em {
          color: #1d4ed8;
          font-weight: 600;
        }

        /* stats */
        .lp__stats {
          display: flex; align-items: center; gap: clamp(16px, 3vw, 32px);
          margin-bottom: clamp(28px, 4vw, 40px);
          padding: 14px clamp(20px, 4vw, 36px);
          background: rgba(255,255,255,0.65);
          border: 1px solid rgba(186,230,253,0.75);
          border-radius: 20px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 20px rgba(96,165,250,0.1), inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .lp__stat {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
        }
        .lp__stat-n {
          font-size: clamp(18px, 3.5vw, 26px);
          font-weight: 800; color: #1e3a5f; letter-spacing: -0.03em;
        }
        .lp__stat-l {
          font-size: clamp(8px, 1.4vw, 10px);
          font-weight: 600; color: rgba(30,64,175,0.55);
          text-transform: uppercase; letter-spacing: 0.1em;
        }
        .lp__stat-sep {
          width: 1px; height: 32px;
          background: linear-gradient(to bottom, transparent, rgba(147,197,253,0.6), transparent);
          flex-shrink: 0;
        }

        /* CTA */
        .lp__cta-wrap {
          width: 100%;
          max-width: min(320px, calc(100vw - 32px));
          display: flex; flex-direction: column; align-items: center;
          margin-bottom: clamp(32px, 5vw, 48px);
        }
        .lp__cta-wrap--open {
          max-width: min(460px, calc(100vw - 24px));
        }

        .lp__cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%;
          padding: clamp(13px, 2.8vw, 16px) clamp(28px, 5vw, 36px);
          border-radius: clamp(22px, 6vw, 28px);
          border: 1px solid rgba(37,99,235,0.3);
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 60%, #1e40af 100%);
          color: #fff;
          font-size: clamp(14px, 3vw, 17px);
          font-weight: 700; letter-spacing: 0.01em;
          cursor: pointer;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.15) inset,
            0 12px 36px rgba(37,99,235,0.38),
            0 4px 12px rgba(37,99,235,0.22);
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          -webkit-tap-highlight-color: transparent;
          position: relative;
          overflow: hidden;
        }
        .lp__cta::before {
          content: "";
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 60%);
          pointer-events: none;
        }
        .lp__cta:hover {
          transform: translateY(-3px);
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.18) inset,
            0 18px 48px rgba(37,99,235,0.48),
            0 6px 16px rgba(37,99,235,0.28);
        }
        .lp__cta:active { transform: translateY(-1px); }

        .lp__cta-logo {
          width: 22px; height: 30px;
          border-radius: 6px;
          object-fit: cover; object-position: center;
          flex-shrink: 0;
          filter: drop-shadow(0 1px 3px rgba(0,0,0,0.2));
        }
        .lp__cta-arrow {
          flex-shrink: 0;
          opacity: 0.85;
          transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.18s;
        }
        .lp__cta:hover .lp__cta-arrow {
          transform: translateX(5px);
          opacity: 1;
        }

        /* ── steps ── */
        .lp__steps {
          display: flex; align-items: center; gap: 0;
        }
        .lp__step {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          min-width: 0;
        }
        .lp__step-n {
          font-size: 11px; font-weight: 800; color: #2563eb;
          letter-spacing: 0.04em;
        }
        .lp__step-l {
          font-size: clamp(8px, 1.8vw, 10px);
          font-weight: 600; color: #64748b;
          text-transform: uppercase; letter-spacing: 0.08em;
          white-space: nowrap;
        }
        .lp__step-line {
          flex: 1; height: 1px; min-width: clamp(16px, 4vw, 40px);
          background: linear-gradient(90deg, transparent, rgba(147,197,253,0.7), transparent);
          margin: 0 clamp(6px, 1.5vw, 14px) 14px;
        }

        /* ── wallet connect modal ── */
        .cw {
          width: 100%;
          padding: 22px 24px 60px;
          border-radius: 18px 18px 0 0;
          border: 1px solid rgba(186,230,253,0.8);
          border-bottom: none;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 -4px 40px rgba(96,165,250,0.18), inset 0 1px 0 rgba(255,255,255,1);
          animation: cwIn 0.22s cubic-bezier(0.34, 1.1, 0.64, 1);
        }
        @keyframes cwIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cw-top {
          display: flex; align-items: center; justify-content: center;
          position: relative; margin-bottom: 20px;
        }
        .cw-title {
          margin: 0; font-size: 11px; font-weight: 700;
          letter-spacing: 0.2em; color: rgba(30,64,175,0.6);
          text-align: center;
        }
        .cw-x {
          position: absolute; right: 0; top: 50%; transform: translateY(-50%);
          display: flex; align-items: center; justify-content: center;
          border: none; background: none;
          color: rgba(30,64,175,0.35); cursor: pointer; padding: 4px;
          transition: color 0.15s;
        }
        .cw-x:hover { color: #1d4ed8; }

        .cw-row { display: flex; gap: 10px; justify-content: center; }

        .cw-btn {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; gap: 8px; padding: 16px 8px 12px;
          border-radius: 12px;
          border: 1px solid rgba(186,230,253,0.7);
          background: rgba(239,246,255,0.7);
          cursor: pointer; position: relative;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .cw-btn:hover:not(:disabled) {
          background: rgba(219,234,254,0.9);
          border-color: rgba(147,197,253,0.9);
          transform: translateY(-2px);
        }
        .cw-btn:active:not(:disabled) { transform: scale(0.97); }
        .cw-btn:disabled { opacity: 0.4; cursor: wait; }

        .cw-logo { width: 40px; height: 40px; border-radius: 10px; object-fit: contain; display: block; }
        .cw-name { font-size: 11px; font-weight: 600; color: #1e3a5f; letter-spacing: 0.01em; }
        .cw-star { position: absolute; top: 6px; right: 7px; font-size: 7px; color: #2563eb; opacity: 0.6; }

        .cw-powered {
          margin: 12px 0 0; font-size: 9px; font-weight: 700;
          letter-spacing: 0.12em; color: rgba(30,64,175,0.35);
          text-align: center; text-transform: uppercase;
        }
        .cw-err {
          margin: 8px 0 0; font-size: 10px; color: #dc2626; text-align: center;
        }

        /* ── footer ── */
        .lp__footer {
          position: fixed;
          bottom: max(20px, env(safe-area-inset-bottom, 0px) + 14px);
          left: max(20px, env(safe-area-inset-left, 0px) + 16px);
          z-index: 20;
          display: flex; align-items: center; gap: 8px;
        }
        .lp__footer-link {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: rgba(30,64,175,0.35);
          text-decoration: none; transition: color 0.18s;
        }
        .lp__footer-link:hover { color: #1d4ed8; }
        .lp__footer-dot {
          width: 2px; height: 2px; border-radius: 50%;
          background: rgba(147,197,253,0.6); flex-shrink: 0;
        }

        /* ── ghost cards — only show on wide screens ── */
        @media (max-width: 1100px) {
          .lp__ghosts { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp__orb, .gc { animation: none; }
        }
      `}</style>
    </main>
  );
}
