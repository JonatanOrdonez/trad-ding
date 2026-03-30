import { NextRequest } from "next/server";
import YahooFinance from "yahoo-finance2";
import { supabase } from "@/lib/services/supabase";
import { buildFeatures } from "@/lib/features";
import { getCached, setCached } from "@/lib/cache";

const CACHE_TTL = 600; // 10 minutes

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

    const chart = await yf.chart(asset.yfinance_symbol as string, {
      period1: start,
      period2: end,
    });

    const filtered = chart.quotes.filter(
      (h) => h.close !== null && h.open !== null && h.high !== null && h.low !== null
    );

    if (!filtered || filtered.length < 60) {
      return Response.json({ detail: "Not enough price data" }, { status: 422 });
    }

    const records = filtered.map((h) => ({
      open: h.open!, high: h.high!, low: h.low!, close: h.close!, volume: h.volume!,
    }));
    const features = buildFeatures(records);

    if (features.length === 0) {
      return Response.json({ detail: "Could not compute indicators" }, { status: 422 });
    }

    const offset = filtered.length - features.length;
    const rows = features.map((f, i) => {
      const d = filtered[offset + i].date;
      const close = filtered[offset + i].close!;
      const sma20 = f.price_to_sma20 !== 0 ? close / f.price_to_sma20 : 0;
      const sma7 = sma20 * f.sma_ratio;
      return {
        date: d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10),
        close: Math.round(close * 100) / 100,
        sma_7: Math.round(sma7 * 100) / 100,
        sma_20: Math.round(sma20 * 100) / 100,
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
