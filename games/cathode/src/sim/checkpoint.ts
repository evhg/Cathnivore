// C8 "Dying, done properly" (docs/design/cathode-combat.md S6.6): what Retry restores. A restart is a fresh resume
// from what is stored (the save and the unlocks), never from the dying session's memory: XP, loot and kit picked up
// since the last checkpoint go, exactly as a page reload would lose them. The only difference is the death count.
// Pure: the store is passed in (the game layer gives it localStorage).

import { SAVE_KEY, deserialize } from "./save";
import type { Character } from "./character";

export const UNLOCKS_KEY = "cathode:unlocks:v1";

export interface Store {
  getItem(key: string): string | null;
}

export interface ResumeState {
  character: Character | null;
  jobsDone: string[];
  unlocks: { weapons: string[]; features: string[] } | null;
  deaths: number;
}

/** What a fresh visit resumes from (`deaths` carried by the caller: a page load starts at 0). */
export function freshResume(store: Store, deaths = 0): ResumeState {
  let character: Character | null = null;
  let jobsDone: string[] = [];
  let unlocks: ResumeState["unlocks"] = null;
  try {
    const raw = store.getItem(SAVE_KEY);
    const r = raw ? deserialize(raw) : null;
    if (r?.ok) {
      character = r.save.character;
      jobsDone = r.save.jobsDone;
    }
    const u = store.getItem(UNLOCKS_KEY);
    if (u) {
      const p = JSON.parse(u) as Partial<NonNullable<ResumeState["unlocks"]>>;
      if (Array.isArray(p.weapons) && Array.isArray(p.features)) unlocks = { weapons: p.weapons, features: p.features };
    }
  } catch {
    // Private mode or a broken store: the defaults.
  }
  return { character, jobsDone, unlocks, deaths };
}

/** Retry from the checkpoint: the fresh resume, one death on. */
export function restartResume(store: Store, deathsBefore: number): ResumeState {
  return freshResume(store, deathsBefore + 1);
}
