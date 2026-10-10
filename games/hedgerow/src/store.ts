// Saved progress for Hedgerow: stars per level, which stories were seen, which enemies have been met,
// which tips Cath has given, and the Seed Bank (perks bought with stars). One localStorage key; any
// storage failure degrades to an in-memory copy so the game still plays. Bump `version` and add a
// migration (with a test) for every shape change. v1 -> v2 (2026-10-02): added seen, tips and bank.

import { ABILITIES, AUTO_AFTER_CASTS, NO_PERKS, type Ability, type Perks } from "./engine";
import { applyCath, levelOf, parseCath, xpOf, type CathSave } from "./cath";

export interface SaveData {
  version: 2;
  /** Best stars per level id (1 to 3). Missing = not cleared. */
  stars: Record<string, number>;
  seenBefore: Record<string, boolean>;
  /** Enemy kinds already introduced. */
  seen: Record<string, boolean>;
  /** Tips Cath has already given. */
  tips: Record<string, boolean>;
  /** Seed Bank: ranks bought per perk. */
  bank: Record<string, number>;
  /** Rosettes (achievements) earned, by id. Optional in old saves. */
  rosettes?: Record<string, boolean>;
  /** Best daily-challenge score by day number (daily.ts). Optional in old saves. */
  daily?: Record<string, number>;
  /** Best wave reached on each act's Endless field (by act number). Optional in old saves. */
  endless?: Record<string, number>;
  /** Levels won in a Heroic run (one Goodwill, no pies): the fourth star. Optional in old saves. */
  heroic?: Record<string, boolean>;
  /** Cath's character sheet: attributes and talents (cath.ts). Optional in old saves. */
  cath?: CathSave;
  /** The wardrobe outfit she is wearing (wardrobe.ts). Optional in old saves. */
  outfit?: string;
  /** Play settings (Hedgerow 2 M1). Optional in old saves. */
  settings?: {
    /** Keep Going: the next round starts by itself 2 s after a clear. Unset = on (from level 6). */
    keepGoing?: boolean;
  };
  /** Hand casts per ability: three earn its Auto toggle (Hedgerow 2 section 7). Optional in old saves. */
  casts?: Partial<Record<Ability, number>>;
  /** Abilities the player has switched to Auto (only honoured once earned). Optional in old saves. */
  autoCast?: Partial<Record<Ability, boolean>>;
}

/** Levels where Keep Going is always off, while new players learn the Go and stack rhythm. */
export const KEEP_GOING_FROM = 6;

/** Is Keep Going on for this level? Off on levels 1-5; after that on unless the player turned it off. */
export function keepGoingFor(data: SaveData, levelId: number): boolean {
  if (levelId < KEEP_GOING_FROM) return false;
  return data.settings?.keepGoing ?? true;
}

export function setKeepGoing(data: SaveData, on: boolean): void {
  (data.settings ??= {}).keepGoing = on;
}

/** Counts a hand cast; returns the new total. */
export function recordCast(data: SaveData, ability: Ability): number {
  const casts = (data.casts ??= {});
  casts[ability] = Math.min(9999, (casts[ability] ?? 0) + 1);
  return casts[ability]!;
}

/** Has this ability earned its Auto toggle (three hand casts)? */
export function autoEarned(data: SaveData, ability: Ability): boolean {
  return (data.casts?.[ability] ?? 0) >= AUTO_AFTER_CASTS;
}

/** Is this ability on Auto? Only once earned. */
export function autoOn(data: SaveData, ability: Ability): boolean {
  return autoEarned(data, ability) && data.autoCast?.[ability] === true;
}

export function setAuto(data: SaveData, ability: Ability, on: boolean): void {
  (data.autoCast ??= {})[ability] = on;
}

/** x5 opens on a level once it has been won. */
export function fastestSpeed(data: SaveData, levelId: number): 3 | 5 {
  return (data.stars[String(levelId)] ?? 0) >= 1 ? 5 : 3;
}

const KEY = "hedgerow:v1";
let memory: SaveData | null = null;

export function emptySave(): SaveData {
  return { version: 2, stars: {}, seenBefore: {}, seen: {}, tips: {}, bank: {} };
}

