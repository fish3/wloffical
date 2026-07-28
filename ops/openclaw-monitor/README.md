# OpenClaw website monitor

This component runs technical SEO and availability monitoring for `weilanrecycling.com` on the dedicated OpenClaw VPS.

## Collected signals

- HTTP status, response time, redirect chain, and final URL.
- Page title, description, canonical, robots, H1, hreflang, and video sources.
- Sitemap URL count, duplicates, and language-path distribution.
- robots.txt availability and sitemap declaration.
- TLS certificate expiry.
- Actionable error and warning records.
- GSC clicks, impressions, CTR, average position, daily trend, query distribution,
  landing pages, position buckets, and opportunity queries.

## Server paths

- Runtime: `/home/openclaw/workspace/monitor`
- Reports: `/home/openclaw/workspace/monitor/reports`
- Seven-snapshot AI input: `/home/openclaw/workspace/monitor/reports/weekly-history.json`
- Latest GSC AI input: `/home/openclaw/workspace/monitor/reports/gsc-latest.json`
- OpenClaw policy: `/home/openclaw/workspace/monitor/MONITORING.md`
- Systemd service: `/etc/systemd/system/weilan-site-monitor.service`
- Systemd timer: `/etc/systemd/system/weilan-site-monitor.timer`
- GSC systemd service: `/etc/systemd/system/weilan-gsc-collector.service`
- GSC systemd timer: `/etc/systemd/system/weilan-gsc-collector.timer`

## Schedule

The collector runs daily at 03:15 Asia/Shanghai with up to five minutes of random delay.
Each run updates a compact seven-snapshot history so the weekly AI task does not
scan or guess timestamped filenames.
Repeated collections on the same UTC date replace that day's snapshot instead
of creating a false intra-day trend.

The GSC collector runs daily at 04:00 Asia/Shanghai with up to five minutes of
random delay. It compares the latest complete seven-day period ending three days
ago with the preceding seven days. The service-account credential remains outside
the Git workspace at `/home/openclaw/.openclaw/secrets/google-search-console.json`.

## OpenClaw integration

`weekly-analysis-prompt.md` is deployed to an enabled OpenClaw cron job. The report
focuses on search impressions, clicks, CTR, rankings, queries, landing pages, and
prioritized SEO actions. Technical checks appear only when they reveal a crawl or
indexing risk; performance and conversion analytics are outside this report.

The weekly job requires:

1. A model provider.
2. A notification channel or webhook.
3. A read-only Google Search Console service account for ranking, click, and impression analysis.

The technical collector does not require a model or external credentials.

The weekly job runs Monday at 09:30 Asia/Shanghai and writes its result to
`monitor/reports/weekly-latest.md` before delivering the same Chinese report to
the configured notification channel.

OpenClaw's workspace `AGENTS.md` must direct monitoring tasks to read
`monitor/MONITORING.md` before analyzing reports.
