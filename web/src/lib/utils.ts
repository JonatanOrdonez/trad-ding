import type { LocalAnalysis } from "@/types/asset";
import type { Signal } from "@/types/analysis";
import type { ParsedNews } from "@/types/news";

const LS_PREFIX = "td_analysis_";

// ── localStorage helpers ──────────────────────────────────────────────────────

export function loadAnalysis(symbol: string): LocalAnalysis | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${symbol}`);
    if (!raw) return null;
    return JSON.parse(raw) as LocalAnalysis;
  } catch {
    return null;
  }
}

export function saveAnalysis(symbol: string, action: Signal, score?: number): void {
  if (typeof window === "undefined") return;
  const data: LocalAnalysis = { action, ts: Date.now(), ...(score !== undefined && { score }) };
  localStorage.setItem(`${LS_PREFIX}${symbol}`, JSON.stringify(data));
}

export function removeAnalysis(symbol: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${LS_PREFIX}${symbol}`);
}

// ── Score → bar percentage (-1..+1 → 0..100) ──────────────────────────────────

export function scoreToPct(score: number): number {
  return Math.round(((score + 1) / 2) * 100);
}

// ── Relative time ─────────────────────────────────────────────────────────────

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── News raw string parser ────────────────────────────────────────────────────
// Format: "Title: <t> | Date: <d> | Source: <s> | Summary: <text> | URL: <url>"

export function parseNewsRaw(raw: string): ParsedNews {
  const result: ParsedNews = { title: "", date: "", source: "", summary: "", url: "" };
  if (!raw) return result;

  const parts = raw.split(" | ");
  for (const part of parts) {
    const idx = part.indexOf(": ");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 2).trim();
    if (key === "title") result.title = val;
    else if (key === "date") result.date = val;
    else if (key === "source") result.source = val;
    else if (key === "summary") result.summary = val;
    else if (key === "url") result.url = val;
  }
  return result;
}

// ── News date formatter ───────────────────────────────────────────────────────

export function fmtNewsDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
