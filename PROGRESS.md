# Progress

## Current milestone
M0 Setup (hours 0-4)

## Tasks

### M0 Setup (hours 0-4)
- [x] repo, tooling, npm scripts, the `build` branch, the lock, `DEADLINE` and `PROGRESS.md`
- [ ] `vercel.json`, `version.json` and the holding page released to `main` (vercel.json + version.json done; release pending)
- [x] `ci.yml`, `ios.yml` and `store.yml` committed (Capacitor iOS shell not yet built)
- [ ] push `ios-1` to prove that signing and upload to TestFlight work end to end (blocked on Capacitor iOS shell)

### M1 Engine (day 1)
- [ ] full rules of section 4 with starter content: 4 producers, 24 Improvements, 18 Schemes, 8 Hollowell and 8 Candor Agenda cards, and 10 Pressure cards
- [ ] unit tests and the fuzz gate

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
(none yet)

## Deploy log
(none yet)

## Final report
(not yet written)
