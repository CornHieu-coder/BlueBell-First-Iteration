import { Router } from 'express';
import type { CreateSessionInput, CreateSessionResponse } from '../shared/contracts.js';
import { escalationReasons } from '../shared/contracts.js';
import { ApiHttpError } from './errors.js';
import { listScenarioSummaries } from './scenarios.js';
import { SessionStore } from './sessionStore.js';
import { WorkflowService } from './workflowService.js';

type RealtimeCredential = Omit<CreateSessionResponse, 'sessionId'>;

export interface ApiDependencies {
  store?: SessionStore;
  createRealtimeCredential?: () => Promise<RealtimeCredential>;
}

function validateBody(body: unknown, allowedKeys: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw new ApiHttpError(400, 'INVALID_INPUT', 'Invalid request body.');
  }
  return body as Record<string, unknown>;
}

function validateSessionInput(body: unknown): CreateSessionInput {
  const input = validateBody(body, ['scenarioId', 'staffAvailable']);
  const scenario = listScenarioSummaries().find((item) => item.id === input.scenarioId);
  if (!scenario || typeof input.staffAvailable !== 'boolean') {
    throw new ApiHttpError(400, 'INVALID_INPUT', 'A valid scenarioId and boolean staffAvailable are required.');
  }
  return { scenarioId: scenario.id, staffAvailable: input.staffAvailable };
}

async function unavailableProvider(): Promise<RealtimeCredential> {
  throw new ApiHttpError(503, 'PROVIDER_NOT_CONFIGURED', 'Voice provider is not configured for this checkpoint.');
}

export async function createDemoSession(
  input: CreateSessionInput,
  store: SessionStore,
  createRealtimeCredential: () => Promise<RealtimeCredential>,
): Promise<CreateSessionResponse> {
  let credential: RealtimeCredential;
  try {
    credential = await createRealtimeCredential();
    if (!credential || typeof credential.connectionCredential !== 'string' || !credential.connectionCredential.trim()
      || typeof credential.model !== 'string' || !credential.model.trim()
      || !Number.isFinite(credential.expiresAt) || credential.expiresAt <= Date.now() / 1000) {
      throw new Error('Invalid provider credential.');
    }
  } catch (error) {
    if (error instanceof ApiHttpError && error.code === 'PROVIDER_NOT_CONFIGURED') throw error;
    // Never send upstream messages, credentials or stack traces to the caller.
    throw new ApiHttpError(503, 'PROVIDER_UNAVAILABLE', 'Voice provider unavailable. Please try again.');
  }
  const session = store.create(input.scenarioId, input.staffAvailable);
  return {
    sessionId: session.id,
    connectionCredential: credential.connectionCredential,
    expiresAt: credential.expiresAt,
    model: credential.model,
  };
}

export function createApiRouter(dependencies: ApiDependencies = {}) {
  const store = dependencies.store ?? new SessionStore();
  const workflow = new WorkflowService(store);
  const createRealtimeCredential = dependencies.createRealtimeCredential ?? unavailableProvider;
  const router = Router();

  router.use((req, _res, next) => {
    if (Object.keys(req.query).length > 0) {
      throw new ApiHttpError(400, 'INVALID_INPUT', 'These API routes do not accept query parameters.');
    }
    next();
  });

  router.get('/scenarios', (_req, res) => {
    res.json(listScenarioSummaries());
  });

  router.post('/sessions', async (req, res) => {
    const input = validateSessionInput(req.body);
    res.status(201).json(await createDemoSession(input, store, createRealtimeCredential));
  });

  router.post('/sessions/:sessionId/scan-status', (req, res) => {
    if (req.body !== undefined) validateBody(req.body, []);
    res.json(workflow.getScanStatus(req.params.sessionId));
  });

  router.post('/sessions/:sessionId/escalation', (req, res) => {
    const input = validateBody(req.body, ['reason']);
    const reason = escalationReasons.find((value) => value === input.reason);
    if (!reason) throw new ApiHttpError(400, 'INVALID_INPUT', 'A supported escalation reason is required.');
    res.json(workflow.requestHumanHelp(req.params.sessionId, reason));
  });

  router.delete('/sessions/:sessionId', (req, res) => {
    workflow.endDemoSession(req.params.sessionId);
    res.status(204).end();
  });

  return router;
}
