// The vault ledger, the lead into act 5: the debt-book index sits in a clerk's cage at the Hollow Vault gate,
// watched by two guards and a sniper on the gantry. Cath takes it, then makes for the water taxi. It holds the
// vault door code, so the boss job needs it. Closes `vaultLead`.

import * as THREE from "three";
import type { Enemy } from "./enemy";
import type { JobHost } from "./firstjob";

export class VaultLeadJob {
  stage = 0;
  objective = "";
  done = false;
  target: THREE.Vector3 | null = null;
  private chasers: Enemy[] = [];
  private lockT = 0;

  constructor(private readonly h: JobHost) {
    this.goto(0);
  }

  private P(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, this.h.ground(x, z), z);
  }

  private M(key: string, i: number, x: number, z: number): THREE.Vector3 {
    return this.h.markers[key]?.[i]?.clone() ?? this.P(x, z);
  }

  private get inVault(): boolean {
    return !!this.h.markers["lead:register"];
  }

  private goto(stage: number): void {
    const h = this.h;
    this.stage = stage;
    switch (stage) {
      case 0:
        this.objective = this.inVault
          ? "The debt-book index is in the clerk's cage, west of the gate hall. Take it."
          : "Bea traced the vault's debt-book index to a clerk's cage at the Hollow Vault gate, far east of the quay.";
        this.target = this.M("lead:register", 0, 20, -55);
        this.target.y += 0.6;
        h.spawn("rifle", [this.M("lead:guard", 0, 18, -57), this.M("lead:guard", 1, 22, -53)]);
        h.spawn("shield", [this.M("lead:guard", 2, 24, -57), this.M("lead:guard", 3, 24, -51)]);
        h.spawn("sniper", [this.M("lead:sniper", 0, 27, -45)], { passive: true });
        h.say("Bea: Clerk's cage, inside the gate. Two guards, and a rifle on the gantry.");
        break;
      case 1:
        if (this.inVault) {
          // The code opens the core door at the end of the chasm: no taxi run. Lifting the index trips the
          // vault's lockdown, and the gantry squad comes down to retrieve it.
          h.banner("Index recovered", "The Hollow Vault");
          h.say("Bea: Lockdown! The shutters are dropping and the gantry squad is coming for the index. Keep moving, Cath.");
          h.sting?.();
          this.lockT = 0;
          this.target = null;
          this.objective = "Lockdown. Break the gantry squad or hold out for 45 seconds.";
          const from = this.M("lead:register", 0, 20, -55);
          this.chasers = [
            h.spawn("rifle", [this.M("lead:guard", 0, 18, -57), from]),
            h.spawn("rifle", [this.M("lead:guard", 1, 22, -53), from]),
            h.spawn("shield", [this.M("lead:guard", 2, 24, -57), from]),
            h.spawn("rifle", [this.M("lead:sniper", 0, 27, -45), from]),
          ];
          return;
        }
        this.objective = "Index taken. Get to the water taxi.";
        h.banner("Index recovered", "The Hollow Vault");
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.say("Cath: Every debt Candor ever wrote, and the code on the cover.");
        break;
      case 2:
        this.done = true;
        this.target = null;
        this.objective = this.inVault
          ? "Index taken. Cross the chasm to the vault core, north end."
          : "Index delivered. Bea is reading the door code.";
        if (!h.progress.jobsDone.includes("vaultLead")) h.progress.jobsDone.push("vaultLead");
        h.progress.save();
        if (!this.inVault) h.banner("Job done", "The vault ledger");
        if (!this.inVault) h.say("Bea: Got the code. The vault door opens when you reach it.");
        break;
    }
  }

  update(dt: number): void {
    if (this.inVault && this.stage === 1) {
      this.lockT += dt;
      const cleared = this.chasers.length > 0 && this.chasers.every((e) => !e.alive);
      if (cleared || this.lockT > 45) {
        this.h.say("Cath: Every debt Candor wrote, and the code on the cover. Across the chasm, then.");
        this.goto(2);
      }
      return;
    }
    const near = this.target && this.h.player.pos.distanceTo(this.target) < (this.stage === 0 ? 2.2 : 3);
    if (near) this.goto(this.stage + 1);
  }
}
