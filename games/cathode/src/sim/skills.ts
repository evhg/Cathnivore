// CATHODE's skill allocation rules: spending, refunding and respeccing points, the row level gates and
// prerequisites, dual-classing, hybrid capstones, effective ranks (hard points plus "+skills" from gear),
// synergies, and folding every learned skill into modifiers for `deriveStats`.
//
// Rules (design bible 4.2):
// - A row unlocks at character level 1, 6, 12, 18, 24 or 30. A skill needs a point in each prerequisite.
// - At level 15 Cath takes a second class. Its skills cost the same but unlock 3 levels later (they need
//   the primary's level minus 3 to reach the row level).
// - Each class pair has one hybrid capstone at level 30; it needs both classes.
// - Gear "+skills" raise the effective rank of skills that have at least one hard point; synergies only
//   count hard points (as in Diablo II).
// All functions are pure: they return a new holder or a reason, never mutate.

import {
  ALL_SKILLS,
  DUAL_CLASS_LEVEL,
  HYBRID_LEVEL,
  ROW_LEVELS,
  SECOND_CLASS_DELAY,
  SKILLS,
  fillTemplate,
  mainValue,
  type SkillDef,
  type SkillEffect,
} from "./classes";
import { skillBonus, type Modifier, type StatTotals } from "./stats";
import type { ClassId } from "./types";

/** The parts of a character the skill rules read and write (a full `Character` fits). */
export interface SkillHolder {
  level: number;
  /** [primary] or [primary, second]. */
  classes: readonly ClassId[];
  /** Hard points by skill id. Absent means 0. */
  skills: Readonly<Record<string, number>>;
  unspentSkills: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };
const fail = <T>(reason: string): Result<T> => ({ ok: false, reason });

/** Hard points in a skill. */
export function rankOf(holder: Pick<SkillHolder, "skills">, id: string): number {
  return holder.skills[id] ?? 0;
}

/** True when the skill belongs to the holder's second class. */
export function isSecondClassSkill(holder: Pick<SkillHolder, "classes">, skill: SkillDef): boolean {
  return !skill.hybrid && holder.classes[1] === skill.cls;
}

/** The character level a skill unlocks at for this holder (row level, +3 for the second class, 30 for hybrids). */
export function requiredLevel(holder: Pick<SkillHolder, "classes">, skill: SkillDef): number {
  if (skill.hybrid) return HYBRID_LEVEL;
  const base = ROW_LEVELS[skill.row] ?? 1;
  return isSecondClassSkill(holder, skill) ? base + SECOND_CLASS_DELAY : base;
}

/** Why a point can't go into this skill right now, or null if it can. */
export function cannotSpend(holder: SkillHolder, id: string): string | null {
  const skill = SKILLS[id];
  if (!skill) return `unknown skill ${id}`;
  if (holder.unspentSkills < 1) return "no skill points";
  if (skill.hybrid) {
    if (!skill.classes.every((c) => holder.classes.includes(c))) return `${skill.name} needs both of its classes`;
  } else if (!holder.classes.includes(skill.cls)) {
    return `${skill.name} belongs to a class Cath hasn't taken`;
  }
  const need = requiredLevel(holder, skill);
  if (holder.level < need) return `${skill.name} unlocks at level ${need}`;
  if (rankOf(holder, id) >= skill.maxRank) return `${skill.name} is at its maximum rank`;
  for (const p of skill.prereqs) {
    if (rankOf(holder, p) < 1) return `${skill.name} needs ${SKILLS[p]?.name ?? p} first`;
  }
  return null;
}

/** Spends `points` (default 1) into a skill, one at a time; fails without change if any point can't go in. */
export function spendSkill<T extends SkillHolder>(holder: T, id: string, points = 1): Result<T> {
  let h = holder;
  for (let i = 0; i < points; i++) {
    const why = cannotSpend(h, id);
    if (why) return fail(why);
    h = { ...h, unspentSkills: h.unspentSkills - 1, skills: { ...h.skills, [id]: rankOf(h, id) + 1 } };
  }
  return { ok: true, value: h };
}

/** Skills that list `id` as a prerequisite and have points in them. */
export function dependents(holder: Pick<SkillHolder, "skills">, id: string): SkillDef[] {
  return ALL_SKILLS.filter((s) => s.prereqs.includes(id) && rankOf(holder, s.id) > 0);
}

/** Takes one point back out of a skill. A skill's last point can't come out while a learned skill needs it. */
export function refundSkill<T extends SkillHolder>(holder: T, id: string): Result<T> {
  const rank = rankOf(holder, id);
  if (rank < 1) return fail("no points to refund");
  if (rank === 1) {
    const deps = dependents(holder, id);
    if (deps.length > 0) return fail(`${deps.map((d) => d.name).join(", ")} still need ${SKILLS[id]?.name ?? id}`);
  }
  const skills = { ...holder.skills };
  if (rank === 1) delete skills[id];
  else skills[id] = rank - 1;
  return { ok: true, value: { ...holder, skills, unspentSkills: holder.unspentSkills + 1 } };
}

