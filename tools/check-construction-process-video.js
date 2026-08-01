const fs = require("fs");
const path = require("path");
const { parse } = require("node-html-parser");

const root = path.join(__dirname, "..");
const videoPath = "/assets/video/Lion1_flow.mp4";
const posterPath = "/assets/images/Lion1_flow.png";
const oldVideoPath = "/assets/video/Lion1_boom.mp4";
const oldQuicktimePath = "/assets/video/Lion1_boom.MOV";
const videoFile = path.join(root, "public", "assets", "video", "Lion1_flow.mp4");
const posterFile = path.join(root, "public", "assets", "images", "Lion1_flow.png");
const stylesFile = path.join(root, "public", "styles.css");
const maxVideoBytes = 32 * 1024 * 1024;

const targets = [
  [
    "source en",
    "src/content/en/product-construction-waste.json",
    "json",
    "C&D process video",
    "Crushing, screening, conveying, separation, and recovery in one operating view",
  ],
  [
    "source zh-CN",
    "src/content/zh-cn/product-construction-waste.json",
    "json",
    "C&D 工艺视频",
    "破碎、筛分、输送、分离与资源化回收的一体化运行视图",
  ],
  [
    "source zh-Hant",
    "src/content/zh-hant/product-construction-waste.json",
    "json",
    "C&D 工藝影片",
    "破碎、篩分、輸送、分離與資源化回收的一體化運行視圖",
  ],
  [
    "public en",
    "public/products/construction-waste-recycling-line.html",
    "html",
    "C&D process video",
    "Crushing, screening, conveying, separation, and recovery in one operating view",
  ],
  [
    "public zh-CN",
    "public/zh-cn/products/construction-waste-recycling-line.html",
    "html",
    "C&D 工艺视频",
    "破碎、筛分、输送、分离与资源化回收的一体化运行视图",
  ],
  [
    "public zh-Hant",
    "public/zh-hant/products/construction-waste-recycling-line.html",
    "html",
    "C&D 工藝影片",
    "破碎、篩分、輸送、分離與資源化回收的一體化運行視圖",
  ],
];

if (!fs.existsSync(videoFile)) {
  throw new Error(`Missing construction process video asset: ${videoFile}`);
}
if (!fs.existsSync(posterFile)) {
  throw new Error(`Missing construction process poster asset: ${posterFile}`);
}
if (fs.statSync(videoFile).size > maxVideoBytes) {
  throw new Error("Construction process video should be web-compressed below 32MB");
}

