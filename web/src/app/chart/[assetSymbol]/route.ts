import { NextRequest } from "next/server";
import YahooFinance from "yahoo-finance2";
import { supabase } from "@/lib/services/supabase";
import { buildFeatures } from "@/lib/features";
import { getCached, setCached } from "@/lib/cache";

const CACHE_TTL = 60;

const yf = new YahooFinance();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assetSymbol: string }> }
) {
  const { assetSymbol } = await params;
  const key = `chart:${assetSymbol.toUpperCase()}`;

  try {
    const cached = await getCached(key);
    if (cached) return Response.json(cached);

    const { data: asset } = await supabase
      .from("assets")
      .select("yfinance_symbol")
      .eq("symbol", assetSymbol.toUpperCase())
      .maybeSingle();

    if (!asset) {
      return Response.json({ detail: "Asset not found" }, { status: 404 });
    }

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);

    const raw = await yf.historical(
      asset.yfinance_symbol as string,
      { period1: start, period2: end },
      { validateResult: false }
    );

    const filtered = raw.filter((h: { close: number | null }) => h.close !== null);

    if (!filtered || filtered.length < 30) {
      return Response.json({ detail: "Not enough price data" }, { status: 422 });
    }

    const records = filtered.map((h: { close: number; volume: number }) => ({ close: h.close, volume: h.volume }));
    const features = buildFeatures(records);

    if (features.length === 0) {
      return Response.json({ detail: "Could not compute indicators" }, { status: 422 });
    }

    const offset = filtered.length - features.length;
    const rows = features.map((f, i) => {
      const d = filtered[offset + i].date;
      return {
        date: d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10),
        close: Math.round(filtered[offset + i].close * 100) / 100,
        sma_7: Math.round(f.sma_7 * 100) / 100,
        sma_20: Math.round(f.sma_20 * 100) / 100,
        rsi: Math.round(f.rsi * 10) / 10,
      };
    });

    const payload = { rows: rows.slice(-45) };
    await setCached(key, payload, CACHE_TTL);
    return Response.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ detail: msg }, { status: 500 });
  }
}
