// CATHODE's guns and blades: nine weapon classes with at least two bases each, gunsmith tiers I–V and
// the five part slots. A base is the weapon's factory numbers; `weaponStats` applies the item level, the
// tier, any fitted parts and the item's local affixes to give the numbers the game layer fires with.
// Character bonuses (Aim, skills, gear) are applied later, in damage.ts, through `DerivedStats`.
//
// Units: damage per projectile (per pellet for shotguns), fireRate in shots (or swings) per second,
// reload in seconds, spread in degrees (hip fire; aiming multiplies it by ADS_SPREAD), recoil steps in
// degrees (x right, y up), distances in metres, muzzle velocity in m/s (0 = melee).

import type { Attributes, DamageType, WeaponClass } from "./types";

export interface RecoilStep {
  /** Horizontal kick in degrees (positive is right). */
  x: number;
  /** Vertical kick in degrees (positive is up). */
  y: number;
}

/** An alternate fire mode (middle mouse). The game layer reads `type` and the parameters. */
export interface AltFire {
  type: string;
  description: string;
  [param: string]: number | string;
}

export interface Falloff {
  /** Full damage up to here. */
  start: number;
  /** Damage reaches `min` here and stays there. */
  end: number;
  /** Damage multiplier past `end`. */
  min: number;
}

/** A weapon's resolved numbers (a base, or a base after tier, parts and affixes). */
export interface WeaponStats {
  id: string;
  name: string;
  cls: WeaponClass;
  damage: number;
  fireRate: number;
  /** Rounds per magazine (0 for melee). */
  magazine: number;
  reload: number;
  spread: number;
  /** One step per shot; the pattern repeats from the start when it runs out. */
  recoil: readonly RecoilStep[];
  falloff: Falloff;
  /** Maximum effective range (melee reach for blades). */
  range: number;
  /** Radius in metres within which enemies hear a shot (or a swing). */
  noise: number;
  /** Muzzle velocity in m/s; 0 for melee. Sniper rounds use ballistics.ts, others can be hitscan. */
  velocity: number;
  /** Projectiles per shot. */
  pellets: number;
  /** Share of armour ignored, 0..1. */
  pierce: number;
  /** Bodies or cover layers a round passes through (rails punch through cover). */
  penetration: number;
  damageType: DamageType;
  /** Crit chance bonus in percentage points. */
  critBonus: number;
  /** Aim-down-sights time in seconds. */
  adsTime: number;
  /** Scope sway in degrees while aiming (before Held Breath). */
  sway: number;
  /** Scope magnification (1 = iron sights). */
  zoom: number;
  suppressed: boolean;
  subsonic: boolean;
  /** A bladed melee weapon (katana, monowire): close kills sever. Blunt ones (the Pin) don't. */
  edged: boolean;
  altFire: AltFire;
}

export interface WeaponBase extends WeaponStats {
  /** Lowest item level this base drops at. */
  level: number;
  requirements: Partial<Attributes>;
  /** Most sockets this base can roll. */
  maxSockets: number;
  twoHanded: boolean;
  lore: string;
}

/** Spread multiplier while aiming down sights. */
export const ADS_SPREAD = 0.3;

const pattern = (...steps: [number, number][]): RecoilStep[] => steps.map(([x, y]) => ({ x, y }));
const NO_RECOIL: RecoilStep[] = [{ x: 0, y: 0 }];

type BaseSpec = Omit<WeaponBase, "critBonus" | "suppressed" | "subsonic" | "zoom" | "sway" | "adsTime" | "penetration" | "edged"> &
  Partial<Pick<WeaponBase, "critBonus" | "suppressed" | "subsonic" | "zoom" | "sway" | "adsTime" | "penetration" | "edged">>;

const base = (b: BaseSpec): WeaponBase => ({
  critBonus: 0,
  suppressed: false,
  subsonic: false,
  zoom: 1,
  sway: 0,
  adsTime: 0.25,
  penetration: 0,
  edged: false,
  ...b,
});

