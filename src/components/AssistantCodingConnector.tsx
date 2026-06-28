import React, { useMemo, useState } from "react";
import {
  ASSISTANT_CONNECTOR_BOUNDARY,
  createAssistantConnectorRequest,
  createAssistantProofPacket,
  type AssistantConnectorState
} from "../lib/kex/assistantConnector";

export const AssistantCodingConnector: React.FC = () => {
  const [intent, setIntent] = useState("Build the next KEX runtime lane");
  const [targetFiles, setTargetFiles] = useState("src/App.tsx, src/data/placeholders.ts");

  const state: AssistantConnectorState = useMemo(() => {
    const request = createAssistantConnectorRequest({
      repo: "aboudykeddeh276-stack/KEX_HYPERDRIVE_DASHBOARD_UI",
      targetFiles: targetFiles.split(",").map((file) => file.trim()).filter(Boolean),
      intent,
      constraints: [
        "Preserve claim boundary",
        "Use reviewable file patches",
        "Record proof packet for every state change",
        "No unbounded host actions"
      ]
    });

    return {
      request,
      patches: [],
      proofPackets: [
        createAssistantProofPacket({
          requestId: request.id,
          beforeState: "connector_absent",
          afterState: "connector_request_defined",
          ruleApplied: "Definition -> Request -> ProofPacket",
          validation: "pending"
        })
      ]
    };
  }, [intent, targetFiles]);

  return (
    <section className="assistant-connector panel span12">
      <div className="panelTitle">
        <h2>Assistant Coding Connector</h2>
        <small>reviewable repo-context coding lane</small>
      </div>

      <div className="audit">
        <div className="auditCard">
          <h3>Intent</h3>
          <textarea
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            rows={3}
            style={{ width: "100%" }}
          />
        </div>

        <div className="auditCard">
          <h3>Target files</h3>
          <input
            value={targetFiles}
            onChange={(event) => setTargetFiles(event.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div className="auditCard">
          <h3>Connector boundary</h3>
          <pre>{JSON.stringify(ASSISTANT_CONNECTOR_BOUNDARY, null, 2)}</pre>
        </div>
      </div>

      <div className="ledger">
        <div className="packet">
          <code>{state.request.id}</code>
          <b>{state.request.status.toUpperCase()}</b>
          <small>{state.request.intent}</small>
        </div>
        {state.proofPackets.map((packet) => (
          <div className="packet" key={packet.id}>
            <code>{packet.id}</code>
            <b>{packet.validation.toUpperCase()}</b>
            <small>{packet.beforeState} → {packet.afterState}</small>
          </div>
        ))}
      </div>
    </section>
  );
};
