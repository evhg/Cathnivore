// District registry: every walkable place is built by id, so createWorld and travel never hard-code one.

import { buildLevel, type Level } from "../level";
import { buildClinic } from "./clinic";

export type DistrictId = "market" | "clinic";

export interface DistrictInfo {
  id: DistrictId;
  name: string;
  act: number;
  build(quality: "phone" | "high" | "ultra"): Level;
}

export const DISTRICTS: readonly DistrictInfo[] = [
  { id: "market", name: "The Drowned Market", act: 1, build: buildLevel },
  { id: "clinic", name: "The Candor Clinic", act: 2, build: buildClinic },
];

export function districtInfo(id: string | undefined): DistrictInfo {
  return DISTRICTS.find((d) => d.id === id) ?? DISTRICTS[0]!;
}

export function buildDistrict(id: string | undefined, quality: "phone" | "high" | "ultra"): Level {
  return districtInfo(id).build(quality);
}
