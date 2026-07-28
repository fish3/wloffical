# OpenClaw website monitor

This component runs technical SEO and availability monitoring for `weilanrecycling.com` on the dedicated OpenClaw VPS.

## Collected signals

- HTTP status, response time, redirect chain, and final URL.
- Page title, description, canonical, robots, H1, hreflang, and video sources.
- Sitemap URL count, duplicates, and language-path distribution.
- robots.txt availability and sitemap declaration.
- TLS certificate expiry.
- Actionable error and warning records.

## Server paths

- Runtime: `/home/openclaw/workspace/monitor`
- Reports: `/home/openclaw/workspace/monitor/reports`
- Seven-snapshot AI input: `/home/openclaw/workspace/monitor/reports/weekly-history.json`
- OpenClaw policy: `/home/openclaw/workspace/monitor/MONITORING.md`
- Systemd service: `/etc/systemd/system/weilan-site-monitor.service`
- Systemd timer: `/etc/systemd/system/weilan-site-monitor.timer`

## Schedule

The collector runs daily at 03:15 Asia/Shanghai with up to five minutes of random delay.
Each run updates a compact seven-snapshot history so the weekly AI task does not
scan or guess timestamped filenames.

## OpenClaw integration

`weekly-analysis-prompt.md` is ready for an OpenClaw cron job. The weekly AI job should only be enabled after configuring:

1. A model provider.
2. A notification channel or webhook.
3. Google Search Console credentials if ranking, click, and impression analysis is required.

The technical collector does not require a model or external credentials.

The deployed weekly job is intentionally disabled until model authentication and
a delivery destination are configured. It is scheduled for Monday 09:30
Asia/Shanghai and writes its result to `monitor/reports/weekly-latest.md`.

OpenClaw's workspace `AGENTS.md` must direct monitoring tasks to read
`monitor/MONITORING.md` before analyzing reports.
