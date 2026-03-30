// Asset types

export type AssetType = "stock" | "crypto" | "etf";

export interface Asset {
  symbol: string;
  name: string;
  type: AssetType;
  urls: {
    news: string;
    predict: string;
  };
}

export interface CreateAssetRequest {
  name: string;
  symbol: string;
  asset_type: AssetType;
  yfinance_symbol: string;
}

export interface LocalAnalysis {
  action: "BUY" | "SELL" | "HOLD";
  ts: number;
  score?: number;
  latestRsi?: number | null;
  priceChange7d?: number | null;
}
