// The weekly Most Wanted: one seeded contract, the same for everyone that ISO week (like Hedgerow's Endless).
import { createRng } from "./rng";

export interface MostWanted {
  week: string;
  name: string;
  alias: string;
  /** Guards around the target. */
  guards: number;
  snipers: number;
  /** Monster level bump on top of the difficulty's own. */
  levelBump: number;
  /** A rule that changes the fight. */
  twist: "none" | "lightsOut" | "fastRounds" | "armoured" | "noFocus";
  /** Extra loot rolls on the target. */
  bonusDrops: number;
}

const FIRST = ["Marlowe", "Dessa", "Ivo", "Renata", "Okonkwo", "Lucan", "Saskia", "Bram", "Yara", "Teodor"];
const LAST = ["Vance", "Kell", "Strand", "Moro", "Quill", "Harrow", "Slate", "Voss", "Ferro", "Lund"];
const ALIAS = ["the Auctioneer", "Three-Fingers", "the Quiet Man", "Glass Jaw", "the Treasurer", "Low Tide", "Saint Nobody", "the Dentist"];

/** The ISO week key ("2026-W41") for a date, in UTC. */
export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The contract for a week key; the same key always gives the same contract. */
export function mostWanted(week: string): MostWanted {
  const rng = createRng(`mostwanted:${week}`);
  return {
    week,
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
    alias: rng.pick(ALIAS),
    guards: rng.int(2, 5),
    snipers: rng.int(0, 2),
    levelBump: rng.int(0, 6),
    twist: rng.pick(["none", "lightsOut", "fastRounds", "armoured", "noFocus"] as const),
    bonusDrops: rng.int(2, 4),
  };
}
