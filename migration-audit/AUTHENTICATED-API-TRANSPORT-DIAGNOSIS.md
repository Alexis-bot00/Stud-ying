# Shared authenticated transport investigation

Branch: `migration/supabase-render-test`. Reviewed base: `a0d0f2bff1cb508c833e5e9f2a86fa6bb4ebdd4e`. The approved four-file diagnostic change is being prepared for an internal versionCode 3 test APK; release verification and build identifiers are recorded separately after completion.

## Findings and confidence

The common Android HTTP 502 cause is **not confirmed**. Auth's direct login fetch and the shared helper's GET/JSON requests both call global fetch. SDK 57 installs Expo fetch as that global unless EXPO_PUBLIC_USE_RN_FETCH explicitly opts out; the existing test build did not enable that flag. Switching a named Expo import to global fetch would not establish a different native transport. Official SDK reference: https://docs.expo.dev/versions/v57.0.0/sdk/expo/ (expo/fetch API); also verified in the installed `runtime.native.ts`.

| Detail | Auth login | Shared helper |
| --- | --- | --- |
| Fetch | global fetch | global fetch for GET/JSON; named Expo fetch for native multipart |
| URL | API + /api/auth/login | Same API constant + endpoint path |
| Authorization | absent | Bearer followed by current token, with one separating space |
| Content-Type | JSON, with JSON body | JSON for every non-FormData request, including GET; omitted for FormData |
| Body conversion | JSON.stringify | Caller supplies JSON/FormData |
| Response conversion | json(), invalid JSON becomes {} | Same |
| Custom timeout | none | none; supplied AbortSignal passes through |
| Rewriting/retries | none | none |

Token construction was inspected and tested structurally with a synthetic session; no real token was read, printed or logged. Fresh-token phone evidence alone does not distinguish header, route, ingress or native-runtime behavior. Related native downloads additionally use legacy FileSystem.downloadAsync with Bearer authentication, rather than this helper.

The helper's existing object-spread header merge is retained to keep the current wire shape during diagnosis. Its active callers use plain header objects; Headers/tuple-array inputs remain an existing limitation, not a confirmed cause for these requests.

## Exact changes

- `STUDYante-App/src/app/index.tsx`: call the extracted request function, attach safe error IDs, and expose a manually triggered read-only comparison under My Account only when using the exact Render test URL. Results live only in component memory, reset on account changes/unmount, and duplicate taps are blocked. Auth direct fetch, API constant, route behavior and response parsing remain intact.
- `STUDYante-App/src/lib/api-transport.ts`: same request/transport selection, safe network/5xx errors, validated application/gateway IDs, labeled client-only fallback references, explicit read-only comparison function.
- `STUDYante-App/tests/api-transport.test.mjs`: seven synthetic regression tests, including a loopback authenticated lightweight endpoint comparison.
- `migration-audit/AUTHENTICATED-API-TRANSPORT-DIAGNOSIS.md`: this report.

No transport replacement was made: the condition that global fetch succeeds while the shared transport fails has not been reproduced. Error IDs prefer x-request-id/body requestId, then Render rndr-id, accepting only the observed hexadecimal UUID/gateway shapes. Arbitrary IDs and raw network/upstream errors are not echoed. A client reference is explicitly labeled and is not represented as a server request ID or sent as a new header. No logging or automatic retries were added. Existing 4xx messages are preserved exactly, with IDs available as error metadata; network and 5xx messages display safe explanations and correlation IDs.

## Safe comparison

`compareAuthenticatedTransports(baseUrl, token, transports)` makes exactly two GETs to `/api/admin/me`: current shared request construction and minimal authenticated global fetch. It accepts only the Render test origin or loopback fixtures, is never invoked automatically, and returns only mode, UTC timestamp, endpoint/method, HTTP status, duration and safe error IDs. It releases responses without retaining account data. The private session must come from application state, never a pasted token.

Both modes passed with the same synthetic authorization on the local lightweight endpoint. The observed header difference is Content-Type on the shared GET. JSON, native multipart selection, browser multipart selection, body identity, Authorization prefix, cancellation and no-retry behavior are covered. These are Node/loopback tests, not Android network execution. Each comparison GET has a probe-only 20-second timeout; ordinary API request timeouts are unchanged. Safe IDs are captured for successful responses too. Status 0 means no HTTP response; a client reference is not a server request ID.

### VersionCode 3 phone instructions

1. Install the approved internal STUDYante Test update, keeping the separate production app untouched.
2. Sign in normally; never paste a token or credentials into a console or chat.
3. Open Library, then tap the top-right settings gear (Open account). Scroll past preferences to My Account.
4. Under Test connection diagnostics, tap Run read-only connection check once. Wait for both shared and global rows (up to about 40 seconds).
5. Share only the two diagnostic rows: UTC timestamps, GET /api/admin/me, statuses, durations, safe request IDs and their sources, plus the fetch-reference indicator. Do not screenshot the profile name/email above them.

The button performs exactly two GETs with no body, no retries, and no create/update/delete operations. The existing app's normal background presence heartbeat is separate and unchanged; the probe does not call it. The /api/admin/me handler reads account/admin status and performs no writes. Server response bodies are discarded, not displayed or cached. Navigating away or logging out discards the diagnostic UI results. The probe is absent on the production URL and is never automatically invoked.

## Validation before release staging

- Backend: 37 passed, 0 failed, 0 skipped; local file/mocked Supabase fixtures.
- Multipart/cache/planner plus new transport unit tests: 29 passed, 0 failed, 0 skipped (22 existing + 7 new).
- Active-source TypeScript: passed; generated dist snapshots excluded with a temporary config, repository tsconfig unchanged.
- Expo Android and web export: passed with process-only Render test URL and EXPO_NO_DOTENV=1; final ignored output `STUDYante-App/dist/auth-api-final-check`.
- Fresh browser regression results: 46 passed, 0 failed, 0 skipped on the final export. Original browser tests were not changed.
- Final total: 112 passed, 0 failed, 0 skipped (all 105 existing tests plus seven new transport tests).
- Source/test/report secret scan: four files, zero findings; changes manually reviewed for private data. Report contains no credentials or records. Unrelated working files match their captured hashes; HEAD, main and staging remain unchanged.

An initial refactor parenthesis error was corrected before the final passing TypeScript/export checks. The first browser run detected two Circle fallbacks relying on exact 4xx message equality; preserving those strings corrected the regressions without changing browser assertions. No functional change was made beyond error diagnostics and extraction for tests.

The investigation validation above preceded the approved commit/build step. The release must repeat all 112 tests, TypeScript, Android/web exports and the secret scan against an exact staged snapshot before committing only these four files. Test app name/package/versionCode are configured only in an isolated build checkout; production configuration and unrelated dirty files remain intact. No Railway access, Supabase project writes or private backup access is needed.
