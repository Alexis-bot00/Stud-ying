# Phase 5 frontend fixes and verification

Completed locally on migration/supabase-render-test. HEAD remains 0145989; main and origin/main remain e3d7319. No commit, push, deployment, APK or Railway change.

## Changes

The Library displays cached material cards alongside its offline notice, preserving the existing layout and saved notes, flashcards, tests and games. User and Library caches use studyante:<encoded authenticated user ID>:user/library envelopes, validated against the active account. Offline account bootstrap requires an exact match to the previously authenticated token/session binding; mismatched or corrupt sessions fail closed. An online 401/403 cannot fall back to an offline identity. Offline cached profiles do not grant admin privileges.

Legacy studyanteOfflineUser and studyanteOfflineLibrary entries are removed without reading or assigning them to an account. Their ownership cannot be established safely. Existing accounts may need one online sign-in and Library visit to rebuild their scoped caches after upgrade.

Logout clears scoped profile/Library data, the session binding, native auth token, current-account Circle jacket caches and guest planner state. Writes are serialized with logout and late cache writes are rejected. Account-specific planner data remains under its existing cappy-planner:<user ID> key to preserve unsynced tasks/classes/budget/grades; it is unavailable through the signed-out or other-account UI. The planner hook now hides the previous account state immediately when its key changes. Circle jacket keys already include user and Circle IDs. Device-only theme and onboarding flags remain shared; they contain no account records.

All 39 useful source backup files were moved from STUDYante-App/src/app to migration-audit/frontend-source-backups. Each move was verified with before/after SHA-256 checksums; no backup bytes were changed or deleted. These are local source backups, separate from both private Railway backup copies.

Existing browser specs now use a network guard that blocks unmocked external requests. Two stale tests were updated to use the current Circle availability message and Back to shared games navigation. The isolated browser config serves only the Render-configured export. Mocked AI/email UI regression tests do not call providers.

## Verification

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Complete local backend suite, file and mocked Supabase modes | 34 | 0 | 0 |
| Planner and account-cache unit tests | 10 | 0 | 0 |
| Complete existing browser suite, mocked synthetic APIs | 46 | 0 | 0 |
| Extended hosted/browser Phase 5 features | 19 | 0 | 4 |

TypeScript: node STUDYante-App/node_modules/typescript/bin/tsc --noEmit -p STUDYante-App/tsconfig.json passed. Expo web export: node migration-audit/build-render-frontend.cjs passed; exactly three static routes: /, /_sitemap and /+not-found. No source backup routes were exported.

Existing browser command: EXPO_PUBLIC_API_URL=https://studyante-backend-test.onrender.com with node STUDYante-App/node_modules/@playwright/test/cli.js test --config=migration-audit/phase5-existing-browser.config.cjs --reporter=line. Final run: 46 passed. Initial run had two stale test failures and one skipped URL assertion; corrected test navigation/message and explicitly supplied the test URL before the complete successful rerun.

Hosted checks used only https://studyante-backend-test.onrender.com and synthetic_render_test. There were 34 API requests and 58 explicit assertions, plus browser assertions. Online registration/login/Library/folders/uploads/materials remained working. Browser offline mode verified cached uploaded-item visibility, saved notes, flashcards, tests, games and local planner tasks. Restart was simulated using a new browser context with the same local storage and unavailable Render requests while serving the application shell locally. Logout/account switching checked sensitive-cache removal, legacy-cache disposal and absence of the prior account Library/planner content.

