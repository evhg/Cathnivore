// C18 "Every gun is a hero" (S2.6): the arsenal's choreography as data, to the Kestrel's standard. One entry per
// class: the S2.6 numbers (ADS time, reload times, camera pitch per shot, flash, mass), the fire clip on the gun's
// moving parts, the reload clips with their commit at 60%, and the class's signature beat. No three.js import:
// tests read exactly what the viewmodel plays (tests/cathode-arsenal.test.ts).
//
// Clips are in gun-root space like feel/pistol.ts (metres, radians; -Z the muzzle, +X her right, +Y up), sampled
// additively on each part's rest pose. Scalar channels ride in a track's pos[0]:
//   hand    the support hand's weight from its grip to `handTo`'s first empty (the mag, the loader, the shell)
//   hand2   the support hand's weight to the second empty (the charging handle, the bolt's knob for the left)
//   handR   the firing hand's weight from the grip to the bolt (the sniper works its bolt with the right hand)
//   arm     how far the firing shoulder drops out and right through a reload
//   magVis  the magazine (or the loader, the shell in hand) shown
//   rounds  the rounds in the gun shown (a revolver's six, an empty launcher's breech)

import { sampleTrack, eventsBetween, type Clip, type Key, type V3 } from "./clip";

const D = Math.PI / 180;

export type HeroModel = "revolver" | "smg" | "rifle" | "shotgun" | "sniper" | "launcher";
export const HERO_MODELS: readonly HeroModel[] = ["revolver", "smg", "rifle", "shotgun", "sniper", "launcher"];

export type FlashKind = "star" | "prong" | "large" | "brake" | "backblast";

export interface ClassFeel {
  model: HeroModel;
  /** S2.6: hip to aimed (ms). */
  adsMs: number;
  /** Reload times (ms); the shotgun's are per shell (`shellMs`), the revolver's and launcher's have one reload. */
  tacMs: number;
  emptyMs: number;
  /** S2.6 camera pitch per shot (degrees); the SMG and rifle follow `pattern` on top. */
  camPitchDeg: number;
  /** S2.2 layer 5: spring frequencies divide by its square root, bob multiplies by 0.85 per step. */
  mass: number;
  /** The viewmodel shove per shot (S2.3's numbers, per class): back (m), up (m), muzzle up (deg), roll (deg). */
  shove: { z: number; y: number; pitchDeg: number; rollDeg: number };
  flash: { kind: FlashKind; sizeM: number; frames: number; light: number; lightRangeM: number };
  /** A tracer every n rounds (0: none). S2.3: SMG and rifle only, 1 in 3. */
  tracerEvery: number;
  /** The class's moving parts and empties: every one must exist on the model (tests/cathode-arsenal.test.ts). */
  parts: readonly string[];
  fire: Clip;
  tac: Clip;
  empty: Clip;
  /** The support hand's targets for `hand` and `hand2` (empties on the model). */
  handTo: [string, string | null];
  /** The firing hand's target for `handR` (the sniper's bolt), if any. */
  handRTo?: string;
}

// ---- shared poses ------------------------------------------------------------------------------------------

/** A reload's turn: rolled toward her, muzzle up, the magwell opening to the support hand (pistol: TILT). */
const LONG_TILT: V3 = [10 * D, 16 * D, -28 * D];
const LONG_TILT_P: V3 = [0.02, 0.05, -0.06];
/** Off the bottom-left of the frame: where the old mag goes and the new one comes from (gun space). */
const POUCH: V3 = [-0.3, -0.36, 0.12];
const POUCH_ROT: V3 = [0.5, 0.2, 0.7];

const k = (t: number, p: V3, r: V3 = [0, 0, 0], e?: Key[3]): Key => [t, p, r, e];
const s = (t: number, v: number, e?: Key[3]): Key => [t, [v, 0, 0], [0, 0, 0], e];
const mul = (a: V3, m: number): V3 => [a[0] * m, a[1] * m, a[2] * m];

/** The gun track of a magazine reload: turned in by 220 ms, the seat's one-frame jolt, home by `dur`. */
function gunTrack(dur: number, seat: number, tilt = LONG_TILT, tiltP = LONG_TILT_P, extra: Key[] = []): Key[] {
  const jolt: V3 = [tiltP[0], tiltP[1] + 0.005, tiltP[2] - 0.003];
  return [
    k(0, [0, 0, 0]),
    k(220, tiltP, tilt, "inOut"),
    k(seat - 2, tiltP, tilt),
    k(seat + 16, jolt, [tilt[0] + 3 * D, tilt[1], tilt[2]], "out"),
    k(seat + 90, tiltP, tilt, "inOut"),
    ...extra,
    k(dur, [0, 0, 0], [0, 0, 0], "inOut"),
  ];
}

/** A box magazine's way out and back in along `axis` (the mag's own direction out of the well). */
function magTrack(axis: V3, seat: number, empty: boolean): Key[] {
  const out = (m: number): V3 => mul(axis, m);
  return empty
    ? [k(0, [0, 0, 0]), k(240, [0, 0, 0]), k(560, POUCH, POUCH_ROT, "inOut"), k(700, POUCH, POUCH_ROT), k(seat - 90, out(0.05), [0, 0, 0], "out"), k(seat, [0, 0, 0], [0, 0, 0], "in")]
    : [k(0, [0, 0, 0]), k(240, [0, 0, 0]), k(280, out(0.035), [0, 0, 0], "out"), k(380, out(0.09), [0.06, 0.03, 0.1], "inOut"), k(580, POUCH, POUCH_ROT, "in"), k(640, POUCH, POUCH_ROT), k(seat - 90, out(0.05), [0, 0, 0], "out"), k(seat, [0, 0, 0], [0, 0, 0], "in")];
}

