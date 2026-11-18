# Workflow 01 demo

Implementation is delivered one checkpoint at a time. See [specification](docs/specification.md) and [progress](docs/progress.md).

## Current checkpoint

Step 4 connects the voice interface to OpenAI Realtime. You can inspect scenarios without a key. To start a call, you need an OpenAI API project key with access to the configured Realtime model and a browser with microphone access.

## Run the interface

```powershell
Copy-Item .env.example .env
```

Set `OPENAI_API_KEY` in `.env`, then start the app. The default model is `gpt-realtime-2.1-mini`. Set `OPENAI_REALTIME_MODEL` to change it.

```powershell
npm.cmd run dev
```

Open `http://127.0.0.1:5173/`. This command starts both the frontend and API; stop them with Ctrl+C. Choose one of the four scenarios to open `/demo/:scenarioId` directly. Refreshing that route reloads scenario details and returns to the ready state.

Choose a scenario, set staff availability and click **Start call**. Allow microphone access and ask one of the example questions. Use **Mute microphone**, **Request a person** or **End call** during the call. The app shows scheduling facts and simulated handoffs as they arrive. Starting another call clears the previous results.

The server keeps the API key in its environment and gives the browser a short-lived connection credential. Microphone audio is sent to OpenAI Realtime while connected. The demo disables optional tracing and user audio transcription and does not save audio or transcripts. Use only the fictional records shown in the scenarios.

## Run the local API

```powershell
npm.cmd run dev:server
```

The API listens on `http://127.0.0.1:3001`. Stop it with Ctrl+C.

| Method | Route | Input |
| --- | --- | --- |
| GET | `/api/scenarios` | None |
| POST | `/api/sessions` | `{ "scenarioId": "current_estimate", "staffAvailable": true }` |
| POST | `/api/sessions/:sessionId/scan-status` | No body, or `{}` |
| POST | `/api/sessions/:sessionId/escalation` | `{ "reason": "person_requested" }` |
| DELETE | `/api/sessions/:sessionId` | None |

The standalone server lists scenarios without an API key. Session creation returns `503 PROVIDER_NOT_CONFIGURED` if the key is missing. Integration tests inject a test credential factory through `createApp({ createRealtimeCredential, store })` and exercise all five routes without paid calls.

Example read-only request:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/scenarios
```

Session creation succeeds with HTTP 201 only after provider credentials are available; the response includes sessionId, connectionCredential, expiresAt (Unix seconds) and model. Responses use `Cache-Control: no-store`. API errors are JSON `{ code, message }`. Unknown/extra fields and query parameters are rejected. Malformed JSON returns 400; bodies over 16kb return 413.

## Run checks

Requires Node.js 24+.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

For step 2, review server/routes.ts, server/app.ts, server/errors.ts, server/index.ts and tests/api.test.ts. The routes reuse the step 1 workflow functions.

For step 3, review client/App.tsx, client/pages, client/components, client/api.ts, client/styles.css and tests/interface.test.tsx. Vite proxies `/api` to the local backend. The production build contains only browser code; server-side records and API credentials are not imported by the client.

For step 4, review server/openaiService.ts, client/voice and the voice and provider tests. Automated tests use a simulated connection. Browser testing and manual voice walkthroughs are step 5.

Project coding skills: [.agents/skills/dry/SKILL.md](.agents/skills/dry/SKILL.md) and [.agents/skills/kiss/SKILL.md](.agents/skills/kiss/SKILL.md).
