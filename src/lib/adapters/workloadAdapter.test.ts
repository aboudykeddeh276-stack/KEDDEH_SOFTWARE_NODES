import { describe, expect, it } from 'vitest';
import { nextActionableWorkloads, queryWorkloads, summarizeWorkloads } from './workloadAdapter';

describe('workloadAdapter', () => {
  it('summarizes workload status counts', () => {
    const summary = summarizeWorkloads();

    expect(summary.completed).toBeGreaterThanOrEqual(13);
    expect(summary.queued).toBe(0);
    expect(summary.in_progress).toBe(0);
  });

  it('filters workloads by text and path', () => {
    const byText = queryWorkloads({ text: 'affect ethics' });
    const byPath = queryWorkloads({ path: 'src/components/WorkloadPanel.tsx' });

    expect(byText.some((workload) => workload.workloadId === 'WL-0009')).toBe(true);
    expect(byPath.some((workload) => workload.workloadId === 'WL-0013')).toBe(true);
  });

  it('returns no actionable workloads when registered work is complete', () => {
    expect(nextActionableWorkloads()).toEqual([]);
  });
});
