/**
 * HTTP SCRAPER
 * 
 * This is the "simple" scraper that makes regular HTTP requests.
 * It's fast and free, but doesn't execute JavaScript.
 * 
 * Works well for: Jarir, Extra (sometimes), Noon
 * Doesn't work for: Amazon (too much anti-bot protection)
 */

import { ScraperTransport, ScraperOptions, ScraperError } from './types.ts';

export class HTTPScraper implements ScraperTransport {
  /**
   * Default headers that make our requests look like a real browser
   * This is important to avoid being blocked
   */
  private defaultHeaders = {
    // Pretend to be Safari on Mac
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Accept HTML responses
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    
    // Accept compressed responses (faster)
    'Accept-Encoding': 'gzip, deflate, br',
    
    // Accept Arabic and English
    'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7',
    
    // Tell the server we upgraded our connection
    'Upgrade-Insecure-Requests': '1',
    
    // Modern browser security
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  };

  /**
   * Fetch HTML from a URL using simple HTTP request
   * 
   * @param url - The webpage to scrape
   * @param options - Optional settings (timeout, custom headers)
   * @returns The HTML content as a string
   */
  async fetch(url: string, options?: ScraperOptions): Promise<string> {
    const startTime = Date.now();
    
    try {
      console.log(`[HTTP Scraper] Fetching: ${url}`);
      
      // Set timeout (default 30 seconds)
      const timeout = options?.timeout || 30000;
      
      // Merge default headers with custom ones
      const headers = {
        ...this.defaultHeaders,
        ...options?.headers,
      };
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Make the HTTP request
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        signal: controller.signal,
        // Important: Follow redirects automatically
        redirect: 'follow',
      });
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Check if request was successful
      if (!response.ok) {
        throw new ScraperError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status === 403 || response.status === 429 ? 'BLOCKED' : 'NETWORK_ERROR'
        );
      }
      
      // Get the HTML content
      const html = await response.text();
      
      // Log success
      const duration = Date.now() - startTime;
      console.log(`[HTTP Scraper] ✅ Success (${duration}ms) - ${html.length} chars`);
      
      // Check if we got blocked (some sites return 200 but with CAPTCHA page)
      if (this.isBlockedResponse(html)) {
        throw new ScraperError(
          'Blocked by anti-bot protection (CAPTCHA detected)',
          'BLOCKED'
        );
      }
      
      return html;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[HTTP Scraper] ❌ Timeout after ${duration}ms`);
        throw new ScraperError(
          `Request timeout after ${duration}ms`,
          'TIMEOUT',
          undefined,
          error
        );
      }
      
      // Handle other errors
      if (error instanceof ScraperError) {
        console.error(`[HTTP Scraper] ❌ ${error.message}`);
        throw error;
      }
      
      // Unknown error
      console.error(`[HTTP Scraper] ❌ Unknown error:`, error);
      throw new ScraperError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Check if the response is a blocked/CAPTCHA page
   * 
   * Some sites return HTTP 200 but show a CAPTCHA or block page.
   * This function tries to detect that.
   */
  private isBlockedResponse(html: string): boolean {
    const blockIndicators = [
      // Common CAPTCHA services
      'captcha',
      'recaptcha',
      'hcaptcha',
      
      // Common block messages
      'access denied',
      'blocked',
      'suspicious activity',
      'unusual traffic',
      
      // Cloudflare
      'cf-ray',
      'cloudflare',
      
      // Other anti-bot services
      'distil networks',
      'perimeter x',
      'incapsula',
    ];
    
    const lowerHtml = html.toLowerCase();
    
    // Check for indicators
    for (const indicator of blockIndicators) {
      if (lowerHtml.includes(indicator)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Add delay between requests to avoid rate limiting
   * Call this between consecutive scrapes
   */
  async delay(ms: number = 1000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}