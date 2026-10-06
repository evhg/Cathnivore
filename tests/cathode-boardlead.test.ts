import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { BoardLeadJob } from "../games/cathode/src/game/boardlead";

describe("The visitor pass", () => {
  it("reach the cache, extract, then closes the job", () => {
    const player = { pos: new THREE.Vector3(0, 0, 0) };
    const progress = { jobsDone: ["fishMarket", "crispLead", "quayContracts", "pellBoss"] as string[], save: vi.fn() };
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
    const job = new BoardLeadJob(h as never);
    expect(spawned).toHaveLength(3);
    job.update(0.1);
    expect(job.stage).toBe(0);
    player.pos.set(20, 0.6, -30);
    job.update(0.1);
    expect(job.stage).toBe(1);
    player.pos.set(6, 0, -60);
    job.update(0.1);
    expect(job.done).toBe(true);
    expect(progress.jobsDone).toContain("boardLead");
  });
});
