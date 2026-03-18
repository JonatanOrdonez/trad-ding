// News types

export interface NewsItem {
  summary: string;
  source_type?: string;
  [key: string]: unknown;
}

export interface NewsResponse {
  news: NewsItem[];
}

export interface ParsedNews {
  title: string;
  date: string;
  source: string;
  summary: string;
  url: string;
}

export interface SyncResponse {
  message: string;
}
