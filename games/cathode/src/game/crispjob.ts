// Crisp's ledger, the second job: the lead the case board pins after the Fish Market. Bea has found the
// berth; Crisp's ledger is in a case on the walkway. Lifting it wakes his men, who come down the street
// behind her while she makes for the water taxi.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import { Case, type JobHost } from "./firstjob";

export class CrispJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  private pickup: Case | null = null;
  private wave: Enemy[] = [];

  constructor(private readonly h: JobHost) {
    this.goto(0);
  }

  private P(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, this.h.ground(x, z), z);
  }

  private goto(stage: number): void {
    const h = this.h;
    this.stage = stage;
    switch (stage) {
      case 0: {
        this.objective = "Crisp's ledger is in a case on the walkway. Take the stairs.";
        const at = (h.markers.perch?.[0] ?? this.P(-9.2, 30)).clone().add(new THREE.Vector3(0.6, 0, 1.5));
        this.pickup = new Case(at, h.scene, h.light);
        this.target = this.pickup.pos;
        h.say("Bea: Crisp's berth is on the quay. His ledger sits in a case on that walkway.");
        break;
      }
      case 1: {
        this.pickup?.remove();
        this.pickup = null;
        this.objective = "Crisp's men are coming. Get the ledger to the water taxi.";
        h.banner("Ledger taken", "Crisp's men are awake");
        // They arrive from the north end, behind her, hunting.
        this.wave = [
          h.spawn("rifle", [this.P(-3, 40), this.P(-3, 20)]),
          h.spawn("rifle", [this.P(1, 44), this.P(-1, 22)]),
          h.spawn("shield", [this.P(-2, 52), this.P(-2, 26)]),
        ];
        for (const e of this.wave) e.passive = false;
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Heavy. Let's not be here when he notices.");
        break;
      }
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Job done. The ledger names Crisp's berth and a buyer: Candor.";
        if (!h.progress.jobsDone.includes("crispLead")) h.progress.jobsDone.push("crispLead");
        h.progress.save();
        h.banner("Job done", "Julian Crisp");
        h.say("Bea: Crisp sold Tomas out to Candor. Ana will want to hear this.");
        break;
    }
  }

  update(dt: number): void {
    this.pickup?.update(dt);
    const p = this.h.player.pos;
    if (this.stage === 0 && this.pickup && p.distanceTo(this.pickup.pos) < 1.4) this.goto(1);
    else if (this.stage === 1 && this.target && p.distanceTo(this.target) < 3) this.goto(2);
  }
}
