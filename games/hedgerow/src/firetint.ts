// Plan item 676: one tint per tower for its muzzle puff and shot trail, shared by the 2D and 3D battlefields.

import type { TowerKind } from "./engine";

/** How long a muzzle puff hangs about a tower that fired, in seconds: long enough that a still frame shows the fight. */
export const PUFF = 1.1;

/** The colour of a tower's muzzle puff and shot trail: straw dust, seed-cannon smoke, silo glare, pond spray, honey. */
export function fireTint(kind: TowerKind, spec: 0 | 1 | null): string {
  switch (kind) {
    case "cannon":
      return "#d9d2c6";
    case "silo":
      return "#ffe9a8";
    case "pond":
      return "#d6eef7";
    case "beehive":
      return "#ffe08a";
    case "scarecrow":
      return spec === 0 ? "#f6c48a" : "#f3e6b8";
    default:
      return "#f4f1ea";
  }
}
