import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";
import { getCached, setCached } from "@/lib/cache";

const CACHE_TTL = 30;
const CACHE_KEY = "summary";

export async function GET(req: NextRequest) {
  const cached = await getCached(CACHE_KEY);
  if (cached) return Response.json(cached);

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

  await setCached(CACHE_KEY, result, CACHE_TTL);
  return Response.json(result);
}
