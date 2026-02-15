/**
 * JARIR CONNECTOR (Browser Version)
 * 
 * This version uses Puppeteer browser scraping instead of simple HTTP.
 * Works reliably even with anti-bot protection.
 */

import { MarketplaceConnector, ScrapedProduct, ScraperTransport } from '../types.ts';
import { PriceExtractor } from '../utils/price-extractor.ts';

export class JarirBrowserConnector implements MarketplaceConnector {
  name = 'Jarir (Browser)';
  
  private baseUrl = 'https://www.jarir.com';
  private searchUrl = 'https://www.jarir.com/sa-en/catalogsearch/result/?q=';
  
  constructor(private scraper: ScraperTransport) {}
  
  /**
   * Search for products on Jarir using browser scraping
   */
  async searchProduct(productName: string): Promise<ScrapedProduct[]> {
    try {
      console.log(`[Jarir Browser] Searching for: "${productName}"`);
      
      // Build search URL
      const query = encodeURIComponent(productName);
      const url = `${this.searchUrl}${query}`;
      
      console.log(`[Jarir Browser] URL: ${url}`);
      
      // Fetch with browser (wait for products to load)
      const html = await this.scraper.fetch(url, {
        timeout: 30000,
        waitForSelector: '.product-item, .product-item-info, [data-price-amount], [class*=price], [class*=product]',
        additionalWait: 8000,  // Extra wait for dynamic content
      });
      
      console.log(`[Jarir Browser] Got HTML (${html.length} chars), extracting...`);
      
      const products: ScrapedProduct[] = [];
      
      // Try JSON-LD first (most reliable)
      const jsonLdProduct = PriceExtractor.extractFromJsonLd(html, 'Jarir');
      if (jsonLdProduct) {
        products.push(jsonLdProduct);
        console.log(`[Jarir Browser] ✅ JSON-LD: ${jsonLdProduct.name} - ${jsonLdProduct.price} SAR`);
      }
      
      // Try OpenGraph
      if (products.length === 0) {
        const ogProduct = PriceExtractor.extractFromOpenGraph(html, 'Jarir');
        if (ogProduct) {
          products.push(ogProduct);
          console.log(`[Jarir Browser] ✅ OpenGraph: ${ogProduct.name} - ${ogProduct.price} SAR`);
        }
      }
      
      // Extract from embedded API payloads captured at browser network layer
      if (products.length === 0) {
        const apiProducts = PriceExtractor.extractFromEmbeddedApiPayloads(html, 'Jarir');
        products.push(...apiProducts);
        console.log(`[Jarir Browser] ✅ Found ${apiProducts.length} from API payloads`);
      }

      // Extract from product JSON attributes / script state in HTML
      if (products.length === 0) {
        const stateProducts = this.extractFromProductJsonAttributes(html);
        products.push(...stateProducts);
        console.log(`[Jarir Browser] ✅ Found ${stateProducts.length} from HTML JSON blocks`);
      }

      // Extract from search results HTML
      if (products.length === 0) {
        const searchResults = this.extractFromSearchResults(html);
        products.push(...searchResults);
        console.log(`[Jarir Browser] ✅ Found ${searchResults.length} from search results`);
      }
      
      // Filter and validate
      const validProducts = products.filter(p => {
        const isValid = p.price > 0 && p.name && p.name.length > 3;
        if (!isValid) {
          console.log(`[Jarir Browser] ⚠️ Filtered invalid: ${p.name} - ${p.price}`);
        }
        return isValid;
      });
      
      console.log(`[Jarir Browser] Final: ${validProducts.length} valid products`);
      
      return validProducts;
      
    } catch (error) {
      console.error(`[Jarir Browser] ❌ Error:`, error);
      throw error;
    }
  }
  

