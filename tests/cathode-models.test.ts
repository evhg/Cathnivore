// C10 "Enforcer v2" (docs/design/cathode-combat.md S3.1, S3.2, performance table): the enemy models' budgets per
// LOD and profile, shared geometry and materials (no per-enemy clones), and the 21-joint rig.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { archGeometry, type Arch, type Lod } from "../games/cathode/src/game/models/enforcer";
import { buildRifle, rifleLod } from "../games/cathode/src/game/models/gear";
import { partsDetail, refine } from "../games/cathode/src/game/models/parts";
import { Body, bodyView, enforcerLook, JOINTS } from "../games/cathode/src/game/body";
import { FX0, SEGMENTS } from "../games/cathode/src/game/rig";

/** S0's table: triangles and draw calls per LOD (desktop and phone). */
const BUDGET = {
  desktop: { tris: [16000, 5000, 1200], calls: [12, 6, 2] },
  phone: { tris: [7000, 2500, 600], calls: [8, 4, 2] },
} as const;

/** What one enemy draws at a LOD: the body's two layers, the cloth at LOD0, and the rifle's meshes for that LOD. */
function cost(arch: Arch, lod: Lod, phone: boolean): { tris: number; calls: number } {
  const g = archGeometry(arch, lod, phone);
  // C15: the layers under the plates (negative plate tags) draw only in place of the plate they replace, which is
  // never smaller (asserted below), so what's drawn at once is the intact set.
  let tris = g.tris - underTris(g.opaque) - underTris(g.glow);
  let calls = (g.opaque.getAttribute("position").count ? 1 : 0) + (g.glow.getAttribute("position").count ? 1 : 0);
  if (lod === 0) {
    // The tabard: 8 strips x 3 quads x 2 faces x 2 triangles (the coat: 10 x 4).
    tris += arch === "sniper" ? 10 * 4 * 4 : 8 * 3 * 4;
    calls += 1;
  }
  const r = buildRifle(phone, arch === "sniper");
  rifleLod(r, lod);
  r.root.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    calls++;
    tris += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3;
  });
  return { tris: Math.round(tris), calls };
}

/** Triangles whose plate tag is negative (C15's under-layers), and per tag. */
function tagTris(geo: THREE.BufferGeometry): Map<number, number> {
  const out = new Map<number, number>();
  const a = geo.getAttribute("aPlate") as THREE.BufferAttribute | undefined;
  if (!a) return out;
  for (let i = 0; i < a.count; i += 3) {
    const t = Math.round(a.getX(i));
    if (t !== 0) out.set(t, (out.get(t) ?? 0) + 1);
  }
  return out;
}
function underTris(geo: THREE.BufferGeometry): number {
  let n = 0;
  for (const [t, c] of tagTris(geo)) if (t < 0) n += c;
  return n;
}

describe("CATHODE enemy models (C15 plates)", () => {
  for (const phone of [false, true])
    for (const arch of ["enforcer", "leader", "riot"] as Arch[])
      it(`${arch} ${phone ? "phone" : "desktop"}: every under-layer draws no more than the plate it replaces`, () => {
        const g = archGeometry(arch, 0, phone);
        const t = tagTris(g.opaque);
        for (const [k, v] of tagTris(g.glow)) t.set(k, (t.get(k) ?? 0) + v);
        for (const [k, v] of t) if (k < 0) expect(v, `slot ${-k}`).toBeLessThanOrEqual(t.get(-k) ?? 0);
        // The plates are tagged at all: chest front, back, both pauldrons, the helmet, the visor.
        for (const k of [1, 2, 3, 4, 5, 6]) expect(t.get(k) ?? 0, `slot ${k}`).toBeGreaterThan(0);
      });
});

