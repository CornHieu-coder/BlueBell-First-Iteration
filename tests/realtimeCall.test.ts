// @vitest-environment jsdom
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getScanStatus, requestHumanHelp } from '../client/api.js';
import { createRealtimeCall } from '../client/voice/realtimeCall.js';
import { SessionStore } from '../server/sessionStore.js';
import { WorkflowService } from '../server/workflowService.js';

vi.mock('../client/api.js');
vi.mock('@openai/agents/realtime', () => ({
  OpenAIRealtimeWebRTC: function (options: { audioElement: HTMLAudioElement }) {
    return new MockTransport(options);
  },
}));

let transport: MockTransport;
class MockTransport extends EventEmitter {
  connect = vi.fn(async () => {});
  requestResponse = vi.fn();
  sendFunctionCallOutput = vi.fn();
  mute = vi.fn();
  interrupt = vi.fn();
  close = vi.fn();
  constructor(readonly options: { audioElement: HTMLAudioElement }) {
    super();
    transport = this;
  }
}

function setup() {
  const store = new SessionStore();
  const session = store.create('stale_information', false);
  const workflow = new WorkflowService(store);
  vi.mocked(getScanStatus).mockImplementation(async (id) =>
    workflow.getScanStatus(id),
  );
  vi.mocked(requestHumanHelp).mockImplementation(async (id, reason) =>
    workflow.requestHumanHelp(id, reason),
  );
  const events = {
    phase: vi.fn(),
    scheduling: vi.fn(),
    handoff: vi.fn(),
    finish: vi.fn(),
    fail: vi.fn(),
  };
  const voice = createRealtimeCall(
    {
      sessionId: session.id,
      model: 'test-model',
      connectionCredential: 'ek_test',
      expiresAt: 2000000000,
    },
    {} as MediaStream,
    session.record.examination,
    events,
  );
  return { voice, events, id: session.id };
}

function tool(name: string, args = '{}') {
  transport.emit('function_call', {
    type: 'function_call',
    callId: 'tool-id',
    name,
    arguments: args,
  });
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it('connects with the ephemeral key and passes scheduling facts from the bound session only', async () => {
  const { voice, events, id } = setup();
  await voice.connect();
  expect(transport.connect).toHaveBeenCalledWith(
    expect.objectContaining({
      apiKey: 'ek_test',
      model: 'test-model',
      initialSessionConfig: expect.objectContaining({
        tracing: null,
        audio: {
          input: { transcription: null, turnDetection: { type: 'server_vad' } },
        },
        tools: [
          expect.objectContaining({ name: 'getScanStatus' }),
          expect.objectContaining({ name: 'requestHumanHelp' }),
        ],
      }),
    }),
  );
  tool('getScanStatus');
  await vi.waitFor(() => expect(events.scheduling).toHaveBeenCalledOnce());
  expect(getScanStatus).toHaveBeenCalledExactlyOnceWith(id);
  const output = String(transport.sendFunctionCallOutput.mock.calls[0]?.[1]);
  expect(JSON.parse(output)).toMatchObject({
    kind: 'no_reliable_estimate',
    reason: 'stale_information',
    offerHumanHelp: true,
  });
  expect(output).not.toContain('estimatedWindow');
  expect(requestHumanHelp).not.toHaveBeenCalled();
  voice.close();
});

it('interrupts normal audio, ignores late lookups, and finishes only when the handoff audio drains', async () => {
  const { voice, events, id } = setup();
  const result = await getScanStatus(id);
  let resolveLookup!: (
    value: Awaited<ReturnType<typeof getScanStatus>>,
  ) => void;
  vi.mocked(getScanStatus).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
  );
  tool('getScanStatus');
  tool('requestHumanHelp', '{"reason":"person_requested"}');
  expect(transport.interrupt).toHaveBeenCalledOnce();
  expect(transport.options.audioElement.muted).toBe(true);
  await vi.waitFor(() => expect(events.handoff).toHaveBeenCalledOnce());
  resolveLookup(result);
  await Promise.resolve();
  expect(events.scheduling).not.toHaveBeenCalled();
  expect(transport.sendFunctionCallOutput).toHaveBeenCalledTimes(1);
  expect(transport.sendFunctionCallOutput.mock.calls[0]?.[2]).toBe(false);
  expect(transport.requestResponse).toHaveBeenCalledWith(
    expect.objectContaining({
      conversation: 'none',
      tool_choice: 'none',
      instructions: expect.stringContaining(
        'The alternative contact for this enquiry is the imaging coordinator.',
      ),
    }),
  );
  transport.emit('*', {
    type: 'response.created',
    response: { id: 'ack', metadata: { purpose: 'handoff' } },
  });
  transport.emit('*', {
    type: 'output_audio_buffer.stopped',
    response_id: 'old-response',
  });
  expect(events.finish).not.toHaveBeenCalled();
  transport.emit('*', {
    type: 'output_audio_buffer.started',
    response_id: 'ack',
  });
  expect(transport.options.audioElement.muted).toBe(false);
  transport.emit('*', {
    type: 'response.done',
    response: { id: 'ack', status: 'completed' },
  });
  expect(events.finish).not.toHaveBeenCalled();
  transport.emit('*', {
    type: 'output_audio_buffer.stopped',
    response_id: 'ack',
  });
  expect(events.finish).toHaveBeenCalledOnce();
  voice.close();
});

it('finishes a button handoff after ten seconds if the acknowledgment never plays', async () => {
  vi.useFakeTimers();
  const { voice, events } = setup();
  await voice.escalate('person_requested');
  await vi.advanceTimersByTimeAsync(9_999);
  expect(events.finish).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(events.finish).toHaveBeenCalledOnce();
  voice.close();
  expect(transport.close).toHaveBeenCalledOnce();
  expect(transport.options.audioElement.srcObject).toBeNull();
});
