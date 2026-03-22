"use client";

import { useEffect, useState } from "react";
import type { ChartRow } from "@/types/analysis";

interface ChartSummary {
  latestRsi: number | null;
  priceChange7d: number | null;
  loading: boolean;
}

export function useChartSummary(symbol: string): ChartSummary {
  const [latestRsi, setLatestRsi] = useState<number | null>(null);
  const [priceChange7d, setPriceChange7d] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLatestRsi(null);
    setPriceChange7d(null);

    fetch(`/chart/${symbol}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.rows?.length || cancelled) return;
        const rows: ChartRow[] = d.rows;
        const last = rows[rows.length - 1];
        const prev = rows[Math.max(0, rows.length - 8)];
        setLatestRsi(Math.round(last.rsi * 10) / 10);
        setPriceChange7d(Math.round(((last.close - prev.close) / prev.close) * 1000) / 10);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [symbol]);

  return { latestRsi, priceChange7d, loading };
}