  /**
   * Extract product cards from embedded JSON snippets in HTML attributes/scripts.
   */
  private extractFromProductJsonAttributes(html: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    try {
      const jsonCandidatePattern = /("name"\s*:\s*"[^"]{3,}"[\s\S]{0,240}?"(?:price|final_price|special_price|regular_price)"\s*:\s*"?\d[\d,.]*)/gi;
      const matches = [...html.matchAll(jsonCandidatePattern)];

      for (const match of matches.slice(0, 30)) {
        const snippet = `{${match[1]}}`;
        try {
          const data = JSON.parse(snippet);
          const name = String(data.name || '').trim();
          const priceRaw = data.price ?? data.final_price ?? data.special_price ?? data.regular_price;
          const price = parseFloat(String(priceRaw).replace(/[^0-9.]/g, ''));

          if (name.length > 3 && !isNaN(price) && price > 0) {
            products.push({
              name,
              price,
              currency: 'SAR',
              marketplace: 'Jarir',
              extractionMethod: 'api',
            });
          }
        } catch {
          // Ignore malformed snippets
        }
      }
    } catch (error) {
      console.error('[Jarir Browser] Error extracting HTML JSON blocks:', error);
    }

    return products;
  }

  /**
   * Extract products from search results page
   */
  private extractFromSearchResults(html: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];
    
    try {
      // Pattern for Magento product items
      const productPattern = /<li[^>]*class="[^"]*product-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
      const matches = [...html.matchAll(productPattern)];
      
      console.log(`[Jarir Browser] Found ${matches.length} product containers`);
      
      for (const match of matches.slice(0, 10)) {  // Limit to first 10
        const productHtml = match[1];
        
        // Extract product name
        const namePattern = /<a[^>]*class="[^"]*product-item-link[^"]*"[^>]*>([^<]+)<\/a>/i;
        const nameMatch = productHtml.match(namePattern);
        const name = nameMatch ? nameMatch[1].trim() : null;
        
        // Extract price - multiple methods
        let price = 0;
        
        // Method 1: data-price-amount attribute
        const priceAttr = productHtml.match(/data-price-amount="([^"]+)"/i);
        if (priceAttr) {
          price = parseFloat(priceAttr[1]);
        }
        
        // Method 2: price span
        if (price === 0) {
          const priceSpan = productHtml.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/i);
          if (priceSpan) {
            const priceText = priceSpan[1].replace(/[^0-9.]/g, '');
            price = parseFloat(priceText);
          }
        }
        
        // Extract URL
        const urlPattern = /<a[^>]*href="([^"]+)"[^>]*class="[^"]*product-item-link/i;
        const urlMatch = productHtml.match(urlPattern);
        let url = urlMatch ? urlMatch[1] : null;
        
        // Make URL absolute if needed
        if (url && !url.startsWith('http')) {
          url = this.baseUrl + url;
        }
        
        // Add if valid
        if (name && price > 0) {
          products.push({
            name,
            price,
            currency: 'SAR',
            url: url || undefined,
            marketplace: 'Jarir',
            extractionMethod: 'css-selector',
          });
        }
      }
      
    } catch (error) {
      console.error('[Jarir Browser] Error extracting search results:', error);
    }
    
    return products;
  }
  
  /**
   * Get product details from specific URL
   */
  async getProductDetails(url: string): Promise<ScrapedProduct | null> {
    try {
      console.log(`[Jarir Browser] Getting details: ${url}`);
      
      const html = await this.scraper.fetch(url, {
        timeout: 25000,
        additionalWait: 2000,
      });
      
      // Try JSON-LD (best for product pages)
      const product = PriceExtractor.extractFromJsonLd(html, 'Jarir');
      if (product) {
        product.url = url;
        return product;
      }
      
      // Try OpenGraph
      const ogProduct = PriceExtractor.extractFromOpenGraph(html, 'Jarir');
      if (ogProduct) {
        ogProduct.url = url;
        return ogProduct;
      }
      
      console.log('[Jarir Browser] ⚠️ Could not extract product details');
      return null;
      
    } catch (error) {
      console.error('[Jarir Browser] Error getting details:', error);
      return null;
    }
  }
}