import { SEPOLIA_WALLET_ERC20 } from "./constants";
import { getCollateralTokenAddress, getDivvyFpmmAddress } from "./trading";

/** Normalize contract address for Cartridge policy `target` fields. */
function norm(addr: string): string {
  return "0x" + BigInt(addr).toString(16);
}

/**
 * Nethermind Sepolia STRK delegation pool.
 * Override with NEXT_PUBLIC_STAKING_POOL_STRK if you use a different pool.
 */
export const STAKING_POOL_STRK_SEPOLIA =
  process.env.NEXT_PUBLIC_STAKING_POOL_STRK?.trim() ||
  "0x0755e4fbfd6ca9a17e532a0eb3027dd3202957d5bcc2912cbc5a7fb199cc78c6";

/**
 * Policies passed to CartridgeWallet.create().
 *
 * These cover exactly what "Run split" does:
 *  - approve + enter/add delegation pool  (staking slice)
 *  - transfer STRK to cold wallet         (forward slice)
 *
 * No backend session keys — users sign each Run split manually.
 * Cartridge's built-in paymaster covers gas on testnet.
 */
export function getCartridgeStarkzapPolicies(): { target: string; method: string }[] {
  const strk = norm(SEPOLIA_WALLET_ERC20.STRK.address);
  const pool = norm(STAKING_POOL_STRK_SEPOLIA);
  const usdc = norm(getCollateralTokenAddress());
  const fpmm = norm(getDivvyFpmmAddress());

  return [
    { target: strk, method: "approve" },
    { target: strk, method: "transfer" },
    { target: pool, method: "enter_delegation_pool" },
    { target: pool, method: "add_to_delegation_pool" },
    /* Divvy FPMM trading (session must allow these or approve/buy does nothing useful) */
    { target: usdc, method: "mint" },
    { target: usdc, method: "approve" },
    { target: fpmm, method: "buy" },
    { target: fpmm, method: "sell" },
  ];
}
