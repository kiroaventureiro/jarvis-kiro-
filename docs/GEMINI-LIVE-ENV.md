# Gemini Live experimental environment

Configure these variables only in the Vercel Preview environment for the isolated experiment branch. Do not set them in Production.

- `GEMINI_API_KEY`: Google AI Studio / Gemini API key. Server-side only.
- `JARVIS_GEMINI_LIVE_ENABLED`: leave `false` until client adapter and tests are ready. Set to `true` only for an explicitly approved preview test.
- `JARVIS_GEMINI_LIVE_PAID_ALLOWED`: leave `false` until cost approval.
- `JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR`: integer from 1 to 120, set only after choosing a session budget.

The endpoint `POST /api/voice/gemini-token` requires the existing Jarvis authorization cookie and both feature/cost gates. It returns a single-use ephemeral token, a 30-minute connection expiry and a one-minute session-start expiry. The permanent API key is never returned.

## Current phase status

The endpoint is implemented but disabled by default. No frontend connects to it yet. No audio is captured or sent to Google by this change. No Gemini Live session can start until the remaining client transport, audio pipeline, integration bridge and tests are implemented.

## Preview-only validation

1. Add the variables to Vercel Preview for `experiment/gemini-live-hybrid`.
2. Keep both gates false while configuring.
3. Verify unauthorized requests return 401 and disabled requests return 403.
4. Only after the client adapter and tests exist, enable the feature gate for a limited owner-only test.
5. Never add the API key to `NEXT_PUBLIC_*`, browser storage, source code, screenshots or logs.
6. Keep Production variables unchanged.
