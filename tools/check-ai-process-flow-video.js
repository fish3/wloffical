const fs = require("fs");
const path = require("path");
const { parse } = require("node-html-parser");

const root = path.join(__dirname, "..");
const videoPath = "/assets/video/AI_flow.mp4";
const videoFile = path.join(root, "public", "assets", "video", "AI_flow.mp4");
const stylesFile = path.join(root, "public", "styles.css");
const maxVideoBytes = 8 * 1024 * 1024;

const targets = [
  ["source en", "src/content/en/product-ai-optical-sorting.json", "json"],
  ["source zh-CN", "src/content/zh-cn/product-ai-optical-sorting.json", "json"],
  ["source zh-Hant", "src/content/zh-hant/product-ai-optical-sorting.json", "json"],
  ["public en", "public/products/ai-optical-sorting.html", "html"],
  ["public zh-CN", "public/zh-cn/products/ai-optical-sorting.html", "html"],
  ["public zh-Hant", "public/zh-hant/products/ai-optical-sorting.html", "html"],
];

if (!fs.existsSync(videoFile)) {
  throw new Error(`Missing AI process video asset: ${videoFile}`);
}
if (fs.statSync(videoFile).size > maxVideoBytes) {
  throw new Error("AI process video should be web-compressed below 8MB");
}

const videoHeader = fs.readFileSync(videoFile).subarray(0, 1024 * 1024).toString("latin1");
const moovIndex = videoHeader.indexOf("moov");
const mdatIndex = videoHeader.indexOf("mdat");
if (moovIndex === -1 || mdatIndex === -1 || moovIndex > mdatIndex) {
  throw new Error("AI process video should be fast-start encoded with moov before mdat");
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
  const section = document.querySelector(".product-page-ai .product-process-section");

  if (!section) {
    throw new Error(`${label}: AI product process section is missing`);
  }

  if (section.querySelector(".process-timeline, .process-timeline-step, .process-timeline-card")) {
    throw new Error(`${label}: Process Flow still renders the old multi-step video timeline`);
  }

  const videos = section.querySelectorAll("video");
  if (videos.length !== 1) {
    throw new Error(`${label}: Process Flow must contain exactly one video, found ${videos.length}`);
  }

  const frame = section.querySelector("[data-ai-process-video-frame]");
  if (!frame) {
    throw new Error(`${label}: Process Flow video should use the original UI frame wrapper`);
  }

  const video = videos[0];
  if (video.getAttribute("id") !== "ai-process-flow-video" || !video.hasAttribute("data-ai-process-video")) {
    throw new Error(`${label}: Process Flow video must expose the expected playback hooks`);
  }

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
  if (video.getAttribute("preload") !== "none") {
    throw new Error(`${label}: Process Flow video should not preload before the cover is clicked`);
  }

  const sources = video.querySelectorAll("source");
  const deferredSources = sources.map((source) => source.getAttribute("data-src"));
  if (!deferredSources.includes(videoPath)) {
    throw new Error(`${label}: Process Flow video must defer ${videoPath} until playback`);
  }
  if (sources.some((source) => source.hasAttribute("src"))) {
    throw new Error(`${label}: Process Flow video source should use data-src so it is loaded on demand`);
  }

  const cover = section.querySelector("[data-ai-process-video-cover]");
  if (!cover) {
    throw new Error(`${label}: Process Flow video needs an idle-state cover`);
  }
  if (cover.tagName !== "BUTTON" || cover.getAttribute("type") !== "button") {
    throw new Error(`${label}: Process Flow video cover should be a button`);
  }
  if (cover.getAttribute("aria-controls") !== "ai-process-flow-video") {
    throw new Error(`${label}: Process Flow video cover must control the video element`);
  }

  for (const selector of [".ai-process-video-tag", ".ai-process-video-play", ".ai-process-video-label"]) {
    if (!cover.querySelector(selector)) {
      throw new Error(`${label}: Process Flow video cover is missing ${selector}`);
    }
  }
  const idleLabel = cover.querySelector(".ai-process-video-label")?.text.trim();
  if (idleLabel !== "AI PROCESS LINE READY") {
    throw new Error(`${label}: Process Flow idle label should read AI PROCESS LINE READY`);
  }
  if (/PROCESS VIDEO READY/i.test(cover.text)) {
    throw new Error(`${label}: Process Flow idle label should not use the old PROCESS VIDEO READY copy`);
  }
  const monitorTag = cover.querySelector(".ai-process-video-tag");
  const monitorMode = monitorTag?.querySelector("span")?.text.trim();
  const monitorScope = monitorTag?.querySelector("strong")?.text.trim();
  if (monitorMode !== "REC" || monitorScope !== "FLOW") {
    throw new Error(`${label}: Process Flow idle cover should match the single-video REC FLOW monitor state`);
  }
  if (/^CAM-\d{2}$/i.test(monitorScope)) {
    throw new Error(`${label}: Process Flow idle cover must not use a camera number for a single video`);
  }

  if (!section.querySelector(".ai-process-showcase")) {
    throw new Error(`${label}: Process Flow should render the optimized single-video showcase`);
  }

  if (section.querySelector(".ai-process-summary")) {
    throw new Error(`${label}: Process Flow should not render the removed text process summary`);
  }

}

