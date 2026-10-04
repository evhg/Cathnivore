// Ana's quay contract, the third job: a marked buyer, Marlow, drinks at the far end of the quay behind two
// guards. Cath takes him out (any way she likes), then makes for the water taxi. Closes `quayContracts`.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";

export class QuayJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  private mark: Enemy | null = null;

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
        this.objective = "Ana's contract: Marlow, Candor's buyer, is at the north end of the quay. Remove him.";
        this.mark = h.spawn("rifle", [this.P(0, 48), this.P(2, 46)], { passive: true });
        h.spawn("rifle", [this.P(-4, 46), this.P(-4, 52)]);
        h.spawn("shield", [this.P(5, 50), this.P(5, 44)]);
        h.say("Ana: Marlow signs for Candor's shipments. Take him off the board. Quietly, if you can.");
        break;
      case 1:
        this.objective = "Marlow is down. Get to the water taxi.";
        h.banner("Contract complete", "Marlow");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: One less signature. Time to go.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Contract paid. Ana will pin the next one.";
        if (!h.progress.jobsDone.includes("quayContracts")) h.progress.jobsDone.push("quayContracts");
        h.progress.save();
        h.banner("Job done", "Ana's contract");
        h.say("Ana: Paid in full. Come back when the quay's gone quiet.");
        break;
    }
  }

  update(_dt: number): void {
    if (this.stage === 0) {
      if (this.mark) this.target = this.mark.position.clone().setY(this.mark.position.y + 1.9);
      if (this.mark && !this.mark.alive) this.goto(1);
    } else if (this.stage === 1 && this.target && this.h.player.pos.distanceTo(this.target) < 3) this.goto(2);
  }
}
