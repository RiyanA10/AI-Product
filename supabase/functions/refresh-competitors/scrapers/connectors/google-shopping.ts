import { MarketplaceConnector, ScrapedProduct, ScraperTransport } from '../types.ts';

export class GoogleShoppingConnector implements MarketplaceConnector {
  name = 'Google Shopping';

  private searchUrl = 'https://www.google.com/search?tbm=shop&hl=en&gl=sa&q=';

  constructor(private scraper: ScraperTransport) {}

  async searchProduct(productName: string): Promise<ScrapedProduct[]> {
    const query = encodeURIComponent(productName);
    const url = `${this.searchUrl}${query}`;

    console.log(`[Google Shopping] Searching: ${url}`);

    const html = await this.scraper.fetch(url, {
      timeout: 35000,
      waitForSelector: 'a[href*="/shopping/product"], [class*="sh-dgr"], [class*="merchant"], [class*="price"]',
      additionalWait: 5000,
    });

    const products = this.extractFromGoogleShoppingHtml(html);
    console.log(`[Google Shopping] Found ${products.length} product(s)`);
    return products;
  }

  private extractFromGoogleShoppingHtml(html: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    const cardPattern = /<a[^>]*href="([^"]*\/shopping\/product[^"]*)"[^>]*>([\s\S]{0,400})<\/a>/gi;
    const cardMatches = [...html.matchAll(cardPattern)].slice(0, 120);

    for (const match of cardMatches) {
      const href = this.normalizeUrl(match[1]);
      const neighborhoodStart = Math.max(0, (match.index || 0) - 700);
      const neighborhoodEnd = Math.min(html.length, (match.index || 0) + 1400);
      const neighborhood = html.slice(neighborhoodStart, neighborhoodEnd);

      const title = this.extractTitle(match[2], neighborhood);
      const price = this.extractPrice(neighborhood);

      if (!title || title.length < 4 || !price || isNaN(price)) {
        continue;
      }

      products.push({
        name: title,
        price,
        currency: 'SAR',
        url: href,
        marketplace: 'Google Shopping',
        extractionMethod: 'css-selector',
      });
    }

    const deduped = new Map<string, ScrapedProduct>();
    for (const product of products) {
      const key = `${product.name.toLowerCase()}::${product.price}`;
      if (!deduped.has(key)) {
        deduped.set(key, product);
      }
    }

    return [...deduped.values()].slice(0, 30);
  }

  private extractTitle(anchorHtml: string, neighborhood: string): string | null {
    const fromAnchor = this.stripTags(anchorHtml).trim();
    if (fromAnchor.length > 4) {
      return fromAnchor;
    }

    const fallback = neighborhood.match(/"(?:title|name)"\s*:\s*"([^"]{4,160})"/i)?.[1];
    if (fallback) {
      return this.decodeEntities(fallback).trim();
    }

    return null;
  }

  private extractPrice(neighborhood: string): number | null {
    const patterns = [
      /(?:SAR|ر\.س|SR)\s*([0-9][0-9,.]*)/i,
      /([0-9][0-9,.]*)\s*(?:SAR|ر\.س|SR)/i,
      /"(?:price|final_price|min_price|amount)"\s*:\s*"?([0-9][0-9,.]*)"?/i,
    ];

    for (const pattern of patterns) {
      const hit = neighborhood.match(pattern);
      if (hit?.[1]) {
        const value = parseFloat(hit[1].replace(/,/g, ''));
        if (!isNaN(value) && value > 0) {
          return value;
        }
      }
    }

    return null;
  }

  private normalizeUrl(raw: string): string {
    if (!raw) return 'https://www.google.com';

    const decoded = this.decodeEntities(raw);

    if (decoded.startsWith('http')) {
      return decoded;
    }

    if (decoded.startsWith('/')) {
      return `https://www.google.com${decoded}`;
    }

    return `https://www.google.com/${decoded}`;
  }

  private stripTags(input: string): string {
    return this.decodeEntities(input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
  }

  private decodeEntities(input: string): string {
    return input
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
}
