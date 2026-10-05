import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SideContractJob, sideCount } from "../games/cathode/src/game/sidejob";

function host(jobsDone: string[]) {
  const spawned: { alive: boolean; position: THREE.Vector3 }[] = [];
  const h = {
    player: { pos: new THREE.Vector3() },
    progress: { jobsDone, save: vi.fn() },
    scene: new THREE.Scene(),
    markers: { extract: [new THREE.Vector3(6, 0, -60)] },
    ground: () => 0,
    touch: false,
    spawn: () => {
      const e = { alive: true, position: new THREE.Vector3(0, 0, 48) };
      spawned.push(e);
      return e;
    },
    arm: vi.fn(),
    say: vi.fn(),
    teach: vi.fn(),
    banner: vi.fn(),
  };
  return { h, spawned };
}

describe("Ana's late contracts", () => {
  it("kill, extract, record, and the next one is harder", () => {
    const jobs = ["vaultBoss"];
    const a = host(jobs);
    const job = new SideContractJob(a.h as never);
    expect(a.spawned).toHaveLength(2);
    a.spawned[0]!.alive = false;
    job.update(0.1);
    expect(job.stage).toBe(1);
    a.h.player.pos.set(6, 0, -60);
    job.update(0.1);
    expect(job.done).toBe(true);
    expect(sideCount(jobs)).toBe(1);
    const b = host([...jobs, "anaSide:0", "anaSide:1", "anaSide:2"]);
    new SideContractJob(b.h as never);
    expect(b.spawned).toHaveLength(4);
  });
});
