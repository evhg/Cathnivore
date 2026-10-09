import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PellLeadJob } from "../games/cathode/src/game/pelllead";
import { PellBossJob } from "../games/cathode/src/game/pellboss";
import { buildDistrict } from "../games/cathode/src/render/levels";

function host(jobsDone: string[]) {
  const lv = buildDistrict("plaza", "phone");
  const player = { pos: new THREE.Vector3(0, 0, 48) };
  const progress = { jobsDone, save: vi.fn() };
  const spawned: { role: string; route: THREE.Vector3[]; hp: number; alive: boolean }[] = [];
  const h = {
    player,
    progress,
    scene: new THREE.Scene(),
    markers: lv.markers,
    ground: lv.groundHeight,
    touch: false,
    spawn: (role: string, route: THREE.Vector3[]) => {
      const e = { role, route, hp: 100, alive: true, kit: { maxHp: 100 }, body: { root: { scale: { setScalar: vi.fn() } } }, position: route[0]!.clone() };
      spawned.push(e as never);
      return e;
    },
    arm: vi.fn(),
    say: vi.fn(),
    teach: vi.fn(),
    banner: vi.fn(),
  };
  return { h, player, progress, spawned, lv };
}

describe("hollowell plaza jobs", () => {
  it("the permit lead runs in the plaza and skips the taxi leg", () => {
    const { h, player, progress, spawned, lv } = host(["vaneBoss"]);
    const job = new PellLeadJob(h as never);
    expect(spawned).toHaveLength(3);
    const box = lv.markers["lead:register"]![0]!;
    expect(job.target!.x).toBeCloseTo(box.x);
    player.pos.set(box.x, box.y + 0.6, box.z);
    job.update(0.1);
    expect(job.done).toBe(true);
    expect(progress.jobsDone).toContain("pellLead");
  });
  it("Pell takes the landing, and the ambush adds marksmen", () => {
    const { h, spawned, lv } = host(["vaneBoss", "pellLead"]);
    const job = new PellBossJob(h as never);
    const top = lv.markers["boss:pell"]![0]!;
    expect(job.boss!.position.y).toBeCloseTo(top.y);
    expect(top.y).toBeGreaterThan(2);
    const before = spawned.length;
    job.boss!.hp = 10;
    job.update(0.1);
    expect(spawned.length).toBe(before + 3 + lv.markers.perch!.length);
    expect(spawned.filter((e) => e.role === "sniper")).toHaveLength(lv.markers.perch!.length);
    (job.boss as { alive: boolean }).alive = false;
    job.update(0.1);
    expect(job.stage).toBe(1);
  });
});
