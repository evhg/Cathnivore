# Progress

Short by design (SPEC 16: under 150 lines). v1's full history (M0 to M7, every session's notes and the full deploy log) is in `docs/archive/PROGRESS-v1.md`; search it with grep and never read it in full.

## Now
- **Mode:** continuous improvement, indefinitely (SPEC 16, `VISION.md`). Work from `FEEDBACK.md`, then anything broken, then `ROADMAP.md`, top down.
- **Current ROADMAP item:** 1, "Cath's new look: the master art". Started by the owner's chat session on 2026-09-28: `shared/cath/cath.ts` renders Cath (framings face, bust and half; five expressions; field and market outfits). Next, wire her into Portrait.tsx, the title screen, the landing page and Runnel, then continue with ROADMAP 2-5.
- **Next step:** see the **Session log** for where the last session stopped.

## Blocked
- **iPhone App Store launch: postponed by the owner** until the games are truly impressive (ROADMAP "Postponed"). Once reopened, it still needs the owner's Apple secrets (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`) and the real Team ID in `OWNER.md`.
- **Git tag pushes fail with HTTP 403** from session credentials. Dispatch `ios.yml`/`store.yml` by `workflow_dispatch` instead. `deploy-<n>` tags stay local; this file's release list is the record.
- **The live browser smoke test can't run in this sandbox** (`ERR_CERT_AUTHORITY_INVALID` from the proxy). `npm run release` falls back to an HTTP check and reverts only on a real failure (see CLAUDE.md).

## Known issues (small, from v1's last reviews)
- [ ] `sim/run.ts`'s worker pool has no per-worker wall-clock timeout (dev tooling only).
- [ ] `site/src/scene.ts` never calls `gl.deleteShader` after linking (minor).
- [ ] `site/src/scene.ts` has no `webglcontextrestored` handler: after a GPU reset the landing animation stays stopped until reload.

## Recent releases (newest first, last 10)
- 2026-09-28: title screen redesign, Campaign journey screen, continuous-improvement docs (owner's chat session).
- 2026-09-28 ~05:02 UTC and earlier: v1 hardening releases; see `docs/archive/PROGRESS-v1.md`'s deploy log.

## Session log (newest first, last 15)
- 2026-09-28 (owner's chat session): switched the routine to indefinite improvement (SPEC 16, VISION, ROADMAP, FEEDBACK); archived v1's notes; shipped the title screen and Campaign screen redesigns; the owner then set a new plan (Cath redesigned as a classy, cute, stylish mum and the star of every game; App Store launch postponed), and Cath's master art was started in `shared/cath/`.
