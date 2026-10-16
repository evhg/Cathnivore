// Every feel number in Phase C lives here (docs/design/cathode-combat.md S0): timings, sizes and gains. It's
// a plain object with no three.js import, so the tests read exactly what the game uses.

export type HitClass = "body" | "head" | "armour" | "armourBreak" | "pen" | "kill" | "headKill";

export const tuning = {
  /** S1.5: how long a hit holds the world (ms). Automatic weapons hold less, so a burst never stutters. */
  hitStop: {
    body: 12,
    bodyAuto: 0,
    crit: 20,
    critAuto: 0,
    plateBreak: 40,
    melee: 40,
    kill: 60,
    killAuto: 40,
    headKill: 110,
    takedown: 80,
    lastEnemy: 120,
    cathDeath: 120,
    /** A single stop never runs longer than this. */
    cap: 150,
    /** While firing automatic weapons: the sum of stops in any 100 ms window stays at or below this. */
    autoWindowMs: 100,
    autoWindowCap: 30,
    /** During a hit-stop particles run at this rate, so blood hangs in the air. */
    fxScale: 0.25,
  },
  /** S1.5 last row: the final enemy of an encounter. */
  lastEnemySlowmo: { scale: 0.35, holdMs: 700, rampOutMs: 250 },
  /** S1.4: kill confirm. */
  kill: { fovPunchDeg: -1.5, fovSpring: { freqHz: 4.2, zeta: 0.9 }, trauma: 0.2, duckDb: -3, duckMs: 400 },
  /** S0 trauma: shake = trauma² × max. */
  trauma: { maxRotDeg: 1.8, maxOffsetM: 0.008, noiseHz: 20, decayPerS: 1.6, reducedMotionCap: 0.3, phoneMul: 1.2 },
  /**
   * S1.2: the marker per hit class, in --u units (1u = 1/1080 of the screen height, S8). The spec's table
   * (body 10u x 2.25u) is the floor; the owner found the marker too small on a 5K screen, so every class is
   * drawn 1.6x the table's size (body 16u x 3.6u: 43 x 9.6 physical px at 2560x1440 @2).
   */
  marker: {
    body: { len: 16, thick: 3.6, gap: 10, pop: 1.25, popMs: 60, holdMs: 80, fadeMs: 140 },
    // The head gap is opened to 16u (about 0.22 m at 10 m, since --u and the projection both scale with the
    // screen height) so the X frames the head instead of covering the flinch, flash and puff it confirms.
    head: { len: 20.8, thick: 4, gap: 16, pop: 1.35, popMs: 60, holdMs: 90, fadeMs: 160 },
    armour: { len: 16, thick: 3.6, gap: 10, pop: 1.15, popMs: 60, holdMs: 80, fadeMs: 120 },
    armourBreak: { len: 16, thick: 3.6, gap: 10, pop: 1.3, popMs: 60, holdMs: 90, fadeMs: 200 },
    pen: { len: 16, thick: 3.6, gap: 10, pop: 1.2, popMs: 60, holdMs: 60, fadeMs: 120 },
    kill: { len: 24, thick: 4.8, gap: 13, pop: 1.5, popMs: 80, holdMs: 120, fadeMs: 400 },
    headKill: { len: 24, thick: 4.8, gap: 13, pop: 1.5, popMs: 80, holdMs: 120, fadeMs: 400 },
  } satisfies Record<HitClass, { len: number; thick: number; gap: number; pop: number; popMs: number; holdMs: number; fadeMs: number }>,
  /** The kill ring bursts from 27u to 90u over 420 ms, clear of the 1.6x kill ticks (the spec says 12u to 40u, sized for its smaller ticks); two rings on a head kill. */
  killRing: { fromU: 27, toU: 90, ms: 420 },
  /** S1.1 blocked: the hollow bracket beside the crosshair. "COVER" is spelled out for the first few. */
  blocked: { glyphMs: 320, wordUses: 3, impactMul: 1.5, sparks: [12, 20] as const, ricochetChance: 0.3, nearRayM: 1.0 },
  /** S1.1 near miss: a round within this of an enemy's head makes them flinch and duck. */
  nearMiss: { radiusM: 0.5, flinchDeg: 8, duckMs: 400, accuracyMul: 0.6, accuracyMs: 1000, barkChance: 0.4 },
  /** S1.2 target bar on a kill: flash, collapse, hide. */
  targetBar: { collapseMs: 180, hideAfterMs: 400, holdS: 2.5 },
  /** S1.2 rumble (gamepads with vibrationActuator). */
  rumble: {
    fire: { motor: "weak", mag: 0.3, ms: 40 },
    hit: { motor: "weak", mag: 0.2, ms: 30 },
    kill: { motor: "strong", mag: 0.6, ms: 120 },
  },
  /** S1.3 confirm sounds: peak level in dBFS per class. */
  confirmDb: { body: -12, head: -10, armour: -14, plateBreak: -10, visor: -10, kill: -8, headKill: -8, pen: -15 },
  /** S0 audio buses. */
  audio: { compThreshold: -18, compRatio: 4, compKnee: 6, compAttack: 0.003, compRelease: 0.15, attackTau: 0.04, releaseTau: 0.4, dryGainDb: 3, voicesDesktop: 32, voicesPhone: 20 },
  /**
   * S4.1 flinch. The spec asks for 12 Hz, zeta 0.5 "settling in about 250 ms", but a 12 Hz spring peaks in
   * 16 ms and is gone in 100 ms (two frames at 60 Hz). 5 Hz at zeta 0.5 is the spring that settles in 250 ms
   * and peaks at about 38 ms, where the eye catches it; the kick is sized so each channel peaks at the table.
   */
  flinch: {
    spring: { freqHz: 5, zeta: 0.5 },
    rootSpring: { freqHz: 3, zeta: 0.85 },
    scaleMin: 0.4,
    scaleMax: 1.4,
    maxDeg: 45,
    maxRootM: 0.6,
    zones: {
      // 32 deg, past the spec's 22: at 1440x900 the 22 deg tip moved the head 6.6 px at 60 ms (pillar 4: overstate).
      // A Kestrel headshot scales that past maxDeg, so a bigger tip changes nothing; the margin over the 8 px bar
      // (8.3 px, too thin) comes from the shove instead: 0.2 m, not 0.1, moves the head about 25% further.
      head: { pitchDeg: 32, yawDeg: 10, pushM: 0.2 },
      torso: { pitchDeg: 6, twistDeg: 12, shrugDeg: 8, pushM: 0.15 },
      arm: { swingDeg: 28, muzzleDropDeg: 15, muzzleDropMs: 300, twistDeg: 5, pushM: 0.05 },
      leg: { kneeDeg: 18, pelvisDropM: 0.06, tipDeg: 4, pushM: 0.1 },
    },
    weaponPush: { pistol: 0.15, rifle: 0.25, shotgunClose: 0.45, sniperMul: 2.5 },
    /** Archetype poise: heavier kits react less, but every hit still shows (pillar 3). */
    poise: { shield: 0.7, elite: 0.8, turret: 0.25, default: 1 },
    /**
     * How far each push bends off the round's line toward the side away from the hit (0 = straight along it).
     * Straight from the camera, a pure "back" moves nothing on screen; the bend makes it read (pillar 4).
     */
    lateral: { head: 0.95, chain: 0.45, root: 0.5, headTorso: 0.35 },
  },
  /**
   * S4.1 the flash: white for one frame, then red fading out. Emissive radiance on the hit segment.
   * `death` (C2): the whole body's rim on a kill. Kept dim and nearly pure red: the AgX tone map turns any
   * bright red to salmon (1.1 radiance maps to about rgb 216,118,103; 0.45 keeps a red 176,85,78 rim over a deep 105,38,35 face).
   */
  hitFlash: { whiteMs: 25, white: 1.8, fadeMs: 150, red: [1, 0.165, 0.1] as const, redGain: 0.6, death: { level: 0.45, holdMs: 500, fadeMs: 1400, red: [1, 0.02, 0.01] as const } },
  /** S0 timescale: nothing but death holds longer than this (ms). */
  timescale: { maxHoldMs: 3000 },
} as const;

/** dBFS to linear gain. */
export const db = (d: number): number => Math.pow(10, d / 20);
