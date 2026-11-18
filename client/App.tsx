import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import type { ScenarioSummary } from '../shared/contracts.js';
import { loadScenarios } from './api.js';
import { ScenarioSelectionPage } from './pages/ScenarioSelectionPage.js';
import { DemoPage } from './pages/DemoPage.js';

export function App() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadScenarios()
      .then((items) => {
        if (!cancelled) setScenarios(items);
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not load scenarios.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Imaging home">
          <span className="brand-mark" aria-hidden="true">
            +
          </span>{' '}
          imaging<span className="brand-divider">/</span>
          <span className="brand-subtitle">workflow lab</span>
        </Link>
        <span className="demo-badge">
          <span className="dot" /> Local demo
        </span>
      </header>
      <main id="main">
        {loading ? (
          <div className="state-panel" role="status">
            Loading scenarios…
          </div>
        ) : error ? (
          <section className="state-panel">
            <p className="eyebrow">Connection unavailable</p>
            <h1>Let’s try that again</h1>
            <p role="alert">{error}</p>
            <button
              className="button primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </section>
        ) : (
          <Routes>
            <Route
              path="/"
              element={<ScenarioSelectionPage scenarios={scenarios} />}
            />
            <Route
              path="/demo/:scenarioId"
              element={
                <DemoPage key={location.pathname} scenarios={scenarios} />
              }
            />
            <Route
              path="*"
              element={
                <section className="state-panel">
                  <h1>Page not found</h1>
                  <Link to="/" className="text-link">
                    ← All scenarios
                  </Link>
                </section>
              }
            />
          </Routes>
        )}
      </main>
      <footer className="site-footer">
        <span>Workflow 01 · Scan-status enquiries</span>
        <span>Synthetic patient records</span>
      </footer>
    </div>
  );
}
