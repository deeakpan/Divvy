import { NextRequest, NextResponse } from "next/server";
import { hash } from "starknet";
import { RPC_URL as FALLBACK_RPC } from "@/app/lib/constants";

type RpcResponse = {
  result?: string[];
  error?: { message?: string };
};

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const account = req.nextUrl.searchParams.get("account");
    if (!token || !account) {
      return NextResponse.json({ error: "Missing token/account" }, { status: 400 });
    }

    const rpcUrl =
      process.env.RPC_URL?.trim() ||
      process.env.STARKNET_RPC_URL?.trim() ||
      FALLBACK_RPC;

    for (const fn of ["balanceOf", "balance_of"]) {
      const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "starknet_call",
        params: [
          {
            contract_address: token,
            entry_point_selector: hash.getSelectorFromName(fn),
            calldata: [account],
          },
          "latest",
        ],
      };

      let res: Response;
      try {
        res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
      } catch (err) {
        const hint =
          err instanceof TypeError && String(err.message).includes("fetch")
            ? "Cannot reach Starknet RPC (network or RPC_URL). The app falls back to a default Sepolia URL if RPC_URL is unset."
            : err instanceof Error
              ? err.message
              : "RPC request failed";
        return NextResponse.json({ error: hint }, { status: 503 });
      }
      const data = (await res.json()) as RpcResponse;
      if (Array.isArray(data.result) && data.result.length > 0) {
        return NextResponse.json({
          low: data.result[0] ?? "0x0",
          high: data.result[1] ?? "0x0",
        });
      }
    }

    return NextResponse.json({ error: "Balance read failed" }, { status: 502 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const friendly =
      e instanceof TypeError && msg.includes("fetch")
        ? "Balance read failed: network error. Check RPC_URL and connectivity."
        : msg;
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
