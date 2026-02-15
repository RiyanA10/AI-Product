/**
 * BROWSER SCRAPER V2 - Maximum Stealth
 */
// @ts-nocheck
import { ScraperTransport, ScraperOptions, ScraperError } from './types.ts';
import puppeteer from "npm:puppeteer@24.15.0";

export class BrowserScraperV2 implements ScraperTransport {
  
  async fetch(url: string, options?: ScraperOptions): Promise<string> {
    const startTime = Date.now();
    let browser;
    
    try {
      console.log(`[Browser V2] Launching browser for: ${url}`);
      
      const executablePath = Deno.env.get('PUPPETEER_EXECUTABLE_PATH');

      // Launch with maximum stealth
      browser = await puppeteer.launch({
        headless: Deno.env.get('PUPPETEER_HEADLESS') !== 'false',
        executablePath: executablePath || undefined,
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1920,1080',
          '--start-maximized',
        ],
      });
      
      const page = await browser.newPage();
      
      await page.setViewport({ width: 1920, height: 1080 });
      
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en', 'ar'],
        });
        
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // @ts-ignore
        window.chrome = { runtime: {} };
        
        // Permissions
        const originalQuery = window.navigator.permissions.query;
        // @ts-ignore
        window.navigator.permissions.query = (parameters: any) => (
          parameters.name === 'notifications' ?
            // @ts-ignore
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });
      
      console.log(`[Browser V2] Navigating...`);
      
      const timeout = options?.timeout || 20000;
      const targetHost = new URL(url).host;
      const apiSignalPattern = /(\"price\"|\"final_price\"|\"special_price\"|\"product\"|\"products\"|\"items\"|\"hits\"|\"sku\")/i;
      const apiUrlPattern = /(\/api\/|catalogv2|graphql|search(?:\?|\/)|query)/i;
      let html = '';
      const apiPayloads: Array<{ url: string; payload: string }> = [];
      let domProducts: Array<{ name: string; price: number; url?: string }> = [];
      
      page.on('response', async (response) => {
        try {
          const respUrl = response.url();
          const contentType = response.headers()['content-type'] || '';

          if (contentType.includes('json') || apiUrlPattern.test(respUrl)) {
            const payload = await response.text();
            const trimmedPayload = payload.trim();
            const looksLikeJson = trimmedPayload.startsWith('{') || trimmedPayload.startsWith('[');

            // Keep payloads that look like product/search APIs and are valid JSON-like content.
            if (
              payload.length > 30 &&
              looksLikeJson &&
              (apiSignalPattern.test(payload) || apiUrlPattern.test(respUrl))
            ) {
              apiPayloads.push({ url: respUrl, payload });
              console.log(`[Browser V2] 📦 Captured API payload from: ${respUrl}`);
            }
          }
          
          let responseHost = '';
          try {
            responseHost = new URL(respUrl).host;
          } catch {
            responseHost = '';
          }

          const sameTargetHost = responseHost === targetHost;
          const isJarirFamilyHost = targetHost.includes('jarir.com') && respUrl.includes('jarir.com');

          if ((sameTargetHost || isJarirFamilyHost) && html === '') {
            if (contentType.includes('text/html')) {
              const text = await response.text();
              if (text && text.length > 1000) {
                html = text;
                console.log(`[Browser V2] 🎯 Captured HTML from response! (${html.length} chars)`);
              }
            }
          }
        } catch (e) {
          // Silently ignore
        }
      });
      
      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: timeout,
        });
        console.log(`[Browser V2] ✅ Navigation succeeded!`);
      } catch (navError) {
        console.log(`[Browser V2] ⚠️ Navigation error:`, 
          navError instanceof Error ? navError.message : navError);
      }
      
      try {
        await page.waitForNetworkIdle({ idleTime: 1200, timeout: Math.min(timeout, 12000) });
        console.log('[Browser V2] ✅ Network became idle');
      } catch (_e) {
        console.log('[Browser V2] ⚠️ Network idle wait timed out');
      }

      if (options?.waitForSelector) {
        try {
          await page.waitForSelector(options.waitForSelector, { timeout: Math.min(timeout, 10000) });
          console.log(`[Browser V2] ✅ waitForSelector matched: ${options.waitForSelector}`);
        } catch (_e) {
          console.log(`[Browser V2] ⚠️ waitForSelector timed out: ${options.waitForSelector}`);
        }
      }

      try {
        await page.evaluate(async () => {
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          window.scrollTo(0, 0);
        });
      } catch (_e) {
        // Ignore scroll failures
      }

      // WAIT FOR PRODUCT DATA TO LOAD
      console.log(`[Browser V2] Waiting for JavaScript to populate product data...`);
      
      let attempts = 0;
      let hasProductData = false;
      
      while (attempts < 15 && !hasProductData) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        try {
          hasProductData = await page.evaluate(() => {
            const state = (window as any).__INITIAL_STATE__;
            return state?.product?.current && Object.keys(state.product.current).length > 0;
          });
          
          if (hasProductData) {
            console.log(`[Browser V2] ✅ Product data loaded after ${attempts} seconds!`);
            break;
          }
        } catch (e) {
          // Continue waiting
        }
      }
      
      if (!hasProductData) {
        console.log(`[Browser V2] ⚠️ Product data didn't load within 15 seconds`);
      }
      
      // Get fresh HTML with loaded data
      console.log(`[Browser V2] Getting final HTML...`);
      
      // Wait extra time for any remaining JS
      const additionalWait = options?.additionalWait ?? 3000;
      await new Promise(resolve => setTimeout(resolve, additionalWait));
      
      // FORCE getting fresh DOM (not cached response)
      try {
        const freshHtml = await page.content();

        if (freshHtml && freshHtml.length > html.length) {
          html = freshHtml;
          console.log(`[Browser V2] ✅ Got FRESH HTML with JS updates (${html.length} chars)`);
        } else {
          console.log(`[Browser V2] ✅ Using response HTML (${html.length} chars)`);
        }
      } catch (e) {
        console.log(`[Browser V2] ⚠️ Using cached HTML`);
      }

      try {
        domProducts = await page.evaluate(() => {
          const productNodes = Array.from(
            document.querySelectorAll(
              '[data-price-amount], .product-item, .product-item-info, [class*="product"], a[href*="/p/"]'
            )
          );

          const parsed: Array<{ name: string; price: number; url?: string }> = [];

          for (const node of productNodes.slice(0, 250)) {
            const block = node instanceof HTMLElement ? node : (node.parentElement as HTMLElement | null);
            if (!block) {
              continue;
            }

            const nameEl =
              block.querySelector('a.product-item-link') ||
              block.querySelector('[class*="product-name"] a') ||
              block.querySelector('a[href*="/p/"]') ||
              block.querySelector('a[href*="product"]');

            const priceEl =
              block.querySelector('[data-price-amount]') ||
              block.querySelector('[class*="price"]') ||
              block.querySelector('span.price');

            const name = (nameEl?.textContent || '').replace(/\s+/g, ' ').trim();
            const href = (nameEl as HTMLAnchorElement | null)?.href;
            const rawPrice =
              (priceEl as HTMLElement | null)?.getAttribute?.('data-price-amount') ||
              priceEl?.textContent ||
              '';

            const numeric = parseFloat(String(rawPrice).replace(/[^0-9.]/g, ''));
            if (!name || name.length < 4 || isNaN(numeric) || numeric <= 0) {
              continue;
            }

            parsed.push({
              name,
              price: numeric,
              url: href || undefined,
            });
          }

          const dedup = new Map<string, { name: string; price: number; url?: string }>();
          for (const item of parsed) {
            const key = `${item.name.toLowerCase()}::${item.price}`;
            if (!dedup.has(key)) {
              dedup.set(key, item);
            }
          }

          return [...dedup.values()].slice(0, 80);
        });

        if (domProducts.length > 0) {
          console.log(`[Browser V2] ✅ Extracted ${domProducts.length} product candidate(s) directly from DOM`);
        }
      } catch (_e) {
        // Ignore DOM extraction failures
      }

      let resourceUrls: string[] = [];
      try {
        resourceUrls = await page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((name) => /jarir|catalog|search|product|graphql|api/i.test(name))
            .slice(-200)
        );
      } catch (_e) {
        // Ignore performance entry extraction failures
      }

      if (apiPayloads.length > 0) {
        const uniquePayloads = [...new Map(apiPayloads.map((item) => [`${item.url}::${item.payload.length}`, item])).values()].slice(0, 40);
        const payloadBlob = btoa(unescape(encodeURIComponent(JSON.stringify(uniquePayloads))));
        const payloadScript = `<script type="application/json" id="__SCRAPER_API_PAYLOADS__">${payloadBlob}</script>`;
        const endpointBlob = btoa(unescape(encodeURIComponent(JSON.stringify(uniquePayloads.map((item) => item.url)))));
        const endpointScript = `<script type="application/json" id="__SCRAPER_API_ENDPOINTS__">${endpointBlob}</script>`;
        html += payloadScript + endpointScript;
        console.log(`[Browser V2] ✅ Appended ${uniquePayloads.length} API payload(s) to HTML`);
      }

      if (resourceUrls.length > 0) {
        const resourceBlob = btoa(unescape(encodeURIComponent(JSON.stringify(resourceUrls))));
        const resourceScript = `<script type="application/json" id="__SCRAPER_RESOURCE_URLS__">${resourceBlob}</script>`;
        html += resourceScript;
        console.log(`[Browser V2] ✅ Appended ${resourceUrls.length} resource URL(s)`);
      }

      if (domProducts.length > 0) {
        const domProductsBlob = btoa(unescape(encodeURIComponent(JSON.stringify(domProducts))));
        const domProductsScript = `<script type="application/json" id="__SCRAPER_DOM_PRODUCTS__">${domProductsBlob}</script>`;
        html += domProductsScript;
        console.log(`[Browser V2] ✅ Appended ${domProducts.length} DOM product candidate(s)`);
      }
      
      await browser.close();
      
      const duration = Date.now() - startTime;
      console.log(`[Browser V2] ✅ Success (${duration}ms) - ${html.length} chars`);
      
      return html;
      
    } catch (error) {
      if (browser) {
        await browser.close().catch(() => {});
      }
      
      const duration = Date.now() - startTime;
      console.error(`[Browser V2] ❌ Error after ${duration}ms:`, error);
      
      throw new ScraperError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }
}
