// The 3D battlefield's ground: a vertex-coloured heightfield that extends well past the playable grid into
// rolling country, with the lanes carved in as rutted dirt tracks, raised high ground, water, building plots
// (with protected land marked), scenery, the corporate gate at each spawn and the farmhouse. Seeded by the
// level id, so a level always looks the same.

import * as THREE from "three";
import { hasTwist, isProtected, laneCellsOf, plotKind, type Level } from "../engine";
import { rng } from "../theme";
import { actLight } from "./palette";
import {
  buildBoat,
  buildCrane,
  buildFarmhouse,
  buildGate,
  buildHouse,
  buildLighthouse,
  buildOffice,
  buildRock,
  buildTowerKeep,
  buildTree,
  buildWall,
  buildWindmill,
} from "./models";
import { matte, glow } from "./palette";

const MARGIN = 9;

let grain: THREE.Texture | null = null;
/** A soft speckle multiplied over the vertex colours, so the ground has grain up close. */
function grainTexture(): THREE.Texture {
  if (grain) return grain;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(128, 128);
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 128 * 128; i++) {
    const v = 215 + r() * 40;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grain = new THREE.CanvasTexture(c);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(24, 24);
  grain.colorSpace = THREE.SRGBColorSpace;
  return grain;
}
const RES = 6; // vertices per cell

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Distance from (x, y) (cell units) to the nearest lane centreline. */
function laneDistance(level: Level, x: number, y: number): number {
  let best = Infinity;
  for (const path of [level.path, level.path2].filter(Boolean) as Array<Level["path"]>) {
    const pts = path.map(([c, r]) => [c + 0.5, r + 0.5] as const);
    // Extend the first segment off the field, where the convoys come from.
    const [a, b] = [pts[0]!, pts[1]!];
    const dx = Math.sign(a[0] - b[0]);
    const dy = Math.sign(a[1] - b[1]);
    const all = [[a[0] + dx * 30, a[1] + dy * 30] as const, ...pts];
    for (let i = 1; i < all.length; i++) {
      const [ax, ay] = all[i - 1]!;
      const [bx, by] = all[i]!;
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
      best = Math.min(best, Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)));
    }
  }
  return best;
}

export interface Ground {
  group: THREE.Group;
  /** Height of the ground at (x, y) in cell units. */
  heightAt: (x: number, y: number) => number;
  farmhouse: THREE.Group;
  water: THREE.Mesh | null;
}

