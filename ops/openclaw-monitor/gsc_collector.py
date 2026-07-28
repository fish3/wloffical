#!/usr/bin/env python3
"""Collect Google Search Console performance data for weekly SEO analysis."""

from __future__ import annotations

import argparse
import json
import urllib.parse
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
SEARCH_ANALYTICS_API_TEMPLATE = (
    "https://searchconsole.googleapis.com/webmasters/v3/sites/"
    "{site_url}/searchAnalytics/query"
)
DEFAULT_DATA_LAG_DAYS = 3
DEFAULT_PERIOD_DAYS = 7
DEFAULT_ROW_LIMIT = 25_000
DEFAULT_REQUEST_TIMEOUT_SECONDS = 30
TOP_POSITION_THRESHOLDS = (10, 20, 50)
OPPORTUNITY_MINIMUM_IMPRESSIONS = 5
OPPORTUNITY_MINIMUM_POSITION = 8
OPPORTUNITY_MAXIMUM_POSITION = 20
OPPORTUNITY_MAXIMUM_CTR = 0.03


@dataclass(frozen=True)
class GscConfig:
    """Validated Google Search Console collector configuration."""

    site_url: str
    credential_path: Path
    report_directory: Path
    data_lag_days: int
    period_days: int
    row_limit: int
    request_timeout_seconds: int


def parse_positive_integer(value: Any, field_name: str) -> int:
    """Return a positive integer configuration value or reject it."""
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise ValueError(f"Configuration field '{field_name}' must be a positive integer")
    if isinstance(value, str) and not value.strip().isdigit():
        raise ValueError(f"Configuration field '{field_name}' must be a positive integer")
    parsed_value = int(value)
    if parsed_value <= 0:
        raise ValueError(f"Configuration field '{field_name}' must be a positive integer")
    return parsed_value


def load_config(config_path: Path) -> GscConfig:
    """Load and validate collector configuration from JSON."""
    raw_config = json.loads(config_path.read_text(encoding="utf-8"))
    site_url = raw_config.get("site_url")
    credential_path = raw_config.get("credential_path")
    report_directory = raw_config.get("report_directory")
    for field_name, field_value in (
        ("site_url", site_url),
        ("credential_path", credential_path),
        ("report_directory", report_directory),
    ):
        if not isinstance(field_value, str) or not field_value.strip():
            raise ValueError(f"Configuration field '{field_name}' must be a non-empty string")

    if not site_url.startswith("sc-domain:") and not site_url.startswith(("http://", "https://")):
        raise ValueError("Configuration field 'site_url' must be a GSC domain or URL-prefix property")

    row_limit = parse_positive_integer(
        raw_config.get("row_limit", DEFAULT_ROW_LIMIT), "row_limit"
    )
    if row_limit > DEFAULT_ROW_LIMIT:
        raise ValueError(f"Configuration field 'row_limit' cannot exceed {DEFAULT_ROW_LIMIT}")

    return GscConfig(
        site_url=site_url.strip(),
        credential_path=Path(credential_path).expanduser(),
        report_directory=Path(report_directory).expanduser(),
        data_lag_days=parse_positive_integer(
            raw_config.get("data_lag_days", DEFAULT_DATA_LAG_DAYS), "data_lag_days"
        ),
        period_days=parse_positive_integer(
            raw_config.get("period_days", DEFAULT_PERIOD_DAYS), "period_days"
        ),
        row_limit=row_limit,
        request_timeout_seconds=parse_positive_integer(
            raw_config.get("request_timeout_seconds", DEFAULT_REQUEST_TIMEOUT_SECONDS),
            "request_timeout_seconds",
        ),
    )


def build_periods(today: date, data_lag_days: int, period_days: int) -> dict[str, dict[str, date]]:
    """Build current and previous complete reporting periods."""
    current_end = today - timedelta(days=data_lag_days)
    current_start = current_end - timedelta(days=period_days - 1)
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=period_days - 1)
    return {
        "current": {"start": current_start, "end": current_end},
        "previous": {"start": previous_start, "end": previous_end},
    }


