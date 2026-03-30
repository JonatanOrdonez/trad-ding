import { NextRequest } from "next/server";
import YahooFinance from "yahoo-finance2";
import { supabase } from "@/lib/services/supabase";

const yf = new YahooFinance();

// ── Auth ─────────────────────────────────────────────────────────────────────

function validateApiKey(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key");
  const expected = process.env.TRAIN_API_KEY;
  if (!expected) return false;
  return key === expected;
}

// ── Train a single asset ─────────────────────────────────────────────────────

interface TrainResult {
  symbol: string;
  saved: boolean;
  error?: string;
  metrics?: { balanced_accuracy: number; roc_auc: number };
}

async function trainAsset(
  assetId: string,
  symbol: string,
  yfinanceSymbol: string,
): Promise<TrainResult> {
  const modalUrl = process.env.MODAL_TRAIN_URL;
  const trainApiKey = process.env.TRAIN_API_KEY;
  if (!modalUrl) throw new Error("MODAL_TRAIN_URL is not set");

  // Fetch 3 years of price history
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 3);

  console.log(`[train] ${symbol} fetching price history...`);
  const history = (await yf.chart(yfinanceSymbol, {
    period1: startDate,
    period2: endDate,
  })).quotes as Array<{
    date: Date;
    close: number;
    open: number;
    high: number;
    low: number;
    volume: number;
  }>;

  const records = history
    .filter((h) => h.close !== null)
    .map((h) => ({
      Date: h.date,
      Close: h.close,
      Open: h.open,
      High: h.high,
      Low: h.low,
      Volume: h.volume,
    }));

  if (records.length < 60) {
    return { symbol, saved: false, error: "Not enough historical data" };
  }

  console.log(`[train] ${symbol} sending ${records.length} records to Modal...`);
  const modalRes = await fetch(modalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, records, api_key: trainApiKey }),
  });

  if (!modalRes.ok) {
    const text = await modalRes.text();
    return { symbol, saved: false, error: `Modal error: ${text}` };
  }

  const result = (await modalRes.json()) as {
    error?: string;
    metrics?: { balanced_accuracy: number; roc_auc: number };
    storage_path?: string;
  };

  if (result.error) {
    return { symbol, saved: false, error: result.error };
  }

  // Always save — training runs weekly, always replace with fresh model
  console.log(`[train] ${symbol} saving model. storage_path=${result.storage_path}`);

  await supabase
    .from("asset_models")
    .update({ is_active: false })
    .eq("asset_id", assetId);

  const { error: insertErr } = await supabase.from("asset_models").insert({
    asset_id: assetId,
    storage_path: result.storage_path,
    metrics: result.metrics,
    features: {
      period: "3y",
      features: [
        "sma_ratio",
        "price_to_sma20",
        "rsi",
        "rsi_change",
        "macd_hist",
        "bb_position",
        "atr_ratio",
        "volume_ratio",
        "obv_change",
        "price_change",
        "price_change_5d",
        "high_low_range",
        "trend_strength",
        "vol_regime",
        "mean_rev_dist",
        "rsi_zone",
        "consecutive_up",
      ],
    },
    is_active: true,
  });

  if (insertErr) {
    console.log(`[train] ${symbol} insert error=`, insertErr);
    return { symbol, saved: false, error: insertErr.message };
  }

  console.log(`[train] ${symbol} done. roc_auc=${result.metrics?.roc_auc}`);
  return { symbol, saved: true, metrics: result.metrics };
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return Response.json({ detail: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const filterSymbols: string[] | undefined = body.symbols;

  let query = supabase.from("assets").select("id, symbol, yfinance_symbol");
  if (filterSymbols?.length) {
    query = query.in("symbol", filterSymbols.map((s: string) => s.toUpperCase()));
  }

  const { data: assets } = await query;

  if (!assets || assets.length === 0) {
    return Response.json({ results: [] });
  }

  // Train all assets in parallel
  const results = await Promise.all(
    assets.map(async (asset): Promise<TrainResult> => {
      try {
        return await trainAsset(
          asset.id as string,
          asset.symbol as string,
          asset.yfinance_symbol as string,
        );
      } catch (e) {
        return {
          symbol: asset.symbol as string,
          saved: false,
          error: e instanceof Error ? e.message : "Unknown error",
        };
      }
    }),
  );

  return Response.json({ results });
}
