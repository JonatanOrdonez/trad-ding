"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/hooks/useAuth";
import type { DbAsset } from "@/lib/services/supabase";

type SortCol = "symbol" | "name" | "type" | "yfinance" | "created";
type SortDir = "asc" | "desc";

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

export function AssetsTab() {
  const [assets, setAssets] = useState<DbAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DbAsset>>({});
  const [saving, setSaving] = useState(false);
  const [deletingSymbol, setDeletingSymbol] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchAssets = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/assets", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError("Failed to load assets"); return; }
      setAssets(await res.json());
    } catch {
      setError("Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const startEdit = (asset: DbAsset) => {
    setEditingId(asset.id);
    setEditForm({ name: asset.name, symbol: asset.symbol, asset_type: asset.asset_type, yfinance_symbol: asset.yfinance_symbol });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (id: string) => {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) { const d = await res.json(); alert(d.detail ?? "Failed to update"); return; }
      setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...editForm } as DbAsset : a)));
      setEditingId(null);
      setEditForm({});
    } catch {
      alert("Failed to update asset");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (symbol: string) => {
    const token = getAccessToken();
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/assets/${symbol}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); alert(d.detail ?? "Failed to delete"); return; }
      setAssets((prev) => prev.filter((a) => a.symbol !== symbol));
      setDeletingSymbol(null);
    } catch {
      alert("Failed to delete asset");
    } finally {
      setDeleting(false);
    }
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  let filtered = assets;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }
  if (filterType) filtered = filtered.filter((a) => a.asset_type === filterType);

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortCol === "symbol") return a.symbol.localeCompare(b.symbol) * dir;
    if (sortCol === "name") return a.name.localeCompare(b.name) * dir;
    if (sortCol === "type") return a.asset_type.localeCompare(b.asset_type) * dir;
    if (sortCol === "yfinance") return a.yfinance_symbol.localeCompare(b.yfinance_symbol) * dir;
    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
  });

  if (error) return <div className="text-sm text-red-500 py-4">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search symbol or name..."
          className="min-h-[36px] px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="cursor-pointer min-h-[36px] px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All types</option>
          <option value="stock">stock</option>
          <option value="crypto">crypto</option>
          <option value="etf">etf</option>
        </select>
        <span className="text-xs text-gray-500">{sorted.length} assets</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <SortHeader label="Symbol" col="symbol" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Name" col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Type" col="type" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="YF Symbol" col="yfinance" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Created" col="created" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="py-2 font-medium w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {sorted.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  {editingId === a.id ? (
                    <>
                      <td className="py-2 pr-3">
                        <input value={editForm.symbol ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, symbol: e.target.value }))}
                          className="w-full min-h-[32px] px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </td>
                      <td className="py-2 pr-3">
                        <input value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full min-h-[32px] px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </td>
                      <td className="py-2 pr-3">
                        <select value={editForm.asset_type ?? "stock"} onChange={(e) => setEditForm((f) => ({ ...f, asset_type: e.target.value as DbAsset["asset_type"] }))}
                          className="cursor-pointer min-h-[32px] px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="stock">stock</option>
                          <option value="crypto">crypto</option>
                          <option value="etf">etf</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input value={editForm.yfinance_symbol ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, yfinance_symbol: e.target.value }))}
                          className="w-full min-h-[32px] px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </td>
                      <td className="py-2 pr-3 text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td className="py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => saveEdit(a.id)} disabled={saving}
                            className="cursor-pointer text-[10px] font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 px-2 py-1 rounded transition-colors">
                            {saving ? "..." : "Save"}
                          </button>
                          <button type="button" onClick={cancelEdit}
                            className="cursor-pointer text-[10px] font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 pr-3 whitespace-nowrap font-semibold">{a.symbol}</td>
                      <td className="py-2.5 pr-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{a.name}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{a.asset_type}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-gray-500">{a.yfinance_symbol}</td>
                      <td className="py-2.5 pr-3 text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => startEdit(a)}
                            className="cursor-pointer text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeletingSymbol(a.symbol)}
                            className="cursor-pointer text-[10px] font-medium text-red-500 hover:underline">
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No assets found.</p>}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => !deleting && setDeletingSymbol(null)} />
          <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold mb-2">Delete {deletingSymbol}?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              This will permanently delete the asset, its models, and all associated news. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingSymbol(null)}
                disabled={deleting}
                className="cursor-pointer min-h-[40px] px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingSymbol)}
                disabled={deleting}
                className="cursor-pointer min-h-[40px] px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
