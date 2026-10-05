// HollowCandor, the boss of act 5: the company's vault intelligence, a 9x-health shield-role body in the vault
// with two shield guards. At two thirds health it calls a rifle squad, at one third a sniper and more rifles.
// Killing it closes `vaultBoss` and opens Hardboiled (the `hardboiledOpen` flag); then the vault lift.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";
import { actFiveUnlock } from "../sim/difficulty";

export class VaultBossJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  boss: Enemy | null = null;
  private rallied = 0;

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
        this.objective = "HollowCandor runs the vault. Pull the plug.";
        const b = h.spawn("shield", [this.P(-24, 34), this.P(-20, 36)]);
        b.hp = b.kit.maxHp = Math.round(b.kit.maxHp * 9);
        b.body.root.scale.setScalar(1.2);
        this.boss = b;
        h.spawn("shield", [this.P(-28, 30), this.P(-28, 38)]);
        h.spawn("shield", [this.P(-18, 30), this.P(-16, 38)]);
        h.spawn("sniper", [this.P(-24, 44), this.P(-18, 44)]);
        h.banner("HollowCandor", "The vault");
        h.say("Bea: It is not a man, it is the building. Break the guards, then break it.");
        break;
      }
      case 1:
        this.objective = "HollowCandor is silent. Take the vault lift.";
        h.banner("HollowCandor is down", "Act 5");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Five off the list. All of them.");
        break;
      case 2: {
        this.done = true;
        this.target = null;
        this.objective = "Act 5 complete. Candor is dark.";
        const next = actFiveUnlock(h.progress.character?.difficulty ?? "noir");
        for (const id of next ? ["vaultBoss", "hardboiledOpen", next] : ["vaultBoss", "hardboiledOpen"]) if (!h.progress.jobsDone.includes(id)) h.progress.jobsDone.push(id);
        h.progress.save();
        h.banner("Act 5 complete", next === "hellWeekOpen" ? "Hell Week unlocked" : "Hardboiled unlocked");
        h.say("Bea: It is over. Or it starts again, harder. Your call.");
        break;
      }
    }
  }

  update(_dt: number): void {
    if (this.stage === 0 && this.boss) {
      this.target = this.boss.position.clone().setY(this.boss.position.y + 2.2);
      const frac = this.boss.hp / this.boss.kit.maxHp;
      if (this.boss.alive && this.rallied < 1 && frac < 2 / 3) {
        this.rallied = 1;
        this.h.spawn("rifle", [this.P(-40, 26), this.P(-34, 28)]);
        this.h.spawn("rifle", [this.P(-6, 26), this.P(-12, 28)]);
        this.h.say("HollowCandor: Security response initiated.");
      }
      if (this.boss.alive && this.rallied < 2 && frac < 1 / 3) {
        this.rallied = 2;
        this.h.spawn("sniper", [this.P(-30, 44), this.P(-14, 44)]);
        this.h.spawn("rifle", [this.P(-24, 20), this.P(-20, 22)]);
        this.h.spawn("rifle", [this.P(-30, 22), this.P(-16, 22)]);
        this.h.say("HollowCandor: Escalating. Escalating.");
      }
      if (!this.boss.alive) this.goto(1);
    } else if (this.stage === 1 && this.target && this.h.player.pos.distanceTo(this.target) < 3) this.goto(2);
  }
}
