export type AssistantConnectorStatus = "draft" | "ready" | "applied" | "rejected";
export type AssistantValidationState = "pending" | "passed" | "failed";

export type AssistantConnectorRequest = {
  id: string;
  repo: string;
  targetFiles: string[];
  intent: string;
  constraints: string[];
  status: AssistantConnectorStatus;
  createdAt: string;
};

export type AssistantPatchProposal = {
  id: string;
  requestId: string;
  filePath: string;
  beforeHash?: string;
  afterHash?: string;
  summary: string;
  content: string;
};

export type AssistantProofPacket = {
  id: string;
  requestId: string;
  beforeState: string;
  afterState: string;
  ruleApplied: string;
  validation: AssistantValidationState;
  createdAt: string;
};

export type AssistantConnectorState = {
  request: AssistantConnectorRequest;
  patches: AssistantPatchProposal[];
  proofPackets: AssistantProofPacket[];
};

export function createAssistantConnectorRequest(input: {
  repo: string;
  targetFiles: string[];
  intent: string;
  constraints?: string[];
}): AssistantConnectorRequest {
  return {
    id: `acr-${Date.now()}`,
    repo: input.repo,
    targetFiles: input.targetFiles,
    intent: input.intent,
    constraints: input.constraints ?? [],
    status: "draft",
    createdAt: new Date().toISOString()
  };
}

export function createAssistantProofPacket(input: {
  requestId: string;
  beforeState: string;
  afterState: string;
  ruleApplied: string;
  validation?: AssistantValidationState;
}): AssistantProofPacket {
  return {
    id: `app-${Date.now()}`,
    requestId: input.requestId,
    beforeState: input.beforeState,
    afterState: input.afterState,
    ruleApplied: input.ruleApplied,
    validation: input.validation ?? "pending",
    createdAt: new Date().toISOString()
  };
}

export const ASSISTANT_CONNECTOR_BOUNDARY = {
  canReadRepoContext: true,
  canProposePatches: true,
  canCreateReviewableUpdates: true,
  canBypassReview: false,
  canRunUnboundedHostActions: false
} as const;
