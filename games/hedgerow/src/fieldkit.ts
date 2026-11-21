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
  // The Rift: agribusiness at the edge: oilseed rape, sugar beet, a fallow strip gone to ragwort.
  | "rape"
  | "beet"
  | "fallow"
  // The Ballot: the village allotments: bean canes, sweet peas on pea sticks, show marrows.
  | "allotment"
  | "sweetpea"
  | "marrow"
  // The Merger: the takeover's growing: polytunnels, a lettuce grid, a turf farm.
  | "polytunnel"
  | "lettuce"
  | "turf"
  // Kingsmarket: the market garden: red and green salad rows, forced rhubarb, strawberries in straw.
  | "salad"
  | "rhubarb"
  | "strawberry"
  // Rivermead: water-meadow strips with their drains, a hay meadow mown into swathes, a watercress bed (no trees: an orchard reads as item 43's unbuildable orchard landmark).
  | "meadow"
  | "swathe"
  | "cress";

/** The building on a barn's cell. */
export type BarnLook = "barn" | "netshed" | "millhouse" | "fold" | "timberbarn" | "boathut" | "dutchbarn" | "marquee" | "warehouse" | "granary";
/** A water plot: a round farm pond, a salt pan, a willow-ringed pond. */
export type WaterLook = "pond" | "saltpan" | "willowpond" | "peatpool" | "lilypool" | "rockpool" | "gravelpit" | "duckpond" | "lagoon" | "basin";

export type KnollDress = "rocks" | "marram" | "willow" | "bracken" | "pebbles" | "spoil" | "daisies" | "sprinkler" | "path";

export interface FieldKit {
  name: string;
  /** The three looks the fields take turns with (plotlook.ts keeps neighbours apart). */
  beds: readonly [BedLook, BedLook, BedLook];
  /**
   * Plan item 621: two margin beds borrowed from a neighbouring country's kit, so a level's farm reads as 5+ crops,
   * not three repeating ones. They are sown after the act's own three (plotlook.ts), so the act's beds still lead.
   */
  margins: readonly [BedLook, BedLook];
  /** The look that sometimes holds a puddle (none: no puddles). */
  puddle?: BedLook;
  barn: BarnLook;
  water: WaterLook;
  /** High ground: the mound's colours (top, foot, contour) and what grows or lies on it; the trig pillar stays. */
  knoll: { top: string; foot: string; contour: string; dress?: KnollDress };
  /** The farmhouse at the lane's end (sprites.ts's drawFarmhouse). */
  house: "farm" | "fisher" | "thatch" | "longhouse" | "lodge" | "flint" | "bungalow" | "rectory" | "showhome" | "townhouse";
}

export const BRINDLE_KIT: FieldKit = { name: "farm", beds: ["earth", "stubble", "clover"], margins: ["oats", "turnips"], puddle: "earth", barn: "barn", water: "pond", house: "farm", knoll: { top: "rgb(150,176,92)", foot: "rgb(92,120,56)", contour: "rgba(60,80,30,0.45)" } };

/** Acts by index (0 Brindle .. 9 Kingsmarket) with a kit of their own; the rest keep the farm's. */
export const FIELD_KITS: Partial<Record<number, FieldKit>> = {
  1: { name: "hill farm", beds: ["oats", "turnips", "inbye"], margins: ["stubble", "meadow"], barn: "fold", water: "peatpool", house: "longhouse", knoll: { top: "rgb(160,150,120)", foot: "rgb(110,100,84)", contour: "rgba(70,60,46,0.45)", dress: "rocks" } },
  2: { name: "saltmarsh", beds: ["samphire", "lavender", "saltgrass"], margins: ["thrift", "seakale"], barn: "netshed", water: "saltpan", house: "fisher", knoll: { top: "rgb(222,212,160)", foot: "rgb(132,156,100)", contour: "rgba(110,120,70,0.45)", dress: "marram" } },
  3: { name: "water meadow", beds: ["meadow", "swathe", "cress"], margins: ["clover", "garlic"], barn: "millhouse", water: "willowpond", house: "thatch", knoll: { top: "rgb(140,186,96)", foot: "rgb(90,140,64)", contour: "rgba(50,90,40,0.45)", dress: "willow" } },
  4: { name: "woodland holding", beds: ["garlic", "litter", "bluebell"], margins: ["inbye", "swathe"], barn: "timberbarn", water: "lilypool", house: "lodge", knoll: { top: "rgb(120,150,74)", foot: "rgb(74,100,48)", contour: "rgba(50,70,30,0.45)", dress: "bracken" } },
  5: { name: "shingle croft", beds: ["seakale", "lazybed", "thrift"], margins: ["saltgrass", "samphire"], barn: "boathut", water: "rockpool", house: "flint", knoll: { top: "rgb(190,186,174)", foot: "rgb(146,142,132)", contour: "rgba(96,92,84,0.45)", dress: "pebbles" } },
  6: { name: "agribusiness", beds: ["rape", "beet", "fallow"], margins: ["stubble", "lettuce"], barn: "dutchbarn", water: "gravelpit", house: "bungalow", knoll: { top: "rgb(140,124,100)", foot: "rgb(100,88,72)", contour: "rgba(60,50,40,0.45)", dress: "spoil" } },
  7: { name: "allotments", beds: ["allotment", "sweetpea", "marrow"], margins: ["salad", "strawberry"], barn: "marquee", water: "duckpond", house: "rectory", knoll: { top: "rgb(156,190,100)", foot: "rgb(104,140,64)", contour: "rgba(60,90,36,0.45)", dress: "daisies" } },
  8: { name: "agri-tech", beds: ["polytunnel", "lettuce", "turf"], margins: ["beet", "rape"], barn: "warehouse", water: "lagoon", house: "showhome", knoll: { top: "rgb(120,186,96)", foot: "rgb(84,150,70)", contour: "rgba(40,90,40,0.45)", dress: "sprinkler" } },
  9: { name: "market garden", beds: ["salad", "rhubarb", "strawberry"], margins: ["allotment", "sweetpea"], barn: "granary", water: "basin", house: "townhouse", knoll: { top: "rgb(160,170,96)", foot: "rgb(112,124,64)", contour: "rgba(70,80,36,0.45)", dress: "path" } },
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
    case "beet":
    case "allotment":
    case "lettuce":
    case "rhubarb":
      return "earth";
    case "stubble":
    case "saltgrass":
    case "meadow":
    case "oats":
    case "bluebell":
    case "seakale":
    case "rape":
    case "marrow":
    case "polytunnel":
    case "strawberry":
      return "stubble";
    default:
      return "clover";
  }
}
