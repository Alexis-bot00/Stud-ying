# Prepared Render test service — do not create or deploy yet

| Setting | Value |
| --- | --- |
| Name | studyante-backend-test |
| Type/runtime | Web Service / Node |
| Plan | Free |
| Repository | Alexis-bot00/Stud-ying |
| Branch | migration/supabase-render-test |
| Root Directory | backend |
| Build Command | npm install |
| Start Command | npm start |
| Auto-deploy | Disable during controlled testing |

Configure only through Render environment variables after separate approval. Never paste values into Git, reports or chat. Use only the already verified studyante-migration-test project. Keep all six Storage buckets private. No migration or import command belongs in the build/start/pre-deploy settings.

## Required variables

- `STORAGE_DRIVER` — supabase for this test service; the code default remains file.
- `SUPABASE_URL` — test project's HTTPS API origin, without a dashboard/API subpath.
- `SUPABASE_SERVICE_ROLE_KEY` — test project's backend-only service-role key.
- `JWT_SECRET` — a newly generated test-only secret; do not reuse the Railway production secret. Existing production JWTs will not authenticate against this test secret; bcrypt hashes remain compatible when signing in.
- `STORAGE_NAMESPACE` — use `synthetic_render_test` to isolate hosted write testing from the migrated documents. Seed this isolated namespace only in a later approved step. Until then, it starts empty; do not use unnamespaced migrated records for hosted write tests.
- `GEMINI_API_KEY` — separately configured test-provider credential for AI/image/schedule features.
- `ADMIN_EMAILS` — only synthetic test administrator addresses in the isolated test namespace.
- `RESEND_API_KEY`, `RESET_EMAIL_FROM` — HTTPS reset-email delivery with a verified test sender; exercise only approved synthetic recipients.

Recommended environment settings: `NODE_ENV=production`, `NODE_VERSION=24.21.0`.

Render supplies `PORT`; the existing server listens on it. Do not set `STUDYANTE_NO_LISTEN`. Neither `SUPABASE_DB_URL` nor a database certificate is required by the deployed REST/Storage runtime. Do not upload local private configuration, certificates, reports or backups.

The six core storage/auth/isolation names are necessary for an isolated hosted backend. Provider/admin/email names are additionally needed to test those existing features; without provider credentials those features will be unavailable.

## Limits and later checks

Render Free has an ephemeral filesystem, idles after 15 minutes and blocks outbound SMTP ports 25/465/587. Use Supabase for persistent data and the existing HTTPS email transport. Password-reset codes remain in process memory, so pending codes are lost on restart. [Render Free documentation](https://render.com/docs/free).

Pinning `NODE_VERSION` avoids runtime drift. [Render Node version documentation](https://render.com/docs/node-version).

Before any later creation approval: review the exact test branch commit, private variable configuration, namespace isolation and synthetic test plan. Subsequent hosted checks must cover startup, authenticated API behavior, private downloads, sleep/restart persistence, provider delivery and synthetic cleanup. Do not change the frontend/production API URL, Railway service, main branch or APK.

Known integration limitations remain: normalized projections do not receive runtime writes; requests fetch seven canonical documents and serialize within a process; separate Storage/DB operations may leave orphan objects after uncertain failures. These must be reviewed before any production cutover.
