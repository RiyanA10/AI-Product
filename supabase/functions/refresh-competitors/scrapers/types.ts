/**
 * SCRAPER TYPES & INTERFACES
 * 
 * This file defines the "contract" that all scrapers must follow.
 * Think of it like a blueprint - any scraper (HTTP, Browser, etc.) 
 * must implement these methods.
 */

// ============================================
// CORE TRANSPORT INTERFACE
// ============================================

/**
 * ScraperTransport - The main interface all scrapers implement
 * 
 * Any scraper (HTTP, Puppeteer, etc.) must have a 'fetch' method
 * that takes a URL and returns the HTML content as a string.
 */
export interface ScraperTransport {
  /**
   * Fetch HTML content from a URL
   * @param url - The URL to scrape
   * @param options - Optional settings (timeout, headers, etc.)
   * @returns Promise<string> - The HTML content
   */
  fetch(url: string, options?: ScraperOptions): Promise<string>;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * Options that can be passed to any scraper
 */
export interface ScraperOptions {
  /**
   * Maximum time to wait for response (milliseconds)
   * Default: 30000 (30 seconds)
   */
  timeout?: number;
  
  /**
   * Custom headers to send with request
   * Example: { 'User-Agent': 'Mozilla/5.0...' }
   */
  headers?: Record<string, string>;
  
  /**
   * Whether to wait for JavaScript to execute
   * Only applicable for browser scrapers
   */
  waitForJs?: boolean;
  
  /**
   * CSS selector to wait for before considering page loaded
   * Example: '.product-price'
   */
  waitForSelector?: string;
  
  /**
   * Additional wait time after page load (milliseconds)
   */
  additionalWait?: number;
}

// ============================================
// PRODUCT DATA TYPES
// ============================================

/**
 * Raw product data extracted from a marketplace
 */
export interface ScrapedProduct {
  /**
   * Product name/title
   */
  name: string;
  
  /**
   * Price in SAR (Saudi Riyal)
   */
  price: number;
  
  /**
   * Currency code (usually 'SAR')
   */
  currency?: string;
  
  /**
   * Product URL on the marketplace
   */
  url?: string;
  
  /**
   * Product image URL
   */
  imageUrl?: string;
  
  /**
   * Availability status
   */
  availability?: 'in_stock' | 'out_of_stock' | 'pre_order' | 'unknown';
  
  /**
   * How the data was extracted
   * Helps with debugging
   */
  extractionMethod?: 'json-ld' | 'opengraph' | 'css-selector' | 'api';
  
  /**
   * Marketplace where this was found
   */
  marketplace: string;
}

// ============================================
// MARKETPLACE CONNECTOR INTERFACE
// ============================================

/**
 * Each marketplace (Amazon, Jarir, etc.) has a connector
 * that knows how to search and extract data from that specific site
 */
export interface MarketplaceConnector {
  /**
   * Marketplace name
   */
  name: string;
  
  /**
   * Search for products on this marketplace
   * @param productName - What to search for (e.g., "iPhone 15 Pro")
   * @returns Array of products found
   */
  searchProduct(productName: string): Promise<ScrapedProduct[]>;
  
  /**
   * Get product details from a specific URL
   * @param url - Direct product page URL
   * @returns Product details
   */
  getProductDetails?(url: string): Promise<ScrapedProduct | null>;
}

// ============================================
// RESULT TYPES
// ============================================

/**
 * Result of a scraping attempt
 * Includes both success and error information
 */
export interface ScraperResult {
  /**
   * Whether the scrape was successful
   */
  success: boolean;
  
  /**
   * Products found (if successful)
   */
  products?: ScrapedProduct[];
  
  /**
   * Error message (if failed)
   */
  error?: string;
  
  /**
   * How long the scrape took (milliseconds)
   */
  duration?: number;
  
  /**
   * Which transport was used
   */
  transportUsed?: 'http' | 'browser';
  
  /**
   * Additional metadata
   */
  metadata?: {
    marketplace: string;
    searchQuery: string;
    timestamp: string;
    wasBlocked?: boolean;
    usedFallback?: boolean;
  };
}

// ============================================
// ERROR TYPES
// ============================================

/**
 * Custom error class for scraping failures
 */
export class ScraperError extends Error {
  constructor(
    message: string,
    public code: 'TIMEOUT' | 'BLOCKED' | 'PARSE_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN',
    public marketplace?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}