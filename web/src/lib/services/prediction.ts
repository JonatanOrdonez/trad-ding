import YahooFinance from "yahoo-finance2";
import * as ort from "onnxruntime-node";
import { supabase } from "./supabase";
import { buildFeatures, FEATURES } from "../features";

const yf = new YahooFinance();
const BUCKET = "ml-models";

export type PredictionResult = {
  signal: "BUY" | "SELL";
  confidence: number;
  balanced_accuracy: number;
  roc_auc: number;
} | null;

async function getActiveModel(assetId: string) {
  const { data } = await supabase
    .from("asset_models")
    .select("storage_path, metrics")
    .eq("asset_id", assetId)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

// Returns null if no model exists — no training is triggered
export async function predictAsset(
  yfinanceSymbol: string,
  assetId: string
): Promise<PredictionResult> {
  const model = await getActiveModel(assetId);
  if (!model) return null;

  const { data: blob, error } = await supabase.storage
    .from(BUCKET)
    .download(model.storage_path);
  if (error || !blob) return null;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  let historical: { close: number; volume: number }[] = [];
  try {
    const raw = await yf.historical(
      yfinanceSymbol,
      { period1: startDate, period2: endDate },
      { validateResult: false }
    );
    historical = raw.filter((h: { close: number | null }) => h.close !== null) as { close: number; volume: number }[];
  } catch {
    return null;
  }

  if (historical.length < 30) return null;

  const records = historical.map((h) => ({ close: h.close, volume: h.volume }));
  const features = buildFeatures(records);
  if (features.length === 0) {
    console.log(`[predictAsset] feature engineering returned 0 rows`);
    return null;
  }

  const last = features[features.length - 1];
  const inputData = Float32Array.from(
    FEATURES.map((f) => last[f as keyof typeof last] as number)
  );

  try {
    const modelBytes = new Uint8Array(await blob.arrayBuffer());
    const session = await ort.InferenceSession.create(modelBytes);
    const inputTensor = new ort.Tensor("float32", inputData, [1, FEATURES.length]);
    const results = await session.run({ [session.inputNames[0]]: inputTensor });
    const proba = results[session.outputNames[1]].data as Float32Array;

    const signal = proba[1] >= 0.5 ? "BUY" : "SELL";
    const confidence = Math.round(Math.max(proba[0], proba[1]) * 10000) / 10000;

    return {
      signal,
      confidence,
      balanced_accuracy: (model.metrics as Record<string, number>)?.balanced_accuracy ?? 0,
      roc_auc: (model.metrics as Record<string, number>)?.roc_auc ?? 0,
    };
  } catch {
    return null;
  }
}
