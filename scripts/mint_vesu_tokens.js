// Vesu Sepolia: direct faucet mints (ETH / USDC / STRK) + optional yield hub in one tx.
//
// Divvy Vesu Router (`DivvyVesuRouter`): you only pass **recipient + STRK amount**. USDC minted into Vesu is
// **exactly** what Chainlink STRK/USD implies for that STRK (integer math, rounded down). No LTV arg.
//
// Constructor: owner, strk_token, vesu_usdc, usdc_vtoken, eth_usd_feed, strk_usd_feed,
//              strk_decimals (18), usdc_decimals (6), max_feed_staleness_secs
//
// .env: RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY
//       DIVVY_VESU_ROUTER (or VESU_YIELD_HUB / VESU_STRK_HUB), VESU_USDC_VTOKEN (optional), …
//
// Run: node scripts/mint_vesu_tokens.js [optional_yield_recipient_hex]

require("dotenv").config();
const { RpcProvider, Account, cairo } = require("starknet");

const TOKENS = {
  ETH: "0x07bb0505dde7c05f576a6e08e64dadccd7797f14704763a5ad955727be25e5e9",
  USDC: "0x0715649d4c493ca350743e43915b88d2e6838b1c78ddc23d6d9385446b9d6844",
  STRK: "0x01278f23115f7e8acf07150b17c1f4b2a58257dde88aad535dbafc142edbd289",
};

const DEFAULT_USDC_VTOKEN =
  "0x74655d40dcdf5d0c2d1c508e0d79ca57416dbd51facda53a08f9ec2380cf96d";

const CHAINLINK_FEEDS = {
  ETH_USD: "0x08ed94479864161b612f4d77555e3a71089b2bfcae2d544e09b617113932611",
  STRK_USD: "0x0a5db422ee7c28beead49303646e44ef9cbb8364eeba4d8af9ac06a3b556937",
};

const AMOUNTS = {
  ETH: cairo.uint256("0x1a055690d9db80000"),
  USDC: cairo.uint256("0x5F5E100000"),
  STRK: cairo.uint256("0xa968163f0a57b400000"),
};

function feltAddr(addr) {
  return "0x" + BigInt(addr).toString(16);
}

function u256FromFelts(data) {
  return BigInt(data[0] ?? 0) + (BigInt(data[1] ?? 0) << 128n);
}

async function hubYieldEnter(account, provider, hub, recipient, strkAmt, usdcVToken) {
  const rec = feltAddr(recipient);
  console.log("DivvyVesuRouter:", hub);
  console.log("Recipient (Vesu vToken shares):", rec);
  console.log("USDC vToken:", feltAddr(usdcVToken));

  console.log("Refreshing Chainlink snapshots on hub…");
  const refreshTx = await account.execute({
    contractAddress: hub,
    entrypoint: "refresh_chainlink_prices",
    calldata: [],
  });
  await provider.waitForTransaction(refreshTx.transaction_hash);
  console.log("refresh_chainlink_prices tx:", refreshTx.transaction_hash);

  for (const label of ["get_last_eth_usd", "get_last_strk_usd"]) {
    try {
      const data = await provider.callContract({
        contractAddress: hub,
        entrypoint: label,
        calldata: [],
      });
      console.log(`  ${label}: answer=${data[0]} decimals=${data[1]}`);
    } catch (e) {
      console.log(`  ${label}: read failed — ${e.message?.slice(0, 80)}`);
    }
  }

  try {
    const preview = await provider.callContract({
      contractAddress: hub,
      entrypoint: "preview_usdc_for_strk",
      calldata: [strkAmt.low, strkAmt.high],
    });
    const usdc = u256FromFelts(preview);
    console.log("preview_usdc_for_strk (raw USDC units, will mint + deposit):", usdc.toString());
    if (usdc === 0n) {
      throw new Error("Oracle implies 0 USDC for this STRK (too small or bad price) — tx would revert with dust_usdc");
    }
  } catch (e) {
    console.log("preview_usdc_for_strk:", e.message?.slice(0, 120));
    throw e;
  }

  console.log("Approving STRK for hub…");
  const approveTx = await account.execute({
    contractAddress: TOKENS.STRK,
    entrypoint: "approve",
    calldata: [hub, strkAmt.low, strkAmt.high],
  });
  await provider.waitForTransaction(approveTx.transaction_hash);

  console.log("deposit_strk_mint_usdc_to_vesu(recipient, strk) — USDC amount from Chainlink only…");
  const tx = await account.execute({
    contractAddress: hub,
    entrypoint: "deposit_strk_mint_usdc_to_vesu",
    calldata: [rec, strkAmt.low, strkAmt.high],
  });
  console.log("tx:", tx.transaction_hash);
  await provider.waitForTransaction(tx.transaction_hash);
  console.log("✓ yield entry done\n");

  try {
    const sh = await provider.callContract({
      contractAddress: feltAddr(usdcVToken),
      entrypoint: "balance_of",
      calldata: [rec],
    });
    const shares = BigInt(sh[0] ?? 0) + (BigInt(sh[1] ?? 0) << 128n);
    console.log("Recipient Vesu USDC vToken balance (raw shares):", shares.toString());
  } catch (e) {
    console.log("vToken balance_of:", e.message?.slice(0, 100));
  }
}

