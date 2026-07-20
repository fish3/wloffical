import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import nunjucks from "nunjucks";
import { parse } from "node-html-parser";
import { routes } from "../src/site-manifest.mjs";
import { uiCopy } from "../src/ui-copy.mjs";
import { getAlternates, getBuildTargets, loadContent, localizedUrl } from "./lib/i18n.mjs";

const site = { origin: "https://weilanrecycling.com" };
const routeByUrl = new Map(routes.map((route) => [route.url, route]));
const env = nunjucks.configure(path.resolve("src/templates"), { autoescape: true, noCache: true });
env.addFilter("dump", (value) => JSON.stringify(value));

function localizeReference(value, locale) {
  if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) return value;
  const match = value.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const pathname = match?.[1] || "";
  const route = routeByUrl.get(pathname === "/" ? "/" : pathname.replace(/\/$/, ""));
  if (!route) return value;
  return `${localizedUrl(route, locale)}${match?.[2] || ""}${match?.[3] || ""}`;
}

function localizeBody(bodyHtml, locale) {
  const root = parse(bodyHtml);
  for (const element of root.querySelectorAll("[href]")) {
    element.setAttribute("href", localizeReference(element.getAttribute("href"), locale));
  }
  return root.toString();
}

function makeNavigation(target) {
  const navRoutes = ["home", "about", "products", "solutions", "service-support", "resources", "contact"];
  const labelKeys = ["home", "about", "products", "solutions", "service", "resources", "contact"];
  const items = navRoutes.map((id, index) => {
    const route = routes.find((candidate) => candidate.id === id);
    return { id, label: uiCopy[target.locale.code][labelKeys[index]], url: localizedUrl(route, target.locale), active: target.route.id === id || target.route.id.startsWith(`${id}-`) };
  });
  const byId = (id) => ({ url: localizedUrl(routes.find((route) => route.id === id), target.locale) });
  return { items, home: byId("home"), about: byId("about"), products: byId("products"), solutions: byId("solutions"), service: byId("service-support"), resources: byId("resources"), contact: byId("contact"), cases: byId("case-studies") };
}

function makeStructuredData(target, content) {
  return {
    "@context": "https://schema.org",
    "@type": target.route.id === "home" ? "Organization" : "WebPage",
    name: target.route.id === "home" ? uiCopy[target.locale.code].organizationName : content.pageTitle,
    alternateName: target.route.id === "home" ? uiCopy[target.locale.code].brandName : undefined,
    url: `${site.origin}${target.url}`,
    description: target.route.id === "home" ? uiCopy[target.locale.code].organizationDescription : content.meta.description,
  };
}

for (const target of getBuildTargets()) {
  const content = await loadContent(target.route.id, target.locale);
  const alternates = getAlternates(target.route);
  const bodyHtml = localizeBody(content.bodyHtml, target.locale);
  const html = env.render(target.route.template, {
    ...target,
    content,
    bodyHtml,
    alternates,
    site,
    ui: uiCopy[target.locale.code],
    navigation: makeNavigation(target),
    structuredData: makeStructuredData(target, content),
  });
  const output = path.resolve("public", target.outputPath);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${html.trim()}\n`, "utf8");
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const sitemapEntries = getBuildTargets().map((target) => {
  const alternates = getAlternates(target.route);
  const alternateLinks = [
    ...alternates.map((alternate) => ({ hreflang: alternate.code, url: alternate.url })),
    { hreflang: "x-default", url: alternates[0].url },
  ].map(({ hreflang, url }) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(`${site.origin}${url}`)}"/>`).join("\n");

  return [
    "  <url>",
    `    <loc>${escapeXml(`${site.origin}${target.url}`)}</loc>`,
    alternateLinks,
    "  </url>",
  ].join("\n");
}).join("\n");

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  sitemapEntries,
  "</urlset>",
  "",
].join("\n");
await writeFile(path.resolve("public/sitemap.xml"), sitemap, "utf8");

console.log(`Generated ${getBuildTargets().length} localized HTML pages.`);
