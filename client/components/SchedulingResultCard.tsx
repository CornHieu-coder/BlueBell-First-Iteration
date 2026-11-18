import type { ScanStatusResult } from '../../shared/contracts.js';
import { formatDateTime, formatTimeWindow } from '../formatters.js';

export function SchedulingResultCard({
  result,
}: {
  result: ScanStatusResult | null;
}) {
  return (
    <section className="panel result-card" aria-labelledby="scheduling-heading">
      <div className="result-title">
        <span className="result-icon" aria-hidden="true">
          ◷
        </span>
        <h2 id="scheduling-heading">Scheduling information</h2>
      </div>
      {!result ? (
        <p className="empty-copy">No scheduling information retrieved yet.</p>
      ) : (
        <div role="status">
          <SchedulingFacts result={result} />
        </div>
      )}
    </section>
  );
}

export function SchedulingFacts({ result }: { result: ScanStatusResult }) {
  return (
    <div className="result-content">
      {result.kind === 'current_estimate' ? (
        <>
          <p className="eyebrow">Estimated scan window</p>
          <p className="estimate-value">
            {formatTimeWindow(
              result.estimatedWindow.start,
              result.estimatedWindow.end,
            )}
          </p>
          <p>{formatDateTime(result.estimatedWindow.start)}</p>
          <p className="small muted">This estimate may change.</p>
        </>
      ) : result.kind === 'no_reliable_estimate' ? (
        <>
          <h3>No reliable current estimate</h3>
          <p>
            {result.reason === 'stale_information'
              ? 'The scheduling information is out of date.'
              : 'The patient is not yet scheduled.'}
          </p>
          <p className="small muted">
            Human assistance is available on request.
          </p>
        </>
      ) : (
        <>
          <h3>Scan complete</h3>
          <p>Report not yet available</p>
          <p className="small muted">
            Scan completion does not mean clinical interpretation is complete.
          </p>
        </>
      )}
      <div className="source-details">
        <span>{result.source.name}</span>
        <span>Updated {formatDateTime(result.source.updatedAt)} · Sydney</span>
      </div>
    </div>
  );
}
