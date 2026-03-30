"use client";

import { useCallback } from "react";
import { fetchAnalysis } from "@/lib/api";
import { saveAnalysis } from "@/lib/utils";
import type { AssetAnalysis, ChartRow } from "@/types/analysis";

async function fetchChartSummary(symbol: string): Promise<{ latestRsi: number | null; priceChange7d: number | null }> {
  try {
    const res = await fetch(`/chart/${symbol}`);
    const d = await res.json();
    if (!res.ok || !d.rows?.length) return { latestRsi: null, priceChange7d: null };
    const rows: ChartRow[] = d.rows;
    const last = rows[rows.length - 1];
    const prev = rows[Math.max(0, rows.length - 8)];
    return {
      latestRsi: Math.round(last.rsi * 10) / 10,
      priceChange7d: Math.round(((last.close - prev.close) / prev.close) * 1000) / 10,
    };
  } catch {
    return { latestRsi: null, priceChange7d: null };
  }
}

export function useAnalysis() {
  const analyze = useCallback(async (symbol: string, period?: string): Promise<AssetAnalysis> => {
    const [result, chartData] = await Promise.all([
      fetchAnalysis(symbol, period),
      fetchChartSummary(symbol),
    ]);
    saveAnalysis(symbol, result.action, result.score, chartData);
    return result;
  }, []);

  return { analyze };
}
