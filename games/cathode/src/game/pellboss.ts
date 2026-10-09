// Councillor Marcus Pell, the boss of act 3: he holds the Hollowell Plaza steps behind two shield guards. At
// half health he calls a rifle squad from both flanks and, once, drops his armour for speed (his health stays,
// his reaction time halves). Killing him closes `pellBoss`; then the water taxi.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";

export class PellBossJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  boss: Enemy | null = null;
  private rallied = false;

  constructor(private readonly h: JobHost) {
    this.goto(0);
  }

  /** A level marker if it has one (the plaza steps), else the quay-side fallback coordinates. */
  private M(key: string, i: number, x: number, z: number): THREE.Vector3 {
    return this.h.markers[key]?.[i]?.clone() ?? this.P(x, z);
  }

  private P(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, this.h.ground(x, z), z);
  }

  private goto(stage: number): void {
    const h = this.h;
    this.stage = stage;
    switch (stage) {
      case 0: {
        this.objective = "Councillor Pell holds the plaza steps. Bring him down.";
        const b = h.spawn("shield", [this.M("boss:pell", 0, -24, 34), this.M("boss:pell", 1, -20, 36)]);
        b.hp = b.kit.maxHp = Math.round(b.kit.maxHp * 6);
        b.body.root.scale.setScalar(1.12);
        this.boss = b;
        h.spawn("shield", [this.M("boss:guard", 0, -28, 30), this.M("boss:guard", 1, -28, 38)]);
        h.spawn("shield", [this.M("boss:guard", 2, -18, 30), this.M("boss:guard", 3, -16, 38)]);
        h.banner("Councillor Pell", "Hollowell Plaza", "boss");
        h.say("Bea: Pell hides behind his guards. Break the line, then break him.");
        break;
      }
      case 1:
        this.objective = "Pell is finished. Get to the water taxi.";
        h.banner("Pell is down", "Act 3");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Three names off the list.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Act 3 complete. Hollowell Plaza is quiet.";
        if (!h.progress.jobsDone.includes("pellBoss")) h.progress.jobsDone.push("pellBoss");
        h.progress.save();
        h.banner("Act 3 complete", "Hollowell Plaza");
        h.say("Bea: The Spire is next. The Board.");
        break;
    }
  }

  update(_dt: number): void {
    if (this.stage === 0 && this.boss) {
      this.target = this.boss.position.clone().setY(this.boss.position.y + 2.2);
      if (!this.rallied && this.boss.alive && this.boss.hp < this.boss.kit.maxHp / 2) {
        this.rallied = true;
        this.h.spawn("rifle", [this.M("boss:reinforce", 0, -40, 26), this.M("boss:reinforce", 1, -34, 28)]);
        this.h.spawn("rifle", [this.M("boss:reinforce", 2, -6, 26), this.M("boss:reinforce", 3, -12, 28)]);
        this.h.spawn("rifle", [this.M("boss:reinforce", 4, -24, 20), this.M("boss:reinforce", 5, -20, 22)]);
        // In the plaza the rally turns into an ambush: marksmen open up from both rooftops too.
        for (const perch of this.h.markers["boss:pell"] ? this.h.markers.perch ?? [] : []) this.h.spawn("sniper", [perch.clone()]);
        this.h.say("Pell: Security! Everyone, now!");
      }
      if (!this.boss.alive) this.goto(1);
    } else if (this.stage === 1 && this.target && this.h.player.pos.distanceTo(this.target) < 3) this.goto(2);
  }
}
