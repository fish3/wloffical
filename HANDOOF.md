# WEI LAN Multilingual Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On 2026-07-14, add complete English, Simplified Chinese, and Traditional Chinese versions for all 23 public HTML pages, with a full-language-name switcher and first-visit locale selection based on Cloudflare IP country data.

**Architecture:** Keep the current English URLs canonical and generate localized static counterparts under `/zh-cn/` and `/zh-hant/` from shared Nunjucks templates and locale-specific content files. A small Cloudflare Pages middleware resolves the first-visit locale from an explicit switch request, locale URL, saved cookie, or IP country, in that order. The selected language always overrides later IP detection.

**Tech Stack:** Cloudflare Pages Functions, Node.js, Nunjucks, native `node:test`, `node-html-parser`, Playwright, existing HTML/CSS/JavaScript.

---

## 1. Handoff Summary

### Confirmed product decisions

- Launch languages: `English`, `简体中文`, and `繁體中文`.
- Coverage: all 23 current public HTML pages, producing 69 generated HTML files.
- Selected UI: option C, showing the full current language name rather than `EN / 简 / 繁` abbreviations.
- English remains at the current root URLs to avoid an unnecessary SEO migration.
- Simplified Chinese uses `/zh-cn/`; Traditional Chinese uses `/zh-hant/`.
- China mainland (`CN`) defaults to Simplified Chinese.
- Hong Kong (`HK`), Macau (`MO`), and Taiwan (`TW`) default to Traditional Chinese.
- Every other country defaults to English.
- IP detection runs only when the visitor has not explicitly selected a language.
- A manual language selection is stored for one year and always wins over IP detection.
- Traditional Chinese is its own reviewed copy set. Do not ship a character-only Simplified-to-Traditional conversion as final copy.

### Current repository state

- Branch at handoff: `dev1.0`.
- HEAD observed on 2026-07-13: `7e565c8 docs: specify related resources arrow alignment`.
- Hosting: Cloudflare Pages; current output directory is `public`.
- Current site: hand-authored static HTML with shared `public/styles.css` and `public/script.js`.
- Contact form: `functions/api/contact.js`, delivered through Resend.
- Responsive navigation switches to the mobile menu at `920px`; the current quote button hides below `640px`.
- Current sitemap contains the English routes only.

### Preserve these existing user changes

Do not revert, overwrite, or include these changes in unrelated commits:

- Modified: `.gitignore`
- Untracked: `tools/check-about-hero-image.js`
- Untracked: `tools/check-ai-feeding-video.js`
- Untracked: `tools/check-ai-material-sorting-video.js`
- Untracked: `tools/check-ai-pre-sorting-video.js`
- Untracked: `tools/check-construction-capacity-comparison.js`
- Untracked: `tools/check-construction-process-output-frame.js`
- Untracked: `tools/check-products-ai-media-fit.js`

The current `.gitignore` ignores `/tests`. This plan deliberately uses the singular `/test` directory so the new test suite can be tracked without changing the user's ignore rule.

The worktree remained active while this handoff was written. Treat the execution-time `git status --short` output as authoritative, and treat every new or changed file outside the active task as user-owned.

Run `git status --short` before every commit and stage only the files named by the current task.

## 2. Final Behavior Specification

### Locale URL matrix

| Locale | HTML `lang` | URL prefix | `hreflang` | Default countries |
| --- | --- | --- | --- | --- |
| English | `en` | none | `en` | all countries except those below |
| Simplified Chinese | `zh-CN` | `/zh-cn` | `zh-CN` | `CN` |
| Traditional Chinese | `zh-Hant` | `/zh-hant` | `zh-Hant` | `HK`, `MO`, `TW` |

For any English route such as `/products/ai-optical-sorting`, the localized counterparts must be:

```text
/products/ai-optical-sorting
/zh-cn/products/ai-optical-sorting
/zh-hant/products/ai-optical-sorting
```

The same route identity must be used by templates, the switcher, canonical tags, `hreflang`, and the sitemap. Do not derive counterpart URLs by editing arbitrary strings in the browser.

### Locale resolution order

Use this exact priority:

1. A valid `?locale=en`, `?locale=zh-CN`, or `?locale=zh-Hant` switch request.
2. An explicit `/zh-cn/` or `/zh-hant/` URL.
3. The valid `wl_locale` cookie.
4. `request.cf.country` mapped by the country rules above.
5. English fallback.

Rules:

