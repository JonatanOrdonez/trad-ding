import { NextRequest } from "next/server";
import { getNewsBySymbol, newsItemToText } from "@/lib/services/news";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetSymbol: string }> }
) {
  const { assetSymbol: symbol } = await params;
  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  try {
    const items = await getNewsBySymbol(symbol.toUpperCase(), offset, limit);
    return Response.json({
      news: items.map((item) => ({
        summary: newsItemToText(item),
        source_type: item.source_type,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ detail: msg }, { status: 400 });
  }
}