| Hosted feature | Result |
| --- | --- |
| Registration â€” browser | passed |
| Login â€” browser | passed |
| Folders â€” browser | passed |
| Uploads and private downloads â€” hosted API | passed |
| Library â€” browser and hosted API | passed |
| Notes â€” persistence and browser | passed |
| Tests â€” persistence and browser | passed |
| Games â€” persistence and browser | passed |
| Flashcards â€” persistence and browser | passed |
| Multiple-file sources â€” ownership validation | passed |
| Multiple-file AI generation / new AI replies | skipped |
| AI history â€” synthetic stored history | passed |
| Community â€” synthetic browsing and submission permissions | passed |
| Friends â€” consent and chat | passed |
| Circles â€” membership, materials, chat and Cappy settings | passed |
| Cappy â€” browser interaction and local planner | passed |
| Offline â€” cached Library and local planner persistence | passed |
| Offline saved notes, flashcards, tests and games | passed |
| Offline account restart with cached application shell | passed |
| Logout, legacy-cache disposal and account switching isolation | passed |
| Community admin moderation | skipped |
| Password-email delivery and reset | skipped |
| Native Android/device offline and cold offline web launch | skipped |

## Integrity and cleanup

The before/after table counts and record fingerprints, all Storage metadata, seven archive byte checksums and Supabase Auth count match. All 405 migrated normalized records, seven canonical source documents and seven archived files remain unchanged. Synthetic namespace cleanup: 0 documents and 0 Storage objects remaining. Browser contexts and local test servers were closed. Zero browser requests reached production. Neither private backup copy was accessed.

## Exact changed files

Modified existing local files:
- STUDYante-App/src/app/index.tsx
- STUDYante-App/src/components/cappy.tsx
- STUDYante-App/tests/browser/cappy.spec.ts
- STUDYante-App/tests/browser/circle.spec.ts
- migration-audit/phase5-feature-check.cjs
- migration-audit/PHASE-5-RESULT.json

New files:
- STUDYante-App/src/components/account-cache.ts
- STUDYante-App/tests/account-cache.test.mjs
- STUDYante-App/tests/browser/render-fixture.ts
- migration-audit/serve-render-frontend.cjs
- migration-audit/phase5-existing-browser.config.cjs
- migration-audit/PHASE-5-BACKUP-MOVES.json
- migration-audit/PHASE-5-FRONTEND-FIXES.md

Moved source files (all checksum-verified):

