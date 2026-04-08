import { NextResponse } from "next/server";
import {
  fetchEthStrkUsdFromCoinGecko,
  fetchPragmaSpotUsd,
} from "@/app/lib/spotPrice";

export async function GET() {
  try {
    let { ethUsd, strkUsd, btcUsd } = await fetchEthStrkUsdFromCoinGecko();
    let source = "coingecko";

    if (ethUsd == null || ethUsd <= 0) {
      const p = await fetchPragmaSpotUsd("ETH");
      if (p != null && p > 0) { ethUsd = p; source = "coingecko+pragma"; }
    }
    if (strkUsd == null || strkUsd <= 0) {
      const p = await fetchPragmaSpotUsd("STRK");
      if (p != null && p > 0) { strkUsd = p; source = "coingecko+pragma"; }
    }

    return NextResponse.json({ ethUsd, strkUsd, btcUsd, source });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Price fetch failed",
        ethUsd: null,
        strkUsd: null,
      },
      { status: 500 }
    );
  }
}
