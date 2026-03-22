import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";

const BUCKET = "ml-models";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ assetSymbol: string }> }
) {
  const { assetSymbol } = await params;
  const upper = assetSymbol.toUpperCase();

  const { data: asset } = await supabase
    .from("assets")
    .select("id")
    .eq("symbol", upper)
    .maybeSingle();

  if (!asset) {
    return Response.json({ detail: `Asset '${upper}' not found.` }, { status: 404 });
  }

  // Collect model storage paths before deleting
  const { data: models } = await supabase
    .from("asset_models")
    .select("storage_path")
    .eq("asset_id", asset.id);

  const storagePaths = (models ?? []).map((m) => m.storage_path as string);

  // Delete related rows
  await supabase.from("asset_news").delete().eq("asset_id", asset.id);
  await supabase.from("asset_models").delete().eq("asset_id", asset.id);
  await supabase.from("assets").delete().eq("id", asset.id);

  // Remove ONNX files from storage
  if (storagePaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(storagePaths);
  }

  return Response.json({ deleted: upper });
}
