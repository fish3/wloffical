const fs = require("fs");
const path = require("path");

const publicPath = path.join(__dirname, "..", "public");
const products = fs.readFileSync(path.join(publicPath, "products.html"), "utf8");
const css = fs.readFileSync(path.join(publicPath, "styles.css"), "utf8");

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blockFor(selector) {
  const pattern = new RegExp(`${escapePattern(selector)}\\s*\\{([^}]*)\\}`, "m");
  const match = css.match(pattern);
  if (!match) {
    throw new Error(`Missing CSS block for ${selector}`);
  }
  return match[1];
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

assertIncludes(
  products,
  '<section class="product-family-band product-family-ai"',
  "AI product family section",
);
assertIncludes(
  products,
  '<img src="assets/images/super-sorting.jpg"',
  "AI product family image",
);

const sharedMediaBlock = blockFor(".product-family-media");
const sharedImageBlock = blockFor(".product-family-media img");
const aiMediaBlock = blockFor(".product-family-ai .product-family-media");
const aiImageBlock = blockFor(".product-family-ai .product-family-media img");

assertIncludes(sharedMediaBlock, "aspect-ratio: 16 / 9", "Product media aspect ratio");
assertIncludes(sharedImageBlock, "object-fit: contain", "Product image fit mode");
assertIncludes(aiMediaBlock, "min-height: 0", "AI product image intrinsic aspect sizing");
assertIncludes(aiImageBlock, "object-fit: cover", "AI product image edge-to-edge fit mode");

console.log("Products AI media fit check passed.");
