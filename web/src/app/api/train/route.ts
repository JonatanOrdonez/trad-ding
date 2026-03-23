import { NextRequest } from "next/server";
import YahooFinance from "yahoo-finance2";
import { supabase } from "@/lib/services/supabase";
import { getCached, setCached } from "@/lib/cache";

const yf = new YahooFinance();

const RATE_LIMIT_KEY = "train:rate-limit";
const LOCK_KEY = "train:lock";
const RATE_LIMIT_TTL = 1800; // 30 minutes
const LOCK_TTL = 600; // 10 minutes max lock

// ── Auth ─────────────────────────────────────────────────────────────────────

function validateApiKey(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key");
  const expected = process.env.TRAIN_API_KEY;
  if (!expected) return false;
  return key === expected;
}

// ── Redis lock helpers (using Upstash via cache module) ──────────────────────

async function acquireLock(): Promise<boolean> {
  // Use getCached to check if lock exists
  const existing = await getCached<string>(LOCK_KEY);
  if (existing) return false;
  // Set lock with TTL
  await setCached(LOCK_KEY, "locked", LOCK_TTL);
  return true;
}

async function releaseLock(): Promise<void> {
  // Import Redis directly to use del
  const { Redis } = await import("@upstash/redis");
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  const redis = new Redis({ url, token });
  await redis.del(LOCK_KEY);
}

// ── Train a single asset ─────────────────────────────────────────────────────

interface TrainResult {
  symbol: string;
  improved: boolean;
  error?: string;
  metrics?: { balanced_accuracy: number; roc_auc: number };
}

async function trainAsset(
  assetId: string,
  symbol: string,
  yfinanceSymbol: string
): Promise<TrainResult> {
  const modalUrl = process.env.MODAL_TRAIN_URL;
  const trainApiKey = process.env.TRAIN_API_KEY;
  if (!modalUrl) throw new Error("MODAL_TRAIN_URL is not set");

  // Fetch existing active model
  const { data: existingModel } = await supabase
    .from("asset_models")
    .select("id, metrics, created_at")
    .eq("asset_id", assetId)
    .eq("is_active", true)
    .maybeSingle();

  // Fetch 1 year of price history
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  const history = await yf.historical(
    yfinanceSymbol,
    { period1: startDate, period2: endDate },
    { validateResult: false }
  ) as Array<{ date: Date; close: number; open: number; high: number; low: number; volume: number }>;

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
    return { symbol, improved: false, error: "Not enough historical data" };
  }

  // Call Modal web endpoint
  const modalRes = await fetch(modalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, records, api_key: trainApiKey }),
  });

  if (!modalRes.ok) {
    const text = await modalRes.text();
    return { symbol, improved: false, error: `Modal error: ${text}` };
  }

  const result = await modalRes.json() as {
    error?: string;
    metrics?: { balanced_accuracy: number; roc_auc: number };
    storage_path?: string;
  };

  if (result.error) {
    return { symbol, improved: false, error: result.error };
  }

  const rocAuc = result.metrics!.roc_auc;

  // Decide whether to save the new model
  let shouldSave = true;
  if (existingModel) {
    const existingRocAuc = (existingModel.metrics as Record<string, number>)?.roc_auc ?? 0;
    const improved = rocAuc > existingRocAuc;
    const createdAt = new Date(existingModel.created_at);
    const stale = Date.now() - createdAt.getTime() > 5 * 24 * 60 * 60 * 1000; // 5 days
    shouldSave = improved || stale;
  }

  if (!shouldSave) {
    return { symbol, improved: false, metrics: result.metrics };
  }

  // Deactivate existing models and save new one
  await supabase
    .from("asset_models")
    .update({ is_active: false })
    .eq("asset_id", assetId);

  await supabase.from("asset_models").insert({
    asset_id: assetId,
    storage_path: result.storage_path,
    metrics: result.metrics,
    is_active: true,
  });

  return { symbol, improved: true, metrics: result.metrics };
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  if (!validateApiKey(req)) {
    return Response.json({ detail: "Forbidden" }, { status: 403 });
  }

  // 2. Rate limit
  const lastRun = await getCached<string>(RATE_LIMIT_KEY);
  if (lastRun) {
    return Response.json(
      { detail: "Rate limited. Max 1 training every 30 minutes." },
      { status: 429 }
    );
  }

  // 3. Concurrency lock
  const acquired = await acquireLock();
  if (!acquired) {
    return Response.json(
      { detail: "Training already in progress." },
      { status: 409 }
    );
  }

  try {
    // 4. Get all assets
    const { data: assets } = await supabase
      .from("assets")
      .select("id, symbol, yfinance_symbol");

    if (!assets || assets.length === 0) {
      return Response.json({ results: [] });
    }

    // 5. Train sequentially (avoid overloading Modal)
    const results: TrainResult[] = [];
    for (const asset of assets) {
      try {
        const result = await trainAsset(
          asset.id as string,
          asset.symbol as string,
          asset.yfinance_symbol as string
        );
        results.push(result);
      } catch (e) {
        results.push({
          symbol: asset.symbol as string,
          improved: false,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    // 6. Set rate limit after successful completion
    await setCached(RATE_LIMIT_KEY, new Date().toISOString(), RATE_LIMIT_TTL);

    return Response.json({ results });
  } finally {
    await releaseLock();
  }
}
