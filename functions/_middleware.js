import {
  localeFromPath,
  localizedPath,
  normalizeLocale,
  parseLocaleCookie,
  resolveLocale,
  shouldBypassLocale,
} from "./lib/locale.js";

const LOCALE_COOKIE = "wl_locale";
const ONE_YEAR_SECONDS = 31_536_000;

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || "";

  if (shouldBypassLocale({ pathname: url.pathname, userAgent })) return context.next();

  const queryValue = url.searchParams.get("locale");
  const queryLocale = normalizeLocale(queryValue);
  const explicitPathLocale = localeFromPath(url.pathname);
  const cookieLocale = parseLocaleCookie(request.headers.get("cookie"));
  const resolvedLocale = resolveLocale({
    query: queryValue,
    path: explicitPathLocale,
    cookie: cookieLocale,
    country: request.cf?.country,
  });

  if (queryLocale) {
    url.searchParams.delete("locale");
    url.pathname = localizedPath(url.pathname, queryLocale);
    const response = temporaryRedirect(url);
    response.headers.append(
      "Set-Cookie",
      localeCookie(queryLocale, url),
    );
    return response;
  }

  if (explicitPathLocale) return context.next();

  const targetPath = localizedPath(url.pathname, resolvedLocale);
  if (targetPath !== url.pathname) {
    url.pathname = targetPath;
    return temporaryRedirect(url);
  }

  return context.next();
}

function localeCookie(locale, url) {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${LOCALE_COOKIE}=${locale}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

function temporaryRedirect(url) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Cache-Control": "private, no-store",
    },
  });
}
