// Plan item 7 (2026-11-01): where each district's scripted entrances happen. Data only, so the unit tests
// (`tests/cathode-entrances.test.ts`) check every one against the district's colliders: a rope that hangs from a real
// ceiling or roof edge, a van with a clear road that misses the standing crowds, a breach out of a real gap in a
// wall. Each lands about 8 to 20 m from where she stands when it fires (the objective she just took, or the boss),
// so she sees it happen. Each entry is in district metres:
//   rappel: from = the rope's anchor (over the landing, at the ceiling's or roof's height), to = where he lands;
//   breach: from = the door in its gap, to = his first step through it;
//   van:    from = where the van starts its run, stop = where it brakes, to = where he climbs out to.

import * as THREE from "three";
import type { EntranceKind, EntranceSpec } from "./entrance";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface Entry {
  kind: EntranceKind;
  from: THREE.Vector3;
  to: THREE.Vector3;
  stop?: THREE.Vector3;
  /** A breach through a wide gap blows two leaves (m, the gap's width). */
  doorW?: number;
  delay?: number;
  trigger?: number;
}

/** The encounters per district: the lead job's alarm and the boss fight's reinforcements, two at least each. */
export const ENTRIES = {
  market: {
    // The first job's flyover pair (S7.1 stage 3): one down a rope off the north parapet, one out of a van that
    // brakes in under the deck from the flooded south road.
    flyoverRope: { kind: "rappel", from: V(-4, 10.4, 13.9), to: V(-4, 0, 13.9) },
    flyoverVan: { kind: "van", from: V(2.4, 0, -16), stop: V(2.4, 0, 8.6), to: V(3.8, 0, 10.6), delay: 0.8 },
  },
  clinic: {
    // The blackout ambush in the east ward: the roof team drops through a ceiling vent, and a second man blows the
    // ward's double doors (bay 5) behind her.
    ambushVent: { kind: "rappel", from: V(5, 3.6, -22), to: V(5, 0, -22) },
    ambushBreach: { kind: "breach", from: V(3.2, 0, -6), to: V(4.8, 0, -6), doorW: 3.8, delay: 1.2 },
    // Vane's stitch: one through the STAFF ONLY doors (bay 3), one down from the ceiling over the theatre doors.
    bossBreach: { kind: "breach", from: V(-3.2, 0, -22), to: V(-1.6, 0, -22), doorW: 3.8 },
    bossVent: { kind: "rappel", from: V(2, 3.6, -30), to: V(2, 0, -30), delay: 0.9 },
  },
  plaza: {
    // The strongbox alarm: a Hollowell van tears up the west side of the square; a second man ropes off the
    // roof of the west block (its parapet at 12 m), in plain sight of the strongbox.
    alarmVan: { kind: "van", from: V(-14.5, 0, 1), stop: V(-14.5, 0, 13.5), to: V(-17, 0, 14.5) },
    alarmRope: { kind: "rappel", from: V(-29.2, 12, 41.5), to: V(-29.2, 0, 41.5), delay: 1.5 },
    // Pell's rally detail: a van down the east side of the fountain, a man off the front of the hall's portico roof.
    bossVan: { kind: "van", from: V(10.5, 0, 20), stop: V(10.5, 0, -1), to: V(8.4, 0, -1.6) },
    bossRope: { kind: "rappel", from: V(-2, 9.4, -45.6), to: V(-2, 2.4, -45.6), delay: 1.2 },
  },
  tower: {
    // The courier safe's alarm: two security men rope down the lobby atrium, one after the other.
    alarmRopeA: { kind: "rappel", from: V(1, 14.1, 31.5), to: V(1, 0, 31.5) },
    alarmRopeB: { kind: "rappel", from: V(5, 14.1, 24), to: V(5, 0, 24), delay: 0.7 },
    // The boardroom: the chairman's detail drops from the ceiling vents either side of the table.
    bossVentL: { kind: "rappel", from: V(-7, 14.1, -46), to: V(-7, 9.1, -46) },
    bossVentR: { kind: "rappel", from: V(7, 14.1, -46), to: V(7, 9.1, -46), delay: 0.6 },
  },
  vault: {
    // The ledger alarm: the lift behind her opens on a breach team; a second man drops off the gate gantry.
    alarmLift: { kind: "breach", from: V(1, 0, 55.2), to: V(1, 0, 52.6), doorW: 4.4 },
    alarmRope: { kind: "rappel", from: V(-2, 18, 31), to: V(-2, 0, 31), delay: 1.0 },
    // The core: Hollowell drops two men down the chasm on lines.
    bossRopeL: { kind: "rappel", from: V(-8, 18, -38), to: V(-8, 0, -38) },
    bossRopeR: { kind: "rappel", from: V(8, 18, -38), to: V(8, 0, -38), delay: 0.8 },
  },
} satisfies Record<string, Record<string, Entry>>;

/** The spawn options for an entry: his route starts where he lands, then runs on through `then`. */
export function entryRoute(e: Entry, then: THREE.Vector3[] = []): { route: THREE.Vector3[]; entrance: EntranceSpec } {
  return {
    route: [e.to.clone(), ...then.map((p) => p.clone())],
    entrance: { kind: e.kind, from: e.from.clone(), stop: e.stop?.clone(), delay: e.delay, trigger: e.trigger, doorW: e.doorW },
  };
}

/** Spawns `role` coming in by `e` (the job's own host spawn), then on along `then`. */
export function enter<T>(spawn: (role: "rifle" | "shield" | "sniper", route: THREE.Vector3[], opts?: { entrance?: EntranceSpec }) => T, role: "rifle" | "shield" | "sniper", e: Entry, then: THREE.Vector3[] = []): T {
  const { route, entrance } = entryRoute(e, then);
  return spawn(role, route, { entrance });
}
