const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "..", "public", "styles.css");
const css = fs.readFileSync(cssPath, "utf8");

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

function blockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m");
  const match = css.match(pattern);
  if (!match) {
    throw new Error(`Missing CSS block for ${selector}`);
  }
  return match[1];
}

const linkBlock = blockFor(".resource-related-grid a");
const afterBlock = blockFor(".resource-related-grid a::after");
const hoverBlock = blockFor(".resource-related-grid a:hover");
const hoverAfterBlock = blockFor(".resource-related-grid a:hover::after");
const focusBlock = blockFor(".resource-related-grid a:focus-visible");

assertIncludes(linkBlock, "display: flex", "Related resource card layout");
assertIncludes(linkBlock, "position: relative", "Related resource card positioning");
assertIncludes(linkBlock, "overflow: hidden", "Related resource card containment");
assertIncludes(afterBlock, 'content: "Explore ->"', "Related resource navigation cue");
assertIncludes(afterBlock, "align-self: flex-end", "Related resource cue placement");
assertIncludes(afterBlock, "transition:", "Related resource cue animation");
assertIncludes(hoverBlock, "box-shadow:", "Related resource hover elevation");
assertIncludes(hoverAfterBlock, "transform:", "Related resource hover cue movement");
assertIncludes(focusBlock, "outline:", "Related resource keyboard focus");

console.log("Related resources affordance CSS check passed.");
