from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
import json
import math
import re
from typing import Any, Dict, List, Mapping, Optional, Sequence, Set


ACTIVE = "ACTIVE"
REVIEW_REQUIRED = "REVIEW_REQUIRED"
FALSIFIED = "FALSIFIED"
VALID_CLAIM_STATES = frozenset({ACTIVE, REVIEW_REQUIRED, FALSIFIED})


class GraphValidationError(Exception):
    """Raised when theorem-graph state or routing input is invalid."""


class ParentTheoremNotFoundError(GraphValidationError):
    """Raised when a theorem references a parent that is not registered."""


class TensorViolationError(GraphValidationError):
    """Raised when a theorem violates the minimum tensor constraint."""


class ReviewBlocked(GraphValidationError):
    """Raised when a theorem cannot be revalidated because a parent is not ACTIVE."""

    def __init__(self, theorem_id: str, blockers: Sequence[str], status: str) -> None:
        self.theorem_id = theorem_id
        self.blockers = tuple(blockers)
        self.status = status
        super().__init__(
            f"Revalidation blocked for {theorem_id}: status={status}; "
            f"non-active parents={','.join(self.blockers)}"
        )


class TheoremNotActive(GraphValidationError):
    """Raised when routing is attempted for a non-ACTIVE theorem."""

    def __init__(
        self,
        theorem_id: str,
        status: str,
        causes: Sequence[str],
        blockers: Sequence[str],
    ) -> None:
        self.theorem_id = theorem_id
        self.status = status
        self.causes = tuple(causes)
        self.blockers = tuple(blockers)
        super().__init__(
            f"Theorem {theorem_id} is not ACTIVE: status={status}; "
            f"blockers={','.join(self.blockers) or 'none'}; "
            f"causes={','.join(self.causes) or 'none'}"
        )


class GraphIntegrityError(GraphValidationError):
    """Raised when stored graph claim-state violates dependency consistency."""

    def __init__(self, theorem_id: str, ancestors: Sequence[str]) -> None:
        self.theorem_id = theorem_id
        self.ancestors = tuple(ancestors)
        super().__init__(
            f"ACTIVE theorem {theorem_id} has non-ACTIVE ancestor(s): "
            f"{','.join(self.ancestors)}"
        )


