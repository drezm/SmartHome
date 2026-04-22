import { XMLParser } from "fast-xml-parser";
import { env } from "../config/env.js";
import type { NewsItem } from "../domain/types.js";

const CACHE_TTL_MS = 30 * 60 * 1000;

type CacheState = {
  expiresAt: number;
  items: NewsItem[];
};

export class NewsService {
  private cache: CacheState = { expiresAt: 0, items: [] };
  private readonly parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

  async listItNews(): Promise<NewsItem[]> {
    if (Date.now() < this.cache.expiresAt) {
      return this.cache.items;
    }

    try {
      const urls = env.NEWS_RSS_FEEDS.split(",").map((item) => item.trim()).filter(Boolean);
      const batches = await Promise.all(urls.map((url) => this.fetchFeed(url)));
      const items = batches
        .flat()
        .sort((left, right) => new Date(right.publishedAt ?? 0).getTime() - new Date(left.publishedAt ?? 0).getTime())
        .slice(0, 8);
      this.cache = { expiresAt: Date.now() + CACHE_TTL_MS, items };
      return items;
    } catch {
      this.cache = { expiresAt: Date.now() + 5 * 60 * 1000, items: [] };
      return [];
    }
  }

  private async fetchFeed(url: string): Promise<NewsItem[]> {
    const response = await fetch(url, { headers: { "User-Agent": "SmartHome/1.0" } });
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const parsed = this.parser.parse(xml);
    const channel = parsed.rss?.channel ?? parsed.feed;
    const source = asText(channel?.title) || new URL(url).hostname;
    const rawItems = normalizeArray(channel?.item ?? channel?.entry).slice(0, 8);

    return rawItems
      .map((item, index) => {
        const link = asLink(item.link);
        const title = asText(item.title);
        if (!title || !link) {
          return null;
        }

        return {
          id: `${source}-${index}-${link}`,
          title,
          source,
          url: link,
          publishedAt: asText(item.pubDate ?? item.published ?? item.updated) || null
        } satisfies NewsItem;
      })
      .filter((item): item is NewsItem => Boolean(item));
  }
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in value) return String((value as { "#text": unknown })["#text"]).trim();
  return "";
}

function asLink(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return asLink(value[0]);
  if (value && typeof value === "object") {
    const link = value as { href?: unknown; "#text"?: unknown };
    return String(link.href ?? link["#text"] ?? "").trim();
  }
  return "";
}
