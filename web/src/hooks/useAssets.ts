"use client";

import { useState, useCallback } from "react";
import { fetchAssets, createAsset, deleteAsset as apiDeleteAsset } from "@/lib/api";
import { removeAnalysis } from "@/lib/utils";
import type { Asset, CreateAssetRequest } from "@/types/asset";

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssets();
      setAssets(data);
    } catch {
      setError("Failed to load assets. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (body: CreateAssetRequest): Promise<void> => {
    await createAsset(body);
    await fetchAssets().then(setAssets);
  }, []);

  const remove = useCallback(async (symbol: string): Promise<void> => {
    await apiDeleteAsset(symbol);
    removeAnalysis(symbol);
    setAssets((prev) => prev.filter((a) => a.symbol !== symbol));
  }, []);

  return { assets, loading, error, load, create, remove };
}
