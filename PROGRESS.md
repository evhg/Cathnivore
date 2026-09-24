# Progress

## Current milestone
M1 Engine (day 1)

## Tasks

### M0 Setup (hours 0-4)
- [x] repo, tooling, npm scripts, the `build` branch, the lock, `DEADLINE` and `PROGRESS.md`
- [x] `vercel.json`, `version.json` and the holding page released to `main`
- [x] `ci.yml`, `ios.yml` and `store.yml` committed
- [x] Capacitor iOS shell wrapping the holding page (`ios/App`, `capacitor.config.ts`)
- [ ] push `ios-1` to prove that signing and upload to TestFlight work end to end (tag push blocked, see Blocked below; triggered `ios.yml` via `workflow_dispatch` on `build` instead — the shell built and archived correctly, but signing itself is blocked on Apple secrets not yet being set, see Blocked)

### M1 Engine (day 1)
- [x] `src/engine` core: `rng.ts` (mulberry32, pure/seeded), `types.ts`, `region.ts`, `pieces.ts` (enemy piece pools), `state.ts` (`createGame`), `enemy.ts` (Squeeze/Expand/Scout/Advance), `round.ts` (turn order, Harvest, Cleanup, win/loss), `actions.ts` (`legalActions`/`applyAction`)
- [x] `src/content`: `map.ts` (7 regions + adjacency), `producers.ts` (all 4), `pressure.ts` (10 cards, 3 stages)
- [x] Actions implemented: Open Stall, Supply (Outlets/Buyout), Rebut, Sell, Graft, Role (Ines/Sol done; Mara's Injunction and Tomas's Market Day are no-op placeholders pending a target-picker in `currentDecision`)
- [ ] Invest and Scheme actions (blocked on Improvements/Schemes content below)
- [x] Agenda deck: 8 Hollowell + 8 Candor cards (`src/content/agenda.ts`, the 4 exact cards from SPEC 4.7 plus 4 more per faction), shuffled at setup, resolved first each enemy turn (`resolveAgenda` in `enemy.ts`)
- [x] Rift 3 "Cracks" (Agenda bonus effects skipped when Rift >= 3) — the check exists and is tested via `validate()`'s agenda-deck accounting, but nothing raises Rift yet (that's Schemes/Improvements, not built), so it can't be exercised end-to-end until then
- [ ] Rift 6 "The Split" (needs a `currentDecision`-style choice for which faction/pieces; not built)
- [ ] Kingsmarket-liberation production choice, and the home-region Squeeze production-loss choice, are auto-picked by a default instead of going through `currentDecision` (not yet built)
- [ ] starter content: 24 Improvements, 18 Schemes (Agenda done, see above)
- [x] `validate()`, `serialize`/`deserialize`, `replay()`, `isOver()`/`result()` in `src/engine/api.ts`, with round-trip/determinism/invariant tests
- [ ] `currentDecision()` (forced choices — Squeeze's home-production-loss pick, Rift 6's faction split — aren't wired up as decisions yet, see above)
- [x] Unit tests: RNG determinism, `createGame` setup invariants, several actions, illegal-action rejection, no-mutation
- [x] A 40-seed random-play smoke test plays full games start to finish, calling `validate()` after every step, with no crash or invariant failure, and confirms determinism by replay (stands in for the real fuzz gate until `npm run fuzz`/`sim/fuzz.ts` exist). Caught and fixed two real bugs this session: an Agenda card effect that bypassed the outlet-pool bookkeeping, and a `validate()` check that was itself wrong (see DECISIONS.md).
- [ ] `sim/fuzz.ts` (the actual `npm run fuzz` / fuzz gate: 10,000 RandomBot + 1,000 HeuristicBot games with `validate()` after every step)

### M2 Bots and simulation (first half of day 2)
- [ ] RandomBot, HeuristicBot and MCTSBot
- [ ] the simulation harness and the first balance report

### M3 Playable game (second half of day 2 to day 3)
- [ ] the game screen on phone and desktop, and the setup screen
- [ ] Solo and Hot-seat modes, saves and undo
- [ ] enemy turn playback and the rules reference
- [ ] Release to `main`

### M4 Full content and balance (day 4)
- [ ] full card counts and difficulty levels
- [ ] the balance loop run to the targets
- [ ] Release

### M5 Campaign (day 5 to first half of day 6)
- [ ] the scenario system, portraits, scenes and tutorial prompts
- [ ] chapters 1 to 6, with their twists and carry-over
- [ ] Release after chapters 1 to 3, and again after chapters 4 to 6
- [ ] push `ios-<n>` for the first full iPhone build (up to 3 fix builds)

### M6 Polish and store assets (second half of day 6)
- [ ] animations, fixes from the visual review, accessibility and performance
- [ ] web install and offline play; icons, launch screen and haptics
- [ ] the privacy and support pages, store text and screenshots
- [ ] Release, push `ios-<n>`, then push `store-<n>`

### M7 Hardening (final 18 hours; no new features)
- [ ] long fuzz run of 50,000 RandomBot games, full e2e suite on both sizes, final balance report
- [ ] README covering how to play, how to run it locally and how it was built
- [ ] final release and live smoke test, then the final `ios-<n>` build
- [ ] push `submit-<n>` to send that build for App Review
- [ ] final report in `PROGRESS.md`
- [ ] create `DONE`

## Blocked
- **`ios-1` signing check (day-1 gate, SPEC M0 / 11.6):** `ios.yml` was manually dispatched on `build` (commit `b99e197`) since tag pushes are blocked (see below). `npm run build`, `npx cap sync ios` and the `xcodebuild archive` invocation itself all ran; it failed fast (1s) with `xcodebuild: error: The flag -authenticationKeyID is required when specifying -authenticationKeyPath.` even though `-authenticationKeyID "${{ secrets.ASC_KEY_ID }}"` is present in the command — the most likely cause is that `ASC_KEY_ID` (and probably `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`) are not yet set as GitHub Actions secrets, so the flag's value is empty and xcodebuild reads it as missing. `OWNER.md`'s Apple Team ID is still the placeholder `PASTE-TEAM-ID`, consistent with Apple Developer setup not being done yet (SPEC 11.6 lists this as owner setup, outside session capability: no Apple credentials are available to sessions). The Capacitor iOS shell itself (`ios/App`) is sound — this is purely a missing-secrets issue. Re-dispatch `ios.yml` next session to check whether secrets have appeared; until then this is not fixable from a session. Per SPEC 11.4 gate 9 / cut rule 7, proceed with web-version work (M1+) in the meantime.
- Pushing any git tag (`deploy-1`, `ios-1`) fails with `HTTP 403` (RPC failed) from this session's GitHub credentials; `main` and `build` branch pushes work fine. No MCP GitHub tool creates a tag ref either (`create_branch` only creates `refs/heads/*`). Confirmed again on `ios-1` after 3 retries with backoff. Workaround in place (see `DECISIONS.md`): dispatch the workflow directly via `mcp__github__actions_run_trigger` (`run_workflow`, ref `build`) instead of pushing a tag, since `ios.yml`/`store.yml` both also listen for `workflow_dispatch`. `release`'s `deploy-<n>` tag has no such trigger use (it's just a marker), so that one stays untagged; rely on the deploy log plus commit SHAs.

## Deploy log
- `bf1e42c` (holding page, M0 scaffold) — released to `main` 2026-09-24 ~14:00 UTC. Live smoke test passed (`https://cathnivore.com` returned 200, `/version.json` showed the new commit immediately). Tag `deploy-1` created locally but could not be pushed (see Blocked).

## Final report
(not yet written)
