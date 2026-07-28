#!/usr/bin/env python3
"""Collect Google rankings and external visibility through DataForSEO."""

from __future__ import annotations

import argparse
import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TASK_POST_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/organic/task_post"
TASKS_READY_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/organic/tasks_ready"
TASK_GET_ENDPOINT_TEMPLATE = (
    "https://api.dataforseo.com/v3/serp/google/organic/task_get/advanced/{task_id}"
)
SUCCESS_STATUS_CODE = 20000
TASK_CREATED_STATUS_CODE = 20100
RANK_THRESHOLDS = (10, 20, 50, 100)
DEFAULT_TIMEOUT_SECONDS = 300
DEFAULT_MAXIMUM_TASKS = 100
DEFAULT_HISTORY_LIMIT = 12
COMPETITOR_SAMPLE_LIMIT = 3


@dataclass(frozen=True)
class Country:
    """One country-specific Google search location."""

    code: str
    name: str
    location_code: int
    language_code: str


@dataclass(frozen=True)
class Keyword:
    """One tracked equipment or commercial keyword."""

    text: str
    category: str


@dataclass(frozen=True)
class VisibilityQuery:
    """One brand or external-platform Google query."""

    name: str
    query: str
    expected_domains: tuple[str, ...]


@dataclass(frozen=True)
class SerpConfig:
    """Validated rank collector configuration."""

    target_domain: str
    login_path: Path
    password_path: Path
    report_directory: Path
    countries: tuple[Country, ...]
    keywords: tuple[Keyword, ...]
    visibility_queries: tuple[VisibilityQuery, ...]
    rank_depth: int
    visibility_depth: int
    maximum_tasks: int
    history_limit: int
    timeout_seconds: int
    concurrent_requests: int
    poll_interval_seconds: int
    maximum_wait_seconds: int


