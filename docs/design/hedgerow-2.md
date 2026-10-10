# Hedgerow 2: Second Planting

Owner, 2026-10-10: "research and try Bloons TD 5 and 6. Somehow these are way more addictive than Hedgerow. Why? Upgrade our game and build it." The diagnosis and design below were written by a research workflow: two Bloons TD research reports, a code audit and a headless play-through of Hedgerow, then three independent redesigns (loop, progression, feel) scored and merged by a judge. The research appendix is in `hedgerow-2-research.md`. **This doc is the spec for ROADMAP Phase H.**


I checked these against the code on `build` (`games/hedgerow/src/`). File and line references are given where a decision depends on them.

1. **Damage you can see, and a reward on every hit.** In Bloons a hit removes one visible layer, plays a pop sound and pays $1. Big enemies burst into children, and leftover pierce hits those children in the same instant. That gives hundreds of small wins a second, and income comes from what you watch.
   - Hedgerow's enemies are health pools: a van has 98 HP (`engine.ts:278`) and bosses 1,800–8,000.
   - Pay is per kill (`bounty`, `engine.ts:~2582`), shot sounds are capped at 2 per step (`main.ts:1256`), and nothing changes on screen until the enemy dies.
   - The pieces we need already exist in another form. `splits` spawns children at `e.dist - i*0.35` (`engine.ts:2592`), and the sim runs in fixed 1/30 s steps (`engine.ts:7`), so layers can be added without breaking determinism.
2. **Every round asks one question, and the rounds are the same every time.** Fixed numbered rounds teach "camo comes at 24" and "the first MOAB is at 40". A loss gets a cause and a fix, which drives the "one more try" loop.
   - `ramp()` (`levels.ts:134`) puts every enemy type of the act into every wave. One balanced build wins everywhere: from act 5 on, the bot's field is always about 4 Masts, 5–9 Hedgerows and 10–19 Scarecrows.
3. **Every tower is a build you plan and save for.** Bloons gives 3 paths, a 2-path crosspath limit and a unique top tier that is a visible goal worth several rounds of saving.
   - Hedgerow has 3 linear tiers at about ×1.5 each (`TowerSpec`, `engine.ts:50`) and one binary spec (`SPECIALISATIONS`, `engine.ts:525`). A tower makes about 4 decisions in its life, and the tiers look almost the same.
4. **Counters are hard locks you can read.** In Bloons each property has a look, an immunity and one obvious key.
   - Hedgerow uses soft multipliers (`TOWER_VS`, `engine.ts:2014`, ×0.3–1.8), so a generalist build still works and a loss teaches nothing.
   - Units carry no property icons and towers carry no badges. A leak shows only "-1 Goodwill".
5. **There is a decision every few seconds and no dead time.** Bloons has short rounds, money that streams in, Go and stack-the-next-round, 3× speed, and a visible price tag on the next upgrade.
   - Hedgerow has 5–9 waves of 12–135 s. In level 1 the player could afford nothing for 148 of 170 s.
6. **"Press it now" moments and real stakes.** Bloons has manual abilities, enough lives to bleed slowly, and leaks that cost what leaked.
   - In Hedgerow, `abilityBrain` (`engine.ts:2260`) casts everything itself and auto-continue fires after 6 s (`AUTO_SECS`, `main.ts:269`).
   - `heroBrain` (`engine.ts:2238`) walks Cath to the lead enemy, so she takes the kills.
   - With Goodwill at 10 and leaks costing 1, level 1 gives 3 stars without effort.
7. **Difficulty comes from new problems, not HP inflation.** Hedgerow's `HP_SCALE` swings from 0.48 to 10.98 and is not monotone. No new regular enemy arrives after level 61, and lobbyist, carrier and rival appear only on level 80.
8. **Goals nested on every timescale.** Bloons layers pops, rounds, maps, medals per mode, tower XP, Knowledge, collectible pre-built towers and events. Hedgerow has stars, small % perks and nothing per tower.

Three code facts the plan depends on (all verified):
- `TowerSpec.pierce` already exists as a **boolean meaning "ignores armour"** (`engine.ts:70`). It has to be renamed (`ignoresArmour`) before a numeric pierce is added.
- The 3D renderer builds a **cloned Group plus a health bar per enemy** (`render3d/index.ts:~1150–1170`). Only debris and fx are instanced. Hundreds of units need instanced rungs first.
- Replays are `v: 1` (`replay.ts:50`) and saves are `version: 2` (`store.ts:10`). Both need versioned migrations.

---

# The design: "Hedgerow: Second Planting"

**One idea.** Grabwell/Candor's fleet is a stack of parts. Every hit knocks one off with a sound and a Mark. Every round asks one readable question. Every tower is a build you plan, save for and show off. Cath is the general you place and play.

No Bloons terms appear anywhere: not in the UI, the Almanac, code comments or the colour order. We use "Fleet Value (FV)", "Knockouts", "Crown", "Heirloom" and "Round Book".

## 1. The Fleet (new `fleet.ts`)

**How damage works:**
- One point of damage removes one layer. Overflow carries into the first child.
- Children spawn 0.06 cells apart behind the parent, in a fixed order. Leftover pierce may hit them in the same tick.
- Each layer removed pays **1 Mark** and adds 1 to the tower's **Knockouts**.
- **FV** is the total number of layers, children included. It sets round budgets, leak cost and income.

