#!/usr/bin/env python3
"""Collect technical SEO and availability signals for a public website."""

from __future__ import annotations

import argparse
import json
import math
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as element_tree
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_SLOW_RESPONSE_SECONDS = 3.0
DEFAULT_MINIMUM_SITEMAP_URLS = 3
WEEKLY_HISTORY_LIMIT = 7
USER_AGENT = "WEI-LAN-Site-Monitor/1.0 (+https://weilanrecycling.com/)"


class PageMetadataParser(HTMLParser):
    """Extract SEO-relevant fields from an HTML document."""

    def __init__(self) -> None:
        super().__init__()
        self.title_parts: list[str] = []
        self.h1_parts: list[str] = []
        self.meta: dict[str, str] = {}
        self.canonical = ""
        self.hreflang: dict[str, str] = {}
        self.video_sources: list[str] = []
        self._inside_title = False
        self._inside_h1 = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): value or "" for key, value in attrs}
        normalized_tag = tag.lower()

        if normalized_tag == "title":
            self._inside_title = True
        elif normalized_tag == "h1":
            self._inside_h1 = True
        elif normalized_tag == "meta":
            name = attributes.get("name", "").lower()
            property_name = attributes.get("property", "").lower()
            content = attributes.get("content", "").strip()
            if name and content:
                self.meta[name] = content
            if property_name and content:
                self.meta[property_name] = content
        elif normalized_tag == "link":
            relations = set(attributes.get("rel", "").lower().split())
            href = attributes.get("href", "").strip()
            if "canonical" in relations:
                self.canonical = href
            if "alternate" in relations and attributes.get("hreflang"):
                self.hreflang[attributes["hreflang"]] = href
        elif normalized_tag == "source" and attributes.get("type", "").startswith("video/"):
            self.video_sources.append(attributes.get("src", ""))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._inside_title = False
        elif tag.lower() == "h1":
            self._inside_h1 = False

    def handle_data(self, data: str) -> None:
        normalized_text = " ".join(data.split())
        if not normalized_text:
            return
        if self._inside_title:
            self.title_parts.append(normalized_text)
        if self._inside_h1:
            self.h1_parts.append(normalized_text)

    def as_dict(self) -> dict[str, Any]:
        """Return normalized metadata values."""
        return {
            "title": " ".join(self.title_parts).strip(),
            "description": self.meta.get("description", ""),
            "robots": self.meta.get("robots", ""),
            "canonical": self.canonical,
            "hreflang": self.hreflang,
            "h1": " ".join(self.h1_parts).strip(),
            "og_title": self.meta.get("og:title", ""),
            "og_description": self.meta.get("og:description", ""),
            "video_sources": [source for source in self.video_sources if source],
        }


class RedirectRecorder(urllib.request.HTTPRedirectHandler):
    """Record every redirect while preserving urllib redirect behavior."""

    def __init__(self) -> None:
        super().__init__()
        self.redirects: list[dict[str, Any]] = []

    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        self.redirects.append({"status": code, "from": request.full_url, "to": new_url})
        return super().redirect_request(request, file_pointer, code, message, headers, new_url)


@dataclass(frozen=True)
class MonitorConfig:
    site_name: str
    base_url: str
    sitemap_url: str
    robots_url: str
    pages: list[str]
    report_directory: Path
    timeout_seconds: int
    slow_response_seconds: float
    minimum_sitemap_urls: int


