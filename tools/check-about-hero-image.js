const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "..", "public", "about.html");
const page = fs.readFileSync(pagePath, "utf8");
const heading = '<p class="eyebrow">About WEI LAN</p>';
const headingIndex = page.indexOf(heading);

if (headingIndex === -1) {
  throw new Error("About WEI LAN section is missing");
}

const sectionStart = page.lastIndexOf('<section class="section about-hero"', headingIndex);
const sectionEnd = page.indexOf("</section>", headingIndex);
const aboutHeroSection = page.slice(sectionStart, sectionEnd);

if (!aboutHeroSection.includes('src="assets/images/wl-company.png"')) {
  throw new Error('About WEI LAN image source must be assets/images/wl-company.png');
}

const imagePath = path.join(__dirname, "..", "public", "assets", "images", "wl-company.png");
if (!fs.existsSync(imagePath)) {
  throw new Error(`About WEI LAN image file is missing: ${imagePath}`);
}

console.log("About WEI LAN hero image check passed.");
