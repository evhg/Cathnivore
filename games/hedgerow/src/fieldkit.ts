// Plan item 399: each act's field furnished as its own country. The margins were act-specific (items 345, 370,
// 388), but the field inside them was one kit everywhere: the same red barn, white cottage, straw stooks, hens and
// round blue ponds. A kit names what an act's plots are sown with, what stands in a barn's farmyard, what a water
// plot looks like and what grazes its beds. Drawing only: plot kinds, barns and water keep their rules.

import type { Level } from "./engine";

/** What a plain plot is sown with (2D); `bedBase` maps each to the 3D view's three beds. */
export type BedLook =
  | "earth"
  | "stubble"
  | "clover"
  // Saltmarsh: glassy samphire, sea-lavender in flower, short salt grazing with sheep on it.
  | "samphire"
  | "lavender"
  | "saltgrass"
  // Highmoor: hill oats standing in ear, turnip rows for the flock, walled in-bye pasture.
  | "oats"
  | "turnips"
  | "inbye"
  // Oakvale: a woodland smallholding: wild garlic in flower, leaf litter with toadstools, a bluebell bank.
  | "garlic"
  | "litter"
  | "bluebell"
  // Shingle Bay: sea kale on the shingle, potato lazybeds under wrack, thrift cushions on the cliff turf.
  | "seakale"
  | "lazybed"
  | "thrift"
  // Rivermead: water-meadow strips with their drains, a hay meadow mown into swathes, a watercress bed (no trees: an orchard reads as item 43's unbuildable orchard landmark).
  | "meadow"
  | "swathe"
  | "cress";

/** The building on a barn's cell. */
export type BarnLook = "barn" | "netshed" | "millhouse" | "fold" | "timberbarn" | "boathut";
/** A water plot: a round farm pond, a salt pan, a willow-ringed pond. */
export type WaterLook = "pond" | "saltpan" | "willowpond" | "peatpool" | "lilypool" | "rockpool";

export interface FieldKit {
  name: string;
  /** The three looks the fields take turns with (plotlook.ts keeps neighbours apart). */
  beds: readonly [BedLook, BedLook, BedLook];
  /** The look that sometimes holds a puddle (none: no puddles). */
  puddle?: BedLook;
  barn: BarnLook;
  water: WaterLook;
  /** The farmhouse at the lane's end (sprites.ts's drawFarmhouse). */
  house: "farm" | "fisher" | "thatch" | "longhouse" | "lodge" | "flint";
}

export const BRINDLE_KIT: FieldKit = { name: "farm", beds: ["earth", "stubble", "clover"], puddle: "earth", barn: "barn", water: "pond", house: "farm" };

/** Acts by index (0 Brindle .. 9 Kingsmarket) with a kit of their own; the rest keep the farm's. */
export const FIELD_KITS: Partial<Record<number, FieldKit>> = {
  1: { name: "hill farm", beds: ["oats", "turnips", "inbye"], barn: "fold", water: "peatpool", house: "longhouse" },
  2: { name: "saltmarsh", beds: ["samphire", "lavender", "saltgrass"], barn: "netshed", water: "saltpan", house: "fisher" },
  4: { name: "woodland holding", beds: ["garlic", "litter", "bluebell"], barn: "timberbarn", water: "lilypool", house: "lodge" },
  5: { name: "shingle croft", beds: ["seakale", "lazybed", "thrift"], barn: "boathut", water: "rockpool", house: "flint" },
  3: { name: "water meadow", beds: ["meadow", "swathe", "cress"], barn: "millhouse", water: "willowpond", house: "thatch" },
};

export function actIndex(level: Pick<Level, "id">): number {
  return Math.min(9, Math.max(0, Math.floor((level.id - 1) / 10)));
}

export function kitFor(level: Pick<Level, "id">): FieldKit {
  return FIELD_KITS[actIndex(level)] ?? BRINDLE_KIT;
}

/** The 3D view's bed for a 2D look (the 3D field keeps its three beds for now). */
export function bedBase(look: BedLook | "puddle"): "earth" | "stubble" | "clover" {
  switch (look) {
    case "earth":
    case "puddle":
    case "cress":
    case "lavender":
    case "turnips":
    case "litter":
    case "lazybed":
      return "earth";
    case "stubble":
    case "saltgrass":
    case "meadow":
    case "oats":
    case "bluebell":
    case "seakale":
      return "stubble";
    default:
      return "clover";
  }
}
