import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildGun, buildGunLOD, type GunModel } from "../games/cathode/src/game/viewmodel";
import { Arms } from "../games/cathode/src/game/hands";
import { meshStats } from "../games/cathode/src/game/gunkit";
import { KESTREL_PARTS } from "../games/cathode/src/game/kestrel";
import { BANDS, trimAtlas } from "../games/cathode/src/render/guntex";
import { ARSENAL, HERO_MODELS } from "../games/cathode/src/game/feel/arsenal";

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

  it("a world gun has three LODs: the full model, one mesh past 8 m, one box past 30 m", () => {
    for (const model of ["pistol", "shotgun"] as GunModel[]) {
      const lod = buildGunLOD(model);
      expect(lod.levels.map((l) => l.distance)).toEqual([0, 8, 30]);
      const full = meshStats(lod.levels[0]!.object);
      const mid = meshStats(lod.levels[1]!.object);
      const far = meshStats(lod.levels[2]!.object);
      expect(mid.calls).toBe(1);
      expect(far.calls).toBe(1);
      // The Kestrel drops its bevels and cut-outs; older guns only merge to one draw.
      if (model === "pistol") expect(mid.tris).toBeLessThan(full.tris * 0.6);
      else expect(mid.tris).toBeLessThanOrEqual(full.tris);
      expect(far.tris).toBeLessThanOrEqual(12 * 4);
    }
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

describe("C18 the arsenal on the kit (S2.6)", () => {
  for (const m of HERO_MODELS) {
    it(`${m} has every part its clips move and every empty the hands and the stages read`, () => {
      for (const phone of [false, true]) {
        const r = buildGun(m, phone);
        for (const n of ARSENAL[m].parts) expect(r.parts[n], `${m} ${phone ? "phone" : "desktop"} ${n}`).toBeTruthy();
        // Moving parts the fire clip drives carry their own meshes (a separate draw so they can move), except
        // the trigger, merged into the frame on a phone like the Kestrel's.
        for (const n of Object.keys(ARSENAL[m].fire.tracks)) {
          if (["gun", "hand", "hand2", "handR", "trigger"].includes(n)) continue;
          let meshes = 0;
          r.parts[n]!.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) meshes++;
          });
          expect(meshes, `${m} ${n}`).toBeGreaterThan(0);
        }
        // The muzzle is ahead of everything that isn't the flash.
        expect(r.muzzle.position.z).toBeLessThan(-0.18);
        // Built on the kit: one shared material, a handful of draws.
        const st = meshStats(r.root);
        expect(st.calls).toBeLessThanOrEqual(phone ? 8 : 12);
      }
    });
  }

  it("the hero guns are one family: the faction plate and the cyan line on every one", () => {
    for (const m of HERO_MODELS) {
      const r = buildGun(m);
      let emissive = 0;
      r.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.userData.kit === "emissive") emissive++;
      });
      expect(emissive, m).toBeGreaterThan(0);
    }
  });
});
