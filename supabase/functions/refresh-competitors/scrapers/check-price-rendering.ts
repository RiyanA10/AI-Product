const html = await Deno.readTextFile('extra-product-page.html');

console.log('🔍 Checking how Extra renders prices...\n');

// Check for image-based prices
const priceImages = html.match(/<img[^>]*(?:price|amount|cost)[^>]*>/gi);
console.log(`📸 Images with price-related attributes: ${priceImages?.length || 0}`);

if (priceImages) {
  priceImages.slice(0, 3).forEach(img => console.log(`  ${img.substring(0, 100)}`));
}

// Check for SVG prices
const svgPrices = html.match(/<svg[^>]*>[\s\S]{0,500}?<\/svg>/gi);
console.log(`\n🎨 SVG elements: ${svgPrices?.length || 0}`);

// Check for canvas
const canvas = html.match(/<canvas[^>]*>/gi);
console.log(`\n🖼️ Canvas elements: ${canvas?.length || 0}`);

// Check for base64 images
const base64Images = html.match(/data:image\/[^"']+/gi);
console.log(`\n📦 Base64 images: ${base64Images?.length || 0}`);

// Look for actual text numbers that COULD be prices
console.log('\n\n💰 Looking for visible text prices...\n');

// Search for numbers in actual text content (not in attributes/scripts)
const textMatches = html.match(/>([^<]*\d{3,5}[^<]*)</g);

if (textMatches) {
  const withNumbers = textMatches
    .map(m => m.replace(/^>|<$/g, '').trim())
    .filter(t => t.match(/\d{3,5}/) && t.length < 100);
  
  console.log('Text containing 3-5 digit numbers:');
  const unique = [...new Set(withNumbers)].slice(0, 20);
  unique.forEach(t => console.log(`  "${t}"`));
}