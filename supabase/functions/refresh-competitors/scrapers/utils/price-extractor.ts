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