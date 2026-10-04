# Local migration foundation

This includes the migration foundation and Phase 3 backend compatibility integration. File storage remains the default. Synthetic testing against the separate Supabase test project passed; no production cutover is authorized. See `RENDER-TEST-SETUP.md` for the prepared test-service settings.

## What runs now

`npm start` still runs the original file-backed Express backend. With no `STORAGE_DRIVER`, or with `STORAGE_DRIVER=file`, all existing persistence and API routes remain unchanged except `/api/generate` now supports owned `libraryIds` (JSON string or array) alongside the existing singular/upload requests. It rejects invalid IDs and mixed-account selections before asking AI. Order is preserved, duplicate selections are removed, and all selected sources are included. Responses keep the existing shape.

`storage/repository.js` supports file and Supabase modes and is wired into the active Express persistence helpers through `storage/runtime.js`. Supabase mode uses canonical document snapshots and atomic checksum-checked commits. Normalized tables remain migration projections. See the Phase 3 section below for verified behavior and remaining limitations; this is not a finished production migration.

The adapter defaults to `file`; remote calls require explicitly constructed `allowNetwork: true` AND backend credentials. No dotenv loading is done by the migration CLI. This avoids accidentally using local real secrets. Tests provide a fake transport to the adapter; embedded PostgreSQL runs entirely in memory. Unknown driver names, missing credentials, unsafe paths and corrupted JSON fail closed.

## Database structure

Apply SQL in numeric order only after a separate setup decision:

1. `001_foundation.sql`: text IDs, unchanged password hashes, users/profiles/settings, folders/uploads/typed study materials, chats/messages, community, Circles/members/requests/invitations/messages/materials/results/activity, friendships/direct messages, calendar/schedule/notifications/Cappy/planner/tasks/budget/grades/attendance, announcements/admin logs, immutable source-document payloads, migration runs and per-record ledger.
2. `002_transactional_import.sql`: service-role-only import RPC with advisory lock, duplicate skipping and conflicting-content rejection; atomic DB transaction with deferred foreign keys. Document replacement requires an expected checksum to reject stale writes.
3. `003_private_buckets.sql`: six private buckets. Existing public buckets with these names cause an explicit error; no public/client read policies are added.

The normalized tables are initial projections. Original JSON payloads (including unrecognized fields, old formats, arrays and order) stay intact in `source_documents`; raw bytes and formatting are archived separately. The import preserves existing text IDs and timestamps. ID-less child records get deterministic generated IDs; original parent JSON is untouched. Legacy Circle membership/notes are projected without calling application normalization routines.

Indexes cover ownership, folders, Circle access, chat relationships and results. User emails are case-insensitively unique; membership is unique per Circle/user. No schema/data DROP, truncate or source delete is included. Supabase Auth is not substituted: backend bcrypt/JWT remain authoritative. Raw profile data URIs remain preserved in user payloads; moving them to bucket references would require a separate response-compatibility step.

The document CAS operation only updates source payloads. Future live route integration must define projection updates in the same transaction before using projections as authoritative queries; a CAS call alone does not refresh projections.

## Storage plan and policies

| Bucket | Content | Maximum upload |
| --- | --- | --- |
| `documents` | PDF, DOCX, PPTX, TXT | 20 MiB |
| `images` | JPEG, PNG, WEBP library images | 20 MiB |
| `circle-files` | Retained Circle attachments if introduced/confirmed | 20 MiB |
| `attachments` | Retained AI/document/camera attachments if confirmed | 20 MiB |
| `profile-images` | Future profile-object representation | 10 MiB bucket ceiling; preserve 3 MiB route rule |
| `migration-archive` | Exact source bytes, JSON, unknown/orphan files | No bucket cap; project limits still apply |

Buckets stay private. Supabase's [private bucket model](https://supabase.com/docs/guides/storage/buckets/fundamentals) supports authenticated downloads or limited signed URLs. No browser `anon`/Supabase Auth policy is granted because app JWTs are not Supabase Auth sessions. The backend must resolve trusted metadata for the exact bucket/key, verify ownership or accepted Circle membership, then download/sign. A metadata object coming from the request body is never trusted. Suspended actors fail authorization. Signed URL lifetime is capped at five minutes. Documents are stored/downloaded as documents, with no image transformations.

