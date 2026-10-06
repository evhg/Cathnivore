// The vault ledger, the lead into act 5: the debt-book index sits in a clerk's cage at the Hollow Vault gate,
// watched by two guards and a sniper on the gantry. Cath takes it, then makes for the water taxi. It holds the
// vault door code, so the boss job needs it. Closes `vaultLead`.

import * as THREE from "three";
import type { JobHost } from "./firstjob";

export class VaultLeadJob {
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
        this.objective = "Bea traced the vault's debt-book index to a clerk's cage at the Hollow Vault gate, far east of the quay.";
        this.target = this.P(20, -55).setY(this.h.ground(20, -55) + 0.6);
        h.spawn("rifle", [this.P(18, -57), this.P(22, -53)]);
        h.spawn("shield", [this.P(24, -57), this.P(24, -51)]);
        h.spawn("sniper", [this.P(27, -45)], { passive: true });
        h.say("Bea: Clerk's cage, inside the gate. Two guards, and a rifle on the gantry.");
        break;
      case 1:
        this.objective = "Index taken. Get to the water taxi.";
        h.banner("Index recovered", "The Hollow Vault");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Every debt Candor ever wrote, and the code on the cover.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = "Index delivered. Bea is reading the door code.";
        if (!h.progress.jobsDone.includes("vaultLead")) h.progress.jobsDone.push("vaultLead");
        h.progress.save();
        h.banner("Job done", "The vault ledger");
        h.say("Bea: Got the code. The vault door opens when you reach it.");
        break;
    }
  }

  update(_dt: number): void {
    const near = this.target && this.h.player.pos.distanceTo(this.target) < (this.stage === 0 ? 2.2 : 3);
    if (near) this.goto(this.stage + 1);
  }
}
