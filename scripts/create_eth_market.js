// Create one ETH market on DivvyFPMM:
// - Fetch current ETH/USD (CoinGecko)
// - Set threshold to +1%
// - Expiry = now + 20 minutes
// - Seed with 20 USDC total (10 yes / 10 no)
//
// .env required:
//   RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY
//   NEXT_PUBLIC_DIVVY_FPMM (or DIVVY_FPMM)
//
// Run:
//   node scripts/create_eth_market.js

require("dotenv").config();
const { RpcProvider, Account } = require("starknet");

const ADDR = {
  usdc: "0x0715649d4c493ca350743e43915b88d2e6838b1c78ddc23d6d9385446b9d6844",
  chainlinkEthUsd:
    "0x08ed94479864161b612f4d77555e3a71089b2bfcae2d544e09b617113932611",
};

const USDC_DECIMALS = 6n;
const CHAINLINK_DECIMALS = 8n;
const MARKET_DURATION_SECONDS = 20 * 60;
const TOTAL_SEED_USDC = 20n * 10n ** USDC_DECIMALS;
const SEED_SIDE_USDC = TOTAL_SEED_USDC / 2n; // 10 USDC each side

function toU256(v) {
  const x = BigInt(v);
  const mask = (1n << 128n) - 1n;
  return { low: (x & mask).toString(), high: (x >> 128n).toString() };
}

function fmt2(n) {
  return Number(n).toFixed(2);
}

function fmtUtc(tsSec) {
  const d = new Date(Number(tsSec) * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}

async function getEthUsd() {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ETH price fetch failed (${res.status})`);
  const json = await res.json();
  const px = Number(json?.ethereum?.usd);
  if (!Number.isFinite(px) || px <= 0) throw new Error("Invalid ETH price from CoinGecko");
  return px;
}

async function main() {
  const { RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY, NEXT_PUBLIC_DIVVY_FPMM, DIVVY_FPMM } =
    process.env;

  if (!RPC_URL || !ACCOUNT_ADDRESS || !PRIVATE_KEY) {
    throw new Error("Set RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY in .env");
  }

  const fpmm = NEXT_PUBLIC_DIVVY_FPMM || DIVVY_FPMM;
  if (!fpmm) throw new Error("Set NEXT_PUBLIC_DIVVY_FPMM (or DIVVY_FPMM) in .env");

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({
    provider,
    address: ACCOUNT_ADDRESS,
    signer: PRIVATE_KEY,
    cairoVersion: "1",
  });

  const ethUsd = await getEthUsd();
  const targetUsd = ethUsd * 1.01;
  const thresholdRaw = BigInt(Math.round(targetUsd * 10 ** Number(CHAINLINK_DECIMALS)));

  const nowSec = Math.floor(Date.now() / 1000);
  const expirySec = nowSec + MARKET_DURATION_SECONDS;
  const expiryUtc = fmtUtc(expirySec);
  const d = new Date(expirySec * 1000);
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  // felt252 is short; include UTC time in compact form.
  const question = `ETH>${fmt2(targetUsd)} by ${yy}${mm}${dd} ${hh}:${mi}Z`;

  const seedU256 = toU256(SEED_SIDE_USDC);

  console.log("=== Create ETH market ===");
  console.log("FPMM:", fpmm);
  console.log("Feed:", ADDR.chainlinkEthUsd);
  console.log("Spot ETH/USD:", ethUsd);
  console.log("Target (+1%):", targetUsd, `(raw=${thresholdRaw.toString()})`);
  console.log("Expiry:", expiryUtc, `(unix=${expirySec})`);
  console.log("Question:", question);
  console.log("Seed:", "10 USDC yes / 10 USDC no");

  const approveTx = await account.execute({
    contractAddress: ADDR.usdc,
    entrypoint: "approve",
    calldata: [fpmm, (TOTAL_SEED_USDC & ((1n << 128n) - 1n)).toString(), (TOTAL_SEED_USDC >> 128n).toString()],
  });
  await provider.waitForTransaction(approveTx.transaction_hash);
  console.log("approve tx:", approveTx.transaction_hash);

  const createTx = await account.execute({
    contractAddress: fpmm,
    entrypoint: "create_market",
    calldata: [
      question,
      ADDR.chainlinkEthUsd,
      String(expirySec),
      thresholdRaw.toString(),
      seedU256.low,
      seedU256.high,
      seedU256.low,
      seedU256.high,
    ],
  });
  await provider.waitForTransaction(createTx.transaction_hash);
  console.log("create_market tx:", createTx.transaction_hash);

  try {
    const out = await provider.callContract({
      contractAddress: fpmm,
      entrypoint: "get_market_count",
      calldata: [],
    });
    const count = BigInt(out?.[0] ?? 0n);
    const marketId = count > 0n ? count - 1n : 0n;
    console.log("market_id:", marketId.toString());
  } catch {
    console.log("Market created. Could not read market_count.");
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

