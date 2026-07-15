# Resource Library Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production resource gate on `Project Inquiry Checklist`, where one successful business-contact submission unlocks the full checklist and establishes a reusable browser-wide unlock state for the complete resource library.

**Architecture:** Keep the approved soft gate in semantic page HTML, post leads to a dedicated Cloudflare Pages Function, and persist only a versioned boolean-equivalent key in `localStorage`. Extend the current English content source and generated public pages, reuse the existing site CSS and shared script, and connect the resource hub to a query-aware contact form.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Cloudflare Pages Functions, Resend, Nunjucks content build, Node test runner, Playwright.

---

## Execution Notes

- Preserve the existing dirty worktree. `.gitignore`, `package.json`, `scripts/`, `src/`, `test/`, and installed dependencies include user-owned work that must not be reverted or broadly staged.
- The editable page content source is `src/content/en/*.json`; the corresponding English output under `public/` must stay synchronized.
- The current locale manifest declares `zh-cn` and `zh-hant`, but those content directories are absent. Do not invent translations as part of this feature. Attempt the normal build during final verification, but treat a missing non-English content file as a pre-existing repository constraint and record the exact failure.
- `package.json` currently references `scripts/check-generated-site.mjs`, but that file is absent. Do not create an unrelated site checker in this feature. Attempt `npm run check:site` during final verification and record the exact pre-existing failure if the script remains absent.
- Commit only the files named in each task. Inspect `git diff --cached --name-only` before every commit.

## File Map

- Create `functions/api/resource-unlock.js`: validate resource lead payloads and deliver resource-unlock emails through Resend.
- Create `test/functions/resource-unlock.test.mjs`: endpoint content-type, JSON, field, environment, escaping, delivery success, and provider-failure coverage.
- Modify `package.json`: include function tests in the normal Node test command.
- Create `test/i18n/resource-unlock-content.test.mjs`: verify source and generated resource-gate structure plus the resource-hub link.
- Modify `src/content/en/resource-inquiry-checklist.json`: provide the preview, complete six-part checklist, unlock form, and confirmation state.
- Modify `public/resources/project-inquiry-checklist.html`: keep the English generated output and pre-paint unlock bootstrap synchronized with the source system.
- Modify `public/styles.css`: add narrowly scoped checklist gate, form, fade, success, library action, and responsive styles.
- Modify `src/templates/layouts/base.njk`: read the versioned unlock flag before paint.
- Modify `public/script.js`: manage shared unlock state, endpoint submission, errors, persistence, and contact query prefill.
- Create `test/browser/resource-unlock.spec.mjs`: verify locked, success, failure, persisted, storage-error, mobile, and contact-prefill behavior.
- Modify `src/content/en/resources.json`: add the `More Resources` action with the approved query string.
- Modify `public/resources.html`: synchronize the English generated hub output.

### Task 1: Resource Lead Endpoint

**Files:**
- Create: `test/functions/resource-unlock.test.mjs`
- Create: `functions/api/resource-unlock.js`
- Modify: `package.json`

- [ ] **Step 1: Write endpoint tests that define the contract**

Create `test/functions/resource-unlock.test.mjs` with helpers that invoke the Pages Function without a live network request:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../../functions/api/resource-unlock.js";

const env = {
  RESEND_API_KEY: "test-key",
  CONTACT_TO_EMAIL: "sales@example.com",
  CONTACT_FROM_EMAIL: "WEI LAN <resources@example.com>",
};

const validLead = {
  name: "Ada Buyer",
  email: "ada@example.com",
  company: "Example Recycling",
  resource: "Project Inquiry Checklist",
  sourcePath: "/resources/project-inquiry-checklist",
};

