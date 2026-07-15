import path from "node:path";
import { access, readFile } from "node:fs/promises";
import { parse } from "node-html-parser";
import { getBuildTargets } from "./lib/i18n.mjs";

const PUBLIC_ROOT = path.resolve("public");
const SITE_ORIGIN = "https://weilanrecycling.com";
const targets = getBuildTargets();
const routeToTarget = new Map(targets.map((target) => [normalizeRoute(target.url), target]));
const failures = [];

function normalizeRoute(value) {
  const pathname = decodeURIComponent(value || "/");
  return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
}

function describe(source, attribute, value, message) {
  failures.push(`${source}: ${attribute}="${value}" ${message}`);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkReference(source, attribute, rawValue, document) {
  if (!rawValue || /^(?:mailto:|tel:|data:|javascript:)/i.test(rawValue) || rawValue.startsWith("#")) return;

  let url;
  try {
    url = new URL(rawValue, `${SITE_ORIGIN}${routeToTarget.get(normalizeRoute(source.replace(/^public/, "").replace(/\.html$/, "")))?.url || "/"}`);
  } catch {
    describe(source, attribute, rawValue, "is not a valid URL");
    return;
  }

  if (url.origin !== SITE_ORIGIN) return;
  if (url.pathname.startsWith("/api/")) return;

  if (attribute === "canonical" || attribute === "alternate") {
    if (!routeToTarget.has(normalizeRoute(url.pathname))) {
      describe(source, attribute, rawValue, "does not match a generated locale route");
    }
    return;
  }

  const linkedTarget = routeToTarget.get(normalizeRoute(url.pathname));
  if (linkedTarget) {
    if (url.hash) {
      const linkedHtml = linkedTarget.outputPath === source.replace(/^public\//, "")
        ? document
        : parse(await readFile(path.resolve(PUBLIC_ROOT, linkedTarget.outputPath), "utf8"));
      const fragment = decodeURIComponent(url.hash.slice(1));
      const hasFragment = linkedHtml.querySelectorAll("[id]").some((element) => element.getAttribute("id") === fragment);
      if (!hasFragment) {
        describe(source, attribute, rawValue, `points to missing fragment #${fragment}`);
      }
    }
    return;
  }

  const filePath = path.resolve(PUBLIC_ROOT, `.${decodeURIComponent(url.pathname)}`);
  if (!filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`) || !(await fileExists(filePath))) {
    describe(source, attribute, rawValue, "points to a missing local file or route");
  }
}

for (const target of targets) {
  const relativePath = target.outputPath;
  const source = `public/${relativePath}`;
  const html = await readFile(path.resolve(PUBLIC_ROOT, relativePath), "utf8");
  const document = parse(html);

  for (const element of document.querySelectorAll("[href], [src], [poster]")) {
    for (const attribute of ["href", "src", "poster"]) {
      if (element.hasAttribute(attribute)) await checkReference(source, attribute, element.getAttribute(attribute), document);
    }
  }
  for (const link of document.querySelectorAll('link[rel="canonical"]')) {
    await checkReference(source, "canonical", link.getAttribute("href"), document);
  }
  for (const link of document.querySelectorAll('link[rel="alternate"]')) {
    await checkReference(source, "alternate", link.getAttribute("href"), document);
  }
}

if (failures.length) {
  throw new Error(`Generated site check failed (${failures.length}):\n${failures.join("\n")}`);
}

console.log(`Generated site check passed: ${targets.length} HTML pages, local links, assets, and locale counterparts.`);
