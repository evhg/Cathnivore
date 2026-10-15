import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildDistrict } from "../games/cathode/src/render/levels/index";
import type { Builder, PropRecord } from "../games/cathode/src/render/builder";

/**
 * S1.1's audit rule: a prop at least 0.9 m tall and 4 cm thick, not marked "none", must stop rounds. Only
 * props inside the walkable bounds (plus 2 m) count: a skyline backdrop can't be shot at. A prop flush with a
 * collider (its centre within 15 cm of one) counts as covered, since the wall behind stops the round there.
 */
function auditProps(b: Builder, bounds: { xMin: number; xMax: number; zMin: number; zMax: number }): { audited: number; missing: PropRecord[] } {
  const play = new THREE.Box3(new THREE.Vector3(bounds.xMin - 2, -5, bounds.zMin - 2), new THREE.Vector3(bounds.xMax + 2, 40, bounds.zMax + 2));
  const boxes = [...b.colliders, ...b.shotOnly.map((s) => s.box)];
  const missing: PropRecord[] = [];
  let audited = 0;
  const c = new THREE.Vector3();
  for (const p of b.props) {
    if (p.cover === "none") continue;
    const h = p.bounds.max.y - p.bounds.min.y;
    if (h < 0.9 || p.thick < 0.04 || !play.intersectsBox(p.bounds)) continue;
    audited++;
    if (p.cover === "solid" || p.cover === "thin") continue;
    p.bounds.getCenter(c);
    const covered = boxes.some((x) => x.clone().expandByScalar(0.15).containsPoint(c));
    if (!covered) missing.push(p);
  }
  return { audited, missing };
}

describe("CATHODE collider audit (S1.1)", () => {
  for (const id of ["market", "clinic", "plaza", "tower", "vault"]) {
    it(`${id}: every prop that should stop a round does (100%)`, () => {
      const level = buildDistrict(id, "high");
      const { audited, missing } = auditProps(level.builder, level.theme?.bounds ?? { xMin: -26, xMax: 16, zMin: -70, zMax: 66 });
      const pct = audited ? Math.round(((audited - missing.length) / audited) * 1000) / 10 : 100;
      console.log(`collider audit ${id}: ${audited - missing.length}/${audited} = ${pct}%`);
      if (missing.length)
        console.log(missing.map((p) => `  ${p.key} @ ${p.bounds.getCenter(new THREE.Vector3()).toArray().map((v) => v.toFixed(1)).join(",")} size ${p.bounds.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join("x")}`).join("\n"));
      expect(missing.length).toBe(0);
    });
  }
});
