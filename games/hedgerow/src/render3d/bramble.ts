import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Plan item 468: one side of the tangle a slowed vehicle is caught in, as a single geometry for the instanced
 * brambles. In its own frame the stems are half arcs in the XY plane (y > 0) and z is height: the instance lays
 * them round the wheels and z climbs the vehicle's side. Three stems at different radii and heights, reddish
 * thorns pointing out along them, and a few leaves, all vertex-coloured so it stays one draw call.
 */
export function brambleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry => {
    const geo = g.index ? g.toNonIndexed() : g;
    const c = new THREE.Color(hex);
    const n = geo.getAttribute("position").count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  };
  // [radius, height, tilt about x, stem colour]: a low stem on the lane, one higher and one leaning in.
  const stems: Array<[number, number, number, string]> = [
    [0.3, 0.0, 0, "#3f6e22"],
    [0.25, 0.09, 0.32, "#4f8228"],
    [0.34, 0.05, -0.22, "#355f1c"],
  ];
  for (const [r, h, tilt, hex] of stems) {
    const arc = new THREE.TorusGeometry(r, 0.03, 5, 14, Math.PI);
    arc.rotateX(tilt);
    arc.translate(0, 0, h);
    parts.push(paint(arc, hex));
    // Thorns every ~25 degrees, pointing out from the stem, alternately up and down.
    for (let i = 1; i < 7; i++) {
      const a = (i / 7) * Math.PI;
      const thorn = new THREE.ConeGeometry(0.028, 0.1, 4);
      thorn.rotateZ(a - Math.PI / 2);
      thorn.rotateY(i % 2 ? 0.5 : -0.5);
      thorn.translate(Math.cos(a) * (r + 0.04), Math.sin(a) * (r + 0.04), 0);
      thorn.rotateX(tilt);
      thorn.translate(0, 0, h);
      parts.push(paint(thorn, "#9a4b2c"));
    }
  }
  // Leaves: flat diamonds standing off the top stem, lit green so the tangle reads as living.
  for (const a of [0.55, 1.6, 2.5]) {
    const leaf = new THREE.OctahedronGeometry(0.06, 0);
    leaf.scale(1.4, 0.7, 0.35);
    leaf.rotateZ(a);
    leaf.translate(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.07);
    parts.push(paint(leaf, "#79c043"));
  }
  // Every part needs the same attributes to merge: drop uvs (the material samples no map).
  for (const p of parts) p.deleteAttribute("uv");
  const merged = mergeGeometries(parts)!;
  merged.computeBoundingSphere();
  return merged;
}
