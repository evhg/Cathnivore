// Julian Crisp, the boss of act 1: he waits at the north end of the quay behind a shield line. At half health he
// calls his men in from the street. Killing him closes `crispBoss`; then the water taxi.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";

export class CrispBossJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  boss: Enemy | null = null;
  private called = false;

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
        this.objective = "Julian Crisp is on the north quay. End him.";
        const b = h.spawn("shield", [this.P(0, 50), this.P(3, 48)]);
        b.hp = b.kit.maxHp = Math.round(b.kit.maxHp * 4);
        b.body.root.scale.setScalar(1.15);
        this.boss = b;
        h.spawn("rifle", [this.P(-5, 46), this.P(-5, 52)]);
        h.spawn("shield", [this.P(6, 52), this.P(6, 45)]);
        h.banner("Julian Crisp", "Candor's man on the quay", "boss");
        h.say("Bea: That is Crisp. He does not run. Make him.");
        break;
      }
      case 1:
        this.objective = "Crisp is finished. Get to the water taxi.";
        h.banner("Crisp is down", "Act 1");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: One name off the list. Bea, we are coming in.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Act 1 complete. The Drowned Market is yours.";
        if (!h.progress.jobsDone.includes("crispBoss")) h.progress.jobsDone.push("crispBoss");
        h.progress.save();
        h.banner("Act 1 complete", "The Drowned Market");
        h.say("Bea: Vane next. The Candor clinic. Get some sleep.");
        break;
    }
  }

  update(_dt: number): void {
    if (this.stage === 0 && this.boss) {
      this.target = this.boss.position.clone().setY(this.boss.position.y + 2.2);
      if (!this.called && this.boss.alive && this.boss.hp < this.boss.kit.maxHp / 2) {
        this.called = true;
        this.h.spawn("rifle", [this.P(-8, 38), this.P(-2, 40)]);
        this.h.spawn("rifle", [this.P(8, 38), this.P(2, 40)]);
        this.h.say("Crisp: Men! To me!");
      }
      if (!this.boss.alive) this.goto(1);
    } else if (this.stage === 1 && this.target && this.h.player.pos.distanceTo(this.target) < 3) this.goto(2);
  }
}
