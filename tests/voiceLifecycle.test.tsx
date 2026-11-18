// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from '../client/api.js';
import { useVoiceSession } from '../client/voice/useVoiceSession.js';
import { createRealtimeCall } from '../client/voice/realtimeCall.js';

vi.mock('../client/api.js');
vi.mock('../client/voice/realtimeCall.js');

let stop: ReturnType<typeof vi.fn>;
let getUserMedia: ReturnType<typeof vi.fn>;
function mockVoice() {
  return {
    connect: vi.fn(async () => {}),
    close: vi.fn(),
    mute: vi.fn(),
    escalate: vi.fn(async () => {}),
  };
}

let voice: ReturnType<typeof mockVoice>;

function demo() {
  return renderHook(() =>
    useVoiceSession('current_estimate', false, {
      id: 'exam-1',
      patientId: 'test-1',
      patientName: 'Fictional Patient',
      description: 'MRI',
    }),
  );
}

beforeEach(() => {
  stop = vi.fn();
  getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  voice = mockVoice();
  vi.mocked(createRealtimeCall).mockReturnValue(voice);
  vi.mocked(api.createDemoSession).mockResolvedValue({
    sessionId: 'test-session',
    connectionCredential: 'ek_test',
    expiresAt: 2000000000,
    model: 'test-model',
  });
  vi.mocked(api.endDemoSession).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it('starts on demand, uses selected staff availability, and cleans up synchronously on end', async () => {
  const { result } = demo();
  expect(getUserMedia).not.toHaveBeenCalled();
  await act(() => result.current.startCall());
  expect(api.createDemoSession).toHaveBeenCalledWith({
    scenarioId: 'current_estimate',
    staffAvailable: false,
  });
  expect(result.current.phase).toBe('listening');
  act(() => result.current.toggleMute());
  expect(voice.mute).toHaveBeenCalledWith(true);
  await act(() => result.current.requestPerson());
  expect(voice.escalate).toHaveBeenCalledWith('person_requested');
  act(() => result.current.endCall());
  expect(stop).toHaveBeenCalledOnce();
  expect(voice.close).toHaveBeenCalledOnce();
  expect(api.endDemoSession).toHaveBeenCalledWith('test-session');
  expect(result.current.phase).toBe('completed');
});

it('disposes a backend session that arrives after the call was ended', async () => {
  let resolveSession!: (
    session: Awaited<ReturnType<typeof api.createDemoSession>>,
  ) => void;
  vi.mocked(api.createDemoSession).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
  );
  const { result } = demo();
  let starting!: Promise<void>;
  await act(async () => {
    starting = result.current.startCall();
  });
  act(() => result.current.endCall());
  expect(stop).toHaveBeenCalledOnce();
  await act(async () => {
    resolveSession({
      sessionId: 'late',
      connectionCredential: 'ek_test',
      expiresAt: 2000000000,
      model: 'test-model',
    });
    await starting;
  });
  expect(api.endDemoSession).toHaveBeenCalledWith('late');
  expect(createRealtimeCall).not.toHaveBeenCalled();
  expect(result.current.phase).toBe('completed');
});

it('never creates a backend session when microphone permission is rejected', async () => {
  getUserMedia.mockRejectedValueOnce(
    new DOMException('Denied', 'NotAllowedError'),
  );
  const { result } = demo();
  await act(() => result.current.startCall());
  expect(api.createDemoSession).not.toHaveBeenCalled();
  expect(result.current.error).toMatch(/allow microphone access/i);
  expect(result.current.phase).toBe('error');
});

it('cleans up the microphone and backend session if voice connection fails', async () => {
  voice.connect.mockRejectedValueOnce(new Error('sensitive provider details'));
  const { result } = demo();
  await act(() => result.current.startCall());
  expect(stop).toHaveBeenCalledOnce();
  expect(voice.close).toHaveBeenCalledOnce();
  expect(api.endDemoSession).toHaveBeenCalledWith('test-session');
  expect(result.current.error).toMatch(/could not connect/i);
});
