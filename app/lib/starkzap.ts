"use client";

// Direct API calls to Ekubo and Vesu; avoids bundling starkzap bridge submodules
// which have uninstalled optional peer deps (ethers, @solana/web3.js, etc.)

import { TOKENS } from "./constants";
import type { TokenSymbol } from "./constants";
import { fetchSpotUsd } from "./spotPrice";

const EKUBO_API = "https://prod-api-quoter.ekubo.org";
const EKUBO_CHAIN_ID = "393402133025997798000961"; // SN_SEPOLIA

// Vesu Sepolia doesn't have a public markets REST API, so we return null
// and show APY as "~" in the UI.
export async function getVesuApy(tokenSymbol: TokenSymbol): Promise<number | null> {
  try {
    const res = await fetch("https://api.vesu.xyz/markets");
    if (!res.ok) return null;
    const data = await res.json();
    const list: unknown[] = data?.data ?? data ?? [];
    const sym = tokenSymbol.toUpperCase();
    let best: number | null = null;
    for (const m of list) {
      const market = m as Record<string, unknown>;
      // skip deprecated pools
      if ((market?.pool as Record<string,unknown>)?.isDeprecated) continue;
      if ((market?.symbol as string)?.toUpperCase() !== sym) continue;
      // stats.supplyApy is { value: string, decimals: number }
      const supplyApy = (market?.stats as Record<string,unknown>)?.supplyApy as Record<string,unknown> | undefined;
      if (!supplyApy?.value) continue;
      const apy = Number(supplyApy.value) / 10 ** (Number(supplyApy.decimals) || 18);
      if (apy > 0 && (best === null || apy > best)) best = apy;
    }
    return best;
  } catch {
    return null;
  }
}

/* ── Pragma (Chainlink-backed) → CoinGecko fallback for ETH or STRK price ── */
export async function fetchAssetPrice(symbol: "ETH" | "STRK"): Promise<number | null> {
  return fetchSpotUsd(symbol);
}

/* ── ERC20 balance via direct RPC ── */
export async function getTokenBalance(
  tokenAddress: string,
  userAddress: string,
  decimals: number
): Promise<number | null> {
  try {
    const qs = new URLSearchParams({ token: tokenAddress, account: userAddress });
    const res = await fetch(`/api/balance?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const low = BigInt(data.low ?? "0x0");
    const high = BigInt(data.high ?? "0x0");
    return Number(low + high * 2n ** 128n) / 10 ** decimals;
  } catch {
    return null;
  }
}

// GET /SN_SEPOLIA/{amountIn}/{tokenIn}/{tokenOut}
// Returns: { quote: { amount: string }, specifiedAmount: string }
export async function getEkuboQuote(
  tokenInSymbol: TokenSymbol,
  tokenOutSymbol: TokenSymbol,
  amountIn: string
): Promise<{ amountOut: string; priceImpactBps: bigint | null } | null> {
  try {
    const tokenIn = TOKENS[tokenInSymbol];
    const tokenOut = TOKENS[tokenOutSymbol];
    const amountInRaw = BigInt(Math.floor(parseFloat(amountIn) * 10 ** tokenIn.decimals));
    if (amountInRaw <= 0n) return null;

    const url = `${EKUBO_API}/${EKUBO_CHAIN_ID}/${amountInRaw.toString()}/${tokenIn.address}/${tokenOut.address}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    // Ekubo response has: { quote: { amount: "..." } } or { total: "..." }
    const rawOut: string = data?.quote?.amount ?? data?.total ?? data?.amountOut;
    if (!rawOut) return null;

    const outHuman = (Number(BigInt(rawOut)) / 10 ** tokenOut.decimals).toFixed(6);
    return { amountOut: outHuman, priceImpactBps: null };
  } catch {
    return null;
  }
}
