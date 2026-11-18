import type { DemoSession, ScenarioId } from '../shared/contracts.js';
import { randomUUID } from 'node:crypto';
import { buildScenarioRecord } from './scenarios.js';

export class SessionStore {
  private readonly sessions = new Map<string, DemoSession>();

  // The API layer calls this only after provider credentials are created successfully.
  create(scenarioId: ScenarioId, staffAvailable: boolean, startedAt = new Date()): DemoSession {
    const session: DemoSession = {
      id: randomUUID(), scenarioId, staffAvailable,
      startedAt: startedAt.toISOString(), state: 'active',
      record: buildScenarioRecord(scenarioId, startedAt),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): DemoSession | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
