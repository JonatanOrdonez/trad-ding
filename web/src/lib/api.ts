import type { Asset, CreateAssetRequest } from "@/types/asset";
import type { AssetAnalysis, TrainResponse } from "@/types/analysis";
import type { NewsResponse, SyncResponse } from "@/types/news";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    const detail = await res.json().then((d) => d?.detail).catch(() => null);
    throw new Error(detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchAssets(): Promise<Asset[]> {
  return request<Asset[]>("/summary");
}

export function createAsset(body: CreateAssetRequest): Promise<unknown> {
  return request("/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteAsset(symbol: string): Promise<unknown> {
  return request(`/assets/${symbol}`, { method: "DELETE" });
}

export function fetchAnalysis(symbol: string): Promise<AssetAnalysis> {
  return request<AssetAnalysis>(`/predictions/${symbol}`);
}

export function fetchNews(symbol: string, offset: number, limit: number): Promise<NewsResponse> {
  return request<NewsResponse>(`/news/${symbol}?offset=${offset}&limit=${limit}`);
}

export function syncNews(): Promise<SyncResponse> {
  return request<SyncResponse>("/news/sync");
}

export function trainAll(): Promise<TrainResponse> {
  return request<TrainResponse>("/train");
}
