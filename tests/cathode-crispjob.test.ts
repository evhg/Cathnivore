import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CrispJob } from "../games/cathode/src/game/crispjob";

function host() {
  const player = { pos: new THREE.Vector3(0, 0, 50) };
  const progress = { jobsDone: ["fishMarket"] as string[], save: vi.fn() };
  const spawned: unknown[] = [];
  const h = {
    player,
    progress,
    scene: new THREE.Scene(),
    markers: { perch: [new THREE.Vector3(-9, 4, 28)], extract: [new THREE.Vector3(6, 0, -60)] },
    ground: () => 0,
    touch: false,
    spawn: () => {
      const e = { passive: true, alive: true };
      spawned.push(e);
      return e;
    },
    arm: vi.fn(),
    say: vi.fn(),
    teach: vi.fn(),
    banner: vi.fn(),
  };
  return { h, player, progress, spawned };
}

describe("Crisp's ledger", () => {
  it("runs ledger, ambush, extract, then closes the lead", () => {
    const { h, player, progress, spawned } = host();
    const job = new CrispJob(h as never);
    expect(job.stage).toBe(0);
    player.pos.set(-8.4, 4, 29.5);
    job.update(0.1);
    expect(job.stage).toBe(1);
    expect(spawned).toHaveLength(3);
    player.pos.set(6, 0, -60);
    job.update(0.1);
    expect(job.done).toBe(true);
    expect(progress.jobsDone).toContain("crispLead");
    expect(progress.save).toHaveBeenCalled();
  });
});
