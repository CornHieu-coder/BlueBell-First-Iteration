import type { EscalationResult } from '../../shared/contracts.js';
import { SchedulingFacts } from './SchedulingResultCard.js';

export function HandoffCard({ result }: { result: EscalationResult | null }) {
  return (
    <section className="panel result-card" aria-labelledby="handoff-heading">
      <div className="result-title">
        <span className="result-icon" aria-hidden="true">
          ↗
        </span>
        <h2 id="handoff-heading">Human assistance</h2>
      </div>
      {!result ? (
        <p className="empty-copy">
          A transfer or fallback will appear here if requested.
        </p>
      ) : (
        <div className="result-content" role="status">
          <span className="outcome-label">
            {result.category === 'urgent'
              ? 'Urgent assistance'
              : 'Routine enquiry'}{' '}
            ·{' '}
            {result.outcome === 'transfer' ? 'Simulated transfer' : 'Fallback'}
          </span>
          <h3>{result.destination}</h3>
          <p>{result.message}</p>
          <dl className="detail-list">
            <div>
              <dt>Examination</dt>
              <dd>{result.handoff.examination.id}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{result.handoff.reason.replaceAll('_', ' ')}</dd>
            </div>
          </dl>
          {result.handoff.lastSchedulingResult && (
            <div className="handoff-facts">
              <p className="eyebrow">Information already provided</p>
              <SchedulingFacts result={result.handoff.lastSchedulingResult} />
            </div>
          )}
          <p className="simulation-label">{result.simulationLabel}</p>
        </div>
      )}
    </section>
  );
}
