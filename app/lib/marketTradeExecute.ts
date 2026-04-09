"use client";

import {
  getCollateralTokenAddress,
  getDivvyFpmmAddress,
  mulBpsDown,
  parseCollateralToRaw,
  splitU256,
} from "@/app/lib/trading";

export type RawInvokeCall = {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
};

export type SendWalletCallsResult = {
  transactionHash: string;
  feeModeUsed: "sponsored" | "user_pays";
  switchedToUserPaysThisSession: boolean;
};

export function formatMarketTradeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

let cartridgeForceUserPaysForSession = false;
let cartridgeUserPaysNoticeShown = false;

async function readDivvy(body: object): Promise<Record<string, string>> {
  const res = await fetch("/api/divvy-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const j = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !j.ok) throw new Error(j.error || "Read failed");
  return j as Record<string, string>;
}

/** On-chain preview: USDC in → outcome tokens out. */
export async function previewBuyTokens(
  marketId: string,
  outcomeYes: boolean,
  usdcRaw: bigint,
): Promise<bigint> {
  const j = await readDivvy({
    op: "preview_buy",
    marketId,
    outcomeYes,
    usdcRaw: usdcRaw.toString(),
  });
  return BigInt(j.tokensOut || "0");
}

export function buildFpmmBuyCalls(
  marketId: string,
  outcomeYes: boolean,
  usdcRaw: bigint,
  minTokensOut: bigint,
): RawInvokeCall[] {
  const fpmm = getDivvyFpmmAddress();
  const usdc = getCollateralTokenAddress();
  const idFelt = `0x${BigInt(marketId).toString(16)}`;
  const yesFelt = outcomeYes ? "0x1" : "0x0";
  const [inL, inH] = splitU256(usdcRaw);
  const [minL, minH] = splitU256(minTokensOut);
  return [
    { contractAddress: usdc, entrypoint: "approve", calldata: [fpmm, inL, inH] },
    {
      contractAddress: fpmm,
      entrypoint: "buy",
      calldata: [idFelt, yesFelt, inL, inH, minL, minH],
    },
  ];
}

/**
 * Send batched invokes. Cartridge: prefers paymaster (`feeMode: "sponsored"`) for policy-matched calls.
 * Browser wallets: one user-signed transaction; user pays network fee in STRK.
 */
export async function sendWalletCalls(
  wallet: unknown,
  method: "cartridge" | "browser",
  rpcUrl: string,
  address: string,
  calls: RawInvokeCall[],
): Promise<SendWalletCallsResult> {
  if (method === "cartridge") {
    const cw = wallet as {
      ensureReady?: (opts?: { deploy?: "if_needed" }) => Promise<void>;
      execute: (
        c: RawInvokeCall[],
        opts?: { feeMode?: "sponsored" | "user_pays" },
      ) => Promise<{ hash: string } | unknown>;
    };
    if (typeof cw.ensureReady === "function") {
      await cw.ensureReady({ deploy: "if_needed" });
    }
    const extractHash = (tx: unknown): string | null => {
      if (tx && typeof tx === "object" && "hash" in tx && typeof (tx as { hash: string }).hash === "string") {
        return (tx as { hash: string }).hash;
      }
      if (
        tx &&
        typeof tx === "object" &&
        "transaction_hash" in tx &&
        typeof (tx as { transaction_hash: string }).transaction_hash === "string"
      ) {
        return (tx as { transaction_hash: string }).transaction_hash;
      }
      return null;
    };

    if (cartridgeForceUserPaysForSession) {
      const tx = await cw.execute(calls, { feeMode: "user_pays" });
      const h = extractHash(tx);
      if (h) {
        return {
          transactionHash: h,
          feeModeUsed: "user_pays",
          switchedToUserPaysThisSession: false,
        };
      }
      throw new Error("Cartridge did not return a transaction hash.");
    }

    try {
      const tx = await cw.execute(calls, { feeMode: "sponsored" });
      const h = extractHash(tx);
      if (h) {
        return {
          transactionHash: h,
          feeModeUsed: "sponsored",
          switchedToUserPaysThisSession: false,
        };
      }
    } catch (e) {
      const msg = formatMarketTradeError(e);
      if (/paymaster|snip|sponsor|sponsored|gas|fee/i.test(msg)) {
        cartridgeForceUserPaysForSession = true;
        const showNotice = !cartridgeUserPaysNoticeShown;
        cartridgeUserPaysNoticeShown = true;
        const tx2 = await cw.execute(calls, { feeMode: "user_pays" });
        const h2 = extractHash(tx2);
        if (h2) {
          return {
            transactionHash: h2,
            feeModeUsed: "user_pays",
            switchedToUserPaysThisSession: showNotice,
          };
        }
      }
      throw e;
    }
    throw new Error("Cartridge did not return a transaction hash.");
  }

  const { WalletAccount, RpcProvider: Provider } = await import("starknet");
  const provider = new Provider({ nodeUrl: rpcUrl });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const account = new WalletAccount({ provider, walletProvider: wallet as any, address });
  const r = await account.execute(calls);
  return {
    transactionHash: r.transaction_hash,
    feeModeUsed: "user_pays",
    switchedToUserPaysThisSession: false,
  };
}

/** Used by swipe / quick trade: quote + approve+buy in one flow. */
export async function executeMarketBuyQuick(params: {
  marketId: string;
  outcomeYes: boolean;
  amountStr: string;
  slippageBps: number;
  wallet: unknown;
  method: "cartridge" | "browser";
  rpcUrl: string;
  address: string;
}): Promise<SendWalletCallsResult> {
  const raw = parseCollateralToRaw(params.amountStr);
  if (raw <= 0n) throw new Error("Enter an amount greater than zero.");

  const tokensOut = await previewBuyTokens(params.marketId, params.outcomeYes, raw);
  if (tokensOut <= 0n) throw new Error("No valid quote for that size — try a smaller amount.");

  const minOut = mulBpsDown(tokensOut, params.slippageBps);
  const calls = buildFpmmBuyCalls(params.marketId, params.outcomeYes, raw, minOut);
  return sendWalletCalls(
    params.wallet,
    params.method,
    params.rpcUrl,
    params.address,
    calls,
  );
}
