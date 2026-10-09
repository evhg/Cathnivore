import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { VaultBossJob } from "../games/cathode/src/game/vaultboss";

describe("vault finale", () => {
  it("rolls the credits a few seconds after HollowCandor falls in the vault", () => {
    const progress = { jobsDone: ["vaultLead"] as string[], save: vi.fn(), character: { difficulty: "noir" } };
    const boss = { alive: true, hp: 100, kit: { maxHp: 100 }, position: new THREE.Vector3(), body: { root: new THREE.Group() } };
    const finale = vi.fn();
    const h = {
      player: { pos: new THREE.Vector3() },
      progress,
      scene: new THREE.Scene(),
      markers: { "boss:core": [new THREE.Vector3(0, 0, -53)], extract: [new THREE.Vector3(0, 0, 54)] },
      ground: () => 0,
      touch: false,
      spawn: () => ({ ...boss, kit: { maxHp: 100 }, body: { root: new THREE.Group() } }),
      arm: vi.fn(),
      say: vi.fn(),
      teach: vi.fn(),
      banner: vi.fn(),
      finale,
    };
    const job = new VaultBossJob(h as never);
    (job.boss as { alive: boolean }).alive = false;
    job.update(0.1);
    expect(job.stage).toBe(1);
    job.update(2);
    expect(finale).not.toHaveBeenCalled();
    job.update(2.5);
    expect(finale).toHaveBeenCalledTimes(1);
    expect(job.done).toBe(true);
  });

});
