import { describe, expect, it } from 'vitest';
import { buildScenarioRecord, listScenarioSummaries } from '../server/scenarios.js';
import { SessionStore } from '../server/sessionStore.js';
import { WorkflowError, WorkflowService } from '../server/workflowService.js';

const startedAt = new Date('2026-11-18T00:00:00.000Z');

function setup(scenarioId: Parameters<SessionStore['create']>[0] = 'current_estimate', staffAvailable = true) {
  const store = new SessionStore();
  const session = store.create(scenarioId, staffAvailable, startedAt);
  return { store, session, workflow: new WorkflowService(store) };
}

describe('synthetic scheduling source', () => {
  it('offers four scenarios without leaking scheduling facts into the selection data', () => {
    const summaries = listScenarioSummaries();
    expect(summaries.map((scenario) => scenario.id)).toEqual([
      'current_estimate', 'unscheduled', 'stale_information', 'scan_complete_report_pending',
    ]);
    expect(JSON.stringify(summaries)).not.toContain('estimatedWindow');
    expect(summaries.every((scenario) => scenario.exampleQuestions.length > 0)).toBe(true);
  });

  it('generates a relative window without changing the supplied start time', () => {
    const record = buildScenarioRecord('current_estimate', startedAt);
    expect(record.estimatedWindow).toEqual({
      start: '2026-11-18T02:00:00.000Z', end: '2026-11-18T02:30:00.000Z',
    });
    expect(record.source.updatedAt).toBe('2026-11-17T23:55:00.000Z');
    expect(startedAt.toISOString()).toBe('2026-11-18T00:00:00.000Z');
  });
});

describe('scheduling answers', () => {
  it('returns the recorded current estimate with a required uncertainty instruction', () => {
    const { session, workflow } = setup();
    const result = workflow.getScanStatus(session.id);
    expect(result.kind).toBe('current_estimate');
    if (result.kind !== 'current_estimate') throw new Error('Expected a current estimate.');
    expect(result.estimatedWindow.start).toBe('2026-11-18T02:00:00.000Z');
    expect(result.responseInstruction).toContain('may change');
    expect(result.source.name).toBe('Demo scheduling source');
  });

  it.each(['unscheduled', 'stale_information'] as const)('%s supplies no estimate and offers help without escalating', (scenarioId) => {
    const { session, workflow } = setup(scenarioId);
    const result = workflow.getScanStatus(session.id);
    expect(result.kind).toBe('no_reliable_estimate');
    expect(result).not.toHaveProperty('estimatedWindow');
    expect(result.offerHumanHelp).toBe(true);
    expect(session.state).toBe('active');
    expect(session.escalation).toBeUndefined();
  });

  it('does not expose the stale fixture time anywhere in the returned result', () => {
    const { session, workflow } = setup('stale_information');
    expect(session.record.estimatedWindow).toBeDefined();
    const result = JSON.stringify(workflow.getScanStatus(session.id));
    expect(result).not.toContain(session.record.estimatedWindow!.start);
    expect(result).not.toContain('estimatedWindow');
  });

  it('keeps completed scanning separate from a pending report', () => {
    const { session, workflow } = setup('scan_complete_report_pending');
    expect(workflow.getScanStatus(session.id)).toMatchObject({
      kind: 'scan_complete_report_pending', scanStatus: 'complete', reportStatus: 'pending',
      offerHumanHelp: false,
    });
  });
});

describe('human assistance', () => {
  it.each(['person_requested', 'out_of_scope', 'unreliable_estimate'] as const)('routes %s to the coordinator when unavailable', (reason) => {
    const { session, workflow } = setup('current_estimate', false);
    const result = workflow.requestHumanHelp(session.id, reason);
    expect(result).toMatchObject({
      outcome: 'fallback', category: 'routine', destination: 'Demo imaging coordinator',
      message: 'The requested staff member is unavailable. The alternative contact for this enquiry is the imaging coordinator.',
      simulationLabel: 'Simulation only — no staff notified.',
    });
  });

  it.each([true, false])('keeps urgent assistance separate when availability is %s', (staffAvailable) => {
    const { session, workflow } = setup('current_estimate', staffAvailable);
    const result = workflow.requestHumanHelp(session.id, 'urgent_concern');
    expect(result.category).toBe('urgent');
    expect(result.outcome).toBe(staffAvailable ? 'transfer' : 'fallback');
    expect(result.destination).toBe(staffAvailable ? 'Demo urgent assistance staff' : 'Demo urgent escalation contact');
  });

  it('transfers to scheduling staff when available even before a lookup', () => {
    const { session, workflow } = setup();
    const result = workflow.requestHumanHelp(session.id, 'person_requested');
    expect(result).toMatchObject({ outcome: 'transfer', destination: 'Demo imaging scheduling staff' });
    expect(result.handoff.lastSchedulingResult).toBeUndefined();
  });

  it('includes only previously returned scheduling facts in the handoff', () => {
    const { session, workflow } = setup('stale_information');
    const answer = workflow.getScanStatus(session.id);
    const result = workflow.requestHumanHelp(session.id, 'unreliable_estimate');
    expect(result.handoff.lastSchedulingResult).toEqual(answer);
    expect(result.handoff.examination.id).toBe(session.record.examination.id);
    expect(JSON.stringify(result.handoff)).not.toContain('estimatedWindow');
  });

  it('blocks lookups after escalation and preserves the first handoff on repeated requests', () => {
    const { session, workflow } = setup();
    const first = workflow.requestHumanHelp(session.id, 'person_requested');
    expect(session.state).toBe('escalated');
    expect(() => workflow.getScanStatus(session.id)).toThrowError('Session has already escalated.');
    expect(workflow.requestHumanHelp(session.id, 'out_of_scope')).toEqual(first);
  });
});

describe('session lifecycle', () => {
  it('isolates concurrent sessions and clears state when a new call starts', () => {
    const { store, session, workflow } = setup();
    workflow.getScanStatus(session.id);
    workflow.requestHumanHelp(session.id, 'person_requested');
    const next = store.create('unscheduled', false, startedAt);
    expect(next.id).not.toBe(session.id);
    expect(next.state).toBe('active');
    expect(next.lastSchedulingResult).toBeUndefined();
    expect(next.escalation).toBeUndefined();
    expect(workflow.getScanStatus(next.id).kind).toBe('no_reliable_estimate');
  });

  it('makes repeated termination safe and rejects work on deleted or unknown sessions', () => {
    const { session, workflow } = setup();
    workflow.endDemoSession(session.id);
    workflow.endDemoSession(session.id);
    for (const id of [session.id, 'unknown']) {
      expect(() => workflow.getScanStatus(id)).toThrowError(WorkflowError);
      expect(() => workflow.requestHumanHelp(id, 'person_requested')).toThrowError('Session not found.');
    }
  });
});
