# WEI LAN Overseas Product Site

Static product website for Cloudflare Pages with a Pages Function contact form.

## Cloudflare Pages setup

Build settings:

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `public`
- Root directory: `/`

## Contact form environment variables

The contact form posts to `/api/contact` and sends email through Resend.

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
