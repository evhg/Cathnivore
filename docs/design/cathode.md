# CATHODE: design bible

The owner, 2026-10-03, in a chat session: *"I'm okay with month long, start building. Push the limits."*

Their brief:
- A first-person shooter with a cyberpunk theme and Unreal Engine 5 level graphics, running in a browser.
- The **minimum spec is an iPhone 17 Pro Max**, so take the quality up a notch.
- A Diablo II-style skill tree, attributes that grow with experience, class specialisation and **dual classes**.
- Several weapon classes, like Doom and Unreal, upgradable and synergising with class and skill tree.
- Long-range stealth kills.
- **Violent, R-rated**, with a gritty noir vibe, for the audience that liked Cyberpunk 2077.

This file is the north star for every session that touches `games/cathode/`. Hedgerow's PG rules (its story bible, rule 7) don't apply here; VISION.md's craft bar and Cath's character bible do.

## 1. The pitch
**CATHODE** is a noir cyberpunk shooter-RPG.
- **The other ending:** in this timeline the Marrow Corridor got built. Hollowell paved the valley and grew a city-state on top of it: **Hollowell Proper**, a vertical slum of rain, neon and debt.
- **Cath Hale walks back in.** She was once Hollowell's best "cleaner" and left to raise Bea. Then Tomas Reed, the market man who knew everyone's name, is found in the harbour with a Hollowell debt tag in his mouth. Cath goes back into the city with a coat, pearls and a steel baton she still calls **the Pin**. She works down a list of names to find out who signed the order.
- **Noir in every layer:**
  - first-person voiceover in Cath's voice (dry, tired, occasionally funny);
  - a case board between missions;
  - every boss is a name on the list;
  - the city is always raining.

**Audience:** players who loved Cyberpunk 2077, Deus Ex, Dishonored, Diablo II, DOOM (2016) and Sniper Elite. **Rating:** R / PEGI 18 (strong bloody violence, strong language). No sexual content. Cath stays classy.

## 2. Cath, noir edition (extends VISION.md's character bible)
- **Look:**
  - mid-thirties, very long dark hair up in a low knot for work;
  - charcoal trench over a cream silk blouse, pearl studs, fine gold leaf pendant;
  - black leather gloves, red lipstick, winged liner.
- **What the player sees in first person:**
  - her gloved hands, the trench cuff and a pearl bracelet on every weapon;
  - her reflection in mirrors, wet windows and scopes;
  - her portrait (shared `shared/cath/` art, noir-graded) on the case board, in dialogue and on the level-up screen.
- **Voice:**
  - short sentences, concrete detail, one zinger per scene at most;
  - she swears rarely, so it lands;
  - she never gloats over the dead.
- **Bea** stays a wholesome detail: Cath calls her between missions; one of Bea's drawings is pinned to the case board.

## 3. Pillars
1. **Every kill is a decision.** Approach (ghost, gun or butcher), weapon, build. The game pays you for choosing, not grinding.
2. **Builds you dream about.** Diablo II's depth: attributes, three trees per class, synergies, dual classes, uniques, sets and firmware chains.
3. **It looks like a trailer.** Darkness, rain, neon and wet reflections are where real-time graphics are strongest. We play to that ruthlessly.
4. **Brutal, readable combat.** DOOM's speed and Sniper Elite's long shot. Every hit reacts: limbs, sparks, blood and ragdolls.
5. **Phone-first, console-feel.** It's built for the iPhone 17 Pro Max at 60 fps, and desktop with mouse and keyboard is first-class.

