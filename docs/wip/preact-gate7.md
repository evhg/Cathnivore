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
