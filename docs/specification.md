# Workflow 01 specification

## Approved demonstration

Local voice-only browser demo using React/TypeScript/Vite, Node/Express and OpenAI Realtime. Four synthetic scenarios: current estimate, unscheduled, stale information and scan complete/report pending. No caller authentication, failed-authentication scenario, AI/processing notice, typed conversation input, captions or saved transcripts. Browser microphone permission and backend OpenAI connection credentials remain necessary technical mechanisms.

Select a scenario at `/` to navigate immediately to `/demo/:scenarioId`. Navigation does not start microphone capture or create a paid session. Start call requests microphone permission, creates the backend session and connects voice. A refresh reloads scenario summaries and starts in the ready state. The selection fixes the fictional patient/examination; no spoken identification is required.

Main interface: selected examination, example questions, staff availability (locked during calls), start/end/mute/request-person controls, progress indicator, structured scheduling facts, source details and simulated handoff cards. English; display times in Australia/Sydney; generate fixture timestamps relative to call start.

## Rules

- Backend owns fixtures, freshness, session state and escalation routing. Model uses tool results rather than inventing scheduling facts.
- A current estimate includes uncertainty. Unscheduled or stale records provide no estimate and offer assistance without automatically escalating. Omit stale estimate values from model-facing results.
- Scan completion and report availability are independent.
- Human requests, urgent concerns and out-of-scope requests escalate. Block scheduling lookups afterward. Repeated escalation returns the existing outcome.
- Available routine destination: Demo imaging scheduling staff. Unavailable routine destination: Demo imaging coordinator.
- Exact routine fallback: "The requested staff member is unavailable. The alternative contact for this enquiry is the imaging coordinator."
- Available urgent destination: Demo urgent assistance staff. Unavailable urgent destination: Demo urgent escalation contact.
- Every outcome carries "Simulation only — no staff notified." No actual staff contact, clinical assessment, booking changes or callback promises.
- Handoff includes examination, reason and only scheduling facts already returned. No verification fields, credentials or transcript.
- End/reset releases capture, playback and connection, then deletes session memory. A new call has fresh state. Microphone/provider errors offer retry, never typed interaction or fabricated answers.

## Interfaces and ownership

| Route | Parent function | Helpers |
| --- | --- | --- |
| GET /api/scenarios | listScenarioSummaries | none |
| POST /api/sessions | createDemoSession (step 2) | buildScenarioRecord, createRealtimeCredential, SessionStore.create |
| POST /api/sessions/:sessionId/scan-status | getScanStatus | getActiveSession |
| POST /api/sessions/:sessionId/escalation | requestHumanHelp | buildHandoffCard |
| DELETE /api/sessions/:sessionId | endDemoSession | SessionStore.delete |

Only assistant tools: getScanStatus, requestHumanHelp. Session creation accepts scenarioId and staffAvailable. Escalation accepts person_requested, urgent_concern, out_of_scope or unreliable_estimate. Lookups accept no patient/examination selector. Shared ApiError: code/message; route errors 400 invalid input, 404 missing session, 409 escalated lookup, 503 provider/configuration unavailable. Deletion is idempotent.

Session creation at the HTTP layer stores a session only after provider credentials succeed. Step 1 supplies the pure in-memory creation operation; step 2 adds that orchestration with a mocked provider. Step 4 supplies real provider connection and audio lifecycle.

Step 2 API details: POST /api/sessions returns 201; all successful lookups/escalations return 200; DELETE returns 204 even when repeated. Credential expiry is Unix seconds. No query parameters are supported. Unknown body fields are rejected; scan-status accepts no body or an empty JSON object. Responses are not cached. Malformed JSON returns 400 and bodies over 16kb return 413. Until step 4 the standalone server returns 503 PROVIDER_NOT_CONFIGURED for session creation, while tests inject a credential factory. No test-only provider is enabled in the application.

Memory only; disable optional tracing and avoid content-bearing logs. Real hospital integrations, authentication, telephony, notifications and appointment changes are excluded. No data or endpoint in this demo is hospital-approved.

## Implementation structure

- shared/contracts.ts: common data and API types.
- server/scenarios.ts: summaries and relative-time synthetic records.
- server/sessionStore.ts: isolated in-memory sessions.
- server/workflowService.ts: scheduling results, lifecycle, escalation and handoff rules.
- Later server files: app/index/config/routes/openaiService for HTTP and provider integration.
- Later client files: selection/demo pages, call controls, workflow/result/handoff components, voice lifecycle hook, tool adapters and agent instructions.
- tests: workflow first, then API, browser and audio lifecycle tests.

## Step 3 interface checkpoint

Frontend at http://127.0.0.1:5173 proxies /api to the loopback backend on port 3001. One application-level scenario fetch supports selection and direct scenario entry, with loading/error/retry views. Selecting a scenario navigates immediately; no intermediate notices or identification screens. Unknown scenario IDs have a recovery link.

Step 3 added the call controls, availability toggle and result cards. Results remain empty until tool results are returned.

## Step 4 voice checkpoint

Start call acquires the microphone, then creates the backend session and connects with the OpenAI Agents SDK WebRTC transport. The backend requests a client credential with a 60-second expiry and keeps the API key server-side. Staff availability is locked while connecting or in a call. The model receives two tools and Sydney-formatted estimates from the session-bound scheduling lookup.

A simulated handoff interrupts the current response, mutes input and suppresses any late scheduling result. The app displays the approved handoff message and requests the same wording as a dedicated audio response. The call closes when that response's audio drains or after ten seconds if it does not finish. Ending, leaving the page or a connection failure releases microphone and playback resources and requests deletion of the backend session.

