const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "..", "public", "products", "construction-waste-recycling-line.html");
const page = fs.readFileSync(pagePath, "utf8");

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

function assertNotIncludes(haystack, needle, label) {
  if (haystack.includes(needle)) {
    throw new Error(`${label} should not include: ${needle}`);
  }
}

const capacityHeading = "<h3>Capacity</h3>";
const capacityHeadingIndex = page.indexOf(capacityHeading);

if (capacityHeadingIndex === -1) {
  throw new Error("Construction comparison Capacity row is missing");
}

const rowStart = page.lastIndexOf('<li class="product-compare-row">', capacityHeadingIndex);
const rowEnd = page.indexOf("</li>", capacityHeadingIndex);
const capacityRow = page.slice(rowStart, rowEnd);

assertIncludes(capacityRow, 'style="--fill:100%"', "Lion One capacity bar should fill to the 70 t/h ceiling");
assertIncludes(capacityRow, 'style="--fill:88.6%"', "MK-F50 capacity bar should scale by 62 / 70 t/h");
assertNotIncludes(capacityRow, "--start:", "Capacity comparison should use progress bars instead of offset range bands");
assertIncludes(capacityRow, "upper rated throughput", "Capacity comparison note should explain the scaling basis");

console.log("Construction Capacity comparison check passed.");
