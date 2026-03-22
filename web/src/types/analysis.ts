// Analysis types

export type Signal = "BUY" | "SELL" | "HOLD";
export type Sentiment = "bullish" | "bearish" | "neutral";

export interface AssetAnalysis {
  symbol: string;
  sentiment: Sentiment;
  score: number;
  score_interpretation: string;
  summary: string;
  growth_signals: string[];
  risks: string[];
  competitors_mentioned: string[];
  monitor: string[];
  action: Signal;
  recommendation: string;
  ml_confidence: number | null;
}

export interface ChartRow {
  date: string;
  close: number;
  sma_7: number;
  sma_20: number;
  rsi: number;
}

export interface TrainResult {
  symbol: string;
  error?: string;
  improved?: boolean;
}

export interface TrainResponse {
  results: TrainResult[];
}
