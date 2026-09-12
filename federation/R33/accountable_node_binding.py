#!/usr/bin/env python3
"""Accountability admission wrapper around the resident R33 node binding adapter.

The existing node_binding_adapter.bind implementation remains the binding
mechanic. This module only verifies a governance-bound request for the
SOFTWARE_NODES target, invokes that mechanic, and checks its authority-preserving
readback.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping

try:
    from .node_binding_adapter import bind
except ImportError:
    from node_binding_adapter import bind

ENVELOPE_SCHEMA = "keddeh.accountability-bound-envelope.r33.v1"
DECISION_SCHEMA = "keddeh.accountability-admission.r33.v1"
SCHEMA = "keddeh.accountable-software-node-binding.r33/v1"


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode("utf-8")


def root(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def verify_envelope(envelope: Mapping[str, Any]) -> None:
    if envelope.get("schema") != ENVELOPE_SCHEMA:
        raise ValueError("ACCOUNTABILITY_ENVELOPE_SCHEMA_INVALID")
    supplied = str(envelope.get("envelope_root") or "")
    body = {k: v for k, v in envelope.items() if k != "envelope_root"}
    if not supplied or root(body) != supplied:
        raise ValueError("ACCOUNTABILITY_ENVELOPE_ROOT_INVALID")
    decision = envelope.get("decision_receipt")
    if not isinstance(decision, Mapping) or decision.get("schema") != DECISION_SCHEMA:
        raise ValueError("ACCOUNTABILITY_DECISION_INVALID")
    decision_root = str(decision.get("receipt_root") or "")
    decision_body = {k: v for k, v in decision.items() if k != "receipt_root"}
    if not decision_root or root(decision_body) != decision_root:
        raise ValueError("ACCOUNTABILITY_DECISION_ROOT_INVALID")
    if decision.get("decision") != "ALLOW":
        raise PermissionError("ACCOUNTABILITY_DECISION_NOT_ALLOW")
    if envelope.get("target_domain") != "SOFTWARE_NODES":
        raise PermissionError("ACCOUNTABILITY_TARGET_NOT_SOFTWARE_NODES")


def bind_accountable(node: Mapping[str, Any], envelope: Mapping[str, Any]) -> dict[str, Any]:
    verify_envelope(envelope)
    if envelope.get("subject") != node.get("node_id"):
        raise ValueError("ACCOUNTABILITY_SUBJECT_NODE_MISMATCH")
    receipt = bind(node)
    if receipt.get("node_authority_mutated") is not False:
        raise RuntimeError("NODE_BINDING_AUTHORITY_SHIFT_DETECTED")
    if receipt.get("node_id") != node.get("node_id") or receipt.get("authority_root") != node.get("authority_root"):
        raise RuntimeError("NODE_BINDING_IDENTITY_DRIFT_DETECTED")
    body = {
        "schema": SCHEMA,
        "node_id": node.get("node_id"),
        "accountability_envelope_root": envelope.get("envelope_root"),
        "binding_receipt_root": receipt.get("receipt_root"),
        "binding_status": receipt.get("status"),
        "node_authority_mutated": False,
        "reported_state": receipt.get("status"),
    }
    return {**body, "receipt_root": root(body)}