function makeContext(body, overrides = {}) {
  return {
    request: new Request("https://weilanrecycling.com/api/resource-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env: { ...env, ...overrides },
  };
}

test("resource unlock requires name, email, company, resource, and source path", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 200 });
  try {
    for (const field of Object.keys(validLead)) {
      const body = { ...validLead };
      delete body[field];
      const response = await onRequestPost(makeContext(body));
      assert.equal(response.status, 400, `${field} must be required`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resource unlock rejects an invalid email", async () => {
  const response = await onRequestPost(makeContext({ ...validLead, email: "not-an-email" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, message: "Email format is invalid" });
});

test("resource unlock rejects non-JSON and malformed JSON requests", async () => {
  const nonJson = await onRequestPost({
    request: new Request("https://weilanrecycling.com/api/resource-unlock", { method: "POST", body: "plain text" }),
    env,
  });
  assert.equal(nonJson.status, 400);
  const malformed = await onRequestPost({
    request: new Request("https://weilanrecycling.com/api/resource-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    env,
  });
  assert.equal(malformed.status, 400);
  const invalidShape = await onRequestPost(makeContext(null));
  assert.equal(invalidShape.status, 400);
});

test("resource unlock returns a safe error when email configuration is missing", async () => {
  const response = await onRequestPost(makeContext(validLead, { RESEND_API_KEY: "" }));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    ok: false,
    message: "Unable to unlock resources right now. Please try again.",
  });
});

test("resource unlock sends escaped HTML and plain text to Resend", async () => {
  const originalFetch = globalThis.fetch;
  let requestPayload;
  globalThis.fetch = async (_url, init) => {
    requestPayload = JSON.parse(init.body);
    return new Response(null, { status: 200 });
  };
  try {
    const response = await onRequestPost(makeContext({
      ...validLead,
      name: "<Ada & Co>",
      company: "Buyers \"International\"",
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(requestPayload.reply_to, validLead.email);
    assert.match(requestPayload.subject, /resource unlock/i);
    assert.match(requestPayload.html, /&lt;Ada &amp; Co&gt;/);
    assert.doesNotMatch(requestPayload.html, /<Ada & Co>/);
    assert.match(requestPayload.text, /Project Inquiry Checklist/);
    assert.match(requestPayload.text, /Example Recycling|Buyers "International"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resource unlock returns a safe retryable error when Resend fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("provider secret detail", { status: 503 });
  try {
    const response = await onRequestPost(makeContext(validLead));
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.ok, false);
    assert.equal(body.message, "Unable to unlock resources right now. Please try again.");
    assert.doesNotMatch(JSON.stringify(body), /provider secret detail/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

- [ ] **Step 2: Run the endpoint tests and confirm the expected failure**

Run:

```bash
node --test test/functions/resource-unlock.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `functions/api/resource-unlock.js`.

- [ ] **Step 3: Implement the dedicated Pages Function**

Create `functions/api/resource-unlock.js` with the endpoint contract below. Keep resource-specific validation local to this endpoint instead of changing the general inquiry endpoint.

```js
const RESEND_API_URL = "https://api.resend.com/emails";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MAX_COMPANY_LENGTH = 160;
const MAX_RESOURCE_LENGTH = 120;
const MAX_SOURCE_PATH_LENGTH = 240;
const DELIVERY_ERROR = "Unable to unlock resources right now. Please try again.";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

class PublicError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function onRequestPost(context) {
  try {
    const body = await readJsonBody(context.request);
    const lead = validateLead(body);
    validateEnvironment(context.env);
    const response = await sendLead(context.env, lead);
    if (!response.ok) throw new PublicError(DELIVERY_ERROR, 500);
    return Response.json({ ok: true }, { headers: jsonHeaders });
  } catch (error) {
    const status = error instanceof PublicError ? error.status : 500;
    const message = error instanceof PublicError ? error.message : DELIVERY_ERROR;
    return Response.json({ ok: false, message }, { status, headers: jsonHeaders });
  }
}

export function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function readJsonBody(request) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    throw new PublicError("Content-Type must be application/json");
  }
  try {
    return await request.json();
  } catch {
    throw new PublicError("Request body must be valid JSON");
  }
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new PublicError(`${label} is required`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new PublicError(`${label} is too long`);
  return normalized;
}

function validateLead(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PublicError("Request body must be a JSON object");
  }
  const lead = {
    name: requiredText(body.name, "Name", MAX_NAME_LENGTH),
    email: requiredText(body.email, "Email", MAX_EMAIL_LENGTH),
    company: requiredText(body.company, "Company", MAX_COMPANY_LENGTH),
    resource: requiredText(body.resource, "Resource", MAX_RESOURCE_LENGTH),
    sourcePath: requiredText(body.sourcePath, "Source path", MAX_SOURCE_PATH_LENGTH),
  };
  if (!EMAIL_PATTERN.test(lead.email)) throw new PublicError("Email format is invalid");
  return lead;
}

function validateEnvironment(env) {
  for (const key of ["RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"]) {
    if (!env[key]) throw new PublicError(DELIVERY_ERROR, 500);
  }
}

function sendLead(env, lead) {
  const payload = {
    from: env.CONTACT_FROM_EMAIL,
    to: env.CONTACT_TO_EMAIL,
    reply_to: lead.email,
    subject: `WEI LAN resource unlock - ${lead.resource}`,
    html: [
      "<strong>New WEI LAN resource unlock lead</strong><br>",
      `<strong>Name:</strong> ${escapeHtml(lead.name)}<br>`,
      `<strong>Work email:</strong> ${escapeHtml(lead.email)}<br>`,
      `<strong>Company:</strong> ${escapeHtml(lead.company)}<br>`,
      `<strong>Resource:</strong> ${escapeHtml(lead.resource)}<br>`,
      `<strong>Source page:</strong> ${escapeHtml(lead.sourcePath)}<br>`,
    ].join(""),
    text: [
      "New WEI LAN resource unlock lead",
      "",
      `Name: ${lead.name}`,
      `Work email: ${lead.email}`,
      `Company: ${lead.company}`,
      `Resource: ${lead.resource}`,
      `Source page: ${lead.sourcePath}`,
    ].join("\n"),
  };
  return fetch(RESEND_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify(payload),
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 4: Run the focused endpoint tests**

Run:

```bash
node --test test/functions/resource-unlock.test.mjs
```

Expected: 6 tests PASS.

- [ ] **Step 5: Add endpoint tests to the normal Node suite**

Change the `test` script in `package.json` to:

```json
"test": "node --test test/i18n/*.test.mjs test/functions/*.test.mjs"
```

Run:

```bash
npm test
```

Expected: existing i18n tests and all 6 endpoint tests PASS.

- [ ] **Step 6: Commit the endpoint slice**

```bash
git add functions/api/resource-unlock.js test/functions/resource-unlock.test.mjs package.json
git diff --cached --check
git diff --cached --name-only
git commit -m "feat: add resource unlock lead endpoint"
```

Expected staged files: only the three paths listed above.

### Task 2: Checklist Preview, Full Content, And Site-Aligned Styles

**Files:**
- Create: `test/i18n/resource-unlock-content.test.mjs`
- Modify: `src/content/en/resource-inquiry-checklist.json`
- Modify: `public/resources/project-inquiry-checklist.html`
- Modify: `public/styles.css`

- [ ] **Step 1: Write structural tests for the source and public page**

Create `test/i18n/resource-unlock-content.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "node-html-parser";

const sourceUrl = new URL("../../src/content/en/resource-inquiry-checklist.json", import.meta.url);
const publicUrl = new URL("../../public/resources/project-inquiry-checklist.html", import.meta.url);

const topics = [
  "Waste type and material composition",
  "Target capacity and operating schedule",
  "Site footprint and installation conditions",
  "Expected output products and quality targets",
  "Material photos, videos, and current process",
  "Project stage, timeline, and required documents",
];

function assertGate(root) {
  const form = root.querySelector("[data-resource-unlock-form]");
  assert.ok(root.querySelector("[data-resource-gate]"));
  assert.ok(root.querySelector("[data-resource-preview]"));
  assert.ok(root.querySelector("[data-resource-gated-content]"));
  assert.ok(root.querySelector("[data-resource-gated-content][inert]"));
  assert.equal(form.getAttribute("action"), "/api/resource-unlock");
  for (const name of ["name", "email", "company"]) {
    assert.ok(form.querySelector(`[name='${name}'][required]`), `${name} must be required`);
  }
  const text = root.textContent.replace(/\s+/g, " ");
  for (const topic of topics) assert.match(text, new RegExp(topic));
}

test("checklist source defines the complete gated resource", async () => {
  const content = JSON.parse(await readFile(sourceUrl, "utf8"));
  assertGate(parse(content.bodyHtml));
});

test("generated English checklist preserves metadata, canonical, related resources, and gate", async () => {
  const root = parse(await readFile(publicUrl, "utf8"));
  assert.equal(root.querySelector("link[rel='canonical']").getAttribute("href"), "https://weilanrecycling.com/resources/project-inquiry-checklist");
  assert.equal(root.querySelectorAll(".resource-meta-row span").length, 4);
  assert.equal(root.querySelectorAll(".resource-related-grid a").length, 4);
  assertGate(root);
});

test("resource gate styles include locked, unlocked, and mobile layouts", async () => {
  const css = await readFile(new URL("../../public/styles.css", import.meta.url), "utf8");
  for (const selector of [
    ".resource-checklist-layout",
    ".resource-unlock-form",
    ".resource-gated-content",
    "[data-resource-state=\"unlocked\"]",
  ]) assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
```

- [ ] **Step 2: Run the content tests and confirm they fail**

Run:

```bash
node --test test/i18n/resource-unlock-content.test.mjs
```

Expected: FAIL because the current source and public page have no resource gate.

- [ ] **Step 3: Replace the checklist summary layout with the approved content structure**

In `src/content/en/resource-inquiry-checklist.json`, preserve the current hero and related-resource section, and replace the existing two-panel summary section inside `bodyHtml` with this structure. Encode the markup as the JSON string value without changing the wording below:

```html
<section class="section resource-checklist-layout" data-resource-gate data-resource-state="locked" aria-labelledby="coverage-title">
  <article class="resource-detail-panel resource-checklist-preview" data-resource-preview>
    <p class="resource-preview-label">Free preview</p>
    <h2 id="coverage-title">Prepare a clearer first project brief</h2>
    <p>This checklist helps your team collect the operating inputs WEI LAN needs for a useful first engineering review. Start with what is already known and mark uncertain items for follow-up.</p>
    <div class="resource-checklist-item">
      <span class="number">01</span>
      <div>
        <h3>Waste type and material composition</h3>
        <p>Identify the main material stream, typical composition, contamination, moisture, particle or object size, and any materials that must be removed or recovered.</p>
        <p>For plastics, note PET, HDPE, PP, film, color groups, and mixed recyclable fractions. For construction or bulky waste, note aggregate, wood, metal, plastic, textile, and light-material content.</p>
      </div>
    </div>
    <div class="resource-checklist-item">
      <span class="number">02</span>
      <div>
        <h3>Target capacity and operating schedule</h3>
        <p>Share the target hourly throughput, operating hours per day, shifts per day, expected peak periods, and any planned future expansion.</p>
        <p>Separating current demand from future capacity helps the first recommendation avoid both undersizing and unnecessary equipment.</p>
      </div>
    </div>
  </article>

  <aside class="resource-detail-panel resource-unlock-panel">
    <div data-resource-locked-state>
      <p class="eyebrow">Resource access</p>
      <h2>Unlock all resources</h2>
      <p>Submit your business contact details once to read the complete checklist and unlock the WEI LAN resource library in this browser.</p>
      <form class="resource-unlock-form" data-resource-unlock-form action="/api/resource-unlock" method="post">
        <label>Name<input name="name" autocomplete="name" maxlength="80" required></label>
        <label>Work Email<input type="email" name="email" autocomplete="email" maxlength="120" required></label>
        <label>Company<input name="company" autocomplete="organization" maxlength="160" required></label>
        <input type="hidden" name="resource" value="Project Inquiry Checklist">
        <input type="hidden" name="sourcePath" value="/resources/project-inquiry-checklist">
        <button type="submit">Unlock all resources</button>
        <p class="resource-unlock-status" data-resource-unlock-status role="status" aria-live="polite"></p>
        <p class="resource-unlock-notice">By submitting, you agree that WEI LAN may contact you about this resource and related project support.</p>
      </form>
    </div>
    <div class="resource-unlock-success" data-resource-unlocked-state hidden>
      <p class="eyebrow">Access confirmed</p>
      <h2 tabindex="-1" data-resource-unlocked-heading>All resources unlocked</h2>
      <p>You can now read the complete checklist. Other gated WEI LAN resources will open without another form in this browser.</p>
    </div>
  </aside>

  <article class="resource-detail-panel resource-gated-content" data-resource-gated-content aria-hidden="true" inert>
    <p class="resource-preview-label">Full checklist</p>
    <div class="resource-checklist-item">
      <span class="number">03</span>
      <div>
        <h3>Site footprint and installation conditions</h3>
        <p>Provide the project country, available plant or yard dimensions, clear height, access limits, voltage and frequency, and any restrictions affecting transport, lifting, installation, dust, or noise control.</p>
      </div>
    </div>
    <div class="resource-checklist-item">
      <span class="number">04</span>
      <div>
        <h3>Expected output products and quality targets</h3>
        <p>List the fractions your team wants to recover, the required grouping or purity direction, downstream use, packaging method, and any local acceptance requirements.</p>
      </div>
    </div>
    <div class="resource-checklist-item">
      <span class="number">05</span>
      <div>
        <h3>Material photos, videos, and current process</h3>
        <p>Prepare representative input photos or videos, current process diagrams when available, and examples of existing manual or mechanical sorting. Show normal material as well as difficult or contaminated batches.</p>
      </div>
    </div>
    <div class="resource-checklist-item">
      <span class="number">06</span>
      <div>
        <h3>Project stage, timeline, and required documents</h3>
        <p>State whether the project is in research, budget approval, tender, supplier comparison, replacement, or quotation stage. Include the target decision timeline and documents needed for the next internal review.</p>
      </div>
    </div>
    <div class="resource-checklist-next-step">
      <p class="eyebrow">Next step</p>
      <h3>Turn the checklist into an engineering inquiry</h3>
      <p>Combine the information above into one project brief, then send it through the contact form for configuration review and proposal discussion.</p>
      <a class="primary-button" href="/contact">Send Project Details</a>
    </div>
  </article>
</section>
```

- [ ] **Step 4: Synchronize the English public page**

Apply the same section replacement to `public/resources/project-inquiry-checklist.html`. Preserve the current canonical link, generated header/footer, metadata row, related-resource links, and `/script.js` reference exactly.

- [ ] **Step 5: Add narrowly scoped styles**

Add the following rule groups next to the existing `.resource-detail-*` styles in `public/styles.css`. Use existing color variables and the current 8px panel radius:

```css
.resource-checklist-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr);
  grid-template-areas: "preview unlock" "content unlock";
  gap: 22px clamp(22px, 4vw, 42px);
  align-items: start;
}

.resource-checklist-preview { grid-area: preview; }
.resource-unlock-panel { grid-area: unlock; position: sticky; top: calc(var(--header-height) + 24px); }
.resource-gated-content { grid-area: content; position: relative; }
.resource-preview-label { margin: 0 0 14px; color: var(--color-accent); font-size: 0.78rem; font-weight: 900; text-transform: uppercase; }
.resource-checklist-item { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 14px; padding: 22px 0; border-top: 1px solid var(--color-line); }
.resource-checklist-item .number { display: grid; place-items: center; width: 38px; height: 30px; border: 1px solid rgba(66, 215, 223, 0.35); border-radius: 5px; color: var(--color-cyan); font-weight: 900; }
.resource-checklist-item h3 { margin: 0 0 9px; font-size: 1.1rem; }
.resource-checklist-item p { margin: 0; }
.resource-checklist-item p + p { margin-top: 10px; }

.resource-unlock-form { display: grid; gap: 14px; margin-top: 22px; }
.resource-unlock-form label { display: grid; gap: 7px; color: #d7e1e7; font-size: 0.9rem; font-weight: 700; }
.resource-unlock-form input { width: 100%; min-height: 44px; padding: 12px 13px; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 6px; color: var(--color-text); background: #08111a; font: inherit; }
.resource-unlock-form input:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.resource-unlock-form button { min-height: 44px; border: 1px solid transparent; border-radius: 6px; color: var(--color-white); background: var(--color-red); font-weight: 700; cursor: pointer; }
.resource-unlock-form button:disabled { cursor: wait; opacity: 0.68; }
.resource-unlock-status { min-height: 1.4em; margin: 0; color: #ffd2d2; font-size: 0.82rem; }
.resource-unlock-notice { margin: 0; color: var(--color-muted); font-size: 0.76rem; line-height: 1.55; }
.resource-unlock-success h2:focus { outline: none; }

[data-resource-state="locked"] .resource-gated-content { max-height: 280px; overflow: hidden; }
[data-resource-state="locked"] .resource-gated-content::after { content: ""; position: absolute; inset: auto 0 0; height: 170px; background: linear-gradient(180deg, transparent, #101b26 88%); pointer-events: none; }
[data-resource-state="locked"] .resource-gated-content > * { opacity: 0.42; filter: blur(3px); user-select: none; }
[data-resource-state="unlocked"] .resource-gated-content { max-height: none; }
[data-resource-state="unlocked"] .resource-gated-content > * { opacity: 1; filter: none; user-select: auto; }
html[data-resources-unlocked="true"] [data-resource-gated-content] { max-height: none; }
html[data-resources-unlocked="true"] [data-resource-gated-content]::after { display: none; }
html[data-resources-unlocked="true"] [data-resource-gated-content] > * { opacity: 1; filter: none; user-select: auto; }
.resource-checklist-next-step { padding-top: 22px; border-top: 1px solid var(--color-line); }
```

Add responsive rules inside the existing `@media (max-width: 920px)` and `@media (max-width: 640px)` blocks:

```css
.resource-checklist-layout {
  grid-template-columns: 1fr;
  grid-template-areas: "preview" "unlock" "content";
}

.resource-unlock-panel { position: static; }

@media (max-width: 640px) {
  .resource-checklist-item { grid-template-columns: 1fr; }
  .resource-unlock-form button { width: 100%; }
}
```

- [ ] **Step 6: Run the content tests**

Run:

```bash
node --test test/i18n/resource-unlock-content.test.mjs
```

Expected: 3 tests PASS.

- [ ] **Step 7: Run the complete Node suite**

Run:

```bash
npm test
```

Expected: all i18n, content, and endpoint tests PASS.

- [ ] **Step 8: Commit the page-content slice**

```bash
git add test/i18n/resource-unlock-content.test.mjs src/content/en/resource-inquiry-checklist.json public/resources/project-inquiry-checklist.html public/styles.css
git diff --cached --check
git diff --cached --name-only
git commit -m "feat: add gated project inquiry checklist"
```

Expected staged files: only the four paths listed above.

### Task 3: Shared Unlock State And Client Interaction

**Files:**
- Modify: `src/templates/layouts/base.njk`
- Modify: `public/resources/project-inquiry-checklist.html`
- Modify: `public/script.js`
- Create: `test/browser/resource-unlock.spec.mjs`

- [ ] **Step 1: Write browser tests for the locked, success, failure, persisted, and storage-error states**

Create `test/browser/resource-unlock.spec.mjs`:

```js
import { test, expect } from "@playwright/test";

const resourcePath = "/resources/project-inquiry-checklist";
const unlockKey = "weilan_resources_unlocked_v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => localStorage.removeItem(key), unlockKey);
});

test("successful submission unlocks the checklist and persists one library flag", async ({ page }) => {
  let postedBody;
  await page.route("**/api/resource-unlock", async (route) => {
    postedBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(resourcePath);
  const gate = page.locator("[data-resource-gate]");
  await expect(gate).toHaveAttribute("data-resource-state", "locked");
  await page.getByLabel("Name", { exact: true }).fill("Ada Buyer");
  await page.getByLabel("Work Email", { exact: true }).fill("ada@example.com");
  await page.getByLabel("Company", { exact: true }).fill("Example Recycling");
  await page.getByRole("button", { name: "Unlock all resources" }).click();
  await expect(gate).toHaveAttribute("data-resource-state", "unlocked");
  await expect(page.getByRole("heading", { name: "All resources unlocked" })).toBeVisible();
  expect(postedBody).toEqual({
    name: "Ada Buyer",
    email: "ada@example.com",
    company: "Example Recycling",
    resource: "Project Inquiry Checklist",
    sourcePath: "/resources/project-inquiry-checklist",
  });
  expect(await page.evaluate((key) => ({ value: localStorage.getItem(key), keys: Object.keys(localStorage) }), unlockKey)).toEqual({ value: "true", keys: [unlockKey] });
});

test("repeated submission cannot issue parallel unlock requests", async ({ page }) => {
  let requestCount = 0;
  let releaseRequest;
  await page.route("**/api/resource-unlock", async (route) => {
    requestCount += 1;
    await new Promise((resolve) => { releaseRequest = resolve; });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(resourcePath);
  await page.getByLabel("Name", { exact: true }).fill("Ada Buyer");
  await page.getByLabel("Work Email", { exact: true }).fill("ada@example.com");
  await page.getByLabel("Company", { exact: true }).fill("Example Recycling");
  const form = page.locator("[data-resource-unlock-form]");
  await form.evaluate((node) => {
    node.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    node.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => requestCount).toBe(1);
  releaseRequest();
  await expect(page.locator("[data-resource-gate]")).toHaveAttribute("data-resource-state", "unlocked");
});

test("delivery failure preserves values and never unlocks", async ({ page }) => {
  await page.route("**/api/resource-unlock", (route) => route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, message: "Unable to unlock resources right now. Please try again." }),
  }));
  await page.goto(resourcePath);
  await page.getByLabel("Name", { exact: true }).fill("Ada Buyer");
  await page.getByLabel("Work Email", { exact: true }).fill("ada@example.com");
  await page.getByLabel("Company", { exact: true }).fill("Example Recycling");
  await page.getByRole("button", { name: "Unlock all resources" }).click();
  await expect(page.locator("[data-resource-gate]")).toHaveAttribute("data-resource-state", "locked");
  await expect(page.locator("[data-resource-unlock-status]")).toHaveText("Unable to unlock resources right now. Please try again.");
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue("Example Recycling");
  expect(await page.evaluate((key) => localStorage.getItem(key), unlockKey)).toBeNull();
});

test("an existing library flag starts the page unlocked", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "true"), unlockKey);
  await page.goto(resourcePath);
  await expect(page.locator("[data-resource-gate]")).toHaveAttribute("data-resource-state", "unlocked");
  await expect(page.getByRole("heading", { name: "All resources unlocked" })).toBeVisible();
});

test("blocked storage does not break the locked page", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("storage blocked"); };
    Storage.prototype.setItem = () => { throw new Error("storage blocked"); };
  });
  await page.goto(resourcePath);
  await expect(page.locator("[data-resource-gate]")).toHaveAttribute("data-resource-state", "locked");
  await expect(page.getByRole("button", { name: "Unlock all resources" })).toBeVisible();
});

test("mobile places the unlock form between preview and gated content without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(resourcePath);
  const order = await page.locator("[data-resource-gate] > *").evaluateAll((nodes) => nodes.map((node) => node.className));
  expect(order[0]).toContain("resource-checklist-preview");
  expect(order[1]).toContain("resource-unlock-panel");
  expect(order[2]).toContain("resource-gated-content");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
```

- [ ] **Step 2: Run the browser test and confirm the expected failure**

Run:

```bash
npx playwright test test/browser/resource-unlock.spec.mjs
```

Expected: FAIL because the page has no unlock event handler or persistence logic.

- [ ] **Step 3: Add the pre-paint shared-state bootstrap**

In `src/templates/layouts/base.njk`, place this script in `<head>` before the stylesheet link so a previously unlocked visitor does not see blurred content flash. Add the same script to the current generated English output `public/resources/project-inquiry-checklist.html` before its stylesheet link:

```html
<script>
  try {
    if (localStorage.getItem("weilan_resources_unlocked_v1") === "true") {
      document.documentElement.dataset.resourcesUnlocked = "true";
    }
  } catch {}
</script>
```

The script stores and reads no personal information.

- [ ] **Step 4: Implement the resource gate client controller**

Add these selectors near the top of `public/script.js`:

```js
const RESOURCE_UNLOCK_KEY = "weilan_resources_unlocked_v1";
const resourceGate = document.querySelector("[data-resource-gate]");
const resourceUnlockForm = document.querySelector("[data-resource-unlock-form]");
const resourceUnlockStatus = document.querySelector("[data-resource-unlock-status]");
const resourceGatedContent = document.querySelector("[data-resource-gated-content]");
const resourceLockedState = document.querySelector("[data-resource-locked-state]");
const resourceUnlockedState = document.querySelector("[data-resource-unlocked-state]");
const resourceUnlockedHeading = document.querySelector("[data-resource-unlocked-heading]");
let resourceUnlockSubmitting = false;
```

Add these focused functions before the existing contact-form submit handler:

```js
function hasResourceUnlock() {
  try {
    return localStorage.getItem(RESOURCE_UNLOCK_KEY) === "true";
  } catch {
    return false;
  }
}

function persistResourceUnlock() {
  try {
    localStorage.setItem(RESOURCE_UNLOCK_KEY, "true");
  } catch {
    // The current page remains unlocked even when browser storage is unavailable.
  }
}

function applyResourceUnlockState(isUnlocked, shouldFocus = false) {
  if (!resourceGate) return;
  resourceGate.dataset.resourceState = isUnlocked ? "unlocked" : "locked";
  document.documentElement.dataset.resourcesUnlocked = isUnlocked ? "true" : "false";
  if (resourceGatedContent) resourceGatedContent.setAttribute("aria-hidden", String(!isUnlocked));
  if (resourceGatedContent) resourceGatedContent.toggleAttribute("inert", !isUnlocked);
  if (resourceLockedState) resourceLockedState.hidden = isUnlocked;
  if (resourceUnlockedState) resourceUnlockedState.hidden = !isUnlocked;
  if (isUnlocked && shouldFocus && resourceUnlockedHeading) resourceUnlockedHeading.focus();
}

async function submitResourceUnlock(event) {
  event.preventDefault();
  if (!resourceUnlockForm || !resourceUnlockStatus) return;
  if (resourceUnlockSubmitting) return;
  if (!resourceUnlockForm.reportValidity()) return;
  const submitButton = resourceUnlockForm.querySelector("button[type='submit']");
  const payload = Object.fromEntries(new FormData(resourceUnlockForm).entries());
  resourceUnlockSubmitting = true;
  submitButton.disabled = true;
  resourceUnlockStatus.textContent = "Unlocking resources...";
  try {
    const response = await fetch(resourceUnlockForm.action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Unable to unlock resources right now. Please try again.");
    persistResourceUnlock();
    applyResourceUnlockState(true, true);
  } catch (error) {
    resourceUnlockStatus.textContent = error.message;
  } finally {
    resourceUnlockSubmitting = false;
    submitButton.disabled = false;
  }
}

if (resourceGate) applyResourceUnlockState(hasResourceUnlock());
if (resourceUnlockForm) resourceUnlockForm.addEventListener("submit", submitResourceUnlock);
```

- [ ] **Step 5: Run the focused browser tests**

Run:

```bash
npx playwright test test/browser/resource-unlock.spec.mjs
```

Expected: all 6 resource unlock tests PASS.

- [ ] **Step 6: Run all current browser tests**

Run:

```bash
npm run test:browser
```

Expected: language-switcher tests and resource-unlock tests PASS.

- [ ] **Step 7: Commit the shared-state slice**

```bash
git add src/templates/layouts/base.njk public/resources/project-inquiry-checklist.html public/script.js test/browser/resource-unlock.spec.mjs
git diff --cached --check
git diff --cached --name-only
git commit -m "feat: persist resource library unlock state"
```

Expected staged files: only the four paths listed above.

### Task 4: More Resources Link And Contact Prefill

**Files:**
- Modify: `test/i18n/resource-unlock-content.test.mjs`
- Modify: `test/browser/resource-unlock.spec.mjs`
- Modify: `src/content/en/resources.json`
- Modify: `public/resources.html`
- Modify: `public/styles.css`
- Modify: `public/script.js`

- [ ] **Step 1: Add failing source and browser tests for the approved route**

Append to `test/i18n/resource-unlock-content.test.mjs`:

```js
test("resource hub exposes the approved More Resources destination", async () => {
  const source = JSON.parse(await readFile(new URL("../../src/content/en/resources.json", import.meta.url), "utf8"));
  const sourceRoot = parse(source.bodyHtml);
  const publicRoot = parse(await readFile(new URL("../../public/resources.html", import.meta.url), "utf8"));
  for (const root of [sourceRoot, publicRoot]) {
    const link = root.querySelector("[data-more-resources]");
    assert.equal(link.textContent.trim(), "More Resources");
    assert.equal(link.getAttribute("href"), "/contact?source=resources&request=more-resources");
  }
});
```

Append to `test/browser/resource-unlock.spec.mjs`:

```js
test("More Resources opens contact with a prefilled editable request", async ({ page }) => {
  await page.goto("/resources");
  await page.locator("[data-more-resources]").click();
  await expect(page).toHaveURL(/\/contact\?source=resources&request=more-resources$/);
  const details = page.getByLabel("Project Details");
  await expect(details).toHaveValue("I would like to receive more WEI LAN resource materials.");
  await details.fill("Please send the AI sorting brochure and parameter summary.");
  await expect(details).toHaveValue("Please send the AI sorting brochure and parameter summary.");
});

test("normal contact visits keep Project Details empty", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByLabel("Project Details")).toHaveValue("");
});
```

- [ ] **Step 2: Run both focused suites and confirm the expected failures**

Run:

```bash
node --test test/i18n/resource-unlock-content.test.mjs
npx playwright test test/browser/resource-unlock.spec.mjs
```

Expected: the `More Resources` source assertion and contact-prefill browser test FAIL.

- [ ] **Step 3: Add the hub action to the source and public page**

Immediately after `.resource-library-list` in both `src/content/en/resources.json` and `public/resources.html`, add:

```html
<div class="resource-library-actions">
  <a class="secondary-button" data-more-resources href="/contact?source=resources&amp;request=more-resources">More Resources</a>
</div>
```

In the JSON source, encode the markup in the existing `bodyHtml` string. In generated `public/resources.html`, the browser-visible `href` may serialize `&` as `&amp;`; DOM parsing must return the approved query string.

- [ ] **Step 4: Style the resource-library action with existing button language**

Add to the existing resource-library CSS group in `public/styles.css`:

```css
.resource-library-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

@media (max-width: 640px) {
  .resource-library-actions { justify-content: stretch; }
  .resource-library-actions .secondary-button { width: 100%; }
}
```

- [ ] **Step 5: Implement exact query-aware prefill behavior**

Add this function to `public/script.js` after the contact form selectors are created and call it before contact-form listeners are attached:

```js
function prefillResourceRequest() {
  if (!contactForm) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("source") !== "resources" || params.get("request") !== "more-resources") return;
  const message = contactForm.querySelector("textarea[name='message']");
  if (message && !message.value.trim()) {
    message.value = "I would like to receive more WEI LAN resource materials.";
  }
}

prefillResourceRequest();
```

Do not preselect a product, submit the form, or overwrite an existing message.

- [ ] **Step 6: Run the focused source and browser tests**

Run:

```bash
node --test test/i18n/resource-unlock-content.test.mjs
npx playwright test test/browser/resource-unlock.spec.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 7: Run all Node and browser tests**

Run:

```bash
npm test
npm run test:browser
```

Expected: all runnable tests PASS.

- [ ] **Step 8: Commit the hub/contact slice**

```bash
git add test/i18n/resource-unlock-content.test.mjs test/browser/resource-unlock.spec.mjs src/content/en/resources.json public/resources.html public/styles.css public/script.js
git diff --cached --check
git diff --cached --name-only
git commit -m "feat: connect resource hub to contact request"
```

Expected staged files: only the six paths listed above.

### Task 5: Final Build, Regression, And Visual Verification

**Files:**
- Modify only if verification finds an in-scope defect in a file already named above.

- [ ] **Step 1: Run syntax and diff checks**

```bash
node --check public/script.js
node --check functions/api/resource-unlock.js
git diff --check 4f5ad4c..HEAD
```

Expected: all commands exit 0.

- [ ] **Step 2: Run the complete automated suites**

```bash
npm test
npm run test:browser
```

Expected: all Node and Playwright tests PASS.

- [ ] **Step 3: Attempt the normal site build**

```bash
npm run build
```

Expected when the locale work is complete: PASS and regenerate the public site. If it fails because `src/content/zh-cn` or `src/content/zh-hant` is absent, record the first missing-file error as the known pre-existing multilingual migration constraint. Do not generate placeholder translations.

If the build succeeds, rerun:

```bash
npm test
npm run test:browser
```

Expected: all tests still PASS after generation.

- [ ] **Step 4: Attempt the configured generated-site checker**

```bash
npm run check:site
```

Expected when the referenced checker exists: PASS. If Node reports that `scripts/check-generated-site.mjs` is missing, record it as the known pre-existing repository constraint and do not expand this feature into a new site-checker implementation.

- [ ] **Step 5: Inspect desktop visual states**

Start or reuse the configured local Pages server through Playwright, then capture the checklist at `1440x1000` in locked and unlocked states. Verify:

- Hero, metadata, preview, form, fade, and related resources use the existing WEI LAN visual language.
- The sticky panel does not collide with the header.
- The locked continuation communicates depth without exposing readable full copy.
- Unlocking does not produce a horizontal jump or leave an empty panel.
- Focus moves to `All resources unlocked` after a successful mocked response.

- [ ] **Step 6: Inspect mobile visual states**

Capture the checklist and resources hub at `375x812`. Verify:

- Preview, form, and gated continuation appear in that order.
- All field labels, input values, button text, metadata chips, and resource titles fit their containers.
- The form and `More Resources` action are full-width where appropriate.
- `document.documentElement.scrollWidth <= innerWidth` on both pages.

- [ ] **Step 7: Verify privacy and shared state manually**

After one mocked successful unlock, inspect local storage and confirm the only feature key is:

```text
weilan_resources_unlocked_v1=true
```

Confirm name, email, company, resource name, and source path are absent. Reload the checklist and confirm it starts unlocked without another request.

- [ ] **Step 8: Fix only in-scope verification defects and rerun affected checks**

For every defect, first add or tighten the smallest failing automated assertion, then change only the relevant resource endpoint, content, script, or styles. Rerun the focused test and both complete suites before continuing.

- [ ] **Step 9: Review final scope**

```bash
git status --short
git log --oneline 4f5ad4c..HEAD
git diff --stat 4f5ad4c..HEAD
```

Expected: implementation commits cover the endpoint, gated checklist, shared state, and hub/contact link. Existing unrelated user changes remain present and unstaged. No complete content was added to the other six resource pages.
