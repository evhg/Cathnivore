// C5 review fixes: the draw reads mid-rise, the old mag leaves low and left with the glove on it, the suppressed
// shot's viewmodel light stays off the gloves, the lock turns the gun to the eye, and the dropped mags share one
// draw call.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DRAW, TAC } from "../games/cathode/src/game/feel/pistol";
import { sampleTrack } from "../games/cathode/src/game/feel/clip";
import { tuning } from "../games/cathode/src/game/feel/tuning";
import { DroppedMags } from "../games/cathode/src/game/dropmag";

const K = tuning.kestrel;

describe("CATHODE Kestrel, C5 review", () => {
  it("the draw is still visibly rising at 300 ms (not 96% done)", () => {
    const g0 = sampleTrack(DRAW.tracks.gun!, 0);
    const g = sampleTrack(DRAW.tracks.gun!, 300);
    // At least 10% of the drop and of the pitch still to go.
    expect(g.pos[1] / g0.pos[1]).toBeGreaterThan(0.1);
    expect(g.rot[0] / g0.rot[0]).toBeGreaterThan(0.1);
    // At 140 ms it still has 40% of the drop to go.
    expect(sampleTrack(DRAW.tracks.gun!, 140).pos[1] / g0.pos[1]).toBeGreaterThan(0.4);
  });

  it("the tactical reload's old mag leaves to the left, not straight down through the frame", () => {
    const m = TAC.tracks.mag!;
    const at400 = sampleTrack(m, 400);
    const at520 = sampleTrack(m, 520);
    // Gun space: -X is her left. By 520 ms it's further left than down-the-grip.
    expect(at520.pos[0]).toBeLessThan(-0.25);
    expect(Math.abs(at520.pos[0])).toBeGreaterThan(Math.abs(at520.pos[1]) * 0.8);
    // Mid-way it's moving out (the glove carries it) but still near the gun.
    expect(Math.hypot(...at400.pos)).toBeLessThan(0.25);
  });

  it("the suppressed shot's viewmodel light is faint and short-ranged (the crown, not the gloves)", () => {
    expect(K.puff.light).toBe(0.6);
    expect(K.puff.vmLight).toBeLessThanOrEqual(0.1);
    // The support glove sits about 0.25 m behind the crown: the light must not reach it.
    expect(K.puff.vmRangeM).toBeLessThan(0.2);
  });

  it("on a locked slide the gun turns its left flank to the eye", () => {
    expect(K.lock.pose.rot[1]).toBeGreaterThanOrEqual(15);
  });

  it("dropped mags are one instanced draw, at most six", () => {
    const scene = new THREE.Scene();
    const drops = new DroppedMags(scene, () => 0);
    const mag = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.03), new THREE.MeshStandardMaterial());
    body.userData.kit = "opaque";
    mag.add(body);
    const round = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.02), new THREE.MeshStandardMaterial());
    round.name = "magRound";
    round.userData.kit = "opaque";
    mag.add(round);
    for (let i = 0; i < 8; i++) drops.drop(mag, new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3(0, -1, 0));
    const meshes: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o);
    });
    expect(meshes.length).toBe(1);
    const im = meshes[0] as THREE.InstancedMesh;
    expect(im.isInstancedMesh).toBe(true);
    expect(im.count).toBe(K.reload.dropMagMax);
    // The top round never reaches the street: one box's worth of vertices.
    expect(im.geometry.getAttribute("position").count).toBe(new THREE.BoxGeometry().getAttribute("position").count);
    for (let i = 0; i < 20 * 60; i++) drops.update(1 / 60);
    expect(im.count).toBe(0);
    expect(im.visible).toBe(false);
  });
});
