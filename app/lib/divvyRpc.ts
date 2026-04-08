import { hash } from "starknet";
import { DIVVY_FPMM_ADDRESS, RPC_URL as FALLBACK_RPC } from "@/app/lib/constants";

type RpcResponse = {
  result?: string[];
  error?: { message?: string };
};

export function hexToBigInt(hex: string | undefined): bigint {
  if (!hex) return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

export function u256From(result: string[], offset: number): bigint {
  return hexToBigInt(result[offset]) + (hexToBigInt(result[offset + 1]) << 128n);
}

export function marketIdCalldata(id: string): string {
  return `0x${BigInt(id).toString(16)}`;
}

export function splitU256(n: bigint): [string, string] {
  const low = (n & ((1n << 128n) - 1n)).toString();
  const high = (n >> 128n).toString();
  return [low, high];
}

export async function divvyRpcCall(entrypoint: string, calldata: string[]): Promise<string[]> {
  const rpcUrl = process.env.RPC_URL?.trim() || process.env.STARKNET_RPC_URL?.trim() || FALLBACK_RPC;
  const contract = process.env.NEXT_PUBLIC_DIVVY_FPMM?.trim() || DIVVY_FPMM_ADDRESS;

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "starknet_call",
    params: [
      {
        contract_address: contract,
        entry_point_selector: hash.getSelectorFromName(entrypoint),
        calldata,
      },
      "latest",
    ],
  };
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json()) as RpcResponse;
  if (!Array.isArray(data.result)) throw new Error(data.error?.message || `${entrypoint} failed`);
  return data.result;
}