- Consume a valid `?locale=` request, set the cookie, and issue a temporary redirect to the clean counterpart URL.
- Never use `301` or `308` for locale selection. Use `302` or `307` so a location change does not become permanent.
- Add `Cache-Control: private, no-store` to locale redirects to prevent one visitor's country result from being cached for another visitor.
- Locale-prefixed URLs are explicit and must not be redirected to another locale by IP.
- Static assets, `/api/*`, `robots.txt`, and `sitemap.xml` bypass locale resolution.
- Recognized search crawlers bypass automatic geo redirects but can crawl every locale through `hreflang` and the sitemap.
- Cookie: `wl_locale=<locale>; Max-Age=31536000; Path=/; SameSite=Lax; Secure`.

### Language switcher, option C

Desktop, `921px` and wider:

- Place the current full language name immediately before `Request Quote`.
- Button labels are exactly `English`, `简体中文`, and `繁體中文`.
- Use a downward chevron icon and `aria-expanded`; do not use country flags.
- Menu order is English, Simplified Chinese, Traditional Chinese.
- Mark the active item with both a visual indicator and `aria-current="true"`.

Tablet and mobile, `920px` and narrower:

- Keep the current full language name visible in the header between the brand and menu button.
- Move `Request Quote` into the mobile navigation panel so the header cannot overflow at 641-920px.
- The language menu opens below the header without changing header height.
- At 320px, allow the full language label to shrink only through padding changes; do not reduce font size based on viewport width.

Interaction and accessibility:

- The trigger is a real `<button>`; choices are real `<a>` links so switching still works without JavaScript.
- Open on trigger click; close on outside pointer, `Escape`, selection, or navigation close.
- Return focus to the trigger after `Escape`.
- Support `ArrowDown`, `ArrowUp`, `Home`, and `End` inside the menu.
- Use visible focus styles and a minimum 44px touch target.
- Opening the language menu closes the mobile navigation; opening the mobile navigation closes the language menu.

### SEO requirements

Each generated page must include:

- A locale-specific `<title>` and meta description.
- A self-referencing canonical URL.
- Alternate links for `en`, `zh-CN`, `zh-Hant`, and `x-default`.
- Locale-specific Open Graph title, description, and URL.
- Localized JSON-LD human-readable fields while preserving factual identifiers and numeric values.
- Correct `html[lang]`.

`public/sitemap.xml` must contain all 69 URLs and alternate-language links. English is `x-default`.

### Content and form requirements

- Brand `WEI LAN`, model names, email addresses, telephone numbers, and numeric specifications remain unchanged unless the approved glossary says otherwise.
- Translate navigation, headings, body copy, alt text, ARIA labels, form labels, placeholders, validation messages, metadata, and structured data.
- Visible product and waste-type labels are localized, but submitted form values remain stable English machine values so `functions/api/contact.js` and sales email routing do not depend on display language.
- Translate backend error responses through stable error codes; retain the current English `message` field for compatibility.
- Existing images and videos are shared by all locales. Localized downloadable documents require separately supplied assets and are not invented during this implementation.

## 3. Target File Structure

```text
package.json
scripts/
  build-site.mjs
  check-generated-site.mjs
  lib/i18n.mjs
src/
  locales.mjs
  site-manifest.mjs
  content/
    en/*.json
    zh-cn/*.json
    zh-hant/*.json
  templates/
    layouts/base.njk
    components/header.njk
    components/footer.njk
    components/language-switcher.njk
    pages/*.njk
functions/
  _middleware.js
  lib/locale.js
test/
  i18n/build-site.test.mjs
  i18n/generated-site.test.mjs
  i18n/locale-middleware.test.mjs
  browser/language-switcher.spec.mjs
public/
  assets/**
  styles.css
  script.js
  sitemap.xml
  **/*.html
```

Responsibilities:

- `src/site-manifest.mjs`: the only list of the 23 route IDs, templates, and English paths.
- `src/locales.mjs`: locale codes, labels, prefixes, HTML language values, and country mapping.
- `src/content/<locale>/*.json`: reviewed locale copy, one file per route.
- `src/templates/pages/*.njk`: semantic page structure, with no locale routing decisions.
- `scripts/lib/i18n.mjs`: pure counterpart path and content-loading helpers.
- `scripts/build-site.mjs`: render the route-locale cross product and sitemap into `public`.
- `functions/lib/locale.js`: pure request-time locale resolution.
- `functions/_middleware.js`: Cloudflare request adapter, cookie write, and temporary redirects.
- `public/script.js`: switcher and existing navigation interactions only.

## 4. Route Inventory

The manifest must contain these exact 23 route IDs and English outputs:

