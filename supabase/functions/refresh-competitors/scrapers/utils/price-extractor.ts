/**
 * PRICE EXTRACTOR
 * 
 * This utility tries multiple methods to extract product prices from HTML:
 * 1. JSON-LD structured data (most reliable)
 * 2. OpenGraph meta tags
 * 3. CSS selectors (as fallback)
 * 
 * It's designed to work on ANY e-commerce site.
 */

import { ScrapedProduct } from '../types.ts';

export class PriceExtractor {
  /**
   * Extract product data using JSON-LD (structured data)
   * 
   * JSON-LD is a standardized format that many e-commerce sites use
   * to help search engines understand their products.
   * 
   * Example JSON-LD:
   * <script type="application/ld+json">
   * {
   *   "@type": "Product",
   *   "name": "iPhone 15 Pro",
   *   "offers": {
   *     "price": "3999",
   *     "priceCurrency": "SAR"
   *   }
   * }
   * </script>
   */
  static extractFromJsonLd(html: string, marketplace: string): ScrapedProduct | null {
    try {
      // Find all JSON-LD script tags
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      
      if (!jsonLdMatches) {
        return null;
      }
      
      // Try each JSON-LD block
      for (const match of jsonLdMatches) {
        try {
          // Extract JSON content
          const jsonContent = match
            .replace(/<script[^>]*>/i, '')
            .replace(/<\/script>/i, '')
            .trim();
          
          const data = JSON.parse(jsonContent);
          
          // Handle single Product
          if (data['@type'] === 'Product') {
            const product = this.parseJsonLdProduct(data, marketplace);
            if (product) return product;
          }
          
          // Handle @graph array
          if (data['@graph'] && Array.isArray(data['@graph'])) {
            const productData = data['@graph'].find((item: any) => item['@type'] === 'Product');
            if (productData) {
              const product = this.parseJsonLdProduct(productData, marketplace);
              if (product) return product;
            }
          }
          
          // Handle array of items
          if (Array.isArray(data)) {
            const productData = data.find((item: any) => item['@type'] === 'Product');
            if (productData) {
              const product = this.parseJsonLdProduct(productData, marketplace);
              if (product) return product;
            }
          }
          
        } catch (e) {
          // Continue to next JSON-LD block
          continue;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('[Price Extractor] Error parsing JSON-LD:', error);
      return null;
    }
  }
  
  /**
   * Parse a JSON-LD Product object into our ScrapedProduct format
   */
  private static parseJsonLdProduct(data: any, marketplace: string): ScrapedProduct | null {
    const offers = data.offers;
    if (!offers) return null;
    
    // Get price (could be in different places)
    const price = offers.price || offers[0]?.price || offers.lowPrice;
    const currency = offers.priceCurrency || offers[0]?.priceCurrency || 'SAR';
    const name = data.name;
    const url = data.url || offers.url;
    const image = data.image;
    const availability = offers.availability;
    
    // Validate we have minimum required data
    if (!name || !price) {
      return null;
    }
    
    // Parse price to number
    const priceNum = parseFloat(String(price).replace(/[^0-9.]/g, ''));
    
    if (isNaN(priceNum) || priceNum <= 0) {
      return null;
    }
    
    console.log(`   ✅ JSON-LD found: "${name.slice(0, 50)}..." @ ${priceNum} ${currency}`);
    
    return {
      name,
      price: priceNum,
      currency,
      url,
      imageUrl: image,
      availability: this.normalizeAvailability(availability),
      extractionMethod: 'json-ld',
      marketplace,
    };
  }
  
  /**
   * Extract product data using OpenGraph meta tags
   * 
   * OpenGraph is used by social media to show rich previews.
   * Many e-commerce sites include price in OG tags.
   * 
   * Example:
   * <meta property="og:price:amount" content="3999" />
   * <meta property="og:price:currency" content="SAR" />
   */
  static extractFromOpenGraph(html: string, marketplace: string): ScrapedProduct | null {
    try {
      // Extract price
      const priceMatch = html.match(/<meta[^>]*property=["'](?:og:price:amount|product:price:amount)["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og:price:amount|product:price:amount)["']/i);
      
      if (!priceMatch) {
        return null;
      }
      
      // Extract currency
      const currencyMatch = html.match(/<meta[^>]*property=["'](?:og:price:currency|product:price:currency)["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og:price:currency|product:price:currency)["']/i);
      
      // Extract title
      const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      
      // Extract image
      const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      
      // Extract URL
      const urlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:url["']/i);
      
      // Parse price
      const price = parseFloat(priceMatch[1].replace(/[^0-9.]/g, ''));
      
      if (isNaN(price) || price <= 0) {
        return null;
      }
      
      const name = titleMatch?.[1] || 'Unknown Product';
      const currency = currencyMatch?.[1] || 'SAR';
      
      console.log(`   ✅ OpenGraph found: "${name.slice(0, 50)}..." @ ${price} ${currency}`);
      
      return {
        name,
        price,
        currency,
        url: urlMatch?.[1],
        imageUrl: imageMatch?.[1],
        extractionMethod: 'opengraph',
        marketplace,
      };
      
    } catch (error) {
      console.error('[Price Extractor] Error parsing OpenGraph:', error);
      return null;
    }
  }
  
  /**
   * Extract price using CSS selectors
   * 
   * This is the fallback method when structured data isn't available.
   * We search for common price patterns in the HTML.
   */
  static extractFromCssSelectors(
    html: string,
    selectors: string[],
    marketplace: string
  ): number | null {
    try {
      // Try each selector
      for (const selector of selectors) {
        // Simple regex-based selector matching
        // Note: For production, you'd want a proper HTML parser
        const pattern = this.selectorToRegex(selector);
        const matches = html.match(pattern);
        
        if (matches) {
          for (const match of matches) {
            // Extract numbers from the matched text
            const priceText = match.replace(/<[^>]*>/g, '').trim();
            const priceMatch = priceText.match(/[\d,]+\.?\d*/);
            
            if (priceMatch) {
              const price = parseFloat(priceMatch[0].replace(/,/g, ''));
              
              // Validate price is reasonable
              if (!isNaN(price) && price > 0 && price < 1000000) {
                console.log(`   ✅ CSS selector found price: ${price} SAR (selector: ${selector})`);
                return price;
              }
            }
          }
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('[Price Extractor] Error with CSS selectors:', error);
      return null;
    }
  }
  
  /**
   * Convert a simple CSS selector to regex
   * This is a simplified version - for production use a proper HTML parser
   */
  private static selectorToRegex(selector: string): RegExp {
    // Handle class selectors
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      return new RegExp(`class=["'][^"']*${className}[^"']*["'][^>]*>([^<]+)`, 'gi');
    }
    
    // Handle ID selectors
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return new RegExp(`id=["']${id}["'][^>]*>([^<]+)`, 'gi');
    }
    
    // Handle tag selectors
    return new RegExp(`<${selector}[^>]*>([^<]+)<\/${selector}>`, 'gi');
  }
  
  /**
   * Normalize availability status
   */
  private static normalizeAvailability(availability: string | undefined): ScrapedProduct['availability'] {
    if (!availability) return 'unknown';
    
    const lower = availability.toLowerCase();
    
    if (lower.includes('instock') || lower.includes('in stock')) {
      return 'in_stock';
    }
    if (lower.includes('outofstock') || lower.includes('out of stock')) {
      return 'out_of_stock';
    }
    if (lower.includes('preorder') || lower.includes('pre-order')) {
      return 'pre_order';
    }
    
    return 'unknown';
  }
  


  /**
   * Extract products captured directly from live DOM by BrowserScraperV2.
   */
  static extractFromEmbeddedDomProducts(html: string, marketplace: string): ScrapedProduct[] {
    try {
      const domMatch = html.match(/<script[^>]*id=["']__SCRAPER_DOM_PRODUCTS__["'][^>]*>([\s\S]*?)<\/script>/i);
      if (!domMatch?.[1]) {
        return [];
      }

      const rawItems = JSON.parse(domMatch[1]) as Array<{ name?: string; price?: number; url?: string }>;
      const products: ScrapedProduct[] = [];

      for (const item of rawItems.slice(0, 80)) {
        const name = (item.name || '').trim();
        const price = Number(item.price);

        if (!name || name.length < 4 || !isFinite(price) || price <= 0) {
          continue;
        }

        products.push({
          name,
          price,
          currency: 'SAR',
          url: item.url,
          marketplace,
          extractionMethod: 'css-selector',
        });
      }

      const dedup = new Map<string, ScrapedProduct>();
      for (const product of products) {
        const key = `${product.name.toLowerCase()}::${product.price}`;
        if (!dedup.has(key)) {
          dedup.set(key, product);
        }
      }

      return [...dedup.values()];
    } catch (error) {
      console.error('[Price Extractor] Error parsing embedded DOM products:', error);
      return [];
    }
  }

  /**
   * Extract product candidates from API payloads embedded by BrowserScraperV2.
   * BrowserScraperV2 appends JSON responses in #__SCRAPER_API_PAYLOADS__.
   */
  static extractFromEmbeddedApiPayloads(html: string, marketplace: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    try {
      const payloadMatch = html.match(/<script[^>]*id=["']__SCRAPER_API_PAYLOADS__["'][^>]*>([\s\S]*?)<\/script>/i);
      if (!payloadMatch?.[1]) {
        return products;
      }

      const payloadItems = JSON.parse(payloadMatch[1]) as Array<string | { url?: string; payload?: string }>;

      for (const item of payloadItems.slice(0, 40)) {
        const payload = typeof item === 'string' ? item : item?.payload;
        if (!payload || payload.length < 2) {
          continue;
        }

        try {
          const data = JSON.parse(payload);
          this.collectProductsFromApiObject(data, marketplace, products);
        } catch {
          // Ignore payloads that are not valid JSON.
        }
      }

      // Fallback: inspect JSON script blocks directly in HTML (e.g., app state blobs).
      const scriptJsonBlocks = html.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const block of scriptJsonBlocks.slice(0, 30)) {
        try {
          const jsonText = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
          if (jsonText.length < 5) {
            continue;
          }
          const data = JSON.parse(jsonText);
          this.collectProductsFromApiObject(data, marketplace, products);
        } catch {
          // Ignore non-JSON script blocks.
        }
      }

      // Deduplicate by name+price to avoid noisy payload repetitions.
      const deduped = new Map<string, ScrapedProduct>();
      for (const product of products) {
        const key = `${product.name.toLowerCase()}::${product.price}`;
        if (!deduped.has(key)) {
          deduped.set(key, product);
        }
      }

      return [...deduped.values()];
    } catch (error) {
      console.error('[Price Extractor] Error parsing embedded API payloads:', error);
      return [];
    }
  }

  private static collectProductsFromApiObject(
    value: unknown,
    marketplace: string,
    output: ScrapedProduct[]
  ): void {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectProductsFromApiObject(item, marketplace, output);
      }
      return;
    }

    const record = value as Record<string, unknown>;
    const nameCandidate =
      record.name ||
      record.title ||
      record.product_name ||
      record.productName ||
      record.display_name ||
      record.label;

    const priceCandidate =
      record.price ??
      record.final_price ??
      record.special_price ??
      record.sale_price ??
      record.regular_price ??
      record.min_price ??
      record.max_price ??
      record.amount ??
      record.value;

    if (typeof nameCandidate === 'string' && nameCandidate.trim().length > 2 && priceCandidate !== undefined) {
      const numericPrice = parseFloat(String(priceCandidate).replace(/[^0-9.]/g, ''));
      if (!isNaN(numericPrice) && numericPrice > 0) {
        output.push({
          name: nameCandidate.trim(),
          price: numericPrice,
          currency: typeof record.currency === 'string' ? record.currency : 'SAR',
          marketplace,
          extractionMethod: 'api',
        });
      }
    }

    for (const nested of Object.values(record)) {
      if (nested && typeof nested === 'object') {
        this.collectProductsFromApiObject(nested, marketplace, output);
      }
    }
  }

  /**
   * Validate scraped price is reasonable
   */
  static validatePrice(price: number, baselinePrice?: number): boolean {
    // Price must be positive
    if (price <= 0) return false;
    
    // Price must be less than 1 million SAR (sanity check)
    if (price > 1000000) return false;
    
    // If we have a baseline, price shouldn't be ridiculously different
    if (baselinePrice) {
      const ratio = price / baselinePrice;
      
      // Price shouldn't be less than 10% or more than 1000% of baseline
      if (ratio < 0.1 || ratio > 10) {
        console.warn(`   ⚠️ Suspicious price: ${price} SAR (baseline: ${baselinePrice} SAR, ratio: ${ratio.toFixed(2)})`);
        return false;
      }
    }
    
    return true;
  }
}