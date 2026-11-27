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
