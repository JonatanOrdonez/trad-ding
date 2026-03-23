"use client";

import { useEffect, useRef, useCallback, useState } from "react";

// Layout
import { Header } from "@/components/layout/Header";
import { SidePanel, PanelSpinner } from "@/components/layout/SidePanel";

// UI
import { ToastContainer } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/PageLoader";

// Assets
import { AssetCard, AssetCardSkeleton } from "@/components/assets/AssetCard";
import { FilterBar, type FilterType, type SortType } from "@/components/assets/FilterBar";
import { SignalSummary } from "@/components/assets/SignalSummary";
import { CreateAssetModal } from "@/components/assets/CreateAssetModal";

// Analysis & News
import { AnalysisPanel, AnalysisPanelError } from "@/components/analysis/AnalysisPanel";
import { NewsList } from "@/components/news/NewsList";

// Hooks
import { useAssets } from "@/hooks/useAssets";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useNews } from "@/hooks/useNews";
import { useToast } from "@/hooks/useToast";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useTheme } from "@/hooks/useTheme";

// Lib
import { loadAnalysis, saveAnalysis } from "@/lib/utils";
import { syncNews as apiSyncNews } from "@/lib/api";

// Types
import type { Asset, LocalAnalysis, CreateAssetRequest } from "@/types/asset";
import type { AssetAnalysis, Signal } from "@/types/analysis";

// ─── Panel state ──────────────────────────────────────────────────────────────
type PanelMode =
  | { type: "closed" }
  | { type: "analysis-loading"; symbol: string }
  | { type: "analysis"; symbol: string; data: AssetAnalysis }
  | { type: "analysis-error"; symbol: string; message: string }
  | { type: "news"; symbol: string }
;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getLocalAnalyses(assets: Asset[]): Record<string, LocalAnalysis | null> {
  const result: Record<string, LocalAnalysis | null> = {};
  assets.forEach((a) => {
    result[a.symbol] = loadAnalysis(a.symbol);
  });
  return result;
}

