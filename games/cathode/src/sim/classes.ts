// CATHODE's five classes and their 150 skills (5 classes × 3 trees × 10 skills), plus the 10 hybrid
// capstones, as data. Each skill has one "main value" that grows linearly with rank
// (`base + perRank × (rank − 1)`, optionally capped) and is raised by synergies, Diablo II-style:
// +perPoint% per hard point in each named skill. The main value then feeds the skill's modifiers (for
// passives) or its effect parameters (for actives, which the game layer reads). Allocation rules live in
// skills.ts; this file is only the catalogue.
//
// Tree layout (every tree): rows 0–3 hold two skills each, row 4 one, row 5 (level 30) the tree's capstone.
// Row unlock levels are 1, 6, 12, 18, 24 and 30. Prerequisites point to earlier rows of the same tree.

import { CLASS_IDS, TREES_BY_CLASS, type ClassId, type TreeId } from "./types";
import { flat, inc, more, type Modifier } from "./stats";

export type SkillRow = 0 | 1 | 2 | 3 | 4 | 5;
/** The character level each row unlocks at (design bible 4.2). */
export const ROW_LEVELS: readonly number[] = [1, 6, 12, 18, 24, 30];
export const MAX_SKILL_RANK = 20;
/** The level the second class opens at. */
export const DUAL_CLASS_LEVEL = 15;
/** Second-class skills unlock this many levels later than their row level. */
export const SECOND_CLASS_DELAY = 3;
export const HYBRID_LEVEL = 30;

/** Parameters an active skill hands the game layer, e.g. `{type: "bulletTime", seconds: 2.6}`. */
export interface SkillEffect {
  type: string;
  [param: string]: number | string | boolean;
}

export interface Synergy {
  /** The skill whose hard points raise this one. */
  from: string;
  /** +% to this skill's main value per hard point in `from`. */
  perPoint: number;
}

export interface ActiveSpec {
  /** Seconds between uses (before cooldown reduction). */
  cooldown: number;
  /** Battery cost per use. */
  battery: number;
  /** The parameters the game layer reads, from the synergised main value and the effective rank. */
  effect(value: number, rank: number): SkillEffect;
}

export interface SkillDef {
  /** `class.key`, e.g. "ghost.steadyHands"; hybrid capstones are `hybrid.key`. */
  id: string;
  name: string;
  /** The owning class (the first of a hybrid's pair). */
  cls: ClassId;
  /** One class, or both classes of a hybrid capstone. */
  classes: readonly ClassId[];
  tree: TreeId | "hybrid";
  row: SkillRow;
  /** Skill ids that need at least one point first. */
  prereqs: readonly string[];
  maxRank: number;
  kind: "active" | "passive";
  /** One crisp line with the rank-1 numbers and the per-rank growth. */
  description: string;
  /** The description template; `{v}` is the main value. */
  template: string;
  main: { base: number; perRank: number; cap?: number };
  synergies: readonly Synergy[];
  /** Modifiers this skill adds to the character at a given (synergised) value and effective rank. */
  modifiers(value: number, rank: number): Modifier[];
  active?: ActiveSpec;
  /** True for the 10 hybrid capstones. */
  hybrid?: boolean;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  fantasy: string;
  trees: readonly TreeId[];
}

export interface TreeDef {
  id: TreeId;
  name: string;
  cls: ClassId;
  theme: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  ghost: { id: "ghost", name: "Ghost", fantasy: "The unseen sniper.", trees: TREES_BY_CLASS.ghost },
  butcher: { id: "butcher", name: "Butcher", fantasy: "Blades, the Pin and shotguns.", trees: TREES_BY_CLASS.butcher },
  gunslinger: {
    id: "gunslinger",
    name: "Gunslinger",
    fantasy: "Pistols, revolvers and SMGs with style.",
    trees: TREES_BY_CLASS.gunslinger,
  },
  wirewitch: { id: "wirewitch", name: "Wirewitch", fantasy: "The hacker.", trees: TREES_BY_CLASS.wirewitch },
  fixer: { id: "fixer", name: "Fixer", fantasy: "Explosives and gadgets.", trees: TREES_BY_CLASS.fixer },
};

export const TREES: Record<TreeId, TreeDef> = {
  longshot: { id: "longshot", name: "Longshot", cls: "ghost", theme: "Sniper rifles, bullet-time, wind reading." },
  shroud: { id: "shroud", name: "Shroud", cls: "ghost", theme: "Stealth, optic camo, silent takedowns." },
  coldRead: { id: "coldRead", name: "Cold Read", cls: "ghost", theme: "Marks, weak spots, kill-cam rewards." },
  meat: { id: "meat", name: "Meat", cls: "butcher", theme: "Blades, the Pin, finishers, dismemberment." },
  scattergun: { id: "scattergun", name: "Scattergun", cls: "butcher", theme: "Shotguns, knockback, close crits." },
  iron: { id: "iron", name: "Iron", cls: "butcher", theme: "Armour, rage, kills heal you." },
  sixShooter: { id: "sixShooter", name: "Six-Shooter", cls: "gunslinger", theme: "Revolvers, fan the hammer, ricochets." },
  spray: { id: "spray", name: "Spray", cls: "gunslinger", theme: "SMGs, dual-wield, magazine size." },
  showman: { id: "showman", name: "Showman", cls: "gunslinger", theme: "Style meter, reload tricks, chain kills." },
  ghostInTheWire: {
    id: "ghostInTheWire",
    name: "Ghost in the Wire",
    cls: "wirewitch",
    theme: "Camera, turret and drone hijack.",
  },
  shortCircuit: { id: "shortCircuit", name: "Short Circuit", cls: "wirewitch", theme: "Overloads, chains, cyberpsychosis." },
  daemon: { id: "daemon", name: "Daemon", cls: "wirewitch", theme: "Smart guns, homing rounds, an AI familiar." },
  demolition: { id: "demolition", name: "Demolition", cls: "fixer", theme: "Launchers, grenades, mines." },
  workshop: { id: "workshop", name: "Workshop", cls: "fixer", theme: "Deployable turrets and drones." },
  chem: { id: "chem", name: "Chem", cls: "fixer", theme: "Gas, incendiaries, stims." },
};

// ---------------------------------------------------------------------------------------------------------
// The compact skill DSL
// ---------------------------------------------------------------------------------------------------------

interface SkillSpec {
  /** Key, unique within the class. */
  k: string;
  /** Name. */
  n: string;
  r: SkillRow;
  /** Prerequisite keys in the same class. */
  pre?: string[];
  /** Description template; `{v}` is the main value. */
  d: string;
  /** Main value at rank 1 and per extra rank. */
  b: number;
  p: number;
  cap?: number;
  /** Passive modifiers from the main value. */
  m?: (v: number, rank: number) => Modifier[];
  /** Synergies: [key in the same class, % per point]. */
  syn?: [string, number][];
  /** Active: cooldown, battery and effect. */
  act?: { cd: number; bat: number; fx: (v: number, rank: number) => SkillEffect };
}

/** Rounds a value for display: whole numbers stay whole, others get up to two decimals. */
export function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

/** Fills a template with a value. */
export function fillTemplate(template: string, value: number): string {
  return template.split("{v}").join(fmt(value));
}

