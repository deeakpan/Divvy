// Declare + deploy DivvyVesuRouter (only contract in this package).
//
// .env: RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY
// Optional: MAX_FEED_STALENESS_SECS (default 86400)
//
// After deploy: Vesu must set USDC minter to this hub if you use mint_vesu_tokens yield path.
// Run: node scripts/deploy.js   (from repo root, after `cd contracts && scarb build`)

require("dotenv").config();
const { RpcProvider, Account } = require("starknet");
const fs = require("fs");
const path = require("path");

const ADDR = {
  chainlinkEthUsd:
    "0x08ed94479864161b612f4d77555e3a71089b2bfcae2d544e09b617113932611",
  chainlinkStrkUsd:
    "0x0a5db422ee7c28beead49303646e44ef9cbb8364eeba4d8af9ac06a3b556937",
  usdc: "0x0715649d4c493ca350743e43915b88d2e6838b1c78ddc23d6d9385446b9d6844",
  strk: "0x01278f23115f7e8acf07150b17c1f4b2a58257dde88aad535dbafc142edbd289",
  usdcVToken: "0x74655d40dcdf5d0c2d1c508e0d79ca57416dbd51facda53a08f9ec2380cf96d",
};

function feltAddr(a) {
  return "0x" + BigInt(a).toString(16);
}

function loadSierra(name) {
  const p = path.join(__dirname, `../contracts/target/dev/divvy_${name}.contract_class.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadCasm(name) {
  const p = path.join(
    __dirname,
    `../contracts/target/dev/divvy_${name}.compiled_contract_class.json`,
  );
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function waitFor(provider, txHash) {
  process.stdout.write(`  Waiting for tx ${txHash.slice(0, 14)}...`);
  await provider.waitForTransaction(txHash);
  console.log(" confirmed");
}

async function declareIfNeeded(account, provider, label, sierraName) {
  console.log(`Declaring ${label}...`);
  try {
    const sierra = loadSierra(sierraName);
    const casm = loadCasm(sierraName);
    const decl = await account.declare({ contract: sierra, casm });
    await waitFor(provider, decl.transaction_hash);
    console.log("  class_hash:", decl.class_hash);
    return decl.class_hash;
  } catch (e) {
    const msg = e.message ?? e.baseError?.message ?? "";
    if (msg.includes("already declared")) {
      const h = e.class_hash ?? e.baseError?.data?.class_hash;
      console.log("  already declared:", h);
      return h;
    }
    throw e;
  }
}

async function main() {
  const { RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY, MAX_FEED_STALENESS_SECS } = process.env;
  if (!RPC_URL || !ACCOUNT_ADDRESS || !PRIVATE_KEY) {
    throw new Error("Set RPC_URL, ACCOUNT_ADDRESS, and PRIVATE_KEY in .env");
  }

  const maxStale = MAX_FEED_STALENESS_SECS ?? "86400";

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({
    provider,
    address: ACCOUNT_ADDRESS,
    signer: PRIVATE_KEY,
    cairoVersion: "1",
  });

  console.log("=== DivvyVesuRouter deploy ===\n");

  const classHash = await declareIfNeeded(account, provider, "DivvyVesuRouter", "DivvyVesuRouter");

  const calldata = [
    feltAddr(ACCOUNT_ADDRESS),
    feltAddr(ADDR.strk),
    feltAddr(ADDR.usdc),
    feltAddr(ADDR.usdcVToken),
    feltAddr(ADDR.chainlinkEthUsd),
    feltAddr(ADDR.chainlinkStrkUsd),
    "18",
    "6",
    maxStale,
  ];

  console.log("\nDeploying DivvyVesuRouter...");
  const dep = await account.deployContract({
    classHash,
    constructorCalldata: calldata,
  });
  await waitFor(provider, dep.transaction_hash);
  const hub = dep.contract_address;

  console.log("\n=== Done ===");
  console.log("DivvyVesuRouter:", hub);
  console.log("\nSet in .env: DIVVY_VESU_ROUTER=" + hub + "  (or VESU_YIELD_HUB)");
  console.log("Then: Vesu USDC set_minter(hub) if required; run scripts/mint_vesu_tokens.js");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
