import { NextRequest, NextResponse } from "next/server";
import {
  normalizeStarknetAddress,
  parseSplitPlanConfig,
  validateSplitConfig,
  type SplitPlanBalanceSnapshot,
} from "@/app/lib/splitPlan";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/app/lib/supabaseAdmin";

function parseSnapshot(raw: unknown): SplitPlanBalanceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const cap = o.captured_at;
  if (typeof cap !== "string") return null;
  const need = (sym: string) => {
    const v = o[sym];
    if (!v || typeof v !== "object") return null;
    const u = v as Record<string, unknown>;
    if (typeof u.low !== "string" || typeof u.high !== "string") return null;
    return { low: u.low, high: u.high };
  };
  const STRK = need("STRK");
  const ETH = need("ETH");
  const USDC = need("USDC");
  if (!STRK || !ETH || !USDC) return null;
  return { STRK, ETH, USDC, captured_at: cap };
}

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 503 });
    }
    const wallet = req.nextUrl.searchParams.get("wallet");
    if (!wallet?.trim()) {
      return NextResponse.json({ error: "Missing wallet query parameter." }, { status: 400 });
    }
    let normalized: string;
    try {
      normalized = normalizeStarknetAddress(wallet);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wallet_split_plans")
      .select("wallet_address, config, balance_snapshot, created_at, updated_at")
      .eq("wallet_address", normalized)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ plan: null });
    }
    return NextResponse.json({ plan: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 503 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const wallet = typeof body.wallet_address === "string" ? body.wallet_address : "";
    if (!wallet.trim()) {
      return NextResponse.json({ error: "Missing wallet_address." }, { status: 400 });
    }
    let normalized: string;
    try {
      normalized = normalizeStarknetAddress(wallet);
    } catch {
      return NextResponse.json({ error: "Invalid wallet_address." }, { status: 400 });
    }

    const config = parseSplitPlanConfig(body.config);
    if (!config) {
      return NextResponse.json({ error: "Invalid config shape." }, { status: 400 });
    }
    const cfgErr = validateSplitConfig(config);
    if (cfgErr) {
      return NextResponse.json({ error: cfgErr }, { status: 400 });
    }

    const snapshot = parseSnapshot(body.balance_snapshot);
    if (!snapshot) {
      return NextResponse.json({ error: "Invalid balance_snapshot (need STRK, ETH, USDC u256 + captured_at)." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wallet_split_plans")
      .upsert(
        {
          wallet_address: normalized,
          config,
          balance_snapshot: snapshot,
        },
        { onConflict: "wallet_address" }
      )
      .select("wallet_address, config, balance_snapshot, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ plan: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
