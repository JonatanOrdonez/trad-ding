"use client";

import type { Signal } from "@/types/analysis";
import type { LocalAnalysis } from "@/types/asset";

interface SignalSummaryProps {
  localAnalyses: Record<string, LocalAnalysis | null>;
  totalAssets: number;
  activeSignal: Signal | null;
  onSignalClick: (signal: Signal | null) => void;
}

interface PillInfo {
  id: Signal;
  label: string;
  count: number;
  bg: string;
  text: string;
  border: string;
  ring: string;
  icon: React.ReactNode;
}

export function SignalSummary({
  localAnalyses,
  totalAssets,
  activeSignal,
  onSignalClick,
}: SignalSummaryProps) {
  const counts: Record<Signal | "unanalyzed", number> = {
    BUY: 0,
    SELL: 0,
    HOLD: 0,
    unanalyzed: 0,
  };

  Object.values(localAnalyses).forEach((a) => {
    if (a?.action) counts[a.action] = (counts[a.action] ?? 0) + 1;
    else counts.unanalyzed++;
  });

  if (!totalAssets) return null;

  const pills: PillInfo[] = [
    {
      id: "BUY",
      label: "BUY",
      count: counts.BUY,
      bg: "bg-green-500/12",
      text: "text-green-400",
      border: "border-green-500/20",
      ring: "focus-visible:ring-green-500",
      icon: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
    {
      id: "SELL",
      label: "SELL",
      count: counts.SELL,
      bg: "bg-red-500/12",
      text: "text-red-400",
      border: "border-red-500/20",
      ring: "focus-visible:ring-red-500",
      icon: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ),
    },
    {
      id: "HOLD",
      label: "HOLD",
      count: counts.HOLD,
      bg: "bg-yellow-500/12",
      text: "text-yellow-400",
      border: "border-yellow-500/20",
      ring: "focus-visible:ring-yellow-500",
      icon: (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
  ];

  const visiblePills = pills.filter((p) => p.count > 0);
  if (!visiblePills.length && !counts.unanalyzed) return null;

  return (
    <div className="px-4 sm:px-6 pt-4 pb-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-600 font-medium mr-1">Portfolio signals</span>
        {visiblePills.map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => onSignalClick(activeSignal === pill.id ? null : pill.id)}
            className={`signal-pill inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 min-h-[32px] rounded-full ${pill.bg} ${pill.text} border ${pill.border} cursor-pointer focus:outline-none focus-visible:ring-2 ${pill.ring} transition-all ${
              activeSignal === pill.id ? "ring-2 ring-offset-2 ring-offset-gray-950" : ""
            }`}
          >
            {pill.icon}
            <span>
              {pill.label} {pill.count}
            </span>
          </button>
        ))}
        {counts.unanalyzed > 0 && (
          <span className="text-xs text-gray-600 tabular-nums">
            {counts.unanalyzed} not yet analyzed
          </span>
        )}
      </div>
    </div>
  );
}
