"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

type NavKey = "product" | "solution" | "docs" | "support";

const NAV_ITEMS: readonly {
  label: string;
  href: string;
  icon: NavKey;
  newTab?: boolean;
}[] = [
  { label: "Product", href: "#product", icon: "product" },
  { label: "Solution", href: "#solution", icon: "solution" },
  { label: "Docs", href: "https://docs.starknet.io", icon: "docs", newTab: true },
  { label: "Support", href: "mailto:support@divvy.xyz", icon: "support" },
];

const s = 1.65;
const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: s,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Inline SVGs with articulated motion on hover (paths/groups move; no glow or pop). */
function NavGlyph({ name }: { name: NavKey }) {
  switch (name) {
    case "product":
      return (
        <svg className="lp-ico-svg lp-ico-svg--product" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <g className="lp-ico-product-cell">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" {...stroke} />
          </g>
          <g className="lp-ico-product-cell">
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" {...stroke} />
          </g>
          <g className="lp-ico-product-cell">
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" {...stroke} />
          </g>
          <g className="lp-ico-product-cell">
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" {...stroke} />
          </g>
        </svg>
      );
    case "solution":
      return (
        <svg className="lp-ico-svg lp-ico-svg--solution" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <g className="lp-ico-sol-ring">
            <path d="M12 3L20 8.5v7L12 21l-8-5.5v-7L12 3z" {...stroke} />
          </g>
          <g className="lp-ico-sol-rail">
            <path d="M4 8.5L12 13l8-4.5" {...stroke} />
          </g>
          <circle className="lp-ico-sol-node" cx="12" cy="13.5" r="1.35" fill="currentColor" stroke="none" />
        </svg>
      );
    case "docs":
      return (
        <svg className="lp-ico-svg lp-ico-svg--docs" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <g className="lp-ico-docs-body">
            <path d="M8 3.5h6.5L18 7v13.5H8a2 2 0 01-2-2V5.5a2 2 0 012-2z" {...stroke} />
          </g>
          <g className="lp-ico-docs-fold">
            <path d="M14.5 3.5V7H18" {...stroke} />
          </g>
          <g className="lp-ico-docs-lines" strokeLinecap="round">
            <path className="lp-ico-docs-line lp-ico-docs-line--a" d="M10 11h6" />
            <path className="lp-ico-docs-line lp-ico-docs-line--b" d="M10 14.5h6" />
            <path className="lp-ico-docs-line lp-ico-docs-line--c" d="M10 18h4" />
          </g>
        </svg>
      );
    case "support":
      return (
        <svg className="lp-ico-svg lp-ico-svg--support" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path className="lp-ico-sup-band" d="M5.5 15.5V14a6.5 6.5 0 0113 0v1.5" {...stroke} />
          <path className="lp-ico-sup-mic" d="M8.5 15.5v1.2a3.5 3.5 0 007 0v-1.2" {...stroke} />
          <g className="lp-ico-sup-cup lp-ico-sup-cup--l">
            <rect x="2" y="13" width="4.5" height="6" rx="1.2" {...stroke} />
          </g>
          <g className="lp-ico-sup-cup lp-ico-sup-cup--r">
            <rect x="17.5" y="13" width="4.5" height="6" rx="1.2" {...stroke} />
          </g>
        </svg>
      );
    default:
      return null;
  }
}

export default function Header({ onLaunch }: { onLaunch?: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onResize = () => {
      const w = window.innerWidth < 900;
      setNarrow(w);
      if (!w) setOpen(false);
    };
    onResize();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const linkExtras = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.href.startsWith("mailto:")) return { target: undefined as string | undefined, rel: undefined as string | undefined };
    if (item.newTab) return { target: "_blank" as const, rel: "noopener noreferrer" as const };
    return {};
  };

  return (
    <header className={`lp-nav ${scrolled ? "lp-nav--scrolled" : ""}`}>
      <div className="lp-nav-inner">
        <div className="lp-nav-left">
          <a href="/" className="lp-nav-logo">
            <span className="lp-nav-logo__mark">
              <Image src="/logo.png" alt="" width={200} height={200} className="lp-nav-logo__img" priority sizes="140px" />
            </span>
            <span className="lp-nav-logo__word">Divvy</span>
          </a>
        </div>

        {!narrow && (
          <nav className="lp-nav-center" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <a key={item.label} href={item.href} className="lp-nav-link" {...linkExtras(item)}>
                <span className="lp-nav-link__icon" aria-hidden>
                  <NavGlyph name={item.icon} />
                </span>
                <span className="lp-nav-link__text">{item.label}</span>
              </a>
            ))}
          </nav>
        )}

        {narrow && <div className="lp-nav-center lp-nav-center--spacer" aria-hidden />}

        <div className="lp-nav-right">
          <button type="button" className="lp-nav-cta" onClick={onLaunch}>
            <span className="lp-nav-cta__label">Get started</span>
            <span className="lp-nav-cta-arrow" aria-hidden>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path
                  className="lp-nav-cta-arrow__path"
                  d="M9 6l7 6-7 6"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
          {narrow && (
            <button
              type="button"
              className="lp-nav-burger"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {open ? <path d="M6 6L18 18M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          )}
        </div>
      </div>

      {narrow && open && (
        <div className="lp-nav-drawer">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="lp-nav-drawer__link"
              {...linkExtras(item)}
              onClick={() => setOpen(false)}
            >
              <span className="lp-nav-link__icon lp-nav-link__icon--drawer" aria-hidden>
                <NavGlyph name={item.icon} />
              </span>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
