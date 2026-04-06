"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "../components/WalletContext";
import { SplitPlanPanel } from "../components/SplitPlanPanel";
import { detectBrowserWallets } from "../lib/wallet";

type AppPanel = "splits" | "activity";

const SIDEBAR_ITEMS: { id: AppPanel; label: string }[] = [
  { id: "splits", label: "Split plan" },
  { id: "activity", label: "Activity" },
];

export default function AppPage() {
  const router = useRouter();
  return <AppShell onBack={() => router.push("/")} />;
}

function ConnectedHeaderWallet({
  address,
  method,
  isMobile,
  onDisconnect,
}: {
  address: string;
  method: "cartridge" | "browser" | null;
  isMobile: boolean;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const short = isMobile
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : `${address.slice(0, 8)}…${address.slice(-6)}`;

  const copy = () => {
    void navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 12px",
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${open ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 10, cursor: "pointer", color: "#fff",
          transition: "border-color 0.15s",
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#34d399",
          boxShadow: "0 0 6px rgba(52,211,153,0.6)",
          flexShrink: 0,
        }} />
        <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>
          {short}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{
          opacity: 0.4,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.18s",
        }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 220,
          background: "#0a0f22",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "6px",
          zIndex: 200,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}>
          {/* method badge */}
          {method && (
            <div style={{
              padding: "8px 10px 6px",
              fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(147,197,253,0.7)",
            }}>
              {method === "cartridge" ? "Cartridge" : "Browser wallet"}
            </div>
          )}

          {/* copy address */}
          <button
            type="button"
            onClick={copy}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 10px", borderRadius: 8, border: "none",
              background: "transparent", cursor: "pointer", color: "rgba(255,255,255,0.7)",
              fontSize: 12, transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span className="font-mono" style={{ fontSize: 11 }}>
              {`${address.slice(0, 14)}…${address.slice(-8)}`}
            </span>
            {copied
              ? <span style={{ fontSize: 10, color: "#6ee7b7", fontWeight: 700 }}>Copied</span>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" opacity={0.5}>
                  <path d="M8 7h9a2 2 0 012 2v9M7 8H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-1"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            }
          </button>

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

          {/* disconnect */}
          <button
            type="button"
            onClick={() => { setOpen(false); onDisconnect(); }}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8,
              border: "none", background: "transparent",
              cursor: "pointer", color: "rgba(239,68,68,0.75)",
              fontSize: 13, fontWeight: 500, textAlign: "left",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              e.currentTarget.style.color = "rgba(239,68,68,0.95)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(239,68,68,0.75)";
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

function AppShell({ onBack }: { onBack: () => void }) {
  const { address, method, connecting, connectCartridge, connectBrowser, disconnect } = useWallet();
  const [panel, setPanel] = useState<AppPanel>("splits");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [browserWallets, setBrowserWallets] = useState<{ id: "argentX" | "braavos"; name: string }[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setBrowserWallets(detectBrowserWallets());
    const onResize = () => setIsMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleCartridge = async () => {
    setConnectError(null);
    try {
      await connectCartridge();
      setShowModal(false);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Connection failed");
    }
  };

  const handleBrowser = async (id?: "argentX" | "braavos") => {
    setConnectError(null);
    try {
      await connectBrowser(id);
      setShowModal(false);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Connection failed");
    }
  };

  const goPanel = (id: AppPanel) => {
    setPanel(id);
    setSidebarOpen(false);
  };

  return (
    <div className="app-root">
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <div className="app-topbar-left">
            {isMobile && (
              <button
                type="button"
                className="app-icon-btn"
                aria-label="Open menu"
                onClick={() => setSidebarOpen(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button type="button" onClick={onBack} className="app-brand-btn">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={36} height={36} className="app-brand-logo" />
              <span className="app-brand-text font-display">Divvy</span>
            </button>
            <span className="app-sepolia-pill font-mono">Starknet Sepolia</span>
          </div>

          <div className="app-topbar-right">
            {address ? (
              <ConnectedHeaderWallet
                address={address}
                method={method}
                isMobile={isMobile}
                onDisconnect={disconnect}
              />
            ) : (
              <button
                type="button"
                className="app-connect-cta app-connect-cta--topbar font-display"
                disabled={connecting}
                onClick={() => setShowModal(true)}
              >
                {connecting ? (
                  "Connecting…"
                ) : (
                  <>
                    <span>Connect wallet</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M3 8h10M9 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        {isMobile && sidebarOpen && (
          <button
            type="button"
            className="app-sidebar-backdrop"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`app-sidebar ${isMobile ? (sidebarOpen ? "app-sidebar--open" : "") : ""}`}>
          <nav className="app-sidebar-nav" aria-label="App sections">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`app-sidebar-link ${panel === item.id ? "app-sidebar-link--active" : ""}`}
                onClick={() => goPanel(item.id)}
              >
                <SidebarGlyph id={item.id} />
                <span className="app-sidebar-link-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <a
            href="https://docs.starknet.io"
            target="_blank"
            rel="noopener noreferrer"
            className="app-sidebar-docs"
          >
            Starknet docs
            <span aria-hidden className="app-sidebar-ext">
              {" →"}
            </span>
          </a>
          <p className="app-sidebar-foot">
            Testnet only. Balances and routes are for development; do not use real mainnet funds here.
          </p>
        </aside>

        <main className="app-main">
          {!address && (
            <div className="app-main-inner">
              <div className="app-connect-prompt">
                <h2 className="app-connect-prompt-title font-display">Connect a wallet</h2>
                <p className="app-connect-prompt-lead">Sepolia · Cartridge, Argent X, or Braavos</p>
                <button type="button" className="app-connect-cta font-display" onClick={() => setShowModal(true)}>
                  <span>Connect wallet</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
          {address && panel === "splits" && (
            <div className="app-main-inner app-main-inner--split">
              <SplitPlanPanel address={address} />
            </div>
          )}
          {address && panel === "activity" && (
            <PlaceholderPanel
              title="Activity"
              body="History and status for your splits will show here as we wire on-chain flows."
            />
          )}
        </main>
      </div>

      {showModal && (
        <div
          className="app-modal-overlay"
          onClick={() => {
            setShowModal(false);
            setConnectError(null);
          }}
        >
          <div
            className="app-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="app-connect-title"
          >
            <div className="app-modal-head">
              <h2 id="app-connect-title" className="app-modal-title font-display">
                Connect wallet
              </h2>
              <button
                type="button"
                className="app-modal-close"
                aria-label="Close"
                onClick={() => {
                  setShowModal(false);
                  setConnectError(null);
                }}
              >
                ✕
              </button>
            </div>

            <WalletOption
              onClick={handleCartridge}
              disabled={connecting}
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <rect width="20" height="20" rx="6" fill="rgba(0,82,255,0.15)" />
                  <path
                    d="M10 4L14.5 7V13L10 16L5.5 13V7Z"
                    stroke="#0052FF"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                  <circle cx="10" cy="10" r="2" fill="#0052FF" />
                </svg>
              }
              title="Cartridge"
              subtitle="Social login · Passkey · Email · Google"
              badge="Recommended"
            />

            {browserWallets.length > 0 ? (
              browserWallets.map((w) => (
                <WalletOption
                  key={w.id}
                  onClick={() => handleBrowser(w.id)}
                  disabled={connecting}
                  icon={
                    <div
                      className="app-wallet-opt-icon"
                      data-variant={w.id === "argentX" ? "argent" : "braavos"}
                    >
                      <span>{w.id === "argentX" ? "A" : "B"}</span>
                    </div>
                  }
                  title={w.name}
                  subtitle="Browser extension"
                />
              ))
            ) : (
              <WalletOption
                onClick={() => handleBrowser()}
                disabled={connecting}
                icon={
                  <div className="app-wallet-opt-icon app-wallet-opt-icon--neutral">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <rect x="1" y="1" width="10" height="10" rx="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
                      <path d="M1 4.5h10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
                    </svg>
                  </div>
                }
                title="Browser wallet"
                subtitle="Argent X or Braavos"
              />
            )}

            {connectError && <p className="app-modal-error font-mono">{connectError}</p>}

            <p className="app-modal-foot font-mono">
              Starknet Sepolia testnet only. Set your wallet to Sepolia before signing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarGlyph({ id }: { id: AppPanel }) {
  const cls = "app-sidebar-icon";
  const stroke = "currentColor";
  const sw = 1.65;
  if (id === "splits") {
    return (
      <svg className={cls} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 4v6M12 10L7 18M12 10l5 8"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M5 12h10M5 17h12"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlaceholderPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="app-main-inner app-placeholder">
      <h2 className="app-placeholder-title font-display">{title}</h2>
      <p className="app-placeholder-body font-mono">{body}</p>
    </div>
  );
}

function WalletOption({
  onClick,
  disabled,
  icon,
  title,
  subtitle,
  badge,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="app-wallet-option"
      data-hover={hov ? "1" : "0"}
    >
      {icon}
      <div className="app-wallet-option-text">
        <p className="app-wallet-option-title">{title}</p>
        <p className="app-wallet-option-sub font-mono">{subtitle}</p>
      </div>
      {badge && <span className="app-wallet-option-badge font-mono">{badge}</span>}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="app-wallet-option-chevron" aria-hidden>
        <path
          d="M3 7H11M7.5 3.5L11 7L7.5 10.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
