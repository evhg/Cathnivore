// Dr Octavia Vane, the boss of act 2: she works from a clinic bay at the east end of the quay behind a chrome
// guard. At half health she patches herself once (back to 70%) and calls two more guards. Killing her closes
// `vaneBoss`; then the water taxi.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";

export class VaneBossJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  boss: Enemy | null = null;
  private patched = false;

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
        this.objective = "Dr Octavia Vane is in the clinic bay. End her.";
        const b = h.spawn("rifle", [this.P(22, 30), this.P(25, 28)]);
        b.hp = b.kit.maxHp = Math.round(b.kit.maxHp * 5);
        b.body.root.scale.setScalar(1.1);
        this.boss = b;
        h.spawn("shield", [this.P(18, 32), this.P(18, 26)]);
        h.spawn("rifle", [this.P(28, 34), this.P(24, 36)]);
        h.banner("Dr Octavia Vane", "Candor's surgeon");
        h.say("Bea: Vane stitches herself back together. Hit her hard and fast.");
        break;
      }
      case 1:
        this.objective = "Vane is finished. Get to the water taxi.";
        h.banner("Vane is down", "Act 2");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Two names off the list.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Act 2 complete. The Candor clinic is closed.";
        if (!h.progress.jobsDone.includes("vaneBoss")) h.progress.jobsDone.push("vaneBoss");
        h.progress.save();
        h.banner("Act 2 complete", "The Candor clinic");
        h.say("Bea: Pell next. Hollowell Plaza.");
        break;
    }
  }

  update(_dt: number): void {
    if (this.stage === 0 && this.boss) {
      this.target = this.boss.position.clone().setY(this.boss.position.y + 2.2);
      if (!this.patched && this.boss.alive && this.boss.hp < this.boss.kit.maxHp / 2) {
        this.patched = true;
        this.boss.hp = Math.round(this.boss.kit.maxHp * 0.7);
        this.h.spawn("rifle", [this.P(16, 22), this.P(22, 22)]);
        this.h.spawn("rifle", [this.P(30, 22), this.P(26, 24)]);
        this.h.say("Vane: A little stitch. Nothing personal.");
      }
      if (!this.boss.alive) this.goto(1);
    } else if (this.stage === 1 && this.target && this.h.player.pos.distanceTo(this.target) < 3) this.goto(2);
  }
}
