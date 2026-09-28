# Decisions

Newest at the bottom. At most 5 lines per entry, under 250 lines in all (SPEC 16). v1's full log (2026-09-24 to 2026-09-28, about 3,400 lines) is in `docs/archive/DECISIONS-v1.md`; search it with grep.

## Standing decisions carried over from v1 (summary)
- Stack: Vite, React and TypeScript; a pure deterministic engine in `src/engine` (seeded mulberry32); bots in `src/ai` (Random, Heuristic, MCTS with a worker pool); a sim harness in `sim/`. See SPEC 9 and 11.
- Balance: the 12-iteration loop ended with MCTS on Normal at about 27% wins (target 45-60%). The pairs spread and loss-reason mix are recorded in `docs/archive/BALANCE-v1.md`. More balance work is allowed as a ROADMAP item and must log sims before and after.
- Only `main` deploys on Vercel (100 deployments a day on the Hobby plan); `vercel.json` disables `build`, `ci-status` and `claude/*`.
- Site layout (SPEC 15): landing at `/`, Cathnivore at `/cathnivore/`, Runnel at `/runnel/`; `npm run build:site` builds it, and `npm run build` stays Cathnivore-only for iOS and the gates.
- Sandbox limits: tag pushes fail with 403; the Chromium live smoke test hits the proxy's certificate; `/opt/pw-browsers/chromium` is the pinned browser. See CLAUDE.md notes.
- Inline `style` attributes are forbidden by the CSP. Set dynamic styles through the CSSOM or classes.

## Log
- 2026-09-28 (owner's chat session): **owner instruction: run indefinitely, improving and beautifying the games until they are world-class, Cathnivore first.** Added SPEC 16, `VISION.md`, `ROADMAP.md` and `FEEDBACK.md`; the session steps in CLAUDE.md now never end the run.
- 2026-09-28 (owner's chat session): archived v1's `PROGRESS.md`, `DECISIONS.md` and `BALANCE.md` to `docs/archive/` because they had grown to about 870 KB, which every session was paying to read. New size limits are in SPEC 16.
- 2026-09-28 (owner's chat session): shipped the title screen (the title screen: an illustrated, animated map of Marrow with Cath, in `src/ui/TitleArt.tsx` and `src/styles/title.css`) and the Campaign screen (the Campaign screen as a journey, in `src/ui/CampaignScreen.tsx` and `src/styles/campaign.css`). Text entrance animations move without fading, because axe measured contrast mid-fade and the test failed intermittently. Test hooks kept: chapter buttons' accessible names still start with the chapter title.
- 2026-09-28 (owner's chat session): **new plan from the owner.** Cath becomes a classy, cute, stylish mum (interpreted tastefully: elegant, warm, never suggestive) and a prime figure in every game; the iPhone App Store launch is postponed until the games are truly impressive. `ROADMAP.md` was rewritten (Phase 1: Cath); VISION.md gained "Cath: character bible"; SPEC 3.2 and 16, STYLE 9 and CLAUDE.md now point to it.
- 2026-09-28: found this pivot only after already fixing 2 real v1 bugs on `build` this session (the root
  `sw.js` origin-wide cache wipe deleting Cathnivore's own PWA cache; the sim harness's silent bad-`--bot`
  fallback and hung-worker gap). Rebased cleanly onto the pivot's tip rather than discarding either side —
  no conflicts, both are orthogonal fixes. `npm run release` hit the standing stale-`main` classifier denial
  twice this session; not retried a 3rd time (see PROGRESS.md).
