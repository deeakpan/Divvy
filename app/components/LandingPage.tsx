"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import "../landing-page.css";
import { useWallet } from "./WalletContext";

/* ── tiny decorative market card shown in the background ── */
function GhostCard({
  asset, logo, question, yes, no, timer, ghostKey,
}: {
  asset: string; logo: string; question: string;
  yes: number; no: number; timer: string;
  ghostKey: "a" | "b" | "c";
}) {
  return (
    <div className={`lp__ghost-card lp__ghost-card--${ghostKey}`} aria-hidden>
      <div className="lp__ghost-card__row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lp__ghost-card__logo" src={logo} alt="" />
        <span className="lp__ghost-card__asset">{asset}</span>
        <span className="lp__ghost-card__timer">{timer}</span>
      </div>
      <p className="lp__ghost-card__question">{question}</p>
      <div className="lp__ghost-card__bar">
        <div className="lp__ghost-card__bar-yes" style={{ width: `${yes}%` }} />
        <div className="lp__ghost-card__bar-no" style={{ width: `${no}%` }} />
      </div>
      <div className="lp__ghost-card__votes">
        <span className="lp__ghost-card__vote-yes">YES {yes}%</span>
        <span className="lp__ghost-card__vote-no">NO {no}%</span>
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
    router.push("/markets");
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
          ghostKey="a"
          asset="ETH" logo="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
          question="Will ETH break $3,400 this week?"
          yes={62} no={38} timer="2d:14h"
        />
        <GhostCard
          ghostKey="b"
          asset="BTC" logo="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
          question="Will BTC hit $72K before April?"
          yes={47} no={53} timer="5d:09h"
        />
        <GhostCard
          ghostKey="c"
          asset="STRK" logo="https://assets.coingecko.com/coins/images/26433/small/starknet.png"
          question="Will STRK reach $0.55 this month?"
          yes={71} no={29} timer="11d:02h"
        />
      </div>

      {/* ── top nav ── */}
      <div className="lp__nav-wrap">
        <nav className="lp__nav font-mono" aria-label="Primary">
          <a className="lp__nav-link" href="/markets">Markets</a>
          <span className="lp__nav-dot" aria-hidden />
          <a className="lp__nav-link" href="/markets">Yield</a>
          <span className="lp__nav-dot" aria-hidden />
          <a className="lp__nav-link" href="/markets">Leaderboard</a>
          <span className="lp__nav-dot" aria-hidden />
          <a className="lp__nav-link" href="/markets">Docs</a>
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
    </main>
  );
}