def create_authorized_session(credential_path: Path) -> AuthorizedSession:
    """Create an authenticated read-only Google API session."""
    if not credential_path.is_file():
        raise FileNotFoundError(f"Google service-account credential not found: {credential_path}")
    credentials = service_account.Credentials.from_service_account_file(
        credential_path,
        scopes=[SEARCH_CONSOLE_SCOPE],
    )
    return AuthorizedSession(credentials)


def query_search_analytics(
    session: AuthorizedSession,
    config: GscConfig,
    request_body: dict[str, Any],
) -> dict[str, Any]:
    """Execute one Search Analytics query and return its JSON response."""
    encoded_site_url = urllib.parse.quote(config.site_url, safe="")
    api_url = SEARCH_ANALYTICS_API_TEMPLATE.format(site_url=encoded_site_url)
    response = session.post(api_url, json=request_body, timeout=config.request_timeout_seconds)
    if response.status_code != 200:
        raise RuntimeError(
            f"Search Console API returned HTTP {response.status_code}: {response.text}"
        )
    response_body = response.json()
    if not isinstance(response_body, dict):
        raise ValueError("Search Console API returned a non-object JSON response")
    return response_body


def fetch_rows(
    session: AuthorizedSession,
    config: GscConfig,
    start_date: date,
    end_date: date,
    dimensions: list[str],
) -> list[dict[str, Any]]:
    """Fetch all rows for one date range and dimension set."""
    rows: list[dict[str, Any]] = []
    start_row = 0
    while True:
        request_body = {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "dimensions": dimensions,
            "rowLimit": config.row_limit,
            "startRow": start_row,
            "dataState": "final",
        }
        response_body = query_search_analytics(session, config, request_body)
        page_rows = response_body.get("rows", [])
        if not isinstance(page_rows, list):
            raise ValueError("Search Console API field 'rows' must be an array")
        rows.extend(page_rows)
        if len(page_rows) < config.row_limit:
            return rows
        start_row += config.row_limit


def normalize_metric_row(row: dict[str, Any]) -> dict[str, float]:
    """Normalize metric values returned by Search Console."""
    return {
        "clicks": float(row.get("clicks", 0)),
        "impressions": float(row.get("impressions", 0)),
        "ctr": float(row.get("ctr", 0)),
        "position": float(row.get("position", 0)),
    }


def fetch_totals(
    session: AuthorizedSession,
    config: GscConfig,
    start_date: date,
    end_date: date,
) -> dict[str, float]:
    """Fetch property totals for one period."""
    rows = fetch_rows(session, config, start_date, end_date, [])
    if not rows:
        return normalize_metric_row({})
    return normalize_metric_row(rows[0])


def normalize_dimension_rows(
    rows: list[dict[str, Any]],
    dimension_name: str,
) -> list[dict[str, Any]]:
    """Normalize one-dimensional Search Console rows."""
    normalized_rows: list[dict[str, Any]] = []
    for row in rows:
        keys = row.get("keys", [])
        if not isinstance(keys, list) or len(keys) != 1:
            raise ValueError(f"Search Console row for '{dimension_name}' has invalid keys")
        normalized_rows.append({dimension_name: str(keys[0]), **normalize_metric_row(row)})
    return normalized_rows


def count_keyword_positions(query_rows: list[dict[str, Any]]) -> dict[str, int]:
    """Count query rows whose average positions fall within SEO thresholds."""
    return {
        f"top_{threshold}": sum(
            0 < query_row["position"] <= threshold for query_row in query_rows
        )
        for threshold in TOP_POSITION_THRESHOLDS
    }


