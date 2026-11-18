import type { RealtimeSessionConfig } from '@openai/agents/realtime';
import { escalationReasons } from '../../shared/contracts.js';

export const realtimeTools = [
  {
    type: 'function',
    name: 'getScanStatus',
    description:
      'Look up timing, scan status and report availability for the selected examination.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'requestHumanHelp',
    description:
      'Start simulated human assistance for an explicit request, urgent concern, out-of-scope question or accepted offer of help.',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string', enum: [...escalationReasons] } },
      required: ['reason'],
      additionalProperties: false,
    },
    strict: true,
  },
] satisfies RealtimeSessionConfig['tools'];

export function parseEscalationReason(args: string) {
  try {
    const parsed = JSON.parse(args) as { reason?: unknown } | null;
    return escalationReasons.find((reason) => reason === parsed?.reason);
  } catch {
    return undefined;
  }
}
