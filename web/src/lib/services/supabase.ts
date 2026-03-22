import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_KEY must be set");
  return createClient(url, key);
}

export const supabase = getSupabase();

// ── Typed DB helpers ──────────────────────────────────────────────────────────

export interface DbAsset {
  id: string;
  symbol: string;
  name: string;
  asset_type: "stock" | "crypto" | "etf";
  yfinance_symbol: string;
  created_at: string;
}

export interface DbAssetNews {
  id: string;
  asset_id: string | null;
  content_id: string;
  source_type: "yfinance" | "newsapi";
  content: Record<string, unknown>;
  created_at: string;
}

export interface DbAssetModel {
  id: string;
  asset_id: string;
  storage_path: string;
  metrics: { balanced_accuracy?: number; roc_auc?: number } | null;
  is_active: boolean;
  created_at: string;
}