class GraphEventLedger:
    """Small append-only local ledger adapter for graph state transitions.

    Signature intentionally stays boring:
        append(event_type, theorem_id, *, evidence=None, metadata=None)
    """

    def __init__(self) -> None:
        self._events: List[Dict[str, Any]] = []
        self._head_hash = "GENESIS"

    @property
    def events(self) -> List[Dict[str, Any]]:
        return [dict(event) for event in self._events]

    def append(
        self,
        event_type: str,
        theorem_id: str,
        *,
        evidence: Optional[str] = None,
        metadata: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        if not isinstance(event_type, str) or not event_type.strip():
            raise ValueError("event_type must be a non-empty string")
        if not isinstance(theorem_id, str) or not theorem_id.strip():
            raise ValueError("theorem_id must be a non-empty string")
        if metadata is not None and not isinstance(metadata, Mapping):
            raise ValueError("metadata must be a mapping")

        body = {
            "sequence": len(self._events) + 1,
            "event_type": event_type.strip(),
            "theorem_id": theorem_id.strip(),
            "evidence": evidence,
            "metadata": dict(metadata or {}),
            "previous_hash": self._head_hash,
        }
        encoded = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        body["event_hash"] = sha256(encoded).hexdigest()
        self._head_hash = body["event_hash"]
        self._events.append(body)
        return dict(body)


@dataclass(frozen=True)
class TheoremNode:
    theorem_id: str
    constraints: Mapping[str, Any]
    parent_ids: tuple[str, ...] = field(default_factory=tuple)
    operators: frozenset[str] = field(default_factory=frozenset)


class MasterTheoremGraphRegistry:
    """Strict local theorem registry with claim-state and dependency enforcement."""

    MIN_TENSOR = 7.0

    def __init__(self, ledger: Optional[GraphEventLedger] = None) -> None:
        self._nodes: Dict[str, TheoremNode] = {}
        self._status: Dict[str, str] = {}
        self._causes: Dict[str, tuple[str, ...]] = {}
        self.ledger = ledger if ledger is not None else GraphEventLedger()

    def register(
        self,
        theorem_id: str,
        constraints: Mapping[str, Any],
        parent_ids: Optional[Sequence[str]] = None,
        parent_operators: Optional[Sequence[str]] = None,
    ) -> TheoremNode:
        theorem_id = self._validate_theorem_id(theorem_id)
        if theorem_id in self._nodes:
            raise GraphValidationError(f"Theorem already registered: {theorem_id}")

        if not isinstance(constraints, Mapping):
            raise GraphValidationError("constraints must be a mapping")

        parent_ids = tuple(parent_ids or ())
        direct_operators = tuple(parent_operators or ())

        missing = [parent_id for parent_id in parent_ids if parent_id not in self._nodes]
        if missing:
            raise ParentTheoremNotFoundError(
                f"Missing parent theorem(s) for {theorem_id}: {', '.join(missing)}"
            )

        tensor_min = constraints.get("tensor_min")
        if isinstance(tensor_min, bool) or not isinstance(tensor_min, (int, float)):
            raise TensorViolationError(
                f"{theorem_id} requires numeric tensor_min >= {self.MIN_TENSOR}"
            )
        tensor_min = float(tensor_min)
        if not math.isfinite(tensor_min) or tensor_min < self.MIN_TENSOR:
            raise TensorViolationError(
                f"{theorem_id} tensor_min={tensor_min!r} violates minimum {self.MIN_TENSOR}"
            )

        inherited: Set[str] = set()
        for parent_id in parent_ids:
            inherited.update(self._nodes[parent_id].operators)

        for operator in direct_operators:
            if not isinstance(operator, str) or not operator.strip():
                raise GraphValidationError("operators must be non-empty strings")
            inherited.add(operator.strip())

        node = TheoremNode(
            theorem_id=theorem_id,
            constraints=dict(constraints),
            parent_ids=parent_ids,
            operators=frozenset(inherited),
        )
        self._nodes[theorem_id] = node

        non_active_parents = [
            parent_id for parent_id in parent_ids if self._status[parent_id] != ACTIVE
        ]
        if non_active_parents:
            self._status[theorem_id] = REVIEW_REQUIRED
            self._causes[theorem_id] = tuple(
                f"parent:{parent_id}:{self._status[parent_id]}"
                for parent_id in non_active_parents
            )
            self.ledger.append(
                "THEOREM_REGISTERED_REVIEW_REQUIRED",
                theorem_id,
                metadata={
                    "parent_ids": list(parent_ids),
                    "non_active_parents": non_active_parents,
                },
            )
        else:
            self._status[theorem_id] = ACTIVE
            self._causes[theorem_id] = ()
            self.ledger.append(
                "THEOREM_REGISTERED",
                theorem_id,
                metadata={"parent_ids": list(parent_ids)},
            )
        return node

    def get(self, theorem_id: str) -> TheoremNode:
        try:
            return self._nodes[theorem_id]
        except KeyError as exc:
            raise GraphValidationError(f"Unregistered theorem: {theorem_id}") from exc

    def theorem_ids(self) -> tuple[str, ...]:
        return tuple(self._nodes.keys())

    def children_of(self, theorem_id: str) -> tuple[str, ...]:
        self.get(theorem_id)
        return tuple(
            node.theorem_id
            for node in self._nodes.values()
            if theorem_id in node.parent_ids
        )

    def status(self, theorem_id: str) -> str:
        self.get(theorem_id)
        return self._status[theorem_id]

    def causes(self, theorem_id: str) -> tuple[str, ...]:
        self.get(theorem_id)
        return tuple(self._causes.get(theorem_id, ()))

    def blockers(self, theorem_id: str) -> tuple[str, ...]:
        """Return all non-ACTIVE ancestors, nearest discovered first."""
        node = self.get(theorem_id)
        queue = list(node.parent_ids)
        seen: Set[str] = set()
        blocked: List[str] = []
        while queue:
            parent_id = queue.pop(0)
            if parent_id in seen:
                continue
            seen.add(parent_id)
            if self._status[parent_id] != ACTIVE:
                blocked.append(parent_id)
            queue.extend(self._nodes[parent_id].parent_ids)
        return tuple(blocked)

    def invalidate(self, theorem_id: str, *, evidence: str) -> Dict[str, Any]:
        self.get(theorem_id)
        evidence = self._require_evidence(evidence)

        self._status[theorem_id] = FALSIFIED
        self._causes[theorem_id] = (f"evidence:{evidence}",)
        invalidation_event = self.ledger.append(
            "THEOREM_INVALIDATED",
            theorem_id,
            evidence=evidence,
            metadata={"status": FALSIFIED},
        )

        affected: List[str] = []
        queue = list(self.children_of(theorem_id))
        seen: Set[str] = set()
        while queue:
            child_id = queue.pop(0)
            if child_id in seen:
                continue
            seen.add(child_id)

            if self._status[child_id] != FALSIFIED:
                self._status[child_id] = REVIEW_REQUIRED
                cause = f"upstream:{theorem_id}"
                existing = list(self._causes.get(child_id, ()))
                if cause not in existing:
                    existing.append(cause)
                self._causes[child_id] = tuple(existing)
                affected.append(child_id)
                self.ledger.append(
                    "DESCENDANT_REVIEW_REQUIRED",
                    child_id,
                    evidence=evidence,
                    metadata={
                        "invalidated_ancestor": theorem_id,
                        "status": REVIEW_REQUIRED,
                    },
                )
            queue.extend(self.children_of(child_id))

        return {
            "status": FALSIFIED,
            "theorem_id": theorem_id,
            "affected": affected,
            "ledger_event_hash": invalidation_event["event_hash"],
        }

    def revalidate(self, theorem_id: str, *, evidence: str) -> Dict[str, Any]:
        node = self.get(theorem_id)
        evidence = self._require_evidence(evidence)
        current_status = self._status[theorem_id]

        non_active_parents = tuple(
            parent_id for parent_id in node.parent_ids if self._status[parent_id] != ACTIVE
        )
        if non_active_parents:
            self.ledger.append(
                "REVALIDATION_BLOCKED",
                theorem_id,
                evidence=evidence,
                metadata={
                    "status": current_status,
                    "blockers": list(non_active_parents),
                },
            )
            raise ReviewBlocked(theorem_id, non_active_parents, current_status)

        self._status[theorem_id] = ACTIVE
        self._causes[theorem_id] = ()
        event = self.ledger.append(
            "THEOREM_REVALIDATED",
            theorem_id,
            evidence=evidence,
            metadata={"prior_status": current_status, "status": ACTIVE},
        )
        return {
            "status": ACTIVE,
            "theorem_id": theorem_id,
            "ledger_event_hash": event["event_hash"],
        }

    def validate(self) -> Dict[str, Any]:
        for theorem_id in self.theorem_ids():
            state = self._status.get(theorem_id)
            if state not in VALID_CLAIM_STATES:
                raise GraphIntegrityError(theorem_id, ())
            if state == ACTIVE:
                blocked = self.blockers(theorem_id)
                if blocked:
                    raise GraphIntegrityError(theorem_id, blocked)
        return {"status": "VALID", "theorem_count": len(self._nodes)}

    def __contains__(self, theorem_id: object) -> bool:
        return theorem_id in self._nodes

    @staticmethod
    def _require_evidence(evidence: str) -> str:
        if not isinstance(evidence, str) or not evidence.strip():
            raise ValueError("evidence must be a non-empty string")
        return evidence.strip()

    @staticmethod
    def _validate_theorem_id(theorem_id: str) -> str:
        if not isinstance(theorem_id, str) or not theorem_id.strip():
            raise GraphValidationError("theorem_id must be a non-empty string")
        value = theorem_id.strip()
        if not re.fullmatch(r"[A-Za-z0-9_.:-]+", value):
            raise GraphValidationError(
                "theorem_id may contain only letters, digits, _, ., :, and -"
            )
        return value


class StrictBranchRouter:
    """Routes only ACTIVE registered theorem objects through supported sectors."""

    ALLOWED_SECTORS = frozenset(
        {
            "cosmology",
            "semitic_decode",
            "governance",
            "runtime_architecture",
            "proof_systems",
            "observer_state",
            "motif_registry",
        }
    )

    def __init__(self, registry: MasterTheoremGraphRegistry) -> None:
        if not isinstance(registry, MasterTheoremGraphRegistry):
            raise GraphValidationError("registry must be a MasterTheoremGraphRegistry")
        self._registry = registry
        self._sequence = 0

    @property
    def sequence(self) -> int:
        return self._sequence

    def route(self, theorem_id: str, context: Mapping[str, Any]) -> Dict[str, Any]:
        node = self._registry.get(theorem_id)
        theorem_status = self._registry.status(theorem_id)
        if theorem_status != ACTIVE:
            blockers = self._registry.blockers(theorem_id)
            causes = self._registry.causes(theorem_id)
            self._registry.ledger.append(
                "ROUTE_REJECTED",
                theorem_id,
                metadata={
                    "status": theorem_status,
                    "causes": list(causes),
                    "blockers": list(blockers),
                    "route_sequence": self._sequence,
                },
            )
            raise TheoremNotActive(theorem_id, theorem_status, causes, blockers)

        if not isinstance(context, Mapping):
            raise GraphValidationError("route context must be a mapping")

        sector = context.get("sector")
        if sector not in self.ALLOWED_SECTORS:
            raise GraphValidationError(f"Unregistered sector: {sector!r}")

        resonance = context.get("resonance")
        if isinstance(resonance, bool) or not isinstance(resonance, (int, float)):
            raise GraphValidationError("resonance must be a finite numeric value")
        resonance = float(resonance)
        if not math.isfinite(resonance) or resonance <= 0:
            raise GraphValidationError("resonance must be finite and > 0")

        tensor_min = float(node.constraints["tensor_min"])
        operator_factor = max(1, len(node.operators))
        parent_factor = 1.0 + (0.125 * len(node.parent_ids))
        computed_metric = round(
            tensor_min * resonance * operator_factor * parent_factor,
            12,
        )

        next_sequence = self._sequence + 1
        route_material = (
            f"{next_sequence}|{node.theorem_id}|{sector}|{resonance:.12g}|{tensor_min:.12g}|"
            f"{','.join(sorted(node.operators))}|{','.join(node.parent_ids)}"
        )
        route_receipt = sha256(route_material.encode("utf-8")).hexdigest()
        self._sequence = next_sequence
        self._registry.ledger.append(
            "ROUTE_ACCEPTED",
            theorem_id,
            metadata={
                "sector": sector,
                "route_sequence": self._sequence,
                "route_receipt": route_receipt,
            },
        )

        return {
            "status": "VALIDATED_AND_ROUTED",
            "theorem_id": node.theorem_id,
            "sector": sector,
            "computed_metric": computed_metric,
            "operators": sorted(node.operators),
            "parent_ids": list(node.parent_ids),
            "route_receipt": route_receipt,
            "route_sequence": self._sequence,
        }


class BilateralCompressor:
    """Produces deterministic structural reduction with a claim fingerprint."""

    _word_re = re.compile(r"[A-Za-z0-9']+")
    _stop_words = frozenset(
        {
            "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
            "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
        }
    )

    def compress(self, text: str) -> Dict[str, Any]:
        if not isinstance(text, str) or not text.strip():
            raise GraphValidationError("compress expects non-empty text")

        words = self._word_re.findall(text)
        if not words:
            raise GraphValidationError("compress input contains no structural tokens")

        canonical = " ".join(word.lower() for word in words)
        fingerprint = sha256(canonical.encode("utf-8")).hexdigest()[:16]

        structural_tokens: List[str] = []
        seen: Set[str] = set()
        for word in words:
            token = word.lower()
            if token in self._stop_words or token in seen:
                continue
            seen.add(token)
            structural_tokens.append(token)

        compressed_form = (
            f"CLAIM[{fingerprint}]::TOKENS[" + ",".join(structural_tokens) + "]"
        )

        return {
            "compressed_form": compressed_form,
            "input_word_count": len(words),
            "structural_token_count": len(structural_tokens),
            "input_char_count": len(text),
            "compressed_char_count": len(compressed_form),
            "reduction_ratio": round(len(compressed_form) / len(text), 6),
            "claim_fingerprint": fingerprint,
            "structural_tokens": structural_tokens,
        }