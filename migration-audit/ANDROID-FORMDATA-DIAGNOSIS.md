# Android FormData diagnosis and local construction fix

Branch: `migration/supabase-render-test`. Starting commit: `aada7881a34f2d87532da3e796c4cc657cf6a8fe`.

## Confirmed findings

The shared `api()` helper does not manually set multipart Content-Type. It leaves multipart headers to Expo fetch. The installed SDK 57 encoder creates a random boundary and closing delimiter, and supplies the matching Content-Type. Android passes the resulting byte array to OkHttp; application code sets neither Content-Length nor Transfer-Encoding. These checks establish source behavior, not a capture of the failing APK's network traffic.

Expo's File implements the Blob interface but does not extend Blob. Its `name` comes from its URI. Expo's FormData patch applies the optional filename only to actual Blob instances, so passing an ExpoFile plus a picker filename loses the picker filename. The native AI path also computed a MIME type without using it. Profile upload used a React Native URI descriptor, which the installed Expo fetch encoder rejects. These are reproduced construction defects; none independently proves the Render HTTP 502 cause.

Photo schedule scanning uses JSON, not FormData. Text-only AI uses FormData but has no attachment. This file-only fix cannot establish a remedy for those failures. Previous pre-Express failures on authenticated reads and JSON requests also prevent attributing every failure to multipart.

## Local change

A shared attachment helper now supplies explicit name, MIME type and a lazy `bytes()` reader, the file-part interface accepted by the installed Expo encoder. The native adapter uses ExpoFile only for local bytes and MIME fallback. It avoids React Native's URI-only parts and Blob constructor typed-array limitations. Web keeps browser Files. Boundary and request length remain transport responsibilities; no manual boundary, transfer header, retry or logging is introduced.

The helper is used for library uploads, direct generation, AI file/image attachments, profile pictures, Circle note import and school calendar import. Multiple-file upload order and saved `libraryIds` generation are unchanged. Photo scanning retains its JSON API contract. Existing layouts and API error handling are unchanged.

## Exact intended files

- `STUDYante-App/src/app/index.tsx`: route file attachments through the shared helper; await construction.
- `STUDYante-App/src/components/circle-materials.tsx`: shared Circle note attachment.
- `STUDYante-App/src/components/school-calendar.tsx`: shared calendar attachment.
- `STUDYante-App/src/lib/multipart.ts`: platform-independent file metadata/reader construction.
- `STUDYante-App/src/lib/upload-file.ts`: Expo native file and platform adapter.
- `STUDYante-App/tests/multipart.test.mjs`: installed Expo encoder/FormData patch regression tests and loopback parser comparison.
- `migration-audit/ANDROID-FORMDATA-DIAGNOSIS.md`: this report.

## Verification

- TypeScript: passes for active `src`, Expo types and expo-env; old generated `dist` snapshots excluded through a temporary configuration, repository tsconfig unchanged.
- Backend: 37 passed, 0 failed, 0 skipped (file and mocked Supabase modes).
- Multipart: 12 passed, 0 failed; installed Expo encoder and FormData patch tested against a loopback Multer parser and Node multipart using synthetic TXT/metadata fixtures. Image case tests image MIME/part construction, not Gemini image recognition. No native Android networking is executed by these tests.
- Account cache/planner: 10 passed, 0 failed.
- Android and web export: passes, process-only test URL and dotenv loading disabled. Final output: ignored `STUDYante-App/dist/multipart-final-check`; no APK.
- Secret scan: all seven intended source/test/report files, zero matches for known credential/private-key/JWT/database URL patterns. Diff reviewed for private data; only synthetic fixtures added. Production API constant matches HEAD exactly. Intended tracked changes pass `git diff --check`; an existing whitespace issue in unrelated `app-tabs.web.tsx` was left untouched.
- Browser: 46 passed, 0 failed, 0 skipped against the freshly exported preview on localhost:4176. Temporary runner configuration preserves the existing browser configuration. The earlier default runner also passed 45 tests and skipped its environment-dependent API-origin check, but served a previous export; the fresh run is the authoritative result.
- Final test total: 105 passed, 0 failed, 0 skipped (37 backend + 12 multipart + 10 cache/planner + 46 browser). Native device end-to-end verification has not been performed and is not counted as passed.

No Supabase project writes, dataset access, backup access, Railway changes, Render changes, commits, pushes, deployments or APK builds were performed. All test writes occurred in disposable local memory/loopback parser fixtures. Unrelated dirty files and existing staged EAS configuration were preserved. Generated exports and browser artifacts are excluded from intended source files.

## Remaining limitation

The pre-Express APK 502 root cause is **not confirmed**. Device/native transport verification remains necessary before calling these changes a fix for that symptom. Source tests cannot observe Android HTTP negotiation, actual outgoing length/transfer headers, device URI accessibility, or Render ingress rejection. No speculative global fetch switch was made: SDK 57 installs Expo fetch globally by default, so replacing its named import with global fetch would not constitute an independent transport test.

SDK reference read before edits: https://docs.expo.dev/versions/v57.0.0/ and https://docs.expo.dev/versions/v57.0.0/sdk/expo/. Implementation evidence comes from the locally installed Expo FormData patch, convertFormDataAsync, RequestUtils, Android NativeRequest and Expo File sources. A subsequent approved native/device comparison should use synthetic fixtures and record only safe structural transport metadata; no further deployment/build is authorized by this task.
