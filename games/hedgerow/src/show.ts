// The weekly County Show (Hedgerow 2 M11): three Fleet fields, one kit of six towers, one Goodwill purse that
// carries from field to field. The same for everyone each week, no Seed Bank. Clearing all three wins a Seed Packet.

import type { Level, TowerKind } from "./engine";
import { LEVELS } from "./levels";
import { PACKETS } from "./meta";

/** Every Show has these four; the week adds two more from the rest of the roster. */
export const SHOW_CORE: TowerKind[] = ["scarecrow", "hedgerow", "beehive", "cannon"];
export const SHOW_EXTRAS: TowerKind[] = ["windmill", "stall", "mast", "pond", "silo", "court"];

function rng(seed: number): () => number {
  let s = (Math.imul(seed + 1, 2654435761) >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function showKit(week: number, picks?: TowerKind[]): TowerKind[] {
  // The draft: the player picks two of the six extras; without a valid pick the week chooses for them.
  if (picks && picks.length === 2 && picks[0] !== picks[1] && picks.every((k) => SHOW_EXTRAS.includes(k))) return [...SHOW_CORE, ...picks];
  const r = rng(week * 7 + 3);
  const pool = [...SHOW_EXTRAS];
  const out = [...SHOW_CORE];
  for (let i = 0; i < 2; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]!);
  return out;
}

/** Three non-boss Fleet fields, easiest first, with the week's kit. */
export function showFields(week: number, drafted?: TowerKind[]): Level[] {
  const r = rng(week * 13 + 5);
  const pool = LEVELS.filter((l) => l.rules === "fleet" && !l.endless && l.id >= 11 && l.id % 10 !== 0);
  const picks: Level[] = [];
  while (picks.length < 3) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0]!);
  picks.sort((a, b) => a.id - b.id);
  const kit = showKit(week, drafted);
  return picks.map((l) => ({ ...l, towers: kit.filter((k) => l.towers.includes(k) || SHOW_CORE.includes(k)) }));
}

export function showPacket(week: number): string {
  return PACKETS[week % PACKETS.length]!.id;
}
