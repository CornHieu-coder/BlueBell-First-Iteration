import { Link } from 'react-router-dom';
import type { ScenarioSummary } from '../../shared/contracts.js';

export function ScenarioSelectionPage({
  scenarios,
}: {
  scenarios: ScenarioSummary[];
}) {
  return (
    <>
      <section className="selection-intro">
        <p className="eyebrow">01 / Imaging communication</p>
        <h1>
          A clearer answer.
          <br />
          <span>Fewer interruptions.</span>
        </h1>
        <p className="intro-copy">
          Explore a scan-status enquiry, from a routine timing question to a
          handoff for human assistance.
        </p>
      </section>
      <section aria-labelledby="scenarios-heading">
        <div className="section-heading">
          <h2 id="scenarios-heading">Choose a scenario</h2>
          <span>04 patient journeys</span>
        </div>
        <div className="scenario-grid">
          {scenarios.map((scenario, index) => (
            <Link
              key={scenario.id}
              to={`/demo/${scenario.id}`}
              className="scenario-card"
            >
              <div className="scenario-card-top">
                <span className="scenario-number">0{index + 1}</span>
                <span className="card-arrow" aria-hidden="true">
                  ↗
                </span>
              </div>
              <h3>{scenario.title}</h3>
              <p>{scenario.exampleQuestions[0]}</p>
              <div className="scenario-card-bottom">
                <span>{scenario.examination.description}</span>
                <span>{scenario.examination.id}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
