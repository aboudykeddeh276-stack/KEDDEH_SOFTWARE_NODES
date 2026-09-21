#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
SOURCE = (ROOT / "theorem_graph.py").read_text(encoding="utf-8")
TEST = ROOT / "test_claim_invalidation.py"

MUTANTS = [
    {
        "id": "M01_DISABLE_EVIDENCE_GUARD",
        "old": 'if not isinstance(evidence, str) or not evidence.strip():\n            raise ValueError("evidence must be a non-empty string")',
        "new": 'if False:\n            raise ValueError("evidence must be a non-empty string")',
    },
    {
        "id": "M02_OVERWRITE_FALSIFIED_DESCENDANT",
        "old": 'if self._status[child_id] != FALSIFIED:\n                self._status[child_id] = REVIEW_REQUIRED',
        "new": 'if True:\n                self._status[child_id] = REVIEW_REQUIRED',
    },
    {
        "id": "M03_DISABLE_ROUTER_ACTIVE_GATE",
        "old": 'if theorem_status != ACTIVE:\n            blockers = self._registry.blockers(theorem_id)',
        "new": 'if False:\n            blockers = self._registry.blockers(theorem_id)',
    },
    {
        "id": "M04_DISABLE_INTEGRITY_ANCESTOR_GATE",
        "old": 'if state == ACTIVE:\n                blocked = self.blockers(theorem_id)\n                if blocked:',
        "new": 'if False:\n                blocked = self.blockers(theorem_id)\n                if blocked:',
    },
    {
        "id": "M05_DISABLE_REVALIDATION_PARENT_BLOCK",
        "old": 'if non_active_parents:\n            self.ledger.append(\n                "REVALIDATION_BLOCKED",',
        "new": 'if False:\n            self.ledger.append(\n                "REVALIDATION_BLOCKED",',
    },
    {
        "id": "M06_DISABLE_REGISTRATION_INHERITANCE",
        "old": 'if non_active_parents:\n            self._status[theorem_id] = REVIEW_REQUIRED',
        "new": 'if False:\n            self._status[theorem_id] = REVIEW_REQUIRED',
    },
    {
        "id": "M07_AUTO_CLEAR_CHILD_ON_REVALIDATE",
        "old": 'self._status[theorem_id] = ACTIVE\n        self._causes[theorem_id] = ()\n        event = self.ledger.append(',
        "new": 'self._status[theorem_id] = ACTIVE\n        self._causes[theorem_id] = ()\n        for child_id in self.children_of(theorem_id):\n            if self._status[child_id] == REVIEW_REQUIRED:\n                self._status[child_id] = ACTIVE\n                self._causes[child_id] = ()\n        event = self.ledger.append(',
    },
    {
        "id": "M08_ADVANCE_ROUTE_SEQUENCE_BEFORE_ACTIVE_GATE",
        "old": 'theorem_status = self._registry.status(theorem_id)\n        if theorem_status != ACTIVE:',
        "new": 'theorem_status = self._registry.status(theorem_id)\n        self._sequence += 1\n        if theorem_status != ACTIVE:',
    },
]


def run_pytest(work: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", "-m", "pytest", "-q", "test_claim_invalidation.py"],
        cwd=work,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=30,
    )


def main() -> int:
    results = []
    for mutant in MUTANTS:
        if mutant["old"] not in SOURCE:
            results.append({"id": mutant["id"], "status": "HARNESS_ERROR", "detail": "mutation target not found"})
            continue
        mutated = SOURCE.replace(mutant["old"], mutant["new"], 1)
        with tempfile.TemporaryDirectory(prefix="kex_mutant_") as td:
            work = Path(td)
            (work / "theorem_graph.py").write_text(mutated, encoding="utf-8")
            shutil.copy2(TEST, work / TEST.name)
            proc = run_pytest(work)
            killed = proc.returncode != 0
            results.append({
                "id": mutant["id"],
                "status": "KILLED" if killed else "SURVIVED",
                "returncode": proc.returncode,
                "output_tail": "\n".join(proc.stdout.strip().splitlines()[-12:]),
            })

    receipt = {
        "schema": "keddeh.local.theorem-graph.mutation-checks.v1",
        "mutants": results,
        "killed": sum(r.get("status") == "KILLED" for r in results),
        "survived": sum(r.get("status") == "SURVIVED" for r in results),
        "harness_errors": sum(r.get("status") == "HARNESS_ERROR" for r in results),
    }
    out = ROOT / "MUTATION_CHECK_RECEIPT.json"
    out.write_text(json.dumps(receipt, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return 0 if receipt["survived"] == 0 and receipt["harness_errors"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())