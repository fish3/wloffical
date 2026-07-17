import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "node-html-parser";
import { routes } from "../src/site-manifest.mjs";

const AUTH_URL = "https://edge.microsoft.com/translate/auth";
const TRANSLATE_URL = "https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=zh-Hans&to=zh-Hant";
const TARGETS = [
  { code: "zh-Hans", directory: "zh-cn" },
  { code: "zh-Hant", directory: "zh-hant" },
];

const protectedPattern = /(?:WEI(?:\s|&nbsp;)+LAN|Ningbo Wei Lan Environmental Protection Technology Co\., Ltd\.|Lion One|GL01V(?:1-5|2-9|3-10)?|GREATWALL HEAVY INDUSTRY MK-F50|GREATWALL HAVEY INDUSTRY MK-F50|PET|HDPE|PP|MRF|PLC|DCS|IoT|AI|ISO\s?\d+(?::\d+)?|(?:\+?86[-\s]?)?137[-\s]8001[-\s]2268|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b\d+(?:\.\d+)?(?:\s*(?:-|–|&ndash;)\s*\d+(?:\.\d+)?)?\s*(?:t\/h|kW|mm|m(?:²|&sup2;)?|days?|min|%|RMB)?\b)/giu;

function localizeChineseBrand(value, targetCode) {
  if (targetCode === "zh-Hans") {
    return value
      .replaceAll("Ningbo Wei Lan Environmental Protection Technology Co., Ltd.", "宁波蔚澜环保科技有限公司")
      .replace(/WEI(?:\s|&nbsp;)+LAN/gi, "蔚澜");
  }
  if (targetCode === "zh-Hant") {
    return value
      .replaceAll("Ningbo Wei Lan Environmental Protection Technology Co., Ltd.", "寧波蔚澜環保科技有限公司")
      .replace(/WEI(?:\s|&nbsp;)+LAN/gi, "蔚澜");
  }
  return value;
}

let token = "";
let tokenExpiresAt = 0;
const cache = new Map();

async function getToken() {
  if (token && Date.now() < tokenExpiresAt) return token;
  const response = await fetch(AUTH_URL);
  if (!response.ok) throw new Error(`Translation auth failed: ${response.status}`);
  token = (await response.text()).trim();
  tokenExpiresAt = Date.now() + 7 * 60 * 1000;
  return token;
}

function protect(value) {
  const values = [];
  const text = value.replace(protectedPattern, (match) => {
    const placeholder = `ZXQTERM${values.length}QXZ`;
    values.push(match);
    return placeholder;
  });
  return { text, values };
}

function restore(value, protectedValues) {
  return protectedValues.reduce((result, original, index) => {
    return result.replaceAll(`ZXQTERM${index}QXZ`, original);
  }, value);
}

function collectTranslatable(content) {
  const entries = [];
  const seen = new Set();
  const add = (value, setter) => {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (!normalized || !/[A-Za-z]/.test(normalized) || seen.has(normalized)) return;
    seen.add(normalized);
    entries.push({ value: normalized, setters: [setter] });
  };
  const addOrReuse = (value, setter) => {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (!normalized || !/[A-Za-z]/.test(normalized)) return;
    const existing = entries.find((entry) => entry.value === normalized);
    if (existing) existing.setters.push(setter);
    else add(normalized, setter);
  };

  for (const key of ["title", "description", "ogTitle", "ogDescription"]) {
    addOrReuse(content.meta[key], (translated) => { content.meta[key] = translated; });
  }
  addOrReuse(content.pageTitle, (translated) => { content.pageTitle = translated; });

  const document = parse(content.bodyHtml);
  const visit = (node) => {
    if (node.nodeType === 3) {
      const raw = node.rawText;
      if (/[A-Za-z]/.test(raw)) {
        const leading = raw.match(/^\s*/)?.[0] || "";
        const trailing = raw.match(/\s*$/)?.[0] || "";
        addOrReuse(raw, (translated) => { node.rawText = `${leading}${translated}${trailing}`; });
      }
      return;
    }
    if (node.nodeType !== 1) return;
    for (const attribute of ["alt", "aria-label", "placeholder", "title"]) {
      const value = node.getAttribute(attribute);
      if (value && /[A-Za-z]/.test(value)) {
        addOrReuse(value, (translated) => node.setAttribute(attribute, translated));
      }
    }
    node.childNodes.forEach(visit);
  };
  visit(document);

  return { entries, serialize: () => document.toString() };
}

async function translateBatch(batch) {
  const uncached = batch.filter((entry) => !cache.has(entry.value));
  if (uncached.length) {
    const protectedEntries = uncached.map((entry) => ({ entry, ...protect(entry.value) }));
    const response = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(protectedEntries.map(({ text }) => ({ Text: text }))),
    });
    if (!response.ok) throw new Error(`Translation request failed: ${response.status} ${await response.text()}`);
    const translated = await response.json();
    translated.forEach((result, index) => {
      const source = protectedEntries[index];
      const translations = Object.fromEntries(result.translations.map((item) => [
        item.to,
        localizeChineseBrand(restore(item.text, source.values), item.to),
      ]));
      cache.set(source.entry.value, translations);
    });
  }
  return batch.map((entry) => ({ entry, translations: cache.get(entry.value) }));
}

for (const route of routes) {
  const source = JSON.parse(await readFile(path.resolve("src/content/en", `${route.id}.json`), "utf8"));
  const localized = Object.fromEntries(TARGETS.map((target) => [target.code, structuredClone(source)]));
  const collectors = Object.fromEntries(TARGETS.map((target) => [target.code, collectTranslatable(localized[target.code])]));
  const entries = collectors["zh-Hans"].entries;

  for (let index = 0; index < entries.length; index += 80) {
    const translatedBatch = await translateBatch(entries.slice(index, index + 80));
    for (const { entry, translations } of translatedBatch) {
      for (const target of TARGETS) {
        const targetEntry = collectors[target.code].entries.find((candidate) => candidate.value === entry.value);
        targetEntry?.setters.forEach((setter) => setter(translations[target.code]));
      }
    }
  }

  for (const target of TARGETS) {
    localized[target.code].bodyHtml = collectors[target.code].serialize();
    const output = path.resolve("src/content", target.directory, `${route.id}.json`);
    await writeFile(output, `${JSON.stringify(localized[target.code], null, 2)}\n`, "utf8");
  }
  console.log(`Translated ${route.id} (${entries.length} strings).`);
}

for (const target of TARGETS) {
  const maintenancePath = path.resolve("src/content", target.directory, "resource-maintenance-guide.json");
  const maintenance = JSON.parse(await readFile(maintenancePath, "utf8"));
  maintenance.pageTitle = target.code === "zh-Hans" ? "维护指南" : "維護指南";
  await writeFile(maintenancePath, `${JSON.stringify(maintenance, null, 2)}\n`, "utf8");
}

console.log(`Translated ${routes.length} routes into Simplified and Traditional Chinese.`);
