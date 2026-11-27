# Gate 7: Preact for the build (lane A, 2026-11-27 00:30, not on build yet)

`git apply docs/wip/preact-gate7.patch` (then `npm install`) builds Cathnivore on preact/compat (alias in
vite.config.ts, build only; dev and vitest keep React). Entry chunk 141 -> 105 KB gzip. Lighthouse A/B on the same
machine, interleaved: React 72/71 (one run errored), Preact 83/80/80 (FCP 3.2-3.4 -> 2.9-3.0 s, TBT 500-590 -> 310-410).
The board's 73 CSS filters were measured too: dropping all of them is within noise (71/79/74 -> 76/80/78), not a lever.

The patch also has: each lazy screen in its own Suspense (`lazyScreen` in App.tsx): under Preact the root Suspense
dropped Screens' state update and no screen ever opened; Setup's producer label `onFocusCapture` (Preact's onFocus doesn't bubble).

E2E with the patch (20 specs, phone + desktop, --retries=0): 132 passed, 20 failed. To fix before it can ship:
- Autoplayed games stall mid-turn (quick-game full game and Play again, campaign.spec chapters 2-6, daily,
  crash-recovery resume, hotseat): the aria snapshot shows "Actions left: 2 of 3" and no end screen. Look at how
  `?e2eAutoplay` / the AI seat chain moves (effects keyed on state, setTimeout + setState, useSyncExternalStore).
- tutorial.spec:101 keyboard focus on the target (React's onFocus/autoFocus/focus-in-effect timing).
- card-drag.spec:144 (the stack-to-lose mark on drag-over), drawer-tabs.spec:5 (desktop), campaign-map.spec:416
  (card foot 25.7 px from the bottom against 24).
Compare each against the React build at --retries=0 before treating it as a Preact difference.

## 2026-11-27 00:51 lane A: progress
- **Fixed in the patch:** the tutorial's keyboard focus (tutorial.spec 5/5 pass). Root cause: Preact sets an SVG
  element's props with setAttribute under their own name, so `<g tabIndex={0}>` got an attribute spelt `tabIndex` and the
  board's hexes were not focusable at all (a real keyboard regression, not a test quirk). `src/preactFixes.ts` (imported
  first in main.tsx) renames `tabIndex` to `tabindex` in an `options.vnode` hook. Look for other camelCase props on SVG
  that React maps and Preact doesn't (grep the board for `<g`/`<svg` props other than tabIndex) before shipping.
- **Autoplay stall, not yet understood:** quick-game/hotseat/campaign/crash-recovery pass alone (1 worker) and fail with
  2+ workers. Instrumented (window.__dbg in the AI effect, CPU throttle 4x, 12 runs): 1 stalled, its last entry the AI
  effect having run and scheduled its setTimeout(0) for round 9, 1 action left, and the timer never firing (so a cleanup
  cleared it with no successor effect). 8 later runs with cleanup logging all finished. Next: run the stall repro with
  `clean` + `run` logging until it stalls, to see which dep changed; suspect Preact's pending-effect handling when the
  component re-renders between an effect's commit and its flush.
- Hotseat's failure under load: after the second graft the pass-device screen was up and the spec's poll then waited on
  a gone `.active-producer`; unhurried (1.5 s between clicks) the turn flow is right.
- Still failing alone at 1 worker: card-drag.spec:144 (no `−1 Outlet` aim chip on drag-over) and drawer-tabs.spec:5
  (`.is-open` present but computed translate `0px`, want `0px 1px`). Neither compared against React yet.
