"use client";

/**
 * Reference: long-form Divvy marketing landing (splits product narrative).
 * Not imported by the app — copy into another project as needed.
 */

import Image from "next/image";
import { Browser, CreditCard, Planet } from "react-kawaii";
import { useEffect, useRef, useState } from "react";

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduce;
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          el.classList.add("lp-reveal--visible");
          obs.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const HERO_WORDS = ["wallet.", "portfolio.", "staker.", "treasury."];

function RotatingLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % HERO_WORDS.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      className="font-display"
      style={{
        display: "inline-block",
        minWidth: "min(100%, 280px)",
        fontSize: "clamp(40px, 6vw, 76px)",
        fontWeight: 600,
        letterSpacing: "-0.045em",
        lineHeight: 1.05,
        color: "#007BFF",
      }}
    >
      <span key={i} className="lp-rotate-word">
        {HERO_WORDS[i]}
      </span>
    </span>
  );
}

export default function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  return (
    <main style={{ margin: 0, padding: 0 }}>
      <Hero onLaunch={onLaunch} />
      <div className="lp-pattern-navy">
        <StackStrip />
        <Pillars />
        <Unlock />
        <VesuLiquidity />
        <ProductBlocks />
      </div>
      <FinalCta onLaunch={onLaunch} />
      <Footer />
    </main>
  );
}

