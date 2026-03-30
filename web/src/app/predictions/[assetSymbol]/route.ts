import { NextRequest } from "next/server";
import { analyzeAsset } from "@/lib/services/analysis";
import { getCached, setCached } from "@/lib/cache";

const CACHE_TTL = 600; // 10 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetSymbol: string }> }
) {
  const { assetSymbol: symbol } = await params;
  const period = req.nextUrl.searchParams.get("period") ?? undefined;
  const key = `predictions:${symbol.toUpperCase()}:${period ?? "1d"}`;

  try {
    const cached = await getCached(key);
    if (cached) return Response.json(cached);

    const analysis = await analyzeAsset(symbol.toUpperCase(), period);
    await setCached(key, analysis, CACHE_TTL);
    return Response.json(analysis);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return Response.json({ detail: msg }, { status: 400 });
  }
}
