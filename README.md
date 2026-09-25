# Cathnivore

A free, cooperative, engine-building strategy game set in the fictional Republic of Marrow. One or two
producers — played by humans, or by one human and an AI teammate — build up small farms and push two
satirical corporations, Hollowell Group and Candor Health, out of the country one region at a time.
A six-chapter story campaign doubles as the tutorial; Quick Game is a standalone full game once you know
the rules.

Cathnivore is a work of satire. All places, companies and people in it are fictional. There is no
tracking, no accounts and no ads — every save stays on your device.

## How to play

- **Campaign** teaches the game a chapter at a time, starting from a single producer with very few rules
  switched on and building up to the full game. Start here if this is your first time.
- **Quick Game** is the full game (two producers, the full rulebook) from a fresh board. Recommended once
  you've finished at least chapter 3.
- Each round: **Harvest** (gain resources), then each producer takes 3 actions (Open Stall, Supply, Rebut,
  Invest, Sell, Scheme or Graft, plus a free once-per-round role ability), then the **enemy turn**
  (Agenda card, Squeeze, Expand, Scout). The **enemy plan strip** at the top of the game screen always
  shows which regions Squeeze and Expand will hit next — reading it is the core of every decision.
- You win the moment 5 regions are liberated, including Kingsmarket. You lose if Public Trust hits 0, the
  Lost Land token pool runs out, or the Pressure deck runs out.
- The full rules are generated from the same data the game plays with, and are always available in-game
  under **How to Play**, so they can never drift out of sync with how the game actually behaves.

## Playing it

The live web version is at **[cathnivore.com](https://cathnivore.com)**. It works offline after the first
visit and can be added to your home screen like an app. An iPhone app is in progress; see
[`PROGRESS.md`](PROGRESS.md) for its current status.

## Running it locally

Requires Node.js (LTS) and npm.

```sh
npm ci                # install dependencies
npm run dev            # start a local dev server
```

Other useful commands:

```sh
npm run check          # typecheck, lint, unit tests, a quick fuzz run, and a production build
npm test               # unit and property tests only
npm run e2e             # the Playwright end-to-end suite
npm run sim -- --games 1000 --bot heuristic --difficulty normal --pairs all   # balance simulations
npm run gates           # the full quality-gate suite (SPEC 11.4's gates 1-8)
```

## How it was built

Cathnivore was built end to end by unattended [Claude Code](https://claude.ai/code) sessions, one per
hour, following a fixed build specification ([`SPEC.md`](SPEC.md)) and visual style guide
([`STYLE.md`](STYLE.md)) with no human approval in the loop while it ran. Every session's decisions and
reasoning are logged in [`DECISIONS.md`](DECISIONS.md); build progress, balance-loop results and known
issues are tracked in [`PROGRESS.md`](PROGRESS.md) and [`BALANCE.md`](BALANCE.md).

### Stack

- **TypeScript** (strict mode), **Vite** and **React**. `src/engine` is pure, deterministic TypeScript
  (a seeded random number generator, no DOM or timers) — it's the single source of truth for the rules,
  and both the UI and the AI bots play through the exact same API.
- Three bots (`src/ai`): a random baseline, a greedy heuristic bot, and an MCTS bot that simulates many
  possible futures per decision. A headless simulation harness (`sim/`) runs thousands of self-played
  games to measure win rates and tune balance, logged in `BALANCE.md`.
- Plain CSS using design tokens from `STYLE.md` — no UI component library, no external image assets. Every
  piece, icon and portrait is drawn in code as SVG.
- `vite-plugin-pwa` for offline play and home-screen install on the web; Capacitor for the iPhone app
  (`ios/`), which bundles every asset so it runs fully offline.
- Vitest and fast-check for unit and property tests, Playwright for end-to-end tests, axe-core for
  accessibility checks and Lighthouse for a performance budget — all wired into `npm run gates`, which
  every change has to pass before it can ship.

### Process

Each hourly session read the spec fresh, picked up the next unfinished task from `PROGRESS.md`, worked for
about 50 minutes, and committed and pushed its progress before releasing a lock file so the next session
could pick up cleanly. When the spec was silent or ambiguous, the session made a call and logged it in
`DECISIONS.md` rather than stopping to ask — there was no one to ask.
