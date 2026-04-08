/**
 * Off-chain USD spot. CoinGecko is primary (reliable from Node); Pragma API is fallback.
 */

const GECKO_PAIR =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,starknet,bitcoin&vs_currencies=usd";

function parseUsd(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** One request for ETH + STRK + BTC USD (used by /api/spot-prices). */
export async function fetchEthStrkUsdFromCoinGecko(): Promise<{
  ethUsd: number | null;
  strkUsd: number | null;
  btcUsd: number | null;
}> {
  try {
    const r = await fetch(GECKO_PAIR, { cache: "no-store" });
    if (!r.ok) return { ethUsd: null, strkUsd: null, btcUsd: null };
    const d = (await r.json()) as Record<string, { usd?: unknown } | undefined>;
    return {
      ethUsd: parseUsd(d.ethereum?.usd),
      strkUsd: parseUsd(d.starknet?.usd),
      btcUsd: parseUsd(d.bitcoin?.usd),
    };
  } catch {
    return { ethUsd: null, strkUsd: null, btcUsd: null };
  }
}

/** Parse Pragma spot JSON (shape has changed across versions). */
function parsePragmaSpotBody(d: unknown): number | null {
  if (d == null || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;

  const candidates: unknown[] = [o.price, o.median_price, o.value];
  const data = o.data;
  if (data && typeof data === "object") {
    const inner = data as Record<string, unknown>;
    candidates.push(inner.price, inner.median_price, inner.value, inner.spot);
  }
  if (Array.isArray(o.data) && o.data[0] && typeof o.data[0] === "object") {
    const row = o.data[0] as Record<string, unknown>;
    candidates.push(row.price, row.median_price, row.value);
  }

  let raw: unknown;
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== "") {
      raw = c;
      break;
    }
  }
  if (raw === undefined) return null;

  let dec = 8;
  if (typeof o.decimals === "number") dec = o.decimals;
  else if (data && typeof data === "object" && typeof (data as Record<string, unknown>).decimals === "number") {
    dec = (data as Record<string, unknown>).decimals as number;
  }

  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    try {
      return Number(BigInt(raw)) / 10 ** dec;
    } catch {
      return Number(raw) / 10 ** dec;
    }
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n > 1e6) return n / 10 ** dec;
  return n;
}

export async function fetchPragmaSpotUsd(symbol: "ETH" | "STRK"): Promise<number | null> {
  const pragmaId = symbol === "ETH" ? "ETH" : "STRK";
  try {
    const r = await fetch(
      `https://api.pragma.build/node/v1/data/spot/${pragmaId}/USD?aggregation=median`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    return parsePragmaSpotBody(d);
  } catch {
    return null;
  }
}

async function fetchGeckoSingle(geckoId: "ethereum" | "starknet"): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, { usd?: unknown }>;
    return parseUsd(d[geckoId]?.usd);
  } catch {
    return null;
  }
}

/** Used by starkzap and any single-symbol caller. */
export async function fetchSpotUsd(symbol: "ETH" | "STRK"): Promise<number | null> {
  const geckoId = symbol === "ETH" ? "ethereum" : "starknet";
  const g = await fetchGeckoSingle(geckoId);
  if (g != null && g > 0) return g;
  const p = await fetchPragmaSpotUsd(symbol);
  return p;
}
