"use client";

import { constants } from "starknet";
import { getCartridgeStarkzapPolicies } from "./cartridgePolicies";
import { APP_CHAIN, RPC_URL } from "./constants";

/**
 * StarkZap `CartridgeWallet.create` defaults to `provider.getChainId()` when this is omitted.
 * Some RPCs return a short felt (e.g. 0xc488) that is not UTF-8 "SN_SEPOLIA", which throws and triggers full reload.
 * We pin the chain using starknet.js constants (no `import from "starkzap"` root — it pulls optional deps that break the client bundle).
 */
const CARTRIDGE_CHAIN_STARKZAP =
  APP_CHAIN === "mainnet"
    ? {
        toFelt252: () => constants.StarknetChainId.SN_MAIN,
        toLiteral: () => "SN_MAIN" as const,
        isMainnet: () => true,
        isSepolia: () => false,
      }
    : {
        toFelt252: () => constants.StarknetChainId.SN_SEPOLIA,
        toLiteral: () => "SN_SEPOLIA" as const,
        isMainnet: () => false,
        isSepolia: () => true,
      };

export type ConnectedWallet = {
  address: string;
  /** wallet object: exposes .account.execute() or .execute() */
  wallet: unknown;
  method: "cartridge" | "browser";
};

/**
 * Connect via Cartridge Controller (passkey / social login: Google, Discord, email).
 * Uses starkzap/cartridge subpath which has no bridge/DCA deps.
 */
export async function connectCartridge(): Promise<ConnectedWallet> {
  const { CartridgeWallet } = await import("starkzap/cartridge");
  const wallet = await CartridgeWallet.create({
    rpcUrl: RPC_URL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- starkzap ChainId; avoid importing starkzap barrel in client
    chainId: CARTRIDGE_CHAIN_STARKZAP as any,
    policies: getCartridgeStarkzapPolicies(),
    /** Policy-matched invokes use Cartridge paymaster when eligible (gasless-style on testnet). */
    feeMode: "sponsored",
  });
  return { address: wallet.address, wallet, method: "cartridge" };
}

/**
 * Connect via browser extension wallet (Argent X / Braavos).
 */
export async function connectBrowser(walletId?: "argentX" | "braavos"): Promise<ConnectedWallet> {
  if (typeof window === "undefined") throw new Error("Not in browser");
  const win = window as unknown as Record<string, unknown>;

  let raw: Record<string, unknown> | null = null;
  if (walletId === "braavos" && win.starknet_braavos) raw = win.starknet_braavos as Record<string, unknown>;
  else if (win.starknet_argentX)                      raw = win.starknet_argentX as Record<string, unknown>;
  else if (win.starknet_braavos)                      raw = win.starknet_braavos as Record<string, unknown>;
  else if (win.starknet)                              raw = win.starknet as Record<string, unknown>;

  if (!raw) throw new Error("No Starknet wallet detected. Install Argent X or Braavos.");

  const result = await (raw.enable as () => Promise<string[]>)();
  const address = Array.isArray(result) ? result[0] : (raw.selectedAddress as string);
  if (!address) throw new Error("Wallet connection cancelled");

  return { address, wallet: raw, method: "browser" };
}

export function detectBrowserWallets(): { id: "argentX" | "braavos"; name: string }[] {
  if (typeof window === "undefined") return [];
  const win = window as unknown as Record<string, unknown>;
  const found: { id: "argentX" | "braavos"; name: string }[] = [];
  if (win.starknet_argentX) found.push({ id: "argentX", name: "Argent X" });
  if (win.starknet_braavos) found.push({ id: "braavos",  name: "Braavos" });
  return found;
}
