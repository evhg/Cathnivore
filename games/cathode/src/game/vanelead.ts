// The clinic register, the lead into act 2: Candor's night register sits in a cabinet in the Clinic Bay, watched
// by two guards and a sniper on the clinic roof. Cath takes it, then makes for the water taxi. It names Vane's
// shift, so the boss job needs it. Closes `vaneLead`.

import * as THREE from "three";
import type { JobHost } from "./firstjob";

export class VaneLeadJob {
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
        this.objective = "Bea traced Candor's night register to a cabinet in the Clinic Bay, east of the quay.";
        this.target = this.P(20, 24).setY(this.h.ground(20, 24) + 0.6);
        h.spawn("rifle", [this.P(18, 22), this.P(22, 26)]);
        h.spawn("shield", [this.P(24, 22), this.P(24, 28)]);
        h.spawn("sniper", [this.P(27, 36)], { passive: true });
        h.say("Bea: Clinic Bay, east side. They log every patient Candor breaks. Two guards, and a rifle on the roof.");
        break;
      case 1:
        this.objective = "Register taken. Get to the water taxi.";
        h.banner("Register recovered", "Candor clinic");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Names, dates, a doctor's initials on every page. O.V.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Register delivered. Bea is tracing the initials.";
        if (!h.progress.jobsDone.includes("vaneLead")) h.progress.jobsDone.push("vaneLead");
        h.progress.save();
        h.banner("Job done", "The clinic register");
        h.say("Bea: Octavia Vane. She works nights in that bay. She will be there tonight.");
        break;
    }
  }

  update(_dt: number): void {
    const near = this.target && this.h.player.pos.distanceTo(this.target) < (this.stage === 0 ? 2.2 : 3);
    if (near) this.goto(this.stage + 1);
  }
}