export function buildGround(level: Level): Ground {
  const light = actLight(level.id);
  const rand = rng(level.id * 7919 + 17);
  const group = new THREE.Group();
  const cols = level.cols;
  const rows = level.rows;
  const lane = laneCellsOf(level);
  const high = new Set((level.terrain?.high ?? []).map(([c, r]) => `${c},${r}`));
  const wet = new Set((level.terrain?.water ?? []).map(([c, r]) => `${c},${r}`));
  const act = Math.floor((level.id - 1) / 10);

  // Hills out beyond the field: low noise that rises with distance from the grid.
  const noise = (x: number, y: number) =>
    Math.sin(x * 0.7 + level.id) * Math.cos(y * 0.6 - level.id * 0.3) * 0.5 + Math.sin(x * 0.23 + y * 0.31) * 0.8;
  const heightAt = (x: number, y: number): number => {
    const ox = Math.max(0, -x, x - cols);
    const oy = Math.max(0, -y, y - rows);
    const out = Math.hypot(ox, oy);
    let h = out > 0 ? smooth(Math.min(1, out / 6)) * (1.2 + noise(x, y) * 0.9) : 0;
    const c = Math.floor(x);
    const r = Math.floor(y);
    if (high.has(`${c},${r}`)) {
      const fx = Math.min(x - c, c + 1 - x);
      const fy = Math.min(y - r, r + 1 - y);
      h += 0.32 * smooth(Math.min(1, Math.min(fx, fy) / 0.25));
    }
    const d = laneDistance(level, x, y);
    if (d < 0.5) h -= 0.035 * smooth(1 - d / 0.5);
    return h;
  };

  const W = cols + MARGIN * 2;
  const H = rows + MARGIN * 2;
  const geo = new THREE.PlaneGeometry(W, H, W * RES, H * RES);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const g0 = new THREE.Color(light.grass[0]);
  const g1 = new THREE.Color(light.grass[1]);
  const g2 = new THREE.Color(light.grass[2]);
  const d0 = new THREE.Color(light.dirt[0]);
  const d1 = new THREE.Color(light.dirt[1]);
  const sand = new THREE.Color("#c9b88a");
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cols / 2;
    const y = pos.getZ(i) + rows / 2;
    const h = heightAt(x, y);
    pos.setY(i, h);
    const n = (Math.sin(x * 3.1 + y * 1.7) + Math.sin(x * 1.3 - y * 2.9) + 2) / 4;
    tmp.copy(g0).lerp(n > 0.5 ? g2 : g1, Math.abs(n - 0.5) * 1.6);
    const d = laneDistance(level, x, y);
    if (d < 0.42) {
      // Dirt track with two darker wheel ruts.
      const rut = Math.abs(Math.abs(d) - 0.17) < 0.05 ? 1 : 0;
      tmp.copy(d0).lerp(d1, rut * 0.7 + (Math.sin(x * 9 + y * 7) + 1) * 0.08);
    } else if (d < 0.5) tmp.lerp(d1, 0.7 * (1 - (d - 0.42) / 0.08));
    if (wet.has(`${Math.floor(x)},${Math.floor(y)}`)) tmp.lerp(sand, 0.6);
    // Darken the far hills a touch so the field reads.
    const out = Math.max(0, -x, x - cols, -y, y - rows);
    if (out > 0) tmp.multiplyScalar(1 - Math.min(0.18, out * 0.03));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: grainTexture() }));
  ground.position.set(cols / 2, 0, rows / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // Water on wet plots, and a sea or river along one side in the coastal acts.
  let water: THREE.Mesh | null = null;
  if (wet.size || act === 2 || act === 3 || act === 5) {
    water = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshPhysicalMaterial({ color: "#3d7fa6", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82, clearcoat: 1 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cols / 2, -0.09, rows / 2);
    water.receiveShadow = true;
    group.add(water);
    // Lower the ground under water areas so the plane shows through.
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cols / 2;
      const y = pos.getZ(i) + rows / 2;
      const c = Math.floor(x);
      const r = Math.floor(y);
      const coast = act === 2 ? x < -2.5 : act === 3 ? x > cols + 2.5 : act === 5 ? y > rows + 2.5 : false;
      if (wet.has(`${c},${r}`) || (coast && !lane.has(`${c},${r}`) && laneDistance(level, x, y) > 1.2))
        pos.setY(i, Math.min(pos.getY(i), -0.2 - (coast ? 0.2 : 0)));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // Building plots: a subtle tilled square on every plot; protected land gets a stone marker instead.
  const plotMat = new THREE.MeshStandardMaterial({ color: "#5a4a30", roughness: 1, transparent: true, opacity: 0.22 });
  const plotGeo = new THREE.PlaneGeometry(0.78, 0.78);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (lane.has(`${c},${r}`)) continue;
      const h = heightAt(c + 0.5, r + 0.5);
      if (isProtected(level, c, r)) {
        const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6), matte("#bdb6a6", 0.9));
        marker.position.set(c + 0.5, h + 0.11, r + 0.5);
        marker.castShadow = true;
        group.add(marker);
        continue;
      }
      if (plotKind(level, c, r) === "water") continue;
      const p = new THREE.Mesh(plotGeo, plotMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(c + 0.5, h + 0.012, r + 0.5);
      p.receiveShadow = true;
      group.add(p);
    }

  // Scenery out beyond the field.
  const leaves = [light.grass[1], "#4f7f37", "#5e8f41", act >= 6 ? "#7a7a42" : "#6ea04c"];
  const treeKind = act === 6 ? "dead" : act === 1 || act === 4 ? "pine" : "oak";
  const nDecor = 70;
  for (let i = 0; i < nDecor; i++) {
    const x = -MARGIN + rand() * W;
    const y = -MARGIN + rand() * H;
    if (x > -0.6 && x < cols + 0.6 && y > -0.6 && y < rows + 0.6) continue;
    if (laneDistance(level, x, y) < 1.1) continue;
    const h = heightAt(x, y);
    if (h < -0.05) continue;
    const o = rand() < 0.7 ? buildTree(rand() < 0.25 ? "pine" : treeKind, rand, leaves) : buildRock(rand);
    o.position.set(x, h, y);
    group.add(o);
  }
  // Hedgerows along the field's edge (the game's namesake), broken where the lanes run out.
  const hedgeMats = [matte("#3f6e33"), matte("#4a7a3a"), matte("#355e2c")];
  const blossom = matte("#f3e9f0", 0.6);
  const hedgeAt = (x: number, y: number) => {
    if (laneDistance(level, x, y) < 0.85) return;
    const r = 0.13 + rand() * 0.05;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), hedgeMats[Math.floor(rand() * 3)]!);
    b.position.set(x, heightAt(x, y) + r * 0.8, y);
    b.scale.y = 0.85 + rand() * 0.3;
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
    if (rand() < 0.15) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), blossom);
      f.position.set(x + (rand() - 0.5) * 0.1, heightAt(x, y) + r * 1.6, y + (rand() - 0.5) * 0.1);
      group.add(f);
    }
  };
  for (let c = -0.9; c <= cols + 0.9; c += 0.22)
    for (const r of [-0.62, -0.42, rows + 0.42, rows + 0.62]) hedgeAt(c + (rand() - 0.5) * 0.08, r);
  for (let r = -0.4; r <= rows + 0.4; r += 0.22)
    for (const c of [-0.62, -0.42, cols + 0.42, cols + 0.62]) hedgeAt(c, r + (rand() - 0.5) * 0.08);

  // Each act's landmarks along the far horizon (behind the field, where the camera looks).
  const night = act === 9 || hasTwist(level, "night");
  const spin: THREE.Object3D[] = [];
  const back = (x: number, z: number, o: THREE.Object3D, face = 0) => {
    const h = Math.max(0, heightAt(x, z));
    o.position.set(x, h, z);
    o.rotation.y = face;
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    group.add(o);
  };
  const across = (n: number, z0: number, z1: number, make: (i: number) => THREE.Object3D) => {
    for (let i = 0; i < n; i++) {
      const x = -3 + ((i + 0.5) / n) * (cols + 6) + (rand() - 0.5) * 1.2;
      const z = z0 + rand() * (z1 - z0);
      if (laneDistance(level, x, z) < 1.5) continue;
      back(x, z, make(i), (rand() - 0.5) * 0.6);
    }
  };
  switch (act) {
    case 0:
    case 1: {
      const w = buildWindmill();
      back(cols + 1.8, -2.4, w, -0.4);
      spin.push(w.userData.spin as THREE.Object3D);
      across(3, -3.2, -2.2, () => buildHouse(rand));
      break;
    }
    case 2:
    case 5: {
      back(act === 5 ? cols + 2 : -2.2, -2.6, buildLighthouse());
      across(4, -3.8, -2.4, () => buildBoat(rand));
      across(3, -3, -2.2, () => buildHouse(rand));
      break;
    }
    case 3:
    case 4:
      across(5, -3.2, -2.2, () => buildHouse(rand, night));
      break;
    case 6:
      across(3, -3.6, -2.4, () => buildCrane());
      break;
    case 7:
      across(7, -3.2, -2.2, () => buildHouse(rand, night));
      break;
    case 8:
      across(6, -4.2, -2.6, () => buildOffice(rand, true));
      break;
    case 9:
      back(cols / 2, -2.2, buildWall(cols + 6));
      across(3, -2.9, -2.6, () => buildTowerKeep());
      across(5, -4, -3.2, () => buildHouse(rand, true));
      break;
  }
  group.userData.spin = spin;

  // The corporate gate at each spawn.
  const label = level.id >= 81 ? "HOLLOWCANDOR" : level.id >= 41 && level.id <= 60 ? "CANDOR" : "HOLLOWELL";
  for (const path of [level.path, level.path2].filter(Boolean) as Array<Level["path"]>) {
    const [c, r] = path[0]!;
    const [c2, r2] = path[1]!;
    const dx = Math.sign(c - c2);
    const dy = Math.sign(r - r2);
    const gate = buildGate(label);
    gate.position.set(c + 0.5 + dx * 1.1, heightAt(c + 0.5 + dx * 1.1, r + 0.5 + dy * 1.1), r + 0.5 + dy * 1.1);
    gate.rotation.y = dx !== 0 ? 0 : Math.PI / 2;
    group.add(gate);
  }

  // The farmhouse at the end of the lane.
  const [ec, er] = level.path[level.path.length - 1]!;
  const farmhouse = buildFarmhouse();
  farmhouse.position.set(ec + 0.5, heightAt(ec + 0.5, er + 0.5), er + 0.5);
  const [pc, pr] = level.path[level.path.length - 2]!;
  farmhouse.rotation.y = Math.atan2(pc - ec, pr - er);
  group.add(farmhouse);

  // Lanterns along the lane at night (Kingsmarket, and any night twist).
  if (act === 9 || hasTwist(level, "night")) {
    for (let i = 0; i < 12; i++) {
      const x = rand() * cols;
      const y = rand() * rows;
      const d = laneDistance(level, x, y);
      if (d < 0.55 || d > 0.95) continue;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glow("#ffb85a", 4));
      lamp.position.set(x, heightAt(x, y) + 0.35, y);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 5), matte("#2b2320"));
      post.position.set(x, heightAt(x, y) + 0.17, y);
      group.add(lamp, post);
    }
  }
  return { group, heightAt, farmhouse, water };
}
