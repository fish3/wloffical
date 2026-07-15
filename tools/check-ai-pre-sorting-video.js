const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "..", "public", "products", "ai-optical-sorting.html");
const page = fs.readFileSync(pagePath, "utf8");
const heading = "<h3>Pre-sorting</h3>";
const headingIndex = page.indexOf(heading);

if (headingIndex === -1) {
  throw new Error("Pre-sorting process step is missing");
}

const stepStart = page.lastIndexOf('<li class="process-timeline-step">', headingIndex);
const stepEnd = page.indexOf("</li>", headingIndex);
const preSortingStep = page.slice(stepStart, stepEnd);

function assertIncludes(needle, label) {
  if (!preSortingStep.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

assertIncludes('aria-label="Pre-sorting process video"', "Pre-sorting video description");
assertIncludes(
  "Identify and separate metal containers from bottles made of other materials before downstream sorting.",
  "Pre-sorting process description",
);
assertIncludes("<video", "Native Pre-sorting video");
assertIncludes("controls", "Native playback controls");
assertIncludes("playsinline", "Inline mobile playback");
assertIncludes('preload="metadata"', "Metadata-only preload");
assertIncludes('src="../assets/video/AI预分.mp4"', "Pre-sorting MP4 source");
assertIncludes('type="video/mp4"', "Pre-sorting MP4 MIME type");

if (/\b(?:autoplay|loop)\b/.test(preSortingStep)) {
  throw new Error("Pre-sorting video must require user playback and must not loop");
}

const videoPath = path.join(__dirname, "..", "public", "assets", "video", "AI预分.mp4");
if (!fs.existsSync(videoPath)) {
  throw new Error(`Pre-sorting video file is missing: ${videoPath}`);
}

console.log("AI optical sorting Pre-sorting video check passed.");