| Route ID | English output |
| --- | --- |
| `home` | `index.html` |
| `about` | `about.html` |
| `products` | `products.html` |
| `solutions` | `solutions.html` |
| `service-support` | `service-support.html` |
| `resources` | `resources.html` |
| `contact` | `contact.html` |
| `product-ai-optical-sorting` | `products/ai-optical-sorting.html` |
| `product-construction-waste` | `products/construction-waste-recycling-line.html` |
| `case-studies` | `case-studies.html` |
| `case-ai-index` | `case-studies/super-optical-sorting-system.html` |
| `case-ai-haishu` | `case-studies/super-optical-sorting-system/case-haishu.html` |
| `case-ai-smart-recovery` | `case-studies/super-optical-sorting-system/smart-recovery-center.html` |
| `case-construction-index` | `case-studies/construction-bulky-waste-line.html` |
| `case-construction-utilization` | `case-studies/construction-bulky-waste-line/construction-waste-utilization.html` |
| `case-bulky-layout` | `case-studies/construction-bulky-waste-line/bulky-waste-processing-layout.html` |
| `resource-company-profile` | `resources/company-profile.html` |
| `resource-ai-brochure` | `resources/ai-optical-sorting-system-brochure.html` |
| `resource-construction-brochure` | `resources/construction-waste-recycling-line-brochure.html` |
| `resource-product-spec` | `resources/product-specification-sheet.html` |
| `resource-case-pdf` | `resources/case-study-pdf.html` |
| `resource-inquiry-checklist` | `resources/project-inquiry-checklist.html` |
| `resource-maintenance-guide` | `resources/maintenance-guide.html` |

## 5. Tomorrow's Development Plan, 2026-07-14

### Task 1: Establish a clean baseline and test command

**Files:**

- Create: `package.json`
- Create: `test/i18n/build-site.test.mjs`

- [ ] **Step 1: Record the baseline without changing it**

Run:

```bash
git status --short
find public -type f -name '*.html' | sort | wc -l
```

Expected: the known dirty files remain present and the HTML count is `23`.

- [ ] **Step 2: Add the project scripts and dependencies**

Use this initial `package.json`:

```json
{
  "name": "wloffical",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-site.mjs",
    "check:site": "node scripts/check-generated-site.mjs",
    "test": "node --test test/i18n/*.test.mjs",
    "test:browser": "playwright test test/browser"
  },
  "dependencies": {
    "node-html-parser": "^7.0.1",
    "nunjucks": "^3.2.4"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 3: Install dependencies and capture the lockfile**

Run:

```bash
npm install
```

Expected: exit code `0`, with `package-lock.json` created.

Then run:

```bash
npx playwright install chromium
```

Expected: Chromium is available for `npm run test:browser`.

- [ ] **Step 4: Write a failing generated-count test**

Create `test/i18n/build-site.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getBuildTargets } from "../../scripts/lib/i18n.mjs";

test("23 routes across 3 locales produce 69 targets", () => {
  const targets = getBuildTargets();
  assert.equal(targets.length, 69);
  assert.equal(new Set(targets.map((target) => target.outputPath)).size, 69);
});
```

- [ ] **Step 5: Run the test and verify the expected failure**

Run:

```bash
npm test
```

Expected: failure because `scripts/lib/i18n.mjs` does not exist.

- [ ] **Step 6: Commit only the baseline tooling**

```bash
git add package.json package-lock.json test/i18n/build-site.test.mjs
git commit -m "test: establish multilingual build baseline"
```

### Task 2: Define locales, routes, and pure build helpers

**Files:**

- Create: `src/locales.mjs`
- Create: `src/site-manifest.mjs`
- Create: `scripts/lib/i18n.mjs`
- Modify: `test/i18n/build-site.test.mjs`

- [ ] **Step 1: Add locale metadata**

Create `src/locales.mjs` with these exported records:

```js
export const locales = [
  { code: "en", htmlLang: "en", label: "English", prefix: "", contentDir: "en" },
  { code: "zh-CN", htmlLang: "zh-CN", label: "简体中文", prefix: "zh-cn", contentDir: "zh-cn" },
  { code: "zh-Hant", htmlLang: "zh-Hant", label: "繁體中文", prefix: "zh-hant", contentDir: "zh-hant" },
];

