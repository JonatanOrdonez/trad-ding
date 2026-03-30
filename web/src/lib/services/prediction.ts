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
  assetId: string,
): Promise<PredictionResult> {
  const model = await getActiveModel(assetId);
  console.log(
    `[predictAsset] assetId=${assetId} activeModel=`,
    model ? { path: model.storage_path, metrics: model.metrics } : "NONE",
  );
  if (!model) return null;

  const { data: blob, error } = await supabase.storage
    .from(BUCKET)
    .download(model.storage_path);
  console.log(
    `[predictAsset] download storage_path=${model.storage_path} error=`,
    error ?? "none",
    "blob size=",
    blob?.size ?? 0,
  );
  if (error || !blob) return null;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  let historical: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[] = [];
  try {
    const chart = await yf.chart(yfinanceSymbol, {
      period1: startDate,
      period2: endDate,
    });
    historical = chart.quotes.filter((h) => h.close !== null) as {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[];
  } catch (e) {
    console.log(`[predictAsset] yfinance error:`, e);
    return null;
  }

  console.log(`[predictAsset] historical rows=${historical.length}`);
  if (historical.length < 30) return null;

  const records = historical.map((h) => ({
    open: h.open,
    high: h.high,
    low: h.low,
    close: h.close,
    volume: h.volume,
  }));
  const features = buildFeatures(records);
  if (features.length === 0) {
    console.log(`[predictAsset] feature engineering returned 0 rows`);
    return null;
  }

  const last = features[features.length - 1];
  const inputData = Float32Array.from(
    FEATURES.map((f) => last[f as keyof typeof last] as number),
  );

  try {
    const modelBytes = new Uint8Array(await blob.arrayBuffer());
    console.log(`[predictAsset] ONNX model bytes=${modelBytes.length}`);
    const session = await ort.InferenceSession.create(modelBytes);
    console.log(
      `[predictAsset] ONNX session created. inputs=${session.inputNames} outputs=${session.outputNames}`,
    );
    const inputTensor = new ort.Tensor("float32", inputData, [
      1,
      FEATURES.length,
    ]);
    const results = await session.run({ [session.inputNames[0]]: inputTensor });
    const proba = results[session.outputNames[1]].data as Float32Array;
    console.log(`[predictAsset] proba=`, Array.from(proba));

    const signal = proba[1] >= 0.5 ? "BUY" : "SELL";
    const confidence = Math.round(Math.max(proba[0], proba[1]) * 10000) / 10000;

    return {
      signal,
      confidence,
      balanced_accuracy:
        (model.metrics as Record<string, number>)?.balanced_accuracy ?? 0,
      roc_auc: (model.metrics as Record<string, number>)?.roc_auc ?? 0,
    };
  } catch (e) {
    console.log(`[predictAsset] ONNX inference error:`, e);
    return null;
  }
}
