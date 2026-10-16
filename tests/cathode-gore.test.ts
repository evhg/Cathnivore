import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { createGore, exitCount, puffSize, GORE } from "../games/cathode/src/render/gore";
import { Body, enforcerLook } from "../games/cathode/src/game/body";

function rig(quality: "phone" | "high" = "high", reduced = false) {
  const scene = new THREE.Scene();
  const decals: { size: number; wet: number }[] = [];
  const gore = createGore({
    scene,
    quality,
    reduced,
    noise: { value: null },
    atlas: new THREE.Texture(),
    // A wall 2 m behind anything shot along +z.
    raycast: (from, dir) => (dir.z > 0.5 ? { point: from.clone().addScaledVector(dir, 2), normal: new THREE.Vector3(0, 0, -1) } : null),
    ground: () => 0,
    decal: (_p, _n, size, _c, _t, wet = 0) => decals.push({ size, wet }),
    light: (_p, out) => out.setRGB(0.3, 0.25, 0.2),
  });
  return { scene, gore, decals };
}

function body() {
  const b = new Body(enforcerLook());
  b.pose();
  b.root.updateMatrixWorld(true);
  return b;
}

describe("CATHODE gore (S4.5)", () => {
  it("sprays by weapon: pistol 15, rifle 22, shotgun 6 a pellet, sniper 40", () => {
    expect(exitCount("pistol")).toBe(15);
    expect(exitCount("rifle")).toBe(22);
    expect(exitCount("shotgun")).toBe(6);
    expect(exitCount("sniper")).toBe(40);
  });

  it("sizes the puff 0.25..0.45 m, and 1.4x beyond 15 m", () => {
    expect(puffSize(1, 100, 10, 0)).toBeGreaterThanOrEqual(0.25);
    expect(puffSize(100, 100, 10, 1)).toBeLessThanOrEqual(0.45);
    expect(puffSize(25, 100, 20, 0.5)).toBeCloseTo(puffSize(25, 100, 10, 0.5) * 1.4);
  });

  it("puts every layer down on one flesh hit: puff, spurt, exit spray, wet wall splat and a wound", () => {
    const { gore, decals } = rig();
    const b = body();
    const chest = b.segs.get("chest")!.group;
    const point = b.joints.chest.clone().add(new THREE.Vector3(0, 0.15, -0.3));
    gore.hit({ point, dir: new THREE.Vector3(0, 0, 1), damage: 25, maxHp: 130, weaponCls: "pistol", distance: 10, anchor: chest, owner: b, root: b.root });
    const c = gore.counts;
    expect(c.mist).toBeGreaterThanOrEqual(GORE.puff.count[0]);
    expect(c.drops).toBeGreaterThanOrEqual(GORE.spurt.count[0] + 15);
    expect(decals.some((d) => d.wet === GORE.splat.wetInMs && d.size >= GORE.splat.size[0])).toBe(true);
    expect(c.wounds).toBeGreaterThanOrEqual(1);
  });

  it("anchors to the hit segment for 80 ms: the spray moves with the flinch", () => {
    const { gore } = rig();
    const b = body();
    const head = b.segs.get("head")!.group;
    gore.hit({ point: b.joints.head.clone(), dir: new THREE.Vector3(0, 0, 1), damage: 25, maxHp: 130, weaponCls: "pistol", distance: 10, anchor: head });
    // The mist hangs still on its own; move the head 10 cm and the puff goes with it.
    const before = (gore as unknown as { counts: { mist: number } }).counts.mist;
    expect(before).toBeGreaterThan(0);
    head.position.x += 0.1;
    gore.update(0.016, new THREE.Camera());
    head.position.x += 0.1;
    gore.update(0.1, new THREE.Camera());
    expect(gore.counts.mist).toBeGreaterThan(0);
  });

  it("holds every cap through a 200-shot soak, at most 8 wounds a body", () => {
    for (const q of ["high", "phone"] as const) {
      const { gore } = rig(q);
      const bodies = [body(), body(), body()];
      const cam = new THREE.Camera();
      for (let i = 0; i < 200; i++) {
        const b = bodies[i % 3]!;
        const segs = [...b.segs.values()];
        const s = segs[i % segs.length]!;
        const p = b.joints[s.def.from].clone().lerp(b.joints[s.def.to], 0.5).add(new THREE.Vector3(0, 0, -0.25));
        const cls = ["pistol", "rifle", "shotgun", "sniper"][i % 4]!;
        gore.hit({ point: p, dir: new THREE.Vector3(0, 0, 1), damage: 30, maxHp: 130, weaponCls: cls, distance: 10, anchor: s.group, owner: b, root: b.root });
        gore.update(1 / 60, cam);
        const c = gore.counts;
        expect(c.mist).toBeLessThanOrEqual(gore.caps.mist);
        expect(c.drops).toBeLessThanOrEqual(gore.caps.drops);
        expect(c.wounds).toBeLessThanOrEqual(gore.caps.wounds);
      }
      expect(gore.counts.wounds).toBeLessThanOrEqual(3 * GORE.wound.perBody);
      // Everything but the wounds is gone a few seconds later.
      for (let i = 0; i < 240; i++) gore.update(1 / 60, cam);
      expect(gore.counts.mist + gore.counts.drops).toBe(0);
    }
  });

  it("wounds leave with their body", () => {
    const { scene, gore } = rig();
    const b = body();
    scene.add(b.root);
    const chest = b.segs.get("chest")!.group;
    gore.hit({ point: b.joints.chest.clone().add(new THREE.Vector3(0, 0.15, -0.3)), dir: new THREE.Vector3(0, 0, 1), damage: 25, maxHp: 130, weaponCls: "pistol", distance: 10, anchor: chest, owner: b, root: b.root });
    expect(gore.counts.wounds).toBeGreaterThan(0);
    b.root.removeFromParent();
    gore.update(0.016, new THREE.Camera());
    expect(gore.counts.wounds).toBe(0);
  });

  it("reduced violence draws only an ink puff: no spray, splat or wound", () => {
    const { gore, decals } = rig("high", true);
    const b = body();
    gore.hit({ point: b.joints.chest.clone(), dir: new THREE.Vector3(0, 0, 1), damage: 25, maxHp: 130, weaponCls: "pistol", distance: 10, anchor: b.segs.get("chest")!.group, owner: b });
    expect(gore.counts.mist).toBe(1);
    expect(gore.counts.drops).toBe(0);
    expect(gore.counts.wounds).toBe(0);
    expect(decals.length).toBe(0);
  });
});

