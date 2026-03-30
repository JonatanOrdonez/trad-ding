"use client";

import { useState, useRef } from "react";
import type { AuthUser } from "@/types/auth";

interface HeaderProps {
  onAddAsset: () => void;
  onSyncNews: () => Promise<void>;
  onAnalyzeAll: () => Promise<void>;
  isDark: boolean;
  onToggleTheme: () => void;
  user: AuthUser | null;
  onLogout: () => void;
}

export function Header({ onAddAsset, onSyncNews, onAnalyzeAll, isDark, onToggleTheme, user, onLogout }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMenuAction = async (action: () => Promise<void>) => {
    setMenuOpen(false);
    await action();
  };

  return (
    <header className="sticky top-0 z-10 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
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
        {/* User info */}
        {user && (
          <div className="hidden sm:flex items-center gap-2 mr-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
              {user.userName || user.email}
            </span>
            {user.role === "admin" && (
              <a
                href="/admin"
                className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              >
                Admin
              </a>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="cursor-pointer flex items-center justify-center w-9 h-9 min-h-[44px] rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {isDark ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Actions dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="More actions"
            className="cursor-pointer flex items-center gap-1.5 min-h-[44px] text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg transition-colors duration-150 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950"
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
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div
                className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-20 py-1 overflow-hidden"
                role="menu"
              >
                {user?.role === "admin" && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onAddAsset(); }}
                      className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add asset
                    </button>
                    <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800" />
                    <button
                      type="button"
                      onClick={() => handleMenuAction(onSyncNews)}
                      className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      Sync news
                    </button>
                    <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800" />
                    <button
                      type="button"
                      onClick={() => handleMenuAction(onAnalyzeAll)}
                      className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 transition-colors duration-150"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                      </svg>
                      Analyze all
                    </button>
                  </>
                )}

                {/* Admin link (visible on mobile too) */}
                {user?.role === "admin" && (
                  <>
                    <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800" />
                    <a
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Admin panel
                    </a>
                  </>
                )}

                {/* Logout */}
                {user && (
                  <>
                    <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800" />
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onLogout(); }}
                      className="cursor-pointer w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors duration-150"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign out
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