The repository's generic file-object store (`library/objects/<bucket>/<key>`) is for adapter callers/tests, not the current route's `library/files` layout. Do not move or rename current uploads; the later integration must retain storedName/API compatibility. Migration object names are content-addressed for the archive and deterministic for owned files. Existing Storage bytes are downloaded and checksummed on collision; differing bytes cause a failure and are never overwritten.

Uploads precede the transactional DB import. PostgreSQL and Storage cannot share a single transaction. Failed DB imports can leave safe reusable uploaded objects; do not delete them automatically. A rerun verifies checksums and skips matching objects. Standard uploads are supported by the adapter; Supabase [recommends resumable uploads above 6 MB](https://supabase.com/docs/guides/storage/uploads/standard-uploads). Reliability for the app's full 20 MiB limit must be verified before production integration.

## Migration tools

`migration/plan.js` recursively inventories a supplied library directory, archives all source bytes, parses known stores, builds lossless documents/relational projections, checks IDs/emails/timestamps, and flags ownerless records, missing users/folders and missing referenced binaries. No owner is manufactured. Missing mandatory users/index/chats, malformed JSON, symlinks and special entries fail. Unknown files remain archival objects.

`migration/cli.js` defaults to dry-run, never contacts Supabase for a dry-run, requires a new private report path outside Git/source, and refuses to overwrite a report. It does not alter the source. The report contains payloads/hashes and must be treated as private. Actual imports require BOTH `--apply --allow-network`, a Supabase adapter and separately supplied backend secrets; do not run apply now. Sources are rechecksummed before writes. Successful per-record imports are logged in `migration_records`; aggregate migrated/skipped/failed results and source issues appear in the private report. An RPC failure rolls back DB records, but a transport timeout leaves outcome uncertain; idempotent rerun resolves it.

The supplied source is a **library directory**, not the outer backup directory. Outside-volume uploads/legacy users must be preserved separately using the verified export; do not merge legacy account stores or transient uploads automatically. Device-only planner, calendar, Cappy/local cache/theme/reminder state and in-memory reset codes cannot be inferred from backend JSON. Their tables reserve future sync destinations without changing offline behavior.

## PowerShell checks

From the repository root:

```powershell
git status --short
Push-Location .\backend
npm.cmd test
Pop-Location
node --test .\STUDYante-App\tests\planner.test.mjs
& '.\STUDYante-App\node_modules\.bin\tsc.cmd' --noEmit --project .\STUDYante-App\tsconfig.json
node --check .\backend\server.js
```

Optional local dry-run, only when you choose a source copy and a private output path:

```powershell
$librarySource = 'C:\path\to\private-backup\library'
$privateReport = 'C:\path\to\private-reports\new-dry-run-report.json'
node .\backend\migration\cli.js --source $librarySource --report $privateReport --dry-run
```

No dry-run of the real backup was executed during this foundation task. All import tests use synthetic fixtures.

## Next manual setup steps

1. Review this foundation and choose a separate test Supabase project. Keep Railway and the production URL as they are.
2. After setup approval, create that test project and apply the three SQL files in order. Confirm six private buckets, RLS and denied browser/client access; audit any pre-existing broad Storage policies separately.
3. Store test URL/service-role key only in backend environment management. Never put it in Expo, Git, reports or chat. Use the example template without adding real values to tracked files.
4. Run a private dry-run against a copy of the verified export. Resolve relationship/legacy/orphan issues; compare expected account/material/Circle/chat counts and binary checksums.
5. In a later approved step, run the real import into the test project, compare destination counts/checksums, and verify existing account bcrypt/JWT compatibility. No such connection/import is authorized or performed here.
6. Complete async route/binary integration and full existing-account/new-account/offline/Android/web feature parity before Render or any production cutover. Maintain the two backups and Railway rollback service.

## Files in this change

Changed: `backend/server.js`, `backend/package.json`, `backend/package-lock.json`.

Created: `backend/generation-lesson.js`, `backend/generation-lesson.test.js`, `backend/storage/repository.js`, `backend/storage/repository.test.js`, `backend/migrations/001_foundation.sql`, `002_transactional_import.sql`, `003_private_buckets.sql`, `backend/migration/plan.js`, `plan.test.js`, `cli.js`, `cli.test.js`, this README, and `backend/.env.migration.example`.

All earlier dirty files remain preserved. No `git add` or commit was performed. The new embedded PostgreSQL package is a dev dependency only. Existing historical `server-old.js` syntax failure and pre-existing dependency audit warnings are not fixed by this infrastructure foundation.

## Phase 3 local runtime integration (supersedes the Phase 2 runtime limitation)

`server.js` now uses `storage/runtime.js` for all seven active JSON stores, including accounts, Library, folders, materials, chats, Community, friends, Circles, announcements and admin logs. Existing bcrypt/JWT authentication and route permission checks remain authoritative; Supabase Auth is unused. `STORAGE_DRIVER` still defaults to `file`, with the current working-directory Library/uploads layout. No production environment setting was changed.

Supabase mode privately reads canonical `source_documents` before dispatching a request. Existing synchronous route helpers operate on that request's snapshot. Changes are committed together through `004_runtime_documents.sql` before the JSON response completes. Requests serialize within a process, and an expected-checksum check rejects stale writes from another process with 503. Storage failures also return 503 instead of pretending the user has an invalid JWT. Multipart handlers explicitly re-enter their request context.

The normalized 405 migration records remain immutable migration projections in this integration: runtime changes are stored in canonical documents, not synchronized into those normalized tables. Do not use the projections as a current runtime/reporting store. A future normalized-write design needs its own transaction and relationship tests before it can replace this compatibility path.

Permanent Library uploads use private `documents` or `images`; profile uploads additionally use private `profile-images` while retaining the existing embedded data URI in API responses for offline compatibility. Internal Library object locations are stored separately from the public file record. Downloads preserve the authenticated Express endpoint, filename-derived MIME type and byte ranges. Existing migrated binary locations are supported. AI and Circle note-import uploads remain temporary extraction inputs, matching existing behavior; they do not create new persistent attachment/Circle-file records. `attachments` and `circle-files` remain private reserved buckets.

The combined `libraryIds` generation path validates every file's ownership. The existing combined-chat branch previously returned an object without sending a response; it now continues through normal chat generation/persistence instead of hanging.

Local checks: `npm.cmd test` in `backend`. These tests clear remote credentials and use temporary synthetic fixtures and a mocked Supabase transport. The manual `storage/verify-test-project.cjs` runner is separate from `npm test`; it reads only the previously configured private test environment and CA outside Git. It validates the existing 405/7 baseline, applies only the runtime RPC, writes seven documents under a unique `synthetic_parity_*` namespace, exercises synthetic API operations, deletes only that namespace's objects/documents, then compares every original table/document fingerprint and all archive bytes. It never reads either backup. Real AI/email delivery is deliberately stubbed, with no provider credentials.

For a separately approved test run from the repository root in PowerShell:

```powershell
$env:NODE_OPTIONS = '--use-system-ca'
node .\backend\storage\verify-test-project.cjs
```

Private values stay in `%USERPROFILE%\STUDYante-private-config\supabase-test.env` and the corresponding CA file. `STORAGE_NAMESPACE` is a test isolation option restricted to `synthetic_*`; it is not a cutover setting. The runner sets it only in memory. Leave the private environment's existing file-default configuration intact unless a later task explicitly authorizes a local switch.

Remaining verification work: real AI/image/email provider delivery, full browser/device offline synchronization, every individual route permutation, load testing and multi-instance behavior. Canonical snapshots serialize long AI requests and fetch all seven documents, so throughput must be evaluated before cutover. Storage upload, DB commit and object deletion are separate provider operations: a timeout or failed deletion can leave an orphan or an uncertain commit; no automatic rollback or overwrite is attempted. Replaced/removed profile images can leave private objects requiring a separately scoped cleanup process. No production readiness or cutover approval is implied.
