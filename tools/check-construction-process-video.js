const fs = require("fs");
const path = require("path");
const { parse } = require("node-html-parser");

const root = path.join(__dirname, "..");
const videoPath = "/assets/video/Lion1_boom.mp4";
const quicktimePath = "/assets/video/Lion1_boom.MOV";
const videoFile = path.join(root, "public", "assets", "video", "Lion1_boom.mp4");
const stylesFile = path.join(root, "public", "styles.css");

const targets = [
  ["source en", "src/content/en/product-construction-waste.json", "json"],
  ["source zh-CN", "src/content/zh-cn/product-construction-waste.json", "json"],
  ["source zh-Hant", "src/content/zh-hant/product-construction-waste.json", "json"],
  ["public en", "public/products/construction-waste-recycling-line.html", "html"],
  ["public zh-CN", "public/zh-cn/products/construction-waste-recycling-line.html", "html"],
  ["public zh-Hant", "public/zh-hant/products/construction-waste-recycling-line.html", "html"],
];

if (!fs.existsSync(videoFile)) {
  throw new Error(`Missing construction process video asset: ${videoFile}`);
}

function loadBody(relativePath, kind) {
  const content = fs.readFileSync(path.join(root, relativePath), "utf8");
  if (kind === "json") {
    return JSON.parse(content).bodyHtml;
  }
  return content;
}

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
    const character = styles[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) {
      return styles.slice(openBraceIndex + 1, index);
    }
  }

  throw new Error(`styles.css: selector block is not closed: ${selector}`);
}

for (const [label, relativePath, kind] of targets) {
  const document = parse(loadBody(relativePath, kind));
  const section = document.querySelector(".product-process-section");

  if (!section) {
    throw new Error(`${label}: product process section is missing`);
  }

  if (section.querySelector(".industrial-flow")) {
    throw new Error(`${label}: Process Flow still renders the segmented industrial-flow layout`);
  }

  if (section.querySelector(".industrial-flow-node, .industrial-flow-track, .industrial-flow-wrap")) {
    throw new Error(`${label}: Process Flow still contains segmented flow nodes`);
  }

  if (section.querySelector("article")) {
    throw new Error(`${label}: Process Flow must not render segmented article cards`);
  }

  const videos = section.querySelectorAll("video");
  if (videos.length !== 1) {
    throw new Error(`${label}: Process Flow must contain exactly one promotional video, found ${videos.length}`);
  }

  const video = videos[0];
  for (const attribute of ["controls", "playsinline"]) {
    if (!video.hasAttribute(attribute)) {
      throw new Error(`${label}: Process Flow video is missing ${attribute}`);
    }
  }
  for (const attribute of ["autoplay", "muted", "loop"]) {
    if (video.hasAttribute(attribute)) {
      throw new Error(`${label}: Process Flow video must not include ${attribute}; it should wait for user playback`);
    }
  }

  const sources = video.querySelectorAll("source").map((source) => source.getAttribute("src"));
  if (!sources.includes(videoPath)) {
    throw new Error(`${label}: Process Flow video must include ${videoPath}`);
  }
  if (!sources.includes(quicktimePath)) {
    throw new Error(`${label}: Process Flow video must include ${quicktimePath}`);
  }

  if (/Video coming soon|视频即将发布|影片即将推出|影片即將推出/i.test(section.toString())) {
    throw new Error(`${label}: Process Flow still contains placeholder video copy`);
  }
}

const styles = fs.readFileSync(stylesFile, "utf8");
const processVideoBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video");
if (!processVideoBlock.includes("width: min(100%, 880px);")) {
  throw new Error("styles.css: construction process video should be capped at 880px so it does not dominate the section");
}
if (!processVideoBlock.includes("aspect-ratio: 4 / 3;")) {
  throw new Error("styles.css: construction process video should use an explicit 4 / 3 ratio");
}
if (!processVideoBlock.includes("margin: clamp(22px, 3vw, 34px) auto 0;")) {
  throw new Error("styles.css: construction process video should use a tighter top margin");
}

console.log("Construction process video check passed.");
