// Readability for the Fleet's hard locks (Hedgerow 2 section 2): what a vehicle is called with its properties,
// which properties a round brings, whether the field can answer them, what a tower can and can't touch, and
// the words of the leak report and the loss screen. Pure functions over the engine's state, so the tests can
// read exactly what a player reads.

import { ENEMIES, fieldAnswers, hasTwist, inherentProps, towerStats, type Game, type LeakCause, type Level, type Tower, type TowerKind, type WaveGroup } from "./engine";
import { DAMAGE_NAMES, P, PROPERTIES, RUNGS, canHurt, propsOf, type Property } from "./fleet";

/** The properties the player has to answer, in the order chips and badges show them. */
export const LOCKS = ["stealth", "airborne", "plated", "wrapped", "sealed", "reefer"] as const;
export type Lock = (typeof LOCKS)[number];

/** "Stealth Box Lorry", "Plated Van": the rung's name with the properties it carries beyond its own. */
export function vehicleName(kind: Parameters<typeof inherentProps>[0], pm = 0): string {
  const own = inherentProps(kind);
  const extra = propsOf(pm & ~own & ~P.airborne & ~P.plant);
  const name = ENEMIES[kind].name;
  if (!extra.length) return name;
  return `${extra.map((p) => PROPERTIES[p].adj).join(" ")} ${name}`;
}

/**
 * Every property a vehicle's children (and theirs, all the way down) carry: their own and what their parent
 * gives them. A Car Transporter pops into Artics, which pop into a Wrapped and a Reefer lorry.
 */
export function descendantProps(kind: Parameters<typeof inherentProps>[0], seen = 0): number {
  const r = RUNGS[kind];
  if (!r || seen > 8) return 0;
  let pm = 0;
  r.children.forEach((c, i) => {
    pm |= inherentProps(c) | descendantProps(c, seen + 1);
    for (const p of r.childProps?.[i] ?? []) pm |= P[p];
  });
  return pm;
}

/** Every property a round (a level's wave) brings: its groups', its rungs' own, and the Armoured/Fortified twists'. */
export function roundProps(level: Level, groups: WaveGroup[] | undefined): number {
  let pm = 0;
  for (const g of groups ?? []) {
    pm |= (g.pm ?? 0) | inherentProps(g.enemy) | descendantProps(g.enemy);
  }
  if (hasTwist(level, "armoured")) pm |= P.plated;
  if (hasTwist(level, "fortified")) pm |= P.reinforced;
  return pm;
}

/** The locks in `pm` that no tower on the field holds the key to ("Your field can't answer this"). */
export function unanswered(game: Game, pm: number): Lock[] {
  return LOCKS.filter((p) => pm & P[p] && !fieldAnswers(game, p));
}

/** What a tower can do about each lock: a green or red badge on its card. */
export function towerBadges(t: Pick<Tower, "kind" | "tier"> & { spec?: 0 | 1 | null; fleet?: boolean }): Array<{ prop: Lock; ok: boolean; text: string }> {
  const s = towerStats({ ...t, fleet: true });
  const hits = s.damage > 0 || s.thorns > 0;
  return LOCKS.map((prop) => {
    const info = PROPERTIES[prop];
    if (prop === "stealth") {
      const ok = s.reveal > 1;
      return { prop, ok, text: ok ? "Reveals Stealth in its range" : "Can't see Stealth without a Radio Mast nearby" };
    }
    if (!hits) return { prop, ok: false, text: `Doesn't hit ${info.name}` };
    if (prop === "airborne") return { prop, ok: s.air, text: s.air ? "Hits the air" : "Ground only: can't reach Airborne" };
    const ok = canHurt(s.type, P[prop]);
    return { prop, ok, text: ok ? `Hits ${info.name}` : `${DAMAGE_NAMES[s.type!]}: can't touch ${info.name}` };
  });
}

/** The damage type a tower deals, as its card says it ("Sharp", "Blast"), or "" for towers that don't hit. */
export function damageLabel(t: Pick<Tower, "kind" | "tier"> & { spec?: 0 | 1 | null }): string {
  const s = towerStats({ ...t, fleet: true });
  return s.type && (s.damage > 0 || s.thorns > 0) ? DAMAGE_NAMES[s.type] : "";
}