def require_string(value: Any, field_name: str) -> str:
    """Return a non-empty stripped string or reject it."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Configuration field '{field_name}' must be a non-empty string")
    return value.strip()


def require_positive_integer(value: Any, field_name: str) -> int:
    """Return a positive integer or reject it."""
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise ValueError(f"Configuration field '{field_name}' must be a positive integer")
    if isinstance(value, str) and not value.strip().isdigit():
        raise ValueError(f"Configuration field '{field_name}' must be a positive integer")
    parsed_value = int(value)
    if parsed_value <= 0:
        raise ValueError(f"Configuration field '{field_name}' must be a positive integer")
    return parsed_value


def normalize_domain(domain_or_url: str) -> str:
    """Normalize a domain or URL for exact and subdomain matching."""
    candidate = domain_or_url.strip().lower()
    if "://" in candidate:
        candidate = urllib.parse.urlparse(candidate).hostname or ""
    return candidate.removeprefix("www.").rstrip(".")


def parse_countries(raw_countries: Any) -> tuple[Country, ...]:
    """Validate configured countries."""
    if not isinstance(raw_countries, list) or not raw_countries:
        raise ValueError("Configuration field 'countries' must be a non-empty array")
    if not all(isinstance(item, dict) for item in raw_countries):
        raise ValueError("Every country entry must be an object")
    countries = tuple(
        Country(
            code=require_string(item.get("code"), "countries.code"),
            name=require_string(item.get("name"), "countries.name"),
            location_code=require_positive_integer(
                item.get("location_code"), "countries.location_code"
            ),
            language_code=require_string(
                item.get("language_code"), "countries.language_code"
            ),
        )
        for item in raw_countries
    )
    if len({country.code for country in countries}) != len(countries):
        raise ValueError("Country codes must be unique")
    return countries


def parse_keywords(raw_keywords: Any) -> tuple[Keyword, ...]:
    """Validate configured target keywords."""
    if not isinstance(raw_keywords, list) or not raw_keywords:
        raise ValueError("Configuration field 'keywords' must be a non-empty array")
    if not all(isinstance(item, dict) for item in raw_keywords):
        raise ValueError("Every keyword entry must be an object")
    keywords = tuple(
        Keyword(
            text=require_string(item.get("text"), "keywords.text"),
            category=require_string(item.get("category"), "keywords.category"),
        )
        for item in raw_keywords
    )
    if len({keyword.text.lower() for keyword in keywords}) != len(keywords):
        raise ValueError("Keywords must be unique")
    return keywords


def parse_visibility_queries(raw_queries: Any) -> tuple[VisibilityQuery, ...]:
    """Validate configured brand and platform visibility queries."""
    if not isinstance(raw_queries, list):
        raise ValueError("Configuration field 'visibility_queries' must be an array")
    queries: list[VisibilityQuery] = []
    for raw_query in raw_queries:
        if not isinstance(raw_query, dict):
            raise ValueError("Every visibility query entry must be an object")
        raw_domains = raw_query.get("expected_domains")
        if not isinstance(raw_domains, list) or not raw_domains:
            raise ValueError("Visibility expected_domains must be a non-empty array")
        queries.append(
            VisibilityQuery(
                name=require_string(raw_query.get("name"), "visibility_queries.name"),
                query=require_string(raw_query.get("query"), "visibility_queries.query"),
                expected_domains=tuple(
                    normalize_domain(require_string(domain, "visibility_queries.expected_domains"))
                    for domain in raw_domains
                ),
            )
        )
    return tuple(queries)


def load_config(config_path: Path) -> SerpConfig:
    """Load and validate a JSON collector configuration."""
    raw_config = json.loads(config_path.read_text(encoding="utf-8"))
    countries = parse_countries(raw_config.get("countries"))
    keywords = parse_keywords(raw_config.get("keywords"))
    visibility_queries = parse_visibility_queries(raw_config.get("visibility_queries", []))
    maximum_tasks = require_positive_integer(
        raw_config.get("maximum_tasks", DEFAULT_MAXIMUM_TASKS), "maximum_tasks"
    )
    task_count = len(countries) * (len(keywords) + len(visibility_queries))
    if task_count > maximum_tasks:
        raise ValueError(f"Configured task count {task_count} exceeds maximum {maximum_tasks}")
    concurrent_requests = require_positive_integer(
        raw_config.get("concurrent_requests", 8), "concurrent_requests"
    )
    if concurrent_requests > 20:
        raise ValueError("Configuration field 'concurrent_requests' cannot exceed 20")
    return SerpConfig(
        target_domain=normalize_domain(
            require_string(raw_config.get("target_domain"), "target_domain")
        ),
        login_path=Path(require_string(raw_config.get("login_path"), "login_path")),
        password_path=Path(require_string(raw_config.get("password_path"), "password_path")),
        report_directory=Path(
            require_string(raw_config.get("report_directory"), "report_directory")
        ),
        countries=countries,
        keywords=keywords,
        visibility_queries=visibility_queries,
        rank_depth=require_positive_integer(raw_config.get("rank_depth", 100), "rank_depth"),
        visibility_depth=require_positive_integer(
            raw_config.get("visibility_depth", 20), "visibility_depth"
        ),
        maximum_tasks=maximum_tasks,
        history_limit=require_positive_integer(
            raw_config.get("history_limit", DEFAULT_HISTORY_LIMIT), "history_limit"
        ),
        timeout_seconds=require_positive_integer(
            raw_config.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS), "timeout_seconds"
        ),
        concurrent_requests=concurrent_requests,
        poll_interval_seconds=require_positive_integer(
            raw_config.get("poll_interval_seconds", 15), "poll_interval_seconds"
        ),
        maximum_wait_seconds=require_positive_integer(
            raw_config.get("maximum_wait_seconds", 900), "maximum_wait_seconds"
        ),
    )


def build_tasks(config: SerpConfig) -> list[dict[str, Any]]:
    """Build one bounded batch of rank and visibility tasks."""
    tasks: list[dict[str, Any]] = []
    for country in config.countries:
        common_fields = {
            "location_code": country.location_code,
            "language_code": country.language_code,
            "device": "desktop",
            "os": "windows",
        }
        for keyword_index, keyword in enumerate(config.keywords):
            tasks.append(
                {
                    **common_fields,
                    "keyword": keyword.text,
                    "depth": config.rank_depth,
                    "tag": f"rank|{country.code}|{keyword_index}",
                }
            )
        for query_index, query in enumerate(config.visibility_queries):
            tasks.append(
                {
                    **common_fields,
                    "keyword": query.query,
                    "depth": config.visibility_depth,
                    "tag": f"visibility|{country.code}|{query_index}",
                }
            )
    if len(tasks) > config.maximum_tasks:
        raise ValueError("Generated task count exceeds the configured maximum")
    return tasks


def read_secret(secret_path: Path) -> str:
    """Read a non-empty owner-only credential file."""
    if not secret_path.is_file():
        raise FileNotFoundError(f"Secret file not found: {secret_path}")
    if secret_path.stat().st_mode & 0o077:
        raise PermissionError(f"Secret file permissions are too broad: {secret_path}")
    value = secret_path.read_text(encoding="utf-8").strip()
    if not value:
        raise ValueError(f"Secret file is empty: {secret_path}")
    return value


def authorization_header(config: SerpConfig) -> str:
    """Build the DataForSEO Basic authorization value."""
    login = read_secret(config.login_path)
    password = read_secret(config.password_path)
    encoded_credentials = base64.b64encode(f"{login}:{password}".encode()).decode()
    return f"Basic {encoded_credentials}"


def request_json(
    config: SerpConfig,
    authorization: str,
    url: str,
    payload: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Execute one authenticated DataForSEO JSON request."""
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        method="POST" if payload is not None else "GET",
        headers={
            "Authorization": authorization,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=config.timeout_seconds) as response:
            response_body = json.load(response)
    except urllib.error.HTTPError as error:
        response_text = error.read().decode("utf-8", errors="replace")
        try:
            response_body = json.loads(response_text)
        except json.JSONDecodeError as decode_error:
            raise RuntimeError(
                f"DataForSEO returned non-JSON HTTP {error.code}: {response_text}"
            ) from decode_error
        if not response_body:
            raise RuntimeError(
                f"DataForSEO returned empty HTTP {error.code} response"
            ) from error
        return response_body
    if response_body.get("status_code") != SUCCESS_STATUS_CODE:
        raise RuntimeError(
            f"DataForSEO API error {response_body.get('status_code')}: "
            f"{response_body.get('status_message')}"
        )
    return response_body


