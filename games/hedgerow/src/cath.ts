// Cath grows (owner, third playtest: "like in an rpg there should be lvl progression with attributes and
// skill points"). Her experience comes from the stars already earned, so every existing save starts at the
// right level and it can't be farmed: each cleared level is worth 80 XP plus 40 a star. Each Cath level
// gives a skill point for one of six attributes, and every fifth level a talent: one of two, for good.
// Pure functions over the save; main.ts draws the sheet and perksOf (store.ts) folds it into the Perks.

import type { Perks } from "./engine";
import type { CathOutfit } from "../../../shared/cath/cath";

export type Attr = "strength" | "grit" | "pace" | "baking" | "leadership" | "wits";

export interface AttrDef {
  id: Attr;
  name: string;
  each: string;
  apply: (p: Perks, n: number) => void;
}

export const ATTR_CAP = 8;

export const ATTRS: AttrDef[] = [
  { id: "strength", name: "Strength", each: "+8% rolling-pin damage", apply: (p, n) => (p.heroDamage *= 1 + 0.08 * n) },
  { id: "grit", name: "Grit", each: "+10% health", apply: (p, n) => (p.heroHp *= 1 + 0.1 * n) },
  { id: "pace", name: "Pace", each: "+5% walking speed", apply: (p, n) => (p.heroSpeed *= 1 + 0.05 * n) },
  {
    id: "baking",
    name: "Baking",
    each: "Pie 4% sooner, 3% wider",
    apply: (p, n) => {
      p.pieCooldown *= 1 - 0.04 * n;
      p.pieRadius *= 1 + 0.03 * n;
    },
  },
  { id: "leadership", name: "Leadership", each: "+1.5% damage for every tower", apply: (p, n) => (p.towerDamage *= 1 + 0.015 * n) },
  {
    id: "wits",
    name: "Wits",
    each: "+12 starting Marks, +6% early-wave bonus",
    apply: (p, n) => {
      p.marks += 12 * n;
      p.earlyBonus *= 1 + 0.06 * n;
    },
  },
];

export interface Talent {
  name: string;
  blurb: string;
  apply: (p: Perks) => void;
}

/** A talent choice every five Cath levels: [at level, [option 0, option 1]]. */
export const TALENTS: Array<[number, [Talent, Talent]]> = [
  [
    5,
    [
      { name: "Double Batch", blurb: "Pies hit twice as hard and freeze 30% longer.", apply: (p) => ((p.pieDamage *= 2), (p.pieStun *= 1.3)) },
      { name: "Iron Pin", blurb: "She holds three vehicles at once, not two.", apply: (p) => (p.heroHolds += 1) },
    ],
  ],
  [
    10,
    [
      { name: "Hold the Line", blurb: "Takes 40% less damage while she's holding the lane.", apply: (p) => (p.holdGuard *= 0.6) },
      { name: "Second Wind", blurb: "Back on her feet in half the time.", apply: (p) => (p.heroRespawn *= 0.5) },
    ],
  ],
  [
    15,
    [
      { name: "Rallying Cry", blurb: "Rally lasts 40% longer; the neighbours hold 25% longer.", apply: (p) => ((p.rally *= 1.4), (p.neighbours *= 1.25)) },
      { name: "Neighbourly", blurb: "The whole village turns out: +3 Goodwill every level.", apply: (p) => (p.goodwill += 3) },
    ],
  ],
  [
    20,
    [
      { name: "Pie Volley", blurb: "The pie is ready 25% sooner.", apply: (p) => (p.pieCooldown *= 0.75) },
      { name: "Hot Oven", blurb: "Pies straight from the oven: everything hit burns for 18 a second.", apply: (p) => (p.pieBurn = Math.max(p.pieBurn, 18)) },
    ],
  ],
  [
    25,
    [
      { name: "Duellist", blurb: "Her duel strikes bite 60% deeper into bosses.", apply: (p) => (p.duel *= 1.6) },
      { name: "Matriarch", blurb: "Everyone fights for Cath: every tower +8% damage.", apply: (p) => (p.towerDamage *= 1.08) },
    ],
  ],
];

export interface CathSave {
  attrs: Partial<Record<Attr, number>>;
  /** Talent picked at each talent level (keyed by the level). */
  talents: Record<string, 0 | 1>;
  /** What she's wearing (her wardrobe, below). Missing = the olive field blazer. */
  outfit?: CathOutfit;
}

