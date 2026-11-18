import type { CreateSessionResponse } from '../shared/contracts.js';
import { ApiHttpError } from './errors.js';

export async function createRealtimeCredential(
  apiKey = process.env.OPENAI_API_KEY?.trim(),
  model = process.env.OPENAI_REALTIME_MODEL?.trim() || 'gpt-realtime-2.1-mini',
): Promise<Omit<CreateSessionResponse, 'sessionId'>> {
  if (!apiKey)
    throw new ApiHttpError(
      503,
      'PROVIDER_NOT_CONFIGURED',
      'Set OPENAI_API_KEY on the local server, then restart it.',
    );

  const response = await fetch(
    'https://api.openai.com/v1/realtime/client_secrets',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 60 },
        session: { type: 'realtime', model, tracing: null },
      }),
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok)
    throw new Error('Could not create a Realtime client credential.');
  const data = (await response.json()) as {
    value?: unknown;
    expires_at?: unknown;
  } | null;
  if (
    typeof data?.value !== 'string' ||
    !data.value.startsWith('ek_') ||
    typeof data.expires_at !== 'number'
  ) {
    throw new Error('Realtime provider returned an invalid credential.');
  }
  return {
    connectionCredential: data.value,
    expiresAt: data.expires_at,
    model,
  };
}