def post_tasks(
    config: SerpConfig,
    authorization: str,
    tasks: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]], float]:
    """Create all Standard SERP tasks in one request."""
    response_body = request_json(config, authorization, TASK_POST_ENDPOINT, tasks)
    created_tasks: dict[str, dict[str, Any]] = {}
    failed_tasks: list[dict[str, Any]] = []
    charged_cost = 0.0
    for response_task in response_body.get("tasks") or []:
        charged_cost += float(response_task.get("cost") or 0)
        if response_task.get("status_code") == TASK_CREATED_STATUS_CODE:
            task_id = response_task.get("id")
            if not isinstance(task_id, str) or not task_id:
                raise ValueError("DataForSEO created task is missing its id")
            created_tasks[task_id] = response_task.get("data") or {}
        else:
            failed_tasks.append(response_task)
    if len(created_tasks) + len(failed_tasks) != len(tasks):
        raise ValueError("DataForSEO task_post response count does not match submitted tasks")
    return created_tasks, failed_tasks, charged_cost


def fetch_ready_ids(config: SerpConfig, authorization: str) -> set[str]:
    """Return IDs currently ready for Standard SERP retrieval."""
    response_body = request_json(config, authorization, TASKS_READY_ENDPOINT)
    ready_ids: set[str] = set()
    for response_task in response_body.get("tasks") or []:
        for result in response_task.get("result") or []:
            task_id = result.get("id")
            if isinstance(task_id, str) and task_id:
                ready_ids.add(task_id)
    return ready_ids


def get_completed_task(
    config: SerpConfig,
    authorization: str,
    task_id: str,
) -> dict[str, Any]:
    """Retrieve one completed Standard SERP task."""
    response_body = request_json(
        config,
        authorization,
        TASK_GET_ENDPOINT_TEMPLATE.format(task_id=urllib.parse.quote(task_id, safe="")),
    )
    response_tasks = response_body.get("tasks") or []
    if len(response_tasks) != 1:
        raise ValueError(f"DataForSEO task_get returned {len(response_tasks)} tasks for {task_id}")
    return response_tasks[0]


