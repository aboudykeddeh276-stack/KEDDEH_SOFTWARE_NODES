const ALLOWED_ENTRY_POINTS = new Set([
  "path",
  "metadata",
  "hidden_file",
  "event",
  "link_mount",
  "permission",
  "timestamp"
]);

const ALLOWED_ACTIONS = new Set([
  "set_metadata",
  "write_hidden_file",
  "touch_event",
  "create_link",
  "mount",
  "rename",
  "set_permission"
]);

export function validateControlRow(row: Record<string, string>) {
  const errors: string[] = [];

  if (!row.ADDRESS?.startsWith("kex://")) errors.push("ADDRESS must start with kex://");
  if (!row.TARGET) errors.push("TARGET is required");
  if (!ALLOWED_ENTRY_POINTS.has(row.ENTRY_POINT)) errors.push(`Invalid ENTRY_POINT: ${row.ENTRY_POINT}`);
  if (!ALLOWED_ACTIONS.has(row.ACTION)) errors.push(`Invalid ACTION: ${row.ACTION}`);

  return {
    valid: errors.length === 0,
    errors
  };
}


export type AffectEthicsGateInput = {
  humanBioBoundaryPreserved: boolean;
  codexNonBiologicalBoundaryPreserved: boolean;
  brainkAnchorPreserved: boolean;
  noManipulation: boolean;
  noUnsupportedMedicalClaim: boolean;
  repairRouteAvailable: boolean;
  blockersPreserved: boolean;
};

const AFFECT_ETHICS_REQUIREMENTS: Array<keyof AffectEthicsGateInput> = [
  "humanBioBoundaryPreserved",
  "codexNonBiologicalBoundaryPreserved",
  "brainkAnchorPreserved",
  "noManipulation",
  "noUnsupportedMedicalClaim",
  "repairRouteAvailable",
  "blockersPreserved"
];

const AFFECT_ETHICS_ERROR_MESSAGES: Record<keyof AffectEthicsGateInput, string> = {
  humanBioBoundaryPreserved: "Human bio-organic boundary must be preserved",
  codexNonBiologicalBoundaryPreserved: "Codex non-biological boundary must be preserved",
  brainkAnchorPreserved: "BRAINK/KEX anchor must be preserved",
  noManipulation: "KEX/BRAINK language must not manipulate, shame, or override agency",
  noUnsupportedMedicalClaim: "Unsupported medical, hormone, diagnosis, or body-state claims are not allowed",
  repairRouteAvailable: "Repair route must be available",
  blockersPreserved: "Blockers and pending gates must be preserved"
};

export function validateAffectEthicsGate(input: AffectEthicsGateInput) {
  const errors = AFFECT_ETHICS_REQUIREMENTS
    .filter((requirement) => input[requirement] !== true)
    .map((requirement) => AFFECT_ETHICS_ERROR_MESSAGES[requirement]);

  return {
    valid: errors.length === 0,
    status: errors.length === 0 ? "MODEL-LOCAL" : "BLOCK_OR_REPAIR",
    errors
  };
}
