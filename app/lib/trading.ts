import { DIVVY_FPMM_ADDRESS, walletBalanceTokenAddress } from "@/app/lib/constants";

export const COLLATERAL_DECIMALS = 6;
const SCALE = 10n ** BigInt(COLLATERAL_DECIMALS);

export function getDivvyFpmmAddress(): string {
  const v = process.env.NEXT_PUBLIC_DIVVY_FPMM?.trim();
  if (v && v.length > 2) return v.startsWith("0x") ? v : `0x${v}`;
  const f = DIVVY_FPMM_ADDRESS;
  return f.startsWith("0x") ? f : `0x${f}`;
}

export function getCollateralTokenAddress(): string {
  return walletBalanceTokenAddress("USDC");
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
