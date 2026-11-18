import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EscalationResult,
  Examination,
  ScanStatusResult,
  ScenarioId,
} from '../../shared/contracts.js';
import { createDemoSession, endDemoSession } from '../api.js';
import type { CallPhase } from '../types.js';
import { createRealtimeCall } from './realtimeCall.js';

interface ActiveCall {
  stream?: MediaStream;
  sessionId?: string;
  voice?: ReturnType<typeof createRealtimeCall>;
}

function releaseMicrophone(stream?: MediaStream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function deleteSession(sessionId: string) {
  // Audio has already stopped. A network failure cannot delay local cleanup.
  void endDemoSession(sessionId).catch(() => {});
}

export function useVoiceSession(
  scenarioId: ScenarioId,
  staffAvailable: boolean,
  examination: Examination,
) {
  const active = useRef<ActiveCall | null>(null);
  const [phase, setPhase] = useState<CallPhase>('ready');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<ScanStatusResult | null>(null);
  const [handoff, setHandoff] = useState<EscalationResult | null>(null);

  const release = useCallback(() => {
    const call = active.current;
    if (!call) return;
    active.current = null;
    releaseMicrophone(call.stream);
    try {
      call.voice?.close();
    } catch {
      // If the transport has already closed, still delete the local session.
    }
    if (call.sessionId) deleteSession(call.sessionId);
  }, []);

  useEffect(() => {
    function handlePageHide() {
      if (!active.current) return;
      release();
      setPhase('completed');
      setMuted(false);
    }
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      release();
    };
  }, [release]);

  function endCall() {
    release();
    setMuted(false);
    setPhase('completed');
  }

  async function startCall() {
    if (active.current) return;
    const call: ActiveCall = {};
    active.current = call;
    setPhase('connecting');
    setMuted(false);
    setError(null);
    setScheduling(null);
    setHandoff(null);
    const isCurrent = () => call === active.current;
    const fail = (message: string) => {
      if (!isCurrent()) return;
      release();
      setMuted(false);
      setError(message);
      setPhase('error');
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      fail(
        'Allow microphone access in your browser and check that a microphone is connected, then try again.',
      );
      return;
    }
    if (!isCurrent()) {
      releaseMicrophone(stream);
      return;
    }
    call.stream = stream;

    let session: Awaited<ReturnType<typeof createDemoSession>>;
    try {
      session = await createDemoSession({ scenarioId, staffAvailable });
    } catch (failure) {
      fail(
        failure instanceof Error
          ? failure.message
          : 'Could not start the call. Try again.',
      );
      return;
    }
    if (!isCurrent()) {
      deleteSession(session.sessionId);
      return;
    }
    call.sessionId = session.sessionId;

    try {
      call.voice = createRealtimeCall(session, stream, examination, {
        phase: (value) => {
          if (isCurrent()) setPhase(value);
        },
        scheduling: (value) => {
          if (isCurrent()) setScheduling(value);
        },
        handoff: (value) => {
          if (isCurrent()) setHandoff(value);
        },
        finish: () => {
          if (isCurrent()) endCall();
        },
        fail,
      });
      await call.voice.connect();
      if (isCurrent())
        setPhase((current) =>
          current === 'connecting' ? 'listening' : current,
        );
    } catch {
      fail(
        'Could not connect the voice session. Check your connection and try again.',
      );
    }
  }

  return {
    phase,
    muted,
    error,
    scheduling,
    handoff,
    startCall,
    endCall,
    toggleMute() {
      const voice = active.current?.voice;
      if (!voice) return;
      voice.mute(!muted);
      setMuted(!muted);
    },
    requestPerson() {
      return active.current?.voice?.escalate('person_requested');
    },
  };
}
