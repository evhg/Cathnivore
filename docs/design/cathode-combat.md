# Phase C: CATHODE combat, look and feel (owner's playtest and goals)

This spec lives at `docs/design/cathode-combat.md`, the path ROADMAP Phase C already names. Where it is more specific than the C1 to C8 placeholders in ROADMAP, this spec wins: replace those placeholders with C1 to C20 below. It merges three specialist specs (gunfeel, enemies, player and front door), the AAA research brief and the playtest audit of `origin/build` @ `18585ee`/`e481c68`. It is the only source of truth for Phase C, and it adds to the existing code. It does not rewrite it.

**Priority.** Until C1 to C11 have shipped, Phase C comes before ROADMAP Phases D and H, because the owner's playtest is the newest owner direction. Log this in `DECISIONS.md` when the first C session starts. The owner asked for at least a week of non-stop work on this, so Phase C stays exclusive until C20 is done.

## The owner's playtest (5K desktop, 2026-10-15)
> "I don't like the name. It still feels like a budget game, especially the loading screen and the menus. The starting screen looks budget. Take inspiration from real AAA game designs. It's easy to take down the first enemy but it feels very unsatisfying. The first weapon pickup is easily missed; I didn't know there was an indicator. When I'm shooting at the enemy, I don't see if I hit or not. Can the enemy be hit if I can see it but it's behind something? The enemy looks very basic. The pistol design and shooting animation are so simple, definitely not AAA grade. Focus on combat mechanics, look and feel, the weapons and enemy design, and make the visuals when getting hit, being wounded and dying very high quality. Spend at least a week on this, non stop."

### Each complaint, its cause and its fix
| Complaint | What the audit found | Fixed in |
|---|---|---|
| "I don't see if I hit" | Hit ticks are 2×7 CSS px (4×14 physical at 5K). The hit sound is `hitFlesh`, which is also Cath's own hurt sound. The flinch (`push*0.06`) can't be seen. Blood is near-black and sprays away from the player. | C1, C2 |
| "Hit behind something?" | The ray logic is right: world first, then enemies within `maxD`. But only 42 of 126 level props have colliders, so glass, shutters, rails, AC units and awnings let bullets through. Rotated props use bounding boxes that are too large. A shot stopped by cover gets no feedback. | C1 |
| "First enemy easy but unsatisfying" | The takedown is instant (`damage(hp+1)`), with no animation, no camera and no sound, and the body folds into a pile of boxes. Gun kills have no hit-stop, no kill sound and no death moment. The target bar stays up after a kill. | C1, C2, C9, C11 |
| "First weapon easily missed" | The case sits 12 m away behind the pawn-shop car, 47% of the way to the left screen edge. Its beam is lost in the rain. The diamond is 40 physical px. There is no prompt and no arrow. | C3 |
| "Enemy looks very basic" | 11 segments of cylinders and boxes, flat materials, a sphere for a helmet. No cloth, no faction markings, no rim light. At 10 m he blends into the street. | C10, C15, C20 |
| "Pistol design and shooting animation so simple" | About 15 primitives, no textures, hands mostly off screen. Recoil is translation only. The slide moves linearly. The reload is a dip. The suppressed pistol shows a 0.36 m white cross for a flash. | C4, C5 |
| "Getting hit, wounded, dying: very high quality" | A CSS gradient and a 140×36 px arc. Death shows a banner, then `location.reload()`. | C6, C7, C8, C17 |
| "Loading screen, menus, starting screen budget" | A centred card, a chibi SVG Cath, empty space at 5K, and a black loading screen with a hairline bar. | C12, C13, C14 |
| "Don't like the name" | "CATHODE" appears in the gate, the title, `<title>`, aria labels, docs and the URL. | C12 |

---

# Pillars and the bar (what AAA means here, with reference games)

1. **Every hit gives five readouts on the same frame.** A marker, a dry hit sound, a reaction on the hit segment, an effect anchored to the bone, and a mark that stays (a wound or a decal). A shot that cover stops gives none of the first three. It gets its own glyph, sound and impact effect instead. *References: DOOM (2016), Destiny 2 crit "ding", Valorant head/body hit effects, Nuclear Throne's layering.*
2. **A hit marker means flesh or armour, and nothing else.** Its size comes from the class of hit (body, head, armour, kill), never from the damage dealt. *Reference: the Overwatch marker-size backlash.*
3. **No silent damage.** Every enemy reacts to every hit, elites and bosses included; heavy enemies scale the reaction down. *Reference: Cyberpunk 2077's anti-bullet-sponge rule.*
4. **Overstate what matters to play.** A stagger window, a broken plate, an enemy reload and a regen start must read twice as clearly as feels natural, at 10 m, in rain, in the noir grade. *Reference: Bungie's Grunt-panic lesson.*
5. **Weapons are machines.** Separate moving parts, gloved hands that wrap the grip, recoil on several springs, a slide that locks on the last round, a choreographed reload, layered sound with reflections. *References: Call of Duty: Modern Warfare (2019), Titanfall 2.*
6. **Bodies have weight.** Hits flinch the body, damage builds to a stagger, death starts as a powered fall that blends into a ragdoll, armour breaks off, and blood stays where it lands. *References: Max Payne 3 (Euphoria), DOOM Eternal destructible demons, The Last of Us Part II.*
7. **Cath's body is the HUD of her health.** The screen, sound and hands tell you she is hurt, wounded or dying, and when she is recovering. Death is a physical fall and a held moment, never a modal. *References: Halo shields, Call of Duty's red edge, Control's ink, Max Payne 3's lingering type.*
8. **The front door is a place in the world.** A live 3D scene with Cath in it that remembers your progress, a few menu items that never move, a sound on every focus change, and loading screens that carry lore instead of tips. Starting the game is a camera move. *References: The Last of Us Part II, Dragon Age: Inquisition, Hitman, Control, Assassin's Creed Odyssey's mask screen.*
9. **It scales to 5K and fits an iPhone.** Every HUD size comes from viewport height. The 3D renders at a dynamic scale, and the DOM HUD renders at native resolution.
10. **It stays inside the browser rules.** WebGL2 and three.js only, no WASM (so no Draco, KTX2/Basis, Ammo or Rapier), no CSG. A strict CSP: no `style=""` and no `<style>`, only classes and `el.style.setProperty('--x', …)`. Assets are self-hosted and either procedural or CC0. Each CC0 file is logged in `games/cathode/public/tex/CREDITS.md`, and combat textures stay under 6 MB of download in total.

**The bar for each milestone.** Shots of the before and after frames at all three sizes go to a subagent. It critiques them against this spec, `VISION.md` and the reference games named for that milestone. The milestone is done only when the critique finds nothing a player would notice that is still "blockout", "placeholder" or "web page". Findings that remain become the next slice.

---

# Systems

## S0. Shared runtime (built in C1; everything else uses it)

All feel numbers live in `games/cathode/src/game/feel/tuning.ts`. It is a plain object with no three.js import, so tests read the same values the game uses. Every timing, size and gain in this spec gets a named entry there.

| Module | Contents | Test |
|---|---|---|
| `game/feel/timescale.ts` | The only writer of `simScale` and `fxScale`. `push(id, scale, holdMs, rampInMs, rampOutMs, priority)`: the lowest active scale wins, and a tie goes to the higher priority. Priority order: death > takedown > Second Wind > kill-cam > pause > hit-stop. `hitStop(ms)` takes the larger of the current and new stop and never stacks: the cap is 150 ms. Sim, AI, physics and particles use `simDt = realDt*simScale`. During a hit-stop, particles run at `fxScale = 0.25`, so blood hangs in the air. Rendering, audio, viewmodel springs, camera trauma, HUD and input always use `realDt`. It replaces `killcam.timeScale * run.timeScale` and the melee-only `hitStop`. | Overlapping pushes resolve to the minimum. A hit-stop inside slow motion returns to the slow motion, not to 1.0. Ramps are monotonic. Nothing holds longer than 3 s except death. Render dt is unaffected. |
| `game/feel/spring.ts` | `Spring1` and `Spring3`, semi-implicit Euler at fixed 1/240 s substeps, built from `{freqHz, zeta}` with `k=(2πf)²` and `c=2ζ·2πf`. Supports `shove(v)` and `target`. | Settles within ±2% of the analytic time. Stable at dt = 0.1 s. |
| `game/feel/trauma.ts` | One camera-shake accumulator. `add(x)` caps at 1. Shake = trauma² × max (1.8° rotation, 0.8 cm), from 20 Hz value noise. Decays at 1.6/s. Reduced motion caps trauma at 0.3 and turns roll off. Phones get ×1.2 in place of rumble. | Decays from 1 to 0 in about 0.63 s. Output is 0 at trauma 0. |
| `game/feel/clip.ts` | Keyframe clips `{dur, tracks:{[part]: Key[]}}` with `Key=[tMs,pos3,rot3,ease]`, sampled additively. `eventsBetween(t0,t1)` gives sound and spawn cues. The existing `SWING_FORE` tables become clips. | Interpolation, eases and event times. |
| `game/feel/ik.ts` | Two-bone analytic IK with a pole, shared by the viewmodel arms and enemy arms. Reuse the leg-IK maths in `body.ts`. | The end effector lands within 1 mm of a reachable target. |
| `sim/hitevent.ts` + `game/feel/bus.ts` | `resolveHit` returns a `HitEvent` (below). The `CombatBus` carries `fire`, `hit`, `blocked`, `nearMiss`, `kill`, `plateBreak`, `visorBreak`, `sever`, `stagger`, `takedownStart`, `takedownImpact`, `takedownEnd`, `encounterCleared`, `cathHit`, `guardBreak`, `cathDown`, `pickupSeen` and `pickup`. Combat only emits; HUD, audio, FX, viewmodel and post only listen. `window.cathode.combat.replay([...HitEvent])` replays events on a frozen frame for screenshots. | Each listener is called once per emit. Replay is deterministic. |

```ts
interface HitEvent {
  t: number; targetUid: string; seg: SegmentName; zone: Zone;
  point: Vec3; normal: Vec3; dir: Vec3; distance: number;
  weaponCls: WeaponClass; damage: number; crit: boolean;
  layer: "flesh" | "plate" | "visor" | "cyber" | "shield" | "weakpoint";
  plateId?: string; plateBroke?: boolean; visorStage?: 0 | 1 | 2;
  penetrated: boolean; lethal: boolean; severed?: SegmentName[];
  reaction: "flinch" | "stagger" | "knockdown" | "none";
  staggerDir?: "front" | "back" | "left" | "right";
}
```

**Audio buses** (`game/audio.ts`). Each bus feeds `master`, which feeds a `DynamicsCompressor` (threshold −18, ratio 4, knee 6, attack 3 ms, release 150 ms) and then the output.

| Bus | Carries | Treatment |
|---|---|---|
| `world` | Everything spatial | Passes the `muffle` lowpass and the reverb send |
| `player` | Cath's body: breath, heartbeat, grunts | Dry, never muffled |
| `dry` | Hit confirms | No reverb, no duck, +3 dB over gunfire |
| `ui` | Menus | Never muffled or ducked |
| `music` | Music | Ducked |

One `AudioState` object drives the buses: `{muffleHz 22000..400, worldGain, tinnitus 0..1, heartbeatBpm, breath 0..1, duck dB}`. Values ramp with `setTargetAtTime`, with τ 40 ms on attack and 400 ms on release. The voice cap is 32 live voices on desktop and 20 on phone; when full, the oldest tail is stolen first. Per-shot variation everywhere: pitch ±4%, gain ±1.5 dB, and a pick from 3 to 5 parameter sets.

**Stage hooks for screenshots.** `?play&shot&stage=<name>&t=<ms>` builds a scene and freezes it at an exact feel time. `window.cathode.stage(name, tMs)` does the same at runtime. `&rs=0.5` forces the 3D render scale, so 5K captures finish under SwiftShader while the DOM still renders at full DPR. `&quality=phone` picks the phone profile. Front-door states use `&front=gate|title|classpick|loading:<district>|pause|deathcard`. Vitals states use `&vitals=hp:0.25,hurt:0.8,dir:120`. `&death=<ms>` shows a moment of the death sequence. `?debug=cover` draws every collider as a wireframe coloured by material. `window.ruin` is an alias of `window.cathode`.

**The screenshot script** is `scripts/cathode-feel-shots.mjs`, generalised from `cathode-hit-shots.mjs`. It shoots every stage at 2560×1440 @2 (`rs=0.5`), 1440×900 @1 and 844×390 @3 (`rs=0.5`, `quality=phone`), and writes `e2e/screenshots/c-<stage>-<vp>.png`. Next to each image it writes a JSON sidecar of DOM rects × DPR and of `window.cathode.stats` (`drawCalls`, `tris`, `combatMs`, `particles`, `voices`). It fails the run when a DOM size check, a presence check, a pixel probe or a budget check named in a milestone fails. Before shooting, run `lsof -i :4173` and kill any stale preview (CLAUDE.md).

## S1. Hit feedback

### S1.1 Resolution and cover (the owner's "behind something" question)
- **The ray order stays:** world first, then enemies within the capped `maxD`, nearest hit wins. The rules are already right; the colliders are what's missing.
- **Collider coverage.** The `box()` and `cyl()` builders in `render/level.ts` and `render/levels/*` take `cover: "solid" | "thin" | "none"` and `mat`. Defaults by prop kind:
  - `solid`: walls, crates, cars, counters, pillars, AC units, planters, dumpsters, statues.
  - `thin` (blocks bullets, not movement, `collide:"shot"`): shop glass, shutters, railings, awnings below 3 m, sign boxes, plywood, cloth stalls.
  - `none`: decals, rain, light cones, lamp heads above 2.4 m.
  - A level-audit test fails when a prop that is at least 0.9 m tall and at least 4 cm thick, and not marked `none`, has no collider.
- **Oriented boxes.** `RayWorld` gains OBBs (a box plus a yaw quaternion). The ray is transformed into box space and the existing slab test runs there.
- **Penetration** (`sim/penetration.ts`, pure). Uses `WeaponStats.penetration`. A round can pass through 1 layer, or 2 for the sniper.

  | `mat` | Through? | Damage after |
  |---|---|---|
  | glass | yes | 70% |
  | drywall, cloth | yes | 60% |
  | wood | yes | 45% |
  | metal sheet under 3 cm | only if `penetration ≥ 1` | 35% |
  | concrete, solid metal | never | — |

  A round that passes through plays the impact on both faces. A hit after penetration shows the hollow `pen` marker and plays the hit tick at −3 dB.
- **Blocked.** Emitted when the ray hits a collider and an enemy segment lies within 1.0 m of the ray beyond the hit point, with line of sight to the camera from the hit point. This is "you were aiming at him and cover ate it". The response:
  - The material impact plays at ×1.5, plus a spark fan of 12 to 20 particles on metal or concrete.
  - A 320 ms hollow-bracket glyph appears beside the crosshair (`Hud.blocked()`). The word "COVER" shows for the first three uses only.
  - `Audio.blocked()` plays: a dull crack plus a ricochet whine 30% of the time.
  - **No hit marker, ever.**
- **Near miss.** Emitted when a ray passes within 0.5 m of an enemy head without hitting. The enemy's head flinches 8°, it ducks for 400 ms, and its accuracy drops ×0.6 for 1 s. There is a 40% chance of a "Taking fire!" bark. The player gets no marker but sees the shot do something.
- **Peeking enemies** are hittable only where their geometry shows. A head over a 1.1 m crate can be hit; the chest behind it can't. A test checks this.
- **Ballistic rounds** keep their 240 Hz stepping. The kill-cam no longer steers the round: it plays only when `predict()` already says the round will hit.
- **Debug hook:** `window.cathode.combat.traceShot(from,to)` returns `{blockedBy, mat, enemy, zone, damage, pen}`.