def load_config(config_path: Path) -> MonitorConfig:
    """Load and validate monitor configuration from JSON."""
    raw_config = json.loads(config_path.read_text(encoding="utf-8"))
    required_string_fields = ["site_name", "base_url", "sitemap_url", "robots_url"]
    for field_name in required_string_fields:
        if not isinstance(raw_config.get(field_name), str) or not raw_config[field_name].strip():
            raise ValueError(f"Configuration field '{field_name}' must be a non-empty string")

    pages = raw_config.get("pages")
    if not isinstance(pages, list) or not pages or not all(isinstance(page, str) for page in pages):
        raise ValueError("Configuration field 'pages' must be a non-empty string array")

    timeout_seconds = parse_positive_integer(
        raw_config.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS), "timeout_seconds"
    )
    slow_response_seconds = parse_positive_float(
        raw_config.get("slow_response_seconds", DEFAULT_SLOW_RESPONSE_SECONDS),
        "slow_response_seconds",
    )
    minimum_sitemap_urls = parse_positive_integer(
        raw_config.get("minimum_sitemap_urls", DEFAULT_MINIMUM_SITEMAP_URLS),
        "minimum_sitemap_urls",
    )

    return MonitorConfig(
        site_name=raw_config["site_name"].strip(),
        base_url=validate_http_url(raw_config["base_url"], "base_url"),
        sitemap_url=validate_http_url(raw_config["sitemap_url"], "sitemap_url"),
        robots_url=validate_http_url(raw_config["robots_url"], "robots_url"),
        pages=[validate_http_url(page, "pages") for page in pages],
        report_directory=Path(raw_config.get("report_directory", "./reports")).expanduser(),
        timeout_seconds=timeout_seconds,
        slow_response_seconds=slow_response_seconds,
        minimum_sitemap_urls=minimum_sitemap_urls,
    )


def validate_http_url(value: str, field_name: str) -> str:
    """Reject invalid or non-HTTP external URLs."""
    parsed_url = urllib.parse.urlparse(value)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError(f"Configuration field '{field_name}' contains an invalid URL: {value}")
    return value


def parse_positive_integer(value: Any, field_name: str) -> int:
    """Parse a positive integer configuration value or reject it."""
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise ValueError(f"Configuration field '{field_name}' must be a positive integer")
    if isinstance(value, str) and not value.strip().isdigit():
        raise ValueError(f"Configuration field '{field_name}' must be a positive integer")
    try:
        parsed_value = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f"Configuration field '{field_name}' must be a positive integer"
        ) from error
    if parsed_value <= 0:
        raise ValueError(f"Configuration field '{field_name}' must be a positive integer")
    return parsed_value


def parse_positive_float(value: Any, field_name: str) -> float:
    """Parse a positive floating-point configuration value or reject it."""
    if isinstance(value, bool):
        raise ValueError(f"Configuration field '{field_name}' must be a positive number")
    try:
        parsed_value = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"Configuration field '{field_name}' must be a positive number") from error
    if not math.isfinite(parsed_value) or parsed_value <= 0:
        raise ValueError(f"Configuration field '{field_name}' must be a positive number")
    return parsed_value


def fetch_url(url: str, timeout_seconds: int) -> dict[str, Any]:
    """Fetch one URL and return status, timing, redirects, headers, and body."""
    redirect_recorder = RedirectRecorder()
    opener = urllib.request.build_opener(redirect_recorder)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    started_at = time.monotonic()

    try:
        with opener.open(request, timeout=timeout_seconds) as response:
            body = response.read()
            return {
                "requested_url": url,
                "final_url": response.geturl(),
                "status": response.status,
                "elapsed_seconds": round(time.monotonic() - started_at, 3),
                "content_type": response.headers.get_content_type(),
                "content_length": len(body),
                "last_modified": response.headers.get("Last-Modified", ""),
                "redirects": redirect_recorder.redirects,
                "body": body,
                "error": "",
            }
    except urllib.error.HTTPError as error:
        return {
            "requested_url": url,
            "final_url": error.geturl(),
            "status": error.code,
            "elapsed_seconds": round(time.monotonic() - started_at, 3),
            "content_type": error.headers.get_content_type() if error.headers else "",
            "content_length": 0,
            "last_modified": "",
            "redirects": redirect_recorder.redirects,
            "body": b"",
            "error": str(error),
        }
    except (urllib.error.URLError, TimeoutError, socket.timeout) as error:
        return {
            "requested_url": url,
            "final_url": url,
            "status": 0,
            "elapsed_seconds": round(time.monotonic() - started_at, 3),
            "content_type": "",
            "content_length": 0,
            "last_modified": "",
            "redirects": redirect_recorder.redirects,
            "body": b"",
            "error": str(error),
        }


