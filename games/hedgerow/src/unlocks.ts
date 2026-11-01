// Plan item 3 (progressive unlocks): a new player meets one system at a time. Each entry opens when its
// field opens (the field before it has a star), and the first time it is open the level select shows a
// one-card introduction from Cath. Seen cards are kept as `unlock:<id>` in the save's `tips`, so the save
// format doesn't change. Saves made before this table existed (any stars, no `unlock:init`) are treated as
// having seen every card already open, so returning players aren't shown a queue of cards. Sandbox mode
// (`?sandbox=1`, screenshots and tests) has everything open and shows no cards.

import { isUnlocked, type SaveData } from "./store";

export type UnlockId = "almanac" | "kit" | "daily" | "modes" | "orchard" | "show";

export interface Unlock {
  id: UnlockId;
  /** The field whose opening opens this system. */
  level: number;
  icon: string;
  title: string;
  body: string;
}

export const UNLOCKS: readonly Unlock[] = [
  {
    id: "almanac",
    level: 2,
    icon: "📖",
    title: "The Almanac",
    body: "Every tower and vehicle you've met, with its numbers. It fills in as the lane brings new trouble.",
  },
  {
    id: "kit",
    level: 3,
    icon: "🧺",
    title: "Cath's kit",
    body: "Pick how I play before a field: Baker, Organiser or Warden. Each one bends my skills a different way.",
  },
  {
    id: "daily",
    level: 4,
    icon: "☀",
    title: "The Daily",
    body: "One field a day, the same for everyone, with a score to share. No Seed Bank: just you and the lane.",
  },
  {
    id: "modes",
    level: 6,
    icon: "⚖",
    title: "Difficulty and remixes",
    body: "Cleared fields can be played Hard, remixed, or Heroic with one Goodwill. Each win earns a medal.",
  },
  {
    id: "orchard",
    level: 11,
    icon: "🍎",
    title: "The Orchard",
    body: "A run of fields, one boon after each, until a field falls. Seeds from every run buy Heirlooms.",
  },
  {
    id: "show",
    level: 13,
    icon: "🏵",
    title: "The County Show",
    body: "Three fields, one kit of six towers, one Goodwill purse. A new Show every week; win it for a Seed Packet.",
  },
];

const key = (id: UnlockId): string => `unlock:${id}`;
const INIT = "unlock:init";

export function isOpen(data: SaveData, id: UnlockId, sandbox = false): boolean {
  if (sandbox) return true;
  const u = UNLOCKS.find((x) => x.id === id);
  return !u || isUnlocked(data, u.level);
}

/** What a field card needs to know about a level: its id and its twists. */
export interface FieldInfo {
  id: number;
  twists?: readonly string[];
}

/** First run of the table on this save: an old save (any stars) counts every open card as seen, and every field
 * card for a field it has already won (it has met that twist, or merged). Returns true if `data` changed. */
export function initUnlocks(data: SaveData, levels: readonly FieldInfo[] = [], heirloomFrom = Infinity): boolean {
  if (data.tips[INIT]) return false;
  data.tips[INIT] = true;
  if (Object.keys(data.stars).length > 0) {
    for (const u of UNLOCKS) if (isUnlocked(data, u.level)) data.tips[key(u.id)] = true;
    for (const lv of levels) if (data.stars[String(lv.id)]) for (const c of fieldCards(data, lv, heirloomFrom)) data.tips[`unlock:${c}`] = true;
  }
  return true;
}

// ---- Field cards: systems introduced inside a field, the first time they matter ----
// A twist (night, rain, a tight budget...) gets one card the first time a field has it; Heirloom forging gets
// one at the first field where towers can be forged. Seen flags share the `unlock:` prefix in `tips`.

/** The field cards this level would show and the player hasn't seen yet, twists first. */
export function fieldCards(data: SaveData, level: FieldInfo, heirloomFrom: number, sandbox = false): string[] {
  if (sandbox) return [];
  const ids = [...(level.twists ?? []).map((t) => `twist:${t}`), ...(level.id >= heirloomFrom ? ["heirloom"] : [])];
  return ids.filter((id) => !data.tips[`unlock:${id}`]);
}

export function markFieldCardSeen(data: SaveData, id: string): void {
  data.tips[`unlock:${id}`] = true;
}

/** The next introduction card to show, if any: open and not yet seen. */
export function pendingUnlock(data: SaveData, sandbox = false): Unlock | null {
  if (sandbox) return null;
  return UNLOCKS.find((u) => isUnlocked(data, u.level) && !data.tips[key(u.id)]) ?? null;
}

export function markUnlockSeen(data: SaveData, id: UnlockId): void {
  data.tips[key(id)] = true;
}

/** The furthest act the map shows: every act whose first field is open (later acts sit in fog). */
export function openActs(data: SaveData, actCount: number): number {
  let n = 1;
  while (n < actCount && isUnlocked(data, n * 10 + 1)) n++;
  return n;
}
