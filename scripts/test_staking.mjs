// Test StarkZap staking in Node.js (private-key wallet — not Cartridge).
//
// For Cartridge + StarkZap in the app, session policies are defined in
// `app/lib/cartridgePolicies.ts` (router, STRK approve/transfer, Nethermind pool entrypoints).
// Run: node scripts/test_staking.mjs

import "dotenv/config";
import { StarkZap, StarkSigner, Staking, sepoliaValidators } from "starkzap";
import { Amount } from "starkzap";

const { RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY } = process.env;
if (!RPC_URL || !ACCOUNT_ADDRESS || !PRIVATE_KEY) {
  throw new Error("Set RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY in .env");
}

// Use Nethermind — reliable Sepolia validator
const VALIDATOR = sepoliaValidators.NETHERMIND;

async function main() {
  console.log("Connecting StarkZap on Sepolia...");

  const sdk = new StarkZap({
    rpcUrl: RPC_URL,
    network: "sepolia",
  });

  const wallet = await sdk.connectWallet({
    account: { signer: new StarkSigner(PRIVATE_KEY) },
    accountAddress: ACCOUNT_ADDRESS,
  });

  console.log("Wallet address:", wallet.address);

  // Get staking pools for validator
  console.log(`\nFetching pools for ${VALIDATOR.name}...`);
  const pools = await sdk.getStakerPools(VALIDATOR.stakerAddress);
  console.log("Pools:", pools.map(p => `${p.token.symbol}: ${p.amount.toFormatted()} delegated`));

  // Get STRK pool
  const strkPool = pools.find(p => p.token.symbol === "STRK");
  if (!strkPool) throw new Error("No STRK pool found for this validator");

  // Get staking instance
  const staking = await Staking.fromPool(
    strkPool.poolContract,
    sdk.getProvider(),
    sdk.getResolvedConfig().staking
  );

  // Check existing position
  const position = await staking.getPosition(wallet);
  if (position) {
    console.log(`\nCurrent position:`);
    console.log(`  Staked:  ${position.staked.toFormatted()}`);
    console.log(`  Rewards: ${position.rewards.toFormatted()}`);
  } else {
    console.log("\nNo existing position in this pool.");
  }

  // Stake 1 STRK
  const amount = Amount.parse("1", strkPool.token);
  console.log(`\nStaking ${amount.toFormatted()}...`);

  const tx = await staking.stake(wallet, amount);
  console.log("Tx hash:", tx.hash);
  console.log("Waiting for confirmation...");
  await tx.wait();
  console.log("Confirmed.");

  // Show updated position
  const updated = await staking.getPosition(wallet);
  if (updated) {
    console.log(`\nUpdated position:`);
    console.log(`  Staked:  ${updated.staked.toFormatted()}`);
    console.log(`  Rewards: ${updated.rewards.toFormatted()}`);
  }
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
