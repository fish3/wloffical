const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const imagePath = "/assets/images/Lion1_boom.png";
const imageFile = path.join(root, "public", "assets", "images", "Lion1_boom.png");
const videoPath = "/assets/video/Lion1_boom.mp4";
const videoFile = path.join(root, "public", "assets", "video", "Lion1_boom.mp4");
const requiredFigureMarkers = [
  "product-compare-explode-frame is-technical-plate",
  "product-compare-explode-stats",
  "product-compare-explode-meta",
];

function extractCssBlock(styles, selector) {
  const selectorIndex = styles.indexOf(selector);
  if (selectorIndex === -1) {
    throw new Error(`styles.css: missing selector: ${selector}`);
  }

  const openBraceIndex = styles.indexOf("{", selectorIndex);
  if (openBraceIndex === -1) {
    throw new Error(`styles.css: selector has no block: ${selector}`);
  }

  let depth = 0;
  for (let index = openBraceIndex; index < styles.length; index += 1) {
    const char = styles[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return styles.slice(openBraceIndex + 1, index);
    }
  }

  throw new Error(`styles.css: selector block is not closed: ${selector}`);
}

function getVideoDimensions(filePath) {
  const result = spawnSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=s=x:p=0",
    filePath,
  ], { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(`Unable to read video dimensions for ${filePath}: ${result.stderr.trim()}`);
  }

  const [width, height] = result.stdout.trim().split("x").map(Number);
  if (!width || !height) {
    throw new Error(`Invalid video dimensions for ${filePath}: ${result.stdout.trim()}`);
  }

  return { width, height };
}

const targets = [
  ["source en", "src/content/en/product-construction-waste.json"],
  ["source zh-CN", "src/content/zh-cn/product-construction-waste.json"],
  ["source zh-Hant", "src/content/zh-hant/product-construction-waste.json"],
  ["public en", "public/products/construction-waste-recycling-line.html"],
  ["public zh-CN", "public/zh-cn/products/construction-waste-recycling-line.html"],
  ["public zh-Hant", "public/zh-hant/products/construction-waste-recycling-line.html"],
];

if (!fs.existsSync(imageFile)) {
  throw new Error(`Missing comparison image asset: ${imageFile}`);
}

if (!fs.existsSync(videoFile)) {
  throw new Error(`Missing hero video asset: ${videoFile}`);
}

const videoDimensions = getVideoDimensions(videoFile);
const videoAspectRatio = `${videoDimensions.width} / ${videoDimensions.height}`;

for (const [label, relativePath] of targets) {
  const filePath = path.join(root, relativePath);
  const content = fs.readFileSync(filePath, "utf8");
  const normalizedContent = content.replace(/\\"/g, '"');
  const figureStart = normalizedContent.indexOf('class="product-compare-explode"');

  if (figureStart === -1) {
    throw new Error(`${label}: comparison figure is missing`);
  }

  if (!/<section class="section product-compare-section" id="comparison" /.test(normalizedContent)) {
    throw new Error(`${label}: comparison section must expose id="comparison" for hash navigation`);
  }

  const figureSlice = normalizedContent.slice(figureStart, figureStart + 1200);

  if (!figureSlice.includes(imagePath)) {
    throw new Error(`${label}: comparison figure must include ${imagePath}`);
  }

  if (!normalizedContent.includes(videoPath)) {
    throw new Error(`${label}: hero video must include ${videoPath}`);
  }

  for (const marker of requiredFigureMarkers) {
    if (!figureSlice.includes(marker)) {
      throw new Error(`${label}: comparison figure is missing A-plan marker: ${marker}`);
    }
  }

  if (/coming soon|即将推出|即將推出|即将登场|即將登場/i.test(figureSlice)) {
    throw new Error(`${label}: comparison figure still contains coming-soon placeholder text`);
  }
}

const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const requiredCssMarkers = [
  ".product-compare-section",
  "scroll-margin-top",
  ".product-page-industrial .product-compare-explode-frame.is-technical-plate",
  ".product-compare-explode-stats",
];

for (const marker of requiredCssMarkers) {
  if (!styles.includes(marker)) {
    throw new Error(`styles.css: missing A-plan marker: ${marker}`);
  }
}

const heroVideoBlock = extractCssBlock(styles, ".product-page-industrial .split-section-media video");
if (!heroVideoBlock.includes("object-fit: contain;")) {
  throw new Error("styles.css: construction hero video must use object-fit: contain to keep the full frame visible");
}
if (/transform\s*:/.test(heroVideoBlock)) {
  throw new Error("styles.css: construction hero video must not scale the media frame");
}

const heroMediaBlock = extractCssBlock(styles, ".product-page-industrial .split-section-media");
if (!heroMediaBlock.includes(`aspect-ratio: ${videoAspectRatio};`)) {
  throw new Error(`styles.css: construction hero media container must preserve the source video ratio ${videoAspectRatio}`);
}
if (!heroMediaBlock.includes("height: auto;")) {
  throw new Error("styles.css: construction hero media container must not force a full-height crop frame");
}

const heroMediaBeforeBlock = extractCssBlock(styles, ".product-page-industrial .split-section-media::before");
const heroMediaAfterBlock = extractCssBlock(styles, ".product-page-industrial .split-section-media::after");
if (!heroMediaBeforeBlock.includes("display: none;") || !heroMediaAfterBlock.includes("display: none;")) {
  throw new Error("styles.css: construction hero media overlays must be disabled to keep the video border weak");
}

const technicalPlateBlock = extractCssBlock(styles, ".product-page-industrial .product-compare-explode-frame.is-technical-plate");
if (!technicalPlateBlock.includes("aspect-ratio: 1320 / 910;")) {
  throw new Error("styles.css: comparison media plate must preserve the Lion1_boom.png source ratio");
}
if (!technicalPlateBlock.includes("box-shadow: inset 0 0 0 1px rgba(184, 194, 201, 0.12);")) {
  throw new Error("styles.css: comparison media plate must use a weak border-only frame");
}

const technicalImageBlock = extractCssBlock(styles, ".product-page-industrial .product-compare-explode-frame.is-technical-plate > img");
if (!technicalImageBlock.includes("inset: 0;")) {
  throw new Error("styles.css: comparison media image must fill the ratio-preserving plate without an inner frame");
}
if (/filter\s*:/.test(technicalImageBlock)) {
  throw new Error("styles.css: comparison media image must not use visual filters");
}

console.log("Construction comparison image check passed.");
