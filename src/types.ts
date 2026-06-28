export type Metric = { label: string; value: string; foot: string };
export type HyperNode = { title: string; role: string; status: "ready" | "watch" | "locked" };
export type RouteNode = { index: number; name: string; className: string; description: string };
export type Sector = { id: string; address: string; role: string; state: string };
export type ChatMessage = { actor: "host" | "system"; text: string; time: string };
export type LedgerPacket = { id: string; action: string; hash: string };
export type ControlRow = { address: string; target: string; entryPoint: string; action: string; field: string; value: string; status: string; };
export type WorkloadObject = { id: string; status: string; title: string; event: string; completion: string; notes: string };

export type KexRuntimePayload = {
  seedPayload: { timestamp: number };
  seedHash: string;
};

export type KexRuntimeState = "HEALTHY" | "DEGRADED_RECONCILING" | "OFFLINE";