function build(cls: ClassId, tree: TreeId | "hybrid", specs: SkillSpec[], classes: readonly ClassId[] = [cls]): SkillDef[] {
  const prefix = tree === "hybrid" ? "hybrid" : cls;
  return specs.map((s): SkillDef => {
    const id = `${prefix}.${s.k}`;
    const per = s.p === 0 ? "" : ` (+${fmt(s.p)} per rank${s.cap !== undefined ? `, max ${fmt(s.cap)}` : ""})`;
    const def: SkillDef = {
      id,
      name: s.n,
      cls,
      classes,
      tree,
      row: s.r,
      prereqs: (s.pre ?? []).map((k) => (k.includes(".") ? k : `${cls}.${k}`)),
      maxRank: MAX_SKILL_RANK,
      kind: s.act ? "active" : "passive",
      description: fillTemplate(s.d, s.b) + per,
      template: s.d,
      main: { base: s.b, perRank: s.p, cap: s.cap },
      synergies: (s.syn ?? []).map(([k, perPoint]) => ({ from: k.includes(".") ? k : `${cls}.${k}`, perPoint })),
      modifiers: (v, rank) => (s.m ? s.m(v, rank).map((mod) => ({ ...mod, source: id })) : []),
    };
    if (s.act) {
      const a = s.act;
      def.active = { cooldown: a.cd, battery: a.bat, effect: a.fx };
    }
    if (tree === "hybrid") def.hybrid = true;
    return def;
  });
}

const floor = Math.floor;

// ---------------------------------------------------------------------------------------------------------
// Ghost: the unseen sniper
// ---------------------------------------------------------------------------------------------------------

const LONGSHOT: SkillSpec[] = [
  { k: "steadyHands", n: "Steady Hands", r: 0, d: "+{v}% sniper rifle damage.", b: 10, p: 3,
    m: (v) => [inc("damage.sniper", v)], syn: [["windReader", 4], ["deadCalm", 4]] },
  { k: "heldBreath", n: "Held Breath", r: 0, d: "Hold your breath: scope sway −{v}% for 4 s.", b: 50, p: 2, cap: 90,
    act: { cd: 6, bat: 4, fx: (v) => ({ type: "heldBreath", sway: v, seconds: 4 }) } },
  { k: "windReader", n: "Wind Reader", r: 1, pre: ["steadyHands"], d: "The reticle shows wind drift; +{v}% muzzle velocity.", b: 5, p: 1.5,
    m: (v) => [inc("projectileSpeed", v)] },
  { k: "slowTime", n: "Slow Time", r: 1, pre: ["heldBreath"], d: "Bullet-time: the world runs at 25% speed for {v} s.", b: 2, p: 0.15,
    syn: [["longExposure", 3]], act: { cd: 20, bat: 25, fx: (v) => ({ type: "bulletTime", seconds: v, timeScale: 0.25 }) } },
  { k: "deadCalm", n: "Dead Calm", r: 2, pre: ["windReader"], d: "+{v}% headshot damage.", b: 8, p: 3,
    m: (v) => [inc("headshot", v)], syn: [["steadyHands", 3]] },
  { k: "tungsten", n: "Tungsten Core", r: 2, pre: ["windReader"], d: "Sniper rounds ignore {v}% armour and punch through one more body.", b: 10, p: 2, cap: 60,
    m: (v) => [flat("armourPierce.sniper", v), flat("penetration", 1)] },
  { k: "longExposure", n: "Long Exposure", r: 3, pre: ["slowTime"], d: "+{v}% bullet-time duration; kills in bullet-time add 0.5 s.", b: 10, p: 4,
    m: (v) => [inc("bulletTime", v), flat("bulletTimeOnKill", 0.5)] },
  { k: "rangefinder", n: "Rangefinder", r: 3, pre: ["deadCalm"], d: "+{v}% damage per 100 m to the target (up to 5 steps).", b: 3, p: 1,
    m: (v) => [flat("rangeDamage", v)] },
  { k: "railDiscipline", n: "Rail Discipline", r: 4, pre: ["tungsten", "rangefinder"], d: "Rails charge {v}% faster; sniper reloads +{v}% faster.", b: 8, p: 2,
    m: (v) => [inc("chargeSpeed", v), inc("reloadSpeed.sniper", v)] },
  { k: "oneShot", n: "One Shot, One Name", r: 5, pre: ["railDiscipline", "longExposure"], d: "Your next sniper shot deals +{v}% damage and always crits.", b: 100, p: 15,
    syn: [["steadyHands", 5], ["deadCalm", 5]], act: { cd: 45, bat: 30, fx: (v) => ({ type: "oneShot", damage: v, crit: true }) } },
];

const SHROUD: SkillSpec[] = [
  { k: "softSoles", n: "Soft Soles", r: 0, d: "Footsteps are {v}% quieter.", b: 10, p: 3, cap: 80,
    m: (v) => [inc("footstepNoise", -v)] },
  { k: "silentTakedown", n: "Silent Takedown", r: 0, d: "Takedowns from behind reach {v} m, instant and silent.", b: 2, p: 0.1,
    act: { cd: 1, bat: 0, fx: (v) => ({ type: "takedownRange", meters: v }) } },
  { k: "shadowFed", n: "Shadow-Fed", r: 1, pre: ["softSoles"], d: "+{v}% stealth while in light below 30%.", b: 10, p: 3,
    m: (v) => [flat("darkStealth", v)], syn: [["lowProfile", 4]] },
  { k: "opticCamo", n: "Optic Camo", r: 1, pre: ["softSoles"], d: "Near-invisible for {v} s (detection ×0.1); unsuppressed shots break it.", b: 4, p: 0.3,
    syn: [["shadowFed", 3]], act: { cd: 25, bat: 30, fx: (v) => ({ type: "opticCamo", seconds: v, detection: 0.1 }) } },
  { k: "bodyCourier", n: "Body Courier", r: 2, pre: ["silentTakedown"], d: "Carry bodies at full speed; hidden bodies are found {v}% less often.", b: 20, p: 3, cap: 90,
    m: (v) => [flat("bodyConceal", v)] },
  { k: "lowProfile", n: "Low Profile", r: 2, pre: ["shadowFed"], d: "+{v}% stealth: detection meters fill slower.", b: 6, p: 2,
    m: (v) => [inc("stealth", v)], syn: [["softSoles", 2]] },
  { k: "subsonic", n: "Subsonic", r: 3, pre: ["lowProfile"], d: "Suppressed weapons are silent; +{v}% damage with them.", b: 5, p: 2,
    m: (v) => [flat("subsonic", 1), inc("suppressedDamage", v)] },
  { k: "deathFromShadow", n: "Death from Shadow", r: 3, pre: ["bodyCourier"], d: "Takedowns are {v}% faster and heal 10% health.", b: 15, p: 3,
    m: (v) => [inc("takedownSpeed", v)] },
  { k: "vanish", n: "Vanish", r: 4, pre: ["opticCamo", "subsonic"], d: "Enemies within 25 m lose you and fall back to searching; {v} s of camo.", b: 2, p: 0.15,
    syn: [["opticCamo", 4]], act: { cd: 60, bat: 40, fx: (v) => ({ type: "vanish", radius: 25, seconds: v }) } },
  { k: "nobodyHome", n: "Nobody Home", r: 5, pre: ["vanish", "deathFromShadow"], d: "Unseen kills give +{v}% XP and refill 10 battery.", b: 20, p: 4,
    m: (v) => [flat("unseenXp", v)], syn: [["lowProfile", 3]] },
];