| Rung | Look | Shell HP | Children on pop | FV | Speed (cells/s) |
|---|---|---|---|---|---|
| Courier | e-scooter rider | 1 | – | 1 | 0.9 |
| Hatchback | small car | 1 | Courier | 2 | 1.2 |
| Van | today's white van model | 1 | Hatchback | 3 | 1.5 |
| Pickup | open pickup | 1 | Van | 4 | 2.3 |
| Sprinter | violet "Same-Day" rush van | 1 | Pickup | 5 | 2.6 |
| Box Lorry (variants: Wrapped / Sealed / Reefer) | navy box | 1 | 2 Sprinter | 11 | 1.6 |
| Plated Lorry | riveted steel | 1 | 2 Box Lorry | 23 | 1.0 |
| Artic | Wrapped + Reefer | 1 | Wrapped Lorry + Reefer Lorry | 23 | 1.6 |
| Car Transporter | double deck | 1 | 2 Artic | 47 | 2.0 |
| Skip Truck | rust skip, cracks visibly | 12 | 2 Car Transporter | 106 | 2.2 |
| **Bulldozer** (Plant) | giant Candor yellow | 180 | 4 Skip | 604 | 0.9 |
| **Crane Convoy** (Plant) | red and white | 650 | 4 Bulldozer | 3,066 | 0.3 |
| **Tunnel Borer** (Plant) | black | 3,600 | 4 Crane | 15,864 | 0.18 |
| **Exec Car** (Plant) | black and chrome; Stealth + Plated + Wrapped | 360 | 4 Stealth Rebrand Skip | 784 | 2.4 |
| Drone / Quadcopter / **Carrier** | Airborne versions | 1 / 1 / 60 | – / 2 Drone / 6 Quad, plus 2 Drones every 5 s | 1 / 3 / 78+ | 1.8 / 1.6 / 0.6 |

**Disruptors** keep the satire: Influencer (charm), Lawyer (jam) and Lobbyist (lobby) ride Hatchback-rung cars with low FV. They appear as themed rounds in acts 3, 7 and 8, and are never filler.

**Bosses:** the 10 bosses and their `BOSS_MOVES` stay. Each becomes a phased Plant with one long bar and drops a scripted escort at 66% and 33%.

**Damage types.** Every attack has exactly one:
- **Sharp:** pecks, thorns, millstones
- **Blast:** shells, pumpkins
- **Sting:** bees, poison
- **Chill:** pond freeze and slow
- **Gust:** push, low damage
- **Crush:** Silo; slow and single-target, hits Plated and Wrapped
- **Writ:** Courthouse only; low damage, hits everything

**Control** (slow, stun, push, hold) is tracked separately.

## 2. Properties and the counters matrix

Each property has its own material and a 10 px icon row above the unit, drawn in both renderers.

| Property | Look | Lock |
|---|---|---|
| Stealth | hedge-camo, 60% alpha | can't be targeted without detection; passed to children |
| Plated | steel and rivets | immune to Sharp |
| Wrapped | glossy bubble wrap ("it cushions explosions") | immune to Blast |
| Sealed | purple mesh grille | immune to Sting |
| Reefer | frost box | immune to Chill and all Control except a Writ hold |
| Airborne | drone | only Air-badged towers can hit it |
| Reinforced | hazard bands | layer and shell HP ×2 (not immune) |
| Rebrand | spinning logo pip | regains 1 rung every 3 s up to its start; passed to children |
| Heavy Plant | – | no push, knockback or hold; slows half as effective |

Who can hit what (✔ hits, ✖ immune, ½ half effect):

| | Sharp | Blast | Sting | Chill | Gust | Crush | Writ |
|---|---|---|---|---|---|---|---|
| Plated | ✖ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Wrapped | ✔ | ✖ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Sealed | ✔ | ✔ | ✖ | ✔ | ✔ | ✔ | ✔ |
| Reefer | ✔ | ✔ | ✔ | ✖ (and no slow) | push ✖ | ✔ | ✔ (hold ✔) |
| Artic (Wrapped + Reefer) | ✔ | ✖ | ✔ | ✖ | ✖ | ✔ | ✔ |
| Heavy Plant | ✔ | ✔ | ✔ | slow ½ | push ✖ | ✔ + anti-Plant bonuses | ✔ |

**Detection:** Radio Mast (any tier), Scarecrow Lookout T2, Beehive Scent T2, Silo Spotter T2, and Cath within 1.6 cells.

**Air:** Scarecrow, Beehive, Windmill, Cannon Flak T2, and Silo.

**Readability:**
- Tower cards show green or red badges for every property.
- The round preview names the next 2 rounds with their property icons.
- A "Your field can't answer this" warning appears when no placed tower holds the key.
- **Leak report:** the first leak in a round slows the game to 0.4× for 0.6 s and shows a banner such as "Leaked: Stealth Van (3). Nothing could see it. A Radio Mast or Scarecrow Lantern Eyes reveals stealth."
- The loss screen lists the top 3 leak causes, highlights the counter for each, and offers **Retry from round N**.

## 3. Towers: 10 towers, 3 paths × 4 tiers

**Crosspath rule:** a tower may buy into at most 2 paths, and only one of them may go past tier 2. Builds look like 4-2-0, 2-0-4 or 3-2-0: 6 of 12 upgrades.

**Crown rule:** tier 4 is a **Crown**, and each specific Crown may exist once per field. A Crown brings a new model, a sting in the music and usually an ability.

**Costs** as multiples of base: T1 ≈ 0.5×, T2 ≈ 1.0×, T3 ≈ 5×, T4 ≈ 100×. Prices are scaled by difficulty and rounded to 5.

**What each tier adds:** T1 and T2 are stat changes you can see, plus one utility on T2 (detection, air, plating); this is where crosspath dilemmas come from. T3 adds a new behaviour and a new silhouette. T4 transforms the tower.

The path data lives in a new `paths.ts`. `Tower.path: [a, b, c]` replaces `tier/spec`. Old saves and replays map each spec to its nearest path.

