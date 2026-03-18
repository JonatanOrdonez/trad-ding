"use client";

import { useState, useRef } from "react";

interface HeaderProps {
  onAddAsset: () => void;
  onSyncNews: () => Promise<void>;
  onTrainAll: () => Promise<void>;
  onAnalyzeAll: () => Promise<void>;
}

export function Header({ onAddAsset, onSyncNews, onTrainAll, onAnalyzeAll }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMenuAction = async (action: () => Promise<void>) => {
    setMenuOpen(false);
    await action();
  };

  return (
    <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <svg className="w-6 h-6 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
        <span className="text-base font-semibold tracking-tight">trad-ding</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Actions dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="More actions"
            className="cursor-pointer flex items-center gap-1.5 min-h-[44px] text-sm bg-gray-800 hover:bg-gray-700 active:bg-gray-600 px-3 py-2 rounded-lg transition-colors duration-150 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
            <span className="hidden sm:inline">Actions</span>
          </button>

          {menuOpen && (
            <>
              {/* Close on outside click */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div
                className="absolute right-0 top-full mt-1.5 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-20 py-1 overflow-hidden"
                role="menu"
              >
                <button
                  type="button"
                  onClick={() => handleMenuAction(onSyncNews)}
                  className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors duration-150"
                  role="menuitem"
                >
                  <svg className="w-4 h-4 text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Sync news
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuAction(onTrainAll)}
                  className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors duration-150"
                  role="menuitem"
                >
                  <svg className="w-4 h-4 text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  Train all
                </button>
                <div className="mx-3 my-1 border-t border-gray-800" />
                <button
                  type="button"
                  onClick={() => handleMenuAction(onAnalyzeAll)}
                  className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-300 hover:bg-indigo-500/10 transition-colors duration-150"
                  role="menuitem"
                >
                  <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                  Analyze all
                </button>
              </div>
            </>
          )}
        </div>

        {/* Add asset button */}
        <button
          type="button"
          onClick={onAddAsset}
          className="cursor-pointer min-h-[44px] text-sm bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2 rounded-lg transition-colors duration-150 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 whitespace-nowrap"
        >
          <span className="sm:hidden">+ Add</span>
          <span className="hidden sm:inline">+ Add asset</span>
        </button>
      </div>
    </header>
  );
}
