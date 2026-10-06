// The permit ledger, the lead into act 3: Pell's signed permits sit in a strongbox on Hollowell Plaza, watched
// by two guards and a sniper on the plaza roofs. Cath takes it, then makes for the water taxi. It names Pell's
// hours, so the boss job needs it. Closes `pellLead`.

import * as THREE from "three";
import type { JobHost } from "./firstjob";

export class PellLeadJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;

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
      case 0:
        this.objective = "Bea traced Pell's signed permits to a strongbox on Hollowell Plaza, east of the quay.";
        this.target = this.P(20, 2).setY(this.h.ground(20, 2) + 0.6);
        h.spawn("rifle", [this.P(18, 0), this.P(22, 4)]);
        h.spawn("shield", [this.P(24, 0), this.P(24, 6)]);
        h.spawn("sniper", [this.P(27, 12)], { passive: true });
        h.say("Bea: Plaza strongbox, behind the dry fountain. Two guards, and a rifle on the steps.");
        break;
      case 1:
        this.objective = "Permits taken. Get to the water taxi.";
        h.banner("Permits recovered", "Hollowell Plaza");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Every Candor crate waved through, and one signature on all of them.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Permits delivered. Bea is checking Pell's diary.";
        if (!h.progress.jobsDone.includes("pellLead")) h.progress.jobsDone.push("pellLead");
        h.progress.save();
        h.banner("Job done", "The permit ledger");
        h.say("Bea: He gives a speech on the steps at midnight. He will be there.");
        break;
    }
  }

  update(_dt: number): void {
    const near = this.target && this.h.player.pos.distanceTo(this.target) < (this.stage === 0 ? 2.2 : 3);
    if (near) this.goto(this.stage + 1);
  }
}