/** Every weapon base by id. */
export const WEAPON_BASES: Readonly<Record<string, WeaponBase>> = Object.fromEntries(
  [
    // Pistols: quick, quiet enough, everyone's backup.
    base({ id: "kestrel", name: "Brass Kestrel", cls: "pistol", level: 1, damage: 18, fireRate: 4, magazine: 12, reload: 1.4, spread: 1.2,
      recoil: pattern([0.1, 1.1], [-0.2, 1.0], [0.3, 1.2], [-0.1, 1.0]), falloff: { start: 20, end: 60, min: 0.5 }, range: 80, noise: 45,
      velocity: 360, pellets: 1, pierce: 0, damageType: "kinetic", requirements: {}, maxSockets: 2, twoHanded: false, adsTime: 0.15,
      altFire: { type: "burst", description: "Three-round burst.", rounds: 3 },
      lore: "Brass frame, nine millimetre, older than the Corridor." }),
    base({ id: "p9service", name: "Hollowell P-9 Service", cls: "pistol", level: 6, damage: 22, fireRate: 3.5, magazine: 15, reload: 1.5, spread: 1.0,
      recoil: pattern([0.2, 1.2], [-0.3, 1.1], [0.2, 1.3]), falloff: { start: 25, end: 70, min: 0.5 }, range: 90, noise: 50,
      velocity: 380, pellets: 1, pierce: 0.1, damageType: "kinetic", requirements: { aim: 20 }, maxSockets: 2, twoHanded: false, adsTime: 0.15,
      altFire: { type: "flashlight", description: "Under-barrel torch blinds for 1 s.", seconds: 1 },
      lore: "Standard issue. The serial number is filed off." }),
    base({ id: "ladybird", name: "Ladybird .22", cls: "pistol", level: 3, damage: 14, fireRate: 3, magazine: 10, reload: 1.3, spread: 0.8,
      recoil: pattern([0, 0.6], [0.1, 0.5]), falloff: { start: 15, end: 45, min: 0.4 }, range: 60, noise: 8, suppressed: true, subsonic: true,
      velocity: 300, pellets: 1, pierce: 0, damageType: "kinetic", requirements: { nerve: 20 }, maxSockets: 1, twoHanded: false, adsTime: 0.12,
      critBonus: 5, altFire: { type: "holdBreath", description: "Steady the next shot: +25% crit chance.", crit: 25 },
      lore: "Fits in a clutch. Barely a cough." }),
    // Revolvers: heavy rounds, slow reloads.
    base({ id: "oldTestament", name: "Old Testament", cls: "revolver", level: 1, damage: 48, fireRate: 1.6, magazine: 6, reload: 2.4, spread: 1.0,
      recoil: pattern([0.4, 4.0], [-0.5, 3.8]), falloff: { start: 30, end: 80, min: 0.55 }, range: 100, noise: 90,
      velocity: 420, pellets: 1, pierce: 0.2, damageType: "kinetic", requirements: { aim: 20 }, maxSockets: 3, twoHanded: false, adsTime: 0.2,
      altFire: { type: "fanTheHammer", description: "Fan the hammer: empty the cylinder fast and wide.", spread: 4 },
      lore: ".44 Magnum. It has said its piece many times." }),
    base({ id: "pearlHandle", name: "Pearl Handle", cls: "revolver", level: 8, damage: 56, fireRate: 1.5, magazine: 6, reload: 2.2, spread: 0.8,
      recoil: pattern([0.3, 3.6], [-0.4, 3.5]), falloff: { start: 35, end: 90, min: 0.55 }, range: 110, noise: 85,
      velocity: 440, pellets: 1, pierce: 0.25, damageType: "kinetic", requirements: { aim: 30 }, maxSockets: 3, twoHanded: false, adsTime: 0.2,
      critBonus: 5, altFire: { type: "fanTheHammer", description: "Fan the hammer.", spread: 3.5 },
      lore: "Mother-of-pearl grips. It matches the studs." }),
    base({ id: "juryRig", name: "Jury Rig", cls: "revolver", level: 20, damage: 40, fireRate: 1.8, magazine: 6, reload: 2.0, spread: 1.0,
      recoil: pattern([0.3, 3.2], [-0.3, 3.0]), falloff: { start: 30, end: 80, min: 0.5 }, range: 100, noise: 80,
      velocity: 600, pellets: 1, pierce: 0.2, damageType: "shock", requirements: { aim: 35, wire: 25 }, maxSockets: 3, twoHanded: false,
      altFire: { type: "charge", description: "Hold to charge the cylinder: +60% shock damage.", damage: 60 },
      lore: "A coil-gun in a revolver's coat." }),
    // SMGs: bullet hoses.
    base({ id: "rattlecan", name: "Rattlecan", cls: "smg", level: 1, damage: 11, fireRate: 13, magazine: 30, reload: 1.9, spread: 2.5,
      recoil: pattern([0.2, 0.7], [0.4, 0.6], [-0.1, 0.7], [-0.5, 0.6], [0.3, 0.5], [0.6, 0.5], [-0.4, 0.6]),
      falloff: { start: 15, end: 45, min: 0.4 }, range: 60, noise: 70, velocity: 380, pellets: 1, pierce: 0,
      damageType: "kinetic", requirements: {}, maxSockets: 3, twoHanded: false, adsTime: 0.18,
      altFire: { type: "stock", description: "Fold the stock: −30% recoil, slower to raise.", recoil: -30 },
      lore: "Stamped steel. It sounds like a paint can full of nails." }),
    base({ id: "sewingMachine", name: "Sewing Machine", cls: "smg", level: 10, damage: 13, fireRate: 16, magazine: 40, reload: 2.1, spread: 2.2,
      recoil: pattern([0.1, 0.6], [0.3, 0.5], [-0.2, 0.6], [-0.4, 0.5], [0.2, 0.6]),
      falloff: { start: 18, end: 50, min: 0.4 }, range: 65, noise: 65, velocity: 400, pellets: 1, pierce: 0.05,
      damageType: "kinetic", requirements: { aim: 25 }, maxSockets: 4, twoHanded: false, adsTime: 0.18,
      altFire: { type: "burst", description: "Five-round burst with tight spread.", rounds: 5 },
      lore: "It stitches. That's the joke." }),
    // Shotguns: close and final.
    base({ id: "streetSweeper", name: "Street Sweeper", cls: "shotgun", level: 1, damage: 12, fireRate: 1.2, magazine: 6, reload: 3.0, spread: 6,
      recoil: pattern([0.5, 6.0], [-0.6, 5.5]), falloff: { start: 6, end: 25, min: 0.2 }, range: 40, noise: 90,
      velocity: 400, pellets: 9, pierce: 0, damageType: "kinetic", requirements: { grit: 20 }, maxSockets: 3, twoHanded: true, adsTime: 0.3,
      altFire: { type: "bash", description: "Stock bash: 40 damage and a stagger.", damage: 40 },
      lore: "Pump action. Every rack is a threat." }),
    base({ id: "coachGun", name: "Coach Gun", cls: "shotgun", level: 5, damage: 14, fireRate: 3, magazine: 2, reload: 2.2, spread: 8,
      recoil: pattern([0.8, 8.0], [-0.8, 8.0]), falloff: { start: 5, end: 20, min: 0.15 }, range: 30, noise: 100,
      velocity: 380, pellets: 10, pierce: 0, damageType: "kinetic", requirements: { grit: 25 }, maxSockets: 2, twoHanded: true, adsTime: 0.25,
      altFire: { type: "bothBarrels", description: "Both barrels at once.", shots: 2 },
      lore: "Double barrel, sawn short. The Drowned Market's handshake." }),
    base({ id: "autoSweeper", name: "Auto-Sweeper", cls: "shotgun", level: 18, damage: 11, fireRate: 3.5, magazine: 12, reload: 2.8, spread: 7,
      recoil: pattern([0.6, 3.5], [-0.5, 3.2], [0.4, 3.4], [-0.6, 3.6]), falloff: { start: 6, end: 22, min: 0.2 }, range: 35, noise: 95,
      velocity: 400, pellets: 8, pierce: 0, damageType: "kinetic", requirements: { grit: 40, aim: 20 }, maxSockets: 4, twoHanded: true, adsTime: 0.3,
      altFire: { type: "slug", description: "Load a slug: one heavy projectile.", damage: 250 },
      lore: "Drum-fed. Riot squads hate it." }),
    // Assault rifles.
    base({ id: "corridorAR", name: "Corridor AR", cls: "rifle", level: 1, damage: 20, fireRate: 9, magazine: 30, reload: 2.2, spread: 1.4,
      recoil: pattern([0.2, 1.0], [0.3, 1.1], [-0.2, 1.0], [-0.4, 1.2], [0.1, 1.1], [0.5, 1.0]),
      falloff: { start: 40, end: 150, min: 0.6 }, range: 250, noise: 110, velocity: 820, pellets: 1, pierce: 0.15,
      damageType: "kinetic", requirements: { aim: 20 }, maxSockets: 4, twoHanded: true, adsTime: 0.25,
      altFire: { type: "underbarrel", description: "Under-barrel grenade: 80 damage within 4 m.", damage: 80, radius: 4 },
      lore: "Built by the people who built the road." }),
    base({ id: "enforcerCarbine", name: "Enforcer Carbine", cls: "rifle", level: 12, damage: 26, fireRate: 8, magazine: 30, reload: 2.1, spread: 1.2,
      recoil: pattern([0.2, 1.1], [-0.2, 1.2], [0.3, 1.1], [-0.3, 1.3]),
      falloff: { start: 50, end: 170, min: 0.6 }, range: 280, noise: 115, velocity: 860, pellets: 1, pierce: 0.25,
      damageType: "kinetic", requirements: { aim: 30, grit: 20 }, maxSockets: 4, twoHanded: true, adsTime: 0.25,
      altFire: { type: "burst", description: "Three-round burst.", rounds: 3 },
      lore: "Hollowell security's rifle. The visor sync is still on." }),
    // Sniper and rail rifles.
    base({ id: "widowmaker", name: "Widowmaker", cls: "sniper", level: 1, damage: 55, fireRate: 0.8, magazine: 5, reload: 3.2, spread: 0.05,
      recoil: pattern([0.3, 9.0]), falloff: { start: 400, end: 1200, min: 0.7 }, range: 1200, noise: 180, velocity: 850, pellets: 1,
      pierce: 0.4, penetration: 1, damageType: "kinetic", requirements: { aim: 20 }, maxSockets: 3, twoHanded: true, adsTime: 0.4,
      zoom: 6, sway: 0.6, altFire: { type: "zoom", description: "Toggle 6× and 12× zoom.", zoom: 12 },
      lore: "Bolt action. Cath's first. She never named it; the street did." }),
    base({ id: "rail9", name: "Rail-9", cls: "sniper", level: 18, damage: 90, fireRate: 0.5, magazine: 3, reload: 3.8, spread: 0.02,
      recoil: pattern([0.2, 11.0]), falloff: { start: 600, end: 1600, min: 0.8 }, range: 1600, noise: 140, velocity: 1100, pellets: 1,
      pierce: 0.8, penetration: 3, damageType: "kinetic", requirements: { aim: 40, wire: 25 }, maxSockets: 4, twoHanded: true, adsTime: 0.45,
      zoom: 8, sway: 0.5, altFire: { type: "charge", description: "Hold to charge for 1.2 s: +100% damage, punches through cover.", damage: 100, seconds: 1.2 },
      lore: "A coil rail. Walls are a suggestion." }),
    base({ id: "nightJar", name: "Nightjar", cls: "sniper", level: 9, damage: 46, fireRate: 1.2, magazine: 10, reload: 2.8, spread: 0.1,
      recoil: pattern([0.3, 6.5], [-0.3, 6.0]), falloff: { start: 300, end: 900, min: 0.65 }, range: 900, noise: 25, suppressed: true, subsonic: true,
      velocity: 600, pellets: 1, pierce: 0.3, penetration: 0, damageType: "kinetic", requirements: { aim: 25, nerve: 25 }, maxSockets: 3, twoHanded: true,
      adsTime: 0.35, zoom: 6, sway: 0.7, altFire: { type: "zoom", description: "Toggle thermal.", zoom: 6 },
      lore: "Integrally suppressed, subsonic. Made for rooftops." }),
    // Launchers.
    base({ id: "bargainBin", name: "Bargain Bin", cls: "launcher", level: 4, damage: 110, fireRate: 1, magazine: 6, reload: 3.5, spread: 1.5,
      recoil: pattern([0.5, 5.0]), falloff: { start: 60, end: 120, min: 0.8 }, range: 120, noise: 140, velocity: 70, pellets: 1,
      pierce: 0.3, damageType: "kinetic", requirements: { grit: 25, wire: 20 }, maxSockets: 3, twoHanded: true, adsTime: 0.35,
      altFire: { type: "remote", description: "Grenades stick and detonate on release.", radius: 4 },
      lore: "Six-shot drum grenade launcher, bought by the kilo." }),
    base({ id: "lastOrders", name: "Last Orders", cls: "launcher", level: 16, damage: 260, fireRate: 0.5, magazine: 1, reload: 3.0, spread: 0.5,
      recoil: pattern([0.3, 7.0]), falloff: { start: 150, end: 300, min: 0.8 }, range: 300, noise: 200, velocity: 120, pellets: 1,
      pierce: 0.5, damageType: "incendiary", requirements: { grit: 35, wire: 30 }, maxSockets: 3, twoHanded: true, adsTime: 0.45,
      altFire: { type: "guided", description: "Laser-guided rocket.", turnRate: 60 },
      lore: "A rocket for the end of the night." }),
    // Smart guns.
    base({ id: "candorSeeker", name: "Candor Seeker", cls: "smart", level: 6, damage: 16, fireRate: 7, magazine: 24, reload: 2.0, spread: 3,
      recoil: pattern([0.2, 0.8], [-0.2, 0.7]), falloff: { start: 30, end: 90, min: 0.5 }, range: 120, noise: 60, velocity: 200, pellets: 1,
      pierce: 0.1, damageType: "kinetic", requirements: { wire: 25 }, maxSockets: 3, twoHanded: false, adsTime: 0.3,
      altFire: { type: "tag", description: "Tag up to 3 targets; rounds curve to them.", tags: 3 },
      lore: "Candor's own. It still phones home." }),
    base({ id: "mothEye", name: "Moth-Eye", cls: "smart", level: 20, damage: 34, fireRate: 3, magazine: 12, reload: 2.4, spread: 2,
      recoil: pattern([0.3, 1.6], [-0.3, 1.5]), falloff: { start: 50, end: 140, min: 0.5 }, range: 180, noise: 70, velocity: 260, pellets: 3,
      pierce: 0.15, damageType: "shock", requirements: { wire: 40, aim: 20 }, maxSockets: 4, twoHanded: true, adsTime: 0.3,
      altFire: { type: "tag", description: "Tag up to 6 targets.", tags: 6 },
      lore: "Three micro-rounds per trigger, each with an opinion." }),
    // Melee.
    base({ id: "thePin", name: "The Pin", cls: "melee", level: 1, damage: 30, fireRate: 1.6, magazine: 0, reload: 0, spread: 0,
      recoil: NO_RECOIL, falloff: { start: 2.2, end: 2.2, min: 1 }, range: 2.2, noise: 5, velocity: 0, pellets: 1,
      pierce: 0.2, damageType: "kinetic", requirements: {}, maxSockets: 2, twoHanded: false, adsTime: 0.1,
      altFire: { type: "extend", description: "Snap the baton out to full length: +0.6 m reach, a stagger.", reach: 0.6 },
      lore: "A steel baton. She still calls it the Pin." }),
    base({ id: "nightShift", name: "Night Shift", cls: "melee", level: 5, damage: 42, fireRate: 1.4, magazine: 0, reload: 0, spread: 0,
      recoil: NO_RECOIL, falloff: { start: 2.4, end: 2.4, min: 1 }, range: 2.4, noise: 4, velocity: 0, pellets: 1,
      pierce: 0.3, damageType: "kinetic", requirements: { grit: 30 }, maxSockets: 3, twoHanded: true, adsTime: 0.1, edged: true,
      altFire: { type: "parry", description: "Parry: deflect bullets for 0.5 s.", seconds: 0.5 },
      lore: "A katana from a noodle bar's back room. Folded steel, wet neon." }),
    base({ id: "catsCradle", name: "Cat's Cradle", cls: "melee", level: 12, damage: 38, fireRate: 1.5, magazine: 0, reload: 0, spread: 0,
      recoil: NO_RECOIL, falloff: { start: 6, end: 6, min: 1 }, range: 6, noise: 2, velocity: 0, pellets: 1,
      pierce: 0.5, damageType: "monowire", requirements: { grit: 20, wire: 30 }, maxSockets: 3, twoHanded: false, adsTime: 0.1, edged: true,
      altFire: { type: "garrotte", description: "Silent garrotte from behind.", seconds: 1.5 },
      lore: "A monowire on a ring. One loop and it's over." }),
    base({ id: "repossessor", name: "Repossessor", cls: "melee", level: 15, damage: 70, fireRate: 0.8, magazine: 0, reload: 0, spread: 0,
      recoil: NO_RECOIL, falloff: { start: 2.6, end: 2.6, min: 1 }, range: 2.6, noise: 25, velocity: 0, pellets: 1,
      pierce: 0.4, damageType: "kinetic", requirements: { grit: 45 }, maxSockets: 4, twoHanded: true, adsTime: 0.1,
      altFire: { type: "slam", description: "Ground slam: knockdown within 3 m.", radius: 3, damage: 60 },
      lore: "A sledgehammer. Debt collectors' favourite." }),
  ].map((b) => [b.id, b]),
);