const COLD_READ: SkillSpec[] = [
  { k: "caseTheRoom", n: "Case the Room", r: 0, d: "Mark every enemy within {v} m, through walls, for 12 s.", b: 20, p: 2,
    syn: [["tells", 4]], act: { cd: 15, bat: 10, fx: (v) => ({ type: "mark", radius: v, seconds: 12 }) } },
  { k: "weakSpot", n: "Weak Spot", r: 0, d: "+{v}% damage to marked enemies.", b: 8, p: 3,
    m: (v) => [inc("weakSpot", v)], syn: [["autopsy", 4]] },
  { k: "tells", n: "Tells", r: 1, pre: ["caseTheRoom"], d: "Marked enemies show their awareness; marks last {v}% longer.", b: 20, p: 5,
    m: (v) => [inc("markDuration", v)] },
  { k: "coldEye", n: "Cold Eye", r: 1, pre: ["weakSpot"], d: "+{v}% critical chance.", b: 2, p: 0.5,
    m: (v) => [flat("critChance", v)] },
  { k: "autopsy", n: "Autopsy", r: 2, pre: ["coldEye"], d: "+{v}% critical damage.", b: 10, p: 4,
    m: (v) => [flat("critMultiplier", v)], syn: [["coldEye", 2]] },
  { k: "dossier", n: "Dossier", r: 2, pre: ["tells"], d: "Read a target: it takes +{v}% damage from you for 10 s.", b: 15, p: 2,
    syn: [["weakSpot", 3]], act: { cd: 12, bat: 12, fx: (v) => ({ type: "dossier", damage: v, seconds: 10 }) } },
  { k: "killCamJunkie", n: "Kill-Cam Junkie", r: 3, pre: ["autopsy"], d: "+{v}% kill-cam chance; each kill-cam refunds 5 battery.", b: 10, p: 2,
    m: (v) => [flat("killCamChance", v)] },
  { k: "readTheRoom", n: "Read the Room", r: 3, pre: ["dossier"], d: "Marking an enemy marks {v} more within 8 m.", b: 1, p: 0.25,
    m: (v) => [flat("marks", floor(v))] },
  { k: "finalWord", n: "Final Word", r: 4, pre: ["killCamJunkie", "readTheRoom"], d: "Kills restore {v}% of max health.", b: 2, p: 0.4,
    m: (v) => [flat("lifeOnKill", v)] },
  { k: "nameOnTheList", n: "Name on the List", r: 5, pre: ["finalWord"], d: "One target takes +{v}% damage and every hit on it crits for 8 s.", b: 40, p: 6,
    syn: [["weakSpot", 4], ["dossier", 4]], act: { cd: 40, bat: 35, fx: (v) => ({ type: "nameOnTheList", damage: v, seconds: 8, crit: true }) } },
];

// ---------------------------------------------------------------------------------------------------------
// Butcher: blades, the Pin and shotguns
// ---------------------------------------------------------------------------------------------------------

const MEAT: SkillSpec[] = [
  { k: "thePin", n: "The Pin", r: 0, d: "+{v}% melee damage with the Pin and blades.", b: 12, p: 4,
    m: (v) => [inc("damage.melee", v)], syn: [["abattoir", 3]] },
  { k: "cleave", n: "Cleave", r: 0, d: "A wide swing hits everything within 2.5 m for {v}% weapon damage.", b: 120, p: 8,
    syn: [["thePin", 4]], act: { cd: 3, bat: 5, fx: (v) => ({ type: "cleave", damage: v, radius: 2.5 }) } },
  { k: "butchersEye", n: "Butcher's Eye", r: 1, pre: ["thePin"], d: "Limbs sever {v}% more easily.", b: 10, p: 3, cap: 100,
    m: (v) => [inc("sever", v)] },
  { k: "lunge", n: "Lunge", r: 1, pre: ["cleave"], d: "Dash {v} m to a target and strike; a kill resets the cooldown.", b: 6, p: 0.3,
    act: { cd: 6, bat: 8, fx: (v) => ({ type: "lunge", meters: v }) } },
  { k: "finisher", n: "Finisher", r: 2, pre: ["butchersEye"], d: "Execute an enemy under {v}% health; restore 15% health.", b: 20, p: 1, cap: 45,
    act: { cd: 8, bat: 10, fx: (v) => ({ type: "finisher", threshold: v, heal: 15 }) } },
  { k: "bleeder", n: "Bleeder", r: 2, pre: ["lunge"], d: "Blade hits bleed for {v}% weapon damage over 4 s.", b: 20, p: 5,
    m: (v) => [flat("bleed", v)], syn: [["butchersEye", 3]] },
  { k: "monowireWhip", n: "Monowire Whip", r: 3, pre: ["finisher"], d: "Lash 8 m with monowire for {v}% damage; kills sever.", b: 140, p: 10,
    syn: [["thePin", 3], ["butchersEye", 3]], act: { cd: 5, bat: 12, fx: (v) => ({ type: "monowireWhip", damage: v, range: 8, damageType: "monowire" }) } },
  { k: "frenzy", n: "Frenzy", r: 3, pre: ["bleeder"], d: "Melee kills give +{v}% attack speed for 6 s (stacks 3 times).", b: 5, p: 1,
    m: (v) => [flat("frenzy", v)] },
  { k: "abattoir", n: "Abattoir", r: 4, pre: ["monowireWhip", "frenzy"], d: "+{v}% damage to wounded (limping, crawling or severed) enemies.", b: 15, p: 4,
    m: (v) => [inc("woundedDamage", v)] },
  { k: "redHarvest", n: "Red Harvest", r: 5, pre: ["abattoir"], d: "For 8 s every melee hit severs and returns {v}% of its damage as health.", b: 10, p: 1,
    syn: [["bleeder", 2]], act: { cd: 50, bat: 40, fx: (v) => ({ type: "redHarvest", seconds: 8, lifeSteal: v }) } },
];