function Hero({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="lp-hero">
      <div className="lp-container">
        <p
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--lp-faint)",
            marginBottom: 28,
          }}
        >
          Starknet · Non-custodial
        </p>

        <h1 className="font-display" style={{ margin: 0, maxWidth: 900 }}>
          <span
            style={{
              display: "block",
              fontSize: "clamp(40px, 6vw, 76px)",
              fontWeight: 600,
              letterSpacing: "-0.045em",
              lineHeight: 1.05,
              color: "var(--lp-ink)",
            }}
          >
            Programmable splits,
          </span>
          <span
            style={{
              display: "block",
              fontSize: "clamp(40px, 6vw, 76px)",
              fontWeight: 600,
              letterSpacing: "-0.045em",
              lineHeight: 1.05,
              color: "var(--lp-muted)",
              marginTop: 4,
            }}
          >
            for every
          </span>
          <span style={{ display: "block", marginTop: 4 }}>
            <RotatingLine />
          </span>
        </h1>

        <p
          style={{
            marginTop: 36,
            maxWidth: 520,
            fontSize: 18,
            lineHeight: 1.65,
            color: "var(--lp-muted)",
            fontWeight: 400,
          }}
        >
          You pick percentages once. On each deposit, Divvy splits your STRK into four buckets: staking, USDC yield on Vesu, cold-wallet transfer, and liquid balance in your wallet. One confirmation, then each bucket runs automatically with your rules.
        </p>

        <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <button type="button" className="lp-btn-primary" onClick={onLaunch}>
            <span className="lp-btn-primary__label">Get started</span>
            <span className="lp-btn-primary-arrow" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  className="lp-btn-primary-arrow__path"
                  d="M9 6l7 6-7 6"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
          <a href="#how" className="lp-btn-ghost" style={{ padding: "12px 22px", fontSize: 15 }}>
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const ref = useReveal();
  const items = [
    {
      title: "Non-custodial by design",
      body: "Transactions execute from the user’s account. Session keys and Cartridge policies only sign what you allow. Divvy never holds your keys.",
      illu: (
        <CreditCard uniqueId="pillar-custody" size={118} mood="blissful" color="#8ec8ff" className="lp-pillar-kawaii" />
      ),
    },
    {
      title: "Modular splits",
      body: "Set a percent for each bucket, and Divvy applies that split every time. You can change the mix anytime without rebuilding your whole strategy.",
      illu: (
        <Browser uniqueId="pillar-modular" size={118} mood="happy" color="#7eb8ff" className="lp-pillar-kawaii" />
      ),
    },
    {
      title: "Built to scale",
      body: "The same split model works across environments: test on Sepolia first, then keep the same setup when using live routes.",
      illu: (
        <Planet uniqueId="pillar-scale" size={118} mood="excited" color="#9dd6ff" className="lp-pillar-kawaii" />
      ),
    },
  ];

  return (
    <section id="product" className="lp-section" style={{ background: "transparent", paddingTop: 72 }}>
      <div ref={ref} className="lp-container lp-reveal">
        <div className="lp-pillars-grid">
          {items.map((item) => (
            <article key={item.title} className="lp-pillar-card">
              <div className="lp-pillar-stage" aria-hidden>
                {item.illu}
              </div>
              <h3 className="font-display lp-pillar-title">{item.title}</h3>
              <p className="lp-pillar-body">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Unlock() {
  const ref = useReveal();
  return (
    <section id="solution" className="lp-section" style={{ background: "transparent", paddingTop: 72 }}>
      <div ref={ref} className="lp-container lp-reveal">
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(28px, 3.5vw, 44px)",
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 1.15,
            color: "var(--lp-on-navy)",
            maxWidth: 640,
          }}
        >
          Unlock Starknet yield rails.
        </h2>
        <p style={{ marginTop: 20, maxWidth: 560, fontSize: 17, lineHeight: 1.65, color: "var(--lp-on-navy-muted)" }}>
          Instead of manually staking, lending, and forwarding funds in separate apps, Divvy does the split in one flow. You keep custody, choose the percentages, and decide where each part of the balance goes.
        </p>
        <a
          href="#product"
          style={{
            display: "inline-block",
            marginTop: 24,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--lp-on-navy)",
            textDecoration: "none",
            borderBottom: "1px solid rgba(255,255,255,0.45)",
            paddingBottom: 2,
          }}
        >
          Explore the split →
        </a>
      </div>
    </section>
  );
}

type Block = {
  id: string;
  title: string;
  lead: string;
  bullets: string[];
};

function VesuLiquidity() {
  const ref = useReveal();
  return (
    <section id="liquidity" className="lp-section lp-vesu-band">
      <div ref={ref} className="lp-container lp-reveal">
        <p className="font-mono lp-vesu-kicker">Vesu · Starknet liquidity</p>
        <h2 className="font-display lp-vesu-section-title">Put your crypto to work, next to serious liquidity.</h2>
        <p className="lp-vesu-lead">
          Earn from pooled lending while others borrow from the same liquidity your Divvy split can route into.
        </p>
        <div className="lp-vesu-row">
          <div className="lp-vesu-copy">
            <p className="lp-vesu-p">
              Vesu is where Starknet users supply assets to shared pools and earn yield when others borrow. When someone
              borrows, the tokens show up in their wallet. Divvy can route part of your split into those same pools so
              your USDC or other supported assets sit where activity already is.
            </p>
            <p className="lp-vesu-p lp-vesu-p--last">
              You can still send another slice to STRK staking, so lending-style yield and staking rewards can both show
              up in one plan. Yields move with demand; in the app you will see what each option is paying today.
            </p>
          </div>
          <div className="lp-vesu-visual">
            <Image
              src="/vesusnippet.png"
              alt="Vesu app interface showing lending markets and yield on Starknet"
              width={640}
              height={480}
              className="lp-vesu-snippet"
              sizes="(max-width: 900px) min(92vw, 360px) 360px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductBlock({ block }: { block: Block }) {
  const ref = useReveal();
  return (
    <section
      id={block.id}
      className="lp-section"
      style={{
        background: "transparent",
        borderTop: "1px solid var(--lp-on-navy-border)",
        paddingTop: 72,
      }}
    >
      <div ref={ref} className="lp-container lp-reveal">
        <p
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--lp-on-navy-faint)",
            marginBottom: 14,
          }}
        >
          {block.title}
        </p>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(26px, 3vw, 36px)",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: "var(--lp-on-navy)",
            maxWidth: 560,
            lineHeight: 1.2,
          }}
        >
          {block.lead}
        </h2>
        <ul style={{ marginTop: 28, padding: 0, listStyle: "none", maxWidth: 560 }}>
          {block.bullets.map((line) => (
            <li
              key={line.slice(0, 32)}
              style={{
                position: "relative",
                paddingLeft: 20,
                marginBottom: 16,
                fontSize: 16,
                lineHeight: 1.6,
                color: "var(--lp-on-navy-muted)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: "0.55em",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.45)",
                }}
              />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProductBlocks() {
  const blocks: Block[] = [
    {
      id: "how",
      title: "How it works",
      lead: "Connect, set your split, and confirm one transaction.",
      bullets: [
        "Use your Starknet wallet (or Cartridge). Assets stay under your address.",
        "Set percentages for stake, Vesu USDC yield, cold-wallet forwarding, and liquid.",
        "On deposit, Divvy executes those actions in one batched flow instead of four separate manual steps.",
        "When you change percentages, the next run uses your new split.",
      ],
    },
    {
      id: "split",
      title: "What gets routed",
      lead: "Each deposit is split into four buckets.",
      bullets: [
        "Staking: a chosen % of STRK goes to delegation.",
        "Vesu yield: a chosen % is converted/routed into USDC lending on Vesu.",
        "Cold wallet: a chosen % is sent to your own external address.",
        "Liquid: the rest stays available in-wallet for immediate use.",
      ],
    },
  ];

  return (
    <>
      {blocks.map((b) => (
        <ProductBlock key={b.id} block={b} />
      ))}
    </>
  );
}

/** Vesu has no asset in /public; geometric mark matches grey → color hover treatment. */
function VesuMark({ muted }: { muted: boolean }) {
  return (
    <svg width={34} height={34} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        fill={muted ? "rgba(255,255,255,0.58)" : "#A855F7"}
        d="M16 3 28 29h-5.2L16 12.2 9.2 29H4L16 3Z"
      />
    </svg>
  );
}

function StackRasterPair({ src }: { src: string }) {
  return (
    <>
      <div className="lp-stack-brand__layer">
        <Image
          src={src}
          alt=""
          width={40}
          height={40}
          sizes="40px"
          className="lp-stack-brand__img lp-stack-brand__img--muted"
          style={{ width: 38, height: 38, maxWidth: 38, maxHeight: 38 }}
        />
      </div>
      <div className="lp-stack-brand__layer">
        <Image
          src={src}
          alt=""
          width={40}
          height={40}
          sizes="40px"
          className="lp-stack-brand__img"
          style={{ width: 38, height: 38, maxWidth: 38, maxHeight: 38 }}
        />
      </div>
    </>
  );
}

const STACK_LINKS = [
  { id: "starknet", name: "Starknet", href: "https://www.starknet.io", src: "/starknet.webp" as const },
  { id: "vesu", name: "Vesu", href: "https://vesu.xyz", kind: "vesu" as const },
  { id: "starkzap", name: "StarkZap", href: "https://www.npmjs.com/package/starkzap", src: "/starkzap.png" as const },
  { id: "chainlink", name: "Chainlink", href: "https://chain.link", src: "/chainlink.png" as const },
  { id: "cartridge", name: "Cartridge", href: "https://cartridge.gg", src: "/catridge.png" as const },
] as const;

type StackItem = (typeof STACK_LINKS)[number];

function StackBrandLink({ item }: { item: StackItem }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className="lp-stack-brand font-display"
      aria-label={`${item.name} (opens in new tab)`}
    >
      <span className="lp-stack-brand__viewport">
        <span className="lp-stack-brand__track">
          {"kind" in item && item.kind === "vesu" ? (
            <>
              <span className="lp-stack-brand__layer">
                <VesuMark muted />
              </span>
              <span className="lp-stack-brand__layer">
                <VesuMark muted={false} />
              </span>
            </>
          ) : (
            "src" in item && <StackRasterPair src={item.src} />
          )}
        </span>
      </span>
      <span className="lp-stack-brand__name">{item.name}</span>
    </a>
  );
}

function StackStrip() {
  const ref = useReveal();
  const reduceMotion = usePrefersReducedMotion();
  const loopItems = reduceMotion ? [...STACK_LINKS] : [...STACK_LINKS, ...STACK_LINKS];

  return (
    <section
      id="stack"
      className="lp-section"
      style={{
        background: "transparent",
        borderTop: "1px solid var(--lp-on-navy-border)",
        paddingTop: 72,
        paddingBottom: 96,
      }}
    >
      <div className="lp-container">
        <div ref={ref} className="lp-reveal">
          <p
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--lp-on-navy-faint)",
              marginBottom: 20,
            }}
          >
            Stack
          </p>
        </div>
      </div>
      <div className="lp-stack-marquee">
        <div className={`lp-stack-marquee__track${reduceMotion ? " lp-stack-marquee__track--static" : ""}`}>
          {loopItems.map((item, i) => (
            <StackBrandLink key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section
      style={{
        background: "#007BFF",
        color: "#fff",
        padding: "88px 24px",
        textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.2)",
      }}
    >
      <div className="lp-container">
        <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, letterSpacing: "-0.035em", marginBottom: 16 }}>
          Get started in minutes.
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.88)", maxWidth: 420, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Open Divvy on Sepolia, connect your wallet, and run your first split when the app is live for your cohort.
        </p>
        <button
          type="button"
          onClick={onLaunch}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 28px",
            background: "#fff",
            color: "#007BFF",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Launch Divvy
        </button>
      </div>
    </section>
  );
}

