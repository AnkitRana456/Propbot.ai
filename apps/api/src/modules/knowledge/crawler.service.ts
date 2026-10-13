import type { CrawlConfig } from '@propbot/shared';
import { parserService } from './parser.service.js';

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  byteSize: number;
}

export class CrawlerService {
  /**
   * Crawls a starting URL with depth, page count, and same-domain limits
   */
  async crawlUrl(startUrl: string, config?: CrawlConfig): Promise<CrawlResult[]> {
    const parsedOrigin = new URL(startUrl).origin;
    const maxPages = config?.maxPages ?? 10;
    const results: CrawlResult[] = [];
    const visited = new Set<string>();
    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 1 }];

    while (queue.length > 0 && results.length < maxPages) {
      const item = queue.shift();
      if (!item) break;

      const currentUrl = item.url;
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(currentUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'PropBotPro-Crawler/1.0 (+https://propbotpro.com)',
          },
        });
        clearTimeout(timeout);

        if (!response.ok) continue;

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
          continue;
        }

        const rawHtml = await response.text();
        const cleanContent = parserService.parseHtml(rawHtml);

        // Extract title
        const titleMatch = rawHtml.match(/<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : currentUrl;

        if (cleanContent.length > 50) {
          results.push({
            url: currentUrl,
            title,
            content: cleanContent,
            byteSize: Buffer.byteLength(cleanContent, 'utf-8'),
          });
        }

        // Discover child links if depth allows
        if (item.depth < (config?.maxDepth ?? 2)) {
          const linkRegex = /href=["'](https?:\/\/[^"']+|\/[^"']+)["']/gi;
          let match: RegExpExecArray | null;

          while ((match = linkRegex.exec(rawHtml)) !== null) {
            const rawHref = match[1];
            if (!rawHref) continue;

            try {
              const resolved = new URL(rawHref, currentUrl).toString();
              const resolvedUrl = new URL(resolved);

              // Check domain restriction
              if (config?.sameDomainOnly !== false && resolvedUrl.origin !== parsedOrigin) {
                continue;
              }

              // Filter out static asset links
              if (/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ico|mp4)$/i.test(resolvedUrl.pathname)) {
                continue;
              }

              if (!visited.has(resolved) && results.length + queue.length < maxPages) {
                queue.push({ url: resolved, depth: item.depth + 1 });
              }
            } catch {
              // skip invalid links
            }
          }
        }
      } catch (err: unknown) {
        // Network timeout or blocked by target host
        console.warn(`[Crawler] Failed to fetch ${currentUrl}:`, err instanceof Error ? err.message : err);
      }
    }

    return results;
  }
}

export const crawlerService = new CrawlerService();
