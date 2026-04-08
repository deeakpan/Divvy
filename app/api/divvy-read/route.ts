import { NextResponse } from "next/server";
import {
  divvyRpcCall,
  marketIdCalldata,
  splitU256,
  u256From,
} from "@/app/lib/divvyRpc";

type PreviewBuyBody = {
  op: "preview_buy";
  marketId: string;
  outcomeYes: boolean;
  usdcRaw: string;
};

type PreviewSellBody = {
  op: "preview_sell";
  marketId: string;
  outcomeYes: boolean;
  tokensRaw: string;
};

type UserBalancesBody = {
  op: "user_balances";
  marketId: string;
  user: string;
};

type Body = PreviewBuyBody | PreviewSellBody | UserBalancesBody;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const id = marketIdCalldata(String(body.marketId));
    const yes = (b: boolean) => (b ? "0x1" : "0x0");

    if (body.op === "preview_buy") {
      const raw = BigInt(body.usdcRaw || "0");
      const [lo, hi] = splitU256(raw);
      const r = await divvyRpcCall("preview_buy", [id, yes(body.outcomeYes), lo, hi]);
      const tokensOut = u256From(r, 0);
      return NextResponse.json({ ok: true as const, tokensOut: tokensOut.toString() });
    }

    if (body.op === "preview_sell") {
      const raw = BigInt(body.tokensRaw || "0");
      const [lo, hi] = splitU256(raw);
      const r = await divvyRpcCall("preview_sell", [id, yes(body.outcomeYes), lo, hi]);
      const usdcOut = u256From(r, 0);
      return NextResponse.json({ ok: true as const, usdcOut: usdcOut.toString() });
    }

    if (body.op === "user_balances") {
      const user = String(body.user || "").trim();
      if (!user.startsWith("0x")) {
        return NextResponse.json({ ok: false as const, error: "bad user" }, { status: 400 });
      }
      const r = await divvyRpcCall("get_user_balances", [id, user]);
      const yesBal = u256From(r, 0);
      const noBal = u256From(r, 2);
      return NextResponse.json({
        ok: true as const,
        yesRaw: yesBal.toString(),
        noRaw: noBal.toString(),
      });
    }

    return NextResponse.json({ ok: false as const, error: "unknown op" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "read failed";
    return NextResponse.json({ ok: false as const, error: msg }, { status: 400 });
  }
}