const SCATTERGUN: SkillSpec[] = [
  { k: "pointBlank", n: "Point Blank", r: 0, d: "+{v}% shotgun damage.", b: 10, p: 3,
    m: (v) => [inc("damage.shotgun", v)], syn: [["closeCall", 3], ["meatGrinder", 3]] },
  { k: "slugThrower", n: "Slug Thrower", r: 0, d: "Load a slug: one projectile for {v}% of a full blast with 50% armour pierce.", b: 130, p: 6,
    act: { cd: 4, bat: 4, fx: (v) => ({ type: "slug", damage: v, pierce: 50 }) } },
  { k: "knockdown", n: "Knockdown", r: 1, pre: ["pointBlank"], d: "+{v}% knockback; knocked-down enemies take +20% damage.", b: 20, p: 5,
    m: (v) => [inc("knockback", v)] },
  { k: "chokeWork", n: "Choke Work", r: 1, pre: ["slugThrower"], d: "−{v}% shotgun spread.", b: 6, p: 2, cap: 50,
    m: (v) => [inc("spread.shotgun", -v)] },
  { k: "closeCall", n: "Close Call", r: 2, pre: ["knockdown"], d: "+{v}% critical chance with shotguns.", b: 4, p: 1, cap: 30,
    m: (v) => [flat("critChance.shotgun", v)] },
  { k: "dragonsBreath", n: "Dragon's Breath", r: 2, pre: ["chokeWork"], d: "For 10 s pellets ignite, burning for {v}% of their damage over 3 s.", b: 40, p: 5,
    act: { cd: 15, bat: 15, fx: (v) => ({ type: "dragonsBreath", burn: v, seconds: 10, damageType: "incendiary" }) } },
  { k: "doubleBarrel", n: "Double Barrel", r: 3, pre: ["closeCall"], d: "+{v}% shotgun fire rate and +1 pellet.", b: 5, p: 1.5,
    m: (v) => [inc("fireRate.shotgun", v), flat("pellets", 1)] },
  { k: "shellGame", n: "Shell Game", r: 3, pre: ["dragonsBreath"], d: "+{v}% shotgun reload speed.", b: 10, p: 3,
    m: (v) => [inc("reloadSpeed.shotgun", v)] },
  { k: "meatGrinder", n: "Meat Grinder", r: 4, pre: ["doubleBarrel", "shellGame"], d: "Shotgun kills within 6 m sever and splash {v}% damage to enemies behind.", b: 20, p: 4,
    m: (v) => [flat("grinderSplash", v), inc("sever", 10)] },
  { k: "judgementDay", n: "Judgement Day", r: 5, pre: ["meatGrinder"], d: "One blast of every shell: {v}% damage in a 10 m cone.", b: 300, p: 20,
    syn: [["pointBlank", 4], ["doubleBarrel", 3]], act: { cd: 30, bat: 30, fx: (v) => ({ type: "judgementDay", damage: v, range: 10 }) } },
];

const IRON: SkillSpec[] = [
  { k: "thickSkin", n: "Thick Skin", r: 0, d: "+{v} armour.", b: 15, p: 6,
    m: (v) => [flat("armour", v)], syn: [["platework", 3]] },
  { k: "bloodRush", n: "Blood Rush", r: 0, d: "Kills heal {v}% of max health.", b: 2, p: 0.4,
    m: (v) => [flat("lifeOnKill", v)] },
  { k: "rage", n: "Rage", r: 1, pre: ["bloodRush"], d: "Taking damage builds rage; full rage gives +{v}% damage for 8 s.", b: 15, p: 3,
    m: (v) => [flat("rageDamage", v)] },
  { k: "ironHide", n: "Iron Hide", r: 1, pre: ["thickSkin"], d: "+{v}% max health.", b: 6, p: 2,
    m: (v) => [inc("maxHealth", v)] },
  { k: "warCry", n: "War Cry", r: 2, pre: ["rage"], d: "Enemies within 10 m flee for {v} s; gain 30 rage.", b: 2, p: 0.15,
    act: { cd: 20, bat: 15, fx: (v) => ({ type: "warCry", seconds: v, radius: 10, rage: 30 }) } },
  { k: "platework", n: "Platework", r: 2, pre: ["ironHide"], d: "+{v}% kinetic resistance.", b: 3, p: 1, cap: 40,
    m: (v) => [flat("resist.kinetic", v)] },
  { k: "secondWind", n: "Second Wind", r: 3, pre: ["platework"], d: "Once every 90 s a killing blow leaves you at {v}% health instead.", b: 10, p: 1.5, cap: 50,
    m: (v) => [flat("secondWind", v)] },
  { k: "bloodthirst", n: "Bloodthirst", r: 3, pre: ["warCry"], d: "{v}% of damage dealt returns as health.", b: 1, p: 0.25,
    m: (v) => [flat("lifeSteal", v)] },
  { k: "unstoppable", n: "Unstoppable", r: 4, pre: ["secondWind", "bloodthirst"], d: "Immune to knockdown; −{v}% damage taken above half rage.", b: 5, p: 1, cap: 25,
    m: (v) => [flat("rageDamageReduction", v)] },
  { k: "juggernaut", n: "Juggernaut", r: 5, pre: ["unstoppable"], d: "For 10 s take {v}% less damage and walk through gunfire.", b: 30, p: 2, cap: 70,
    syn: [["thickSkin", 1], ["ironHide", 1]], act: { cd: 60, bat: 40, fx: (v) => ({ type: "juggernaut", reduction: Math.min(70, v), seconds: 10 }) } },
];

// ---------------------------------------------------------------------------------------------------------
// Gunslinger: pistols, revolvers and SMGs
// ---------------------------------------------------------------------------------------------------------

const SIX_SHOOTER: SkillSpec[] = [
  { k: "quickDraw", n: "Quick Draw", r: 0, d: "+{v}% revolver damage.", b: 10, p: 3,
    m: (v) => [inc("damage.revolver", v)], syn: [["highCaliber", 3]] },
  { k: "fanTheHammer", n: "Fan the Hammer", r: 0, d: "Empty the cylinder in 0.6 s; each round deals {v}% damage.", b: 70, p: 4,
    syn: [["quickDraw", 3]], act: { cd: 6, bat: 6, fx: (v) => ({ type: "fanTheHammer", damage: v, duration: 0.6 }) } },
  { k: "ricochet", n: "Ricochet", r: 1, pre: ["quickDraw"], d: "Revolver rounds bounce to another target within 10 m for {v}% damage.", b: 30, p: 3,
    m: (v, rank) => [flat("ricochet", 1 + floor(rank / 10)), flat("ricochetDamage", v)], syn: [["trickBounce", 4]] },
  { k: "speedLoader", n: "Speed Loader", r: 1, pre: ["fanTheHammer"], d: "+{v}% revolver and pistol reload speed.", b: 10, p: 3,
    m: (v) => [inc("reloadSpeed.revolver", v), inc("reloadSpeed.pistol", v)] },
  { k: "deadEye", n: "Dead Eye", r: 2, pre: ["ricochet"], d: "Slow time and paint {v} marks; release to fire at each.", b: 2, p: 0.1,
    act: { cd: 20, bat: 25, fx: (v) => ({ type: "deadEye", marks: Math.min(6, floor(v)), seconds: 3 }) } },
  { k: "hairTrigger", n: "Hair Trigger", r: 2, pre: ["speedLoader"], d: "+{v}% revolver fire rate.", b: 6, p: 2,
    m: (v) => [inc("fireRate.revolver", v)] },
  { k: "highCaliber", n: "High Caliber", r: 3, pre: ["deadEye"], d: "+{v}% critical damage with revolvers and pistols.", b: 10, p: 3,
    m: (v) => [flat("critMultiplier.revolver", v), flat("critMultiplier.pistol", v)] },
  { k: "lastRound", n: "Last Round", r: 3, pre: ["hairTrigger"], d: "The last round in a cylinder deals +{v}% damage.", b: 40, p: 8,
    m: (v) => [flat("lastRoundDamage", v)] },
  { k: "trickBounce", n: "Trick Bounce", r: 4, pre: ["highCaliber", "lastRound"], d: "Ricochets seek heads; +{v}% ricochet damage.", b: 20, p: 4,
    m: (v) => [flat("ricochetDamage", v)] },
  { k: "sixForSix", n: "Six for Six", r: 5, pre: ["trickBounce"], d: "For 6 s every revolver hit counts as a headshot with +{v}% damage.", b: 20, p: 3,
    syn: [["quickDraw", 4]], act: { cd: 45, bat: 35, fx: (v) => ({ type: "sixForSix", damage: v, seconds: 6 }) } },
];

