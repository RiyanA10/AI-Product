/**
 * JARIR CONNECTOR
 * 
 * This connector knows how to scrape Jarir.com (https://www.jarir.com)
 * Jarir is a Saudi bookstore that also sells electronics.
 * 
 * It's a good "beginner" marketplace because:
 * - Less aggressive anti-bot protection
 * - Uses Magento (standard e-commerce platform)
 * - Has JSON-LD structured data
 * - Works well with simple HTTP scraping
 */

import { MarketplaceConnector, ScrapedProduct, ScraperTransport } from '../types.ts';
import { PriceExtractor } from '../utils/price-extractor.ts';

export class JarirConnector implements MarketplaceConnector {
  name = 'Jarir';
  
  // Base URLs
  private baseUrl = 'https://www.jarir.com';
  private searchUrl = 'https://www.jarir.com/sa-en/catalogsearch/result/?q=';
  
  // CSS selectors for Jarir's HTML structure
  // Jarir uses Magento, which has standard selectors
  private selectors = {
    // Product containers (each product card)
    containers: [
      '.product-items .product-item',      // Standard Magento
      '.products.list .product-item',
      'li.product-item',
      'div.product-item-info',
    ],
    
    // Product name/title
    productName: [
      '.product-item-link',                // Magento standard
      'a.product-item-link',
      '.product-name a',
      'h2.product-name',
    ],
    
    // Price
    price: [
      '.price',                            // Magento standard
      'span.price',
      '.price-box .price',
      '[data-price-type="finalPrice"]',
    ],
  };
  
  constructor(private scraper: ScraperTransport) {}
  
  /**
   * Search for a product on Jarir
   * 
   * @param productName - What to search for (e.g., "iPhone 15 Pro")
   * @returns Array of products found
   */
  async searchProduct(productName: string): Promise<ScrapedProduct[]> {
    try {
      console.log(`[Jarir] Searching for: "${productName}"`);
      
      // Build search URL
      // Replace spaces with + for URL
      const query = encodeURIComponent(productName);
      const url = `${this.searchUrl}${query}`;
      
      console.log(`[Jarir] URL: ${url}`);
      
      // Fetch the search results page
      const html = await this.scraper.fetch(url, {
        timeout: 25000,  // 25 seconds
        waitForSelector: '.product-item, .product-price',
      });
      
      console.log(`[Jarir] Got HTML (${html.length} chars), extracting products...`);
      
      // Try multiple extraction methods
      const products: ScrapedProduct[] = [];
      
      // Method 1: JSON-LD (most reliable)
      const jsonLdProduct = PriceExtractor.extractFromJsonLd(html, 'Jarir');
      if (jsonLdProduct) {
        products.push(jsonLdProduct);
        console.log(`[Jarir] ✅ Found via JSON-LD: ${jsonLdProduct.name} - ${jsonLdProduct.price} SAR`);
      }
      
      // Method 2: OpenGraph (fallback)
      if (products.length === 0) {
        const ogProduct = PriceExtractor.extractFromOpenGraph(html, 'Jarir');
        if (ogProduct) {
          products.push(ogProduct);
          console.log(`[Jarir] ✅ Found via OpenGraph: ${ogProduct.name} - ${ogProduct.price} SAR`);
        }
      }
      
      // Method 3: CSS Selectors (last resort)
      if (products.length === 0) {
        const cssProducts = this.extractProductsFromHtml(html);
        products.push(...cssProducts);
        console.log(`[Jarir] ✅ Found ${cssProducts.length} products via CSS selectors`);
      }
      
      // Filter out invalid products
      const validProducts = products.filter(p => 
        p.price > 0 && 
        p.name && 
        p.name.length > 3
      );
      
      console.log(`[Jarir] Final result: ${validProducts.length} valid products`);
      
      return validProducts;
      
    } catch (error) {
      console.error(`[Jarir] Error searching:`, error);
      throw error;
    }
  }
  
  /**
   * Extract products from HTML using CSS selectors
   * This is a fallback when JSON-LD isn't available
   */
  private extractProductsFromHtml(html: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];
    
    try {
      // This is a simplified version
      // For production, you'd use a proper HTML parser like cheerio or jsdom
      
      // Find product containers
      const containerPattern = /<li[^>]*class="[^"]*product-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
      const containers = [...html.matchAll(containerPattern)];
      
      console.log(`[Jarir] Found ${containers.length} product containers`);
      
      for (const container of containers) {
        const productHtml = container[1];
        
        // Extract product name
        const nameMatch = productHtml.match(/<a[^>]*class="[^"]*product-item-link[^"]*"[^>]*>([^<]+)<\/a>/i);
        const name = nameMatch ? nameMatch[1].trim() : null;
        
        // Extract price
        const priceMatch = productHtml.match(/data-price-amount="([^"]+)"/i) ||
                          productHtml.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/i);
        
        let price = 0;
        if (priceMatch) {
          const priceText = priceMatch[1].replace(/[^0-9.]/g, '');
          price = parseFloat(priceText);
        }
        
        // Extract URL
        const urlMatch = productHtml.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*product-item-link/i);
        const url = urlMatch ? urlMatch[1] : null;
        
        // Validate and add product
        if (name && price > 0) {
          products.push({
            name,
            price,
            currency: 'SAR',
            url: url ? (url.startsWith('http') ? url : this.baseUrl + url) : undefined,
            marketplace: 'Jarir',
            extractionMethod: 'css-selector',
          });
        }
      }
      
    } catch (error) {
      console.error('[Jarir] Error extracting products from HTML:', error);
    }
    
    return products;
  }
  
  /**
   * Get detailed product information from a specific URL
   * This is useful if you already have a Jarir product link
   */
  async getProductDetails(url: string): Promise<ScrapedProduct | null> {
    try {
      console.log(`[Jarir] Getting product details from: ${url}`);
      
      const html = await this.scraper.fetch(url, {
        timeout: 20000,
      });
      
      // Try JSON-LD first (most reliable for product pages)
      const jsonLdProduct = PriceExtractor.extractFromJsonLd(html, 'Jarir');
      if (jsonLdProduct) {
        jsonLdProduct.url = url;
        return jsonLdProduct;
      }
      
      // Try OpenGraph
      const ogProduct = PriceExtractor.extractFromOpenGraph(html, 'Jarir');
      if (ogProduct) {
        ogProduct.url = url;
        return ogProduct;
      }
      
      console.log('[Jarir] ⚠️ Could not extract product details');
      return null;
      
    } catch (error) {
      console.error('[Jarir] Error getting product details:', error);
      return null;
    }
  }
}