// ---- revolver: the Old Testament ---------------------------------------------------------------------------

const REV_TURN_MS = 90;
const REV_RELOAD = 2600;
const REV_COMMIT = REV_RELOAD * 0.6;

const REVOLVER: ClassFeel = {
  model: "revolver",
  adsMs: 200,
  tacMs: REV_RELOAD,
  emptyMs: REV_RELOAD,
  camPitchDeg: 2.6,
  mass: 1.25,
  shove: { z: 0.045, y: 0.012, pitchDeg: 14, rollDeg: 3 },
  flash: { kind: "star", sizeM: 0.2, frames: 1, light: 8, lightRangeM: 6 },
  tracerEvery: 0,
  parts: ["frame", "barrel", "cylinder", "crane", "hammer", "trigger", "ejector", "rounds", "loader", "sightF", "sightR", "muzzle", "port", "gripR", "gripL", "loadHand", "sight"],
  fire: {
    dur: 320,
    tracks: {
      // Double action: the hammer is up at the break and falls in 4 ms; the cylinder indexes the next chamber 60°
      // in 90 ms (S2.6's signature beat) and the trigger resets.
      hammer: [k(0, [0, 0, 0], [32 * D, 0, 0]), k(4, [0, 0, 0], [0, 0, 0], "in")],
      cylinder: [k(0, [0, 0, 0]), k(REV_TURN_MS, [0, 0, 0], [0, 0, 60 * D], "inOut"), k(91, [0, 0, 0], [0, 0, 0], "step")],
      trigger: [s(0, 1), s(120, 1), s(260, 0, "out")],
    },
    events: [
      [0, "fire"],
      [REV_TURN_MS, "cylinder"],
    ],
  },
  tac: revolverReload(),
  empty: revolverReload(),
  handTo: ["loadHand", null],
};

/** Swing-out, six cases out on the ejector, the speedloader in, a twist, the flick closed (2.6 s). */
function revolverReload(): Clip {
  const open: V3 = [0.01, 0.06, -0.07];
  const up: V3 = [0.0, 0.08, -0.05];
  return {
    dur: REV_RELOAD,
    tracks: {
      gun: [
        k(0, [0, 0, 0]),
        // Rolled right so the crane swings out to her, the cylinder's face toward the eye.
        k(260, open, [8 * D, 14 * D, -38 * D], "inOut"),
        // Muzzle up: the ejector rod throws the six empties out of the back of the cylinder.
        k(480, up, [48 * D, 6 * D, -20 * D], "inOut"),
        k(640, up, [52 * D, 6 * D, -20 * D]),
        // Muzzle down, the cylinder's face up for the speedloader.
        k(860, open, [-26 * D, 10 * D, -30 * D], "inOut"),
        k(1450, open, [-24 * D, 10 * D, -30 * D]),
        // The flick: closed with a turn of the wrist.
        k(1780, [0.004, 0.03, -0.03], [-6 * D, 4 * D, -6 * D], "inOut"),
        k(1840, [0.0, 0.02, -0.02], [2 * D, 0, 6 * D], "out"),
        k(REV_RELOAD, [0, 0, 0], [0, 0, 0], "inOut"),
      ],
      // The crane swings the cylinder out to the left (about the crane's pin, along the bore).
      crane: [k(0, [0, 0, 0]), k(200, [0, 0, 0]), k(330, [0, 0, 0], [0, 0, 82 * D], "out"), k(1760, [0, 0, 0], [0, 0, 82 * D]), k(1830, [0, 0, 0], [0, 0, 0], "in")],
      // The ejector rod pushed home by the support palm: the extractor star lifts the six cases 25 mm.
      ejector: [k(0, [0, 0, 0]), k(520, [0, 0, 0]), k(600, [0, 0, 0.026], [0, 0, 0], "out"), k(700, [0, 0, 0], [0, 0, 0], "in")],
      rounds: [s(0, 1), s(600, 0, "step"), s(1420, 1, "step")],
      // The speedloader from the pouch to the cylinder's face, the twist, and away (it falls out of frame).
      loader: [
        k(0, POUCH, POUCH_ROT),
        k(760, POUCH, POUCH_ROT),
        k(1220, [0, 0.0, 0.045], [0, 0, 0], "out"),
        k(1340, [0, 0, 0.0], [0, 0, 0], "in"),
        k(1440, [0, 0, 0.0], [0, 0, 30 * D], "inOut"),
        k(1560, [-0.02, 0.0, 0.07], [0.3, 0, 30 * D], "out"),
        k(1760, POUCH, POUCH_ROT, "in"),
      ],
      magVis: [s(0, 0), s(760, 1, "step"), s(1760, 0, "step")],
      hand: [s(0, 0), s(520, 0), s(600, 0.35, "out"), s(700, 0, "in"), s(760, 0), s(900, 1, "inOut"), s(1560, 1), s(1760, 0, "inOut")],
      arm: [s(0, 0), s(260, 1, "inOut"), s(1780, 1), s(REV_RELOAD, 0, "inOut")],
    },
    events: [
      [0, "reloadStart"],
      [300, "craneOpen"],
      [600, "eject"],
      [880, "magPouch"],
      [1340, "loaderIn"],
      [1440, "twist"],
      [REV_COMMIT, "seat"],
      [1830, "craneClose"],
      [REV_RELOAD - 120, "settle"],
    ],
  };
}

