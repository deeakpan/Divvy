"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ConnectedWallet } from "../lib/wallet";

interface WalletState {
  address: string | null;
  wallet: unknown;
  method: "cartridge" | "browser" | null;
  connecting: boolean;
  connectCartridge: () => Promise<void>;
  connectBrowser: (id?: "argentX" | "braavos") => Promise<void>;
  disconnect: () => void;
}

const WALLET_METHOD_KEY = "divvy_wallet_method";

const WalletContext = createContext<WalletState>({
  address: null, wallet: null, method: null, connecting: false,
  connectCartridge: async () => {},
  connectBrowser: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Partial<ConnectedWallet> & { connecting: boolean }>({
    connecting: false,
  });

  const setConnected = (cw: ConnectedWallet) => {
    setState({ ...cw, connecting: false });
    localStorage.setItem(WALLET_METHOD_KEY, cw.method);
  };

  const connectCartridge = useCallback(async () => {
    setState(s => ({ ...s, connecting: true }));
    try {
      const { connectCartridge: fn } = await import("../lib/wallet");
      setConnected(await fn());
    } catch (e) {
      setState(s => ({ ...s, connecting: false }));
      throw e;
    }
  }, []);

  const connectBrowser = useCallback(async (id?: "argentX" | "braavos") => {
    setState(s => ({ ...s, connecting: true }));
    try {
      const { connectBrowser: fn } = await import("../lib/wallet");
      setConnected(await fn(id));
    } catch (e) {
      setState(s => ({ ...s, connecting: false }));
      throw e;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ connecting: false });
    localStorage.removeItem(WALLET_METHOD_KEY);
  }, []);

  // Auto-reconnect browser wallet only.
  // Cartridge reconnect can trigger a confirmation popup on refresh in some setups,
  // so we require explicit user action for Cartridge connections.
  useEffect(() => {
    const saved = localStorage.getItem(WALLET_METHOD_KEY);
    if (saved === "browser") {
      connectBrowser().catch(() => {
        localStorage.removeItem(WALLET_METHOD_KEY);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WalletContext.Provider value={{
      address: state.address ?? null, wallet: state.wallet ?? null, method: state.method ?? null,
      connecting: state.connecting, connectCartridge, connectBrowser, disconnect,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
