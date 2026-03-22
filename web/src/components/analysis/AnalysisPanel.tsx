"use client";

import { actionStyleClasses, actionHeroBg, actionBarColor } from "@/lib/constants";
import { scoreToPct } from "@/lib/utils";
import type { AssetAnalysis, Signal } from "@/types/analysis";
import { PriceChart } from "./PriceChart";

interface AnalysisPanelProps {
  analysis: AssetAnalysis;
  onReanalyze: () => void;
}

function SectionLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3 flex items-center gap-2">
      <span className={`inline-block w-1 h-3.5 rounded-full ${color}`} />
      {children}
    </p>
  );
}

export function AnalysisPanel({ analysis, onReanalyze }: AnalysisPanelProps) {
  const styles = actionStyleClasses(analysis.action as Signal);
  const heroBg = actionHeroBg(analysis.action as Signal);
  const barColor = actionBarColor(analysis.action as Signal);
  const barPct = scoreToPct(analysis.score);

  const now = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-5">
      {/* Hero: action + score */}
      <div className={`rounded-xl border ${heroBg} p-4 space-y-3`}>
        <div className="flex items-center gap-3">
          <span className={`text-4xl font-bold tracking-tight ${styles.score}`}>
            {analysis.action}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles.pill}`}>
            {analysis.sentiment}
          </span>
          <span className={`ml-auto text-2xl font-bold tabular-nums ${styles.score}`}>
            {analysis.score > 0 ? "+" : ""}
            {analysis.score.toFixed(2)}
          </span>
        </div>

        {/* Score bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-600 mb-1.5">
            <span>−1.0 Bearish</span>
            <span>Bullish +1.0</span>
          </div>
          <div className="relative h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 ${barColor} rounded-full transition-all duration-500`}
              style={{ width: `${barPct}%` }}
            />
            <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300/60 dark:bg-gray-700/60" />
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{analysis.score_interpretation}</p>

        {/* ML confidence */}
        {analysis.ml_confidence !== null && analysis.ml_confidence !== undefined && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-400 dark:text-gray-500">ML model quality</span>
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  analysis.ml_confidence >= 0.65
                    ? "bg-green-500"
                    : analysis.ml_confidence >= 0.55
                    ? "bg-yellow-500"
                    : "bg-red-400"
                }`}
                style={{ width: `${Math.round(analysis.ml_confidence * 100)}%` }}
              />
            </div>
            <span className={`text-xs font-medium tabular-nums ${
              analysis.ml_confidence >= 0.65
                ? "text-green-500"
                : analysis.ml_confidence >= 0.55
                ? "text-yellow-500"
                : "text-red-400"
            }`}>
              {Math.round(analysis.ml_confidence * 100)}%
            </span>
          </div>
        )}
        {(analysis.ml_confidence === null || analysis.ml_confidence === undefined) && (
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">ML model: not trained yet</p>
        )}
      </div>

      {/* Timestamp */}
      <p className="text-xs text-gray-400 dark:text-gray-600 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Analyzed {now}
      </p>

      <hr className="border-gray-200 dark:border-gray-800" />

      {/* Price chart */}
      <section className="space-y-2">
        <SectionLabel color="bg-cyan-500/60">Technical chart</SectionLabel>
        <PriceChart symbol={analysis.symbol} />
      </section>

      <hr className="border-gray-200 dark:border-gray-800" />

      {/* Summary */}
      <section className="space-y-2">
        <SectionLabel color="bg-indigo-500/60">Summary</SectionLabel>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-[1.75] max-w-prose">{analysis.summary}</p>
      </section>

      {/* Recommendation */}
      <section className="space-y-2">
        <SectionLabel color="bg-indigo-500/60">Recommendation</SectionLabel>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-[1.75] max-w-prose">{analysis.recommendation}</p>
      </section>

      {/* Growth signals */}
      {analysis.growth_signals?.length > 0 && (
        <section className="space-y-2">
          <SectionLabel color="bg-green-500/60">Growth signals</SectionLabel>
          <ul className="space-y-2">
            {analysis.growth_signals.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-green-400 leading-snug">
                <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Risks */}
      {analysis.risks?.length > 0 && (
        <section className="space-y-2">
          <SectionLabel color="bg-red-500/60">Risks</SectionLabel>
          <ul className="space-y-2">
            {analysis.risks.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-red-400 leading-snug">
                <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Watch */}
      {analysis.monitor?.length > 0 && (
        <section className="space-y-2">
          <SectionLabel color="bg-yellow-500/60">Watch</SectionLabel>
          <ul className="space-y-1.5">
            {analysis.monitor.map((m, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-gray-500 dark:text-gray-400 leading-snug">
                <svg className="w-4 h-4 shrink-0 mt-0.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Competitors */}
      {analysis.competitors_mentioned?.length > 0 && (
        <section className="space-y-2">
          <SectionLabel color="bg-gray-500/60">Competitors mentioned</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {analysis.competitors_mentioned.map((c, i) => (
              <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded-lg font-medium text-gray-600 dark:text-gray-300">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Re-analyze */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={onReanalyze}
          className="cursor-pointer w-full flex items-center justify-center gap-2 min-h-[40px] text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 rounded-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Re-analyze
        </button>
      </div>
    </div>
  );
}

export function AnalysisPanelError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
