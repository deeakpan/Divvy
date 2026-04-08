import { NextResponse } from "next/server";
import { hexToBigInt, u256From, divvyRpcCall } from "@/app/lib/divvyRpc";

const FEEDS = {
  ETH: "0x08ed94479864161b612f4d77555e3a71089b2bfcae2d544e09b617113932611",
  STRK: "0x0a5db422ee7c28beead49303646e44ef9cbb8364eeba4d8af9ac06a3b556937",
} as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function shortStringFromFelt(feltHex: string | undefined): string {
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

function inferAsset(question: string, feed: string): string {
  const q = question.toUpperCase();
  const f = feed.toLowerCase();
  if (q.includes("ETH") || f === FEEDS.ETH) return "ETH";
  if (q.includes("STRK") || f === FEEDS.STRK) return "STRK";
  return "ETH";
}

function ordinal(n: number): string {
  if (n === 1 || n === 21 || n === 31) return `${n}st`;
  if (n === 2 || n === 22) return `${n}nd`;
  if (n === 3 || n === 23) return `${n}rd`;
  return `${n}th`;
}

function humanUtc(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  const day = ordinal(d.getUTCDate());
  const mon = MONTHS[d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon}, ${hh}:${mm} UTC`;
}

// Compact on-chain felt252 form:
// ETH>2236.19 by 260408 15:43Z
function prettifyQuestion(raw: string, asset: string, expirySec: number): string {
  const m = raw.match(/^([A-Z]+)>(\d+(?:\.\d+)?) by \d{6} \d{2}:\d{2}Z$/);
  if (!m) return raw;
  const px = Number(m[2]);
  const shown = Number.isFinite(px) ? px.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : m[2];
  return `Will ${asset} settle above $${shown} by ${humanUtc(expirySec)}?`;
}

export async function GET() {
  try {
    const cntRaw = await divvyRpcCall("get_market_count", []);
    const count = Number(hexToBigInt(cntRaw[0]));
    if (!Number.isFinite(count) || count <= 0) return NextResponse.json({ markets: [] });

    const nowSec = Math.floor(Date.now() / 1000);
    const markets: Array<{
      id: string;
      question: string;
      asset: string;
      expiry_at: string;
      yes_pool: number;
      no_pool: number;
      status: string;
    }> = [];

    for (let i = count - 1; i >= 0; i -= 1) {
      const marketId = `0x${i.toString(16)}`;
      const core = await divvyRpcCall("get_market_core", [marketId]);
      const pool = await divvyRpcCall("get_market_pool", [marketId]);

      const question = shortStringFromFelt(core[0]) || `Market #${i}`;
      const feed = core[1] ?? "";
      const expirySec = Number(hexToBigInt(core[2]));
      const resolved = hexToBigInt(core[5]) !== 0n;
      const yesReserve = u256From(pool, 0);
      const noReserve = u256From(pool, 2);

      const status = resolved ? "resolved" : expirySec <= nowSec ? "expired" : "active";
      if (status !== "active") continue;
      const asset = inferAsset(question, feed);
      const prettyQuestion = prettifyQuestion(question, asset, expirySec);

      markets.push({
        id: String(i),
        question: prettyQuestion,
        asset,
        expiry_at: new Date(expirySec * 1000).toISOString(),
        yes_pool: Number(yesReserve / 10n ** 6n),
        no_pool: Number(noReserve / 10n ** 6n),
        status,
      });
    }

    return NextResponse.json({ markets });
  } catch {
    return NextResponse.json({ markets: [] });
  }
}