describe("CATHODE enemy models (C10)", () => {
  for (const phone of [false, true]) {
    const B = BUDGET[phone ? "phone" : "desktop"];
    for (const arch of ["enforcer", "leader", "riot", "sniper", "orderly", "nurse", "thug", "civilian"] as Arch[])
      for (const lod of [0, 1, 2] as Lod[])
        it(`${arch} LOD${lod} on ${phone ? "phone" : "desktop"} stays inside ${B.tris[lod]} triangles and ${B.calls[lod]} draw calls`, () => {
          const c = cost(arch, lod, phone);
          expect(c.tris).toBeLessThanOrEqual(B.tris[lod]);
          expect(c.calls).toBeLessThanOrEqual(B.calls[lod]);
        });
  }

  it("each LOD is a real step down", () => {
    for (const phone of [false, true]) {
      const t = ([0, 1, 2] as Lod[]).map((l) => archGeometry("enforcer", l, phone).tris);
      expect(t[1]!).toBeLessThan(t[0]! * 0.6);
      expect(t[2]!).toBeLessThan(t[1]! * 0.5);
    }
  });

  it("shares geometry and materials between bodies: no per-enemy clones", () => {
    const a = new Body(enforcerLook(0xffa040));
    const b = new Body(enforcerLook(0xff3040));
    const meshes = (body: Body) => {
      const out: THREE.SkinnedMesh[] = [];
      body.root.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.SkinnedMesh);
      });
      return out;
    };
    const ma = meshes(a);
    const mb = meshes(b);
    expect(ma.length).toBe(mb.length);
    expect(ma.length).toBeGreaterThanOrEqual(6);
    ma.forEach((m, i) => {
      expect(m.material).toBe(mb[i]!.material);
      expect(m.geometry).toBe(mb[i]!.geometry);
      expect(m.skeleton).not.toBe(mb[i]!.skeleton);
    });
    // Two materials for every body in the game, whatever its visor colour.
    expect(new Set(ma.map((m) => m.material)).size).toBe(2);
    // Every piece is rigidly bound to one bone of the skeleton's layout, and carries its flash slot.
    for (const m of ma) {
      const si = m.geometry.getAttribute("skinIndex") as THREE.BufferAttribute;
      const sw = m.geometry.getAttribute("skinWeight") as THREE.BufferAttribute;
      for (let i = 0; i < si.count; i += 97) {
        expect(si.getX(i)).toBeLessThan(FX0);
        expect(sw.getX(i)).toBe(1);
      }
      expect(m.geometry.getAttribute("aSeg")).toBeTruthy();
      expect(m.geometry.getAttribute("aRimN")).toBeTruthy();
    }
  });

  it("stands 1.86 m to the top of the helmet (S3.2), the leader's crest higher still", () => {
    const top = (arch: Arch) => {
      const body = new Body(enforcerLook(0xffa040, arch));
      body.pose();
      body.root.updateMatrixWorld(true);
      let y = -Infinity;
      body.root.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!m.isSkinnedMesh || m.name !== "body:lod0:opaque") return;
        m.skeleton.update();
        const p = m.geometry.getAttribute("position") as THREE.BufferAttribute;
        const v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) y = Math.max(y, m.applyBoneTransform(i, v.fromBufferAttribute(p, i)).y);
      });
      return y;
    };
    const h = top("enforcer");
    expect(h).toBeGreaterThan(1.8);
    expect(h).toBeLessThan(1.92);
    expect(top("leader")).toBeGreaterThan(h + 0.02);
  });

  it("swaps LOD by distance with a dither, and the forced review LOD wins", () => {
    const body = new Body(enforcerLook());
    bodyView.forceLod = -1;
    bodyView.eye.set(0, 1.6, 5);
    body.pose();
    expect(body.lod).toBe(0);
    bodyView.eye.set(0, 1.6, 25);
    body.pose();
    expect(body.lod).toBe(1);
    bodyView.eye.set(0, 1.6, 60);
    body.pose();
    expect(body.lod).toBe(2);
    bodyView.forceLod = 0;
    body.pose();
    expect(body.lod).toBe(0);
    bodyView.forceLod = -1;
    bodyView.eye.set(0, 1.6, 0);
  });
});

describe("CATHODE 21-joint rig (C10, S3.1)", () => {
  it("has 21 joints and 14 segments", () => {
    expect(JOINTS.length).toBe(21);
    expect(SEGMENTS.length).toBe(14);
  });
});

describe("C11 hero detail (the takedown's close-up)", () => {
  it("draws the target at more detail than LOD0, and refining a profile keeps every authored point (corners stay corners)", () => {
    const lod0 = archGeometry("enforcer", 0, false);
    const hero = archGeometry("enforcer", 0, false, true);
    expect(hero.tris).toBeGreaterThan(lod0.tris * 1.8);
    // Same skinning layout, so the body can swap it in on its LOD0 meshes.
    expect(Object.keys(hero.opaque.attributes).sort()).toEqual(Object.keys(lod0.opaque.attributes).sort());
    const prof: [number, number][] = [[0, 0.158], [0.072, 0.146], [0.114, 0.118], [0.14, 0.078], [0.152, 0.036], [0.166, -0.12], [0.16, -0.128]];
    partsDetail.hero = true;
    const r = refine(prof, 0.5);
    partsDetail.hero = false;
    expect(r.length).toBeGreaterThan(prof.length);
    for (const p of prof) expect(r.some((q) => q[0] === p[0] && q[1] === p[1])).toBe(true);
    expect(refine(prof, 0.5)).toBe(prof);
  });
});