def timeout_task(original_task: dict[str, Any]) -> dict[str, Any]:
    """Build an explicit error record for a task that exceeded the wait window."""
    return {
        "status_code": 59800,
        "status_message": "DataForSEO task did not become ready before timeout",
        "cost": 0,
        "data": original_task,
        "result": None,
    }


def pending_state_path(config: SerpConfig) -> Path:
    """Return the persistent Standard-task state path."""
    return config.report_directory / "serp-pending.json"


def save_pending_state(
    config: SerpConfig,
    pending_tasks: dict[str, dict[str, Any]],
    completed_tasks: list[dict[str, Any]],
    charged_cost: float,
) -> None:
    """Persist created IDs before waiting for DataForSEO processing."""
    config.report_directory.mkdir(parents=True, exist_ok=True)
    write_json(
        pending_state_path(config),
        {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "charged_cost_usd": charged_cost,
            "pending_tasks": pending_tasks,
            "completed_tasks": completed_tasks,
        },
    )


def load_or_create_pending_state(
    config: SerpConfig,
    authorization: str,
    tasks: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]], float]:
    """Resume existing paid tasks or create and persist a new set."""
    state_path = pending_state_path(config)
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
        pending_tasks = state.get("pending_tasks")
        completed_tasks = state.get("completed_tasks")
        if not isinstance(pending_tasks, dict) or not isinstance(completed_tasks, list):
            raise ValueError(f"Invalid pending SERP state: {state_path}")
        return (
            pending_tasks,
            completed_tasks,
            float(state.get("charged_cost_usd") or 0),
        )
    pending_tasks, completed_tasks, charged_cost = post_tasks(
        config, authorization, tasks
    )
    save_pending_state(
        config, pending_tasks, completed_tasks, charged_cost
    )
    return pending_tasks, completed_tasks, charged_cost


def request_results(config: SerpConfig, tasks: list[dict[str, Any]]) -> dict[str, Any]:
    """Create Standard tasks, wait for readiness, and retrieve every result."""
    authorization = authorization_header(config)
    pending_tasks, completed_tasks, charged_cost = load_or_create_pending_state(
        config, authorization, tasks
    )
    deadline = time.monotonic() + config.maximum_wait_seconds
    while pending_tasks and time.monotonic() < deadline:
        ready_ids = fetch_ready_ids(config, authorization) & pending_tasks.keys()
        if not ready_ids:
            time.sleep(config.poll_interval_seconds)
            continue
        with ThreadPoolExecutor(max_workers=config.concurrent_requests) as executor:
            futures = {
                executor.submit(get_completed_task, config, authorization, task_id): task_id
                for task_id in ready_ids
            }
            for future in as_completed(futures):
                task_id = futures[future]
                try:
                    completed_tasks.append(future.result())
                except Exception as error:
                    completed_tasks.append(
                        {
                            "status_code": 59999,
                            "status_message": str(error),
                            "cost": 0,
                            "data": pending_tasks[task_id],
                            "result": None,
                        }
                    )
                pending_tasks.pop(task_id)
        save_pending_state(
            config, pending_tasks, completed_tasks, charged_cost
        )
    if not pending_tasks:
        pending_state_path(config).unlink(missing_ok=True)
    completed_tasks.extend(timeout_task(task) for task in pending_tasks.values())
    return {
        "status_code": SUCCESS_STATUS_CODE,
        "charged_cost_usd": charged_cost,
        "tasks": completed_tasks,
    }


def parse_tag(task: dict[str, Any]) -> tuple[str, str, int]:
    """Parse the collector tag echoed in a DataForSEO response task."""
    tag = (task.get("data") or {}).get("tag")
    if not isinstance(tag, str):
        raise ValueError("DataForSEO task is missing its collector tag")
    parts = tag.split("|")
    if len(parts) != 3 or not parts[2].isdigit():
        raise ValueError(f"Invalid DataForSEO collector tag: {tag}")
    return parts[0], parts[1], int(parts[2])


