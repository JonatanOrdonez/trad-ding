import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";
import { extractToken, requireAdmin } from "@/lib/services/auth";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(extractToken(req.headers.get("authorization")));
  if (!admin) return Response.json({ detail: "Forbidden" }, { status: 403 });

  const assetId = req.nextUrl.searchParams.get("asset_id") ?? null;

  let query = supabase
    .from("asset_models")
    .select("*, assets!asset_models_asset_id_fkey(symbol)")
    .order("trained_at", { ascending: false });

  if (assetId) query = query.eq("asset_id", assetId);

  const { data, error } = await query;
  if (error) return Response.json({ detail: error.message }, { status: 500 });

  return Response.json(data);
}