### S1.2 Marker (DOM, `ui/hud.ts` + `styles/hud.css`, sized in `--u`; see S8)
| Class | Tick length / thickness / gap | Colour | Pop | Hold / fade (ms) | Extra |
|---|---|---|---|---|---|
| body | 10u / 2.25u / 7u | `#f4f1ea`, 1u `#000a` outline | 1.25→1.0 over 60 ms | 80 / 140 | — |
| head / crit | 13u / 2.5u / 7u | `#ff3b3b` | 1.35→1.0 | 90 / 160 | 2u centre-dot flash |
| armour | 10u / 2.25u | `#9fb4c8` | 1.15 | 80 / 120 | 3u shield pip below the centre |
| armour break | as armour | `#9fb4c8` | 1.3 | 90 / 200 | Pip plus a shatter ring of 10u→26u |
| pen | 10u hollow, 1u stroke | `#f4f1ea` | 1.2 | 60 / 120 | — |
| kill | 15u / 3u / 9u | `#ff3b3b` | 1.5→1.0 over 80 ms | 120 / 400 | Ring expands 12u→40u, fades over 420 ms |
| head kill | kill plus a 1u gold `#e8b04a` accent | | | | Ring doubled |

- A new hit restarts the animation by re-adding the class on the next frame, with no reflow.
- **Damage numbers** are off by default (`prefs.damageNumbers`). When on: condensed mono at 16u, rising 30u over 600 ms. Hits within 250 ms merge into one rolling number. Crits show at 20u in amber.
- **Target bar bug fix.** `Hud.targetHit` also runs on lethal hits, with `frac = 0`. The bar flashes, collapses its width over 180 ms and hides 400 ms later.
- **Gamepad rumble**, where `vibrationActuator` exists:

  | Event | Motor | Magnitude | Duration |
  |---|---|---|---|
  | fire | weak | 0.3 | 40 ms |
  | hit | weak | 0.2 | 30 ms |
  | kill | strong | 0.6 | 120 ms |
  | hurt | strong | 0.5 + 0.25k | 160 + 80k ms |

### S1.3 Hit-confirm sounds (`dry` bus; `game/combataudio.ts`)
| Event | Layers | Peak |
|---|---|---|
| body | Square 2.6 kHz falling to 2.2 kHz over 45 ms; noise high-passed above 5 kHz, 30 ms; sine "thock" 140 Hz falling to 90 Hz over 60 ms | −12 dBFS |
| head / crit | Square at 3.6 kHz, plus sines at 1.8 and 2.7 kHz with a 250 ms decay (the "ding") | −10 dBFS |
| armour | 3 inharmonic sines (1.1, 2.9, 4.3 kHz) with a 180 ms decay, plus a 10 ms click | −14 dBFS |
| plate break | The armour layer, plus a crack (noise high-passed at 3 kHz, 80 ms), plus 3 to 5 debris clicks between 60 and 140 ms; the clatter on landing plays on the world bus | −10 dBFS |
| visor shatter | 6 random sines between 3 and 8 kHz, each 40 to 120 ms, staggered over 150 ms, plus a noise sizzle | −10 dBFS |
| kill | The body or head layer, then at +50 ms a square 1.5 kHz falling to 1.1 kHz over 90 ms, a sub 70 Hz falling to 40 Hz over 180 ms, and a 300 ms noise "whump" low-passed at 400 Hz | −8 dBFS |
| head kill | The kill layers plus a 2.2 kHz ding with a 400 ms decay | −8 dBFS |

- `hitFlesh` stays as the world-space meat impact, spatialised on the world bus (a 50 ms noise slap low-passed at 1.2 kHz plus a 90 Hz thump).
- **Cath never plays `hitFlesh` again.** She gets `Audio.hurt()` (S6).
- On each kill, music and ambience duck by 3 dB for 400 ms.

### S1.4 Kill confirm
- Hit-stop (S1.5).
- An FOV punch of −1.5° that recovers through a spring over 150 ms.
- Trauma +0.2.
- The kill marker and kill sound.
- On the last enemy of an encounter, slow motion follows (S5.6).

### S1.5 Hit-stop table (`tuning.hitStop`)
| Event | Stop (ms) |
|---|---|
| body hit, semi-auto (pistol, revolver, shotgun, sniper) | 12 |
| body hit, automatic (SMG, rifle) | 0 |
| crit hit | 20 (automatic: 0) |
| plate break | 40 |
| melee connect | 40 |
| kill | 60 (automatic: 40) |
| headshot kill | 110 |
| takedown impact | 80 |
| last enemy of the encounter | 120, then 0.35× slow motion for 700 ms with a 250 ms ramp out |
| Cath's death | 120 |

Rule: while firing automatic weapons, the sum of stops in any 100 ms window stays at or below 30 ms.

## S2. Weapons

### S2.1 Construction (`game/gunkit.ts`, `render/guntex.ts`)
- **Primitives:**
  - `profile(points, depth, bevel)`: an `ExtrudeGeometry` of a side silhouette, bevel 0.6 to 1.2 mm, 2 bevel segments on desktop and 1 on phone. Cut-outs (ejection port, lightening cuts, serrations) are `Shape.holes`. **No CSG.**
  - `lathe(radii)`: 24 segments, or 12 on phone.
  - `rounded(w,h,d,r)`: `RoundedBoxGeometry`.
  - A shared part vocabulary for enemy weapons too.
- **Merging and caching.** Geometry is merged per (moving part × material) with `mergeGeometries`, giving 6 to 12 draw calls per gun. Built rigs are cached by model id and built when the weapon is first owned, in an idle callback, never mid-fight. Each build takes at most 25 ms on desktop and 40 ms on phone.
- **UVs.** Box-projected at 1 texel per 0.25 mm. Extrude side faces get planar UVs along the profile.
- **Trim atlas.** One atlas, generated at load from canvas height fields with Sobel-derived normals. 1024² on desktop, 512² on phone.
  - Bands: grip stipple, slide serration, knurling, polymer grain, brushed steel, Cerakote orange-peel, padded nylon, the engraving "KESTREL 9 · HOLLOWELL ARMS · 9×21", and the faction text.
  - Outputs: albedo, roughness and metalness packed in G and B, a normal map, and an edge-wear mask.
  - Edge wear: a vertex attribute `aEdge` (1 on bevel vertices) times noise. Where it exceeds 0.55, albedo lightens by 25% and roughness drops by 0.2, through `onBeforeCompile`.
  - Optional: a CC0 `painted_metal` detail normal from Poly Haven at 512² WebP, tiled every 4 cm.
- **Materials.** `MeshPhysicalMaterial` on desktop, `MeshStandardMaterial` on phone.

  | Part | Colour | Metal / rough | Extra |
  |---|---|---|---|
  | Polymer frame | `#1b1c1f` | 0 / 0.62 | Stipple normal at 0.8 |
  | Slide | `#2a2c30` | 1 / 0.34 | Edge wear; clearcoat 0.3 on desktop |
  | Barrel and hood | `#8a6a3c` (TiN bronze) | 1 / 0.28 | — |
  | Pins and springs | `#9aa0a6` | 1 / 0.4 | — |
  | Tritium dots | `#7dffb2` | Emissive 3.0, blooms | — |
  | Faction trim | `#3fe0ff` | Emissive 1.2 | One accent line only |

- **Viewmodel lighting.**
  - Its own PMREM environment, made at load from a tiny neon room with four emissive strips (red, cyan, amber, white).
  - A key light from the upper left at 1.2.
  - A cyan rim light from behind right at 0.8.
  - The gun never renders black.
- **Viewmodel rendering.** A first-person layer drawn after a depth clear, in the same HDR buffer. Viewmodel FOV 54° (world FOV 75°). Near plane 0.01.
- **Hands**, the biggest single step up from a budget viewmodel.
  - Black leather gloves (`#141214`, roughness 0.45, sheen 0.4) and a burgundy `#5a1420` cuff showing 2 cm of sleeve, using `shared/cath/` palette tokens.
  - Each hand: a palm extrude, 4 fingers × 3 phalanges, and a 3-phalanx thumb, in a joint hierarchy with one curl scalar per finger. Merged into 3 draw calls: static fingers, trigger finger, thumb.
  - Forearm and upper-arm tapered lathes, driven by `feel/ik.ts` from shoulder anchors at (±0.18, −0.28, +0.35) toward the `gripR` and `gripL` empties on the gun.
  - The grip is a modern two-handed thumbs-forward grip, with the support hand wrapping the firing hand. The trigger finger lies along the frame and curls only while firing.
  - **At hip fire, at least 25% of the viewmodel's pixels are hand or arm.** The camera shows the wrist and part of the forearm.
  - Wound states: blood smears on the glove backs below 30% Flesh (a mask texture with uniform `uBloodiness`; roughness 0.2 where wet). In the `bleeding` tier, a drip falls from the support wrist every 1.5 s.
- **World guns** (pickups, drops, enemy weapons) use the same kit with `THREE.LOD`:
  - LOD0: the full merged mesh.
  - LOD1 beyond 8 m: no cut-outs, one material, no bevel.
  - LOD2 beyond 30 m: one box with atlas albedo.
- **Kestrel 9 part nodes** (all must exist):
  - `frame` (with stipple), `slide` (with serrations and the port cut), `barrel` (tilts 3°), `hammer` (0 to 55°), `trigger` (5 mm travel), `mag` (with a visible top round), `slideStop` (12° up on lock).
  - `sightF` and `sightR` (tritium), `suppressor` (a lathe with 6 grooves and an end cap), `rail`, `guard`, `floorplate`.
  - The red-dot, rebuilt as an extruded housing with physical glass (roughness 0.05, opacity 0.25).
  - Empties: `gripR`, `gripL`, `muzzle`, `port`, `magwell`.
- **Viewmodel budget, hands included:** desktop ≤ 30k triangles and ≤ 14 draw calls; phone ≤ 14k triangles and ≤ 10 draw calls.

### S2.2 Viewmodel animation stack (`Arsenal.pose`, layers added in this order)
1. **Base:** hip to ADS with smoothstep (ADS time per class in S2.6). ADS zooms FOV by ×1.15, fades the crosshair, and scales sway, breath and bob by 0.3.
2. **Locomotion:**
   - Walk bob: a figure-eight at the stride frequency, x 6 mm, y 10 mm, roll 0.6°.
   - Sprint pose: pitch −25°, yaw +30°, roll +10°, y −4 cm, blended in 200 ms.
   - Landing dip: 3 to 6 cm in proportion to fall speed, plus 2° of camera pitch, on a 6 Hz spring with ζ 0.6.
3. **Clip:** draw, reload, inspect, takedown arms or melee, from `feel/clip.ts`.
4. **Springs:**
   - Look sway: −0.02°/px, clamped to ±4°, with ±3° roll into turns, at 8 Hz and ζ 0.7.
   - Breathing: pitch ±0.3° at 0.25 Hz, plus a Lissajous of x at 0.5 Hz and y at 1.0 Hz, ±3 mm.
   - Recoil (S2.3).
   - The hurt jolt (S6).
5. **Weight:** class mass (pistol 1.0, rifle 1.6, launcher 2.4). Spring frequencies are divided by √mass, and bob is multiplied by 0.85 per mass step.
6. **Wounded:** sway ×1.6 and ADS time +20% in the `critical` tier and below.

### S2.3 Pistol fire choreography (Kestrel 9, suppressed)
| t (ms) | Event |
|---|---|
| −30 to 0 | While the button is held down, the trigger is preloaded to 3 mm |
| 0 | Trigger at 5 mm, hammer drops. Muzzle puff and light. Camera recoil impulse. Viewmodel shove: position z +3.0 cm, y +0.5 cm; rotation pitch +6°, roll ±2°. `fire` event. Trauma +0.12. |
| 0–30 | Slide travels 24 mm back with an ease-out (`1-(1-u)³`). The barrel tilts 3° from 14 ms. |
| 18 | A shell leaves `port`: velocity right 1.8–2.4, up 1.0–1.4, back 0.3 m/s; spin 25–40 rad/s; ±20% random. |
| 30–62 | Slide returns with an ease-in and lands with a 1-frame 0.6 mm overshoot. The hammer re-cocks to 55°. |
| 62 | The mechanical "clack". |
| 0–900 | Smoke: 3 billboards at the muzzle and 1 at the port, rising 0.3 m/s, growing 2 to 9 cm, alpha 0.18 to 0, lit by the scene. Heat (+0.12 per shot, decaying 0.25/s) adds up to 3× smoke and makes the crown glow above 0.6. |
| 350–600 | The shell lands and bounces up to 2 times (restitution 0.35), with a brass tink panned in 3D. Shells are capped at 40, FIFO. |

- **Recoil springs.**
  - Viewmodel: rotation at 14 Hz with ζ 0.45; position at 16 Hz with ζ 0.55. These replace `kick*0.06`.
  - Camera (what moves the aim): +1.1° pitch and ±0.3° yaw per shot, through `recoilAt()`. 70% recovers over 200 ms on a 5 Hz critically damped spring; the other 30% stays until the player corrects it.
- **Last round.**
  - The slide locks at 24 mm, the slide stop rises, the chamber shows empty through the port, and the mag shows no top round.
  - The next pull dry-fires: two 4 kHz clicks, no flash and no recoil.
  - Then the empty reload plays.
- **Muzzle effects.**
  - Suppressed: a gas puff of 2 crossed additive quads, 5 to 8 cm, `#ffb070` at intensity 2, for 1 frame; a ring of 4 smoke wisps; and the shared light at 0.6 intensity over 2.5 m for 40 ms. The old 0.2 to 0.36 m white cross goes.
  - Unsuppressed classes: 3 crossed quads plus a star quad with random roll, scale ±25%, shown 1 frame at 50 fps or above and 2 frames below. The one shared `PointLight` (`#ffb070`) spikes to 4 to 8 over 4 to 6 m and decays over 50 ms, so it lights the wet street.
  - Tracers on SMG and rifle only, 1 round in 3: 40 cm × 6 mm, additive `#ffcf8a`, at an apparent 600 m/s.

### S2.4 Reloads (the mag counts as in at 60% of the duration)
**Tactical reload, 1.55 s:**
| t (ms) | Beat |
|---|---|
| 0–200 | The gun rolls 20° and pitches 8°. The left-hand IK target moves to `magwell`. |
| 200 | Release click. The mag drops 3 cm into the left hand. |
| 200–520 | The old mag leaves at the bottom left. |
| 520–880 | The new mag comes in, showing its top round. |
| 930 | Seat: a 1-frame 4 mm jolt, trauma +0.05, a click and seat sound. **Ammo is committed here.** |
| 930–1550 | Return to the base pose. |

**Empty reload, 2.05 s:**
- The same beats, but the old mag drops as a physical object (restitution 0.2, stays 10 s, at most 6).
- At 1450 ms the thumb presses the slide stop.
- The slide slams home in 35 ms, with trauma +0.08 and a slam sound.

**Rules:**
- Sprint, fire or a weapon swap cancels the reload before the commit with no ammo lost. After the commit the reload can't be cancelled.
- ADS during a reload is allowed, with clip rotations at 50%.
- Reduced motion scales clip rotations to 50%.

**Draw:**
- 450 ms, rising from y −25 cm and pitch −40°.
- On the first pickup only, a 900 ms hero draw with a 24 mm slide rack at 300 ms.

**Inspect:** after 12 s without input, a 1.6 s press-check (the slide comes back 8 mm under the left thumb). Any input cancels it.

### S2.5 Layered gunshot audio (`game/gunsound.ts`)
At load, an `OfflineAudioContext` pre-renders 8 variants per class from the layers below. Each shot picks a variant that differs from the last two.

| Layer | Pistol (suppressed) | Level |
|---|---|---|
| Transient | 12 ms white noise, high-passed at 1.5 kHz, 1 ms attack | −9 dB |
| Body | 90 ms noise low-passed at 2.2 kHz, plus a sine swept 160→70 Hz | −10 dB |
| Mechanics | Clicks at +22 ms and +62 ms, band-passed at 3.5 kHz, Q 6 | −14 dB |
| LFE | 55 Hz for 100 ms (unsuppressed classes: 45 Hz for 160 ms at −6 dB) | −16 dB |
| Tail | Send to a procedural convolver IR: 1.4 s outdoors (low-passed at 3 kHz), 0.8 s indoors (`Level.theme.indoor`) | Send −12 dB |
| Reflections (live) | 5 `RayWorld` rays (left, right, front, back, up) up to 40 m. Each wall hit schedules a body copy, low-passed at 1.8 kHz, at `2d/343` s, at −14 dB minus 0.3 dB per metre, panned to the ray. The sniper casts 6. | — |

Mixing:
- While firing, music and ambience duck by 4 dB (attack 20 ms, release 400 ms).
- Enemy rounds passing within 2 m of the camera play a whiz-by: noise band-passed with a sweep from 4 kHz down to 1.5 kHz over 120 ms, panned to the side.

