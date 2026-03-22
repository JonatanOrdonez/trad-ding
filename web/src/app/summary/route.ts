import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";

export async function GET(req: NextRequest) {
  const { data: assets, error } = await supabase
    .from("assets")
    .select("symbol, name, asset_type")
    .order("created_at");

  if (error) return Response.json({ detail: error.message }, { status: 500 });

  const base = new URL(req.url).origin;

  const result = (assets ?? []).map((a) => ({
    symbol: a.symbol,
    name: a.name,
    type: a.asset_type,
    urls: {
      news: `${base}/news/${a.symbol}`,
      predict: `${base}/predictions/${a.symbol}`,
    },
  }));

  return Response.json(result);
}