// ---- SMG: the Rattlecan ------------------------------------------------------------------------------------

const SMG_MAG_AXIS: V3 = [0, -0.99, -0.12];
const SMG_TAC = 1900;
const SMG_EMPTY = 2400;
const SMG_CHARGE = 1820;

const SMG: ClassFeel = {
  model: "smg",
  adsMs: 220,
  tacMs: SMG_TAC,
  emptyMs: SMG_EMPTY,
  camPitchDeg: 0.45,
  mass: 1.3,
  shove: { z: 0.012, y: 0.002, pitchDeg: 1.6, rollDeg: 0.8 },
  flash: { kind: "star", sizeM: 0.11, frames: 1, light: 5, lightRangeM: 4.5 },
  tracerEvery: 3,
  parts: ["receiver", "upper", "bolt", "charge", "mag", "magRound", "stock", "foregrip", "barrel", "trigger", "sightF", "sightR", "muzzle", "port", "magwell", "gripR", "gripL", "magHand", "chargeHand", "sight"],
  fire: {
    dur: 72,
    tracks: {
      // The bolt cycles 16 mm at the fire rate (S2.6): back by 22 ms, home by 58.
      bolt: [k(0, [0, 0, 0]), k(22, [0, 0, 0.016], [0, 0, 0], "out"), k(58, [0, 0, 0], [0, 0, 0], "in")],
      trigger: [s(0, 1), s(50, 1), s(72, 0)],
    },
    events: [
      [0, "fire"],
      [12, "shell"],
    ],
  },
  tac: {
    dur: SMG_TAC,
    tracks: {
      gun: gunTrack(SMG_TAC, SMG_TAC * 0.6),
      mag: magTrack(SMG_MAG_AXIS, SMG_TAC * 0.6, false),
      hand: [s(0, 0), s(210, 1, "inOut"), s(SMG_TAC * 0.6 + 40, 1), s(SMG_TAC * 0.6 + 320, 0, "inOut")],
      arm: [s(0, 0), s(220, 1, "inOut"), s(SMG_TAC * 0.6 + 90, 1), s(SMG_TAC, 0, "inOut")],
      magVis: [s(0, 1)],
    },
    events: [
      [0, "reloadStart"],
      [240, "magRelease"],
      [580, "magPouch"],
      [SMG_TAC * 0.6 - 90, "magIn"],
      [SMG_TAC * 0.6, "seat"],
      [SMG_TAC - 120, "settle"],
    ],
  },
  empty: {
    dur: SMG_EMPTY,
    tracks: {
      gun: gunTrack(SMG_EMPTY, SMG_EMPTY * 0.6, LONG_TILT, LONG_TILT_P, [
        // The charging handle: turned back toward square, the support hand slaps it down out of its notch.
        k(SMG_CHARGE - 140, [-0.01, 0.03, -0.04], [4 * D, 8 * D, -12 * D], "inOut"),
        k(SMG_CHARGE + 30, [-0.01, 0.026, -0.03], [2 * D, 8 * D, -10 * D], "out"),
        k(SMG_CHARGE + 130, [-0.01, 0.03, -0.04], [4 * D, 8 * D, -12 * D], "inOut"),
      ]),
      mag: magTrack(SMG_MAG_AXIS, SMG_EMPTY * 0.6, true),
      magVis: [s(0, 1), s(240, 0, "step"), s(560, 1, "step")],
      // Locked back on the empty mag until the handle slaps home.
      bolt: [k(0, [0, 0, 0.016]), k(SMG_CHARGE, [0, 0, 0.016]), k(SMG_CHARGE + 30, [0, 0, -0.0008], [0, 0, 0], "in"), k(SMG_CHARGE + 46, [0, 0, 0], [0, 0, 0], "out")],
      charge: [k(0, [0, 0, 0.042]), k(SMG_CHARGE - 20, [0, 0, 0.042]), k(SMG_CHARGE, [0, -0.004, 0.046], [0, 0, 0], "out"), k(SMG_CHARGE + 30, [0, 0, 0], [0, 0, 0], "in")],
      hand: [s(0, 0), s(210, 1, "inOut"), s(SMG_EMPTY * 0.6 + 40, 1), s(SMG_CHARGE - 260, 0, "inOut")],
      hand2: [s(0, 0), s(SMG_EMPTY * 0.6 + 60, 0), s(SMG_CHARGE - 90, 1, "inOut"), s(SMG_CHARGE + 90, 1), s(SMG_CHARGE + 340, 0, "inOut")],
      arm: [s(0, 0), s(220, 1, "inOut"), s(SMG_CHARGE + 130, 1), s(SMG_EMPTY, 0, "inOut")],
    },
    events: [
      [0, "reloadStart"],
      [240, "magRelease"],
      [240, "magDrop"],
      [560, "magPouch"],
      [SMG_EMPTY * 0.6 - 90, "magIn"],
      [SMG_EMPTY * 0.6, "seat"],
      [SMG_CHARGE, "charge"],
      [SMG_CHARGE + 30, "slam"],
      [SMG_EMPTY - 120, "settle"],
    ],
  },
  handTo: ["magHand", "chargeHand"],
};

