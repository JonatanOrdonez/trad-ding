"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/hooks/useAuth";
import type { DbAsset } from "@/lib/services/supabase";

interface ModelRow {
  id: string;
  asset_id: string;
  storage_path: string;
  metrics: { balanced_accuracy?: number; roc_auc?: number } | null;
  is_active: boolean;
  trained_at: string;
  assets: { symbol: string } | null;
}

function MetricBadge({ label, value }: { label: string; value: number | undefined }) {
  if (value === undefined) return null;
  const pct = (value * 100).toFixed(1);
  const color =
    value >= 0.6
      ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
      : value >= 0.55
      ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
      : "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium tabular-nums ${color}`}>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span>{pct}%</span>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel, loading }: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">{message}</p>
        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="cursor-pointer min-h-[40px] px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="cursor-pointer min-h-[40px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "Training..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModelsTab() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [assets, setAssets] = useState<DbAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAssetId, setFilterAssetId] = useState("");
  const [retrainAsset, setRetrainAsset] = useState<{ id: string; symbol: string } | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainResult, setRetrainResult] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const res = await fetch("/api/admin/assets", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAssets(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchModels = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = filterAssetId ? `?asset_id=${filterAssetId}` : "";
      const res = await fetch(`/api/admin/models${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("Failed to load models"); return; }
      setModels(await res.json());
    } catch {
      setError("Failed to load models");
    } finally {
      setLoading(false);
    }
  }, [filterAssetId]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);
  useEffect(() => { fetchModels(); }, [fetchModels]);

  const handleRetrain = async () => {
    if (!retrainAsset) return;
    const token = getAccessToken();
    if (!token) return;
    setRetraining(true);
    setRetrainResult(null);
    try {
      const res = await fetch("/api/admin/retrain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbol: retrainAsset.symbol }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRetrainResult(`Error: ${data.detail ?? "Training failed"}`);
      } else {
        const result = data.results?.[0];
        if (result?.error) {
          setRetrainResult(`Failed: ${result.error}`);
        } else if (result?.metrics) {
          setRetrainResult(`Success! ROC AUC: ${(result.metrics.roc_auc * 100).toFixed(1)}%, Bal. Acc: ${(result.metrics.balanced_accuracy * 100).toFixed(1)}%`);
          fetchModels();
        } else {
          setRetrainResult("Training completed");
          fetchModels();
        }
      }
    } catch {
      setRetrainResult("Network error during training");
    } finally {
      setRetraining(false);
      setRetrainAsset(null);
    }
  };

  if (error) return <div className="text-sm text-red-500 py-4">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Filter + retrain */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterAssetId}
          onChange={(e) => setFilterAssetId(e.target.value)}
          className="cursor-pointer min-h-[36px] px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All assets</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>{a.symbol}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{models.length} models</span>
      </div>

      {/* Retrain result toast */}
      {retrainResult && (
        <div className={`text-sm px-3 py-2 rounded-lg border ${
          retrainResult.startsWith("Success")
            ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}>
          {retrainResult}
          <button type="button" onClick={() => setRetrainResult(null)} className="ml-2 text-xs underline opacity-70">dismiss</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {models.map((m) => (
            <div key={m.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{m.assets?.symbol ?? "—"}</span>
                  {m.is_active ? (
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                      Inactive
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setRetrainAsset({ id: m.asset_id, symbol: m.assets?.symbol ?? "" })}
                  className="cursor-pointer shrink-0 min-h-[32px] px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors"
                >
                  Retrain
                </button>
              </div>

              {/* Metrics */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <MetricBadge label="ROC AUC" value={m.metrics?.roc_auc} />
                <MetricBadge label="Bal. Acc" value={m.metrics?.balanced_accuracy} />
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 dark:text-gray-600">
                <span>Path: {m.storage_path}</span>
                <span>Trained: {new Date(m.trained_at).toLocaleString()}</span>
              </div>
            </div>
          ))}

          {models.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No models found.</p>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {retrainAsset && (
        <ConfirmModal
          title={`Retrain ${retrainAsset.symbol}?`}
          message={`This will fetch 3 years of price data and train a new XGBoost model for ${retrainAsset.symbol}. This may take a few minutes.`}
          onConfirm={handleRetrain}
          onCancel={() => setRetrainAsset(null)}
          loading={retraining}
        />
      )}
    </div>
  );
}
