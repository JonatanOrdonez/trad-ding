import Groq from "groq-sdk";
import type { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";
import { getGeneralNews, getNewsBySymbol, newsItemToText } from "./news";
import { predictAsset, type PredictionResult } from "./prediction";
import { summarizeNews } from "./summarizer";
import { supabase } from "./supabase";
import type { AssetAnalysis } from "@/types/analysis";

const SYSTEM_PROMPT = `You are an expert financial analyst combining two independent signals to produce \
actionable investment analysis:

1. FUNDAMENTAL / SENTIMENT signal — derived from recent news articles about the asset and the \
broader market. This reflects narratives, macro trends, earnings, and public perception.

2. TECHNICAL signal — produced by a trained XGBoost model using short-term price indicators \
(SMA-7, SMA-20, RSI-14, MACD, volume change). It predicts whether the next closing price will \
be higher or lower. Its quality is measured by ROC AUC (0.5 = random, 1.0 = perfect).

Your job is to weigh both signals together and produce a clear, honest recommendation. When the \
signals agree, conviction should be higher. When they conflict, explain why and lean toward the \
stronger or more reliable one. Write for someone with no investment background — be plain, direct, \
and avoid jargon.

You must respond exclusively with a valid JSON object. Do not include any text outside the JSON.`;

function buildUserPrompt(
  symbol: string,
  generalNews: string,
  assetNews: string,
  ml: PredictionResult,
  periodLabel: string
): string {
  const mlSection = ml
    ? `Model prediction (next closing price direction): ${ml.signal}
Confidence: ${(ml.confidence * 100).toFixed(0)}%
Model quality — balanced accuracy: ${ml.balanced_accuracy}, ROC AUC: ${ml.roc_auc}
(ROC AUC above 0.6 is reliable; below 0.55 should be treated with caution.)`
    : `No trained model available for this asset. Base your analysis solely on the news signals.`;

  return `Analyze the following information for ${symbol} focusing on ${periodLabel}.

--- GENERAL MARKET NEWS ---
${generalNews}

--- NEWS SPECIFIC TO ${symbol} ---
${assetNews}

--- TECHNICAL ML SIGNAL ---
${mlSection}

Respond with a JSON object with exactly these fields:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "score": float between -1.0 and 1.0,
  "score_interpretation": "one sentence explaining what the score means for this asset right now",
  "summary": "2-3 paragraphs: what this asset is, what the news says, and what the technical model suggests",
  "growth_signals": ["specific positive indicators found in the news or technicals"],
  "risks": ["specific risks mentioned or implied for this asset"],
  "competitors_mentioned": ["competitors named in the news, empty list if none"],
  "monitor": ["key factors to watch in the coming days"],
  "action": "BUY" | "SELL" | "HOLD",
  "recommendation": "one paragraph combining both signals into a final recommendation, noting where they agree or conflict"
}`;
}

function scoreInterpretation(score: number): string {
  if (score >= 0.6) return "Strong positive sentiment. News suggests favorable conditions for investment.";
  if (score >= 0.2) return "Moderate positive sentiment. Some encouraging signals but cautious optimism advised.";
  if (score >= -0.2) return "Neutral sentiment. News does not strongly favor either direction.";
  if (score >= -0.6) return "Moderate negative sentiment. News suggests some headwinds for this asset.";
  return "Strong negative sentiment. News indicates significant challenges ahead.";
}

const PERIOD_MAP: Record<string, { newsLimit: number; label: string; summarize: boolean }> = {
  "1h":  { newsLimit: 3,  label: "the last hour",     summarize: false },
  "1d":  { newsLimit: 5,  label: "the last 24 hours",  summarize: false },
  "1w":  { newsLimit: 10, label: "the last week",      summarize: false },
  "1m":  { newsLimit: 20, label: "the last month",     summarize: true },
  "3m":  { newsLimit: 30, label: "the last 3 months",  summarize: true },
  "6m":  { newsLimit: 40, label: "the last 6 months",  summarize: true },
  "1y":  { newsLimit: 50, label: "the last year",      summarize: true },
};

const MAX_RETRIES = 3;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function groqWithRetry(
  client: Groq,
  params: ChatCompletionCreateParamsNonStreaming,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create(params);
      return response.choices[0].message.content ?? "";
    } catch (e: unknown) {
      const status = (e as { status?: number }).status;
      if (status === 429 && attempt < MAX_RETRIES - 1) {
        const waitSec = (e as { headers?: Record<string, string> }).headers?.["retry-after"];
        const wait = waitSec ? parseFloat(waitSec) * 1000 : (attempt + 1) * 12000;
        console.log(`[analysis] Rate limited, waiting ${Math.round(wait / 1000)}s...`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded for Groq API");
}


export async function analyzeAsset(symbol: string, period?: string): Promise<AssetAnalysis> {
  const periodConfig = PERIOD_MAP[period ?? "1d"] ?? PERIOD_MAP["1d"];
  const { data: asset } = await supabase
    .from("assets")
    .select("id, yfinance_symbol")
    .eq("symbol", symbol)
    .maybeSingle();

  if (!asset) throw new Error(`Asset '${symbol}' not found`);

  const [generalNewsItems, assetNewsItems, ml] = await Promise.all([
    getGeneralNews(0, periodConfig.newsLimit),
    getNewsBySymbol(symbol, 0, periodConfig.newsLimit),
    predictAsset(asset.yfinance_symbol as string, asset.id as string),
  ]);

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error("GROQ_API_KEY is not set");

  const client = new Groq({ apiKey: groqApiKey, timeout: 60000 });

  let generalNewsText: string;
  let assetNewsText: string;

  if (periodConfig.summarize) {
    // Two-pass: summarize news first, then analyze
    const generalTexts = generalNewsItems.map((n) => newsItemToText(n));
    const assetTexts = assetNewsItems.map((n) => newsItemToText(n));

    [generalNewsText, assetNewsText] = await Promise.all([
      summarizeNews(generalTexts, "general market"),
      summarizeNews(assetTexts, `${symbol}-specific`),
    ]);
  } else {
    // Direct pass: send raw news
    generalNewsText =
      generalNewsItems.map((n) => newsItemToText(n)).join("\n---\n") ||
      "No general news available.";
    assetNewsText =
      assetNewsItems.map((n) => newsItemToText(n)).join("\n---\n") ||
      "No specific news available for this asset.";
  }

  const raw = await groqWithRetry(client, {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserPrompt(symbol, generalNewsText, assetNewsText, ml, periodConfig.label),
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  if (!raw) throw new Error("Empty response from Groq");

  const data = JSON.parse(raw);
  const score = parseFloat(data.score);

  return {
    symbol,
    sentiment: data.sentiment,
    score,
    score_interpretation: scoreInterpretation(score),
    summary: data.summary,
    growth_signals: data.growth_signals ?? [],
    risks: data.risks ?? [],
    competitors_mentioned: data.competitors_mentioned ?? [],
    monitor: data.monitor ?? [],
    action: data.action ?? "HOLD",
    recommendation: data.recommendation ?? "",
    ml_confidence: ml?.roc_auc ?? null,
  };
}
