#!/usr/bin/env python3
"""Recover paid DataForSEO results whose original task IDs were not persisted."""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from serp_collector import (
    authorization_header,
    build_tasks,
    fetch_ready_ids,
    get_completed_task,
    load_config,
    parse_report,
    parse_tag,
    write_json,
    write_reports,
)


def load_recovered_tasks(recovery_path: Path) -> dict[str, dict[str, Any]]:
    """Load previously retrieved task responses by collector tag."""
    if not recovery_path.exists():
        return {}
    state = json.loads(recovery_path.read_text(encoding="utf-8"))
    recovered_tasks = state.get("recovered_tasks")
    if not isinstance(recovered_tasks, dict):
        raise ValueError(f"Invalid SERP recovery state: {recovery_path}")
    return recovered_tasks


def read_original_cost(report_path: Path) -> float:
    """Read the already charged Standard-task cost from the timeout report."""
    if not report_path.exists():
        return 0.0
    report = json.loads(report_path.read_text(encoding="utf-8"))
    return float(report.get("charged_cost_usd") or 0)


def retrieve_ready_tasks(config, authorization: str, ready_ids: set[str]) -> list[dict[str, Any]]:
    """Retrieve all currently ready tasks with bounded parallelism."""
    retrieved_tasks: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=config.concurrent_requests) as executor:
        futures = {
            executor.submit(get_completed_task, config, authorization, task_id): task_id
            for task_id in ready_ids
        }
        for future in as_completed(futures):
            retrieved_tasks.append(future.result())
    return retrieved_tasks


def recover_once(config_path: Path) -> dict[str, Any]:
    """Retrieve one ready batch and finalize the report when all tags exist."""
    config = load_config(config_path)
    expected_tasks = build_tasks(config)
    expected_by_tag = {task["tag"]: task for task in expected_tasks}
    config.report_directory.mkdir(parents=True, exist_ok=True)
    latest_path = config.report_directory / "serp-latest.json"
    recovery_path = config.report_directory / "serp-recovery.json"
    recovered_by_tag = load_recovered_tasks(recovery_path)
    authorization = authorization_header(config)
    ready_ids = fetch_ready_ids(config, authorization)
    for response_task in retrieve_ready_tasks(config, authorization, ready_ids):
        task_type, country_code, item_index = parse_tag(response_task)
        tag = f"{task_type}|{country_code}|{item_index}"
        if tag in expected_by_tag:
            recovered_by_tag[tag] = response_task
    missing_tags = sorted(set(expected_by_tag) - set(recovered_by_tag))
    write_json(
        recovery_path,
        {
            "recovered_tasks": recovered_by_tag,
            "missing_tags": missing_tags,
        },
    )
    if missing_tags:
        return {
            "complete": False,
            "ready_count": len(ready_ids),
            "recovered_count": len(recovered_by_tag),
            "missing_count": len(missing_tags),
        }
    ordered_tasks = [recovered_by_tag[task["tag"]] for task in expected_tasks]
    response_body = {
        "status_code": 20000,
        "charged_cost_usd": read_original_cost(latest_path),
        "tasks": ordered_tasks,
    }
    report = parse_report(config, response_body)
    write_reports(report, config)
    recovery_path.unlink(missing_ok=True)
    return {
        "complete": True,
        "recovered_count": len(ordered_tasks),
        "task_error_count": len(report["task_errors"]),
        "rank_distribution": report["rank_distribution"],
    }


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path, help="Path to SERP JSON config")
    return parser.parse_args()


def main() -> int:
    """Run one free ready-result recovery check."""
    arguments = parse_arguments()
    result = recover_once(arguments.config)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
