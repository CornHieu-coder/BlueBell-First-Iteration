// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../client/App.js';
import { CallControls } from '../client/components/CallControls.js';
import { SchedulingResultCard } from '../client/components/SchedulingResultCard.js';
import { HandoffCard } from '../client/components/HandoffCard.js';
import { listScenarioSummaries } from '../server/scenarios.js';
import { SessionStore } from '../server/sessionStore.js';
import { WorkflowService } from '../server/workflowService.js';

function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

function open(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(listScenarioSummaries()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('scenario navigation', () => {
  it('opens the chosen scenario directly without creating a call or requesting microphone access', async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia },
    });
    open();
    const scenario = await screen.findByRole('link', {
      name: /Current scan estimate/,
    });
    await userEvent.click(scenario);
    expect(screen.getByLabelText('Current route').textContent).toBe(
      '/demo/current_estimate',
    );
    expect(
      screen.getByRole('heading', { name: 'Scan-status enquiries' }),
    ).toBeDefined();
    expect(screen.getByText('Alex Taylor (fictional)')).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: 'Start call' })
        .hasAttribute('disabled'),
    ).toBe(false);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      '/api/scenarios',
    ]);
  });

  it.each([
    ['current_estimate', 'Alex Taylor (fictional)'],
    ['unscheduled', 'Sam Morgan (fictional)'],
    ['stale_information', 'Jamie Lee (fictional)'],
    ['scan_complete_report_pending', 'Casey Jordan (fictional)'],
  ])('loads direct entry to %s in the ready state', async (id, patientName) => {
    open(`/demo/${id}`);
    expect(await screen.findByText(patientName)).toBeDefined();
    expect(screen.getByText('Ready when you are')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(
      screen.getByText('No scheduling information retrieved yet.'),
    ).toBeDefined();
  });

  it('allows staff availability to change before a call and resets it on scenario change', async () => {
    open('/demo/current_estimate');
    const toggle = await screen.findByRole('switch', {
      name: 'Staff available',
    });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Unavailable')).toBeDefined();
    await userEvent.click(screen.getByRole('link', { name: /All scenarios/ }));
    await userEvent.click(
      screen.getByRole('link', { name: /Patient not yet scheduled/ }),
    );
    expect(
      screen
        .getByRole('switch', { name: 'Staff available' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('shows a recovery link for an unknown scenario or route', async () => {
    const view = open('/demo/unknown');
    expect(
      await screen.findByRole('heading', { name: 'Scenario not found' }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: /All scenarios/ })).toBeDefined();
    view.unmount();
    open('/unknown');
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeDefined();
  });

  it('lets the user retry scenario loading after an API error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'UNAVAILABLE', message: 'API is unavailable.' }),
        { status: 503 },
      ),
    );
    open();
    expect(await screen.findByRole('alert')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('link', { name: /Current scan estimate/ }),
    ).toBeDefined();
  });

  it('shows a useful retry state for a failed network request', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    open();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not reach',
    );
  });
});

describe('result components', () => {
  it('shows the scheduling facts already provided in the handoff context', () => {
    const store = new SessionStore();
    const session = store.create('scan_complete_report_pending', true);
    const workflow = new WorkflowService(store);
    workflow.getScanStatus(session.id);
    render(
      <HandoffCard
        result={workflow.requestHumanHelp(session.id, 'person_requested')}
      />,
    );
    expect(screen.getByText('Information already provided')).toBeDefined();
    expect(screen.getByText('Scan complete')).toBeDefined();
    expect(screen.getByText('Report not yet available')).toBeDefined();
  });

  it('shows the current estimate in Sydney time with uncertainty and source details', () => {
    const store = new SessionStore();
    const session = store.create(
      'current_estimate',
      true,
      new Date('2026-11-18T00:00:00Z'),
    );
    const result = new WorkflowService(store).getScanStatus(session.id);
    render(<SchedulingResultCard result={result} />);
    expect(screen.getByText(/1:00 pm.*1:30 pm/i)).toBeDefined();
    expect(screen.getByText(/estimate may change/i)).toBeDefined();
    expect(screen.getByText('Demo scheduling source')).toBeDefined();
  });

  it.each(['unscheduled', 'stale_information'] as const)(
    'shows no invented time for %s',
    (id) => {
      const store = new SessionStore();
      const session = store.create(id, true);
      render(
        <SchedulingResultCard
          result={new WorkflowService(store).getScanStatus(session.id)}
        />,
      );
      expect(screen.getByText('No reliable current estimate')).toBeDefined();
      expect(screen.queryByText(/Estimated scan window/)).toBeNull();
    },
  );

  it('renders scan completion and report pending separately', () => {
    const store = new SessionStore();
    const session = store.create('scan_complete_report_pending', true);
    render(
      <SchedulingResultCard
        result={new WorkflowService(store).getScanStatus(session.id)}
      />,
    );
    expect(screen.getByText('Scan complete')).toBeDefined();
    expect(screen.getByText('Report not yet available')).toBeDefined();
  });

  it('renders the backend-approved coordinator fallback as simulated assistance', () => {
    const store = new SessionStore();
    const session = store.create('current_estimate', false);
    render(
      <HandoffCard
        result={new WorkflowService(store).requestHumanHelp(
          session.id,
          'person_requested',
        )}
      />,
    );
    expect(screen.getByText('Demo imaging coordinator')).toBeDefined();
    expect(
      screen.getByText(
        'The requested staff member is unavailable. The alternative contact for this enquiry is the imaging coordinator.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText('Simulation only — no staff notified.'),
    ).toBeDefined();
  });
});

describe('call controls', () => {
  it('enables active-call actions only when their handlers are connected', async () => {
    const end = vi.fn();
    const requestPerson = vi.fn();
    render(
      <CallControls
        phase="listening"
        muted={false}
        onEnd={end}
        onRequestPerson={requestPerson}
      />,
    );
    expect(
      screen
        .getByRole('button', { name: 'Start call' })
        .hasAttribute('disabled'),
    ).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'End call' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Request a person' }),
    );
    expect(end).toHaveBeenCalledOnce();
    expect(requestPerson).toHaveBeenCalledOnce();
  });
});