### S2.6 The arsenal (same kit, same animation stack)
| Model | Key parts | Signature beat | ADS ms | Reload tac / empty s | Camera pitch per shot | Flash | Sound note |
|---|---|---|---|---|---|---|---|
| pistol (Kestrel 9) | as S2.1 | Slide lock, press-check | 180 | 1.55 / 2.05 | 1.1° | Suppressed puff | S2.5 |
| revolver | Lathe cylinder (6 bores with rims), hammer, ejector rod | Cylinder turns 60° in 90 ms; swing-out, 6 shells eject, speedloader | 200 | 2.6 | 2.6° | Big star | Heavy LFE at −6 dB |
| smg | Extruded receiver, folding stock, stick mag, foregrip | Bolt cycles 16 mm at the fire rate; the pattern climbs for 6 shots, then drifts right | 220 | 1.9 / 2.4 | 0.45° (patterned) | Small star, tracer 1 in 3 | Fast transient, short tail |
| rifle | Receiver, vented handguard, optic, curved mag | Charging handle on empty; bash on V | 280 | 2.1 / 2.7 | 0.7° (patterned) | Medium star, 3-prong compensator | Long tail |
| shotgun | Lathe barrel and tube, pump, shell carrier | Pump 70 mm over 380 ms; shells load one at a time (0.45 s each) and can be interrupted | 240 | 0.45 per shell | 4.5° | Large, 2 frames, plus a cone of 9 sparks | Boom plus a pump clack |
| sniper | Long barrel, bolt (lift 60°, back 90 mm), scope | 700 ms bolt cycle; enemies see a scope glint | 320 | 2.8 / 3.4 | 6° | Brake side jets | Crack plus a long echo |
| launcher | Tube, sight, grip pod, finned grenade | The round is seen going in; back-blast smoke | 300 | 2.6 | 5° | Back-blast plus a front puff | Thump plus a whoosh |
| melee (pin, sledge, blade, wire) | Existing clips | Keep `SwingTrail`; 40 ms hit-stop on connect, a material spark, trauma +0.2 | — | — | — | — | — |

### S2.7 World impacts by material (`DecalGeometry`-free: the existing instanced decal atlas in `fx.ts`)
| Material | Particles | Decal | Sound |
|---|---|---|---|
| concrete | Grey dust puff ×4, chips ×6 | 6 cm hole plus a 14 cm scorch | Dry crack plus debris |
| metal | Sparks ×12, a 1-frame spark light | 3 cm bright dent | Ping at 2.4 to 3.2 kHz, ricochet whine 30% of the time |
| glass | Reflective shards ×10 | 22 cm star crack | Tick plus tinkle |
| wood | Splinters ×6 | 5 cm hole | Hollow knock |
| cloth | Fibres ×4 | none | Soft thup |

## S3. Enemies

### S3.1 Rig and construction (`game/models/`, `body.ts` `BodyLook` v2)
- **Rig.** The segment rig stays, because rigid segments suit armoured figures and keep ragdolls and severing cheap. Joints go from 16 to 21:
  - `spine2`, `clavicleL`, `clavicleR`, `wristL`, `wristR`.
  - New segments `upperChest`, `handL` and `handR`.
  - The ragdoll `LINKS` table gains matching links and bracing.
  - `jaw` is deferred to C19.
- **Parts library** (`models/parts.ts`, pure, cached by parameters):

  | Part | Built from |
  |---|---|
  | Plates | Chamfered `Shape` extrudes, bevel 6 to 10 mm, depth 12 to 20 mm, bent around the torso with a cylindrical warp of radius 0.18 to 0.25 m |
  | Helmet | A 14-point lathe profile (crown, brow ridge, neck flare), 24 segments, with a separate visor band on a 40° arc |
  | Soft suit | Tapered `TubeGeometry` per limb with a radius curve |
  | Pouches, radios | Rounded boxes, merged |
  | Gloves, boots | A lathe toe cap and an extruded sole with a 6 mm tread |
  | Cloth | 4-particle Verlet strips, or a 6×10 grid panel, pinned to the pelvis or `spine2` and colliding with the leg capsules |

- **Materials** (`models/materials.ts`, shared and patched through `shading.ts`, so the noir grade and wetness apply):

  | Material | Type | Base | Rough | Metal | Notes |
  |---|---|---|---|---|---|
  | Plate | Physical, clearcoat 0.4 on desktop | `#2E333C` | 0.42 | 0.2 | CC0 painted-metal normal (1k phone, 2k desktop, WebP) plus the edge-wear distance field (`#5A616B` within 8 mm of edges) |
  | Suit | Standard | `#15171B` | 0.85 | 0 | Padded-nylon atlas normal |
  | Coat | Physical, sheen 0.6 | `#1C1F26` | 0.7 | 0 | Darkens when wet |
  | Visor | Standard | `#05080A` | 0.1 | 0 | Emissive `#FFA040` × 2.2, with a slit pattern |
  | Under-layer | Standard | `#3B3530` | 0.9 | 0 | Shown after a plate breaks |

- **Faction emissive languages:**

  | Faction | Emissive | Accent |
  |---|---|---|
  | Hollowell | amber `#FFA040` visor slits, `#FF7A1A` joints | — |
  | Price-War | sodium pink `#FF3D7F` | gaffer-white `#E8E2D4` |
  | Candor | cyan `#3FE6FF` | chrome |
  | Machine | red `#FF2A2A` eyes | — |

- **Rim light** (fixes "can't tell him from the street at 10 m"):
  - A fresnel term `pow(1-N·V, 3)`, tinted with the faction emissive at 40% saturation.
  - Strength 0.3 at rest, 0.6 in `combat`, 1.0 for 120 ms after a hit. A 3 Hz pulse marks takedown eligibility.
  - Skipped in the reflection pass.
- **LODs:**
  - LOD0 below 12 m (16 m on desktop): full detail.
  - LOD1 from there to 30 m (39 m on desktop): static cloth, no pouches, bevel 1.
  - LOD2 beyond that: capsules plus the visor plus the silhouette accessories (pauldrons, crest).
  - Swaps use a 0.3 s 4×4 Bayer dither. Shadows render from LOD1. Reflections render from LOD2. LOD2 animates at 15 Hz.
- **The silhouette test.** A flat black render on mid grey at 64 px tall must be classified correctly by the critique subagent.

### S3.2 Hollowell Enforcer v2 (the first enemy the owner fights)
- Height 1.86 m. A corporate riot cop, square and heavy up top.
- **Helmet:** a flared lathe with a brow ridge, a horizontal amber visor slit (the crit target, readable at 40 m), and a 2 cm rear light strip so the head reads from behind.
- **Plates:** chest with a centre ridge, back with the coolant-pack weak point (a 0.18 m cylinder, window pulsing `#FFA040` at 1.2 Hz), stacked pauldrons that stand 0.12 m proud of the shoulder, thigh plates and shin guards.
- **Cloth:** a knee-length split tabard of 8 strips × 4 Verlet particles (32 particles at 60 Hz; on phone, no substeps). It keeps simulating through the death.
- **Gear:**
  - A chest rig with 3 mag pouches.
  - A radio antenna with a red tip blinking at 1 Hz.
  - A holstered sidearm (the fallback after a disarm).
  - The "H in a tower" emblem on the left pauldron and a unit number on the back plate, both from the atlas.
- **The squad leader** has a helmet crest and a red visor stripe.
- **Weapon:** a hand-held gunkit rifle with 10 to 20 parts, parented to `wristR`, with the off hand IK'd to its `foregrip`. It has its own muzzle flash, brass and a 15 mm bolt kick. It must hold up at 3 m, because the takedown camera frames it.
- **Variants:**
  - Riot: a 0.62×1.2 m curved extruded shield with an emissive-tinted viewport, at 300% of max HP. Shock damage does ×2 against it. It breaks into 3 pieces.
  - Sniper: a mid-shin coat, a hood, a single round lens as the laser origin, a 0.35 m scope and a tripod pack.

### S3.3 Roster to the same standard (C20)
| Archetype | Silhouette idea | Key shapes | Height |
|---|---|---|---|
| Price-War Boy | Asymmetric street thug | Bandana, mohawk fin, road-sign pauldron, bomber jacket, slouch +12° | 1.78 m |
| Candor Chrome | Elegant cyborg, too smooth | Mirror head shell (metal 1, roughness 0.08), cyan spine-port weak point, white high-collar longcoat | 1.92 m |
| Cyberpsycho | Wrong proportions | Arms 1.25× long, forearm blades, hunch −20°, cracked faceplate, Verlet cables | 2.0 m hunched |
| Orderly, Nurse | Clinical, quiet threat | Pale scrubs `#9FB3AE`, face shield, restraint gauntlets (Orderly), injector pack (Nurse) | 1.8 / 1.7 m |
| Drones | Readable from below | Rotor ring, red eye, tail strobe | — |
| Turret | Squat | Tripod, box head, two barrels, emissive lid slit | — |
| ED-Class Mech | Boss scale | Reverse-jointed legs, breakable cockpit plates, breakable missile pods | 3.4 m |

**Elite mods** add:
- A 1.2 m floor ring that pulses at 0.5 Hz.
- A DOM glyph over the head, shown within 25 m.
- Material tells: stone normals (Stoneskin), arcs at the joints (Shock), a pulsing vent (Volatile).

### S3.4 Animation layers (`game/anim/`, per enemy per frame)
1. **Locomotion:** the gait ellipse plus leg IK, as a speed blendspace with cadence `1.6 + 0.35·speed` Hz.

   | Gait | Speed (m/s) |
   |---|---|
   | idle | 0 (chest breathes ±1.5% at 0.3 Hz) |
   | walk | 1.6 |
   | run | 4.2 |
   | crouch-walk | 1.2 |
   | strafe | — (hips counter-rotate 20°) |
   | backpedal | 1.4 |

2. **Upper-body poses** (`anim/poses.ts`, joint offsets as data, 150 ms crossfades): `lowReady`, `aim`, `aimHigh`, `aimSide`, `reload`, `throw`, `meleeWind`, `meleeStrike`, `cower`, `surrender`. `?shot&pose=<name>&arch=<id>` renders a turntable for review.
3. **Aim IK:** look-at weighted 40% on `spine2` and 60% on `neck`, clamped to ±70° yaw and ±45° pitch. Weapon-hand IK to the aim line and off-hand IK to the foregrip.
4. **Additive reactions:** S4.1.
5. **Secondary motion:** cloth, cables, pouch wobble (stiffness 180, damping 12).
6. **Ragdoll blend** after death: S4.4.

### S3.5 Telegraphs and action timings (ms)
| Action | Windup | Active | Recover | Tells |
|---|---|---|---|---|
| Raise to aim | 300 | — | — | The visor flares from ×1.0 to ×1.6 |
| Ranged burst | 350 | Burst of 3 to 5 at 90 ms | 250 | Charge chirp 1.2→2 kHz, panned. The sniper adds a laser sweep (a 3 mm additive `#ff3b1a` line, ground to Cath over 450 ms; `SNIPER_CHARGE` 1.5 s kept). |
| Rifle reload | 2,200 total | Mag out at 400, mag in at 1,500, bolt at 1,900 | — | The old mag drops as a body; the "Reloading!" bark always plays. This is a vulnerability window. |
| Peek and shoot (crouch cover) | 250 rise | 900–1,600 | 250 drop | Head and upper chest exposed by 0.3 m |
| Lean out (full cover) | 220 | 1,000–1,800 | 220 | Spine rolls 25° |
| Blind fire | 150 | 800 | 150 | Weapon over the cover, accuracy ×0.3, arm and weapon hitboxes exposed |
| Grenade | 600 arm-back, "Frag out!" | Release at 600 | 400 | Visible arc, 2.8 s fuse, red light blinking at 4 Hz, HUD indicator (S6.2) |
| Melee lunge (Orderly, Cyberpsycho) | 500 crouch, red emissive flash, coat flares | 180 strike (`ORDERLY_LUNGE` 11 m/s) | 600, vulnerable | — |
| Knockdown get-up | — | Down 1,500–2,500 | 900 (hands push, knee, stand) | Takedown-eligible while down |
| Surrender | 500 to kneel | Holds until shot or 8 s, then flees | — | Hands up; executing gives no XP penalty but triggers Cath's line pool |

**Accuracy ramp:**
- A token holder's hit chance ramps from 20% to 70% over 1.2 s of continuous LOS.
- It resets on a LOS break, a slide or a dodge.
- The first 2 rounds of every burst miss on purpose, landing 0.4 to 1.0 m from Cath with tracers, sparks and snaps. These are the readable warning.

## S4. Enemy damage, reaction and death

### S4.1 Flinch on every hit (`anim/springs.ts`)
- A `Spring3` on the hit segment's local rotation, 12 Hz, ζ 0.5, settling in about 250 ms. It is additive on top of locomotion and on top of the powered ragdoll.
- Scale: `clamp(damage/maxHp·4, 0.4, 1.4) × archetype poise`.

  | Zone | Rotation impulse | Root push |
  |---|---|---|
  | head | 22° pitch back, 10° yaw away from the shot side | 0.10 m |
  | chest, abdomen | 12° twist away, 6° pitch back, clavicles shrug 8° | 0.15 m |
  | arm | 28° along the shot; the hand opens 30°; the weapon muzzle drops 15° for 300 ms | 0.05 m |
  | leg | 18° knee buckle; the pelvis drops 6 cm | 0.10 m |

- Root push by weapon: pistol 0.15 m, rifle 0.25 m, shotgun under 6 m 0.45 m, sniper ×2.5. It is applied as velocity and decays over 200 ms.
- **The flash.** The hit segment goes emissive white at ×1.5 to 2 for one frame (16 to 33 ms), then fades from `#ff2a1a` at 0.6 to 0 over 150 ms. This uses a shared uniform `uHitFlash` with a per-vertex segment-group attribute on the merged mesh, so there are no per-hit material clones.
- The current `push*0.06` is removed. The new flinch is 8 to 12× larger.

### S4.2 Location damage and the stagger meter (`sim/damage.ts`, `sim/stagger.ts`)
| Zone | Multiplier |
|---|---|
| head, visor intact | 2.0 (the visor takes the hit, S4.3) |
| head, visor broken | 2.5 (the sniper keeps 4.0) |
| torso, flesh | 1.0 |
| torso, plate up | 0.35 to the body; the rest goes to the plate |
| arms, legs | 0.75 |
| weak point | 2.0, and it vents |

**The meter:**
- `meter += damage/maxHp × poise`. After 0.6 s without a hit it decays at 0.35/s.
- Poise: Price-War 1.2, Enforcer 1.0, Chrome 0.7, Riot 0.6, Cyberpsycho 0.5, mech 0.15 (the mech staggers only from part breaks).
- **Stagger** at 0.35, or on a head hit from a pistol-class weapon or heavier. A helmet that is still up suppresses headshot staggers until the visor breaks; it then plays a 25° head snap with the hands going to the helmet for 400 ms.
- **Knockdown** at 0.8, or from a shotgun hit within 4 m doing at least 25% of max HP, an explosive, or a heavy melee hit.
- Cooldowns: stagger 1.2 s, knockdown 4 s.

