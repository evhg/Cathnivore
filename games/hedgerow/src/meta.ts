// Hedgerow 2 M10 (docs/design/hedgerow-2.md section 9): tower XP and Acorns. Each kind earns XP equal to its
// knockouts in every mode; a win pays Acorns by mode. Both are earned only in real runs (the sandbox and the
// Daily never call this), and nothing here gates a tier yet.
import { XP_CROWN, type Difficulty, type Game, type TowerKind } from "./engine";
import { freeAcorns, type SaveData } from "./store";

/** Acorns for a win: 20 to 120 by mode, with a remix paying the same as its base mode. */
export function acornsFor(difficulty: Difficulty, heroic: boolean): number {
  if (heroic) return 120;
  return difficulty === "easy" ? 20 : difficulty === "hard" ? 70 : 40;
}

export interface RunReward {
  xp: Partial<Record<TowerKind, number>>;
  acorns: number;
  /** A Seed Packet dropped by a boss level's win, if any. */
  packet?: string;
}

/** What a finished run earns, and the save updated with it. A loss still earns the XP its knockouts made. */
export function awardRun(data: SaveData, g: Game, won: boolean): RunReward {
  const xp: Partial<Record<TowerKind, number>> = {};
  for (const t of g.towers) if ((t.kills ?? 0) > 0) xp[t.kind] = (xp[t.kind] ?? 0) + (t.kills ?? 0);
  const store = (data.xp ??= {});
  for (const [k, n] of Object.entries(xp)) store[k as TowerKind] = (store[k as TowerKind] ?? 0) + (n ?? 0);
  // XP past a kind's Crown gate has nothing left to unlock: it collects in the Compost Heap.
  for (const k of Object.keys(store) as TowerKind[]) {
    const over = (store[k] ?? 0) - XP_CROWN;
    if (over > 0) {
      data.compost = (data.compost ?? 0) + over;
      store[k] = XP_CROWN;
    }
  }
  const acorns = won ? acornsFor(g.difficulty, g.heroic) : 0;
  if (acorns) data.acorns = (data.acorns ?? 0) + acorns;
  // Every tenth level (a boss) drops a Seed Packet on a win, rotating through the catalogue.
  let packet: string | undefined;
  if (won && g.level.id % 10 === 0 && !g.level.endless && !g.heroic) {
    const def = PACKETS[(g.level.id / 10 - 1) % PACKETS.length]!;
    (data.packets ??= {})[def.id] = packetCount(data, def.id) + 1;
    packet = def.name;
  }
  return { xp, acorns, packet };
}

/** XP given per feed: the Heap pays 2 compost for each XP (design doc section 9). */
export const COMPOST_RATE = 2;
export const COMPOST_FEED = 500;

/** Feeds the Compost Heap to `kind`: `COMPOST_FEED` XP for 1,000 compost. False if the heap is short or the kind is full. */
export function feedCompost(data: SaveData, kind: TowerKind): boolean {
  const have = data.xp?.[kind] ?? 0;
  const give = Math.min(COMPOST_FEED, XP_CROWN - have);
  const cost = give * COMPOST_RATE;
  if (give <= 0 || (data.compost ?? 0) < cost) return false;
  (data.xp ??= {})[kind] = have + give;
  data.compost = (data.compost ?? 0) - cost;
  return true;
}

/** A Seed Packet: a one-use pre-grown path tower, bought with Acorns and planted free on any plot (design doc section 9). */
export interface PacketDef {
  id: string;
  name: string;
  kind: TowerKind;
  path: [number, number, number];
  cost: number;
}
export const PACKETS: PacketDef[] = [
  { id: "silo-203", name: "Silo 2-0-3", kind: "silo", path: [2, 0, 3], cost: 120 },
  { id: "cannon-302", name: "Cannon 3-0-2", kind: "cannon", path: [3, 0, 2], cost: 100 },
  { id: "mill-032", name: "Windmill 0-3-2", kind: "windmill", path: [0, 3, 2], cost: 110 },
  { id: "stall-320", name: "Stall 3-2-0", kind: "stall", path: [3, 2, 0], cost: 90 },
  { id: "bee-023", name: "Beehive 0-2-3", kind: "beehive", path: [0, 2, 3], cost: 100 },
];

export function packetCount(data: SaveData, id: string): number {
  return data.packets?.[id] ?? 0;
}

export function buyPacket(data: SaveData, id: string): boolean {
  const p = PACKETS.find((x) => x.id === id);
  if (!p || freeAcorns(data) < p.cost) return false;
  (data.packets ??= {})[id] = packetCount(data, id) + 1;
  data.packetSpend = (data.packetSpend ?? 0) + p.cost;
  return true;
}

export function spendPacket(data: SaveData, id: string): boolean {
  if (packetCount(data, id) < 1) return false;
  data.packets![id] = packetCount(data, id) - 1;
  return true;
}
