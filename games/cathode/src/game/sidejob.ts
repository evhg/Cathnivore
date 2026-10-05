// Ana's late contracts: once the story is closed she keeps pinning marks to the quay board, one after another.
// Each is a kill-and-extract job that grows with every one Cath completes. Recorded as `anaSide:<n>`.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";
import { WINGS, wingAt, type Wing } from "./zones";

const MARKS = ["Dunmore", "Ketch", "Ostler", "Brandt", "Vasco", "Imre", "Teague", "Halloran"];
const SPOTS: [number, number][] = [[0, 48], [-10, 30], [12, 20], [-6, -10], [8, 38]];

/** Quay spots, plus the middle of every wing she has opened (marks hide in the districts she has earned). */
export function sideSpots(jobsDone: readonly string[]): [number, number][] {
  const wings = WINGS.filter((w) => jobsDone.includes(w.needs)).map((w): [number, number] => [14.5, (w.zMin + w.zMax) / 2]);
  return [...SPOTS, ...wings];
}

const WING_MARKS: Record<string, string[]> = {
  clinicBay: ["Nurse Pryce", "Doctor Lund"],
  plazaSteps: ["Alderman Voss", "Clerk Moy"],
  towerLobby: ["Director Hale", "Auditor Sern"],
  vaultGate: ["Warden Kell", "Teller Ibbs"],
};

/** How many contracts she has finished. */
export function sideCount(jobsDone: readonly string[]): number {
  return jobsDone.filter((j) => j.startsWith("anaSide:")).length;
}

export class SideContractJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  readonly markName: string;
  readonly wing: Wing | undefined;
  readonly guards: number;
  private mark: Enemy | null = null;

  constructor(private readonly h: JobHost) {
    const n = sideCount(h.progress.jobsDone);
    const [sx, sz] = sideSpots(h.progress.jobsDone)[n % sideSpots(h.progress.jobsDone).length]!;
    this.wing = wingAt(h.progress.jobsDone, sx, sz);
    const pool = (this.wing && WING_MARKS[this.wing.id]) || MARKS;
    this.markName = pool[n % pool.length]!;
    this.guards = Math.min(5, 1 + Math.floor(n / 2));
    this.goto(0);
  }

  private P(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, this.h.ground(x, z), z);
  }

  private goto(stage: number): void {
    const h = this.h;
    this.stage = stage;
    if (stage === 0) {
      const n = sideCount(h.progress.jobsDone);
      const spots = sideSpots(h.progress.jobsDone);
      const [x, z] = spots[n % spots.length]!;
      const where = this.wing ? this.wing.name : "the quay";
      this.objective = `Ana's contract: ${this.markName} is in ${where}. Remove them.`;
      this.mark = h.spawn("rifle", [this.P(x, z), this.P(x + 2, z - 2)], { passive: true });
      for (let i = 0; i < this.guards; i++) {
        const gx = x + (i % 2 ? 5 : -5) + i;
        h.spawn(i % 3 === 2 ? "shield" : "rifle", [this.P(gx, z + 2), this.P(gx, z - 4)]);
      }
      h.say(this.wing ? `Ana: ${this.markName} hides in ${this.wing.name}. Quietly, if you can.` : `Ana: ${this.markName} again owes Candor. Collect.`);
    } else if (stage === 1) {
      this.objective = `${this.markName} is down. Get to the water taxi.`;
      h.banner("Contract complete", this.markName);
      this.target = h.markers.extract?.[0]?.clone() ?? null;
    } else {
      this.done = true;
      this.target = null;
      this.objective = "Contract paid. Ana will pin another.";
      h.progress.jobsDone.push(`anaSide:${sideCount(h.progress.jobsDone)}`);
      h.progress.save();
      h.banner("Job done", "Ana's contract");
      h.say("Ana: Paid. There's always another name.");
    }
  }

  update(_dt: number): void {
    if (this.stage === 0) {
      if (this.mark) this.target = this.mark.position.clone().setY(this.mark.position.y + 1.9);
      if (this.mark && !this.mark.alive) this.goto(1);
    } else if (this.stage === 1 && this.target && this.h.player.pos.distanceTo(this.target) < 3) this.goto(2);
  }
}
