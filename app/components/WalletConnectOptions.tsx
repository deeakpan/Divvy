"use client";

import { useCallback, useEffect, useState } from "react";
import { detectBrowserWallets } from "../lib/wallet";
import { useWallet } from "./WalletContext";

function WalletOption({
  onClick,
  disabled,
  icon,
  title,
  subtitle,
  badge,
  compact,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  compact?: boolean;
}) {
  const [hov, setHov] = useState(false);
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className="app-wallet-option app-wallet-option--compact"
        data-hover={hov ? "1" : "0"}
      >
        {icon}
        <span className="app-wallet-option-title-compact">{title}</span>
      </button>
    );
  }
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
      {badge ? <span className="app-wallet-option-badge font-mono">{badge}</span> : null}
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

export function WalletConnectOptions({
  onSuccess,
  className,
  id,
  showFootnote = true,
  compact = false,
}: {
  onSuccess?: () => void;
  className?: string;
  id?: string;
  showFootnote?: boolean;
  /** Horizontal chips: icon + short label only (e.g. landing). */
  compact?: boolean;
}) {
  const { connectCartridge, connectBrowser, connecting } = useWallet();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [browserWallets, setBrowserWallets] = useState<{ id: "argentX" | "braavos"; name: string }[]>([]);

  useEffect(() => {
    setBrowserWallets(detectBrowserWallets());
  }, []);

  const handleCartridge = useCallback(async () => {
    setConnectError(null);
    try {
      await connectCartridge();
      onSuccess?.();
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Connection failed");
    }
  }, [connectCartridge, onSuccess]);

  const handleBrowser = useCallback(
    async (walletId?: "argentX" | "braavos") => {
      setConnectError(null);
      try {
        await connectBrowser(walletId);
        onSuccess?.();
      } catch (e) {
        setConnectError(e instanceof Error ? e.message : "Connection failed");
      }
    },
    [connectBrowser, onSuccess]
  );

  const logoPx = compact ? 32 : 20;

  if (compact) {
    return (
      <div className={[className, "app-wallet-connect--compact"].filter(Boolean).join(" ")} id={id}>
        <div className="app-wallet-connect--compact-row">
          <WalletOption
            compact
            onClick={() => void handleCartridge()}
            disabled={connecting}
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/catridge.png" alt="" className="app-wallet-opt-logo" width={logoPx} height={logoPx} />
            }
            title="Cartridge"
            subtitle=""
          />
          <WalletOption
            compact
            onClick={() => void handleBrowser("argentX")}
            disabled={connecting}
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/wallet-argent.svg" alt="" className="app-wallet-opt-logo" width={logoPx} height={logoPx} />
            }
            title="Argent"
            subtitle=""
          />
          <WalletOption
            compact
            onClick={() => void handleBrowser("braavos")}
            disabled={connecting}
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/wallet-braavos.svg" alt="" className="app-wallet-opt-logo" width={logoPx} height={logoPx} />
            }
            title="Braavos"
            subtitle=""
          />
        </div>
        {connectError ? <p className="app-modal-error app-modal-error--compact font-mono">{connectError}</p> : null}
        {showFootnote ? (
          <p className="app-modal-foot app-modal-foot--compact font-mono">Sepolia testnet</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className} id={id}>
      <WalletOption
        onClick={() => void handleCartridge()}
        disabled={connecting}
        icon={
          // eslint-disable-next-line @next/next/no-img-element -- small static brand asset
          <img src="/catridge.png" alt="" className="app-wallet-opt-logo" width={logoPx} height={logoPx} />
        }
        title="Cartridge"
        subtitle="Social login · Passkey · Email · Google"
        badge="Recommended"
      />

      {browserWallets.length > 0 ? (
        browserWallets.map((w) => (
          <WalletOption
            key={w.id}
            onClick={() => void handleBrowser(w.id)}
            disabled={connecting}
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={w.id === "argentX" ? "/wallet-argent.svg" : "/wallet-braavos.svg"}
                alt=""
                className="app-wallet-opt-logo"
                width={logoPx}
                height={logoPx}
              />
            }
            title={w.name}
            subtitle="Browser extension"
          />
        ))
      ) : (
        <WalletOption
          onClick={() => void handleBrowser()}
          disabled={connecting}
          icon={
            <span className="app-wallet-opt-logos-pair" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wallet-argent.svg" alt="" className="app-wallet-opt-logo" width={logoPx} height={logoPx} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wallet-braavos.svg" alt="" className="app-wallet-opt-logo" width={logoPx} height={logoPx} />
            </span>
          }
          title="Browser wallet"
          subtitle="Argent X or Braavos"
        />
      )}

      {connectError ? <p className="app-modal-error font-mono">{connectError}</p> : null}

      {showFootnote ? (
        <p className="app-modal-foot font-mono">
          Starknet Sepolia testnet only. Set your wallet to Sepolia before signing.
        </p>
      ) : null}
    </div>
  );
}