// ---- rifle: the Corridor AR --------------------------------------------------------------------------------

const AR_MAG_AXIS: V3 = [0, -0.95, -0.31];
const AR_TAC = 2100;
const AR_EMPTY = 2700;
const AR_CHARGE = 2080;

const RIFLE: ClassFeel = {
  model: "rifle",
  adsMs: 280,
  tacMs: AR_TAC,
  emptyMs: AR_EMPTY,
  camPitchDeg: 0.7,
  mass: 1.6,
  shove: { z: 0.016, y: 0.003, pitchDeg: 2.2, rollDeg: 1 },
  flash: { kind: "prong", sizeM: 0.16, frames: 1, light: 6, lightRangeM: 5 },
  tracerEvery: 3,
  parts: ["lower", "upper", "handguard", "barrel", "comp", "optic", "bolt", "charge", "dustCover", "mag", "magRound", "stock", "trigger", "muzzle", "port", "magwell", "gripR", "gripL", "magHand", "chargeHand", "sight"],
  fire: {
    dur: 104,
    tracks: {
      // The carrier through the port: 30 mm back by 34 ms, home by 86; the dust cover is open after the first shot.
      bolt: [k(0, [0, 0, 0]), k(34, [0, 0, 0.03], [0, 0, 0], "out"), k(86, [0, 0, 0], [0, 0, 0], "in")],
      trigger: [s(0, 1), s(70, 1), s(104, 0)],
    },
    events: [
      [0, "fire"],
      [16, "shell"],
    ],
  },
  tac: {
    dur: AR_TAC,
    tracks: {
      gun: gunTrack(AR_TAC, AR_TAC * 0.6),
      mag: magTrack(AR_MAG_AXIS, AR_TAC * 0.6, false),
      hand: [s(0, 0), s(210, 1, "inOut"), s(AR_TAC * 0.6 + 40, 1), s(AR_TAC * 0.6 + 340, 0, "inOut")],
      arm: [s(0, 0), s(220, 1, "inOut"), s(AR_TAC * 0.6 + 90, 1), s(AR_TAC, 0, "inOut")],
      magVis: [s(0, 1)],
    },
    events: [
      [0, "reloadStart"],
      [240, "magRelease"],
      [580, "magPouch"],
      [AR_TAC * 0.6 - 90, "magIn"],
      [AR_TAC * 0.6, "seat"],
      [AR_TAC - 120, "settle"],
    ],
  },
  empty: {
    dur: AR_EMPTY,
    tracks: {
      gun: gunTrack(AR_EMPTY, AR_EMPTY * 0.6, LONG_TILT, LONG_TILT_P, [
        // S2.6's signature: the charging handle. Turned square, the support hand pulls it 70 mm and lets go.
        k(AR_CHARGE - 160, [-0.012, 0.035, -0.02], [6 * D, 6 * D, -8 * D], "inOut"),
        k(AR_CHARGE + 40, [-0.012, 0.03, -0.004], [3 * D, 6 * D, -7 * D], "out"),
        k(AR_CHARGE + 150, [-0.012, 0.035, -0.02], [6 * D, 6 * D, -8 * D], "inOut"),
      ]),
      mag: magTrack(AR_MAG_AXIS, AR_EMPTY * 0.6, true),
      magVis: [s(0, 1), s(240, 0, "step"), s(560, 1, "step")],
      bolt: [k(0, [0, 0, 0.03]), k(AR_CHARGE + 30, [0, 0, 0.03]), k(AR_CHARGE + 62, [0, 0, -0.0008], [0, 0, 0], "in"), k(AR_CHARGE + 78, [0, 0, 0], [0, 0, 0], "out")],
      charge: [k(0, [0, 0, 0]), k(AR_CHARGE - 70, [0, 0, 0]), k(AR_CHARGE, [0, 0, 0.07], [0, 0, 0], "out"), k(AR_CHARGE + 30, [0, 0, 0.07]), k(AR_CHARGE + 62, [0, 0, 0], [0, 0, 0], "in")],
      hand: [s(0, 0), s(210, 1, "inOut"), s(AR_EMPTY * 0.6 + 40, 1), s(AR_CHARGE - 280, 0, "inOut")],
      hand2: [s(0, 0), s(AR_EMPTY * 0.6 + 60, 0), s(AR_CHARGE - 90, 1, "inOut"), s(AR_CHARGE + 80, 1), s(AR_CHARGE + 360, 0, "inOut")],
      arm: [s(0, 0), s(220, 1, "inOut"), s(AR_CHARGE + 150, 1), s(AR_EMPTY, 0, "inOut")],
    },
    events: [
      [0, "reloadStart"],
      [240, "magRelease"],
      [240, "magDrop"],
      [560, "magPouch"],
      [AR_EMPTY * 0.6 - 90, "magIn"],
      [AR_EMPTY * 0.6, "seat"],
      [AR_CHARGE, "charge"],
      [AR_CHARGE + 62, "slam"],
      [AR_EMPTY - 120, "settle"],
    ],
  },
  handTo: ["magHand", "chargeHand"],
};

// ---- shotgun: the Fishmonger -------------------------------------------------------------------------------

/** S2.6: the pump's 70 mm over 380 ms, starting as the muzzle comes down from the shot. */
export const PUMP = { m: 0.07, fromMs: 170, ms: 380 };
export const SHELL = { openMs: 260, shellMs: 450, inAt: 300, closeMs: 300 };
const SG_TILT: V3 = [8 * D, 8 * D, 34 * D];
const SG_TILT_P: V3 = [-0.02, 0.06, -0.05];

