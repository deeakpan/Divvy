"use client";

// No top-level starknet import — starknet is in serverExternalPackages and
// Turbopack will fail to bundle it for client routes. All starknet usage goes
// through dynamic import() inside async functions.
import { RPC_URL, SEPOLIA_WALLET_ERC20, APP_CHAIN } from "./constants";
import { STAKING_POOL_STRK_SEPOLIA } from "./cartridgePolicies";
import type { SplitPlanConfig } from "./splitPlan";

// ─── Constants ──────────────────────────────────────────────────────────────

const STRK_MIN_STAKE = 1_000_000_000_000_000_000n; // 1 STRK in wei
const VOYAGER_BASE =
  APP_CHAIN === "mainnet"
    ? "https://voyager.online/tx"
    : "https://sepolia.voyager.online/tx";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SplitTxResult = {
  hash: string;
  explorerUrl: string;
};

export type SplitPreview = {
  /** Current live STRK balance */
  currentStrkWei: bigint;
  /** STRK balance at last snapshot */
  snapshotStrkWei: bigint;
  /** New STRK received since last snapshot — what actually gets split */
  gainedWei: bigint;
  /** Threshold required to trigger a run (from config.threshold_strk) */
  thresholdWei: bigint;
  /** Whether gained >= threshold — if false, Run split is disabled */
  thresholdMet: boolean;
  /** How much more STRK is needed to meet the threshold (0 if met) */
  neededWei: bigint;
  /** Per-bucket allocations on gainedWei */
  stakeWei: bigint;
  coldWei: bigint;
  liquidWei: bigint;
  /** Vesu: held liquid on testnet, live on mainnet */
  vesuWei: bigint;
  belowMinStake: boolean;
};

// ─── Balance + preview ───────────────────────────────────────────────────────

