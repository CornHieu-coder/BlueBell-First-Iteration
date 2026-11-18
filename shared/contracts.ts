export type ScenarioId =
  | 'current_estimate'
  | 'unscheduled'
  | 'stale_information'
  | 'scan_complete_report_pending';

export interface Examination {
  id: string;
  patientId: string;
  patientName: string;
  description: string;
}

export interface ScenarioSummary {
  id: ScenarioId;
  title: string;
  examination: Examination;
  exampleQuestions: string[];
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface SchedulingSource {
  name: string;
  updatedAt: string;
}

export type ScanStatus = 'scheduled' | 'unscheduled' | 'complete';
export type ReportStatus = 'not_available' | 'pending' | 'available';

export interface SchedulingRecord {
  examination: Examination;
  scanStatus: ScanStatus;
  reportStatus: ReportStatus;
  freshness: 'current' | 'stale';
  estimatedWindow?: TimeWindow;
  source: SchedulingSource;
}

interface ScanStatusBase {
  examination: Examination;
  scanStatus: ScanStatus;
  reportStatus: ReportStatus;
  freshness: SchedulingRecord['freshness'];
  source: SchedulingSource;
  responseInstruction: string;
}

export type ScanStatusResult = ScanStatusBase & (
  | { kind: 'current_estimate'; estimatedWindow: TimeWindow; offerHumanHelp: false }
  | { kind: 'no_reliable_estimate'; reason: 'unscheduled' | 'stale_information'; offerHumanHelp: true }
  | { kind: 'scan_complete_report_pending'; offerHumanHelp: false }
);

export const escalationReasons = [
  'person_requested', 'urgent_concern', 'out_of_scope', 'unreliable_estimate',
] as const;

export type EscalationReason = typeof escalationReasons[number];

export interface HandoffCard {
  examination: Examination;
  reason: EscalationReason;
  lastSchedulingResult?: ScanStatusResult;
}

export interface EscalationResult {
  outcome: 'transfer' | 'fallback';
  category: 'routine' | 'urgent';
  destination: string;
  message: string;
  simulationLabel: string;
  handoff: HandoffCard;
}

export interface DemoSession {
  id: string;
  scenarioId: ScenarioId;
  staffAvailable: boolean;
  startedAt: string;
  state: 'active' | 'escalated';
  record: SchedulingRecord;
  lastSchedulingResult?: ScanStatusResult;
  escalation?: EscalationResult;
}

export interface CreateSessionInput {
  scenarioId: ScenarioId;
  staffAvailable: boolean;
}

export interface CreateSessionResponse {
  sessionId: string;
  connectionCredential: string;
  expiresAt: number;
  model: string;
}

export interface EscalationInput {
  reason: EscalationReason;
}

export interface ApiError {
  code: string;
  message: string;
}
