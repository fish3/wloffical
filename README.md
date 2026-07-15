# WEI LAN Overseas Product Site

Static multilingual product website for Cloudflare Pages with English, Simplified Chinese, and Traditional Chinese pages plus Pages Function contact and resource-unlock forms.

## Local development

```bash
npm install
npx playwright install chromium
npm run build
npm test
npm run check:site
npm run test:browser
```

Production-like local runtime:

```bash
npx wrangler pages dev public --port 8788
```

The generated output contains 23 route identities across three locales (69 HTML files). English stays on the root paths, Simplified Chinese uses `/zh-cn/`, and Traditional Chinese uses `/zh-hant/`.

## Cloudflare Pages setup

Build settings:

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `public`
- Root directory: `/`

Local verification command:

```bash
npm run build && npm test && npm run check:site && npm run test:browser
```

## Locale behavior

The Pages middleware resolves the first visit in this order: explicit `?locale=` selection, locale URL prefix, `wl_locale` cookie, Cloudflare country, then English.

- `CN` defaults to Simplified Chinese.
- `HK`, `MO`, and `TW` default to Traditional Chinese.
- Other countries default to English.
- Manual selection is saved for one year and overrides later country detection.
- Assets, APIs, `robots.txt`, `sitemap.xml`, and recognized crawlers bypass automatic locale redirects.

Production HTTPS cookies use `Secure`; Wrangler's local HTTP runtime omits it so cookie persistence remains testable.

Country behavior is covered by unit tests. Confirm real `request.cf.country` behavior on a Cloudflare preview deployment before production promotion.

## Contact form environment variables

The contact form posts to `/api/contact`; the gated resource form posts to `/api/resource-unlock`. Both send email through Resend.

Set these Cloudflare Pages environment variables:

- `RESEND_API_KEY`: Resend API key.
- `CONTACT_TO_EMAIL`: sales inbox that receives website inquiries.
- `CONTACT_FROM_EMAIL`: verified sender address in Resend, for example `WEI LAN <inquiry@your-domain.com>`.

After changing environment variables, redeploy the Pages project.

For local testing, copy `.dev.vars.example` to `.dev.vars` and fill real values:

```bash
cp .dev.vars.example .dev.vars
npx wrangler pages dev public --port 8788
```

## Production domain

The production domain is `https://weilanrecycling.com/`.

Before production release, complete the terminology and marketing-copy review described in `HANDOOF.md`, especially technical capacities and Traditional Chinese wording for Hong Kong, Macau, and Taiwan audiences.
