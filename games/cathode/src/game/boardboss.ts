// the Chair of the Candor Board, the boss of act 4: she holds the top of the Spire behind two shield guards
// with a sniper on the balcony. At half health the Board calls a rifle squad from both stairwells. Killing her
// closes `boardBoss`; then the roof taxi.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";

export class BoardBossJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  boss: Enemy | null = null;
  private rallied = false;

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
        this.objective = "The Chair of the Board holds the Spire's top floor. Bring her down.";
        const b = h.spawn("shield", [this.P(-24, 34), this.P(-20, 36)]);
        b.hp = b.kit.maxHp = Math.round(b.kit.maxHp * 6);
        b.body.root.scale.setScalar(1.12);
        this.boss = b;
        h.spawn("shield", [this.P(-28, 30), this.P(-28, 38)]);
        h.spawn("shield", [this.P(-18, 30), this.P(-16, 38)]);
        h.spawn("sniper", [this.P(-24, 44), this.P(-18, 44)]);
        h.banner("The Chair of the Board", "The Spire");
        h.say("Bea: The Chair hides behind her guards, with a sniper above. Break the line, then break her.");
        break;
      }
      case 1:
        this.objective = "The Chair is finished. Get to the roof taxi.";
        h.banner("The Chair is down", "Act 4");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Four names off the list.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Act 4 complete. The Spire is dark.";
        if (!h.progress.jobsDone.includes("boardBoss")) h.progress.jobsDone.push("boardBoss");
        h.progress.save();
        h.banner("Act 4 complete", "The Spire");
        h.say("Bea: One door left. The vault. HollowCandor.");
        break;
    }
  }

  update(_dt: number): void {
    if (this.stage === 0 && this.boss) {
      this.target = this.boss.position.clone().setY(this.boss.position.y + 2.2);
      if (!this.rallied && this.boss.alive && this.boss.hp < this.boss.kit.maxHp / 2) {
        this.rallied = true;
        this.h.spawn("rifle", [this.P(-40, 26), this.P(-34, 28)]);
        this.h.spawn("rifle", [this.P(-6, 26), this.P(-12, 28)]);
        this.h.spawn("rifle", [this.P(-24, 20), this.P(-20, 22)]);
        this.h.say("The Chair: Security! Everyone, now!");
      }
      if (!this.boss.alive) this.goto(1);
    } else if (this.stage === 1 && this.target && this.h.player.pos.distanceTo(this.target) < 3) this.goto(2);
  }
}
