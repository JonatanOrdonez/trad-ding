import YahooFinance from "yahoo-finance2";
import { supabase, type DbAsset, type DbAssetNews } from "./supabase";

const yf = new YahooFinance();

// ── Text serialization (must match Python's to_text() format) ─────────────────

function yfinanceNewsToText(content: Record<string, unknown>): string {
  const parts: string[] = [];
  const title = (content.title as string) || "";
  const pubDate = (content.pubDate as string) || "";
  // publisher: new yahoo-finance2 format; provider.displayName: old Python yfinance format
  const source =
    (content.publisher as string) ||
    ((content.provider as Record<string, string>)?.displayName) ||
    "";
  const summary = (content.summary as string) || "";
  // link: new yahoo-finance2 format; canonicalUrl.url: old Python yfinance format
  const url =
    (content.link as string) ||
    ((content.canonicalUrl as Record<string, string>)?.url) ||
    "";

  parts.push(`Title: ${title}`);
  if (pubDate) parts.push(`Date: ${pubDate}`);
  if (source) parts.push(`Source: ${source}`);
  if (summary) parts.push(`Summary: ${summary}`);
  if (url) parts.push(`URL: ${url}`);
  return parts.join(" | ");
}

function newsApiToText(content: Record<string, unknown>): string {
  const parts: string[] = [];
  const title = (content.title as string) || "";
  const publishedAt = (content.publishedAt as string) || "";
  const source = ((content.source as Record<string, string>)?.name) || "";
  const description = (content.description as string) || "";
  const url = (content.url as string) || "";

  parts.push(`Title: ${title}`);
  if (publishedAt) parts.push(`Date: ${publishedAt}`);
  if (source) parts.push(`Source: ${source}`);
  if (description) parts.push(`Summary: ${description}`);
  if (url) parts.push(`URL: ${url}`);
  return parts.join(" | ");
}

export function newsItemToText(item: DbAssetNews): string {
  if (item.source_type === "yfinance") return yfinanceNewsToText(item.content);
  if (item.source_type === "newsapi") return newsApiToText(item.content);
  return "";
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function contentIdExists(contentId: string): Promise<boolean> {
  const { data } = await supabase
    .from("asset_news")
    .select("id")
    .eq("content_id", contentId)
    .maybeSingle();
  return data !== null;
}

async function insertNewsItem(
  assetId: string | null,
  contentId: string,
  sourceType: "yfinance" | "newsapi",
  content: Record<string, unknown>
): Promise<void> {
  await supabase.from("asset_news").insert({
    asset_id: assetId,
    content_id: contentId,
    source_type: sourceType,
    content,
  });
}

// ── Yahoo Finance news sync ───────────────────────────────────────────────────

type YahooNewsItem = {
  uuid: string;
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: Date | number;
};

export async function syncYahooNewsForAsset(asset: DbAsset): Promise<void> {
  let news: YahooNewsItem[] = [];
  try {
    const result = await yf.search(asset.yfinance_symbol, {
      newsCount: 20,
      quotesCount: 0,
    });
    news = (result.news ?? []) as YahooNewsItem[];
  } catch {
    return;
  }

  for (const item of news) {
    const contentId = item.uuid;
    if (!contentId) continue;
    if (await contentIdExists(contentId)) continue;

    await insertNewsItem(asset.id, contentId, "yfinance", {
      uuid: item.uuid,
      title: item.title ?? "",
      publisher: item.publisher ?? "",
      link: item.link ?? "",
      pubDate: item.providerPublishTime
        ? new Date(item.providerPublishTime).toISOString()
        : "",
      summary: "",
    });
  }
}

// ── NewsAPI world news sync ───────────────────────────────────────────────────

async function syncWorldNews(): Promise<void> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return;

  let articles: Record<string, unknown>[] = [];
  try {
    const res = await fetch(
      `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=20&apiKey=${apiKey}`
    );
    const json = (await res.json()) as { articles?: Record<string, unknown>[] };
    articles = json.articles ?? [];
  } catch {
    return;
  }

  for (const article of articles) {
    const contentId = article.url as string;
    if (!contentId) continue;
    if (await contentIdExists(contentId)) continue;
    await insertNewsItem(null, contentId, "newsapi", article);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function syncAllNews(): Promise<void> {
  const { data: assets } = await supabase.from("assets").select("*");
  if (!assets) return;

  await Promise.all([
    ...assets.map((a: DbAsset) => syncYahooNewsForAsset(a)),
    syncWorldNews(),
  ]);
}

export async function getNewsBySymbol(
  symbol: string,
  offset = 0,
  limit = 20
): Promise<DbAssetNews[]> {
  const { data: asset } = await supabase
    .from("assets")
    .select("id, yfinance_symbol")
    .eq("symbol", symbol)
    .maybeSingle();

  if (!asset) throw new Error(`Asset '${symbol}' not found`);

  // If no news in DB, do a quick sync first
  const { data: existing } = await supabase
    .from("asset_news")
    .select("id")
    .eq("asset_id", asset.id)
    .limit(1);

  if (!existing || existing.length === 0) {
    await syncYahooNewsForAsset(asset as DbAsset);
  }

  const { data } = await supabase
    .from("asset_news")
    .select("*")
    .eq("asset_id", asset.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return (data ?? []) as DbAssetNews[];
}

export async function getGeneralNews(offset = 0, limit = 5): Promise<DbAssetNews[]> {
  const { data } = await supabase
    .from("asset_news")
    .select("*")
    .is("asset_id", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return (data ?? []) as DbAssetNews[];
}
