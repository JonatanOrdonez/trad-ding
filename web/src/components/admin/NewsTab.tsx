"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/hooks/useAuth";
import type { DbAsset } from "@/lib/services/supabase";

interface NewsItem {
  id: string;
  asset_id: string | null;
  content_id: string;
  source_type: "yfinance" | "newsapi";
  content: Record<string, unknown>;
  created_at: string;
  assets: { symbol: string } | null;
}

interface NewsResponse {
  items: NewsItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

type SortCol = "asset" | "source" | "title" | "date";
type SortDir = "asc" | "desc";

function getTitle(item: NewsItem): string {
  const c = item.content;
  return (c.title as string) ?? (c.Title as string) ?? (c.headline as string) ?? item.content_id;
}

function getDate(item: NewsItem): string {
  const c = item.content;
  const d = (c.date as string) ?? (c.published_at as string) ?? (c.Date as string) ?? item.created_at;
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

function getDateTs(item: NewsItem): number {
  const c = item.content;
  const d = (c.date as string) ?? (c.published_at as string) ?? (c.Date as string) ?? item.created_at;
  try { return new Date(d).getTime(); } catch { return 0; }
}

function ExpandableTitle({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 80;
  return (
    <div>
      <span className="text-gray-700 dark:text-gray-300">
        {isLong && !expanded ? text.slice(0, 80) + "..." : text}
      </span>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 text-[10px] text-indigo-500 hover:underline"
        >
          {expanded ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}

function JsonModal({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <span className="text-sm font-semibold">Raw JSON</span>
          <button type="button" onClick={onClose} className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <pre className="overflow-auto p-4 text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function SortHeader({ label, col, sortCol, sortDir, onSort }: {
  label: string; col: SortCol; sortCol: SortCol; sortDir: SortDir; onSort: (col: SortCol) => void;
}) {
  return (
    <th
      className="py-2 pr-3 font-medium cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortCol === col && (
          <span className="text-indigo-500">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </span>
    </th>
  );
}

export function NewsTab() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [assets, setAssets] = useState<DbAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterAssetId, setFilterAssetId] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [jsonModal, setJsonModal] = useState<Record<string, unknown> | null>(null);

  const fetchAssets = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch("/api/admin/assets", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAssets(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchNews = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filterAssetId) params.set("asset_id", filterAssetId);
      if (filterSource) params.set("source_type", filterSource);
      const res = await fetch(`/api/admin/news?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("Failed to load news"); return; }
      setData(await res.json());
    } catch {
      setError("Failed to load news");
    } finally {
      setLoading(false);
    }
  }, [page, filterAssetId, filterSource]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);
  useEffect(() => { fetchNews(); }, [fetchNews]);

  const handleSync = async (assetId?: string) => {
    const token = getAccessToken();
    if (!token) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/sync-news", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(assetId ? { asset_id: assetId } : {}),
      });
      const d = await res.json();
      setSyncResult(!res.ok ? `Error: ${d.detail ?? "Sync failed"}` : d.message ?? "Synced");
      if (res.ok) fetchNews();
    } catch {
      setSyncResult("Network error");
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortedItems = [...(data?.items ?? [])].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortCol === "asset") return (a.assets?.symbol ?? "").localeCompare(b.assets?.symbol ?? "") * dir;
    if (sortCol === "source") return a.source_type.localeCompare(b.source_type) * dir;
    if (sortCol === "title") return getTitle(a).localeCompare(getTitle(b)) * dir;
    return (getDateTs(a) - getDateTs(b)) * dir;
  });

  if (error) return <div className="text-sm text-red-500 py-4">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Filters + sync */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterAssetId} onChange={(e) => { setFilterAssetId(e.target.value); setPage(1); }}
          className="cursor-pointer min-h-[36px] px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All assets</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.symbol}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}
          className="cursor-pointer min-h-[36px] px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All sources</option>
          <option value="yfinance">yfinance</option>
          <option value="newsapi">newsapi</option>
        </select>
        {data && <span className="text-xs text-gray-500">{data.total} total</span>}
        <div className="ml-auto flex items-center gap-2">
          {filterAssetId && (
            <button type="button" onClick={() => handleSync(filterAssetId)} disabled={syncing}
              className="cursor-pointer min-h-[36px] px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors disabled:opacity-50">
              {syncing ? "Syncing..." : `Sync ${assets.find((a) => a.id === filterAssetId)?.symbol ?? "asset"}`}
            </button>
          )}
          <button type="button" onClick={() => handleSync()} disabled={syncing}
            className="cursor-pointer min-h-[36px] px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 rounded-lg transition-colors">
            {syncing ? "Syncing..." : "Sync all"}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`text-sm px-3 py-2 rounded-lg border ${syncResult.startsWith("Error") ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"}`}>
          {syncResult}
          <button type="button" onClick={() => setSyncResult(null)} className="ml-2 text-xs underline opacity-70">dismiss</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-14 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <SortHeader label="Asset" col="asset" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Source" col="source" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Title" col="title" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Date" col="date" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="py-2 font-medium w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">{item.assets?.symbol ?? "General"}</span>
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${item.source_type === "newsapi" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"}`}>
                      {item.source_type}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 max-w-xs"><ExpandableTitle text={getTitle(item)} /></td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-gray-500">{getDate(item)}</td>
                  <td className="py-2.5 whitespace-nowrap">
                    <button type="button" onClick={() => setJsonModal(item.content)}
                      className="cursor-pointer text-[10px] font-medium text-indigo-500 hover:underline">
                      JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedItems.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No news found.</p>}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="cursor-pointer min-h-[36px] px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-default rounded-lg transition-colors">
            Previous
          </button>
          <span className="text-xs text-gray-500">Page {data.page} of {data.total_pages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))} disabled={page >= data.total_pages}
            className="cursor-pointer min-h-[36px] px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-default rounded-lg transition-colors">
            Next
          </button>
        </div>
      )}

      {/* JSON modal */}
      {jsonModal && <JsonModal data={jsonModal} onClose={() => setJsonModal(null)} />}
    </div>
  );
}