/** Total hard points spent. */
export function pointsSpent(holder: Pick<SkillHolder, "skills">): number {
  return Object.values(holder.skills).reduce((a, b) => a + b, 0);
}

/** Returns every spent point (no cost check: see `respecCost`). */
export function respec<T extends SkillHolder>(holder: T): T {
  return { ...holder, skills: {}, unspentSkills: holder.unspentSkills + pointsSpent(holder) };
}

/** Scrip a respec costs: 250 × level, doubling with each respec already bought (one free after the act 1 boss). */
export function respecCost(respecsBought: number, level: number): number {
  return Math.round(250 * level * Math.pow(2, Math.min(respecsBought, 10)));
}

/** Takes the second class at level 15. */
export function addSecondClass<T extends SkillHolder>(holder: T, cls: ClassId): Result<T> {
  if (holder.classes.length >= 2) return fail("Cath already has two classes");
  if (holder.classes[0] === cls) return fail("the second class must differ from the first");
  if (holder.level < DUAL_CLASS_LEVEL) return fail(`a second class opens at level ${DUAL_CLASS_LEVEL}`);
  return { ok: true, value: { ...holder, classes: [...holder.classes, cls] } };
}

/** The "+skills" gear gives this skill (all skills, its class and its tree). */
export function bonusRanks(skill: SkillDef, totals?: StatTotals): number {
  if (!totals) return 0;
  return skillBonus(totals, skill.cls, skill.tree === "hybrid" ? null : skill.tree);
}

/** Hard points plus gear bonuses; gear only lifts skills with at least one hard point. */
export function effectiveRank(holder: Pick<SkillHolder, "skills">, id: string, totals?: StatTotals): number {
  const skill = SKILLS[id];
  const hard = rankOf(holder, id);
  if (!skill || hard < 1) return 0;
  return hard + bonusRanks(skill, totals);
}

/** The synergy bonus in percent: Σ perPoint × hard points in each synergy source. */
export function synergyBonus(holder: Pick<SkillHolder, "skills">, id: string): number {
  const skill = SKILLS[id];
  if (!skill) return 0;
  return skill.synergies.reduce((sum, s) => sum + s.perPoint * rankOf(holder, s.from), 0);
}

/** A skill's main value at its effective rank, raised by synergies (and re-capped). 0 when unlearned. */
export function skillValue(holder: Pick<SkillHolder, "skills">, id: string, totals?: StatTotals): number {
  const skill = SKILLS[id];
  if (!skill) return 0;
  const rank = effectiveRank(holder, id, totals);
  if (rank < 1) return 0;
  const v = mainValue(skill, rank) * (1 + synergyBonus(holder, id) / 100);
  return skill.main.cap !== undefined ? Math.min(skill.main.cap, v) : v;
}

/**
 * Every modifier the holder's learned skills add. `totals` are the equipment totals, used for "+skills".
 * Pass the result to `deriveStats` as its skills list.
 */
export function skillModifiers(holder: Pick<SkillHolder, "skills">, totals?: StatTotals): Modifier[] {
  const out: Modifier[] = [];
  for (const id of Object.keys(holder.skills)) {
    const skill = SKILLS[id];
    if (!skill) continue;
    const rank = effectiveRank(holder, id, totals);
    if (rank < 1) continue;
    out.push(...skill.modifiers(skillValue(holder, id, totals), rank));
  }
  return out;
}

/** What the game layer needs to fire an active skill. */
export interface ActiveSkillState {
  id: string;
  name: string;
  rank: number;
  /** Seconds, after cooldown reduction. */
  cooldown: number;
  battery: number;
  effect: SkillEffect;
}

/** An active skill's live parameters, or null if it's passive or unlearned. */
export function activeSkill(
  holder: Pick<SkillHolder, "skills">,
  id: string,
  totals?: StatTotals,
  cooldownReduction = 0,
): ActiveSkillState | null {
  const skill = SKILLS[id];
  if (!skill?.active) return null;
  const rank = effectiveRank(holder, id, totals);
  if (rank < 1) return null;
  const value = skillValue(holder, id, totals);
  return {
    id,
    name: skill.name,
    rank,
    cooldown: skill.active.cooldown * (1 - cooldownReduction),
    battery: skill.active.battery,
    effect: skill.active.effect(value, rank),
  };
}

/** A skill's description at the holder's current rank (for tooltips): the template with the live value. */
export function describeAtRank(holder: Pick<SkillHolder, "skills">, id: string, totals?: StatTotals): string {
  const skill = SKILLS[id];
  if (!skill) return "";
  const v = skillValue(holder, id, totals) || mainValue(skill, 1);
  return fillTemplate(skill.template, v);
}