def organic_items(task: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract organic result items from a task."""
    return [
        item
        for result in (task.get("result") or [])
        for item in (result.get("items") or [])
        if item.get("type") == "organic"
    ]


def domain_matches(candidate: str, expected_domain: str) -> bool:
    """Return whether a result belongs to an expected domain."""
    candidate_domain = normalize_domain(candidate)
    return candidate_domain == expected_domain or candidate_domain.endswith(
        f".{expected_domain}"
    )


def matching_item(
    items: list[dict[str, Any]], expected_domains: tuple[str, ...]
) -> dict[str, Any] | None:
    """Return the highest organic result matching expected domains."""
    matches = [
        item
        for item in items
        if any(domain_matches(str(item.get("domain", "")), domain) for domain in expected_domains)
    ]
    if not matches:
        return None
    return min(matches, key=lambda item: item.get("rank_group") or 10**9)


def competitor_sample(
    items: list[dict[str, Any]], target_domain: str
) -> list[dict[str, Any]]:
    """Return the first three non-target organic competitors."""
    competitors: list[dict[str, Any]] = []
    for item in items:
        domain = normalize_domain(str(item.get("domain", "")))
        if not domain or domain_matches(domain, target_domain):
            continue
        competitors.append(
            {
                "domain": domain,
                "organic_rank": item.get("rank_group"),
                "url": item.get("url"),
            }
        )
        if len(competitors) == COMPETITOR_SAMPLE_LIMIT:
            break
    return competitors


def ranking_result(
    config: SerpConfig, country: Country, keyword: Keyword, items: list[dict[str, Any]]
) -> dict[str, Any]:
    """Build one exact target-keyword ranking record."""
    target_item = matching_item(items, (config.target_domain,))
    return {
        "country_code": country.code,
        "country_name": country.name,
        "keyword": keyword.text,
        "category": keyword.category,
        "found": target_item is not None,
        "organic_rank": target_item.get("rank_group") if target_item else None,
        "serp_position": target_item.get("rank_absolute") if target_item else None,
        "ranking_url": target_item.get("url") if target_item else None,
        "top_competitors": competitor_sample(items, config.target_domain),
    }


def visibility_result(
    country: Country, query: VisibilityQuery, items: list[dict[str, Any]]
) -> dict[str, Any]:
    """Build one brand or external-platform visibility record."""
    result_item = matching_item(items, query.expected_domains)
    return {
        "country_code": country.code,
        "country_name": country.name,
        "name": query.name,
        "query": query.query,
        "found": result_item is not None,
        "organic_rank": result_item.get("rank_group") if result_item else None,
        "url": result_item.get("url") if result_item else None,
        "title": result_item.get("title") if result_item else None,
    }


def rank_distribution(results: list[dict[str, Any]]) -> dict[str, int]:
    """Count ranks within each threshold and outside the top 100."""
    distribution = {
        f"top_{threshold}": sum(
            result["organic_rank"] is not None and result["organic_rank"] <= threshold
            for result in results
        )
        for threshold in RANK_THRESHOLDS
    }
    distribution["not_found_top_100"] = sum(not result["found"] for result in results)
    return distribution


def competitor_summary(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aggregate recurring top-three competitor domains."""
    ranks_by_domain: dict[str, list[int]] = defaultdict(list)
    for result in results:
        for competitor in result["top_competitors"]:
            rank = competitor.get("organic_rank")
            if isinstance(rank, int):
                ranks_by_domain[competitor["domain"]].append(rank)
    summary = [
        {
            "domain": domain,
            "appearances": len(ranks),
            "average_organic_rank": round(sum(ranks) / len(ranks), 2),
        }
        for domain, ranks in ranks_by_domain.items()
    ]
    return sorted(
        summary, key=lambda item: (-item["appearances"], item["average_organic_rank"])
    )[:20]


def parse_report(config: SerpConfig, response_body: dict[str, Any]) -> dict[str, Any]:
    """Parse rank tasks into compact report data."""
    countries = {country.code: country for country in config.countries}
    rankings: list[dict[str, Any]] = []
    visibility: list[dict[str, Any]] = []
    task_errors: list[dict[str, Any]] = []
    charged_cost = float(response_body.get("charged_cost_usd") or 0)
    for task in response_body.get("tasks") or []:
        if "charged_cost_usd" not in response_body:
            charged_cost += float(task.get("cost") or 0)
        task_type, country_code, item_index = parse_tag(task)
        if task.get("status_code") != SUCCESS_STATUS_CODE:
            task_errors.append(
                {
                    "tag": (task.get("data") or {}).get("tag"),
                    "status_code": task.get("status_code"),
                    "status_message": task.get("status_message"),
                }
            )
            continue
        items = organic_items(task)
        country = countries[country_code]
        if task_type == "rank":
            rankings.append(
                ranking_result(config, country, config.keywords[item_index], items)
            )
        elif task_type == "visibility":
            visibility.append(
                visibility_result(country, config.visibility_queries[item_index], items)
            )
        else:
            raise ValueError(f"Unsupported DataForSEO task type: {task_type}")
    country_distributions = {
        country.code: rank_distribution(
            [result for result in rankings if result["country_code"] == country.code]
        )
        for country in config.countries
    }
    return {
        "schema_version": 1,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "search_engine": "google",
        "device": "desktop",
        "target_domain": config.target_domain,
        "rank_depth": config.rank_depth,
        "task_count": len(response_body.get("tasks") or []),
        "charged_cost_usd": round(charged_cost, 4),
        "task_errors": task_errors,
        "rank_distribution": rank_distribution(rankings),
        "country_distributions": country_distributions,
        "ranking_results": rankings,
        "visibility_results": visibility,
        "competitor_summary": competitor_summary(rankings),
    }


def history_snapshot(report: dict[str, Any]) -> dict[str, Any]:
    """Build one compact rank-history snapshot."""
    return {
        "collected_at": report["collected_at"],
        "country_distributions": report["country_distributions"],
        "ranks": [
            {
                "country_code": result["country_code"],
                "keyword": result["keyword"],
                "organic_rank": result["organic_rank"],
                "ranking_url": result["ranking_url"],
            }
            for result in report["ranking_results"]
        ],
        "visibility": [
            {
                "country_code": result["country_code"],
                "name": result["name"],
                "found": result["found"],
                "organic_rank": result["organic_rank"],
                "url": result["url"],
            }
            for result in report["visibility_results"]
        ],
    }


def write_json(path: Path, value: Any) -> None:
    """Write JSON through an atomic same-directory replacement."""
    temporary_path = path.with_name(f".{path.name}.tmp")
    temporary_path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary_path.replace(path)


def write_reports(report: dict[str, Any], config: SerpConfig) -> tuple[Path, Path]:
    """Write latest results and a bounded twelve-week history."""
    config.report_directory.mkdir(parents=True, exist_ok=True)
    latest_path = config.report_directory / "serp-latest.json"
    history_path = config.report_directory / "serp-history.json"
    history: list[dict[str, Any]] = []
    if history_path.exists():
        loaded_history = json.loads(history_path.read_text(encoding="utf-8"))
        if not isinstance(loaded_history, list):
            raise ValueError(f"SERP history must be a JSON array: {history_path}")
        history = loaded_history
    snapshot = history_snapshot(report)
    if history and history[-1].get("collected_at", "")[:10] == report["collected_at"][:10]:
        history[-1] = snapshot
    else:
        history.append(snapshot)
    write_json(latest_path, report)
    write_json(history_path, history[-config.history_limit :])
    return latest_path, history_path


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path, help="Path to SERP JSON config")
    return parser.parse_args()


def main() -> int:
    """Run one paid country-rank collection."""
    arguments = parse_arguments()
    config = load_config(arguments.config)
    tasks = build_tasks(config)
    response_body = request_results(config, tasks)
    report = parse_report(config, response_body)
    latest_path, history_path = write_reports(report, config)
    print(
        json.dumps(
            {
                "latest_report": str(latest_path),
                "history_report": str(history_path),
                "task_count": report["task_count"],
                "charged_cost_usd": report["charged_cost_usd"],
                "rank_distribution": report["rank_distribution"],
                "task_error_count": len(report["task_errors"]),
            },
            ensure_ascii=False,
        )
    )
    return 1 if report["task_errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
