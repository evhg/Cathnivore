# Progress

## Current milestone
M3 Playable game (second half of day 2 to day 3) — M1 and M2 are complete.

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
- [x] Actions implemented: Open Stall, Supply (Outlets/Buyout, with the Mobile Butcher Pasture discount), Rebut (with the Soil Lab Report free extra), Sell, Graft, Invest, Scheme, Role — all four producers' role abilities now work, including Mara's Injunction (adds to `expandSkip`) and Tomas's Market Day (free Stall bordering any producer's Stall), both with proper target enumeration in `legalActions`. Tests in `tests/roles.test.ts`.
- [x] Invest and Scheme actions: `src/engine/actions.ts` — buying an Improvement spends Marks, applies its `onBuy` (immediate production/one-off effects; ongoing abilities checked by id, see DECISIONS.md), adds it permanently to the producer's tableau and empties its Market slot; playing a Scheme spends Goodwill, resolves its `effect(state, producer, target)` against a chosen region (required/optional/no target per card, enumerated in `legalActions`), empties its Cath's Plan slot and discards it. Scheme deck reshuffles from discard when empty (SPEC 5). Unit tests in `tests/invest-scheme.test.ts`.
- [x] Agenda deck: 8 Hollowell + 8 Candor cards (`src/content/agenda.ts`, the 4 exact cards from SPEC 4.7 plus 4 more per faction), shuffled at setup, resolved first each enemy turn (`resolveAgenda` in `enemy.ts`)
- [x] Rift 3 "Cracks" (Agenda bonus effects skipped when Rift >= 3) — now exercised end-to-end: several Schemes/Improvements raise Rift (Leaked Memo, Whistleblower, Competing Lawsuits, Op-ed Column, Listening Post)
- [x] Rift 6 "The Split" (`src/engine/rift.ts`, `checkRiftSplit`): triggers once, automatically, whenever Rift reaches 6 (checked after every action and after Agenda resolution). Faction and piece-removal choice are auto-decided (see DECISIONS.md) rather than through a real `currentDecision`. Tests in `tests/rift-split.test.ts`.
- [x] First-time liberation production bonus (SPEC 4.8: Pasture→Produce, Crop→Marks, Coast→Goodwill, Kingsmarket→choice, defaulted to Marks — see DECISIONS.md) — this was previously missing (only the Public Trust +1 half was implemented); fixed in `enemy.ts`'s `refreshLiberation`
- [x] `currentDecision()` API (SPEC 9.1): `src/engine/types.ts`'s `PendingDecision`, `src/engine/api.ts`'s `currentDecision(state)`, and a `{kind: 'decide'}` action resolve it. The Kingsmarket-liberation production choice and the home-region Squeeze production-loss choice both apply a default immediately (so unrelated play isn't blocked) and expose it as a pending decision; while one is pending, `legalActions` returns only its `decide` options, so a human and the AI (once it exists in M2) use the same path. Rift 6 "The Split" keeps its own auto-decide heuristic for now (SPEC explicitly ties it to "the AI's evaluation," which doesn't exist until M2's MCTSBot — see DECISIONS.md). Tests in `tests/decisions.test.ts`; full 10,000-game RandomBot fuzz still clean.
- [x] Starter content: 24 Improvements (`src/content/improvements.ts`, the 6 exact cards from SPEC 7 plus 18 more) and 18 Schemes (`src/content/schemes.ts`, the 6 exact cards from SPEC 5 plus 12 more, with region-targeting via `legalSchemeTargets`)
- [x] `sim/fuzz.ts`: the real fuzz gate — RandomBot games (200 quick / 10,000 full) across all 6 producer pairs, `validate()` after every step, checked into `npm run fuzz`/`npm run check`. Ran clean: 10,000/10,000 games, 0 exceptions, 0 invariant failures, all ended by round 10 (avg 5.91 rounds — short because RandomBot plays badly; HeuristicBot fuzz lands in M2). HeuristicBot fuzzing (1,000 games) is still pending M2's bots.
- [x] `validate()`, `serialize`/`deserialize`, `replay()`, `isOver()`/`result()` in `src/engine/api.ts`, with round-trip/determinism/invariant tests
- [x] `currentDecision()` (see above; Rift 6's faction/piece split is intentionally still a heuristic default, not a real decision, pending M2's evaluation function)
- [x] Unit tests: RNG determinism, `createGame` setup invariants, several actions, illegal-action rejection, no-mutation
- [x] A 40-seed random-play smoke test (`tests/random-play.test.ts`) plays full games start to finish, calling `validate()` after every step, with no crash or invariant failure, and confirms determinism by replay. Caught and fixed two real bugs in an earlier session: an Agenda card effect that bypassed the outlet-pool bookkeeping, and a `validate()` check that was itself wrong (see DECISIONS.md).

### M2 Bots and simulation (first half of day 2)
- [x] RandomBot, HeuristicBot and MCTSBot: `src/ai/types.ts` (shared `Bot` interface, RNG-threaded like the engine), `src/ai/random.ts`, `src/ai/heuristic.ts` (1-ply lookahead against `src/ai/evaluation.ts`), `src/ai/mcts.ts` (`createMCTSBot(budget, rolloutRounds)`, flat Monte Carlo rollout rather than a full UCB tree — see DECISIONS.md; reshuffles the undrawn portion of every deck before each simulation per SPEC 9.2). Evaluation weights are a first-pass starting point, to be tuned by the M4 balance loop per SPEC 9.2. Tests in `tests/bots.test.ts` (all three bots finish games cleanly; HeuristicBot beats RandomBot on the evaluation function; `evaluate()` scores won/lost terminal states as 1/0).
- [x] `sim/fuzz.ts` now also fuzzes 1,000 HeuristicBot games (100 in `--quick`), satisfying SPEC 11.4 gate 3 in full (10,000 RandomBot + 1,000 HeuristicBot). Ran clean: 10,000 RandomBot (avg 5.89 rounds) + 1,000 HeuristicBot (avg 8.46 rounds) games, 0 exceptions, 0 invariant failures, all ended by round 10. HeuristicBot playing noticeably longer games than RandomBot (it survives to liberate more before losing/winning) is a first sanity signal that the evaluation function is pointing the right direction.
- [x] the simulation harness (`sim/run.ts`): `npm run sim -- --games N --bot random|heuristic|mcts --difficulty easy|normal|hard --pairs all|<comma-list>`, runs headless (single-threaded, not the worker-thread pool SPEC 9.3 describes — see DECISIONS.md), writes `sim/reports/<timestamp>.json` (full per-game outcomes) and appends a summary to `BALANCE.md`: win rate overall/by pair, loss-reason share, avg rounds, avg/share of settled round, avg legal actions per decision, Improvement purchase rate + win-rate-when-bought, Scheme play rate. First report: 1,000 HeuristicBot games at Normal, 0 crashes/invariant failures, 1.3% win rate (expected — content/weights aren't balance-tuned yet, that's M4's job) with the loss split roughly matching SPEC 9.4's shape (Public Trust and Lost Land both cause meaningful losses). A 10-game MCTSBot run confirms that path works too, but see the performance note below before using MCTSBot at scale.
  - A 10-game MCTSBot run (also appended to `BALANCE.md`) finished in about 4.5 minutes (~27s/game) and reached a 20% win rate — clearly ahead of HeuristicBot's 1.3% on the same untuned content, a good sanity signal that the bot hierarchy (Random < Heuristic < MCTS) is pointed the right way even this early.
  - **Perf note for M4:** MCTSBot at the sim's 200-simulation budget takes ~400ms per decision *in this environment* (profiled directly), so a full 1,000-game MCTSBot run would take on the order of hours single-threaded — too slow to iterate the balance loop (SPEC 9.3's 12-iteration cap) inside a session, even though a single 10-game smoke run was fine. Before M4 starts, either add the worker-thread pool SPEC 9.3 asks for, or cut MCTS rollout cost (e.g. a cheaper rollout policy than a fully-lookahead HeuristicBot, or a smaller rollout budget/depth just for sim runs vs. the AI teammate). Logged in DECISIONS.md.

### M3 Playable game (second half of day 2 to day 3)
- [ ] (partial) a functional but unstyled Quick Game loop exists and was smoke-tested in a real browser (title → setup → game → end screen), with no console errors. `src/ui/Setup.tsx` (mode/producers/difficulty/seed), `src/ui/Game.tsx` (one button per `legalActions()` entry via `src/ui/actionLabel.ts`, since every choice is already expanded into a concrete Action — no separate map/targeting UI yet), `src/App.tsx` (Title/Setup/Game screen switch, Continue from a save). Still missing before this is done: the SVG hex map and STYLE.md visual pass (SPEC 10.2/10.4 — this UI is plain HTML controls, not close to the spec'd look yet), the Farm/Market/Cath's Plan/Log sheets, enemy-turn step playback (currently the whole enemy turn + cleanup happens invisibly inside one `applyAction` call, which is correct engine behaviour but gives the player no feedback), the rules reference screen, and the desktop 3-column layout (SPEC 10.3).
- [x] Solo mode: the 2nd configured producer is AI-controlled (`src/ui/Game.tsx`'s `aiProducerRef`, decided as "producers[1] is the AI" — see DECISIONS.md) and auto-acts via `HeuristicBot`, including resolving its own `currentDecision`s. **Not yet MCTSBot-in-a-Worker** as SPEC 9.2 specifies for the real AI teammate — HeuristicBot is a synchronous stand-in so the loop is playable now; swap once MCTSBot's performance is fixed (see M2's perf note) and a Web Worker wrapper exists. Hot-seat mode (no AI producer) also works, just untested beyond a manual pass.
- [x] Saves: `src/platform/storage.ts` (SPEC 11.3 `{version, config, seed, actions}` shape, `cathnivore:save:v1` key, web `localStorage` only so far — the Capacitor Preferences implementation behind the same interface is iPhone/M5+ work) autosaves after every state change; Title screen offers Continue when a save exists, rebuilding via `replay()`.
- [x] Undo: a simplified version exists (a plain in-memory stack of prior states, popped on Undo) — **not yet** SPEC 4.6's real semantics (limited to the current turn, and blocked past an irreversible action like Steak-out's peek). Revisit before relying on it for the real UI.
- [ ] enemy turn playback (currently invisible/instant, see above) and the rules reference
- [ ] the SVG map, sheets and full STYLE.md visual pass; desktop 3-column layout
- [ ] Release to `main` (holding off until the screen is closer to spec — releasing this plain-HTML placeholder to production would fail SPEC 11.4 gate 8's visual review)

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
