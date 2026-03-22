import type { Signal } from "@/types/analysis";
import type { AssetType } from "@/types/asset";

export const NEWS_LIMIT = 20;

// ── Asset filter tabs ──────────────────────────────────────────────────────────
export const ASSET_TYPES = [
  { value: "all", label: "All" },
  { value: "stock", label: "Stocks", color: "bg-blue-400" },
  { value: "crypto", label: "Crypto", color: "bg-orange-400" },
  { value: "etf", label: "ETFs", color: "bg-purple-400" },
] as const;

// ── Sort options ───────────────────────────────────────────────────────────────
export const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "symbol", label: "Symbol A–Z" },
  { value: "analyzed", label: "Last analyzed" },
  { value: "action", label: "Signal (BUY first)" },
] as const;

export const SORT_LABELS: Record<string, string> = {
  default: "Sort",
  symbol: "A–Z",
  analyzed: "Recent",
  action: "Signal",
};

// ── Action (BUY / SELL / HOLD) style helpers ───────────────────────────────────
export function actionStyleClasses(action: Signal | null): {
  score: string;
  pill: string;
  badge: string;
} {
  switch (action) {
    case "BUY":
      return {
        score: "text-green-400",
        pill: "bg-green-500/15 text-green-300",
        badge: "bg-green-500/15 text-green-400",
      };
    case "SELL":
      return {
        score: "text-red-400",
        pill: "bg-red-500/15 text-red-300",
        badge: "bg-red-500/15 text-red-400",
      };
    case "HOLD":
      return {
        score: "text-yellow-400",
        pill: "bg-yellow-500/15 text-yellow-300",
        badge: "bg-yellow-500/15 text-yellow-400",
      };
    default:
      return {
        score: "text-gray-400",
        pill: "bg-gray-700 text-gray-400",
        badge: "bg-gray-800 text-gray-500",
      };
  }
}

export function actionHeroBg(action: Signal): string {
  switch (action) {
    case "BUY":
      return "bg-green-500/5 border-green-500/20";
    case "SELL":
      return "bg-red-500/5 border-red-500/20";
    case "HOLD":
      return "bg-yellow-500/5 border-yellow-500/20";
    default:
      return "bg-gray-900 border-gray-800";
  }
}

export function actionBarColor(action: Signal): string {
  switch (action) {
    case "BUY":
      return "bg-green-500";
    case "SELL":
      return "bg-red-500";
    case "HOLD":
      return "bg-yellow-500";
    default:
      return "bg-gray-500";
  }
}

// ── Asset type badge / card helpers ───────────────────────────────────────────
export function typeBadgeClasses(type: AssetType): string {
  switch (type) {
    case "stock":
      return "bg-blue-500/15 text-blue-300 border border-blue-500/20";
    case "crypto":
      return "bg-orange-500/15 text-orange-300 border border-orange-500/20";
    case "etf":
      return "bg-purple-500/15 text-purple-300 border border-purple-500/20";
    default:
      return "bg-gray-700 text-gray-400";
  }
}

export function cardTypeClass(type: AssetType): string {
  switch (type) {
    case "stock":
      return "hover:border-blue-800/60";
    case "crypto":
      return "hover:border-orange-800/60";
    case "etf":
      return "hover:border-purple-800/60";
    default:
      return "";
  }
}

// ── News source badge colors ───────────────────────────────────────────────────
export function sourceColorClasses(src: string): string {
  const lower = src.toLowerCase();
  if (lower.includes("yfinance")) {
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  }
  if (lower.includes("newsapi")) {
    return "bg-purple-500/10 text-purple-400 border-purple-500/20";
  }
  return "bg-gray-800 text-gray-400 border-gray-700";
}
