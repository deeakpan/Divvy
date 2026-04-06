import { TOKENS } from "./constants";

/** Normalize contract address for Cartridge policy `target` fields. */
function norm(addr: string): string {
  return "0x" + BigInt(addr).toString(16);
}

/**
 * Sepolia: Nethermind validator STRK delegation pool (from `getStakerPools(NETHERMIND.stakerAddress)`).
 * Set `NEXT_PUBLIC_STAKING_POOL_STRK` if you stake through a different pool.
 */
export const STAKING_POOL_STRK_SEPOLIA =
  process.env.NEXT_PUBLIC_STAKING_POOL_STRK?.trim() ||
  "0x0755e4fbfd6ca9a17e532a0eb3027dd3202957d5bcc2912cbc5a7fb199cc78c6";

/** Divvy Vesu Router — defaults to last known deploy; override with `NEXT_PUBLIC_DIVVY_VESU_ROUTER`. */
export const DIVVY_VESU_ROUTER =
  process.env.NEXT_PUBLIC_DIVVY_VESU_ROUTER?.trim() ||
  "0x5e07162d95b4c5827687266f747b01b7728562c826ed11e212b2d9d20fb4879";

/**
 * Policies passed to `CartridgeWallet.create` / StarkZap `toSessionPolicies()`.
 * Covers: router (STRK→Vesu USDC), STRK approve for pool + router + transfers to cold wallet, staking pool txs.
 */
export function getCartridgeStarkzapPolicies(): { target: string; method: string }[] {
  const strk = norm(TOKENS.STRK.address);
  const usdc = norm(TOKENS.USDC.address);
  const eth = norm(TOKENS.ETH.address);
  const pool = norm(STAKING_POOL_STRK_SEPOLIA);
  const router = norm(DIVVY_VESU_ROUTER);

  return [
    { target: router, method: "deposit_strk_mint_usdc_to_vesu" },
    { target: router, method: "refresh_chainlink_prices" },
    { target: strk, method: "approve" },
    { target: strk, method: "transfer" },
    { target: usdc, method: "transfer" },
    { target: eth, method: "transfer" },
    { target: pool, method: "enter_delegation_pool" },
    { target: pool, method: "add_to_delegation_pool" },
    { target: pool, method: "claim_rewards" },
    { target: pool, method: "exit_delegation_pool_intent" },
    { target: pool, method: "exit_delegation_pool_action" },
  ];
}
