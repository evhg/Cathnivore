# Roadmap

The ordered backlog for improvement sessions (SPEC 16). Work from the top: take the first item that isn't done or blocked. Big items are split into slices, and each slice must ship on its own, leaving the game better and never half-broken.

Sessions may add items, split items or reorder within a section when they find something more important, and log the reason in `DECISIONS.md`. Only the owner (through `FEEDBACK.md`) moves items between sections or deletes them. Mark items `[x]` when shipped (released to `main`), with the release commit.

Every visual item is done only when:
- before and after screenshots at 390×844 and 1440×900, light and dark, show a clear improvement against `VISION.md`;
- the gates pass;
- motion respects reduced motion.

## Now: make Cathnivore beautiful

1. [x] **Title screen:** an illustrated, animated map of Marrow with Cath, poster typography and a clear menu. Done by the owner's chat session on 2026-09-28; it sets the bar for the rest.
2. [ ] **The table (game screen), part 1: layout.** Make the map the hero. On desktop, the map fills the centre column at the largest size that fits, and the farm, market, plan and log panels become tidy side trays. On phone, the map fills the top of the screen and actions live in a bottom tray that can be pulled up. Keep every current control and test hook, and don't change the rules. Ship behind no flag once it's at least as usable as today.
3. [ ] **The table, part 2: actions as cards.** Replace the grid of text buttons with illustrated action tiles: an icon per action (Open Stall, Supply, Rebut, Sell, Graft, Invest, Scheme, Role), cost chips shown with resource tokens, clear disabled and why-not states, and press feedback. Region-targeting mode highlights the valid regions on the map with an animated outline.
4. [ ] **The table, part 3: the HUD.** Round, Trust, Lost Land and Rift become illustrated gauges (a wax-seal round counter, a trust meter, a Lost Land tile stack, a Rift crack) with tick-up and tick-down animation when they change. The enemy's Squeeze, Expand and Scout slots become agenda cards with each corporation's glossy branding.
5. [ ] **Map art, part 1: regions.** Each region gets terrain illustration on top of its texture: hills and hedgerows on pasture, field rows on crop land, a shoreline and boats on the coast, and the Kingsmarket clock tower and cobbles. Labels become painted signboards. It must stay legible and pass the greyscale shape test (STYLE.md 2).
6. [ ] **Map art, part 2: pieces.** Draw the exact STYLE.md 6 pieces: a striped-awning Stall, a glossy plastic Outlet with a "0.99" tag, a picket-fence "SOLD" Buyout and a "?" speech-bubble Doubt. Add a placement animation for each (the Stall pops up, the Outlet drops in with a plastic bounce, the SOLD sign hammers down).
7. [ ] **Moments:** liberating a region (a seal stamp, colour blooming across the hex, the producers' portraits cheering), a Squeeze (glossy plastic creeping over a region), Lost Land, the Rift at 3 and 6, the enemy turn playback choreographed step by step, and the end of a round.
8. [ ] **Story scenes as a graphic novel:** large portraits with expressions (neutral, happy, angry, worried, smug), speech bubbles on an illustrated backdrop per chapter's region, tap to advance line by line, and a skip option. Portraits get an expression system (eyebrows, mouth, eyes) in `Portrait.tsx`.
9. [ ] **Campaign screen:** an illustrated journey across Marrow, with chapters as stops on a path, chapter art, locked and unlocked states, and a best result per chapter.
10. [ ] **Setup screen:** the producers as character cards (portrait, role, ability in one line), a difficulty toggle drawn as three pieces of produce, and a recommended-pair ribbon. No default radio buttons or checkboxes anywhere.
11. [ ] **End screen:** a win or loss illustration, the final map snapshot, stat cards (regions, rounds, Trust, cards bought), each producer's line, and "Play again" and "Share".
12. [ ] **Cards:** Improvements and Schemes as illustrated cards, with a frame per category (Media, Science, Coast, Pasture, Community and so on), an icon per card, and cost and effect in a consistent layout. Animations for buying and playing a card.
13. [ ] **How to Play:** illustrated, paged and interactive (tiny demo boards showing each rule), replacing the wall of text.
14. [ ] **Sound:** a synthesised WebAudio sound set (stall pop, coins, seal stamp, plastic squeak, page turn) and an optional ambient market loop, with volume and off switches in Settings. Silent by default until the player's first tap; on iPhone, respect the silent switch.
15. [ ] **Settings and Credits:** designed screens that match the title.
16. [ ] **Motion system:** shared easing and duration tokens, a small animation helper, and an audit of every screen for consistency and reduced motion.

## Next: Runnel and the site

17. [ ] **Runnel feel:** a sound set, a water-arrival sparkle, crops varied by season (the season changes with the month), a streak calendar in Stats, and a par that feels fair (consider limiting the scramble so average taps per tile fall; log the sim before and after).
18. [ ] **Runnel variety:** new tile types such as bridges (two crossing channels), sluice gates and reservoirs, introduced gradually by day of the week, each with generator support and a solvability test.
19. [ ] **Landing page:** a live miniature animated preview of each game on its card, and a performance check on real mid-range phones (add a frame-time probe in development builds).

## Launch track (blocked on the owner)

20. [ ] **iPhone App Store submission.** Blocked until the owner adds the Apple secrets (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`) and the real Team ID in `OWNER.md`. When they appear, follow SPEC 11.6. Budget: at most 2 iOS builds a week (SPEC 16).

## Later (only after "Now" is world-class, or when the owner asks in FEEDBACK.md)

- A third game for the portfolio, with a design note first in `docs/design/`.
- Online play, localisation.