export async function fetchSplitPreview(
  address: string,
  config: SplitPlanConfig,
  snapshotStrkWei: bigint,
): Promise<SplitPreview> {
  const strkAddress = SEPOLIA_WALLET_ERC20.STRK.address;
  const res = await fetch(`/api/balance?token=${strkAddress}&account=${encodeURIComponent(address)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch STRK balance.");
  const data = (await res.json()) as { low?: string; high?: string; error?: string };
  if (data.error) throw new Error(data.error);

  const currentStrkWei =
    BigInt(data.low ?? "0x0") + (BigInt(data.high ?? "0x0") << 128n);

  // Only split the new STRK since the last snapshot
  const gainedWei = currentStrkWei > snapshotStrkWei ? currentStrkWei - snapshotStrkWei : 0n;
  const thresholdWei = BigInt(Math.round(config.threshold_strk * 1e18));
  const thresholdMet = gainedWei >= thresholdWei;
  const neededWei = thresholdMet ? 0n : thresholdWei - gainedWei;

  // Split exactly the threshold amount — not the full gained balance.
  // If gained = 17 STRK and threshold = 10 STRK, split 10, leave 7 for next run.
  const splitAmount = thresholdMet ? thresholdWei : 0n;

  const stakeWei =
    config.stake_enabled && config.stake_bps > 0
      ? (splitAmount * BigInt(config.stake_bps)) / 10_000n
      : 0n;
  const vesuWei =
    config.vesu_yield_enabled && config.vesu_yield_bps > 0
      ? (splitAmount * BigInt(config.vesu_yield_bps)) / 10_000n
      : 0n;
  const coldWei =
    config.cold_wallet_enabled && config.cold_wallet_bps > 0
      ? (splitAmount * BigInt(config.cold_wallet_bps)) / 10_000n
      : 0n;
  const liquidWei =
    config.liquid_enabled && config.liquid_bps > 0
      ? (splitAmount * BigInt(config.liquid_bps)) / 10_000n
      : 0n;

  return {
    currentStrkWei,
    snapshotStrkWei,
    gainedWei,
    thresholdWei,
    thresholdMet,
    neededWei,
    stakeWei,
    coldWei,
    liquidWei,
    vesuWei,
    belowMinStake: stakeWei > 0n && stakeWei < STRK_MIN_STAKE,
  };
}

// ─── Pool membership check ────────────────────────────────────────────────────

// ─── Call builders ────────────────────────────────────────────────────────────

type RawCall = { contractAddress: string; entrypoint: string; calldata: string[] };

function buildStakingCalls(
  userAddress: string,
  stakeWei: bigint,
  member: boolean,
): RawCall[] {
  const strkAddress = SEPOLIA_WALLET_ERC20.STRK.address;
  const poolAddress = STAKING_POOL_STRK_SEPOLIA;
  return [
    { contractAddress: strkAddress, entrypoint: "approve", calldata: [poolAddress, stakeWei.toString(), "0"] },
    member
      ? { contractAddress: poolAddress, entrypoint: "add_to_delegation_pool", calldata: [userAddress, stakeWei.toString()] }
      : { contractAddress: poolAddress, entrypoint: "enter_delegation_pool", calldata: [userAddress, stakeWei.toString()] },
  ];
}

function buildColdWalletCall(
  coldAddress: string,
  coldWei: bigint,
): RawCall {
  return {
    contractAddress: SEPOLIA_WALLET_ERC20.STRK.address,
    entrypoint: "transfer",
    // ERC20 transfer: (recipient, amount_low, amount_high)
    calldata: [coldAddress, coldWei.toString(), "0"],
  };
}

// ─── Main execute ─────────────────────────────────────────────────────────────

export async function executeSplit(
  config: SplitPlanConfig,
  walletObj: unknown,
  method: "cartridge" | "browser",
  userAddress: string,
  snapshotStrkWei: bigint,
): Promise<SplitTxResult> {
  const preview = await fetchSplitPreview(userAddress, config, snapshotStrkWei);

  if (preview.currentStrkWei === 0n) {
    throw new Error("No STRK balance. Get testnet STRK from the faucet first.");
  }

  if (!preview.thresholdMet) {
    throw new Error(
      `Threshold not met — need ${formatStrk(preview.neededWei)} more STRK before running the split.`,
    );
  }

  if (preview.stakeWei > 0n && preview.stakeWei < STRK_MIN_STAKE) {
    throw new Error(
      `Stake slice is ${formatStrk(preview.stakeWei)} STRK — minimum is 1 STRK. Increase your staking % or deposit more STRK.`,
    );
  }

  // Build calls optimistically as a new member (enter_delegation_pool).
  // If the pool rejects with "Pool member exists", retry as existing member (add_to_delegation_pool).
  const assembleCalls = (member: boolean): RawCall[] => {
    const cs: RawCall[] = [];
    if (preview.stakeWei >= STRK_MIN_STAKE) cs.push(...buildStakingCalls(userAddress, preview.stakeWei, member));
    if (preview.coldWei > 0n && config.cold_wallet_address?.trim()) cs.push(buildColdWalletCall(config.cold_wallet_address.trim(), preview.coldWei));
    return cs;
  };

  const calls = assembleCalls(false);
  if (calls.length === 0) throw new Error("Nothing to execute — enable staking or cold wallet forwarding in your split plan.");

  // ── Execute ────────────────────────────────────────────────────────────────

  const send = async (cs: RawCall[]): Promise<SplitTxResult> => {
    if (method === "cartridge") {
      const cw = walletObj as { execute: (c: RawCall[]) => Promise<{ hash: string; explorerUrl: string }> };
      const tx = await cw.execute(cs);
      return { hash: tx.hash, explorerUrl: tx.explorerUrl };
    }
    const { WalletAccount, RpcProvider: Provider } = await import("starknet");
    const provider = new Provider({ nodeUrl: RPC_URL });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = new WalletAccount({ provider, walletProvider: walletObj as any, address: userAddress });
    const result = await account.execute(cs);
    return { hash: result.transaction_hash, explorerUrl: `${VOYAGER_BASE}/${result.transaction_hash}` };
  };

  try {
    return await send(calls);
  } catch (e) {
    // ArgentX throws plain objects; serialize everything to catch the revert reason
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    if (msg.includes("Pool member exists") || msg.includes("add_to_delegation_pool")) {
      return await send(assembleCalls(true));
    }
    throw e;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatStrk(wei: bigint, maxFrac = 4): string {
  const base = 10n ** 18n;
  const whole = wei / base;
  const frac = wei % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, "0").slice(0, maxFrac).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
