const fs = require("fs");
const path = require("path");

const publicPath = path.join(__dirname, "..", "public");
const cssPath = path.join(publicPath, "styles.css");
const resourcesPath = path.join(publicPath, "resources");
const css = fs.readFileSync(cssPath, "utf8");

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

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

function blockForSelectorList(selectors) {
  const selectorPattern = selectors.map(escapePattern).join("\\s*,\\s*");
  const pattern = new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`, "m");
  const match = css.match(pattern);
  if (!match) {
    throw new Error(`Missing shared CSS block for ${selectors.join(", ")}`);
  }
  return match[1];
}

const detailFiles = fs
  .readdirSync(resourcesPath)
  .filter((file) => file.endsWith(".html"))
  .sort();

for (const file of detailFiles) {
  const html = fs.readFileSync(path.join(resourcesPath, file), "utf8");
  const relatedGrid = html.match(/<div class="resource-related-grid">([\s\S]*?)<\/div>/);
  if (!relatedGrid) {
    throw new Error(`Missing Related Resources grid in ${file}`);
  }

  const linkCount = (relatedGrid[1].match(/<a\b/g) || []).length;
  const ctaCount = (
    relatedGrid[1].match(
      /<span class="resource-related-cta" aria-hidden="true">Explore<\/span>/g,
    ) || []
  ).length;

  if (linkCount !== 4 || ctaCount !== linkCount) {
    throw new Error(
      `${file} must contain one Related Resources CTA for each of its four links`,
    );
  }
}

if (css.includes('content: "Explore ->"')) {
  throw new Error("Obsolete Explore arrow content is still present");
}

const linkBlock = blockFor(".resource-related-grid a");
const ctaBlock = blockFor(".resource-related-cta");
const arrowBlock = blockForSelectorList([
  ".resource-read-more::after",
  ".resource-related-cta::after",
]);
const hoverBlock = blockFor(".resource-related-grid a:hover");
const hoverCtaBlock = blockFor(".resource-related-grid a:hover .resource-related-cta");
const hoverArrowBlock = blockForSelectorList([
  ".resource-read-more:hover::after",
  ".resource-related-grid a:hover .resource-related-cta::after",
]);
const focusBlock = blockFor(".resource-related-grid a:focus-visible");

assertIncludes(linkBlock, "display: flex", "Related resource card layout");
assertIncludes(linkBlock, "position: relative", "Related resource card positioning");
assertIncludes(linkBlock, "overflow: hidden", "Related resource card containment");
assertIncludes(ctaBlock, "display: inline-flex", "Related resource CTA layout");
assertIncludes(ctaBlock, "gap: 8px", "Related resource CTA arrow spacing");
assertIncludes(ctaBlock, "align-self: flex-end", "Related resource CTA placement");
assertIncludes(arrowBlock, 'content: "→"', "Shared resource arrow glyph");
assertIncludes(
  arrowBlock,
  "color: rgba(66, 215, 223, 0.72)",
  "Shared resource arrow color",
);
assertIncludes(arrowBlock, "transition:", "Shared resource arrow animation");
assertIncludes(hoverBlock, "box-shadow:", "Related resource hover elevation");
assertIncludes(hoverCtaBlock, "color: var(--color-white)", "Related CTA hover color");
assertIncludes(hoverArrowBlock, "color: var(--color-cyan)", "Shared arrow hover color");
assertIncludes(hoverArrowBlock, "transform: translateX(4px)", "Shared arrow hover movement");
assertIncludes(focusBlock, "outline:", "Related resource keyboard focus");

console.log("Related resources affordance CSS and HTML checks passed.");
