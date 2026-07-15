const SUPPORTED_LOCALES = new Set(["en", "zh-CN", "zh-Hant"]);
const COUNTRY_LOCALE = new Map([
  ["CN", "zh-CN"],
  ["HK", "zh-Hant"],
  ["MO", "zh-Hant"],
  ["TW", "zh-Hant"],
]);
const CRAWLER_PATTERN = /(?:googlebot|bingbot|baiduspider|yandexbot|duckduckbot|slurp|sogou|bytespider|facebookexternalhit|twitterbot|linkedinbot)/i;
const STATIC_FILE_PATTERN = /\.(?:css|js|mjs|json|xml|txt|ico|png|jpe?g|gif|webp|svg|avif|woff2?|ttf|mp4|webm|pdf)$/i;

export function normalizeLocale(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  if (normalized === "en") return "en";
  if (normalized === "zh-cn" || normalized === "zh-hans") return "zh-CN";
  if (normalized === "zh-hant" || normalized === "zh-tw") return "zh-Hant";
  return null;
}

export function localeFromCountry(country) {
  return COUNTRY_LOCALE.get(String(country || "").toUpperCase()) || "en";
}

export function localeFromPath(pathname) {
  const firstSegment = String(pathname || "").replace(/^\/+/, "").split("/")[0].toLowerCase();
  if (firstSegment === "zh-cn") return "zh-CN";
  if (firstSegment === "zh-hant") return "zh-Hant";
  return null;
}

export function parseLocaleCookie(cookieHeader) {
  if (typeof cookieHeader !== "string") return null;
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === "wl_locale") return normalizeLocale(decodeURIComponent(valueParts.join("=")));
  }
  return null;
}

export function localizedPath(pathname, locale) {
  const targetLocale = normalizeLocale(locale);
  if (!SUPPORTED_LOCALES.has(targetLocale)) return pathname;
  const rawPath = String(pathname || "/");
  const withoutPrefix = rawPath.replace(/^\/(?:zh-cn|zh-hant)(?=\/|$)/i, "") || "/";
  if (targetLocale === "en") return withoutPrefix.startsWith("/") ? withoutPrefix : `/${withoutPrefix}`;
  const prefix = targetLocale === "zh-CN" ? "/zh-cn" : "/zh-hant";
  return withoutPrefix === "/" ? `${prefix}/` : `${prefix}${withoutPrefix.startsWith("/") ? withoutPrefix : `/${withoutPrefix}`}`;
}

export function shouldBypassLocale({ pathname = "/", userAgent = "" } = {}) {
  const normalizedPath = pathname.toLowerCase();
  if (normalizedPath === "/robots.txt" || normalizedPath === "/sitemap.xml") return true;
  if (normalizedPath.startsWith("/api/") || normalizedPath.startsWith("/assets/")) return true;
  if (STATIC_FILE_PATTERN.test(normalizedPath)) return true;
  return CRAWLER_PATTERN.test(userAgent);
}

export function resolveLocale({ query, path, cookie, country } = {}) {
  return normalizeLocale(query)
    || normalizeLocale(path)
    || normalizeLocale(cookie)
    || localeFromCountry(country);
}
