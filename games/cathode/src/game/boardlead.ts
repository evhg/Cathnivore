// The visitor pass, the lead into act 4: a Board courier's keycard sits in a lobby safe in the Board Tower, watched
// by two guards and a sniper on the mezzanine. Cath takes it, then makes for the water taxi. It opens the Spire
// lift, so the boss job needs it. Closes `boardLead`.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";

export class BoardLeadJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  private captors: Enemy[] = [];

  constructor(private readonly h: JobHost) {
    this.goto(0);
  }

  private P(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, this.h.ground(x, z), z);
  }

  private M(key: string, i: number, x: number, z: number): THREE.Vector3 {
    return this.h.markers[key]?.[i]?.clone() ?? this.P(x, z);
  }

  private get inTower(): boolean {
    return !!this.h.markers["lead:register"];
  }

  private goto(stage: number): void {
    const h = this.h;
    this.stage = stage;
    switch (stage) {
      case 0:
        this.objective = this.inTower
          ? "A courier's Spire keycard is in the lobby safe, east of the marble desk. Take it."
          : "Bea traced a courier's Spire keycard to a lobby safe in the Board Tower, east of the quay.";
        this.target = this.M("lead:register", 0, 20, -30);
        this.target.y += 0.6;
        h.spawn("rifle", [this.M("lead:guard", 0, 18, -32), this.M("lead:guard", 1, 22, -28)]);
        h.spawn("shield", [this.M("lead:guard", 2, 24, -32), this.M("lead:guard", 3, 24, -26)]);
        h.spawn("sniper", [this.M("lead:sniper", 0, 27, -22)], { passive: true });
        h.say("Bea: Lobby safe, behind the marble desk. Two guards, and a rifle on the mezzanine.");
        break;
      case 1:
        if (this.inTower) {
          // The keycard rides the private lift: the climb is the way on, so no taxi run.
          // Set piece: the courier who owned the pass is held at the private lift. Free her to ride up.
          h.banner("Keycard recovered", "The Board Tower");
          h.say("Bea: The courier is at the private lift, and three of Candor's men have her. No shots near her, Cath.");
          h.sting?.();
          this.target = null;
          this.objective = "A courier is held at the private lift. Down the three captors to free her.";
          const at = this.M("lead:guard", 0, 18, -32);
          this.captors = [
            h.spawn("rifle", [this.M("lead:guard", 1, 22, -28), at]),
            h.spawn("rifle", [this.M("lead:guard", 2, 24, -32), at]),
            h.spawn("shield", [this.M("lead:guard", 3, 24, -26), at]),
          ];
          return;
        }
        this.objective = "Keycard taken. Get to the water taxi.";
        h.banner("Keycard recovered", "The Board Tower");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: A courier's pass. It rides the private lift to the very top.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = this.inTower
          ? "Keycard taken. Climb the grand stairs to the boardroom, north end, two floors up."
          : "Keycard delivered. Bea is wiring it to the Spire lift.";
        if (!h.progress.jobsDone.includes("boardLead")) h.progress.jobsDone.push("boardLead");
        h.progress.save();
        if (!this.inTower) h.banner("Job done", "The visitor pass");
        if (!this.inTower) h.say("Bea: The lift will take you to the Chair. Go when you are ready.");
        break;
    }
  }

  update(_dt: number): void {
    if (this.inTower && this.stage === 1) {
      if (this.captors.length > 0 && this.captors.every((e) => !e.alive)) {
        this.h.say("Cath: You're safe. Thank you. Now, the lift. Two floors up, the boardroom.");
        this.goto(2);
      }
      return;
    }
    const near = this.target && this.h.player.pos.distanceTo(this.target) < (this.stage === 0 ? 2.2 : 3);
    if (near) this.goto(this.stage + 1);
  }
}
