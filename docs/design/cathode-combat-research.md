# Phase C research appendix (2026-10-15)

Sources for `cathode-combat.md`.

## A. AAA combat feel
## AAA combat feel: implementable research for CATHODE

**Note on sources.** Searches found no transcripts of the GDC talks, and Bungie's AI lecture PDF wouldn't parse. Facts marked [S] come from the linked sources. Numbers marked [P] are standard practitioner values that I measured or recalled from shipped games, not published figures; they are starting points to tune, not citations. Each section ends with how to build it in three.js under CATHODE's limits: WebGL2, strict CSP, procedural or CC0 assets only.

---

### 0. Direct answers to the owner's playtest

| Complaint | Cause (likely) | Fix (sections) |
|---|---|---|
| "Can the enemy be hit behind something?" | The shot raycast may test enemy hitboxes without testing level geometry, or cover gives no visible feedback | Raycast against world and enemies together; nearest hit wins. Cover that blocks a shot must spark, chip and decal, with no hit marker. A hit marker must mean flesh was hit. (1.6) |
| "I don't see if I hit" | No hit confirm in the layers players read | Add four layers at once: crosshair marker, a distinct hit sound, a visible enemy flinch and an impact effect on the body. (1) |
| "First enemy easy but unsatisfying" | No staggers, no hit reactions, no death "moment" | Add flinch and stagger, a hit-stop on kills, a kill marker and kill sound, a death sequence with a physical fall, and blood that stays. (1, 4, 6) |
| "Pickup easily missed on 5K" | The indicator is sized in CSS px and the pickup has no world-space beacon | Add a light beam, a glint, a rim pulse, a proximity prompt and an off-screen arrow. Size the HUD from viewport height, with a minimum physical size. (7) |
| "Enemy looks very basic" | Silhouette, materials and armour carry no design language | Add a faction kit, layered silhouettes, emissive tells and breakable armour plates. (3) |
| "Pistol design and shooting animation simple" | One-mesh gun, translation-only kick | Build a multi-part viewmodel (slide, hammer, trigger, mag, hands). Fire chain: slide cycle, shell ejection, smoke, spring-based recoil on several axes. (2) |

---

### 1. Hit feedback

#### 1.1 The layers (they all fire on the same frame, or within one frame)
Nuclear Throne's breakdown of a single pistol hit [S, infovore]:
- The impact sound mixes a material sound (meat, metal, rock) with the character's own hurt sound.
- Knockback pushes the enemy along the bullet's direction.
- A white flash frame plays, then 2 frames of a "hurt" face.
- **Hit-stop of 10-20 ms on each hit.**
- Firing kicks the camera 6 px back from the aim point, adds to a screenshake value that decays quickly, and jerks the gun sprite back 2 px.

Translated to 3D FPS layers [P]:
1. **Crosshair hit marker** (details in 1.2).
2. **Hit sound**: a dry, short "tick" with no reverb, played to the player only, so it cuts through the gunshot.
   - Body hits play a muted thock (about 2-4 kHz click plus a soft low thump).
   - Head and crit hits play a brighter, higher ring. Destiny's crit "ding" is the classic example.
   - Armour hits play a metallic clank.
   - A kill plays a separate, heavier, longer confirm (150-300 ms).
3. **Enemy reaction**: an additive flinch on the hit body part (1.4).
4. **Impact effect** at the hit point: a blood puff for flesh, sparks for armour. Valorant ships different hit VFX for head and body [S]. Anchor the effect to the bone that was hit, not to the world, so it moves with the enemy. Valorant listed this as a planned fix [S].
5. **Camera**: hits produce no camera kick; only firing kicks. On a **kill**, add a hit-stop of 40-80 ms and a small FOV punch of -1.5° that recovers over 150 ms.

#### 1.2 Hit marker specification [P; color changes from S]
- **Shape:** 4 diagonal ticks around the crosshair (an X with the centre gap kept).
  - Each tick is about 0.9% of viewport height long and 0.15% thick.
  - On a 2880 px-tall 5K screen, that is about 26 px long and 4 px thick.
- **Timing:** appears at full size and full opacity, scales from 1.25 to 1.0 over 60 ms, holds 80 ms, fades over 120-150 ms. Total is about 250 ms. A new hit restarts the animation.
- **Variants:**
  - Body: white.
  - Head or crit: red or orange, ticks 1.3× longer. Halo 5, Overwatch and Titanfall 2 all turn the marker red on a crit [S, Twinfinite].
  - Armour: grey-blue with a shield pip.
  - Kill: red, 1.5× size, a slower 400 ms fade, plus a separate skull/X glyph or a ring that expands outward.
  - Headshot kill: the kill marker plus a gold accent.
- **Damage scaling:** some games scale the marker with damage. Overwatch did, and players complained when a killing blow drew a smaller marker than an earlier headshot [S]. **Recommendation:** pick size from the hit class (body, head, kill), not from raw damage.
- **Damage numbers:** RPG shooters (Destiny, Borderlands, Cyberpunk) show them. Realistic games (CoD, TLOU) don't. CATHODE is an FPS-RPG, so:
  - **Default:** numbers off. Turning them on is an optional setting.
  - If shown: small and condensed, drifting up 20-40 px over 600 ms. Crits use a larger yellow number. Merge rapid hits into one rolling number.

#### 1.3 Latency
CATHODE is single-player, so all feedback can fire on the same frame as the shot. Valorant must wait a full round trip (about 80 ms at a 40 ms ping) before confirming [S]. Do not add artificial delay.

#### 1.4 Enemy flinch, stagger, hit-stop [P]
- **Flinch** (every hit): a bone-local additive rotation on the hit segment.
  - Head snaps back 15-25°. Torso twists 8-15° away from the shot. Limbs jerk 20-30°.
  - Drive it with a critically-damped spring: about 12 Hz, damping ratio about 0.5, settling in about 250 ms.
  - Add a 0.1-0.25 m root push along the bullet direction.
  - **Cyberpunk always plays hit reactions, even on elites, to avoid the bullet-sponge feel** [S, GamingBolt]. Copy that rule.
- **Stagger** (when accumulated damage passes a threshold, such as 35% of max HP inside 1.5 s, or any headshot):
  - A 400-700 ms interrupt that cancels the enemy's current attack.
  - The enemy stumbles 1-2 steps and drops its weapon arm.
  - Gives a reward window: the next hit is a guaranteed crit or opens a takedown (6).
- **Hit-stop**: freeze or slow game time (not audio) for 10-20 ms on normal hits [S, Vlambeer]. Use 50-80 ms on kills and 100-150 ms on headshot kills [P]. Keep it under about 30 ms for automatic fire, or the stutter feels wrong.
- **White flash**: one frame (16-33 ms) of emissive white on the hit segment's material [S, Vlambeer]. Then a 150 ms red-to-normal fade on the wound area.

#### 1.5 Controller rumble equivalents in a browser
- On gamepads, `navigator.getGamepads()[i].vibrationActuator.playEffect('dual-rumble', {duration, strongMagnitude, weakMagnitude})` works in Chromium.
  - Fire: weak 0.3, 40 ms.
  - Hit: weak 0.2, 30 ms.
  - Kill: strong 0.6, 120 ms.
  - Player hurt: strong 0.8, 200 ms.
- iPhone has no Vibration API in Safari. Substitute stronger camera trauma and audio.

#### 1.6 Cover and occlusion
- Hitscan must raycast the merged set of **world colliders and enemy hitboxes** and take the nearest. In three.js, use one `Raycaster` over `[...worldColliders, ...enemyHitMeshes]` with `firstHitOnly` semantics. Better: test the world BVH first, then cut the enemy test's `far` to that distance.
- When cover blocks the shot:
  - Show the material impact: concrete dust, metal sparks with a whine, glass crack.
  - Leave a bullet-hole decal.
  - **Draw no hit marker.** The marker must only mean "you hit flesh or armour".
- Optional material penetration (an RPG stat, Deus Ex or Cyberpunk "Tech" style):
  - Thin materials (drywall, wood, glass) let rounds through at 50% damage.
  - Draw a distinct "penetration" marker: a hollow tick.
  - Thick concrete always blocks.
- Peeking enemies: put hitboxes only on visible geometry. The head and weapon arm stick out of cover, so a precise shot is rewarded.
- Suppression: a near-miss within 0.5 m of an enemy's head makes it duck or bark (3.4). This is the feedback that shooting at cover is still doing something.

#### 1.7 three.js build notes
- Build the hit marker as DOM/SVG in the HUD layer, which is CSP-safe if the CSS lives in a stylesheet and animations toggle classes. Restarting the animation by forcing a reflow is fine. Alternatively, draw it on an orthographic overlay scene.
- Hit-stop: in the game loop, `simDt = hitStopTimer > 0 ? 0 : dt`. Keep updating rendering, audio and the viewmodel spring.
- Hit sounds: synthesise with WebAudio (CATHODE already synthesises audio).
  - Body: a filtered noise burst (bandpass 2.5 kHz, Q 4, 30 ms) plus a sine thump (120 Hz, 60 ms exponential decay).
  - Crit: add two sines (1.8 kHz and 2.7 kHz) with a 250 ms decay.
  - Kill: a lower, longer ring plus a sub thump.
  - Route all of these to a dry bus that bypasses the reverb send.

---

### 2. Weapon feel

#### 2.1 Viewmodel construction [P; MW2019 details S]
- **Separate parts for a pistol, at least:**
  - Frame/grip, slide (moves), barrel (tilts on Browning-style locking, about 3°), hammer or striker, trigger, magazine (detachable), slide-stop lever.
  - Front and rear sights (with emissive tritium dots for noir readability).
  - Ejection port, rail, plus muzzle details (crown, compensator).