**Roster (all 10 unlocked by level 24).**
- The game's namesake **Hedgerow** tower stays as the lane-edge trap and slow tower and absorbs the Co-op Barn.
- The Radio Mast stays (its model and story references are reused) and absorbs the Clinic Tent.
- The Union Hall becomes a Market Stall Crown.

| Tower (unlock) | Base | Damage type | Role |
|---|---|---|---|
| Scarecrow (1) | 200 | Sharp, Air | single target and pierce |
| Hedgerow (1) | 150 | Sharp thorn piles / Control | stall and slow |
| Beehive (2) | 300 | Sting, Air | swarm, poison |
| Seed Cannon (4) | 500 | Blast | splash |
| Windmill (6) | 450 | Gust, Air | push, anti-air |
| Market Stall (8) | 800 | – | economy |
| Radio Mast (11) | 400 | – | detection, vulnerability, buffs |
| Duck Pond (14, water plots or a Pond Tub) | 400 | Chill | freeze, slow |
| Grain Silo (18) | 550 | Crush | long-range sniper, anti-Plant |
| Courthouse (24) | 750 | Writ | strips properties, holds Plant |

**Scarecrow in full** (base: damage 1, pierce 2, range 2.4, 0.9 s):

| Path | T1 | T2 | T3 | T4 Crown |
|---|---|---|---|---|
| Flock | Sharp Beaks, +1 pierce (100) | Quick Crows, rate ×1.3 (200) | Crow Caller: 3-crow fan, pierce 4, every 3rd shot crits ×3 (1,000) | **Murder of Crows** (20,000): 12 homing crows, damage 2, pierce 6. Ability *Blackout Sky*: ×3 rate for 8 s, 45 s cooldown |
| Lookout | Tall Hat, +25% range (90) | Lantern Eyes: sees Stealth (220) | Hawk Post: map-wide, damage 4, Crush talons crack Plated (1,200) | **Falconer** (24,000): damage 30, ×3 vs Plant. Ability *Stoop*: 2,500 to the strongest Plant, 40 s cooldown |
| Scythe | Quick Arms, rate ×1.25 (110) | Two Hands, rate ×1.5 (240) | Whirling Scythe: 360° sweep every 0.4 s, pierce 8 (1,300) | **Wicker Giant** (28,000): flails at 6 attacks/s, pierce 8. Ability *Stand Up*: Scarecrows within 3 cells get ×3 rate for 8 s |

**Seed Cannon in full** (base: Blast, damage 1, splash 1.0 with pierce 18, range 3.3, 1.6 s, ground only):

| Path | T1 | T2 | T3 | T4 Crown |
|---|---|---|---|---|
| Big Shells | Bigger Bore, splash 1.3 (250) | Heavy Shells, damage 2 (450) | Pumpkin Lobber: damage 4, splash 1.5, 0.3 s stun on non-Plant (2,400) | **Harvest Festival** (45,000): aimed anywhere. Ability: a 30-shell barrage, 50 s cooldown |
| Flak | Fast Loader, rate ×1.25 (200) | Air Burst: hits Air (300) | Scatter Shot: shells split into 8 Sharp seeds, so it answers Wrapped (1,900) | **Seed Storm** (38,000): continuous fire, damage 2 |
| Wrecker | Long Barrel, +0.5 range (150) | Shell Cracker, ×2 vs shells (500) | Wrecking Shot: damage 12 vs Plant with knockback 0.5 (2,600) | **Demolition Order** (50,000): 60 per hit. Ability *Condemn*: 1,500 to one Plant, 45 s cooldown |

**The other eight towers**, given as path → T2 utility → T3 behaviour → T4 Crown. Costs follow the same multiples.

**Beehive**
- Killer: poison 1 layer/s → Killer Queen, poison that spreads on pop → **Queen of Thorns**
- Honey: slow 35% (Control) → Honey Marsh lane patch → **Golden Flood**, an ability that glues non-Plant for 6 s
- Scent: sees Stealth → Pollinator, ×1.15 rate aura → **Royal Jelly**: hive Sting ignores Sealed, +1 pierce aura

**Hedgerow**
- Blackthorn: thorn piles of 8 hits → 20-hit piles → **Hawthorn Wall**, which stops a Plant for 4 s
- Bramble Maze: slow 40% → maze, slow 55% → **The Labyrinth**
- Haybale: holds non-Plant 1 s → Tractor Shed, knockback rams → **Tractor Run**: tractors drive up the lane

**Windmill**
- Storm Sails: push → Storm Sails T3 → **Tempest**, an ability that blows every non-Plant back 40%
- Mill Stones: pierce 6 → grind that strips Wrapped → **Grindstone Titan**
- Wind Pump: +60 Marks per round → a rate aura → **Wind Farm**, +1,500 per round

**Duck Pond**
- Freeze: 1 s → shatter, frozen units take ×2 → **Frost Fair**, a 3 s lane freeze on a 60 s cooldown
- Mud: slow that works on Plant at 50% → **Bog of Ages**
- Geese: Sharp melee with knockback → **Goose Army**, geese that roam the lane

**Grain Silo**
- Elevator: damage 6 → strips Reinforced → **Combine**, a damage 18, pierce 8 line shot
- Spotter: sees Stealth → crit mark → **Eye of the Shire**: global detection and +25% damage taken
- Supply: Marks crates → **Harvest Airlift**

**Market Stall** (base +80 per round; pays back in about 10 rounds)
- Produce: tap-to-collect crates → **County Fair**, +4,500 per round
- Bank: 10% interest, cap 6,000, withdraw by hand → **Credit Union**, no cap
- Co-op: +Goodwill per round, -8% cost to towers in range → **Union Hall**, a global +15% damage aura

