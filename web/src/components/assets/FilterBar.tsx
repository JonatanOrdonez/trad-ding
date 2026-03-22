"use client";

import { useRef, useState } from "react";
import { ASSET_TYPES, SORT_OPTIONS, SORT_LABELS } from "@/lib/constants";

export type FilterType = "all" | "stock" | "crypto" | "etf";
export type SortType = "default" | "symbol" | "analyzed" | "action" | "score-high" | "score-low";

interface FilterBarProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  sortBy: SortType;
  onSortChange: (sort: SortType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  counts: Record<string, number>;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function FilterBar({
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
  counts,
  searchInputRef,
}: FilterBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  return (
    <div className="px-4 sm:px-6 pt-4 pb-3 flex flex-col gap-3">
      {/* Type filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {ASSET_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            data-filter={t.value}
            onClick={() => onFilterChange(t.value as FilterType)}
            className={`filter-tab cursor-pointer text-xs font-medium px-3 py-2 min-h-[36px] rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all duration-150 ${
              activeFilter === t.value
                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
                : ""
            }`}
          >
            {"color" in t && (
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${t.color} mr-1.5 align-middle`}
              />
            )}
            {t.label}
            <span className="ml-1 opacity-60">
              {counts[t.value] ?? ""}
            </span>
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-600 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search symbol or name…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full min-h-[44px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 focus:border-indigo-500 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 pl-8 pr-8 py-2 rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Search assets"
            autoComplete="off"
            spellCheck={false}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative" ref={sortRef}>
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={sortOpen}
            className="cursor-pointer flex items-center gap-1.5 min-h-[44px] text-xs font-medium px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>{SORT_LABELS[sortBy] ?? "Sort"}</span>
          </button>

          {sortOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} aria-hidden="true" />
              <div
                className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-20 py-1 overflow-hidden"
                role="menu"
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSortChange(opt.value as SortType);
                      setSortOpen(false);
                    }}
                    className={`cursor-pointer w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 ${
                      sortBy === opt.value ? "text-indigo-600 dark:text-indigo-400" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
