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
}

export interface TrainResult {
  symbol: string;
  error?: string;
  improved?: boolean;
}

export interface TrainResponse {
  results: TrainResult[];
}
