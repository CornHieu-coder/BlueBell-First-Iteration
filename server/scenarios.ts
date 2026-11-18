import type { ScenarioId, ScenarioSummary, SchedulingRecord } from '../shared/contracts.js';

const scenarios: ScenarioSummary[] = [
  {
    id: 'current_estimate', title: 'Current scan estimate',
    examination: { id: 'EXAM-001', patientId: 'PAT-001', patientName: 'Alex Taylor (fictional)', description: 'MRI brain' },
    exampleQuestions: ['When will this patient be scanned?', 'Is that a confirmed time?'],
  },
  {
    id: 'unscheduled', title: 'Patient not yet scheduled',
    examination: { id: 'EXAM-002', patientId: 'PAT-002', patientName: 'Sam Morgan (fictional)', description: 'MRI lumbar spine' },
    exampleQuestions: ['What time is the scan?', 'Can I speak to someone about the timing?'],
  },
  {
    id: 'stale_information', title: 'Scheduling information is stale',
    examination: { id: 'EXAM-003', patientId: 'PAT-003', patientName: 'Jamie Lee (fictional)', description: 'MRI knee' },
    exampleQuestions: ['Do you have a current scan estimate?', 'Can you connect me to a person?'],
  },
  {
    id: 'scan_complete_report_pending', title: 'Scan complete, report pending',
    examination: { id: 'EXAM-004', patientId: 'PAT-004', patientName: 'Casey Jordan (fictional)', description: 'MRI abdomen' },
    exampleQuestions: ['Has the examination finished?', 'Is the report available?'],
  },
];

export function listScenarioSummaries(): ScenarioSummary[] {
  return structuredClone(scenarios);
}

export function buildScenarioRecord(scenarioId: ScenarioId, startedAt: Date): SchedulingRecord {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error('Unknown scenario.');

  const relativeTime = (minutes: number) => new Date(startedAt.getTime() + minutes * 60_000).toISOString();
  const record: SchedulingRecord = {
    examination: structuredClone(scenario.examination),
    scanStatus: 'scheduled',
    reportStatus: 'not_available',
    freshness: scenarioId === 'stale_information' ? 'stale' : 'current',
    source: {
      name: 'Demo scheduling source',
      updatedAt: relativeTime(scenarioId === 'stale_information' ? -120 : -5),
    },
  };

  if (scenarioId === 'unscheduled') {
    record.scanStatus = 'unscheduled';
  } else if (scenarioId === 'scan_complete_report_pending') {
    record.scanStatus = 'complete';
    record.reportStatus = 'pending';
  } else {
    record.estimatedWindow = { start: relativeTime(120), end: relativeTime(150) };
  }
  return record;
}