**Stagger set** (direction from the angle between `dir` and the enemy's facing):
- **Front, 600 ms:** 2 steps back of 0.35 m at 180 ms each, the weapon arm drops 45°, the off hand clutches the hit point, the head drops 15°.
- **Back, 550 ms:** a forward pitch of 25°, one stumble step, the arms flail 20°.
- **Left or right, 500 ms:** a crossover step, a 20° roll, the opposite arm goes up for balance.
- **During a stagger:** the attack and its token are cancelled, the visor flickers, the rim light pulses at 3 Hz (takedown-eligible), and for 1.5 s the next hit is a guaranteed crit (head marker colour, "CRIT" in the feed).

**Wounded behaviour** (persistent):
- A leg with 40% or more of its damage taken: a limp (the injured stance takes 35% of the cycle, the hip drops 4 cm) and speed ×0.6.
- An arm at the same level: a one-handed pose with accuracy ×0.7.
- Below 25% HP: a 10° hunch with a hand pressed to the worst segment, a 0.6 Hz breathing bob, and a floor blood trail every 1.2 m.
- **Crawl:** Price-War Boys, and Enforcers knocked down below 10% HP, have a 25% chance to crawl at 0.4 m/s for up to 6 s. They leave a smear and can fire a sidearm at ×0.25 accuracy. They are takedown-eligible, and the crawl ends in a death rattle.

### S4.3 Armour, visor, weak points, disarm (`sim/armour.ts` pure, `game/armourfx.ts`)
```ts
interface Plate { id: string; seg: SegmentName; hp: number; maxHp: number; absorb: number; state: "intact"|"cracked"|"broken"; }
```
**Enforcer plates:**
| Plate | HP (share of max HP) | Absorb |
|---|---|---|
| chest front | 40% | 0.65 |
| chest back | 30% | 0.65 |
| each pauldron (outer 120° arc of the upper arm only) | 15% | 0.5 |
| helmet | 20% | 0.5 |

- A plate hit applies `damage·(1−absorb)` to the body and the full `damage` to the plate.
- A shotgun under 6 m splits its damage across adjacent plates.

**States:**
- **Intact hit:** 6 to 14 sparks (120 to 260 ms, 4 to 9 m/s, reflected about the normal with ±35° jitter, `#FFD8A0` to `#FF7A1A`), a 2.5 cm chip decal that rides the bone, the armour marker and the armour sound.
- **Cracked**, at or below 50% plate HP: the plate swaps to a material variant with a Voronoi crack normal (seeded per plate) at ×1.6 normal strength. The crack glows with the faction emissive at 0.3 for 0.4 s. The plate sinks 4 mm.
- **Broken**, at 0 HP:
  - The plate detaches as a rigid body (a 4-particle Verlet box against the `RagdollWorld` boxes) with 3 m/s along the shot, 1.5 m/s up and 8 to 15 rad/s of spin.
  - It clatters 2 to 3 times, sleeps, and freezes into a static mesh (FIFO cap).
  - The under-layer shows, with 2 strap tabs flapping on springs.
  - A 40 ms hit-stop, the break marker and the break sound.
  - A 30% chance of the "Plate's gone!" bark, at most once per 10 s per squad.

**Visor:**
- The first head hit cracks it: a crack overlay, with the emissive flickering at 14 Hz for 300 ms.
- The second shatters it: 12 to 20 amber-tinted instanced shards, a 1.2 s life, gravity on. The face shows: a lathe skull with a dark balaclava, wet-specular eye sockets and 4 seeded skin tones. Its emissive drops to 0.3, and the head multiplier rises to 2.5.

**Weak points:**
- The back coolant pack at 0 HP vents an 800 ms orange plume, causes a 1.4 s stagger, and stops the enemy from sprinting.
- The Chrome's spine port does the same in cyan and disables its dash.
- The mech pods have 25% of the mech's HP each. Breaking one disables its attack and explodes for 15% of the mech's HP.

**Disarm:**
- A forearm or hand hit on the weapon arm from a pistol-class weapon or heavier rolls `0.25 + 0.5·(damage/maxHp)`. Each enemy can be disarmed at most once.
- The weapon flies off as a rigid body. The enemy shakes the hand for 400 ms, then draws the sidearm over 900 ms.
- Price-War Boys flee instead. Cyberpsychos ignore disarms.

### S4.4 Death (`game/death.ts`, extending `Body.goLimp`)
1. **The lethal frame.** Seed `prev = joints − v·dt` from the animated pose, on the same frame, so there is no pop. Add the bullet impulse at the hit joint, with falloff `max(0.25, 1−0.8d)`:

   | Weapon | Impulse (m/s) |
   |---|---|
   | pistol | 3.5 |
   | rifle | 4.5 |
   | shotgun | 7 to 10 |
   | sniper | 9 |

2. **Active phase.** Each joint gets a pose spring toward the variant's dying pose: `p += (target−p)·k·dt·60`, with `k` fading from 0.6 to 0 along a smoothstep. Hand IK (the clutch) runs until `k` drops below 0.15.
3. **Limp phase.**
   - Ground friction 0.85.
   - New joint limits stop the pile-of-boxes look: knees fold backward only (a dot-product constraint against the thigh's forward vector), the neck within 70°, elbows within 150°.
4. **Sleep.** When every joint moves under 2 mm per frame for 30 frames, the body bakes to a static pose and frees its slot. Bodies settle within 2 s.

**Variants** (chosen deterministically from the seed and the `HitEvent`, so screenshots are stable):
| Variant | Trigger | Active-phase pose | Duration (ms) | Notes |
|---|---|---|---|---|
| Headshot drop | Lethal head hit | Instant limp | 0 | Backward head impulse ×1.2 (6 m/s). The helmet pops off 40% of the time. Blood mist ×2. |
| Gut clutch | Torso hit, pistol or rifle, ≤ 12 m | The pelvis drops 0.5 m over 500 ms, both hands IK to the wound, the head drops | 900 | **The default for the first gun kill of a new save** |
| Spin fall | Torso or arm hit from the side | A 90° yaw toward the shot, the arm flung out | 600 | — |
| Wall slump | Wall within 1.2 m behind | The back is pinned to the wall plane, then slides down to sit | 1,200 | Leaves a 0.4×1.2 m vertical smear |
| Knees then face | Lethal leg hit | One knee down, a 200 ms pause, then forward | 800 | — |
| Blown back | Shotgun ≤ 4 m, or an explosive | none; impulse ×1.5 plus 1.5 m/s up | 0 | May sever |
| Over the rail | A collider top edge between 0.9 and 1.2 m within 1 m | Folds over the edge | 700 | — |
| Crawl-out | A crawl ends | 3 breaths, then limp | 2,400 | — |

**Every death:**
- The weapon detaches as a rigid body with a clatter, at 200 ms into the active phase or on the first limp frame.
- **The light goes out:** the visor emissive fades from 1.0 to 0 over 900 ms, flickering at 300 and 550 ms. The radio squelches out.
- Audio: a breathy death rattle with a falling formant (600 ms). Each joint that hits the ground above 1.5 m/s thuds (180 Hz, 70 ms), with gear rattle on chest contact and a weapon clatter.
- Loot shows as the real dropped gun and glinting pouches with beacon layers 1 to 4 (S7). No octahedron.

### S4.5 Blood and wounds (`render/gore.ts`, a new module with its own instanced pools; it reuses the `fx.ts` decal atlas)
**Per flesh hit:**
| Layer | Spec |
|---|---|
| Entry puff, facing the player | 1 to 3 soft mist quads, 0.25 to 0.45 m (×1.4 beyond 15 m), `#8A0E0E` at α 0.85, expanding over 200 ms and fading over 350 ms. **Emissive lift `0.18 × base`, ignoring local light**, so it reads in the noir grade. |
| Entry spurt, back toward the camera | 4 to 8 droplets at 1 to 2.5 m/s in a 50° cone toward the camera. This is what the player sees from the front. |
| Exit spray | Pistol 15, rifle 22, shotgun 6 per pellet, sniper 40 droplets, in a 35° cone along `dir`, at 2 to 6 m/s with gravity, 1.5 to 4 cm, stretched along velocity, base `#5C0707` with a fake `pow(N·H, 40)` highlight. A decal where a droplet lands. |
| Anchoring | Effects are parented to the hit segment for their first 80 ms, then released, so they move with the flinch. |
| Wall splatter | A ray from the exit point along `dir` up to 3 m. A splat decal (atlas `splat1..6`) of 0.3 to 0.8 m by damage, random roll, α 0.9, with a 120 ms "wet in" scale from 0.7 to 1.0. |
| Wound on the body | A 3 cm hole quad 2 mm off the segment surface, plus a 6 cm run-down streak that grows over 2 s. At most 8 per enemy, oldest recycled. |
| Plate hit | Sparks only (S4.3). |
| Cyber hit | The droplet system tinted coolant `#00E5C8` with emissive ×0.8, 2 to 4 sparks and a crackle. Emissive puddles fade to `#0A3A35` over 20 s. |

**Pools:**
- Start 600 ms after the body sleeps, or after 1.5 s of ragdoll, centred under the torso.
- The radius grows from 0.2 to 1.0 m (headshot 0.8, shotgun 1.2) over 8 s with an ease-out.
- Material: roughness 0.08 and clearcoat 1 on desktop, roughness 0.15 on phone. It uses the wet street's reflection path, so neon reflects in it.
- The colour darkens from `#5C0707` to `#2A0303` over 30 s.
- Over the cap, the oldest pool freezes.

**Dismemberment** (extends `sever()`):
- **Severs when:**
  - A killing blow on a limb or the head with `damage ≥ share × maxHp × 1.5`.
  - A shotgun within `CLOSE_SEVER_RANGE`.
  - An explosive within 3 m (legs first).
  - The sniper on a head whose visor is broken.
  - Non-lethal severs happen only on forearms, from shotgun or sniper.
  - The pistol never severs, except on a lethal forearm crit of at least 0.4 × max HP.
- **The stump:**
  - A gore cap made as a lathe disc: a flesh core, a 2 mm `#C9A27A` fat ring, a `#E6DCC8` bone that stands 1.5 cm proud, and 3 torn suit strands.
  - The severed piece flies with 4 to 8 m/s along `dir`, 1.5 m/s up and 10 to 20 rad/s of spin.
  - The stump spurts for 1.5 s at a 2 Hz heartbeat, with pulse amplitudes 1.0, 0.7, 0.45 and 0.25, 6 droplets per pulse. The flying limb trails 2 droplets per 100 ms for 0.8 s.
  - Cyber limbs spark, arc (a 3-segment emissive line, ×4) and leak coolant, with a servo whine-down.
  - Audio: a wet tear (noise swept 600 Hz → 2 kHz, 140 ms), a crunch, and a hiss in time with the spurt.
- **Reduced violence** (the existing gate choice):
  - Turns off: severing, spurts, pools larger than 0.5 m, wall splats, lens blood and x-ray. Blood mist becomes dark ink.
  - Keeps: flinch, stagger, ragdolls, armour breaking, hit-stop and kill cams.
  - A killing blow that would sever plays the knockdown death instead.

## S5. Takedowns, kill confirm and kill cams

### S5.1 Takedown eligibility (`sim/takedown.ts`, pure)
- **Who:** an `unaware` or `suspicious` enemy approached within ±70° of its back; any enemy that is staggered, knocked down, crawling or surrendered; or any enemy below 20% HP.
- **Range and machines:** within 2.5 m. Machines are not eligible. Cyberpsychos get a staggered-only "counter" variant.
- **The magnet** pulls Cath over 120 to 300 ms to the sync point, 0.75 to 0.9 m behind or in front of the target, collision-checked, with a fallback.
- **The tell:**
  - The target's rim and visor pulse at 3 Hz.
  - A world-anchored chip `[F] TAKEDOWN` appears, with a 22u keycap.
  - A 2-tone tick plays the first time a target becomes eligible.
  - The teach line no longer repeats the prompt. This fixes the audit overlap.

### S5.2 Paired sequence (`game/takedown.ts`, 1.2 s base, input locked)
World time runs at 0.4, except for Cath and the target.

| t (ms) | Cath and camera | Target |
|---|---|---|
| 0–120 | The camera eases from first person to an authored framing: 0.35 m back, 0.15 m right, a 0.25 m lift, FOV +12°. Letterbox at 30%. The viewmodel switches to the takedown arms rig (the S2.1 hands). | Snapped to its pose start. The visor flares. |
| 120–420 | **Stealth from behind:** the left arm wraps the neck (hand IK to `neck`) and the right hand raises the baton. | The head pulls back 30°. The hands grab Cath's arm. |
| 420 | **Impact:** an 80 ms hit-stop, a 3° camera kick down, trauma +0.35, a hard thud plus a 45 Hz sub. Under gore, a 0.6 m blood mist at the temple. | The head snaps 40°. White flash. |
| 420–900 | A second strike or a choke squeeze. The camera drifts 6° around. | The knees buckle (the pelvis drops 0.55 m). Cath's arm lowers the body (powered ragdoll, k 0.8 → 0). |
| 900–1200 | Cath lets go. The camera returns over 200 ms. Time ramps back to 1. | Laid down limp at 0.5 m/s with no crash. Noise radius 2 m. |

**Variants** (at least 3 per approach; picked by angle, weapon and seed; no repeat of the last 2):
| Variant | Sequence |
|---|---|
| Behind A: neck wrap and baton | As in the table above |
| Behind B: choke-down | Hold to 900 ms, silent |
| Behind C, pistol equipped: suppressed shot under the jaw | At 650 ms |
| Front A, staggered: collar grab | Pistol-whip at 300 ms, a shot under the chin at 650 ms (110 ms hit-stop, wall splat behind, headshot drop) |
| Front B: chest kick | The target flies 1.5 m (blown back), then a double-tap at 700 and 820 ms |
| Front C: baton combo | Gut strike at 250 ms, then a downward strike to the back of the neck at 600 ms |
| Side A: knee then elbow | Baton to the knee at 250 ms, elbow to the head at 600 ms |
| Side B: sweep | A leg sweep, then a stomp |
| Side C: shove into a wall | Shove into the nearest wall within 1.5 m (falls back to A without one) |
| Knocked down | The camera pitches −35°, a baton downstrike at 380 ms |
| Surrendered | Cath's line. Hold F for 0.6 s to knock out (non-lethal), or fire. |

**Reward:**
- 1 to 2 red health orbs (8% of max total HP each, restoring Flesh) and 1 cyan Guard orb. Ammo too, if a gun finisher was used.
- The orbs magnetise to Cath within 4 m after 400 ms.
- A "+XP" chip rises from the body.

**The first takedown of a new save** (the tutorial guard in `firstjob.ts`):
- The guard is unaware and faces a lit shop window, so he shows as a backlit silhouette.
- It is forced to Behind A at world time 0.3, with a one-time Cath line at 1,000 ms.
- The body is laid down, not dropped.

**The first gun fight** is staged so the first gun kill is likely a torso hit at 8 to 12 m, under a street lamp. It plays the gut clutch, a wall slump if a wall is near, and then a pool that reflects the neon.

### S5.3 Kill cams (rewrite of `killcam.ts`)
- **Triggers** (at most one per 20 s; never during the first 3 kills of a new save, except the first-job finale):
  - The last enemy of an encounter killed by a headshot, a sever or a takedown.
  - A ballistic headshot beyond 30 m.
  - A multi-kill of 3 within 1.5 s.
- **Skip** with any input after 300 ms. Setting: Kill cams On / Last enemy only (default) / Off.

| Variant | Sequence (ms) |
|---|---|
| Bullet follow (ballistic, only when `predict()` says it hits) | 0: time 0.1; the camera 0.5 m behind the round, FOV 50°, orbiting 8°/s; the round is a 0.6 m emissive `#FFE0B0` streak with a heat-haze sprite. 0–400: travel. 400: impact, optional x-ray, time 0.05 for 200 ms. 600–1,400: an orbit of the body at 0.3×. 1,400–1,650: ramp to 1.0, with a 120 ms whip-pan smear (a 3-tap directional blur in `post.ts`). |
| Last-man orbit (hitscan) | 0: time 0.25; the camera 3.5 m from the target at 1.4 m height, 35° off Cath's line, FOV 45°; 2.39:1 bars slide in over 150 ms. 0–900: orbit at 20°/s while the death plays and the blood hangs. 900–1,150: ramp to 1, bars out, cut back. |

- **Audio during a kill cam:** buffers −12 semitones, synth voices lowered, low-pass at 800 Hz, a 2-beat heartbeat at 55 Hz, and a reverse whoosh on return.
- **X-ray** (desktop only, off by default on phone and in reduced violence):
  - For 600 ms the segments become a translucent `#9FD8FF` fresnel shell at α 0.25 over lazily built capsule and lathe bones.
  - The struck bone cracks and sheds 6 to 10 white chips.
  - Sound: a crunch, a 90 Hz thump and three 3 ms snaps 8 ms apart.

## S6. Player damage, wounded and dying

### S6.1 Health model (`sim/vitals.ts`, pure)
The total equals today's `maxHp`, so `BALANCE.md` difficulty stays the same.

| Layer | Share | Regen | Restored by |
|---|---|---|---|
| **Guard** (cyan) | 40% | Starts 4.0 s after any hit (including 0-damage hits), fills in 2.0 s ease-in-out | Itself, Guard orbs |
| **Flesh** (red) | 60% | None, except the **bleed floor**: up to 25% of Flesh at 3%/s after 6 s, so nobody is stranded at 1 HP | Stims, takedowns (+15%), health orbs, a Second Wind kill (+30%), checkpoints |

- Damage hits Guard first, and the overflow carries into Flesh.
- The frame Guard breaks emits `guardBreak`.
- The armour stat reduces Flesh damage only. Skills that grant HP add to Flesh.

**Wound tiers** (from `flesh/maxFlesh`; `w` drives post and audio):
| Tier | Flesh | `w` | Audio | Gameplay |
|---|---|---|---|---|
| fine | > 60% | 0 | — | — |
| hurt | 30–60% | 0–0.35 | Breath 0.3 | — |
| critical | 10–30% | 0.35–0.85 | Heartbeat 80–110 bpm; muffle 6 → 2.5 kHz | Sway ×1.6, ADS +20% |
| bleeding | < 10% | 0.85–1 | Heartbeat 120 bpm; muffle 1.5 kHz | No sprint; a floor blood decal every 1.2 m |

### S6.2 Per hit (every layer on the hit frame)
- **Directional arc** (SVG ring in `ui/hud.ts`, replacing the 140×36 px arc):
  - Radius 190u (about 18% of viewport height). Each arc spans 38° and is 14u thick at its centre, tapering to 2u with feathered ends.
  - Colour `--blood-hot`, with opacity `0.45 + 0.55·min(1, amount/(0.25·maxTotal))` and a 2u core line for the first 120 ms.
  - It appears instantly with a 1.15 → 1.0 scale over 90 ms, holds 600 ms while tracking the attacker's bearing every frame, then fades over 600 ms. A repeat hit from the same source restarts it. Up to 4 sources at once.
  - Attackers behind the player, or more than 35° above or below, get a chevron at the edge of the safe frame.
  - By kind:
    - Melee: a 40u edge flash on that side for 250 ms.
    - Blast: an amber arc.
    - Laser: a cyan arc.
    - A live grenade within 6 m: a grenade glyph in a 44u circle on the ring, pulsing at 4 Hz.
  - The colour-blind palette adds a 2u white outline.
- **Camera flinch.** A spring at 9 Hz, ζ 0.55, added after aim, so it never moves the aim vector.
  - Yaw ±3.0°·k and pitch +1.5°·k away from the source, roll 1.2°·k toward the hit side, with `k = clamp(amount/(0.1·maxTotal), 0.4, 1.6)`.
  - Melee doubles `k`. Blast adds a 6 cm shove.
  - Trauma +0.18·k.
- **Viewmodel jolt.** The gun dips 2.5 cm and rolls 4° away. In `critical` and below, every third hit pulls the support hand to the sternum for 350 ms, then blends it back over 250 ms ("clutching the wound").
- **Screen** (`post.ts` Vitals uniforms, S6.4):
  - `uHurt` rises to `0.35 + 0.25k`, then decays with τ 160 ms.
  - `uHurtDir` adds a red lobe on the hit side.
  - **Lens blood** (gore on): one splat in the slot nearest the hit side when `k ≥ 1` or on any melee hit, at most one per 400 ms.
- **Guard break:**
  - 12 cyan SVG shards fly out 30 to 80u with 180° of spin over 380 ms.
  - A 1-frame cyan rim flash at 0.25.
  - The bar empties with a crack glyph.
  - Trauma +0.2.
  - A descending FM sweep (1.8 kHz → 300 Hz over 260 ms) plus 6 granular glass ticks.
- **Blast within 6 m:**
  - Tinnitus: a 4.8 kHz sine at −20 dBFS, decaying over `2 + 3(1−d/6)` s.
  - `muffleHz` drops to 500 Hz and recovers with τ 0.9 s.
  - `uWound` gets +0.25 for 1.5 s.
- **Audio** (`Audio.hurt()`, player bus):

  | Layer | Recipe |
  |---|---|
  | Bullet impact | Pink noise band-passed at 900 Hz (Q 1.2) for 70 ms, plus a sine falling 90 → 55 Hz over 110 ms |
  | Melee impact | The bullet impact plus a 40 ms clap low-passed at 400 Hz |
  | Grunt | Formant noise (F1 650, F2 1100, F3 2800 Hz), 140 ms, pitch ±6%. Variants `hurt`, `strain` and `gasp`. Cooldown 700 ms. |
  | Guard hit | A glass tick: sines at 2.6 and 3.9 kHz for 50 ms, plus noise at 6 kHz |
  | Near miss within 1 m | A Doppler whiz-by on the world bus |

  A Flesh hit ducks music by 4 dB for 300 ms.
- **Flesh bar:** a two-step "damage ghost". The lost segment shows as a white trail that waits 350 ms and then shrinks over 400 ms.

### S6.3 Wounded loop and recovery
- **Heartbeat** (critical and below):
  - Each beat is a lub (55 Hz, 90 ms) and a dub (48 Hz, 70 ms, 110 ms later), each with a 4 ms attack.
  - Rate is `lerp(80, 120, w)` bpm.
  - `uPulse` comes from the same scheduler, mapping AudioContext time to frame time, so the vignette beats in sync. A unit test checks the phase mapping.
- **Breath:** looped noise, band-passed at 500 Hz for the exhale and 1.4 kHz for the inhale. Rate 0.3 Hz when fine and 0.9 Hz when bleeding, gain `0.25·breath`. Ducked under gunfire.
- **World muffle:** `muffleHz = lerp(22000, 1500, w)` on an exponential curve.
- **Bleeding tier:** a ±1° roll wobble at 0.3 Hz plus a 0.4% FOV breathe in sync (off under reduced motion). The Flesh bar pulses in scale-Y from 1.0 to 1.15 on the beat, and its numeral turns `--blood-hot`.
- **Regen start** (as important as the hurt):
  - A sharp inhale (noise at 1.6 kHz with a 120 ms rise).
  - A rising sine sweep from 220 to 880 Hz over 1.8 s at −14 dB.
  - The Guard bar fills with a moving highlight.
  - `uRegen` washes the inner edge cyan at 0.15 for 300 ms.
  - `uWound` eases to its new target over 1.2 s instead of snapping.
- **Guard full:** a chime of 660 Hz then 990 Hz, 90 ms each.
- **Stim:**
  - A 700 ms green-white edge wash.
  - The heartbeat slows by 30 bpm over 2 s.
  - The lens blood wipes off left to right over 500 ms, as if Cath wiped her eyes.

### S6.4 The Vitals pass (`render/post.ts`, an extension of GradeShader; no new full-screen pass on phone)
**Uniforms:** `uWound`, `uHurt`, `uHurtDir`, `uDeath`, `uPulse`, `uRegen`, `uInk`, `uGlitch`, `uPause`, `uLens` (4 slots, each an atlas cell plus an age) and `uBloodTex` (a 512² procedural lens mask of 8 fBm metaball splats with drips).

This runs after tone mapping and before grain:
```glsl
float r = length((vUv - .5) * vec2(uRes.x/uRes.y, 1.));
float inner = mix(.75, .42, uWound) - uPulse*.035*uWound;
float vig = smoothstep(inner, inner + .45, r);
vec3 lum = vec3(dot(c, vec3(.2126,.7152,.0722)));
float keepCentre = 1. - smoothstep(.15, .55, r);
c = mix(c, lum, uWound*.7*(1.-keepCentre*.5) + uDeath*.95);
c = mix(c, c*vec3(1.,.25,.22), uDeath*.6);
c = mix(c, vec3(.42,.02,.04), vig*(.55*uWound + .35*uHurt));
float dirLobe = max(0., dot(normalize(vUv-.5), uHurtDir)) * uHurt;
c += vec3(.8,.05,.05) * dirLobe * smoothstep(.25,.7,r) * .6;
c *= 1. - uDeath*smoothstep(.2, .9, r + uDeath*.6);
```
- **Chromatic aberration:** the existing edge CA, scaled by `(1 + 2uWound + 3uHurt) × uRes.y/1080`.
- **Radial blur:** 6 taps with weight `0.6·uWound + uDeath`, on desktop high and ultra only.
- **Lens blood:**
  - Refraction offsets `vUv` by the mask gradient × 0.004.
  - Each slot ages over 1.8 s, with alpha `1 − age²` and a drip of `0.06·age`.
  - Reduced violence uses a grey rain-on-lens mask instead.
- **Ink:** `uInk` is an fBm threshold that floods in from the edges.
- **Glitch:** `uGlitch` gives 8 horizontal slice offsets of ±2% width (re-randomised every 33 ms), an RGB split from 6 px to 0, and scanlines.
- **Pause:** `uPause` desaturates 85%, blurs (9 taps on desktop, 5 on phone) and tints 40% toward `--night`.
- **Cost:** at most +0.6 ms on iPhone at 0.75 render scale, and at most +0.4 ms at 5K. Profiled with `EXT_disjoint_timer_query_webgl2` under `?perf`.

### S6.5 Second Wind (once per checkpoint; disabled on Hell Week; a skill can add a charge)
| t (ms) | Event |
|---|---|
| 0 | Lethal Flesh damage while ready. A 140 ms hit-stop, `uHurt` at 1, Flesh set to 1. The camera drops 35 cm and rolls 12° over 220 ms (Cath on one knee). |
| 140 | `timescale.push(0.3, 3500)`. Every live enemy gets a 2u `--blood-hot` outline: an inverted hull scaled 1.03 with `depthTest:false`, so enemies show through walls. The world goes 90% grey, except the outlines and muzzle flashes (a stencil bit exempts them from the grade). |
| 140–3640 | The weapon fires and reloads at real-time rate (it uses real dt). A 40 bpm heartbeat. The music drops to a held 55 Hz saw drone low-passed at 300 Hz. "SECOND WIND" in Rajdhani 700 at 28u, tracking 0.4em, with a 1u timer line that drains. |
| A kill in the window | Flesh +30%, a big inhale and a sting. Time ramps back to 1 over 400 ms, the colour floods back over 300 to 600 ms, and the outlines fade over 200 ms. |
| No kill by 3640 | The death sequence starts from its 400 ms state, without a second hit-stop. |

### S6.6 Death sequence (about 2.2 s to the card; any input after 900 ms skips to the card)
| t (ms) | Camera and body | Screen | Audio |
|---|---|---|---|
| 0 | A 120 ms hit-stop. The killer's id is stored. Input locks. | `uHurt` 1, a lens splat on the hit side | Impact plus a hard "gasp"; the music cuts over 80 ms |
| 120 | `timescale.push(0.25, 1400, out 600)`. The camera detaches into a 3-particle Verlet body (head, chest, hips) seeded from the player capsule's velocity plus the killing impulse (0.6 to 2.0 m/s). It rides the head and looks along chest→head, biased 40% toward the killer. | `uDeath` 0 → 0.35 over 600 ms; CA ×3 | Muffle from 22 kHz to 900 Hz over 300 ms; tinnitus 1.0; heartbeat at 50 bpm |
| 120–900 | Knees first (the hips drop 0.5 m), then the chest falls forward or back by hit side. The camera rolls 60 to 80° and stops at the 0.12 m ground plane. **The gun drops out of the viewmodel** into the world scene with a spin and clatters on the floor at 500 to 800 ms (casing physics; `audio.casing` 2 octaves lower). | 2 more lens splats; FOV 75° → 62° | Each beat 30% slower; one long exhale |
| 900–1800 | Settled, drifting 0.4°/s. If the killer is alive within 25 m, the camera frames him. His visor flares ×2 and he lowers his weapon (a "stand down" pose). His name appears in mono in a corner, lingering and doubling (Max Payne 3 style, a CSS class animation). | `uDeath` 0.35 → 0.8; 2.39:1 bars slide in over 500 ms | The last two beats, then silence. A held note (sine plus 2nd and 3rd harmonics, A2, 2.5 s decay). |
| 1500–2300 | The frame freezes. | `uInk` floods in from the edges in `--blood` at 0.85 over 800 ms, with the centre still visible | The rain bed returns, muffled, at −18 dB |
| 2200 | — | The death card fades in over 300 ms | A low FM cello sting |

- Reduced violence: no lens blood, and the ink is grey-black `--night-3`.
- Reduced motion: no roll; the camera slides down 0.8 m and holds.

**The death card** (`ui/deathcard.ts`, left-aligned in the 16:9 safe frame, never "Game Over"):
- Eyebrow, Rajdhani 700 at 15u, tracking 0.32em: `FLATLINED · FILE CLOSED · 02:14 · THE FISH MARKET`.
- Headline, Bodoni Moda italic at 88u: one of 24 Cath lines in `voice.ts`, picked by cause. Examples: *"Not tonight, love."*, *"Mind the glass. Mind everything."*, *"School run's at eight. Get up."*
- The logotype's 1u `--blood-hot` rule, 360u long, drawing in over 400 ms.
- Mono stats at 15u: `KILLED BY  HOLLOWELL ENFORCER · 14 M · RIFLE`, `DAMAGE TAKEN  212`, `NAMES LEFT  3`.
- Actions:
  - **RETRY FROM CHECKPOINT**: Enter, A, or a tap on the left half.
  - **QUIT TO TITLE**: Esc or B.
- After 600 ms on the card, a fire input also retries.
- Elements rise 12u and fade in, staggered 60 ms. Focus shows a 2u `--blood` bar, the label tracks out 2%, and the UI tick plays.

**Retry without a page reload:**
- Delete `location.reload()`. `session.restartFromCheckpoint()` restores the `sim/save.ts` checkpoint: position, Rng state, character, inventory and the job's enemy roster.
- It despawns bodies, decals, particles and pickups, and rebuilds only the job's dynamic state. The world, textures and shaders stay warm. It must take under 250 ms on iPhone.
- **Re-sync transition (900 ms):**
  - The ink recedes over 300 ms.
  - 250 ms of `uGlitch`.
  - A 350 ms fade from black into first person, already holding the checkpoint weapon.
  - The cyan mono line "RE-SYNCED · CHECKPOINT 2" shows at the top left for 2 s.
- **Targets:** from Retry to control under 1.2 s. From death to control under 4.5 s when the player skips. `stats.lastRestartMs` records it.

## S7. Pickups and objectives

### S7.1 The first weapon (Kestrel 9)
- **Placement rule:** from the takedown spot, the case must be within ±15° of the default facing, within 10 m, and unoccluded. It moves out from behind the car onto a market-stall top in the street's sightline. A unit test casts a ray from the takedown pose to the case centre and requires it to be clear.
- **Display:** an open case on a stand with the lid at 100°. The real Kestrel 9 LOD0 mesh lies in a cut-foam insert.
- **Beacon layers:**
  1. **Beam:** an additive cylinder 3.5 m tall, radius 0.12 m, with a soft edge `pow(1−|2u−1|, 2)`. Amber `#e8b04a` at HDR 2.5, so it blooms. `fog:false`. Fades with distance from 60 m to 5 m, and to 0 within 1.5 m of Cath.
  2. **Glint:** a 4-point star, 18 cm across, sweeping the gun every 2.5 s with a 350 ms flash at HDR 4. It has a screen-size floor of 14u.
  3. **Rim pulse:** a fresnel emissive on the gun at 1 Hz, from 0 to 0.8, in rarity colour.
  4. **Floor ring:** a 0.9 m additive decal ring pulsing in sync. It catches reflections on the wet ground.
  5. **World prompt** within 3 m (a tap target on phone): a projected chip `[E]  TAKE  ·  Kestrel 9` with a 2-line DMG/RATE/MAG strip and a 22u keycap. Hidden when the gun is occluded.
  6. **Off-screen arrow** for scripted key items until they are taken: a 22u chevron clamped to an ellipse at 42% × 40% of the viewport, with the distance in mono at 13u.
  7. **Nudge:** the first time the gun is on screen within 12 m, Cath says "There. On the stall." with a subtitle. If the mouse is idle, a one-time look assist adds up to 10° of yaw over 600 ms. It is never forced.
- **The pickup moment:**
  - **Weapons need a press.** Ammo and cash stay walk-in.
  - The case closes within 200 ms, and the 900 ms hero draw plays.
  - An amber toast "NEW WEAPON · Kestrel 9" slides in, with a 1.2 s minor-seventh sting.
- **Loot drops:** the real LOD0 gun with layers 1 to 4, a 1.6 m beam, no glint for common rarity, and no nudge.

### S7.2 Objective marker
- An 18u diamond with a 2u cyan stroke, with the distance in mono at 14u below it.
- Clamped to the screen edge with an arrow when off screen.
- Shrinks to 60% and fades to 40% within 5 m or in ADS.
- Pulses at 1 Hz for 6 s after an objective update.

## S8. HUD scaling (all HUD and front-end CSS)
- **The unit** (`styles/tokens.css`), with `--hud-scale` (0.8 to 1.3) set by the HUD-scale setting:
  ```css
  :root {
    --u: calc(clamp(0.62px, min(100svh / 1080, 100vw / 1920), 2.4px) * var(--hud-scale, 1));
    --safe-x: max(env(safe-area-inset-left), 4vw);
    --safe-y: max(env(safe-area-inset-top), 4.5svh);
  }
  .hud-frame { position: fixed; inset: var(--safe-y) var(--safe-x); max-width: calc(100svh * 16 / 9); margin: auto; }
  ```
  - At 5K (2560×1440 CSS @2): 1u = 1.333 CSS px = 2.67 physical px.
  - At 1440×900: 1u = 0.75 px.
  - On the phone at 844×390: 1u = 0.62 px (the floor).
- **Minimums:** text sizes are written as `max(12px, calc(var(--u)*N))`, so phone text never drops below 12 CSS px. Crosshair arms are at least 2 CSS px thick.
- **Ultrawide:** the critical HUD (crosshair group, ammo, health) sits in the centred 16:9 frame.
- **Lint:** an extension of `scripts/font-budget.ts`'s CSS checks fails on raw `px` in `games/cathode/src/styles/**`, except `0`, `1px` hairlines, `max(12px, …)` floors and lines marked `/* px-ok */`.
- **Renderer:** the 3D DPR is capped at 1.5 at 5K and 2 elsewhere, with a dynamic render scale of 0.6 to 1.0 (`autoscale.ts`). The DOM HUD renders at native DPR, and every glyph is SVG.
- **Sizes to verify at 2560×1440 @2** (`getBoundingClientRect` × DPR):

  | Element | Physical px |
  |---|---|
  | Waypoint diamond | ≥ 48 |
  | Hit-marker tick | ≥ 26 × 6 |
  | Hurt arc thickness | ≥ 36 |
  | Prompt keycap | ≥ 58 |
  | Ammo numerals | ≥ 150 |
  | Death-card headline | ≥ 220 |
  | Title menu items | ≥ 88 |

## S9. Front door

### S9.1 Principles
- A live place with Cath in it that remembers progress.
- Starting the game is a camera move.
- Three faces with strict jobs: Bodoni Moda for story, Rajdhani caps for system text, JetBrains Mono for data.
- 3 to 5 items that never move. A sound on every focus change. Transitions of 150 to 300 ms. Escape always goes back.
- The chibi SVG Cath leaves the R-rated front door. She stays only where the character bible puts the 2D art.

### S9.2 Menu scene (`render/frontscene.ts`)
- **The scene:** a reduced Drowned Market built with `level.ts`, `atmosphere.ts` and `lighting.ts`.
- **The camera:** a 36 s Catmull-Rom loop through 4 framings around the fish-market pier, at FOV 38°. Mouse or gyro parallax of ±1.5° yaw and ±1° pitch through a 2 Hz spring. Bias 0.5° toward the focused menu row. 2.39:1 bars ease to 2.0:1 on interaction.
- **Cath in 3D**, silhouette-first and lit from behind (14k triangles, 4 materials):
  - The `body.ts` rig at the `shared/cath/` bible proportions.
  - A belted trench coat of 3 lathe skirt rings, with a 12-particle Verlet hem in the wind.
  - A bevelled bob, heeled boots, and an umbrella (a lathe canopy with 8 ribs, rain running off the rim).
  - The coat is physical: roughness 0.45, clearcoat 0.6.
  - A `--neon-pink` back light (RectAreaLight on high and ultra, a spot on phone) and a cool cyan fill.
  - **Idle:** breathing at 0.25 Hz, a weight shift every 7 to 11 s, and a cigarette ember with a smoke billboard every 14 s.
- **Rain on the lens:** the lens-mask path with a water mask, 6 drops sliding down.
- **Progress set pieces** (`progress.jobsDone`):
  - After the Fish Market, the pier sign is dark and a chalk tally appears.
  - After the Plaza, the camera loop moves to the plaza.
  - Later districts add their landmark to the skyline.
  - It never shows a place the player hasn't reached.
- **Cost:** phone at 0.75 render scale capped at 30 fps; desktop at 60 fps; no GTAO. The scene keeps running behind class pick and settings, and freezes on its last frame behind loading.
- **Ambience:**
  - A rain bed and the existing traffic synth.
  - A sign hum at 120 Hz plus its 2nd and 3rd harmonics, placed at the sign.
  - A minor pad of 2 detuned saws low-passed at 900 Hz, changing chord every 8 s (Am, Fmaj7, Dm9, E7sus).

### S9.3 Cold open and gate
1. **0–1200 ms:** black. The rain fades in to −20 dB with a 60 Hz city rumble. One Bodoni italic line at 34u fades in over 600 ms: *"Everyone's got a list. Mine's just shorter every night."*
2. **1200–2600 ms:** the live scene fades up behind the line, letterboxed.
3. **The gate card** (first visit only, remembered in prefs):
   - A bottom-left plate (`--panel` at 0.86, a 1u rim, the `--cut` corner), not a centred modal.
   - A "RATED 18" stamp: Rajdhani 700 at 22u, a 2u `--blood` border rotated −4°, an SVG roughness filter. It must not imitate PEGI or BBFC marks.
   - The content line.
   - Two 260u × 120u switch tiles, FULL and REDUCED, each with a Bodoni label and a mono description. Arrows or a tap switch between them; ENTER confirms.
4. **On accept:**
   - The card wipes right to left with the ink mask over 450 ms.
   - The bars ease over 600 ms.
   - The logotype strokes draw in over 900 ms (`stroke-dashoffset`), then the fill fades in.

### S9.4 Title
**Layout** (inside the 16:9 safe frame, a left column 34% wide):
- The logotype at 120u cap height.
- A live subtitle, Rajdhani 600 at 17u, tracking 0.24em: `HOLLOWELL PROPER · 2079 · 3 NAMES LEFT`.
- The menu, Rajdhani 700 at 34u, tracking 0.12em, 64u row pitch, in fixed slots: CONTINUE (the slot stays reserved even without a save) · NEW CASE · SETTINGS · CREDITS.
- A quiet `Games` back link at the top left inside the safe frame. This fixes the phone overlap.
- At the bottom left, **THE LIST**: 5 names in Bodoni at 22u. Dealt-with names are struck through in `--ink-3`. The next name has a 1u `--blood-hot` caret that does not blink.
- The build version in mono at 12u at the bottom right.

**Focus:**
- A 2u `--blood` rule slides in over 160 ms. The label goes from `--ink-2` to `--ink` with +2% tracking.
- A 13u mono hint appears, for example `RESUME · THE FISH MARKET · CHECKPOINT 2`.
- A UI tick plays: a 1.2 kHz sine plus noise, 25 ms, at −22 dB.
- Mouse, arrows, WASD and gamepad share one focus.

**Confirm:**
- A 1-frame `--on-blood` on `--blood` flash.
- Two sines a fifth apart (70 ms) plus a sub thump.
- **Continue or New Case is a camera push:**
  - The UI fades over 400 ms.
  - A 1.6 s smootherstep spline flies past Cath into the street, with a saw-pad swell (low-pass sweeping 200 Hz → 2 kHz).
  - Loading happens during the push. If it isn't finished, the push ends on the loading screen over the frozen final frame.
  - Then a 300 ms fade from black into first person.
- **The area title:** "THE FISH MARKET" in Rajdhani 700 at 44u, tracking 0.5em, in the upper third, with a Bodoni italic subline at 22u (*"Drowned Market, low tide"*). In over 400 ms, held 2.2 s, out over 600 ms.

### S9.5 Class pick: a wardrobe and a dossier
- **The scene:** a close three-quarter framing of the 3D Cath. The key light changes per class over 400 ms: Operative cyan, Fixer amber, Wetwork `--blood`.
- **Class idles,** each a 1.2 s posed clip with hand IK:
  - Operative: a press-check.
  - Fixer: straightens her cuffs.
  - Wetwork: rolls her neck.
- **Left column:** the class names in Bodoni at 56u.
- **Right column** (the space that was empty at 5K): a mono stat sheet whose 1u bars, with 6u ticks, count up over 350 ms when the class changes, plus a Bodoni italic voice line.
- **Commit:** press and hold a `--blood` bar for 600 ms. The heartbeat thumps twice. Releasing early cancels.

### S9.6 Loading: the case file
- **Background:** the destination's establishing camera, rendered once to a target while the district loads (1024×576 on phone, 1920×1080 on desktop). It gets a duotone (`--night` to `--ink`, with a hint of the district's colour), a 4u halftone at 15°, grain, and a 6% Ken Burns push over 20 s.
- **Left column:** a halftone portrait plate of the next name (their rig under a top light, rendered to texture at 1:1.25), the name in Bodoni at 72u, the district in Rajdhani at 18u (tracking 0.4em), and at most 55 words of lore in Bodoni at 20u. **No control tips.**
- **Progress:** an ink bleed along the logotype rule under the name, and a mono percentage at 12u that eases and never jumps more than 4% per frame.
- **The List:** in a corner. A newly dealt-with name strikes through over 600 ms (`cubic-bezier(.6,0,.2,1)`).
- **Ready:** `PRESS ANY KEY` pulses in opacity from 0.55 to 1 at 0.5 Hz, without blinking. It shows only when the load took more than 2.5 s; otherwise the game continues on its own.
- **Motifs:** travel gets a cyan circuit-trace sweep along the rule. A retry skips loading entirely.
- **Never spoil:** a `loadingCard(progress, target)` unit test checks that it never returns an unvisited district.

### S9.7 Pause
- **Opening (200 ms):** `timescale.push(0, ∞)`. The last frame stays and `uPause` ramps in. `muffleHz` drops to 700 Hz and the music ducks −8 dB.
- **Left column:** RESUME · CASE BOARD · CHARACTER · SETTINGS · QUIT TO TITLE, in the title style.
- **Right:** a pinned case note, a card rotated 1.5° with a cyan pin. It shows the objective in Bodoni at 26u, plus the district, the in-city time and the names left in mono.
- **Breadcrumbs** in mono at 13u, for example `PAUSE / SETTINGS / AUDIO`.
- Esc resumes in one press.
- The card stays hidden under webdriver; screenshots use `?front=pause`.

### S9.8 Settings additions (`tests/cathode-prefs.test.ts`)
- **New settings:**
  - Damage effects: Full / Reduced / Minimal. Minimal drops CA and blur, halves the vignette, and keeps the indicator.
  - Camera shake 0 to 100%.
  - Heartbeat on/off.
  - Hit-stop on/off.
  - Kill cams: On / Last enemy only / Off.
  - Damage numbers.
  - HUD scale 80 to 130%.
  - Colour-blind palette (existing).
- **Presets:** "Vision", "Hearing" and "Motion", in the style of The Last of Us Part II.

## S10. Audio summary (who owns what)
| Owner | Module | Bus |
|---|---|---|
| Hit confirms | `combataudio.ts` | dry |
| Gunshots | `gunsound.ts`, pre-rendered, with live reflections | world, plus the dry mechanics layer |
| Cath's body (hurt, heartbeat, breath, tinnitus) | `audio.ts` | player |
| Enemy voices | `voice.ts` radio chain: band-pass 400 to 3,200 Hz, 12% bitcrush, a squelch at each end, HRTF panner on desktop and equal-power on phone | world |
| Front door | `ui` and `music` | ui, music |

**Enemy barks:**
- **Lines** (the subtitle shows `ENFORCER: "Reloading!"` in the faction colour):

  | Event | Lines |
  |---|---|
  | Contact | "Contact!", "There she is!" |
  | Reloading | "Reloading!" (always plays) |
  | Ally down | "Man down!", "We lost Harker!" (names from the seed; always plays) |
  | Flank | "She's flanking left!" |
  | Lost her | "Where'd she go?" |
  | Grenade | "Frag out!" |
  | Plate break | "Plate's gone!" |
  | Suppressed | "Taking fire!" |
  | Fall back | "Fall back! Fall back!" |
  | Surrender | "Alright! Alright!" |
  | Wounded | "I'm hit, I'm hit" |

- **Rate limits:** at most 1 bark per enemy per 4 s, and 1 in flight per squad with a 1.2 s cooldown, except "Reloading!" and "Man down!", which always play.
- **Pain:** a 120 ms 2-vowel radio grunt, 40% of the time on a hit and always on a stagger.

## S11. Firefight AI (`game/ai/`; the existing `Awareness` FSM stays as the perception layer)
- **Squads:**
  - One per encounter zone, with up to 6 members. The leader is the officer variant with the crest.
  - Roles are assigned every 1.5 s: `suppress` (the nearest member with LOS; hit chance capped at 8% to 25%), `flank` (at most 1, sent to the far side of Cath's cover), `advance` (when Cath has been out of LOS for 5 s or more), and `hold`.
- **Attack tokens:** only token holders fire with real accuracy. Noir 2, Hardboiled 3, Hell Week 4. A token passes on after 2.5 to 4 s of firing, or when its holder loses LOS.
- **Cover points:**
  - Generated at build time by `scripts/cathode-cover.ts` into `render/levels/*.cover.json`: 0.75 m spacing along `solid` colliders, at 1.1 m (crouch) and 1.8 m or more (full, lean).
  - Score: `protection×3 + distance-band(8–20 m)×1.5 − crowding(<2 m)×2 − exposure-path×1 + flank-angle×1` (the flank term for the flanker only).
  - When Cath's angle to the cover normal exceeds 70°: the "She's flanking!" bark, and new cover within 600 ms.
- **Suppression:** a near miss (within 0.5 m of the head in the last 1.5 s) causes ducking and stress, and from full cover a blind fire.
- **Morale** (`sim/morale.ts`, 0 to 1):

  | Event | Change |
  |---|---|
  | An ally dies within 15 m | −0.25 |
  | The leader dies | −0.4 for everyone |
  | Own HP below 25% | −0.3 |
  | Cath gets a takedown in view | −0.35 |
  | Each second in cover with no damage | +0.1 |

  - Below 0.3: fall back to the farthest cover, accuracy ×0.5.
  - Below 0.1, last alive: surrender (Price-War Boys flee).
  - Machines and Cyberpsychos have no morale.

---

# The rename

The owner said "I don't like the name". Each candidate below was checked with one web search for the name as a video game. **A web search is not a trademark search:** before the rename ships, the session runs USPTO, EUIPO, UKIPO and Steam searches and logs the result in `DECISIONS.md`.

| # | Name | Rationale | Clash found |
|---|---|---|---|
| 1 | **MOTHER'S RUIN** | Old slang for gin. A classy British mum and the ruin she brings. It sounds noir and R-rated, and the apostrophe becomes a blood-drop brand mark. | No game. A gin cabaret and cocktails use it. |
| 2 | **STRIKETHROUGH** | The list of names, crossed off one by one. It builds the loading-screen motif into the title. | Small titles only: an adult visual novel and a jam platformer |
| 3 | **HOLLOWELL** | The city as the title, as with Rapture or Dunwall. Hollow, and well. | None (nearest: *Hollowed*) |
| 4 | **PROPER** | From Hollowell Proper. Polite and menacing at once ("a proper beating"), like Cath. | None |
| 5 | **RED LEDGER** | Debts paid in blood. Ties to the debt-tag murder in the opening. | None (nearest: *Red Leader*, a tabletop RPG) |
| 6 | **NIGHT LEDGER** | A moodier take on the ledger. | None |
| 7 | **SCHOOL NIGHT** | Mum irony: she has to be home by morning. | Near misses on itch only |
| 8 | **CROSSED OUT** | The list, said bluntly, with a hint of being double-crossed. | None |
| 9 | **DEBT TAG** | The opening crime's calling card. | None (nearest: *Debtors' Club*) |
| 10 | **NAMESAKE** | The names on the list, and "for their sake". | No noir or shooter |
| 11 | **MOTHER TONGUE** | Cath's voice is the game's signature, and she has a sharp tongue. | A 15-minute 2020 Twine game |
| 12 | **LAST ORDERS** | The pub's closing call, meaning the end, and orders as in a hit list. | A small 2025 Steam pub game |

Rejected after checking: *House Call* (a 2026 Steam horror game), *Wet Ink* (a tabletop publisher), *Bad Mother* (a crime comic), *The Quiet Hour* (a 2026 simulation game).

**The recommended three:**
1. **MOTHER'S RUIN.** The most distinctive, the best fit for Cath's class and menace, and no game clash.
2. **STRIKETHROUGH.** The fallback if the trademark check finds a clash. It needs no change to the motifs.
3. **HOLLOWELL.** The world-first option.

**Decision.** Adopt MOTHER'S RUIN, with the tagline "Hollowell, 2079." Log it in `DECISIONS.md` and put the 3 options in `FEEDBACK.md`'s reply line, so the owner can veto. If the owner names a different title in `FEEDBACK.md`, use it; the logotype builder takes the string as data.

**Logotype** (code-drawn SVG, not live text):
- Bodoni Moda at opsz 96, weight 560, caps, tracking +0.08 em.
- "MOTHER'S" on top, and "RUIN" below at 1.6×.
- The apostrophe is a `--blood` teardrop: the favicon, the loading spinner and the death-card bullet.
- A 1u `--blood-hot` rule under RUIN. This is the rule that bleeds on the loading and death screens.

**Code changes:**
- Every user-facing "CATHODE" changes: the gate, the title, `<title>`, aria labels, the `site/` landing card and copy.
- The URL becomes `/mothers-ruin/`, with a permanent 301 from `/cathode/*` in `vercel.json`.
- Unchanged: `games/cathode/`, `window.cathode` (plus the alias `window.ruin`) and the save key, so saves and tests survive.
- `docs/design/cathode.md` is renamed with `git mv` to `mothers-ruin.md` in a later notes-only commit.
- Tests:
  - A unit test: no "CATHODE" in the text nodes of `dist-site/mothers-ruin/index.html`.
  - A site e2e: the redirect works, and `<title>` is "Mother's Ruin".

---

# Milestones C1..C20

These are ordered by owner impact. Each one ships on its own, gets a release when every gate passes, and gets a ROADMAP tick.

**Every milestone ends with:**
- `npm run check`.
- `npm run shots` before and after.
- `scripts/cathode-feel-shots.mjs` for the milestone's stages at **2560×1440 @2 (`rs=0.5`), 1440×900 @1 and 844×390 @3 (`rs=0.5`, `quality=phone`)**.
- The e2e specs it touches.
- `npm run gates`.
- A subagent critique of the before and after frames against this spec, `VISION.md` and the named reference games.
- `npm run release`.

Sizes are in hourly sessions. The total is about 58 sessions, which with the Phase D/H split is about a week of continuous hourly running. After C20, the screenshot-critique loop continues until the critique stops finding "budget" items (CLAUDE.md).

Unless a milestone says otherwise, "3 sizes" means its stages are shot at all three viewports and its DOM checks run at each.

### C1. "Every shot tells you what it hit" (3 sessions)
- **Goal:** the owner can see and hear every hit, and knows when cover ate a shot.
- **Files:**
  - `game/feel/{tuning,timescale,spring,trauma,bus}.ts`, `sim/hitevent.ts`, `sim/penetration.ts`.
  - `game/combat.ts`, `render/level.ts`, `render/levels/*` (cover and mat tags, OBBs in `RayWorld`).
  - `ui/hud.ts`, `styles/hud.css` (marker classes in `--u`, the blocked glyph, the target-bar fix).
  - `game/combataudio.ts` and the `dry` bus in `game/audio.ts`.
  - The kill FOV punch, the hit-stop table and the `?debug=cover` hook.
- **Tests:**
  - `cathode-timescale` (max not add, priority, ramps, render dt).
  - `cathode-feel` (spring settle, trauma decay, the auto-fire 30 ms cap).
  - `cathode-cover` (a solid box gives `blocked` and no hit; glass passes at 70% with `pen`; an OBB corner ray passes; near miss).
  - `cathode-colliders` (the level audit prints 100%).
  - `cathode-hitclass` (marker class from `{zone, kill, plate, pen}`; never on `blocked`; target bar cleared on a kill).
  - e2e `cathode-combat.spec.ts`: a guard behind a crate gives `blocked` and no `.hud-hit`; a head over the crate gives a `hit`.
- **Screenshot acceptance (3 sizes):**
  - Stages `hit-body`, `hit-head`, `hit-kill`, `hit-soft`, `blocked`, `cover-debug-market`.
  - At 5K the hit tick is at least 26×6 physical px, and the kill ring reaches at least 100 physical px.
  - On `blocked`, the marker is absent and the bracket glyph is present.
  - On `hit-kill`, the target bar is hidden.
  - At 844×390, no HUD overlap.
- **Size:** 3.

### C2. "Hits land on the body" (2 sessions)
- **Goal:** each hit visibly moves, flashes and bleeds the enemy, and kills feel confirmed.
- **Files:**
  - `game/anim/springs.ts` (the flinch replaces `push*0.06`) and `uHitFlash` in `body.ts`.
  - `render/gore.ts` (entry puff with emissive lift, entry spurt, exit spray, bone anchoring, wound quads, wall splats).
  - The last-enemy slow motion through `timescale`, and rumble.
- **Tests:**
  - Unit: flinch impulse by zone and scale; the gore caps hold in a 200-shot soak; `hitFlesh` is never called for Cath (spy).
- **Screenshot acceptance (3 sizes):**
  - Stages `hit-body` and `hit-head` at 10 m, `enemy-flinch-head-60`, `wall-splat`.
  - The red-pixel probe: at least N red-dominant pixels within 0.2 m of the projected hit point.
  - The puff is at least 40 physical px at 10 m on 5K.
  - The flinch moves the head at least 8 px between t=0 and t=60.
- **Size:** 2.

### C3. "You can't miss the first gun", and a HUD sized for 5K (2 sessions)
- **Goal:** the first weapon is found in 5 seconds on a 5K screen, and the whole HUD scales.
- **Files:**
  - `styles/tokens.css` (`--u`, safe frame, `--hud-scale`) and every HUD rule converted.
  - The px lint in `scripts/font-budget.ts`.
  - `game/firstjob.ts` (case placement, open display with the gunkit stand-in until C4).
  - `game/beacon.ts` (beam, glint, rim, ring), `ui/hud.ts` (world prompt, off-screen arrow, objective diamond, toast).
  - Press-to-take, Cath's nudge line and look assist.
  - Loot drops with beacon layers.
- **Tests:**
  - `cathode-pickup-beacon` (beam fade function; the sightline ray from the takedown pose; prompt range; weapons need a press).
  - `cathode-hudscale` (`--u` at heights 390, 900, 1440 and 2880; minimum sizes).
  - The lint.
- **Screenshot acceptance (3 sizes):**
  - Stages `pickup-first-from-takedown`, `pickup-prompt`, `objective-offscreen`, `hud-combat`.
  - At 5K the beam's projected x is within 30% of the centre, the keycap is at least 58 physical px, the diamond at least 48, and the ammo numerals at least 150.
  - At 844×390, no overlap, and all text at least 12 CSS px.
- **Size:** 2.

### C4. "Kestrel 9, built like a real gun" (3 sessions)
- **Goal:** the pistol and Cath's hands read as a finished AAA viewmodel at rest.
- **Files:**
  - `game/gunkit.ts`, `render/guntex.ts` (trim atlas, edge wear), the Kestrel 9 part list.
  - The viewmodel PMREM, key light and rim light.
  - `game/hands.ts` with `feel/ik.ts` and `feel/clip.ts`.
  - A rebuild of the pistol in `game/viewmodel.ts`.
  - The LOD0/1/2 world gun on the first-job stand.
- **Tests:**
  - `cathode-gunkit`, building every model in Node: required part names, `gripR`/`gripL`, triangles and draw groups within budget (desktop ≤ 30k and 14; phone ≤ 14k and 10).
  - `cathode-ik`.
- **Screenshot acceptance (3 sizes):**
  - Stages `pistol-idle`, `pistol-ads`, `pistol-inspect`.
  - A mask render shows hands at 25% or more of the viewmodel pixels.
  - Mean slide luminance in a dark alley is at least 0.08 (the gun never goes black).
  - The critique says the pistol "does not read as a blockout", compared against the Modern Warfare (2019) pistol.
- **Size:** 3.

### C5. "Kestrel 9 in motion" (3 sessions)
- **Goal:** every shot, reload and draw has AAA choreography and sound.
- **Files:**
  - The `Arsenal.pose` layer stack.
  - The fire choreography, recoil springs, `recoilAt` camera recovery, slide lock and dry fire.
  - Tactical and empty reloads with physical mags, draw, hero draw, inspect.
  - The suppressed puff, smoke and heat.
  - `game/gunsound.ts` (pre-rendered variants, live reflections, ducking, compressor, whiz-by).
- **Tests:**
  - `cathode-reload`: commit at 60%, cancel before or after, the lock state on the last round, dry fire.
  - `cathode-feel` clip events: slide back at 30 ms or less, home by 62 ms, shell at 18 ms.
  - `cathode-gunsound`: 8 distinct variants, no repeat of the last 2.
- **Screenshot acceptance (3 sizes):**
  - Stages `pistol-fire-0`, `-20`, `-45`, `pistol-lock`, `pistol-reload-400`, `pistol-reload-930`, `pistol-draw-300`.
  - The muzzle-region luminance on `fire-0` beats `idle`, but no white cross wider than 0.1 m.
  - The slide is visibly back at 20 ms.
  - On `lock`, the slide stop is up and the chamber is empty.
  - At 930 ms the mag is seated.
- **Size:** 3.

### C6. "I know I'm hit" (2 sessions)
- **Goal:** every hit on Cath is felt through direction, camera, hands, screen and voice.
- **Files:**
  - `sim/vitals.ts` (Guard and Flesh, bleed floor, tiers, bearing).
  - The `ui/hud.ts` SVG arc ring, chevrons, grenade glyph, and the two-layer bar with the damage ghost.
  - Camera flinch and trauma in `game/player.ts`, the viewmodel jolt and clutch.
  - `Audio.hurt()` and the `player` bus.
  - `uHurt` and `uHurtDir` in `post.ts`, and the guard-break shards.
- **Tests:**
  - `cathode-vitals`: overflow; regen delay reset by a 0-damage hit; bleed floor at 25% or less; tier bounds; bearing (an attacker at +X with the camera facing −Z gives 90°).
  - A 10-minute seeded fight sim stays within ±10% of today's time-to-death for each difficulty, logged in BALANCE.md.
  - e2e: a damage hook gives `.hud-dmg-arc` rotated within ±10° of the expected bearing.
- **Screenshot acceptance (3 sizes):**
  - Stages `player-hurt-100` (from 90°), `player-hurt-behind`, `vitals-guardbreak`, `grenade-near`.
  - At 5K the arc is at least 36 physical px thick, at a radius of 18% ±2% of height.
  - The behind case shows a bottom chevron.
- **Size:** 2.

### C7. "Wounded" (2 sessions)
- **Goal:** low health looks, sounds and feels desperate, and recovery is unmistakable.
- **Files:**
  - The `post.ts` Vitals pass (`uWound`, `uPulse`, `uRegen`, radial blur, CA scaling, the lens-blood mask and slots).
  - The heartbeat scheduler, breath, muffle and tinnitus in `audio.ts`.
  - The regen telegraph, stim wipe, glove blood, and the damage-effects and heartbeat settings.
- **Tests:**
  - The heartbeat phase mapping.
  - The regen event fires within 1 frame of 4.0 s.
  - Reduced violence puts nothing in the lens slots.
  - Reduced motion turns the wobble off.
- **Screenshot acceptance (3 sizes):**
  - Stages `vitals-hurt`, `vitals-critical`, `vitals-bleeding`, `vitals-regen`.
  - The four look distinct (a pairwise histogram difference above a threshold).
  - The edge-to-centre saturation probe passes on `bleeding`.
  - The Vitals pass costs no more than 15% of the grade pass in SwiftShader relative timing.
- **Size:** 2.

### C8. "Dying, done properly" (2 sessions)
- **Goal:** death is a cinematic body-cam fall and a held moment, then Retry with no page reload.
- **Files:**
  - `game/death-cam.ts` (the 3-particle camera body, the viewmodel drop, killer framing).
  - `uDeath`, `uInk` and `uGlitch`.
  - `ui/deathcard.ts` and 24 lines in `voice.ts`.
  - `session.restartFromCheckpoint()`, deleting `location.reload()`.
  - The re-sync transition.
- **Tests:**
  - `deathState(tMs)` is monotonic, and the card shows at 2200 ms.
  - `restartFromCheckpoint` matches a fresh resume deep-equal, apart from `deaths++`.
  - e2e: lethal hook, then `.death-card`, then Enter gives control with `hp > 0`, no `framenavigated`, the same `window.cathode` identity, and `stats.lastRestartMs` under 1500.
- **Screenshot acceptance (3 sizes):**
  - Stages `death-400`, `death-1200`, `death-2000`, `death-card`, `resync`.
  - At 5K the card headline is at least 220 physical px tall.
  - The reduced-violence `death-2000` has no pixel with hue 350° to 10°, saturation above 0.6 and value above 0.25.
- **Size:** 2.

### C9. "Deaths that land" (3 sessions)
- **Goal:** every kill ends in a weighted, varied fall, a light going out, and blood that stays.
- **Files:**
  - `game/death.ts` (powered ragdoll, 8 variants, joint limits, sleep).
  - Weapon drop, the visor light-out, death rattle and body-fall audio.
  - Growing reflective pools, floor trails, the wall-slump smear.
  - The first-gun-fight staging in `firstjob.ts`.
  - Dropped real-gun loot.
- **Tests:**
  - `cathode-death`: variant selection is deterministic; the knee angle stays in range after a 1 m fall over 600 steps; the body sleeps within 2 s; no NaN over 10k random impulses (the quick fuzz joins `npm run check`).
- **Screenshot acceptance (3 sizes):**
  - Stages `death-gutclutch-450`, `death-wallslump-1200`, `death-headshot-300`, `death-spin-400`, `blood-pool-8s`.
  - The critique compares the 4 deaths, confirms they differ, and finds "no box heap".
  - The pool shows a neon reflection (a highlight probe).
- **Size:** 3.

### C10. "Enforcer v2" (4 sessions)
- **Goal:** the first enemy looks like a designed AAA corporate riot cop and reads at any range.
- **Files:**
  - Rig to 21 joints in `body.ts`, `models/parts.ts`, `models/materials.ts`.
  - The CC0 plate normals in `public/tex/` (logged in `CREDITS.md`).
  - The Enforcer, Riot and Sniper at LOD0, 1 and 2, with the tabard and coat Verlet, rim light, emblem, gear and the hand-held gunkit rifle.
  - The `?shot&arch&lod&pose` turntable.
- **Tests:**
  - `cathode-models`: triangles and draw calls per LOD within budget; shared materials (no per-enemy clones).
  - `cathode-body`: rest lengths hold within 2% after 600 settle steps.
- **Screenshot acceptance (3 sizes):**
  - Stages `enemy-front-10m`, `enemy-back-10m`, `turntable-enforcer`, `silhouette-lineup`.
  - The silhouette lineup is classified correctly.
  - On `back-10m`, the enemy's mean mask luminance is at least 1.3× the surrounding street.
  - The re-shot audit frame `12-guard-from-10m` is distinguishable without the diamond.
- **Size:** 4.

### C11. "Takedowns" (3 sessions)
- **Goal:** the first enemy goes down in a paired, framed, weighted 1.2 s sequence that feels like the reward.
- **Files:**
  - `sim/takedown.ts` (eligibility), `game/takedown.ts` (magnet, tell, camera, 11 variants, takedown arms rig, rewards with orbs).
  - The first-takedown staging.
  - Fixing the teach-line overlap.
- **Tests:**
  - `cathode-takedown`: the eligibility matrix; variants chosen by angle and weapon with no repeat of the last 2; the sync point avoids colliders; noise radius 2 m; reward drops.
  - e2e: the input lock lasts between 900 and 1400 ms, and the enemy ends as a sleeping ragdoll.
- **Screenshot acceptance (3 sizes):**
  - Stages `takedown-0`, `takedown-420`, `takedown-800`, `takedown-front-650`.
  - At 420 ms Cath's arm and the target's helmet are both in frame.
  - The re-shot audit frames 14 to 16 show a staged fall.
- **Size:** 3.

### C12. "The new name" (1 session)
- **Goal:** the owner never sees "CATHODE" again.
- **Files:** the logotype SVG builder (`ui/logotype.ts`), the favicon, `index.html` copy, `site/` landing card, `vercel.json` redirect, the `window.ruin` alias, the trademark-search log in `DECISIONS.md`.
- **Tests:**
  - A unit test for the text-node grep.
  - Site e2e: the redirect and the title.
- **Screenshot acceptance (3 sizes):**
  - Stages `gate`, `title`, and the site landing card.
  - The logotype is crisp at DPR 2 (SVG), and the landing card shows the new name.
- **Size:** 1.

### C13. "A front door that looks AAA" (4 sessions)
- **Goal:** the cold open, gate and title are a live, rainy, cinematic scene with Cath in it.
- **Files:**
  - `render/frontscene.ts`, the 3D Cath title figure (coat Verlet, umbrella, ember), the lens rain.
  - The cold open, gate plate and tiles, ink wipe.
  - The title layout and focus model (`ui/menu.ts`, shared by mouse, keys and pad), the ambience bed and UI sounds.
  - Progress set pieces, the camera push and the area title.
  - Removing the chibi Cath from the front door.
- **Tests:**
  - Menu model: fixed slots, wrap, Esc back, `ui.tick` on every focus change.
  - The subtitle text from progress.
  - e2e: Title, then New Case, then the area title, with no navigation.
- **Screenshot acceptance (3 sizes):**
  - Stages `gate`, `title`, `title-continue-focus`, `title-30s`, `title-60s`, `areatitle`.
  - At 5K the menu column and logotype take at least 30% of the frame height, and no screen has more than 35% empty width.
  - The 60 s frame differs from the 30 s frame (the dolly is moving).
  - On the phone, the back link does not overlap the logotype.
  - The critique rates it "AAA-adjacent" against The Last of Us Part II, Hitman and Control.
- **Size:** 4.

### C14. "Class pick, loading and pause" (2 sessions)
- **Goal:** every screen between the menu and play is part of the game's story.
- **Files:**
  - The wardrobe camera and class idles, the stat sheet, the hold-to-commit bar.
  - The key-art render target, the duotone and halftone shader, the case-file layout, The List with strike-through.
  - `uPause`, the pause columns and case note, breadcrumbs.
- **Tests:**
  - The `loadingCard` spoiler guard.
  - No control tips on the loading screen.
  - e2e: pause opens within 200 ms, and one Esc resumes.
- **Screenshot acceptance (3 sizes):**
  - Stages `classpick-operative`, `classpick-wetwork`, `loading-fishmarket`, `loading-travel`, `pause`.
  - At 5K the class-pick right column is filled (no empty 40%).
  - The loading percentage never jumps more than 4% per frame (sidecar trace).
- **Size:** 2.

### C15. "Armour that breaks, enemies that stagger" (3 sessions)
- **Goal:** sustained fire visibly breaks plates and visors and staggers enemies into takedown windows.
- **Files:** `sim/armour.ts`, `sim/stagger.ts`, `game/armourfx.ts` (sparks, chips, crack variants, detaching plates, strap tabs, visor stages and the face, weak-point venting, disarm), the directional stagger set, knockdown and get-up, wounded behaviours and crawl.
- **Tests:**
  - `cathode-armour`: absorb maths, crack and break thresholds, the pauldron arc, visor stages taking the head multiplier from 2.0 to 2.5, the vent disables sprint, disarm at most once.
  - `cathode-stagger`: accumulation and decay, thresholds, poise, cooldowns, direction, a helmet suppressing headshot staggers.
  - e2e: 6 rifle shots to the chest give `plateBreak`.
- **Screenshot acceptance (3 sizes):**
  - Stages `enemy-plate-cracked`, `enemy-plate-broken`, `visor-shatter`, `enemy-stagger-front-200`, `enemy-stagger-back-200`, `enemy-knockdown-1000`.
  - On `enemy-plate-broken`, the under-layer is visible.
- **Size:** 3.

### C16. "Firefights with intent" (4 sessions)
- **Goal:** enemies telegraph, take cover, flank, suppress, reload out loud and break, so fights read.
- **Files:**
  - `game/ai/squad.ts`, `scripts/cathode-cover.ts` with the JSON output, `sim/morale.ts`.
  - The S3.5 telegraphs (raise, visor flare, chirp, sniper laser, warning shots, reload clip, grenade).
  - Peek, lean, blind fire, suppression, surrender, and barks with subtitles in `voice.ts`.
- **Tests:**
  - `cathode-squad`: token caps per difficulty; one flanker at most; the accuracy ramp from 20% to 70% over 1.2 s and its reset; warning shots miss; flanked above 70°; morale deltas; "Reloading!" always barks.
  - `cathode-cover`: generated points sit on navigable ground with protection above 0.5 and none inside a collider.
  - `scripts/cathode-firefight-sim.ts` over 50 runs: time to first damage at least 1.0 s after first LOS, at least 1 flank and at least 1 "Reloading!" per encounter, no enemy stuck for more than 5 s. Logged in BALANCE.md.
- **Screenshot acceptance (3 sizes):**
  - Stages `enemy-telegraph-300` (laser visible), `enemy-peek`, `enemy-blindfire`, `enemy-reload-1000`, `bark-subtitle`.
  - Subtitles stay readable at 12 CSS px or more on the phone.
- **Size:** 4.

### C17. "Second Wind and the kill cams" (3 sessions)
- **Goal:** near-death becomes a comeback, and last kills become cinematic moments.
- **Files:**
  - Second Wind (inverted-hull outlines, stencil grey exception, the real-time weapon clock).
  - The `killcam.ts` rewrite: bullet follow without steering, last-man orbit, multi-kill, cooldown, skip, setting, audio, whip-pan blur.
  - X-ray on desktop.
- **Tests:**
  - Second Wind once per checkpoint; a kill in the window revives to 30%; shots per real second are unaffected by `simScale`.
  - Kill-cam triggers and cooldown; `predict()` gating.
  - e2e: skip after 300 ms, and the camera returns with `simScale` back to 1 within 300 ms.
- **Screenshot acceptance (3 sizes):**
  - Stages `player-secondwind` (red outlines on a grey world, enemies seen through cover), `killcam-orbit-500`, `killcam-bullet-200`, `xray-450`.
- **Size:** 3.

### C18. "Every gun is a hero" (6 sessions, one class per slice, released at the end)
- **Goal:** revolver, SMG, rifle, shotgun, sniper and launcher match the Kestrel 9 standard.
- **Files:** S2.6 per class in `gunkit` and `viewmodel`, unsuppressed flashes with the shared light, tracers, per-class sound variants, shotgun shell-by-shell loading, the sniper bolt and scope glint, and melee polish.
- **Tests:** for each class, the gunkit part list and budgets pass, and the fire and reload clip events are tested.
- **Screenshot acceptance (3 sizes):**
  - Stages `<model>-idle`, `<model>-fire-20`, `<model>-reload-mid` for each class, and `arsenal-lineup`.
  - The critique reads the 7 guns as one family.
  - Each flash lights the wet ground (a probe on the floor region).
- **Size:** 6.

### C19. "Gore and dismemberment" (2 sessions)
- **Goal:** heavy weapons maim believably, cyber enemies leak coolant, and reduced violence stays clean.
- **Files:** the sever rules in `sim/damage.ts`, the new lathe gore caps (fat ring, bone, strands), stump spurts and limb trails, head severs with the `jaw` joint, coolant, sever audio, and the reduced-mode substitutions.
- **Tests:**
  - `cathode-sever`: the pistol never severs except the forearm-crit rule; the shotgun severs at close range; reduced mode never severs.
- **Screenshot acceptance (3 sizes):**
  - Stages `sever-arm`, `sever-head`, `coolant-cyber`, `reduced-mode-death`.
  - The reduced-mode hue probe finds no red droplets and no caps.
- **Size:** 2.

### C20. "District roster and the 5K polish pass" (4 sessions)
- **Goal:** every archetype meets the Enforcer v2 standard, and every state is re-shot and fixed at 5K.
- **Files:**
  - Price-War Boy, Candor Chrome, Cyberpsycho, Orderly, Nurse, drones, turret and the ED-Class mech (with breakable pods).
  - Elite-mod layers.
  - The accessibility presets and HUD-scale slider.
  - Tuning the dynamic-resolution controller.
- **Tests:**
  - Model budgets for all archetypes.
  - A mech pod break disables its attack.
  - The DR controller: above 15.5 ms for 30 frames gives ×0.9; below 11 ms for 120 frames gives ×1.05; clamped to 0.6–1.0.
  - The `firefight-12` perf gate.
- **Screenshot acceptance (3 sizes):**
  - Stages `silhouette-lineup-all`, `turntable-<arch>`.
  - Every earlier milestone's stages are re-shot at 2560×1440 @2 and critiqued, and the fixes are listed.
- **Size:** 4.

---

# Performance budgets and risks

## Budgets (combat at its busiest: 6 enemies firing for 20 s; desktop gate scene `firefight-12`)
| Item | Phone (iPhone 17 Pro Max) | Desktop 1440p | Desktop 5K |
|---|---|---|---|
| Frame target | 60 fps gameplay at 0.75 render scale; front door 30 fps | 60 fps or more | 60 fps; DPR cap 1.5, dynamic scale 0.6–1.0 |
| Combat CPU (anim, reactions, ragdolls, FX) | ≤ 2.0 ms | ≤ 3.0 ms | ≤ 3.0 ms |
| Draw calls, whole scene | ≤ 260 (6 enemies) | ≤ 600 | ≤ 600 (gate: ≤ 900 at 12 enemies) |
| Viewmodel | ≤ 10 calls, 14k tris | ≤ 14 calls, 30k tris | same |
| Enemy LOD0 / LOD1 / LOD2 | 7k / 2.5k / 600 tris; ≤ 8 / 4 / 2 calls | 16k / 5k / 1.2k tris; ≤ 12 / 6 / 2 calls | same |
| Full-detail enemies | 6 | 12 | 12 |
| Ragdolls awake | 4 | 10 | 10 |
| Particles alive | ≤ 1,500 total, of which blood ≤ 400 | ≤ 4,000, of which blood ≤ 1,500 | same |
| Decals (atlas) and blood share | 160 / 64 | 480 / 160 | same |
| Pools | 6 | 12 | 12 |
| Detached plates, limbs and mags as bodies | 6 | 16 | 16 |
| Shells | 24 | 40 | 40 |
| Combat point lights | 1 shared muzzle light + 1 impact | 2 + 2 | 2 + 2 |
| Live audio voices | 20 | 32 | 32 |
| Vitals pass | ≤ 0.6 ms (no radial blur) | ≤ 0.3 ms | ≤ 0.4 ms |
| Front scene | ≤ 8 ms GPU, 120 calls, 250k tris | ≤ 6 ms | ≤ 9 ms at 0.75 scale |
| Combat and front-door textures in GPU memory | ≤ 24 MB | ≤ 64 MB | ≤ 64 MB |
| Download added | ≤ 6 MB of textures (WebP); fonts already self-hosted | same | same |
| Per-shot JS allocations | 0 (pooled particles, decals, events, vectors) | 0 | 0 |
| Gun or enemy build | ≤ 40 ms each, in idle callbacks off the critical path | ≤ 25 ms | ≤ 25 ms |
| HUD DOM | ≤ 60 animated elements, transform and opacity only | same | same |
| Retry, Retry press to control | < 1.2 s (rebuild < 250 ms) | same | same |

**Measuring:**
- `window.cathode.stats` exposes `drawCalls`, `tris`, `combatMs`, `particles`, `voices` and `lastRestartMs`.
- `scripts/cathode-perf.mjs` runs `?shot&scene=firefight-12` (and `firefight-6` with `quality=phone`) and asserts the counts. Draw calls and triangles are deterministic under SwiftShader.
- Time can't be trusted under SwiftShader, so `combatMs` and pass costs are checked only as ratios against a baseline taken in the same run.
- It joins `npm run gates` as a CATHODE sub-check from C10.
- **If a milestone misses the phone budget,** it ships with phone LOD, particle caps and decal caps cut, never with the feature cut on desktop.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| SwiftShader runs at 0.1 to 3 fps, so in-game 5K captures time out | No proof of the visuals | Frozen `stage` hooks plus `rs=0.5` with the DOM at full DPR; `fxTime` stepping instead of waiting; drive input with `window.cathode.input.forced` and waits of 1 s or more |
| Ragdoll joint limits and the powered phase explode or jitter | Kills look broken, the worst result | The no-NaN fuzz in `npm run check`; clamp impulses; sleep; fall back to a plain limp when any joint's speed exceeds 30 m/s |
| Collider audit shifts navigation or AI cover | Stuck enemies, blocked paths | `cover:"thin"` is shot-only (no movement collision); the level audit test; the firefight sim's stuck-for-5-s check |
| Guard plus Flesh changes difficulty | Balance regressions | Total HP equals today's `maxHp`; the seeded 10-minute sim within ±10%, logged in BALANCE.md |
| `restartFromCheckpoint` leaks state (listeners, pools, timers) | Bugs after the second death | A deep-equal test against a fresh resume; an e2e that dies 3 times; a pool-count assertion after each restart |
| Viewmodel and enemy triangle budgets on phone | Frame drops | Bevel segments at 1 and lathe at 12 on phone; LOD1 beyond 12 m; static cloth at LOD1; the budget tests run in Node |
| WebAudio voice storms in firefights | Crackle, missed hit ticks | Pre-rendered shots; voice stealing (oldest tail first); hit ticks on a reserved, uncapped `dry` bus with a 2-voice limit |
| CSP breaks dynamic styles (arcs, prompts, markers) | Blank HUD in production | Only `setProperty` and classes; the existing CSP e2e runs on the built site |
| Hit-stop stutter in automatic fire | Fire feels wrong | 0 ms on automatic hits; at most 30 ms per 100 ms window; a test checks it |
| Kill cams or takedowns take control too often | Irritating | 20 s cooldown; never in the first 3 kills; skip after 300 ms; default "Last enemy only" |
| Rename clashes with a trademark | Rework | The trademark search comes before C12 ships; STRIKETHROUGH is the drop-in fallback; the logotype takes the string as data |
| The `/cathode/` redirect breaks saves or links | Lost progress | Same origin, same save key, a permanent 301; a site e2e test |
| Vercel Hobby allows 100 deploys a day; releases are capped at 4 a day | Milestones queue up | One release per milestone; slices push to `build` only |
| The hourly session runs over (lock at 75 minutes) | Lock contention | Start nothing long after 40 minutes; one milestone is 1 to 6 sessions; every slice leaves the game working |
| CC0 texture licensing or size creep | Licence or size gate failure | Procedural first; each CC0 file logged in `CREDITS.md`; 6 MB cap enforced in the asset budget check |
| Gore reads as gratuitous, or the reduced mode leaks red | Owner or rating concerns | The reduced-violence hue probe on death and gore stages; gore only on lethal or heavy hits; a pistol never severs, except the lethal forearm-crit rule |

## Decisions this spec makes (log them in `DECISIONS.md` when built)
1. Marker size comes from the hit class, never from damage. Damage numbers are off by default.
2. A blocked shot never shows a hit marker. It has its own glyph and sound.
3. Thin props block bullets but not movement. Penetration is by material, with at most 1 layer (2 for the sniper).
4. One `timescale.ts` and one `trauma.ts`. Hit-stop takes the max, never adds, and is capped at 150 ms.
5. Health is Guard 40% (regenerating) plus Flesh 60% (25% bleed floor), with the same total.
6. Death never reloads the page.
7. Gunshots are pre-rendered layered synthesis (8 variants per class) with live reflections.
8. No CSG, KTX2, Draco or WASM: extrude profiles plus canvas trim atlases.
9. Weapon pickups need a press. Ammo and cash stay walk-in.
10. Reduced violence keeps reactions, ragdolls, armour and kill cams, and drops severing, lens blood, pools and splats.
11. The 3D DPR is capped at 1.5 at 5K with dynamic resolution. The DOM HUD stays native.
12. The name is MOTHER'S RUIN, at `/mothers-ruin/` with a permanent `/cathode/` redirect, unless the owner writes otherwise in `FEEDBACK.md`. The fallbacks are STRIKETHROUGH, then HOLLOWELL.
13. Phase C comes before Phases D and H until C11 has shipped.