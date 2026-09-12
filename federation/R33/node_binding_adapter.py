#!/usr/bin/env python3
"""KEDDEH software-node R33 binding adapter.

Consumes a BRAINK node-transition object and proves whether it can bind to an
already-active sector node. It does not replace or mutate BRAINK node authority.
The returned receipt is evidence that BRAINK may use for an adjacent transition.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping
import hashlib
import json
import time

SCHEMA = "keddeh.software-node-binding.r33/v1"
HERE = Path(__file__).resolve().parent
ACTIVE_NODES = HERE.parent / "R16" / "ACTIVE_SECTOR_NODES_R16.json"


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode("utf-8")


def sha(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def active_sector_nodes(path: Path = ACTIVE_NODES) -> dict[str, Mapping[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {str(node["sector_id"]): node for node in raw.get("nodes", [])}


def bind(node: Mapping[str, Any], *, path: Path = ACTIVE_NODES) -> dict[str, Any]:
    if node.get("schema") != "braink.node-transition.r33/v1":
        raise ValueError("UNSUPPORTED_NODE_SCHEMA")
    if node.get("state") != "NODE_MATERIALIZED":
        raise ValueError("NODE_MUST_BE_MATERIALIZED_BEFORE_BIND")
    if not node.get("node_id") or not node.get("source_root") or not node.get("payload_root"):
        raise ValueError("NODE_INTEGRITY_FIELDS_REQUIRED")
    if not node.get("authority_root") or node.get("authority_root") == "UNBOUND":
        raise PermissionError("NODE_AUTHORITY_UNBOUND")

    sectors = active_sector_nodes(path)
    sector_id = str(node.get("sector_id", ""))
    sector = sectors.get(sector_id)
    if sector is None:
        status = "EDGE_HOLD_UNKNOWN_SECTOR"
        target = None
    elif sector.get("state") != "ACTIVE_BOUND":
        status = "EDGE_HOLD_SECTOR_NOT_ACTIVE"
        target = dict(sector)
    else:
        status = "EDGE_BOUND"
        target = dict(sector)

    body = {
        "schema": SCHEMA,
        "node_id": node["node_id"],
        "source_root": node["source_root"],
        "payload_root": node["payload_root"],
        "authority_root": node["authority_root"],
        "sector_id": sector_id,
        "capability": node.get("capability"),
        "status": status,
        "target_sector_node": target,
        "binding_source": "federation/R16/ACTIVE_SECTOR_NODES_R16.json",
        "node_authority_mutated": False,
        "observed_ns": time.time_ns(),
    }
    body["receipt_root"] = sha(body)
    return body


def self_test() -> dict[str, Any]:
    node = {
        "schema": "braink.node-transition.r33/v1",
        "node_id": "node:test",
        "source_root": "a" * 64,
        "payload_root": "b" * 64,
        "authority_root": "authority:test",
        "sector_id": "ENTERPRISE_AUTOMATION",
        "capability": "FUNCTION_RND_ENGINEERING",
        "state": "NODE_MATERIALIZED",
    }
    bound = bind(node)
    assert bound["status"] == "EDGE_BOUND"
    assert bound["node_authority_mutated"] is False
    unknown = dict(node, node_id="node:unknown", sector_id="NOT_A_REAL_SECTOR")
    held = bind(unknown)
    assert held["status"] == "EDGE_HOLD_UNKNOWN_SECTOR"
    return {"status": "PASS", "checks": ["active_sector_bind", "unknown_sector_fail_closed", "node_authority_preserved"]}


if __name__ == "__main__":
    print(json.dumps(self_test(), indent=2, sort_keys=True))
