import { OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import type { TransportToolCallEvent } from '@openai/agents/realtime';
import type {
  CreateSessionResponse,
  EscalationReason,
  EscalationResult,
  Examination,
  ScanStatusResult,
} from '../../shared/contracts.js';
import { getScanStatus, requestHumanHelp } from '../api.js';
import { formatDateTime } from '../formatters.js';
import { agentInstructions } from './agentInstructions.js';
import { parseEscalationReason, realtimeTools } from './realtimeTools.js';

interface CallEvents {
  phase: (value: 'listening' | 'answering' | 'escalating') => void;
  scheduling: (result: ScanStatusResult) => void;
  handoff: (result: EscalationResult) => void;
  finish: () => void;
  fail: (message: string) => void;
}

export function createRealtimeCall(
  session: CreateSessionResponse,
  stream: MediaStream,
  examination: Examination,
  events: CallEvents,
) {
  const audio = document.createElement('audio');
  const transport = new OpenAIRealtimeWebRTC({
    mediaStream: stream,
    audioElement: audio,
  });
  let closed = false;
  let ending = false;
  let acknowledgementTimer: ReturnType<typeof setTimeout> | undefined;
  let acknowledgementId: string | undefined;

  function serviceFailure() {
    if (!closed)
      events.fail(
        'Could not complete the request. Start another call to try again.',
      );
  }

  function connectionFailure() {
    if (closed) return;
    if (acknowledgementTimer !== undefined) events.finish();
    else
      events.fail(
        'The voice connection was interrupted. Start another call to try again.',
      );
  }

  async function escalate(
    reason: EscalationReason,
    toolCall?: TransportToolCallEvent,
  ) {
    if (closed || ending) return;
    ending = true;
    events.phase('escalating');
    try {
      audio.muted = true;
      transport.mute(true);
      transport.interrupt();
      const result = await requestHumanHelp(session.sessionId, reason);
      if (closed) return;
      events.handoff(result);
      acknowledgementTimer = setTimeout(events.finish, 10_000);
      try {
        if (toolCall)
          transport.sendFunctionCallOutput(
            toolCall,
            JSON.stringify(result),
            false,
          );
        transport.requestResponse({
          conversation: 'none',
          input: [],
          metadata: { purpose: 'handoff' },
          tool_choice: 'none',
          instructions: `Say this sentence verbatim, then stop: ${JSON.stringify(result.message)}`,
        });
      } catch {
        events.finish();
      }
    } catch {
      serviceFailure();
    }
  }

  async function handleTool(toolCall: TransportToolCallEvent) {
    if (closed || ending) return;
    try {
      if (toolCall.name === 'getScanStatus') {
        const result = await getScanStatus(session.sessionId);
        if (closed || ending) return;
        events.scheduling(result);
        const sydneyEstimate =
          result.kind === 'current_estimate'
            ? {
                start: formatDateTime(result.estimatedWindow.start),
                end: formatDateTime(result.estimatedWindow.end),
              }
            : undefined;
        transport.sendFunctionCallOutput(
          toolCall,
          JSON.stringify({ ...result, sydneyEstimate }),
        );
      } else if (toolCall.name === 'requestHumanHelp') {
        const reason = parseEscalationReason(toolCall.arguments);
        if (reason) await escalate(reason, toolCall);
        else
          transport.sendFunctionCallOutput(
            toolCall,
            'Invalid reason. Choose a permitted escalation reason.',
          );
      } else {
        transport.sendFunctionCallOutput(toolCall, 'This tool is unavailable.');
      }
    } catch {
      if (!ending) serviceFailure();
    }
  }

  transport.on('function_call', (call) => {
    void handleTool(call);
  });
  transport.on('error', ({ error }) => {
    // The response can finish on the server just before the cancellation arrives.
    const detail =
      error && typeof error === 'object' && 'error' in error
        ? error.error
        : error;
    if (
      ending &&
      detail &&
      typeof detail === 'object' &&
      'code' in detail &&
      detail.code === 'response_cancel_not_active'
    )
      return;
    connectionFailure();
  });
  transport.on('connection_change', (status) => {
    if (status === 'disconnected') connectionFailure();
  });
  transport.on('*', (event) => {
    if (closed) return;
    if (event.type === 'response.created') {
      if (
        'response' in event &&
        event.response?.metadata?.purpose === 'handoff'
      ) {
        acknowledgementId = event.response.id;
      }
      if (!ending) events.phase('answering');
    } else if (event.type === 'output_audio_buffer.started' && ending) {
      if (
        'response_id' in event &&
        acknowledgementId &&
        event.response_id === acknowledgementId
      )
        audio.muted = false;
    } else if (
      event.type === 'output_audio_buffer.stopped' ||
      event.type === 'output_audio_buffer.cleared'
    ) {
      if (!ending) events.phase('listening');
      else if (
        'response_id' in event &&
        acknowledgementId &&
        event.response_id === acknowledgementId
      )
        events.finish();
    } else if (event.type === 'response.done' && 'response' in event) {
      if (
        ending &&
        acknowledgementId &&
        event.response?.id === acknowledgementId &&
        event.response.status !== 'completed'
      ) {
        events.finish();
      } else if (!ending && event.response?.status === 'failed') {
        connectionFailure();
      } else if (
        !ending &&
        !event.response?.output?.some(
          (item: { type: string }) => item.type === 'message',
        )
      ) {
        events.phase('listening');
      }
    }
  });

  return {
    async connect() {
      await transport.connect({
        apiKey: session.connectionCredential,
        model: session.model,
        initialSessionConfig: {
          instructions: agentInstructions(examination),
          outputModalities: ['audio'],
          tracing: null,
          audio: {
            input: {
              transcription: null,
              turnDetection: { type: 'server_vad' },
            },
          },
          tools: realtimeTools,
          toolChoice: 'auto',
        },
      });
      if (!closed)
        transport.requestResponse({
          tool_choice: 'none',
          instructions:
            'Start with a brief greeting and ask how you can help with the selected scan.',
        });
    },
    mute(muted: boolean) {
      if (!ending) transport.mute(muted);
    },
    escalate,
    close() {
      closed = true;
      clearTimeout(acknowledgementTimer);
      audio.pause();
      audio.srcObject = null;
      transport.close();
    },
  };
}