def select_opportunity_queries(query_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Select high-impression, page-one-to-two queries with weak CTR."""
    opportunities = [
        query_row
        for query_row in query_rows
        if query_row["impressions"] >= OPPORTUNITY_MINIMUM_IMPRESSIONS
        and OPPORTUNITY_MINIMUM_POSITION <= query_row["position"] <= OPPORTUNITY_MAXIMUM_POSITION
        and query_row["ctr"] < OPPORTUNITY_MAXIMUM_CTR
    ]
    return sorted(opportunities, key=lambda row: (-row["impressions"], row["position"]))


def build_query_coverage(
    current_totals: dict[str, float],
    query_rows: list[dict[str, Any]],
) -> dict[str, float | int | None]:
    """Measure query-level coverage after Google's privacy filtering."""
    visible_impressions = sum(query_row["impressions"] for query_row in query_rows)
    visible_clicks = sum(query_row["clicks"] for query_row in query_rows)
    total_impressions = current_totals["impressions"]
    return {
        "visible_query_count": len(query_rows),
        "visible_impressions": visible_impressions,
        "anonymized_impressions": max(total_impressions - visible_impressions, 0),
        "visible_clicks": visible_clicks,
        "anonymized_clicks": max(current_totals["clicks"] - visible_clicks, 0),
        "visible_impression_share": (
            round(visible_impressions / total_impressions, 4)
            if total_impressions > 0
            else None
        ),
    }


def calculate_percent_change(current_value: float, previous_value: float) -> float | None:
    """Calculate percentage change, returning null when the baseline is zero."""
    if previous_value == 0:
        return None
    return round((current_value - previous_value) / previous_value * 100, 2)


def build_comparison(
    current_totals: dict[str, float],
    previous_totals: dict[str, float],
) -> dict[str, float | None]:
    """Build explicit period-over-period metric changes."""
    return {
        "clicks_percent": calculate_percent_change(
            current_totals["clicks"], previous_totals["clicks"]
        ),
        "impressions_percent": calculate_percent_change(
            current_totals["impressions"], previous_totals["impressions"]
        ),
        "ctr_percentage_points": round(
            (current_totals["ctr"] - previous_totals["ctr"]) * 100, 2
        ),
        "position_change": round(
            current_totals["position"] - previous_totals["position"], 2
        ),
    }


def collect_report(config: GscConfig, today: date | None = None) -> dict[str, Any]:
    """Collect current and previous GSC performance windows."""
    periods = build_periods(today or date.today(), config.data_lag_days, config.period_days)
    session = create_authorized_session(config.credential_path)
    current_period = periods["current"]
    previous_period = periods["previous"]
    current_totals = fetch_totals(
        session, config, current_period["start"], current_period["end"]
    )
    previous_totals = fetch_totals(
        session, config, previous_period["start"], previous_period["end"]
    )
    daily_rows = normalize_dimension_rows(
        fetch_rows(session, config, previous_period["start"], current_period["end"], ["date"]),
        "date",
    )
    query_rows = normalize_dimension_rows(
        fetch_rows(
            session, config, current_period["start"], current_period["end"], ["query"]
        ),
        "query",
    )
    page_rows = normalize_dimension_rows(
        fetch_rows(
            session, config, current_period["start"], current_period["end"], ["page"]
        ),
        "page",
    )
    return {
        "schema_version": 1,
        "site_url": config.site_url,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "data_lag_days": config.data_lag_days,
        "current_period": {
            "start": current_period["start"].isoformat(),
            "end": current_period["end"].isoformat(),
            "totals": current_totals,
        },
        "previous_period": {
            "start": previous_period["start"].isoformat(),
            "end": previous_period["end"].isoformat(),
            "totals": previous_totals,
        },
        "comparison": build_comparison(current_totals, previous_totals),
        "daily": daily_rows,
        "queries": query_rows,
        "query_coverage": build_query_coverage(current_totals, query_rows),
        "landing_pages": page_rows,
        "keyword_position_counts": count_keyword_positions(query_rows),
        "organic_landing_page_count": sum(page["impressions"] > 0 for page in page_rows),
        "opportunity_queries": select_opportunity_queries(query_rows),
        "row_coverage": {
            "landing_page_count": len(page_rows),
            "row_limit_per_request": config.row_limit,
        },
    }


def write_report(report: dict[str, Any], report_directory: Path) -> Path:
    """Atomically write the latest GSC report JSON."""
    report_directory.mkdir(parents=True, exist_ok=True)
    report_path = report_directory / "gsc-latest.json"
    temporary_path = report_directory / ".gsc-latest.json.tmp"
    temporary_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(report_path)
    return report_path


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path, help="Path to GSC JSON config")
    return parser.parse_args()


def main() -> int:
    """Run one Search Console collection."""
    arguments = parse_arguments()
    config = load_config(arguments.config)
    report = collect_report(config)
    report_path = write_report(report, config.report_directory)
    print(
        json.dumps(
            {
                "report": str(report_path),
                "current_period": report["current_period"],
                "keyword_position_counts": report["keyword_position_counts"],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
