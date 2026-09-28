# CATHNIVORE: v1 Build Spec

This file is the single source of truth for building Cathnivore v1. It is written for unattended Claude Code cloud sessions (Opus 5.5) that a routine on claude.ai starts every hour. The owner will not answer questions or approve anything during the build. Everything needed to finish is in this file; where it is silent, decide and log (section 1).

## 0. The job in one paragraph

Build and ship **Cathnivore**, a free, cooperative, engine-building strategy game, in two forms:
- a web version at **https://cathnivore.com**;
- an **iPhone app submitted to the App Store**.

One or two players, or one player with an AI teammate, run small farms in the fictional Republic of Marrow. Guided by the heroine Cathnivore, they push two fictional corporations out of the country one region at a time. v1 includes a six-chapter story campaign that doubles as the tutorial, a Quick Game mode, an AI teammate, two-player play on one device, and bots that balance the game through simulation.

There is a hard cap of 7 days from the time in `DEADLINE`. The run ends when the iPhone build has been submitted for App Review; Apple's review and the release happen after the run. From day 1 onward, the live site must always serve the latest build that passed every check in section 11.4.

## 1. Autonomy rules (re-read every session)

1. **Never ask the owner anything, never wait for input, never pause for approval.** No one will answer.
2. When this spec is silent or ambiguous, decide using the priority order below. Write one line in `DECISIONS.md` (date, decision, reason) and continue.
3. Priority order when goals conflict:
   1. The live site works: it loads, never crashes, games can be finished, and saves survive a reload.
   2. The rules are implemented correctly and match the in-game text.
   3. The campaign teaches the game clearly.
   4. The iPhone build builds, installs from TestFlight and behaves exactly like the web version.
   5. The balance targets in section 9 are met.
   6. Visual polish and feel.
   7. Extra content.
4. **Branches.**
   - Work only on the branch `build`.
   - `main` is production: Vercel deploys every push to `main` to cathnivore.com. Move `main` forward to a `build` commit only when every gate in section 11.4 passes, then run the live smoke test (11.5).
   - Only read the branch `ci-status`. Never push to it or merge it anywhere: it contains commits by the GitHub Actions bot, and these sessions can't push to a branch that holds someone else's commits.
