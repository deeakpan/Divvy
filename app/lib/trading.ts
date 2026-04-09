import {
  APP_CHAIN,
  DIVVY_FPMM_ADDRESS,
  SEPOLIA_WALLET_ERC20,
  TOKENS,
  walletBalanceTokenAddress,
} from "@/app/lib/constants";

export const COLLATERAL_DECIMALS = 6;
const SCALE = 10n ** BigInt(COLLATERAL_DECIMALS);

function normalizeHex(addr: string): string {
  const t = addr.trim();
  return t.startsWith("0x") ? t : `0x${t}`;
}

export function getDivvyFpmmAddress(): string {
  const v = process.env.NEXT_PUBLIC_DIVVY_FPMM?.trim();
  if (v && v.length > 2) return v.startsWith("0x") ? v : `0x${v}`;
  const f = DIVVY_FPMM_ADDRESS;
  return f.startsWith("0x") ? f : `0x${f}`;
}

/**
 * ERC-20 used for Divvy FPMM collateral: approve, buy, sell, profile USDC balance, faucet mint.
 * Must match the `usdc_token` stored on your deployed DivvyFPMM.
 *
 * Override (recommended for dev): set in `.env` and restart `next dev` / rebuild:
 *   NEXT_PUBLIC_DIVVY_USDC=0x...   (wins over everything)
 * On Sepolia only, if unset:
 *   NEXT_PUBLIC_MOCK_USDC=0x...     (e.g. mintable test USDC)
 * Otherwise: canonical USDC for the chain (Sepolia `0x0512feac…`, mainnet `TOKENS.USDC`).
 */
export function getCollateralTokenAddress(): string {
  const divvy = process.env.NEXT_PUBLIC_DIVVY_USDC?.trim();
  if (divvy && divvy.length > 2) return normalizeHex(divvy);

  if (APP_CHAIN === "sepolia") {
    const mock = process.env.NEXT_PUBLIC_MOCK_USDC?.trim();
    if (mock && mock.length > 2) return normalizeHex(mock);
  }

  return walletBalanceTokenAddress("USDC");
}

/** True when the app is still on default Sepolia canonical USDC (wallet mint usually fails). */
export function isDefaultSepoliaCanonicalUsdc(): boolean {
  if (APP_CHAIN !== "sepolia") return false;
  const a = getCollateralTokenAddress().toLowerCase();
  return a === SEPOLIA_WALLET_ERC20.USDC.address.toLowerCase();
}

/** Short hint for faucet UI when open mint is unlikely. */
export function faucetMintHint(): string | null {
  if (APP_CHAIN === "mainnet") {
    const a = getCollateralTokenAddress().toLowerCase();
    if (a === TOKENS.USDC.address.toLowerCase()) {
      return "Mainnet USDC cannot be minted from this app.";
    }
  }
  if (isDefaultSepoliaCanonicalUsdc()) {
    return "This Sepolia USDC is not mintable by your wallet. Set NEXT_PUBLIC_DIVVY_USDC (or NEXT_PUBLIC_MOCK_USDC) to the same mintable token your FPMM uses, restart the dev server, then try again.";
  }
  return null;
}

/** Parse human USDC / pool token amount (6 decimals) to raw u256-compatible bigint. */
export function parseCollateralToRaw(input: string): bigint {
  const s = input.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(s)) {
    throw new Error("Enter a valid amount (up to 6 decimals).");
  }
  const [whole, frac = ""] = s.split(".");
  const w = BigInt(whole || "0");
  const f = BigInt((frac + "000000").slice(0, 6));
  return w * SCALE + f;
}

export function formatCollateralRaw(raw: bigint, maxFrac = 4): string {
  const whole = raw / SCALE;
  let frac = raw % SCALE;
  if (frac === 0n) return `${whole}`;
  let fracStr = frac.toString().padStart(COLLATERAL_DECIMALS, "0").replace(/0+$/, "");
  if (fracStr.length > maxFrac) fracStr = fracStr.slice(0, maxFrac).replace(/0+$/, "");
  return `${whole}.${fracStr || "0"}`;
}

export function splitU256(n: bigint): [string, string] {
  const low = (n & ((1n << 128n) - 1n)).toString();
  const high = (n >> 128n).toString();
  return [low, high];
}

export function mulBpsDown(amount: bigint, slippageBps: number): bigint {
  if (amount <= 0n) return 0n;
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}
