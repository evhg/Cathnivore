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

  it("applies the twist and pays bonus drops", () => {
    const base = mostWanted("2026-W41");
    const kit = () => ({ maxHp: 100, armour: 0.15, walk: 2, run: 5, burst: [3, 0.2, 1.2] as [number, number, number] });
    const make = (twist: typeof base.twist) => {
      const crew: { alive: boolean; hp: number; kit: ReturnType<typeof kit>; position: THREE.Vector3; body: { root: THREE.Object3D } }[] = [];
      const drop = vi.fn();
      const h = {
        progress: { jobsDone: [] as string[], save: vi.fn() },
        ground: () => 0,
        spawn: () => {
          const e = { alive: true, hp: 100, kit: kit(), position: new THREE.Vector3(), body: { root: new THREE.Group() } };
          crew.push(e);
          return e;
        },
        say: vi.fn(),
        banner: vi.fn(),
        drop,
      };
      const job = new MostWantedJob(h as never, { ...base, twist });
      return { crew, drop, job };
    };
    const a = make("armoured");
    expect(a.crew[0]!.kit.armour).toBeCloseTo(0.4);
    const f = make("fastRounds");
    expect(f.crew[1]!.kit.run).toBeCloseTo(6.25);
    const n = make("noFocus");
    expect(n.job.focusJammed).toBe(true);
    n.crew[0]!.alive = false;
    n.job.update(0.1);
    expect(n.job.focusJammed).toBe(false);
    expect(n.drop).toHaveBeenCalledWith(expect.anything(), base.bonusDrops);
  });
});
