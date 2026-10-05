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
  /** Bullet-time is jammed while the target lives (the noFocus twist). */
  get focusJammed(): boolean {
    return this.contract.twist === "noFocus" && !this.done;
  }

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
    const crew = [b];
    for (let i = 0; i < c.guards; i++)
      crew.push(h.spawn("rifle", [this.P(-12 + i * 5, 34), this.P(-10 + i * 5, 46)]));
    for (let i = 0; i < c.snipers; i++)
      crew.push(h.spawn("sniper", [this.P(-14 + i * 12, 50), this.P(-8 + i * 12, 50)]));
    // The week's twist (sim/mostwanted.ts): plated crews, quicker crews; noFocus is read by the session.
    for (const e of crew) {
      if (c.twist === "armoured") e.kit.armour = Math.min(0.8, e.kit.armour + 0.25);
      if (c.twist === "fastRounds") {
        e.kit.walk *= 1.25;
        e.kit.run *= 1.25;
        e.kit.burst = [e.kit.burst[0], e.kit.burst[1] * 0.75, e.kit.burst[2] * 0.75];
      }
    }
    h.banner("Most Wanted", `${c.name}, ${c.alias}`);
    if (c.twist === "noFocus") h.say("Bea: His crew jams the focus implant. No bullet-time on this one.");
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
      if (this.boss) this.h.drop?.(this.boss.position.clone(), this.contract.bonusDrops);
      this.h.progress.save();
      this.h.banner("Bounty paid", this.contract.alias);
    }
  }
}
