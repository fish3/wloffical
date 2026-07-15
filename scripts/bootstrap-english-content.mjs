import path from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parse } from "node-html-parser";
import { routes } from "../src/site-manifest.mjs";

const routeByOutputUrl = new Map(routes.map((route) => [`/${route.output}`, route]));

function splitReference(value) {
  const match = value.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  return { pathname: match?.[1] || "", search: match?.[2] || "", hash: match?.[3] || "" };
}

function normalizeReference(value, route) {
  if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) return value;
  const { pathname, search, hash } = splitReference(value);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(`/${route.output}`), pathname));
  const linkedRoute = routeByOutputUrl.get(resolved);
  return `${linkedRoute ? linkedRoute.url : resolved}${search}${hash}`;
}

function normalizeMain(main, route) {
  for (const element of main.querySelectorAll("*")) {
    for (const attribute of ["href", "src", "poster", "action"]) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, normalizeReference(value, route));
    }
  }
  return main.toString();
}

for (const route of routes) {
  const source = await readFile(path.resolve("public", route.output), "utf8");
  const document = parse(source);
  const main = document.querySelector("main");
  if (!main) throw new Error(`${route.output} has no main element`);
  const meta = {
    title: document.querySelector("title")?.textContent.trim() || route.id,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "",
    ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "",
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "",
  };
  const content = {
    meta,
    pageTitle: main.querySelector("h1")?.textContent.replace(/\s+/g, " ").trim() || meta.title,
    bodyHtml: normalizeMain(main, route),
  };
  const contentFile = path.resolve("src/content/en", `${route.id}.json`);
  const templateFile = path.resolve("src/templates", route.template);
  await mkdir(path.dirname(contentFile), { recursive: true });
  await mkdir(path.dirname(templateFile), { recursive: true });
  await writeFile(contentFile, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  await writeFile(templateFile, `{% extends "layouts/base.njk" %}\n{% block content %}{{ bodyHtml | safe }}{% endblock %}\n`, "utf8");
}

console.log(`Migrated ${routes.length} English pages into structured content.`);
