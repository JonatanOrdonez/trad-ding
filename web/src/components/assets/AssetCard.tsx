"use client";

import { typeBadgeClasses, cardTypeClass, actionStyleClasses, actionBarColor } from "@/lib/constants";
import { timeAgo, scoreToPct } from "@/lib/utils";
import { useChartSummary } from "@/hooks/useChartSummary";
import type { Asset, LocalAnalysis } from "@/types/asset";

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface AssetCardProps {
  asset: Asset;
  localAnalysis: LocalAnalysis | null;
  onAnalyze: (symbol: string) => void;
  onShowNews: (symbol: string) => void;
  onDelete: (symbol: string) => void;
}

export function AssetCard({ asset, localAnalysis, onAnalyze, onShowNews, onDelete }: AssetCardProps) {
  const styles = actionStyleClasses(localAnalysis?.action ?? null);
  const barColor = localAnalysis?.action ? actionBarColor(localAnalysis.action) : null;
  const isStale = localAnalysis ? Date.now() - localAnalysis.ts > STALE_MS : false;
  const { latestRsi, priceChange7d } = useChartSummary(asset.symbol);

  const rsiColor =
    latestRsi !== null
      ? latestRsi >= 70
        ? "text-red-500 bg-red-500/10 border-red-500/20"
        : latestRsi <= 30
        ? "text-green-500 bg-green-500/10 border-green-500/20"
        : null
      : null;

  return (
    <div
      className={`${cardTypeClass(asset.type)} bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800/80 rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 cursor-default`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-bold tracking-tight">{asset.symbol}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeClasses(asset.type)}`}>
              {asset.type.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug">{asset.name}</p>
        </div>

        {/* Last analysis badge + stale indicator */}
        {localAnalysis && (
          <div className="shrink-0 pt-0.5 flex items-center gap-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badge}`}>
              {localAnalysis.action} · {timeAgo(localAnalysis.ts)}
            </span>
            {isStale && (
              <span title="Analysis may be outdated (>24h)" className="text-amber-500 text-xs leading-none">⚠</span>
            )}
          </div>
        )}
      </div>

      {/* Mini score bar */}
      {localAnalysis?.score !== undefined && barColor && (
        <div className="space-y-0.5">
          <div className="relative h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 ${barColor} rounded-full`}
              style={{ width: `${scoreToPct(localAnalysis.score)}%` }}
            />
            <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300/60 dark:bg-gray-700/60" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-600">
            <span>Bearish</span>
            <span className="font-medium tabular-nums">
              {localAnalysis.score > 0 ? "+" : ""}{localAnalysis.score.toFixed(2)}
            </span>
            <span>Bullish</span>
          </div>
        </div>
      )}

      {/* Chart indicators row */}
      {(priceChange7d !== null || rsiColor) && (
        <div className="flex items-center gap-2 flex-wrap">
          {priceChange7d !== null && (
            <span className={`text-xs font-medium tabular-nums px-2 py-0.5 rounded-full border ${
              priceChange7d >= 0
                ? "text-green-600 dark:text-green-400 bg-green-500/8 border-green-500/20"
                : "text-red-500 dark:text-red-400 bg-red-500/8 border-red-500/20"
            }`}>
              {priceChange7d >= 0 ? "+" : ""}{priceChange7d.toFixed(1)}% 7d
            </span>
          )}
          {latestRsi !== null && rsiColor && (
            <span className={`text-xs font-medium tabular-nums px-2 py-0.5 rounded-full border ${rsiColor}`}>
              RSI {latestRsi}
            </span>
          )}
        </div>
      )}

      {/* Primary actions */}
      <div className="flex gap-2 mt-auto">
        <button
          type="button"
          onClick={() => onAnalyze(asset.symbol)}
          className="cursor-pointer flex-1 min-h-[40px] bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Analyze
        </button>
        <button
          type="button"
          onClick={() => onShowNews(asset.symbol)}
          className="cursor-pointer flex-1 min-h-[40px] border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm font-medium py-2 rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          News
        </button>
      </div>

      {/* Delete */}
      <div className="border-t border-gray-200/80 dark:border-gray-800/80 pt-2.5 -mx-5 px-5 -mb-1">
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete ${asset.symbol} and all its news and ML models?`)) {
              onDelete(asset.symbol);
            }
          }}
          aria-label={`Delete ${asset.symbol}`}
          className="cursor-pointer w-full flex items-center justify-center gap-2 min-h-[32px] text-xs font-medium text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-1.5 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}

export function AssetCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-3.5 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
      <div className="flex gap-2 mt-auto">
        <div className="h-9 flex-1 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="h-9 flex-1 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      </div>
    </div>
  );
}
