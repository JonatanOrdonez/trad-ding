import { NextRequest } from "next/server";
import { analyzeAsset } from "@/lib/services/analysis";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assetSymbol: string }> }
) {
  const { assetSymbol: symbol } = await params;

  try {
    const analysis = await analyzeAsset(symbol.toUpperCase());
    return Response.json(analysis);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return Response.json({ detail: msg }, { status: 400 });
  }
}