const pumpKeys = (t0: number): Key[] => [
  k(t0, [0, 0, 0]),
  k(t0 + PUMP.ms * 0.48, [0, 0, PUMP.m], [0, 0, 0], "inOut"),
  k(t0 + PUMP.ms * 0.52, [0, 0, PUMP.m]),
  k(t0 + PUMP.ms, [0, 0, 0], [0, 0, 0], "inOut"),
];

const SHOTGUN: ClassFeel = {
  model: "shotgun",
  adsMs: 240,
  tacMs: SHELL.shellMs,
  emptyMs: SHELL.shellMs,
  camPitchDeg: 4.5,
  mass: 1.8,
  shove: { z: 0.06, y: 0.016, pitchDeg: 13, rollDeg: 2.5 },
  flash: { kind: "large", sizeM: 0.3, frames: 2, light: 9, lightRangeM: 6 },
  tracerEvery: 0,
  parts: ["receiver", "barrel", "tube", "pump", "carrier", "stock", "trigger", "shell", "bead", "muzzle", "port", "gripR", "gripL", "loadHand", "sight"],
  fire: {
    dur: PUMP.fromMs + PUMP.ms + 60,
    tracks: {
      pump: pumpKeys(PUMP.fromMs),
      // The gun rides the pump: it rolls in a touch and dips as the forend comes back.
      gun: [k(0, [0, 0, 0]), k(PUMP.fromMs, [0, 0, 0]), k(PUMP.fromMs + PUMP.ms * 0.5, [-0.004, -0.008, 0.012], [-2 * D, 0, 5 * D], "inOut"), k(PUMP.fromMs + PUMP.ms, [0, 0, 0], [0, 0, 0], "inOut")],
      carrier: [k(0, [0, 0, 0]), k(PUMP.fromMs + PUMP.ms * 0.4, [0, 0, 0]), k(PUMP.fromMs + PUMP.ms * 0.5, [0, 0, 0], [-10 * D, 0, 0], "out"), k(PUMP.fromMs + PUMP.ms * 0.8, [0, 0, 0], [0, 0, 0], "in")],
      trigger: [s(0, 1), s(120, 1), s(200, 0)],
    },
    events: [
      [0, "fire"],
      [PUMP.fromMs, "pumpBack"],
      [PUMP.fromMs + PUMP.ms * 0.45, "shell"],
      [PUMP.fromMs + PUMP.ms, "pumpHome"],
    ],
  },
  // One shell (S2.6: 0.45 s each, interruptible): from the pouch, thumbed up into the loading port at 300 ms.
  tac: shellClip(),
  empty: shellClip(),
  handTo: ["loadHand", null],
};

function shellClip(): Clip {
  const S = SHELL;
  return {
    dur: S.shellMs,
    tracks: {
      gun: [k(0, SG_TILT_P, SG_TILT), k(S.inAt - 10, SG_TILT_P, SG_TILT), k(S.inAt + 30, [SG_TILT_P[0], SG_TILT_P[1] + 0.004, SG_TILT_P[2]], [SG_TILT[0] + 2 * D, SG_TILT[1], SG_TILT[2]], "out"), k(S.shellMs, SG_TILT_P, SG_TILT, "inOut")],
      // The shell in her fingers: up from the pouch, to the port, thumbed in along the tube.
      shell: [k(0, POUCH, POUCH_ROT), k(160, [0, -0.03, 0.04], [0.4, 0, 0], "out"), k(S.inAt - 40, [0, -0.004, 0.02], [0.06, 0, 0], "inOut"), k(S.inAt, [0, 0, -0.02], [0, 0, 0], "in"), k(S.inAt + 1, POUCH, POUCH_ROT, "step")],
      magVis: [s(0, 1), s(S.inAt, 0, "step")],
      hand: [s(0, 1)],
      arm: [s(0, 1)],
    },
    events: [
      [120, "magPouch"],
      [S.inAt, "shellIn"],
    ],
  };
}

/** The shell reload's open (into the loading pose) and close (back, and the pump racked on an empty gun). */
export const SHELL_OPEN: Clip = {
  dur: SHELL.openMs,
  tracks: { gun: [k(0, [0, 0, 0]), k(SHELL.openMs, SG_TILT_P, SG_TILT, "inOut")], hand: [s(0, 0), s(SHELL.openMs, 1, "inOut")], arm: [s(0, 0), s(SHELL.openMs, 1, "inOut")], magVis: [s(0, 0)] },
  events: [[0, "reloadStart"]],
};
export const SHELL_CLOSE: Clip = {
  dur: SHELL.closeMs,
  tracks: { gun: [k(0, SG_TILT_P, SG_TILT), k(SHELL.closeMs, [0, 0, 0], [0, 0, 0], "inOut")], hand: [s(0, 1), s(SHELL.closeMs * 0.8, 0, "inOut")], arm: [s(0, 1), s(SHELL.closeMs, 0, "inOut")], magVis: [s(0, 0)] },
  events: [[SHELL.closeMs - 60, "settle"]],
};
/** The rack that chambers the first shell of an empty gun. */
export const SHELL_RACK: Clip = {
  dur: PUMP.ms + 40,
  tracks: { pump: pumpKeys(0), gun: [k(0, [0, 0, 0]), k(PUMP.ms * 0.5, [-0.004, -0.008, 0.012], [-2 * D, 0, 5 * D], "inOut"), k(PUMP.ms, [0, 0, 0], [0, 0, 0], "inOut")] },
  events: [
    [0, "pumpBack"],
    [PUMP.ms, "pumpHome"],
  ],
};