/** Parses stored JSON (v1 or v2), repairing anything unexpected instead of throwing. */
export function parseSave(raw: string | null): SaveData {
  const data = emptySave();
  if (!raw) return data;
  try {
    const obj = JSON.parse(raw) as Partial<Omit<SaveData, "version">> & { version?: number };
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj.stars ?? {})) {
        if (typeof v === "number" && v >= 1 && v <= 3) data.stars[k] = Math.floor(v);
      }
      for (const [k, v] of Object.entries(obj.seenBefore ?? {})) if (v === true) data.seenBefore[k] = true;
      for (const [k, v] of Object.entries(obj.seen ?? {})) if (v === true) data.seen[k] = true;
      for (const [k, v] of Object.entries(obj.tips ?? {})) if (v === true) data.tips[k] = true;
      for (const [k, v] of Object.entries(obj.rosettes ?? {})) if (v === true) (data.rosettes ??= {})[k] = true;
      for (const [k, v] of Object.entries(obj.heroic ?? {})) if (v === true) (data.heroic ??= {})[k] = true;
      for (const [k, v] of Object.entries(obj.endless ?? {})) if (typeof v === "number" && v >= 1) (data.endless ??= {})[k] = Math.floor(v);
      for (const [k, v] of Object.entries(obj.daily ?? {})) if (typeof v === "number" && v >= 0 && v <= 100) (data.daily ??= {})[k] = Math.floor(v);
      if (obj.cath) data.cath = parseCath(obj.cath);
      if (typeof obj.outfit === "string") data.outfit = obj.outfit.slice(0, 20);
      if (obj.settings && typeof obj.settings === "object" && typeof obj.settings.keepGoing === "boolean")
        data.settings = { keepGoing: obj.settings.keepGoing };
      for (const a of ABILITIES) {
        const n = obj.casts?.[a];
        if (typeof n === "number" && n >= 1) (data.casts ??= {})[a] = Math.min(9999, Math.floor(n));
        if (obj.autoCast?.[a] === true) (data.autoCast ??= {})[a] = true;
      }
      for (const [k, v] of Object.entries(obj.bank ?? {})) {
        const perk = PERKS.find((p) => p.id === k);
        if (perk && typeof v === "number" && v >= 1) data.bank[k] = Math.min(perk.costs.length, Math.floor(v));
      }
    }
  } catch {
    // corrupt save: start fresh
  }
  // A bank bought with stars that no longer exist (a reset elsewhere) is refunded rather than kept.
  if (spentStars(data) > totalStars(data)) data.bank = {};
  return data;
}

export function load(): SaveData {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // storage unavailable
  }
  memory = parseSave(raw);
  return memory;
}

export function save(data: SaveData): void {
  memory = data;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full or blocked: the in-memory copy still works
  }
}

export function recordStars(data: SaveData, levelId: number, stars: number): void {
  if (stars > (data.stars[String(levelId)] ?? 0)) data.stars[String(levelId)] = stars;
  save(data);
}

export function recordHeroic(data: SaveData, levelId: number): void {
  (data.heroic ??= {})[String(levelId)] = true;
  save(data);
}

export function recordEndless(data: SaveData, act: number, wave: number): boolean {
  const best = data.endless?.[String(act)] ?? 0;
  if (wave <= best) return false;
  (data.endless ??= {})[String(act)] = wave;
  save(data);
  return true;
}

export function recordDaily(data: SaveData, day: number, score: number): boolean {
  const best = data.daily?.[String(day)];
  if (best !== undefined && score <= best) return false;
  (data.daily ??= {})[String(day)] = score;
  save(data);
  return true;
}

export function isUnlocked(data: SaveData, levelId: number): boolean {
  return levelId <= 1 || (data.stars[String(levelId - 1)] ?? 0) > 0;
}

// ---- the Seed Bank ----

export interface PerkDef {
  id: string;
  name: string;
  blurb: string;
  /** Stars for each rank. */
  costs: number[];
  /** What one rank does, for the card. */
  each: string;
  apply: (p: Perks, rank: number) => void;
}

