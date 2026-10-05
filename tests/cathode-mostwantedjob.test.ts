import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { MostWantedJob } from "../games/cathode/src/game/mostwantedjob";
import { mostWanted } from "../games/cathode/src/sim/mostwanted";

describe("Most Wanted job", () => {
  it("spawns the contract and closes this week's flag when the target falls", () => {
    const contract = mostWanted("2026-W41");
    const progress = { jobsDone: [] as string[], save: vi.fn() };
    const spawned: { alive: boolean; hp: number; kit: { maxHp: number }; position: THREE.Vector3; body: { root: THREE.Object3D } }[] = [];
    const h = {
      progress,
      ground: () => 0,
      spawn: () => {
        const e = { alive: true, hp: 100, kit: { maxHp: 100 }, position: new THREE.Vector3(0, 0, 40), body: { root: new THREE.Group() } };
        spawned.push(e);
        return e;
      },
      say: vi.fn(),
      banner: vi.fn(),
    };
    const job = new MostWantedJob(h as never, contract);
    expect(spawned).toHaveLength(1 + contract.guards + contract.snipers);
    job.update(0.1);
    expect(job.target).not.toBeNull();
    spawned[0]!.alive = false;
    job.update(0.1);
    expect(job.done).toBe(true);
    expect(progress.jobsDone).toContain("mostWanted:2026-W41");
  });
});