| Original | Preserved destination |
| --- | --- |
| STUDYante-App/src/app/index.before-account-settings.tsx | migration-audit/frontend-source-backups/index.before-account-settings.tsx |
| STUDYante-App/src/app/index.before-ai-attachments-final.tsx | migration-audit/frontend-source-backups/index.before-ai-attachments-final.tsx |
| STUDYante-App/src/app/index.before-ai-attachments.tsx | migration-audit/frontend-source-backups/index.before-ai-attachments.tsx |
| STUDYante-App/src/app/index.before-ai-file-camera.tsx | migration-audit/frontend-source-backups/index.before-ai-file-camera.tsx |
| STUDYante-App/src/app/index.before-ai-images.tsx | migration-audit/frontend-source-backups/index.before-ai-images.tsx |
| STUDYante-App/src/app/index.before-ai-menu-position.tsx | migration-audit/frontend-source-backups/index.before-ai-menu-position.tsx |
| STUDYante-App/src/app/index.before-ai-plus-menu.tsx | migration-audit/frontend-source-backups/index.before-ai-plus-menu.tsx |
| STUDYante-App/src/app/index.before-applause.tsx.txt | migration-audit/frontend-source-backups/index.before-applause.tsx.txt |
| STUDYante-App/src/app/index.before-button-fix.tsx | migration-audit/frontend-source-backups/index.before-button-fix.tsx |
| STUDYante-App/src/app/index.before-card-layout.txt | migration-audit/frontend-source-backups/index.before-card-layout.txt |
| STUDYante-App/src/app/index.before-community-button-width.txt | migration-audit/frontend-source-backups/index.before-community-button-width.txt |
| STUDYante-App/src/app/index.before-community-controls.txt | migration-audit/frontend-source-backups/index.before-community-controls.txt |
| STUDYante-App/src/app/index.before-community-popup.tsx | migration-audit/frontend-source-backups/index.before-community-popup.tsx |
| STUDYante-App/src/app/index.before-community-reader.txt | migration-audit/frontend-source-backups/index.before-community-reader.txt |
| STUDYante-App/src/app/index.before-community-swipe.txt | migration-audit/frontend-source-backups/index.before-community-swipe.txt |
| STUDYante-App/src/app/index.before-correct-answer-voice.tsx.txt | migration-audit/frontend-source-backups/index.before-correct-answer-voice.tsx.txt |
| STUDYante-App/src/app/index.before-easier-swipe.txt | migration-audit/frontend-source-backups/index.before-easier-swipe.txt |
| STUDYante-App/src/app/index.before-folder-button-fix.tsx | migration-audit/frontend-source-backups/index.before-folder-button-fix.tsx |
| STUDYante-App/src/app/index.before-four-navigation.tsx.bak | migration-audit/frontend-source-backups/index.before-four-navigation.tsx.bak |
| STUDYante-App/src/app/index.before-four-tabs.tsx.bak | migration-audit/frontend-source-backups/index.before-four-tabs.tsx.bak |
| STUDYante-App/src/app/index.before-header-fix.tsx.bak | migration-audit/frontend-source-backups/index.before-header-fix.tsx.bak |
| STUDYante-App/src/app/index.before-library-button-fix.tsx | migration-audit/frontend-source-backups/index.before-library-button-fix.tsx |
| STUDYante-App/src/app/index.before-library-folders.tsx | migration-audit/frontend-source-backups/index.before-library-folders.tsx |
| STUDYante-App/src/app/index.before-library-swipe.txt | migration-audit/frontend-source-backups/index.before-library-swipe.txt |
| STUDYante-App/src/app/index.before-logo-left.tsx.bak | migration-audit/frontend-source-backups/index.before-logo-left.tsx.bak |
| STUDYante-App/src/app/index.before-remove-a.tsx.bak | migration-audit/frontend-source-backups/index.before-remove-a.tsx.bak |
| STUDYante-App/src/app/index.before-settings-layout.tsx | migration-audit/frontend-source-backups/index.before-settings-layout.tsx |
| STUDYante-App/src/app/index.before-theme-and-picture.tsx | migration-audit/frontend-source-backups/index.before-theme-and-picture.tsx |
| STUDYante-App/src/app/index.before-website-swipe.txt | migration-audit/frontend-source-backups/index.before-website-swipe.txt |
| STUDYante-App/src/app/index.tsx.bak | migration-audit/frontend-source-backups/index.tsx.bak |
| STUDYante-App/src/app/index.tsx.before-folder-plus | migration-audit/frontend-source-backups/index.tsx.before-folder-plus |
| STUDYante-App/src/app/index.tsx.before-manual-creator | migration-audit/frontend-source-backups/index.tsx.before-manual-creator |
| STUDYante-App/src/app/index.tsx.before-move-buttons | migration-audit/frontend-source-backups/index.tsx.before-move-buttons |
| STUDYante-App/src/app/index.tsx.before-move-function | migration-audit/frontend-source-backups/index.tsx.before-move-function |
| STUDYante-App/src/app/index.tsx.before-move-panel | migration-audit/frontend-source-backups/index.tsx.before-move-panel |
| STUDYante-App/src/app/index.tsx.before-remove-library-buttons | migration-audit/frontend-source-backups/index.tsx.before-remove-library-buttons |
| STUDYante-App/src/app/index.tsx.folder-backup | migration-audit/frontend-source-backups/index.tsx.folder-backup |
| STUDYante-App/src/app/index.tsx.multiple-files.bak | migration-audit/frontend-source-backups/index.tsx.multiple-files.bak |
| STUDYante-App/src/app/index.tsx.theme-backup | migration-audit/frontend-source-backups/index.tsx.theme-backup |

