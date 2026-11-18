import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ScenarioSummary } from '../../shared/contracts.js';
import { CallControls } from '../components/CallControls.js';
import { WorkflowIndicator } from '../components/WorkflowIndicator.js';
import { SchedulingResultCard } from '../components/SchedulingResultCard.js';
import { HandoffCard } from '../components/HandoffCard.js';
import { useVoiceSession } from '../voice/useVoiceSession.js';
import type { CallPhase } from '../types.js';

const callStatus: Record<CallPhase, string> = {
  ready: 'Ready when you are',
  connecting: 'Connecting',
  listening: 'Listening',
  answering: 'Assistant responding',
  escalating: 'Arranging human assistance',
  completed: 'Call ended',
  error: 'Call unavailable',
};

export function DemoPage({ scenarios }: { scenarios: ScenarioSummary[] }) {
  const { scenarioId } = useParams();
  const scenario = scenarios.find((item) => item.id === scenarioId);

  if (!scenario)
    return (
      <section className="state-panel">
        <h1>Scenario not found</h1>
        <Link to="/" className="text-link">
          ← All scenarios
        </Link>
      </section>
    );

  return <CallPage scenario={scenario} />;
}

function CallPage({ scenario }: { scenario: ScenarioSummary }) {
  const [staffAvailable, setStaffAvailable] = useState(true);
  const call = useVoiceSession(
    scenario.id,
    staffAvailable,
    scenario.examination,
  );
  const callActive = [
    'connecting',
    'listening',
    'answering',
    'escalating',
  ].includes(call.phase);

  return (
    <>
      <Link to="/" className="text-link back-link">
        ← All scenarios
      </Link>
      <div className="demo-heading">
        <div>
          <p className="eyebrow">01 / Voice assistant</p>
          <h1>Scan-status enquiries</h1>
          <p className="muted">{scenario.title}</p>
        </div>
        <span className="scenario-tag">{scenario.examination.id}</span>
      </div>
      <div className="demo-layout">
        <aside className="context-column" aria-label="Scenario settings">
          <section className="panel patient-panel">
            <p className="eyebrow">Selected examination</p>
            <div className="patient-avatar" aria-hidden="true">
              {scenario.examination.patientName
                .split(' ')
                .slice(0, 2)
                .map((word) => word[0])
                .join('')}
            </div>
            <h2>{scenario.examination.patientName}</h2>
            <p>{scenario.examination.description}</p>
            <dl className="detail-list">
              <div>
                <dt>Patient</dt>
                <dd>{scenario.examination.patientId}</dd>
              </div>
              <div>
                <dt>Examination</dt>
                <dd>{scenario.examination.id}</dd>
              </div>
            </dl>
          </section>
          <section className="panel availability-panel">
            <p className="eyebrow">Human assistance</p>
            <div className="availability-row">
              <div>
                <h2>Staff availability</h2>
                <p className="muted">
                  {staffAvailable ? 'Available' : 'Unavailable'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Staff available"
                aria-checked={staffAvailable}
                className="switch"
                disabled={callActive}
                onClick={() => setStaffAvailable((value) => !value)}
              >
                <span />
              </button>
            </div>
            <p className="small muted">Sets the simulated handoff outcome.</p>
          </section>
          <section className="question-panel">
            <p className="eyebrow">Try asking</p>
            {scenario.exampleQuestions.map((question) => (
              <p className="example-question" key={question}>
                “{question}”
              </p>
            ))}
          </section>
        </aside>
        <div className="conversation-column">
          <WorkflowIndicator phase={call.phase} />
          <section className="voice-panel" aria-labelledby="voice-heading">
            <div className="voice-panel-top">
              <span>Imaging assistant</span>
              <span className="voice-status">
                <span className="dot" />{' '}
                {callActive && call.phase !== 'connecting'
                  ? 'Connected'
                  : 'Not connected'}
              </span>
            </div>
            <div className="voice-center">
              <div className="microphone-orbit" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <rect
                    x="12"
                    y="5"
                    width="8"
                    height="14"
                    rx="4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M8 15v1a8 8 0 0016 0v-1M16 24v4m-4 0h8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h2 id="voice-heading" aria-live="polite">
                {callStatus[call.phase]}
              </h2>
              {call.error ? (
                <p role="alert">{call.error}</p>
              ) : (
                <p>Ask about the selected patient’s scan timing or status.</p>
              )}
            </div>
            <CallControls
              phase={call.phase}
              muted={call.muted}
              onStart={call.startCall}
              onEnd={call.endCall}
              onToggleMute={call.toggleMute}
              onRequestPerson={call.requestPerson}
            />
          </section>
          <div className="result-grid">
            <SchedulingResultCard result={call.scheduling} />
            <HandoffCard result={call.handoff} />
          </div>
        </div>
      </div>
    </>
  );
}