/** The bases of one weapon class. */
export function basesOfClass(cls: WeaponClass): WeaponBase[] {
  return Object.values(WEAPON_BASES).filter((b) => b.cls === cls);
}

/** True when a character's attributes meet a base's requirements. */
export function meetsRequirements(attributes: Attributes, requirements: Partial<Attributes>): boolean {
  return (Object.keys(requirements) as (keyof Attributes)[]).every((a) => attributes[a] >= (requirements[a] ?? 0));
}

// ---------------------------------------------------------------------------------------------------------
// Tiers and parts (the gunsmith, Ana Ruiz)
// ---------------------------------------------------------------------------------------------------------

export type Tier = 1 | 2 | 3 | 4 | 5;
export const TIER_NAMES = ["I", "II", "III", "IV", "V"] as const;
/** Base damage multiplier per tier. */
export const TIER_DAMAGE: readonly number[] = [1, 1.2, 1.45, 1.75, 2.1];
/** Scrip to upgrade to tier n+1 from tier n, before the item-level factor. */
export const TIER_UPGRADE_COST: readonly number[] = [400, 1200, 3500, 9000];

/** Scrip to raise a weapon of this item level from `tier` to `tier + 1` (null at tier V). */
export function upgradeCost(tier: Tier, itemLevel: number): number | null {
  const c = TIER_UPGRADE_COST[tier - 1];
  return c === undefined ? null : Math.round(c * (1 + itemLevel / 20));
}

