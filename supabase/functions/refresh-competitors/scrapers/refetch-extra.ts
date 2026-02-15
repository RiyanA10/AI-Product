import { BrowserScraperV2 } from './browser-scraper-v2.ts';

const scraper = new BrowserScraperV2();

console.log('🔄 Re-fetching Extra product page...\n');

const html = await scraper.fetch(
  'https://www.extra.com/en-sa/mobiles-tablets/mobile-phones/apple-iphone/apple-iphone-15-pro-max-256gb-natural-titanium/p/100314493',
  { additionalWait: 5000 }
);

await Deno.writeTextFile('extra-product-page.html', html);

console.log(`✅ Saved extra-product-page.html (${html.length} chars)`);