export const PERKS: PerkDef[] = [
  {
    id: "pockets",
    name: "Deep Pockets",
    blurb: "The co-op tin is never quite empty.",
    each: "+30 starting Marks",
    costs: [1, 2, 3, 4],
    apply: (p, r) => (p.marks += 30 * r),
  },
  {
    id: "hedges",
    name: "Thicker Hedges",
    blurb: "Hawthorn, blackthorn and a lot of patience.",
    each: "Slowing towers bite 10% harder",
    costs: [2, 3, 4],
    apply: (p, r) => (p.slow = 1 / (1 + 0.1 * r)),
  },
  {
    id: "apron",
    name: "Cath's Apron",
    blurb: "Waxed cotton. Pockets for everything.",
    each: "+20% health for Cath",
    costs: [1, 2, 3],
    apply: (p, r) => (p.heroHp = 1 + 0.2 * r),
  },
  {
    id: "pin",
    name: "Grandma's Rolling Pin",
    blurb: "Solid beech. Older than the corporation.",
    each: "+20% damage for Cath",
    costs: [2, 3, 4],
    apply: (p, r) => (p.heroDamage = 1 + 0.2 * r),
  },
  {
    id: "oven",
    name: "Quick Oven",
    blurb: "Bea minds the timer.",
    each: "Pie cooldown -12%",
    costs: [2, 3, 4],
    apply: (p, r) => (p.pieCooldown = 1 - 0.12 * r),
  },
  {
    id: "dish",
    name: "Family-size Dish",
    blurb: "It feeds twelve, or stops twelve vans.",
    each: "Pie splash +15%",
    costs: [2, 4],
    apply: (p, r) => (p.pieRadius = 1 + 0.15 * r),
  },
  {
    id: "boots",
    name: "Wellies by the Door",
    blurb: "The neighbours are out the door before you finish asking.",
    each: "Neighbours hold the lane 25% longer",
    costs: [2, 3],
    apply: (p, r) => (p.neighbours = 1 + 0.25 * r),
  },
  {
    id: "rallycry",
    name: "Rallying Cry",
    blurb: "Cath has a voice that carries across three fields.",
    each: "Rally lasts 25% longer",
    costs: [2, 3],
    apply: (p, r) => (p.rally = 1 + 0.25 * r),
  },
  {
    id: "neighbours",
    name: "Good Neighbours",
    blurb: "Somebody always comes to help.",
    each: "+2 Goodwill",
    costs: [3, 5],
    apply: (p, r) => (p.goodwill += 2 * r),
  },
  {
    id: "discount",
    name: "Co-op Discount",
    blurb: "Tomas knows a man who sells timber.",
    each: "Towers cost 5% less",
    costs: [3, 5],
    apply: (p, r) => (p.discount = 0.05 * r),
  },
  {
    id: "earlybird",
    name: "Early Bird",
    blurb: "Up before the vans.",
    each: "+35% bonus for early waves",
    costs: [2, 3],
    apply: (p, r) => (p.earlyBonus = 1 + 0.35 * r),
  },
];

export function totalStars(data: SaveData): number {
  return Object.values(data.stars).reduce((a, b) => a + b, 0);
}

export function spentStars(data: SaveData): number {
  let n = 0;
  for (const p of PERKS) {
    const r = data.bank[p.id] ?? 0;
    for (let i = 0; i < r; i++) n += p.costs[i]!;
  }
  return n;
}

export function freeStars(data: SaveData): number {
  return totalStars(data) - spentStars(data);
}

export function nextCost(data: SaveData, id: string): number | null {
  const p = PERKS.find((x) => x.id === id);
  if (!p) return null;
  const r = data.bank[id] ?? 0;
  return r >= p.costs.length ? null : p.costs[r]!;
}

export function buyPerk(data: SaveData, id: string): boolean {
  const cost = nextCost(data, id);
  if (cost === null || cost > freeStars(data)) return false;
  data.bank[id] = (data.bank[id] ?? 0) + 1;
  save(data);
  return true;
}

export function refundAll(data: SaveData): void {
  data.bank = {};
  save(data);
}

export function perksOf(data: SaveData): Perks {
  const p: Perks = { ...NO_PERKS };
  for (const def of PERKS) {
    const r = data.bank[def.id] ?? 0;
    if (r > 0) def.apply(p, r);
  }
  if (data.cath) applyCath(p, data.cath, cathLevel(data));
  return p;
}

/** Cath's level, from the stars earned so far. */
export function cathLevel(data: SaveData): number {
  return levelOf(xpOf(data.stars)).level;
}