function Footer() {
  const productLinks = [
    ["#product", "Overview"],
    ["#how", "How it works"],
    ["#stack", "Stack"],
    ["/app", "Launch app"],
  ] as const;

  const ecosystemLinks = [
    ["https://www.starknet.io", "Starknet"],
    ["https://vesu.xyz", "Vesu"],
    ["https://www.npmjs.com/package/starkzap", "StarkZap"],
    ["https://chain.link", "Chainlink"],
    ["https://cartridge.gg", "Cartridge"],
  ] as const;

  const resourceLinks = [
    ["https://docs.starknet.io", "Starknet docs"],
    ["https://docs.chain.link", "Chainlink docs"],
    ["https://starkscan.co", "Starkscan explorer"],
  ] as const;

  const legalLinks = [
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms of service"],
  ] as const;

  return (
    <footer className="lp-footer-pattern" style={{ padding: "48px 24px 56px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="lp-container">
        <div className="lp-footer-grid">
          <div>
            <div className="lp-footer-brand">
              <span className="lp-footer-logo-wrap">
                <Image src="/logo.png" alt="" width={200} height={200} className="lp-footer-logo" sizes="96px" />
              </span>
              <span className="lp-footer-brand__word">Divvy</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--lp-on-navy-muted)", maxWidth: 300, lineHeight: 1.6, margin: 0 }}>
              Non-custodial split flows for STRK, ETH, and USDC yield on Starknet with staking, Vesu lending, cold forwarding, and liquid balance in one intent.
            </p>
          </div>

          <div>
            <p className="lp-footer-heading">Product</p>
            {productLinks.map(([href, label]) => (
              <a key={href + label} href={href} className="lp-footer-link">
                {label}
              </a>
            ))}
          </div>

          <div>
            <p className="lp-footer-heading">Ecosystem</p>
            {ecosystemLinks.map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="lp-footer-link">
                {label}
                <span className="font-mono" style={{ opacity: 0.45, marginLeft: 4, fontSize: 11 }}>
                  ↗
                </span>
              </a>
            ))}
          </div>

          <div>
            <p className="lp-footer-heading">Resources</p>
            {resourceLinks.map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="lp-footer-link">
                {label}
                <span className="font-mono" style={{ opacity: 0.45, marginLeft: 4, fontSize: 11 }}>
                  ↗
                </span>
              </a>
            ))}
            <p className="lp-footer-heading" style={{ marginTop: 22 }}>
              Legal
            </p>
            {legalLinks.map(([href, label]) => (
              <a key={href} href={href} className="lp-footer-link">
                {label}
              </a>
            ))}
          </div>
        </div>

        <div className="lp-footer-bottom">
          <p className="lp-footer-legal">
            © 2026 Divvy. All rights reserved. Divvy is an interface to smart contracts you control; it is not a custodian and does not provide investment advice.
          </p>
          <span className="lp-footer-meta">Starknet · Non-custodial</span>
        </div>
      </div>
    </footer>
  );
}
