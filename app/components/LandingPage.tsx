"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useWallet } from "./WalletContext";

export default function LandingPage() {
  const router = useRouter();
  const { connectCartridge, connectBrowser, connecting } = useWallet();
  const [logoHover, setLogoHover] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const [connectErr, setConnectErr] = useState<string | null>(null);

  const goApp = useCallback(() => {
    setConnectOpen(false);
    setConnectErr(null);
    router.push("/app");
  }, [router]);

  const pickCartridge = useCallback(async () => {
    setConnectErr(null);
    try {
      await connectCartridge();
      goApp();
    } catch (e) {
      setConnectErr(e instanceof Error ? e.message : "Could not connect");
    }
  }, [connectCartridge, goApp]);

  const pickArgent = useCallback(async () => {
    setConnectErr(null);
    try {
      await connectBrowser("argentX");
      goApp();
    } catch (e) {
      setConnectErr(e instanceof Error ? e.message : "Could not connect");
    }
  }, [connectBrowser, goApp]);

  const pickBraavos = useCallback(async () => {
    setConnectErr(null);
    try {
      await connectBrowser("braavos");
      goApp();
    } catch (e) {
      setConnectErr(e instanceof Error ? e.message : "Could not connect");
    }
  }, [connectBrowser, goApp]);

  return (
    <main className="landing-hero">
      <div className="landing-hero__bg" aria-hidden>
        <div className="landing-hero__mesh" />
        <div className="landing-hero__orb landing-hero__orb--a" />
        <div className="landing-hero__orb landing-hero__orb--b" />
        <div className="landing-hero__orb landing-hero__orb--c" />
        <div className="landing-hero__grid" />
        <div className="landing-hero__noise" />
      </div>
      <div className="landing-hero__head-wrap">
        <nav className="landing-hero__head font-mono" aria-label="Primary">
          <a className="landing-hero__head-link" href="/app">
            Yield
          </a>
          <span className="landing-hero__head-dot" aria-hidden />
          <a className="landing-hero__head-link" href="/app">
            Markets
          </a>
          <span className="landing-hero__head-dot" aria-hidden />
          <a className="landing-hero__head-link" href="/app">
            Leaderboard
          </a>
          <span className="landing-hero__head-dot" aria-hidden />
          <a className="landing-hero__head-link" href="/app">
            Docs
          </a>
        </nav>
      </div>
      <div className="landing-hero__inner">
        <div
          className="landing-hero__logo-wrap"
          onMouseEnter={() => setLogoHover(true)}
          onMouseLeave={() => setLogoHover(false)}
          data-hover={logoHover ? "1" : "0"}
        >
          <h1 className="landing-hero__wordmark">Divvy</h1>
        </div>

        <p className="landing-hero__tag font-mono">Swipe to trade and earn yield</p>

        <div className={`landing-hero__cta-block${connectOpen ? " landing-hero__cta-block--open" : ""}`}>
          {!connectOpen ? (
            <button
              type="button"
              className="landing-hero__cta"
              onClick={() => setConnectOpen(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="landing-hero__cta-logo" />
              <span>Start trading</span>
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
              {connectErr ? <p className="cw-err font-mono">{connectErr}</p> : null}
            </div>
          )}
        </div>
      </div>

      {/* Bottom-left footer links */}
      <footer className="landing-footer font-mono">
        <a className="landing-footer__link" href="/how-it-works">How it works</a>
        <span className="landing-footer__dot" aria-hidden />
        <a className="landing-footer__link" href="https://x.com/divvyfi" target="_blank" rel="noopener noreferrer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ display: "block" }}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          Twitter
        </a>
        <span className="landing-footer__dot" aria-hidden />
        <a className="landing-footer__link" href="/terms">Terms</a>
      </footer>

      <style jsx>{`
        .landing-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          padding: max(20px, env(safe-area-inset-top, 0px) + 12px)
            max(20px, env(safe-area-inset-right, 0px) + 16px)
            max(24px, env(safe-area-inset-bottom, 0px) + 16px)
            max(20px, env(safe-area-inset-left, 0px) + 16px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
        }

        .landing-hero__head-wrap {
          position: relative;
          z-index: 2;
          flex-shrink: 0;
          width: 100%;
          max-width: min(380px, 100%);
          min-width: 0;
          box-sizing: border-box;
          container-type: inline-size;
          container-name: landing-head;
        }

        .landing-hero__head {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: nowrap;
          gap: clamp(2px, 1.4cqi, 9px);
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          margin-top: 0;
          padding: clamp(6px, 1.8cqi, 7px) clamp(6px, 3.2cqi, 14px);
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          background: linear-gradient(
            155deg,
            rgba(255, 255, 255, 0.2) 0%,
            rgba(255, 255, 255, 0.08) 55%,
            rgba(255, 255, 255, 0.05) 100%
          );
          box-shadow:
            0 12px 40px rgba(15, 40, 90, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease,
            background 0.22s ease;
        }

        .landing-hero__head:hover {
          transform: translateY(-3px);
          border-color: rgba(255, 255, 255, 0.48);
          box-shadow:
            0 20px 52px rgba(15, 40, 90, 0.52),
            0 0 0 1px rgba(186, 230, 253, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
          background: linear-gradient(
            155deg,
            rgba(255, 255, 255, 0.3) 0%,
            rgba(255, 255, 255, 0.14) 55%,
            rgba(255, 255, 255, 0.09) 100%
          );
        }

        .landing-hero__head:hover .landing-hero__head-link {
          color: rgba(255, 255, 255, 0.98);
          text-shadow: 0 0 14px rgba(255, 255, 255, 0.25);
        }

        .landing-hero__head:hover .landing-hero__head-dot {
          background: rgba(255, 255, 255, 0.55);
        }

        .landing-hero__head-link {
          flex: 0 1 auto;
          min-width: 0;
          color: rgba(230, 240, 255, 0.82);
          font-size: clamp(7px, 3.9cqi, 13px);
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          text-decoration: none;
          white-space: nowrap;
          line-height: 1.15;
          padding: clamp(2px, 0.85cqi, 4px) clamp(1px, 1.15cqi, 6px);
          border-radius: 6px;
          transition: color 0.18s ease, text-shadow 0.18s ease;
        }

        @container landing-head (max-width: 380px) {
          .landing-hero__head-link {
            letter-spacing: 0.025em;
          }
        }

        @container landing-head (max-width: 320px) {
          .landing-hero__head {
            gap: clamp(1px, 0.8cqi, 4px);
            padding-inline: clamp(4px, 1.8cqi, 10px);
          }

          .landing-hero__head-link {
            letter-spacing: 0;
            font-size: clamp(7px, 4.25cqi, 12px);
          }

          .landing-hero__head-dot {
            width: 2px;
            height: 2px;
          }
        }

        @container landing-head (max-width: 280px) {
          .landing-hero__head-link {
            font-size: clamp(6px, 4.6cqi, 11px);
            padding-inline: 1px;
          }
        }

        @supports not (container-type: inline-size) {
          .landing-hero__head {
            gap: clamp(2px, 1vw, 9px);
            padding: 7px clamp(5px, 2.2vw, 14px);
          }

          .landing-hero__head-link {
            font-size: clamp(7px, 2.35vw, 13px);
            letter-spacing: 0.03em;
            padding: 4px clamp(1px, 1.2vw, 6px);
          }
        }

        @media (max-width: 360px) {
          @supports not (container-type: inline-size) {
            .landing-hero__head-link {
              font-size: clamp(7px, 2.05vw, 11px);
              letter-spacing: 0;
            }
          }
        }

        .landing-hero__head:hover .landing-hero__head-link:hover {
          color: #fff;
          text-shadow: 0 0 18px rgba(186, 230, 253, 0.45);
        }

        .landing-hero__head-link:focus-visible {
          outline: 2px solid rgba(186, 230, 253, 0.9);
          outline-offset: 2px;
        }

        .landing-hero__head-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.38);
          flex-shrink: 0;
          transition: background 0.18s ease;
        }

        .landing-hero__bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .landing-hero__mesh {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 120% 80% at 0% 0%, rgba(56, 100, 200, 0.2), transparent 55%),
            radial-gradient(ellipse 90% 70% at 100% 10%, rgba(120, 80, 220, 0.14), transparent 50%),
            radial-gradient(ellipse 70% 50% at 50% 100%, rgba(30, 80, 160, 0.15), transparent 45%),
            linear-gradient(165deg, rgb(3, 8, 24) 0%, rgb(5, 12, 35) 100%);
        }

        .landing-hero__orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.35;
          mix-blend-mode: screen;
          animation: landingHeroDrift 22s ease-in-out infinite;
        }

        .landing-hero__orb--a {
          width: min(55vw, 420px);
          height: min(55vw, 420px);
          top: -12%;
          left: -8%;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.7) 0%, transparent 70%);
          animation-delay: 0s;
        }

        .landing-hero__orb--b {
          width: min(65vw, 520px);
          height: min(65vw, 520px);
          bottom: -18%;
          right: -12%;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.55) 0%, transparent 68%);
          animation-delay: -7s;
          animation-duration: 26s;
        }

        .landing-hero__orb--c {
          width: min(45vw, 360px);
          height: min(45vw, 360px);
          top: 38%;
          right: 5%;
          background: radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 65%);
          opacity: 0.25;
          animation-delay: -14s;
          animation-duration: 19s;
        }

        @keyframes landingHeroDrift {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(2%, 3%) scale(1.05);
          }
          66% {
            transform: translate(-2%, 1%) scale(0.98);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-hero__orb {
            animation: none;
          }

          .landing-hero__head,
          .landing-hero__head:hover {
            transform: none;
          }
        }

        .landing-hero__grid {
          position: absolute;
          inset: 0;
          opacity: 0.07;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.35) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 85% 75% at 50% 45%, black 20%, transparent 75%);
        }

        .landing-hero__noise {
          position: absolute;
          inset: 0;
          opacity: 0.055;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
        }

        .landing-hero__inner {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: min(100%, 720px);
          min-height: 0;
          gap: clamp(8px, 2.4vw, 18px);
          padding-top: clamp(4px, 1.2vw, 10px);
        }

        .landing-hero__logo-wrap {
          pointer-events: auto;
          user-select: none;
          display: flex;
          justify-content: center;
          transition: transform 0.2s ease;
        }

        .landing-hero__logo-wrap[data-hover="1"] {
          transform: scale(1.015);
        }

        .landing-hero__wordmark {
          margin: 0;
          font-family: var(--font-brand), sans-serif;
          font-size: clamp(56px, 16vw, 130px);
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1;
          color: #fff;
          text-shadow: 0 0 80px rgba(59, 130, 246, 0.3), 0 4px 24px rgba(0,0,0,0.4);
        }

        .landing-hero__cta-logo {
          width: 22px;
          height: 30px;
          border-radius: 6px;
          object-fit: cover;
          object-position: center;
          display: block;
          flex-shrink: 0;
        }

        .landing-hero__tag {
          margin: 0;
          margin-top: clamp(60px, 12vw, 100px);
          padding: 0 max(8px, 2vw);
          color: rgba(235, 245, 255, 0.92);
          font-size: clamp(9px, 2.8vw, 12px);
          letter-spacing: clamp(0.06em, 1.2vw, 0.12em);
          text-transform: uppercase;
          text-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
          text-align: center;
          line-height: 1.35;
          max-width: 22rem;
        }

        .landing-hero__cta-block {
          position: relative;
          z-index: 5;
          width: 100%;
          max-width: min(300px, calc(100vw - 32px));
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: clamp(8px, 1.5vw, 14px);
        }

        .landing-hero__cta-block--open {
          max-width: min(460px, calc(100vw - 24px));
        }

        .landing-hero__cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: min(100%, 320px);
          max-width: 100%;
          padding: clamp(11px, 2.5vw, 14px) clamp(24px, 5vw, 32px);
          border-radius: clamp(22px, 6vw, 28px);
          border: 1px solid rgba(100, 130, 180, 0.35);
          outline: 1px solid rgba(60, 80, 120, 0.25);
          outline-offset: 3px;
          background: #2563eb;
          color: #fff;
          font-size: clamp(13px, 3.6vw, 16px);
          font-weight: 700;
          letter-spacing: 0.01em;
          cursor: pointer;
          box-shadow:
            0 0 0 1px rgba(37, 99, 235, 0.4),
            0 10px 32px rgba(37, 99, 235, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .landing-hero__cta:hover {
          transform: translateY(-2px);
          background: #3b82f6;
          box-shadow:
            0 0 0 1px rgba(59, 130, 246, 0.5),
            0 14px 40px rgba(37, 99, 235, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .landing-hero__cta:active {
          transform: translateY(0);
        }

        .cw {
          width: 100%;
          padding: 22px 24px 60px;
          border-radius: 18px 18px 0 0;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-bottom: none;
          background: rgba(6, 15, 50, 0.88);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 -4px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12);
          animation: cwIn 0.22s cubic-bezier(0.34, 1.1, 0.64, 1);
        }

        @keyframes cwIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cw-top {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          margin-bottom: 20px;
        }

        .cw-title {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: rgba(255,255,255,0.6);
          text-align: center;
        }

        .cw-x {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          color: rgba(255,255,255,0.35);
          cursor: pointer;
          padding: 4px;
          transition: color 0.15s;
        }

        .cw-x:hover { color: #fff; }

        .cw-row {
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .cw-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 8px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.05);
          cursor: pointer;
          position: relative;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
          -webkit-tap-highlight-color: transparent;
        }

        .cw-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.11);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-2px);
        }

        .cw-btn:active:not(:disabled) { transform: scale(0.97); }
        .cw-btn:disabled { opacity: 0.4; cursor: wait; }

        .cw-logo {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          object-fit: contain;
          display: block;
        }

        .cw-name {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          letter-spacing: 0.01em;
        }

        .cw-star {
          position: absolute;
          top: 6px;
          right: 7px;
          font-size: 7px;
          color: rgba(186,230,253,0.6);
        }

        .cw-powered {
          margin: 12px 0 0;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.28);
          text-align: center;
          text-transform: uppercase;
        }

        .cw-err {
          margin: 8px 0 0;
          font-size: 10px;
          color: rgba(252,165,165,0.9);
          text-align: center;
        }

        @media (min-width: 480px) {
          .landing-hero__inner {
            gap: clamp(10px, 2.2vw, 22px);
          }

          .landing-hero__logo {
            width: min(74vw, 700px);
          }
        }

        .landing-footer {
          position: fixed;
          bottom: max(20px, env(safe-area-inset-bottom, 0px) + 14px);
          left: max(20px, env(safe-area-inset-left, 0px) + 16px);
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .landing-footer__link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.32);
          text-decoration: none;
          transition: color 0.18s;
        }

        .landing-footer__link:hover {
          color: rgba(255, 255, 255, 0.75);
        }

        .landing-footer__dot {
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          flex-shrink: 0;
        }
      `}</style>
    </main>
  );
}
