import { afterEach, expect, it, vi } from 'vitest';
import { createRealtimeCredential } from '../server/openaiService.js';

afterEach(() => vi.unstubAllGlobals());

it('requests a short-lived Realtime client credential and returns only browser connection fields', async () => {
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe('https://api.openai.com/v1/realtime/client_secrets');
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer test-server-key',
    );
    expect(JSON.parse(String(init.body))).toEqual({
      expires_after: { anchor: 'created_at', seconds: 60 },
      session: { type: 'realtime', model: 'test-model', tracing: null },
    });
    return Response.json({
      value: 'ek_test',
      expires_at: 2000000000,
      session: {},
    });
  });
  vi.stubGlobal('fetch', fetch);
  await expect(
    createRealtimeCredential('test-server-key', 'test-model'),
  ).resolves.toEqual({
    connectionCredential: 'ek_test',
    expiresAt: 2000000000,
    model: 'test-model',
  });
  expect(fetch).toHaveBeenCalledOnce();
});

it('rejects a malformed provider credential', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ value: 'sk_unexpected', expires_at: 2000000000 }),
    ),
  );
  await expect(
    createRealtimeCredential('test-server-key', 'test-model'),
  ).rejects.toThrow();
});
