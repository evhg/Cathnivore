import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Arsenal } from "../games/cathode/src/game/weapons";

// C5 review 2: a reload cancelled by fire, sprint or a swap must not snap the Kestrel to the hip in one frame.
describe("CATHODE C5 cancel blend", () => {
  const setup = () => {
    const a = new Arsenal(new THREE.Scene());
    a.owned.add("kestrel");
    a.equipId("kestrel");
    a.settle();
    const cam = new THREE.PerspectiveCamera(54, 16 / 9, 0.01, 10);
    const pose = (dt: number) => a.pose(dt, { yaw: 0, pitch: 0 }, 0, 0, false, 0, cam, 75);
    for (let i = 0; i < 30; i++) pose(1 / 60);
    return { a, pose };
  };

  it("a cancelled tac reload eases the mag, hand and turn out over about 140 ms", () => {
    const { a, pose } = setup();
    a.stageReload("tac", 400);
    pose(1 / 60);
    const mag = a.rig.mag!;
    const off0 = mag.position.length();
    const turn0 = a.reloadW;
    expect(off0).toBeGreaterThan(0.03);
    a.stageCancel();
    expect(a.rm.active).toBe(false);
    pose(1 / 60);
    // One frame on: still most of the way out (no snap to the grip).
    expect(mag.position.length()).toBeGreaterThan(off0 * 0.3);
    expect(a.reloadW).toBeGreaterThan(0);
    expect(a.reloadW).toBeLessThan(turn0 + 1e-6);
    for (let i = 0; i < 12; i++) pose(1 / 60);
    // Past the blend: home.
    expect(mag.position.length()).toBeLessThan(1e-6);
    expect(a.reloadW).toBe(0);
  });

  it("a reload that plays out ends without a ghost blend", () => {
    const { a, pose } = setup();
    a.stageReload("tac", 1540);
    pose(1 / 60);
    for (let i = 0; i < 3; i++) {
      a.update(1 / 60, false, new THREE.Vector3(), new THREE.Vector3(0, 0, -1), new THREE.Quaternion(), 1);
      pose(1 / 60);
    }
    expect(a.rm.active).toBe(false);
    expect(a.rig.mag!.position.length()).toBeLessThan(1e-6);
  });
});
