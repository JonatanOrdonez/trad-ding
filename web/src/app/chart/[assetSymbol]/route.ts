import { NextRequest } from "next/server";
import YahooFinance from "yahoo-finance2";
import { supabase } from "@/lib/services/supabase";
import { buildFeatures } from "@/lib/features";

const yf = new YahooFinance();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assetSymbol: string }> }
) {
  try {
    const { assetSymbol } = await params;

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

    if (!raw || raw.length < 30) {
      return Response.json({ detail: "Not enough price data" }, { status: 422 });
    }

    const records = raw.map((h) => ({ close: h.close, volume: h.volume }));
    const features = buildFeatures(records);

    if (features.length === 0) {
      return Response.json({ detail: "Could not compute indicators" }, { status: 422 });
    }

    const offset = raw.length - features.length;
    const rows = features.map((f, i) => {
      const d = raw[offset + i].date;
      return {
        date: d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10),
        close: Math.round(raw[offset + i].close * 100) / 100,
        sma_7: Math.round(f.sma_7 * 100) / 100,
        sma_20: Math.round(f.sma_20 * 100) / 100,
        rsi: Math.round(f.rsi * 10) / 10,
      };
    });

    return Response.json({ rows: rows.slice(-45) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ detail: msg }, { status: 500 });
  }
}
