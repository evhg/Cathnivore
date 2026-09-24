# Decisions log

Format: date, decision, reason.

- 2026-09-24: Created `build` branch from `main` (it didn't exist yet). Reason: SPEC rule 1.9.1 / CLAUDE.md step 1.
- 2026-09-24: Set `DEADLINE` to 2026-10-01T13:54:11Z (now + 7 days). Reason: SPEC rule 1.10, first session.
- 2026-09-24: Scaffolding with Vite + React + TypeScript (strict), plain CSS custom properties per STYLE.md, no UI framework. Reason: SPEC 11.1.
- 2026-09-24: Using `vitest` for unit tests, `fast-check` for property tests, `@playwright/test` for e2e, per SPEC 11.1.
- 2026-09-24: `store.yml` uses fastlane `deliver` (via `fastlane run deliver`, no Fastfile required yet) to upload store metadata/screenshots and submit for review. Reason: SPEC 11.6 allows fastlane deliver or a small API script; fastlane is the more battle-tested option for App Store Connect uploads. `store/metadata` and `store/screenshots` will be created in M6.
- 2026-09-24: `ios.yml`'s ci-status report doesn't yet attach real failure logs (SPEC asks for the last 150 lines on failure) — it writes a placeholder string. Fetching a workflow's own run logs needs a GitHub API call with a token; deferred until iOS builds are actually exercised (after M5).
- 2026-09-24: The `ci-status` branch and its `status/<workflow>.json` files are created and force-pushed only by the GitHub Actions workflows themselves (using the runner's own `GITHUB_TOKEN`), never by a build session. Reason: CLAUDE.md/SPEC 1.4 forbid sessions from pushing to `ci-status`; a session attempting to create the branch was correctly blocked by the permission classifier ("Modify Shared Resources").
