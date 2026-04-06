import { num } from "starknet";

export const SPLIT_TOTAL_BPS = 10_000;

export const DEFAULT_THRESHOLD_STRK = 10;

export type TokenBalanceU256 = { low: string; high: string };

export type SplitPlanBalanceSnapshot = {
  STRK: TokenBalanceU256;
  ETH: TokenBalanceU256;
  USDC: TokenBalanceU256;
  captured_at: string;
};

export type SplitPlanConfig = {
  stake_enabled: boolean;
  vesu_yield_enabled: boolean;
  cold_wallet_enabled: boolean;
  liquid_enabled: boolean;
  stake_bps: number;
  vesu_yield_bps: number;
  cold_wallet_bps: number;
  liquid_bps: number;
  cold_wallet_address: string;
  /** STRK amount above which a new allocation cycle may run (planning / policy UX). */
  threshold_strk: number;
};

export type SplitPlanRow = {
  wallet_address: string;
  config: SplitPlanConfig;
  balance_snapshot: SplitPlanBalanceSnapshot;
  created_at: string;
  updated_at: string;
};

export function normalizeStarknetAddress(addr: string): string {
  const hex = num.toHex(num.toBigInt(addr));
  return hex.toLowerCase();
}

function isNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

/** Shown in UI only in the red total line — not duplicated in a second banner. */
export const SPLIT_VALIDATION_SUM_MSG = "Totals must add up to 100%.";

export function parseSplitPlanConfig(raw: unknown): SplitPlanConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const stake_bps = o.stake_bps;
  const vesu_yield_bps = o.vesu_yield_bps;
  const cold_wallet_bps = o.cold_wallet_bps;
  const liquid_bps = o.liquid_bps;
  const cold_wallet_address =
    typeof o.cold_wallet_address === "string" ? o.cold_wallet_address.trim() : "";
  if (
    !isNonNegInt(stake_bps) ||
    !isNonNegInt(vesu_yield_bps) ||
    !isNonNegInt(cold_wallet_bps) ||
    !isNonNegInt(liquid_bps)
  ) {
    return null;
  }

  const legacy = !("stake_enabled" in o);
  const stake_enabled = legacy ? true : o.stake_enabled === true;
  const vesu_yield_enabled = legacy ? true : o.vesu_yield_enabled === true;
  const cold_wallet_enabled = legacy ? true : o.cold_wallet_enabled === true;
  const liquid_enabled = legacy ? true : o.liquid_enabled === true;

  let threshold_strk = DEFAULT_THRESHOLD_STRK;
  if ("threshold_strk" in o) {
    const t = o.threshold_strk;
    const n = typeof t === "number" ? t : typeof t === "string" ? Number(t) : NaN;
    if (Number.isFinite(n) && n > 0) threshold_strk = n;
  }

  return {
    stake_enabled,
    vesu_yield_enabled,
    cold_wallet_enabled,
    liquid_enabled,
    stake_bps,
    vesu_yield_bps,
    cold_wallet_bps,
    liquid_bps,
    cold_wallet_address,
    threshold_strk,
  };
}

export function validateSplitConfig(c: SplitPlanConfig): string | null {
  const parts: { en: boolean; bps: number }[] = [
    { en: c.stake_enabled, bps: c.stake_bps },
    { en: c.vesu_yield_enabled, bps: c.vesu_yield_bps },
    { en: c.cold_wallet_enabled, bps: c.cold_wallet_bps },
    { en: c.liquid_enabled, bps: c.liquid_bps },
  ];

  for (const p of parts) {
    if (!p.en && p.bps !== 0) {
      return "Turn off unused rows or set their share to 0%.";
    }
  }

  let sum = 0;
  for (const p of parts) {
    if (p.en) sum += p.bps;
  }
  if (sum !== SPLIT_TOTAL_BPS) {
    return SPLIT_VALIDATION_SUM_MSG;
  }

  if (!Number.isFinite(c.threshold_strk) || c.threshold_strk <= 0) {
    return "Enter a positive STRK threshold.";
  }

  const cold = c.cold_wallet_address.trim();
  if (c.cold_wallet_enabled && c.cold_wallet_bps > 0) {
    if (!cold.length) {
      return "Add a forwarding address.";
    }
    try {
      normalizeStarknetAddress(cold);
    } catch {
      return "That forwarding address isn’t valid.";
    }
  }
  return null;
}

export const DEFAULT_SPLIT_CONFIG: SplitPlanConfig = {
  stake_enabled: false,
  vesu_yield_enabled: false,
  cold_wallet_enabled: false,
  liquid_enabled: false,
  stake_bps: 0,
  vesu_yield_bps: 0,
  cold_wallet_bps: 0,
  liquid_bps: 0,
  cold_wallet_address: "",
  threshold_strk: DEFAULT_THRESHOLD_STRK,
};

export function u256ToBigInt(low: string, high: string): bigint {
  return (BigInt(high) << 128n) + BigInt(low);
}

export function formatTokenAmount(raw: bigint, decimals: number, maxFrac = 6): string {
  if (decimals < 0) return raw.toString();
  const base = 10n ** BigInt(decimals);
  const neg = raw < 0n;
  const n = neg ? -raw : raw;
  const whole = n / base;
  let frac = n % base;
  if (frac === 0n) return `${neg ? "-" : ""}${whole.toString()}`;
  let fracStr = frac.toString().padStart(decimals, "0");
  if (maxFrac < decimals) {
    fracStr = fracStr.slice(0, maxFrac).replace(/0+$/, "");
  } else {
    fracStr = fracStr.replace(/0+$/, "");
  }
  if (!fracStr) return `${neg ? "-" : ""}${whole.toString()}`;
  return `${neg ? "-" : ""}${whole.toString()}.${fracStr}`;
}

/** STRK slice for a bucket given wallet STRK balance (wei) and bps. */
export function strkSliceForBps(strkWei: bigint, bps: number): bigint {
  if (bps <= 0) return 0n;
  return (strkWei * BigInt(bps)) / BigInt(SPLIT_TOTAL_BPS);
}
