# Weekly SEO and website operations report

Read the latest seven timestamped JSON reports in `monitor/reports/` and prepare a concise report for the WEI LAN overseas website. Ignore `latest.json` so the newest collection is not counted twice.

Required sections:

1. Availability and TLS status.
2. Redirect and language-routing changes.
3. Metadata, canonical, hreflang, robots, and sitemap changes.
4. Response-time trend and pages slower than the configured threshold.
5. New errors or warnings compared with the previous report.
6. Prioritized actions for the next seven days.

Do not claim Google Search Console, ranking, click, impression, conversion, or PageSpeed data unless those data sources are present in the report files. Clearly label missing data sources.

Write the finished report to `monitor/reports/weekly-latest.md` and return the same report as the final response. If fewer than two timestamped reports exist, state that trend comparison does not yet have enough history.
