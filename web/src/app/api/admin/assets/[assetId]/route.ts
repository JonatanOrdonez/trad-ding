import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";
import { extractToken, requireAdmin } from "@/lib/services/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const admin = await requireAdmin(extractToken(req.headers.get("authorization")));
  if (!admin) return Response.json({ detail: "Forbidden" }, { status: 403 });

  const { assetId } = await params;
  const body = await req.json();

  const allowed = ["name", "symbol", "asset_type", "yfinance_symbol"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ detail: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase.from("assets").update(updates).eq("id", assetId);
  if (error) return Response.json({ detail: error.message }, { status: 500 });

  return Response.json({ success: true });
}