## 4. RPG systems (all pure TypeScript in `src/sim/`, unit-tested, deterministic given a seed)
### 4.1 Attributes
**Levels:** level 1 to 60. Each level gives **5 attribute points and 1 skill point**, and story jobs give bonus skill points (Diablo II's Den of Evil rule).

| Attribute | Gives |
|---|---|
| **Grit** | +2 health, +1% melee damage, +2 carry |
| **Aim** | +1% gun damage, +0.5% critical chance, -0.4% recoil, faster aim-down-sights |
| **Nerve** | +1% stealth, +0.5% bullet-time, +1% headshot damage, slower enemy detection |
| **Wire** | +2 cyberware capacity, +1% hack strength, +1 battery |

- Weapons and cyberware have attribute requirements.
- The class sets the starting attributes.
- XP to the next level is `round(120 * L^1.85)`, and monster XP falls off with the level gap (Diablo II-like).

### 4.2 Classes
There are five, each with three trees of 10 skills arranged in 6 rows.
- **Row unlock levels:** 1, 6, 12, 18, 24, 30.
- **Maximum rank** is 20 per skill.
- **Synergies:** a skill gets +x% per point in named other skills, as in Diablo II.

| Class | Fantasy | Trees |
|---|---|---|
| **Ghost** | Unseen sniper | *Longshot* (sniper rifles, bullet-time, wind reading), *Shroud* (stealth, optic camo, silent takedowns), *Cold Read* (marks, weak spots, kill-cam rewards) |
| **Butcher** | Melee and shotguns | *Meat* (blades, the Pin, finishers, dismemberment), *Scattergun* (shotguns, knockback, close crits), *Iron* (armour, rage, kills heal you) |
| **Gunslinger** | Pistols and SMGs | *Six-Shooter* (revolvers, fan the hammer, ricochets), *Spray* (SMGs, dual-wield, mag size), *Showman* (style meter, reload tricks, chain kills) |
| **Wirewitch** | Hacker | *Ghost in the Wire* (camera, turret and drone hijack), *Short Circuit* (overloads, chains, cyberpsychosis), *Daemon* (smart guns, homing rounds, an AI familiar) |
| **Fixer** | Explosives and gadgets | *Demolition* (launchers, grenades, mines), *Workshop* (deployable turrets and drones), *Chem* (gas, incendiaries, stims) |

**Dual-classing:**
- At level 15 Cath takes a second class, and its three trees open.
- Second-class skills cost the same but need the primary's level minus 3.
- Each of the 10 class pairs has a **hybrid capstone** at level 30. For example:
  - Ghost + Wirewitch: *Dead Signal* (sniper shots pass through walls a hacked camera sees);
  - Butcher + Fixer: *Wetwork* (finishers leave a live grenade);
  - Gunslinger + Ghost: *High Noon* (the bullet-time "dead-eye" marks up to 6 heads);
  - Wirewitch + Butcher: *Puppeteer* (a hacked enemy fights for you, then detonates);
  - Fixer + Gunslinger: *Trick Shot* (pistol rounds detonate mines and canisters for crits).
- Respec costs money and grows each time; one free respec comes after the act 1 boss.

### 4.3 Weapons (DOOM/Unreal variety, Diablo loot)
**Nine classes:**
- pistol
- revolver
- SMG
- shotgun
- assault rifle
- sniper/rail rifle (rails punch through cover)
- launcher
- smart gun (rounds curve to tagged targets)
- melee (the Pin, katana, monowire, sledgehammer)

**Each weapon has:**
- a base (damage, rate, magazine, reload, spread, recoil pattern, range falloff, noise, attribute requirements);
- an alt-fire.

**Rarity:**
- **Tiers:** Standard, Modded (blue, 1–2 affixes), Rare (yellow, 3–5 affixes, a generated name), Unique (gold, fixed name and lore), Set (green; pieces add bonuses).
- **Affixes** are prefixes and suffixes with level-banded ranges ("Vicious", "of the Drowned Market").
- **Sockets:** 0 to 4. **Chips** go in them; a named sequence of chips in a socketed weapon of the right class makes a **firmware chain** (Diablo II's runewords). Example: chips *Ash* + *Rain* + *Cold* in a 3-socket sniper rifle make **"Last Call"**: kills in bullet-time refill bullet-time.
- **Upgrades:** weapon tiers I to V at a gunsmith (Ana Ruiz, the fixer in the Drowned Market) raise base damage; parts (barrel, scope, suppressor, mag, stock) change handling.
- **Synergy with the tree:** skills scale weapon classes. *Longshot* points add sniper damage; *Spray* adds SMG magazine; a Ghost's *Subsonic* makes any suppressed weapon silent.

### 4.4 Damage and violence
- **Hit zones:** head (×2.5, ×4 sniper with Nerve), torso, arms and legs (×0.7, can sever).
- **Dismemberment:** a limb is lost when one hit exceeds the zone's threshold, or when it dies to shotgun, blade or explosion at close range.
- **Gore:** sprays, wall and floor decals that persist for the mission, and gibs.
- **Enemy states:** wounded enemies limp, crawl and bleed out; sparks and fluid for cyborgs.
- **Defences:** armour mitigates a share of the damage, and piercing ignores it; shields have to be broken first.
- **Damage types:** kinetic, shock, incendiary, toxic and monowire. Enemies have resistances (as in Hedgerow's counters).
- **Gore toggle:** an "Intensity: Full / Reduced" setting. Reduced keeps hit reactions but drops severing and decals.

### 4.5 Stealth and the long shot
- **Detection:** each enemy has a vision cone and hearing. A detection meter fills by distance, light, motion, Cath's stance and Nerve.
  - **States:** unaware, suspicious (investigating), alerted (searching), combat.
  - A **body found** raises the alarm level for the area: more patrols and reinforcements.
- **Ballistics:** sniper rounds travel in time (600–1,100 m/s) with drop under gravity and drift from the district's wind. The scope reticle has a range ladder.
  - **Held Breath** steadies the sway, and bullet-time slows the world.
  - **Masking:** a subsonic or suppressed shot masked by thunder, a passing train or a neon sign's hum isn't heard.
- **The kill-cam:**
  - when it plays: on a long stealth headshot, the last enemy, or a 1-in-4 roll for criticals;
  - the camera rides the bullet in slow motion;
  - an X-ray cut shows the skull or ribs breaking;
  - it can be skipped by tap.
- **Rewards:** an unseen kill pays +50% XP. A whole area cleared unseen pays a "Ghost" bonus.

### 4.6 Enemies (Hollowell Proper's food chain)
- **Corp security:** Hollowell Enforcers in riot armour with glowing visors, plus riot-shield teams and snipers.
- **Street gangs:** the Price-War Boys (Crisp's muscle).
- **Candor's chrome:** surgically "improved" thugs, heal-drones and cyberpsychos.
- **Machines:** spider mines, sentry turrets, drones and the ED-class mech.
- **Elites** get Diablo-style modifiers: *Extra Fast*, *Cursed* (drains bullet-time), *Shock Enchanted*, *Stoneskin*, *Multiple Shots*, *Explosive on death*.
- **Bosses** are the names on the list:
  1. **Julian Crisp** (Drowned Market)
  2. **Dr Octavia Vane** (the Candor clinic towers)
  3. **Graham Pell** (Hollowell Plaza)
  4. **The Board** (the boardroom at the top of the Spire)
  5. **HollowCandor** (the AI, in the server vault under the river)

### 4.7 Structure
- **Five districts.** Each has a hub street, 4 story jobs, generated side contracts, a boss and secrets (stashes, audio logs, Bea's drawings).
- **Jobs take 10–25 minutes.** Phone sessions resume mid-job from a checkpoint.
- **Difficulties:** Noir, Hardboiled and Hell Week, with higher monster levels, better drops and elite odds (Diablo II's Normal, Nightmare and Hell).
- **The weekly Most Wanted:** a seeded contract that's the same for everyone (like Hedgerow's Endless).
- **Saves:** localStorage plus an export/import code; never broken, always migrated (VISION).

## 5. Technology: pushing the limits on the minimum spec
**Target:** an iPhone 17 Pro Max (A19 Pro, 12 GB) in Safari at 60 fps. The render scale and settings adapt, and the frame budget is 14 ms. Desktop Chromium, Firefox and Safari can go higher.

**Stack:**
- three.js `WebGLRenderer` (WebGL2) with a custom HDR pipeline. It's mature in Safari and headless-testable; WebGPU is a later option when three's `WebGPURenderer` matures.
- No WASM: the CSP has no `wasm-unsafe-eval`, so physics and ragdolls are our own Verlet code.

**Graphics features:**
- HDR linear rendering, AgX or ACES tone mapping, and **noir grading**: desaturated midtones with neon allowed to keep its colour, film grain, vignette and slight chromatic aberration.
- **Wet streets:**
  - planar reflections on the ground at half resolution, blurred by roughness and distorted by a rain-ripple normal map;
  - a puddle mask;
  - screen-space reflections on walls later.
- **Lighting:**
  - many neon lights through clustered or tiled forward shading (or an emissive-plus-baked approach), so dozens are lit cheaply;
  - signs with flicker and buzz;
  - baked ambient occlusion and lightmaps for static geometry (generated at build time or on load), with light probes for dynamic objects;
  - one shadowed key light (a moon or a spot) with cascaded or spot shadow maps.
- **Atmosphere:**
  - height fog plus volumetric light shafts (raymarched at low resolution, or additive cone meshes with noise);
  - GPU-instanced rain streaks, splashes, drips from ledges, steam vents and drifting smoke;
  - drops on the lens when looking up, and wiped away by the player.
- **Materials:** PBR from **Poly Haven (CC0)** texture sets (asphalt, concrete, metal, brick, tiles), at 1k–2k, compressed. Procedural decals: graffiti, posters, grime and kanji signage generated on canvas.
- **Characters:** procedural segmented armoured humanoids (plate meshes with bevels, glowing visors), so dismemberment is a real detachable segment. They animate procedurally (IK legs, spring-driven upper body) and turn into Verlet ragdolls on death. Later: CC0-licensed rigged models if a good source is found (VISION: CC0 or OFL only).
- **Weapons in first person:** high-detail models in code with procedural animation (sway, bob, recoil springs, reload choreography) and muzzle flash lights. Shell casings are physical, and casing sounds depend on the surface.
- **Post-processing:** bloom (HDR threshold), temporal anti-aliasing or FXAA, motion blur on fast turns, depth of field in kill-cam and menus, and screen-space ambient occlusion on desktop.
- **Audio:** WebAudio, synthesised and CC0:
  - convolution reverb per space (alley, interior, plaza);
  - the gunshot and its tail, rain beds, distant sirens;
  - a dark synthwave score that intensifies with the alert level.
- **Loading:** each district is a chunk under 40 MB, cached by the service worker, and the first job is playable within 15 s on 5G.

**Quality presets:**
- **Phone:** half-resolution reflections, 0.8 render scale plus FXAA, 24 dynamic lights, rain at 30%.
- **High** (desktop default): full-resolution reflections, SSAO, 64 lights.
- **Ultra.**

The frame-time readout is `?perf`.

## 6. Controls
- **Desktop:** WASD, mouse look (pointer lock), Shift sprint, Ctrl crouch or slide, Space jump or mantle, Q/E lean, F takedown, R reload, 1–9 weapons, mouse wheel, right mouse aim, middle mouse alt-fire, Tab case board and inventory, K skill tree.
- **Phone (landscape):**
  - movement: a left virtual stick, with a double-tap to sprint;
  - aiming: right-side swipe, with optional gyro aiming;
  - buttons: on-screen fire, aim, jump, crouch, reload and weapon wheel; a contextual takedown button;
  - aim help: magnetism and slowdown near targets (off on Hell Week), and an option for auto-fire on the crosshair.
- **Controller:** the Gamepad API.

## 7. Phases (ROADMAP items)
The month plan. Each phase ends with something playable on the live site, behind an 18+ gate.
1. **Vertical slice** (week 1):
   - the `/cathode/` page, the age gate, a landing card;
   - the rain-soaked Drowned Market street at full graphics quality;
   - first-person movement and collision;
   - the Pin, a pistol, a shotgun and a sniper;
   - Enforcer AI with stealth detection;
   - gore and ragdolls, the kill-cam;
   - XP and levels with attributes, Ghost and Butcher trees playable;
   - one job ("The Fish Market") with a start and an end.
2. **Systems:**
   - all 5 classes and 150 skills, dual-classing and capstones;
   - loot (rarities, affixes, sockets, firmware chains), the gunsmith and upgrades;
   - inventory and the case board UI;
   - elites, saves and checkpoints.
3. **Act 1 complete:** the Drowned Market hub, 4 jobs, the Crisp boss fight, side contracts, audio and score, phone controls polish, the performance pass.
4. **Acts 2–3:**
   - the Candor clinic (Vane) and Hollowell Plaza (Pell);
   - new enemy families, launchers and smart guns, Wirewitch and Fixer depth.
5. **Acts 4–5 and the endgame:**
   - the Spire and the Board, then the vault and HollowCandor;
   - Hardboiled and Hell Week;
   - the weekly Most Wanted contract.

## 8. Rules for sessions
- **Code layout:** `games/cathode/src/sim/` holds rules and numbers (pure TypeScript, tests in `tests/cathode-*.test.ts`); `src/render/` is three.js; `src/game/` holds the loop, input and AI; `src/ui/` is the HUD and menus (DOM, CSP-safe: no inline styles).
- **Screenshots:** take them with `?shot` (fixed seed, rain frozen) at 1440×900 and 956×440 (iPhone 17 Pro Max landscape) before and after any visual change. Headless Chromium needs `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- **Assets:** procedural or CC0 only. Credit every third-party file in `games/cathode/CREDITS.md`, and keep `games/cathode/public/` under 60 MB.
- **Never** gate the rest of the site on CATHODE. Its e2e test checks the age gate and that the slice boots without errors.