export const countryLocale = new Map([
  ["CN", "zh-CN"],
  ["HK", "zh-Hant"],
  ["MO", "zh-Hant"],
  ["TW", "zh-Hant"],
]);
```

- [ ] **Step 2: Add all 23 manifest entries from section 4**

Create `src/site-manifest.mjs` using this shape for every entry:

```js
export const routes = [
  { id: "home", template: "pages/home.njk", output: "index.html", url: "/" },
  { id: "about", template: "pages/about.njk", output: "about.html", url: "/about" },
  { id: "products", template: "pages/products.njk", output: "products.html", url: "/products" },
  { id: "solutions", template: "pages/solutions.njk", output: "solutions.html", url: "/solutions" },
  { id: "service-support", template: "pages/service-support.njk", output: "service-support.html", url: "/service-support" },
  { id: "resources", template: "pages/resources.njk", output: "resources.html", url: "/resources" },
  { id: "contact", template: "pages/contact.njk", output: "contact.html", url: "/contact" },
  { id: "product-ai-optical-sorting", template: "pages/product-ai-optical-sorting.njk", output: "products/ai-optical-sorting.html", url: "/products/ai-optical-sorting" },
  { id: "product-construction-waste", template: "pages/product-construction-waste.njk", output: "products/construction-waste-recycling-line.html", url: "/products/construction-waste-recycling-line" },
  { id: "case-studies", template: "pages/case-studies.njk", output: "case-studies.html", url: "/case-studies" },
  { id: "case-ai-index", template: "pages/case-ai-index.njk", output: "case-studies/super-optical-sorting-system.html", url: "/case-studies/super-optical-sorting-system" },
  { id: "case-ai-haishu", template: "pages/case-ai-haishu.njk", output: "case-studies/super-optical-sorting-system/case-haishu.html", url: "/case-studies/super-optical-sorting-system/case-haishu" },
  { id: "case-ai-smart-recovery", template: "pages/case-ai-smart-recovery.njk", output: "case-studies/super-optical-sorting-system/smart-recovery-center.html", url: "/case-studies/super-optical-sorting-system/smart-recovery-center" },
  { id: "case-construction-index", template: "pages/case-construction-index.njk", output: "case-studies/construction-bulky-waste-line.html", url: "/case-studies/construction-bulky-waste-line" },
  { id: "case-construction-utilization", template: "pages/case-construction-utilization.njk", output: "case-studies/construction-bulky-waste-line/construction-waste-utilization.html", url: "/case-studies/construction-bulky-waste-line/construction-waste-utilization" },
  { id: "case-bulky-layout", template: "pages/case-bulky-layout.njk", output: "case-studies/construction-bulky-waste-line/bulky-waste-processing-layout.html", url: "/case-studies/construction-bulky-waste-line/bulky-waste-processing-layout" },
  { id: "resource-company-profile", template: "pages/resource-company-profile.njk", output: "resources/company-profile.html", url: "/resources/company-profile" },
  { id: "resource-ai-brochure", template: "pages/resource-ai-brochure.njk", output: "resources/ai-optical-sorting-system-brochure.html", url: "/resources/ai-optical-sorting-system-brochure" },
  { id: "resource-construction-brochure", template: "pages/resource-construction-brochure.njk", output: "resources/construction-waste-recycling-line-brochure.html", url: "/resources/construction-waste-recycling-line-brochure" },
  { id: "resource-product-spec", template: "pages/resource-product-spec.njk", output: "resources/product-specification-sheet.html", url: "/resources/product-specification-sheet" },
  { id: "resource-case-pdf", template: "pages/resource-case-pdf.njk", output: "resources/case-study-pdf.html", url: "/resources/case-study-pdf" },
  { id: "resource-inquiry-checklist", template: "pages/resource-inquiry-checklist.njk", output: "resources/project-inquiry-checklist.html", url: "/resources/project-inquiry-checklist" },
  { id: "resource-maintenance-guide", template: "pages/resource-maintenance-guide.njk", output: "resources/maintenance-guide.html", url: "/resources/maintenance-guide" },
];
```

- [ ] **Step 3: Implement `getBuildTargets()` and counterpart URL helpers**

`scripts/lib/i18n.mjs` must export the routing and content interfaces used by the builder:

```js
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
```

- [ ] **Step 4: Run the unit tests**

Run `npm test`.

Expected: the target-count test passes with `69` unique outputs.

- [ ] **Step 5: Commit the manifest layer**

```bash
git add src/locales.mjs src/site-manifest.mjs scripts/lib/i18n.mjs test/i18n/build-site.test.mjs
git commit -m "feat: define multilingual route manifest"
```

### Task 3: Create shared templates and option C language switcher

**Files:**

- Create: `src/templates/layouts/base.njk`
- Create: `src/templates/components/header.njk`
- Create: `src/templates/components/footer.njk`
- Create: `src/templates/components/language-switcher.njk`
- Create: `playwright.config.mjs`
- Modify: `public/styles.css`
- Modify: `public/script.js`
- Create: `test/browser/language-switcher.spec.mjs`

- [ ] **Step 1: Write browser assertions before the component**

Create `playwright.config.mjs` so browser tests have a stable server and base URL:

```js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "npx wrangler pages dev public --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
});
```

The Playwright test must assert at desktop and mobile widths:

```js
import { test, expect } from "@playwright/test";

