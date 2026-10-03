// Cath's wardrobe (ROADMAP 51): outfits earned from clears and rosettes. Pure rules plus one piece of module
// state, the outfit she is wearing, which the 2D sprite and the 3D model read when they draw her. The choice is
// stored in SaveData.outfit (an optional field, so no version bump).

import type { SaveData } from "./store";
import type { CathOutfit } from "../../../shared/cath/cath";

export interface Outfit {
  id: string;
  name: string;
  /** How to earn it, shown while it is locked. */
  how: string;
  jacket: string;
  sleeve: string;
  trousers: string;
  boots: string;
  blouse: string;
  brooch: string;
  /** Her illustrated outfit in the shared Cath art (portraits, story scenes, the Cath sheet). */
  art: CathOutfit;
  unlocked: (d: SaveData) => boolean;
}

const won = (d: SaveData, from: number, to: number): boolean => {
  for (let i = from; i <= to; i++) if (!d.stars[String(i)]) return false;
  return true;
};

export const OUTFITS: Outfit[] = [
  {
    id: "blazer",
    art: "field",
    name: "Olive blazer",
    how: "Hers from the start.",
    jacket: "#6E7C4B",
    sleeve: "#56623A",
    trousers: "#3a3340",
    boots: "#5a3a28",
    blouse: "#F7F0E3",
    brooch: "#86AC5B",
    unlocked: () => true,
  },
  {
    id: "wax",
    art: "wax",
    name: "Wellies and wax jacket",
    how: "Clear levels 1 to 10.",
    jacket: "#4B5A3A",
    sleeve: "#3b472d",
    trousers: "#5b5446",
    boots: "#2f6b3a",
    blouse: "#c9b88f",
    brooch: "#d9b384",
    unlocked: (d) => won(d, 1, 10),
  },
  {
    id: "market",
    art: "pinny",
    name: "Market-day dress",
    how: "Earn 6 rosettes.",
    jacket: "#d96b7f",
    sleeve: "#c0586c",
    trousers: "#f1d6c8",
    boots: "#7a3a4a",
    blouse: "#fff4e8",
    brooch: "#f2c94c",
    unlocked: (d) => Object.keys(d.rosettes ?? {}).length >= 6,
  },
  {
    id: "trench",
    art: "market",
    name: "Camel trench and knit scarf",
    how: "Clear level 50.",
    jacket: "#C99A61",
    sleeve: "#AA7D48",
    trousers: "#3a3340",
    boots: "#6b4a2b",
    blouse: "#F1E6D0",
    brooch: "#D4AE58",
    unlocked: (d) => won(d, 50, 50),
  },
  {
    id: "gown",
    art: "gown",
    name: "Kingsmarket gown",
    how: "Clear level 100.",
    jacket: "#6E1F33",
    sleeve: "#4E1424",
    trousers: "#5A1829",
    boots: "#D4AE58",
    blouse: "#F3E3C8",
    brooch: "#f2c94c",
    unlocked: (d) => won(d, 100, 100),
  },
];

export function unlockedOutfits(d: SaveData): Outfit[] {
  return OUTFITS.filter((o) => o.unlocked(d));
}

/** The outfit the save asks for, falling back to the blazer if it is unknown or not yet earned. */
export function outfitFor(d: SaveData): Outfit {
  const o = OUTFITS.find((x) => x.id === d.outfit);
  return o && o.unlocked(d) ? o : OUTFITS[0]!;
}

let worn: Outfit = OUTFITS[0]!;
export const wornOutfit = (): Outfit => worn;
export function wear(o: Outfit): void {
  worn = o;
}