const SPRAY: SkillSpec[] = [
  { k: "hoseDown", n: "Hose Down", r: 0, d: "+{v}% SMG damage.", b: 8, p: 3,
    m: (v) => [inc("damage.smg", v)], syn: [["sprayAndPray", 3]] },
  { k: "extendedMags", n: "Extended Mags", r: 0, d: "+{v}% SMG magazine size.", b: 15, p: 5,
    m: (v) => [inc("magazine.smg", v)] },
  { k: "dualWield", n: "Dual Wield", r: 1, pre: ["hoseDown"], d: "Wield two SMGs or pistols; the off-hand deals {v}% damage.", b: 50, p: 2.5, cap: 100,
    m: (v) => [flat("dualWield", v)] },
  { k: "tightGroup", n: "Tight Group", r: 1, pre: ["extendedMags"], d: "−{v}% SMG and pistol recoil.", b: 8, p: 2, cap: 60,
    m: (v) => [inc("recoil.smg", -v), inc("recoil.pistol", -v)] },
  { k: "bulletHose", n: "Bullet Hose", r: 2, pre: ["dualWield"], d: "Overclock for 6 s: +{v}% fire rate and no reloads.", b: 40, p: 4,
    act: { cd: 25, bat: 25, fx: (v) => ({ type: "bulletHose", fireRate: v, seconds: 6 }) } },
  { k: "hollowPoints", n: "Hollow Points", r: 2, pre: ["tightGroup"], d: "+{v}% SMG critical damage.", b: 10, p: 3,
    m: (v) => [flat("critMultiplier.smg", v)] },
  { k: "sprayAndPray", n: "Spray and Pray", r: 3, pre: ["bulletHose"], d: "+{v}% SMG fire rate.", b: 5, p: 1.5,
    m: (v) => [inc("fireRate.smg", v)] },
  { k: "drumFed", n: "Drum-Fed", r: 3, pre: ["hollowPoints"], d: "+{v}% SMG reload speed.", b: 10, p: 3,
    m: (v) => [inc("reloadSpeed.smg", v)], syn: [["extendedMags", 2]] },
  { k: "suppressingFire", n: "Suppressing Fire", r: 4, pre: ["sprayAndPray", "drumFed"], d: "Sustained fire pins enemies: they move and shoot {v}% slower.", b: 10, p: 2, cap: 50,
    m: (v) => [flat("suppression", v)] },
  { k: "leadRain", n: "Lead Rain", r: 5, pre: ["suppressingFire"], d: "For 8 s SMG rounds pierce one body and deal +{v}% damage.", b: 30, p: 5,
    syn: [["hoseDown", 4]], act: { cd: 50, bat: 40, fx: (v) => ({ type: "leadRain", damage: v, seconds: 8, pierce: 1 }) } },
];

const SHOWMAN: SkillSpec[] = [
  { k: "flourish", n: "Flourish", r: 0, d: "The style meter fills {v}% faster.", b: 10, p: 4,
    m: (v) => [inc("styleGain", v)] },
  { k: "spinReload", n: "Spin Reload", r: 0, d: "Twirl-reload in 0.4 s; the next {v} shots deal +20% damage.", b: 3, p: 0.25,
    act: { cd: 8, bat: 5, fx: (v) => ({ type: "spinReload", shots: floor(v), damage: 20, seconds: 0.4 }) } },
  { k: "encore", n: "Encore", r: 1, pre: ["flourish"], d: "Kills within {v} s of each other chain; each link adds +5% damage.", b: 2, p: 0.15,
    m: (v) => [flat("comboWindow", v)] },
  { k: "stageCombat", n: "Stage Combat", r: 1, pre: ["spinReload"], d: "+{v}% move speed.", b: 3, p: 1, cap: 25,
    m: (v) => [inc("moveSpeed", v)] },
  { k: "showstopper", n: "Showstopper", r: 2, pre: ["encore"], d: "At full style every gun deals +{v}% damage.", b: 10, p: 3,
    m: (v) => [flat("styleDamage", v)], syn: [["flourish", 3]] },
  { k: "slideShot", n: "Slide Shot", r: 2, pre: ["stageCombat"], d: "+{v}% critical chance while sliding or mid-air.", b: 10, p: 2,
    m: (v) => [flat("slideCrit", v)] },
  { k: "curtainCall", n: "Curtain Call", r: 3, pre: ["showstopper"], d: "Spend the style meter: a {v}% damage shot that chains to 3 enemies.", b: 150, p: 12,
    syn: [["showstopper", 4]], act: { cd: 10, bat: 15, fx: (v) => ({ type: "curtainCall", damage: v, chains: 3 }) } },
  { k: "crowdPleaser", n: "Crowd Pleaser", r: 3, pre: ["slideShot"], d: "Chain kills drop {v}% more Scrip.", b: 5, p: 2,
    m: (v) => [flat("scripFind", v)] },
  { k: "standingOvation", n: "Standing Ovation", r: 4, pre: ["curtainCall", "crowdPleaser"], d: "{v}% cooldown reduction.", b: 5, p: 1, cap: 30,
    m: (v) => [flat("cooldown", v)] },
  { k: "bangBang", n: "Bang Bang", r: 5, pre: ["standingOvation"], d: "For 8 s kills refill your magazine and stack +{v}% damage.", b: 8, p: 1,
    syn: [["encore", 3]], act: { cd: 45, bat: 30, fx: (v) => ({ type: "bangBang", damagePerKill: v, seconds: 8 }) } },
];

// ---------------------------------------------------------------------------------------------------------
// Wirewitch: the hacker
// ---------------------------------------------------------------------------------------------------------

