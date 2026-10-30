import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { VaultLeadJob } from "../games/cathode/src/game/vaultlead";

describe("The vault ledger", () => {
  it("reach the cache, extract, then closes the job", () => {
    const player = { pos: new THREE.Vector3(0, 0, 0) };
    const progress = { jobsDone: ["fishMarket", "crispLead", "quayContracts", "boardBoss"] as string[], save: vi.fn() };
    const spawned: { alive: boolean; position: THREE.Vector3 }[] = [];
    const h = {
      player,
      progress,
      scene: new THREE.Scene(),
      markers: { extract: [new THREE.Vector3(6, 0, -60)] },
      ground: () => 0,
      touch: false,
      spawn: () => {
        const e = { alive: true, passive: true, position: new THREE.Vector3(0, 0, 48) };
        spawned.push(e);
        return e;
      },
      arm: vi.fn(),
      say: vi.fn(),
      teach: vi.fn(),
      banner: vi.fn(),
    };
    const job = new VaultLeadJob(h as never);
    expect(spawned).toHaveLength(3);
    job.update(0.1);
    expect(job.stage).toBe(0);
    player.pos.set(20, 0.6, -55);
    job.update(0.1);
    expect(job.stage).toBe(1);
    player.pos.set(6, 0, -60);
    job.update(0.1);
    expect(job.done).toBe(true);
    expect(progress.jobsDone).toContain("vaultLead");
  });

  it("in the vault, lifting the index trips a lockdown that ends when the squad is down or 45 s pass", () => {
    const run = (kill: boolean) => {
      const player = { pos: new THREE.Vector3(0, 0, 0) };
      const progress = { jobsDone: ["boardBoss"] as string[], save: vi.fn() };
      const squad: { alive: boolean; position: THREE.Vector3 }[] = [];
      const sting = vi.fn();
      const h = {
        player,
        progress,
        scene: new THREE.Scene(),
        markers: { "lead:register": [new THREE.Vector3(20, 0, -55)] },
        ground: () => 0,
        touch: false,
        spawn: () => {
          const e = { alive: true, passive: false, position: new THREE.Vector3() };
          squad.push(e);
          return e;
        },
        arm: vi.fn(),
        say: vi.fn(),
        teach: vi.fn(),
        banner: vi.fn(),
        sting,
      };
      const job = new VaultLeadJob(h as never);
      player.pos.set(20, 0.6, -55);
      job.update(0.1);
      expect(job.stage).toBe(1);
      expect(sting).toHaveBeenCalled();
      expect(job.done).toBe(false);
      job.update(1);
      expect(job.stage).toBe(1);
      if (kill) squad.forEach((e) => (e.alive = false));
      else job.update(46);
      job.update(0.1);
      expect(job.done).toBe(true);
      expect(progress.jobsDone).toContain("vaultLead");
    };
    run(true);
    run(false);
  });
});
