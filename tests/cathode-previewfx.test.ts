import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildPreviewFx } from "../games/cathode/src/render/previewfx";

// Plan item 481, slice 3: a preview's stage pieces stand for its length, follow the scene clock, and are all hidden
// outside one (so the pick's draw calls are unchanged).
describe("skill preview stage pieces", () => {
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(0, 1.6, 3);
  const hand = new THREE.Vector3(-0.3, 1.2, 0);
  const aim = new THREE.Vector3(0.6, 0.48, -0.4);
  const crate = new THREE.Vector3(0.6, 0, -0.4);
  const visible = (fx: ReturnType<typeof buildPreviewFx>) => fx.group.children.filter((o) => o.visible).length;

  it("nothing shows before or after a preview", () => {
    const fx = buildPreviewFx();
    fx.update(1, cam);
    expect(visible(fx)).toBe(0);
    fx.play("mark", 10, 1800, hand, aim, crate);
    fx.update(10.5, cam);
    expect(fx.showing()).toBe("mark");
    expect(visible(fx)).toBe(1);
    fx.update(11.81, cam);
    expect(fx.showing()).toBe("");
    expect(visible(fx)).toBe(0);
  });

  it("each standing look shows its own piece", () => {
    const fx = buildPreviewFx();
    for (const look of ["mark", "hack", "overload", "moth", "sentry"] as const) {
      fx.play(look, 0, 2000, hand, aim, crate);
      fx.update(0.8, cam);
      expect(fx.showing(), look).toBe(look);
      expect(visible(fx), look).toBe(1);
    }
    // looks made of effects alone leave nothing standing
    fx.play("fan", 0, 1800, hand, aim, crate);
    fx.update(0.5, cam);
    expect(visible(fx)).toBe(0);
  });

  it("the reticle closes on the bottle, the Moth flies from her hand to the target", () => {
    const fx = buildPreviewFx();
    fx.play("mark", 0, 1800, hand, aim, crate);
    fx.update(0.05, cam);
    const reticle = fx.group.children[0]!;
    const wide = reticle.scale.x;
    fx.update(1, cam);
    expect(reticle.scale.x).toBeLessThan(wide);
    expect(reticle.position.distanceTo(aim)).toBeLessThan(1e-6);
    fx.play("moth", 0, 2000, hand, aim, crate);
    fx.update(0.01, cam);
    const moth = fx.group.children[2]!;
    expect(moth.position.distanceTo(hand)).toBeLessThan(0.1);
    fx.update(1.3, cam);
    expect(Math.hypot(moth.position.x - aim.x, moth.position.z - aim.z)).toBeLessThan(0.05);
    expect(moth.position.y).toBeGreaterThan(aim.y);
  });

  it("stop hides everything at once (a class switch)", () => {
    const fx = buildPreviewFx();
    fx.play("sentry", 0, 2000, hand, aim, crate);
    fx.update(0.6, cam);
    expect(visible(fx)).toBe(1);
    fx.stop();
    fx.update(0.7, cam);
    expect(visible(fx)).toBe(0);
  });
});
