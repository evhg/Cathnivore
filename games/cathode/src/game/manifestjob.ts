// The Candor manifest, the fourth job: a courier's shipping manifest is stashed in a cache under the south
// arcade, watched by three guards and a sniper on the roof. Cath finds it (a secret the case board never
// mentions), then takes it to the water taxi. Closes `candorManifest`.

import * as THREE from "three";
import type { JobHost } from "./firstjob";

export class ManifestJob {
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

  private goto(stage: number): void {
    const h = this.h;
    this.stage = stage;
    switch (stage) {
      case 0:
        this.objective = "Bea found a dead drop: Candor's manifest is in a cache at the south end of the street.";
        this.target = this.P(-5, -28).setY(this.h.ground(-5, -28) + 0.6);
        h.spawn("rifle", [this.P(-4, -24), this.P(-4, -34)]);
        h.spawn("rifle", [this.P(1, -30), this.P(-1, -26)]);
        h.spawn("sniper", [this.P(2, -38)], { passive: true });
        h.say("Bea: The courier left it under the arcade. Three guards, and someone up high. Careful.");
        break;
      case 1:
        this.objective = "Manifest in hand. Get to the water taxi.";
        h.banner("Manifest recovered", "Candor shipments");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Every Candor crate for a month. Bea will want this.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Manifest delivered. Bea is reading it now.";
        if (!h.progress.jobsDone.includes("candorManifest")) h.progress.jobsDone.push("candorManifest");
        h.progress.save();
        h.banner("Job done", "The Candor manifest");
        h.say("Bea: There is a name on page nine. We are going to need a bigger plan.");
        break;
    }
  }

  update(_dt: number): void {
    const near = this.target && this.h.player.pos.distanceTo(this.target) < (this.stage === 0 ? 2.2 : 3);
    if (near) this.goto(this.stage + 1);
  }
}
