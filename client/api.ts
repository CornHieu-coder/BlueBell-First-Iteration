import type {
  CreateSessionInput,
  CreateSessionResponse,
  EscalationReason,
  EscalationResult,
  ScanStatusResult,
  ScenarioSummary,
} from '../shared/contracts.js';

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch {
    throw new Error(
      'Could not reach the local API. Check that the server is running and try again.',
    );
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    throw new Error(
      typeof error?.message === 'string'
        ? error.message
        : 'The request failed. Please try again.',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function loadScenarios(): Promise<ScenarioSummary[]> {
  return apiRequest('/scenarios');
}

export function createDemoSession(
  input: CreateSessionInput,
): Promise<CreateSessionResponse> {
  return apiRequest('/sessions', jsonPost(input));
}

export function getScanStatus(sessionId: string): Promise<ScanStatusResult> {
  return apiRequest(`/sessions/${encodeURIComponent(sessionId)}/scan-status`, {
    method: 'POST',
  });
}

export function requestHumanHelp(
  sessionId: string,
  reason: EscalationReason,
): Promise<EscalationResult> {
  return apiRequest(
    `/sessions/${encodeURIComponent(sessionId)}/escalation`,
    jsonPost({ reason }),
  );
}

export function endDemoSession(sessionId: string): Promise<void> {
  return apiRequest(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    keepalive: true,
  });
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
