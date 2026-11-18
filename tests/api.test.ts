import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.js';
import { SessionStore } from '../server/sessionStore.js';

function setup() {
  const store = new SessionStore();
  const credential = {
    connectionCredential: 'test-only-ephemeral-credential',
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    model: 'test-realtime-model',
  };
  const createRealtimeCredential = vi.fn(async () => credential);
  const app = createApp({ store, createRealtimeCredential });
  return { app, store, credential, createRealtimeCredential };
}

async function start(app: ReturnType<typeof createApp>, scenarioId = 'current_estimate', staffAvailable = true) {
  const response = await request(app).post('/api/sessions').send({ scenarioId, staffAvailable }).expect(201);
  return response.body.sessionId as string;
}

describe('scenario and session routes', () => {
  it('lists four scenarios without starting a session or returning scheduling facts', async () => {
    const { app, createRealtimeCredential } = setup();
    const response = await request(app).get('/api/scenarios').expect(200);
    expect(response.body.map((item: { id: string }) => item.id)).toEqual([
      'current_estimate', 'unscheduled', 'stale_information', 'scan_complete_report_pending',
    ]);
    expect(response.text).not.toContain('estimatedWindow');
    expect(createRealtimeCredential).not.toHaveBeenCalled();
  });

  it('returns only the ephemeral connection contract and saves the selected examination', async () => {
    const { app, store, credential, createRealtimeCredential } = setup();
    const providerResponse = { ...credential, serverApiKey: 'must-never-be-returned' };
    createRealtimeCredential.mockResolvedValue(providerResponse);
    const response = await request(app).post('/api/sessions')
      .send({ scenarioId: 'current_estimate', staffAvailable: false }).expect(201);
    expect(response.body).toEqual({ sessionId: expect.any(String), ...credential });
    expect(store.get(response.body.sessionId)).toMatchObject({ scenarioId: 'current_estimate', staffAvailable: false, state: 'active' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each([
    {}, { scenarioId: 'unknown', staffAvailable: true },
    { scenarioId: 'current_estimate', staffAvailable: 'false' },
    { scenarioId: 'current_estimate' },
    { scenarioId: 'current_estimate', staffAvailable: true, patientId: 'PAT-999' },
    [], null,
  ].map((input) => ({ input })))('rejects invalid session input $input before contacting the provider', async ({ input }) => {
    const { app, createRealtimeCredential } = setup();
    const response = await request(app).post('/api/sessions').set('Content-Type', 'application/json')
      .send(JSON.stringify(input)).expect(400);
    expect(response.body.code).toBe('INVALID_INPUT');
    expect(createRealtimeCredential).not.toHaveBeenCalled();
  });

  it('creates no session while the provider is pending and none if it fails', async () => {
    const { store } = setup();
    const create = vi.spyOn(store, 'create');
    let rejectProvider!: (reason: Error) => void;
    let providerEntered!: () => void;
    const entered = new Promise<void>((resolve) => { providerEntered = resolve; });
    const provider = new Promise<never>((_resolve, reject) => { rejectProvider = reject; });
    const app = createApp({ store, createRealtimeCredential: () => { providerEntered(); return provider; } });
    const responsePromise = request(app).post('/api/sessions')
      .send({ scenarioId: 'current_estimate', staffAvailable: true }).then((response) => response);
    await entered;
    expect(create).not.toHaveBeenCalled();
    rejectProvider(new Error('secret-provider-internal-detail'));
    const response = await responsePromise;
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ code: 'PROVIDER_UNAVAILABLE', message: 'Voice provider unavailable. Please try again.' });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns a setup error when no credential provider is configured', async () => {
    const response = await request(createApp()).post('/api/sessions')
      .send({ scenarioId: 'current_estimate', staffAvailable: true }).expect(503);
    expect(response.body.code).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('does not create a usable session from an expired provider credential', async () => {
    const { store, credential } = setup();
    const create = vi.spyOn(store, 'create');
    const app = createApp({ store, createRealtimeCredential: async () => ({ ...credential, expiresAt: 1 }) });
    await request(app).post('/api/sessions').send({ scenarioId: 'current_estimate', staffAvailable: true }).expect(503);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('lookup, escalation and termination routes', () => {
  it('binds lookups to each session and keeps scan completion separate from reporting', async () => {
    const { app } = setup();
    const currentId = await start(app);
    const completeId = await start(app, 'scan_complete_report_pending');
    const current = await request(app).post(`/api/sessions/${currentId}/scan-status`).expect(200);
    expect(current.body).toMatchObject({ kind: 'current_estimate', examination: { id: 'EXAM-001' } });
    expect(current.body.responseInstruction).toContain('may change');
    const completed = await request(app).post(`/api/sessions/${completeId}/scan-status`).expect(200);
    expect(completed.body).toMatchObject({ scanStatus: 'complete', reportStatus: 'pending', examination: { id: 'EXAM-004' } });
  });

  it.each(['unscheduled', 'stale_information'])('omits estimates for %s without auto-escalation', async (scenarioId) => {
    const { app, store } = setup();
    const id = await start(app, scenarioId);
    const response = await request(app).post(`/api/sessions/${id}/scan-status`).expect(200);
    expect(response.body).toMatchObject({ kind: 'no_reliable_estimate', offerHumanHelp: true });
    expect(response.text).not.toContain('estimatedWindow');
    expect(store.get(id)?.state).toBe('active');
  });

  it('rejects patient selectors in either the body or query string', async () => {
    const { app } = setup();
    const id = await start(app);
    await request(app).post(`/api/sessions/${id}/scan-status`).send({ patientId: 'PAT-002' }).expect(400);
    await request(app).post(`/api/sessions/${id}/scan-status?patientId=PAT-002`).expect(400);
  });

  it('uses the coordinator fallback, includes prior facts and blocks later lookups', async () => {
    const { app } = setup();
    const id = await start(app, 'stale_information', false);
    const answer = await request(app).post(`/api/sessions/${id}/scan-status`).expect(200);
    const url = `/api/sessions/${id}/escalation`;
    const first = await request(app).post(url).send({ reason: 'person_requested' }).expect(200);
    expect(first.body).toMatchObject({
      category: 'routine', outcome: 'fallback', destination: 'Demo imaging coordinator',
      message: 'The requested staff member is unavailable. The alternative contact for this enquiry is the imaging coordinator.',
      simulationLabel: 'Simulation only — no staff notified.',
    });
    expect(first.body.handoff.lastSchedulingResult).toEqual(answer.body);
    expect(first.text).not.toContain('estimatedWindow');
    const repeated = await request(app).post(url).send({ reason: 'out_of_scope' }).expect(200);
    expect(repeated.body).toEqual(first.body);
    const blocked = await request(app).post(`/api/sessions/${id}/scan-status`).expect(409);
    expect(blocked.body.code).toBe('SESSION_ESCALATED');
  });

  it.each([
    { staff: true, reason: 'person_requested', destination: 'Demo imaging scheduling staff', outcome: 'transfer' },
    { staff: true, reason: 'urgent_concern', destination: 'Demo urgent assistance staff', outcome: 'transfer' },
    { staff: false, reason: 'urgent_concern', destination: 'Demo urgent escalation contact', outcome: 'fallback' },
    { staff: false, reason: 'unreliable_estimate', destination: 'Demo imaging coordinator', outcome: 'fallback' },
  ])('routes assistance $reason with availability $staff', async ({ staff, reason, destination, outcome }) => {
    const { app } = setup();
    const id = await start(app, 'current_estimate', staff);
    const response = await request(app).post(`/api/sessions/${id}/escalation`).send({ reason }).expect(200);
    expect(response.body).toMatchObject({ destination, outcome });
    expect(response.body.handoff).not.toHaveProperty('lastSchedulingResult');
  });

  it.each([{}, { reason: 'diagnose_patient' }, { reason: 'person_requested', staffAvailable: false }])('rejects invalid escalation %j without changing state', async (body) => {
    const { app } = setup();
    const id = await start(app);
    await request(app).post(`/api/sessions/${id}/escalation`).send(body).expect(400);
    await request(app).post(`/api/sessions/${id}/scan-status`).expect(200);
  });

  it('deletes session data, tolerates repeated deletion and returns 404 afterward', async () => {
    const { app, store } = setup();
    const id = await start(app);
    await request(app).delete(`/api/sessions/${id}`).expect(204);
    expect(store.get(id)).toBeUndefined();
    await request(app).delete(`/api/sessions/${id}`).expect(204);
    for (const route of ['scan-status', 'escalation']) {
      const response = await request(app).post(`/api/sessions/${id}/${route}`).send(route === 'escalation' ? { reason: 'person_requested' } : {}).expect(404);
      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    }
  });
});

describe('HTTP error responses', () => {
  it('rejects oversized bodies without exposing the submitted content', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/sessions')
      .send({ scenarioId: 'x'.repeat(17_000), staffAvailable: true }).expect(413);
    expect(response.body).toEqual({ code: 'INVALID_INPUT', message: 'Request body exceeds the 16kb limit.' });
  });

  it('returns a generic error when an unexpected internal failure occurs', async () => {
    const { app, store } = setup();
    const id = await start(app);
    vi.spyOn(store, 'get').mockImplementation(() => { throw new Error('private-internal-detail'); });
    const response = await request(app).post(`/api/sessions/${id}/scan-status`).expect(500);
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
  });

  it('returns JSON for malformed JSON and unknown endpoints without exposing internals', async () => {
    const { app } = setup();
    const malformed = await request(app).post('/api/sessions').set('Content-Type', 'application/json').send('{broken').expect(400);
    expect(malformed.body).toEqual({ code: 'INVALID_INPUT', message: 'Invalid JSON request body.' });
    const missing = await request(app).get('/api/unknown').expect(404);
    expect(missing.body).toEqual({ code: 'NOT_FOUND', message: 'API route not found.' });
  });
});
