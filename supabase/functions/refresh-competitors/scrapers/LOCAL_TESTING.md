# Local Testing (End-to-End)

## 1) Go to scraper directory
```bash
cd supabase/functions/refresh-competitors/scrapers
```

## 2) Configure Puppeteer Chrome path (Mac ARM example)
```bash
export PUPPETEER_EXECUTABLE_PATH="$HOME/.cache/puppeteer/chrome/mac_arm-145.0.7632.67/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
export PUPPETEER_HEADLESS=false
```

## 3) Run browser E2E test
```bash
deno run -A run-end-to-end.ts "iphone 15 pro max 256gb"
```

## 4) Run direct product URL validation (optional)
```bash
SCRAPER_TARGET_URL="https://www.jarir.com/sa-en/search?text=iphone" deno run -A run-end-to-end.ts "iphone 15"
```

## 5) Force HTTP fallback transport (optional)
```bash
SCRAPER_USE_HTTP=true deno run -A run-end-to-end.ts "iphone 15"
```

The runner writes `scraper-e2e-result.json` with structured output.


## 6) Try Google Shopping connector (recommended fallback)
```bash
SCRAPER_MARKETPLACE=google deno run -A run-end-to-end.ts "iphone 15"
```

## 7) Try Google Shopping with HTTP transport
```bash
SCRAPER_MARKETPLACE=google SCRAPER_USE_HTTP=true deno run -A run-end-to-end.ts "iphone 15"
```