test("language menu uses full labels and keyboard controls", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /English/ });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("link", { name: "简体中文" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("mobile header does not overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/zh-hant/");
  await expect(page.getByRole("button", { name: /繁體中文/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
```

- [ ] **Step 2: Verify the browser test fails before the switcher exists**

Run `npm run test:browser`.

Expected: failure because the generated site and language trigger are absent.

- [ ] **Step 3: Build the shared header with option C placement**

The switcher component must use real links and a button:

```njk
<div class="language-switcher" data-language-switcher>
  <button class="language-trigger" type="button" data-language-trigger
    aria-expanded="false" aria-controls="language-menu-{{ locale.code }}">
    <span>{{ locale.label }}</span>
    <span class="language-chevron" aria-hidden="true"></span>
  </button>
  <div class="language-menu" id="language-menu-{{ locale.code }}" data-language-menu hidden>
    {% for alternate in alternates %}
      <a href="{{ alternate.switchUrl }}"
        {% if alternate.code == locale.code %}aria-current="true"{% endif %}>
        {{ alternate.label }}
      </a>
    {% endfor %}
  </div>
</div>
```

- [ ] **Step 4: Add the CSS states and responsive placement**

Use stable dimensions: a 44px minimum trigger height, a menu width that fits `繁體中文`, and a header grid that cannot resize when the menu opens. At `max-width: 920px`, hide the header quote action, keep the language trigger in the header, and render a full-width quote action inside the mobile panel.

- [ ] **Step 5: Add switcher behavior to `public/script.js`**

Keep language state separate from the existing navigation state. Implement `setLanguageMenuOpen(isOpen)`, close it from outside-pointer and `Escape` handlers, and add roving focus for arrow keys. Do not translate content in JavaScript.

- [ ] **Step 6: Commit the shared chrome**

```bash
git add playwright.config.mjs src/templates/layouts/base.njk src/templates/components/header.njk src/templates/components/footer.njk src/templates/components/language-switcher.njk public/styles.css public/script.js test/browser/language-switcher.spec.mjs
git commit -m "feat: add full-name language switcher"
```

### Task 4: Build the static generator and migrate English pages

**Files:**

- Create: `scripts/build-site.mjs`
- Create: `src/templates/pages/*.njk` for all 23 route IDs
- Create: `src/content/en/*.json` for all 23 route IDs
- Modify: `test/i18n/build-site.test.mjs`

- [ ] **Step 1: Add a failing content-completeness test**

For every manifest route, assert that `src/content/en/<route.id>.json` exists, parses, and contains non-empty `meta.title`, `meta.description`, and `pageTitle` fields.

- [ ] **Step 2: Implement the render loop**

`scripts/build-site.mjs` must:

```js
for (const target of getBuildTargets()) {
  const content = await loadContent(target.route.id, target.locale);
  const alternates = getAlternates(target.route);
  const site = { origin: "https://weilanrecycling.com" };
  const html = env.render(target.route.template, { ...target, content, alternates, site });
  await mkdir(dirname(resolve("public", target.outputPath)), { recursive: true });
  await writeFile(resolve("public", target.outputPath), html, "utf8");
}
```

The script may overwrite generated HTML and `public/sitemap.xml`; it must not delete `public/assets`, `public/styles.css`, `public/script.js`, `public/robots.txt`, or videos.

- [ ] **Step 3: Migrate the 23 English pages into page templates and content files**

For each route in section 4:

- Preserve existing semantic elements, classes, data attributes, images, videos, factual values, and internal destinations.
- Move header, footer, metadata, canonical, alternates, and scripts into shared templates.
- Move visible English copy and accessibility text into the matching `src/content/en/<route-id>.json`.
- Before migrating `product-construction-waste`, re-read its working-tree diff and preserve any changes present at execution time.

- [ ] **Step 4: Build English output and compare behavior**

Run:

```bash
npm run build
git diff --stat -- public
```

Expected: the 23 English outputs are regenerated, assets are untouched, and all existing page-specific data attributes remain present.

- [ ] **Step 5: Commit the generator and English source**

```bash
git add scripts/build-site.mjs src/templates/pages src/content/en test/i18n/build-site.test.mjs public/*.html public/products public/case-studies public/resources
git commit -m "refactor: generate English pages from shared templates"
```

Before committing, inspect `git diff --cached --name-only` and remove any unrelated user-owned file from the index.

### Task 5: Add reviewed Simplified and Traditional Chinese content

**Files:**

- Create: `src/content/zh-cn/*.json` for all 23 route IDs
- Create: `src/content/zh-hant/*.json` for all 23 route IDs
- Create: `src/content/glossary.json`
- Modify: generated `public/zh-cn/**/*.html`
- Modify: generated `public/zh-hant/**/*.html`

- [ ] **Step 1: Create the terminology glossary**

The glossary must lock brand, model, material, process, capacity, and CTA terminology. At minimum include `WEI LAN`, `Lion One`, `AI optical sorting`, `C&D waste`, `PET`, `HDPE`, `PP`, `throughput`, `sorting rate`, `Request Quote`, and `Service & Support` in all three locales.

- [ ] **Step 2: Translate the global chrome and form copy**

Translate navigation, footer, language labels, quote CTA, contact labels, placeholders, validation states, success state, and accessibility labels. Keep submitted machine values in English.

- [ ] **Step 3: Translate all nine main and product pages**

Create reviewed `zh-cn` and `zh-hant` content files for:

```text
home
about
products
solutions
service-support
resources
contact
product-ai-optical-sorting
product-construction-waste
```

- [ ] **Step 4: Translate all seven case-study pages**

Create reviewed `zh-cn` and `zh-hant` content files for:

```text
case-studies
case-ai-index
case-ai-haishu
case-ai-smart-recovery
case-construction-index
case-construction-utilization
case-bulky-layout
```

- [ ] **Step 5: Translate all seven resource pages**

Create reviewed `zh-cn` and `zh-hant` content files for:

```text
resource-company-profile
resource-ai-brochure
resource-construction-brochure
resource-product-spec
resource-case-pdf
resource-inquiry-checklist
resource-maintenance-guide
```

- [ ] **Step 6: Run completeness tests and generate all locales**

Run:

```bash
npm test
npm run build
find public -type f -name '*.html' | sort | wc -l
```

Expected: tests pass and the HTML count is exactly `69`.

- [ ] **Step 7: Commit locale content separately from infrastructure**

```bash
git add src/content/glossary.json src/content/zh-cn src/content/zh-hant public/zh-cn public/zh-hant
git commit -m "feat: add Simplified and Traditional Chinese content"
```

### Task 6: Add Cloudflare locale resolution middleware

**Files:**

- Create: `functions/lib/locale.js`
- Create: `functions/_middleware.js`
- Create: `test/i18n/locale-middleware.test.mjs`

- [ ] **Step 1: Write resolver tests first**

Cover this exact matrix:

```js
assert.equal(localeFromCountry("CN"), "zh-CN");
assert.equal(localeFromCountry("HK"), "zh-Hant");
assert.equal(localeFromCountry("MO"), "zh-Hant");
assert.equal(localeFromCountry("TW"), "zh-Hant");
assert.equal(localeFromCountry("US"), "en");
assert.equal(localeFromCountry(undefined), "en");
assert.equal(resolveLocale({ query: "en", path: "zh-cn", cookie: "zh-Hant", country: "CN" }), "en");
assert.equal(resolveLocale({ path: "zh-hant", cookie: "en", country: "CN" }), "zh-Hant");
assert.equal(resolveLocale({ cookie: "zh-CN", country: "US" }), "zh-CN");
```

Also assert that assets, APIs, sitemap, robots, and recognized crawlers bypass geo redirects.

- [ ] **Step 2: Run tests and verify failure**

Run `npm test`.

Expected: locale middleware tests fail because the resolver does not exist.

- [ ] **Step 3: Implement pure locale helpers**

Export `normalizeLocale`, `localeFromCountry`, `localeFromPath`, `parseLocaleCookie`, `localizedPath`, `shouldBypassLocale`, and `resolveLocale` from `functions/lib/locale.js`. Keep Cloudflare-specific request access out of this file.

- [ ] **Step 4: Implement the Pages middleware adapter**

`functions/_middleware.js` must:

1. Return `context.next()` for bypassed requests.
2. Handle valid `?locale=` as an explicit switch.
3. Honor `/zh-cn/` and `/zh-hant/` paths.
4. Read `wl_locale` before `request.cf.country`.
5. Redirect only when requested and resolved paths differ.
6. Add the one-year cookie only for explicit switch requests.
7. Add `Cache-Control: private, no-store` to redirects.

- [ ] **Step 5: Run the locale unit tests**

Run `npm test`.

Expected: all resolver precedence, country, bypass, and path tests pass.

- [ ] **Step 6: Commit middleware independently**

```bash
git add functions/_middleware.js functions/lib/locale.js test/i18n/locale-middleware.test.mjs
git commit -m "feat: resolve first-visit locale at the edge"
```

### Task 7: Generate multilingual SEO metadata and sitemap

**Files:**

- Modify: `src/templates/layouts/base.njk`
- Modify: `scripts/build-site.mjs`
- Create: `scripts/check-generated-site.mjs`
- Create: `test/i18n/generated-site.test.mjs`
- Modify: `public/sitemap.xml`

- [ ] **Step 1: Write metadata assertions first**

Parse every generated HTML file and assert one canonical, four alternate links (`en`, `zh-CN`, `zh-Hant`, `x-default`), a non-empty localized title and description, and the correct `html[lang]`.

- [ ] **Step 2: Add alternate and canonical tags to `base.njk`**

Render self-canonical and all alternates from the manifest. Never compute them from relative filesystem depth in a template.

- [ ] **Step 3: Generate the sitemap from the same targets**

Generate 69 `<url>` elements. Each element includes alternate links for the three locales and English `x-default`. Use `https://weilanrecycling.com` as the only production origin.

- [ ] **Step 4: Add broken-link and asset checks**

`scripts/check-generated-site.mjs` must parse local `href`, `src`, `poster`, canonical, and alternate references and fail with the source file and missing target. Ignore external URLs, `mailto:`, `tel:`, fragments, and `/api/contact`.

- [ ] **Step 5: Run the full static verification**

Run:

```bash
npm run build
npm test
npm run check:site
```

Expected: exit code `0`, 69 HTML files checked, no missing counterpart, link, or asset.

- [ ] **Step 6: Commit SEO generation**

```bash
git add src/templates/layouts/base.njk scripts/build-site.mjs scripts/check-generated-site.mjs test/i18n/generated-site.test.mjs public/sitemap.xml
git commit -m "feat: generate multilingual SEO metadata"
```

### Task 8: Localize contact-form errors without changing sales data

**Files:**

- Modify: `functions/api/contact.js`
- Modify: `public/script.js`
- Modify: locale contact content files
- Create: `test/i18n/contact-errors.test.mjs`

- [ ] **Step 1: Test stable error codes**

Assert that missing name, invalid email, missing product, and delivery failure return stable codes such as `NAME_REQUIRED`, `EMAIL_INVALID`, `PRODUCT_REQUIRED`, and `DELIVERY_FAILED` while preserving the existing `message` property.

- [ ] **Step 2: Add `code` to API error responses**

Keep status codes and validation limits unchanged. Map known validation messages to stable codes; use `INTERNAL_ERROR` for unclassified failures and do not expose Resend response bodies to visitors.

- [ ] **Step 3: Map error codes to locale content in the browser**

Render localized error messages into the page as JSON data or `data-*` attributes. `public/script.js` selects the localized message by response code and falls back to a locale-specific generic error.

- [ ] **Step 4: Verify canonical submitted values**

Submit the Simplified and Traditional forms in tests and assert that product and waste-type payload values remain the existing English machine values.

- [ ] **Step 5: Run API and locale tests**

Run `npm test`.

Expected: all contact error-code and locale tests pass.

- [ ] **Step 6: Commit contact localization**

```bash
git add functions/api/contact.js public/script.js src/content/en/contact.json src/content/zh-cn/contact.json src/content/zh-hant/contact.json test/i18n/contact-errors.test.mjs
git commit -m "feat: localize contact form feedback"
```

### Task 9: Responsive, accessibility, and locale QA

**Files:**

- Modify: `test/browser/language-switcher.spec.mjs`
- Modify: `public/styles.css` and `public/script.js` only for verified defects

- [ ] **Step 1: Start the production-like local server**

Run:

```bash
npm run build
npx wrangler pages dev public --port 8788
```

Expected: Cloudflare Pages serves the site at `http://localhost:8788`.

- [ ] **Step 2: Run viewport coverage**

Use Playwright at widths `1440`, `1024`, `920`, `768`, `390`, and `320` for all three locale homepages. Assert no horizontal overflow, no header overlap, stable 72px header height, and an operable quote CTA.

- [ ] **Step 3: Run keyboard coverage**

Verify trigger focus, Enter/Space open, arrow movement, Home/End, Escape close with focus return, outside click close, and mutual exclusion with mobile navigation.

- [ ] **Step 4: Run path preservation coverage**

From a nested resource page and a nested case-study page, switch through all three locales and assert that the same route identity is preserved.

- [ ] **Step 5: Capture visual evidence**

Capture desktop and mobile screenshots for English, Simplified Chinese, and Traditional Chinese headers. Inspect that the complete language names fit, the menu is not clipped, and no text overlaps the brand, quote CTA, or menu button.

- [ ] **Step 6: Run the complete verification suite**

Run:

```bash
npm run build
npm test
npm run check:site
npm run test:browser
git diff --check
```

Expected: every command exits `0`; 69 HTML pages exist; Playwright reports zero failures; `git diff --check` prints no whitespace errors.

- [ ] **Step 7: Commit only verified QA fixes**

```bash
git add test/browser/language-switcher.spec.mjs public/styles.css public/script.js
git commit -m "test: verify multilingual navigation across viewports"
```

Skip this commit when QA requires no code or test changes.

### Task 10: Cloudflare configuration and release handoff

**Files:**

- Modify: `README.md`
- Modify: `wrangler.jsonc` only if the build output contract changes

- [ ] **Step 1: Document the build contract**

Update README with:

```text
Build command: npm run build
Build output directory: public
Local verification: npm run build && npm test && npm run check:site
Local Pages runtime: npx wrangler pages dev public --port 8788
```

- [ ] **Step 2: Verify Cloudflare country fallback locally**

Unit tests remain authoritative for `request.cf.country`, because local Wrangler may not provide a real visitor country. Verify actual `CN`, `HK`, `MO`, `TW`, and non-Chinese country behavior on a Cloudflare preview deployment before production promotion.

- [ ] **Step 3: Run the final clean-room commands**

Run from a fresh shell:

```bash
npm ci
npm run build
npm test
npm run check:site
npm run test:browser
git status --short
```

Expected: install and all checks exit `0`. `git status --short` shows only intentional work plus the preserved pre-existing user changes listed in section 1.

- [ ] **Step 4: Review the generated release sample**

Open and inspect:

```text
/
/zh-cn/
/zh-hant/
/products/ai-optical-sorting
/zh-cn/products/ai-optical-sorting
/zh-hant/products/ai-optical-sorting
/contact
/zh-cn/contact
/zh-hant/contact
```

- [ ] **Step 5: Commit documentation**

```bash
git add README.md wrangler.jsonc
git commit -m "docs: document multilingual build and release"
```

Stage `wrangler.jsonc` only when it actually changed.

## 6. Acceptance Checklist

- [ ] Exactly 23 route identities exist in the manifest.
- [ ] Exactly 69 HTML files are generated.
- [ ] Every route has English, Simplified Chinese, and Traditional Chinese content.
- [ ] Every page has correct canonical, `hreflang`, `x-default`, metadata, and `lang`.
- [ ] Country defaults are `CN -> zh-CN`, `HK/MO/TW -> zh-Hant`, all others -> `en`.
- [ ] A manual switch persists for one year and overrides IP.
- [ ] The C switcher shows complete language names on desktop and mobile.
- [ ] The header does not overflow at 320, 390, 768, 920, 1024, or 1440px.
- [ ] Keyboard and screen-reader semantics are verified.
- [ ] Contact forms show localized feedback while submitting stable values.
- [ ] Local links, assets, sitemap entries, and locale counterparts all resolve.
- [ ] Existing user changes remain intact and outside unrelated commits.

## 7. Translation Review Gate

Infrastructure tests can prove completeness and routing, but they cannot prove marketing or technical translation quality. Before production deployment, a reviewer familiar with recycling equipment must approve:

- Product and process terminology in `src/content/glossary.json`.
- Every capacity, rate, footprint, and material statement against the English source.
- Simplified Chinese sales tone.
- Traditional Chinese terminology for Hong Kong, Macau, and Taiwan audiences.
- Localized SEO titles and descriptions.

Do not treat automated character conversion as this review.

## 8. Rollback Strategy

The English root URLs remain stable. If locale middleware causes a production issue, disable `functions/_middleware.js` first; English pages continue to work while localized URLs remain directly accessible. If generation causes a regression, redeploy the previous Cloudflare Pages build and keep locale content commits for correction. Never remove indexed locale URLs without temporary or permanent redirects chosen explicitly for that release.
