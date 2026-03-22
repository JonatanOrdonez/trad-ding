"use client";

import { useState, useCallback } from "react";
import { fetchNews } from "@/lib/api";
import { NEWS_LIMIT } from "@/lib/constants";
import type { NewsItem } from "@/types/news";

export function useNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (symbol: string, newOffset: number = 0) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNews(symbol, newOffset, NEWS_LIMIT);
      setItems(data.news ?? []);
      setOffset(newOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load news");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const hasMore = items.length >= NEWS_LIMIT;
  const hasPrev = offset > 0;

  return { items, offset, loading, error, load, hasMore, hasPrev };
}
