#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "src" / "data" / "kex_control_sheet.csv"
JSON_PATH = ROOT / "src" / "data" / "kex_moment_ssd.json"

EXPECTED_HEADERS = [
    "ADDRESS",
    "TARGET_FOLDER",
    "ENTRY_POINT",
    "ACTION",
    "FIELD",
    "VALUE",
    "STATUS",
]


def audit() -> dict:
    with CSV_PATH.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        rows = list(reader)

    missing_cells = []
    for row_number, row in enumerate(rows, start=2):
        for header in EXPECTED_HEADERS:
            if not str(row.get(header, "")).strip():
                missing_cells.append({"row": row_number, "column": header})

    addresses = [row["ADDRESS"] for row in rows]
    duplicates = sorted(
        value for value, count in Counter(addresses).items() if count > 1
    )
    status_counts = dict(sorted(Counter(row["STATUS"] for row in rows).items()))

    with JSON_PATH.open(encoding="utf-8") as handle:
        substrate = json.load(handle)

    sectors = [
        {"id": sector_id, **record}
        for sector_id, record in substrate["sectors"].items()
    ]
    sectors.sort(key=lambda item: item["offset"])
    sector_ids = {item["id"] for item in sectors}

    span_mismatches = [
        item["id"]
        for item in sectors
        if item["end_offset"] - item["offset"] != item["byte_span_estimate"]
    ]

    overlaps = []
    gaps = []
    for previous, current in zip(sectors, sectors[1:]):
        if current["offset"] < previous["end_offset"]:
            overlaps.append(
                {
                    "previous": previous["id"],
                    "current": current["id"],
                    "previous_end": previous["end_offset"],
                    "current_start": current["offset"],
                }
            )
        elif current["offset"] > previous["end_offset"]:
            gaps.append(
                {
                    "previous": previous["id"],
                    "current": current["id"],
                    "previous_end": previous["end_offset"],
                    "current_start": current["offset"],
                    "gap": current["offset"] - previous["end_offset"],
                }
            )

    broken_links = [
        link
        for link in substrate["links"]
        if link["from"] not in sector_ids or link["to"] not in sector_ids
    ]

    source_hash_mismatches = [
        item["id"]
        for item in sectors
        if item["source_hash"] != substrate["source_sha256"]
    ]

    ledger_errors = []
    for index, packet in enumerate(substrate["ledger"]):
        if packet["packet_id"] != index + 1:
            ledger_errors.append(
                {"index": index, "reason": "PACKET_ID_SEQUENCE"}
            )
        expected_previous = (
            None if index == 0 else substrate["ledger"][index - 1]["packet_hash"]
        )
        if packet["prev_hash"] != expected_previous:
            ledger_errors.append(
                {"index": index, "reason": "PREV_HASH_MISMATCH"}
            )

    spans = [int(item["byte_span_estimate"]) for item in sectors]
    mean = sum(spans) / len(spans)
    variance = sum((value - mean) ** 2 for value in spans) / len(spans)

    structural_ok = not any(
        (
            missing_cells,
            duplicates,
            span_mismatches,
            overlaps,
            broken_links,
            source_hash_mismatches,
            ledger_errors,
        )
    )

    return {
        "schema": "kex.empirical-ground-truth-audit.v1",
        "sources": {
            "csv": str(CSV_PATH.relative_to(ROOT)),
            "json": str(JSON_PATH.relative_to(ROOT)),
        },
        "csv": {
            "rows": len(rows),
            "headers": headers,
            "header_match": headers == EXPECTED_HEADERS,
            "missing_cells": missing_cells,
            "duplicate_addresses": duplicates,
            "status_counts": status_counts,
            "inferential_statistics": (
                "NOT_JUSTIFIED: n=6 and fields are predominantly "
                "categorical/control metadata"
            ),
        },
        "substrate_json": {
            "claim_boundary": substrate["claim_boundary"],
            "sectors": len(sectors),
            "links": len(substrate["links"]),
            "ledger_packets": len(substrate["ledger"]),
            "span_min": min(spans),
            "span_max": max(spans),
            "span_mean": round(mean, 3),
            "span_stddev_population": round(math.sqrt(variance), 3),
            "span_mismatches": span_mismatches,
            "offset_overlaps": overlaps,
            "offset_gaps": gaps,
            "broken_links": broken_links,
            "sector_source_hash_mismatches": source_hash_mismatches,
            "ledger_chain_errors": ledger_errors,
        },
        "falsification": {
            "physical_ssd_capacity_proven": False,
            "runtime_mount_proven": False,
            "runtime_online_state_proven": False,
            "packet_integrity_100_percent_proven": False,
            "reason": (
                "Checked-in files describe virtual/static metadata; "
                "they do not provide live host, mount, socket, or device readback."
            ),
        },
        "empirical_state": (
            "STATIC_DATA_STRUCTURALLY_CONSISTENT"
            if structural_ok
            else "STATIC_DATA_HAS_STRUCTURAL_DEFECTS"
        ),
    }


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2, sort_keys=True))
