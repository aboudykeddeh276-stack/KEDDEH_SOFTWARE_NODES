#!/usr/bin/env python3
"""
KEX Cell Network Engine - software-record skeleton.

Originating research authority: A. Keddeh
Support-tool note: generated as an assisted repository artefact under direction.

Boundary:
- Models servers, drives, coordinates, cells, routes, mirrors, parity, and restore plans as software records.
- Does not claim physical disk control, hardware control, autonomous execution, or external certification.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from hashlib import sha256
from json import dumps
from typing import Dict, List, Literal, Optional

RecordStatus = Literal["declared", "mounted", "mirrored", "verified", "restore_ready", "blocked"]


@dataclass(frozen=True)
class Coordinate:
    server_id: str
    drive_id: str
    lane_id: str
    cell_id: str

    def key(self) -> str:
        return f"{self.server_id}/{self.drive_id}/{self.lane_id}/{self.cell_id}"


@dataclass
class CellRecord:
    coordinate: Coordinate
    payload_ref: str
    status: RecordStatus = "declared"
    proof_hash: Optional[str] = None

    def compute_hash(self) -> str:
        canonical = dumps(
            {
                "coordinate": asdict(self.coordinate),
                "payload_ref": self.payload_ref,
                "status": self.status,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        self.proof_hash = sha256(canonical.encode("utf-8")).hexdigest()
        return self.proof_hash


@dataclass
class RouteRecord:
    route_id: str
    source: Coordinate
    target: Coordinate
    relation: str
    status: RecordStatus = "declared"


@dataclass
class MirrorRecord:
    mirror_id: str
    primary: Coordinate
    replicas: List[Coordinate]
    parity_hash: Optional[str] = None
    status: RecordStatus = "declared"

    def compute_parity(self) -> str:
        canonical = dumps(
            {
                "mirror_id": self.mirror_id,
                "primary": asdict(self.primary),
                "replicas": [asdict(replica) for replica in self.replicas],
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        self.parity_hash = sha256(canonical.encode("utf-8")).hexdigest()
        self.status = "mirrored"
        return self.parity_hash


@dataclass
class RestorePlan:
    restore_id: str
    failed_coordinate: Coordinate
    candidate_mirrors: List[Coordinate]
    required_evidence: List[str] = field(default_factory=list)
    status: RecordStatus = "declared"

    def mark_ready(self) -> None:
        if not self.candidate_mirrors:
            self.status = "blocked"
            self.required_evidence.append("At least one candidate mirror is required.")
            return
        self.status = "restore_ready"


@dataclass
class KexCellNetworkEngine:
    engine_id: str
    cells: Dict[str, CellRecord] = field(default_factory=dict)
    routes: Dict[str, RouteRecord] = field(default_factory=dict)
    mirrors: Dict[str, MirrorRecord] = field(default_factory=dict)
    restore_plans: Dict[str, RestorePlan] = field(default_factory=dict)

    def add_cell(self, cell: CellRecord) -> str:
        proof = cell.compute_hash()
        self.cells[cell.coordinate.key()] = cell
        return proof

    def add_route(self, route: RouteRecord) -> None:
        self.routes[route.route_id] = route

    def add_mirror(self, mirror: MirrorRecord) -> str:
        parity = mirror.compute_parity()
        self.mirrors[mirror.mirror_id] = mirror
        return parity

    def create_restore_plan(self, plan: RestorePlan) -> None:
        plan.mark_ready()
        self.restore_plans[plan.restore_id] = plan

    def manifest(self) -> dict:
        return {
            "engine_id": self.engine_id,
            "boundary": "software_records_only_not_physical_disk_control",
            "cell_count": len(self.cells),
            "route_count": len(self.routes),
            "mirror_count": len(self.mirrors),
            "restore_plan_count": len(self.restore_plans),
        }


def demo() -> dict:
    engine = KexCellNetworkEngine(engine_id="KEX_CELL_NETWORK_ENGINE_V1")
    primary = Coordinate("server-001", "drive-001", "lane-alpha", "cell-001")
    replica = Coordinate("server-001", "drive-001", "lane-beta", "cell-001r")

    engine.add_cell(CellRecord(primary, payload_ref="payload://declared/source-cell"))
    engine.add_cell(CellRecord(replica, payload_ref="payload://declared/replica-cell"))
    engine.add_mirror(MirrorRecord("mirror-001", primary=primary, replicas=[replica]))
    engine.create_restore_plan(
        RestorePlan(
            "restore-001",
            failed_coordinate=primary,
            candidate_mirrors=[replica],
            required_evidence=["matching parity hash", "file-backed proof record"],
        )
    )
    return engine.manifest()


if __name__ == "__main__":
    print(dumps(demo(), indent=2, sort_keys=True))
