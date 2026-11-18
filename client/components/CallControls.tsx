import type { CallPhase } from '../types.js';

interface CallControlsProps {
  phase: CallPhase;
  muted: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onToggleMute?: () => void;
  onRequestPerson?: () => void;
}

export function CallControls({
  phase,
  muted,
  onStart,
  onEnd,
  onToggleMute,
  onRequestPerson,
}: CallControlsProps) {
  const active = phase === 'listening' || phase === 'answering';
  const canStart =
    phase === 'ready' || phase === 'completed' || phase === 'error';
  return (
    <div className="call-controls" aria-label="Call controls">
      <div className="call-button-row">
        <button
          className="button start-button"
          disabled={!canStart || !onStart}
          onClick={onStart}
        >
          Start call <span aria-hidden="true">↗</span>
        </button>
        <button
          className="button end-button"
          disabled={canStart || !onEnd}
          onClick={onEnd}
        >
          End call
        </button>
        <button
          className="button quiet-button"
          aria-pressed={muted}
          disabled={!active || !onToggleMute}
          onClick={onToggleMute}
        >
          {muted ? 'Unmute microphone' : 'Mute microphone'}
        </button>
      </div>
      <button
        className="person-button"
        disabled={!active || !onRequestPerson}
        onClick={onRequestPerson}
      >
        Request a person <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