- **Stall caught with cleanup logging (run 5 of 6, after the notes above):** the trace ends
  `... ["clean",10,3],["run",10,2,0,false,false,false],["eff",10,2,"tomas",true]`: the effect scheduled its
  setTimeout(0) and then neither the timer (`fire` is the callback's first line) nor the cleanup (`clean`) ever ran in 37 s,
  while page.evaluate still answered. So it's not a dep change cancelling the timer. Next: check whether the Game
  component unmounted or was replaced without its hooks' cleanups (a Preact Suspense/lazyScreen remount: log a mount id),
  and whether a second Game instance is the one rendering.

## 2026-11-27 01:51 lane A: the "stall" is slowness, not a stall
- Probed at the failure (performance.now() on every autoplay step): the last move was 0.1-5 s before the test gave up,
  so the game was still moving, just too slowly for the 30 s budget. The "timer never fired" reading came from a trace
  with no timestamps.
- Same 9 specs (quick-game, campaign, daily, crash-recovery, hotseat, card-drag, drawer-tabs, campaign-map, tutorial),
  P + D, default workers, --retries=0: **React 76/79, Preact 71/79.** card-drag:144, drawer-tabs:5 and hotseat (phone)
  fail on React too here, so they aren't Preact bugs (CI passes them: local environment). After the patch's new changes,
  the 4 autoplay specs on Preact: 20/22, failing campaign.spec:12 D and crash-recovery D (end screen not in 30 s).
- Why: Preact renders Game ~2.2x as often per move (139 vs 64 in one desktop game). Preact runs useEffect after the next
  frame, so the per-move reaction effect (`cathLogSeenRef`: setCathReaction, strikePose, beat, setProducerFaces,
  strikeProducerPoses) commits as its own render after a paint; React folds it into the next move's render. Every render
  then runs the layout-effect measures (receipts `fit`, the desktop sheet `check`, the hand `fan`/`overflows`), each forcing
  a layout of the whole board: getBoundingClientRect self time ~5 s of a ~15 s profiled game in both builds.
- Alone, one desktop game times the same within noise (React 14.8/12.2 s, Preact 12.1/15.4 s), so the gap shows only under load.
- In the patch now: the autoplay/AI driver effect and the enemy-turn skip are layout effects (no wait for a paint);
  the phone/desktop data-tight measure clears, reads, then writes (it forced a layout per card before);
  `NO_PREACT=1 npm run build` builds React for A/B.
- Tried and dropped: `options.requestAnimationFrame` as a MessageChannel post (effects in the next task): no clear gain.
- **Next:** fold the reaction effect into the move (compute the reactions where `advance` sets the state, one render per
  move in both libraries), or make the receipts/sheet/fan measures run only when their inputs change; then rerun the 4
  autoplay specs at default workers, --retries=0, Preact vs React.

## 2026-11-27 02:51 lane A: autoplay specs pass on Preact; Game.tsx fixes on build
- **On build now (both libraries):** Cath's per-move reaction runs in `advance` (`reactToLog`), so its state lands in
  the move's own render; the ledger's `fit` caches each line's step and no longer un-hides every line to measure (it
  was 3,400 data-gone writes and the costliest forced style recalc of a game); the desktop hand fan and the tight-card
  measure skip when `handKey` (same card nodes, classes, text, enabled state, hand width, window, fonts) is unchanged;
  the hot-seat hand-off is a layout effect (under Preact the next player's hand painted for a frame before the
  pass screen: a real peek). The patch's Game.tsx parts (layout-effect autoplay driver, batched data-tight) moved to
  build too; the patch now holds only package, App, main, preactFixes, Setup and vite.config.
- Per desktop autoplayed game: style recalcs 13.9 -> 10.3 per move on Preact. Each render still pays ~2 full recalcs
  (~24 ms each here): the ledger measure, then handKey after the ledger's write. table.css has 247 `:has()` rules,
  the likely reason one recalc costs that much.
- Preact, P + D, --retries=0, default workers: quick-game, campaign, daily, crash-recovery, tutorial, hotseat 34/34
  (hotseat x2). React on the same: the hand specs fail the same 7-8 here with or without the change (environment).
- **Next:** apply the patch, run the whole game e2e on Preact at --retries=0 (compare any failure against
  `NO_PREACT=1`), then ship it before the 19:51 release (gate 7).