// ---- sniper: the Widowmaker --------------------------------------------------------------------------------

/** S2.6: a 700 ms bolt cycle (lift 60°, back 90 mm), starting as the scope settles off the shot. */
export const BOLT = { fromMs: 220, liftDeg: 60, backM: 0.09, cycleMs: 700 };
const SN_MAG_AXIS: V3 = [0, -1, 0];
const SN_TAC = 2800;
const SN_EMPTY = 3400;

function boltKeys(t0: number): { bolt: Key[]; handR: Key[]; gun: Key[]; events: [number, string][] } {
  const c = BOLT.cycleMs;
  const lift = t0 + c * 0.16;
  const back = t0 + c * 0.45;
  const fwd = t0 + c * 0.78;
  const down = t0 + c;
  return {
    // The bolt's rotation is about the bore (z): the handle comes up and over to the left.
    bolt: [k(t0, [0, 0, 0]), k(lift, [0, 0, 0], [0, 0, BOLT.liftDeg * D], "inOut"), k(back, [0, 0, BOLT.backM], [0, 0, BOLT.liftDeg * D], "out"), k(fwd, [0, 0, 0], [0, 0, BOLT.liftDeg * D], "inOut"), k(down, [0, 0, 0], [0, 0, 0], "out")],
    handR: [s(t0 - 120, 0), s(t0 + 10, 1, "inOut"), s(down + 10, 1), s(down + 180, 0, "inOut")],
    // The rifle rolls toward the bolt hand and drops a touch out of the scope's line.
    gun: [k(t0 - 120, [0, 0, 0]), k(t0 + 40, [0.004, -0.02, 0.02], [-3 * D, -4 * D, 10 * D], "inOut"), k(down, [0.004, -0.02, 0.02], [-3 * D, -4 * D, 10 * D]), k(down + 180, [0, 0, 0], [0, 0, 0], "inOut")],
    events: [
      [lift, "boltUp"],
      [t0 + c * 0.4, "shell"],
      [back, "boltBack"],
      [fwd, "boltFwd"],
      [down, "boltDown"],
    ],
  };
}

const SN_FIRE_BOLT = boltKeys(BOLT.fromMs);
const SN_EMPTY_BOLT = boltKeys(SN_EMPTY * 0.6 + 260);

const SNIPER: ClassFeel = {
  model: "sniper",
  adsMs: 320,
  tacMs: SN_TAC,
  emptyMs: SN_EMPTY,
  camPitchDeg: 6,
  mass: 2.0,
  shove: { z: 0.07, y: 0.012, pitchDeg: 9, rollDeg: 2 },
  flash: { kind: "brake", sizeM: 0.26, frames: 1, light: 8, lightRangeM: 6 },
  tracerEvery: 0,
  parts: ["stock", "receiver", "barrel", "brake", "scope", "bolt", "mag", "magRound", "trigger", "bipod", "muzzle", "port", "magwell", "gripR", "gripL", "magHand", "boltHand", "sight"],
  fire: {
    dur: BOLT.fromMs + BOLT.cycleMs + 200,
    tracks: { bolt: SN_FIRE_BOLT.bolt, handR: SN_FIRE_BOLT.handR, gun: SN_FIRE_BOLT.gun, trigger: [s(0, 1), s(150, 1), s(260, 0)] },
    events: [[0, "fire"], ...SN_FIRE_BOLT.events],
  },
  tac: {
    dur: SN_TAC,
    tracks: {
      gun: gunTrack(SN_TAC, SN_TAC * 0.6, [6 * D, 14 * D, -24 * D], [0.02, 0.05, -0.04]),
      mag: magTrack(SN_MAG_AXIS, SN_TAC * 0.6, false),
      hand: [s(0, 0), s(220, 1, "inOut"), s(SN_TAC * 0.6 + 40, 1), s(SN_TAC * 0.6 + 360, 0, "inOut")],
      arm: [s(0, 0), s(220, 1, "inOut"), s(SN_TAC * 0.6 + 90, 1), s(SN_TAC, 0, "inOut")],
      magVis: [s(0, 1)],
    },
    events: [
      [0, "reloadStart"],
      [240, "magRelease"],
      [580, "magPouch"],
      [SN_TAC * 0.6 - 90, "magIn"],
      [SN_TAC * 0.6, "seat"],
      [SN_TAC - 120, "settle"],
    ],
  },
  empty: {
    dur: SN_EMPTY,
    tracks: {
      gun: gunTrack(SN_EMPTY, SN_EMPTY * 0.6, [6 * D, 14 * D, -24 * D], [0.02, 0.05, -0.04]),
      mag: magTrack(SN_MAG_AXIS, SN_EMPTY * 0.6, true),
      magVis: [s(0, 1), s(240, 0, "step"), s(560, 1, "step")],
      bolt: SN_EMPTY_BOLT.bolt,
      handR: SN_EMPTY_BOLT.handR,
      hand: [s(0, 0), s(220, 1, "inOut"), s(SN_EMPTY * 0.6 + 40, 1), s(SN_EMPTY * 0.6 + 360, 0, "inOut")],
      arm: [s(0, 0), s(220, 1, "inOut"), s(SN_EMPTY * 0.6 + 90, 1), s(SN_EMPTY, 0, "inOut")],
    },
    events: [
      [0, "reloadStart"],
      [240, "magRelease"],
      [240, "magDrop"],
      [560, "magPouch"],
      [SN_EMPTY * 0.6 - 90, "magIn"],
      [SN_EMPTY * 0.6, "seat"],
      ...SN_EMPTY_BOLT.events.filter(([, n]) => n !== "shell"),
      [SN_EMPTY - 120, "settle"],
    ],
  },
  handTo: ["magHand", null],
  handRTo: "boltHand",
};