- **Hands:** gloved hands and forearms (Cath's style, from `shared/cath/`).
  - Joint chain: forearm, palm, 3 finger blocks plus thumb, posed to wrap the grip.
  - The support hand cups the main hand, as in a modern two-handed grip.
  - Hands are the main thing that separates a budget viewmodel from an AAA one.
- **Materials:** use `MeshPhysicalMaterial`.
  - Frame: matte polymer (roughness 0.6). Slide: worn metal (metalness 1, roughness 0.35).
  - Edge-wear mask: a procedural canvas texture with lighter edges, driven by a curvature-like noise.
  - Add a clearcoat on any lacquered parts.
  - Light the viewmodel with its own rim light, so the neon city reflects off the slide.
- **Rendering:** draw it in a separate scene or render pass with its own camera.
  - FOV 54-60° versus the world camera's 70-90°. Near plane 0.01.
  - Clear depth before drawing, so the gun never clips into walls.
- **The last-round lock**: on the last round the slide locks back [S, MW2019: "pistol slides … lock back on the last round"]. Fix the slide at rearward travel, show the empty chamber, and play an empty reload.

#### 2.2 Fire choreography (pistol) [P]

| t (ms) | Event |
|---|---|
| 0 | Trigger visibly pulled (5 mm travel, already preloaded). Hammer drops. Muzzle flash on for 1-2 frames, with a point light at 3-6 m range and intensity spike. Camera kick starts. |
| 0-35 | Slide travels back about 25 mm (ease-out). Barrel tilts. Viewmodel kicks back 2-4 cm and pitches up 4-8° (spring impulse). |
| 15-25 | Shell spawns at the ejection port: velocity (right 1.5-2.5 m/s, up 1-1.5, back 0.3), spin 20-40 rad/s, random ±20%. |
| 35-70 | Slide returns (ease-in, snapping home). Hammer re-cocks. |
| 0-600 | Smoke wisp from the muzzle and ejection port: 3-6 soft billboard particles, rising 0.3 m/s, fading over 0.6-1.2 s. More after a long string of shots ("heat"). |
| 300-600 | Shell hits the floor and bounces twice. Brass tink sound, panned in 3D. Despawn after 5-10 s or cap at 40 shells. |

- **Recoil, split into two systems:**
  - **Camera recoil** is what moves the aim point. Pitch up 0.8-1.5° per pistol shot, yaw random ±0.3°.
    - About 70% recovers automatically over 150-250 ms. The rest is player-corrected.
    - Automatic weapons use a fixed authored pattern: the first 5-8 shots climb vertically, then drift sideways. A fixed pattern can be learned; random spread cannot.
  - **Viewmodel recoil** is visual only, much larger, and settles faster.
    - Position: z +3 cm, y +0.5 cm.
    - Rotation: pitch up 6°, roll ±2° random.
    - Springs: stiffness about 300, damping about 25, mass 1, per channel (position and rotation, 3 axes each). Shove on each shot.
  - CryEngine-style weapon recoil appears to be a spring applied to the weapon or arms transform; Roblox frameworks use a per-axis "shove" spring [S, forums].
- **Camera trauma:** add a trauma value (+0.15 per shot, capped at 1). Shake = trauma² × max (2° rotation, 1 cm), sampled from smooth noise at 20 Hz. Trauma decays at 1.5 per second. Firing kicks the camera, then adds a quickly decaying shake [S, Vlambeer].

#### 2.3 Idle, sway, breathing, movement [P]
- **Breathing:** pitch ±0.3° on a sine at 0.25 Hz, plus a sway on a Lissajous figure (x at 0.5 Hz, y at 1.0 Hz, ±3 mm). Lissajous sway is a CryEngine guess [S, forum].
- **Look sway (inertia):** the viewmodel lags mouse delta with a spring, rotating opposite to the look direction (about −0.02° per px, clamped to ±4°) and rolling into turns by ±3°.
- **Walk bob:** a figure-eight at step frequency (about 1.8 Hz walking, 2.6 Hz sprinting).
  - Amplitude: y 1 cm, x 0.6 cm.
  - Sprint pose rotates the gun down and sideways (pitch −25°, yaw 30°, roll 10°), blended over 200 ms.
  - Weight affects motion: MW2019 animates by weapon weight [S], so heavier guns get lower-frequency, higher-inertia springs.
- **Land:** a dip of 3-6 cm in proportion to fall speed, plus a camera pitch dip of 2°.
- **Active idle:** MW2019 has an "active idle" [S]. After 8-15 s without input, play a fidget: inspect a slide press-check, or Cath tilts the gun.

#### 2.4 Reloads [P; S for MW details]
- **Tactical reload** (rounds left, about 1.6 s for a pistol). Beats:
  - Tilt the gun 20° toward the support hand.
  - Mag release and the mag drops 3 cm. In MW2019 the old mag is often visibly kept during a non-empty reload [S].
  - The new mag comes in from off-screen low left. Insert with a 1-frame jolt and a mag-click sound at 0.9 s. Return.
- **Empty reload** (about 2.1 s): the same, then a slide-stop release with a slide snap-forward and a camera nudge.
- **Dropped mags:** spawn them as physical objects that clatter on the floor.
- **Reload while aiming:** MW2019 added ADS reloads that keep the weapon on target [S]. Optional.
- **Reload cancel:** sprint or fire interrupts the reload. The mag is counted as "in" after the insert beat (60% of the duration).

#### 2.5 ADS [P]
- 150-250 ms for pistols, 250-350 ms for rifles, eased with smoothstep.
- During ADS: the sights align with screen centre, FOV zooms ×1.1-1.25, sway falls to 30%, depth-of-field blurs the viewmodel's rear (optional), the HUD crosshair fades out, and the audio low-pass shifts slightly.

#### 2.6 Muzzle flash [P]
- 2-3 crossed alpha-additive quads plus a front-facing "star" quad with random roll.
- Scale randomised ±25% each shot. Visible for 1 frame at 60 fps, 2 frames at 30.
- A `PointLight` (warm 0xffb070, intensity spike, distance 4 m, one shared light that is moved each shot) lights the wet street. With noir rain, this is the biggest single upgrade to atmosphere.
- An emissive heat glow on the barrel crown after rapid fire.

#### 2.7 Sound layers [S, MW2019, A Sound Effect and Activision]
- MW2019 layers each shot from:
  - a main transient,
  - mechanical sounds (trigger reset, disconnector, hammer and striker played separately),
  - tails,
  - and LFE.
  
  Each weapon has about 25 sets of elements, recombined so no two shots match.
- Reflections are cast per shot and played in 3D, delayed by the speed of sound. Strength depends on distance to buildings and on indoor versus outdoor.
- They use several real-time reverbs, not convolution, because convolution was too CPU-heavy.
- Bullets that pass close to the player make whiz-by sounds.

**WebAudio recipe [P], per shot:**
1. **Transient**: 15 ms of white noise through a high-pass at 1 kHz, sharp attack.
2. **Body/report**: 80-150 ms of noise through a low-pass at 3 kHz with a pitch-swept sine from 180 to 60 Hz.
3. **Mechanics**: a slide clack, 2 short filtered clicks at +25 ms and +60 ms.
4. **LFE thump**: a 50 Hz sine, 120 ms, gated by distance.
5. **Tail**: send to a `ConvolverNode` with a procedural impulse response (decaying noise, 1.2-2.5 s, darker outdoors), or to a feedback delay.
6. **Reflections**: cast 4-6 rays (left, right, front, back, up). For each wall within 40 m, schedule a filtered, quieter copy at `2*d/343` s with a matching pan.

- Randomise pitch ±4% and gain ±1.5 dB per shot.
- Compress the master bus.
- **Ducking**: while firing, duck music and ambience by 3-4 dB. Bungie: "when you're firing your gun, that should be the most important thing that you hear" [S, Digital Trends].

---

### 3. Enemy design

#### 3.1 Silhouette and language [P; Bungie cues S]
- **Three-value readability test:** the silhouette alone must read as the class and as "where the head is". Exaggerate shoulders and helmets on heavies, slim lines on scouts.
- **Faction kit** for noir cyberpunk, for example a corporate security syndicate:
  - Matching armour plate shapes, a signature emissive colour on visors and joints (for example cold cyan visor slits), and a faction emblem decal.
  - Add a cloth layer (long coat, hood) on top of hard armour. This is the cheapest way to look less "basic".
- **Hit zones should be visible on the model:**
  - The head has a glowing visor (it doubles as the crit target).
  - Armour plates on the chest and shoulders are a different material from the soft joints.
  - A weak point (a cooling pack on the back) glows and pulses.
- Bungie had to keep adding clues before players noticed Grunts fleeing when an Elite died: "make sure visual cues are obvious" [S, Bungie AI lecture via jmeiners/DU slides]. If an effect matters, overstate it.

#### 3.2 Telegraphing [P]
- **Ranged attacks:**
  - The enemy raises its weapon in 250-400 ms.
  - The visor flares brighter and a laser sight sweeps toward the player for 300-600 ms before the burst.
  - An audio tell plays: a charge-up whine or a bark.
  - The first shots of a burst are deliberately inaccurate, so the player has time to react ("warning shots"). Hit chance ramps from 20% to 70% over 1-1.5 s of sustained line of sight.
- **Melee lunge:** a 500 ms windup with a crouch, a red emissive flash and a cloth flare.
- **Grenades:** a bark, a visible arcing throw, an on-screen grenade indicator, 2.5-3 s fuse.

#### 3.3 Animation set (procedural, for CATHODE's jointed segment bodies) [P]
- **Locomotion:** idle with breathing, walk, run, strafe, a crouch-walk into cover, and peek-and-shoot over and around cover.
- **Combat:** aim, fire (with recoil on the enemy's own gun), reload (which creates a vulnerability window), throw, melee.
- **Reactions:** flinch per zone, stagger front/back/left/right, knockdown, get-up after 1.5-2.5 s, the wounded crawl (4.4), surrender or panic.
- **Dying:** the reaction-into-ragdoll blend (4.2).
- Procedurally, all of this can be IK targets plus pose keyframes, blended with springs. That is enough for convincing results with segment bodies.

#### 3.4 AI that creates good firefights [S, F.E.A.R./Orkin]
- F.E.A.R. used only 3 FSM states (Goto, Animate, UseSmartObject), with a goal-oriented action planner (GOAP) choosing which actions to run.
- A **squad manager** assigns goals by proximity: flank, suppress, advance. Individual soldiers don't know about each other [S].
- **Barks make the AI read as intelligent.** Enemies call out what the player and the squad are doing: "He's rushing!", "He's trying to flank!", "We've got two men down!" [S, GameSpot designer diary].
- Behaviours for CATHODE:
  - **Cover selection:** score cover points by protection from the player, distance and distance to allies.
  - **Suppress and flank:** one enemy suppresses with sustained inaccurate fire while another flanks.
  - **Reposition when flanked**, with a bark.
  - **Morale:** when the squad leader dies, the rest bark and fall back. This is Bungie's Grunt panic [S].
  - **Blind-fire** over cover.
  - **Barks:**
    - "Reloading!" (a vulnerable window the player can hear).
    - "Man down!" when an ally dies (reward for the player).
    - "Where is she?" when the player is lost.
- **Pacing:** at most 2 enemies actively shooting at the player at once; the others reposition (the "attack token" pattern). This keeps difficulty fair and readable.

#### 3.5 Armour that visibly breaks [S, DOOM Eternal; build P]
- DOOM Eternal's destructible demons take into account "distance, angle and overall damage" of attacks. Weak points take extra damage and can disable attacks. Shooting a cyber-demon's weapon disables it [S, DoomWiki and Bloody Disgusting].
- **For CATHODE:**
  - Each plate is a separate mesh with HP.
  - Hits make sparks, a metallic ping and a hit marker with an armour pip.
  - At 50% HP: a crack decal (procedural line texture) and a dented normal.
  - At 0 HP: the plate detaches as a rigid body with spin, exposing soft under-layer material, and the zone takes full damage.
  - Shooting a visor cracks it at the first hit and shatters it at the second, revealing the face.
  - Shooting the weapon arm or gun can disarm the enemy, who then draws a sidearm or flees.

---

### 4. Enemy damage and death

#### 4.1 Location damage [P]
- Multipliers: head ×2.0-2.5, torso ×1.0, limbs ×0.75, weak point ×1.5-3.
- Use compound hitboxes per segment (capsules), not a single box. CATHODE's segment bodies map onto this naturally.

#### 4.2 Hit reaction into ragdoll [S Euphoria/Max Payne 3; build P]
- Rockstar's Euphoria behaviours made Max Payne 3's hit reactions feel connected: enemies stagger, reach for walls and clutch wounds before falling [S].
- Dying Light 2 lets dismemberment trigger on any hit reaction, during ragdoll, or as a unique animation [S, via search summary].
- **Recipe for Verlet bodies (powered ragdoll):**
  1. On death, switch the body to Verlet and seed every particle's previous position from the current animated pose minus the current velocity. Velocity carries over, so there's no pop.
  2. Add the bullet impulse at the hit particle: 2-6 m/s along the shot, up to 10 for shotguns. Damp it across neighbours.
  3. **Active death, the first 300-900 ms:** the body keeps weak joint-angle springs toward a "dying" pose. Strength fades from 0.6 to 0 over the window.
     - Pose choices: clutch the wound (hand IK to the hit point), knees buckle, reach toward a nearby wall.
     - The body sags rather than dropping like a sack. This is the Euphoria feel.
  4. Then it goes fully limp. Friction is high on the ground, and the body settles in under 2 s. Freeze after it sleeps.
  5. Headshot variant: no active phase; instant limp with a backward head impulse. Different deaths are a reward in themselves.

#### 4.3 Dismemberment and gore [S: TLOU2, Cyberpunk, Sniper Elite; build P]
- TLOU2: shots can take off arms or jaws; explosives can take off legs; molotovs char bodies [S].
- Cyberpunk: dismemberment is tied to weapon type and perks such as bleeding [S].
- **For CATHODE:**
  - A limb segment detaches when a killing blow lands on it with damage at least 1.5× a threshold, or from explosives and shotguns at close range.
  - Split the Verlet constraint. Cap the stump with a procedural flesh/bone disc mesh.
  - The detached limb flies off with its own impulse and spin.
  - A spurt emitter at the stump: 1.5 s, pulsing at 2 Hz in heartbeat rhythm, falling off.
  - Cyber-limbs spark and leak coolant instead of blood: a faction-coloured fluid that fits noir cyberpunk and the R rating.

#### 4.4 Blood [P]
- **Spray:** 15-40 instanced particles per hit, in a cone along the shot exit direction (about 35°).
  - Speed 2-6 m/s with gravity. Dark red with a wet specular highlight.
  - Plus a small mist puff of soft quads (200 ms).
- **Decals:**
  - On the wall behind, raycast along the shot to 3 m and place a splatter decal with random rotation and scale 0.3-0.8 m (three.js `DecalGeometry`).
  - On the floor under the body.
  - Pool: a decal that grows from 0.2 to 1.0 m radius over 6-10 s (ease-out). Use high clearcoat and low roughness so neon reflects in it.
  - Cap at 64 decals with FIFO recycling.
- **Wound decals on the enemy:** project onto the segment mesh locally, or swap the segment's material to a "wounded" variant with an emissive gash.
- **Blood on the camera:** only when the player is close (3 m or less) to a gory kill. A few droplet sprites on the screen edge, wiping off over 1.5 s.

#### 4.5 Kill cams [S Max Payne 3, Sniper Elite; build P]
- Max Payne 3 gives a cinematic kill cam only on the **last enemy of an encounter**, with a varied angle based on weapon and situation. The player can slow the bullet and keep shooting [S].
- Sniper Elite's X-ray cam follows the bullet through bone and organs. It was a late addition, with sound from slowed high-speed vehicles and crushed fruit and vegetables [S].
- Sniper Elite's co-op cut kill cams back because they take control away from the player; there they mostly happen on final shots [S].
- **Rules for CATHODE:**
  - Trigger only on the last enemy in an encounter, or on a headshot kill at more than 30 m. Cooldown of 20 s or more.
  - Skippable with any input after 300 ms.
- **Sequence (total 1.2-2.0 s):**
  - At t=0: time scale 0.1.
  - Cut to a bullet-follow camera: 0.5 m behind the bullet, a slight orbit, FOV 50°.
  - The bullet has an emissive streak and heat-haze trail.
  - About 0.4 s later, impact: optional "x-ray" flash (swap the target's materials to a translucent shader that shows the skeleton segments), flesh crunch sound, time scale 0.05 for 200 ms.
  - Then cut to a wide orbit of the body falling at 0.3× speed for 0.8 s.
  - Ramp back to 1.0 over 250 ms and return to the first-person camera with a whip-pan transition.
- **Audio:** pitch every sound down 1-1.5 octaves, low-pass at 800 Hz, keep a heartbeat thud. Snap back on return.

---

### 5. Player damage, wounded and dying

#### 5.1 Directional damage indicator [P]
- A segment of a ring centred on the crosshair (radius 18-22% of viewport height), arc of 30-45°, pointing toward the attacker's direction relative to camera yaw.
- Red, opacity in proportion to damage (0.5-1.0). Holds 600 ms, fades over 600 ms. Updates its angle live while visible, so it tracks a moving attacker.
- Off-screen attackers below or behind: use a chevron at the edge.
- Separate types:
  - Grenade nearby: a grenade icon with an arrow.
  - Melee: a large edge flash.

#### 5.2 Wounded screen state [S CoD; P values]
- Call of Duty uses a red screen-edge overlay instead of a health bar, and health regenerates after hiding for a few seconds [S, forums and CoD wiki].
- CoD4 figures: below 55 HP, health regenerates fully 5 s after the last hit [S, CoD fandom wiki].
- Halo 3 figures: health regenerates after 10 s without damage, at 9 points per second [S, Halo wiki].
- **Recommended model (FPS-RPG):**
  - A regenerating "Guard" layer (shield-like): regen starts after 3.5-5 s without damage, refills in about 2 s.
  - Plus non-regenerating HP, restored by stims and pickups. The DOOM-style alternative is to drop health from takedowns (6).
- **Low-health post-processing** in one full-screen pass, intensity `w = 1 - hp/30%`:
  - Vignette: red edges pulsing with the heartbeat, inner radius shrinking from 0.75 to 0.45.
  - Desaturation up to 70%, with the centre kept more saturated.
  - Chromatic aberration of 1-3 px at the edges.
  - A slight radial blur, plus a slight camera roll wobble (±1°, 0.3 Hz).
  - Blood frames on the screen edges: procedural noise shaped into splats, alpha driven by `w`.
- **On each hit:**
  - A 150 ms red flash at 0.3-0.5 opacity.
  - Camera flinch: pitch and yaw away from the attack, 2-4°, spring back over 200 ms.
  - Viewmodel jolt.
  - A grunt from Cath (synthesised breath, or vocal samples if available).
- **Audio when wounded:**
  - Heartbeat at 60 to 110 bpm as health drops.
  - Low-pass the world mix down to about 1.5 kHz at `w=1`.
  - Breathing. A close explosion adds a tinnitus tone (a 4-6 kHz sine at −20 dB, fading over 3-6 s) and muffles the world for 2 s.
- **Regen telegraph:** when regen starts, the vignette visibly recedes and a sharp inhale plays, then a "shield recharge" rising sweep in 1.5-2 s. Players must hear and see that recovery has started. Halo is the reference.

#### 5.3 Last stand / downed [P]
- On lethal damage, a one-time "Second Wind" per checkpoint (an RPG skill).
  - The world drops to time scale 0.3 for 2.5 s. The screen goes almost greyscale except enemies, outlined red.
  - The player can still fire. Killing an enemy restores 30% HP (Borderlands/Destiny-style).
  - Otherwise the player dies.

#### 5.4 Death sequence and respawn [P]
- **Death (about 3 s total):**
  - 0 ms: the hit lands; hit-stop of 120 ms.
  - The camera detaches: it falls to the ground on a quick arc (500 ms), rolling 60-80°, a body-cam view toward the killer.
  - The viewmodel drops away.
  - Audio: muffle the world, then a slow fade over 2 s, with a long tinnitus tone.
  - Red, then black, vignette closes over 1.5 s.
  - At 1.8 s: a typographic death card that suits noir, for example "FLATLINED", a short epitaph and a tip line. Use letter-spaced condensed type, not a stock "Game Over".
- **Killcam option:** a 2-3 s replay from the killer's position. Not necessary in single player; the camera fall already gives the death impact.
- **Respawn:** press any key, then a 400 ms fade-in from black at a checkpoint, with a chromatic glitch "re-sync" effect that fits the cyberpunk setting. Keep the wait under 5 s.

---

### 6. Takedowns and executions [S DOOM; P timings]
- **The DOOM loop:**
  - Wounded demons flash and lurch before a glory kill. The finisher drops health, and the chainsaw drops ammo.
  - This pulls the player forward ("push-forward combat") in place of cover and regenerating health [S, Game Developer and GDC 2018 coverage].
  - Glory kills grew out of DOOM 4's slower "Sync Melee" idea and were made faster [S].
- **Arkham:**
  - A clear visual tell over the enemy's head for counters.
  - At 12+ combo, time slows ("Freeflow Focus") [S, Arkham City guide].
  - Rocksteady kept the system simple: choose the right move rather than memorise long combos [S].
- **For CATHODE:**
  - **Eligibility:** an enemy in stagger, or below 20% HP, or unaware (stealth).
  - The enemy flashes its visor and emissives with a slow 3 Hz pulse, plus a prompt.
  - Range 2.5 m, with a magnet that pulls the player into place.
- **Timeline (900-1400 ms):**
  - 0-120 ms: a camera snap from first person to a pre-planned framing about 15° wider, with input locked. Time scale for the rest of the world: 0.4.
  - 120-500 ms: the strike. Cath's arm comes into view with a blade or a pistol-whip; the enemy plays a scripted reaction pose.
  - Hit-stop of 80 ms at the impact frame, with a hard punch sound and sub thump, plus a camera kick.
  - 500-1000 ms: the finish, for example a muzzle-to-head shot with heavy blood and a ragdoll release.
  - 1000-1300 ms: return to the gameplay camera. Time scale ramps back over 200 ms.
- **Reward:** drop health, ammo and Guard orbs that magnetise to the player, plus a +XP chip that follows the RPG style.
- **Variety:** at least 3 variants per direction (front, back, side). Pick by approach angle and weapon.

---

### 7. Pickups, objectives and HUD scaling

#### 7.1 Making items findable [S community and mod references; P values]
Community feedback consistently asks for outlines or glow on small pickups, brighter outlines for accessibility, light beams fading with distance, and colour-coded rarity [S, sources below].

**Layers for the first weapon pickup**, which is critical onboarding:
1. **World beam:** a vertical additive cylinder.
   - 2-4 m tall, 0.15 m wide, rarity colour.
   - Visible through fog: draw with `depthTest:true` but no fog.
   - Fade by distance between 5 and 60 m, and fade out within 1.5 m of the player.
2. **Glint:** a sharp star sprite rotating across the item every 2.5 s (350 ms flash). Easy to see on a 5K screen.
3. **Rim/fresnel pulse:** pulse an emissive outline at 1 Hz on the item's material. A screen-space outline pass (`OutlinePass` or a cheap inverted-hull mesh) is also fine.
4. **Pedestal:** a glowing floor decal ring around the item, which also catches reflections on the wet street.
5. **Proximity prompt** within 4 m: "[E] Take Pistol, M-7 Gaunt" plus stat comparison, anchored in world space next to the item and projected to screen.
6. **Off-screen indicator** for scripted key items: an arrow at the screen edge plus a distance, until the item is picked up.
7. **Narrative nudge:** Cath's voice line ("There. On the crate.") and a short camera look-at nudge of about 10° when the item first comes into view. Never force the camera.
8. **Pickup moment:** a 200 ms viewmodel draw animation with a slide racked at the end (a hero beat), a rarity-coloured toast, and a sting sound.

**Objectives:** a world-space marker (diamond plus distance), clamped to the screen edges when off-screen. It shrinks and fades as the player aims down sights or comes within 5 m.

#### 7.2 HUD scaling up to 5K [P]
- Scale everything from **viewport height**, not CSS px:
  - `--u: calc(100vh / 1080)` and size elements in multiples of it, for example `font-size: calc(var(--u)*22)`.
  - Clamp with `clamp()` so phones don't get unreadably small UI (set a minimum around 12 px of physical size).
- On 5K (5120×2880 physical, DPR often 2, so 2560×1440 CSS), 100vh-based sizing keeps the HUD the same fraction of the screen. Fixed-px designs end up tiny, which is likely the owner's "missed indicator" problem.
- **Safe zones:**
  - 5% inset on desktop; `env(safe-area-inset-*)` on iPhone.
  - On ultrawide aspect ratios beyond 16:9, hold critical HUD in a centred 16:9 box so the eyes don't travel far.
- **Renderer:** cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`. Use dynamic resolution, rendering to a lower internal resolution (0.6-1.0×) on 5K to keep 60 fps, but render the HUD and crosshair at native resolution in DOM.
- Draw icons as SVG so they stay crisp at every DPR.
- CSP note: use classes and CSS custom properties set via `element.style.setProperty`. CSSOM property changes are allowed under CSP `style-src` without `'unsafe-inline'`; only inline `style=""` attributes and `<style>` tags are blocked.

---

### 8. Front end, loading screen and menus

These pages are not about combat but are where the owner's "budget" complaint starts. The patterns below are common practice [P].
- **Title screen:** a live 3D scene behind the menu, not a flat background.
  - Example: the Drowned Market at night in rain, a slow camera dolly, Cath silhouetted under neon, a parallax response to the mouse of about 1-2°.
  - A heavy logotype and a minimal left-aligned menu column in the style of CoD MWII and Cyberpunk 2077.
  - Menu items: large condensed caps, 1-2 px letter-spacing; hover shows a slide-in bar and a glitch-tick sound; 120 ms easing.
- **Loading screen:**
  - A full-bleed key-art render (generated from the game scene itself), a tip line and a lore snippet.
  - A thin animated progress line, not a chunky bar.
  - A district name in large type with a "subtitle" location tag (the Destiny/Cyberpunk style).
  - Never show raw percentages unless they're animated smoothly.
- **Audio:** a menu ambience bed (rain, distant city, a synth pad) and UI sounds on every hover and confirm. Silence reads as budget.
- **Transitions:** at most 300 ms between menu pages; cross-fade plus a slide of 20-40 px. A chromatic glitch on page change fits the theme.
- **Naming:** the owner dislikes "CATHODE". Pick a short evocative title that pairs with the Cath character, and make it the logotype on all these screens.

---

### 9. Suggested build order (largest felt-impact first)
1. Combined world and enemy occlusion raycast, cover impacts, and the 4-layer hit feedback (marker, sound, flinch, VFX). Kill marker and kill hit-stop.
2. Pickup beacons (beam, glint, rim, prompt, arrow), Cath's voice nudge and vh-based HUD scaling.
3. The multi-part pistol and hands viewmodel, spring recoil, slide cycle, shells, smoke, flash light, and the layered WebAudio gun with reflections.
4. Enemy flinch and stagger, the active-death ragdoll blend, blood spray, decals and pools, and breakable armour and visor.
5. Player wounded post-processing, directional indicators, heartbeat and muffle audio, regen telegraph, and the death sequence.
6. Takedowns and the last-enemy kill cam.
7. AI barks, squad suppress and flank, attack tokens and morale.
8. Front-end re-skin, live title scene, loading screen and the new name.

---

### Sources
- Game Developer, Design Notes: DOOM (2016): https://www.gamedeveloper.com/design/design-notes-doom-2016-
- GDC 2018 DOOM combat design talk coverage: https://www.gamedeveloper.com/design/video-the-combat-design-of-i-doom-i-
- Bethesda, The guts and gore of DOOM glory kills: https://bethesda.net/ko-KR/news/the-guts-and-gore-of-doom-glory-kills
- Glory kills origin in DOOM 4: https://attackofthefanboy.com/news/doom-2016s-glory-kills-originated-canceled-doom-4/
- DoomWiki, Destructible demons: https://doomwiki.org/wiki/Destructible_demons
- Hugo Martin on destruction: https://bloody-disgusting.com/video-games/3515304/doom-eternal-creative-director-dishes-new-demon-destruction-system/
- Vlambeer "Art of Screenshake" notes: https://infovore.org/?p=5275
- Valorant, The State of Hit Registration: https://playvalorant.com/en-us/news/dev/the-state-of-hit-registration/
- Twinfinite, the reticle as unsung hero: https://twinfinite.net/2016/12/reticle-unsung-hero-modern-shooters/
- Overwatch hit marker size change thread: https://eu.forums.blizzard.com/en/overwatch/t/undocumented-misleading-change-on-hitmarkers/15582
- Darktide hit marker discussion: https://steamcommunity.com/app/1361210/discussions/0/3709306945107196731
- A Sound Effect, Call of Duty: Modern Warfare sound: https://www.asoundeffect.com/call-of-duty-modern-warfare-sound/
- Activision, MW Initial Intel (audio): https://blog.activision.com/call-of-duty/2019-07/Modern-Warfare-Initial-Intel-Creating-an-Orchestra-of-Incredible-Audio-Effects-Weapon-Sounds-in-Call-of-Duty-Modern-Warfare
- Activision, MW Initial Intel (animation): https://blog.activision.com/call-of-duty/2019-07/Modern-Warfare-Initial-Intel-Detailing-Advancements-in-Animation-and-Authenticity
- IMFDB MW2019: https://imfdb.org/wiki/MW2019
- Gfinity, MW2019 reloads and active idle: https://www.gfinityesports.com/article/modern-warfare-2019-weapons-reloading-mechanics-active-idle-and-more
- Fallout 4 MW-sound mod (layer description, secondary): https://www.nexusmods.com/fallout4/mods/64395
- Digital Trends, Destiny audio: https://digitaltrends.com/?p=933553
- Unity forum, weapon recoil as spring: https://forum.unity.com/threads/weapon-recoil-as-spring.543542/
- Roblox, recoil using springs: https://devforum.roblox.com/t/recoil-using-springs/1495471
- Roblox, viewmodel sway: https://devforum.roblox.com/t/how-would-i-make-viewmodel-sway/1799871
- Orkin, Three States and a Plan (F.E.A.R. AI): https://www.cs.uky.edu/~sgware/reading/papers/orkin2005agent.pdf and https://gdcvault.com/play/1013282/Three-States-and-a-Plan
- GameSpot, F.E.A.R. designer diary (barks): https://www.gamespot.com/articles/fear-designer-diary-2-a-study-of-smart-ai-part-ii/1100-6134022/
- Bungie AI lecture (Griesemer and Butcher), The Illusion of Intelligence: https://www.jmeiners.com/shamans/papers/ai/the_illusion_of_intelligence.pdf
- DU game AI lecture slides (Bungie cue quotes): https://www.cs.du.edu/~sturtevant/s13-ai/lecture2.pdf
- Engadget, Jaime Griesemer interview: https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html
- Halo health and regeneration: https://breezewiki.discard.no/halo/wiki/Health and https://filmstories.co.uk/features/killer-feature-halo-and-halo-2s-regenerating-shields/
- CoD damage flash and regen: https://giantbomb.com/wiki/Concepts/Damage_Flash and https://forums.overclockersclub.com/topic/59353-call-of-duty-2-review/page/3/
- Max Payne 3 bullet time and kill cam: https://www.gamingnexus.com/News/26211/The-evolution-of-bullet-time-in-Max-Payne-3 and https://whatculture.com/amp/gaming/max-payne-3-euphoria-for-the-masses and https://www.godisageek.com/2012/04/max-payne-3-bullet-time
- Sniper Elite kill cam: https://mcvuk.com/?p=23739, https://gameinformer.com/games/sniper_elite_3/b/xboxone/archive/2014/02/14/new-kill-cam-adds-gruesome-detail.aspx and https://www.co-optimus.com/interview/1201/page/2/interview-with-sniper-elite-nazi-zombie-army-developer-rebellion.html
- TLOU2 gore: https://www.engadget.com/2017/10/30/the-last-of-us-part-ii-doesnt-shy-away-from-violence-and-gor/ and https://gamersdecide.com/articles/the-last-of-us-part-2-review
- Cyberpunk 2077 hit reactions and bullet sponges: https://gamingbolt.com/cyberpunk-2077-cd-projekt-red-discusses-bullet-sponge-enemies/amp, https://www.pcgamesn.com/cyberpunk-2077/cyberpunk-2077-dismemberment and https://cyberpunk2077.wiki.fextralife.com/Slaughterhouse
- Dying Light 2, Techland interview on combat animation and physics (my fetch was blocked; used via search summary): https://3dvf.com/en/redaction/dying-light-2-stay-human-our-interview-with-techland-about-the-gut-feeling-update-focused-on-combat-animations-and-physics/
- Arkham combat: https://www.siliconera.com/the-improvements-to-batman-arkham-citys-combat-system/ and https://www.gamerevolution.com/?p=1522
- Pickup visibility and loot beams: https://itch.io/post/13294734, https://forever-skies.featureupvote.com/suggestions/625458/comment/698030, https://modrinth.com/mod/lootlight, https://www.mado-hosting.com/minecraft-mods/vaultlootbeams and https://darkanddarker.featureupvote.com/suggestions/488519/comment/553642
- Titanfall 2 weapon feel: https://pcgamer.com/shooter-of-the-year-2016-titanfall-2

Not found in searches: GDC transcripts for Destiny 2 gunfeel, MW2019 animation, TLOU2 hit reactions, Ghost of Tsushima duels and Wolfenstein. Those sections rely on [P] values.
## B. AAA front doors and names
## Research: AAA front doors for CATHODE, and 12 replacement names

Not every game on the list had a usable source. My searches found no real design writeup for the Cyberpunk 2077 title screen, the Mirror's Edge Catalyst menus, the Destiny 2 orbit screen, the Blade Runner Enhanced menus, the Deus Ex: Mankind Divided menus or the Red Dead Redemption 2 loading screens. Where I relied on general knowledge, the text says "(from memory)". Everything else is sourced.

### 1. What AAA front doors do, by topic

#### Composition: a live scene that tells a story, not key art
- **The Last of Us Part II.** The menu is a live scene of a small boat in fog. After the credits it changes to the boat on a Catalina beach, which Naughty Dog's co-director confirmed sets up the ending. The menu tracks story progress.
  - https://www.thumbsticks.com/what-does-new-title-screen-mean-the-last-of-us-part-ii/
  - https://press-start.com.au/news/playstation/2020/06/21/the-last-of-us-part-ii-ending-and-post-credits-start-screen-explained/
  - A patch fixed the boat scene not matching story progress, which shows the scene is driven by save state: https://feedback.naughtydog.com/hc/en-us/articles/23366772804756
- **Death Stranding 2.** A live idle scene: Sam sleeps while the camera pans the landscape and the menu sits over it. Players believe it changes with the story. That is fan discussion, not confirmed.
  - https://redlib.hackliberty.org/r/DeathStranding/comments/1jzupbu/ds2_title_screen_evolution
- **Dragon Age: Inquisition** ("the prime example"). Mages and Templars march on a building. Choosing New Game makes the building explode and knocks the figures back. Pressing the button is itself the opening shot.
  - https://www.gamedeveloper.com/design/setting-the-tone-main-menus-are-the-game
- **Splinter Cell: Conviction and Mega Man X.** Each menu option leads into a matching action beat, and the character idles "ready". The same article holds up Mad Max's slideshow of screenshots as the lifeless counter-example.
  - Same source as above.
- **Takeaway.** A premium front door is a live, framed scene of the world with the hero in it. It reacts to the player's progress, and starting the game is a camera move, not a page swap.

#### Logo and typography: few faces, strict jobs
- **Hitman (2016 onward).** Very sparse UI built on one grotesque, Neue Haas Grotesk.
  - https://fontsinuse.com/uses/64463/hitman-world-of-assassination-video-game
- **Control.** Uses two plain faces: Basic Commercial for case files and Interstate for wayfinding. Brief bold-sans area captions fade out, and the type reinforces the Bureau's authority.
  - https://fontsinuse.com/uses/48689/control-video-game
  - https://kotaku.com/the-fonts-in-control-make-its-world-feel-way-creepier-1837714580
- **Alan Wake 2.** A condensed Compacta logo and one washed-out brand green used everywhere, in-game included.
  - https://www.fontsinuse.com/uses/63024/alan-wake-2-video-game
- **Max Payne 3.** Kinetic typography as storytelling: words linger, double and distort to show the hero's state of mind.
  - https://gameranx.com/updates/id/5597/article/new-max-payne-3-trailer-showcases-cinematic-narrative-style-destruction/
  - https://madegooddesigns.com/max-payne-font/
- **Takeaway.** CATHODE's "Wet Ink" system (Bodoni for story, Rajdhani caps for system text, mono for data; red, cyan and amber each with one job) is already the right shape. What reads as budget is likely scale, spacing and motion, not the choice of faces.

#### Menu structure, motion and focus
- **Keep it to 3 to 5 items with plain labels, and give instant feedback on every input.**
  - https://www.gamedeveloper.com/design/setting-the-tone-main-menus-are-the-game
  - https://indieklem.substack.com/p/9-creating-an-intuitive-in-game-menu
- **Cyberpunk 2077 critique** (useful as a list of what not to do):
  - Its tabs move position, which breaks spatial memory.
  - It has no breadcrumbs.
  - Decoration and live information share one red.
  - Blinking is used for routine items.
  - What works: the HUD's slight perspective skew and optional chromatic aberration, which make it feel like part of V's optics.
  - https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique
- **Ghost of Tsushima.** The UI is kept minimal so players stay "tied into the beauty of Tsushima". The wind replaces waypoints by pointing the way without covering the view.
  - https://www.androidcentral.com/ghost-tsushima-creative-director-interview
  - https://press-start.com.au/features/2020/05/22/ghost-of-tsushima-interview-weapon-upgrades-crafting-length-waypoints-and-more/
- **Hades.** The UI is framed like an instrument panel: clear, readable and consistent with the world. Illustrated UI is a dedicated role at Supergiant.
  - https://geekchamp.com/the-art-of-hades-showcases-the-talent-that-went-into-this-beautifully-vibrant-game/
  - https://www.supergiantgames.com/blog/job-opportunity-ui-illustrator-for-hades-ii

#### Loading screens
- **Rules** (Game Developer, "Game Design Rules: Loading Screens"):
  - Place loads where they hurt pacing least.
  - Never spoil content the player hasn't reached.
  - Show progress for any wait over about 4 seconds; it doesn't have to be a bar.
  - Make the player press to start once loading ends.
  - Never cut off narration.
  - Don't use loading screens for control tips.
  - https://www.gamedeveloper.com/design/game-design-rules-loading-screens
- **Examples that work:**
  - Control uses red Hiss ink swirls after a death and blue Polaris fractals for travel, so the kind of load has its own motif.
  - Shadow of the Tomb Raider's loading art follows an eclipse that darkens with the story, then reverses after the final quest.
  - Assassin's Creed Odyssey's screen fills with the masks of the Cult members you have killed. This is the closest analogue to Cath's list of names.
  - Dishonored 2 uses painterly art per mission plus one short lore paragraph.
  - Disco Elysium's screen looks like an old photograph.
  - https://outpost77.substack.com/p/odyssey-arcade-6-loading-screens
- **Control's red corruption** draws on Suspiria and The Neon Demon: http://alanwake.info/2019/04/10th-april-2019-remedys-senior-concept.html
- **Max Payne 3 has no visible loading screens.** Cutscenes and gameplay run into each other, and the loads happen during the cinematics.
  - https://en.wikipedia.org/wiki/Max_Payne_3
  - https://gamesbeat.com/max-payne-3-review/
- **A static image plus a bar reads as lazy.** Use the wait for backstory.
  - https://www.wayline.io/blog/transforming-loading-screens-immersive-experiences

#### Other references
- **Game UI Database** (Edd Coates) has over 55,000 screenshots and videos, with a "Title Menus" category and filters by screen type. Use it to compare boards directly. Its images are reference only, so check usage rights before reusing anything.
  - https://www.gameuidatabase.com
  - https://aftermath.site/game-ui-database
  - https://80.lv/articles/ui-artist-created-a-database-of-games-menus
- **The Last of Us Part II's accessibility presets** (vision, hearing, motor) are a premium marker in their own right.
  - https://blog.playstation.com/2020/06/09/the-last-of-us-part-ii-accessibility-features-detailed
- **Remember Me** switches to a completely different interface inside a memory, and replays it like a videotape.
  - https://www.gameblog.fr/jeu-video/ed/impressions/remember-me-on-y-a-joue-nos-impressions-papillon-31209
- **Cyberpunk 2077's UI** was built in-house to run thousands of UI instances: https://gdcvault.com/play/1034167/User-Interface-in-Cyberpunk-2077

#### What makes these feel premium
1. The menu is a place in the world, with the hero in it.
2. It remembers your progress.
3. Starting is a camera move into gameplay.
4. Two or three typefaces, each with a single job, set big and with plenty of room.
5. Few options, kept in stable positions.
6. Every focus change has a sound and a 150 to 250 ms eased motion.
7. Loading screens carry lore or art, never tutorial tips.
8. Death is shown as the world's own motif, not as a modal dialog.

### 2. Proposals for each CATHODE screen

All of this works with three.js plus DOM/CSS under a strict CSP:
- CSS classes in external stylesheets.
- Setting styles from JavaScript through the CSSOM (`el.style.setProperty`, CSS custom properties) is allowed under `style-src 'self'`. Only `style=""` attributes and `<style>` tags are blocked.
- Fonts self-hosted.
- Sound synthesised with Web Audio.

#### Cold open and age gate
- Open on black with rain audio fading in, then one Bodoni italic line in Cath's voice. The 18+ card fades in over a slow-moving three.js scene of the street, not a flat panel.
- The card itself should look like a case-file stamp: a "RATED 18" plate and the content line, with Full/Reduced shown as two large tiles you can switch between. Don't mimic real PEGI or BBFC marks.
- Accepting doesn't swap the page: the card wipes away like ink on glass, and the camera holds on the title scene.
- Remember the answer so the gate runs only once.

#### Title screen
This is the biggest win: copy The Last of Us Part II and Dragon Age.
- **Scene:** a live three.js scene using the existing Drowned Market renderer. Cath stands under an awning at the Fish Market pier, cigarette or umbrella in hand, a neon sign buzzing, rain on the lens, and a slow 30 to 40 second dolly loop at a low framerate cost.
- **Lighting:** a little anamorphic flare and film grain, 2.39:1 letterbox bars that ease away on interaction, and the light shifting with the ambient-light colour of the scene.
- **Progress:** after each district is cleared, a matching set piece changes: the neon sign dark, a name scratched on the wall, a different district.
- **Wordmark:** large, Bodoni at the display optical size, letter-spaced. The colour on hover and focus is the single brand red. One live subtitle line underneath, such as "Hollowell Proper · 2079 · 3 names left", which tells returning players where they are.
- **Menu:** a left-aligned list, held in place, with Continue / New Case / Settings / Credits, plus Games as a quiet top-left link.
  - Focus state: a 2 px red rule slides in from the left, the label tracks out 2% and turns white from grey, and a soft synthesised tick plays.
  - Mouse hover moves the same focus. Arrow keys, WASD and gamepad all drive it.
  - Escape always goes back. Sub-screens get a breadcrumb.
- **Pressing Continue or New Case** is a camera push. The camera pushes past Cath into the street, the UI fades over 400 ms, a low synth swell plays, and the camera lands in the first-person start position. In the Max Payne way, any remaining loading hides inside that move.
- **5K support:** cap the device pixel ratio for the 3D (about 1.5 at 5K, with the post-processing chain scaled) and size UI type with `clamp()` and `vmin` so nothing is tiny on large screens. Test the 2560×1440 and 5120×2880 viewports in `npm run shots`.

#### Class pick
- Treat it as a wardrobe and dossier rather than cards. The 3D Cath stands in a pool of key light that changes per class: cool cyan for the system class, warm amber for the rewards class, and so on. She plays a short class-specific idle, such as checking a pistol or rolling her shoulders.
- The left column holds the three class names in Bodoni. The right column holds a mono stat readout that ticks up when you change class, plus one voice line.
- Confirm with a red "Commit" bar you press and hold for 600 ms, with a filling stroke and a heartbeat sound. Red means commit.

#### Loading screen
Follow Assassin's Creed Odyssey, Control and Dishonored 2.
- Show the target's case file:
  - a halftone photo of the next name on the list, treated with grain and duotone;
  - one paragraph of lore in Bodoni;
  - the district name in Rajdhani caps;
  - no control tips.
- **Progress:** wet ink bleeds along a rule under the name, and a mono percentage sits small in a corner.
- **Ready state:** "Press any key", per the Game Developer rule, with a gentle pulse but no blinking.
- **Different motifs for different loads:** a cyan circuit-trace sweep for travel, red ink for death and retry, as in Control.
- **Progress across the run:** the list of names appears in a corner, and dealt-with names get a hand-drawn strike-through animated as an SVG stroke. This pays off the premise every time a load happens.
- Never show an enemy or district the player hasn't reached.

#### Pause
- Freeze the frame and run the live canvas through a desaturate and blur pass. A three.js post pass is better than CSS `backdrop-filter` over WebGL, which is costly at 5K.
- Tint the frame to ink, with a slight vignette, and duck the audio through a low-pass filter.
- The menu sits on the left: Resume / Case board / Character / Settings / Quit to title.
- On the right, the current objective appears as a pinned case note, with the district name and time in the city.
- Opening takes 200 ms; Escape toggles it.

#### Death screen
This is the owner's "dying very high quality" request.
1. **First 0.0 to 1.5 seconds:**
   - Time slows to about 20%.
   - The camera drops and rolls towards the floor with damped spring motion, and the field of view narrows.
   - Blood spatter decals hit the lens, colour drains except for red, chromatic aberration rises, the heartbeat slows to a stop and the high frequencies roll off.
2. **Next 1.5 to 3 seconds:** a short kill-cam of the enemy who killed her, in a letterbox crop, with their name in mono, like Max Payne's lingering, distorted type.
3. **The card:** Control's red ink spreads in from the edges. One Bodoni italic voice line from Cath, plus a small mono line with the cause, damage taken and distance. Then two options: Retry (Enter, instant, no reload screen if the checkpoint is warm) and Quit to title.
- Never more than one key press between dying and playing again.
- Reduced-violence mode keeps the time dilation and colour drain but drops the gore decals.

#### Wounded (between full health and death)
- At low health, a red-tinted edge vignette whose noise pulses with the heartbeat.
- Directional damage arcs that last 400 ms and fade.
- A slight desaturation, plus a muffled "tinnitus" filter for one second after a big hit.
- Cath's breathing comes forward in the mix.

#### The first 10 seconds of a new game
- No stack of screens: the title push lands straight in the street.
- Cath says one voice line, and the area title "THE FISH MARKET" appears in Rajdhani caps and fades out after 3 seconds, as in Control.
- Guide the player to the first weapon the Tsushima way. A diegetic cue (a light spill, a glint, a sound loop) is the main guide, backed by a short "E · Take the pistol" prompt in the world.
- This also answers the owner's missed-pickup complaint, which a corner indicator will miss on a 5K screen.

### 3. Twelve replacement names

Each check was one web search for the name as a video game. A web search is not a trademark search: run USPTO, EUIPO, UKIPO and Steam store searches before committing to one.

| # | Name | Rationale | Clash check |
|---|---|---|---|
| 1 | **MOTHER'S RUIN** | Old slang for gin, a mum, and the ruin she brings. Classy, British, R-rated, and it sounds like noir. | No video game found. The name is used for a gin cabaret and cocktails. https://thebrag.com/mothers-ruin-cabaret-about-gin-comes-sydney |
| 2 | **STRIKETHROUGH** | The list of names, crossed off one by one. It also gives a ready UI motif (the struck-through name). | Only small titles: an adult Ren'Py visual novel and a 48-hour jam platformer. https://www.patreon.com/NullAndVoidStudio/posts/strikethrough-142591017, https://evilstarstudios.itch.io/strikethrough |
| 3 | **HOLLOWELL** | The city as the title, in the tradition of Bioshock's Rapture or Dishonored's Dunwall. Hollow, plus well. | No game with this name found. The nearest is *Hollowed*, a small free platformer. |
| 4 | **PROPER** | From Hollowell Proper. A British word that is both polite and menacing ("a proper beating"), like Cath. | No game found. |
| 5 | **RED LEDGER** | Debts paid in blood. It ties into the debt-tag murder in the opening. | No game found. The nearest is *Red Leader*, a tabletop RPG on itch. https://evanbuchholz.itch.io/red-leader |
| 6 | **NIGHT LEDGER** | A softer, moodier take on the ledger idea, set in the dark. | No game found. |
| 7 | **SCHOOL NIGHT** | Mum irony: she has to be home by morning. Short and memorable. | Only near-miss itch titles (*School Night of Fear*, *It's A School Night*). https://pawsmenu.itch.io/its-a-school-night |
| 8 | **CROSSED OUT** | The list again, said more bluntly, with a sense of being double-crossed. | No game found. |
| 9 | **DEBT TAG** | The calling card from the opening murder, so the title is the inciting crime. | No game found. The nearest is *Debtors' Club*. https://store.epicgames.com/p/debtors-club-af8a2a |
| 10 | **NAMESAKE** | Names are the list, and it echoes "for their sake". | No noir or shooter game found under this name. |
| 11 | **MOTHER TONGUE** | Cath's voice and lines are the game's signature, with a sharp-tongued mum. | Only a 15-minute 2020 Twine game. https://www.ifwiki.org/Mother_Tongue |
| 12 | **LAST ORDERS** | British pub closing call that means the end, and also orders as in a hit list. | Minor clash: a small Steam pub game (Dec 2025, 11 reviews). https://store.steampowered.com/app/1570650 |

**Rejected after checking:**
- *House Call* is a well-reviewed 2026 Steam horror game: https://store.steampowered.com/app/4348980/HOUSE_CALL
- *Wet Ink* is the name of a tabletop publisher, Wet Ink Games: https://www.backerkit.com/c/projects/wet-ink-games/our-lives-our-fortunes/updates/45655
- *Bad Mother* is a Christa Faust crime comic.
- *The Quiet Hour* is a 2026 speakeasy simulation: https://gg.deals/game/quiet-hour/

**Shortlist:** MOTHER'S RUIN, then STRIKETHROUGH or HOLLOWELL.
- MOTHER'S RUIN is the most distinctive, fits Cath's class-and-menace tone, and showed no game clash.
- STRIKETHROUGH builds the loading-screen motif into the title.

### Other sources consulted
- https://www.hudsandguis.com/home/2019/cyberpunk-2077
- https://gdcvault.com/play/1034160/User-Interface-in-Cyberpunk-2077
- https://www.gameinformer.com/2019/03/27/the-mesmerizing-art-behind-control
- https://kotaku.com/the-art-of-hades-1845443438
- https://www.thegamer.com/blade-runner-enhanced-edition-changes-improvements-fixes/
- https://www.dsogaming.com/news/deus-ex-mankind-divided-new-details-unveiled-new-game-mode-confirmed/
- https://www.playstation.com/en-us/games/the-last-of-us-part-ii/accessibility/

**Local context:** CATHODE's title and gate markup lives in `/home/user/Cathnivore/games/cathode/index.html` (read from `origin/build`, not edited). Its type system is the CATHODE section of `/home/user/Cathnivore/docs/design/aaa-ui.md`. I made no worktree and changed no files.
## C. Playtest audit at 5K
## CATHODE combat, look and feel audit (build `18585ee`, 2026-10-15)

I played it in my own worktree with software WebGL at 1440x900, at 2560x1440 (the 5K desktop's CSS layout, at DPR 2 and DPR 1) and at 844x390. The worktree and the preview server have been removed.

**How reliable the frames are.** Swiftshader managed only about 0.1 to 3 fps, so timing-based observations are approximate (about 41 frames rendered in several minutes). At 2560x1440 with DPR 2, the in-game screenshots timed out after 240 s. So the in-game 5K frames were taken at 2560x1440 with DPR 1. That gives the same CSS layout; the physical sizes below are worked out at DPR 2.

All screenshots are in ``. Every path below is under that folder.

### 1. Hit resolution: does cover block shots?
- **Player hitscan** (`game/combat.ts` `hitscan`):
  - It first casts against the world's axis-aligned collision boxes (`RayWorld`, 304 boxes in the market), then caps `maxD` at the world hit.
  - Enemies are then tested only within that distance: a quick reject (1.5 m from the chest), then per-segment capsules in `body.raycast`. Riot shields are an oriented box.
  - **So solid cover does block bullets.**
- **But collision is opt-in.** A box or cylinder only gets a collider if `collide:` is passed. In `render/level.ts`, 42 of 126 box and cylinder calls do. Shop glass, shutters, rails, AC units, awnings, sign boxes and lamp heads have none, so **bullets pass through anything thin or decorative.**
  - Many props are visible cover that isn't.
  - Colliders are also the axis-aligned bounds of rotated meshes, so angled props block a box larger than what you see. "I can see him but can't hit him" (or the reverse) is a real failure mode.
- **Ballistic rounds** (sniper) step at 240 Hz against the same boxes. The kill-cam then steers the round onto the predicted joint, a cinematic cheat.
- **Enemy shots at Cath** (`session.ts` ~1050): a ray to the world plus a "within 0.3 m of her chest line" test. Cover blocks them the same way.
- **Verdict:** the logic is sound, but the collision content is sparse. A player can't learn what is cover, and nothing in the HUD tells you a shot was stopped by cover. The only "blocked" feedback is a metal spark on a riot shield.

### 2. Feedback for hit, miss, kill and blocked
- **Hit** (`hud.ts hitMarker`):
  - Four tick marks, 2x7 CSS px, about 14 px from the centre.
  - White for a body hit, blood-red for a head hit, amber for a kill. Visible for 0.25 s with a 1.4 to 1 scale pop.
  - Plus a "HOLLOWELL ENFORCER" bar at the top centre for 2.5 s.
  - Plus `audio.hitFlesh()`, which is **the same sound Cath makes when she is hit.**
  - Blood: 10 to 50 droplets, 1 to 3 cm, coloured about 0.32 red scaled by local light (near-black in the noir grade). They spray **away from the player**, behind the target.
  - The flinch is `push*0.06`: for the pistol that is about 3 to 5 cm of spine offset. In practice it is invisible.
  - Frames: `21-fire-0-1440.png`, `22-fire-1-1440.png`, `23-fire-2-1440.png`. At 10 m I can't see any blood in any of them.
- **Miss:** an impact effect on the wall (dust, chips, sparks on metal), a decal and a tracer. There is no near-miss feedback.
- **Kill:**
  - The amber marker, a feed line "+XP", the ragdoll goes limp, and a loot octahedron appears.
  - No hitstop for guns (hitstop is melee-only, 0.07 s), no kill sound, no camera response, no slow-motion. The kill-cam only plays for ballistic kills over 18 m.
  - **Bug:** the target health bar stays up after the kill with a sliver of red (`25-fire-4-1440.png`, `28-enemy-dead-1440.png`). It is only updated on non-lethal hits.
- **Verdict:** the hit marker is a 2 px whisper. The owner's line "I don't see if I hit or not" is accurate. The AAA bar (DOOM, CoD, The Division, Cyberpunk) is:
  - a thick, high-contrast marker with a distinct audible tick for hit, head and kill;
  - visible hit-reacts or staggers;
  - bright blood puffs facing the player;
  - and a kill confirmation in sound and on screen.

### 3. Viewmodels: what they are built from
- **Construction:** everything is `RoundedBoxGeometry`, `CylinderGeometry` or `SphereGeometry` with flat-colour `MeshStandardMaterial` (`game/viewmodel.ts`). There are no textures, normal maps, decals or wear, and no environment-reflection setup beyond the scene.
- **Kestrel 9 pistol:** about 15 meshes.
  - Slide box, 6 serration boxes, red-dot body, glass and dot, frame, grip, trigger guard, suppressor cylinder and a ring.
  - The hands are 16 boxes and spheres each, plus a forearm sleeve. At hip fire they are mostly off-screen: only black knuckle spheres show at the bottom edge.
- **Enemy rifle:** 6 primitives.
- **Animation** is all procedural springs:
  - Recoil: z kick `kick*0.06`, rotation `kickRot*0.09` (the pistol's kick is 0.6).
  - Slide: a linear 3 cm travel over 0.07 s.
  - Reload: a generic dip plus roll (`dip 0.6`, `roll 0.5`). There is no magazine-out/magazine-in or hand choreography.
  - No raise or draw animation shows on pickup: frames 19 and 20 show no gun at all for several seconds after the Kestrel is given (`19-pistol-in-hand-1440.png`, `20-aim-at-enemy-1440.png`). This may partly be the low frame rate.
- **Muzzle flash:** a world-space additive 4-point "X" sprite of 0.2 to 0.36 m. It renders as a large blurry white cross beside the barrel, oversized for a *suppressed* pistol (`22-fire-1-1440.png`, `21-fire-0-5kcss.png`). The point light's intensity is 1.5.
- **Casings:** instanced brass cylinders with a landing sound. This part is decent.
- **Verdict:** this reads as a blockout, not a finished weapon (`25-fire-4-1440.png`).
  - Missing: a sculpted silhouette, a texture or trim sheet, hands that wrap the grip, a layered recoil curve (snap, settle, camera kick), a slide lock-back on empty, a dry-fire click, a real reload, an ADS transition with sight alignment, and smoke that lingers at the muzzle.

### 4. Enemy model and animation set
- **Model** (`game/body.ts`): 11 segments between 16 joints. Each segment is cylinders plus rounded boxes in four materials:
  - armour `0x2b2e35`, suit `0x101114`, an emissive visor strip, boots.
  - Helmet = a scaled sphere. Hands = a single box ("glove"). No face, no cloth, no faction markings, no textures.
- **Animation** (`game/animate.ts`): only procedural.
  - A gait ellipse with two-bone leg IK, rifle at low ready or shouldered, aim pitch, crouch, and the tiny flinch.
  - No reload, no hit-react set, no stagger or knockdown, no cover use (zero "cover" logic in `enemy.ts`), no flee, no death animation.
- **Death:** an instant Verlet ragdoll. The impulse is 3.5 for the pistol, 7 for the shotgun, 9 for the sniper.
- **Gore:** limbs and the head sever on big hits (stumps get gore caps). Pistol hits never trigger it.
- **Look in play:**
  - From behind the guard is a stack of near-black boxes (`13-guard-behind-prompt-1440.png`).
  - At 10 m under his lamp he can't be told apart from the street; only the waypoint diamond shows him (`12-guard-from-10m-1440.png`).
  - The lamp's light pool is a flat tan additive disc.
- **Verdict:** "very basic" is fair. It reads as early-2000s placeholder art.

### 5. Takedown, and enemy hit and death
- **The takedown** (`combat.takedown`) is instant:
  - `damage(hp+1)` plus a ragdoll with an impulse of 2.5, a 0.7 blood puff at the neck, and an amber marker.
  - **Cath plays no animation:** no baton strike, no grab, no camera move. The baton simply drops out of frame.
  - The guard folds into a small box heap (`14-takedown-a-1440.png`, `15-takedown-b-1440.png`, `16-takedown-body-1440.png`).
  - That is exactly "easy but unsatisfying". AAA takedowns (Dishonored, Cyberpunk, Far Cry) are short scripted paired animations with camera ownership, a sound, and a body that drops believably.
- **Gun kill:** the ragdoll drops and a loot octahedron appears on the body (`24-fire-3-1440.png`, `25-fire-4-1440.png`, `28-enemy-dead-1440.png`). There is no blood pool visible at that range.

### 6. Cath taking damage, low health and death
- **When hit:**
  - The DOM vignette (`.hud-hurt`, a radial gradient) rises by `damage/30`.
  - A red arc points to the source: 140x36 CSS px, 190 px from the centre.
  - The HP number punches, the tracer line comes from the shooter, and `hitFlesh` plays (the same sound used for hitting enemies).
  - No camera flinch or punch, no screen shake for gunfire (shake exists only for melee jolts), no directional blood on the lens, no post-process (desaturation, blur or chromatic aberration), no breathing or heartbeat audio.
  - Frames: `31-taking-fire-2-hp96-1440.png`. The enemy rifle did only about 3 to 4 HP per landed hit.
- **Low health (under the LOW_HP share):** the vignette gets +0.35, the HP bar pulses and the number turns red, plus a "lowHealth" voice line (`33-low-health-1440.png`). It is a flat red edge tint.
- **Death:**
  - `dead = true`, then a banner "Cath is down / Click or tap to try again" that fades over 3.2 s like any other banner. After 0.9 s, a click calls `location.reload()`, a full page reload.
  - No death camera, no fall, no fade, no slow-motion, no restart card.
  - The world keeps running and the gun stays raised (`34-death-a-1440.png`, `35-death-b-1440.png`, `23-death-5k-5kcss.png`).
  - At this frame rate the banner never appeared in my captures. The DOM still held the previous "Checkpoint saved" banner at opacity 0. So it is at best a transient text line.
- **Verdict:** this is the weakest area. The owner asked specifically for high-quality being-hit, wounded and dying visuals, and today there is almost nothing beyond a CSS gradient.

### 7. First weapon pickup and waypoint at 5K
- **The pistol "case"** (`firstjob.ts Case`):
  - A 0.62x0.14x0.4 m leather box with an amber band, bobbing at y+0.75.
  - A "beam" cylinder 9 m tall (radius 0.05 to 0.25 m, opacity 0.18 additive) and a 4-intensity point light with a 6 m range.
  - It sits at (-7.6, 30.5), behind the pawn shop's parked car. From the street after the takedown it is **12 m away, about 47% of the way to the left screen edge, and hidden behind the car** (`17-case-default-view-1440.png`). Even when you look straight at it, only the diamond shows above the car roof (`18-case-looking-at-1440.png`).
  - The beam is effectively invisible in rain and bloom.
  - Pickup is walk-in within a 1.4 m radius, with no prompt. Kill drops are a 0.10 to 0.16 m octahedron.
- **Sizes at the owner's 5K (2560x1440 CSS, DPR 2):** these are fixed CSS px with no viewport scaling, so 5K draws them at 2x physical px on a 5120-px-wide panel.

| Element | CSS px | Physical px | Share of screen width |
|---|---|---|---|
| Waypoint diamond (`.hud-wp-mark`, 14 px rotated, 1.5 px cyan border) | 19.8 bounding box | about 40 | about 0.8% |
| Waypoint distance text | 14 font | 28 | |
| Hit-marker ticks | 2x7, at a 14 px radius | 4x14, at a 28 px radius | |
| Crosshair arms | 8x1.5 | 16x3 | |
| Teach line | 370x44 | 740x88 | |
| Ammo numerals | 56 font | 112 | |
| Case model at 12 m (75° vertical FOV) | about 74x17 if unoccluded | about 148x34 | |

  - The HUD clusters keep 280 px widths, so on 5K the whole HUD occupies the corners like a phone UI (`17-case-default-view-5kcss.png`, `21-fire-0-5kcss.png`).
- **Verdict:** "easily missed" is confirmed. The case is occluded, off to the side and tiny, and the indicator is a 40-physical-px diamond with no pulse, no on-screen arrow, no world-space marker and no interact prompt.

### 8. Front door: gate, title, class pick, loading
- **Gate:** a centred dark card, a serif "CATHODE" wordmark and radio choices, beside a chibi-style 2D SVG Cath (big eyes, blushing cheeks) with flat bokeh circles (`01-gate-1440.png`, `01-gate-5k.png`, `01-gate-phone.png`).
- **Title:** the same cartoon Cath in a framed panel, the wordmark, a tagline, a quote, and red and ghost buttons (`02-title-1440.png`).
  - At 5K the content is a small island in the middle of a mostly empty screen (`02-title-5k.png`).
  - On phone, the "Games" back link sits on top of the portrait frame (`02-title-phone.png`).
- **Class pick:** a clean editorial layout, but at 5K the right 40% of the screen is empty (`03-classpick-1440.png`, `03-classpick-5k.png`, `03-classpick-phone.png`).
- **Loading:** a black screen with one eyebrow line, an italic flavour line and a 320 px hairline progress bar. No art, no tips, no backdrop (`10-loading1-1440.png`).
- **Verdict:** it is tidy, but reads like a web page rather than a game.
  - AAA front ends (Cyberpunk 2077, Hitman 3, Control, The Division 2) run a live in-engine 3D backdrop (here: the rainy market with a camera drift), use full-bleed key art, and show menus as layered panels with motion, sound and controller-style focus states.
  - Their loading screens show district key art, a lore card or tip, and a stylised progress element.
  - The cute chibi Cath fights the R-rated noir tone; a painted or 3D noir Cath silhouette would fit.
  - None of the layouts scale up for 5K.
- **Name:** "CATHODE" is in the gate, the title, `<title>`, `aria-label`s, `docs/design/cathode.md` and the URL `/cathode/`. A rename touches all of them.

### Top fixes, by owner impact
1. **Hit feedback:**
   - A bigger, thicker hit marker with its own tick, headshot and kill sounds (separate from Cath's hurt sound).
   - Player-facing blood bursts and a mist at readable size and brightness.
   - Real hit-reacts: flinch scaled by about 10x, staggers, limb-specific reactions.
   - A short kill hitstop or slow-motion on the last enemy.
   - Clear the target health bar on kill.
2. **Damage and death:**
   - Camera punch and shake by direction, a post-process damage pass (desaturate, chromatic aberration, edge blur), and a heartbeat and muffle at low HP.
   - A death sequence: the camera falls, fade, a restart card. No more `location.reload()`.
3. **Takedown:** a paired 1 to 1.5 s animation with camera control, a baton strike, sound, and a weighted body fall.
4. **Pistol:**
   - A detailed sculpt with trim textures and visible gloved hands.
   - A layered recoil curve, slide lock on empty, a proper reload, a smaller suppressed muzzle puff, and lingering smoke.
5. **Enemy:** a higher-detail armoured figure with readable faction colour or rim light, hit-react, reload and cover behaviour, and death reactions that blend into the ragdoll.
6. **Pickup:**
   - Move the case into the sightline (not behind the car).
   - Strong vertical light and a pulse, a world-space marker scaled for 5K, an "E / Pick up Kestrel 9" prompt, and a weapon-on-display model instead of a closed box.
7. **HUD scaling:** scale with `clamp()`/viewport units so 5K isn't phone-sized.
8. **Front door:** a live 3D market backdrop, a noir Cath key art, a rebuilt loading screen, layouts that scale to 5K, and the rename.

### Other issues spotted
- **Takedown teach line:** it says "Follow the marker. C to crouch…" while the prompt chip "F TAKEDOWN" already shows below. The teach box overlaps the guard's head at 2 m (`13-guard-behind-prompt-1440.png`).
- **Enforcers at stage 3:** they spawn in the "searching" state, not unaware.
- **HP bar:** in `33-low-health-1440.png` the bar still looks nearly full at 18 HP. That may be my `maxHp` override or the bar easing at a low frame rate; I couldn't tell which.
## D. Gunfeel spec
## CATHODE combat and feel spec (Phase C)

This spec is meant to live at `docs/design/cathode-combat.md`. ROADMAP Phase C already names that file, and the file does not exist yet. Where this spec is more specific than the ROADMAP C1 to C8 placeholders, this spec wins.

Baseline is `origin/build` at `e481c68`. That build already has:
- C1 slice 1: a bigger hit marker with a kill ring, `Audio.hitTick`, `Hud.blocked`, a larger flinch, and rem-based HUD scaling above 900 px.
- C2 pistol detail: sights, ejection port, slide stop, rail and trim.
- C7: a 24 m first-weapon beam and a "New weapon" banner.

Everything below builds on that code. None of it is a rewrite.

---

### 0. Ground rules

#### Platform
- WebGL2 and three.js only. No WASM. That rules out KTX2/Basis transcoders, Draco, Ammo and Rapier.
- CSP: no inline `style=""` attributes and no `<style>` tags. Dynamic values go through `el.style.setProperty('--x', …)` and class toggles, which the HUD already does.
- Assets are self-hosted. Geometry is built in code. Textures are generated on a canvas at load, or are CC0 images (Poly Haven, ambientCG) re-encoded to WebP or JPEG under `games/cathode/public/tex/`.
- Each CC0 texture is logged in `games/cathode/public/tex/CREDITS.md`, with its source URL and licence.
- Combat textures may total at most 6 MB downloaded.

#### Targets
| Profile | Device | Frame target | Notes |
|---|---|---|---|
| `phone` | iPhone 17 Pro Max, landscape 844x390 CSS @3x | 60 fps (16.6 ms) | Render scale 0.7 of CSS × DPR cap 2; FXAA |
| `high` | 1440x900 laptop | 60 fps | MSAA 4x |
| `ultra` | 5K desktop: 2560x1440 CSS @2x (5120x2880 physical) | 60 fps | Dynamic render scale 0.6 to 1.0 of physical. DOM HUD stays native |

#### One file for every feel number
All feel numbers live in `games/cathode/src/game/feel/tuning.ts`. This is a plain object with no three.js import, so unit tests can read the same values. Every timing and size in this spec has a named entry there.

#### One clock
The feel clock is `game/feel/clock.ts`. It owns:
- `hitStop` (in seconds)
- `timeScale` (for slow motion, kill-cam, Second Wind and takedowns)
- `realDt`

Sim, AI, physics and particles use `simDt = realDt * timeScale * (hitStop > 0 ? 0 : 1)`. The viewmodel springs, camera trauma, audio and HUD always use `realDt`. Today hitstop exists only for melee (0.07 s), so the first step is to move it here.

---

### 1. Shared runtime pieces (build these first, in M1)

| Module | Contents | Test |
|---|---|---|
| `feel/spring.ts` | `Spring1`/`Spring3`: semi-implicit Euler, fixed 1/240 s substeps (the same scheme as `ViewAnim`). Created from `{freqHz, zeta}`: `k = (2πf)²`, `c = 2ζ·2πf`. Supports `shove(v)`, `target`. | Settles within ±2% in the analytic time; stable at dt = 0.1 s |
| `feel/trauma.ts` | Camera trauma. `add(x)` caps at 1. Output is `trauma²·max`, sampled from 1D value noise at 20 Hz. Decays at 1.5/s | Decays from 1 to 0 in 0.67 s; output is 0 at trauma 0 |
| `feel/clock.ts` | `hitStop(ms)` keeps the larger of the current and new value, and never stacks above 150 ms. `slowmo(scale, ms, rampMs)` | Normal hit 15 ms, kill 60 ms, a clamp holds; auto-fire caps at 30 ms |
| `feel/events.ts` | A typed bus, `on/emit`, for `Fire`, `Hit`, `Blocked`, `Kill`, `NearMiss`, `PlayerHurt`, `PlayerDown`, `PickupSeen`, `Pickup`. HUD, audio, FX and the viewmodel subscribe; combat only emits | Each listener is called once per emit |
| `feel/clip.ts` | Keyframe clips: `{dur, tracks: {[part]: Key[]}}` with `Key = [tMs, pos3, rot3, ease]`. Sampled additively. The existing `SWING_FORE` tables become clips | Interpolation, eases, and `eventsBetween(t0,t1)` for sound and spawn cues |
| `feel/ik.ts` | Two-bone analytic IK (shoulder or elbow pole) for the viewmodel arms and enemy arms. `body.ts` already has two-bone leg IK; reuse its maths | The end effector hits the target within 1 mm when it is reachable |

---

### 2. Hit resolution and cover (the owner's "behind something" question)

#### 2.1 Rules
- Hitscan keeps the current order: world first, then enemies within `maxD`. This order is correct.
- What is missing is collider content. Fix it in the level code:
  - **Collider coverage.** Any prop that looks like it would stop a person must collide. In `render/level.ts` and `render/levels/*`, the `box()`/`cyl()` builders take `cover: "solid" | "thin" | "none"`, with the default by prop kind:
    - `solid`: walls, crates, cars, counters, pillars, AC units, planters, dumpsters, statues.
    - `thin`: shop glass, shutters, railings, awnings, sign boxes, plywood, cloth stalls.
    - `none`: decals, rain, light cones, lamp heads over 2.4 m.
  - A lint-style test fails if a non-`none` prop has no collider.
  - **Oriented boxes.** `RayWorld` gains OBBs: a box plus a yaw quaternion, tested by transforming the ray into box space. A rotated prop is then hit where it is drawn, not by its larger axis-aligned bounds.
  - **Materials.** Each collider carries `mat: concrete | metal | glass | wood | cloth | flesh`. The material picks the impact FX, the decal and the sound.
  - **Penetration.** This uses `WeaponStats.penetration`, which already exists. A `thin` collider costs one penetration layer and 50% damage. A `solid` collider stops the round unless the weapon is a rail (`penetration ≥ 2`). When a round passes through, the impact plays on both faces.
- **Blocked feedback.** Fire this when the ray hits a collider and an enemy segment lies within 1.0 m of the ray past the hit point, with line of sight to the camera from the hit point. That is "you were aiming at him and cover ate it". The response:
  - FX: material impact ×1.5, plus a bright spark fan of 12 to 20 particles for metal or concrete.
  - HUD: the existing `Hud.blocked()` tag, shortened to a 320 ms glyph (a hollow square bracket) beside the crosshair. Drop the text after the first three uses.
  - Audio: `Audio.blocked()`.
  - **No hit marker.** A hit marker only ever means flesh or armour was hit.
- **Penetration hit.** A hollow-tick marker variant (`.hud-hit.pen`) plus the normal hit sound at -3 dB.
- **Near miss.** Fire this when the ray passes within 0.5 m of an enemy head without hitting. The enemy flinches its head 8° and has a 40% chance to bark "suppressed" (§6.4). The player gets no marker, but sees and hears that the shot did something.

#### 2.2 Debug and test hooks
- `?debug=cover` draws every collider as a wireframe coloured by material, for screenshots.
- `window.cathode.combat.traceShot(from, to)` returns `{blockedBy, mat, enemy, zone, damage}`.

#### 2.3 Tests (`tests/cathode-cover.test.ts`)
1. A solid box between the eye and the enemy gives no `Hit` and gives `Blocked`.
2. A thin pane gives a `Hit` at 50% damage, plus a `pen` flag.
3. A 30°-rotated OBB: a ray through the bounding-box corner but outside the OBB passes.
4. A level audit: every `cover !== "none"` prop in the market, clinic, plaza, tower and vault has a collider. A count is printed.
5. Near miss: a ray 0.4 m from the head emits `NearMiss` and no `Hit`.

---

### 3. Hit feedback (enemy-facing layers, fired on the same frame)

#### 3.1 Marker
The marker is DOM, in `ui/hud.ts` with `styles/hud.css`. The size unit is `--u: clamp(0.8px, calc(100svh / 1080), 2.4px)`. That gives 1.33 at 1440 CSS height (5K) and 0.8 on the phone.

| Class | Tick length / thickness / gap | Colour | Pop scale | Hold / fade (ms) | Extra |
|---|---|---|---|---|---|
| body | 10u / 2.25u / 7u | `#f4f1ea` with a 1u `#000a` outline | 1.25 → 1.0 over 60 | 80 / 140 | — |
| head | 13u / 2.5u / 7u | `#ff3b3b` | 1.35 → 1.0 | 90 / 160 | 2u inner dot flash |
| soft (armour) | 10u / 2.25u | `#9fb4c8` | 1.15 | 80 / 120 | 3u shield pip under the centre |
| pen | 10u hollow (1u stroke) | `#f4f1ea` | 1.2 | 60 / 120 | — |
| kill | 15u / 3u / 9u | `#ff3b3b` | 1.5 → 1.0 over 80 | 120 / 400 | Ring expands 12u → 40u, fades over 420 ms (exists) |
| head kill | kill + gold `#e8b04a` 1u accent stroke | | | | Ring doubled |

Rules:
- The marker class depends on the hit class, not on damage (the Overwatch lesson). A new hit restarts the animation through the existing next-frame class re-add (no reflow).
- Damage numbers are an option, `prefs.damageNumbers`, off by default:
  - Condensed mono at 16u, rising 30u over 600 ms.
  - Hits within 250 ms merge into one rolling number.
  - Crits use 20u in amber.
- **Target bar bug:** `Hud.targetHit` must also run on lethal hits, with `frac = 0`. The bar then flashes, collapses its width over 180 ms and hides 400 ms later.

#### 3.2 Hit sounds (dry bus)
- Add `Audio.dry`, a gain node straight to master that skips the reverb send and the duck. All hit ticks go there.
- Keep `hitTick` as it is and add a body thump. The final layering:

| Hit | Layers | Peak |
|---|---|---|
| body | Square 2.6 kHz → 2.2 kHz over 45 ms; plus high-passed noise above 5 kHz, 30 ms; plus a **new** sine at 140 Hz falling to 90 Hz over 60 ms (the "thock") | -12 dBFS |
| head | Square 3.6 kHz plus sines at 1.8 and 2.7 kHz, 250 ms exponential decay ("ding") | -10 dBFS |
| soft | Triangle 900 → 700 Hz over 50 ms, plus a metal ping (`hitMetal`) | -14 dBFS |
| kill | head or body layer, then +50 ms square 1.5 kHz → 1.1 kHz over 90 ms, plus a sub at 70 → 40 Hz over 180 ms, plus a 300 ms noise "whump" low-passed at 400 Hz | -8 dBFS |

- `hitFlesh` stays as the world-space meat impact, panned to the enemy and played on the reverb bus. Cath's own hurt sound becomes a separate `Audio.hurt()` (§7), so the two never share a sound again.

#### 3.3 Enemy reaction (on every hit, elites included)
- The per-zone flinch is a `Spring3` on the hit segment's local rotation, at 12 Hz with ζ 0.5. It settles in about 250 ms.

| Zone | Rotation impulse | Root push |
|---|---|---|
| head | 20° pitch away from the shot, ±6° roll | 0.10 m |
| torso | 12° twist away from the shot side | 0.15 m |
| arm | 25° at the shoulder; the weapon muzzle drops 15° for 300 ms | 0.05 m |
| leg | 25° at the knee; the root dips 6 cm | 0.10 m |

- Scale both by `clamp(damage / 25, 0.5, 1.6)`.
- Shotgun push ×2. Sniper push ×2.5.
- The flinch is a separate layer, so it blends on top of locomotion and on top of the active ragdoll (§5.2).

#### 3.4 Impact effects (on the body, anchored to the segment)
**Flesh:**
- Blood spray: 18 to 30 instanced particles.
  - Two cones: a 35° exit cone along the shot direction, plus a **60% share in a 50° entry cone back toward the camera**. The entry share fixes "blood sprays away from me".
  - Speed 2 to 5 m/s with gravity.
  - Colour: linear `0.28, 0.01, 0.01`, with a floor of luminance 0.05 after the grade. Size 1.5 to 4 cm.
- A mist of 3 soft quads, 0.25 to 0.4 m across, alpha 0.5 to 0, over 220 ms. The mist is lit with `max(localLight, 0.35)` so it reads in the noir grade.

**Armour:** sparks, 10 to 16 additive streaks of 4 to 8 cm, lasting 120 ms, coloured `#ffd28a`.

**Anchoring:** effects are parented to the hit segment group for their first 80 ms, then released to the world, so they travel with the flinch.

**Wound flash on the hit segment:**
- One frame (≤ 33 ms) of emissive white at intensity 2.
- Then an emissive `#ff2a1a` at 0.6 fading to 0 over 150 ms.
- Implementation: a uniform on the segment material clone (`material.userData.flash`). Clone once per enemy, not per hit.

#### 3.5 Kill confirm
- Hit-stop 60 ms (headshot kill 110 ms).
- Camera FOV punch -1.5°, recovering through a spring over 150 ms.
- Trauma +0.1.
- Kill marker and kill sound (above).
- Last enemy of an encounter: slow motion of 0.35× for 400 ms with a 250 ms ramp out (§9 covers the kill-cam rule).

#### 3.6 Gamepad rumble
- Where `vibrationActuator` exists:
  - fire: weak 0.3 for 40 ms
  - hit: weak 0.2 for 30 ms
  - kill: strong 0.6 for 120 ms
  - hurt: strong 0.8 for 200 ms
- None on iPhone. Phones get trauma ×1.2 instead.

---

### 4. Weapons

#### 4.1 Construction (procedural, per part)
**Builder.** Use `game/gunkit.ts`, built on these primitives:
- `profile(points, depth, bevel)`: `THREE.ExtrudeGeometry` from a `Shape` side silhouette, `bevelEnabled`, `bevelSize 0.6 to 1.2 mm`, `bevelSegments 2` (desktop) or `1` (phone). This is the main tool: slides, frames, receivers and stocks are side profiles extruded to their thickness. That alone moves the look from boxes to silhouettes.
- `lathe(radii)`: `LatheGeometry`, 24 segments (12 on phone), for barrels, crowns, compensators, suppressors, scope tubes, cylinders and rounds.
- `rounded(w,h,d,r)`: the existing `RoundedBoxGeometry`, for small blocks.
- `cutouts`: ejection ports, lightening cuts and serrations are modelled by shape holes (`Shape.holes`) in the extrude profile. Do not use CSG, which costs too much at load and carries too much risk.

**Merging.** After building, run `BufferGeometryUtils.mergeGeometries` per (moving part × material), so each gun is 6 to 12 draw calls. Cache the built rigs by model id. Build them when the weapon is first owned, never during a fight.

**UVs.** Generate them with a box projection at 1 texel = 0.25 mm. The ExtrudeGeometry side faces get a planar UV along the profile.

**Trim atlas.** `render/guntex.ts` generates one atlas at load, from canvas height fields turned into normals with a Sobel filter:
- Size: 1024² on desktop, 512² on phone.
- Bands: grip stipple, slide serration, knurling, polymer grain, brushed steel, Cerakote orange-peel, and engraving text ("KESTREL 9 · HOLLOWELL ARMS · 9×21").
- Outputs: albedo (`map`), packed `roughnessMap`/`metalnessMap` (G/B), `normalMap`, and an `edgeWear` mask.
- The edge-wear mask comes from the bevel: a vertex attribute `aEdge` (1 on bevel verts, 0 on caps) plus noise. The material lightens albedo by 25% and lowers roughness by 0.2 where `aEdge·noise > 0.55`, through `onBeforeCompile`.
- Optional: CC0 Poly Haven `metal_plate`/`painted_metal` detail normals at 512² WebP, tiled at 4 cm.

**Materials** (desktop `MeshPhysicalMaterial`, phone `MeshStandardMaterial`):
| Part | Colour | Metal / rough | Extra |
|---|---|---|---|
| Polymer frame | `#1b1c1f` | 0 / 0.62 | Stipple normal 0.8 |
| Slide | `#2a2c30` | 1 / 0.34 | Edge wear; clearcoat 0.3 (desktop) |
| Barrel / hood | `#8a6a3c` (TiN bronze) | 1 / 0.28 | — |
| Springs, pins | `#9aa0a6` | 1 / 0.4 | — |
| Tritium dots | `#7dffb2` | emissive 3.0 (blooms) | Three dots |
| Faction trim | cyan `#3fe0ff` | emissive 1.2 | One accent line only |

**Viewmodel lighting.** The first-person layer gets:
- its own PMREM environment, made at load from a tiny neon room (four emissive strips: red, cyan, amber, white), so the slide shows neon reflections even in a dark alley;
- a key `DirectionalLight` from upper left at intensity 1.2;
- a rim light from behind right in cyan at 0.8.

The viewmodel never goes black.

**Rendering.** Keep the current approach: a first-person layer after a depth clear, inside the same HDR buffer. Viewmodel FOV is 54° (world FOV 75°). Near plane 0.01.

**Hands.** These are the biggest single step up from a budget viewmodel.
- Gloved hands are built from `shared/cath/` palette tokens: black leather `#141214`, roughness 0.45, and a burgundy cuff `#5a1420` showing 2 cm of sleeve.
- Each hand is a palm extrude, 4 fingers × 3 lathe or rounded phalanges, and a 3-phalanx thumb, about 18 parts merged into 3 draw calls (static fingers, trigger finger, thumb).
- The arms are forearm and upper-arm tapered lathes, driven by `feel/ik.ts` from shoulder anchors at (±0.18, -0.28, +0.35) toward hand targets on the gun (`gripR`, `gripL` empties in the rig).
- The grip pose is a modern two-handed thumbs-forward grip. The support hand wraps the firing hand. The trigger finger lies along the frame and curls only while firing (trigger travel 5 mm).
- At hip fire, at least 25% of the visible viewmodel pixels must be hand or arm. The camera shows the wrist and part of the forearm, not just the knuckles.

**LOD.**
- The viewmodel has none.
- World pickup and enemy weapons share the gunkit:
  - LOD0: the full merged mesh.
  - LOD1 (> 8 m): no cutouts, one material, bevelSegments 0.
  - LOD2 (> 30 m): one box with the atlas albedo.
  - Built with `THREE.LOD`.

**Kestrel 9 (pistol) part list (must all exist as separate nodes):**
- `frame` (with grip stipple)
- `slide` (moves; serrations and port cut)
- `barrel` (tilts 3° when the slide passes 60% of its travel)
- `hammer` (rotates 0 to 55°)
- `trigger` (5 mm)
- `mag` (removable, with a visible top round when loaded)
- `slideStop` (rotates up 12° on lock)
- `sightF`, `sightR` (tritium)
- `suppressor` (lathe with 6 grooves and an end cap)
- `rail`, `guard`, `floorplate`
- the red-dot (keep it, but rebuild as an extruded housing, with the glass as `MeshPhysicalMaterial` transmission 0 / roughness 0.05 / opacity 0.25)
- `gripR`, `gripL`, `muzzle`, `port` empties

**Triangle and draw-call budget per viewmodel:**
- Desktop: ≤ 30k triangles and ≤ 14 draw calls, hands included.
- Phone: ≤ 14k triangles and ≤ 10 draw calls.

#### 4.2 Viewmodel animation stack
Evaluated each frame in `Arsenal.pose`. Layers add in this order:
1. **Base pose:** a lerp from hip to ADS using smoothstep. ADS is 180 ms on the pistol (see the class table for the others).
2. **Locomotion:**
   - Walk bob: a figure-eight at the stride frequency (`stride` exists). x 6 mm, y 10 mm, roll 0.6°.
   - Sprint pose: pitch -25°, yaw +30°, roll +10°, y -4 cm, blended in 200 ms.
   - Land dip: 3 to 6 cm in proportion to fall speed, plus 2° of camera pitch. The spring runs at 6 Hz with ζ 0.6.
3. **Clip layer:** draw, reload, inspect, takedown, or melee from `feel/clip.ts`.
4. **Springs:**
   - Look sway: rotation lags the mouse, about -0.02°/px, clamped to ±4°. Roll into turns ±3°. 8 Hz, ζ 0.7.
   - Breathing: pitch ±0.3° at 0.25 Hz, plus a Lissajous x 0.5 Hz / y 1.0 Hz at ±3 mm.
   - Recoil: separate position and rotation `Spring3`s (below).
   - ADS multiplies sway, breathing and bob by 0.3.
5. **Weight:** each class has `mass` (pistol 1.0, rifle 1.6, launcher 2.4). Divide spring frequencies by √mass and multiply bob by 0.85 per step of mass. Heavy guns feel heavy.

#### 4.3 Pistol fire choreography (Kestrel 9, suppressed)
| t (ms) | Event |
|---|---|
| -30 to 0 | The trigger already sits at 3 mm (preload while the button is held down) |
| 0 | The trigger reaches 5 mm and the hammer drops. Muzzle FX (4.5) and a light pulse. Camera recoil impulse. Viewmodel shove: position z +3.0 cm, y +0.5 cm; rotation pitch +6°, roll ±2° (random sign). `Fire` event. |
| 0 to 30 | The slide travels 24 mm back with ease-out (`1-(1-u)³`). The barrel tilts 3° from 14 ms. |
| 18 | A shell spawns at `port`: velocity right 1.8 to 2.4, up 1.0 to 1.4, back 0.3 m/s; spin 25 to 40 rad/s; ±20% random. The existing instanced casings are kept. |
| 30 to 62 | The slide returns with ease-in and lands with a 1-frame 0.6 mm overshoot. The hammer re-cocks to 55°. |
| 62 | Mechanical "clack": the second click of the sound layers. |
| 0 to 900 | Smoke: 3 billboards at the muzzle and 1 at the port. They rise 0.3 m/s, grow 2 to 9 cm, alpha 0.18 to 0, and are lit by the scene. Heat (+0.12 per shot, decaying at 0.25/s) adds smoke up to 3× at heat 1. |
| 350 to 600 | The shell lands, bounces up to 2 times with restitution 0.35, and plays a brass tink panned in 3D. Cap at 40 shells, FIFO. |

**Recoil springs.** Viewmodel: rotation 14 Hz ζ 0.45; position 16 Hz ζ 0.55. The current `kick·0.06` translation is replaced by these.

**Camera recoil** (what moves the aim):
- Pistol: pitch +1.1° and yaw ±0.3° per shot, driven by `recoilAt()` (the pattern table already exists in `sim/weapons.ts`).
- 70% recovers automatically over 200 ms through a critically damped spring at 5 Hz. The remaining 30% stays until the player corrects it.

**Trauma:** +0.12 per pistol shot. The maximum shake is 1.5° rotation and 0.6 cm translation.

**Last round:**
- The slide locks at 24 mm, the slide stop is up, and the empty chamber is visible through the port. The mag shows no top round.
- The next trigger pull plays a dry click: 2 clicks at 4 kHz, no flash and no recoil.
- An empty reload follows.

#### 4.4 Reloads (clips; the mag counts as "in" at 60% of the duration)
**Tactical reload, 1.55 s:**
| t (ms) | Beat |
|---|---|
| 0 to 200 | The gun rolls 20° and pitches 8° toward the support hand. The left-hand IK target moves to `magwell`. |
| 200 | Mag release click. The mag drops 3 cm and the left hand takes it. |
| 200 to 520 | The left hand takes the old mag down and off screen at low left. |
| 520 to 880 | The new mag comes in from low left. It is the mesh with the top round visible. |
| 930 | Insert. One frame of 4 mm upward jolt on the whole gun, trauma +0.05, and a mag click with a tight seat sound. **Rounds are committed here (60%).** |
| 930 to 1550 | Return to the base pose. The left hand goes back to `gripL`. |

**Empty reload, 2.05 s:** the same beats, then:
- The old mag is ejected as a physical drop that clatters (it uses the casing physics with restitution 0.2 and stays 10 s, cap 6).
- At 1450 the thumb presses the slide stop.
- The slide slams home in 35 ms, with trauma +0.08 and a "slam" sound.

**Rules:**
- Sprint, fire or swapping weapons cancels a reload before the commit beat (no ammo is lost) and does not cancel it after.
- ADS during a reload is allowed (the reload clip plays at the ADS base with rotations at 50%).
- Under `prefs.reducedMotion`, clip rotations scale to 50%.

**Draw (on pickup and on swap):**
- 450 ms. The gun rises from y -25 cm with pitch -40°.
- At 300 ms the slide is racked 24 mm back and released. This is the hero beat on the first pickup only (900 ms total).

**Inspect (active idle):**
- After 12 s without input, play a press-check: the slide comes back 8 mm and the left thumb rests on it, for 1.6 s.
- Any input cancels it.

#### 4.5 Muzzle and impact FX
**Kestrel 9 (suppressed):**
- No star flash. A gas puff: 2 crossed additive quads of 5 to 8 cm, colour `#ffb070`, intensity 2, for 1 frame.
- A ring of 4 smoke wisps.
- Point light: intensity 0.6, distance 2.5 m, 40 ms.

The audit's 0.2 to 0.36 m white cross is removed for suppressed guns.

**Unsuppressed classes:**
- 3 crossed side quads plus a front star quad with random roll.
- Scale ±25%. Visible for exactly 1 frame at ≥ 50 fps and 2 frames below that.
- One shared `PointLight` (`#ffb070`): intensity 4 to 8, distance 4 to 6 m, decaying over 50 ms. It lights wet streets.

**Hot barrel:** an emissive glow on the crown when heat > 0.6.

**Tracer:** a 1 in 3 tracer for SMG and rifle only. 40 cm long, 6 mm wide, additive `#ffcf8a`, moving at 600 m/s apparent speed.

**World impacts by material** (decals use `DecalGeometry`, 64 desktop / 32 phone, FIFO):
| Material | Particles | Decal | Sound |
|---|---|---|---|
| concrete | Dust puff ×4 grey, chips ×6 | 6 cm bullet hole plus a 14 cm scorch | Dry crack plus debris |
| metal | Sparks ×12, a 1-frame spark light | 3 cm bright dent | Ping at 2.4 to 3.2 kHz plus ricochet whine (30%) |
| glass | Shards ×10, reflective | A 22 cm star-crack decal (procedural line canvas) | Glass tick plus tinkle |
| wood | Splinters ×6 | 5 cm hole | Hollow knock |
| cloth | Fibres ×4 | None | Soft thup |

#### 4.6 Layered gunshot audio
- Use `game/gunsound.ts`. At load, an `OfflineAudioContext` pre-renders **8 variants per weapon class** from the layers below. CSP-safe, and much cheaper per shot than live synthesis.
- Each shot picks a variant that differs from the last two, with pitch ±4% and gain ±1.5 dB.

| Layer | Pistol (suppressed) recipe | Level |
|---|---|---|
| Transient | 12 ms white noise, high-passed at 1.5 kHz, 1 ms attack | -9 dB |
| Body | 90 ms noise, low-passed at 2.2 kHz, plus a sine sweeping 160 → 70 Hz | -10 dB |
| Mechanics | Clicks at +22 ms (slide back) and +62 ms (slide home), band-passed at 3.5 kHz, Q 6 | -14 dB |
| LFE | 55 Hz sine for 100 ms (unsuppressed classes 45 Hz for 160 ms at -6 dB) | -16 dB |
| Tail | Send to a procedural convolver IR: exponential noise, 1.4 s outdoor (low-passed at 3 kHz) and 0.8 s indoor (`Level.theme.indoor`) | Send -12 dB |
| Reflections | Live, not baked. Cast 5 `RayWorld` rays (L, R, F, B, up) up to 40 m. Each hit schedules a copy of the body layer, low-passed at 1.8 kHz, at `2d/343` s, at -14 dB minus 0.3 dB per metre, panned to the ray direction | — |

Mixing rules:
- While firing, duck music and ambience by 4 dB (attack 20 ms, release 400 ms).
- A `DynamicsCompressor` sits on the master: threshold -18, ratio 4, knee 6, attack 3 ms, release 150 ms.
- Enemy shots get a supersonic whiz-by when they pass within 2 m of the camera: a band-passed noise sweep from 4 kHz to 1.5 kHz over 120 ms, panned.
- Budget: 32 live voices at most (phone 20). Steal the oldest tail first.

#### 4.7 Every class (same kit, same stack)
| Model | Key parts | Signature beat | ADS ms | Reload tac/empty s | Cam pitch/shot | Flash | Sound note |
|---|---|---|---|---|---|---|---|
| pistol (Kestrel 9) | as 4.1 | Slide lock, press-check | 180 | 1.55 / 2.05 | 1.1° | Suppressed puff | As 4.6 |
| revolver | Lathe cylinder (6 bores with visible rims), hammer, ejector rod | Cylinder rotates 60° per shot over 90 ms; reload swings the cylinder out, ejects 6 shells, uses a speedloader | 200 | 2.6 (no tactical) | 2.6° | Full star, big | Heavy LFE, -6 dB |
| smg | Extruded receiver, folding stock, stick mag, foregrip | Bolt cycles 16 mm at the fire rate; the pattern climbs 6 shots, then drifts right | 220 | 1.9 / 2.4 | 0.45° (patterned) | Small star, 1 in 3 tracer | Fast transient, shorter tail |
| rifle | Receiver, handguard with lathe vents, optic, curved mag | Charging handle on empty; a bayonet-style melee bash on V | 280 | 2.1 / 2.7 | 0.7° (patterned) | Medium star, 3-prong comp | Mid report, long tail |
| shotgun | Lathe barrel and tube, pump, receiver, shell carrier | Pump 70 mm over 380 ms after each shot; shells load one at a time (0.45 s each) and can be interrupted | 240 | 0.45 per shell | 4.5° | Large flash, 2-frame cone of 9 sparks | Boom plus pump clack layer |
| sniper | Long lathe barrel, bolt (lift 60°, back 90 mm), scope | Bolt cycle 700 ms between shots; scope glint seen from enemies | 320 (scope at 100%) | 2.8 / 3.4 | 6° | Muzzle-brake side jets | Crack plus long echo, 6 reflection rays |
| launcher | Tube, sight, grip pod, grenade with visible fins | Loading shows the round going in; back-blast smoke | 300 | 2.6 | 5° | Back-blast plus a front puff | Thump plus a whoosh |
| pin / sledge / blade / wire | Existing melee clips | Keep `SwingTrail`; add 40 ms hitstop on connect (exists), a material spark, and trauma +0.2 | — | — | — | — | — |

Each class milestone must pass the same checks: part nodes exist, fire and reload clips sample, shots taken.

---

### 5. Enemy design, reactions and deaths

#### 5.1 Enforcer v2 (`body.ts` `BodyLook` v2; the 11-segment skeleton stays)
Each segment gets layers instead of one primitive:
1. **Under-suit:** a tapered lathe per limb with a quilted normal pattern from the trim atlas band "padded nylon". Colour `#121318`, roughness 0.8.
2. **Hard plates** as separate meshes with HP:
   - chest (an extruded profile with a centre ridge)
   - back (with a cooling pack that pulses its emissive at 0.5 Hz; the weak point, ×2 damage)
   - 2 shoulder pauldrons (wide; they read as heavy from behind)
   - thigh plates and shin guards
   - Material: `#2b2e35`, metal 0.6, rough 0.4, with edge wear like the guns.
3. **Helmet:**
   - An extruded side profile with a brim and a full visor.
   - The visor is a separate mesh: emissive `#ffa040` (the existing faction amber), intensity 2.2, with a horizontal slit pattern from the atlas.
   - It is the crit target and reads as "the head is here" from 40 m.
   - A rear light strip of 2 cm makes the head readable from behind.
4. **Long coat:** 8 cloth strips hang from the pelvis to the knee. Each is a 4-particle Verlet chain hung from pelvis joints and collided against leg capsules. That adds 32 particles per enemy, simulated at 60 Hz with no substeps on phone. Colour `#1a1715`, rough 0.9. The coat is the cheapest way to stop the enemy looking like boxes.
5. **Faction decal:** a "HOLLOWELL" chevron on the left pauldron and a unit number on the back plate. The atlas holds the text.
6. **Gear:** a chest rig with 3 mag pouches, a radio antenna (with a blinking red 1 Hz tip), and a holstered sidearm (the disarm fallback).
7. **Weapon:** a gunkit rifle (LOD1 at > 8 m).

**Rim light.** Every enemy gets a back-facing fresnel term (`onBeforeCompile`, `pow(1-NdotV, 3) × 0.25`, coloured by the scene's nearest neon), so a dark enemy separates from a dark street. This fixes "can't tell him from the street at 10 m".

**Budget per enemy:**
- Desktop: ≤ 20k triangles and ≤ 24 draw calls (merge by material per segment).
- Phone: ≤ 8k triangles and ≤ 14 draw calls.
- At most 10 active enemies with full detail. Beyond 25 m, switch to LOD1: no coat simulation (static strips) and no gear.

**Variants:** by `role`. Shield troopers get a heavy helmet and a riot shield. Snipers get a hood with a scope glint. Orderlies and nurses keep their district looks but get the same layering.

#### 5.2 Armour that breaks
- Each plate has `hp = 30% of the zone's share`.
- A hit on a plate: sparks, a metal ping, the `soft` marker, and 40% damage passed through.
- At 50% plate HP: the plate's material swaps to a variant with a crack decal (a procedural line canvas) and normal strength ×1.6.
- At 0 HP: the plate detaches as a rigid body (a 4-particle Verlet box), gets spin and a 3 m/s impulse along the shot, and clatters. The under-suit is exposed and takes full damage.
- Visor: the first head hit cracks it (emissive flickers at 8 Hz for 300 ms, crack overlay). The second head hit shatters it into glass shards, shows the face (a simple masked face mesh with a dark balaclava), and drops emissive to 0.3.
- Weapon-arm hit with ≥ 35 damage in one hit: a **disarm**. The rifle drops as a physics object, and the enemy draws the sidearm (900 ms) or flees if morale is low.
- The rules live in `sim/armour.ts` (pure): `plateHit(plate, dmg, pierce) → {passed, state}`.

#### 5.3 Stagger, knockdown and the death blend
**Stagger** (pure, `sim/stagger.ts`):
- Triggered by accumulated damage ≥ 35% of max HP within 1.5 s, or any headshot that doesn't kill, or a shotgun hit at under 6 m.
- Lasts 550 ms (± 150 by direction). It cancels the current attack and the attack token (§6.4).
- During it, the enemy plays a stumble clip of 1 to 2 steps away from the shot, with the weapon arm dropped 40°.
- The next hit is a guaranteed crit (marker head colour, `Crit` on the feed), and a takedown is available (§9).

**Knockdown:**
- Triggered by explosives, a shotgun under 3 m, or a melee heavy hit.
- A ragdoll for 1.8 to 2.4 s, then a get-up blend: the Verlet pose is pulled to a kneel key over 600 ms, then to stand.

**Death: active ragdoll** (extends `Body.goLimp`):
1. Seed `prev = current - velocity·dt` from the animated pose. This already exists; verify that no pop happens.
2. Add the bullet impulse at the hit particle: pistol 3, rifle 4, shotgun 8, sniper 9 m/s. Neighbouring particles get 50% of it.
3. **Drive phase**, 300 to 900 ms by weapon (random):
   - Add `Body.drive(targetPose, k)`: each particle is pulled toward a "dying pose" target relative to the pelvis, with `k` fading from 0.6 to 0 along a smoothstep.
   - Pose families (picked by zone):
     - torso: knees buckle, then a forward fold
     - chest: a clutch, where the free hand's particle is pulled toward the hit point (IK target) with k 0.8
     - leg: that leg folds and the body spins toward it
     - near a wall (< 1.2 m): a reach, with the hand pulled to the wall point, then a slide down
4. Then fully limp. Ground friction 0.85. Sleep (freeze) when the maximum particle speed stays under 0.05 m/s for 0.5 s. Bodies should settle within 2 s.
5. **Headshot:** no drive phase. Instant limp, a 6 m/s backward head impulse, the helmet pops off (a rigid body, 40% chance), and a blood mist ×2.
6. The coat strips keep simulating through the death, which gives it weight.

**Dismemberment:** the existing `sever()` stays. Rules:
- A killing blow on a limb with damage ≥ 1.5× the limb threshold, or a shotgun under 4 m, or an explosive.
- The stump gets the gore cap (exists).
- Add a pulsing spurt emitter: 1.5 s, 2 Hz heartbeat rhythm, each pulse 8 particles, amplitude decaying.
- Cyber limbs (vault and clinic roles) spark plus leak coolant `#3fe0ff` instead of blood.
- `prefs.violence = "reduced"` turns off sever, spurts, pools and screen blood, and keeps the flinch, stagger and ragdoll.

**Blood that stays:**
- Wall splatter: on a flesh hit, raycast along the shot up to 3 m. On a hit, place a decal 0.3 to 0.8 m, random rotation, picked from 6 procedural splat stamps.
- Floor pool:
  - Placed under the pelvis once the body sleeps.
  - Grows from radius 0.2 to 1.0 m over 8 s (ease-out).
  - Material: `MeshPhysicalMaterial`, colour `#2a0303`, roughness 0.08, clearcoat 1 (desktop) or roughness 0.15 (phone), so neon reflects in it.
- Caps: decals 64 desktop / 32 phone, pools 12 / 6, FIFO.

#### 5.4 Telegraphs (pure timings in `tuning.ts`, used by `enemy.ts`)
- **Ranged burst:**
  - Raise the weapon over 300 ms.
  - The visor flares to intensity 4 over 200 ms.
  - A laser sight line (an additive 3 mm cylinder, `#ff3b1a`, alpha 0.5) sweeps from the ground to the player over 450 ms.
  - Plays a charge chirp at 1.2 kHz → 2 kHz with a 3D pan.
  - Hit chance ramps from 20% to 70% over 1.2 s of continuous line of sight. The first 2 rounds of each burst always miss within 0.6 m (warning shots that kick up visible impacts near Cath).
- **Melee lunge** (orderly): 500 ms crouch windup, red emissive flash, and the coat flares out.
- **Grenade:** a bark, a visible arc, a 2.8 s fuse, a red blinking 4 Hz light, and a HUD grenade indicator (§7.2).
- **Reload (enemy):** a 2.2 s clip that drops the mag visibly, with the "Reloading!" bark. This is a vulnerability window.

#### 5.5 Animation set (procedural; `game/animate.ts` grows to `animate/`)
- **Locomotion:** idle with breathing (chest scale ±1.5% at 0.3 Hz), walk, run, strafe (hips counter-rotate 20°), crouch-walk, and backpedal.
- **Combat:** aim (two-arm IK to the rifle grips), fire (the enemy's own recoil: 3° per shot), reload, throw, melee, plus peek left/right/over (a 0.4 m lateral or 0.35 m vertical root offset from a cover point, held 0.8 to 2 s).
- **Reactions** come from §3.3 and §5.3.
- **Surrender/panic:** hands up (both arms IK above the head), a 1 s turn, then flee.
- Each state is a small keyframe clip on joint targets plus IK, blended through a 150 ms crossfade of target poses. The existing gait ellipse stays as the walk generator.

---

### 6. Enemy behaviour that makes firefights readable

#### 6.1 Cover points
- Authored or auto-generated per level: for every `solid` collider ≥ 0.9 m tall, sample points 0.6 m off each face every 1.2 m. Store them in the level data, built once at load.
- Score each point:
  - `+protection` (a ray from the player's chest is blocked)
  - `-distance to the current position × 0.2`
  - `+ally spread` (≥ 3 m from allies)
  - `-flanked` (the player's angle is more than 70° off the cover normal)

#### 6.2 Squad manager (`game/squad.ts`)
- Each encounter gets one squad. It assigns roles every 1.5 s:
  - `suppress`: inaccurate sustained fire at 25% hit chance at the player's last known position
  - `advance`: move to the next cover point within 8 m that is closer to the player
  - `flank`: path to a point at more than 60° off the player's facing
  - `hold`
- At most 1 flanker.
- **Attack tokens:** at most 2 enemies may fire with full hit chance at once. Others suppress or move. A token has a 2.5 s cooldown after its burst.
- **Morale:**
  - Leader death (the first `rifle` spawned, given a red visor stripe): all members get -40 morale and bark "Man down!".
  - Morale under 30: fall back to cover farther away. Under 10, with Cath under 6 m: surrender.
- Repositioning when flanked: when the player's angle is more than 70° off their cover normal, the enemy barks "She's flanking!" and moves within 600 ms.

#### 6.3 Blind fire and suppression
- Blind fire: from cover, the weapon only is raised over the top, with 10% hit chance. The hitboxes of the arm and weapon are exposed, which rewards precise shots.
- An enemy who takes a near miss (§2.1) ducks for 700 ms. Suppression is how shooting at cover pays off.

#### 6.4 Barks (voice lines through `voice.ts`)
- Barks are synthesised radio-filtered speech-like bursts: band-passed formant noise from 300 Hz to 3 kHz, plus a radio squelch at the start and end.
- Each bark also shows a subtitle line, `ENFORCER: "Reloading!"`, in the existing `subtitle()` style.
- Required barks:
  - Reloading!
  - Man down!
  - She's flanking!
  - Grenade out!
  - Suppressed! / Taking fire!
  - Where'd she go?
  - Fall back!
  - I give up!
- Rate limits: at most 1 bark per enemy per 4 s, and at most 1 per squad per 1.2 s.

#### 6.5 Tests (`tests/cathode-squad.test.ts`, pure)
- Token cap: with 5 enemies, never more than 2 hold tokens across a 60 s run.
- Leader death sets morale and emits a bark.
- Cover scoring prefers a blocked point.
- The hit-chance ramp reaches 70% at 1.2 s, and the warning shots miss.

---

### 7. Player hit, wounded and dying

#### 7.1 Health model (`sim/health.ts`, pure)
- **Guard** (a regenerating layer) is 30% of max HP.
  - Regen starts 4.0 s after the last damage and fills in 2.0 s.
  - Damage hits Guard first.
- **HP** does not regenerate. It is restored by stims, takedowns (+15%) and the Second Wind (§7.4).
- HUD: the Guard bar is cyan and sits above the HP bar.
  - When Guard breaks: the bar shatters (6 shards, 300 ms), plays a glass-crack sound, and trauma +0.2.
  - When regen starts: a sharp inhale and a rising sweep of 1.8 s (sine 300 → 900 Hz plus shimmer). The vignette recedes visibly.

#### 7.2 Per-hit response
- **Directional arc:**
  - On a ring at radius 20% of viewport height. The arc is 40° wide, 8u thick, red `#ff2a1a`, with opacity `0.5 + 0.5 × clamp(dmg/20)`.
  - Holds 600 ms and fades over 600 ms. It tracks the attacker live, from bearing every frame while visible. Up to 4 arcs at once.
  - Attackers behind the player get a chevron at the bottom edge.
  - This replaces the 140x36 px arc.
- **Grenade indicator:** a grenade glyph plus an arrow on the same ring. It pulses 4 Hz while within 6 m of the grenade.
- **Camera flinch:** pitch and yaw 2 to 4° away from the attack direction (scaled by damage), through a spring at 9 Hz, ζ 0.5, recovering in about 200 ms. Trauma +0.08 per 10 damage.
- **Viewmodel jolt:** a position shove of 1.5 cm toward the opposite side.
- **Flash:** a full-screen red at 0.35 opacity fading over 150 ms. This is post-process uniform `uHurtFlash`, not DOM, so it sits under the HUD.
- **Lens blood** (gore on): procedural splats come in from the edge facing the attacker. 1 to 3 splats per hit when damage ≥ 8. They drip down 4% of the screen over 1.2 s and fade over 2.5 s.
- **Sound:** `Audio.hurt()`. Cath's breath grunt is formant noise (F1 600, F2 1100) for 180 ms, plus a body impact thump low-passed at 300 Hz. It must be distinct from `hitFlesh`. Plus a 60 ms whoosh of high-pass noise from the attack direction.

#### 7.3 Wounded state (one grade-pass extension in `render/post.ts`)
New uniforms on the Grade pass, driven by `w = clamp(1 - hp / (0.35·maxHp), 0, 1)`:
- **Vignette:** red `#5a0505` edges, inner radius from 0.75 to 0.45 as `w` rises, pulsing at the heart rate.
- **Desaturation:** up to 70% at `w = 1`, with a 15%-radius centre held at 50% of that.
- **Chromatic aberration:** edge CA from 1 px up to 3 px × render scale.
- **Radial blur:** 4 taps, strength 0.006·w.
- **Roll wobble:** ±1° at 0.3 Hz, scaled by `w` and off under `reducedMotion`.

Audio while wounded:
- A heartbeat whose rate rises from 60 to 110 bpm with `w`. It is a two-thump sine at 55 and 45 Hz, 80 ms each, 180 ms apart.
- The world mix is low-passed from 18 kHz down to 1.5 kHz at `w = 1`.
- Breathing loops at 0.4 Hz.
- An explosion within 5 m adds tinnitus: a 4.8 kHz sine at -20 dB fading over 4 s, and the world muffled for 2 s.

#### 7.4 Second Wind (once per checkpoint)
- Triggered by lethal damage while Second Wind is available (default on; a skill can extend it):
  - Time scale drops to 0.3 for 2.5 s of real time.
  - The screen goes greyscale. Enemies get a red silhouette outline (an inverted-hull mesh, scaled 1.03, `#ff2a1a`, depthTest on).
  - A heartbeat at 40 bpm, very loud.
- A kill during the window restores 30% HP, plays a big inhale, and the colour floods back over 300 ms.
- Otherwise the player goes down (7.5).

#### 7.5 Death sequence (replaces the banner plus `location.reload()`)
| t (ms) | Event |
|---|---|
| 0 | Hit-stop 120 ms. The killer's ID is stored. The input lock starts. |
| 120 to 700 | The camera detaches from the player. A spring arc drops the eye from 1.62 m to 0.25 m, rolls 70°, and yaws toward the killer. The viewmodel drops away: the gun falls out of frame with a physics spin. Time scale 0.2. |
| 120 to 1500 | Colour drains except reds. CA ramps to 4 px. The heartbeat slows (110 → 40 → stops at 1300). High frequencies roll off to 600 Hz. A long tinnitus tone. Lens blood: 4 splats. |
| 1500 to 2600 | The killer framing: letterbox bars (2.39:1) slide in over 300 ms. The camera holds on the killer, who lowers his weapon (an AI "stand down" clip). His name appears in mono in a corner, lingering and doubling (Max Payne type) via a CSS class animation. |
| 1800 | Red ink spreads in from the edges: a post uniform `uInk`, with noise-thresholded edges growing to 40% coverage. |
| 2600 | The death card fades in over 300 ms (DOM). |

**The death card:**
- A heading in Bodoni italic, at 64u: one of 8 Cath epitaphs, chosen at random ("Not tonight. Not him."). The word "FLATLINED" sits above it in Rajdhani caps, 18u, letter-spaced 0.3em.
- A mono line at 14u: `Cause: Enforcer rifle · 31 m · Damage taken 142 · Time 2:41`.
- Two buttons: **Retry** (Enter, A or a tap) and **Quit to title**.
- After at least 600 ms of the card, any fire input also retries.

**Retry without a page reload:**
- `Session.restartFromCheckpoint()` disposes the enemies, pickups and FX. It restores the checkpoint snapshot (`sim/save.ts` already saves checkpoints) and re-runs the job stage.
- Respawn: a 400 ms fade from black, plus a 250 ms "re-sync" chromatic glitch (post uniform `uGlitch`: horizontal slice offsets with RGB split).
- **Target:** under 1.5 s from pressing Retry to control at the checkpoint.

---

### 8. Pickups, objectives and HUD scale

#### 8.1 First weapon (Kestrel 9) placement and beacon
**Placement:**
- Move the case out from behind the car, to a crate or market stall top in the street-facing sightline.
- Rule: from the takedown spot, the case must be within ±15° of the default facing, at ≤ 10 m, unoccluded. A unit test checks this with a ray from the takedown pose to the case centre, and the ray must not be blocked.

**Display:**
- The case is open, on a stand. The lid is propped at 100°.
- The **actual Kestrel 9 gunkit mesh** (LOD0) lies in a cut-foam insert. A closed box doesn't read as a gun.

**Beacon layers:**
1. **Beam:**
   - An additive cylinder, 3.5 m tall, radius 0.12 m with a soft-edged shader (`pow(1 - |uv.x - 0.5|·2, 2)`).
   - Colour: rarity colour (the first weapon uses amber `#e8b04a`). Intensity in HDR 2.5, so it blooms.
   - `fog: false`. Fades with distance from 60 m to 5 m, and to 0 within 1.5 m of the player.
2. **Glint:**
   - A 4-point star sprite, 18 cm across, that sweeps over the gun every 2.5 s with a 350 ms flash. Additive HDR 4.
   - The size is world-space, with a floor of 14u on screen, so it stays visible on 5K at 20 m.
3. **Rim pulse:** a fresnel emissive on the gun mesh at 1 Hz, from 0 to 0.8, in rarity colour.
4. **Floor ring:** an additive decal ring 0.9 m across, under the stand, pulsing in sync with the rim.
5. **World prompt** (within 3 m; on phone, a tap target):
   - A DOM chip projected from the gun position: `[E]  TAKE  ·  Kestrel 9`, plus a 2-line stat strip (DMG, RATE, MAG).
   - Keycap 22u. Hidden when the gun is occluded.
6. **Off-screen arrow:** shown for scripted key items until picked up. A 22u chevron clamped to an ellipse at 42%/40% of the viewport, with the distance in mono at 13u.
7. **Nudge:**
   - The first time the gun is on screen within 12 m, Cath says a line ("There. On the stall.") with a subtitle.
   - A one-time camera look-assist adds at most 10° of yaw toward the gun over 600 ms, but only if the mouse is idle. Never forced.

**The pickup moment:**
- **Pickup is a press**, not walk-in, for weapons. Ammo and cash stay walk-in.
- Within 200 ms the case closes. The 900 ms hero draw (4.4) plays with a slide rack.
- An amber toast "NEW WEAPON · Kestrel 9" slides in, plus an amber sting chord (a minor seventh, 1.2 s).

**Loot drops:** every gun and rarity drop gets layers 1 to 4, scaled: beam 1.6 m, no glint for common rarity, no nudge. The dropped item is the real LOD0 gun, not an octahedron.

#### 8.2 Objective marker
- A diamond 18u with a 2u stroke (cyan `#3fe0ff`), plus the distance in mono at 14u underneath.
- Clamped to the screen edge with an arrow when the objective is off screen.
- Shrinks to 60% and fades to 40% when the player is within 5 m or in ADS.
- A 1 Hz soft pulse for the first 6 s after an objective update.

#### 8.3 HUD scaling (all HUD and front-end CSS)
- `:root { --u: clamp(0.8px, calc(100svh / 1080), 2.4px); }` is defined in `styles/hud.css`.
- Every HUD dimension is `calc(var(--u) * N)`. A lint rule in the existing style lint fails on raw `px` in `games/cathode/src/styles/hud.css`, except 1px hairlines.
- **Minimum physical sizes:** text ≥ 12 CSS px on phone, crosshair arms ≥ 2 CSS px thick.
- **Safe area:** 4% inset on desktop, `env(safe-area-inset-*)` plus 12 px on iPhone.
- **Ultrawide:** beyond 16:9, the critical HUD (ammo, health, crosshair group) sits in a centred 16:9 box.
- **Renderer:** at 5K, keep the DPR cap at 2 with dynamic render scale (`autoscale.ts` exists). The DOM HUD always renders at native resolution, and SVG icons stay crisp at every DPR.
- **Sizes to verify at 2560x1440@2** (from `getBoundingClientRect` × DPR):
  | Element | Physical px |
  |---|---|
  | Waypoint diamond | ≥ 48 |
  | Hit marker tick | ≥ 26 × 6 |
  | Prompt keycap | ≥ 58 |
  | Ammo numerals | ≥ 150 |

---

### 9. Takedowns and the kill-cam

#### Takedown (replaces the instant `combat.takedown`)
**Eligibility:**
- An unaware enemy from behind, any enemy in stagger, or an enemy under 20% HP.
- Range 2.0 m. A magnet pulls Cath to a 0.9 m pairing distance over 120 ms.
- The prompt is `[F] TAKEDOWN`. The enemy visor and emissives pulse at 3 Hz to show eligibility.

**Timeline (1.25 s base):**
| t (ms) | Event |
|---|---|
| 0 to 120 | The camera blends from first person to an authored framing: 0.35 m back, 0.15 m right, FOV +12°. Input is locked. World time scale 0.4. Letterbox at 30%. |
| 120 to 480 | Cath's left arm (viewmodel IK) grabs the collar or helmet. The enemy is posed by the paired clip (`feel/clip.ts` on the Body joint targets, ragdoll off). |
| 480 | Impact: the Pin strike to the neck, or a pistol-whip when the pistol is equipped. Hit-stop 80 ms, trauma +0.35, a hard punch sound plus sub, and blood ×2 (gore). |
| 480 to 950 | The finish varies: a baton second strike, a choke-down, or a suppressed shot under the chin (pistol variants). Ragdoll release with the drive phase "slump" (k 0.7 → 0 over 700 ms), lowered gently in stealth takedowns. |
| 950 to 1250 | The camera returns to first person. Time scale ramps back to 1 over 200 ms. |

- **Variety:** at least 3 variants each for front, back and side, picked by approach angle and weapon. No repeat within the last 2.
- **Rewards:** 15% HP and the target's ammo. Orbs magnetise to Cath over 400 ms. An XP chip appears.
- **Stealth takedowns** are quiet: no shot sound, and noise radius 2 m.

#### Kill-cam (existing `killcam.ts`)
- **Triggers:** the last enemy of an encounter (any weapon), or a ballistic headshot at ≥ 30 m.
- Cooldown 20 s. Skippable after 300 ms with any input. Off under `prefs.killcam = false`.
- **Hitscan last-enemy variant** (new): no bullet follow.
  - 0.15× slow motion for 0.5 s.
  - A cut to an orbit around the body at 0.3× for 0.8 s.
  - A 250 ms ramp back to normal, with a whip-pan transition.
  - Audio is pitched down 1 octave and low-passed at 800 Hz, with a heartbeat.
- **Remove the steering cheat for ballistic rounds:** play the kill-cam only when `predict()` already says the round hits.

---

### 10. Performance budgets (combat at its busiest: 6 enemies firing, 20 s of a firefight)

| Item | Phone | Desktop high/ultra |
|---|---|---|
| Frame time, combat systems (CPU) | ≤ 2.0 ms | ≤ 3.0 ms |
| Draw calls, total scene | ≤ 260 | ≤ 600 |
| Viewmodel | ≤ 10 calls, 14k tris | ≤ 14 calls, 30k tris |
| Enemy (full detail) | ≤ 14 calls, 8k tris, ≤ 6 full detail | ≤ 24 calls, 20k tris, ≤ 10 full detail |
| Particles alive | ≤ 1,500 (2 instanced layers) | ≤ 4,000 |
| Decals / pools | 32 / 6 | 64 / 12 |
| Shells / mags | 24 / 4 | 40 / 6 |
| Live audio voices | 20 | 32 |
| Point lights in combat | 1 shared muzzle light + 1 impact | 1 + 2 |
| Combat textures in GPU memory | ≤ 24 MB | ≤ 64 MB |
| Per-shot JS allocations | 0 (pools for particles, decals, events, Vector3) | 0 |
| Gun or Enforcer build at load | ≤ 40 ms each, built off the critical path (idle callback) | ≤ 25 ms |

**Measuring.**
- `window.cathode.stats` gains `drawCalls`, `tris`, `combatMs`, `particles`, `voices`.
- `scripts/cathode-perf.mjs` runs the scripted firefight stage (§11.3) and asserts the counts. Draw calls and triangles are deterministic under SwiftShader. Time cannot be trusted there, so `combatMs` is checked only as a regression ratio against the baseline in the same run.

---

### 11. Testing

#### 11.1 Unit tests (vitest, pure, no WebGL)
| File | Covers |
|---|---|
| `tests/cathode-feel.test.ts` | Springs (settle times for the recoil and flinch configs), trauma decay, the hit-stop clamp and auto-fire cap, slow-motion ramps, clip sampling and event times (slide back ≤ 30 ms, home by 62 ms, shell at 18 ms) |
| `tests/cathode-cover.test.ts` | §2.3 |
| `tests/cathode-hitclass.test.ts` | Marker class from `{zone, kill, plate, pen}`; marker never shown on `Blocked`; target bar cleared on kill |
| `tests/cathode-reload.test.ts` | Ammo committed at 60%, cancel before or after the commit, slide-lock state on the last round, dry fire on empty |
| `tests/cathode-armour.test.ts` | Plate HP states, pass-through %, visor crack then shatter, disarm threshold |
| `tests/cathode-stagger.test.ts` | Accumulation window, headshot stagger, attack cancel, guaranteed crit |
| `tests/cathode-squad.test.ts` | §6.5 |
| `tests/cathode-health.test.ts` | Guard regen delay and rate, Second Wind once per checkpoint, death timeline states, restart restores the checkpoint without a reload |
| `tests/cathode-pickup-beacon.test.ts` | Beam fade function, first-weapon sightline from the takedown pose, prompt range, weapon pickup needs a press |
| `tests/cathode-hudscale.test.ts` | The `--u` function for 390, 900, 1440 and 2880 heights; minimum sizes |
| `tests/cathode-gunkit.test.ts` | Builds every `GunModel` in node with three.js (no renderer). Required part names exist; triangle and draw-group counts are within budget; `gripR` and `gripL` exist |
| `tests/cathode-body-v2.test.ts` | Enforcer build tris and draw calls within budget; plates detach; drive phase fades to 0 by 900 ms; the body sleeps within 2.5 s on flat ground |

#### 11.2 Deterministic stage hooks (for screenshots)
- `?play&shot&stage=<name>` sets up a scene and freezes time at an exact feel time. `window.cathode.stage(name, tMs)` does the same at runtime.
- Add `&rs=0.5` to force a render scale, so 5K captures finish in SwiftShader. The DOM still renders at full DPR.
- Stages:
  - `pistol-idle`, `pistol-fire-0`, `pistol-fire-20`, `pistol-fire-45`, `pistol-lock`, `pistol-reload-400`, `pistol-reload-930`, `pistol-ads`
  - `hit-body`, `hit-head`, `hit-kill`, `hit-soft`, `blocked`
  - `enemy-front-10m`, `enemy-back-10m`, `enemy-flinch-head-60`, `enemy-stagger-200`, `enemy-death-300`, `enemy-death-1500`, `enemy-plate-broken`, `enemy-telegraph-300`
  - `blood-pool-8s`
  - `player-hurt-100`, `player-lowhp`, `player-secondwind`, `player-death-600`, `player-death-2000`, `death-card`
  - `pickup-first-from-takedown`, `pickup-prompt`, `objective-offscreen`
  - `takedown-480`, `killcam-orbit`
  - one per weapon class: `<model>-fire-20`, `<model>-reload-mid`

#### 11.3 Screenshot runs
- `scripts/cathode-feel-shots.mjs` (it generalises `cathode-hit-shots.mjs`) shoots every stage at:
  - **2560x1440 at DPR 2** (`rs=0.5`)
  - **1440x900 at DPR 1**
  - **844x390 at DPR 3** (`rs=0.5`, `quality=phone`)
- It writes `e2e/screenshots/c-<stage>-<vp>.png`. It also writes a JSON sidecar of DOM measurements (element rects × DPR) and stats (draw calls, tris).
- Per CLAUDE.md, kill any stale `:4173`/`:4180` preview before shooting.
- **Automatic checks inside the script** (fail the run):
  - DOM sizes from §8.3
  - The marker exists on hit stages and is absent on `blocked`
  - The death card is visible on `death-card`
  - Pickup prompt visible
  - On `pickup-first-from-takedown`, the beam's projected screen x is within 30% of the centre
  - The draw-call and triangle budgets from §10
- **Pixel probes** (cheap, robust):
  - On `pistol-fire-0`: mean luminance of the muzzle region is higher than on `pistol-idle`.
  - On `hit-body`: the count of red-dominant pixels within 0.2 m of the projected hit point is ≥ N.
  - On `player-lowhp`: edge-pixel saturation is lower than the centre.
- **Visual review:** after each milestone, a subagent critiques the before and after frames at all 3 sizes against this spec and `VISION.md`. Findings that a player would notice go into the next slice.

#### 11.4 e2e
Extend the existing Playwright flow in `?2d`-free WebGL with long waits (about 3 fps), driven by `window.cathode.input.forced`:
- Take the first weapon (press E). Shoot a guard (assert one `Hit` event plus marker class). Shoot a crate in front of a guard (assert `Blocked`, no marker).
- Die (`window.cathode.player.damage(9999)`) and press Retry. Assert the session restarted with no navigation (`performance.navigation` count unchanged, `page.on('framenavigated')` not fired).

---

### 12. Milestones (in order; each one ships alone, gets released when the gates pass, and gets a ROADMAP tick)

Estimates are in hourly sessions. Every milestone ends with `npm run check`, the feel-shots run at all 3 sizes, the subagent critique, and `npm run release`.

#### M1 (C1, finish): "Every shot tells you what it hit" (3 to 4 sessions)
**Scope:**
- The §1 shared modules: spring, trauma, clock, events.
- §2: cover tags on all 5 districts, OBBs, materials, penetration, the reworked blocked feedback, near miss.
- §3 complete: final marker classes, dry bus plus body thump, per-zone flinch, entry-facing blood plus a lit mist, the segment flash, kill hit-stop, FOV punch and the last-enemy slow motion.
- The target-bar fix.

**Accept:**
- `cathode-cover`, `cathode-feel` and `cathode-hitclass` tests pass. The audit test prints 100% collider coverage.
- Shots `hit-*` and `blocked` at 3 sizes. The marker tick is ≥ 26x6 physical px at 5K.
- On `hit-body` at 10 m, blood is visible: the red-pixel probe passes.
- The marker is absent on `blocked`.
- The e2e crate-block case passes.

#### M2 (C7): "You can't miss the first gun" (2 sessions)
**Scope:**
- §8: placement move, open display case with the real gun, beam, glint, rim, ring, world prompt, press-to-take, off-screen arrow, Cath's nudge line, the hero draw and toast.
- Loot drops with real gun meshes and beacons.
- The objective marker rework.
- `--u` scaling for all HUD CSS, plus the lint rule.

**Accept:**
- The `pickup-beacon` and `hudscale` tests pass.
- On `pickup-first-from-takedown` at 2560x1440@2, the beam is on screen within 30% of the centre.
- The prompt keycap is ≥ 58 physical px and the waypoint diamond ≥ 48.
- At 844x390, nothing overlaps (the existing HUD overlap check).

#### M3 (C2a): "Kestrel 9, AAA grade" (4 to 5 sessions)
**Scope:**
- §4.1: gunkit, trim atlas, materials, viewmodel environment and lights, IK gloved hands.
- §4.2 to §4.4: animation stack, fire choreography, slide lock, dry fire, tactical and empty reloads with physical mags, draw, inspect.
- §4.5: the suppressed puff and smoke.
- §4.6: the pre-rendered layered shot plus live reflections, ducking, compressor.

**Accept:**
- The `gunkit` test passes: all pistol parts present, ≤ 30k tris and ≤ 14 calls desktop, ≤ 14k tris and ≤ 10 calls phone.
- The `reload` and `feel` clip timings pass.
- Shots `pistol-fire-0/20/45`: the slide is visibly back at 20.
- On `pistol-lock`: the slide stop is up and the chamber is empty.
- On `pistol-reload-930`: the mag is seated.
- Hands make up ≥ 25% of the viewmodel pixels on `pistol-idle` (a mask render in the script).
- Subagent critique: the pistol "does not read as a blockout".

#### M4 (C5): "Getting hurt, nearly dying and dying" (3 to 4 sessions)
**Scope:** all of §7: Guard and HP, the arcs and grenade glyph, camera flinch, flash, lens blood, `Audio.hurt`, the wounded grade pass and audio, regen telegraph, Second Wind, the death timeline, death card, and `restartFromCheckpoint` (no `location.reload`).

**Accept:**
- The `health` test passes.
- Shots `player-hurt-100`, `player-lowhp`, `player-secondwind`, `player-death-600/2000` and `death-card` at 3 sizes. The `lowhp` edge-saturation probe passes.
- The e2e retry passes with no navigation, and control returns within 1.5 s of Retry (measured from `window.cathode.stats.lastRestartMs`).
- `reducedMotion` turns off the roll wobble.
- `violence=reduced` has no lens blood.

#### M5 (C4): "Enemies that react, break and die properly" (4 sessions)
**Scope:**
- §5.2 (plates, visor, disarm) on the current body model, with plates as separate meshes ready for M6.
- §5.3: stagger, knockdown with get-up, the drive-phase active ragdoll with 4 pose families plus the headshot variant, the dismemberment spurt and coolant, wall splatter, growing reflective pools.

**Accept:**
- The `armour`, `stagger` and `body-v2` (drive and sleep) tests pass.
- Shots `enemy-flinch-head-60`, `enemy-stagger-200`, `enemy-death-300/1500`, `enemy-plate-broken` and `blood-pool-8s`. A subagent compares 4 deaths and confirms they differ.
- Decal caps are respected in a 200-shot soak test.

#### M6 (C3a): "Enforcer v2" (4 sessions)
**Scope:** §5.1 (layered suit, plates, helmet and visor with the rear strip, the coat Verlet strips, faction decals, gear, the gunkit rifle, rim term, LODs, role variants) and the §5.4 telegraphs (raise, visor flare, laser sweep, chirp, warning shots, reload clip).

**Accept:**
- `body-v2` budgets: 20k tris and 24 calls desktop, 8k and 14 phone.
- The `enemy-front-10m` and `enemy-back-10m` shots: the head and the class read in a silhouette-only render (the script renders a flat-black mask and the subagent judges it).
- On `enemy-back-10m`: mean luminance over the enemy's mask is at least 1.3× the surrounding street (the rim term).
- On `enemy-telegraph-300`: the laser is visible.

#### M7 (C3b): "Firefights with intent" (3 sessions)
**Scope:** §6: cover points, squad roles, attack tokens, morale and leader, suppression and ducking, blind fire, flanking and repositioning, barks with subtitles, the §5.5 peek and surrender clips.

**Accept:**
- The `squad` test passes.
- A scripted 60 s firefight soak (`scripts/cathode-perf.mjs`) logs at least 1 flank, 1 "Reloading!", at most 2 concurrent tokens, and no enemy stuck for more than 5 s.
- The perf budgets from §10 hold.

#### M8 (C2b): "Every gun is a hero" (5 to 6 sessions, one class per slice, released at the end)
**Scope:** the §4.7 table for revolver, SMG, rifle, shotgun, sniper and launcher, plus the melee polish. Muzzle flash and the shared light for unsuppressed classes; tracers; per-class sound variants and the whiz-by.

**Accept:**
- For each class: the `gunkit` part list and budgets pass; shots `<model>-fire-20` and `<model>-reload-mid` at 3 sizes; clip events tested.
- A subagent reviews the 7-gun line-up on one sheet, and the guns read as one family.

#### M9 (C6): "Takedowns and the last kill" (3 sessions)
**Scope:**
- §9: the paired takedown timeline, 9 variants (3 directions × 3), magnet, stagger eligibility and rewards.
- The last-enemy hitscan kill-cam variant.
- Removal of the ballistic steering cheat.

**Accept:**
- A test checks variant selection by angle and weapon, with no repeat of the last 2.
- Shots `takedown-480` and `killcam-orbit`.
- The takedown e2e: input locks and restores, and the enemy ends as a sleeping ragdoll.
- `prefs.killcam = false` is respected.

#### M10 (C8): "A front door that looks like a AAA game" and the new name (4 sessions)
**Scope:**
- A live title scene: the Drowned Market at night via `createWorld`. A 35 s camera dolly loop at render scale 0.6. Cath (the 3D `shared/cath/` figure, not the chibi SVG) under an awning. Rain on the lens, letterbox.
- A left-aligned 4-item menu: Continue, New Case, Settings, Credits.
  - Focus state: a 2 px red rule slides in, the label tracks out 2%, and a synthesised tick plays.
  - Keyboard, gamepad and mouse share one focus.
- "Start" is a camera push into first person, which hides any remaining load.
- The loading screen is a case file: a halftone duotone portrait, a lore paragraph, the district in caps, and an ink-bleed progress rule. "Press any key" when ready. A cyan motif for travel, red for retry.
- The pause screen gets a post-blur freeze frame.
- All front-end layouts in `--u`.

**Name.** The owner never answers, so the session decides and logs it in `DECISIONS.md`:
- Adopt **MOTHER'S RUIN**: no game clash was found, and it fits Cath's class and menace. Tagline: "Hollowell, 2079."
- Replace every user-facing "CATHODE" (gate, title, `<title>`, aria labels, landing card).
- Move the URL to `/mothers-ruin/`. Keep `/cathode/` as a redirect in `vercel.json` so existing saves and links work, and keep `games/cathode/` as the code path.
- Rename the docs in a later notes commit.

**Accept:**
- Shots of the gate, title, class pick, loading and pause at 3 sizes. At 2560x1440@2, no front-end screen has more than 35% empty width.
- At 60 s on the title, the dolly has moved and its frame differs from 30 s.
- The subagent critique against the §8 front-door list (live scene, few items in fixed positions, sound on every focus change, lore on loading screens).
- The `e2e:site` landing card shows the new name. `/cathode/` redirects.

---

### 13. Decisions this spec already makes (log them in DECISIONS.md when building)
1. Hit marker size depends on the hit class, never on damage. Damage numbers are off by default.
2. The marker never shows for a blocked shot. Blocked rounds get their own glyph and sound.
3. Gunshots are pre-rendered from layered synthesis via `OfflineAudioContext` (8 variants per class). Reflections stay live.
4. No CSG, no KTX2 and no Draco: extrude profiles plus canvas trim atlases. That keeps the build WASM-free and the load fast.
5. Weapon pickups need a press. Ammo and cash stay walk-in.
6. Death never reloads the page.
7. Reduced violence keeps the reactions and ragdolls, and drops the gore, lens blood, sever and pools.
8. The name is MOTHER'S RUIN, with a `/cathode/` redirect, unless the owner writes otherwise in `FEEDBACK.md`.
## E. Enemies spec
## CATHODE combat spec: enemy design and violence

Build target is `origin/build` @ `18585ee`. The code I refer to is in `games/cathode/src/`: `game/body.ts` (16 joints, 11 segments, Verlet ragdoll, `rayCapsule`), `game/animate.ts`, `game/enemy.ts` (the `Awareness` FSM), `game/combat.ts` (`hitscan`, `takedown`), `game/killcam.ts`, `render/fx.ts` (an instanced decal atlas capped at 160 decals on phone and 480 on desktop, plus casings), `sim/damage.ts` (`ZONE_MULTIPLIER`, `resolveHit`, sever shares) and `sim/enemies.ts` (`ARCHETYPES`, elite mods). The engine is three.js 0.170 on WebGL2, under a strict CSP. All assets are procedural or CC0.

This spec covers what happens to enemies: how they look, move, fight, take hits, break, bleed, die and get finished. Two neighbouring specs own Cath's own hurt, wounded and death screens and the viewmodel. This one defines only the shared buses they plug into (section 12).

---

### 0. Principles and global budgets

1. **One hit, five readouts, same frame.** Every hit on flesh or armour produces:
   - a crosshair marker,
   - a dry hit sound,
   - a visible reaction on the hit segment,
   - an effect anchored to the bone,
   - a lasting mark (a wound or a decal).

   A shot stopped by cover produces none of the first three.
2. **No silent damage.** Every hit plays a reaction, on every enemy, elites and bosses included. Heavy enemies scale the reaction down; nobody skips it.
3. **Overstate it.** If an effect matters to play (a stagger window, a broken plate, a reload), make it twice as readable as feels natural, at 10 m, in rain, in the noir grade.
4. **Rules stay pure.** Damage, armour, stagger, sever and takedown eligibility go in `src/sim/` and are unit-tested. Rendering only reads `HitEvent`s.
5. **Reduced-violence mode** (the existing gate choice):
   - Off: severing, stump spurts, x-ray, lens blood and pools above 0.5 m.
   - Kept: blood mist (desaturated to a dark ink tone), hit reactions, ragdolls, armour breaking, hit-stop and kill cams.

#### Performance budgets (per frame, with combat active)

| Item | iPhone 17 Pro Max (`quality: "phone"`) | Desktop, incl. 5K (pixel ratio capped at 1.5 with dynamic res 0.6 to 1.0) |
|---|---|---|
| Live enemies drawn | 6 at LOD0/1 | 12 at LOD0 |
| Draw calls per enemy (merged by material) | LOD0 ≤ 7, LOD1 ≤ 4, LOD2 ≤ 2 | LOD0 ≤ 9 |
| Triangles per enemy | LOD0 6k, LOD1 2.5k, LOD2 600 | LOD0 14k, LOD1 5k, LOD2 1.2k |
| Ragdolls simulating (not asleep) | 4 | 10 |
| Blood particles alive (instanced) | 400 | 1,500 |
| Decals (existing atlas `InstancedMesh`) | 160 FIFO, of which blood ≤ 64 | 480, of which blood ≤ 160 |
| Growing pools | 4 | 12 |
| Detached plates and limbs as rigid bodies | 6 | 16 |
| Dynamic point lights from combat | 1 shared muzzle light plus 1 shared impact light | 2 plus 2 |
| CPU for animation, reactions and ragdolls | ≤ 1.2 ms | ≤ 1.5 ms |
| Texture memory for the enemy kit | ≤ 24 MB (1k sets, KTX2 not allowed, so PNG/WebP) | ≤ 48 MB (2k sets) |

LOD distances: LOD0 below 12 m, LOD1 from 12 to 30 m, LOD2 beyond 30 m. Add 30% on desktop. Shadows come from LOD1 meshes only. The reflection pass (`render/reflection.ts`) uses LOD2.

---

### 1. The hit pipeline (rules first)

#### 1.1 One ray, nearest wins
`combat.hitscan` already casts against the world first and caps `maxD`. Keep that. What's broken is the content:

1. **Collider audit.**
   - Every mesh in `render/level.ts` and `render/levels/*` that is waist-high or taller, and thicker than 4 cm, gets a collider. That covers glass, shutters, rails, AC units, sign boxes, awnings below 3 m and car bodies.
   - Thin decorative meshes that the player reads as solid get `collide: "shot"`: they block bullets but not movement.
   - Add `colliderMaterial: "concrete" | "metal" | "glass" | "wood" | "drywall" | "flesh-none"` to every collider.
2. **Oriented colliders.** Rotated props get an OBB, not the axis-aligned bounds of the rotated mesh. Ray-vs-OBB is a transform into box space plus the existing slab test.
3. **Penetration** (`sim/penetration.ts`, pure):
   - `glass` and `drywall`: the round goes through at 60% damage and 85% velocity.
   - `wood`: 40% damage.
   - `metal` sheet under 3 cm: passes only with weapon stat `pierce ≥ 1`, at 35% damage.
   - `concrete`: always blocks.
   - At most 1 penetration per round, or 2 with the sniper.
   - A penetrating hit uses a **hollow** hit marker.
4. **Peek-only hitboxes.** No extra work: segment capsules already sit where the visible geometry is. Add a test that a head showing over a 1.1 m crate is hittable and the chest behind it isn't.

#### 1.2 `HitEvent` (new, `sim/hitevent.ts`)
```ts
interface HitEvent {
  t: number; targetUid: string; seg: SegmentName; zone: Zone;
  point: Vec3; normal: Vec3; dir: Vec3; distance: number;
  weaponCls: WeaponClass; damage: number; crit: boolean;
  layer: "plate" | "visor" | "flesh" | "cyber" | "shield" | "weakpoint";
  plateId?: string; plateBroke?: boolean; visorStage?: 0 | 1 | 2;
  penetrated: boolean; lethal: boolean; severed?: SegmentName[];
  reaction: "flinch" | "stagger" | "knockdown" | "none";
  staggerDir?: "front" | "back" | "left" | "right";
}
```
- `resolveHit` in `sim/damage.ts` returns this, and `applyHit` mutates the enemy.
- Every visual, audio and HUD consumer subscribes to a `CombatBus` (`game/combatbus.ts`) and only reads events. That is how the screenshot harness can replay scripted hits on a frozen frame.

#### 1.3 Location damage (in `ZONE_MULTIPLIER`, revised)

| Zone | Multiplier | Notes |
|---|---|---|
| head (visor intact) | 2.0 | the visor takes the first hit and cracks (3.3) |
| head (visor broken, face exposed) | 2.5 | the sniper's 4.0 is kept |
| torso, flesh | 1.0 | |
| torso, plate up | 0.35 to the body, the rest to the plate | 3.2 |
| arms | 0.75 | a 30% share on the weapon arm causes a disarm check |
| legs | 0.75 | each leg hit adds +0.5 to the stagger meter; 40% leg damage forces a limp |
| weak point (back coolant pack, the Chrome's spine port) | 2.0 | it also vents (3.4) |

#### 1.4 The stagger meter (`sim/stagger.ts`)
- `meter += damage / maxHp`, with a decay of 0.35 per second after 0.6 s without a hit.
- **Stagger** when the meter reaches 0.35, or on any head hit by a weapon of class pistol or heavier. Headshots don't count toward it on a target with a helmet still up.
- **Knockdown** when the meter reaches 0.8, or on a shotgun hit within 4 m doing at least 25% of max HP, or a melee heavy.
- Stagger cooldown: 1.2 s. Knockdown cooldown: 4 s.
- Archetype poise scales the meter: Price-War 1.2, Enforcer 1.0, Riot 0.6, Cyberpsycho 0.5, Chrome 0.7, mech 0.15 (the mech staggers only by part breaks).
- A stagger cancels the current attack and opens the takedown window (section 9).

---

### 2. Enemy models

#### 2.1 Construction approach (`game/models/`)
Keep the segment rig. Rigid segments hung between joints suit armoured figures, and they are what makes ragdoll and severing cheap. Upgrade the meshes and add joints.

**Rig additions (JOINTS goes from 16 to 22):**
- `spine2` between `chest` and `neck`.
- `clavicleL` and `clavicleR`, so shoulders shrug in reactions.
- `wristL` and `wristR`, so hands rotate independently and can clutch wounds.
- `jaw`, cosmetic, used by the visor-broken face and for severing.

Also add segments `upperChest`, `handL` and `handR` (the hands get their own 0.05 capsule). The ragdoll gets matching links plus bracing. Its `LINKS` table is extended, and `tests/cathode-body.test.ts` (new) checks that rest lengths hold within 2% after 600 settle steps.

**Geometry vocabulary.** These are pure functions in `models/parts.ts`. They return `BufferGeometry` and are cached by parameters.

| Part | Built from | Detail |
|---|---|---|
| Armour plate | `ExtrudeGeometry` of a 2D plate outline (`Shape` with chamfered corners), `bevelEnabled`, bevelSize 6 to 10 mm, bevelSegments 2, depth 12 to 20 mm, then bent with a cylindrical warp (radius 0.18 to 0.25 m) so it wraps the torso | 4 to 6 plates per torso, 1 per shoulder (pauldrons get 2 layered plates) |
| Helmet | `LatheGeometry` of a 14-point profile (crown, brow ridge, neck flare), 24 radial segments, with a boolean-free visor slot made by cutting the profile into 2 lathes plus a separate visor mesh | the visor is a `LatheGeometry` band, 0.04 m tall, on a 40° arc |
| Soft suit | `TubeGeometry` along the segment axis with a radius curve (bulge at mid-thigh and calf), 10 radial × 6 length segments; seam ridges come from a normal map | |
| Cloth (coats, hoods, tabards) | 6×10 vertex grid strips per panel, Verlet-simulated (2 iterations, pinned to `spine2` and the clavicles, collided against thigh and shin capsules) | at most 3 panels per enemy at LOD0; baked to rigid at LOD1 |
| Pouches, mags, radios | `RoundedBoxGeometry`, radius 6 mm, merged | 6 to 12 per enemy |
| Gloves and boots | `RoundedBoxGeometry` palm plus 2 finger blocks plus a thumb (gloves); boots get a lathe toe cap plus an extruded sole with a 6 mm tread | |
| Cyber parts | `CylinderGeometry` pistons, `TorusGeometry` joint rings, emissive cable `TubeGeometry` | |

**Materials** (`models/materials.ts`, shared and cached, patched through the existing `patchMaterial`/`shading.ts` so the noir grade and wetness apply):

| Material | Type | Base | Rough | Metal | Maps |
|---|---|---|---|---|---|
| Enforcer plate | `MeshPhysicalMaterial`, clearcoat 0.4 / 0.3 | `#2E333C` | 0.42 | 0.2 | CC0 "painted metal" normal and roughness (Poly Haven / ambientCG, 1k phone, 2k desktop), plus a procedural edge-wear mask (canvas: plate outline distance field → lighter `#5A616B` within 8 mm of edges) |
| Enforcer suit | Standard | `#15171B` | 0.85 | 0 | CC0 "fabric ballistic" normal, tiled 4× |
| Visor (Hollowell) | Standard, emissive | `#05080A` | 0.1 | 0 | emissive `#FFA040` × 2.2 (matches `enforcerLook`) |
| Coat (Hollowell officer, sniper) | Standard, sheen via `MeshPhysicalMaterial.sheen` 0.6 | `#1C1F26` | 0.7 | 0 | wet darkening by `shared.wet` |
| Faction trim | Standard, emissive strip | per faction | | | 3 mm emissive piping along plate edges |
| Exposed under-layer (after a plate breaks) | Standard | `#3B3530` mesh weave | 0.9 | 0 | CC0 "fabric weave" normal; flesh tint `#5A1E1A` where a wound decal is projected |
| Flesh / gore cap | Physical, clearcoat 1, roughness 0.25 | `#4A0B0B` core, `#C9B8A0` bone ring | | | procedural radial texture |
| Coolant (cyber blood) | Physical, transmission 0 (too costly), emissive | `#00E5C8` emissive × 0.8 | 0.15 | | |

**Faction colours** (one emissive language per faction):

| Faction | Emissive | Accent |
|---|---|---|
| Hollowell | amber `#FFA040` visor slits, joints `#FF7A1A` | |
| Price-War | sodium pink `#FF3D7F` | gaffer-tape white `#E8E2D4` |
| Candor | cold cyan `#3FE6FF` | chrome |
| Machine | red `#FF2A2A` sensor eyes | |

**Emblem decal:** a procedural SVG-to-canvas texture, the Hollowell "H in a tower", stamped on the left pauldron and the chest plate.

**LODs:** each archetype builder takes `lod: 0 | 1 | 2`.
- LOD1 drops cloth simulation, pouches and bevel segments (bevel 1).
- LOD2 is the current blockout cost: capsules plus the visor, but keeping silhouette accessories (shoulder plates, helmet crest) so the class still reads at 40 m.
- Swap with a 0.3 s dither crossfade, using screen-door alpha in the shader, a 4×4 Bayer pattern.

**Rim light for readability** (fixes "can't tell him apart from the street at 10 m"):
- Every enemy material gets a fresnel term `rim = pow(1 - dot(N, V), 3) * 0.35`, tinted with the faction emissive at 40% saturation.
- It rises to 0.6 in `combat` state and to 1.0 for 120 ms on a hit.
- It is skipped in the reflection pass.

#### 2.2 Silhouettes per archetype
Each must pass the **silhouette test**: a pure-black render on mid-grey at 64 px tall, which a reviewer (or a subagent critique) must classify correctly.

| Archetype | Silhouette idea | Key shapes | Height |
|---|---|---|---|
| **Hollowell Enforcer** | Corporate riot cop, squared and heavy up top | flared helmet with a brow ridge and horizontal visor slit; stacked pauldrons 0.12 m proud of the shoulder; chest rig with 3 mag pouches; knee-length split tabard (cloth) with the emblem; rifle with a long box mag | 1.86 m |
| **Riot-Shield Enforcer** | A wall with a head | as the Enforcer, plus a 0.62×1.2 m curved shield (extruded, bevelled, a viewport slot of emissive-tinted polycarbonate, transmission faked with 0.35 opacity plus a refraction-less fresnel); bulkier forearm plate; sidearm | 1.9 m |
| **Enforcer Sniper** | Tall, thin, cloaked | long rain coat to mid-shin (2 cloth panels), a hood over a helmet with a **single round emissive lens** (laser sight origin), a long rifle with a 0.35 m scope, a tripod pack on the back | 1.88 m |
| **Price-War Boy** | Street thug, asymmetric | no helmet; a tied bandana mask and a mohawk ridge (extruded fin); one pauldron made from a road sign (CC0 diamond-plate normal, pink stencil); bomber jacket (bulky torso lathe); SMG or pipe; slouched posture (spine pitch +12°) | 1.78 m |
| **Candor Chrome** | Elegant cyborg, too smooth | mirror-chrome head shell (`MeshPhysical`, metal 1, roughness 0.08, env from the city probe); a slim waist; exposed cyan spine port (weak point); high-collared white longcoat | 1.92 m |
| **Cyberpsycho** | Wrong proportions | arms 1.25× length, blades (extruded, bevelled) from the forearms, a hunched spine (−20°), a cracked faceplate with a red glare, cables trailing (Verlet strands, 6 points each) | 2.0 m hunched |
| **Orderly / Nurse** (clinic) | Clinical, quiet threat | scrubs (tube suit, pale `#9FB3AE`), a face shield, the Orderly's padded restraint gauntlets, the Nurse's backpack injector with an emissive vial | 1.8 / 1.7 m |
| **Security Drone / Police Drone** | Readable from below | quad-rotor ring (torus) with a single red eye and a tail strobe; rotors as a spinning blurred disc (alpha card) | — |
| **Sentry Turret** | Squat | tripod plus box head, two barrels, emissive lid slit | — |
| **ED-Class Mech** | Boss-scale | reverse-jointed legs, a cockpit box with plates (each plate breakable), shoulder missile pods (breakable weak points) | 3.4 m |

Elite mods get a readable layer on top:
- an emissive ring on the floor, 1.2 m, faction colour, 0.5 Hz pulse;
- a mod glyph over the head (DOM, shown only within 25 m);
- per-mod material tweaks: Stoneskin gets grey stone normals on the plates; Shock gets arc particles at joints; Volatile gets a pulsing chest vent.

#### 2.3 Weapons enemies hold
- Each enemy weapon is built from 10 to 20 parts with bevelled extrusions, using the same part vocabulary as the player viewmodel spec.
- It is **hand-attached**: parented to `wristR` with an offset, while the off hand is placed by two-bone IK to a `foregrip` socket.
- Enemy weapons get their own muzzle flash (2 crossed quads, 1 frame), a shared muzzle light, ejected brass (the existing instanced casings) and a slide or bolt kick: a 15 mm translation over 35 ms.
- They have to look as good as the player's at 3 m, because the takedown camera frames them.

---

### 3. Armour, visors, weak points (`sim/armour.ts`, `game/armourfx.ts`)

#### 3.1 Data
```ts
interface Plate { id: string; seg: SegmentName; hp: number; maxHp: number; absorb: number; state: "intact"|"cracked"|"broken"; }
```
- Enforcer: chest front (hp 40% of max HP, absorb 0.65), chest back (30%, 0.65), each pauldron (15%, 0.5) and the helmet (20%, 0.5). A pauldron covers `upperArm` hits on its outer 120° arc only.
- Riot: the same plus the shield. The shield takes 300% of max HP. Shock does ×2 (`SHOCK_VS_SHIELD`), and the shield breaks into 3 pieces.
- Plate hits apply `damage*(1-absorb)` to the body and `damage` to the plate. A shotgun at under 6 m splits across adjacent plates.

#### 3.2 Visuals by state
- **Intact hit:**
  - 6 to 14 spark particles, lifetime 120 to 260 ms, speed 4 to 9 m/s, reflected about the normal with ±35° jitter, colour `#FFD8A0` → `#FF7A1A`, additive.
  - A small chip decal on the plate itself (decal atlas cell `chip`, 2.5 cm, projected in the segment's local frame so it rides the bone).
  - A grey-blue marker with a shield pip.
  - Sound: armour clank (11).
- **Cracked (at 50% plate HP or below):**
  - The plate material swaps to a variant whose normal map blends in a procedural crack texture (a canvas Voronoi-edge line drawing, seeded per plate). The crack glows with the faction emissive at 0.3 for 0.4 s when it appears.
  - The plate visibly sinks 4 mm along its normal (a dent).
- **Broken (0 HP):**
  - The plate detaches. It spawns as a rigid body (a simple 6-DOF Euler integrator with box-vs-AABB collision, using the existing `RagdollWorld` boxes), with the velocity of the hit direction × 3 m/s plus 1.5 m/s up and a spin of 8 to 15 rad/s.
  - It clatters (2 to 3 bounces with a metal sound), then sleeps, and stays for the session subject to the rigid-body cap (FIFO). Old plates freeze into static meshes and stay.
  - Underneath shows the under-layer material, with 2 broken-strap tabs (small boxes) flapping on 1-point springs.
  - Hit-stop of 40 ms, an armour-break marker (pip plus a shatter ring), and a sound (11).
  - The enemy barks "Plate's gone!" with a 30% chance, at most once per 10 s per squad.

#### 3.3 Visor
The visor goes through three stages:
1. **Intact:** the first head hit cracks it.
2. **Cracked:** the visor shader adds a cracked emissive pattern, and its brightness flickers at 14 Hz for 300 ms.
3. **Shattered:** the second head hit shatters it into 12 to 20 instanced glass shards (with an amber emissive tint, lifetime 1.2 s, gravity on) and shows the **face**.

The face is a procedural head: a lathe skull with a jaw segment and two emissive-less eye sockets with a wet specular, in a dark skin palette chosen per seed from 4 tones. It shows for the first time here. Head damage then uses ×2.5.

#### 3.4 Weak points
- The Enforcer's back coolant pack (a 0.18 m cylinder with a pulsing `#FFA040` window, 1.2 Hz) takes ×2.0.
- At its 0 HP it vents: an 800 ms orange gas jet particle plume, a 1.4 s stagger, and the enemy can no longer sprint.
- The Chrome's spine port does the same in cyan, and also disables its dash.
- The mech's missile pods: breaking a pod (a plate with 25% of the mech's HP) disables that pod's attack, and it explodes for 15% of the mech's HP.

#### 3.5 Disarm
- A forearm or hand hit on the weapon arm with weapon class `pistol` or heavier rolls a disarm check: `chance = 0.25 + 0.5*share`, where `share` is that hit's damage over max HP.
- Each enemy is disarmed at most once.
- On a disarm the weapon flies off as a rigid body. The enemy shakes the hand (400 ms), then draws a sidearm (900 ms). Price-War Boys flee instead, and Cyberpsychos ignore disarms.

---

### 4. Animation (`game/anim/`)

#### 4.1 Layer stack (evaluated per enemy per frame, at LOD0/1; LOD2 runs at 15 Hz)
1. **Base locomotion:** the existing gait ellipse plus two-bone leg IK, extended with a speed-blended 2D blendspace. Gaits: idle, walk 1.6 m/s, run 4.2 m/s, crouch-walk 1.2 m/s, strafe L/R, backpedal 1.4 m/s. Stride and cadence are driven by speed: cadence `1.6 + 0.35*speed` Hz.
2. **Upper-body pose:** keyframed poses (joint offsets in the pelvis frame) blended with smoothstep crossfades. Poses: `lowReady`, `aim`, `aimHigh` (blind-fire over cover), `aimSide` (lean-out), `reload`, `throw`, `meleeWind`, `meleeStrike`, `cower`, `surrender`.
3. **Aim IK:**
   - Look-at on `spine2` (40%) and `neck` (60%) toward the target, clamped to ±70° yaw and ±45° pitch.
   - Weapon-hand IK to the aim line, and off-hand IK to the foregrip socket.
4. **Additive reactions:** per-segment rotational springs (4.3).
5. **Secondary:** cloth Verlet, cable strands, pouches with a 1-DOF wobble (stiffness 180, damping 12).
6. **Ragdoll blend:** after death (section 7).

**Pose keyframes** are authored as data (`anim/poses.ts`): joint offsets in metres relative to `REST`, plus a facing. They are interpolated with `slerp` on segment orientation and `lerp` on position, then legs are re-solved by IK so the feet stay planted. A `?shot&pose=<name>&arch=<id>` hook renders any pose for review.

#### 4.2 Timings (ms)

| Action | Windup | Active | Recover | Notes |
|---|---|---|---|---|
| Raise to aim (from low ready) | 300 | — | — | the visor flares from 1.0 to 1.6 brightness during the raise |
| Burst telegraph | 350 | burst of 3 to 5 at 90 ms | 250 | a laser sweep for the sniper only (`SNIPER_CHARGE` 1.5 s kept) |
| Reload, rifle | 2,200 total | mag-out at 400, mag-in at 1,500, bolt at 1,900 | | the old mag drops as a rigid body; bark "Reloading!" |
| Peek and shoot (crouch cover) | 250 rise | 900 to 1,600 shooting | 250 drop | the head and upper chest are exposed by 0.3 m |
| Lean out (side cover) | 220 | 1,000 to 1,800 | 220 | the spine rolls 25° and the arm extends |
| Blind-fire | 150 | 800 | 150 | weapon over cover, head down; accuracy ×0.3 |
| Grenade throw | 600 (an arm-back pose, bark "Frag out!") | release at 600 | 400 | arc preview: none. Indicator: yes (player-spec HUD) |
| Melee lunge (Orderly, Cyberpsycho) | 500 crouch plus a red emissive flash | 180 strike | 600 vulnerable | the existing `ORDERLY_LUNGE` 11 m/s is kept |
| Knockdown get-up | — | down 1,500 to 2,500 | 900 get-up (hands push, knee, stand) | can be taken down while down |
| Stagger | 400 to 700 | | | 4.4 |
| Surrender (morale broken, last alive, under 25% HP) | 500 to kneel | holds until shot or 8 s, then flees | | executing a surrendered enemy gives no XP penalty but triggers Cath's line pool |

#### 4.3 Flinch (every hit), using the springs in `anim/springs.ts`
- **Rotational spring per segment:** frequency 12 Hz, damping ratio 0.45, settling about 250 ms. Implemented as a semi-implicit critically-damped spring on a 3-component angle vector.
- **Impulse by zone, scaled by `clamp(damage/maxHp*4, 0.4, 1.4) × archetype poise`:**
  - Head: pitch back 22°, plus a 10° yaw away from the shot side.
  - Chest and abdomen: twist 12° away and pitch 6° back; clavicles shrug 8°.
  - Upper arm or forearm: 28° along the shot direction; the hand opens (finger blocks rotate 30°).
  - Thigh or shin: knee buckle of 18° plus a 6 cm drop at the pelvis.
- **Root push:** 0.15 m along `dir` for the pistol, 0.25 for the rifle, 0.45 for the shotgun at under 6 m. It is applied as velocity on the locomotion controller and decays over 200 ms.
- **White flash:** the hit segment's material instance gets `emissive=#FFFFFF × 1.5` for 1 frame (min 16 ms, max 33 ms), then a 150 ms fade to a dark red `#3A0000` and back to normal. This needs per-segment material clones only for the flash. Use a uniform `uHitFlash` on a shared material with a per-instance attribute on the merged mesh instead: one `vec2` per vertex group, set by segment.

The current flinch is `push*0.06`. It is removed and replaced by the above, which is roughly 8 to 12× larger.

#### 4.4 Stagger set (directional)
- **Direction** is chosen from the angle between `dir` and the enemy facing: front, back, left or right.
- **Front:**
  - 2 backward steps, 0.35 m each, at 180 ms per step.
  - The weapon arm drops to 45° below aim, and the off hand reaches for the hit point (hand IK, wound-clutch).
  - The head drops 15°. Total 600 ms.
- **Back:**
  - The torso pitches forward 25° and the enemy takes 1 forward stumble step.
  - The arms flail outward 20°. 550 ms.
- **Left and right:**
  - A crossover step and a 20° torso roll; the opposite arm goes up for balance. 500 ms.
- **Headshot stagger** (helmeted): a 25° head snap, and the hands go to the helmet for 400 ms.
- **During a stagger:**
  - The visor flickers.
  - The rim light pulses at 3 Hz (the takedown-eligible tell, section 9).
  - A 1.5 s "stagger crit" buff: the next hit is a guaranteed crit and shows a crit marker.

#### 4.5 Wounded behaviour (persistent)
- **Leg at 40% damage or more:** a limp. The gait is asymmetric (the injured stance is 35% of the cycle, the hip drops 4 cm), and top speed is ×0.6.
- **Arm at 40% damage or more:** a one-handed weapon pose with accuracy ×0.7. The off hand clutches the arm when idle.
- **Under 25% HP:** a wounded pose (hunched 10°, the hand pressing the most-damaged segment), plus a breathing bob at 0.6 Hz with a 1.5 cm amplitude. A blood trail decal is dropped every 1.2 m moved (floor, 0.15 to 0.3 m).
- **Wounded crawl** (Price-War, and Enforcers not killed by a head or torso shot when a knockdown happens below 10% HP, 25% chance):
  - The enemy goes down and crawls away at 0.4 m/s for up to 6 s, leaving a smear trail.
  - It can fire a sidearm (accuracy ×0.25).
  - It is takedown-eligible.
  - It bleeds out at the end, playing a death-rattle animation (3 slow breaths, then limp).

---

### 5. Firefight AI (`game/ai/`)

The existing `Awareness` FSM (unaware → suspicious → searching → combat) stays as the perception layer. Below `combat` sits a small utility planner. It is not full GOAP: scored actions are cheaper and easier to test.

#### 5.1 Squad manager (`ai/squad.ts`, pure enough to unit-test with a fake world)
- **Squads form per encounter zone** (`game/zones.ts`), with up to 6 members and 1 leader. The leader is the highest-level member or the officer variant, who has a crest on the helmet.
- **Attack tokens:** 2 at Noir difficulty, 3 at Hardboiled, 4 at Hell Week.
  - Only a token holder may fire at Cath with real accuracy. The others reposition, suppress (hit chance capped at 8%), or reload.
  - A token passes on after 2.5 to 4 s of firing, or when its holder loses line of sight.
- **Roles, assigned every 1.5 s:**
  - `suppress`: the nearest member with LOS.
  - `flank`: the member with the best flank path score. At most 1 flanker at a time; it takes the other side of the cover Cath is behind.
  - `advance`: if Cath has been out of LOS for 5 s or more.
  - `hold`: everyone else.
- **Accuracy ramp:** the hit chance of a token holder goes from 20% to 70% over 1.2 s of continuous LOS. It resets on a LOS break or when Cath slides or dodges. The first 2 shots of every burst are deliberate misses that impact within 0.4 to 1.0 m of Cath: visible tracers, wall sparks and snaps near her. They are the readable warning.

#### 5.2 Cover
- **Cover points are generated offline per level** by `scripts/cathode-cover.ts`, run at build time and output as JSON in `render/levels/*.cover.json`. The script samples colliders at 0.75 m spacing along their edges, at the heights 1.1 m (crouch cover) and 1.8 m or more (full cover, lean).
- **Score:** `protection(from Cath, 0..1) × 3 + distance-band(8-20 m ideal) × 1.5 − ally-crowding(<2 m) × 2 − exposure-path × 1 + flank-angle × 1 (flanker only)`.
- **Behaviour in cover:**
  - Crouch cover: peek and shoot (4.2), 1.5 to 3 s between peeks.
  - Full cover: lean.
  - Blind-fire when suppressed, meaning Cath's shots passed within 0.5 m of the head (a near-miss event from the `CombatBus`) in the last 1.5 s.
- **Flanked:** if Cath's angle to the cover normal exceeds 70°, bark "She's flanking!" and pick new cover within 600 ms.
- **Suppression read:** near-misses make the enemy duck for 400 ms (a crouch-pose blend) and add stress, which lowers accuracy ×0.6 for 1 s. So shooting at an enemy's cover always does something visible.

#### 5.3 Morale (`sim/morale.ts`)
- Each enemy has morale from 0 to 1, starting at 1.
- Changes:
  - a nearby ally dies within 15 m: −0.25;
  - the leader dies: −0.4 for all;
  - the enemy's own HP falls below 25%: −0.3;
  - Cath gets a takedown in view: −0.35;
  - +0.1 per second in cover with no damage.
- Below 0.3: fall back to the cover furthest from Cath, with accuracy ×0.5.
- Below 0.1 and the last alive: surrender (4.2), or flee (Price-War).
- Cyberpsychos and machines have no morale.

#### 5.4 Barks (`game/voice.ts`, synthesised radio-filtered voice: the existing voice pipeline gets an enemy "radio" chain of bandpass 400 to 3,200 Hz, a 12% bitcrush and a squelch at the end)
- **Lines:**
  - Contact: "Contact!", "There she is!"
  - Reloading: "Reloading!" (always; it's a reward cue)
  - Man down: "Man down!", "We lost Harker!" (names from the seed)
  - Flanking: "She's flanking left!"
  - Lost: "Where'd she go?"
  - Grenade: "Frag out!"
  - Plate break: "Plate's gone!"
  - Fall back: "Fall back! Fall back!"
  - Surrender: "Alright! Alright!"
  - Wounded: "I'm hit, I'm hit"
- **Rules:**
  - At most 1 bark in flight per squad.
  - A 3 s squad cooldown, except "Reloading" and "Man down", which always play.
  - Spatialised (`PannerNode`, HRTF on desktop, equal-power on phone).
  - Subtitles in a speaker colour (the faction emissive), if subtitles are on.

---

### 6. Blood, wounds, decals, gore (`render/gore.ts`, a new module that owns its instanced pools; it reuses `fx.ts` decals)

#### 6.1 Per hit on flesh

| Layer | Spec |
|---|---|
| **Entry puff (player-facing)** | 1 mist sprite (soft radial, 0.25 to 0.45 m, scaled ×1.4 beyond 15 m for readability), colour `#8A0E0E` at α 0.85, emissive lift so it reads in the noir grade (`emissive = 0.18 × base`, unaffected by the local-light scaling that made the current blood near-black). It faces the camera, expands over 200 ms and fades over 350 ms. |
| **Spray (exit)** | 15 to 40 instanced droplets (pistol 15, rifle 22, shotgun pellet 6 each, sniper 40), in a 35° cone along `dir`, speed 2 to 6 m/s, gravity 9.8, size 1.5 to 4 cm, stretched along velocity (velocity-aligned quads, length ×(1 + speed × 0.04)). Base `#5C0707`, clearcoat-like spec (a fake highlight in the fragment shader with `pow(dot(N,H), 40)`). On ground contact: a decal (`fx.ts` mode 3). |
| **Entry spurt (back toward the player)** | 4 to 8 droplets at 1 to 2.5 m/s in a 50° cone toward the camera. This is what the player actually sees from the front, and it fixes "blood sprays away from the player". |
| **Wall splatter** | Raycast along `dir` from the exit point up to 3 m. On a hit, place a splatter decal (atlas cells `splat1..6`), scale 0.3 to 0.8 m by damage, random roll, alpha 0.9, with a 120 ms "wet in" scale from 0.7 to 1.0. |
| **Wound on the body** | A wound decal projected into the hit segment's local frame: a small instanced quad parented to the segment, offset 2 mm along the surface normal. Hole cell 3 cm, plus a run-down streak cell, 6 cm long, that grows over 2 s. At most 8 wounds per enemy; the oldest are recycled. |
| **Plate hit** | Sparks instead (3.2). No blood. |
| **Cyber hit** (Chrome, cyber limbs, machines) | Coolant: the same droplet system tinted `#00E5C8`, emissive × 0.8, plus a 2 to 4 spark burst and an electrical crackle. The decals are emissive puddles that fade to `#0A3A35` over 20 s. |

#### 6.2 Pools under bodies
- A pool starts 600 ms after the body sleeps (or after 1.5 s of ragdoll). Its centre is the torso point projected to the floor.
- The radius grows from 0.2 to 1.0 m (head kill 0.8, shotgun 1.2) over 8 s with ease-out.
- Material: a dedicated decal instance with `roughness 0.08` and clearcoat 1, so neon reflects in it. It uses the existing SSR/planar reflection path that the wet street uses (`render/reflection.ts`).
- The colour darkens from `#5C0707` to `#2A0303` over 30 s.
- Pools are capped (budgets), and the oldest freezes and stops growing.

#### 6.3 Dismemberment (extends the existing sever code in `body.ts` and `sim/damage.ts`)
- **Rule** (`sim/damage.ts`):
  - A killing blow on a limb or head severs it if `damage ≥ LIMB_SEVER_SHARE × maxHp × 1.5` (head: `HEAD_SEVER_SHARE`).
  - Or: shotgun within `CLOSE_SEVER_RANGE`, explosives within 3 m (legs first), or the sniper on the head with the visor broken.
  - A non-lethal sever is allowed only on forearms, and only with weapon class `shotgun` or `sniper`.
  - Pistols never sever, unless crit and lethal on a forearm with `damage ≥ 0.4 × maxHp`. A rare reward.
- **Visual:**
  - The existing gore caps get new art: a lathe disc with a flesh-red core, a 2 mm fat ring `#C9A27A`, a bone cylinder (radius 30% of the segment, `#E6DCC8`) proud by 1.5 cm, and torn suit strips (3 short Verlet strands).
  - The severed piece gets an impulse of `dir × 4 to 8 m/s` plus 1.5 m/s up, with spin 10 to 20 rad/s.
- **Stump spurt:** 1.5 s at 2 Hz, in time with the heartbeat (pulse amplitude 1.0, 0.7, 0.45, then 0.25), 6 droplets per pulse at 3 m/s, plus a trail emitter on the flying limb (2 droplets per 100 ms for 0.8 s).
- **Head sever:** the helmet and head fly; a neck stump plus a fountain of 10 droplets per pulse; and a camera-side lens blood check (the player spec's lens blood triggers within 3 m).
- **Cyber limbs:** they spark (a 400 ms shower), arc (a 3-segment emissive line, 2 frames each, ×4), and leak coolant. Sound: a servo whine-down.
- **Reduced mode:** never sever. A killing blow that would sever plays the knockdown death variant instead.

---

### 7. Death (`game/death.ts`)

#### 7.1 Powered ragdoll, extending `Body`
1. **On the lethal `HitEvent`:**
   - Seed `prev = joints − velocity × dt`. This exists already via `syncPrev`/the impulse code; keep it, and make sure it runs on the same frame.
   - Add the bullet impulse at the hit joint: pistol 3.5, rifle 4.5, shotgun 7 to 10, sniper 9 m/s, with falloff `max(0.25, 1 − d × 0.8)`. This is already there; the numbers are kept.
2. **Active phase:**
   - Each joint gets a pose spring toward a target death pose (7.2), with strength 0.6 fading to 0 over the variant's duration. It is applied as a Verlet position nudge: `p += (target − p) × k × dt × 60`.
   - The animation layer also keeps hand IK running (for the clutch) until strength drops below 0.15.
3. **Limp phase:**
   - Floor friction is 0.85 per contact step.
   - Joint angle limits are added. This is new: a knee folds only backward, through a dot-product constraint against the thigh-forward vector, which stops the "folds into a box heap" look.
   - Neck limit 70°, elbow 150°.
4. **Sleep** when every joint moves less than 2 mm per frame for 30 frames. Then freeze, bake to a static pose, and release simulation slots.

#### 7.2 Death variants (chosen by `HitEvent`, deterministic from the seed so screenshots are stable)

| Variant | Trigger | Active-phase pose | Duration | Notes |
|---|---|---|---|---|
| **Headshot drop** | head, lethal | none, instant limp | 0 | 1.2× backward head impulse; the weapon falls from the hand at once |
| **Gut clutch** | torso, pistol or rifle, at ≤ 12 m | knees buckle (the pelvis drops 0.5 m over 500 ms), both hands IK to the hit point, the head drops | 900 ms | the most "Euphoria" one; default for the first kill of the run (the tutorial guard), so the owner's first kill reads well |
| **Spin fall** | torso or arm hit from the side | a 90° yaw twist toward the shot, the arm flung out | 600 ms | |
| **Wall slump** | death within 1.2 m of a wall behind | the back is pushed to the wall (the pose target is on the wall plane), then slides down to sit | 1,200 ms | leaves a vertical smear decal 0.4 × 1.2 m |
| **Knees then face** | leg hit, lethal | one knee down, a pause of 200 ms, then forward | 800 ms | |
| **Blown back** | shotgun ≤ 4 m or explosive | none; impulse ×1.5, plus 1.5 m/s up | 0 | possibly with a sever |
| **Railing / ledge** | death within 1 m of a collider top edge between 0.9 and 1.2 m high | fold over the edge | 700 ms | |
| **Crawl-out** | 4.5 crawl ends | 3 breaths, then limp | 2,400 ms | |

- **Weapon drop:** the enemy's weapon detaches at the first frame of limp (or at 200 ms into the active phase), as a rigid body with a clatter. It stays, and is cosmetic unless it is loot.
- **Visor death:** on any death the visor emissive fades from 1.0 to 0 over 900 ms with 2 flickers, at 300 ms and 550 ms. It is a beautiful, cheap "the light goes out" beat.
- **Loot:** the loot octahedron is replaced by the dropped weapon and pouches glinting, using the pickup-beacon rules from the pickups spec. The fix for the HUD target-health-bar bug lives there too: hide it on a lethal `HitEvent`.

---

### 8. Hit-stop, kill confirm, kill cams

#### 8.1 Hit-stop (`game/timescale.ts`, a single owner of `simScale`)
- **Timings:**
  - Normal hit: 0 ms for automatic weapons; 12 ms for the pistol and shotgun.
  - Crit hit: 20 ms.
  - Plate break: 40 ms.
  - Kill: 60 ms.
  - Headshot kill: 110 ms.
  - Takedown impact: 80 ms.
  - Last enemy of the encounter: 120 ms, followed by a 0.35× slow-mo over 700 ms that ramps back over 250 ms.
- **Overlapping stops:** take the max, don't add.
- **What keeps running during a stop:** rendering, audio (unpitched), viewmodel springs, particles (at 25% speed, so the blood "hangs" on a kill), the HUD and input.
- **Kill confirm** (for the HUD and audio specs): a kill marker, a kill sound, an FOV punch of −1.5° that recovers over 150 ms, and +0.2 trauma.

#### 8.2 Kill cams (rewrite of `killcam.ts`; the existing ballistic-over-18 m path becomes one variant)
- **Triggers** (with a cooldown of 20 s between any two, and never in the first 3 kills of a new save except the first-job finale):
  - the last enemy of an encounter killed by a headshot, a sever or a takedown;
  - a ballistic headshot over 30 m;
  - a multi-kill of 3 in 1.5 s.
- **Skip:** any input after 300 ms skips. "Kill cams: On / Last enemy only / Off" in settings, default "Last enemy only".

| Variant | Sequence (ms) |
|---|---|
| **Bullet follow** (ballistic) | 0: time 0.1, cut to 0.5 m behind the round, FOV 50°, slight orbit 8°/s; streak (emissive `#FFE0B0` line 0.6 m with heat-haze refraction faked as a UV-offset noise sprite). 0 to 400: travel. 400: impact; x-ray optional (8.3); time 0.05 for 200 ms. 600 to 1,400: cut to an orbit of the body at 0.3× (the death variant plays). 1,400 to 1,650: ramp to 1.0 and whip-pan back (a 120 ms motion-blur smear via a 3-tap screen-space blur along the pan direction in `render/post.ts`). |
| **Last-man orbit** (hitscan) | 0: time 0.25. Camera at 3.5 m from the target, at 1.4 m height, 35° off Cath's line, FOV 45°, letterbox 2.39:1 bars in over 150 ms. 0 to 900: slow orbit 20°/s while the death plays; blood hangs. 900 to 1,150: time ramps to 1, bars out, cut back. |
| **Takedown cam** | see 9. |

**Audio during kill cams:** everything is pitched −12 semitones via `playbackRate` on buffers. Synthesised voices get lowered oscillator frequencies, the low-pass is at 800 Hz, a heartbeat thud (55 Hz, 2 beats) plays, and a reverse whoosh plays on return.

#### 8.3 X-ray (desktop default on, phone off, reduced mode off)
- At impact, the target segments swap for 600 ms to a translucent Fresnel shell `#9FD8FF` at α 0.25, revealing a skeleton: a procedural bone set of capsule/lathe bones per segment, built lazily.
- The struck bone gets a crack line (a decal on the bone mesh) and shatters into 6 to 10 bone chips (instanced, white `#E6DCC8`).
- Sound: a crunch, a layered noise burst, plus a 90 Hz thump and a celery-snap transient (a high-passed 3 ms click × 3, at 8 ms apart).

---

### 9. Takedowns (rewrite of `combat.takedown`, `game/takedown.ts`)

#### 9.1 Eligibility (`sim/takedown.ts`, pure)
- `unaware` or `suspicious` and approached from behind (within ±70° of their back), or
- staggered, knocked down, crawling or surrendered, or
- below 20% HP.

Plus: range ≤ 2.5 m, and not a machine or Cyberpsycho (the Cyberpsycho gets a staggered-only "counter" variant). A magnet pulls Cath along a 300 ms path to the sync point, 0.75 m behind (or in front of) the target, with collision-checked fallback.

**Tell:**
- The target's rim light pulses at 3 Hz, and a world-anchored prompt "F · TAKEDOWN" appears (the HUD spec sizes it in vh).
- A 2-tone tick sounds when the target first becomes eligible, at most once per target.

#### 9.2 Sequence (paired, camera-owned, input locked, world time 0.4 except the participants)

| t (ms) | Cath / camera | Target |
|---|---|---|
| 0 to 120 | camera eases from first person to a framing 15° wider (FOV +12°) with a 0.25 m lift; the viewmodel transitions to the "takedown arms" rig (the viewmodel spec's hands) | sync-snapped to its pose start; visor flares |
| 120 to 420 | **Stealth, from behind:** the left arm wraps the neck (hand IK to the target's `neck`), the right hand raises the baton | the head pulls back 30°, the hands go to Cath's arm |
| 420 | **impact:** hit-stop 80 ms, camera kick 3° down, trauma +0.35, a hard thud plus a sub 45 Hz | the head snaps 40°, white flash, blood puff at the temple (0.6 m mist) |
| 420 to 900 | second strike or choke squeeze; the camera drifts 6° around | the legs go: knees buckle (pelvis −0.55 m), the body is guided down by Cath's arm (powered ragdoll at strength 0.8 → 0) |
| 900 to 1,200 | Cath lets go, the camera returns over 200 ms, time ramps to 1 | limp, laid down quietly (impulse 0.5 m/s, no crash) and quiet for stealth: noise radius 2 m |

**Other variants** (at least 3 per approach direction, picked by angle, weapon and seed):

| Variant | Sequence |
|---|---|
| Front, staggered | Grab the collar. Pistol-whip at 300 ms, then a point-blank shot under the chin at 650 ms (headshot-kill hit-stop 110 ms, head blood plus a wall splat behind, death variant "headshot drop"). |
| Front, shove | A kick to the chest. The target flies 1.5 m (blown-back variant), then a finishing double-tap at 700 and 820 ms. |
| Side | Baton to the knee at 250 ms (the knee buckles), then the elbow to the head at 600 ms. |
| Knocked down | A stomp camera pitch −35°, a baton downstrike at 380 ms. |
| Surrendered | Cath's line plays and she chooses: hold F for 0.6 s to knock out (non-lethal, rewards "mercy" XP if the skill system has it), or fire. |

**Reward:** pickups pop out in an arc and magnetise to Cath within 4 m after 400 ms:
- 1 to 2 health orbs (8% max HP each, red);
- 1 Guard orb (cyan);
- ammo, if a gun finisher was used.

A "+XP" chip rises from the body.

---

### 10. Cath's first kill: authored to sell all of this
The tutorial guard in `firstjob.ts` (the owner's "easy but unsatisfying" moment) is a staged showcase:
- The guard is unaware and faces a lit shop window, so the stealth takedown is framed against light. That gives a backlit silhouette.
- The guard is forced to take the "from behind" variant with a slower world time of 0.3 for the first takedown of a new save, plus a one-time Cath voice line at 1,000 ms.
- The second enemy (the first gun fight) is placed so that the first gun kill is likely a torso hit. The default death variant is "gut clutch" with a wall slump if near a wall, followed by a pool. All of it is visible from the expected firing position at 8 to 12 m, with a street lamp above the death spot (relit by `render/lighting.ts` so the pool reflects neon).

---

### 11. Audio layers (WebAudio, synthesised in `game/audio.ts`; a new `combatAudio.ts`)
All hit-confirm sounds go to a **dry player bus** (no reverb send) at +3 dB over gunfire. World impacts go through the existing spatial and reverb chain.

| Event | Layers |
|---|---|
| Flesh hit confirm (player-only) | a bandpass noise at 2.5 kHz, Q 4, 30 ms, plus a sine thump at 120 Hz with a 60 ms exponential decay. **Distinct from Cath's `hitFlesh`, which is renamed `cathHurt`.** |
| Crit / head confirm | the above plus sines at 1.8 kHz and 2.7 kHz with a 250 ms decay |
| Armour confirm | 3 inharmonic sines (1.1, 2.9, 4.3 kHz, ratio-detuned), a 180 ms decay, plus a 10 ms noise click |
| Plate break | the armour ping, plus a crack noise (highpass 3 kHz, 80 ms), plus a debris tumble (3 to 5 filtered clicks at 60 to 140 ms), plus a world-spatialised clatter on landing |
| Visor shatter | a glass layer: 6 random sines (3 to 8 kHz, 40 to 120 ms each, staggered over 150 ms) plus a noise sizzle |
| Kill confirm | a lower ring at 660 Hz plus 990 Hz, 300 ms, plus a sub at 55 Hz, 150 ms, plus a "tick-tock" second transient at +60 ms |
| Headshot kill | the kill confirm, plus a bright ding at 2.2 kHz with a 400 ms decay |
| World flesh impact (spatial, what nearby enemies hear) | a meaty slap: a noise burst lowpassed at 1.2 kHz, 50 ms, plus a 90 Hz thump |
| Body fall | per joint ground contact above 1.5 m/s: a lowpassed thud (180 Hz, 70 ms), gear rattle (bandpassed noise 2 kHz, 120 ms) on chest contact, and a weapon clatter |
| Sever | a wet tear (noise through a 600 Hz → 2 kHz sweep, 140 ms), plus a crunch, plus the spurt hiss pulsing with the heartbeat |
| Enemy pain | a radio-chain grunt (the formant voice: 2 vowels, 120 ms) at a 40% chance per hit, always on a stagger |
| Death | the death rattle (a breathy noise with a falling formant, 600 ms), plus the radio squelch out (the radio dies with the visor) |
| Takedown | cloth grab (filtered noise 200 ms), impact (a sub at 45 Hz plus a noise crack), and a choke breath |

Per-shot variation: pitch ±4%, gain ±1.5 dB, and a random pick from 3 to 5 parameter sets per sound so no two match. Music and ambience duck by 3 dB for 400 ms on each kill.

---

### 12. Interfaces with the neighbouring specs
- **`CombatBus` events:** `hit`, `blocked` (cover with a material), `nearMiss`, `kill`, `plateBreak`, `sever`, `takedownStart` / `takedownImpact` / `takedownEnd`, `encounterCleared`, `cathHit` (source position, damage). The HUD hit marker, the player hurt and death post-processing, and the viewmodel all listen.
- **`timescale.ts`** is the only writer of `simScale` and `fxScale`. Cath's death sequence (player spec) and kill cams both request through it, by priority: death > takedown > kill cam > hit-stop.
- **`trauma.ts`** is the single camera-shake accumulator (trauma²-based). This spec adds: kill +0.2, plate break +0.1, takedown impact +0.35, a sever within 5 m +0.15.

---

### 13. Testing

#### 13.1 Unit tests (vitest, `tests/cathode-*.test.ts`)

| File | Covers |
|---|---|
| `cathode-hitpipeline.test.ts` | Nearest-hit ordering (world vs capsule). Glass, drywall and wood penetration percentages; concrete blocks. A blocked hit emits `blocked` and no `hit`. An OBB rotated prop blocks only its own shape (a ray through the AABB corner outside the OBB passes). |
| `cathode-colliders.test.ts` | Every level box or cylinder that is ≥ 0.9 m tall and ≥ 4 cm thick has a collider and a material (static scan of the level builders' output). |
| `cathode-armour.test.ts` | Plate absorb maths. Cracked at ≤ 50% and broken at 0. A pauldron covers only its arc. Visor stages 0 → 1 → 2 and the head multiplier goes from 2.0 to 2.5. Weak-point vent disables sprint. Disarm happens at most once. |
| `cathode-stagger.test.ts` | Meter accumulation and decay. Thresholds give stagger and knockdown. Poise scaling. Cooldowns. Directional choice by angle. A helmet suppresses headshot staggers. |
| `cathode-sever.test.ts` | The pistol never severs except the forearm crit rule. Shotgun close range severs. Reduced mode never severs. The carries list holds. |
| `cathode-death.test.ts` | Variant selection table (deterministic from the seed and the `HitEvent`). Ragdoll joint limits hold (knee angle stays inside its range after 600 steps on a 1 m fall). Sleep within 2 s. No NaNs over 10k random impulses (quick fuzz, joins `npm run check`). |
| `cathode-squad.test.ts` | Token count per difficulty. At most N real-accuracy shooters. Accuracy ramp from 20% to 70% over 1.2 s and reset on a LOS break. One flanker at most. Flank detection at > 70°. Morale deltas, fall back and surrender. "Reloading" always barks. |
| `cathode-cover.test.ts` | The generated cover JSON for every level: points sit on navigable ground, with protection > 0.5 from at least one direction and none inside colliders. |
| `cathode-takedown.test.ts` | The eligibility matrix. The sync point avoids colliders. The reward drops. A stealth takedown has a noise radius of 2 m. |
| `cathode-timescale.test.ts` | Hit-stop max-not-add. Priority order. Rendering dt is unaffected. |
| `cathode-models.test.ts` | Per-archetype triangle and draw-call counts under the budget at each LOD (build geometry headlessly: three.js geometry works in Node). Each material is shared (no per-enemy clones except the flash attribute). |

#### 13.2 Screenshot hooks and runs
- **Hooks:**
  - `?shot&arch=<id>&lod=<n>&pose=<name>` renders a turntable stage: 3 enemies on a grey plinth with key, rim and fill light.
  - `?shot&scene=<name>` gives scripted combat tableaux driven by `window.cathode.combat.replay([...HitEvent])` on a frozen frame, with particles advanced to a set `fxTime`.
- **Tableaux:** `hits-body`, `hits-head`, `plate-crack`, `plate-break`, `visor-shatter`, `stagger-front`, `death-gutclutch@450ms`, `death-wallslump@1200ms`, `pool@8s`, `sever-arm`, `coolant-chrome`, `takedown-impact@420ms`, `killcam-orbit@500ms`, `xray@450ms`, `reduced-mode-death`, `silhouette-lineup` (all archetypes as black on grey).
- **Sizes:** each runs at 2560×1440 @2x (the 5K CSS layout), 1440×900 @1x and 844×390 @3x (phone landscape), through `npm run shots`, under the existing swiftshader flags.
- `?shot` freezes time, so a single frame is enough despite the about 3 fps. Use `fxTime` rather than waiting.
- **Review:** after each milestone, a subagent critiques the before and after shots against VISION.md and this spec. The critique is logged in DECISIONS.md (5 lines at most).

#### 13.3 e2e (Playwright, `?2d` is not available for CATHODE, so drive at low res 640×360 with `?play`)
- `cathode-combat.spec.ts`:
  - Shooting a guard behind a crate emits `blocked` with no `.hud-hit` class; shooting their head over it emits `hit`.
  - A kill emits `kill` and hides the target bar.
  - A takedown locks input for at least 900 ms and returns control.
  - A death does not call `location.reload`.

#### 13.4 Performance checks
- `scripts/cathode-perf.ts` runs `?shot&scene=firefight-12` (12 enemies, 4 ragdolls, 300 particles, 120 decals) and reports `renderer.info` draw calls and triangles plus CPU ms for the anim/react/ragdoll step, measured in Node for the sim part.
- **Gate:** desktop ≤ 900 draw calls and ≤ 1.5 ms; phone scene (6 enemies) ≤ 450 draw calls and ≤ 1.2 ms.
- Add it to `npm run gates` as a CATHODE sub-check.

---

### 14. Milestones (ordered; each ships alone and is player-visible)

**M1: "Every shot reads"** (hit pipeline, cover, hit confirm on the enemy side)
- **Scope:**
  - The collider audit plus OBBs plus materials (1.1).
  - `HitEvent` and `CombatBus`.
  - The flinch springs replacing `push*0.06` (4.3).
  - The white flash.
  - Player-facing blood puffs and the entry spurt (6.1).
  - Separate hit-confirm sounds: flesh, crit, armour, kill (11).
  - Hit-stop and kill confirm (8.1).
  - The target-bar-on-kill fix.
- **Acceptance:**
  - Unit tests: hitpipeline, colliders, timescale.
  - Shots `hits-body` and `hits-head` at all 3 sizes: the puff is visible and at least 40 physical px at 10 m on 5K; the flinch is visibly displaced in the frame.
  - The e2e behind-cover test passes.
  - `hitFlesh` is no longer used for enemy hits.

**M2: "The Enforcer, rebuilt"** (models and look)
- **Scope:**
  - Rig additions (22 joints).
  - The parts library, materials with CC0 normal/roughness sets (committed under `games/cathode/public/tex/`, with licence notes in `docs/credits.md`).
  - The edge-wear mask.
  - The Enforcer, Riot and Sniper with LOD0/1/2, rim light and hand-attached detailed rifles.
  - Cloth tabards and coats.
- **Acceptance:**
  - The `cathode-models` budget test.
  - The turntable shots at 3 sizes.
  - The silhouette-lineup critique classifies all 3 correctly.
  - At 10 m under a lamp the Enforcer is distinguishable from the background (critique check on `12-guard-from-10m` re-shot).
  - The perf gate passes.

**M3: "Breakable armour"**
- **Scope:** plates, cracks, detach rigid bodies, the visor stages and face, weak points and venting, disarm, the armour sounds (3, 11).
- **Acceptance:**
  - The armour unit tests.
  - The shots `plate-crack`, `plate-break` and `visor-shatter`.
  - A scripted e2e of 6 rifle shots to the chest shows the `plateBreak` event and the under-layer material.

**M4: "Hit reactions and firefight AI"**
- **Scope:**
  - The stagger meter and directional stagger set, knockdown and get-up.
  - Wounded behaviour: limp, one-hand, crawl.
  - Cover generation, peek, lean and blind-fire.
  - Squad tokens, the accuracy ramp, flank, suppression ducking, morale and surrender.
  - Barks and the reload animation.
- **Acceptance:**
  - Unit tests: stagger, squad, cover, morale.
  - Shots `stagger-front` and `stagger-back`.
  - A headless sim of 50 encounter runs with a scripted Cath (`scripts/cathode-firefight-sim.ts`) logs that the time-to-first-damage is ≥ 1.0 s after first LOS, at most N shooters at once, and at least 1 "Reloading" bark per encounter. Logged in BALANCE.md.

**M5: "Deaths that land"**
- **Scope:** the powered-ragdoll active phase, the 8 death variants, joint limits, weapon drops, the visor light-out, pools with reflections, wall splatters, wound decals on bodies, blood trails, body-fall audio. The first-kill staging (10).
- **Acceptance:**
  - The death unit tests (including the no-NaN fuzz in `npm run check`).
  - Shots `death-gutclutch@450ms`, `death-wallslump@1200ms` and `pool@8s` at 3 sizes.
  - The critique confirms "no box heap": knees bend correctly in all variants.

**M6: "Gore and dismemberment"**
- **Scope:** sever rules, the new gore caps with bone and fat rings, stump spurts, limb trails, head severs, coolant for cyber, sever audio, reduced-mode substitutions.
- **Acceptance:**
  - The sever unit tests.
  - Shots `sever-arm`, `coolant-chrome` and `reduced-mode-death`. In reduced mode there are no caps and no red droplets in the frame (a pixel-hue check in the shot script: no pixel with hue 350° to 10°, saturation over 0.6 and value over 0.25).

**M7: "Takedowns"**
- **Scope:** eligibility, the magnet, the tell, the paired sequences (stealth from behind, front staggered, front shove, side, knocked down, surrendered), the camera, the arms rig hook, the reward orbs. The first takedown's special 0.3 world time.
- **Acceptance:**
  - The takedown unit tests.
  - The e2e input lock is ≥ 900 ms and ≤ 1,400 ms.
  - The shot `takedown-impact@420ms` at 3 sizes shows Cath's arm and the target's face or helmet in frame.
  - The owner's audit frames `14-16` re-shot show a staged fall, not a heap.

**M8: "Kill cams and x-ray"**
- **Scope:** the `killcam.ts` rewrite: bullet follow, last-man orbit, multi-kill, the cooldown and skip, the settings option, kill-cam audio, the x-ray skeleton and bone chips (desktop), the letterbox, the whip-pan blur.
- **Acceptance:**
  - Unit tests for trigger rules and cooldown.
  - Shots `killcam-orbit@500ms` and `xray@450ms`.
  - An e2e test that skip works after 300 ms and that the camera returns to first person with `simScale` 1 within 300 ms.

**M9: "District roster"** (the rest of the archetypes to the M2 standard)
- **Scope:** Price-War Boy, Candor Chrome, Cyberpsycho, Orderly and Nurse, drones, turret, the ED-Class mech with breakable pods, elite-mod layers.
- **Acceptance:**
  - The model budget test for all of them.
  - The silhouette lineup is fully classified.
  - The mech pod break disables its attack (unit test).
  - The perf gate on the `firefight-12` mixed scene.

Each milestone ends with `npm run check`, `npm run shots` before and after, the touched e2e specs, `npm run gates`, and a release, per CLAUDE.md. A milestone that misses the phone budget ships with phone LOD and particle caps reduced, not with the feature cut on desktop.
## F. Player damage and front door spec
## MOTHER'S RUIN (formerly CATHODE): spec for player damage, death and the front door

**Scope.** This spec covers the player's side of damage (hits taken, wounded states, screen, audio, going down, death, retry) and the front door (rename, cold open and gate, title, menus, class pick, loading, pause). Enemy hit feedback, the weapons and the enemy model are covered elsewhere. This spec only touches them where they share systems: the time-scale controller, audio buses, the post pass and HUD units.

**What the code does today** (read from `origin/build`):
- Death sets `dead = true`, shows a banner, then calls `location.reload()` on click (`session.ts` ~1180).
- Damage feedback is `.hud-hurt`, a CSS radial gradient, plus a 140×36 px arc from `hud.hurtFrom()`.
- Cath's hurt sound is `audio.hitFlesh()`, the same one enemies use.
- Regen restores 6% of max HP per second, 5 s after the last hit (`session.ts:842`).
- `post.ts` already has a GradeShader with `uDrama`, `uFlash`, vignette and edge CA. Hit-stop exists only for melee (`hitStop = 0.07`).
- Checkpoints live in `sim/save.ts` (`checkpointId`, Rng state).
- HUD sizes are fixed CSS px. Tokens are in `styles/tokens.css`: `--blood #c8102e`, `--blood-hot #ff3b55`, `--cyan #2ee6ff`, `--amber #ffb347`, `--night #07080b`, `--ink #ebe6dc`.

**Hard constraints:**
- WebGL2, no WASM.
- CSP: no `style=""` and no `<style>`. JS sets values only via `el.style.setProperty('--x', …)` and classes.
- Self-hosted assets only, all procedural or CC0.
- Targets: desktop up to 5K (2560×1440 CSS at DPR 2) and iPhone 17 Pro Max (956×440 CSS landscape at DPR 3).

---

### 0. The rename

- **New title: MOTHER'S RUIN.**
  - The phrase is old slang for gin. It fits a classy mum, British, menacing and noir.
  - A web search found no game with this name. The release checklist should still include a USPTO/EUIPO/UKIPO/Steam search; log the result in `DECISIONS.md`. If that search finds a clash, the fallback is **STRIKETHROUGH**, which needs no change to the motifs below.
- **Logotype.** Built as code-drawn SVG, not live text, so it renders the same everywhere.
  - Face: Bodoni Moda at opsz 96, weight 560, all caps, tracking +0.08 em. "MOTHER'S" sits on top and "RUIN" below, 1.6× larger.
  - The apostrophe is replaced by a small blood-red (`--blood`) teardrop glyph. This is the brand mark: favicon, loading spinner and death-card bullet.
  - A 1 px `--blood-hot` underline rule runs under "RUIN". On the death screen and loading screens, this is the rule that bleeds.
- **Strikethrough motif.** Names on the list are crossed off with a hand-drawn SVG stroke (`stroke-dasharray` animation, 600 ms, `cubic-bezier(.6,0,.2,1)`). Cath's list is the spine of the front door (section 9).
- **Code changes:**
  - Move the URL from `/cathode/` to `/mothers-ruin/`. Add a `vercel.json` redirect from `/cathode/*` (301) and keep it permanently.
  - Update the landing card, `<title>`, `aria-label`s, `site/` copy, and the copy in `docs/design/cathode.md`. The file is renamed with `git mv` to `mothers-ruin.md`.
  - The code folder `games/cathode/` and the `window.cathode` hook **keep their names**. Renaming them gains nothing and breaks tests. Add an alias `window.ruin = window.cathode`.
  - The save key keeps its name too, so saves survive.
- **Test.** A site e2e check: `/cathode/` redirects to `/mothers-ruin/`, the page `<title>` is "Mother's Ruin", and the string "CATHODE" appears nowhere in rendered DOM text (grep the `dist-site/mothers-ruin/index.html` text nodes in a unit test).

---

### 1. Shared foundations (build first; everything else depends on them)

#### 1.1 HUD unit and safe frame (`styles/tokens.css`)
```css
:root {
  --u: max(0.62px, min(calc(100vh / 1080), calc(100vw / 1920)));  /* 1u = 1 px at 1080p */
  --safe-x: max(env(safe-area-inset-left), calc(100vw * .04));
  --safe-y: max(env(safe-area-inset-top), calc(100vh * .045));
}
.hud-frame { position: fixed; inset: var(--safe-y) var(--safe-x); max-width: calc(100vh * 16 / 9); margin: auto; }
```
- Every HUD and menu size becomes `calc(var(--u) * N)`.
- A lint rule (extending `scripts/font-budget.ts`'s CSS checks) fails on raw `px` in `games/cathode/src/styles/**`. Exceptions: 0/1 px hairlines, and lines marked `/* px-ok */`.
- Resulting scale: 5K (1440 CSS tall) gives 1u = 1.333 CSS px = 2.67 physical px. Phone at 440 tall gives 1u = 0.62 px, set by the floor.

#### 1.2 Time-scale controller (`src/game/timescale.ts`, pure, unit-tested)
- One owner of `simScale`, replacing the ad-hoc `killcam.timeScale * run.timeScale` and `hitStop`.
- API: `push(id, scale, holdMs, rampInMs, rampOutMs, priority)`. The lowest active scale wins, and ties go to the higher priority.
- `hitStop(ms)` is `push(scale 0, hold ms, ramp 0, 0)`.
- Rendering, audio, the viewmodel springs and UI always run on real `dt`.
- Tests:
  - Overlapping pushes resolve to the minimum.
  - Ramps are monotonic.
  - A `hitStop` inside a slow-mo returns to the slow-mo, not to 1.0.
  - The total is bounded: no push longer than 3 s except during the death sequence.

#### 1.3 Audio buses (`audio.ts`)
- Current graph: `master → compressor → out`.
- Add five buses:
  - `world`: every world sound passes through a lowpass `muffle` BiquadFilter and the reverb send.
  - `player`: Cath's body (breath, heartbeat, grunts). Dry, no muffle.
  - `ui`: dry, never muffled, never ducked.
  - `music`
  - `dry`: hit ticks.
- One `AudioState` object drives the filters from data:

  | Field | Range | Effect |
  |---|---|---|
  | `muffleHz` | 22000 to 400 | world lowpass cutoff |
  | `worldGain` | | |
  | `tinnitus` | 0 to 1 | |
  | `heartbeatBpm` | 0 or 55 to 120 | |
  | `breath` | 0 to 1 | |
  | `duck` | dB | |

- Values are set with `setTargetAtTime(v, now, τ)`, using τ = 40 ms for attacks and 400 ms for releases.

#### 1.4 The Vitals pass (`render/post.ts`, extend GradeShader; no new full-screen pass on phone)
- New uniforms:
  - `uWound` (0 to 1): persistent low-HP intensity.
  - `uHurt` (0 to 1): per-hit flash envelope.
  - `uHurtDir` (vec2): screen-space direction of the last hit.
  - `uDeath` (0 to 1).
  - `uPulse`: a heartbeat phase, 0 to 1 per beat.
  - `uRegen` (0 to 1).
  - `uBloodTex`: a 512² procedural lens-blood mask.
  - `uLens` (vec4): 4 blood-splat slots, as atlas cell plus age.
- Pseudocode, added after tone-map and before grain:
```glsl
float r = length((vUv - .5) * vec2(uRes.x/uRes.y, 1.));         // aspect-correct radius
float inner = mix(.75, .42, uWound) - uPulse*.035*uWound;        // vignette closes, beats
float vig = smoothstep(inner, inner + .45, r);
vec3 lum = vec3(dot(c, vec3(.2126,.7152,.0722)));
float keepCentre = 1. - smoothstep(.15, .55, r);
c = mix(c, lum, uWound*.7*(1.-keepCentre*.5) + uDeath*.95);     // desat, centre keeps colour
c = mix(c, c*vec3(1.,.25,.22), uDeath*.6);                      // drain to red-black
c = mix(c, vec3(.42,.02,.04), vig*(.55*uWound + .35*uHurt));     // blood edge
float dirLobe = max(0., dot(normalize(vUv-.5), uHurtDir)) * uHurt;
c += vec3(.8,.05,.05) * dirLobe * smoothstep(.25,.7,r) * .6;     // edge flash on the hit side
c *= 1. - uDeath*smoothstep(.2, .9, r + uDeath*.6);              // close to black
```
- Edge chromatic aberration already exists. Scale its strength by `1 + 2*uWound + 3*uHurt` (1 to 3 px at 1080p, multiplied by `uRes.y/1080`).
- **Radial blur:** 6 taps toward the centre, weight `uWound*.6 + uDeath`. Desktop high and ultra only. On phone, use the CA alone.
- **Lens blood:** a procedural canvas texture generated once at boot: 8 splat shapes from fBm metaballs plus drip streaks, red channel = thickness.
  - Sampled by the 4 `uLens` slots.
  - Refraction: offset `vUv` by the mask gradient ×0.004. Darken by thickness and add a `--blood-hot` specular edge.
  - Each slot ages from 0 to 1 over 1.8 s: alpha `1 - age²`, a downward drip of `0.06*age`.
  - Reduced-gore mode puts nothing in these slots and uses a smeared grey "rain on lens" texture instead.
- **Cost budget:** iPhone at most +0.6 ms GPU at 0.75 internal scale; desktop 5K at most +0.4 ms. Profile with `EXT_disjoint_timer_query_webgl2` in `?perf`.

#### 1.5 Screen-shot and test hooks
- Every visual state in this spec is reachable deterministically with `?shot` (frozen time) plus one of:
  - `&vitals=hp:0.25,hurt:0.8,dir:120`
  - `&death=1200` (ms into the death sequence)
  - `&front=title|gate|classpick|loading:<district>|pause|deathcard`
- All are implemented in `main.ts` so the screenshots need no gameplay driving. This matters because swiftshader renders gameplay at about 3 fps.
- `scripts/cathode-shots.mjs` gains a `--vitals` set covering three viewports:
  - 2560×1440 at DPR 2 (screenshots only; swiftshader is fine for frozen frames)
  - 1440×900 at DPR 1
  - 844×390 at DPR 3

---

### 2. The damage model (rules, `src/sim/vitals.ts`, pure)

Replace "HP plus 5 s regen at 6%/s" with **Guard + Flesh**, the FPS-RPG standard (Halo shield over Doom health):

| Layer | Default (Operative, Normal) | Regen | Restored by |
|---|---|---|---|
| **Guard** (cyan) | 40% of today's `maxHp` | delay 4.0 s after the last hit, then full in 2.0 s (ease-in-out) | itself |
| **Flesh** (red) | 60% of today's `maxHp` | **none** above the "bleed floor" | stims, takedowns (+15%), Second Wind kill (+30%), checkpoints |
| Bleed floor | Flesh regenerates up to 25% of max, at 3%/s after 6 s, so a player is never stranded at 1 HP | | |

- Total effective HP equals today's `maxHp`, so `BALANCE.md` difficulty stays roughly the same.
- Skills that grant HP add to Flesh. Armour stat reduces Flesh damage only.
- **Overflow:** damage to Guard that exceeds the remaining Guard carries into Flesh. The frame Guard breaks is its own event (`guardBreak`), with its own feedback (3.4).
- **Wound tiers**, derived purely from `flesh/maxFlesh`:

| Tier | Flesh | Visuals | Audio | Gameplay |
|---|---|---|---|---|
| `fine` | above 60% | none | none | none |
| `hurt` | 30 to 60% | `uWound` = 0 to 0.35 | breath 0.3 | none |
| `critical` | 10 to 30% | `uWound` = 0.35 to 0.85, heartbeat | heartbeat 80 to 110 bpm, muffle 6 to 2.5 kHz | weapon sway ×1.6, ADS takes 20% longer |
| `bleeding` | below 10% | `uWound` 0.85 to 1, lens blood stays | heartbeat 120 bpm, muffle 1.5 kHz | sprint disabled, leaves floor blood decals every 1.2 m |

- **Directional data:** each hit records `{bearingDeg relative to camera yaw, pitchDeg, amount, kind: bullet|melee|blast|laser|fall, sourceId}`.
  - `bearingDeg` is recomputed every frame while the indicator is visible, from the stored world position of `sourceId`.
- **Tests** (`tests/cathode-vitals.test.ts`):
  - Overflow arithmetic.
  - Guard regen delay is reset by any hit, including 0-damage ones.
  - The bleed floor never pushes Flesh above 25%.
  - Tier boundaries.
  - The bearing math: an attacker at world +X with the camera facing −Z gives 90°.
  - Second Wind eligibility (section 5).
  - A seeded 10-minute fight sim stays within ±10% of today's time-to-death for each difficulty. This is a regression guard for `BALANCE.md`.

---

### 3. Taking a hit

All layers fire on the frame the hit is applied. Only Cath's grunt has a cooldown.

#### 3.1 Directional indicator (`ui/hud.ts`, SVG)
- **Shape:**
  - One SVG ring, 0 to 4 arcs, centred on the crosshair.
  - Radius `calc(var(--u)*190)` at 1080p (about 18% of viewport height).
  - Each arc spans 38° and is a wedge 14u thick at the centre, tapering to 2u at the ends: a path with feathered ends via a `<linearGradient>` stop.
- **Fill:** `--blood-hot`, opacity `0.45 + 0.55*min(1, amount/(0.25*maxTotal))`. Plus an inner 2u `--on-blood` core line for the first 120 ms.
- **Timing:**
  - In: 0 ms (no fade-in), scale from 1.15 to 1.0 over 90 ms.
  - Hold 600 ms with live angle tracking.
  - Out: 600 ms ease-out.
  - A repeat hit from the same source restarts it; there are up to 4 concurrent sources.
- **Above and below** (pitch more than 35° or less than −35°): the arc becomes a chevron at the top or bottom edge of the safe frame.
- **Kinds:**
  - `melee`: a full-edge flash on that side. A 40u-deep gradient on the whole edge, 250 ms.
  - `blast`: an amber (`--amber`) arc plus the tinnitus event (3.3).
  - `laser`: a cyan arc.
  - Grenade nearby, not yet exploded: a grenade glyph in a 44u circle at the ring edge, pointing toward it, pulsing at 4 Hz.
- **Accessibility:** the colour-blind palette (`tokens.css:143`) already remaps `--blood-hot`. In that mode the arc also gets a 2u white outline.

#### 3.2 Camera and viewmodel response (`player.ts`, `viewmodel.ts`)
- **Camera flinch:** a critically-damped spring (ω = 2π·9 Hz, ζ = 0.55) on pitch, yaw and roll offsets. It is added after aim and never moves the aim vector, so it is purely visual and accuracy stays fair.
  - Impulse per hit: rotate away from the source. Yaw is ±3.0°·k and pitch is +1.5°·k, where `k = clamp(amount/(0.1*maxTotal), 0.4, 1.6)`. Roll is 1.2°·k toward the hit side.
  - Melee doubles k. Blast adds a 0.25 s positional shove of 6 cm.
- **Trauma:** +0.18·k per hit, using the same trauma system as weapon fire. Shake = trauma² × (1.8° rot, 0.8 cm), with 20 Hz value noise, decaying 1.6/s.
  - The reduced-motion pref clamps trauma to 0.3 and turns off roll.
- **Viewmodel jolt:**
  - The gun dips 2.5 cm and rolls 4° away from the hit side, on the viewmodel's existing springs.
  - In `critical` and worse, the support hand leaves the grip for 350 ms on every third hit, about 15 cm toward the chest: IK target at the sternum, then a return blend over 250 ms. This is the "clutching the wound" beat, and it costs no animation authoring.
- **Gamepad:** `vibrationActuator.playEffect('dual-rumble', {duration: 160+80k, strongMagnitude: .5+.25k, weakMagnitude: .3})`.

#### 3.3 Screen per hit
- `uHurt` envelope: attack 0 ms to `0.35+0.25k`, then decays with τ = 160 ms. `uHurtDir` comes from the bearing.
- **Lens blood** (gore on): spawn one splat in the `uLens` slot nearest the hit side if `k ≥ 1`, or on every melee hit. At most 1 per 400 ms.
- **Guard break frame:**
  - A cyan glass-shatter overlay: 12 triangle shards as SVG polygons, each flying 30 to 80u outward with 180° spin over 380 ms, opacity from 0.9 to 0.
  - Plus a 1-frame `--cyan` rim flash at 0.25 opacity.
  - The Guard bar empties with a crack glyph.
- **Blast within 6 m:**
  - `tinnitus = 1`: a 4.8 kHz sine at −20 dBFS on `player`, decaying linearly over `2 + 3*(1-d/6)` s.
  - `muffleHz` drops to 500 Hz, then recovers along `setTargetAtTime` τ = 0.9 s.
  - `uWound` is bumped by +0.25 for 1.5 s.

#### 3.4 Audio per hit (all synthesised, `audio.ts`)
Cath gets her own sounds; `hitFlesh()` stays for enemies.

| Layer | Recipe | Bus |
|---|---|---|
| Impact | Bullet: pink noise burst, bandpass 900 Hz, Q 1.2, 70 ms, plus a sine at 90 Hz falling to 55 Hz over 110 ms. Melee: plus a 40 ms low-passed (400 Hz) clap. | player |
| Grunt | A formant-filtered breath: a noise source through 3 parallel bandpass filters at F1 650, F2 1100 and F3 2800 Hz (an "uh" vowel), 140 ms, pitch-jittered ±6%. Cooldown 700 ms. Three variants: `hurt`, `strain`, `gasp` (see 3.5). | player |
| Guard hit | A glassy "tick": 2.6 kHz and 3.9 kHz sines, 50 ms, plus filtered noise at 6 kHz. | player |
| Guard break | A descending FM sweep from 1.8 kHz to 300 Hz over 260 ms, plus 6 granular glass ticks scattered over 200 ms. | player |
| Incoming whiz-by | Near misses within 1 m: noise bandpassed at 3 kHz, with Doppler (the playbackRate envelope rises then falls), panned to the miss side, 120 ms. | world |

- **Mix rule:** on a Flesh hit, `duck` music −4 dB for 300 ms.

#### 3.5 Wounded loop (continuous)
- **Heartbeat** (tier `critical` and worse):
  - Two sine thumps per beat: lub at 55 Hz for 90 ms, then dub at 48 Hz for 70 ms, 110 ms later. Each has a 4 ms attack.
  - BPM is `lerp(80, 120, w)`.
  - `uPulse` is driven from the same scheduler (AudioContext time mapped to frame time), so the vignette visibly beats in sync. A unit test checks the phase mapping.
- **Breath:**
  - A looped noise source, bandpass 500 Hz (exhale) / 1.4 kHz (inhale).
  - Rate is 0.3 Hz when fine and 0.9 Hz when bleeding, gain `0.25*breath`.
  - The mixer ducks it under gunfire.
- **World muffle:** `muffleHz = lerp(22000, 1500, w)` on an exponential curve.
- **Camera:** at `bleeding`, add a roll wobble of ±1° at 0.3 Hz and a 0.4% FOV breathe in sync.
- **HUD:**
  - Flesh bar pulses scale-Y 1.0 to 1.15 on the beat.
  - The numeral turns `--blood-hot`.
  - The bar's lost segment is drawn as a 2-step "damage ghost": a white trail that shrinks after a 350 ms delay over 400 ms. This is the fighting-game convention and makes every hit legible.

#### 3.6 Recovery telegraph (as important as the hurt)
- **Guard regen starts** (after the 4 s delay):
  - A sharp inhale grunt variant: noise at 1.6 kHz with a 120 ms rise.
  - A rising sine sweep from 220 Hz to 880 Hz over 1.8 s on `player`, at −14 dB.
  - The Guard bar refills with a moving cyan highlight.
  - `uRegen` drives a 300 ms cyan inner-edge wash at 0.15 opacity.
  - `uWound` eases toward its new tier target over 1.2 s instead of snapping.
- **Guard full:** a 2-note chime, 660 Hz then 990 Hz, 90 ms each.
- **Stim used:**
  - A 700 ms green-white edge wash (`--green` at 0.2).
  - Heartbeat BPM drops by 30 over 2 s.
  - The lens blood wipes off from left to right over 500 ms. Implementation: a mask threshold sweep, as if Cath wiped her eyes.

---

### 4. Viewmodel and body support for the hurt states

Cath's hands are the face of the hurt in first person, so they must exist (the weapons spec rebuilds them).

**Construction approach** (shared with the weapons spec):
- **Geometry:**
  - `ExtrudeGeometry` with `bevelEnabled` (bevelSize 0.6 to 1.5 mm, bevelSegments 2 to 3) from 2D `Shape` profiles, for slides, frames and glove panels.
  - `LatheGeometry` for barrels and knuckles.
  - Hands: a skinned mesh is not needed. Use 19 rigid parts (phalanges as bevelled capsules from `CapsuleGeometry` scaled 1:0.85:0.7) parented in a joint hierarchy. Fingers use 1-DOF hinge constraints posed by a grip-curl scalar per finger.
  - Glove: dark leather (`MeshPhysicalMaterial`, roughness 0.55, sheen 0.4, sheenColor 0x3a2a24) with a CC0 leather normal map from Poly Haven, `leather_red_02` at 1K, desaturated in a canvas at load. Seam stitches are a procedural line normal map baked at boot into a 256² CanvasTexture.
- **Wound states on the hands:**
  - Below 30% Flesh: blood smears on the glove back. A second mask texture is blended through `onBeforeCompile` with a `uBloodiness` uniform. Roughness drops to 0.2 under the wet blood.
  - Bleeding: a wet drip particle off the support wrist every 1.5 s.
- **LOD:** the viewmodel has no LOD; it is always near. Budget: 9k triangles for the pistol plus hands, 3 materials plus 1 blood mask, 1 draw call per material via `mergeGeometries` of static parts.

---

### 5. Going down: Second Wind (one per checkpoint)

- **Trigger:** lethal Flesh damage while `secondWindReady`. Hellweek difficulty disables it. A skill can grant a second charge.
- **Timeline:**

| t (ms) | Event |
|---|---|
| 0 | Hit-stop 140 ms. `uHurt` = 1. Flesh is set to 1. The camera drops 35 cm and rolls 12° over 220 ms (Cath is on one knee). |
| 140 | `timescale.push(0.3, 4000)`. Every live enemy gets a 2u `--blood-hot` screen-space outline (an inverted-hull mesh scaled 1.03 in normal direction, `depthTest:false`, from the enemy body segments). The world goes 90% greyscale except the outlines and the muzzle flash (`uDeath` = 0.4 path with an enemy-mask exception via a stencil bit). |
| 140 to 4140 | The player can aim and fire at normal *real-time* fire rate (the weapon uses real dt). Heartbeat at 40 bpm, deep. Music cuts to a single held low drone (55 Hz saw, lowpass 300 Hz). Big mono text "SECOND WIND" in Rajdhani 700, 28u, letter-spacing 0.4em, `--blood-hot` at 0.6, top-centre, plus a 1u timer line that drains over 4 s. |
| Kill within window | Flesh +30%, a takedown-style sting, `timescale` ramps to 1 over 400 ms, colour returns over 600 ms, the outlines fade over 200 ms. |
| No kill by 4140 | Death sequence begins (section 6) from its t = 400 ms state, skipping the duplicate hit-stop. |

- **Tests:**
  - Eligibility (once per checkpoint, reset on checkpoint).
  - A kill during the window revives.
  - The real-time fire rate is unaffected by `simScale`: assert shots fired per real second.

---

### 6. Death sequence (target: 3.0 s to the card, 1 key to retry)

The first-person camera becomes a physical body cam. No cut, no modal.

| t (ms) | Camera and body | Screen | Audio |
|---|---|---|---|
| 0 | Hit-stop 120 ms. | `uHurt` 1, a lens splat on the hit side | Impact plus a hard "gasp" grunt, then all music cuts to silence (−∞ over 80 ms) |
| 120 | `timescale.push(0.25, 1400, ramp 0, out 600)`. **Camera detaches** into a Verlet mini-body: 3 particles (head, chest, hips) seeded from the player capsule and its velocity, plus the killing impulse (0.6 to 2.0 m/s along the shot). The camera rides the head particle and looks along the chest→head vector, plus a look-at bias of 40% toward the killer. | `uDeath` ramps 0 to 0.35 over 600 ms. CA up 3×. | World `muffleHz` from 22k to 900 Hz over 300 ms. Tinnitus 1.0. Heartbeat starts at 50 bpm. |
| 120 to 900 | The body folds: knees first (hips drop 0.5 m), then the chest falls forward or back depending on the hit side. The camera rolls 60 to 80° as the head particle lands, clamped by a ground plane 0.12 m. **The viewmodel drops away**: the gun detaches, falls with a spin, and is rendered by the world scene so it clatters into view on the floor at 500 to 800 ms (reuse the casing physics; `audio.casing` pitched down 2 octaves). | Lens blood: 2 more splats. FOV narrows from 75° to 62°. | Each beat 30% slower. Breath: one long exhale. |
| 900 to 1800 | Settled. The camera holds, with a 0.4°/s slow drift. If the killer is alive and within 25 m, it is framed. Its visor emissive flares ×2, and it plays a "lower weapon" pose (the enemies spec owns the pose). | `uDeath` 0.35 to 0.8. The vignette closes to black from the edges. Letterbox bars (2.39:1) slide in over 500 ms. | The last two heartbeats, then nothing. Tinnitus fades. A single held piano-like note (sine plus 2nd/3rd harmonics, 2.5 s decay, A2) as the "moment". |
| 1800 to 2600 | Frozen frame: `?shot`-style time freeze of the world. | **Red ink bleed:** a procedural fBm mask texture (one 512² canvas, animated threshold) floods inward from the edges in `--blood` at 0.85 opacity over 800 ms. The frozen frame stays visible through the centre. | Rain bed returns, muffled, at −18 dB. |
| 2200 | | **Death card** fades in over 300 ms (6.1). | UI sting: low cello-like FM tone. |

- **Skip:** any input after 900 ms jumps straight to t = 2200 (the card).
- **Reduced violence:** no lens blood; the ink bleed is `--night-3` grey-black, not red.
- **Reduced motion:** no roll; the camera slides down 0.8 m and holds.

#### 6.1 The death card (DOM, `ui/deathcard.ts`)
- **Layout:** left-aligned, inside the 16:9 safe frame, over the bled frame.
  - Eyebrow (Rajdhani 700, 15u, tracking 0.32em, `--ink-3`): `FILE CLOSED · 02:14 · THE FISH MARKET`.
  - Headline (Bodoni Moda italic, 88u, `--ink`): one Cath line, picked by cause and context from 24 lines in `voice.ts`. Examples: *"Not tonight, love."*, *"Mind the glass. Mind everything."*, *"School run's at eight. Get up."*
  - The 1u `--blood-hot` rule from the logotype, 360u long, drawn in over 400 ms.
  - Mono stats (JetBrains Mono 15u, `--ink-2`): `KILLED BY  HOLLOWELL ENFORCER · 14 M · RIFLE`, `DAMAGE TAKEN  212`, `NAMES LEFT  3`.
  - Actions:
    - `RETRY FROM CHECKPOINT`: Enter, A, or tap anywhere on the left half. Primary style.
    - `QUIT TO TITLE`: Esc or B. Ghost style.
  - **No "Game Over".**
- **Motion:** each element rises 12u and fades in, staggered 60 ms apart.
- **Hover:** a 2u `--blood` bar slides in from the left (120 ms), the label goes from `--ink-2` to `--ink`, tracking +2%, plus the UI tick.

#### 6.2 Retry flow: no page reload
- Delete `location.reload()`. Add `session.restartFromCheckpoint()`:
  - Restore `sim/save.ts`'s checkpoint: `checkpointId` position, Rng state, character and inventory snapshot, and the enemy roster for the current job.
  - Despawn all bodies, decals, particles and pickups through the existing fx caps.
  - Rebuild only the job's dynamic state. The world, textures and shaders stay warm.
  - Budget: under 250 ms on iPhone.
- **Re-sync transition** (900 ms total):
  - The ink recedes over 300 ms.
  - Then 250 ms of a cyber-glitch: horizontal slice offsets (8 bands, ±2% width, random each 33 ms), RGB split 6 px→0, scanlines. This is a new `uGlitch` term in the Vitals pass.
  - Then a fade from black over 350 ms into first person, already holding the checkpoint weapon.
  - A cyan mono line "RE-SYNCED · CHECKPOINT 2" in the top-left for 2 s.
- **Total:** from the Retry press to control is under 1.2 s. From death to control is under 4.5 s if the player skips the sequence.
- **Tests:**
  - Unit: `restartFromCheckpoint` yields a state deep-equal to a fresh resume from the same save, apart from `deaths++` (test in `tests/cathode-save.test.ts`).
  - Unit: the death timeline function `deathState(tMs)` returns monotonic `uDeath` and the card's visibility at 2200.
  - e2e (`?2d` isn't available for this game, so drive with `?play` and `window.cathode`): set hp to 1, apply lethal damage with a test hook, wait, then assert that `.death-card` is visible, Enter restores `hp > 0`, `performance.navigation` has no reload, and `window.cathode` is the same object identity.

---

### 7. The front door

**Principles from the brief:**
- A live place with Cath in it.
- Progress is remembered.
- Start is a camera move.
- Three faces with strict jobs: Bodoni for story, Rajdhani caps for system text, JetBrains Mono for data.
- 3 to 5 items, kept in fixed positions.
- Sound on every focus change.
- Transitions within 150 to 300 ms.

#### 7.1 The menu scene (`render/frontscene.ts`)
- A reduced instance of the Drowned Market renderer, reusing `level.ts`, `atmosphere.ts` and `lighting.ts`.
- **Camera:** dollies on a 36 s Catmull-Rom loop through 4 framings around the fish-market pier, at FOV 38° (a longer lens reads cinematic). Mouse or gyro parallax ±1.5° yaw and ±1° pitch through a 2 Hz spring.
- **Cath in 3D, as a silhouette-first figure.** The rim light carries the detail, so the triangle budget stays low.
  - Body: the `body.ts` segment rig with Cath's own proportions, from the `shared/cath/` character bible measurements.
  - Mesh:
    - A long belted trench coat built from 3 `LatheGeometry` skirt rings. Cloth sway uses a 2-row Verlet strip (12 particles) pinned to the hips and driven by wind.
    - A bob haircut as a bevelled extrusion.
    - A heel-and-boot lathe.
    - An umbrella: a lathe canopy with 8 rib cylinders and rain-runoff particles off the rim.
  - Material: `MeshPhysicalMaterial` coat, roughness 0.45, clearcoat 0.6 for wet. Lit almost entirely from behind by a `--neon-pink` sign (RectAreaLight on high and ultra, a spot on phone) plus a cool `--cyan` fill.
  - Idle: breathing (0.25 Hz chest scale 1.5%), a weight shift every 7 to 11 s, a cigarette ember (emissive sphere plus smoke billboard) on raise and lower every 14 s.
  - Budget: 14k triangles.
- **Rain on the lens:** reuse the lens-blood texture path with a water mask. 6 drops slide down.
- **Progress set pieces**, keyed off `progress.jobsDone`:
  - Fish Market done: the pier's sign is dark, and a chalk tally is on the wall decal.
  - Plaza done: the camera loop moves to the plaza.
  - Each later district: its landmark is in the background skyline.
  - Never shows an unreached place.
- **Cost:**
  - 0.75 internal scale on phone, 30 fps cap; 60 fps on desktop. DPR capped at 1.5 at 5K.
  - No GTAO.
  - The scene keeps running behind the class pick and settings, and is paused (one last frame kept) behind loading.

#### 7.2 Cold open and age gate
1. **0 to 1200 ms:** black.
   - Rain fades in from −∞ to −20 dB over 1.2 s.
   - A 60 Hz city rumble.
   - One centred Bodoni italic line, 34u: *"Everyone's got a list. Mine's just shorter every night."* Fades in over 600 ms.
2. **1200 to 2600 ms:** the scene fades up from black behind the line, with letterbox bars on.
3. **Gate card** (first visit only, stored in prefs): a bottom-left plate (`--panel` at 0.86 with a 1u `--line-2` rim and the existing `--cut` corner shape) over the live scene. It is not a centred modal.
   - A stamp-style "RATED 18" plate: Rajdhani 700, 22u, a 2u `--blood` border rotated −4°, with an SVG roughness filter. It is not a PEGI or BBFC mimic.
   - The content line.
   - Two large switch tiles, `FULL` and `REDUCED` (each 260u×120u, with a Bodoni label and a mono description). Arrow keys or tap switch between them.
   - `ENTER` to confirm.
4. **Accept:**
   - The card wipes away right-to-left with the ink-mask threshold (450 ms).
   - The letterbox bars ease from 2.39:1 to 2.0:1 (600 ms).
   - The logotype draws in: the strokes reveal over 900 ms with `stroke-dashoffset`, then the fill fades in.
   - Delete the chibi SVG Cath from the gate and title. She stays only where the character bible says the 2D art belongs, outside the R-rated front door.

#### 7.3 Title
- **Layout** (16:9 safe frame, left column 34% wide):
  - Logotype: 120u cap height at the top-left of the column.
  - **Live subtitle**, Rajdhani 600, 17u, tracking 0.24em, `--ink-2`: `HOLLOWELL PROPER · 2079 · 3 NAMES LEFT`.
  - Menu (Rajdhani 700, 34u, tracking 0.12em, uppercase, 64u row pitch): `CONTINUE` (only with a save) · `NEW CASE` · `SETTINGS` · `CREDITS`. Positions are fixed: `CONTINUE` is a reserved slot that is empty without a save.
  - Quiet top-left `Games` back link (`studioBack`), inside the safe frame. This fixes the phone overlap.
  - Bottom-left: `THE LIST`, a column of the 5 names in Bodoni 22u. Dealt-with names are struck through and `--ink-3`. The next name has a 1u blinking-free `--blood-hot` caret.
  - Bottom-right: the build version in mono 12u at `--ink-dim`.
- **Focus:**
  - The 2u `--blood` rule slides in from the left (160 ms).
  - The label goes from `--ink-2` to `--ink` and gains +2% tracking.
  - The focused row shows a one-line mono hint at 13u, `--ink-3`, for example `RESUME · THE FISH MARKET · CHECKPOINT 2`.
  - A UI tick plays: 1.2 kHz sine plus noise, 25 ms, −22 dB.
  - The camera biases 0.5° toward the focused row (subtle aliveness).
  - Mouse, arrow keys, WASD and gamepad all move the same focus. Esc goes back.
- **Confirm:**
  - The label flashes `--on-blood` on `--blood` for 1 frame.
  - A confirm sound: 2 sines a fifth apart, 70 ms, plus a sub thump.
- **Continue / New Case is a camera push**, not a page change:
  - The UI fades over 400 ms.
  - The camera flies along a precomputed spline past Cath into the street (1.6 s, smootherstep).
  - A low synth swell plays (saw pad, lowpass from 200 Hz to 2 kHz).
  - Loading happens during the push. If loading isn't done when the push ends, the push ends on the loading screen (7.5), which is shown over a frozen final frame.
  - On arrival: a cut to first person with a 300 ms fade from black, then the area title.
- **Area title:** "THE FISH MARKET" in Rajdhani 700, 44u, tracking 0.5em, centred upper third, with a Bodoni italic sub-line *"Drowned Market, low tide"* at 22u. In 400 ms, hold 2.2 s, out 600 ms.
- **Ambience:** rain bed, distant traffic (the existing traffic synth), a buzzing sign hum at 120 Hz with 2nd and 3rd harmonics, from the sign's position, and a slow minor pad (2 detuned saws, lowpass 900 Hz, 8 s chord changes, Am, Fmaj7, Dm9, E7sus).

#### 7.4 Class pick: wardrobe and dossier
- The camera cuts to a close 3-quarter framing of the 3D Cath under a key light that changes per class: Operative cyan, Fixer amber, Wetwork `--blood`. The light transition takes 400 ms.
- She plays a class idle:
  - Operative: a press-check of the pistol.
  - Fixer: straightens her cuffs.
  - Wetwork: rolls her neck.
  - Each is a 1.2 s keyframed pose on the segment rig, with 2-bone hand IK.
- **Left:** three class names in Bodoni 56u, the focused one at `--ink` and the others `--ink-3`.
- **Right** (fills the 40% that was empty at 5K): a mono stat sheet. Each stat bar is 1u tall with 6u ticks and counts up from 0 over 350 ms when the class changes. Plus a voice line in Bodoni italic.
- **Commit:** a press-and-hold `--blood` bar, 600 ms. The stroke fills, the heartbeat thumps twice, and release before the end cancels it. Tap-and-hold on phone.

#### 7.5 Loading: the case file
- **Background:**
  - A full-bleed key-art frame rendered from the game's own scene: the destination district's establishing camera, rendered once into a `WebGLRenderTarget` while the district loads.
  - Treated with a duotone shader (shadows `--night`, highlights `--ink` with a hint of the district's signature colour), halftone (a 4u dot grid at 15°), film grain, and a 6% Ken Burns push over 20 s.
- **Left:** the target's case file.
  - A halftone portrait plate of the next name: their enemy-rig model under a top light, rendered to texture, 1:1.25 aspect.
  - The name in Bodoni 72u.
  - District in Rajdhani 18u with tracking 0.4em.
  - One lore paragraph in Bodoni 20u, at most 55 words.
  - **No control tips.**
- **Progress:** the logotype's 1u rule under the name, filled by an ink bleed. Mono `47%` in 12u at the far right, interpolated smoothly (never jumps more than 4%/frame).
- **The List, bottom-right:** the dealt-with names get the 600 ms strike-through animation the first time they appear struck.
- **Ready:** `PRESS ANY KEY` in Rajdhani 15u, tracking 0.4em, at an opacity pulse of 0.55 to 1 at 0.5 Hz (no blinking). Shown only if the load took more than 2.5 s; otherwise it continues automatically.
- **Load kinds:**
  - Travel: a cyan circuit-trace sweep across the progress rule.
  - Retry after death: none (6.2 skips loading).
  - First boot: the cold open.
- **Never spoil:** the portrait and art come only from reached content. Unit test: the `loadingCard(progress, target)` selector never returns an unvisited district's art id.

#### 7.6 Pause
- **Opening (200 ms):**
  - The world sim stops via `timescale.push(0, ∞)`. Render keeps the last frame.
  - The Vitals pass gets `uPause`: desaturate 85%, a 9-tap blur (desktop) or 5-tap (phone) over 200 ms, tint toward `--night` by 40%.
  - `muffleHz` goes to 700 Hz and the music ducks −8 dB.
- **Left column:** `RESUME` · `CASE BOARD` · `CHARACTER` · `SETTINGS` · `QUIT TO TITLE`, styled as the title menu.
- **Right:** a pinned case note, a `--plate` card rotated 1.5° with a cyan pin glyph. It holds the current objective in Bodoni 26u, plus district, in-city time and names left in mono.
- **Breadcrumb** in sub-screens: `PAUSE / SETTINGS / AUDIO` in mono 13u.
- `Esc` toggles and backs out; it never needs more than one press to resume from the top level.
- Keep today's rule that the pause card is not shown under webdriver, and add `?front=pause` for screenshots.

#### 7.7 Settings additions
- `Damage effects: Full / Reduced / Minimal`. Minimal: no CA, no blur, vignette ×0.5, indicator kept.
- `Camera shake 0 to 100%`.
- `Heartbeat audio on/off`.
- `Hit-stop on/off`.
- `HUD scale 80 to 130%`, which multiplies `--u`.
- `Colour-blind palette` (existing).
- **Presets:** "Vision", "Hearing" and "Motion", in the TLOU2 style.
- **Tests:** prefs unit tests in `tests/cathode-prefs.test.ts`.

---

### 8. Performance budgets

| | iPhone 17 Pro Max | Desktop 1440p | Desktop 5K |
|---|---|---|---|
| Target | 60 fps gameplay at 0.75 internal scale; 30 fps front door | 60 to 144 fps | 60 fps; internal scale 0.7 to 1.0 by dynamic resolution, DPR cap 1.5 for 3D |
| Vitals pass | at most 0.6 ms (no radial blur) | at most 0.3 ms | at most 0.4 ms |
| Death sequence peak | at most 1 extra ms | | |
| Front scene | at most 8 ms GPU, 120 draw calls, 250k tris | at most 6 ms | at most 9 ms at 0.75 scale |
| Cath title figure | 14k tris, 4 materials | same | same |
| New textures | at most 1.5 MB GPU: lens mask 512², ink mask 512², glove normal 1K, key-art RT 1024×576 | key-art RT 1920×1080 | same as 1440p |
| JS heap added | at most 6 MB | | |
| HUD DOM | at most 60 animated elements; transforms and opacity only (no layout thrash); SVG for all glyphs | | |

**Dynamic resolution:**
- Measure GPU frame time with the timer query, where available, or rAF deltas.
- Above 15.5 ms for 30 frames: scale ×0.9. Below 11 ms for 120 frames: ×1.05.
- Clamp to 0.6 to 1.0.
- The HUD is DOM at native resolution and unaffected.

---

### 9. Testing matrix

- **Unit (vitest, pure, `tests/cathode-*.test.ts`):**
  - `vitals` (section 2)
  - `timescale` (1.2)
  - death timeline (6)
  - Second Wind (5)
  - `restartFromCheckpoint` equivalence (6.2)
  - heartbeat phase mapping (3.5)
  - loading-card spoiler guard (7.5)
  - title subtitle text from progress, e.g. "3 NAMES LEFT" (7.3)
  - menu focus model: fixed slots, wrap, Esc back (7.3)
  - prefs (7.7)
  - CSS lint: no raw px (1.1)
- **Screenshots** (`scripts/cathode-shots.mjs`, frozen via `?shot`) at **2560×1440@2x, 1440×900@1 and 844×390@3**:
  - `vitals-hurt` (hp 0.5, hurt 0.8, dir 90)
  - `vitals-critical` (hp 0.2)
  - `vitals-bleeding` (hp 0.05 with lens blood)
  - `vitals-guardbreak`
  - `secondwind`
  - `death-400`, `death-1200`, `death-2600` (card)
  - `resync`
  - `gate`, `title`, `title-continue-focus`, `classpick`
  - `loading-fishmarket`, `loading-travel`
  - `pause`
  - `areatitle`
- **Acceptance per screenshot:**
  - At 2560×1440 the menu column and logotype occupy at least 30% of the frame height, so the screen is no longer an empty island.
  - No text below 12 physical px on phone.
  - No DOM overlap. The Playwright check uses `getBoundingClientRect` pairs for back link, logotype, menu and list.
  - A subagent critiques each set against `VISION.md` and the AAA references above before shipping.
- **e2e** (`?play`, waits of 1 s or more between inputs):
  - Damage hook to directional indicator: the `.hud-dmg-arc` exists, rotated within ±10° of the expected bearing.
  - Lethal damage leads to the death card, Enter leads to control again with no navigation.
  - `/cathode/` redirect.
  - Title, then New Case, then the first-person area title within 6 s on fast hardware (skip the timing in CI).
- **Perf:** `?perf` logs the pass timings. A manual check is recorded in `PROGRESS.md` once per milestone on a real iPhone, if the owner provides one; otherwise rely on the budget arithmetic plus swiftshader relative timing (new pass cost at most 15% of the grade pass cost).

---

### 10. Milestones (each ships alone, in order)

**M1: Foundations + "I know I'm hit"** (about 2 sessions)
- **Scope:** `--u` HUD scaling and the safe frame; `timescale.ts`; audio buses; Cath's own hurt sounds; the directional arc rebuild (3.1); camera flinch, trauma and viewmodel jolt (3.2); `uHurt` plus the hit-side edge flash (1.4 subset).
- **Acceptance:**
  - At 2560×1440@2x, the hurt arc is at least 50 physical px thick and at radius 18% of height.
  - A hit from behind shows a bottom chevron or arc.
  - `hitFlesh` is no longer called for Cath.
  - The unit tests pass.
  - The "no raw px" lint passes on HUD CSS.

**M2: Guard + Flesh and the wounded states** (about 2 to 3 sessions)
- **Scope:** `sim/vitals.ts`; the HUD's two-layer bar with damage ghost; wound tiers with vignette, desaturation, CA and the radial blur; heartbeat synced with `uPulse`; breath, muffle and tinnitus; lens blood; guard-break shatter; regen telegraph; stim wipe; settings for damage effects and heartbeat.
- **Acceptance:**
  - The 4 `vitals-*` screenshots look distinct at all 3 viewports.
  - The fight sim stays within ±10% of today's time-to-death.
  - Regen start is audible and visible within 1 frame of the 4.0 s mark (unit test on the event).
  - iPhone pass budget holds by arithmetic and swiftshader relative timing.

**M3: Death sequence, death card and in-place retry** (about 2 sessions)
- **Scope:** the body-cam fall, viewmodel drop, ink bleed, letterbox and the audio moment (6); the death card with 24 Cath lines (6.1); `restartFromCheckpoint` plus the re-sync glitch (6.2); delete `location.reload()`.
- **Acceptance:**
  - The e2e test passes: death, card, then Enter returns control with the same `window.cathode` and no reload.
  - Death to control in under 4.5 s with skip.
  - The `death-400/1200/2600` and `resync` screenshots pass the critique.
  - The reduced-violence variant shows no red.

**M4: Second Wind** (1 session)
- **Scope:** section 5, including the enemy outlines and the stencil greyscale exception.
- **Acceptance:** the unit tests pass; the `secondwind` screenshot shows red-outlined enemies on a grey world; a kill in the window revives at 30% Flesh (e2e via hook).

**M5: The rename** (1 session; can run in parallel with M1)
- **Scope:** section 0. SVG logotype with the teardrop mark, URL redirect, all copy changes, favicon.
- **Acceptance:** the site e2e redirect passes; no "CATHODE" in rendered text; the trademark search is logged in `DECISIONS.md`.

**M6: Live title scene, cold open and gate** (about 3 sessions)
- **Scope:** `frontscene.ts`, the 3D Cath silhouette figure with coat cloth and umbrella, the rain lens, cold open, the gate plate, the new title layout and focus model, the ambience bed and UI sounds, progress set pieces, and the camera push into gameplay with the area title. Delete the chibi Cath from the front door.
- **Acceptance:**
  - `gate`, `title` and `title-continue-focus` at all 3 viewports. At 5K the composition fills the frame, and the critique subagent rates it "AAA-adjacent" against the TLOU2, Cyberpunk and Hitman references.
  - Menu focus works via mouse, keys and pad (unit test plus e2e).
  - Front door at 30 fps on phone by budget.
  - Every focus change makes a sound (unit test on the menu model emitting `ui.tick`).

**M7: Class pick, loading screen and pause** (about 2 sessions)
- **Scope:** sections 7.4 to 7.6, including the key-art render-to-texture, the duotone and halftone shaders, the List with its strike-through, the hold-to-commit bar, and the pause blur.
- **Acceptance:**
  - The `classpick`, `loading-*` and `pause` screenshots pass.
  - The spoiler unit test passes.
  - Loading shows no control tips.
  - Pause opens in 200 ms or less (an e2e check on the class transition time) and Esc resumes in one press.

**M8: Accessibility presets and the 5K polish pass** (1 session)
- **Scope:** section 7.7 presets, the HUD-scale slider, dynamic resolution at 5K, and a full screenshot pass of every state above at 2560×1440@2x with fixes.
- **Acceptance:** 60 fps target logic verified by a unit test on the DR controller; all screenshots re-shot and critiqued; the ROADMAP item is ticked.

Each milestone adds its own ROADMAP line (Phase D, combat feel), is released with `npm run release` when its gates pass, and logs its decisions (name choice, the Guard/Flesh split, the retry semantics) in `DECISIONS.md`.