const GHOST_IN_THE_WIRE: SkillSpec[] = [
  { k: "backdoor", n: "Backdoor", r: 0, d: "Hijack a camera within {v} m and see through it.", b: 25, p: 2,
    syn: [["longReach", 2]], act: { cd: 2, bat: 5, fx: (v) => ({ type: "hackCamera", range: v }) } },
  { k: "handshake", n: "Handshake", r: 0, d: "+{v}% hack strength.", b: 8, p: 3,
    m: (v) => [inc("hackStrength", v)] },
  { k: "loopFeed", n: "Loop Feed", r: 1, pre: ["backdoor"], d: "A looped camera sees nothing for {v} s.", b: 10, p: 1,
    act: { cd: 5, bat: 8, fx: (v) => ({ type: "loopCamera", seconds: v }) } },
  { k: "longReach", n: "Long Reach", r: 1, pre: ["handshake"], d: "+{v}% hack range.", b: 10, p: 3,
    m: (v) => [inc("hackRange", v)] },
  { k: "turncoat", n: "Turncoat", r: 2, pre: ["loopFeed"], d: "A hijacked turret or drone fights for you for {v} s.", b: 10, p: 1,
    syn: [["handshake", 3]], act: { cd: 18, bat: 20, fx: (v) => ({ type: "hijackMachine", seconds: v }) } },
  { k: "daisyChain", n: "Daisy Chain", r: 2, pre: ["longReach"], d: "Hacks jump to {v} more device(s) on the same network.", b: 1, p: 0.15,
    m: (v) => [flat("chainTargets", floor(v))] },
  { k: "masterKey", n: "Master Key", r: 3, pre: ["turncoat"], d: "Hijacked machines deal +{v}% damage.", b: 15, p: 4,
    m: (v) => [inc("hijackDamage", v)], syn: [["turncoat", 3]] },
  { k: "bufferOverflow", n: "Buffer Overflow", r: 3, pre: ["daisyChain"], d: "Hacks cost {v}% less battery.", b: 5, p: 1.5, cap: 50,
    m: (v) => [flat("hackCost", v)] },
  { k: "blindSpot", n: "Blind Spot", r: 4, pre: ["masterKey", "bufferOverflow"], d: "Enemies near a hacked camera detect you {v}% slower.", b: 10, p: 2, cap: 60,
    m: (v) => [flat("blindSpot", v)] },
  { k: "rootAccess", n: "Root Access", r: 5, pre: ["blindSpot"], d: "Seize every camera, turret and drone within 40 m for {v} s.", b: 8, p: 0.6,
    syn: [["turncoat", 2], ["masterKey", 2]], act: { cd: 75, bat: 60, fx: (v) => ({ type: "rootAccess", radius: 40, seconds: v }) } },
];

const SHORT_CIRCUIT: SkillSpec[] = [
  { k: "overload", n: "Overload", r: 0, d: "Fry an enemy's cyberware for {v}% weapon damage as shock.", b: 80, p: 8,
    syn: [["staticCharge", 3], ["arcFlash", 3]], act: { cd: 3, bat: 10, fx: (v) => ({ type: "overload", damage: v, damageType: "shock" }) } },
  { k: "staticCharge", n: "Static Charge", r: 0, d: "+{v}% shock damage.", b: 10, p: 3,
    m: (v) => [inc("dmgType.shock", v)] },
  { k: "arcFlash", n: "Arc Flash", r: 1, pre: ["overload"], d: "Overload arcs to {v} more enemies.", b: 1, p: 0.2,
    m: (v) => [flat("chainTargets", floor(v))] },
  { k: "grounding", n: "Grounding", r: 1, pre: ["staticCharge"], d: "+{v}% shock resistance.", b: 5, p: 1.5, cap: 45,
    m: (v) => [flat("resist.shock", v)] },
  { k: "shortFuse", n: "Short Fuse", r: 2, pre: ["arcFlash"], d: "Detonate a target's battery: {v}% weapon damage as shock within 4 m.", b: 150, p: 10,
    syn: [["overload", 3]], act: { cd: 10, bat: 20, fx: (v) => ({ type: "shortFuse", damage: v, radius: 4, damageType: "shock" }) } },
  { k: "surge", n: "Surge", r: 2, pre: ["grounding"], d: "+{v} max battery.", b: 5, p: 2,
    m: (v) => [flat("battery", v)] },
  { k: "cyberpsychosis", n: "Cyberpsychosis", r: 3, pre: ["shortFuse"], d: "A chromed enemy goes mad for {v} s and attacks its friends.", b: 5, p: 0.5,
    act: { cd: 30, bat: 35, fx: (v) => ({ type: "cyberpsychosis", seconds: v }) } },
  { k: "conductor", n: "Conductor", r: 3, pre: ["surge"], d: "Shock damage ignores {v}% of shields.", b: 10, p: 3, cap: 70,
    m: (v) => [flat("shieldPierce", v)] },
  { k: "feedbackLoop", n: "Feedback Loop", r: 4, pre: ["cyberpsychosis", "conductor"], d: "Shock kills refund {v} battery.", b: 3, p: 0.5,
    m: (v) => [flat("batteryOnKill", v)] },
  { k: "blackout", n: "Blackout", r: 5, pre: ["feedbackLoop"], d: "Kill the grid within 30 m: lights die and machines stall for {v} s.", b: 5, p: 0.4,
    syn: [["surge", 2]], act: { cd: 70, bat: 60, fx: (v) => ({ type: "blackout", radius: 30, seconds: v }) } },
];

const DAEMON: SkillSpec[] = [
  { k: "smartLink", n: "Smart Link", r: 0, d: "+{v}% smart gun damage.", b: 10, p: 3,
    m: (v) => [inc("damage.smart", v)], syn: [["swarmIntel", 3]] },
  { k: "moth", n: "MOTH", r: 0, d: "Summon MOTH, a drone familiar dealing {v} damage per second.", b: 6, p: 3,
    syn: [["compiler", 4]], act: { cd: 10, bat: 20, fx: (v) => ({ type: "familiar", dps: v, name: "MOTH" }) } },
  { k: "tagLock", n: "Tag Lock", r: 1, pre: ["smartLink"], d: "Smart guns lock on {v}% faster.", b: 10, p: 4,
    m: (v) => [inc("lockSpeed", v)] },
  { k: "mothSwarm", n: "Moth Swarm", r: 1, pre: ["moth"], d: "MOTH has +{v}% health and marks what it sees.", b: 15, p: 5,
    m: (v) => [inc("deployableHealth", v)] },
  { k: "homingRounds", n: "Homing Rounds", r: 2, pre: ["tagLock"], d: "Every gun's rounds curve up to {v}° toward tagged targets.", b: 2, p: 0.4,
    m: (v) => [flat("homing", v)] },
  { k: "compiler", n: "Compiler", r: 2, pre: ["mothSwarm"], d: "MOTH deals +{v}% damage.", b: 15, p: 4,
    m: (v) => [inc("familiarDamage", v)] },
  { k: "swarmIntel", n: "Swarm Intel", r: 3, pre: ["homingRounds"], d: "+{v}% critical chance with smart guns.", b: 3, p: 0.75,
    m: (v) => [flat("critChance.smart", v)] },
  { k: "recursion", n: "Recursion", r: 3, pre: ["compiler"], d: "MOTH respawns {v}% faster.", b: 10, p: 3, cap: 70,
    m: (v) => [flat("familiarRespawn", v)] },
  { k: "ghostProtocol", n: "Ghost Protocol", r: 4, pre: ["swarmIntel", "recursion"], d: "Smart rounds ignore {v}% armour.", b: 10, p: 2.5,
    m: (v) => [flat("armourPierce.smart", v)] },
  { k: "hollowChild", n: "Hollow Child", r: 5, pre: ["ghostProtocol"], d: "MOTH rides your gun for 10 s: every round homes and deals +{v}% damage.", b: 30, p: 4,
    syn: [["smartLink", 3], ["compiler", 3]], act: { cd: 50, bat: 45, fx: (v) => ({ type: "hollowChild", damage: v, seconds: 10 }) } },
];

// ---------------------------------------------------------------------------------------------------------
// Fixer: explosives and gadgets
// ---------------------------------------------------------------------------------------------------------

