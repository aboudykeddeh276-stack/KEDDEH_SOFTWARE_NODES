import unittest

from theorem_graph import (
    ACTIVE,
    REVIEW_REQUIRED,
    FALSIFIED,
    GraphEventLedger,
    GraphIntegrityError,
    MasterTheoremGraphRegistry,
    ReviewBlocked,
    StrictBranchRouter,
    TheoremNotActive,
)


class TestClaimInvalidationRuntime(unittest.TestCase):
    def make_chain(self):
        ledger = GraphEventLedger()
        registry = MasterTheoremGraphRegistry(ledger=ledger)
        registry.register("ROOT", {"tensor_min": 7.0}, parent_operators=["OP_ROOT"])
        registry.register("CHILD", {"tensor_min": 8.0}, parent_ids=["ROOT"])
        registry.register("GRANDCHILD", {"tensor_min": 9.0}, parent_ids=["CHILD"])
        registry.register("UNRELATED", {"tensor_min": 7.0}, parent_operators=["OP_OTHER"])
        return ledger, registry

    def test_deep_invalidation_cascades_bfs_and_preserves_unrelated_branch(self):
        ledger, registry = self.make_chain()
        receipt = registry.invalidate("ROOT", evidence="counterexample:root-001")

        self.assertEqual(registry.status("ROOT"), FALSIFIED)
        self.assertEqual(registry.status("CHILD"), REVIEW_REQUIRED)
        self.assertEqual(registry.status("GRANDCHILD"), REVIEW_REQUIRED)
        self.assertEqual(registry.status("UNRELATED"), ACTIVE)
        self.assertEqual(receipt["affected"], ["CHILD", "GRANDCHILD"])
        self.assertIn("upstream:ROOT", registry.causes("CHILD"))
        self.assertIn("upstream:ROOT", registry.causes("GRANDCHILD"))

        types = [event["event_type"] for event in ledger.events]
        self.assertIn("THEOREM_INVALIDATED", types)
        self.assertEqual(types.count("DESCENDANT_REVIEW_REQUIRED"), 2)

    def test_missing_evidence_invalidation_rejected_without_side_effects(self):
        ledger, registry = self.make_chain()
        before_status = {tid: registry.status(tid) for tid in registry.theorem_ids()}
        before_events = list(ledger.events)

        for bad in (None, "", "   "):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    registry.invalidate("ROOT", evidence=bad)

        self.assertEqual(
            {tid: registry.status(tid) for tid in registry.theorem_ids()},
            before_status,
        )
        self.assertEqual(ledger.events, before_events)

    def test_already_falsified_descendant_is_not_weakened(self):
        _, registry = self.make_chain()
        registry.invalidate("CHILD", evidence="counterexample:child")
        registry.invalidate("ROOT", evidence="counterexample:root")
        self.assertEqual(registry.status("CHILD"), FALSIFIED)

    def test_child_registration_inherits_review_required_from_non_active_parent(self):
        ledger = GraphEventLedger()
        registry = MasterTheoremGraphRegistry(ledger=ledger)
        registry.register("ROOT", {"tensor_min": 7.0})
        registry.invalidate("ROOT", evidence="counterexample:root")
        registry.register("LATE_CHILD", {"tensor_min": 8.0}, parent_ids=["ROOT"])

        self.assertEqual(registry.status("LATE_CHILD"), REVIEW_REQUIRED)
        self.assertIn("parent:ROOT:FALSIFIED", registry.causes("LATE_CHILD"))
        self.assertEqual(ledger.events[-1]["event_type"], "THEOREM_REGISTERED_REVIEW_REQUIRED")

    def test_diamond_revalidation_requires_all_active_parents_and_is_explicit_per_node(self):
        ledger = GraphEventLedger()
        registry = MasterTheoremGraphRegistry(ledger=ledger)
        registry.register("BAD_PARENT", {"tensor_min": 7.0})
        registry.register("GOOD_PARENT", {"tensor_min": 7.0})
        registry.register(
            "DIAMOND_CHILD",
            {"tensor_min": 8.0},
            parent_ids=["BAD_PARENT", "GOOD_PARENT"],
        )
        registry.register("LEAF", {"tensor_min": 9.0}, parent_ids=["DIAMOND_CHILD"])

        registry.invalidate("BAD_PARENT", evidence="counterexample:bad-parent")
        self.assertEqual(registry.status("DIAMOND_CHILD"), REVIEW_REQUIRED)
        self.assertEqual(registry.status("LEAF"), REVIEW_REQUIRED)

        with self.assertRaises(ReviewBlocked) as cm:
            registry.revalidate("DIAMOND_CHILD", evidence="review:child-early")
        self.assertEqual(cm.exception.blockers, ("BAD_PARENT",))

        registry.revalidate("BAD_PARENT", evidence="repair:bad-parent")
        self.assertEqual(registry.status("BAD_PARENT"), ACTIVE)
        self.assertEqual(registry.status("DIAMOND_CHILD"), REVIEW_REQUIRED)
        self.assertEqual(registry.blockers("DIAMOND_CHILD"), ())

        registry.revalidate("DIAMOND_CHILD", evidence="review:child-ok")
        self.assertEqual(registry.status("DIAMOND_CHILD"), ACTIVE)
        self.assertEqual(registry.status("LEAF"), REVIEW_REQUIRED)

        registry.revalidate("LEAF", evidence="review:leaf-ok")
        self.assertEqual(registry.status("LEAF"), ACTIVE)
        self.assertIn("THEOREM_REVALIDATED", [e["event_type"] for e in ledger.events])

    def test_revalidate_requires_evidence_without_side_effects(self):
        ledger, registry = self.make_chain()
        registry.invalidate("ROOT", evidence="counterexample:root")
        before = registry.status("ROOT")
        before_events = len(ledger.events)

        with self.assertRaises(ValueError):
            registry.revalidate("ROOT", evidence="")

        self.assertEqual(registry.status("ROOT"), before)
        self.assertEqual(len(ledger.events), before_events)

    def test_router_refuses_non_active_theorem_without_advancing_route_sequence(self):
        ledger, registry = self.make_chain()
        router = StrictBranchRouter(registry)
        registry.invalidate("ROOT", evidence="counterexample:root")
        before_sequence = router.sequence

        with self.assertRaises(TheoremNotActive) as cm:
            router.route("ROOT", {"sector": "cosmology", "resonance": 0.297})

        self.assertEqual(router.sequence, before_sequence)
        self.assertEqual(cm.exception.status, FALSIFIED)
        self.assertTrue(cm.exception.causes)
        self.assertEqual(ledger.events[-1]["event_type"], "ROUTE_REJECTED")
        self.assertEqual(ledger.events[-1]["metadata"]["route_sequence"], before_sequence)

    def test_router_refuses_review_required_descendant_with_blockers_attached(self):
        _, registry = self.make_chain()
        router = StrictBranchRouter(registry)
        registry.invalidate("ROOT", evidence="counterexample:root")

        with self.assertRaises(TheoremNotActive) as cm:
            router.route("GRANDCHILD", {"sector": "proof_systems", "resonance": 0.297})

        self.assertEqual(cm.exception.status, REVIEW_REQUIRED)
        self.assertIn("ROOT", cm.exception.blockers)

    def test_successful_route_advances_sequence_only_after_active_gate(self):
        _, registry = self.make_chain()
        router = StrictBranchRouter(registry)
        self.assertEqual(router.sequence, 0)
        result = router.route("UNRELATED", {"sector": "governance", "resonance": 0.297})
        self.assertEqual(result["route_sequence"], 1)
        self.assertEqual(router.sequence, 1)

    def test_validate_detects_active_node_with_non_active_ancestor_as_tamper(self):
        _, registry = self.make_chain()
        registry.invalidate("ROOT", evidence="counterexample:root")

        # Simulate storage/state tamper, bypassing the public transition API.
        registry._status["GRANDCHILD"] = ACTIVE
        registry._causes["GRANDCHILD"] = ()

        with self.assertRaises(GraphIntegrityError) as cm:
            registry.validate()
        self.assertEqual(cm.exception.theorem_id, "GRANDCHILD")
        self.assertIn("ROOT", cm.exception.ancestors)

    def test_ledger_append_signature_is_stable_and_append_only(self):
        ledger = GraphEventLedger()
        event = ledger.append(
            "TEST_EVENT",
            "THM_X",
            evidence="evidence:x",
            metadata={"k": "v"},
        )
        self.assertEqual(event["sequence"], 1)
        self.assertEqual(event["event_type"], "TEST_EVENT")
        self.assertEqual(event["theorem_id"], "THM_X")
        self.assertEqual(event["evidence"], "evidence:x")
        self.assertEqual(event["metadata"], {"k": "v"})
        self.assertEqual(len(ledger.events), 1)


if __name__ == "__main__":
    unittest.main()