/** Item level scaling of base damage: +4% per item level above 1. */
export function levelDamageScale(itemLevel: number): number {
  return 1 + 0.04 * Math.max(0, itemLevel - 1);
}

export type PartSlot = "barrel" | "scope" | "suppressor" | "mag" | "stock";
export const PART_SLOTS: readonly PartSlot[] = ["barrel", "scope", "suppressor", "mag", "stock"];

/** Weapon-local stats parts and local affixes change. Percent values for increased; flat adds. */
export type WeaponStatKey =
  | "damage"
  | "fireRate"
  | "magazine"
  | "reloadSpeed"
  | "spread"
  | "recoil"
  | "falloff"
  | "range"
  | "noise"
  | "velocity"
  | "adsSpeed"
  | "sway"
  | "zoom"
  | "pierce"
  | "critBonus"
  | "pellets"
  | "penetration";

export interface WeaponMod {
  stat: WeaponStatKey;
  kind: "flat" | "increased";
  value: number;
}

export interface WeaponPart {
  id: string;
  name: string;
  slot: PartSlot;
  /** Weapon classes it fits. */
  fits: readonly WeaponClass[];
  mods: readonly WeaponMod[];
  /** Makes the weapon suppressed / subsonic. */
  suppresses?: boolean;
  subsonic?: boolean;
  cost: number;
}

