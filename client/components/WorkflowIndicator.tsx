import type { CallPhase } from '../types.js';

export function WorkflowIndicator({ phase }: { phase: CallPhase }) {
  const current = ['ready', 'connecting', 'error'].includes(phase)
    ? 0
    : ['listening', 'answering'].includes(phase)
      ? 1
      : 2;
  return (
    <nav className="workflow-indicator" aria-label="Workflow progress">
      <ol>
        {['Ready', 'Conversation', 'Outcome'].map((label, index) => (
          <li
            key={label}
            aria-current={index === current ? 'step' : undefined}
            className={index <= current ? 'reached' : ''}
          >
            <span>{index < current ? '✓' : `0${index + 1}`}</span>
            {label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