// ---- her wardrobe (ROADMAP 51): outfits earned by playing, worn in the story, the HUD and on the field ----

export interface Outfit {
  id: CathOutfit;
  name: string;
  /** How it's earned, for the locked card. */
  how: string;
  earned: (stars: Record<string, number>, rosettes: number) => boolean;
}

const cleared = (stars: Record<string, number>, id: number) => (stars[String(id)] ?? 0) > 0;

export const WARDROBE: Outfit[] = [
  { id: "field", name: "Olive field blazer", how: "Her everyday best.", earned: () => true },
  { id: "market", name: "Camel trench and knit scarf", how: "Clear Brindle Hills (level 10).", earned: (s) => cleared(s, 10) },
  { id: "wax", name: "Waxed country jacket", how: "Earn 5 Rosettes.", earned: (_, r) => r >= 5 },
  { id: "pinny", name: "Market-day pinny", how: "Clear the Saltmarsh (level 30).", earned: (s) => cleared(s, 30) },
  { id: "gown", name: "Kingsmarket gown", how: "Clear the Merger (level 90).", earned: (s) => cleared(s, 90) },
];

/** What she wears: the chosen outfit if it's still earned, else the blazer. */
export function outfitOf(c: CathSave | undefined, stars: Record<string, number>, rosettes: number): CathOutfit {
  const o = WARDROBE.find((w) => w.id === c?.outfit);
  return o && o.earned(stars, rosettes) ? o.id : "field";
}

export function emptyCath(): CathSave {
  return { attrs: {}, talents: {} };
}

/** Repairs a stored sheet: unknown keys dropped, ranks clamped. */
export function parseCath(raw: unknown): CathSave {
  const out = emptyCath();
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Partial<CathSave>;
  for (const a of ATTRS) {
    const v = o.attrs?.[a.id];
    if (typeof v === "number" && v >= 1) out.attrs[a.id] = Math.min(ATTR_CAP, Math.floor(v));
  }
  for (const [lv] of TALENTS) {
    const v = o.talents?.[String(lv)];
    if (v === 0 || v === 1) out.talents[String(lv)] = v;
  }
  if (WARDROBE.some((w) => w.id === o.outfit)) out.outfit = o.outfit;
  return out;
}

export function xpOf(stars: Record<string, number>): number {
  let xp = 0;
  for (const s of Object.values(stars)) if (s > 0) xp += 80 + 40 * s;
  return xp;
}

/** XP needed to go from level `n` to `n + 1`. */
export function xpToNext(n: number): number {
  return 120 + 50 * (n - 1);
}

export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = xp;
  while (left >= xpToNext(level)) {
    left -= xpToNext(level);
    level += 1;
  }
  return { level, into: left, need: xpToNext(level) };
}

export function pointsSpent(c: CathSave): number {
  return Object.values(c.attrs).reduce((a, b) => a + (b ?? 0), 0);
}

export function freePoints(c: CathSave, level: number): number {
  return Math.max(0, level - 1 - pointsSpent(c));
}

export function raise(c: CathSave, level: number, attr: Attr): boolean {
  if (freePoints(c, level) <= 0 || (c.attrs[attr] ?? 0) >= ATTR_CAP) return false;
  c.attrs[attr] = (c.attrs[attr] ?? 0) + 1;
  return true;
}

export function pickTalent(c: CathSave, level: number, at: number, choice: 0 | 1): boolean {
  if (level < at || !TALENTS.some(([l]) => l === at) || c.talents[String(at)] !== undefined) return false;
  c.talents[String(at)] = choice;
  return true;
}

/** Talent levels she has reached but not chosen for yet. */
export function talentsWaiting(c: CathSave, level: number): number[] {
  return TALENTS.filter(([l]) => l <= level && c.talents[String(l)] === undefined).map(([l]) => l);
}

export function respec(c: CathSave): void {
  c.attrs = {};
  c.talents = {};
}

/** Folds Cath's attributes and talents into the level's perks (only what her level actually allows). */
export function applyCath(p: Perks, c: CathSave, level: number): void {
  let budget = level - 1;
  for (const a of ATTRS) {
    const n = Math.min(c.attrs[a.id] ?? 0, budget);
    budget -= n;
    if (n > 0) a.apply(p, n);
  }
  for (const [at, opts] of TALENTS) {
    const pick = c.talents[String(at)];
    if (pick !== undefined && level >= at) opts[pick].apply(p);
  }
}