const GUNS: WeaponClass[] = ["pistol", "revolver", "smg", "shotgun", "rifle", "sniper", "launcher", "smart"];
const SCOPED: WeaponClass[] = ["pistol", "revolver", "smg", "rifle", "sniper", "smart"];
const LONG: WeaponClass[] = ["rifle", "sniper", "smg", "shotgun", "smart"];
const CANS: WeaponClass[] = ["pistol", "smg", "rifle", "sniper", "smart"];
const MAGS: WeaponClass[] = ["pistol", "smg", "shotgun", "rifle", "sniper", "smart", "launcher"];
const m = (stat: WeaponStatKey, value: number, kind: WeaponMod["kind"] = "increased"): WeaponMod => ({ stat, kind, value });

export const WEAPON_PARTS: Readonly<Record<string, WeaponPart>> = Object.fromEntries(
  (
    [
      { id: "longBarrel", name: "Long Barrel", slot: "barrel", fits: LONG, cost: 300, mods: [m("falloff", 25), m("velocity", 10), m("damage", 5), m("adsSpeed", -5)] },
      { id: "snubBarrel", name: "Snub Barrel", slot: "barrel", fits: GUNS, cost: 200, mods: [m("adsSpeed", 15), m("falloff", -15)] },
      { id: "flutedBarrel", name: "Fluted Barrel", slot: "barrel", fits: GUNS, cost: 450, mods: [m("recoil", -10), m("fireRate", 5)] },
      { id: "chokeBarrel", name: "Full Choke", slot: "barrel", fits: ["shotgun"], cost: 350, mods: [m("spread", -30), m("falloff", 20)] },
      { id: "redDot", name: "Red Dot", slot: "scope", fits: SCOPED, cost: 150, mods: [m("adsSpeed", 10), m("zoom", 0.5, "flat")] },
      { id: "fourGlass", name: "4× Glass", slot: "scope", fits: SCOPED, cost: 400, mods: [m("zoom", 3, "flat"), m("adsSpeed", -5)] },
      { id: "nightGlass", name: "Night Glass 8×", slot: "scope", fits: ["rifle", "sniper"], cost: 900, mods: [m("zoom", 2, "flat"), m("sway", -10)] },
      { id: "thermal", name: "Thermal 12×", slot: "scope", fits: ["sniper"], cost: 1600, mods: [m("zoom", 6, "flat"), m("adsSpeed", -15), m("critBonus", 3, "flat")] },
      { id: "can", name: "The Can", slot: "suppressor", fits: CANS, cost: 500, suppresses: true, mods: [m("noise", -70), m("damage", -5), m("velocity", -10)] },
      { id: "subsonicBaffle", name: "Subsonic Baffle", slot: "suppressor", fits: CANS, cost: 1100, suppresses: true, subsonic: true,
        mods: [m("noise", -85), m("velocity", -25), m("damage", -8)] },
      { id: "extendedMag", name: "Extended Mag", slot: "mag", fits: MAGS, cost: 250, mods: [m("magazine", 40), m("reloadSpeed", -10)] },
      { id: "drumMag", name: "Drum", slot: "mag", fits: ["smg", "rifle", "shotgun"], cost: 700, mods: [m("magazine", 100), m("reloadSpeed", -25), m("adsSpeed", -10)] },
      { id: "quickMag", name: "Quick-Pull Mag", slot: "mag", fits: MAGS, cost: 400, mods: [m("reloadSpeed", 25)] },
      { id: "paddedStock", name: "Padded Stock", slot: "stock", fits: GUNS, cost: 200, mods: [m("recoil", -15)] },
      { id: "skeletonStock", name: "Skeleton Stock", slot: "stock", fits: GUNS, cost: 250, mods: [m("adsSpeed", 15), m("recoil", 5)] },
      { id: "marksmanStock", name: "Marksman Stock", slot: "stock", fits: ["rifle", "sniper"], cost: 600, mods: [m("sway", -20), m("recoil", -5)] },
    ] satisfies WeaponPart[]
  ).map((p) => [p.id, p]),
);

