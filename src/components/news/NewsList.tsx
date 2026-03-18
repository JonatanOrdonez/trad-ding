"use client";

import { parseNewsRaw, fmtNewsDate } from "@/lib/utils";
import { sourceColorClasses } from "@/lib/constants";
import type { NewsItem } from "@/types/news";

interface NewsCardProps {
  item: NewsItem;
  index: number;
}

export function NewsCard({ item, index }: NewsCardProps) {
  const p = parseNewsRaw(item.summary as string);
  const srcLabel = p.source || (item.source_type as string) || "News";
  const date = fmtNewsDate(p.date);
  const title = p.title || "Untitled article";
  const summary = p.summary || (item.summary as string) || "";
  const url = p.url;
  const srcCls = sourceColorClasses(srcLabel + " " + ((item.source_type as string) || ""));

  return (
    <article
      className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all duration-200 hover:shadow-lg hover:shadow-black/30"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-4 space-y-3">
        {/* Source + date */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border ${srcCls}`}>
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {srcLabel}
          </span>
          {date && <span className="text-xs text-gray-600 tabular-nums">{date}</span>}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-100 leading-snug group-hover:text-white transition-colors duration-150 line-clamp-2">
          {title}
        </h3>

        {/* Summary */}
        {summary && (
          <p className="text-xs text-gray-400 leading-[1.7] line-clamp-3">{summary}</p>
        )}
      </div>

      {/* Footer */}
      {url && (
        <div className="px-4 pb-3 flex items-center justify-between border-t border-gray-800/70 pt-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors duration-150"
            aria-label={`Read full article: ${title}`}
          >
            Read article
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
          <span className="text-xs text-gray-700 uppercase tracking-widest">
            {((item.source_type as string) || "").toUpperCase()}
          </span>
        </div>
      )}
    </article>
  );
}

interface NewsListProps {
  items: NewsItem[];
  symbol: string;
  offset: number;
  hasMore: boolean;
  hasPrev: boolean;
  loading: boolean;
  onLoadPage: (symbol: string, offset: number) => void;
}

export function NewsList({ items, symbol, offset, hasMore, hasPrev, loading, onLoadPage }: NewsListProps) {
  const page = Math.floor(offset / 5) + 1;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-10 justify-center">
        <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span>Loading...</span>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-300">No news yet for {symbol}</p>
        <p className="text-xs text-gray-600 max-w-[220px]">Try syncing news from the Actions menu to fetch the latest articles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <p className="text-xs text-gray-600 tabular-nums">
          {items.length} article{items.length !== 1 ? "s" : ""} · page {page}
        </p>
      </div>

      {items.map((item, i) => (
        <NewsCard key={i} item={item} index={i} />
      ))}

      {/* Pagination */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={() => onLoadPage(symbol, offset - 5)}
          className="cursor-pointer flex-1 min-h-[40px] flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl border border-gray-800 hover:border-gray-700 hover:bg-gray-800/60 text-gray-400 hover:text-white transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Prev
        </button>
        <button
          type="button"
          disabled={!hasMore}
          onClick={() => onLoadPage(symbol, offset + 5)}
          className="cursor-pointer flex-1 min-h-[40px] flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl border border-gray-800 hover:border-gray-700 hover:bg-gray-800/60 text-gray-400 hover:text-white transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Next
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