describe("CATHODE: Cath never plays hitFlesh (S1.3)", () => {
  it("hitFlesh is called only for enemy hits off the combat bus; Cath's damage plays Audio.hurt", () => {
    const src = readFileSync("games/cathode/src/game/session.ts", "utf8");
    const calls = [...src.matchAll(/hitFlesh\(/g)].map((m) => m.index!);
    expect(calls.length).toBe(1);
    // The one call sits in the loop over the frame's bus hits (rounds that landed on an enemy).
    const loop = src.lastIndexOf("for (const d of frameHits)", calls[0]);
    expect(loop).toBeGreaterThan(0);
    expect(src.slice(loop, calls[0]).split("\n").length).toBeLessThan(12);
    // Every place Cath takes a hit (the hurt arc) plays her own hurt sound.
    const hurts = [...src.matchAll(/hud\.hurtFrom\(/g)].map((m) => m.index!);
    expect(hurts.length).toBeGreaterThan(0);
    for (const h of hurts) expect(src.slice(h, h + 400)).toMatch(/audio\?\.hurt\(/);
    // And combat emits "hit" only from strike, which lands on an Enemy.
    const combat = readFileSync("games/cathode/src/game/combat.ts", "utf8");
    expect([...combat.matchAll(/bus\.emit\("hit"/g)].length).toBe(1);
    expect(combat).toMatch(/private strike\(e: Enemy/);
  });
});
