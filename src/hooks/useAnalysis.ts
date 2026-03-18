"use client";

import { useCallback } from "react";
import { fetchAnalysis } from "@/lib/api";
import { saveAnalysis } from "@/lib/utils";
import type { AssetAnalysis } from "@/types/analysis";

export function useAnalysis() {
  const analyze = useCallback(async (symbol: string): Promise<AssetAnalysis> => {
    const result = await fetchAnalysis(symbol);
    saveAnalysis(symbol, result.action);
    return result;
  }, []);

  return { analyze };
}
