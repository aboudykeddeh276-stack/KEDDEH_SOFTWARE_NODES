import { Activity, Binary, ShieldCheck } from "lucide-react";
import { header, metrics, hyperNodes, kexRoute, sectors, muxLines, hostMessages, ledgerPackets, controlRows } from "./data/placeholders";
import { BilateralMonitor } from "./components/BilateralMonitor";
import { InventoryPanel } from "./components/InventoryPanel";
import { WorkloadPanel } from "./components/WorkloadPanel";
import { AssistantCodingConnector } from "./components/AssistantCodingConnector";

export default function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>{header.title}</h1>
          <p>{header.subtitle}</p>
        </div>
        <div className="badges">
          <span><Activity size={16}/><b>{header.status}</b></span>
          <span><Binary size={16}/>{header.kexCode}</span>
          <span><ShieldCheck size={16}/>{header.proofHash.slice(0, 18)}…</span>
        </div>
      </header>

      <section className="metrics">
        {metrics.map((m) => (
          <article className="metric" key={m.label}>
            <small>{m.label}</small><strong>{m.value}</strong><em>{m.foot}</em>
          </article>
        ))}
      </section>

      <section className="grid">
        <div className="span12">
          <BilateralMonitor />
        </div>

        <AssistantCodingConnector />

        <Panel title="HyperDrive Topology" note="recursive substrate view" span="span8">
          <div className="nodeCloud">
            {hyperNodes.map((n) => (
              <div className="node" key={n.title}>
                <b>{n.title}</b><small>{n.role}</small><i>{n.status.toUpperCase()}</i>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="KEX Route" note="query engine path" span="span4">
          <div className="route">
            {kexRoute.map((n) => (
              <div className="routeItem" key={n.index}>
                <span>{n.index}</span><div><b>{n.name}</b><small>{n.className}<br />{n.description}</small></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Inventory Memory" note="registered KEX/BRAINK objects" span="span7">
          <InventoryPanel />
        </Panel>

        <Panel title="Workload Register" note="workload rule projection" span="span5">
          <WorkloadPanel />
        </Panel>

        <Panel title="Front-Facing Control Plane" note="substrate address routing" span="span7">
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Address</th><th>Target</th><th>Entry Point</th><th>Action</th><th>State</th></tr></thead>
              <tbody>{controlRows.map((r, i) => <tr key={i}><td>{r.address}</td><td>{r.target}</td><td>{r.entryPoint}</td><td>{r.action}</td><td><b className={r.status.toLowerCase()}>{r.status}</b></td></tr>)}</tbody>
            </table>
          </div>
        </Panel>

        <Panel title="MUX Screen Display" note="translated runtime display" span="span5">
          <pre className="screen">{muxLines.join("\n")}</pre>
        </Panel>

        <Panel title="Host Chat Bridge" note="bottom channel to system host" span="span6">
          <div className="chat">
            {hostMessages.map((m, i) => <div className={`msg ${m.actor}`} key={i}><small>{m.actor.toUpperCase()} · {m.time}</small>{m.text}</div>)}
            <div className="input"><input placeholder="Placeholder: wire to KEX action queue..." /><button>Queue</button></div>
          </div>
        </Panel>

        <Panel title="Proof Ledger" note="all transitions should write here" span="span6">
          <div className="ledger">
            {ledgerPackets.map((p) => <div className="packet" key={p.id}><code>{p.id}</code><b>{p.action}</b><small>{p.hash}</small></div>)}
          </div>
        </Panel>

        <Panel title="Self-Critique / Hardening" note="final delivery audit" span="span12">
          <div className="audit">
            <Audit title="Execution boundary" text="This dashboard is not the runtime. It needs adapters connected to sheets, folders, ledgers, and device simulators." />
            <Audit title="Security boundary" text="Never let sheet rows execute arbitrary commands. Use allowlists, schema validation, and ledger preflight." />
            <Audit title="Proof boundary" text="A beautiful UI can hide weak invariants. Keep hashes, claim boundaries, tests, and rollback visible." />
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, note, span, children }: { title: string; note: string; span: string; children: React.ReactNode }) {
  return <article className={`panel ${span}`}><div className="panelTitle"><h2>{title}</h2><small>{note}</small></div>{children}</article>;
}

function Audit({ title, text }: { title: string; text: string }) {
  return <div className="auditCard"><h3>{title}</h3><p>{text}</p></div>;
}