Generated local artifacts: STUDYante-App/dist/render-phase5/ (ignored web export), STUDYante-App/test-results/phase5-existing/ (mock test artifacts), and ignored Expo-generated route types/cache. The separate frontend-render-test.json and build-render-frontend.cjs configurations remain Render-only; their source did not change in this fix step. Production URL literals/configuration were preserved. Unrelated dirty files were not staged or rewritten.

## Remaining limits

- Browser offline simulation passed; physical Android airplane mode, installed-app restart and native file sharing/download cleanup require device testing later. No APK was built.
- Cold offline web launch remains unverified because the static export does not establish a service-worker shell cache. The restart check assumes an available bundled/cached application shell.
- Live AI replies/multiple-file generation and password-email delivery/reset remain skipped until separately approved credentials are configured.
- Actual Community administrator moderation remains skipped because ADMIN_EMAILS is not configured. Student submission/browsing/permission checks use synthetic fixtures.
- Local account cache isolation is not at-rest encryption against someone with direct device-storage access. Offline server revocation cannot be checked until connectivity returns.

This report supersedes the earlier Phase 5 offline-failure summary. Stop here; no deployment or commit is authorized.

## Approved commit scope and exact staged files

The user approved directly required frontend prerequisites. Backup contents, private configuration, generated results/exports, Android configuration and unrelated dirty work are excluded. The unused direct punycode dependency was omitted from the staged package files; required transitive dependencies remain locked. Working package files retain unrelated changes.

Every new asset below has a literal source require reference. Every prerequisite component below is reached through included local imports.

