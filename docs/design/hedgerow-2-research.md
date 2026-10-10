# Hedgerow 2: research appendix (2026-10-10)

Sources for `hedgerow-2.md`. Bloons TD is a reference only: no Bloons names, art or numbers go into the game.

## A. Bloons TD 5/6 systems
## Bloons TD 6 (and BTD5): a breakdown of the game systems

**How reliable this is.** Most source pages could not be fetched directly. bloons.fandom.com returned HTTP 402, bloonswiki.com returned 403, and the breezewiki mirror was behind Anubis bot protection. Only Wikipedia fetched cleanly. Facts marked **[src]** come from search-result snippets or Wikipedia, with the URL given. Facts marked **[mem]** are from my own background knowledge of the game. They are stable, well-known values, but I could not re-check them against a page this session. Check any **[mem]** number before using it as a balance constant.

---

### 0. Headline facts
- Made by Ninja Kiwi in Unity and released in June 2018. It is now on iOS, Android, Steam, Mac, Xbox, PS4, Switch (June 2026) and visionOS. It has had 56 major updates as of August 2026. It was the world's most-bought paid app in 2018 and averages more than 10,000 concurrent players on Steam. [src: https://en.wikipedia.org/wiki/Bloons_TD_6]
- Critics praised "the combination of playability and complexity". PCGamesN called it "a whole new plane of addiction". The criticisms were limited replayability and the freemium-style economy. [src: Wikipedia]
- There are paid roguelike expansions: Rogue Legends (Feb 2025: hex-tile map, 4-stage campaigns) and Frontier Legends (Dec 2025). [src: Wikipedia]

### 1. Towers

#### Roster by category [mem]
About 25 towers:
- **Primary:** Dart Monkey, Boomerang, Bomb Shooter, Tack Shooter, Ice Monkey, Glue Gunner, Desperado (added 2025)
- **Military:** Sniper, Monkey Sub, Monkey Buccaneer, Monkey Ace, Heli Pilot, Mortar Monkey, Dartling Gunner
- **Magic:** Wizard, Super Monkey, Ninja, Alchemist, Druid, Mermonkey (v45)
- **Support:** Banana Farm, Spike Factory, Monkey Village, Engineer, Beast Handler (v41)