/** The towers this level allows that answer a lock. */
export function keysFor(level: Level, prop: Lock): TowerKind[] {
  return level.towers.filter((k) => towerBadges({ kind: k, tier: 1, spec: null }).find((b) => b.prop === prop)?.ok || specAnswers(k, prop));
}
function specAnswers(kind: TowerKind, prop: Lock): boolean {
  return ([0, 1] as const).some((spec) => towerBadges({ kind, tier: 4, spec }).find((b) => b.prop === prop)?.ok);
}

const CAUSE_TEXT: Record<Exclude<LeakCause, Property>, { why: string; key: string }> = {
  dropped: { why: "Cath was knocked down holding it.", key: "Put towers in range of her post so they finish what she holds." },
  stacked: { why: "Too many at once: the next round was stacked on before this one was through.", key: "Stack only when the towers clear a round with room to spare." },
  damage: { why: "Not enough popping near the farmhouse.", key: "Build or upgrade along the last stretch of lane." },
};

/** The leak report's lines for a cause (section 2): why it got through, and what answers it. */
export function causeText(cause: LeakCause): { why: string; key: string } {
  if (cause in CAUSE_TEXT) return CAUSE_TEXT[cause as keyof typeof CAUSE_TEXT];
  const info = PROPERTIES[cause as Property];
  return { why: info.why, key: info.key };
}

/**
 * The banner for a leak: "Leaked: Stealth Box Lorry (11)" and the property's why and key lines ("Nothing
 * could see it. A Radio Mast reveals stealth..."). Cath shows the towers only what she holds (M3).
 */
export function leakReport(ev: { kind: Parameters<typeof inherentProps>[0]; pm?: number; lost?: number; cause?: LeakCause }): { title: string; sub: string } {
  const name = vehicleName(ev.kind, ev.pm ?? 0);
  const t = causeText(ev.cause ?? "damage");
  return { title: `Leaked: ${name}${ev.lost ? ` (${ev.lost})` : ""}`, sub: `${t.why} ${t.key}` };
}

/** The loss screen's top three causes, by Goodwill lost, with the round each first cost something in. */
export function lossCauses(game: Game): Array<{ cause: LeakCause; lost: number; round: number; title: string; why: string; key: string; towers: TowerKind[] }> {
  return (Object.entries(game.leakLog) as Array<[LeakCause, { lost: number; round: number }]>)
    .sort((a, b) => b[1].lost - a[1].lost || a[1].round - b[1].round)
    .slice(0, 3)
    .map(([cause, v]) => {
      const t = causeText(cause);
      const title = cause in CAUSE_TEXT ? (cause === "damage" ? "Too little damage" : cause === "stacked" ? "Stacked rounds" : "Cath knocked down") : PROPERTIES[cause as Property].name;
      const towers = (LOCKS as readonly string[]).includes(cause) ? keysFor(game.level, cause as Lock) : [];
      return { cause, lost: v.lost, round: v.round, title, why: t.why, key: t.key, towers };
    });
}

/** A short "what it is" for a tower's damage type and locks, for the build menu and the tower card. */
export function lockLine(kind: TowerKind, spec: 0 | 1 | null = null, tier: Tower["tier"] = 1): string {
  const label = damageLabel({ kind, tier, spec });
  const red = towerBadges({ kind, tier, spec }).filter((b) => !b.ok && b.prop !== "stealth");
  if (!label) return "";
  const cant = red.map((b) => PROPERTIES[b.prop].name);
  return ` ${label}${cant.length ? `: can't touch ${cant.join(", ")}` : ": hits everything it can see"}.`;
}

/** For the Almanac: one line per property, its look and its key. */
export function propertyEntries(): Array<{ prop: Property; name: string; lock: string; key: string; colour: string }> {
  return (Object.keys(PROPERTIES) as Property[]).map((prop) => ({ prop, name: PROPERTIES[prop].name, lock: PROPERTIES[prop].lock, key: PROPERTIES[prop].key, colour: PROPERTIES[prop].colour }));
}



/** A round card under a "Round N: theme" title: its own "Round N:" prefix would say it twice. */
export function cardBody(card: string): string {
  const body = card.replace(/^Round \d+:\s*/, "");
  return body.charAt(0).toUpperCase() + body.slice(1);
}