const DEMOLITION: SkillSpec[] = [
  { k: "fragOut", n: "Frag Out", r: 0, d: "Throw a frag grenade: {v} damage within 5 m.", b: 60, p: 12,
    syn: [["demoExpert", 4]], act: { cd: 6, bat: 8, fx: (v) => ({ type: "grenade", damage: v, radius: 5 }) } },
  { k: "boomStick", n: "Boom Stick", r: 0, d: "+{v}% launcher damage.", b: 10, p: 3,
    m: (v) => [inc("damage.launcher", v)], syn: [["demoExpert", 3]] },
  { k: "claymore", n: "Claymore", r: 1, pre: ["fragOut"], d: "Plant a tripwire mine (up to 3) for {v} damage.", b: 90, p: 15,
    syn: [["sapper", 4]], act: { cd: 4, bat: 10, fx: (v) => ({ type: "mine", damage: v, max: 3 }) } },
  { k: "bigRadius", n: "Big Radius", r: 1, pre: ["boomStick"], d: "+{v}% explosion radius.", b: 8, p: 2, cap: 60,
    m: (v) => [inc("explosiveRadius", v)] },
  { k: "shapedCharge", n: "Shaped Charge", r: 2, pre: ["claymore"], d: "Launchers ignore {v}% armour.", b: 10, p: 2.5,
    m: (v) => [flat("armourPierce.launcher", v)] },
  { k: "clusterBomb", n: "Cluster Bomb", r: 2, pre: ["bigRadius"], d: "Grenades and rockets split into {v} bomblets.", b: 2, p: 0.2,
    m: (v) => [flat("cluster", floor(v))] },
  { k: "demoExpert", n: "Demo Expert", r: 3, pre: ["shapedCharge"], d: "+{v}% explosive damage.", b: 10, p: 3,
    m: (v) => [inc("explosiveDamage", v)] },
  { k: "cookOff", n: "Cook Off", r: 3, pre: ["clusterBomb"], d: "Explosive kills set off the victim's ammo for {v}% damage.", b: 30, p: 4,
    m: (v) => [flat("cookOff", v)] },
  { k: "sapper", n: "Sapper", r: 4, pre: ["demoExpert", "cookOff"], d: "Mines are invisible to enemies; +{v}% throw range.", b: 15, p: 3,
    m: (v) => [inc("throwRange", v)] },
  { k: "scorchedEarth", n: "Scorched Earth", r: 5, pre: ["sapper"], d: "A rooftop barrage: 8 shells over 4 s, {v} damage each.", b: 200, p: 30,
    syn: [["fragOut", 3], ["demoExpert", 3]], act: { cd: 75, bat: 60, fx: (v) => ({ type: "barrage", damage: v, shells: 8, seconds: 4 }) } },
];

const WORKSHOP: SkillSpec[] = [
  { k: "sentryKit", n: "Sentry Kit", r: 0, d: "Deploy a sentry turret dealing {v} damage per shot.", b: 8, p: 2,
    syn: [["overclock", 4]], act: { cd: 15, bat: 25, fx: (v) => ({ type: "turret", damage: v, fireRate: 4 }) } },
  { k: "tinker", n: "Tinker", r: 0, d: "+{v}% deployable health.", b: 10, p: 4,
    m: (v) => [inc("deployableHealth", v)] },
  { k: "hornet", n: "Hornet", r: 1, pre: ["sentryKit"], d: "Launch a hunter drone dealing {v} damage per second for 20 s.", b: 10, p: 3,
    syn: [["overclock", 3]], act: { cd: 20, bat: 25, fx: (v) => ({ type: "hornet", dps: v, seconds: 20 }) } },
  { k: "overclock", n: "Overclock", r: 1, pre: ["tinker"], d: "+{v}% deployable damage.", b: 8, p: 3,
    m: (v) => [inc("deployableDamage", v)] },
  { k: "secondUnit", n: "Second Unit", r: 2, pre: ["hornet"], d: "+{v} deployable(s) at once.", b: 1, p: 0.1,
    m: (v) => [flat("deployableCount", floor(v))] },
  { k: "scrapArmour", n: "Scrap Armour", r: 2, pre: ["overclock"], d: "+{v} armour.", b: 10, p: 4,
    m: (v) => [flat("armour", v)] },
  { k: "shieldDrone", n: "Shield Drone", r: 3, pre: ["secondUnit"], d: "A drone projects a {v}-point shield around you.", b: 40, p: 8,
    syn: [["tinker", 3]], act: { cd: 25, bat: 30, fx: (v) => ({ type: "shieldDrone", shield: v, seconds: 15 }) } },
  { k: "longWarranty", n: "Long Warranty", r: 3, pre: ["scrapArmour"], d: "+{v}% deployable duration.", b: 10, p: 3,
    m: (v) => [inc("deployableDuration", v)] },
  { k: "netcode", n: "Netcode", r: 4, pre: ["shieldDrone", "longWarranty"], d: "Deployables share your marks and get +{v}% critical chance.", b: 5, p: 1,
    m: (v) => [flat("deployableCrit", v)] },
  { k: "ironLung", n: "Iron Lung", r: 5, pre: ["netcode"], d: "Climb into a scrap battle frame for {v} s.", b: 15, p: 1,
    syn: [["tinker", 2], ["longWarranty", 2]], act: { cd: 90, bat: 70, fx: (v) => ({ type: "battleFrame", seconds: v }) } },
];

const CHEM: SkillSpec[] = [
  { k: "stim", n: "Stim", r: 0, d: "Inject: heal {v}% health over 3 s.", b: 25, p: 2, cap: 80,
    syn: [["chemist", 3]], act: { cd: 12, bat: 10, fx: (v) => ({ type: "stim", heal: Math.min(80, v), seconds: 3 }) } },
  { k: "molotov", n: "Molotov", r: 0, d: "A firebomb burns 4 m for {v} damage per second for 6 s.", b: 15, p: 4,
    syn: [["accelerant", 3]], act: { cd: 8, bat: 10, fx: (v) => ({ type: "molotov", dps: v, radius: 4, seconds: 6, damageType: "incendiary" }) } },
  { k: "chemist", n: "Chemist", r: 1, pre: ["stim"], d: "Stims are {v}% stronger and give +10% move speed.", b: 10, p: 4,
    m: (v) => [inc("stimPotency", v)] },
  { k: "accelerant", n: "Accelerant", r: 1, pre: ["molotov"], d: "+{v}% incendiary damage.", b: 10, p: 3,
    m: (v) => [inc("dmgType.incendiary", v)] },
  { k: "nerveGas", n: "Nerve Gas", r: 2, pre: ["chemist"], d: "A 5 m toxic cloud deals {v} damage per second for 8 s.", b: 18, p: 5,
    syn: [["toxicology", 3]], act: { cd: 14, bat: 15, fx: (v) => ({ type: "gas", dps: v, radius: 5, seconds: 8, damageType: "toxic" }) } },
  { k: "napalm", n: "Napalm", r: 2, pre: ["accelerant"], d: "Damage over time lasts {v}% longer.", b: 15, p: 4,
    m: (v) => [inc("dotDuration", v)] },
  { k: "toxicology", n: "Toxicology", r: 3, pre: ["nerveGas"], d: "+{v}% toxic damage.", b: 10, p: 3,
    m: (v) => [inc("dmgType.toxic", v)] },
  { k: "immolation", n: "Immolation", r: 3, pre: ["napalm"], d: "Burning enemies take +{v}% damage from everything.", b: 5, p: 1.5,
    m: (v) => [flat("burnVulnerability", v)] },
  { k: "hazmat", n: "Hazmat", r: 4, pre: ["toxicology", "immolation"], d: "+{v}% toxic and incendiary resistance.", b: 5, p: 1.5, cap: 40,
    m: (v) => [flat("resist.toxic", v), flat("resist.incendiary", v)] },
  { k: "witchsBrew", n: "Witch's Brew", r: 5, pre: ["hazmat"], d: "An 8 m cloud burns and poisons for {v} damage per second; victims panic.", b: 60, p: 8,
    syn: [["accelerant", 2], ["toxicology", 2]], act: { cd: 60, bat: 50, fx: (v) => ({ type: "brew", dps: v, radius: 8, seconds: 10 }) } },
];