#### Upgrade structure
- Each tower has 3 paths with 5 tiers each, so 15 upgrades. You may buy from only 2 paths, and only one of them can go past tier 2. Valid builds therefore look like 5-2-0, 0-2-5, 2-0-5 or 4-2-0. Once you buy into 2 paths, the third locks. [src: https://www.bloonswiki.com/Upgrades ; https://bloons.fandom.com/wiki/File:302DartMonkeyCrosspathImage.jpg]
- BTD5 had 2 paths with 4 tiers each, and a tower could take 6 of its 8 upgrades (4/2). BTD6 is much more restrictive: 7 of 15 at most. Crosspath choice is therefore a real decision. Fans count the "best crosspath" debates as part of the hook. [src: https://www.bloonswiki.com/Upgrade ; https://kosgames.com/bloons-td-6-best-crosspath-tier-5-tower-15974/]
- **One tier 5 per path per player.** Each specific tier 5 upgrade can exist only once on the map. This is BTD6's "one of a kind" rule. [mem]

#### Cost scaling
Prices rise roughly geometrically by tier. As a typical Medium example [mem]:

| Tier | Cost |
|---|---|
| 1 | $100–500 |
| 2 | $200–800 |
| 3 | $500–3,000 |
| 4 | $2,000–15,000 |
| 5 | $20,000–100,000 |

A sourced example is Monkey Wall Street (Banana Farm 0-0-5) [src: https://www.bloonswiki.com/Monkey_Wall_Street_(BTD6)]:

| Difficulty | Cost |
|---|---|
| Easy | $59,500 |
| Medium | $70,000 |
| Hard | $75,600 |
| Impoppable | $84,000 |

- Each tier 5 also needs **tower XP** before it can be bought at all. Monkey Wall Street needs 50,000 XP, Pop and Awe needs 32,000 XP, and Artillery Battery (tier 3) needs 12,500 XP. [src]
- **What tier 5 feels like:** each one is a dramatic visual and mechanical change, not +10%. A Dart Monkey becomes a giant juggernaut ball thrower or a Plasma Monkey Fan Club. Players save up for several rounds for one and feel the spike immediately. This "save for the big one" tension is central to the game. [mem]

#### Paragons
- Added in v27.0. A Paragon needs all 3 tier 5s of the same tower on the map at once. It sacrifices every other tower of that type, and their value raises the Paragon's **degree (1–100)**, which scales its power. [src: https://www.bloonswiki.com/Paragon ; Wikipedia]
- The cost of a Paragon plus all the upgrades it requires (Dart example) is $524,265 on Easy, $616,800 on Medium, $666,140 on Hard and $740,160 on Impoppable. [src: https://www.bloonswiki.com/Template:BTD6_cost_list_by_paragon]
- Paragons are mostly a freeplay and boss-event toy. They need a lot of tower XP to unlock. [src]

### 2. Bloons, properties and counters

#### Layer and RBE table [mem]
RBE (red bloon equivalent) is the total damage needed to clear a bloon including all its children.

| Bloon | HP | Children | RBE | Speed (red = 1) |
|---|---|---|---|---|
| Red | 1 | – | 1 | 1.0 |
| Blue | 1 | Red | 2 | 1.4 |
| Green | 1 | Blue | 3 | 1.8 |
| Yellow | 1 | Green | 4 | 3.2 |
| Pink | 1 | Yellow | 5 | 3.5 |
| Black | 1 | 2 Pink | 11 | 1.8 |
| White | 1 | 2 Pink | 11 | 2.0 |
| Purple | 1 | 2 Pink | 11 | 3.0 |
| Lead | 1 | 2 Black | 23 | 1.0 |
| Zebra | 1 | Black + White | 23 | 1.8 |
| Rainbow | 1 | 2 Zebra | 47 | 2.2 |
| Ceramic | 10 | 2 Rainbow | 104 | 2.5 |
| MOAB | 200 | 4 Ceramic | 616 | 1.0 |
| BFB | 700 | 4 MOAB | 3,164 | 0.25 |
| ZOMG | 4,000 | 4 BFB | 16,656 | 0.18 |
| DDT | 400 | 4 camo regrow Ceramic | 816 | 2.75 |
| BAD | 20,000 | 2 ZOMG + 3 DDT | 55,760 [src] | 0.18 |

- The BAD's RBE is 55,760 (98,360 fortified) and becomes 67,200 at round 100 because of late-game scaling. The DDT's base HP is 400 (800 fortified, 480 at round 90). [src: https://www.bloonswiki.com/BAD_(BTD6) ; https://www.bloonswiki.com/DDT_(BTD6)]
- **Children on pop** are what makes RBE grow so fast. One ceramic is 104 RBE and one ZOMG is about 16.6k. Splash and pierce towers handle the shower of children, while single-target towers kill the shell. Every big threat therefore needs two kinds of answer. [mem]

#### Properties: immunities and counters [mem]

| Property | Immune to | Counters |
|---|---|---|
| **Camo** | Being seen without detection | Ninja, Sniper, Sub, Heli, Village 0-2-0 Radar, Wizard 0-0-2+, Mortar shrapnel, Dart 0-x-x Elite? (most towers need a specific upgrade) |
| **Lead** | Sharp damage (darts, tacks, blades) | Bombs, fire, energy, Glaive Lord, Ice 3xx, Village MIB |
| **Black** | Explosions | Most non-explosive damage |
| **White** | Freeze | Most non-freeze damage |
| **Zebra** | Explosions and freeze | Most other damage |
| **Purple** | Energy, fire and plasma (lasers, fire, wizard magic, Super lasers) | Sharp or normal damage |
| **Frozen** | Sharp damage | — |
| **Fortified** | Not immune; health doubles (lead 1→4, ceramic 10→20, MOAB-class 2×) | High damage per hit; Bloon Impact Mortar tier 4 strips the fortification |
| **Regrow** | Not immune; regains one layer about every 3 s up to its original type | Burst damage; Grow Blocker power |
| **MOAB-class** | Many effects, e.g. glue stops and stuns (and "glue doesn't slow" without upgrades) | Dedicated anti-MOAB upgrades such as MOAB Mauler, MOAB Assassin, Super Brittle and Sniper Elite Defender |
| **DDT** | Camo, lead and black at once | Its own build question |

- From round 81, **Super Ceramics** replace normal ceramics. MOAB-class HP also rises each round from 81 onward. [src: https://bloons.fandom.com/wiki/Rounds_(BTD6)]
- Sample round mixes:
  - R62: 250 Purple, 15 Fortified Lead Camo Regrow, 5 Fortified MOAB and 2 BFB. [src: https://bloons.fandom.com/wiki/Purple_Bloon]
  - R48: regrow pinks, camo regrow purples, rainbows and fortified ceramics. [src: https://www.bloonswiki.com/Fortified_Bloon_(BTD6)]

**Why build choices matter.** Every property is a "lock", and your defence must have a matching "key" in time. The game tells you the threat in advance: the round number is known and players learn "camo is coming". A cheap build that ignores camo or lead dies on a specific, memorable round. Each tower then becomes a puzzle of which path covers which hole, and the 2-path crosspath rule means you can't cover everything with one tower. [synthesis]

### 3. Economy
- **Starting cash** is $650 on every difficulty. Half Cash starts at $325. Double Cash (a paid unlock) gives $1,300, or $40,000 in Deflation. [src: https://www.bloonswiki.com/Double_Cash_Mode_(BTD6)]
- **Cash per pop** is $1 per layer popped (each RBE) up to round 50, then falls off [src: Double Cash table; base figures are half the Double Cash ones]:

  | Rounds | Share of normal cash per pop |
  |---|---|
  | 51–60 | 50% |
  | 61–85 | 20% |
  | 86–100 | 10% |
  | 101+ | lower still |

- **End-of-round bonus** is $100 + the round number (R3 pays $103, R22 pays $122). [src: https://www.bloonswiki.com/List_of_rounds_in_BTD6]
- **Difficulty price multipliers** [src: Monkey Wall Street costs above, and the paragon table at https://www.bloonswiki.com/Template:BTD6_cost_list_by_paragon]:

  | Easy | Medium | Hard | Impoppable / CHIMPS |
  |---|---|---|---|
  | ×0.85 | ×1.00 | ×1.08 | ×1.20 |

  Prices are rounded to $5.
- **Lives** [mem]:

  | Easy | Medium | Hard | Impoppable | CHIMPS |
  |---|---|---|---|---|
  | 200 | 150 | 100 | 1 | 1 |

- **Banana Farm**
  - The base farm makes 4 bananas × $20 = $80 per round. [src: https://www.bloonswiki.com/Banana_Farm_(BTD6)]
  - Banana Central (5-x-x) makes about $6,000 per round ($1,200 per crate), or about $7,800 per round at 5-2-0 with Monkey Knowledge. [src]
  - Monkey Wall Street (x-x-5) adds $4,000 per round plus lives. [src: https://www.bloonswiki.com/Monkey_Wall_Street_(BTD6)]
  - Other farm paths: Monkey Bank (tier 3, mid path) stores cash with interest up to a cap that you withdraw by hand [mem]. Marketplace (x-x-3) auto-collects [mem].
- **Selling** refunds 70% of the total spent [mem]. A Monkey Knowledge perk raises this to 75% [mem]. A tower sold in the same round it was bought refunds 100% [mem].
- **How scarcity is created** [synthesis]:
  1. Upgrades cost far more than the income of the round you are in, so you are always choosing.
  2. Pop income falls after round 50, while threats grow exponentially through children.
  3. Farms are an explicit greed-versus-safety bet: they pay back over about 5–10 rounds.
  4. Selling at a loss punishes swapping towers around.
  5. Harder difficulties raise every price by 8–20% and also cut lives.

### 4. Round structure
- **Rounds to win by difficulty.** Hard starts at round 3, and Impoppable and CHIMPS start at round 6. [mem]

  | Easy | Medium | Hard | Impoppable / CHIMPS |
  |---|---|---|---|
  | 40 | 60 | 80 | 100 |

- **Freeplay** is endless after winning. [src: Wikipedia]
- Early rounds last about 20–40 s at 1× speed. Fast-forward is 3× [mem]. The play button doubles as **"send next round early"**: you can stack rounds while the current one is still running [mem]. Apopalypse auto-starts rounds. [src]
- **Spike rounds** that players remember by number:
  - R22–R24: first camos (a camo green on R24) [mem]
  - R28: first leads [mem]
  - **R40: first MOAB**, "the hardest challenge of the early game", needing single-target damage plus ceramic clean-up [src: https://www.bloonswiki.com/Strategy:CHIMPS]
  - R60: first BFB [mem]
  - **R63:** three tight ceramic rushes; "one ability cannot handle all 3 waves" [src: same]
  - R80: first ZOMG [mem]
  - R90: first DDTs [mem]
  - **R98:** "widely considered the hardest round", coming right after an easy R97 [src: https://www.tvtropes.org/pmwiki/pmwiki.php/YMMV/BloonsTowerDefense]
  - **R100: BAD** [mem]
- **The difficulty ramp is designed as a sawtooth.** Breather rounds sit right before spikes (R97 then R98), so players can predict and plan for each spike. [synthesis]
- On Easy, RBE is lower from round 40 onward: subtract 67 from the listed value. [src: https://www.bloonswiki.com/List_of_rounds_in_BTD6]

### 5. Heroes
- You may place one hero per game. Heroes have no upgrades. Instead they gain XP each round and level 1→20, gaining stat boosts and activated abilities. [src: https://www.bloonswiki.com/Hero_(BTD6)]
- Hard maps give more XP [src: https://bloonswiki.com/Track]:

  | Beginner | Intermediate | Advanced | Expert |
  |---|---|---|---|
  | ×1.0 | ×1.1 | ×1.2 | ×1.3 |

- XP curves differ by hero. Quincy, Gwendolin, Striker and Obyn use ×1.0, and Benjamin ×1.5, so he levels slower. You can also buy levels with cash. [src: https://www.bloonswiki.com/Hero_XP]
- The usual pattern is a first ability at level 3 and a big one at level 10 [mem].
  - Benjamin is the clearest example. He never attacks. He gives cash, and lives from about level 4–6. His level 10 ability "downgrades all incoming bloons by one rank" and doubles cash per pop (×3 at level 20). [src: https://bloons.fandom.com/wiki/Benjamin_(BTD6)]
- The roster is about 17 heroes [mem]: Quincy, Gwendolin, Striker Jones, Obyn, Captain Churchill, Benjamin, Ezili, Pat Fusty, Adora, Admiral Brickell, Etienne, Sauda, Psi, Geraldo, Corvus, Rosalia and Silas.
- **How heroes shape strategy:**
  - Each hero buffs a tower family. Obyn gives druids +1 pierce at level 2 [src: https://dotesports.com/general/news/bloons-tower-defense-6-hero-tier-list-best-heroes-in-btd6-ranked], Striker buffs bombs and mortars, and Brickell buffs water towers.
  - Picking the hero therefore picks the tower build, and the level-up timeline sets the strategy's timing.

### 6. Meta progression
- **Player XP and tower XP.** Every tower earns its own XP from use, which unlocks its upgrades. Tier 5s cost 32k–50k XP. [src]
- **Monkey Knowledge** [src: https://www.bloonswiki.com/Monkey_Knowledge_(BTD6) ; https://cyberpost.co/how-many-levels-do-you-need-to-get-all-monkey-knowledge/]
  - 6 trees: Primary, Military, Magic, Support, Heroes and Powers.
  - About 133–134 points unlock everything, and 138 are earnable without paying.
  - You get 1 point per player level from level 30 onward, plus achievements.
  - Unlock costs by row: row 4 costs 250 Monkey Money, row 5 costs 500 and row 6 costs 1,000.
  - A respec costs 2,000 Monkey Money.
  - Perks are small permanent buffs, for example "farms +$x" or "+10% Monkey Money".
- **Monkey Money** comes from wins and challenges [src]. A sample payout is about 20–100+ per win, scaling with map difficulty and mode [mem]. It buys heroes (about 1,500–5,000 each), powers, continues, Monkey Knowledge rows and the Double Cash and Fast Track unlocks [mem]. It cannot be spent inside a run.
- **Powers** are consumables placed mid-run: Road Spikes, Glue Trap, Camo Trap, MOAB Mine, Monkey Boost, Thrive, Time Stop, Cash Drop, Banana Farmer, Energizing Totem, Super Monkey Storm, Tech Bot, Portable Lake and Pontoon [mem]. Buying one earns XP of 8 × its cost [src: https://www.bloonswiki.com/Power_Pro]. "Power Pros" are upgraded, levelled versions. [src]
- **Insta Monkeys** are one-use, pre-upgraded towers (for example a 2-0-3 Dart) that you place free in any run. They drop from events, challenges, boss events and Odysseys. Collecting every crosspath is a completionist goal, and better tiers drop on harder maps (Beginner gives tiers 0–2 and Expert gives 3–4). [src: https://bloonswiki.com/Track ; rest mem]
- **Medals** are earned per map × difficulty × mode. On about 80 maps, each with about 13 mode slots, this gives over 1,000 visible checkboxes. A black border for beating every mode on a map, plus Impoppable/CHIMPS badges, gives completionists a long tail. [mem]
- **Modes** [src: https://www.bloonswiki.com/Template:BTD6_mode_nav ; Double Cash page ; Rounds page]:

  | Difficulty | Modes |
  |---|---|
  | Easy | Standard, Primary Only, Deflation |
  | Medium | Standard, Military Only, Apopalypse, Reverse |
  | Hard | Standard, Magic Monkeys Only, Double HP MOABs, Half Cash, Alternate Bloons Rounds, Impoppable, CHIMPS |

  - Deflation starts at round 31 with $20k and no income.
  - Apopalypse sends more bloons and auto-starts rounds. It unlocks after Military Only.
  - Alternate Bloons Rounds unlocks after Hard Standard.
  - **CHIMPS** stands for no Continues, Hearts lost, Income (farms and other eco), Monkey Knowledge, Powers or Selling. Only "Retry Last Round" is allowed. [src for no continues and retry; letters mem]
- **Live events** [src: https://www.bloonswiki.com/Odyssey_(BTD6) ; Wikipedia ; rest mem]:
  - Daily Challenges: one standard and one advanced each day, plus a co-op one.
  - Odysseys run weekly. You draft a crew of towers, powers and 1 hero, then play 3, 4 or 5 islands (Easy, Medium, Hard) with shared lives. In Extreme mode, towers you place become unusable on later islands.
  - Boss Events run every 2 weeks: Bloonarius, Lych, Vortex, Dreadbloon, Phayze and Blastapopoulos. A boss appears every 20 rounds from round 40, with Normal and Elite tiers and leaderboards.
  - Races are timed leaderboards.
  - Contested Territory is a team-versus-team map-capture event.
  - The Trophy Store sells cosmetics (projectile skins, pop effects, music, portraits) for Trophies earned in events.
- There is also a Challenge Editor, co-op for up to 4 players, collection events and achievements. [src for co-op: Wikipedia]

### 7. Maps
- There are about 80+ maps [mem]. The tiers are Beginner, Intermediate, Advanced and Expert. Intermediate unlocks after 5 unique map wins, Advanced after 12 and Expert after 20. [src: https://bloonswiki.com/Track]
- **Map gimmicks:**
  - Line-of-sight blockers: some terrain hides bloons from towers that need sight (a BTD6 novelty). [src: Wikipedia ; https://www.bloonswiki.com/BTD6]
  - Water-only placement for Sub, Buccaneer and Mermonkey.
  - Removable obstacles that cost cash to clear and open up placement (trees, rocks, ice).
  - Multiple or alternating entrances and exits.
  - Paths that move or switch: gates, tunnels where bloons go hidden, and bloons that come out of portals.
  - Maps with very little space.
- Expert maps combine several gimmicks. [mem]

### 8. Activated abilities
- Some upgrades, usually tier 3–5, add a button with a cooldown. Examples:
  - Super Monkey Fan Club: 50 s cooldown, 15 s duration; Plasma Monkey Fan Club is the same at 50 s. [src: https://www.bloonswiki.com/Plasma_Monkey_Fan_Club_(BTD6)]
  - Monkey Ace Ground Zero: a large nuke [src: https://www.bloonswiki.com/Activated_Abilities_(BTD6)]
  - Turbo Charge: attacks very fast for 10 s [src: same]
  - Others [mem]: MOAB Assassin and MOAB Eliminator (abilities that hit MOABs), Blade Maelstrom, Spike Storm, Bloon Crush, Overclock and Supply Drop.
- Cooldowns run in real time and carry across rounds. Bought abilities start partly charged. Heroes add 2–3 abilities each. [mem]
- **When players use them:** they save abilities for spike rounds (R40 MOAB, R63 ceramic rush, R98) and stack several abilities to burst a boss. There is also a known "sell and rebuy to reset cooldowns" trick, which CHIMPS bans; the source says this is why R63 is hard there. [src: https://www.bloonswiki.com/Strategy:CHIMPS] Abilities turn a passive watch into "press it now" moments. [synthesis]

### 9. BTD5 to BTD6
| | BTD5 | BTD6 |
|---|---|---|
| Upgrades | 2 paths × 4 tiers; take 4/2, so 6 of 8 [src] | 3 paths × 5 tiers; take 5/2/0, so 7 of 15 [src] |
| Meta | Rank unlocks, **Specialty Buildings** (one active, permanent buff to one tower type) [src: https://www.bloonswiki.com/BTD5] | Monkey Knowledge trees, tower XP, Paragons, Insta Monkeys |
| Heroes | None | About 17 levelling heroes |
| World | 2D, all-seeing towers | 3D, **line of sight**, obstacles [src] |
| New threats | Up to ZOMG and DDT | Purple, Fortified, BAD, bosses |
| Social | Co-op (Mobile/Deluxe) | 4-player co-op, Contested Territory, races |
| Events | Daily challenge, Special Missions | Odysseys, bosses, races, Contested Territory, Challenge Editor |

**What fans say each does better** (from forums and backloggd; no single authoritative source):
- **BTD6:**
  - Every upgrade is useful. A review says that "so many upgrades in BTD5 just flat out suck". [src: https://backloggd.com/u/copyleft/reviews/liked]
  - Crosspathing depth, the hero layer and endless live events.
  - It is a one-off purchase with no forced ads.
  - All towers are available up front, so players plan with the full toolkit. [src: https://steamcommunity.com/app/960090/discussions/0/3275815186865739911]
- **BTD5** (nostalgia and simplicity):
  - Snappier 2D readability.
  - Specialty Buildings as a long-term goal.
  - Fewer systems to learn.
  - Shorter paths to "fully upgraded".

---

### 10. Why it hooks: design takeaways for Hedgerow [synthesis]
1. **Choosing an upgrade is a real fork.** Three paths, a cap of 5/2 per tower and one of each tier 5 per map mean every tower is a build decision. Players argue about crosspaths.
2. **Spectacular, saved-for tier 5s.** A $20k–100k purchase that changes how the tower looks and what it does gives a clear goal over many rounds and a big payoff.
3. **Bloon properties are known threats that need specific counters.** Camo, lead, purple, black and white, fortified, regrow and MOAB each need one right answer. Players learn "round 24 camo" and "round 40 MOAB", and losing to one feels fair and teaches something.
4. **Children make damage chain visibly.** Splitting layers make a hit feel big through many pops, and every pop pays $1. Income comes from the pops you see.
5. **Greed versus safety.** Farms are a bet that pays back over 5–10 rounds. Selling at 70% punishes swapping towers. Prices are 0.85×–1.2× by difficulty. Pop income falls after round 50.
6. **Long runs with a set rhythm.** A run lasts 40–100 rounds. Breather rounds come just before known spikes (R40, R63, R98). Speed is 3× and you can send rounds early.
7. **Abilities give "press now" moments** at the spike rounds.
8. **Heroes** level inside the run and steer which tower family to build.
9. **A wide grid of goals:**
   - Medals for about 80 maps × 13 modes.
   - Modes that remix the same content: towers of one class only, Deflation, CHIMPS, Reverse, Half Cash.
   - Weekly Odysseys and bosses, Insta Monkey collections and Monkey Knowledge.
   - Players replay the same maps under different constraints instead of needing new content.
10. **Map gimmicks** (line of sight, water, removable obstacles, multiple paths) change the best build on each map.

Sources used: https://en.wikipedia.org/wiki/Bloons_TD_6 · https://www.bloonswiki.com/Upgrades · https://www.bloonswiki.com/Paragon · https://www.bloonswiki.com/Template:BTD6_cost_list_by_paragon · https://www.bloonswiki.com/Monkey_Wall_Street_(BTD6) · https://www.bloonswiki.com/Banana_Farm_(BTD6) · https://www.bloonswiki.com/Double_Cash_Mode_(BTD6) · https://www.bloonswiki.com/List_of_rounds_in_BTD6 · https://bloons.fandom.com/wiki/Rounds_(BTD6) · https://www.bloonswiki.com/Strategy:CHIMPS · https://www.tvtropes.org/pmwiki/pmwiki.php/YMMV/BloonsTowerDefense · https://www.bloonswiki.com/BAD_(BTD6) · https://www.bloonswiki.com/DDT_(BTD6) · https://www.bloonswiki.com/Fortified_Bloon_(BTD6) · https://bloons.fandom.com/wiki/Purple_Bloon · https://www.bloonswiki.com/Hero_(BTD6) · https://www.bloonswiki.com/Hero_XP · https://bloons.fandom.com/wiki/Benjamin_(BTD6) · https://dotesports.com/general/news/bloons-tower-defense-6-hero-tier-list-best-heroes-in-btd6-ranked · https://www.bloonswiki.com/Monkey_Knowledge_(BTD6) · https://cyberpost.co/how-many-levels-do-you-need-to-get-all-monkey-knowledge/ · https://www.bloonswiki.com/Power_Pro · https://bloonswiki.com/Track · https://www.bloonswiki.com/Odyssey_(BTD6) · https://www.bloonswiki.com/Template:BTD6_mode_nav · https://www.bloonswiki.com/Plasma_Monkey_Fan_Club_(BTD6) · https://www.bloonswiki.com/Activated_Abilities_(BTD6) · https://www.bloonswiki.com/BTD5 · https://backloggd.com/u/copyleft/reviews/liked · https://steamcommunity.com/app/960090/discussions/0/3275815186865739911 · https://kosgames.com/bloons-td-6-best-crosspath-tier-5-tower-15974/
## B. Why Bloons TD is addictive
## Why Bloons TD 5 and 6 are so addictive, and what Hedgerow lacks

### Summary

Most of what makes Bloons TD (BTD) addictive comes from one rule: **most enemies die in one hit and turn into a smaller enemy.** So every second brings dozens of small wins you can see and hear: a pop, a colour change, a cash tick. Those small wins feed fast, easy-to-read decisions: what to place, which upgrade path, which crosspath, which targeting mode. Several progression loops sit on top, each on its own timer: a round, a map, unlocking an upgrade, a medal, Monkey Knowledge, the daily challenge.

Hedgerow's current model works the other way, and it matters:
- Its enemies are bullet sponges: a van has 98 HP, a truck 150, bosses 1,800 to 8,000.
- Waves have roughly 5 to 25 enemies.
- Towers have 3 tiers plus one specialisation.

So Hedgerow produces a handful of slow kills a second. BTD produces hundreds of pops a second. The biggest gap is feel and reward rate, not content.

Steam aggregate for BTD6 (vaporlens): 97% positive across about 380k reviews; median playtime 19.5 h, mean 76 h. The most-cited positive themes:
- "Extensive content and replayability" (97% weight)
- "Highly satisfying gameplay loop … popping balloons … addictive and rewarding" (95%)
- "Easy to learn but hard to master" (91%)
- "Frequent and meaningful updates" (91%)
- "Vibrant and polished presentation … sound design" (90%)

Source: https://vaporlens.app/app/960090/bloons_td_6.md

---

### 1. Moment-to-moment feel: popping layer by layer

**How it works**
- A bloon's layers are its health. Red (1 layer) < Blue < Green < Yellow < Pink, each faster than the last. Each hit pops one layer and the bloon visibly turns into the next colour down.
- Black and White bloons split into 2 children each. Zebra, Rainbow and Ceramic bloons split into more (a Ceramic has 10 hit points, then cascades). MOAB-class blimps (MOAB → BFB → ZOMG, plus DDT and BAD) burst into dozens of children.
- So one shot does visible work, and big things explode into a cloud of small things. That cloud is fresh targets for splash and pierce towers, which turns AoE into fireworks.
- Every pop has a short "pop" sound and a small burst graphic. Cash ticks up per pop, not per wave.
- The tower panel shows a "Pops" counter for that tower. It's a personal scoreboard for each monkey, and players get attached to "my 50k-pop Sun Avatar".
- **Pierce** (how many bloons one projectile can hit) makes one dart chain through a line of bloons: one action, many rewards.
- **Fast-forward** (3x) on every round lets players skip easy early rounds and pack in more events per minute.

**Why it hooks**
- Dense, cheap, varied feedback works like a variable-ratio reinforcement schedule: lots of small "you did that" signals.
- The colour downgrade gives instant proof of progress on a single enemy, so damage is never invisible.
- Children spawning on death is the core trick: killing a big thing creates more things to kill, so the satisfaction compounds.
- A reviewer at GamingOnLinux: "it sure is satisfying watching hundreds of balloons float around getting popped" (https://www.gamingonlinux.com/2022/01/send-help-as-i-have-discovered-bloons-td-6/).
- Ninja Kiwi (Epic Games Store feature, quoting Walker): the hook is firing a shot, then watching the follow-up chain reaction of the other balloons (https://store.epicgames.com/news/inside-bloons-the-multimillion-dollar-tower-defense-empire-built-on-monkeys).

**Hedgerow gap:** a van with 98 HP drains a hidden number over about 10 hits, and nothing visibly changes until it dies.
- Turn HP into **visible layers**: the van loses a panel or crate or changes livery per tier, with a pop sound and particles on each layer.
- Make **most fodder one or two hits**, with many more units per wave.
- Make **bigger enemies burst into smaller ones** (convoy → trucks → vans → bikes).
- Pay **cash per layer**, not per kill.
- Show a **per-tower "Knockouts" counter** prominently (Hedgerow already tracks kills).
- Add **pierce** to shots.

### 2. Agency and decision density

**What the player decides**
- **Placement:** range and line of sight around a winding track, and coverage of the track's loops.
- **Which of 3 upgrade paths** to take, and in what order.
- **Targeting:** First, Last, Close or Strong (Ninja adds camo priority; some towers can be aimed by hand or set to a point) (https://www.bloonswiki.com/Targeting_priority).
- **Selling and repositioning:** sell refunds 70% on standard difficulties.
- **Activated abilities**, hero choice and placement, and powers.
- **Economy:** banana farms, and the timing of when to save up for a tier 4 or 5.

**How it feels**
- Cash arrives continuously during the round, so there is almost always something affordable. The player buys mid-round and in short bursts between rounds.
- The usual rhythm is "save → splurge → watch it work". The next upgrade is always a visible, tantalising price tag.

**Why it hooks**
- The player always has a near-term goal ("I can afford 0-3-0 in 2 rounds") plus a long-term plan ("a 5-x-x by round 60").
- Goal-gradient effect: the closer you get to the price, the more motivated you are.
- No dead time: fast-forward, plus starting the next round whenever you like.

**Hedgerow gap:**
- Make cash income during waves visible and frequent.
- Put a visible price tag and "affordable" glow on the next upgrade in each path.
- Let players start the next round instantly (a BTD-style "go" button with auto-start).
- Keep targeting modes one tap away.

### 3. Build expression and experimentation

**How it works**
- BTD6 has 20+ monkeys, each with **3 paths × 5 tiers**. You can take one path to tiers 3 to 5 and a second path up to tier 2; the third path stays locked.
- That gives about 64 meaningful variants per tower. Builds are written like "2-0-4" (https://www.bloonswiki.com/Upgrade).
- Only one of each tier-5 upgrade can exist at a time, so tier 5s are a big, singular event.
- Paragons sacrifice every other tower of that type to become a super-tower.
- Each tower has a strong, one-line identity (Dart, Bomb, Ice, Glue, Sniper, Ninja, Alchemist, Druid…), and its tier-5 upgrades are fantasies: Sun Temple, Grand Saboteur, Glue Storm.

**Combos people discover:**
- Alchemist buffing a Ninja
- Village giving camo detection
- Ice plus Bomb against MOABs
- Glue plus Corrosive

Players keep testing "what if" ideas against challenge modes:
- CHIMPS (no continues, income, Monkey Knowledge, powers or selling) is praised by GameStar for focusing on tower combinations (https://en.wikipedia.org/wiki/Bloons_TD_6).
- Daily challenges restrict the towers you may use.

**Why it hooks**
- Combinatorial depth and self-set goals.
- The first time you find an emergent synergy feels like your own idea, which is intrinsic motivation through competence and autonomy.
- A Saratoga Falcon review calls it a "near infinite selection of choices" (https://saratogafalcon.org/?p=14324).

**Hedgerow gap:**
- Three tiers plus one specialisation gives far fewer, shallower forks.
- Consider **3 paths per tower (or at least 2), each with tiers 1 to 4 or 5, and a crosspath limit**.
- Build-defining **support towers**: buffs, camo or stealth reveal, armour-strip, slow.
- **Signature top tiers that visibly change the tower's model and attack.**

### 4. Readable threats and counters

**How it works**
- Every bloon property has a strong visual:
  - Camo: green camouflage pattern
  - Lead: grey metal
  - Regrow: heart pips
  - Fortified: rivets or bands
  - Purple: immune to magic and energy
  - MOAB class: blue, red, dark green, black
- Each property is a lock with a specific key:
  - Camo needs detection (Village, Ninja, radar and so on).
  - Lead needs explosive, fire or sharp-enough damage.
  - Purple needs non-magic damage.
  - Ceramic needs damage and density.
  - Black and White bloons are immune to explosions and ice respectively.
- Damage types are named per attack: sharp, explosive, cold, energy, normal.
- Rounds are fixed and the same every playthrough. Players memorise the dangerous ones: the first Ceramic rush, round 40's MOAB, 63's ceramic flood, 98's BFBs, 100's BAD.
- On a Steam thread, a player defends static waves because they let you "plan your defences with everything available up front" (https://steamcommunity.com/app/960090/discussions/0/3275815186865739911).

**Why it hooks**
- Losing teaches a specific, nameable lesson ("no camo detection at round 24"), so failure turns into a plan for the next attempt. That is the "one more try" loop: a clear cause, a fix you feel sure of, and a restart within seconds.

**Hedgerow status:** it already has counters: stealth with a Radio Mast, armour, heavy enemies, bubble-wrap shields, charm and jam. To make them work like BTD:
- Give **each property an unmistakable silhouette or colour coding**.
- Name it with an icon above the unit.
- Show the matching counter icon on towers ("sees stealth", "pops wrap").
- When a leak happens, name the cause on screen: "Leaked: stealth drone. Nothing could see it. Radio Mast reveals stealth."

### 5. Power fantasy and escalation

**How it works**
- Early game is a few darts plinking reds.
- Late game is tier-5s deleting entire ZOMGs and filling the screen with effects.
- A MOAB carries 4 Ceramics, each Ceramic 2 Rainbows, and so on: one MOAB is worth 616 red bloons. Destroying one shows a big crack-and-burst animation and releases a flood of children.
- Rounds 80 to 100 and Freeplay (endless beyond the win round) let numbers climb without limit: "pops: 1,240,566".
- Bosses (Bloonarius, Lych, Vortex, Dreadbloon, Phayze, Blastapopoulos) have tier phases and health bars (https://en.wikipedia.org/wiki/Bloons_TD_6).

**Why it hooks**
- Seeing how far you've come is a mastery payoff.
- Escalation keeps a satisfying contrast with the first rounds.
- "Numbers go up", as in idle games.

**Hedgerow gap:**
- Late Hedgerow should look and sound categorically different from early Hedgerow: screen-scale attacks, megastructures erasing a convoy.
- Big enemies should **break apart spectacularly** into a fountain of smaller ones.
- Total pops and knockouts should be visible and celebrated in the end-of-level summary.

### 6. Reward schedules and meta loops

The loops, nested by timescale:

| Timescale | Loop |
|---|---|
| seconds | pops and cash |
| ~1 min | round complete, often with bonus cash |
| 20–40 min | map won, Monkey Money, medal |
| hours | tower XP unlocks the next upgrade tier for that tower |
| days | Monkey Knowledge skill tree, new maps, heroes, achievements, trophies, cosmetics |
| ongoing | daily challenge, odyssey, boss and race events, Contested Territory |

Notes on these loops:
- **Medals:** each map has Easy, Medium, Hard and Impoppable medals, plus mode medals (Primary-only, Deflation, Apopalypse, Reverse, Half-Cash, Double HP MOABs, CHIMPS). So one map holds about 12 goals, which is a collection checklist you can see.
- **Tower XP:** players get attached to the tower they keep playing, because playing it is what unlocks its upgrades.
- **Content cadence:** around 56 major updates (Wikipedia). Updates are themselves a reason to return: "constant updates … new monkeys, new maps" (GamingOnLinux).

**Why it hooks**
- Overlapping goal timers mean something is always about to complete.
- A visible checklist (medal grid) drives completion behaviour.
- A daily challenge gives a reason to come back each day.

**Warnings from reviews:** grind and time-gated achievements (44%) and aggressive microtransactions (49%) are the top complaints. Copy the loops, not the monetisation (vaporlens).

**Hedgerow gap:** Hedgerow has stars, Seed Bank, Daily, Endless and veteran ranks. Add:
- **Per-tower XP** that unlocks deeper paths.
- **A medal grid per level** (difficulty × modifier modes like "Scarecrows only", "No selling", "Double-health convoys").
- An end-of-level reward screen showing XP bars filling.

### 7. Difficulty and tension

**How it works**
- Lives as a buffer: Easy 200, Medium 150, Hard 100, Impoppable or CHIMPS 1. That turns mistakes into a slow bleed rather than instant failure.
- A leak shows a small red flash and the lives counter drops by RBE (red bloon equivalent: a MOAB leak costs a lot).
- Near-misses (a Ceramic crawling to the exit while your sniper reloads) are the most memorable moments.
- Recovery works because you can sell and rebuild mid-round, use abilities, or use powers and "Continue" with Monkey Money.

**Why it hooks**
- Tension then release.
- Loss aversion keeps you engaged.
- A recoverable mistake gives the player a comeback story.

**Hedgerow gap:**
- Make leaks dramatic but survivable.
- Show the **leaker's health bar and distance to the farmhouse**: a slow-motion "last pop" or "close call!" stinger when an enemy dies near the exit.
- Let one big "panic" ability (Cath's pie) save a run.

### 8. Accessibility and session length

**How it works**
- A full map runs 40, 60, 80 or 100 rounds (Easy to Impoppable), roughly 20 to 50 minutes. You can quit at any time and the game saves state per round and resumes.
- Short alternatives exist: Deflation, Races and dailies.
- Fast-forward cuts dead time.
- The learning curve is tiny: place a monkey, it throws darts.
- A New Zealand game developers' association figure praised it as "fun and friendly, so it's accessible, but under the surface it's quite complicated" (Wikipedia).
- It suits quick matches (Xataka review).
- Complaints: there are no in-game numeric stats or tutorials, so players use the wiki (37% and 34% weight). A chance to do better.

**Hedgerow gap:**
- **Mid-level save and resume**, if not already per wave.
- **3x speed.**
- **Upgrade cards with clear numbers and before/after values**: BTD's own weakness, so a chance to beat it.

### 9. Art, sound and personality

**How it works**
- Cheeky cartoon monkeys against balloons. The absurd premise is deliberate: Ninja Kiwi says the ridiculousness of a monkey world fending off balloons is central to the brand (Epic feature).
- Silhouettes stay clear at tiny sizes.
- Every upgrade changes the tower's model: dart monkey → bandana → crossbow → glowing master.
- Bloon colours carry information, not just decoration.
- Sound cues: a crisp pop, a deeper pop for Ceramic, a MOAB crack, a "level up" chime, an upgrade "clang".
- "Vibrant and polished presentation … sound design" is praised at 90% weight (vaporlens). Common Sense Media and other reviewers note the broad appeal.

**Why it hooks**
- The game reads at a glance even at 3x speed.
- The humour lowers frustration.
- Visible upgrade transformation pays off each purchase.

**Hedgerow gap:**
- Each tier and path should change the tower model dramatically.
- Each enemy layer should change colour or silhouette.
- Pops and knockouts need a punchy, varied sound palette that stays crisp at high event counts: pitch variation, voice limiting.
- Hedgerow's satirical corporate villains (vans, lobbyists, lawyers) are a strong personality hook. Lean in with comic death animations: vans folding up, a parcel burst, a lawyer's papers flying.

---

### Recommended Hedgerow upgrades, ranked by likely player impact

1. **Layered enemies and splitting**
   - Replace the HP pools of fodder with 1 to 5 visible layers. Each hit pops a layer with a sound, particles and cash.
   - Big enemies burst into smaller ones (blimp → trucks → vans → bikes or parcels). Make waves 3 to 10 times larger, with much lower HP per unit.
   - Add pierce to most attacks.
   - This is the single biggest feel change, and needs a full re-tune with `hedgerow-tune.ts`.
2. **Three upgrade paths per tower with a crosspath rule** (for example 4-2-0, up to tier 5).
   - Each top tier transforms the model.
   - One signature tier-5 per type at a time.
3. **Readable threat properties:** a property icon over each enemy and matching counter badges on towers. A leak report names the missing counter.
4. **Economy feel:** cash per pop with a ticker animation, affordable-upgrade glow, 3x speed, auto-start next wave, and a "Pops/Knockouts" counter on each tower.
5. **Meta:**
   - Per-tower XP unlocking deeper tiers.
   - A medal grid per level, with modes like Deflation, Half-Cash, Single-tower and CHIMPS-style.
   - Freeplay after victory.
   - A daily challenge with tower restrictions.
6. **Climax moments:**
   - A big-enemy break-apart cinematic beat with a hit-stop.
   - A "close call" slow-motion pop near the farmhouse.
   - An end-of-level stats screen with total pops, the best tower and XP bars.

### Sources
- https://vaporlens.app/app/960090/bloons_td_6.md (Steam review theme aggregation, playtime)
- https://vaporlens.app/app/960090/bloons_td_6/stats/details
- https://www.gamingonlinux.com/2022/01/send-help-as-i-have-discovered-bloons-td-6/
- https://en.wikipedia.org/wiki/Bloons_TD_6 (mechanics, critic quotes: Wired/Simon Hill, GameStar on CHIMPS, NZGDA, sales)
- https://store.epicgames.com/news/inside-bloons-the-multimillion-dollar-tower-defense-empire-built-on-monkeys (Ninja Kiwi on physics/chain-reaction satisfaction and tone; page blocked to direct fetch, quoted via search summary)
- https://www.bloonswiki.com/Upgrade and https://www.bloonswiki.com/Upgrades (3 paths, crosspath rule, x-y-z notation)
- https://www.bloonswiki.com/Crossbow_Master_(BTD6), https://www.bloonswiki.com/Bloon_Crush_(BTD6)
- https://www.bloonswiki.com/Targeting_priority (First/Last/Close/Strong, camo default)
- https://www.bloonswiki.com/Monkey_Knowledge_(BTD6)
- https://steamcommunity.com/app/960090/discussions/0/3275815186865739911 (static waves, planning, "vibe")
- https://steamcommunity.com/app/960090/discussions/0/3485249057149532997 (crosspath balance opinions)
- https://saratogafalcon.org/?p=14324 ("near infinite selection of choices")
- https://www.xatakamovil.com/aplicaciones/hemos-probado-bloons-td6-tower-defense-monos-globos-ritmo-musica-caos/amp (easy to learn, short sessions)
- https://www.commonsensemedia.org/game-reviews/bloons-td-6
- https://indiehellzone.com/2020/05/16/bloons-tower-defense-6/ (counterpoint: meta progression feels tacked on)

Note: some specifics come from general knowledge of the series, not from pages fetched this session, because bloonswiki and fandom blocked direct fetches (403/402):
- the bloon layer order and the child counts in section 1
- MOAB RBE 616
- lives per difficulty
- 70% sell refund
- the "Pops" counter in the tower panel
- the medal-mode list

Check these on bloonswiki before quoting exact numbers.

Hedgerow comparison points come from `/home/user/Cathnivore/games/hedgerow/src/engine.ts`:
- `ENEMIES`: van 98 HP, bosses 1,800 to 8,000 HP
- `TowerSpec`: 3 tiers
- `splits` already exists for some enemies

Wave sizes come from the `ramp()` helper in `/home/user/Cathnivore/games/hedgerow/src/levels.ts`.
## C. Hedgerow as played (headless, 2026-10-10)
## Hedgerow play report: one player's honest view

Screenshots are in `` (written as `R/` below).

**How I tested:**
- I played level 1 the normal way, with real clicks, at x1, in the 2D renderer.
- For levels 5, 16, 31, 50 and 90 I used `?sandbox=1&level=N` and built the towers through `window.hedgerow`. Sandbox gives unlimited Marks and 999 Goodwill, so I could judge how those levels look and play, but not how hard they are. Difficulty comes from the bot.
- I ran the bot (`playLevel`) on levels 1, 5, 16, 31, 50 and 90 at four skill settings: idle, naive (Scarecrows only), balanced and competent. That took about 30 seconds in total.
- Nothing was committed or edited, and the server on port 4350 is shut down.

### Measurements
- **Load to first decision:** about 9 s. That is 1 s on the map, 6 s for the story, then building.
  - The story takes 8 clicks for 4 lines, because the first click only finishes the typing.
  - Placing a tower takes 2 clicks: the plot, then the tower card.
- **Level 1 at x1:** 179 s in total.
  - 5 waves of 3, 4, 6, 8 and 10 vans.
  - Wave 1 is 3 vans and takes about 31 s from Send to the next wave.
  - I made 7 decisions in the whole level. For about 148 of 170 s I had nothing to do, because I couldn't afford anything.
  - I won 3 stars with 10/10 Goodwill and never felt any tension.
- **Wave 1 lengths (wall clock; game time ran at exactly 1.00x):**

  | Level | Wave 1 length | Enemies in wave 1 |
  |---|---|---|
  | 5 | 12 s | 8 |
  | 16 | 20 s | 14 |
  | 31 | 21 s | 17 |
  | 50 | 37 s | 36 |
  | 90 | about 135 s | 75 |

  The level 90 run shared the CPU with two other headless browsers, so that figure may be inflated.
- **Whole levels at x1, from bot ticks:** level 1 about 2.5 min, level 16 about 7 min, level 31 about 10 min, level 90 about 11 min. Every level has only 5 to 8 waves.
- **Spamming one tower (Scarecrows only):**
  - It wins level 1 with 100% Goodwill.
  - It loses levels 5, 16, 31, 50 and 90.
  - So you can't win by spamming one tower, which is good.
- **Odd bot results:**
  - The competent bot loses level 5 early (at tick 1,267) and loses levels 16 and 31, while the balanced bot wins all three.
  - On level 50 the opposite happens: competent wins and balanced loses.
  - The "best" benchmark hides these collapses, so how hard a level is depends a lot on picking the right mix of towers.
- **What a hit or kill shows:** a small "+5" coin popup, a faint flash on the hit, and a small health bar. There are no visible projectiles in still frames, no damage numbers, no pop or burst on a kill, and no count of how many enemies are left.
- **Is upgrading clear?** On desktop it is clear but dense: a wall of stats with arrows from the old value to the new. On phone at 844x390 the choice between the two specialisations isn't visible at all; only Sell shows.
- **Did I feel tension?** Never in my own run. In sandbox, the only signs of danger were a floating "-1 Goodwill" and the heart counter.

### What's fun
- The art is lovely. The story scenes with portraits look polished and charming (`R/l1-story-1.png`).
- Each level brings a new problem. Fog, a tight budget, rain and bubble-wrapped vans are each explained on screen in one line (`R/L16-3-wave1-8s.png`, `R/L5-5-late.png`).
- The specialisation cards are meaty, real choices, for example Pumpkin Lobber against Crow Caller (`R/upgrade-panel-desk.png`).
- Late levels finally look busy: a long lane full of trucks and bulldozers at level 31 (`R/L31-7-end.png`).
- Scarecrow spam doesn't win, so there is real strategy.

### What's dull, idle or confusing
- Level 1 is mostly watching 3 vans crawl along while I can't afford anything.
- Auto (start the next wave by itself) is on by default and Cath plays herself, so the game runs fine without me.
- Cath, the hero, walks to the spawn and gets most of the kills. In level 1 she had 11 knockouts and my towers had almost none, which takes credit away from the player.
- The green "^" tiles look like upgrade buttons, but they are high-ground terrain.
- Selecting a tower freezes the next-wave countdown with no hint that it's paused. I discovered this when my scripted test stalled for 400 s.

### The 10 biggest feel and engagement problems
1. **Hardly any enemies, moving slowly, in long waves.** Level 1's wave 1 is 3 vans over about 31 s, and level 5's is 8 enemies. Bloons gets its rhythm from rounds of dozens of balloons, each only a few seconds long. `R/l1-c-mid-9.png` shows one van on the screen.
2. **Not enough waves and not enough decisions.** Levels have 5 to 8 long waves, against Bloons' 40 to 100 short rounds. I made 7 decisions in 3 minutes, with long gaps where I couldn't afford anything (`R/l1-d-later-60.png`). Splitting levels into many short rounds with a payout after each would fix this.
3. **Hits and kills feel weak.** There are no visible projectiles, no pop, and no damage or kill-count numbers, just "+5" and some faint debris (`R/L16-4-burst1.png`, `R/L50-4-burst3.png`). Bloons' layers popping one by one, each with a sound, is the core of its feel.
4. **Upgrades barely change how a tower looks.** Tier 1, 2 and 3 differ only in tiny stars and a shirt colour (`R/L90-4-burst2.png`, `R/upgrade-panel-desk.png`). There are 3 tiers plus one specialisation, against Bloons' 2 of 3 paths with 5 tiers each and a dramatic new model at every step.
5. **The specialisation choice is hidden on phone.** The tower panel at 844x390 shows only Sell (`R/upgrade-panel-phone.png`, `R/phone-or-desk-phone-wave.png`).
6. **The game plays itself.** Auto-waves are on by default, abilities fire themselves (Rally went off unasked, `R/L50-4-burst3.png`), and Cath farms the kills at the spawn (`R/L5-5-late.png`, `R/L90-3-wave1-8s.png`). There is no tension and no clutch moment.
7. **No sense of rising danger.** Nothing marks a leak or a near-loss except a small floating "-1 Goodwill" (`R/L31-7-end.png`). Level 1 gives 3 stars without effort (`R/l1-z-result.png`).
8. **Wave 1 of every level is quiet,** even late on: 14 enemies at level 16 and 17 at level 31, trickling in. Bloons skips you ahead to round 6 or so, and Hedgerow has no equivalent. Fast-forward only goes to x3, and the waits between waves at x1 drag (`R/L16-3-wave1-8s.png`).
9. **The side panel is cluttered and gets cut off.** The "Coming next" enemy chips are clipped at levels 50 and 90, and a list of 13 towers pushes the wave preview off the panel (`R/L90-3-wave1-8s.png`, `R/L50-7-end.png`). Building costs two clicks instead of dragging a tower onto the field.
10. **Small problems that add up:**
    - The story needs two clicks per line, 8 in all for level 1 (`R/l1-story-1.png`).
    - Selecting a tower silently pauses the next-wave countdown (`R/l1-c-mid-15.png`, "Wave 2 in 6…" stuck).
    - High-ground tiles look like buttons (`R/L31-7-end.png`).
    - Difficulty swings a lot depending on the tower mix (see the bot results above), which suggests real players will hit difficulty walls.

### Main files
- Bot probe: `R/botprobe.ts`.
- Play scripts: `R/p4.mjs` (level 1 with clicks), `R/p5.mjs` (sandbox levels), `R/p6.mjs` (upgrade panel and phone).