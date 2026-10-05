// The weekly Most Wanted: a seeded target (`sim/mostwanted.ts`) with its guards and snipers on the north quay,
// the same for everyone that week. Killing the target closes `mostWanted:<week>`; it opens on Hardboiled.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";
import type { MostWanted } from "../sim/mostwanted";

export class MostWantedJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  boss: Enemy | null = null;

  constructor(
    private readonly h: JobHost,
    private readonly contract: MostWanted,
  ) {
    const c = contract;
    this.objective = `Most Wanted: ${c.name}, ${c.alias}.`;
    const b = h.spawn("shield", [this.P(-6, 40), this.P(0, 42)]);
    b.hp = b.kit.maxHp = Math.round(b.kit.maxHp * (2 + c.levelBump * 0.25));
    b.body.root.scale.setScalar(1.1);
    this.boss = b;
    for (let i = 0; i < c.guards; i++)
      h.spawn("rifle", [this.P(-12 + i * 5, 34), this.P(-10 + i * 5, 46)]);
    for (let i = 0; i < c.snipers; i++)
      h.spawn("sniper", [this.P(-14 + i * 12, 50), this.P(-8 + i * 12, 50)]);
    h.banner("Most Wanted", `${c.name}, ${c.alias}`);
    h.say(
      `Bea: This week's bounty. ${c.name}. Everyone is hunting ${c.alias}.`,
    );
  }

  private P(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, this.h.ground(x, z), z);
  }

  update(_dt: number): void {
    if (this.done || !this.boss) return;
    this.target = this.boss.position.clone().setY(this.boss.position.y + 2.2);
    if (!this.boss.alive) {
      this.done = true;
      this.target = null;
      this.objective = `${this.contract.name} is down. The bounty is paid.`;
      const flag = `mostWanted:${this.contract.week}`;
      if (!this.h.progress.jobsDone.includes(flag))
        this.h.progress.jobsDone.push(flag);
      this.h.progress.save();
      this.h.banner("Bounty paid", this.contract.alias);
    }
  }
}