| Staged file | Why included |
| --- | --- |
| STUDYante-App/assets/images/cappy-cute.png | Referenced by STUDYante-App/src/components/cappy-mascot.tsx |
| STUDYante-App/assets/images/cappy-dance.png | Referenced by STUDYante-App/src/components/cappy-mascot.tsx, STUDYante-App/src/components/cappy-mascot.tsx |
| STUDYante-App/assets/images/cappy-mascot.png | Referenced by STUDYante-App/src/components/cappy-mascot.tsx |
| STUDYante-App/assets/images/cappy-read.png | Referenced by STUDYante-App/src/components/cappy-mascot.tsx, STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/cappy-sad.png | Referenced by STUDYante-App/src/components/cappy-mascot.tsx |
| STUDYante-App/assets/images/cappy-sleep.png | Referenced by STUDYante-App/src/components/cappy-mascot.tsx, STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-black-read.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-black-sleep.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-green-read.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-green-sleep.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-orange-read.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-orange-sleep.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-pink-read.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-pink-sleep.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-red-read.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-red-sleep.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-yellow-read.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/circle-yellow-sleep.png | Referenced by STUDYante-App/src/components/circle-capybara.tsx |
| STUDYante-App/assets/images/studyante-splash.png | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/assets/sounds/quiz-applause.wav | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/assets/sounds/quiz-background.wav | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/assets/sounds/quiz-tick.wav | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/assets/sounds/quiz-win.wav | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/assets/sounds/quiz-wrong.wav | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/package-lock.json | Reproducible lockfile for required dependencies |
| STUDYante-App/package.json | Runtime Expo/RN dependencies and Playwright regression tooling |
| STUDYante-App/src/app/index.tsx | Phase 5 integration or synthetic verification harness |
| STUDYante-App/src/components/account-cache.ts | Referenced by STUDYante-App/src/app/index.tsx, STUDYante-App/tests/account-cache.test.mjs |
| STUDYante-App/src/components/cappy-mascot.tsx | Referenced by STUDYante-App/src/components/cappy.tsx, STUDYante-App/src/components/cappy.tsx, STUDYante-App/src/components/study-circles.tsx, STUDYante-App/src/components/studyante-home.tsx |
| STUDYante-App/src/components/cappy-model.ts | Referenced by STUDYante-App/src/components/cappy-notifications.ts, STUDYante-App/src/components/cappy.tsx, STUDYante-App/src/components/schedule-scan.tsx, STUDYante-App/src/components/school-calendar.tsx, STUDYante-App/src/components/studyante-home.tsx, STUDYante-App/tests/planner.test.mjs |
| STUDYante-App/src/components/cappy-notifications.ts | Referenced by STUDYante-App/src/app/index.tsx, STUDYante-App/src/components/cappy.tsx, STUDYante-App/src/components/schedule-scan.tsx |
| STUDYante-App/src/components/cappy.tsx | Referenced by STUDYante-App/src/app/index.tsx, STUDYante-App/src/components/password-recovery.tsx, STUDYante-App/src/components/schedule-scan.tsx, STUDYante-App/src/components/school-calendar.tsx, STUDYante-App/src/components/school-calendar.tsx, STUDYante-App/src/components/study-circles.tsx, STUDYante-App/src/components/studyante-home.tsx |
| STUDYante-App/src/components/circle-capybara.tsx | Referenced by STUDYante-App/src/components/circle-room-scene.tsx, STUDYante-App/src/components/study-circles.tsx |
| STUDYante-App/src/components/circle-form.tsx | Referenced by STUDYante-App/src/components/study-circles.tsx |
| STUDYante-App/src/components/circle-materials.tsx | Referenced by STUDYante-App/src/components/study-circles.tsx |
| STUDYante-App/src/components/circle-note-reader.tsx | Referenced by STUDYante-App/src/components/circle-materials.tsx |
| STUDYante-App/src/components/circle-room-scene.tsx | Referenced by STUDYante-App/src/components/study-circles.tsx |
| STUDYante-App/src/components/class-time.tsx | Referenced by STUDYante-App/src/components/cappy.tsx, STUDYante-App/src/components/schedule-scan.tsx, STUDYante-App/src/components/studyante-home.tsx |
| STUDYante-App/src/components/password-recovery.tsx | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/src/components/schedule-scan.tsx | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/src/components/school-calendar.tsx | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/src/components/study-circles.tsx | Referenced by STUDYante-App/src/components/cappy.tsx |
| STUDYante-App/src/components/studyante-home.tsx | Referenced by STUDYante-App/src/app/index.tsx |
| STUDYante-App/tests/account-cache.test.mjs | Synthetic regression test/fixture |
| STUDYante-App/tests/browser/cappy.spec.ts | Synthetic regression test/fixture |
| STUDYante-App/tests/browser/circle.spec.ts | Synthetic regression test/fixture |
| STUDYante-App/tests/browser/render-fixture.ts | Referenced by STUDYante-App/tests/browser/cappy.spec.ts, STUDYante-App/tests/browser/circle.spec.ts |
| STUDYante-App/tests/planner.test.mjs | Synthetic regression test/fixture |
| migration-audit/PHASE-5-BACKUP-MOVES.json | Reviewed Phase 5 report or source-move metadata; no backup contents |
| migration-audit/PHASE-5-FRONTEND-FIXES.md | Reviewed Phase 5 report or source-move metadata; no backup contents |
| migration-audit/build-render-frontend.cjs | Isolated Render test export/browser harness |
| migration-audit/frontend-render-test.json | Referenced by migration-audit/build-render-frontend.cjs, migration-audit/phase5-feature-check.cjs |
| migration-audit/phase5-existing-browser.config.cjs | Isolated Render test export/browser harness |
| migration-audit/phase5-feature-check.cjs | Phase 5 integration or synthetic verification harness |
| migration-audit/serve-render-frontend.cjs | Isolated Render test export/browser harness |

The production API URL fallback is preserved. The separate test export configuration points only to Render. Verification uses a clean archive of the Git index. A test-branch-only commit/push is permitted only after that exact staged application passes secret scanning, TypeScript, Expo export, backend tests, cache/planner tests and the applicable browser suite.