// ---------------------------------------------------------------------------------------------------------
// Hybrid capstones: one per class pair, level 30, both classes required
// ---------------------------------------------------------------------------------------------------------

interface HybridSpec extends SkillSpec {
  pair: [ClassId, ClassId];
}

const HYBRIDS: HybridSpec[] = [
  { pair: ["ghost", "wirewitch"], k: "deadSignal", n: "Dead Signal", r: 5, d: "Sniper shots pass through walls a hacked camera sees, at {v}% damage.", b: 60, p: 2, cap: 100,
    m: (v) => [flat("deadSignal", v)], syn: [["ghost.steadyHands", 1], ["wirewitch.backdoor", 1]] },
  { pair: ["butcher", "fixer"], k: "wetwork", n: "Wetwork", r: 5, d: "Finishers leave a live grenade that deals {v} damage.", b: 100, p: 20,
    m: (v) => [flat("wetworkGrenade", v)], syn: [["butcher.finisher", 3], ["fixer.fragOut", 3]] },
  { pair: ["gunslinger", "ghost"], k: "highNoon", n: "High Noon", r: 5, d: "Dead-eye marks up to 6 heads; each takes +{v}% damage.", b: 20, p: 3,
    syn: [["gunslinger.deadEye", 2], ["ghost.deadCalm", 2]], act: { cd: 30, bat: 35, fx: (v) => ({ type: "deadEye", marks: 6, damage: v, seconds: 4, headshots: true }) } },
  { pair: ["wirewitch", "butcher"], k: "puppeteer", n: "Puppeteer", r: 5, d: "A hacked enemy fights for you for 12 s, then detonates for {v}% of its health.", b: 50, p: 5,
    syn: [["wirewitch.handshake", 2], ["butcher.rage", 2]], act: { cd: 40, bat: 40, fx: (v) => ({ type: "puppeteer", seconds: 12, detonation: v }) } },
  { pair: ["fixer", "gunslinger"], k: "trickShot", n: "Trick Shot", r: 5, d: "Pistol rounds detonate mines and canisters as crits with +{v}% damage.", b: 50, p: 5,
    m: (v) => [flat("trickShot", v)], syn: [["fixer.claymore", 2], ["gunslinger.quickDraw", 2]] },
  { pair: ["ghost", "butcher"], k: "quietWork", n: "Quiet Work", r: 5, d: "Takedowns sever without a sound; +{v}% damage to unaware enemies.", b: 40, p: 5,
    m: (v) => [inc("unawareDamage", v), inc("sever", 25)], syn: [["ghost.silentTakedown", 2], ["butcher.thePin", 2]] },
  { pair: ["ghost", "fixer"], k: "longFuse", n: "Long Fuse", r: 5, d: "Sniper rounds set off your mines from any range; mine blasts deal +{v}% damage.", b: 40, p: 5,
    m: (v) => [flat("remoteDetonation", 1), inc("explosiveDamage", v)], syn: [["ghost.windReader", 2], ["fixer.claymore", 2]] },
  { pair: ["butcher", "gunslinger"], k: "saloonDoors", n: "Saloon Doors", r: 5, d: "Melee kills reload your sidearm; its next 3 shots deal +{v}% damage.", b: 40, p: 5,
    m: (v) => [flat("saloonDoor", v)], syn: [["butcher.thePin", 2], ["gunslinger.speedLoader", 2]] },
  { pair: ["gunslinger", "wirewitch"], k: "smartMouth", n: "Smart Mouth", r: 5, d: "Revolver hits hijack the machine they strike for {v} s.", b: 4, p: 0.4,
    m: (v) => [flat("smartMouth", v)], syn: [["gunslinger.ricochet", 2], ["wirewitch.turncoat", 2]] },
  { pair: ["wirewitch", "fixer"], k: "swarmLogic", n: "Swarm Logic", r: 5, d: "Your deployables link up: +{v}% deployable damage and their hits arc shock.", b: 30, p: 4,
    m: (v) => [inc("deployableDamage", v), flat("added.shock", 10)], syn: [["wirewitch.daisyChain", 2], ["fixer.overclock", 2]] },
];

const SPECS: Record<TreeId, SkillSpec[]> = {
  longshot: LONGSHOT,
  shroud: SHROUD,
  coldRead: COLD_READ,
  meat: MEAT,
  scattergun: SCATTERGUN,
  iron: IRON,
  sixShooter: SIX_SHOOTER,
  spray: SPRAY,
  showman: SHOWMAN,
  ghostInTheWire: GHOST_IN_THE_WIRE,
  shortCircuit: SHORT_CIRCUIT,
  daemon: DAEMON,
  demolition: DEMOLITION,
  workshop: WORKSHOP,
  chem: CHEM,
};

/** The 150 class skills, class by class and tree by tree. */
export const CLASS_SKILLS: readonly SkillDef[] = CLASS_IDS.flatMap((cls) =>
  TREES_BY_CLASS[cls].flatMap((tree) => build(cls, tree, SPECS[tree])),
);

/** The 10 hybrid capstones. */
export const HYBRID_SKILLS: readonly SkillDef[] = HYBRIDS.flatMap((h) => build(h.pair[0], "hybrid", [h], h.pair));

/** Every skill, class skills first. */
export const ALL_SKILLS: readonly SkillDef[] = [...CLASS_SKILLS, ...HYBRID_SKILLS];

/** Skill lookup by id. */
export const SKILLS: Readonly<Record<string, SkillDef>> = Object.fromEntries(ALL_SKILLS.map((s) => [s.id, s]));

/** The skills of one tree in row order. */
export function treeSkills(tree: TreeId): SkillDef[] {
  return CLASS_SKILLS.filter((s) => s.tree === tree);
}

/** The hybrid capstone for a class pair (order doesn't matter), if any. */
export function hybridFor(a: ClassId, b: ClassId): SkillDef | undefined {
  return HYBRID_SKILLS.find((s) => s.classes.includes(a) && s.classes.includes(b) && a !== b);
}

/** A skill's main value at a rank before synergies: base + perRank × (rank − 1), capped. 0 at rank 0. */
export function mainValue(skill: SkillDef, rank: number): number {
  if (rank <= 0) return 0;
  const v = skill.main.base + skill.main.perRank * (rank - 1);
  return skill.main.cap !== undefined ? Math.min(skill.main.cap, v) : v;
}

// Re-exported so callers building their own modifiers don't need two imports.
export { flat, inc, more };