async function main() {
  const {
    RPC_URL,
    ACCOUNT_ADDRESS,
    PRIVATE_KEY,
    DIVVY_VESU_ROUTER,
    VESU_YIELD_HUB,
    VESU_STRK_HUB,
    VESU_USDC_VTOKEN,
    YIELD_RECIPIENT,
    STRK_DEPOSIT_RAW,
  } = process.env;
  if (!RPC_URL || !ACCOUNT_ADDRESS || !PRIVATE_KEY)
    throw new Error("Set RPC_URL, ACCOUNT_ADDRESS, and PRIVATE_KEY in .env");

  const hub = DIVVY_VESU_ROUTER || VESU_YIELD_HUB || VESU_STRK_HUB;
  const recipient = YIELD_RECIPIENT || process.argv[2] || ACCOUNT_ADDRESS;
  const usdcVToken = VESU_USDC_VTOKEN || DEFAULT_USDC_VTOKEN;

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({ provider, address: ACCOUNT_ADDRESS, signer: PRIVATE_KEY, cairoVersion: "1" });

  let strkAmt = AMOUNTS.STRK;
  if (STRK_DEPOSIT_RAW) strkAmt = cairo.uint256(STRK_DEPOSIT_RAW);

  if (hub) {
    await hubYieldEnter(account, provider, hub, recipient, strkAmt, usdcVToken);
  }

  console.log(
    "Direct mint on Vesu faucet (ETH only" +
      (hub ? "; STRK/USDC sized by yield hub above" : " / USDC / STRK") +
      ")…\n",
  );

  const direct = { ...TOKENS };
  if (hub) {
    delete direct.STRK;
    delete direct.USDC;
  }

  for (const [sym, addr] of Object.entries(direct)) {
    const amt = AMOUNTS[sym];
    try {
      const tx = await account.execute({
        contractAddress: addr,
        entrypoint: "mint",
        calldata: [feltAddr(ACCOUNT_ADDRESS), amt.low, amt.high],
      });
      console.log(`${sym}: tx ${tx.transaction_hash}`);
      await provider.waitForTransaction(tx.transaction_hash);
      console.log(`${sym}: ✓ minted\n`);
    } catch (e) {
      console.log(`${sym}: FAILED — ${e.message?.slice(0, 120)}\n`);
    }
  }

  console.log("ERC-20 balances — recipient:", feltAddr(recipient));
  for (const [sym, addr] of Object.entries(TOKENS)) {
    try {
      const call = await provider.callContract({
        contractAddress: addr,
        entrypoint: "balance_of",
        calldata: [feltAddr(recipient)],
      });
      const balance = BigInt(call[0] ?? 0) + (BigInt(call[1] ?? 0) << 128n);
      console.log(`${sym}: ${balance.toString()} (raw)`);
    } catch (e) {
      console.log(`${sym}: balance read FAILED — ${e.message?.slice(0, 120)}`);
    }
  }

  if (hub) {
    console.log("\nHub STRK vault balance:");
    try {
      const call = await provider.callContract({
        contractAddress: TOKENS.STRK,
        entrypoint: "balance_of",
        calldata: [feltAddr(hub)],
      });
      console.log((BigInt(call[0] ?? 0) + (BigInt(call[1] ?? 0) << 128n)).toString(), "(raw)");
    } catch (e) {
      console.log("read failed:", e.message?.slice(0, 100));
    }
  }

  console.log("\nConstructor hints:");
  console.log("  vesu_usdc:  ", TOKENS.USDC);
  console.log("  usdc_vtoken:", feltAddr(usdcVToken));
  console.log("  eth_feed:   ", CHAINLINK_FEEDS.ETH_USD);
  console.log("  strk_feed:  ", CHAINLINK_FEEDS.STRK_USD);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
