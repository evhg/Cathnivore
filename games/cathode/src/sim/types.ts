// The small vocabulary every CATHODE rules module shares: classes, skill trees, weapon classes, damage
// types, difficulties and hit zones. Kept in one dependency-free file so the modules can import it
// without import cycles.

export const CLASS_IDS = ["ghost", "butcher", "gunslinger", "wirewitch", "fixer"] as const;
/** One of the five classes (design bible 4.2). */
export type ClassId = (typeof CLASS_IDS)[number];

/** The three skill trees of each class, in display order. */
export const TREES_BY_CLASS = {
  ghost: ["longshot", "shroud", "coldRead"],
  butcher: ["meat", "scattergun", "iron"],
  gunslinger: ["sixShooter", "spray", "showman"],
  wirewitch: ["ghostInTheWire", "shortCircuit", "daemon"],
  fixer: ["demolition", "workshop", "chem"],
} as const satisfies Record<ClassId, readonly string[]>;

/** A skill tree id. Hybrid capstones live in the pseudo-tree "hybrid". */
export type TreeId = (typeof TREES_BY_CLASS)[ClassId][number];
export const TREE_IDS: readonly TreeId[] = CLASS_IDS.flatMap((c) => TREES_BY_CLASS[c]);

export const WEAPON_CLASSES = [
  "pistol",
  "revolver",
  "smg",
  "shotgun",
  "rifle",
  "sniper",
  "launcher",
  "smart",
  "melee",
] as const;
/** The nine weapon classes (design bible 4.3). "rifle" is the assault rifle; "sniper" covers rails too. */
export type WeaponClass = (typeof WEAPON_CLASSES)[number];

export const DAMAGE_TYPES = ["kinetic", "shock", "incendiary", "toxic", "monowire"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const ATTRIBUTES = ["grit", "aim", "nerve", "wire"] as const;
export type AttributeId = (typeof ATTRIBUTES)[number];
export type Attributes = Record<AttributeId, number>;

export const DIFFICULTIES = ["noir", "hardboiled", "hellWeek"] as const;
/** Noir, Hardboiled and Hell Week: Diablo II's Normal, Nightmare and Hell. */
export type Difficulty = (typeof DIFFICULTIES)[number];

export const HIT_ZONES = ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"] as const;
export type HitZone = (typeof HIT_ZONES)[number];
export const LIMB_ZONES: readonly HitZone[] = ["leftArm", "rightArm", "leftLeg", "rightLeg"];

/** A point or direction in metres. y is up. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
