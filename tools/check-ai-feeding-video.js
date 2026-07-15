const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "..", "public", "products", "ai-optical-sorting.html");
const page = fs.readFileSync(pagePath, "utf8");
const heading = "<h3>Feeding</h3>";
const headingIndex = page.indexOf(heading);

if (headingIndex === -1) {
  throw new Error("Feeding process step is missing");
}

const stepStart = page.lastIndexOf('<li class="process-timeline-step">', headingIndex);
const stepEnd = page.indexOf("</li>", headingIndex);
const feedingStep = page.slice(stepStart, stepEnd);

function assertIncludes(needle, label) {
  if (!feedingStep.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

assertIncludes('aria-label="Feeding process video"', "Feeding video description");
assertIncludes("<video", "Native Feeding video");
assertIncludes("controls", "Native playback controls");
assertIncludes("playsinline", "Inline mobile playback");
assertIncludes('preload="metadata"', "Metadata-only preload");
assertIncludes('src="../assets/video/AI上料.mp4"', "Feeding MP4 source");
assertIncludes('type="video/mp4"', "Feeding MP4 MIME type");

if (/\b(?:autoplay|loop)\b/.test(feedingStep)) {
  throw new Error("Feeding video must require user playback and must not loop");
}

const videoPath = path.join(__dirname, "..", "public", "assets", "video", "AI上料.mp4");
if (!fs.existsSync(videoPath)) {
  throw new Error(`Feeding video file is missing: ${videoPath}`);
}

console.log("AI optical sorting Feeding video check passed.");
