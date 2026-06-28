import { nextActionableWorkloads, summarizeWorkloads } from '../lib/adapters/workloadAdapter';
import { workloadSeed } from '../data/workloadSeed';

const summary = summarizeWorkloads();
const actionable = nextActionableWorkloads();

export function WorkloadPanel() {
  return (
    <div className="workloadSurface">
      <div className="workloadSummary">
        {Object.entries(summary).map(([status, count]) => (
          <div className="workloadPill" key={status}>
            <span>{status}</span>
            <b>{count}</b>
          </div>
        ))}
      </div>
      <div className="stateList compact">
        {workloadSeed.map((workload) => (
          <article className="stateCard" key={workload.workloadId}>
            <div>
              <code>{workload.workloadId}</code>
              <h3>{workload.name}</h3>
              <p>{workload.completionCondition}</p>
            </div>
            <dl>
              <div><dt>Status</dt><dd>{workload.status}</dd></div>
              <div><dt>Parent</dt><dd>{workload.parentInventoryObject}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      {actionable.length === 0 ? (
        <p className="boundaryNote">All registered actionable workloads are completed. New discoveries must be registered before execution.</p>
      ) : (
        <p className="boundaryNote">Actionable workload objects remain: {actionable.map((workload) => workload.workloadId).join(', ')}.</p>
      )}
    </div>
  );
}