**Radio Mast**
- Pirate Radio: reveal plus +25% damage taken → **Broadcast Tower**, a global reveal with ×1.5 damage taken
- Clinic: cleanses charm and jam, +range aura → **Field Hospital**, immune to boss disables, +Goodwill
- Siren: +15% rate aura → **Air-Raid Siren**, an ability giving every tower ×2 rate for 10 s

**Courthouse**
- Injunction: holds Plant 2/3/4 s → **Supreme Injunction**: every Plant held 6 s and bosses 3 s
- Cease & Desist: freezes Rebrand → **Gag Order**, which stops all regrowth
- Compulsory Purchase: strips Reinforced and Plated in an aura → **Public Inquiry**, a 1,500 beam every 10 s

**Heirlooms** (today's megastructures as the end-game prize). The 8 recipes and their models stay. A merge now needs 2 orthogonally adjacent towers of the recipe, each holding a Crown, plus 60,000 Marks. Every other tower of those two kinds that is sacrificed adds +2% power. Heirlooms open from act 4 and are limited to one per field.

**Targeting:** First, Last, Strong, Close, plus **Plant** on anti-Plant paths, one tap away.

**Cut:** Veteran ranks (`RANKS`), the Scarecrow crowding penalty and `TOWER_VS`.

## 4. Economy

| Item | Value |
|---|---|
| Starting Marks (Book run) | 500 |
| Pop income | 1 Mark per layer; ×0.5 in rounds 51–60, ×0.2 in 61–75, ×0.1 from 76 (fixed-point, paid as whole Marks) |
| Round bonus | 60 + round number |
| Early send | pressing Go during a round stacks the next one and pays 10 + r |
| Sell | 70%; 100% if sold before the round it was bought in ends |
| Price multiplier | Easy ×0.85, Normal ×1, Hard ×1.1, Hollow ×1.2 |
| Goodwill | Easy 200, Normal 120, Hard 80, Hollow 1. A leak costs the leaker's remaining FV |

- **Greed against safety:** Market Stall, Bank interest that has to be withdrawn by hand, Wind Pump, and the income falloff after round 50.
- **The goal gradient:** every path's next tier shows its price, a fill bar, an "affordable" glow, and "affordable in about N rounds" based on the last 3 rounds' income.

## 5. Rounds: one canonical Round Book (new `rounds.ts`, replaces `ramp()` and `HP_SCALE`)

**The Book:**
- 80 hand-authored rounds, the same on every play, then **Freeplay**, where Plant HP rises 2% a round from round 81.
- Rounds last 10–35 s at x1.
- **Budget:** FV(r) ≈ 18 · r^1.5 · saw(r), where saw(r) is 0.6 on a breather, 1.6 on a spike and 1.0 otherwise. That gives about 18 at round 1, 570 at round 10, 4,500 at round 40 and 12,900 at round 80, plus the finale.
- Every round has a theme and a one-line card, for example "Round 22: Stealth Vans. Bring a Radio Mast or Lantern Eyes."

**Rounds to remember:**

| Round | What arrives |
|---|---|
| R6 | Sprinter rush (speed) |
| R8 | first Wrapped (existing bubble-wrap lore) |
| R10 | first Box Lorry split |
| R12 | drone swarm (Air) |
| R15 | Sealed |
| R18 | Reefer |
| R22 | first Stealth |
| R26 | Plated |
| R30 | Rebrand |
| R33 | Artic |
| R35 | breather |
| **R36** | **first Bulldozer** |
| R42 | Reinforced |
| R48 | Rebrand Skip flood |
| R53 | breather |
| **R54** | **Crane Convoy** |
| R57 | three tight Skip rushes (one ability can't answer all of them) |
| **R62** | **Exec Car** |
| R70 | Reinforced Plants |
| R74 | Carrier wing |
| R77 | breather |
| **R78** | **Tunnel Borer** |
| R80 | mixed finale |

**Story levels play a window of the Book:**
- Length L(n) = min(30, 12 + ⌊n/5⌋). The window ends at E(n) = min(80, 12 + round(0.68(n−1))).
- So level 1 plays rounds 1–12, level 50 plays 24–45, and level 100 plays 51–80.
- Each act swaps about 3 Book rounds for act-themed ones (Influencer parade, Lawyer escort and so on). Twists and set pieces stay.
- Boss levels end on a boss round.
- **Start Marks** = 500 + k · (the Book's income before the start round). The tuner fits k within [0.7, 1.0], monotone within each act. It **never tunes HP**.
- A story level takes about 4–10 min at x1, or 2–4 min at x3.

**Controls:**
- One bottom-right button: **Go**, then **x3**, then back to x1. Pressing it during a round stacks the next one.
- x5 unlocks once you have won the level. On phones, high speed is capped while more than 350 units are alive.
- **Keep Going** auto-send (see "What changes" below for the default).
- **Resume:** a snapshot at each round start (`store.ts`). The title shows "Continue: Orchard Lane, round 37". "Retry round" is available except in Hollow.

## 6. Cath, the hero

**Placement:**
- Cath is placed free, once per run, on a post. She can be dragged to a new post between rounds.
- She never walks to the spawn. She re-aims from her post, sees Stealth within 1.6 cells and holds up to 2 non-Plant units.
- Her attack depends on her kit. She should do about 10–15% of the damage; a test enforces under 20%.

**Levels 1–20 inside a run:**
- XP per round = 20 + 4r. Reaching level L takes 40·(L−1)^1.7 cumulative XP, which puts her at about level 10 by round 24 and level 20 by round 50.
- Levels can be bought for Marks at 1.5× their XP.
- Story levels start her at the Book XP for their start round.

| Level | Unlock |
|---|---|
| 3 | **Pie**, aimed by hand: radius 1.7, stuns non-Plant 3 s, removes 3 layers; 30 s cooldown |
| 5 | kit passive |
| 7 | **Call the Neighbours**: a barricade that holds non-Plant 6 s; 50 s cooldown |
| 10 | **Kit signature ability** |
| 14 | kit passive 2 |
| 20 | **Last Orders**: every non-boss loses 2 rungs and Plants lose 25%; 120 s cooldown |

**Kits** are chosen on the level card. Each one is dressed by a wardrobe outfit, which gives the wardrobe real teeth:

| Kit (unlocked at) | Attack | Level 10 ability | Steers you toward |
|---|---|---|---|
| Baker (L1) | scones, Blast, pierce 3 | Bake-Off: Blast towers ×1.5 rate for 15 s | Cannon, Silo |
| Rambler (L15) | stick, Sharp | Right to Roam: global reveal, Sharp +2 pierce, 12 s | Scarecrow, Windmill |
| Organiser (L35) | none; +40 → +300 Marks per round | Village Fete: layers pay ×2 for 20 s | Market, Mast |
| Campaigner (L60) | megaphone, slow 20% | Public Inquiry: all Plant stunned 4 s and taking ×1.3 | Courthouse, Mast |

**The Cath RPG (`cath.ts`) stays,** because the owner asked for it in round 3 and ROADMAP H3 calls for it. Its effects are re-pointed:
- strength → attack
- baking → pie
- leadership → kit aura
- wits → early-send bonus
- grit → hold time
- pace → move time between posts

Talents become kit variants, for example *Double Batch* gives the Pie 2 charges.

**Boss duels** stay as each boss's intro. A perfect duel pays +150 Marks and takes 10% off the boss. The auto-strike after 4 s stays.

## 7. Abilities

- A thumb-reach **ability tray** holds Cath's abilities first, then tower Crown abilities. Ready buttons glow and give a haptic tick, and pulse during spike rounds.
- Cooldowns run in game time and carry across rounds. A newly bought ability starts at 50% charge.
- **Manual by default.** Each ability gets an **Auto** toggle (long-press) once it has been cast by hand 3 times.
- Spike rounds such as R57 are tuned so one ability can't answer the whole round.

## 8. Feedback and juice spec

**Pops:**
- On every pop the rung model swaps on the same frame (an instanced material and part swap).
- A burst of 4 particles in the colour of the next rung down (12 for a Skip).
- A pop sound pitched by rung, ±8% jitter, 30 ms dedupe, at most 10 voices. Above 8 pops in a frame, a single "rattle" bus plays with gain that grows with the log of the count.
- The cash counter rolls up. Gold "+N" floaters merge within 150 ms windows.

**Shells and Plants:**
- Shells crack visibly at 75%, 50% and 25%.
- When a Plant breaks: 80 ms hit-stop, camera kick 0.5, a fountain of children, papers and parcels flying, and a "BULLDOZER WRECKED +604" banner.
- Damage numbers appear only for crits, hits of 50 or more, and Plant hits.

**Tension:**
- **Close call:** a unit popped within 1.5 cells of the farmhouse drops the game to 0.5× for 0.4 s with a "Close call!" stinger.
- The Goodwill bar pulses below 25%.

**Towers:**
- The panel shows a large **Knockouts** counter and "Marks earned".
- Buying a Crown plays a 1 s camera beat with a gold frame.

**Budgets** (iPhone 12-class, 60 fps):
- At most **350 live units**. Children over the cap queue at the parent and emit over the next ticks in a deterministic order.
- At most 400 particles and about 60 draw calls.
- Sim step ≤ 2 ms with 350 units and 40 towers.
- Targeting uses a lane-distance index with a binary search, not an O(towers × enemies) scan.
- Health bars only on shells with HP above 1.

## 9. Meta progression and modes

**Medals per level:**
- Easy, Normal, Hard and Hollow (no selling, income, Seed Bank or Packets; 1 Goodwill; starts at round +5).
- Three remixes: Hand Tools (Scarecrow, Hedgerow, Beehive and Cannon only), Lean Year (half Marks) and Long Haul (the window extended to round 80, with Keep Going forced).
- 7 × 100 = 700 checkboxes in a grid on the map. A level with every medal gets a gold hedge frame.
- Old stars migrate: 3 stars become Easy and Normal, Heroic becomes Hollow.

**Tower XP:**
- Each kind earns XP equal to its knockouts, in every mode.
- Unlock costs per path: T3 at 1,500 XP and T4 at 10,000. T1 and T2 are always open.
- Unused XP collects in a **Compost Heap** that can be spent on any tower at 2:1.
- The end screen shows the XP bars filling.

**Acorns** (earn-only, never sold):
- 20–120 per win, scaling with mode.
- They buy Seed Bank v2 perks that change play: a free T1 on the first Scarecrow, sell at 75%, Cath starts at level 3, Market -15%, +1 starting ability charge.
- They also buy **Seed Packets**: one-use pre-upgraded towers such as a 2-0-3 Silo, which also drop from boss levels and events.

**Freeplay and Watch:** Freeplay follows any win. **Watch** (Keep Going plus all abilities on Auto) earns medals except Hollow.

**End screen:** total pops as a big rolling number, the MVP tower, close calls, Goodwill kept, medals, XP bars, Acorns, and one big next action ("Next: Hard on Orchard Lane").

**Events (client-side, seeded by date):**
- Daily: a level, a mode and a 3-tower restriction. The share card stays.
- Weekly **County Show**: draft 6 towers and a kit, then play 3 fields with shared Goodwill. Rewards are Seed Packets.
- Endless becomes Freeplay and the County Show.

---

# What changes in today's Hedgerow

**Keep:**
- the story, the 100 levels and 10 acts, the bosses and `BOSS_MOVES`
- twists that change what you build (protected, drought, no-Scarecrow, no-Cath, rush), set pieces (bridges, floods, blackouts), forks and terrain plots
- the Cath RPG (re-pointed), Wardrobe, Rosettes, Almanac (re-pointed to the Fleet), replays (versioned), the Daily share card
- both renderers (`?2d` stays the test path)
- `STEP` determinism and the bot tuner (re-aimed at k)

**Change:**
- HP-pool enemies → Fleet rungs, mapped from today's kinds:
  - van → Van
  - wrapped → Wrapped Lorry
  - drone → Airborne rungs
  - truck → Box Lorry
  - bulldozer → Plated Reinforced Lorry, or Bulldozer in late acts
  - phantom → the Stealth property
  - tender → Plated Lorry
  - influencer, lawyer and lobbyist → Disruptor cars
  - carrier → Carrier
- Bounty per kill → 1 Mark per layer.
- Goodwill 10 → 120 on Normal, with leaks costing FV.
- `ramp()` and `HP_SCALE` → the Round Book plus windows, with the tuner fitting k only.
- Linear tiers plus specs → 3 × 4 paths. The 26 spec names become T3 and T4 names.
- Megastructures (from level 12, two T3s) → Heirlooms (two Crowns, from act 4).
- The 13 towers become 10:
  - Co-op Barn → the Hedgerow tower's paths
  - Clinic Tent → the Mast's Clinic path
  - Union Hall → the Market Crown
  - the last tower unlocks at level 24, not 75
- `heroBrain` → Cath on a post. `abilityBrain` → per-ability Auto, Watch mode and the bots.
- The selection pause gets a visible "Paused while you choose" chip, the story advances one tap per line, and the high-ground "^" tile gets a raised-turf texture.
- The phone tower sheet becomes a bottom sheet with 3 path columns, so the spec choice is no longer hidden on phones.
- Building on touch becomes drag-from-tray.

**Cut:** `TOWER_VS`, Scarecrow crowding, Veteran ranks, purely numeric twists (they become remix modes), the % Seed Bank perks, and 200-wave Endless.

**The auto-battler question: hands-on to learn, watchable once earned.** The owner said in round 2 that it "should stay an auto-chess type game where the player mostly watches". Every proposal makes play manual by default; I keep the owner's preference instead:
- **Keep Going** (auto-send 2 s after a clear) is **off for levels 1–5** while new players learn the Go and stack rhythm, **then on by default** and remembered.
- Abilities start manual and earn Auto after 3 hand casts.
- Cath never farms kills.

Why this works: the addictive decisions are spending ones, between and during rounds. Short rounds, money that streams in, price tags and crosspaths create those decisions even under Keep Going. Watching becomes worth it because of pops, cascades, Crowns and Plant breaks, rather than because the game plays itself. Log this in DECISIONS.md.

**Transition rule** (from P3): `Level.rules: "classic" | "fleet"`. Fleet levels use `fleet.ts`, `rounds.ts` and `paths.ts`, so every milestone ships with the existing `hedgerow-levels-*` tests still passing. Acts convert in blocks, and classic is deleted in M8.

---

# Milestones (ordered; each one shippable and player-visible)

**Applies to every milestone:**
- Checks: `npm run check`, `npm run shots` before and after, the Hedgerow e2e specs, and for balance changes `npx tsx scripts/hedgerow-tune.ts` then `--verify`, logged in BALANCE.md.
- Size: S is 1 session, M is 2–3, L is 4–5. At the Phase H share of about 30% of sessions, this is roughly 30–35 sessions.

**M1. Hands-on pacing.** Size M.
- **Goal:** Go, x3 and stack in one button with the early bonus; Cath on a post; an ability tray with manual abilities and Auto after 3 casts; Keep Going off for levels 1–5 then on; x5 after a win; a leak banner naming the cause using today's traits (stealth, wrap, heavy, air); the pause chip; one-tap story; the phone spec choice visible.
- **Files:** `engine.ts` (`heroBrain`, an `abilityBrain` flag, stacking), `main.ts` (`AUTO_SECS`, toolbar, tray, leak banner), `haptics.ts`, `styles.css`, `bot.ts` (casts abilities itself), `store.ts` (settings).
- **Tests:**
  - in `tests/hedgerow.test.ts`: Cath stays within her post radius, abilities never fire without Auto, and stacking is deterministic
  - an e2e for stacking at 844×390
  - a retune, since Cath gets weaker
- **Acceptance:** on level 1, Cath's share of the kills is below 20% and nothing casts on its own. On phone, the spec choice is visible without scrolling.

**M2. The Fleet in act 1.** Size L.
- **Goal:** rungs Courier to Box Lorry plus Drone and Quad; pops with sound, particles and 1 Mark per layer; the Knockouts counter; Round Book rounds 1–30; levels 1–10 switch to `rules: "fleet"` with Goodwill 120 and FV leak cost; instanced rung rendering.
- **Files:** new `fleet.ts` and `rounds.ts`; `engine.ts` (rename `pierce` to `ignoresArmour`, numeric `pierce`, `hitEnemy()` with overflow, children, live cap and emission queue, fixed-point income); `levels.ts` (windows for act 1); `tuning.ts` (k); `render3d/index.ts` and `models.ts` (an InstancedMesh per rung, replacing the per-enemy Group); `render3d/fx.ts`; `render.ts` and `sprites.ts`; `sound.ts` (pop bus); `replay.ts` (`v: 2`, old replays get a notice).
- **Tests:**
  - new `tests/hedgerow-fleet.test.ts`: FV conservation (popped + leaked = round FV), Marks = layers, overflow, child order, same seed gives the same hash, cap and queue determinism
  - a perf test: 350 units and 40 towers for 1,000 steps at ≤ 2 ms a step
  - `hedgerow-levels-1` passes
- **Acceptance:** level 1, round 1 shows layers visibly popping with a cash tick per pop, and shots show a dense cascade on round 10.
- **Also (M1 review, 2026-10-10):** level 1 must stop being slow and free: no round longer than about 35 s at x1 with a simple build, a lazy build (3 Scarecrows, no upgrades) loses Goodwill visibly, and stacking is a graded choice (stacking one round pays, stacking every round loses) rather than all-or-nothing.

**M3. Properties, damage types and readability; acts 2–3 on fleet.** Size M.
- **Goal:** all 9 properties with icons, damage types on today's tiers, tower badges, preview chips with the "can't answer" warning, the full leak report and loss-screen causes, Book rounds to 45.
- **Files:** `fleet.ts`, `engine.ts` (delete `TOWER_VS` for fleet levels), `icons.ts`, `render.ts`, `render3d/index.ts`, `main.ts`, `almanac.ts`, `levels.ts`, story text that mentions wrap or Masts.
- **Tests:**
  - an immunity-matrix unit test
  - lesson tests: a bot without detection leaks on R22, a Sharp-only bot leaks on R26, a Scarecrow-only (`naive`) bot loses by act 2, and the `best` bot wins
- **Acceptance:** losing level 15 without a Mast shows "Stealth ... Radio Mast reveals stealth".

**M4. Three paths, T1–T3, for Scarecrow, Hedgerow, Beehive, Seed Cannon and Radio Mast.** Size L.
- **Goal:** the crosspath rule, a 3-column bottom sheet with affordable glow and "in about N rounds", per-tier model parts and T3 silhouettes, drag-to-place. The other 5 towers use a legacy adapter that maps old tiers to path A.
- **Files:** new `paths.ts`; `engine.ts` (`upgrade(id, path)`, `towerStats` cache key); `main.ts`; `styles.css`; `render3d/models.ts`; `sprites.ts`; `bot.ts` (named builds such as `crow-3-2-0`); `store.ts` (save v3: specs map to paths).
- **Tests:**
  - new `tests/hedgerow-paths.test.ts`: crosspath legality (property-based), cost and refund maths, migration from a v2 fixture
  - an e2e that buys every path at 844×390
- **Acceptance:** two Scarecrows on different paths look and play differently in shots.

**M5. Plants, Crowns and tower abilities.** Size L.
- **Goal:** Skip, Bulldozer, Crane, Exec Car and Tunnel Borer with crack stages, hit-stop, child fountains and wreck banners; T4 Crowns for the M4 five with their abilities in the tray; the Crown uniqueness rule; Book rounds 46–80; Freeplay.
- **Files:** `fleet.ts`, `rounds.ts`, `paths.ts`, `render3d/fx.ts`, `models.ts`, `sound.ts` (Crown stings), `main.ts`.
- **Tests:**
  - Crown uniqueness
  - Plant FV
  - ability cooldown determinism
  - perf during a Bulldozer burst at x3
- **Acceptance:** in a sandbox at R36, the Bulldozer bursts on screen and Murder of Crows is bought with its beat.

**M6. Cath the hero: in-run levels and kits.** Size M.
- **Goal:** levels 1–20 shown on her portrait; Pie, Neighbours, the level-10 kit ability and Last Orders; a kit picker on the level card; outfit and kit linkage; RPG attributes re-pointed; duel rewards.
- **Files:** new `hero.ts` (moved out of `engine.ts`), `cath.ts`, `wardrobe.ts`, `main.ts`, `render3d/models.ts`, `bot.ts`.
- **Tests:** `tests/hedgerow-cath.test.ts` covers the XP curve (about level 10 by R24), unlock levels, Organiser income, an existing-save migration, and Cath's kill share staying under 20%.
- **Acceptance:** H3 can be ticked once the duel reward shows.

**M7. The full roster and the economy.** Size L.
- **Goal:** paths and Crowns for Windmill, Pond, Silo, Market Stall and Courthouse; Barn, Clinic and Union retired with save mapping; Heirlooms replace megas; sell at 70%, or 100% in the same round; Bank interest; income falloff; all towers unlocked by level 24.
- **Files:** `paths.ts`, `engine.ts` (`TOWERS`, `MEGAS` → Heirlooms), `store.ts`, `almanac.ts`, `levels.ts` (unlocks), `story/*`, `render3d/models.ts`.
- **Tests:**
  - Market payback within 8–12 rounds
  - Bank cap
  - Heirloom requirements
  - a HeuristicBot sim of greed against safety (1,000 games)
  - naive spam still loses
- **Acceptance:** every tower card shows 3 paths. An old save with a Co-op Barn loads.

**M8. Campaign conversion (acts 4–10); classic deleted.** Size L (the tune runs over 2 sessions).
- **Goal:** every level on Book windows with act-themed swaps; bosses as phased Plants closing their windows; a smooth curve; `ramp()` and `HP_SCALE` removed; Endless retired into Freeplay.
- **Files:** `levels.ts`, `tuning.ts`, `scripts/hedgerow-tune.ts` (fits k, monotone per act), `endless.ts`, `daily.ts`, `replay.ts`.
- **Tests:**
  - all `hedgerow-levels-*` pass
  - a curve test: the `best` bot's Goodwill kept is non-increasing within an act, ±10%
- **Acceptance:** ROADMAP H2 can be ticked.

**M9. Difficulties, modes, medals and the end screen.** Size M.
- **Goal:** Easy, Normal, Hard and Hollow plus 3 remixes; the medal grid on the map; star-to-medal migration; close-call slow motion; the full stats screen; resume with round snapshots and Continue.
- **Files:** `engine.ts` (`newGame` mode rules), `store.ts`, `map.ts`, `main.ts`, `rosettes.ts`.
- **Tests:**
  - a mode-rule matrix: Hollow blocks selling, income and Packets
  - migration
  - snapshot round-trip with an identical hash
  - e2e: pick a mode, win, see the medal
- **Acceptance:** the map shows the medal grid, and reloading mid-run offers Continue.

**M10. Long-term meta: tower XP, Acorns, Seed Bank v2 and Seed Packets.** Size M.
- **Goal:** XP bars at the end of a run, T3 and T4 gating, the Compost Heap, the perk shop, Packet drops and placement.
- **Files:** new `meta.ts`, `store.ts` (v4), `main.ts`, `map.ts`. The bot assumes everything is unlocked.
- **Tests:** `tests/hedgerow-meta.test.ts` covers XP only from real runs (not sandbox), a locked tier refusing the upgrade, a Packet placed exactly as stored, and migration.
- **Acceptance:** a locked T3 shows "1,500 XP" and unlocks after play.

**M11. Events and map gimmicks.** Size M.
- **Goal:** the Daily with tower restrictions; the weekly County Show; line-of-sight barns and hedges; removable obstacles such as a fallen oak for 500 Marks; Pond-only fords. This merges with ROADMAP H1 lane variety.
- **Files:** `daily.ts`, new `show.ts`, `layouts.ts`, `terrain.ts`, `engine.ts` (sight filter), `render3d/lanes.ts`.
- **Tests:**
  - seeded determinism per week
  - a sight-blocking unit test
  - the bot clears County Show Normal tier 1
- **Acceptance:** two acts play differently because of their gimmicks.

**M12. Spectacle pass.** Size M.
- **Goal:** full rung liveries (panels, crates, wrap, frost, rivets, decals); Crown and Heirloom idle animations; comic deaths (vans folding up, a lawyer's papers flying); spike-round music stingers.
- **Files:** `render3d/models.ts`, `render3d/fx.ts`, `sound.ts`, `sprites.ts`.
- **Tests:** shots at phone and desktop sizes in 3D and `?2d`; a frame-time probe with 350 units; a gate 8 visual review.

---

# Scores of the three proposals and what was taken from each

Scored 1–10 on addictiveness, fit with theme and Cath, buildability in the existing code, and iPhone suitability.

| | Addictive | Theme / Cath | Buildable | iPhone | Total |
|---|---|---|---|---|---|
| **P1, loop** | 9 | 9 | 7 | 8 | **33** (spine) |
| **P2, progression** | 9 | 7 | 5 | 8 | 29 |
| **P3, feel** | 9 | 8 | 8 | 6 | 31 |

**P1 is the spine.**
- 4 tiers per path, which saves about 30 upgrades and their models compared with 5.
- The fleet table and the property set, including Reefer and Wrapped matching the existing bubble-wrap lore.
- Cath's kits (Baker, Rambler, Organiser, Campaigner).
- Leak cost = FV, the 350-unit cap with a deterministic emission queue, and the per-property "can't answer this" warning.
- Autopilot treated as a toggle, not a punishment.
- Heirlooms open from act 4, and today's kinds mapped onto rungs.
- **Rejected:**
  - per-level authored round plans, in favour of one learnable Book
  - cutting the Cath RPG (the owner asked for it)
  - all towers unlocked by level 30 (now level 24)

**From P3:**
- The `classic | fleet` transition flag, which is the key to shipping in increments.
- The single canonical Round Book with story windows and act swaps.
- The tuner fitting start Marks only, never HP.
- Lesson tests ("a no-detection bot leaks on R22").
- The juice spec: pop bus, rattle aggregation, merged floaters, damage numbers only on big hits, crack stages.
- Abilities unlocking Auto after manual casts.
- Heirlooms needing two Crowns plus a fee, and the Exec Car and Surveyor-style satire.
- Two counters per tower, Knockouts and Marks earned.
- **Rejected:** merging Mast, Clinic and Union into a Village Hall (it loses the Mast art and story), and the 600-unit, 2,000-particle phone budget, which is too optimistic.

**From P2:**
- Outfits as hero loadouts, which gives the wardrobe teeth.
- Round-start snapshots with Continue and Retry round.
- The "affordable in about N rounds" estimate.
- The income falloff schedule and the loss screen's top 3 causes.
- Acorns (earn-only), Seed Packets, the Compost Heap, and the grind warnings: T1 and T2 always open, nothing ever sold.
- The County Show draft and the end-screen call to action.
- **Rejected:**
  - folding the namesake Hedgerow tower into the Barn (reversed: the Hedgerow tower absorbs the Barn)
  - 5 tiers
  - 20 curated fields replacing the 100-level campaign
  - the Knowledge-tree rewrite of the Cath RPG
  - charging 450 Marks for Cath (she is the face, so she stays free)

**Conflicts resolved by this plan:**
- **Auto-play default:** all three proposals go manual. The owner's round 2 note wins: Keep Going is on after level 5 and abilities are manual until they earn Auto.
- **Rounds:** per-level plans (P1) or one Book (P2, P3)? One Book.
- **Tiers:** 4, not 5.
- **Roster:** 10 towers, keeping the Hedgerow tower and the Mast.
- **Old numbers too close to Bloons:** RBE values (604, 3,066, 15,864) and spike rounds (36, 54, 62, 78) were deliberately moved away from Bloons' own.

Nothing in the repo was edited or committed.