function getCountsMap(assets: Asset[]): Record<string, number> {
  return {
    all: assets.length,
    stock: assets.filter((a) => a.type === "stock").length,
    crypto: assets.filter((a) => a.type === "crypto").length,
    etf: assets.filter((a) => a.type === "etf").length,
  };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { dark, toggle: toggleTheme } = useTheme();
  const { assets, loading: assetsLoading, load, create, remove } = useAssets();
  const { analyze } = useAnalysis();
  const { items: newsItems, offset: newsOffset, loading: newsLoading, error: newsError, load: loadNews, hasMore, hasPrev } = useNews();
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  const [panel, setPanel] = useState<PanelMode>({ type: "closed" });
  const [createOpen, setCreateOpen] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);

  // Refresh local analyses when assets change or refreshCounter bumps
  const localAnalyses = getLocalAnalyses(assets);

  // ── Load on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    load();
  }, [load]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useKeyboard({
    onEscape: () => setPanel({ type: "closed" }),
    onSlash: () => searchRef.current?.focus(),
  });

  // ── Analyze single asset ────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async (symbol: string) => {
    setPanel({ type: "analysis-loading", symbol });
    try {
      const result = await analyze(symbol);
      setPanel({ type: "analysis", symbol, data: result });
      setRefreshCounter((c) => c + 1);
    } catch (e) {
      setPanel({
        type: "analysis-error",
        symbol,
        message: e instanceof Error ? e.message : "Analysis failed",
      });
    }
  }, [analyze]);

  // ── Analyze all ─────────────────────────────────────────────────────────────
  const handleAnalyzeAll = useCallback(async () => {
    if (!assets.length) { showToast("No assets to analyze.", "warning"); return; }
    showToast(`Analyzing ${assets.length} assets… this may take a few minutes.`, "info", 8000);
    let done = 0;
    let failed = 0;
    for (const asset of assets) {
      try {
        const result = await analyze(asset.symbol);
        saveAnalysis(asset.symbol, result.action, result.score);
        done++;
      } catch {
        failed++;
      }
    }
    setRefreshCounter((c) => c + 1);
    if (failed === 0) {
      showToast(`All ${done} assets analyzed successfully.`, "success");
    } else {
      showToast(`${done} analyzed · ${failed} failed`, failed === assets.length ? "error" : "warning");
    }
  }, [assets, analyze, showToast]);

  // ── Show news ───────────────────────────────────────────────────────────────
  const handleShowNews = useCallback(async (symbol: string) => {
    setPanel({ type: "news", symbol });
    await loadNews(symbol, 0);
  }, [loadNews]);

  const handleLoadNewsPage = useCallback(async (symbol: string, offset: number) => {
    await loadNews(symbol, offset);
  }, [loadNews]);

  // ── Sync news ───────────────────────────────────────────────────────────────
  const handleSyncNews = useCallback(async () => {
    setLoaderMessage("Syncing news...");
    try {
      const res = await apiSyncNews();
      showToast(res.message ?? "News synced successfully.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to sync news.", "error");
    } finally {
      setLoaderMessage(null);
    }
  }, [showToast]);

  // ── Delete asset ────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (symbol: string) => {
    setLoaderMessage(`Deleting ${symbol}...`);
    try {
      await remove(symbol);
      setLoaderMessage(null);
      showToast(`${symbol} deleted.`, "info");
    } catch (e) {
      setLoaderMessage(null);
      showToast(e instanceof Error ? e.message : "Delete failed.", "error");
    }
  }, [remove, showToast]);

  // ── Create asset ────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async (data: CreateAssetRequest) => {
    setLoaderMessage(`Creating ${data.symbol}...`);
    try {
      await create(data);
      setLoaderMessage(null);
      showToast(`${data.symbol} added to your portfolio.`, "success");
    } catch (e) {
      setLoaderMessage(null);
      throw e; // rethrow so modal can display error
    }
  }, [create, showToast]);

  // ── Filter + sort + search logic ─────────────────────────────────────────────
  let visible = activeFilter === "all" ? [...assets] : assets.filter((a) => a.type === activeFilter);

  if (activeSignal) {
    visible = visible.filter((a) => loadAnalysis(a.symbol)?.action === activeSignal);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    visible = visible.filter(
      (a) =>
        a.symbol.toLowerCase().includes(q) ||
        (a.name || "").toLowerCase().includes(q)
    );
  }

  if (sortBy === "symbol") {
    visible.sort((a, b) => a.symbol.localeCompare(b.symbol));
  } else if (sortBy === "analyzed") {
    visible.sort((a, b) => {
      const ta = loadAnalysis(a.symbol)?.ts ?? 0;
      const tb = loadAnalysis(b.symbol)?.ts ?? 0;
      return tb - ta;
    });
  } else if (sortBy === "action") {
    const order: Record<string, number> = { BUY: 0, HOLD: 1, SELL: 2 };
    visible.sort((a, b) => {
      const aa = loadAnalysis(a.symbol)?.action ?? "";
      const ba = loadAnalysis(b.symbol)?.action ?? "";
      return (order[aa] ?? 3) - (order[ba] ?? 3);
    });
  } else if (sortBy === "score-high") {
    visible.sort((a, b) => {
      const sa = loadAnalysis(a.symbol)?.score ?? -999;
      const sb = loadAnalysis(b.symbol)?.score ?? -999;
      return sb - sa;
    });
  } else if (sortBy === "score-low") {
    visible.sort((a, b) => {
      const sa = loadAnalysis(a.symbol)?.score ?? 999;
      const sb = loadAnalysis(b.symbol)?.score ?? 999;
      return sa - sb;
    });
  }

  // ── Panel title & content ────────────────────────────────────────────────────
  let panelTitle = "";
  let panelContent: React.ReactNode = null;

  if (panel.type === "analysis-loading") {
    panelTitle = `${panel.symbol} — Analysis`;
    panelContent = (
      <>
        <PanelSpinner />
        <p className="text-xs text-gray-500 text-center -mt-4">
          If no model exists, training will run first. This may take a few minutes.
        </p>
      </>
    );
  } else if (panel.type === "analysis") {
    panelTitle = `${panel.symbol} — Analysis`;
    panelContent = (
      <AnalysisPanel
        analysis={panel.data}
        onReanalyze={() => handleAnalyze(panel.symbol)}
      />
    );
  } else if (panel.type === "analysis-error") {
    panelTitle = `${panel.symbol} — Analysis`;
    panelContent = <AnalysisPanelError message={panel.message} />;
  } else if (panel.type === "news") {
    panelTitle = `${panel.symbol} — News`;
    panelContent = (
      <NewsList
        items={newsItems}
        symbol={panel.symbol}
        offset={newsOffset}
        hasMore={hasMore}
        hasPrev={hasPrev}
        loading={newsLoading}
        onLoadPage={handleLoadNewsPage}
      />
    );
    if (newsError) {
      panelContent = <AnalysisPanelError message={newsError} />;
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────────
  const isEmpty = assets.length === 0 && !assetsLoading;
  const noMatch = visible.length === 0 && assets.length > 0;

  return (
    <>
      {/* Header */}
      <Header
        onAddAsset={() => setCreateOpen(true)}
        onSyncNews={handleSyncNews}
        onAnalyzeAll={handleAnalyzeAll}
        isDark={dark}
        onToggleTheme={toggleTheme}
      />

      {/* Signal summary strip */}
      {assets.length > 0 && (
        <SignalSummary
          localAnalyses={localAnalyses}
          totalAssets={assets.length}
          activeSignal={activeSignal}
          onSignalClick={setActiveSignal}
          key={refreshCounter}
        />
      )}

      {/* Filter bar */}
      <FilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        counts={getCountsMap(assets)}
        searchInputRef={searchRef}
      />

      {/* Asset grid */}
      <main className="px-4 sm:px-6 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Loading skeletons */}
          {assetsLoading &&
            Array.from({ length: 4 }).map((_, i) => <AssetCardSkeleton key={i} />)}

          {/* Empty state */}
          {isEmpty && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                <svg className="w-7 h-7 text-gray-400 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-medium mb-1">No assets yet</p>
                <p className="text-gray-500 text-sm">Add your first stock, crypto, or ETF to get started.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="cursor-pointer min-h-[44px] bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                + Add your first asset
              </button>
            </div>
          )}

          {/* No match for filter/search */}
          {noMatch && (
            <div className="col-span-full flex flex-col items-center gap-2 py-16 text-center">
              <svg className="w-8 h-8 text-gray-300 dark:text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="text-sm text-gray-500">
                {searchQuery
                  ? `No assets matching "${searchQuery}"`
                  : activeSignal
                  ? `No ${activeSignal} signals right now`
                  : `No ${activeFilter}s found.`}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 underline mt-1"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* Asset cards */}
          {!assetsLoading &&
            visible.map((asset) => (
              <AssetCard
                key={asset.symbol}
                asset={asset}
                localAnalysis={localAnalyses[asset.symbol] ?? null}
                onAnalyze={handleAnalyze}
                onShowNews={handleShowNews}
                onDelete={handleDelete}
              />
            ))}
        </div>
      </main>

      {/* Side panel */}
      <SidePanel
        title={panelTitle}
        isOpen={panel.type !== "closed"}
        onClose={() => setPanel({ type: "closed" })}
      >
        {panelContent}
      </SidePanel>

      {/* Create asset modal */}
      <CreateAssetModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Full-screen loader */}
      <PageLoader visible={!!loaderMessage} message={loaderMessage ?? ""} />

      {/* Toast container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