def inspect_html_page(url: str, timeout_seconds: int) -> dict[str, Any]:
    """Fetch one page and extract technical SEO metadata."""
    fetch_result = fetch_url(url, timeout_seconds)
    metadata: dict[str, Any] = {}
    if fetch_result["body"] and fetch_result["content_type"] == "text/html":
        parser = PageMetadataParser()
        parser.feed(fetch_result["body"].decode("utf-8", errors="replace"))
        metadata = parser.as_dict()

    fetch_result.pop("body", None)
    fetch_result["metadata"] = metadata
    return fetch_result


def inspect_sitemap(url: str, timeout_seconds: int) -> dict[str, Any]:
    """Fetch a sitemap and return URL inventory and language-path counts."""
    fetch_result = fetch_url(url, timeout_seconds)
    sitemap_urls: list[str] = []
    parse_error = ""
    if fetch_result["body"]:
        try:
            root = element_tree.fromstring(fetch_result["body"])
            sitemap_urls = [
                element.text.strip()
                for element in root.findall(".//{*}loc")
                if element.text and element.text.strip()
            ]
        except element_tree.ParseError as error:
            parse_error = str(error)

    fetch_result.pop("body", None)
    fetch_result.update(
        {
            "url_count": len(sitemap_urls),
            "duplicate_count": len(sitemap_urls) - len(set(sitemap_urls)),
            "english_url_count": sum(
                "/zh-cn/" not in page_url and "/zh-hant/" not in page_url
                for page_url in sitemap_urls
            ),
            "simplified_chinese_url_count": sum("/zh-cn/" in page_url for page_url in sitemap_urls),
            "traditional_chinese_url_count": sum("/zh-hant/" in page_url for page_url in sitemap_urls),
            "urls": sitemap_urls,
            "parse_error": parse_error,
        }
    )
    return fetch_result


def inspect_robots(url: str, timeout_seconds: int) -> dict[str, Any]:
    """Fetch robots.txt and detect sitemap and broad crawl restrictions."""
    fetch_result = fetch_url(url, timeout_seconds)
    robots_text = fetch_result["body"].decode("utf-8", errors="replace")
    normalized_lines = [line.strip() for line in robots_text.splitlines() if line.strip()]
    sitemap_lines = [line for line in normalized_lines if line.lower().startswith("sitemap:")]
    fetch_result.pop("body", None)
    fetch_result.update(
        {
            "sitemap_directives": sitemap_lines,
            "contains_global_disallow": "User-agent: *\nDisallow: /" in robots_text,
            "line_count": len(normalized_lines),
        }
    )
    return fetch_result


def inspect_tls(base_url: str, timeout_seconds: int) -> dict[str, Any]:
    """Read the site's TLS certificate and calculate remaining validity."""
    parsed_url = urllib.parse.urlparse(base_url)
    hostname = parsed_url.hostname
    if not hostname:
        raise ValueError(f"Cannot determine hostname from {base_url}")
    port = parsed_url.port or 443
    context = ssl.create_default_context()
    with socket.create_connection((hostname, port), timeout=timeout_seconds) as connection:
        with context.wrap_socket(connection, server_hostname=hostname) as secure_socket:
            certificate = secure_socket.getpeercert()

    expiry = parsedate_to_datetime(certificate["notAfter"]).astimezone(timezone.utc)
    now = datetime.now(timezone.utc)
    return {
        "hostname": hostname,
        "issuer": dict(item[0] for item in certificate.get("issuer", [])),
        "expires_at": expiry.isoformat(),
        "days_remaining": (expiry - now).days,
    }


