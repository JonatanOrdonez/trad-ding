import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";
import { extractToken, requireAdmin } from "@/lib/services/auth";
import { syncAllNews, syncYahooNewsForAsset } from "@/lib/services/news";
import type { DbAsset } from "@/lib/services/supabase";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(extractToken(req.headers.get("authorization")));
  if (!admin) return Response.json({ detail: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const assetId: string | undefined = body.asset_id;

  try {
    if (assetId) {
      // Sync news for a single asset
      const { data: asset } = await supabase
        .from("assets")
        .select("*")
        .eq("id", assetId)
        .maybeSingle();

      if (!asset) return Response.json({ detail: "Asset not found" }, { status: 404 });
      await syncYahooNewsForAsset(asset as DbAsset);
      return Response.json({ message: `News synced for ${asset.symbol}` });
    }

    // Sync all
    await syncAllNews();
    return Response.json({ message: "All news synced successfully" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return Response.json({ detail: msg }, { status: 500 });
  }
}
