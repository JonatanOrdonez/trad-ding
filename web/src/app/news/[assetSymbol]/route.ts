import { NextRequest } from "next/server";
import { getNewsBySymbol, newsItemToText } from "@/lib/services/news";
import { getCached, setCached } from "@/lib/cache";

const CACHE_TTL = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetSymbol: string }> }
) {
  const { assetSymbol: symbol } = await params;
  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const key = `news:${symbol.toUpperCase()}:${offset}:${limit}`;

  try {
    const cached = await getCached(key);
    if (cached) return Response.json(cached);

    const items = await getNewsBySymbol(symbol.toUpperCase(), offset, limit);
    const payload = {
      news: items.map((item) => ({
        summary: newsItemToText(item),
        source_type: item.source_type,
      })),
    };
    await setCached(key, payload, CACHE_TTL);
    return Response.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ detail: msg }, { status: 400 });
  }
}
