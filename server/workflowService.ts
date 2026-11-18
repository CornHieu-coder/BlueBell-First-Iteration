import type { DemoSession, EscalationReason, EscalationResult, HandoffCard, ScanStatusResult } from '../shared/contracts.js';
import type { SessionStore } from './sessionStore.js';

export class WorkflowError extends Error {
  constructor(public readonly code: 'SESSION_NOT_FOUND' | 'SESSION_ESCALATED', message: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

const simulationLabel = 'Simulation only — no staff notified.';

const escalationRoutes = {
  routine: {
    transfer: {
      destination: 'Demo imaging scheduling staff',
      message: 'Showing a simulated transfer to the imaging scheduling team.',
    },
    fallback: {
      destination: 'Demo imaging coordinator',
      message: 'The requested staff member is unavailable. The alternative contact for this enquiry is the imaging coordinator.',
    },
  },
  urgent: {
    transfer: {
      destination: 'Demo urgent assistance staff',
      message: 'This concern needs urgent human assistance. Showing a simulated transfer to urgent assistance staff.',
    },
    fallback: {
      destination: 'Demo urgent escalation contact',
      message: 'The requested staff member is unavailable. This concern needs urgent human assistance. Showing the demo urgent escalation contact.',
    },
  },
};

export function buildHandoffCard(session: DemoSession, reason: EscalationReason): HandoffCard {
  const handoff: HandoffCard = { examination: structuredClone(session.record.examination), reason };
  if (session.lastSchedulingResult) {
    handoff.lastSchedulingResult = structuredClone(session.lastSchedulingResult);
  }
  return handoff;
}

export class WorkflowService {
  constructor(private readonly store: SessionStore) {}

  private getSession(sessionId: string): DemoSession {
    const session = this.store.get(sessionId);
    if (!session) throw new WorkflowError('SESSION_NOT_FOUND', 'Session not found.');
    return session;
  }

  getActiveSession(sessionId: string): DemoSession {
    const session = this.getSession(sessionId);
    if (session.state !== 'active') {
      throw new WorkflowError('SESSION_ESCALATED', 'Session has already escalated.');
    }
    return session;
  }

  getScanStatus(sessionId: string): ScanStatusResult {
    const session = this.getActiveSession(sessionId);
    const record = session.record;
    // Deliberately whitelist fields: never spread a record containing a stale estimate.
    const base = {
      examination: record.examination, scanStatus: record.scanStatus,
      reportStatus: record.reportStatus, freshness: record.freshness, source: record.source,
    };
    let result: ScanStatusResult;
    if (record.freshness === 'stale' || record.scanStatus === 'unscheduled') {
      const stale = record.freshness === 'stale';
      result = {
        ...base, kind: 'no_reliable_estimate',
        reason: stale ? 'stale_information' : 'unscheduled', offerHumanHelp: true,
        responseInstruction: stale
          ? 'The scheduling information is out of date; no reliable current estimate is available. Offer human assistance without automatically escalating.'
          : 'The patient is not yet scheduled; no reliable current estimate is available. Offer human assistance without automatically escalating.',
      };
    } else if (record.scanStatus === 'complete') {
      result = {
        ...base, kind: 'scan_complete_report_pending', offerHumanHelp: false,
        responseInstruction: 'The scan is complete. The radiology report is not yet available. Do not imply clinical interpretation is complete.',
      };
    } else if (record.estimatedWindow) {
      result = {
        ...base, kind: 'current_estimate', estimatedWindow: record.estimatedWindow, offerHumanHelp: false,
        responseInstruction: 'Use the recorded time window and source. State that this is an estimate and may change.',
      };
    } else {
      throw new Error('Scheduled fixture is missing its estimate.');
    }
    // Callers cannot mutate the saved handoff facts by editing their returned object.
    session.lastSchedulingResult = structuredClone(result);
    return structuredClone(result);
  }

  requestHumanHelp(sessionId: string, reason: EscalationReason): EscalationResult {
    const session = this.getSession(sessionId);
    if (session.escalation) return structuredClone(session.escalation);

    const category = reason === 'urgent_concern' ? 'urgent' : 'routine';
    const outcome = session.staffAvailable ? 'transfer' : 'fallback';
    session.state = 'escalated';
    const result: EscalationResult = {
      outcome, category, ...escalationRoutes[category][outcome],
      simulationLabel,
      handoff: buildHandoffCard(session, reason),
    };
    session.escalation = structuredClone(result);
    return result;
  }

  endDemoSession(sessionId: string): void {
    this.store.delete(sessionId);
  }
}