// ---- launcher: the Bargain Bin -----------------------------------------------------------------------------

const LN_RELOAD = 2600;
const LN_COMMIT = LN_RELOAD * 0.6;

const LAUNCHER: ClassFeel = {
  model: "launcher",
  adsMs: 300,
  tacMs: LN_RELOAD,
  emptyMs: LN_RELOAD,
  camPitchDeg: 5,
  mass: 2.4,
  shove: { z: 0.08, y: 0.02, pitchDeg: 10, rollDeg: 2 },
  flash: { kind: "backblast", sizeM: 0.22, frames: 2, light: 7, lightRangeM: 6 },
  tracerEvery: 0,
  parts: ["tube", "breech", "sight", "grip", "foregrip", "stock", "round", "case", "trigger", "muzzle", "port", "gripR", "gripL", "loadHand"],
  fire: {
    dur: 420,
    tracks: { trigger: [s(0, 1), s(200, 1), s(300, 0)] },
    events: [
      [0, "fire"],
      [0, "backblast"],
    ],
  },
  tac: launcherReload(),
  empty: launcherReload(),
  handTo: ["loadHand", null],
};

/** Break open, the spent case out, the finned round seen going in, closed (S2.6). */
function launcherReload(): Clip {
  return {
    dur: LN_RELOAD,
    tracks: {
      gun: [
        k(0, [0, 0, 0]),
        k(260, [0.0, 0.06, -0.06], [-12 * D, 18 * D, -16 * D], "inOut"),
        k(LN_COMMIT - 4, [0.0, 0.06, -0.06], [-12 * D, 18 * D, -16 * D]),
        k(LN_COMMIT + 20, [0.0, 0.064, -0.064], [-10 * D, 18 * D, -16 * D], "out"),
        k(1700, [0.0, 0.06, -0.06], [-12 * D, 18 * D, -16 * D], "inOut"),
        // Snapped shut with a flick up.
        k(1820, [0, 0.07, -0.05], [6 * D, 14 * D, -10 * D], "out"),
        k(LN_RELOAD, [0, 0, 0], [0, 0, 0], "inOut"),
      ],
      // The barrel breaks open about its hinge under the front of the breech (muzzle down 38°).
      breech: [k(0, [0, 0, 0]), k(240, [0, 0, 0]), k(420, [0, 0, 0], [-38 * D, 0, 0], "out"), k(1720, [0, 0, 0], [-38 * D, 0, 0]), k(1800, [0, 0, 0], [0, 0, 0], "in")],
      // The spent case kicks out of the opened breech.
      case: [k(0, [0, 0, 0]), k(430, [0, 0, 0]), k(560, [0.04, 0.06, 0.16], [1.2, 0.4, 0], "out"), k(561, [0, 0, 0], [0, 0, 0], "step")],
      caseVis: [s(0, 1), s(560, 0, "step"), s(1500, 1, "step")],
      // The round: from the pouch, nose first into the open breech, thumbed home at 1450.
      round: [k(0, POUCH, POUCH_ROT), k(620, POUCH, POUCH_ROT), k(1100, [0.0, 0.03, 0.12], [0.35, 0, 0], "out"), k(1300, [0, 0.0, 0.06], [0.05, 0, 0], "inOut"), k(1450, [0, 0, 0], [0, 0, 0], "in")],
      magVis: [s(0, 1), s(440, 0, "step"), s(620, 1, "step")],
      hand: [s(0, 0), s(560, 0), s(700, 1, "inOut"), s(1480, 1), s(1720, 0, "inOut")],
      arm: [s(0, 0), s(260, 1, "inOut"), s(1820, 1), s(LN_RELOAD, 0, "inOut")],
    },
    events: [
      [0, "reloadStart"],
      [420, "breechOpen"],
      [560, "eject"],
      [700, "magPouch"],
      [1450, "roundIn"],
      [LN_COMMIT, "seat"],
      [1800, "breechClose"],
      [LN_RELOAD - 120, "settle"],
    ],
  };
}

export const ARSENAL: Record<HeroModel, ClassFeel> = { revolver: REVOLVER, smg: SMG, rifle: RIFLE, shotgun: SHOTGUN, sniper: SNIPER, launcher: LAUNCHER };

export function isHero(model: string): model is HeroModel {
  return (HERO_MODELS as readonly string[]).includes(model);
}

// ---- recoil patterns (S2.6: the SMG climbs for 6 shots, then drifts right; the rifle the same, heavier) -----

/**
 * The camera kick of shot `n` (0-based, in one burst) in degrees: [pitch, yaw]. Straight up for the first six
 * (a hair of alternating yaw), then the climb eases and the muzzle walks right. Non-patterned classes kick their
 * S2.6 pitch with a random side the caller supplies.
 */
