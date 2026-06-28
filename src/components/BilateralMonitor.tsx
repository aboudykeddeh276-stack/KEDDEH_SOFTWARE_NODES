import React from 'react';
import { useBilateralRuntime } from '../hooks/useBilateralRuntime';

export const BilateralMonitor: React.FC = () => {
  const { primaryState, mirrorState, metrics, error } = useBilateralRuntime();

  return (
    <div className="bilateral-monitor">
      <div className="bilateral-header">
        <div>
          <h3>Bilateral Loop Telemetry</h3>
          <p>Continuous State Reconciliation Matrix</p>
        </div>
        <span className={`status-badge ${metrics.laneStatus === 'HEALTHY' ? 'healthy' : 'degraded'}`}>
          {metrics.laneStatus}
        </span>
      </div>

      <div className="bilateral-lanes">
        <div className="bilateral-lane primary-lane">
          <span className="lane-title">▼ Primary Execution Lane</span>
          <div className="lane-details">
            <p>Seed: <span>{primaryState?.seedHash?.substring(0, 8) || '0x0000'}...</span></p>
            <p className="lane-metric">Cycles Verified: {metrics.loopCount}</p>
          </div>
        </div>

        <div className="bilateral-lane mirror-lane">
          <span className="lane-title">▲ Mirror Update Lane</span>
          <div className="lane-details">
            <p>Seed: <span>{mirrorState?.seedHash?.substring(0, 8) || '0x0000'}...</span></p>
            <p className="lane-metric">State Drift: {metrics.driftMs}ms</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bilateral-alert">
          CRITICAL SYSTEM NOTICE: {error}
        </div>
      )}
    </div>
  );
};