def build_issues(config: MonitorConfig, report: dict[str, Any]) -> list[dict[str, str]]:
    """Translate collected signals into actionable warning and error records."""
    issues: list[dict[str, str]] = []
    tls_days_remaining = report["tls"]["days_remaining"]
    if tls_days_remaining < 7:
        issues.append({"severity": "error", "code": "tls_expiring", "message": "TLS expires in under 7 days"})
    elif tls_days_remaining < 30:
        issues.append({"severity": "warning", "code": "tls_expiring", "message": "TLS expires in under 30 days"})

    sitemap = report["sitemap"]
    if sitemap["status"] != 200 or sitemap["parse_error"]:
        issues.append({"severity": "error", "code": "sitemap_unavailable", "message": "Sitemap is unavailable or invalid"})
    elif sitemap["url_count"] < config.minimum_sitemap_urls:
        issues.append({"severity": "warning", "code": "sitemap_small", "message": "Sitemap URL count is below the configured minimum"})
    if sitemap["duplicate_count"]:
        issues.append({"severity": "warning", "code": "sitemap_duplicates", "message": "Sitemap contains duplicate URLs"})

    if report["robots"]["status"] != 200:
        issues.append({"severity": "error", "code": "robots_unavailable", "message": "robots.txt is unavailable"})

    for page in report["pages"]:
        page_label = page["requested_url"]
        if page["status"] != 200:
            issues.append({"severity": "error", "code": "page_unavailable", "message": f"{page_label} returned {page['status']}"})
            continue
        if page["elapsed_seconds"] > config.slow_response_seconds:
            issues.append({"severity": "warning", "code": "slow_response", "message": f"{page_label} took {page['elapsed_seconds']} seconds"})
        metadata = page["metadata"]
        for field_name in ("title", "description", "canonical", "h1"):
            if not metadata.get(field_name):
                issues.append({"severity": "warning", "code": f"missing_{field_name}", "message": f"{page_label} is missing {field_name}"})
        if "noindex" in metadata.get("robots", "").lower():
            issues.append({"severity": "error", "code": "page_noindex", "message": f"{page_label} contains noindex"})

    return issues


def collect_report(config: MonitorConfig) -> dict[str, Any]:
    """Collect a complete monitoring snapshot for the configured site."""
    collected_at = datetime.now(timezone.utc)
    report: dict[str, Any] = {
        "schema_version": 1,
        "site_name": config.site_name,
        "collected_at": collected_at.isoformat(),
        "tls": inspect_tls(config.base_url, config.timeout_seconds),
        "robots": inspect_robots(config.robots_url, config.timeout_seconds),
        "sitemap": inspect_sitemap(config.sitemap_url, config.timeout_seconds),
        "pages": [inspect_html_page(page, config.timeout_seconds) for page in config.pages],
    }
    report["issues"] = build_issues(config, report)
    report["summary"] = {
        "error_count": sum(issue["severity"] == "error" for issue in report["issues"]),
        "warning_count": sum(issue["severity"] == "warning" for issue in report["issues"]),
        "page_count": len(report["pages"]),
        "sitemap_url_count": report["sitemap"]["url_count"],
    }
    return report


def render_markdown(report: dict[str, Any]) -> str:
    """Render a concise human-readable monitoring report."""
    summary = report["summary"]
    lines = [
        f"# {report['site_name']} monitoring report",
        "",
        f"Collected at: `{report['collected_at']}`",
        "",
        "## Summary",
        "",
        f"- Errors: {summary['error_count']}",
        f"- Warnings: {summary['warning_count']}",
        f"- Monitored pages: {summary['page_count']}",
        f"- Sitemap URLs: {summary['sitemap_url_count']}",
        f"- TLS days remaining: {report['tls']['days_remaining']}",
        "",
        "## Page checks",
        "",
        "| Requested URL | Status | Final URL | Time | Title |",
        "|---|---:|---|---:|---|",
    ]
    for page in report["pages"]:
        title = page["metadata"].get("title", "").replace("|", "\\|")
        lines.append(
            f"| {page['requested_url']} | {page['status']} | {page['final_url']} | "
            f"{page['elapsed_seconds']}s | {title} |"
        )

    lines.extend(["", "## Issues", ""])
    if report["issues"]:
        for issue in report["issues"]:
            lines.append(f"- **{issue['severity'].upper()}** `{issue['code']}`: {issue['message']}")
    else:
        lines.append("- No technical monitoring issues detected.")
    lines.append("")
    return "\n".join(lines)