/** True when a part fits a weapon class. */
export function partFits(part: WeaponPart, cls: WeaponClass): boolean {
  return part.fits.includes(cls);
}

export interface WeaponBuild {
  itemLevel?: number;
  tier?: Tier;
  /** Part ids by slot. Parts that don't fit are ignored. */
  parts?: Partial<Record<PartSlot, string>>;
  /** Local affix / chip / chain modifiers. */
  mods?: readonly WeaponMod[];
  name?: string;
}

/** Resolves a base plus item level, tier, parts and local mods into the numbers the weapon fires with. */
export function weaponStats(b: WeaponBase, build: WeaponBuild = {}): WeaponStats {
  const mods: WeaponMod[] = [...(build.mods ?? [])];
  let suppressed = b.suppressed;
  let subsonic = b.subsonic;
  for (const id of Object.values(build.parts ?? {})) {
    const part = id ? WEAPON_PARTS[id] : undefined;
    if (!part || !partFits(part, b.cls)) continue;
    mods.push(...part.mods);
    if (part.suppresses) suppressed = true;
    if (part.subsonic) subsonic = true;
  }
  const flatOf = (k: WeaponStatKey) => mods.reduce((s, x) => (x.stat === k && x.kind === "flat" ? s + x.value : s), 0);
  const incOf = (k: WeaponStatKey) => mods.reduce((s, x) => (x.stat === k && x.kind === "increased" ? s + x.value : s), 0);
  const scale = (k: WeaponStatKey, v: number) => (v + flatOf(k)) * Math.max(0.05, 1 + incOf(k) / 100);

  const tier = build.tier ?? 1;
  const damage = scale("damage", b.damage * levelDamageScale(build.itemLevel ?? b.level) * (TIER_DAMAGE[tier - 1] ?? 1));
  const falloffScale = Math.max(0.1, 1 + incOf("falloff") / 100);
  const reloadScale = Math.max(0.1, 1 + incOf("reloadSpeed") / 100);
  const adsScale = Math.max(0.1, 1 + incOf("adsSpeed") / 100);
  const recoilScale = Math.max(0.1, 1 + incOf("recoil") / 100);
  return {
    id: b.id,
    name: build.name ?? b.name,
    cls: b.cls,
    damage,
    fireRate: scale("fireRate", b.fireRate),
    magazine: b.magazine === 0 ? 0 : Math.max(1, Math.round(scale("magazine", b.magazine))),
    reload: b.reload / reloadScale,
    spread: scale("spread", b.spread),
    recoil: b.recoil.map((r) => ({ x: r.x * recoilScale, y: r.y * recoilScale })),
    falloff: b.cls === "melee" ? b.falloff : { start: b.falloff.start * falloffScale, end: b.falloff.end * falloffScale, min: b.falloff.min },
    range: b.cls === "melee" ? scale("range", b.range) : scale("range", b.range) * falloffScale,
    noise: Math.max(1, scale("noise", b.noise)),
    velocity: scale("velocity", b.velocity),
    pellets: Math.max(1, Math.round(b.pellets + flatOf("pellets"))),
    pierce: Math.min(0.95, b.pierce + flatOf("pierce") / 100),
    penetration: b.penetration + flatOf("penetration"),
    damageType: b.damageType,
    critBonus: b.critBonus + flatOf("critBonus"),
    adsTime: b.adsTime / adsScale,
    sway: scale("sway", b.sway),
    zoom: b.zoom + flatOf("zoom"),
    suppressed,
    subsonic,
    edged: b.edged,
    altFire: b.altFire,
  };
}

/** The recoil kick for the nth shot of a burst (0-based), looping the pattern. */
export function recoilAt(weapon: Pick<WeaponStats, "recoil">, shot: number): RecoilStep {
  const p = weapon.recoil;
  return p[((shot % p.length) + p.length) % p.length] ?? { x: 0, y: 0 };
}

/** Damage per second against an unarmoured torso, ignoring reloads (for UI comparisons). */
export function nominalDps(w: WeaponStats): number {
  return w.damage * w.pellets * w.fireRate;
}
