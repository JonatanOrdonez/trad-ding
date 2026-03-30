"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { UsersTab } from "@/components/admin/UsersTab";
import { AssetsTab } from "@/components/admin/AssetsTab";
import { NewsTab } from "@/components/admin/NewsTab";
import { ModelsTab } from "@/components/admin/ModelsTab";

type Tab = "users" | "assets" | "news" | "models";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "users", label: "Users", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2m22-4a4 4 0 01-4 4H9a4 4 0 01-4-4V3" },
  { key: "assets", label: "Assets", icon: "" },
  { key: "news", label: "News", icon: "" },
  { key: "models", label: "Models", icon: "" },
];

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="cursor-pointer lg:hidden flex items-center justify-center w-9 h-9 min-h-[44px] rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <svg className="w-6 h-6 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <span className="text-base font-semibold tracking-tight">Admin Panel</span>
          </div>
        </div>
        <a href="/" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
          Back to Dashboard
        </a>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-10 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-20 w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transform transition-transform duration-200 lg:transform-none lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          pt-16 lg:pt-0
        `}>
          <nav className="flex flex-col py-4 px-3 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
                className={`cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 min-h-[40px] ${
                  activeTab === tab.key
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {tab.key === "users" && (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                )}
                {tab.key === "assets" && (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                )}
                {tab.key === "news" && (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                  </svg>
                )}
                {tab.key === "models" && (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                )}
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-xl font-bold mb-6 capitalize">{activeTab}</h1>
          {activeTab === "users" && <UsersTab />}
          {activeTab === "assets" && <AssetsTab />}
          {activeTab === "news" && <NewsTab />}
          {activeTab === "models" && <ModelsTab />}
        </main>
      </div>
    </div>
  );
}
