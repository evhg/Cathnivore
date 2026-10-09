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

  /** A level marker if it has one (the clinic ward), else the quay-side fallback coordinates. */
  private M(key: string, i: number, x: number, z: number): THREE.Vector3 {
    return this.h.markers[key]?.[i]?.clone() ?? this.P(x, z);
  }

  private get inClinic(): boolean {
    return !!this.h.markers["lead:register"];
  }

  private goto(stage: number): void {
    const h = this.h;
    this.stage = stage;
    switch (stage) {
      case 0:
        this.objective = this.inClinic
          ? "Candor's night register is in a cabinet in the east ward. Take it before Vane's shift."
          : "Bea traced Candor's night register to a cabinet in the Clinic Bay, east of the quay.";
        this.target = this.M("lead:register", 0, 20, 24);
        this.target.y += 0.6;
        h.spawn("rifle", [this.M("lead:guard", 0, 18, 22), this.M("lead:guard", 1, 22, 26)]);
        h.spawn("shield", [this.M("lead:guard", 2, 24, 22), this.M("lead:guard", 3, 24, 28)]);
        if (!this.inClinic) h.spawn("sniper", [this.P(27, 36)], { passive: true });
        h.say("Bea: Clinic Bay, east side. They log every patient Candor breaks. Two guards, and a rifle on the roof.");
        break;
      case 1:
        if (this.inClinic) {
          // Vane's theatre is the way on: the register names her shift, so no taxi run.
          h.banner("Register recovered", "Candor clinic");
          h.say("Cath: Names, dates, a doctor's initials on every page. O.V. She's in the theatre.");
          this.goto(2);
          return;
        }
        this.objective = "Register taken. Get to the water taxi.";
        h.banner("Register recovered", "Candor clinic");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Names, dates, a doctor's initials on every page. O.V.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = this.inClinic
          ? "Register taken. Find Dr Vane in her theatre, north end of the clinic."
          : "Register delivered. Bea is tracing the initials.";
        if (!h.progress.jobsDone.includes("vaneLead")) h.progress.jobsDone.push("vaneLead");
        h.progress.save();
        if (!this.inClinic) h.banner("Job done", "The clinic register");
        if (!this.inClinic) h.say("Bea: Octavia Vane. She works nights in that bay. She will be there tonight.");
        break;
    }
  }

  update(_dt: number): void {
    const near = this.target && this.h.player.pos.distanceTo(this.target) < (this.stage === 0 ? 2.2 : 3);
    if (near) this.goto(this.stage + 1);
  }
}
