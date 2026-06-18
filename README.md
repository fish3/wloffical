# WEI LAN Overseas Product Site

Static product website for Cloudflare Pages with a Pages Function contact form.

## Cloudflare Pages setup

Build settings:

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `public`
- Root directory: `/`

## Contact form environment variables

The contact form posts to `/api/contact` and sends email through Postmark.

Set these Cloudflare Pages environment variables:

- `POSTMARK_SERVER_TOKEN`: Postmark server token.
- `CONTACT_TO_EMAIL`: sales inbox that receives website inquiries.
- `CONTACT_FROM_EMAIL`: verified sender address in Postmark, for example `WEI LAN <inquiry@your-domain.com>`.
- `POSTMARK_MESSAGE_STREAM`: optional, defaults to `website-contact-inquiries`.

After changing environment variables, redeploy the Pages project.

For local testing, copy `.dev.vars.example` to `.dev.vars` and fill real values:

```bash
cp .dev.vars.example .dev.vars
npx wrangler pages dev public --port 8788
```

## Domain placeholders

Replace `https://example.com/` in `public/index.html`, `public/products/*.html`, `public/robots.txt`, and `public/sitemap.xml` after the production domain is confirmed.
