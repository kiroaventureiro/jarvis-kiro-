# Gemini Live experimental environment

Configure these variables only in the Vercel Preview environment for the isolated experiment branch. Do not set them in Production.

- `GEMINI_API_KEY`: Google AI Studio / Gemini API key. Server-side only.
- `JARVIS_GEMINI_LIVE_ENABLED`: leave `false` until client adapter and tests are ready. Set to `true` only for an explicitly approved preview test.
- `JARVIS_GEMINI_LIVE_PAID_ALLOWED`: leave `false` until cost approval.
- `JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR`: integer from 1 to 120, set only after choosing a session budget.

The endpoint `POST /api/voice/gemini-token` requires the existing Jarvis authorization cookie and both feature/cost gates. It returns a single-use ephemeral token, a 30-minute connection expiry and a one-minute session-start expiry. The permanent API key is never returned.

## Implemented client

On Preview deployments from `experiment/gemini-live-hybrid`, Gemini is selected by default (not activated). `/?voice=gemini-live` remains an explicit opt-in elsewhere. Both microphone controls select the same adapter and consent dialog; alternate TTS/OpenAI sessions are blocked while selected. The server still requires authentication, both gates and a persistent session budget. The token endpoint refuses `VERCEL_ENV=production` regardless of gates. No environment variables were changed by this implementation.

Only an explicitly authorized Preview test should enable both gates and set a budget. The key alone does not enable this experiment. Reconnects provision fresh constrained tokens and count against the same session budget. Closing/hiding the page releases the microphone and clears the in-memory resumption handle. No raw audio, tokens or handles are stored by the Jarvis client.

See `GEMINI-LIVE-IMPLEMENTATION.md` for test evidence and remaining acoustic validation.

## Preview-only validation

1. Add the variables to Vercel Preview for `experiment/gemini-live-hybrid`.
2. Keep both gates false while configuring.
3. Verify unauthorized requests return 401 and disabled requests return 403.
4. After explicit cost approval, enable both gates for a limited owner-only Preview test; open `/?voice=gemini-live`, sign into Jarvis and activate the existing listening control. Use headphones first, then evaluate speakers and echo rejection.
5. Never add the API key to `NEXT_PUBLIC_*`, browser storage, source code, screenshots or logs.
6. Keep Production variables unchanged.

## Read-only diagnostics

The consent dialog includes **Verificar endpoint Gemini sem consumo**. It calls `GET /api/voice/gemini-token`, which checks the same auth/config gates without token issuance, Google calls or ledger admission. Status distinguishes selection from active PCM transport and reports HTTP status + sanitized code on error. `POST` validates config before opening the microphone.

Metadata inspected during correction: general Preview contains `GEMINI_API_KEY`; the experiment has no branch-specific overrides. `JARVIS_GEMINI_LIVE_ENABLED`, `JARVIS_GEMINI_LIVE_PAID_ALLOWED`, `JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR` were absent. No variable was changed. Key presence does not prove Google validity/quota.
