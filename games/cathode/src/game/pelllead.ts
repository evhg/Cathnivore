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

  /** A level marker if it has one (Hollowell Plaza), else the quay-side fallback coordinates. */
  private M(key: string, i: number, x: number, z: number): THREE.Vector3 {
    return this.h.markers[key]?.[i]?.clone() ?? this.P(x, z);
  }

  private get inPlaza(): boolean {
    return !!this.h.markers["lead:register"];
  }

  private goto(stage: number): void {
    const h = this.h;
    this.stage = stage;
    switch (stage) {
      case 0:
        this.objective = this.inPlaza
          ? "Pell's signed permits are in a strongbox at the back of the market awnings. Take them."
          : "Bea traced Pell's signed permits to a strongbox on Hollowell Plaza, east of the quay.";
        this.target = this.M("lead:register", 0, 20, 2);
        this.target.y += 0.6;
        h.spawn("rifle", [this.M("lead:guard", 0, 18, 0), this.M("lead:guard", 1, 22, 4)]);
        h.spawn("shield", [this.M("lead:guard", 2, 24, 0), this.M("lead:guard", 3, 24, 6)]);
        h.spawn("sniper", [this.M("lead:sniper", 0, 27, 12)], { passive: true });
        h.say("Bea: Plaza strongbox, behind the dry fountain. Two guards, and a rifle on the steps.");
        break;
      case 1:
        if (this.inPlaza) {
          // Pell's rally on the steps is the way on: the permits name his hours, so no taxi run.
          h.banner("Permits recovered", "Hollowell Plaza");
          h.say("Cath: One signature on every crate. Marcus Pell. And he's on the steps tonight.");
          this.goto(2);
          return;
        }
        this.objective = "Permits taken. Get to the water taxi.";
        h.banner("Permits recovered", "Hollowell Plaza");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Every Candor crate waved through, and one signature on all of them.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = this.inPlaza
          ? "Permits taken. Pell is giving his rally on the council steps, north end of the square."
          : "Permits delivered. Bea is checking Pell's diary.";
        if (!h.progress.jobsDone.includes("pellLead")) h.progress.jobsDone.push("pellLead");
        h.progress.save();
        if (!this.inPlaza) h.banner("Job done", "The permit ledger");
        if (!this.inPlaza) h.say("Bea: He gives a speech on the steps at midnight. He will be there.");
        break;
    }
  }

  update(_dt: number): void {
    const near = this.target && this.h.player.pos.distanceTo(this.target) < (this.stage === 0 ? 2.2 : 3);
    if (near) this.goto(this.stage + 1);
  }
}