const styles = fs.readFileSync(stylesFile, "utf8");
const videoBlock = extractCssBlock(styles, ".product-page-ai .ai-process-video");
if (!videoBlock.includes("--process-video-max-height: 660px;")) {
  throw new Error("styles.css: AI process video should match the construction process video maximum height");
}
if (!videoBlock.includes("--process-video-max-width: 1173.33px;")) {
  throw new Error("styles.css: AI process video should match the construction process video maximum width");
}
if (!videoBlock.includes("width: min(100%, var(--process-video-max-width));")) {
  throw new Error("styles.css: AI process video width should use the shared 16 / 9 max width");
}
if (!videoBlock.includes("max-height: var(--process-video-max-height);")) {
  throw new Error("styles.css: AI process video should cap height with the shared video maximum");
}
if (!videoBlock.includes("aspect-ratio: 16 / 9;")) {
  throw new Error("styles.css: AI process video should preserve a 16 / 9 frame");
}
if (!videoBlock.includes("background-image:")) {
  throw new Error("styles.css: AI process video should keep the original monitor-frame background");
}

const coverBlock = extractCssBlock(styles, ".product-page-ai .ai-process-video-cover");
if (!coverBlock.includes("background-image:")) {
  throw new Error("styles.css: AI process video cover should render the original scanline monitor state");
}
if (!styles.includes("[data-ai-process-video-state=\"playing\"] .ai-process-video-cover")) {
  throw new Error("styles.css: AI process video cover should hide once playback starts");
}

const coverTagBlock = extractCssBlock(styles, ".product-page-ai .ai-process-video-tag");
if (!coverTagBlock.includes("font-size: 0.9rem;")) {
  throw new Error("styles.css: AI process video REC/FLOW tag typography should be reduced to 0.9rem");
}
if (!coverTagBlock.includes("letter-spacing: 0;")) {
  throw new Error("styles.css: AI process video REC/FLOW tag letter spacing should stay compact");
}

const coverLabelBlock = extractCssBlock(styles, ".product-page-ai .ai-process-video-label");
if (!coverLabelBlock.includes("font-size: 0.88rem;")) {
  throw new Error("styles.css: AI process video idle label typography should be reduced to 0.88rem");
}
if (!coverLabelBlock.includes("letter-spacing: 0;")) {
  throw new Error("styles.css: AI process video idle label letter spacing should stay compact");
}

const script = fs.readFileSync(path.join(root, "public", "script.js"), "utf8");
if (!script.includes("data-ai-process-video-cover") || !script.includes("aiProcessVideoState")) {
  throw new Error("script.js: AI process video cover playback behavior is missing");
}
if (!script.includes("source[data-src]") || !script.includes("delete source.dataset.src")) {
  throw new Error("script.js: process videos should hydrate deferred sources only when playback is requested");
}

console.log("AI optical sorting Process Flow video check passed.");
