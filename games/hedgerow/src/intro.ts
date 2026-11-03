// Plan item 64: a new enemy's field-guide page. Pure rules: which enemies a round brings that this save has
// never met, the traits its page shows as icons, and which of the level's towers reach it. main.ts draws the
// page and keeps `seen` in the save (SaveData.seen, already there since v2, so no migration).

import { ENEMIES, inherentProps, isBig, isHeavy, towerStats, type EnemyKind, type Level, type TowerKind } from "./engine";
import { P } from "./fleet";
import { towerBadges, type Lock } from "./counters";

/** The kinds a level's round (1-based) brings that `seen` hasn't met, in the order they first appear. */
export function newThisRound(level: Pick<Level, "waves">, round: number, seen: Readonly<Record<string, boolean>>): EnemyKind[] {
  const groups = [...(level.waves[round - 1] ?? [])].sort((a, b) => a.delay - b.delay);
  const out: EnemyKind[] = [];
  for (const g of groups) if (!seen[g.enemy] && !out.includes(g.enemy)) out.push(g.enemy);
  // A boss is the round's headline: its page comes first.
  return out.sort((a, b) => Number(isBig(b)) - Number(isBig(a)));
}

export type Trait = "flies" | "armour" | "fast" | "slow" | "heavy" | "boss" | "stealth" | "splits" | "wrapped" | "sealed" | "reefer";

export const TRAIT_TEXT: Record<Trait, string> = {
  flies: "Flies",
  armour: "Armoured",
  fast: "Fast",
  slow: "Slow",
  heavy: "Heavy plant",
  boss: "Boss",
  stealth: "Stealth",
  splits: "Splits",
  wrapped: "Bubble-wrapped",
  sealed: "Sealed",
  reefer: "Frozen",
};

/** What the page's trait row shows for an enemy, most important first. */
export function traitsOf(kind: EnemyKind): Trait[] {
  const e = ENEMIES[kind];
  const pm = inherentProps(kind);
  const t: Trait[] = [];
  if (isBig(kind)) t.push("boss");
  if (e.flying || pm & P.airborne) t.push("flies");
  if (e.stealth || pm & P.stealth) t.push("stealth");
  if (e.armor || pm & P.plated) t.push("armour");
  if (e.shield || pm & P.wrapped) t.push("wrapped");
  if (pm & P.sealed) t.push("sealed");
  if (pm & P.reefer) t.push("reefer");
  if (isHeavy(kind) && !isBig(kind)) t.push("heavy");
  if (e.splits) t.push("splits");
  if (e.speed >= 1.3) t.push("fast");
  else if (e.speed <= 0.6) t.push("slow");
  return t;
}

/** The locks an enemy carries that a tower must answer to hurt it (a flier's wings, a lorry's plates...). */
function locksOf(kind: EnemyKind): Lock[] {
  const e = ENEMIES[kind];
  const pm = inherentProps(kind) | (e.stealth ? P.stealth : 0) | (e.flying ? P.airborne : 0);
  return (["stealth", "airborne", "plated", "wrapped", "sealed", "reefer"] as const).filter((p) => pm & P[p]);
}

/** Does this tower (at any tier, spec or path) answer `prop`? Tier 1 first, then what an upgrade gives it. */
function answers(kind: TowerKind, prop: Lock): boolean {
  const try1 = (t: Parameters<typeof towerBadges>[0]): boolean => !!towerBadges(t).find((b) => b.prop === prop)?.ok;
  if (try1({ kind, tier: 1, spec: null })) return true;
  return ([0, 1] as const).some((spec) => try1({ kind, tier: 4, spec }));
}

/**
 * The towers from `towers` (a level's kit) that reach an enemy: they hit, and they answer every lock it
 * carries. A Radio Mast counts against Stealth, since it's what lets the others see it.
 */
export function countersFor(kind: EnemyKind, towers: readonly TowerKind[]): TowerKind[] {
  const locks = locksOf(kind);
  return towers.filter((k) => {
    const s = towerStats({ kind: k, tier: 1, spec: null, fleet: true });
    if (k === "mast" && locks.includes("stealth")) return true;
    const hits = s.damage > 0 || s.thorns > 0 || !!s.piles;
    if (!hits) return false;
    return locks.every((p) => (p === "stealth" ? true : answers(k, p)));
  });
}

/** True when a tower reaches the enemy only once upgraded (a Scarecrow becomes a Pumpkin Lobber for plates). */
export function needsUpgrade(kind: EnemyKind, tower: TowerKind): boolean {
  if (tower === "mast") return false;
  return locksOf(kind).some((p) => p !== "stealth" && !towerBadges({ kind: tower, tier: 1, spec: null }).find((b) => b.prop === p)?.ok);
}

/** A box on screen, in CSS pixels relative to the field. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Where the round-end rosette goes (plan item 64): the spot nearest `near` (the lane's end, where the round was
 * won) whose box covers no plot and stays inside the field with a margin. Scans a grid; if nothing is clear,
 * the spot covering the least plot area.
 */
export function rosetteSpot(plots: readonly Box[], size: { w: number; h: number }, field: { w: number; h: number }, near: { x: number; y: number }, margin = 6, avoid: readonly Box[] = []): { x: number; y: number } {
  const step = Math.max(4, Math.round(Math.min(size.w, size.h) / 8));
  let best: { x: number; y: number; cost: number } | null = null;
  for (let y = margin; y + size.h <= field.h - margin; y += step)
    for (let x = margin; x + size.w <= field.w - margin; x += step) {
      const box = { x, y, w: size.w, h: size.h };
      const area = (list: readonly Box[]): number => {
        let a = 0;
        for (const p of list)
          if (overlaps(box, p)) a += (Math.min(box.x + box.w, p.x + p.w) - Math.max(box.x, p.x)) * (Math.min(box.y + box.h, p.y + p.h) - Math.max(box.y, p.y));
        return a;
      };
      const dist = Math.hypot(x + size.w / 2 - near.x, y + size.h / 2 - near.y);
      // Any plot cover outweighs any overlay cover (Cath's bubble, the ribbon), which outweighs any distance.
      const cost = area(plots) * 1e9 + area(avoid) * 1e4 + dist;
      if (!best || cost < best.cost) best = { x, y, cost };
    }
  return best ? { x: best.x, y: best.y } : { x: Math.max(0, (field.w - size.w) / 2), y: margin };
}
