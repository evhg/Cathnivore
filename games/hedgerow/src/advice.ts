// Plan item 72: Cath's notebook as her advice card for the round. Pure: from the round's spawns (engine.waveSpawns)
// it picks the threat (a boss first, else the kind with the most total health on the lane) and writes one line on
// what answers it from the level's kit, preferring a tower already on the field.

import { ENEMIES, TOWERS, isBig, type EnemyKind, type TowerKind } from "./engine";
import { countersFor, needsUpgrade, traitsOf, type Trait } from "./intro";
import { towerBadges, type Lock } from "./counters";
import { PROPERTIES } from "./fleet";

export interface RoundAdvice {
  kind: EnemyKind;
  /** How many of it the round sends. */
  count: number;
  /** The whole round's size. */
  total: number;
  /** The tower the line names, if any answers it. */
  tower: TowerKind | null;
  /** Cath's one line. */
  line: string;
}

/** What the threat's main trait asks of a tower, as the end of Cath's sentence. */
const NEED: Partial<Record<Trait, string>> = {
  flies: "it reaches the air",
  stealth: "it lets the others see it",
  armour: "it cracks plates",
  wrapped: "it pops the wrap",
  sealed: "it gets through the seal",
  reefer: "it cracks the frost",
  fast: "it catches them on the way past",
  heavy: "it wears heavy plant down",
  boss: "it wears a boss down",
  splits: "it mops up what splits off",
};

export function roundAdvice(
  spawns: ReadonlyArray<{ kind: EnemyKind }>,
  kit: readonly TowerKind[],
  built: readonly TowerKind[],
): RoundAdvice | null {
  if (!spawns.length) return null;
  const tally = new Map<EnemyKind, number>();
  for (const sp of spawns) tally.set(sp.kind, (tally.get(sp.kind) ?? 0) + 1);
  const score = ([k, n]: [EnemyKind, number]) => (isBig(k) ? Infinity : ENEMIES[k].hp * n);
  const [kind, count] = [...tally].sort((a, b) => score(b) - score(a))[0]!;
  const name = ENEMIES[kind].name;
  const traits = traitsOf(kind);
  const trait = traits.find((t) => t !== "slow" && NEED[t]) ?? null;
  const counters = countersFor(kind, kit);
  // A tower on the field that answers it outright beats one that needs an upgrade, which beats building new.
  const onField = counters.filter((t) => built.includes(t));
  const ready = onField.find((t) => !needsUpgrade(kind, t));
  const tower = ready ?? onField[0] ?? counters.find((t) => !needsUpgrade(kind, t)) ?? counters[0] ?? null;
  const why = trait ? NEED[trait]! : "it hits them hard";
  let line: string;
  if (!tower) line = `Nothing in this kit answers the ${name}: slow it where the lane bends and keep Goodwill in hand.`;
  else {
    const tn = TOWERS[tower].name;
    const up = needsUpgrade(kind, tower);
    if (built.includes(tower))
      line = up ? `Upgrade your ${tn} before Go: once upgraded ${why}.` : `Your ${tn} answers the ${name}: ${why}. Another near the gate helps.`;
    else line = `Build a ${tn}${up ? " and upgrade it" : ""}: ${why}.${built.length ? "" : " Tap a plot to build."}`;
  }
  return { kind, count, total: spawns.length, tower, line };
}

/** What a lock asks of a tower, to finish "Nothing on your field ...". */
const GAP: Record<Lock, string> = {
  stealth: "sees through hedge-camo",
  airborne: "reaches the air",
  plated: "gets through steel",
  wrapped: "pops the wrap",
  sealed: "gets through the seal",
  reefer: "cracks the frost",
};

/**
 * Plan item 95: when the round brings a lock no tower on the field answers (the ticket's "Can't answer" stamp),
 * Cath's line is about that first: the cheapest tower in the kit that holds its key, or what to do without one.
 * `cost` prices a tower on this field. Null when nothing is missing.
 */
export function gapAdvice(gaps: readonly Lock[], kit: readonly TowerKind[], cost: (k: TowerKind) => number): string | null {
  const lock = gaps[0];
  if (!lock) return null;
  const keys = kit.filter((k) => towerBadges({ kind: k, tier: 1, spec: null }).find((b) => b.prop === lock)?.ok);
  const tower = [...keys].sort((a, b) => cost(a) - cost(b))[0];
  const name = PROPERTIES[lock].name;
  if (!tower) return `Nothing on your field ${GAP[lock]}, and this kit can't: slow the ${name.toLowerCase()} ones and keep Goodwill in hand.`;
  return `Nothing on your field ${GAP[lock]}. Build a ${TOWERS[tower].name} before Go.`;
}