5. Work only inside this repository. Installing tools and packages on the session's own cloud machine is fine. Never delete anything outside the repository.
6. **Secrets.** Sessions have no Vercel, Apple or domain credentials and don't need them. Apple credentials live only in GitHub Actions secrets and are used only by the workflows in 11.6. Never print, write or commit a secret, and never add a workflow step that echoes one.
7. Do not create accounts, buy anything, or use paid services. Allowed external access: the npm registry, Playwright browser downloads, the live site and its Vercel address, and public documentation (for example Apple's) for reference.
8. If an external step fails (network, npm, a workflow, DNS), retry up to 5 times with growing waits. If it still fails, log it under "Blocked" in `PROGRESS.md`, switch to other work, and retry next session.
9. **Every session** (a routine starts one each hour):
   1. Run `git fetch --all`, then check out `build`, creating it from `main` if it doesn't exist.
   2. ~~If `DONE` exists, reply "Build finished" and end immediately.~~ **Superseded by section 16 (2026-09-28): the run never ends. If `DONE` exists, delete it and carry on.**
   3. **Lock check:**
      - If `.build-lock` exists and its timestamp is less than 75 minutes old, another session is running, so end immediately.
      - Otherwise write the current UTC time to `.build-lock`, commit and push.
      - If that push is rejected, another session got there first, so end immediately.
   4. Read `CLAUDE.md`, this file, `STYLE.md`, `OWNER.md`, `PROGRESS.md`, `DECISIONS.md`, `BALANCE.md` (if it exists), `git log --oneline -20`, and the files on `origin/ci-status`.
   5. Work through the next unchecked tasks for about 50 minutes. Commit and push to `build` after every finished task.
   6. Before ending, make `PROGRESS.md` accurate, delete `.build-lock`, then commit and push.
10. **Time.** (Superseded by section 16 on 2026-09-28: `DEADLINE` no longer ends the run and `DONE` is never created. The rest of this rule is kept for history.) The first session creates `DEADLINE` (now plus 7 days, ISO format, UTC) and commits it. Check the time left before starting each task and follow the schedule in section 12. When less than 18 hours remain, stop feature work and go to M7. Once the deadline has passed:
    - finish the current task only if it takes under 30 minutes;
    - confirm `main` is on the last good build;
    - write the final report;
    - create the empty file `DONE` and push it to both `build` and `main`.
11. Use subagents for independent review work (screenshots, rules text, story text). Run at most 2 at once, because the owner is on a usage-limited subscription.
12. **Cut scope, never stability.** Allowed cuts, in this order:
    1. animations;
    2. dark theme;
    3. card counts, down to the minimums in sections 5 and 7;
    4. Hard difficulty;
    5. chapter 5 shrinks to 5 regions;
    6. story scenes shrink to one opening and one closing scene per chapter;
    7. if App Store submission is blocked, leave the iPhone build in TestFlight, log why, and ship the web version.
    
    Never cut: chapters 1 to 6 (they may be shorter), the AI teammate, save and resume, the phone layout, or any gate in section 11.4.

## 2. Product summary

- **Name:** Cathnivore. **URL:** https://cathnivore.com, with www.cathnivore.com redirecting to it.
- **Genre:** a cooperative engine-builder with area control. The structure is inspired by Spirit Island (players cooperate against an enemy that follows visible rules) and Terraforming Mars (production engine, card tags, a card market). Never copy their text, art, names or exact cards.
- **Players:** every full game has exactly 2 producers, each controlled by a human or by the AI. The modes are **Solo** (1 human plus an AI teammate) and **Hot-seat** (2 humans taking turns on one device). The engine must also support a single producer, which campaign chapters 1 to 3 use. Online play on separate devices is not in v1, but the engine design (serializable state plus an action log) must make it straightforward to add later.
- **Length:** 45 to 60 minutes for a full game at Normal difficulty.
- **Complexity:** medium, about Terraforming Mars level, learnable entirely through the campaign.
- **Audience:** public and free. English only, with no translation layer.
- **Platforms:**
  - **iPhone app:** built from the same code with Capacitor (section 11.6). iPhone only, portrait, fully offline.
  - **Web:** phone browsers first (portrait, 360 to 430 px wide), plus desktop (1280 px and wider) and tablets. The web version is a progressive web app: a website that can be saved to the home screen and works offline after the first visit.
- **No** backend, database, accounts, ads, in-app purchases, analytics, cookies or tracking. All saves stay on the device.
- **Look:** follow `STYLE.md`. Everything is drawn in code (SVG and CSS), with no generated images, stock art or external image files.
- **Tone:** witty, grounded satire. Dry humour, never preachy.

## 3. World and story bible

### 3.1 Setting
The Republic of Marrow is a small fictional country of pastures, market towns and a rainy coast. The capital is Kingsmarket and the currency is the mark. Never name or allude to real countries, companies, brands, people or organisations.

### 3.2 Cathnivore
Catherine "Cath" Hale, early thirties. She left a well-paid trading job to run a pasture-raised cattle farm. A tabloid nicknamed her "the Cathnivore" after she said on live television that she would eat her words "as soon as they're grass-fed." She kept the name.

- **Character:** very smart, warm, funny and quick, always three moves ahead. Charm is her favourite tool. She is never cruel, never preachy and never a know-it-all. She is the one who notices things.
- **Voice:** short sentences, specific details rather than slogans, dry and a little self-deprecating, with the occasional one-line zinger. At most one exclamation mark per chapter.
- **Look (for her SVG portrait):** a soft K-pop idol style with light skin, large bright eyes, glossy lips and curtain bangs, and very long ("Rapunzel" length) centre-parted hair. Hair and skin colours are set in `OWNER.md`. Olive field jacket, cream scarf, and one eyebrow slightly raised by default. Full drawing rules are in `STYLE.md` section 9.
- **Updated by the owner (2026-09-28):** Cath is now a classy, cute, stylish mum with a six-year-old daughter, Bea, and she is the face of every game on cathnivore.com. `VISION.md` "Cath: character bible" overrides the look above and `STYLE.md` 9 where they differ.

### 3.3 Allies (the four playable producers; rules in section 6)
- **Mara Keel:** cattle rancher in Brindle Hills and former litigator. Precise and deadpan.
- **Tomas Reed:** organic vegetable grower in Oakvale who runs the Saturday market. A cheerful organiser who knows everyone.
- **Dr Ines Farrow:** dairy farmer in Rivermead and the district's only country doctor. Calm, evidence-first, gently devastating.
- **Sol Abara:** salt-marsh lamb farmer in Saltmarsh who hosts a surprisingly popular farming podcast. Talks fast, jokes faster.

### 3.4 Antagonists and secrets
- **Hollowell Group:** an ultra-processed food conglomerate. Its tactics are cheap products, supermarket deals and buying up farmland. Its CEO, **Graham Pell**, is genial, speaks in mission statements and never raises his voice.
- **Candor Health:** a pharmaceutical company. Its tactics are sponsored studies, doubt campaigns and "wellness" marketing. **Dr Octavia Vane**, its Head of Public Understanding, is elegant and never technically lies.
- **Julian Crisp:** a PR fixer who works for both companies. Smooth, with a statement always ready.
- **Pip Talbot:** a cheerful Kingsmarket market inspector who helps the players during the tutorial. He is secretly Crisp's informant, which is revealed at the end of chapter 5.
- **Wholesome Hollow:** a beloved organic label the farmers sell through. It is secretly owned by Hollowell, which is revealed at the end of chapter 3.

### 3.5 Satire rules (apply to every piece of text)
- Satirise tactics such as marketing spin, sponsored research, lobbying and buyouts. Never satirise ordinary workers or any group of people.
- No real people, companies, brands, products, drugs, diseases, studies or countries. No health or medical claims presented as fact, and no advice.
- Keep it PG-13: no slurs, gore or sexual content.
- Villains are competent and funny, not cartoonish.

## 4. Rules of the full game

All numbers here are starting values. The balance loop in section 9 may change numbers but not structure. Record every change in `BALANCE.md`. All in-game rules text must be generated from the same data the engine uses, or checked against it by tests, so the text and the rules can never disagree.

### 4.1 Components
- **Map:** 7 regions (4.2).
- **Producers:** 2 per full game, each with its own resources, production tracks and a tableau of bought Improvements.
- **Player pieces:** Stalls (12 per producer).
- **Enemy pieces:** Outlets (Hollowell, pool of 30), Buyouts (Hollowell, pool of 12) and Doubt tokens (Candor, pool of 30). If a pool is empty, that placement is skipped.
- **Lost Land tokens:** a pool of 8 at Normal. Having to take a token when the pool is empty loses the game.
- **Co-op markers:** placed on liberated regions.
- **Tracks:** Public Trust (0 to 15, starts at 10), Rift (0 to 6, starts at 0) and Round (1 to 10).
- **Decks:** Pressure (10 cards), Agenda (24 cards, both factions shuffled together), Improvements (36) and Schemes (30).

### 4.2 Map: the Republic of Marrow
Seven regions form a hex flower with Kingsmarket in the centre.

| Position | Region | Type | Note |
|---|---|---|---|
| centre | Kingsmarket | Capital | Enemy headquarters, guarded (4.8) |
| top-left | Highmoor | Pasture | |
| top-right | Saltmarsh | Coast | Sol's home |
| right | Rivermead | Crop | Ines's home |
| bottom-right | Shingle Bay | Coast | |
| bottom-left | Oakvale | Crop | Tomas's home |
| left | Brindle Hills | Pasture | Mara's home |

**Adjacency:** every outer region borders Kingsmarket and its two neighbours on the ring (Highmoor–Saltmarsh–Rivermead–Shingle Bay–Oakvale–Brindle Hills–Highmoor).

### 4.3 Setup (Normal)
1. Public Trust 10, Rift 0, Lost Land pool 10 (4.9), Round 1.
2. Kingsmarket gets 2 Outlets, 1 Buyout and 2 Doubt. Every other region gets 1 Outlet. Each Coast region also gets 1 Doubt.
3. Each producer places 2 Stalls in their home region and takes their starting resources and production (section 6). Home regions keep their Outlet, so freeing your home is everyone's first goal.
4. Build the Pressure deck (4.7). Reveal the top card into the Scout slot, resolve Scout, then advance the pipeline (4.7).
5. Deal 4 face-up Improvements (the Market) and 3 face-up Schemes (Cath's Plan).
6. Player 1 is the first player. The first player alternates every round.

### 4.4 Resources
- **Produce:** food you grow. Spent to open Stalls and to Supply.
- **Marks:** money. Spent on Improvements.
- **Goodwill:** personal reputation. Spent to Rebut Doubt and to play Schemes.

Each producer has their own resources and a production track for each (0 to 10). Resources carry over between rounds with no cap. **Public Trust** is a separate, shared track representing the country's opinion of farmers. It is not a resource.

### 4.5 Round structure
1. **Harvest:** each producer gains resources equal to their production.
2. **Producers' turns:** the first player takes 3 actions, then the other player takes 3 actions. During their own turn, each producer may also use their role ability once per round for free. Unused actions are lost.
3. **Enemy turn**, in this order:
   1. **Agenda:** reveal the top Agenda card and resolve it.
   2. **Squeeze:** resolve in each region matching the card in the Squeeze slot.
   3. **Expand:** resolve in each region matching the card in the Expand slot.
   4. **Scout:** reveal the top Pressure card into the Scout slot and resolve Scout in each matching region. If the Pressure deck is empty, the players lose (4.8).
   5. **Advance:** discard the Squeeze card, move the Expand card to the Squeeze slot and move the Scout card to the Expand slot.
4. **Cleanup:** refill the Market to 4 and Cath's Plan to 3, check win and loss, advance the round and swap the first player.

During the producers' turns, the Squeeze and Expand slots already show where the enemy will strike. This visible plan is the heart of the game's decisions.

### 4.6 Actions (3 per producer per round)
1. **Open Stall:** pay 1 Produce and place one of your Stalls in a region that contains your Stall or borders a region that does. There is a maximum of 3 Stalls per region (all producers combined, minus 1 per Lost Land token there, never below 1).
2. **Supply:** in a region with your Stall, either pay 2 Produce per Outlet to remove up to 2 Outlets, or pay 4 Produce to remove 1 Buyout. Removing a Buyout requires at least 2 Stalls in the region (any producers).
3. **Rebut:** in a region with your Stall, pay 1 Goodwill per Doubt to remove up to 2 Doubt.
4. **Invest:** buy one face-up Improvement by paying its Marks cost. It goes into your tableau and takes effect. Its Market space stays empty until cleanup.
5. **Sell:** turn up to 3 Produce into the same number of Marks.
6. **Scheme:** play one face-up Scheme from Cath's Plan by paying its Goodwill cost. Resolve it, then discard it. Its space stays empty until cleanup.
7. **Graft:** gain 1 Produce and 1 Marks. This guarantees a legal action always exists.

**Undo:** a human may undo any action taken in their current turn. The engine rebuilds state by replaying the log. Because all refills happen at cleanup, undo never reveals hidden cards. Any action that reveals hidden information (for example a Scheme that peeks at a deck) is marked irreversible, and undo cannot go back past it. The AI never undoes.

### 4.7 The enemy
**Pressure deck (10 cards)**, built at setup:
- Stage I: Pasture, Crop and Coast, shuffled (3 cards).
- Stage II: Pasture, Crop, Coast and Capital, shuffled (4 cards).
- Stage III: Pasture+Crop, Crop+Coast and Coast+Pasture, shuffled (3 cards).

Stack them with Stage I on top and Stage III at the bottom. A card matches every region of the type(s) it names. The Capital card matches Kingsmarket only.

- **Scout:** each matching region that is not liberated gets 1 Outlet. Stage III cards also add 1 Doubt.
- **Expand:** each matching region that is not liberated and has at least 1 enemy piece gets 1 Buyout if it has 2 or more Outlets and no Buyout; otherwise it gets 1 Outlet. Candor also adds 1 Doubt there if the region has any Stall.
- **Squeeze:** in each matching region, Damage = Outlets + 2 × Buyouts and Defence = number of Stalls. If Damage is greater than Defence, place 1 Lost Land token there from the pool. If that region is a producer's home, that producer also lowers one production track by 1 (their choice). If Damage is at least Defence + 3, also remove 1 Stall there, from the producer with the most Stalls in that region (on a tie, the current first player). Finally, Public Trust drops by 1 per Doubt in the region, up to 2.

**Agenda deck (24 cards):** 12 Hollowell cards and 12 Candor cards shuffled together, one revealed per round. Each card has a faction, a satirical news headline (90 characters maximum), an effect, and a bonus effect that is skipped when Rift is 3 or higher. If an effect has no valid target, it does nothing. Use these four exactly and write the rest to match:
- *Hollowell:* "Hollowell unveils 'Farmhouse' range, made in a very large house." Add 1 Outlet to each Crop region that has a Stall. **Bonus:** add 1 Buyout to Kingsmarket.
- *Hollowell:* "Hollowell pledges to support local farmers by buying them." In the non-liberated region with the fewest Stalls, replace 1 Outlet with a Buyout. **Bonus:** each producer loses 1 Marks.
- *Candor:* "Candor-funded study finds 'natural' is a risk factor." Public Trust −1 for each region with 2 or more Doubt. **Bonus:** add 1 Doubt to the region with the most Stalls.
- *Candor:* "Candor launches free wellness app. It is very interested in you." Each producer loses 1 Goodwill. **Bonus:** add 1 Doubt to each Coast region.

**Rift track (0 to 6):** Schemes and some Improvements raise it. It represents the growing distrust between the two companies.
- **Rift 3, "Cracks":** Agenda bonus effects are skipped.
- **Rift 6, "The Split"** (happens once): the players choose one faction. Remove all of its remaining cards from the Agenda deck, and remove half (rounded down) of that faction's pieces from the map, with the players choosing where. The AI picks the faction and places whose removal most improves its evaluation.

### 4.8 Liberation, winning and losing
- A region is **liberated** when it has at least 1 Stall and no Outlets, Buyouts or Doubt. Check after every action and after every enemy step, and mark it with a Co-op marker.
- Liberated regions ignore Scout and Expand. Agenda cards cannot place pieces there unless the card says "even liberated regions." A region loses its Co-op marker if it ever has no Stalls or gains an enemy piece.
- **The first time** each region is liberated in a game, Public Trust rises by 1 and the producer who took the liberating action gains +1 production: Pasture gives Produce, Crop gives Marks, Coast gives Goodwill, and Kingsmarket lets them choose.
- **Kingsmarket is guarded:** nobody may place a Stall there, by any means, unless at least 2 of its neighbours are liberated.
- **Win:** the moment 5 regions are liberated, one of which is Kingsmarket.
- **Lose immediately if:** Public Trust reaches 0; a Lost Land token must be placed but the pool is empty; or the Scout step needs a Pressure card and the deck is empty ("the merger goes through"). With the setup above, this means the game lasts at most 10 rounds.
- The end screen shows the reason, a short story line, and stats: regions liberated, rounds played, cards bought and schemes played.

### 4.9 Difficulty

| | Easy | Normal | Hard |
|---|---|---|---|
| Public Trust at start | 12 | 10 | 8 |
| Lost Land pool | 20 | 10 | 6 |
| Extra setup | 1 fewer starting Outlet in Kingsmarket, 0 starting Buyouts in Kingsmarket (Normal/Hard keep 1), 1 extra starting Stall in each producer's home region | none | +1 Doubt in each Pasture region, +1 Outlet in Kingsmarket |

The balance loop may tune these values. (Normal's Lost Land pool moved 8 -> 11 -> 10 across several
M4 balance-loop iterations — see `DECISIONS.md` and `src/content/difficulty.ts` — landing equal to Easy's
original value. That left Easy's own SPEC 9.4 win-rate target unmet, undetected until a 2026-09-27 session
first actually simulated Easy/Hard: a 100-game MCTSBot Easy run came back at 43.0%, below even Normal's
band. Easy's pool was widened 10 -> 16 (53.0% on a 100-game spot check), then 16 -> 20 in a further
iteration the same day, which held win rate flat but showed Lost Land had stopped being the bottleneck —
so a further iteration added the Kingsmarket-Outlet line above instead, targeting liberation pace
directly (50.0% -> 56.0% confirmed). That shifted the dominant loss reason to Public Trust, so a further
iteration tried widening Easy's starting Public Trust 12 -> 14, but a follow-up spot check came back at
an identical 56.0% (it only moved losses to running out of rounds, not the win rate) and was reverted.
Later 2026-09-27 sessions kept pulling the same liberation-pace lever: `extraHomeStalls` (1 extra starting
Stall per producer's home region, still within the 3-per-region cap) took a 100-game spot check
56.0% -> 66.0%; once that lever hit its own ceiling (a 2nd point would break the 3-per-region cap),
`kingsmarketBuyouts` (0 for Easy instead of 1) pushed further. A 300-game MCTSBot confirmation (up from
the earlier 100-game spot checks) landed at 75.3%, inside the 70-85% target band with every producer pair
within 12 points of that rate — this table is kept in sync with the tuned code rather than the original
design draft.)

## 5. Cath's Plan (Schemes)

- A shared deck of 30 Scheme cards (minimum 18). Three are face up. Any producer may play one as an action by paying its Goodwill cost. Refill at cleanup. When the deck runs out, shuffle the discard pile to form a new deck.
- Each card has a name (3 words maximum), a cost (1 to 4 Goodwill), an effect, and a line in Cath's voice (110 characters maximum). Optional tags: Rift, Media, Market.
- Aim for this mix: about 10 removal or tempo cards, 6 economy, 5 information (look at or reorder the Pressure or Agenda deck), 5 Rift and 4 defensive (a region skips Squeeze or Expand this round).
- Use these six exactly and write the rest to match their tone:
  1. **Loss Leader** (2): Remove 2 Outlets from a region with your Stall. *"They sell at a loss to win. I sell at a profit and win anyway."*
  2. **Leaked Memo** (3): Rift +2. Remove 1 Doubt anywhere. *"Nothing in an office is more dangerous than the printer."*
  3. **Grass Roots** (1): Open a Stall for free in any region bordering a liberated region. *"Roots first. Then shoots. Then lawyers."*
  4. **Steak-out** (2): Look at the top Pressure card. You may put it at the bottom of its stage. (Irreversible.) *"I don't guess where they'll go. I wait where they're going."*
  5. **Blind Taste Test** (2): Choose a region with your Stall. If it has no Doubt, Public Trust +2; otherwise remove all Doubt there. *"Blindfolds on. Now tell me which one is food."*
  6. **Sunlight** (3): Choose a region. Squeeze skips it this round. *"They hate two things: daylight and minutes being taken."*

## 6. Producers

| Producer | Home | Starting Produce / Marks / Goodwill | Production P / M / G | Role and ability (once per round, free) |
|---|---|---|---|---|
| Mara Keel | Brindle Hills | 3 / 2 / 1 | 2 / 1 / 1 | **Litigator, Injunction:** choose a region with your Stall. Expand skips it this round. |
| Tomas Reed | Oakvale | 2 / 3 / 1 | 1 / 2 / 1 | **Organiser, Market Day:** open a Stall for free in a region bordering any producer's Stall. |
| Dr Ines Farrow | Rivermead | 2 / 2 / 2 | 1 / 1 / 2 | **Doctor, Second Opinion:** remove 1 Doubt from a region with your Stall, at no cost. |
| Sol Abara | Saltmarsh | 2 / 2 / 2 | 1 / 1 / 2 | **Podcaster, On Air:** Public Trust +1, or gain 2 Goodwill. |

At setup, players choose 2 producers. The setup screen suggests the pair with the best balance data, labelled "Recommended."

## 7. Improvements

- 36 cards (minimum 24). The Market shows 4 face up and refills at cleanup. If the deck is empty, empty spaces stay empty.
- Each card has a name, a cost (2 to 9 Marks), 1 or 2 tags (Pasture, Crop, Coast, Community, Media or Science), an effect (immediate, ongoing or both) and an optional deadpan flavour line (80 characters maximum).
- Aim for this mix of effects: about 50% production increases, 30% ongoing discounts or abilities, 10% tag-scaling (for example "+1 Marks production for every 2 Community tags you have", counted when bought) and 10% one-off effects. A few Media cards raise Rift.
- Pricing guide as a starting point for the simulations: +1 Produce or Marks production is worth about 3 Marks; +1 Goodwill production about 4; an ongoing ability 2 to 4; add about 1 per tag. Most early cards cost 3 to 5.
- Use these exactly and write the rest to match:
  - **Farm Shop** (3, Community): +1 Marks production.
  - **Rotational Grazing** (6, Pasture): +2 Produce production.
  - **Mobile Butcher** (5, Pasture, Community): Supply in Pasture regions costs 1 less Produce per Outlet (minimum 1).
  - **Soil Lab Report** (4, Crop, Science): +1 Goodwill production. When you Rebut, you may remove 1 extra Doubt for free.
  - **Veg Box Round** (5, Crop, Community): +1 Marks production for every 2 Community tags you have, including this one.
  - **Oyster Beds** (4, Coast): +1 Produce production. At Harvest, also gain 1 Goodwill if you have a Stall in Shingle Bay.
- **Campaign-only cards:** 3 copies of **Wholesome Hollow Contract** (2 Marks: +2 Marks production). They appear only in chapter 3 (section 8). After the chapter 3 reveal, each owned contract adds 1 Outlet to its owner's home region at the start of every round, until the owner spends an action and 3 Marks on "Tear Up the Contract."

## 8. Campaign: story and tutorial in one

### 8.1 Structure
- Six chapters. Chapters 1 to 3 have one producer, controlled by the human. Chapters 4 to 6 have two producers: in Solo, the human plus the AI teammate; in Hot-seat, two humans. The player picks Solo or Hot-seat when starting the campaign.
- Each chapter has an opening scene (12 lines maximum), guided play with tutorial prompts, and a closing scene that ends on a hook.
- **Target playtime:** chapter 1 under 10 minutes, the whole campaign about 2.5 hours.
- **Tutorial prompts** are 2 sentences maximum and highlight the relevant part of the screen. In chapters 1 and 2, the first few steps are "guided": only the action being taught is enabled. After that, the player plays freely within that chapter's rules. Each new rule is introduced exactly once, at the moment it first matters, with a "?" link to the rules reference.
- **Losing a chapter:** offer Retry (same shuffle), Retry (new shuffle) and Play on Easy. After 2 losses, also offer Skip Chapter, which shows a one-paragraph summary scene. Progress is never locked.
- Chapters are data: which regions are active, which rules are switched on, the starting state, a scripted Pressure sequence where needed, triggers (round start, region liberated, card bought and so on), scenes and tutorial steps. The full game is simply every rule switched on.
- Campaign progress and carry-over flags are saved separately from game saves.

### 8.2 Chapters
1. **Fresh Meat.** *Map:* Brindle Hills and Highmoor; Kingsmarket is shown but greyed out. *Producer:* Mara. *Rules:* Harvest, Open Stall, Supply, Graft; the enemy only Scouts, using a fixed tutorial sequence. *Goal:* liberate both regions within 6 rounds. *Story:* Cath arrives at Mara's farm, where Hollowell outlets are undercutting her beef. Pip Talbot, the friendly market inspector, gives helpful tips throughout. *Hook:* a Candor van is parked outside the market.
2. **Word of Mouth.** *Map:* Saltmarsh, Highmoor and Rivermead. *Producer:* Sol. *Adds:* Goodwill, Doubt, Rebut, Public Trust and role abilities; Scout also adds Doubt. *Goal:* liberate 2 regions while keeping Public Trust above 0. *Story:* Candor's "Natural Is Risky" campaign targets Sol's podcast. *Hook:* Octavia Vane invites Cath to lunch.
3. **Growing Season.** *Map:* Oakvale, Brindle Hills, Rivermead and Shingle Bay. *Producer:* Tomas. *Adds:* production growth, the Improvements Market (seeded with the attractive Wholesome Hollow Contract cards), Sell, Expand, Squeeze and Lost Land. *Goal:* liberate 3 regions within 8 rounds. *Twist (scripted at the start of round 5):* a scene reveals that Wholesome Hollow is owned by Hollowell, and the contract rule from section 7 switches on immediately. *Hook:* Graham Pell phones Cath personally and offers to buy her farm. *Carry-over:* each contract not torn up by the end of the chapter adds 1 Outlet to Oakvale in chapter 4 (maximum 2), with a rueful line from Tomas.
4. **The Plan.** *Map:* 5 regions, with Kingsmarket visible and guarded. *Producers:* two (Recommended: Ines and Tomas). *Adds:* Cath's Plan (Schemes), the full Squeeze/Expand/Scout pipeline, two-producer turns, the AI teammate and the Kingsmarket guard rule. *Goal:* liberate 3 regions. *Story:* Cath lays out her plan, and Ines proves Candor's study is fake. *Hook:* Pip warns Cath that someone in her circle is talking.
5. **Friends in Low Places.** *Map:* all 7 regions. *Rules:* everything, including the Agenda deck and Rift. The chapter starts from a pre-built mid-game position, lasts 7 rounds, and is won with 3 liberated regions (Kingsmarket not required). *Story:* Julian Crisp's leak points suspicion at Mara. *Twist (closing scene):* Cath is arrested on live television on fabricated fraud charges. The evidence came from Pip Talbot. A short montage replays three of his helpful tutorial lines from chapters 1 to 4, which now read very differently.
6. **Kingsmarket.** *Rules:* the full game with the standard win. *Twists:* Cath's Plan starts face down and locked. When the players liberate their 2nd region ("Get her out"), a scene brings Cath back, the Plan unlocks and the players get one free Scheme. Rift starts at 2 because Pell and Vane are already blaming each other. *Win scene:* the Kingsmarket market reopens, Pell issues a statement "welcoming healthy competition," and Cath gets the last line. *Loss scene:* short and bittersweet, with a Retry option.

Quick Game is available from the start, with a note recommending the campaign first.

### 8.3 Story writing
- All scenes live as data in `src/content/story/`. Keep the total under 4,000 words, at most 12 lines per scene and at most 160 characters per line.
- Follow the voices in section 3 and the satire rules in 3.5. Every chapter ends on a hook.
- A subagent reviews the complete story for wit, consistency with the bible, and the satire rules. Fix what it flags.

## 9. AI and balance

### 9.1 Engine requirements
- `src/engine` is pure TypeScript with no DOM, React, timers or `Math.random`. Use a seeded random number generator (for example mulberry32) whose state is stored in the game state.
- API:
  - `createGame(config, seed) → GameState`
  - `legalActions(state) → Action[]`: finite, in deterministic order.
  - `applyAction(state, action) → GameState`: never mutates its input, and throws only on an illegal action.
  - `currentDecision(state)`: who must decide what. Forced choices, such as which production to lower or which faction to split at Rift 6, are decisions with legal options, so humans and the AI use the same path.
  - `isOver(state)`, `result(state)`, `serialize`, `deserialize` and `replay(config, seed, actions)`.
  - `validate(state)`: checks invariants, such as piece counts matching the pools, no negative values, Stall caps respected and slots consistent.
- The enemy turn runs automatically and is fully determined by the state and its seed.
- A serialized state stays under 50 KB.

### 9.2 Bots
- **RandomBot:** picks uniformly among legal actions.
- **HeuristicBot:** greedy one-step lookahead using the evaluation function below, with simple rules such as protecting regions in the Squeeze and Expand slots and liberating whenever possible.
- **MCTSBot:** Monte Carlo tree search, meaning it simulates many possible futures for each candidate move and picks the move that leads to the best outcomes on average. Hidden deck orders are re-shuffled for each simulation so the bot never "knows" the future. Simulations follow HeuristicBot moves for 2 rounds, then score the position with the evaluation function. The partner's moves inside simulations also use HeuristicBot.
- **AI teammate:** MCTSBot running in a Web Worker so the screen never freezes. Budget: up to 600 simulations or 400 ms per decision, whichever comes first, measured on a mid-range phone. Each AI action shows a one-line reason in the log, built from templates such as "Clearing Doubt in Saltmarsh before it's squeezed next round."
- **Evaluation function**, scoring a position from 0 to 1: a weighted mix of liberated regions and progress towards Kingsmarket, the margin on Public Trust, the margin on Lost Land, progress relative to rounds remaining, total production, enemy pieces on the map (negative) and Stall coverage of the next Squeeze regions. Tune the weights by self-play, keeping the weights that give MCTSBot the highest win rate.

### 9.3 Simulation harness
- `npm run sim -- --games 1000 --bot mcts --difficulty normal --pairs all` runs games headless across Node worker threads (one per CPU core minus one). It writes `sim/reports/<timestamp>.json` and appends a summary to `BALANCE.md`. Simulations may use a lower budget (200 simulations per decision) to save time.
- Metrics to report:
  - win rate by difficulty and producer pair;
  - the share of each loss reason;
  - game length in rounds;
  - the round at which the outcome became settled (4 or more regions liberated, or a loss track within 1 of losing);
  - the purchase rate of each Improvement and the win rate when it was bought;
  - the play rate of each Scheme;
  - the average number of legal actions per decision;
  - crashes and invariant failures, which must be 0.

### 9.4 Balance targets (both producers played by MCTSBot)
- Win rate: Normal 45–60%, Easy 70–85%, Hard 25–40%.
- **Choices must matter:** a pair of RandomBots wins under 5% on Easy, and MCTSBot's Normal win rate is at least 40 points higher than RandomBot's. HeuristicBot sits between them.
- Every one of the 6 producer pairs is within 12 points of the overall Normal win rate.
- Normal games last 8 to 10 rounds on average, and in at least 60% of games the outcome is not settled before round 7.
- No Improvement is bought in more than 70% of games, has a win rate when bought more than 15 points above average, or is bought in fewer than 3% of games. The same limits apply to Schemes, measured by plays.
- Public Trust and Lost Land each cause at least 15% of losses, and running out of time causes at least 10%.
- **Campaign:** HeuristicBot wins chapter 1 in at least 90% of runs, chapters 2 to 4 in at least 70%, and chapters 5 and 6 on Normal in at least 50%.
- **Balance loop:** change at most 3 numbers per iteration, re-run at least 1,000 games, and keep changes that move the metrics towards the targets. Log every iteration in `BALANCE.md`. Stop when the targets are met or after 12 iterations, whichever comes first. If the targets aren't met, ship the closest version and say so in the final report.

## 10. Interface

### 10.1 Screens
- Title: Continue, Campaign, Quick Game, How to Play, Settings, Credits.
- Campaign: the chapter list, showing locked and completed chapters.
- Setup: mode, producers, difficulty and an optional seed.
- Game, Scene (dialogue) and End of game.
- Rules reference: generated from the rules data and searchable.
- Settings: animations, colour-blind patterns, AI speed, and "Reset all data" with a confirmation.

### 10.2 Game screen on a phone (design at 390×844; must work from 360×640 to 430×932)
- **Top bar (fixed):** round x/10, Public Trust, Lost Land remaining, Rift and a menu button.
- **Enemy plan strip:** three small cards, Squeeze, Expand and Scout, showing their region types. Tapping one highlights the matching regions on the map. This is the player's main planning tool and must be obvious.
- **Map:** a square SVG hex flower at full width. Each region shows its type colour, its name, Stalls in producer colours, Outlets, Buyouts, Doubt, Lost Land, any Co-op marker, and a warning badge if it is targeted by the Squeeze or Expand slot.
- **Bottom panel (fixed):** the active producer's portrait, resources with production, actions left (3 dots), and buttons for the 7 actions plus the role ability. Choosing an action enters targeting mode: legal regions or cards glow, everything else dims, a clear Confirm button appears, and Cancel is always visible.
- **Sheets:** Farm (tableau and tag counts), Market (4 Improvements), Cath's Plan (3 Schemes) and Log (turn history with AI reasons and enemy events).
- **Enemy turn:** plays back as a short series of steps, at most 1 second each, each with a caption such as "Squeeze in Highmoor: 1 Lost Land." Tapping skips ahead.
- An Undo button is available during your own turn.

### 10.3 Desktop (1024 px and wider)
Three columns: both producers' farms on the left, the map and enemy plan strip in the centre, and the Market, Cath's Plan and Log on the right. No scrolling at 1280×800.

### 10.4 Visual style
Follow `STYLE.md` for everything visual: colour tokens, fonts, icons, pieces, map, cards, portraits, spacing, motion, words on screen and store assets.

### 10.5 Text
- All rules text is generated from card and rules data, or checked against it by tests.
- Use plain English. Every game term (Squeeze, Expand, Scout, Liberated, Rift and so on) is explained in the rules reference and in a tap or hover tooltip.
- The title screen footer reads: "A work of satire. All places, companies and people are fictional." and "No tracking. Your saves stay on your device."

## 11. Technology and quality gates

### 11.1 Stack
- TypeScript in strict mode, Vite and React. Engine state is the source of truth, and UI state lives in a small store or a reducer. Plain CSS using the custom properties from `STYLE.md`.
- vite-plugin-pwa for the web version (offline play and home-screen install). The "Update ready: reload" prompt appears on the title screen only. The service worker is off inside the iPhone app, where all assets are bundled.
- Capacitor for the iPhone app, with @capacitor/haptics, @capacitor/status-bar, @capacitor/splash-screen and @capacitor/preferences.
- Vitest with fast-check, Playwright (Chromium and WebKit), @axe-core/playwright and the Lighthouse CLI.
- Node LTS and npm, with versions pinned in `package-lock.json`.

### 11.2 Project layout
```
CLAUDE.md  SPEC.md  STYLE.md  OWNER.md  PROGRESS.md  DECISIONS.md  BALANCE.md  README.md
src/engine     rules, state, random number generator, validate (pure TypeScript)
src/content    map, producers, improvements, schemes, agenda, pressure, story, chapters (data)
src/ai         random, heuristic, mcts, evaluation, web worker
src/ui         React app
src/platform   storage, haptics and other web/iPhone differences behind one interface
sim/           simulation harness and reports
tests/         unit and property tests
e2e/           Playwright tests
ios/           Capacitor iPhone project (committed)
store/         App Store text, review notes and screenshots
.github/workflows/  ci.yml, ios.yml, store.yml
public/        icons, manifest assets, privacy and support pages
```
`.gitignore` covers `node_modules`, `dist`, test output, e2e screenshots (but not `store/screenshots`), `.env*` and `*.p8`.

### 11.3 Saves and errors
- **Autosave** after every action through `src/platform/storage`, storing `{version, config, seed, actions}`. The state is rebuilt by replay.
  - On the web this uses localStorage.
  - On iPhone it uses Capacitor Preferences, because iOS can clear web storage when space is low.
  - Keys: `cathnivore:save:v1` and `cathnivore:campaign:v1`.
- If a save fails to load or is from an older version, show "This save is from an older version" with Start New and Try Anyway. Never show a blank screen.
- A **global error screen** catches crashes and offers Resume From Last Autosave, Copy Bug Report (JSON with config, seed, actions and error) and Back to Title.

### 11.4 Gates (every gate must pass before `main` moves)
1. `npm run typecheck` and `npm run lint` are clean.
2. **`npm test`:** a unit test for every action, enemy step, Agenda card, Scheme, Improvement and win or loss rule. A determinism test (the same seed and actions give an identical state), a save round-trip test, and a test that the rules text matches the rules data.
3. **Fuzz:** 10,000 RandomBot games and 1,000 HeuristicBot games, with `validate()` after every step. Zero exceptions, zero invariant failures, and every game ends by round 10.
4. `npm run build` succeeds, and the main bundle is at most 400 KB gzipped, excluding fonts.
5. **Playwright** at 390×844 (WebKit, touch) and 1440×900 (Chromium):
   - the title screen loads with no console errors;
   - campaign chapter 1 is completed by following the tutorial prompts, with the test clicking the highlighted elements;
   - a full Solo Quick Game reaches the end screen, with the test driving the human producer through the UI using HeuristicBot choices and the AI teammate playing itself;
   - Hot-seat: two full turns, undo works, and reloading mid-turn resumes an identical state;
   - chapters 2 to 6 each load, play at least one round, and reach their end screen using a test-only auto-play hook driven by MCTSBot on Easy;
   - offline (web): after the first load, go offline, reload and start a game.
6. **Accessibility:** axe finds no serious or critical issues on the title, setup, game and scene screens.
7. **Performance:** Lighthouse mobile performance score of 85 or more on the production build served locally, and each AI teammate decision takes at most 1 second with 4× CPU throttling.
8. **Visual review:** capture screenshots of every screen at both sizes, plus one map screenshot in greyscale. A subagent reviews them against `STYLE.md` and section 10 and lists problems. Fix anything that makes text unreadable, overlaps other elements, hides a control, or fails the greyscale test.
9. **iPhone:** at each point in section 12 that calls for an iPhone build, the iOS workflow succeeded for that commit (check `origin/ci-status`). Between those points, this gate doesn't apply.

`npm run check` runs gates 1 to 4. `npm run gates` runs gates 1 to 8.

### 11.5 Web deployment (Vercel, free Hobby plan)
- **Set up by the owner before the run:**
  - this repository is connected to a Vercel project with production branch `main`;
  - cathnivore.com points at that project;
  - the project's Vercel address is recorded in `OWNER.md`.
  
  Vercel builds and deploys every push by itself: `main` goes to production, and other branches get preview addresses. Sessions have no Vercel access and don't need it.
- **M0:**
  - add `vercel.json` with the build command `npm run build`, output folder `dist`, fallback to `index.html` for app routes, and cache headers (hashed assets cached as immutable, `index.html` never cached);
  - add security headers: a Content-Security-Policy allowing only the site itself (plus `data:` where fonts or images need it), `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`;
  - make every build write `dist/version.json` with the commit hash and build time;
  - release a holding page ("Cathnivore. Coming soon.") so the domain works from day 1.
- **Releasing (`npm run release`):**
  1. run `npm run gates`;
  2. fast-forward `main` to the current `build` commit and push;
  3. poll `https://cathnivore.com/version.json` until it shows the new commit (up to 10 minutes);
  4. run the live smoke test: the title loads, a Quick Game starts, one action is taken, and there are no console errors;
  5. tag the commit `deploy-<n>` and add a line to the deploy log in `PROGRESS.md`.
  
  If the smoke test fails, push a revert commit on `main` back to `deploy-<n-1>` (never force-push), log it, and fix the problem on `build`. If the domain isn't resolving yet (DNS changes can take hours), use the Vercel address from `OWNER.md` and retry the domain next session.
- **Pages the App Store needs,** served by the site in the `STYLE.md` look:
  - `/privacy`: no data collected, no tracking, saves stay on the device;
  - `/support`: how to play, plus the support email from `OWNER.md`.
- **Also ship:** a favicon, web app icons, a web manifest and the social preview image.

### 11.6 iPhone app and App Store
- **Set up by the owner before the run:**
  - Apple Developer Program membership;
  - the bundle ID registered;
  - the app record created in App Store Connect;
  - App Privacy answered as "Data Not Collected";
  - an App Store Connect API key with Admin access;
  - GitHub Actions secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` and `APPLE_TEAM_ID`.
  
  The bundle ID, app name and support email are in `OWNER.md`.
- **App shell:** a Capacitor iOS project in `ios/` using the bundle ID from `OWNER.md`.
  - All game assets are bundled, so the app works fully offline and never loads the website.
  - iPhone only (`TARGETED_DEVICE_FAMILY = 1`) and portrait only.
  - Status bar and safe areas handled. Launch screen, icon and haptics per `STYLE.md`.
  - No text selection or long-press callouts, no pinch zoom, and no web behaviour such as whole-page rubber-band scrolling or link previews.
  - `ITSAppUsesNonExemptEncryption` is false. The version is 1.0.0 and the build number is the workflow run number.
  - The only links out are Privacy and Support, which open in Safari.
  
  **Why this matters:** Apple rejects apps that feel like a repackaged website (App Review Guideline 4.2). This app must feel native: bundled, offline, no browser chrome, haptics and a proper launch screen.
- **`ci.yml`** (Ubuntu, on every push to `build` and `main`): typecheck, lint, unit tests, quick fuzz and build. It's cheap, so it always runs.
- **`ios.yml`** (macOS, only when a tag `ios-<n>` is pushed, or run manually):
  1. `npm ci`, build, then `npx cap sync ios`;
  2. write the API key from secrets to a temporary file;
  3. archive with `xcodebuild` using automatic signing authorised by the API key (`-allowProvisioningUpdates` with the authentication-key flags), with `DEVELOPMENT_TEAM` set from `APPLE_TEAM_ID`;
  4. export with an `ExportOptions.plist` whose destination uploads to App Store Connect, so the build lands in TestFlight;
  5. delete the key file.
  
  If signing fails in a way that can't be fixed from the workflow, log it under Blocked and continue with the web version (cut 7).
- **`store.yml`** (Ubuntu, when a tag `store-<n>` or `submit-<n>` is pushed):
  - using the API key, upload the App Store text from `store/` (name, subtitle, description, keywords, promotional text, support URL, privacy URL, age rating answers, review notes) and the screenshots;
  - attach the latest processed build;
  - on `submit-<n>`, also submit version 1.0.0 for App Review with **manual release**, so the owner decides when it goes live after approval.
  
  Use fastlane deliver or a small script against the App Store Connect API, whichever works. Record the choice in `DECISIONS.md`.
- **Reporting back:** every workflow run ends by force-pushing a short JSON summary to `status/<workflow>.json` on the branch `ci-status`. It contains the workflow, tag, commit, success or failure, build number, and the last 150 lines of the log on failure. Sessions read it with `git fetch origin ci-status` and `git show origin/ci-status:status/ios.json`.
- **Build budget:** the repository is private, and GitHub's free allowance covers only about a dozen macOS builds a month. Push `ios-<n>` tags only at the points in section 12, or after fixing a failed iOS build, with at most 8 iOS builds in the whole run. Apart from the day-1 signing check, iPhone builds start only once the web version is feature-complete (end of M5). The Ubuntu workflows are cheap and can run freely.
- **Store text** (in `store/`):
  - limits: subtitle 30 characters, description 4,000 characters, keywords 100 characters;
  - plain English, saying clearly that the game is satire and every company and person in it is fictional;
  - age rating: answer the questionnaire truthfully (no violence, no mature content, mild satire);
  - review notes: what the game is, that there is no login, how to start the tutorial, and that all companies and people are fictional.
- **Screenshots:** generated by Playwright from scripted game states, at the size Apple currently requires for the largest iPhone, following `STYLE.md` section 13. Commit them to `store/screenshots/`.
- **The run ends at submission.** Apple's review happens afterwards. The final report states the build number, what was submitted, and what the owner should do if App Review asks questions or rejects the build.

## 12. Milestones and schedule
Times are counted from the run's start, which is `DEADLINE` minus 7 days. If a milestone runs over, cut scope under rule 1.12. Never skip gates.

- **M0 Setup (hours 0–4):**
  - repo, tooling, npm scripts, the `build` branch, the lock, `DEADLINE` and `PROGRESS.md`;
  - `vercel.json`, `version.json` and the holding page released to `main`;
  - `ci.yml`, `ios.yml` and `store.yml`, and the Capacitor iOS shell wrapping the holding page;
  - push `ios-1` to prove that signing and upload to TestFlight work end to end. This is the only iPhone build before the web version is complete: signing is the likeliest blocker in the whole run, and finding it on day 6 would leave no time to work around it.
- **M1 Engine (day 1):**
  - the full rules of section 4 with starter content: 4 producers, 24 Improvements, 18 Schemes, 8 Hollowell and 8 Candor Agenda cards, and 10 Pressure cards;
  - unit tests and the fuzz gate.
- **M2 Bots and simulation (first half of day 2):**
  - RandomBot, HeuristicBot and MCTSBot;
  - the simulation harness and the first balance report.
- **M3 Playable game (second half of day 2 to day 3):**
  - the game screen on phone and desktop, and the setup screen;
  - Solo and Hot-seat modes, saves and undo;
  - enemy turn playback and the rules reference.
  - Release to `main`. **From here, cathnivore.com has a playable game.** No iPhone build yet: until M5 ends, the WebKit tests at iPhone size stand in for the iPhone.
- **M4 Full content and balance (day 4):**
  - full card counts and difficulty levels;
  - the balance loop run to the targets.
  - Release.
- **M5 Campaign (day 5 to first half of day 6):**
  - the scenario system, portraits, scenes and tutorial prompts;
  - chapters 1 to 6, with their twists and carry-over.
  - Release after chapters 1 to 3, and again after chapters 4 to 6. This completes the web version.
  - Then push `ios-<n>` for the first full iPhone build. Fix anything iPhone-specific (safe areas, storage, haptics, the launch screen) on `build`, with at most 3 fix builds.
- **M6 Polish and store assets (second half of day 6):**
  - animations, fixes from the visual review, accessibility and performance;
  - web install and offline play; icons, launch screen and haptics;
  - the privacy and support pages, store text and screenshots.
  - Release, push `ios-<n>`, then push `store-<n>`.
- **M7 Hardening (final 18 hours; no new features):**
  - a long fuzz run of 50,000 RandomBot games, the full end-to-end suite on both sizes, and a final balance report;
  - a README covering how to play, how to run it locally and how it was built;
  - the final release and live smoke test, then the final `ios-<n>` build;
  - push `submit-<n>` to send that build for App Review;
  - the final report in `PROGRESS.md`, covering what shipped, what was cut, known issues and the owner's next steps;
  - finally, create `DONE`.

## 13. PROGRESS.md template
Create it in M0. It has these sections:
- **Current milestone.**
- **Tasks:** every task from section 12, broken into checkboxes of 2 hours or less.
- **Blocked:** anything waiting on retries, with notes.
- **Deploy log:** tag, time, URL and smoke test result for each deploy.
- **Final report.**

## 14. Not in v1
Online play on separate devices, accounts, leaderboards, sound and music, translations, more than 2 producers per game, more enemy factions, painted or illustrated art, an iPad-specific layout, Android, in-app purchases, ads and analytics.

## 15. The cathnivore.com games portfolio (added by the owner, 2026-09-27)
The owner turned cathnivore.com into the landing page for a small portfolio of games. This section overrides anything above that says the game is served at the site root.

- **Site layout.** `/` is the games landing page (`site/`): a full-screen WebGL animation of hexagonal farmland at dusk, the title, and one card per game. `/cathnivore/` is Cathnivore. `/runnel/` is Runnel (`games/runnel/`). `/privacy`, `/support`, `/fonts`, the icons and `version.json` stay at the root.
- **Builds.** `npm run build` still builds Cathnivore alone at `/` into `dist/`; the iPhone app, the Cathnivore e2e suite and gates 5-8 use it unchanged. `npm run build:site` (`scripts/build-site.ts`) builds the whole website into `dist-site/`, which is what Vercel deploys. It also writes a self-removing `sw.js` at the root, which moves players who have the pre-portfolio offline copy of Cathnivore on to the new site. Never remove it.
- **Runnel** is a finished daily hex irrigation puzzle: turn the channels so water from the central spring reaches every tile with no spills. There is one Daily puzzle per UTC day (Daily #1 was 2026-09-27) plus Practice in three sizes. Logic lives in `games/runnel/src/engine.ts` and is tested in `tests/runnel.test.ts`. The site suite (`npm run e2e:site`, run by gate 5) covers the landing page, Runnel and the game under `/cathnivore/`. Maintain it like the rest of the site: fix bugs, keep its tests green, no new features after M7 starts.
- **Releases.** `npm run release`'s live smoke test checks the landing page, turns a tile in Runnel, and then runs the Cathnivore Quick Game check at `/cathnivore/`.
- **The iPhone app** is still Cathnivore only. Its links out are still just Privacy and Support; the web version's title screen also links to `/` ("More games").

## 16. Continuous improvement (owner decision, 2026-09-28): the run never ends
The owner wants the hourly routine to **keep improving and beautifying the games indefinitely, until they are world-class** (`VISION.md`). This section overrides every earlier rule that ends the run or freezes features.

**What changes**
- **No end.** Never create `DONE`; if it exists, delete it and log why. `DEADLINE` now only marks the original v1 launch date. The "less than 18 hours left: M7 only" rule and the M7 "no new features" rule no longer apply. Section 12's milestones are history.
- **What to work on,** in this order:
  1. an open note in `FEEDBACK.md` (the owner's voice);
  2. anything broken: red CI, a failing gate, a live-site bug, a save or rules bug;
  3. the first unfinished item in `ROADMAP.md`.
  Section 14's "Not in v1" list is lifted where `ROADMAP.md` schedules an item (for example, sound).
- **How to work:** in slices that each leave `build` green and the game better (VISION.md principles). Put a redesign that can't be finished in one session behind a setting or feature flag, or develop it in a new component that isn't wired in yet, rather than shipping it half done.
- **Visual work** is checked with `npm run shots` (every screen at phone and desktop) before and after, plus dark mode where the change touches colour. For anything bigger than a small tweak, have one subagent critique the "after" screenshots against `VISION.md` and `STYLE.md`, then fix what it flags.
- **Releases:** run `npm run release` whenever a slice is complete and every gate passes, at most 4 times a day (Vercel's 100-deploys-a-day limit and the owner's usage). Never leave `main` behind `build` for more than a day without a logged reason.
- **iPhone App Store launch: postponed by the owner (2026-09-28)** until the games are truly impressive. Don't dispatch `ios.yml` or `store.yml`, and don't work on store listings or store screenshots, until the owner reopens the launch in `FEEDBACK.md`. Keep `npm run build`, the iPhone app's web bundle, passing. When the launch reopens: at most 2 `ios.yml` builds a week.

**What doesn't change:** section 1's autonomy rules (never ask; decide and log), the build lock, the priority order in 1.3, the gates in 11.4, save compatibility (a migration and a test for any change to the save format), rules correctness, at most 2 subagents at once, and no secrets.

**Keep the notes short, or every session pays to read them.** v1's notes are archived in `docs/archive/` (read them only by searching, never in full). From now on:
- `PROGRESS.md` stays under 150 lines, with four sections: **Now** (current ROADMAP item, status, next step), **Blocked**, **Recent releases** (last 10), **Session log** (last 15 sessions, one or two lines each). Delete older lines; git keeps them.
- `DECISIONS.md` stays under 250 lines, newest at the bottom, each entry at most 5 lines. When it goes over, move the oldest entries to `docs/archive/DECISIONS-<YYYY-MM>.md`.
- `BALANCE.md` stays under 300 lines; archive older runs the same way.
- `CLAUDE.md` stays under 150 lines.
