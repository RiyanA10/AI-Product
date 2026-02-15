/**
 * End-to-end local runner for competitor scraping.
 *
 * Usage:
 *   deno run -A run-end-to-end.ts "iphone 15 pro max"
 *   deno run -A run-end-to-end.ts --marketplace google "iphone 15 pro max"
 *
 * Optional env vars:
 *   SCRAPER_TARGET_URL=https://www.jarir.com/sa-en/...   // for direct product test
 *   SCRAPER_USE_HTTP=true                                 // force HTTP transport
 *   SCRAPER_MARKETPLACE=jarir|google                      // choose connector
 */

import { BrowserScraperV2 } from './browser-scraper-v2.ts';
import { HTTPScraper } from './http-scraper.ts';
import { JarirBrowserConnector } from './connectors/jarir-browser.ts';
import { JarirConnector } from './connectors/jarir.ts';
import { GoogleShoppingConnector } from './connectors/google-shopping.ts';

const args = [...Deno.args];
let marketplaceFromArgs: string | null = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--marketplace' && args[i + 1]) {
    marketplaceFromArgs = args[i + 1];
    args.splice(i, 2);
    break;
  }

  if (arg.startsWith('--marketplace=')) {
    marketplaceFromArgs = arg.split('=')[1];
    args.splice(i, 1);
    break;
  }
}

const query = args.join(' ').trim() || 'iphone 15 pro max 256gb';
const directUrl = Deno.env.get('SCRAPER_TARGET_URL');
const useHttp = Deno.env.get('SCRAPER_USE_HTTP') === 'true';
const marketplaceRaw = marketplaceFromArgs || Deno.env.get('SCRAPER_MARKETPLACE') || 'jarir';
const marketplace = marketplaceRaw.toLowerCase().trim();

const transport = useHttp ? new HTTPScraper() : new BrowserScraperV2();

const connector = (() => {
  if (marketplace === 'google') {
    return new GoogleShoppingConnector(transport);
  }

  if (marketplace === 'jarir') {
    return useHttp ? new JarirConnector(transport) : new JarirBrowserConnector(transport);
  }

  throw new Error(`Unsupported SCRAPER_MARKETPLACE: ${marketplace}. Use jarir|google`);
})();

console.log('🚀 Running end-to-end scraper test');
console.log(`   Query: ${query}`);
console.log(`   Transport: ${useHttp ? 'HTTP' : 'Browser'}`);
console.log(`   Marketplace: ${marketplace}`);
console.log(`   Marketplace source: ${marketplaceFromArgs ? 'arg' : 'env/default'}`);
console.log(`   Marketplace raw: ${marketplaceRaw}`);
console.log(`   Connector: ${connector.name}`);
console.log(`   Direct URL: ${directUrl ?? '(none)'}`);

const start = Date.now();

let searchResults = [];
try {
  searchResults = await connector.searchProduct(query);
} catch (error) {
  console.error('❌ searchProduct failed:', error);
}

let directResult = null;
if (directUrl && connector.getProductDetails) {
  directResult = await connector.getProductDetails(directUrl);
}

const durationMs = Date.now() - start;

const summary = {
  ok: searchResults.length > 0 || Boolean(directResult),
  durationMs,
  transport: useHttp ? 'http' : 'browser',
  query,
  marketplace,
  searchCount: searchResults.length,
  searchTop3: searchResults.slice(0, 3),
  directResult,
};

console.log('\n📦 Result Summary:\n');
console.log(JSON.stringify(summary, null, 2));

await Deno.writeTextFile('scraper-e2e-result.json', JSON.stringify(summary, null, 2));
console.log('\n💾 Wrote scraper-e2e-result.json');
