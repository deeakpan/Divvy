import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/app/lib/supabaseAdmin";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ markets: [] });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("markets")
      .select("id, question, asset, expiry_at, yes_pool, no_pool, status")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ markets: [] });
    return NextResponse.json({ markets: data ?? [] });
  } catch {
    return NextResponse.json({ markets: [] });
  }
}
