import path from "node:path";
import { readFile } from "node:fs/promises";
import { locales } from "../../src/locales.mjs";
import { routes } from "../../src/site-manifest.mjs";

export function localizedUrl(route, locale) {
  if (!locale.prefix) return route.url;
  return route.url === "/" ? `/${locale.prefix}/` : `/${locale.prefix}${route.url}`;
}

export function localizedOutput(route, locale) {
  return locale.prefix ? path.posix.join(locale.prefix, route.output) : route.output;
}

export function getAlternates(route) {
  return locales.map((locale) => ({
    ...locale,
    url: localizedUrl(route, locale),
    switchUrl: `${route.url}?locale=${encodeURIComponent(locale.code)}`,
  }));
}

export async function loadContent(routeId, locale) {
  const fileUrl = new URL(`../../src/content/${locale.contentDir}/${routeId}.json`, import.meta.url);
  return JSON.parse(await readFile(fileUrl, "utf8"));
}

export function getBuildTargets() {
  return locales.flatMap((locale) => routes.map((route) => ({
    locale,
    route,
    outputPath: localizedOutput(route, locale),
    url: localizedUrl(route, locale),
  })));
}
