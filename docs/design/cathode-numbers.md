# CATHODE: the numbers

The key formulas and tables of the rules core in `games/cathode/src/sim/`, tested by `tests/cathode-*.test.ts`. The code is the source of truth; update this file when a number changes.

## Levels and XP (`stats.ts`)
- Levels 1 to 60. Each level gives **5 attribute points** and **1 skill point**; a fresh Cath has 1 skill point. Story jobs give one bonus skill point each (`claimSkillReward`).
- **XP to the next level:** `round(120 × L^1.85)`, so 120 at level 1, about 8,500 at level 10 and about 225,000 at level 59.
- **Monster XP:** `archetype.xp × level^1.4`, ×3 for elites.
- **Level-gap falloff** (`xpFalloff`):
  - full XP while the monster is at most 5 levels below Cath;
  - −15% per extra level below, never under 5%;
  - for monsters more than 5 levels above, `player / monster`.
- An **unseen kill** pays ×1.5 (plus the Ghost's *Nobody Home*). A whole area cleared unseen pays a "Ghost" bonus of 25% of the area's XP, at least 50.

## Attributes and derived stats (`deriveStats`)
Every class starts with 80 points:

| Class | Grit | Aim | Nerve | Wire |
|---|---|---|---|---|
| Ghost | 15 | 25 | 25 | 15 |
| Butcher | 35 | 15 | 15 | 15 |
| Gunslinger | 20 | 30 | 15 | 15 |
| Wirewitch | 15 | 15 | 20 | 30 |
| Fixer | 20 | 20 | 15 | 25 |

| Stat | Formula |
|---|---|
| Max health | `60 + 5 × level + 2 × Grit`, then modifiers |
| Carry | `40 + 2 × Grit` |
| Melee multiplier | `1 + (Grit + increased damage) %` × more |
| Gun multiplier (per class) | `1 + (Aim + increased damage) %` × more |
| Crit chance | `5% + 0.5% × Aim` + flat, capped at 75% |
| Crit multiplier | ×1.5 + flat |
| Recoil | `1 − 0.4% × Aim`, floored at 0.15 |
| ADS speed | `1 + 0.5% × Aim` |
| Stealth | `Nerve` + stealth bonuses (percent) |
| Detection multiplier | `1 / (1 + stealth%)`, from 0.1 to 3 |
| Bullet-time | `2 s × (1 + 0.5% × Nerve)` |
| Headshot multiplier | `1 + Nerve%` (applied on top of the zone multiplier) |
| Cyberware capacity | `10 + 2 × Wire` |
| Hack strength | `1 + Wire%` |
| Battery | `50 + Wire` |
| Move speed | 4.5 m/s (sprint is ×1.6 in the game layer) |

- **Resistances** are capped at 75%.
- **Difficulty penalty** on resistances: Hardboiled −20, Hell Week −50.

## The modifier system
Every bonus is a `Modifier {stat, kind, value}`:
- `flat` adds;
- `increased` percentages add together;
- each `more` multiplies on its own.

The formula is `(base + Σflat) × (1 + Σincreased/100) × Π(1 + more/100)`. Attributes feed the "increased" sum.

**Stat keys:**
- plain keys (`maxHealth`, `stealth`, …);
- keys qualified by weapon class (`damage.sniper`, `magazine.smg`, `critChance.shotgun`);
- per damage type: `resist.<type>`, `dmgType.<type>` and `added.<type>`, where added damage is a share of the hit;
- skill bonuses: `skills.all`, `skills.class.<class>` and `skills.tree.<tree>`.

## Skills (`classes.ts`, `skills.ts`)
**The catalogue:**
- 5 classes × 3 trees × 10 skills, which is 150, plus 10 hybrid capstones (160 in all).
- **Rows** 0–5 unlock at levels 1, 6, 12, 18, 24 and 30. Each tree is laid out 2-2-2-2-1-1.
- **Maximum rank** is 20.

**Values:**
- A skill's main value is `base + perRank × (rank − 1)`, capped where the skill says so.
- **Synergies** add `perPoint%` per hard point in the named skill.
- **Effective rank** is hard points plus gear "+skills". Gear only lifts learned skills, and "+skills" don't feed synergies.

**Dual-classing:**
- The second class opens at level 15.
- Its rows unlock 3 levels later (rows at 4, 9, 15, 21, 27 and 33).
- Hybrid capstones need both classes and level 30.

**Respec:**
- It costs `250 × level × 2^respecsBought` Scrip.
- A banked free respec (after the act 1 boss) is spent first.
- It returns every skill point and every attribute point above the class start.

## Weapons (`weapons.ts`)
**Bases:** 24 bases across the 9 classes, at least 2 per class.

| Base | Class | Damage | Rate (/s) | Magazine | Velocity (m/s) | Pierce |
|---|---|---|---|---|---|---|
| Widowmaker | sniper | 55 | 0.8 | 5 | 850 | 40% |
| Rail-9 | sniper | 90 | 0.5 | 3 | 1,100 | 80% |
| Nightjar | sniper | 46 | 1.2 | 10 | 600 | 30% |
| Street Sweeper | shotgun | 12 × 9 pellets | 1.2 | 6 | 400 | 0 |
| Corridor AR | rifle | 20 | 9 | 30 | 820 | 15% |
| The Pin | melee | 30 | 1.6 | none | none | 20% |

- Rail-9 punches through 3 bodies or layers of cover. Nightjar is suppressed and fires subsonic rounds.

**Upgrades:**
- **Item level** adds +4% base damage per level above 1.
- **Tiers I–V** multiply damage by ×1, ×1.2, ×1.45, ×1.75 and ×2.1. Upgrades cost `[400, 1200, 3500, 9000] × (1 + ilvl/20)` Scrip.
- **Parts** (barrel, scope, suppressor, mag and stock) are weapon-local modifiers. A suppressor gives −70% noise; the subsonic baffle gives −85% noise and makes rounds subsonic.

## Damage (`damage.ts`)
**Zone multipliers:**
- head ×2.5 (×4 for sniper rifles), times the Nerve headshot multiplier;
- torso ×1;
- limbs ×0.7.

**Order of resolution:**
1. falloff;
2. class multiplier;
3. zone;
4. crit, rolled once per trigger pull;
5. situational bonuses (unaware, marked, wounded, suppressed, range, explosive);
6. shields, where shock counts ×2;
7. armour: `share × (1 − pierce)`, halved for elemental types, with monowire getting +50% pierce;
8. resistance, where 100% means immune and negative values amplify.

**Severing:**
- A limb comes off when one hit's health damage is at least **30%** of max health, divided by the sever multiplier and halved for monowire.
- A head comes off on a killing hit of at least 60%.
- Any kill within **6 m** with a shotgun, an edged blade or an explosion always severs; a torso kill takes a random limb.
- The blunt Pin never severs on a close kill.

**Cath's armour rating** becomes a share of `rating / (rating + 40 + 12 × attackerLevel)`, at most 85%.

## Balance anchors (tested)
- A level-1 Ghost's Widowmaker headshot on a level-1 Enforcer (100 health) deals about 287 damage, a kill. A body shot deals about 56 (83 on a crit), so the Enforcer lives.
- A level-10 Butcher's Street Sweeper at 3 m (8 of 9 pellets) severs an arm or a leg of a level-10 Enforcer (208 health).
- A Hell Week level-50 Enforcer has 5,400 health, about 55 times a level-1 one. A starter headshot does under 6% of that.
- A level-55 Ghost with 175 Aim and 160 Nerve, maxed Longshot and a tier-V Lullaby takes about 43,000 off with a headshot and about 2,800 with a body shot.

## Loot (`loot.ts`)
**Rarity odds per item:**

| Rarity | Base chance |
|---|---|
| Unique | 1/500 |
| Set | 1/250 |
| Rare | 1/30 |
| Modded | 1/6 |

- Magic find has diminishing returns: `mf × k / (mf + k)`, where k is 250 for uniques, 500 for sets and 600 for rares.
- Elites multiply the odds by 3 (by 2 for modded).
- Hardboiled multiplies them by 1.3 and Hell Week by 1.6.

**Drops:**
- An ordinary kill drops an item 30% of the time; an elite drops 2 items, and a third 50% of the time.
- The item type is a weapon 40%, gear 45% or a chip 15% of the time.
- Scrip is `3–8 × ilvl × (1 + 0.5 × difficulty index)`, doubled for elites.

**Affixes:**
- There are 44 families: 20 prefixes and 24 suffixes.
- Bands unlock by item level. The highest eligible band rolls 60% of the time.
- Modded items roll 1–2 affixes; rares roll 3–5 (at most 3 prefixes and 3 suffixes) and get a two-word name.

**Sockets:**
- Standard items get 1 to the base's maximum 30% of the time.
- Modded items get 1–2 sockets 15% of the time, and rares 10%.

**Fixed items:**
- 15 uniques and 2 sets: *The Widow's Weeds*, 4 pieces, and *Market Day*, 3 pieces.
- Set bonuses are cumulative by pieces worn. Only the active weapon counts.

**Chips and chains:**
- There are 16 chips and 9 firmware chains.
- A chain needs a standard weapon of the right class with exactly as many sockets as chips, in order. For example, *Last Call* is Ash + Rain + Cold in a 3-socket sniper rifle.

## Stealth (`stealth.ts`)
**Sight:** `rate/s = 1.6 × distance × angle × light × stance × motion × detection × alarm`.

| Factor | Value |
|---|---|
| Distance | `((range − d) / (range − 3))^1.2` |
| Angle | 1 at the centre of the cone, 0.5 at its edge |
| Light | `0.15 + 0.85 × light` |
| Stance | stand 1, crouch 0.55, prone 0.3, slide 0.8 |
| Motion | `0.6 + 0.15 × speed` |
| Alarm | +25% per level |

- Outside the cone, beyond range or with no line of sight, the meter doesn't fill.
- Within 1.5 m in the cone, the enemy sees Cath instantly.

**States:**
- Suspicious at a meter of 0.35, combat at 1.
- The meter drains 0.12/s.
- Combat drops to searching after 5 s without sight, searching to suspicious after 20 s, and suspicious to unaware 6 s after the meter drains.

**Hearing:**
- A noise is heard within `radius × hearing`.
- Suppressed shots carry ×0.25 and subsonic rounds ×0.4 on top of that.
- A mask such as thunder or a train hides any noise whose effective radius is at most its strength, if it covers the noise or the listener.

**Alarm:**
- A noise or a camera raises it to 1. One body raises it to 2, two to 3, and combat to 3.
- It drops one level per 120 s without events, never below 1 once a body has been found.

## Enemies (`enemies.ts`)
- Health grows ×1.085 per level and damage ×1.08.
- Monster level is the area level, plus 15 on Hardboiled or 30 on Hell Week, capped at 70.
- Elite chance is 5%, 10% or 16% by difficulty.

**Elites:**
- They have ×2.5 health and shields, ×1.25 damage, ×3 XP and +25 magic find.
- They roll 1 modifier, 2 from level 20 and 3 from level 40.

| Elite modifier | Effect |
|---|---|
| Extra Fast | ×1.5 move speed, ×1.33 fire rate |
| Cursed | each hit drains 1 s of bullet-time |
| Shock Enchanted | 75% shock resistance, +30% shock added to its hits |
| Stoneskin | +30% armour, +40% kinetic resistance |
| Multiple Shots | 3 projectiles |
| Explosive on Death | 40% of max health within 4 m |

## Saves (`save.ts`)
- Saves are a JSON envelope `{version, savedAt, character, jobsDone, checkpoint?}`. The current version is 2.
- `MIGRATIONS[n]` upgrades version n to n+1. Version 1 had `gold`, skill pairs, and no respec counters or active weapon.
- The export code is `CATH<version>.<base64url JSON>.<FNV-1a checksum>`; whitespace is ignored on import.