const videoHeader = fs.readFileSync(videoFile).subarray(0, 1024 * 1024).toString("latin1");
const moovIndex = videoHeader.indexOf("moov");
const mdatIndex = videoHeader.indexOf("mdat");
if (moovIndex === -1 || mdatIndex === -1 || moovIndex > mdatIndex) {
  throw new Error("Construction process video should be fast-start encoded with moov before mdat");
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

for (const [label, relativePath, kind, expectedCaptionLabel, expectedCaptionText] of targets) {
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
  if (video.getAttribute("id") !== "construction-process-flow-video" || !video.hasAttribute("data-process-video")) {
    throw new Error(`${label}: Process Flow video must expose the shared playback hooks`);
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
  if (deferredSources.includes(oldVideoPath) || deferredSources.includes(oldQuicktimePath)) {
    throw new Error(`${label}: Process Flow video must not include the old Lion1_boom video sources`);
  }
  if (video.getAttribute("poster") !== posterPath) {
    throw new Error(`${label}: Process Flow video poster must be ${posterPath}`);
  }

  if (section.querySelector("[data-ai-process-video-frame], [data-ai-process-video], [data-ai-process-video-cover]")) {
    throw new Error(`${label}: construction Process Flow must not use AI-specific playback hook names`);
  }
  if (section.querySelector(".ai-process-caption")) {
    throw new Error(`${label}: construction Process Flow must not reuse AI-specific caption class names`);
  }

  const frame = section.querySelector("[data-process-video-frame]");
  if (!frame) {
    throw new Error(`${label}: Process Flow video should use the shared idle-state frame wrapper`);
  }
  if (frame.getAttribute("data-process-video-state") !== "idle") {
    throw new Error(`${label}: Process Flow video frame should initialize in the idle state`);
  }

  const cover = section.querySelector("[data-process-video-cover]");
  if (!cover) {
    throw new Error(`${label}: Process Flow video needs an idle-state cover`);
  }
  if (cover.tagName !== "BUTTON" || cover.getAttribute("type") !== "button") {
    throw new Error(`${label}: Process Flow video cover should be a button`);
  }
  if (cover.getAttribute("aria-controls") !== "construction-process-flow-video") {
    throw new Error(`${label}: Process Flow video cover must control the construction video element`);
  }
  for (const selector of [
    ".construction-process-video-tag",
    ".construction-process-video-play",
    ".construction-process-video-label",
  ]) {
    if (!cover.querySelector(selector)) {
      throw new Error(`${label}: Process Flow video cover is missing ${selector}`);
    }
  }
  const coverTag = cover.querySelector(".construction-process-video-tag");
  if (coverTag?.querySelector("span")?.text.trim().toUpperCase() !== "C&D" ||
      coverTag?.querySelector("strong")?.text.trim().toUpperCase() !== "LINE") {
    throw new Error(`${label}: Process Flow idle cover should use construction-line C&D LINE labeling`);
  }
  if (/\bREC\b|PROCESS VIDEO READY/i.test(cover.text)) {
    throw new Error(`${label}: Process Flow idle cover should not reuse AI process monitor copy`);
  }

  const caption = section.querySelector(".construction-process-caption");
  if (!caption) {
    throw new Error(`${label}: Process Flow video needs a caption below the video`);
  }
  if (caption.querySelector("span")?.text.trim() !== expectedCaptionLabel) {
    throw new Error(`${label}: Process Flow caption label should be "${expectedCaptionLabel}"`);
  }
  if (caption.querySelector("strong")?.text.trim() !== expectedCaptionText) {
    throw new Error(`${label}: Process Flow caption text should describe the construction recycling operating view`);
  }
  if (/AI recognition|optical sorting|PROCESS VIDEO READY|\bREC\b/i.test(caption.text)) {
    throw new Error(`${label}: Process Flow caption should not reuse AI process wording`);
  }

  if (/Video coming soon|视频即将发布|影片即将推出|影片即將推出/i.test(section.toString())) {
    throw new Error(`${label}: Process Flow still contains placeholder video copy`);
  }

  const comparisonSection = document.querySelector(".product-compare-section");
  if (!comparisonSection) {
    throw new Error(`${label}: comparison section is missing`);
  }
  if (comparisonSection.querySelector(".product-compare-explode-stats")) {
    throw new Error(`${label}: comparison media should not render the Footprint / Capacity / Install summary cards`);
  }
  const comparisonMediaCaption = comparisonSection.querySelector(".product-compare-explode figcaption");
  if (comparisonMediaCaption &&
      /Footprint[\s\S]*35|Capacity[\s\S]*20-70|Install[\s\S]*2-3|占地[\s\S]*35|产能[\s\S]*20-70|安装[\s\S]*2-3|佔地[\s\S]*35|產能[\s\S]*20-70|安裝[\s\S]*2-3/i.test(comparisonMediaCaption.toString())) {
    throw new Error(`${label}: comparison section still contains the removed media summary values`);
  }
}

const styles = fs.readFileSync(stylesFile, "utf8");
const processVideoBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video");
if (!processVideoBlock.includes("--process-video-max-height: 660px;")) {
  throw new Error("styles.css: construction process video should preserve the previous 660px maximum height");
}
if (!processVideoBlock.includes("--process-video-max-width: 1173.33px;")) {
  throw new Error("styles.css: construction process video max width should be the 16 / 9 width for a 660px frame");
}
if (!processVideoBlock.includes("width: min(100%, var(--process-video-max-width));")) {
  throw new Error("styles.css: construction process video width should use the 16 / 9 max width");
}
if (!processVideoBlock.includes("max-height: var(--process-video-max-height);")) {
  throw new Error("styles.css: construction process video should cap height at the preserved maximum");
}
if (!processVideoBlock.includes("aspect-ratio: 16 / 9;")) {
  throw new Error("styles.css: construction process video should use an explicit 16 / 9 ratio");
}
if (processVideoBlock.includes("width: min(100%, 880px);") ||
    processVideoBlock.includes("aspect-ratio: 4 / 3;") ||
    processVideoBlock.includes("aspect-ratio: 9 / 16;")) {
  throw new Error("styles.css: construction process video should not keep the previous 4 / 3 or portrait sizing");
}
if (!processVideoBlock.includes("margin: clamp(22px, 3vw, 34px) auto 0;")) {
  throw new Error("styles.css: construction process video should use a tighter top margin");
}
if (!processVideoBlock.includes("background-image:")) {
  throw new Error("styles.css: construction process video should render an industrial steel-frame background");
}
if (!processVideoBlock.includes("border: 1px solid rgba(214, 16, 56, 0.36);") ||
    !processVideoBlock.includes("inset 0 0 0 3px rgba(8, 12, 18, 0.72)")) {
  throw new Error("styles.css: construction process video should use a medium industrial steel frame");
}
if (processVideoBlock.includes("border-left: 6px solid rgba(214, 16, 56, 0.82);")) {
  throw new Error("styles.css: construction process video left edge should match the right frame, without a red vertical bar");
}
if (processVideoBlock.includes("outline: 8px solid") || processVideoBlock.includes("0 8px 0 rgba")) {
  throw new Error("styles.css: construction process video frame should not use the previous heavy raised treatment");
}

const frameStatusBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video::before");
if (!frameStatusBlock.includes("repeating-linear-gradient(135deg") ||
    !frameStatusBlock.includes("height: 7px;")) {
  throw new Error("styles.css: construction process video should use a restrained top rail");
}
if (frameStatusBlock.includes("5px 100%") ||
    frameStatusBlock.includes("linear-gradient(180deg, rgba(214, 16, 56, 0.86), rgba(137, 154, 164, 0.38))")) {
  throw new Error("styles.css: construction process video should not render a left-side status stripe");
}

if (styles.includes(".product-page-industrial .construction-process-video::after") ||
    styles.includes("linear-gradient(to right, rgba(214, 16, 56, 0.62)") ||
    styles.includes("linear-gradient(to bottom, rgba(214, 16, 56, 0.62)")) {
  throw new Error("styles.css: construction process video should not render an inner frame overlay");
}

const coverBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video-cover");
if (!coverBlock.includes("background-image:")) {
  throw new Error("styles.css: construction process video cover should render the industrial idle equipment state");
}
if (!coverBlock.includes("repeating-linear-gradient(0deg") ||
    !coverBlock.includes("repeating-linear-gradient(90deg") ||
    !coverBlock.includes("repeating-linear-gradient(135deg") ||
    !coverBlock.includes("linear-gradient(180deg, rgba(18, 25, 32, 0.96) 0%, rgba(8, 12, 18, 0.96) 100%)") ||
    coverBlock.includes("radial-gradient(circle at 50% 50%")) {
  throw new Error("styles.css: construction process video cover should render a steel-plate idle state without AI monitor focus effects");
}
if (!styles.includes("[data-process-video-state=\"playing\"] .construction-process-video-cover")) {
  throw new Error("styles.css: construction process video cover should hide once playback starts");
}

if (styles.includes(".product-page-industrial .construction-process-video-cover::before") ||
    styles.includes("border-top: 5px solid rgba(214, 16, 56, 0.62);") ||
    styles.includes("radial-gradient(circle at 16px 16px")) {
  throw new Error("styles.css: construction process video cover should not render an inner plate frame");
}

const coverRailBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video-cover::after");
if (!coverRailBlock.includes("repeating-linear-gradient(135deg") ||
    !coverRailBlock.includes("height: 6px;") ||
    !coverRailBlock.includes("opacity: 0.58;")) {
  throw new Error("styles.css: construction process video cover should use a compact industrial warning rail");
}

const coverTagBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video-tag");
const coverTagTextBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video-tag span");
if (!coverTagBlock.includes("background: linear-gradient(180deg, rgba(24, 32, 42, 0.82) 0%, rgba(8, 12, 18, 0.74) 100%);") ||
    !coverTagBlock.includes("inset 4px 0 0 rgba(214, 16, 56, 0.82)") ||
    !coverTagTextBlock.includes("var(--color-red)")) {
  throw new Error("styles.css: construction process video C&D LINE tag should use the industrial red accent");
}

const coverTagMarkerBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video-tag::before");
if (coverTagMarkerBlock.includes("border-radius: 50%;") ||
    !coverTagMarkerBlock.includes("height: 14px;") ||
    !coverTagMarkerBlock.includes("repeating-linear-gradient(135deg")) {
  throw new Error("styles.css: construction process tag marker should be a nameplate notch, not an AI recording dot");
}

const playBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video-play");
if (!playBlock.includes("width: clamp(74px, 8vw, 108px);") ||
    !playBlock.includes("height: clamp(48px, 5.4vw, 62px);") ||
    !playBlock.includes("border-radius: 8px;") ||
    !playBlock.includes("background-color: rgba(8, 12, 18, 0.74);") ||
    !playBlock.includes("transition: background-color 140ms cubic-bezier(0.23, 1, 0.32, 1), border-color 140ms cubic-bezier(0.23, 1, 0.32, 1), transform 140ms cubic-bezier(0.23, 1, 0.32, 1);") ||
    playBlock.includes("border-radius: 50%;") ||
    playBlock.includes("inset 0 0 0 6px") ||
    playBlock.includes("inset 0 0 0 10px") ||
    playBlock.includes("0 0 28px rgba(214, 16, 56") ||
    playBlock.includes("clip-path: polygon")) {
  throw new Error("styles.css: construction process play button should be a minimal rounded-rectangle control");
}
if (styles.includes(".product-page-industrial .construction-process-video-play::before")) {
  throw new Error("styles.css: construction process play button should not include extra inner-ring chrome");
}
const playIconBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-video-play::after");
if (!playIconBlock.includes("border-left: clamp(14px, 2vw, 20px) solid rgba(234, 241, 245, 0.88);") ||
    playIconBlock.includes("filter:") ||
    playIconBlock.includes("drop-shadow")) {
  throw new Error("styles.css: construction process play icon should stay clean inside the minimal button");
}
if (!styles.includes(".product-page-industrial .construction-process-video-cover:active .construction-process-video-play")) {
  throw new Error("styles.css: construction process video cover should provide tactile press feedback");
}

const captionBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-caption");
if (!captionBlock.includes("display: flex;") ||
    !captionBlock.includes("flex-wrap: wrap;") ||
    !captionBlock.includes("justify-content: center;") ||
    !captionBlock.includes("max-width: min(100%, 880px);") ||
    !captionBlock.includes("margin: clamp(14px, 2vw, 20px) auto 0;") ||
    !captionBlock.includes("text-align: center;")) {
  throw new Error("styles.css: construction process caption should align below the video like the AI process caption");
}
const captionLabelBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-caption span");
if (!captionLabelBlock.includes("font-family: ui-monospace, \"SF Mono\", Menlo, Consolas, monospace;") ||
    !captionLabelBlock.includes("letter-spacing: 0.14em;") ||
    !captionLabelBlock.includes("text-transform: uppercase;")) {
  throw new Error("styles.css: construction process caption label should use the compact industrial mono label treatment");
}
const captionStrongBlock = extractCssBlock(styles, ".product-page-industrial .construction-process-caption strong");
if (!captionStrongBlock.includes("color: #eaf1f5;") ||
    !captionStrongBlock.includes("font-weight: 800;")) {
  throw new Error("styles.css: construction process caption should emphasize the operating-view description");
}

const script = fs.readFileSync(path.join(root, "public", "script.js"), "utf8");
if (!script.includes("data-process-video-cover") || !script.includes("processVideoState")) {
  throw new Error("script.js: shared process video cover playback behavior is missing");
}
if (!script.includes("source[data-src]") || !script.includes("delete source.dataset.src")) {
  throw new Error("script.js: process videos should hydrate deferred sources only when playback is requested");
}

console.log("Construction process video check passed.");