def build_weekly_snapshot(report: dict[str, Any]) -> dict[str, Any]:
    """Build a compact trend snapshot for the weekly AI analysis."""
    return {
        "collected_at": report["collected_at"],
        "summary": report["summary"],
        "tls": report["tls"],
        "robots": {
            "status": report["robots"]["status"],
            "final_url": report["robots"]["final_url"],
            "sitemap_directives": report["robots"]["sitemap_directives"],
            "contains_global_disallow": report["robots"]["contains_global_disallow"],
        },
        "sitemap": {
            "status": report["sitemap"]["status"],
            "url_count": report["sitemap"]["url_count"],
            "duplicate_count": report["sitemap"]["duplicate_count"],
            "english_url_count": report["sitemap"]["english_url_count"],
            "simplified_chinese_url_count": report["sitemap"][
                "simplified_chinese_url_count"
            ],
            "traditional_chinese_url_count": report["sitemap"][
                "traditional_chinese_url_count"
            ],
            "parse_error": report["sitemap"]["parse_error"],
        },
        "pages": [
            {
                "requested_url": page["requested_url"],
                "final_url": page["final_url"],
                "status": page["status"],
                "elapsed_seconds": page["elapsed_seconds"],
                "redirects": page["redirects"],
                "metadata": page["metadata"],
            }
            for page in report["pages"]
        ],
        "issues": report["issues"],
    }


def update_weekly_history(report: dict[str, Any], report_directory: Path) -> Path:
    """Append one compact snapshot and retain the latest seven collections."""
    history_path = report_directory / "weekly-history.json"
    history: list[dict[str, Any]] = []
    if history_path.exists():
        loaded_history = json.loads(history_path.read_text(encoding="utf-8"))
        if not isinstance(loaded_history, list):
            raise ValueError(f"Weekly history must be a JSON array: {history_path}")
        history = loaded_history

    history.append(build_weekly_snapshot(report))
    bounded_history = history[-WEEKLY_HISTORY_LIMIT:]
    history_path.write_text(
        json.dumps(bounded_history, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return history_path


def write_report(report: dict[str, Any], report_directory: Path) -> tuple[Path, Path]:
    """Persist timestamped and latest JSON/Markdown reports."""
    report_directory.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = report_directory / f"{timestamp}.json"
    markdown_path = report_directory / f"{timestamp}.md"
    json_content = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    markdown_content = render_markdown(report)

    json_path.write_text(json_content, encoding="utf-8")
    markdown_path.write_text(markdown_content, encoding="utf-8")
    (report_directory / "latest.json").write_text(json_content, encoding="utf-8")
    (report_directory / "latest.md").write_text(markdown_content, encoding="utf-8")
    update_weekly_history(report, report_directory)
    return json_path, markdown_path


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path, help="Path to monitor JSON config")
    return parser.parse_args()


def main() -> int:
    """Run one monitoring collection and return non-zero on hard errors."""
    arguments = parse_arguments()
    config = load_config(arguments.config)
    report = collect_report(config)
    json_path, markdown_path = write_report(report, config.report_directory)
    print(json.dumps({"summary": report["summary"], "json": str(json_path), "markdown": str(markdown_path)}))
    return 1 if report["summary"]["error_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
