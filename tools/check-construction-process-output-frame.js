const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const stylesCss = fs.readFileSync(
  path.join(__dirname, "..", "public", "styles.css"),
  "utf8",
);

assert.match(
  stylesCss,
  /\.industrial-flow-node\s*{[^}]*box-shadow:\s*[\s\S]*?inset 0 0 0 1px rgba\(184, 194, 201, 0\.18\)/,
  "Construction process cards should use the shared neutral outer frame.",
);

assert.doesNotMatch(
  stylesCss,
  /\.industrial-flow-finale\s*{[^}]*box-shadow:/s,
  "The recycled output card should inherit the shared frame instead of adding a red outer border.",
);

console.log("Construction process output frame check passed.");
