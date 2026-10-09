// District registry: every walkable place is built by id, so createWorld and travel never hard-code one.

import { buildLevel, type Level } from "../level";
import { buildClinic, CLINIC } from "./clinic";
import { buildPlaza, PLAZA } from "./plaza";
import { buildTower, TOWER } from "./tower";
import { buildVault, VAULT } from "./vault";

export type DistrictId = "market" | "clinic" | "plaza" | "tower" | "vault";

export interface DistrictInfo {
  id: DistrictId;
  name: string;
  act: number;
  build(quality: "phone" | "high" | "ultra"): Level;
}

export const DISTRICTS: readonly DistrictInfo[] = [
  { id: "market", name: "The Drowned Market", act: 1, build: buildLevel },
  { id: "clinic", name: "The Candor Clinic", act: 2, build: buildClinic },
  { id: "plaza", name: "Hollowell Plaza", act: 3, build: buildPlaza },
  { id: "tower", name: "The Board Tower", act: 4, build: buildTower },
  { id: "vault", name: "The Hollow Vault", act: 5, build: buildVault },
];

export function districtInfo(id: string | undefined): DistrictInfo {
  return DISTRICTS.find((d) => d.id === id) ?? DISTRICTS[0]!;
}

export function buildDistrict(id: string | undefined, quality: "phone" | "high" | "ultra"): Level {
  return districtInfo(id).build(quality);
}

/** Footprint of a district's walkable floor, for the map; the market's street is drawn by the zone bands instead. */
export function districtBounds(id: string | undefined): { xMin: number; xMax: number; zMin: number; zMax: number } | undefined {
  const r = (d: { xW: number; xE: number; zN: number; zS: number }) => ({ xMin: d.xW, xMax: d.xE, zMin: d.zN, zMax: d.zS });
  switch (id) {
    case "clinic":
      return r(CLINIC);
    case "plaza":
      return r(PLAZA);
    case "tower":
      return r(TOWER);
    case "vault":
      return r(VAULT);
    default:
      return undefined;
  }
}

/** Named places for each district's map: [label, x, z]. */
export function districtLabels(id: string | undefined): [string, number, number][] {
  switch (id) {
    case "clinic":
      return [["Waiting room", -6, 15], ["Wards", 6, 5], ["Flooded morgue", 6, -16], ["Theatre", 0, -46]];
    case "plaza":
      return [["Tram stop", 0, 48], ["Market awnings", -21, 30], ["Tram", 22, 0], ["Dry fountain", 0, 8], ["Council steps", 0, -36]];
    case "tower":
      return [["Lobby", 0, 36], ["Offices", 0, -14], ["Boardroom", 0, -52]];
    case "vault":
      return [["Gate hall", 0, 44], ["The chasm", 0, 0], ["Vault core", 0, -48]];
    default:
      return [];
  }
}
