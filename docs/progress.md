# Implementation checkpoints

Stop after each numbered step for user inspection.

1. Shared contracts, fixtures, session storage and backend workflow rules — complete; stopped for user inspection.
2. API routes with mocked-provider integration tests — complete; stopped for user inspection.
3. Scenario selection and main interface — complete; stopped for user inspection.
4. Real voice connection, tool adapters and audio cleanup — implemented; stopped for user inspection.
5. Browser tests and manual voice walkthroughs — pending.

## Decisions

- Work directly in the supplied empty workspace; no Git repository exists to branch or create a worktree from.
- Project skills are stored in .agents/skills and referenced from AGENTS.md to persist DRY/KISS instructions for this project.
- Step 1 adds only test tooling and the backend domain foundation. No Express routes, UI, provider calls or dummy voice implementation.
- SessionStore is an instance-owned Map, not a global singleton; WorkflowService reuses it. HTTP creation will call it only after provider credential creation succeeds.
- Test expectations pin source-relative timestamps: current window +120 to +150 minutes; current update -5 minutes; stale update -120 minutes. Freshness is an explicit fixture flag, not hospital policy.

## Step 1 verification

- Test-first run: 17 failing tests against unimplemented workflow skeletons.
- Final `npm.cmd test`: 17 tests passed, 0 failures.
- Final `npm.cmd run typecheck`: passed, exit 0.
- Both DRY and KISS skill files passed the skill-creator quick validator.
- DRY/KISS self-review: shared contracts, one scheduling source, one lifecycle guard and a single escalation routing table; native Map, randomUUID and structuredClone instead of custom equivalents.
- Dependency installation initially hit restricted network EACCES; the authorised escalation succeeded. No API key or provider call was used.
- No Git commit: the supplied workspace is not a Git repository.
- Next step requires the user's instruction to continue: API routes with mocked-provider integration tests.

## Step 2 verification

- Implemented all five API routes in server/routes.ts, using the existing WorkflowService and SessionStore.
- Added server/app.ts for JSON parsing, cache prevention and safe JSON error handling; server/errors.ts for typed HTTP errors; server/index.ts for loopback startup.
- Added createDemoSession orchestration: validate input, await and validate provider credentials, then store session. Provider details are not exposed through error responses.
- Escalation reasons now have one shared runtime list and derived TypeScript type, reused by route validation.
- Test-first run: 26 API cases failed against the empty app. Final suite: 45 tests passed (17 workflow + 28 API); type checking passed with exit 0.
- Review checks cover pending/failed/expired provider credentials, extra provider fields, invalid request data, session-bound lookups, stale estimates, repeated escalation, deletion, oversized/malformed JSON and generic internal errors.
- Local server smoke check: GET /api/scenarios returned four fixtures; POST /api/sessions returned the documented 503 PROVIDER_NOT_CONFIGURED without a real provider.
- DRY/KISS review: routes reuse domain functions; shared JSON validation and error handling avoid repeated route logic. Express handles asynchronous rejections without custom promise wrappers.
- No paid provider calls, UI or voice connection implemented. Provider connection remains step 4; test credentials exist only in tests.
- Next checkpoint: step 3, scenario selection and main interface. Await the user's instruction before starting.

## Step 3 verification

- Added React/Vite routing for selection and `/demo/:scenarioId`, including direct entry, refresh recovery, unknown routes and API loading/error/retry states.
- Scenario summaries load at the application level and are reused during navigation; selection does not create a session or request microphone access.
- Main interface includes examination context, spoken-question examples, staff availability, call controls, workflow progress and structured result/handoff components.
- Step boundary: call controls are disabled without connected handlers. The app does not simulate listening or issue unused voice sessions. Step 4 will connect the existing API wrappers, control callbacks and result props to live voice events, and lock staff availability during calls.
- Added Sydney date/time formatters and shared SchedulingFacts rendering for both the scheduling card and information already provided in a handoff.
- Added one dev command to run the frontend and API together, plus a production frontend build. Formatted new UI source for code inspection.
- Test-first run: 15 interface tests failed against empty components; the missing handoff-facts case was separately observed failing before implementation.
- Final verification: 61 tests passed (17 workflow + 28 API + 16 interface), typecheck passed, production build passed.
- HTTP preview check: selection and direct scenario URLs returned 200; the frontend API proxy returned all four scenarios.
- Browser preview host was unavailable. Visual layout and real-browser interaction verification remain unverified; no substitute screenshot or browser result is claimed. Test DOM interaction covers navigation, availability changes, result rendering and retry states. Step 5 remains the browser-test/manual-walkthrough checkpoint.
- Next checkpoint: step 4, real voice connection, tool adapters and audio cleanup. Await the user's instruction before starting.

## Step 4 verification

- Added server-side OpenAI client credential issuance and a configurable Realtime model. The development server loads the local environment file.
- Connected call controls, scheduling results and simulated handoff results to the Agents SDK WebRTC transport. The transport is used directly so the app controls when tool outputs trigger a response and when acknowledgment playback ends.
- Added cleanup for end, navigation, late credential responses, provider failures and handoff completion or timeout. Scheduling tools reuse the existing session-bound API.
- Final verification: 70 automated tests passed, type checking passed and the production build passed.
- Tested the credential request with mocked provider responses and the call lifecycle with a simulated transport. A fresh loopback server verified the real credential factory's missing-key response. Port 3001 was already occupied during the startup check.
- No API key was configured. Live microphone capture, output audio and the model's spoken wording remain unverified. Step 5 covers browser testing and the voice walkthrough.

