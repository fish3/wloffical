const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "..", "public", "products", "ai-optical-sorting.html");
const page = fs.readFileSync(pagePath, "utf8");
const heading = "<h3>Material sorting</h3>";
const headingIndex = page.indexOf(heading);

if (headingIndex === -1) {
  throw new Error("Material sorting process step is missing");
}

const stepStart = page.lastIndexOf('<li class="process-timeline-step">', headingIndex);
const stepEnd = page.indexOf("</li>", headingIndex);
const materialSortingStep = page.slice(stepStart, stepEnd);

function assertIncludes(needle, label) {
  if (!materialSortingStep.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

assertIncludes('aria-label="Material sorting process video"', "Material sorting video description");
assertIncludes("<video", "Native Material sorting video");
assertIncludes("controls", "Native playback controls");
assertIncludes("playsinline", "Inline mobile playback");
assertIncludes('preload="metadata"', "Metadata-only preload");
assertIncludes('src="../assets/video/AI分拣.mp4"', "Material sorting MP4 source");
assertIncludes('type="video/mp4"', "Material sorting MP4 MIME type");

if (/\b(?:autoplay|loop)\b/.test(materialSortingStep)) {
  throw new Error("Material sorting video must require user playback and must not loop");
}

const videoPath = path.join(__dirname, "..", "public", "assets", "video", "AI分拣.mp4");
if (!fs.existsSync(videoPath)) {
  throw new Error(`Material sorting video file is missing: ${videoPath}`);
}

console.log("AI optical sorting Material sorting video check passed.");