export function recoilPattern(model: HeroModel, n: number, side = 0): [number, number] {
  const f = ARSENAL[model];
  if (model !== "smg" && model !== "rifle") return [f.camPitchDeg, side * f.camPitchDeg * 0.12];
  if (n < 6) return [f.camPitchDeg, (n % 2 ? 1 : -1) * f.camPitchDeg * 0.06];
  const drift = Math.min(1, (n - 5) / 4);
  return [f.camPitchDeg * (1 - 0.4 * drift), f.camPitchDeg * (0.25 + 0.3 * drift)];
}

// ---- the reload machine for every class (the pistol keeps feel/pistol.ts's) ------------------------------------

export type ClassReloadKind = "tac" | "empty" | "shell";
type ShellPhase = "open" | "shell" | "close" | "rack";

/** What a class's magazine holds (the same shape as the pistol's). */
export interface ClassMag {
  ammo: number;
  reserve: number;
  mag: number;
}

/**
 * A class reload. Magazine classes (and the revolver and launcher) play one clip and move the rounds at its 60%
 * commit; a cancel before the commit loses nothing. The shotgun loads shell by shell (S2.6): open, a 450 ms clip
 * per shell with the round counted at 300 ms, close, and on an empty gun a rack of the pump; a trigger pull
 * between shells ends it (the close is skipped: the caller blends the pose out).
 */
export class ClassReload {
  kind: ClassReloadKind | null = null;
  t = 0;
  committed = false;
  phase: ShellPhase | null = null;
  /** Shells loaded in this reload. */
  loaded = 0;
  /** The gun was empty when the shell reload began (it racks the pump at the end). */
  private wasEmpty = false;
  constructor(readonly feel: ClassFeel) {}

  get active(): boolean {
    return this.kind !== null;
  }

  get clip(): Clip {
    if (this.kind === "shell") return this.phase === "open" ? SHELL_OPEN : this.phase === "close" ? SHELL_CLOSE : this.phase === "rack" ? SHELL_RACK : this.feel.tac;
    return this.kind === "empty" ? this.feel.empty : this.feel.tac;
  }

  get commitAt(): number {
    return this.kind === "shell" ? SHELL.inAt : this.clip.dur * 0.6;
  }

  /** Starts a reload if one makes sense. */
  start(h: ClassMag): boolean {
    if (this.kind || h.mag === 0 || h.ammo >= h.mag || h.reserve <= 0) return false;
    this.t = 0;
    this.committed = false;
    this.loaded = 0;
    if (this.feel.model === "shotgun") {
      this.kind = "shell";
      this.phase = "open";
      this.wasEmpty = h.ammo === 0;
    } else {
      this.kind = h.ammo === 0 ? "empty" : "tac";
      this.phase = null;
    }
    return true;
  }

  /**
   * Cancels a reload. Magazine reloads cancel only before their commit; a shell reload cancels between shells
   * at any time (the shells already in stay in). Returns whether it did.
   */
  cancel(): boolean {
    if (!this.kind) return false;
    if (this.kind !== "shell" && this.committed) return false;
    if (this.kind === "shell" && this.phase === "rack") return false;
    this.kind = null;
    this.phase = null;
    this.t = 0;
    return true;
  }

  /** Advances; rounds move at the commit (each shell at 300 ms). */
  step(h: ClassMag, dtMs: number): { commit: boolean; done: boolean; events: string[] } {
    if (!this.kind) return { commit: false, done: false, events: [] };
    const events: string[] = [];
    let commit = false;
    let left = Math.max(0, dtMs);
    // A shell reload can cross a phase boundary inside one step.
    for (let guard = 0; guard < 8 && this.kind; guard++) {
      const clip = this.clip;
      const t0 = this.t;
      const t1 = Math.min(clip.dur, t0 + left);
      left -= t1 - t0;
      this.t = t1;
      events.push(...eventsBetween(clip, t0 === 0 ? -1 : t0, t1));
      if (!this.committed && this.t >= this.commitAt && (this.kind !== "shell" || this.phase === "shell")) {
        this.committed = true;
        commit = true;
        if (this.kind === "shell") {
          if (h.reserve > 0 && h.ammo < h.mag) {
            h.ammo++;
            h.reserve--;
            this.loaded++;
          }
        } else {
          const take = Math.min(h.mag - h.ammo, h.reserve);
          h.ammo += take;
          h.reserve -= take;
        }
      }
      if (this.t < clip.dur) break;
      // The clip ended.
      if (this.kind !== "shell") {
        this.kind = null;
        return { commit, done: true, events };
      }
      this.t = 0;
      this.committed = false;
      if (this.phase === "open" || this.phase === "shell") this.phase = h.ammo < h.mag && h.reserve > 0 ? "shell" : "close";
      else if (this.phase === "close") {
        if (this.wasEmpty && h.ammo > 0) {
          this.phase = "rack";
          this.wasEmpty = false;
        } else {
          this.kind = null;
          this.phase = null;
          return { commit, done: true, events };
        }
      } else {
        this.kind = null;
        this.phase = null;
        return { commit, done: true, events };
      }
      if (left <= 0) break;
    }
    return { commit, done: false, events };
  }
}

/** A clip's scalar channel at `tMs` (dflt when the clip has no such track). */
export function chan(clip: Clip, name: string, tMs: number, dflt = 0): number {
  const kk = clip.tracks[name];
  return kk ? sampleTrack(kk, tMs).pos[0] : dflt;
}
