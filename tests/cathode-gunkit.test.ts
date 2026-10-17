import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildGun, type GunModel } from "../games/cathode/src/game/viewmodel";
import { Arms } from "../games/cathode/src/game/hands";
import { meshStats } from "../games/cathode/src/game/gunkit";
import { KESTREL_PARTS } from "../games/cathode/src/game/kestrel";
import { BANDS, trimAtlas } from "../games/cathode/src/render/guntex";

const MODELS: GunModel[] = ["pin", "pistol", "shotgun", "sniper", "revolver", "smg", "rifle", "launcher", "sledge", "blade", "wire"];
// S2.1: the viewmodel budget, hands included.
const BUDGET = { desktop: { tris: 30_000, calls: 14 }, phone: { tris: 14_000, calls: 10 } };

describe("CATHODE gun kit (S2.1, C4)", () => {
  for (const phone of [false, true]) {
    const prof = phone ? "phone" : "desktop";
    for (const model of MODELS) {
      it(`${model} (${prof}) builds within the viewmodel budget, with both grip frames`, () => {
        const r = buildGun(model, phone);
        const arms = new Arms(phone);
        arms.attach(r.root);
        expect(r.gripR).toBeTruthy();
        expect(r.parts.gripR).toBe(r.gripR);
        // One-handed weapons (batons, the blade, the wire) have no support hand; every gun does.
        if (!["pin", "blade", "wire"].includes(model)) expect(r.gripL).toBeTruthy();
        const st = meshStats(r.root);
        expect(st.calls).toBeLessThanOrEqual(BUDGET[prof].calls);
        expect(st.tris).toBeLessThanOrEqual(BUDGET[prof].tris);
      });
    }
  }

  it("the Kestrel 9 has every named part and empty", () => {
    const r = buildGun("pistol");
    for (const n of KESTREL_PARTS) expect(r.parts[n], n).toBeTruthy();
    // The moving parts carry their own meshes: each is a separate draw so it can move.
    for (const n of ["frame", "slide", "barrel", "hammer", "trigger", "mag", "slideStop"]) {
      let meshes = 0;
      r.parts[n]!.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.parent === r.parts[n]) meshes++;
      });
      expect(meshes, n).toBeGreaterThan(0);
    }
    // The muzzle is ahead of the can's mouth, the grips on either side of the grip.
    expect(r.parts.muzzle!.position.z).toBeLessThan(-0.3);
    expect(r.gripR.position.x).toBeGreaterThan(0);
    expect(r.gripL!.position.x).toBeLessThan(0);
  });

  it("the Kestrel's hands are posed onto the grips by IK", () => {
    const scene = new THREE.Scene();
    const r = buildGun("pistol");
    scene.add(r.root);
    r.root.position.copy(r.hip);
    const arms = new Arms(false);
    arms.attach(r.root);
    arms.pose(r.root, r.gripR, r.gripL, r.poseR, r.poseL!);
    scene.updateMatrixWorld(true);
    const wristR = arms.right.bones.hand.getWorldPosition(new THREE.Vector3());
    const gripR = r.gripR.getWorldPosition(new THREE.Vector3());
    expect(wristR.distanceTo(gripR)).toBeLessThan(0.001);
    const elbow = arms.right.bones.fore.getWorldPosition(new THREE.Vector3());
    // The elbow sits below and to the right of the wrist, off toward the shoulder.
    expect(elbow.y).toBeLessThan(wristR.y);
    expect(elbow.z).toBeGreaterThan(wristR.z);
  });

  it("the trim atlas has every band, packed top to bottom without overlap", () => {
    const names = Object.keys(BANDS) as (keyof typeof BANDS)[];
    let end = 0;
    for (const n of names) {
      expect(BANDS[n].v0).toBeCloseTo(end, 6);
      end = BANDS[n].v0 + BANDS[n].vh;
    }
    expect(end).toBeLessThanOrEqual(1);
    const t = trimAtlas(512);
    expect(t.image.width).toBe(512);
    // A flat band reads as an up-facing normal and no albedo or roughness change.
    const d = t.image.data as Uint8Array;
    expect(Math.abs(d[0]! - 128)).toBeLessThan(3);
    expect(Math.abs(d[2]! - 128)).toBeLessThan(3);
  });
});
