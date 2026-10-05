import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { VaneBossJob } from "../games/cathode/src/game/vaneboss";

describe("Dr Vane", () => {
  it("patches herself and calls guards at half health, then extract closes act 2", () => {
    const player = { pos: new THREE.Vector3(0, 0, 0) };
    const progress = { jobsDone: ["fishMarket", "crispLead", "quayContracts", "crispBoss"] as string[], save: vi.fn() };
    const spawned: { alive: boolean; hp: number; kit: { maxHp: number }; position: THREE.Vector3; body: { root: THREE.Object3D } }[] = [];
    const h = {
      player,
      progress,
      scene: new THREE.Scene(),
      markers: { extract: [new THREE.Vector3(6, 0, -60)] },
      ground: () => 0,
      touch: false,
      spawn: () => {
        const e = { alive: true, hp: 100, kit: { maxHp: 100 }, position: new THREE.Vector3(0, 0, 48), body: { root: new THREE.Group() } };
        spawned.push(e);
        return e;
      },
      arm: vi.fn(),
      say: vi.fn(),
      teach: vi.fn(),
      banner: vi.fn(),
    };
    const job = new VaneBossJob(h as never);
    expect(spawned).toHaveLength(3);
    const boss = spawned[0]!;
    expect(boss.kit.maxHp).toBe(500);
    job.update(0.1);
    expect(spawned).toHaveLength(3);
    boss.hp = 150;
    job.update(0.1);
    expect(spawned[0]!.hp).toBe(350);
    expect(spawned).toHaveLength(5);
    job.update(0.1);
    expect(spawned).toHaveLength(5);
    boss.alive = false;
    job.update(0.1);
    expect(job.stage).toBe(1);
    player.pos.set(6, 0, -60);
    job.update(0.1);
    expect(job.done).toBe(true);
    expect(progress.jobsDone).toContain("vaneBoss");
  });
});
