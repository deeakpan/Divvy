// Live market watcher for DivvyFPMM:
// - Every 60s: fetch next market window from contract and append to local JSON
// - Every 30s: check stored markets, and resolve expired unresolved markets
//
// .env required:
//   RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY
//   NEXT_PUBLIC_DIVVY_FPMM (or DIVVY_FPMM)
//
// Run:
//   node scripts/sync_and_resolve_markets.js

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { RpcProvider, Account } = require("starknet");
const OUT_PATH = path.join(__dirname, "..", "markets.snapshot.json");
const STORAGE_CHECK_MS = 30_000;
const CONTRACT_PULL_MS = 60_000;

function hexToBigInt(hex) {
  if (!hex) return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

function u256From(result, offset) {
  return hexToBigInt(result[offset]) + (hexToBigInt(result[offset + 1]) << 128n);
}

function shortStringFromFelt(feltHex) {
  if (!feltHex) return "";
  try {
    let hex = hexToBigInt(feltHex).toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    const bytes = Buffer.from(hex, "hex");
    return bytes.toString("utf8").replace(/\0+$/g, "").trim();
  } catch {
    return "";
  }
}

function unwrapResult(callOut) {
  if (Array.isArray(callOut)) return callOut;
  if (Array.isArray(callOut?.result)) return callOut.result;
  return [];
}

async function main() {
  const { RPC_URL, ACCOUNT_ADDRESS, PRIVATE_KEY, NEXT_PUBLIC_DIVVY_FPMM, DIVVY_FPMM } = process.env;
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

  const readSnapshot = () => {
    if (!fs.existsSync(OUT_PATH)) return { contract: fpmm, markets: [] };
    try {
      const j = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
      if (j.contract && String(j.contract).toLowerCase() !== String(fpmm).toLowerCase()) {
        // New deployment: reset local cache so old market IDs don't leak across contracts.
        return { contract: fpmm, markets: [] };
      }
      if (!Array.isArray(j.markets)) j.markets = [];
      return j;
    } catch {
      return { contract: fpmm, markets: [] };
    }
  };

  const writeSnapshot = (snap) => {
    fs.writeFileSync(OUT_PATH, JSON.stringify(snap, null, 2));
  };

  const getCount = async () => {
    const countCall = await account.callContract({
      contractAddress: fpmm,
      entrypoint: "get_market_count",
      calldata: [],
    });
    const countRaw = unwrapResult(countCall);
    const count = Number(hexToBigInt(countRaw[0]));
    if (!Number.isFinite(count) || count < 0) throw new Error("Bad market_count");
    return count;
  };

  const fetchWindow = async () => {
    const count = await getCount();
    const nowSec = Math.floor(Date.now() / 1000);
    const snap = readSnapshot();
    const maxSaved = snap.markets.reduce((m, x) => Math.max(m, Number(x?.id ?? -1)), -1);

    let startId = 0;
    let endExclusive = Math.min(count, 10);
    if (maxSaved >= 0) {
      startId = maxSaved + 1;
      endExclusive = Math.min(count, startId + 5);
    }

    if (startId >= count) {
      console.log(`No new markets to fetch. count=${count}, last_saved_id=${maxSaved}`);
      snap.fetched_at_unix = nowSec;
      snap.fetched_at_utc = new Date(nowSec * 1000).toISOString();
      snap.count = count;
      writeSnapshot(snap);
      return;
    }

    console.log(`Fetching markets in window [${startId}, ${endExclusive - 1}] out of count=${count}`);
    const rows = [];
    for (let i = startId; i < endExclusive; i += 1) {
      const idHex = `0x${i.toString(16)}`;
      const coreCall = await account.callContract({
        contractAddress: fpmm,
        entrypoint: "get_market_core",
        calldata: [idHex],
      });
      const poolCall = await account.callContract({
        contractAddress: fpmm,
        entrypoint: "get_market_pool",
        calldata: [idHex],
      });

      const core = unwrapResult(coreCall);
      const pool = unwrapResult(poolCall);
      const questionRaw = shortStringFromFelt(core[0]) || `Market #${i}`;
      const feed = core[1] ?? "";
      const expirySec = Number(hexToBigInt(core[2]));
      const threshold = hexToBigInt(core[3]).toString();
      const createdAt = Number(hexToBigInt(core[4]));
      const resolved = hexToBigInt(core[5]) !== 0n;
      const outcomeYes = hexToBigInt(core[6]) !== 0n;
      const resolvedPrice = hexToBigInt(core[7]).toString();
      const resolvedTimestamp = Number(hexToBigInt(core[8]));
      const yesReserve = u256From(pool, 0).toString();
      const noReserve = u256From(pool, 2).toString();
      const collateral = u256From(pool, 6).toString();

      const expired = Number.isFinite(expirySec) ? expirySec <= nowSec : false;
      const status = resolved ? "resolved" : expired ? "expired" : "active";

      rows.push({
        id: i,
        question: questionRaw,
        feed,
        expiry_time: expirySec,
        expiry_utc: Number.isFinite(expirySec) ? new Date(expirySec * 1000).toISOString() : null,
        threshold,
        created_at: createdAt,
        resolved,
        outcome_yes: outcomeYes,
        resolved_price: resolvedPrice,
        resolved_timestamp: resolvedTimestamp,
        yes_reserve: yesReserve,
        no_reserve: noReserve,
        collateral,
        status,
      });
    }

    const mergedMarkets = [...snap.markets, ...rows];
    const updated = {
      contract: fpmm,
      fetched_at_unix: nowSec,
      fetched_at_utc: new Date(nowSec * 1000).toISOString(),
      count,
      range_start: startId,
      range_end_inclusive: endExclusive - 1,
      markets: mergedMarkets,
    };
    writeSnapshot(updated);
    console.log(`Saved ${rows.length} new market(s), total stored=${mergedMarkets.length} -> ${OUT_PATH}`);
  };

  const resolving = new Set();
  const resolveFromStorage = async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const count = await getCount();
    const snap = readSnapshot();
    const candidates = (snap.markets || [])
      .filter((m) => Number.isFinite(Number(m?.id)))
      .filter((m) => Number(m?.id) >= 0 && Number(m?.id) < count)
      .filter((m) => Number(m?.expiry_time ?? 0) <= nowSec)
      .filter((m) => Number(m?.resolved_timestamp ?? 0) === 0)
      .map((m) => Number(m.id));

    if (candidates.length === 0) {
      console.log("No expired unresolved markets to resolve.");
      return;
    }
    console.log(`Resolving ${candidates.length} expired market(s): ${candidates.join(", ")}`);

    for (const id of candidates) {
      if (resolving.has(id)) continue;
      resolving.add(id);
      try {
        const tx = await account.execute({
          contractAddress: fpmm,
          entrypoint: "resolve_market",
          calldata: [`0x${id.toString(16)}`],
        });
        console.log(`resolve_market(${id}) tx: ${tx.transaction_hash}`);
        await provider.waitForTransaction(tx.transaction_hash);
        console.log(`resolved market ${id}`);
      } catch (e) {
        console.log(`resolve_market(${id}) failed: ${e?.message || e}`);
      } finally {
        resolving.delete(id);
      }
    }
  };

  // Initial pass
  await fetchWindow();
  await resolveFromStorage();

  console.log(`Watcher active: storage check=${STORAGE_CHECK_MS / 1000}s, contract pull=${CONTRACT_PULL_MS / 1000}s`);
  setInterval(() => {
    resolveFromStorage().catch((e) => console.error("storage check error:", e?.message || e));
  }, STORAGE_CHECK_MS);
  setInterval(() => {
    fetchWindow().catch((e) => console.error("contract pull error:", e?.message || e));
  }, CONTRACT_PULL_MS);

  // Keep process alive.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

