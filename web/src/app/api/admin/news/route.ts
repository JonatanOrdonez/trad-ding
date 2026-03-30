import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";
import { extractToken, requireAdmin } from "@/lib/services/auth";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(extractToken(req.headers.get("authorization")));
  if (!admin) return Response.json({ detail: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const assetId = sp.get("asset_id") ?? null;
  const sourceType = sp.get("source_type") ?? null;

  let query = supabase
    .from("asset_news")
    .select("*, assets!asset_news_asset_id_fkey(symbol)", { count: "exact" });

  if (assetId) query = query.eq("asset_id", assetId);
  if (sourceType) query = query.eq("source_type", sourceType);

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) return Response.json({ detail: error.message }, { status: 500 });

  return Response.json({
    items: data,
    total: count ?? 0,
    page,
    page_size: PAGE_SIZE,
    total_pages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
