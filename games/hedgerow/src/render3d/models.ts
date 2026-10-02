// Procedural low-poly models for Hedgerow's 3D battlefield. 1 world unit = 1 cell; y is up. Every builder
// returns a Group whose userData names the parts the renderer animates: `turret` (turns to its target),
// `spin` (rotors, sails), `bob` (idles), `arm` (throws), `light` (blinks).

import * as THREE from "three";
import type { EnemyKind, TowerKind } from "../engine";
import { C, chrome, glass, gloss, glow, matte, metal } from "./palette";

type M = THREE.Material;

function mesh(geo: THREE.BufferGeometry, mat: M, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w: number, h: number, d: number, mat: M, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z);
const cyl = (rt: number, rb: number, h: number, mat: M, x = 0, y = 0, z = 0, seg = 10) =>
  mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y + h / 2, z);
const ball = (r: number, mat: M, x = 0, y = 0, z = 0, detail = 1) => mesh(new THREE.IcosahedronGeometry(r, detail), mat, x, y, z);
const cone = (r: number, h: number, mat: M, x = 0, y = 0, z = 0, seg = 8) => mesh(new THREE.ConeGeometry(r, h, seg), mat, x, y + h / 2, z);

function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

const TIER_RING = ["#8a5a35", "#b9c0c8", "#d4ae58"];
const SPEC_RING = ["#e0503a", "#3f8fe0"];

/** The plinth every tower stands on; its rim shows the tier (wood, silver, gold) or the specialisation (glowing). */
function plinth(tier: number, spec: 0 | 1 | null): THREE.Group {
  const g = group(cyl(0.4, 0.44, 0.08, matte(C.stoneDark, 0.95)));
  const rim =
    tier === 4 && spec !== null ? glow(SPEC_RING[spec]!, 1.6) : tier >= 2 ? metal(TIER_RING[tier - 1]!, 0.3) : matte(TIER_RING[0]!);
  const ring = mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 24), rim, 0, 0.08, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return g;
}

export function buildTower(kind: TowerKind, tier: number, spec: 0 | 1 | null): THREE.Group {
  const root = new THREE.Group();
  root.add(plinth(tier, spec));
  const body = new THREE.Group();
  body.position.y = 0.08;
  root.add(body);
  const scale = 1 + (Math.min(tier, 3) - 1) * 0.07;
  body.scale.setScalar(scale);
  const ud = root.userData as Record<string, THREE.Object3D | THREE.Object3D[]>;
  const turret = new THREE.Group();
  ud.turret = turret;
  switch (kind) {
    case "hedgerow": {
      const leaf = spec === 0 ? matte("#2f5a2a") : spec === 1 ? matte("#56743a") : matte(C.leaf);
      const leaf2 = spec === 0 ? matte("#24481f") : matte(C.leafLight);
      const n = 3 + Math.min(tier, 3) + (spec === 1 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = i === 0 ? 0 : 0.2 + (spec === 1 ? 0.06 : 0);
        body.add(ball(0.2 + (i % 2) * 0.04, i % 2 ? leaf : leaf2, Math.cos(a) * r, 0.22 + (i % 3) * 0.05, Math.sin(a) * r, 1));
      }
      const berry = matte(spec === 1 ? "#5b2a5e" : "#e8748b", 0.6);
      for (let i = 0; i < 4 + tier; i++) {
        const a = i * 2.3;
        body.add(ball(0.035, berry, Math.cos(a) * 0.28, 0.25 + (i % 3) * 0.08, Math.sin(a) * 0.28, 0));
      }
      if (spec === 0)
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const t = cone(0.025, 0.14, matte("#e9e1cf"), Math.cos(a) * 0.34, 0.2, Math.sin(a) * 0.34, 4);
          t.rotation.z = -Math.cos(a) * 1.2;
          t.rotation.x = Math.sin(a) * 1.2;
          body.add(t);
        }
      break;
    }
    case "scarecrow": {
      body.add(cyl(0.03, 0.035, 0.75, matte(C.wood)));
      turret.position.y = 0.48;
      body.add(turret);
      const coat = matte(spec === 1 ? "#2f2f3a" : spec === 0 ? "#d9822b" : tier >= 3 ? "#3f6fb5" : "#c4433a");
      turret.add(box(0.3, 0.3, 0.18, coat, 0, -0.18, 0));
      const arm = new THREE.Group();
      arm.add(box(0.7, 0.05, 0.05, matte(C.wood), 0, -0.02, 0));
      arm.add(box(0.12, 0.08, 0.08, coat, -0.3, -0.04, 0), box(0.12, 0.08, 0.08, coat, 0.3, -0.04, 0));
      turret.add(arm);
      ud.arm = arm;
      const head = ball(spec === 0 ? 0.15 : 0.12, matte(spec === 0 ? "#e98a2b" : "#e6cf9a"), 0, 0.16, 0, 1);
      turret.add(head);
      // A face, so it reads as a scarecrow from any angle.
      turret.add(ball(0.02, matte(C.ink), -0.045, 0.18, 0.11, 0), ball(0.02, matte(C.ink), 0.045, 0.18, 0.11, 0));
      const hatMat = matte(spec === 1 ? "#3a3340" : C.straw);
      const brim = cyl(0.2, 0.2, 0.025, hatMat, 0, 0.24, 0, 14);
      turret.add(brim, cone(0.11, 0.16, hatMat, 0, 0.26, 0, 10));
      if (spec === 1)
        for (const side of [-1, 1]) {
          const crow = group(ball(0.06, matte("#1d1b22"), 0, 0, 0, 0), cone(0.02, 0.06, matte(C.gold), 0.06 * side, 0.01, 0, 4));
          crow.position.set(0.32 * side, 0.03, 0);
          turret.add(crow);
        }
      if (tier >= 3) turret.add(box(0.08, 0.04, 0.02, glow("#ffd76a", 0.8), 0, -0.05, 0.1));
      break;
    }
    case "beehive": {
      const straw = matte(spec === 0 ? "#c98a3a" : spec === 1 ? "#e8b13c" : "#d9a649");
      body.add(box(0.5, 0.06, 0.5, matte(C.wood)));
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push(new THREE.Vector2(0.3 * Math.sin(Math.acos(t * 0.95)) + 0.02 * Math.sin(t * 40), t * 0.55));
      }
      const skep = mesh(new THREE.LatheGeometry(pts, 14), straw, 0, 0.06, 0);
      body.add(skep);
      body.add(cyl(0.05, 0.05, 0.02, matte(C.ink), 0, 0.12, 0.27));
      if (spec === 0) {
        const crown = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          crown.add(cone(0.03, 0.09, metal(C.gold, 0.3), Math.cos(a) * 0.08, 0.6, Math.sin(a) * 0.08, 4));
        }
        body.add(crown);
      }
      if (spec === 1)
        for (let i = 0; i < 4; i++) {
          const a = i * 1.6;
          body.add(cone(0.035, 0.12, gloss("#f0b429", 0), Math.cos(a) * 0.27, 0.08, Math.sin(a) * 0.27, 6));
        }
      // Bees: little glowing dots that orbit (animated by the renderer).
      const bees = new THREE.Group();
      for (let i = 0; i < 3 + Math.min(tier, 3); i++) bees.add(ball(0.025, glow("#ffd23f", 1.2), 0, 0, 0, 0));
      bees.position.y = 0.4;
      body.add(bees);
      ud.bees = bees;
      break;
    }
    case "stall": {
      body.add(box(0.62, 0.26, 0.36, matte(C.wood)));
      const goods = spec === 1 ? ["#e8c27a", "#e8c27a", "#e8c27a"] : ["#d4544a", "#f2c94c", "#5f8f3f", "#e98a2b"];
      goods.forEach((g, i) => body.add(ball(0.055, matte(g, 0.5), -0.21 + i * (0.42 / (goods.length - 1)), 0.31, 0.06, 0)));
      for (const x of [-0.29, 0.29]) body.add(box(0.03, 0.62, 0.03, matte(C.wood), x, 0, -0.15));
      const awn = spec === 0 ? "#3f6fb5" : spec === 1 ? "#e98a2b" : "#c4433a";
      for (let i = 0; i < 5; i++) {
        const strip = box(0.14, 0.03, 0.46, matte(i % 2 ? C.cream : awn), -0.28 + i * 0.14, 0.6, 0.02);
        strip.rotation.x = 0.35;
        body.add(strip);
      }
      body.add(cyl(0.05, 0.05, 0.015, metal(C.gold, 0.25), 0.2, 0.26, 0.12, 12));
      break;
    }
    case "pond": {
      const wide = spec === 1 ? 1.25 : 1;
      body.add(cyl(0.4 * wide, 0.42 * wide, 0.05, matte(C.stoneDark), 0, 0, 0, 16));
      const water = mesh(new THREE.CylinderGeometry(0.34 * wide, 0.34 * wide, 0.02, 20), gloss(spec === 1 ? "#5f8f7a" : C.water, 0.1), 0, 0.05, 0);
      body.add(water);
      ud.water = water;
      const ducks = new THREE.Group();
      const n = spec === 0 ? 2 : Math.min(tier, 3);
      for (let i = 0; i < n; i++) {
        const goose = spec === 0;
        const duck = group(
          ball(goose ? 0.08 : 0.065, matte(goose ? "#f4f1ea" : "#f2c94c"), 0, 0.09, 0, 1),
          ball(goose ? 0.04 : 0.035, matte(goose ? "#f4f1ea" : "#3f7a4a"), 0.06, goose ? 0.2 : 0.15, 0, 1),
          cone(0.02, 0.05, matte("#e98a2b"), 0.1, goose ? 0.19 : 0.14, 0, 4),
        );
        duck.children[2]!.rotation.z = -Math.PI / 2;
        duck.userData.phase = i * 2.1;
        ducks.add(duck);
      }
      body.add(ducks);
      ud.ducks = ducks;
      if (spec === 1)
        for (let i = 0; i < 3; i++) body.add(cyl(0.07, 0.07, 0.01, matte(C.leafLight), Math.cos(i * 2) * 0.22, 0.065, Math.sin(i * 2) * 0.22, 8));
      break;
    }
    case "barn": {
      const red = matte(spec === 1 ? "#b8863e" : C.red);
      body.add(box(0.58, 0.36, 0.44, red));
      const roof = new THREE.Shape();
      roof.moveTo(-0.33, 0);
      roof.lineTo(-0.2, 0.2);
      roof.lineTo(0.2, 0.2);
      roof.lineTo(0.33, 0);
      roof.lineTo(-0.33, 0);
      const roofMesh = mesh(new THREE.ExtrudeGeometry(roof, { depth: 0.5, bevelEnabled: false }), matte(C.woodDark), 0, 0.36, -0.25);
      body.add(roofMesh);
      body.add(box(0.2, 0.24, 0.01, matte(C.cream), 0, 0, 0.225));
      const x1 = box(0.27, 0.025, 0.012, matte(C.red), 0, 0.12, 0.232);
      x1.rotation.z = 0.8;
      const x2 = x1.clone();
      x2.rotation.z = -0.8;
      body.add(x1, x2);
      if (spec === 0) {
        const tractor = group(
          box(0.2, 0.12, 0.14, gloss("#3f8a3d", 0.1), 0, 0.04, 0),
          box(0.08, 0.1, 0.1, glass(), -0.04, 0.16, 0),
          cyl(0.07, 0.07, 0.04, matte(C.ink), 0.06, 0.07, 0.08, 10),
          cyl(0.05, 0.05, 0.04, matte(C.ink), -0.08, 0.05, 0.08, 10),
        );
        tractor.children[2]!.rotation.x = Math.PI / 2;
        tractor.children[3]!.rotation.x = Math.PI / 2;
        tractor.position.set(0.42, 0, 0.1);
        body.add(tractor);
        ud.tractor = tractor;
      }
      if (spec === 1)
        for (const x of [-0.38, 0.38]) {
          const bale = cyl(0.1, 0.1, 0.16, matte(C.straw), x, 0.1, 0.12, 12);
          bale.rotation.x = Math.PI / 2;
          body.add(bale);
        }
      break;
    }
    case "silo": {
      const w = spec === 1 ? 0.24 : 0.18;
      const shell = spec === 0 ? metal("#6f9a4a", 0.45) : metal("#c7ccd1", 0.35);
      body.add(cyl(w, w, 0.75, shell, 0, 0, 0, 16));
      for (let i = 1; i < 5; i++) {
        const band = mesh(new THREE.TorusGeometry(w + 0.005, 0.012, 4, 20), metal("#7a8086"), 0, i * 0.15, 0);
        band.rotation.x = Math.PI / 2;
        body.add(band);
      }
      const dome = mesh(new THREE.SphereGeometry(w, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, 0.75, 0);
      body.add(dome);
      turret.position.y = 0.6;
      body.add(turret);
      const spout = cyl(0.04, 0.05, 0.3, metal("#8a8f94"), 0, 0, 0, 8);
      spout.rotation.z = -Math.PI / 2;
      spout.position.set(w + 0.12, 0, 0);
      turret.add(spout);
      body.add(box(0.06, 0.06, 0.02, glow("#ffd76a", 1), 0, 0.5, w));
      break;
    }
    case "mast": {
      const lattice = metal("#5a5e63", 0.5);
      for (const [x, z] of [
        [-0.14, -0.14],
        [0.14, -0.14],
        [0.14, 0.14],
        [-0.14, 0.14],
      ] as const) {
        const leg = cyl(0.015, 0.02, 1.05, lattice, x * 0.5, 0, z * 0.5, 5);
        leg.rotation.z = -x * 0.25;
        leg.rotation.x = z * 0.25;
        leg.position.set(x, 0, z);
        body.add(leg);
      }
      for (let i = 1; i < 5; i++) body.add(box(0.28 - i * 0.04, 0.012, 0.012, lattice, 0, i * 0.2, 0));
      turret.position.y = 1.0;
      body.add(turret);
      const dish = mesh(new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), metal("#d9dde2", 0.3), 0, 0, 0);
      dish.rotation.x = -Math.PI / 2;
      dish.position.z = 0.04;
      turret.add(dish);
      const lamp = ball(0.04, glow(spec === 1 ? "#ff3b30" : "#ff6a3a", 3), 0, 0.12, 0, 1);
      turret.add(lamp);
      ud.light = lamp;
      if (spec === 0) turret.add(box(0.14, 0.09, 0.005, matte(C.ink), 0, 0.22, 0));
      break;
    }
    case "tent": {
      const cloth = matte(spec === 1 ? "#f2e6c8" : "#fffbe6");
      const t = cone(0.38, 0.6, cloth, 0, 0, 0, 4);
      t.rotation.y = Math.PI / 4;
      body.add(t);
      body.add(box(0.06, 0.18, 0.01, glow("#3fbf8a", 0.8), 0, 0.22, 0.27), box(0.18, 0.06, 0.01, glow("#3fbf8a", 0.8), 0, 0.28, 0.27));
      if (spec === 1) {
        const urn = group(cyl(0.08, 0.1, 0.22, metal("#b8bcc2"), 0, 0, 0, 12), cyl(0.02, 0.02, 0.05, metal("#8a8f94"), 0.1, 0.06, 0, 6));
        urn.position.set(0.32, 0, 0.18);
        body.add(urn);
      }
      if (spec === 0) body.add(cyl(0.01, 0.01, 0.3, matte(C.ink), 0, 0.6, 0, 4), box(0.14, 0.08, 0.01, matte("#c4433a"), 0.07, 0.8, 0));
      break;
    }
    case "court": {
      const stone = matte(spec === 0 ? "#e6dcc6" : "#ece6da", 0.7);
      body.add(box(0.72, 0.06, 0.5, matte(C.stoneDark)));
      for (let i = 0; i < 4; i++) body.add(cyl(0.035, 0.04, 0.36, stone, -0.27 + i * 0.18, 0.06, 0.15, 8));
      body.add(box(0.62, 0.36, 0.3, stone, 0, 0.06, -0.08));
      const ped = new THREE.Shape();
      ped.moveTo(-0.38, 0);
      ped.lineTo(0, 0.18);
      ped.lineTo(0.38, 0);
      ped.lineTo(-0.38, 0);
      body.add(mesh(new THREE.ExtrudeGeometry(ped, { depth: 0.5, bevelEnabled: false }), stone, 0, 0.42, -0.25));
      turret.position.set(0, 0.52, 0.27);
      body.add(turret);
      turret.add(box(0.2, 0.012, 0.012, metal(C.gold, 0.3)), ball(0.03, metal(C.gold, 0.3), -0.1, -0.03, 0, 0), ball(0.03, metal(C.gold, 0.3), 0.1, -0.03, 0, 0));
      if (spec === 1) for (let i = 0; i < 3; i++) body.add(box(0.12, 0.004, 0.16, matte("#fffdf6"), 0.3 + i * 0.02, 0.07 + i * 0.01, 0.2));
      break;
    }
    case "hall": {
      body.add(box(0.66, 0.42, 0.46, matte("#b36a4a")));
      const ped = new THREE.Shape();
      ped.moveTo(-0.38, 0);
      ped.lineTo(0, 0.22);
      ped.lineTo(0.38, 0);
      ped.lineTo(-0.38, 0);
      body.add(mesh(new THREE.ExtrudeGeometry(ped, { depth: 0.5, bevelEnabled: false }), matte(C.woodDark), 0, 0.42, -0.25));
      body.add(box(0.14, 0.22, 0.01, matte(C.cream), 0, 0, 0.235));
      for (const x of [-0.2, 0.2]) body.add(box(0.1, 0.1, 0.01, glow("#ffe39a", 0.9), x, 0.22, 0.235));
      body.add(cyl(0.01, 0.01, 0.4, matte(C.ink), 0.26, 0.42, 0.18, 4));
      const banner = box(0.18, 0.12, 0.01, matte(spec === 0 ? "#c4433a" : spec === 1 ? C.gold : "#3f6fb5"), 0.36, 0.7, 0.18);
      body.add(banner);
      ud.flag = banner;
      break;
    }
  }
  if (!turret.parent) body.add(turret);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

// ---- enemies ----

export function enemyScale(kind: EnemyKind): number {
  switch (kind) {
    case "drone":
      return 0.75;
    case "lawyer":
    case "influencer":
      return 0.85;
    case "boss":
    case "convoy":
    case "megadozer":
    case "clinic":
    case "blimp":
      return 1.6;
    case "ship":
    case "swarm":
    case "bus":
    case "board":
      return 1.75;
    case "hollowcandor":
      return 2.2;
    case "candor":
      return 1.5;
    case "director":
    case "remnant":
      return 1.1;
    default:
      return 1;
  }
}

export function enemyLift(kind: EnemyKind): number {
  return kind === "drone" ? 0.55 : kind === "blimp" ? 0.9 : kind === "candor" || kind === "hollowcandor" ? 0.2 : 0;
}

interface VehicleOpts {
  len: number;
  h: number;
  w?: number;
  body: string;
  cab?: string;
  stripe?: string;
  wheels?: number;
  matteBody?: boolean;
}

/** A vehicle facing +x, wheels on the ground. */
function vehicle(o: VehicleOpts): THREE.Group {
  const g = new THREE.Group();
  const w = o.w ?? 0.3;
  const bodyMat = o.matteBody ? matte(o.body, 0.7, false) : gloss(o.body);
  const wr = 0.07;
  g.add(box(o.len * 0.72, o.h, w, bodyMat, -o.len * 0.14, wr, 0));
  g.add(box(o.len * 0.26, o.h * 0.78, w * 0.96, o.cab ? gloss(o.cab) : bodyMat, o.len * 0.36, wr, 0));
  g.add(box(o.len * 0.02, o.h * 0.34, w * 0.82, glass(), o.len * 0.495, wr + o.h * 0.38, 0));
  for (const side of [-1, 1]) g.add(box(o.len * 0.18, o.h * 0.28, 0.005, glass(), o.len * 0.36, wr + o.h * 0.42, (side * w * 0.965) / 2));
  if (o.stripe) for (const side of [-1, 1]) g.add(box(o.len * 0.7, o.h * 0.14, 0.006, glow(o.stripe, 0.6), -o.len * 0.14, wr + o.h * 0.35, (side * (w + 0.004)) / 2));
  for (const side of [-1, 1]) g.add(ball(0.025, glow("#fff2b0", 2.5), o.len * 0.5, wr + o.h * 0.18, side * w * 0.33, 0));
  const n = o.wheels ?? 2;
  const wheels: THREE.Object3D[] = [];
  for (let i = 0; i < n; i++)
    for (const side of [-1, 1]) {
      const wh = cyl(wr, wr, 0.05, matte("#1d1b1b", 0.9, false), -o.len * 0.32 + (i * o.len * 0.66) / Math.max(1, n - 1), wr - 0.025, (side * w) / 2, 10);
      wh.rotation.x = Math.PI / 2;
      wh.position.y = wr;
      g.add(wh);
      wheels.push(wh);
    }
  g.userData.wheels = wheels;
  return g;
}

function crown(y: number, w: number): THREE.Group {
  const g = new THREE.Group();
  const gold = metal(C.gold, 0.25);
  const ring = mesh(new THREE.TorusGeometry(w, w * 0.18, 6, 16), gold, 0, y, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(cone(w * 0.22, w * 0.6, gold, Math.cos(a) * w, y, Math.sin(a) * w, 4));
  }
  return g;
}

function person(suit: string, head = "#efd6c4"): THREE.Group {
  const g = new THREE.Group();
  const legs = new THREE.Group();
  for (const z of [-0.04, 0.04]) legs.add(box(0.05, 0.2, 0.05, matte("#2b2b30"), 0, 0, z));
  g.add(legs);
  g.add(box(0.16, 0.24, 0.2, matte(suit, 0.6), 0, 0.2, 0));
  g.add(ball(0.075, matte(head, 0.6), 0, 0.52, 0, 1));
  g.userData.legs = legs;
  return g;
}

export function buildEnemy(kind: EnemyKind): THREE.Group {
  let g: THREE.Group;
  switch (kind) {
    case "van":
      g = vehicle({ len: 0.62, h: 0.3, body: "#f4f6f8", stripe: C.teal });
      break;
    case "phantom":
      g = vehicle({ len: 0.62, h: 0.3, body: "#2a2b30", cab: "#202126", matteBody: true });
      for (const side of [-1, 1]) g.add(ball(0.025, glow("#ff3b30", 3), 0.31, 0.2, side * 0.1, 0));
      break;
    case "truck":
      g = vehicle({ len: 0.78, h: 0.36, body: "#d93a2f", stripe: "#ffe66b", wheels: 3 });
      break;
    case "tender":
      g = vehicle({ len: 0.7, h: 0.24, body: "#8fb8d6", cab: "#d9e6ef", stripe: "#2f5a7a" });
      break;
    case "director":
      g = vehicle({ len: 0.82, h: 0.22, body: "#16181d", cab: "#16181d", stripe: C.gold });
      break;
    case "clinic":
      g = vehicle({ len: 0.72, h: 0.36, body: "#f7fbfa", stripe: "#7fd1b9", wheels: 3 });
      g.add(box(0.06, 0.16, 0.005, glow("#2fd19c", 2), -0.1, 0.18, 0.16), box(0.16, 0.06, 0.005, glow("#2fd19c", 2), -0.1, 0.23, 0.16));
      break;
    case "boss":
      g = vehicle({ len: 0.72, h: 0.36, body: "#16171c", cab: "#22232a", stripe: C.gold, wheels: 3 });
      g.add(crown(0.5, 0.09));
      break;
    case "convoy":
      g = vehicle({ len: 0.84, h: 0.38, body: "#d93a2f", stripe: "#ffe66b", wheels: 4 });
      g.add(crown(0.52, 0.09));
      break;
    case "bus":
      g = vehicle({ len: 0.9, h: 0.4, body: "#f2f4f7", stripe: "#d93a2f", wheels: 3 });
      g.add(box(0.5, 0.1, 0.005, glow("#2a6fd9", 1.5), -0.1, 0.32, 0.155));
      break;
    case "board":
      g = vehicle({ len: 0.96, h: 0.24, body: "#16181d", cab: "#16181d", stripe: C.gold, wheels: 3 });
      for (let i = 0; i < 4; i++) g.add(ball(0.045, matte("#e9d7c7"), -0.3 + i * 0.13, 0.38, 0, 1));
      g.add(crown(0.48, 0.08));
      break;
    case "ship": {
      g = new THREE.Group();
      const hull = new THREE.Shape();
      hull.moveTo(-0.45, 0.24);
      hull.lineTo(0.48, 0.24);
      hull.lineTo(0.38, 0.06);
      hull.lineTo(-0.42, 0.06);
      hull.lineTo(-0.45, 0.24);
      const h = mesh(new THREE.ExtrudeGeometry(hull, { depth: 0.3, bevelEnabled: false }), gloss("#2f5a7a"), 0, 0, -0.15);
      g.add(h);
      const cols = ["#d93a2f", C.teal, "#f2c94c", "#5b6f8a"];
      for (let i = 0; i < 6; i++) g.add(box(0.17, 0.11, 0.26, matte(cols[i % 4]!, 0.6), -0.32 + (i % 3) * 0.18, 0.24 + Math.floor(i / 3) * 0.11, 0));
      g.add(box(0.14, 0.26, 0.24, gloss("#f4f6f8"), 0.3, 0.24, 0));
      g.add(box(0.12, 0.04, 0.005, glow("#bfe8ff", 1.5), 0.3, 0.42, 0.122));
      const wheels: THREE.Object3D[] = [];
      for (let i = 0; i < 4; i++)
        for (const side of [-1, 1]) {
          const wh = cyl(0.06, 0.06, 0.05, matte("#1d1b1b"), -0.33 + i * 0.22, 0, side * 0.15, 10);
          wh.rotation.x = Math.PI / 2;
          wh.position.y = 0.06;
          g.add(wh);
          wheels.push(wh);
        }
      g.userData.wheels = wheels;
      break;
    }
    case "bulldozer":
    case "megadozer": {
      g = new THREE.Group();
      g.add(box(0.5, 0.12, 0.34, matte("#2f2f2f", 0.9), -0.04, 0, 0));
      g.add(box(0.38, 0.22, 0.28, gloss("#f2b51f", 0.15), -0.06, 0.12, 0));
      g.add(box(0.2, 0.2, 0.22, gloss("#f2b51f", 0.15), -0.12, 0.34, 0));
      g.add(box(0.21, 0.1, 0.18, glass(), -0.12, 0.42, 0));
      g.add(box(0.05, 0.22, 0.42, metal("#9aa0a6", 0.35), 0.28, 0.02, 0));
      if (kind === "megadozer") g.add(crown(0.62, 0.08));
      g.add(ball(0.025, glow("#ff9a1a", 3), -0.12, 0.56, 0, 0));
      break;
    }
    case "drone": {
      g = new THREE.Group();
      g.add(box(0.26, 0.07, 0.26, gloss("#e6eaee", 0.2), 0, 0, 0));
      const rotors: THREE.Object3D[] = [];
      for (const [x, z] of [
        [0.18, 0.18],
        [-0.18, 0.18],
        [0.18, -0.18],
        [-0.18, -0.18],
      ] as const) {
        g.add(box(0.2, 0.02, 0.02, metal("#5a5e63"), x / 2, 0.04, z / 2).rotateY(Math.atan2(z, x)));
        const r = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.005, 12), new THREE.MeshBasicMaterial({ color: "#cfd6dc", transparent: true, opacity: 0.35 }), x, 0.08, z);
        g.add(r);
        rotors.push(r);
      }
      g.userData.rotors = rotors;
      g.add(ball(0.02, glow("#ff3b30", 3), 0.13, 0.03, 0, 0));
      g.add(box(0.14, 0.11, 0.14, matte("#c79a62"), 0, -0.16, 0));
      g.add(box(0.145, 0.02, 0.145, glow(C.teal, 0.6), 0, -0.12, 0));
      break;
    }
    case "influencer": {
      g = new THREE.Group();
      g.add(box(0.36, 0.02, 0.08, metal("#5a5e63"), 0, 0.06, 0));
      for (const x of [-0.16, 0.16]) {
        const w = cyl(0.05, 0.05, 0.03, matte("#1d1b1b"), x, 0.05, 0, 10);
        w.rotation.x = Math.PI / 2;
        w.position.y = 0.05;
        g.add(w);
      }
      g.add(cyl(0.012, 0.012, 0.4, metal("#5a5e63"), 0.15, 0.06, 0, 5));
      const p = person("#f27ab0", "#f3d2c1");
      p.position.y = 0.08;
      g.add(p);
      const ring = mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20), glow("#ffd6ea", 3), 0.16, 0.8, 0);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
      g.userData.legs = p.userData.legs;
      break;
    }
    case "blimp": {
      g = new THREE.Group();
      const env = mesh(new THREE.SphereGeometry(0.42, 20, 12), gloss("#f27ab0", 0.1), 0, 0.3, 0);
      env.scale.set(1, 0.48, 0.48);
      g.add(env);
      for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const fin = box(0.14, 0.12, 0.01, gloss("#e05a98", 0.1), -0.42, 0.24, 0);
        fin.rotation.x = r;
        g.add(fin);
      }
      g.add(box(0.36, 0.18, 0.005, glow("#ffffff", 1.6), 0, 0.28, 0.2));
      g.add(box(0.2, 0.07, 0.1, gloss("#f4f6f8"), 0, 0.06, 0));
      g.add(crown(0.56, 0.08));
      break;
    }
    case "lawyer":
      g = person("#4a5260");
      g.add(box(0.12, 0.09, 0.03, matte("#3a2a24"), 0.02, 0.1, 0.13));
      break;
    case "swarm": {
      g = new THREE.Group();
      const legsAll: THREE.Object3D[] = [];
      for (let i = 0; i < 5; i++) {
        const p = person("#2f343c");
        p.position.set((i % 3) * 0.17 - 0.17, 0, Math.floor(i / 3) * 0.2 - 0.1);
        p.scale.setScalar(0.8);
        g.add(p);
        legsAll.push(p.userData.legs as THREE.Object3D);
      }
      g.add(crown(0.56, 0.07));
      g.userData.legsAll = legsAll;
      break;
    }
    case "hollowcandor":
    case "candor":
    case "remnant": {
      g = new THREE.Group();
      const R = kind === "hollowcandor" ? 0.32 : kind === "candor" ? 0.26 : 0.17;
      const core =
        kind === "remnant"
          ? mesh(new THREE.OctahedronGeometry(R, 0), chrome("#9aa3b5"), 0, R, 0)
          : mesh(new THREE.SphereGeometry(R, 24, 16), chrome(kind === "hollowcandor" ? "#c8ccd8" : "#e4e8f0"), 0, R, 0);
      g.add(core);
      const eye = mesh(new THREE.SphereGeometry(R * 0.3, 16, 10), glow(kind === "hollowcandor" ? "#ff2a2a" : "#2ae0d0", 4), R * 0.82, R * 1.05, 0);
      eye.scale.set(0.5, 1, 1);
      g.add(eye);
      if (kind !== "remnant") {
        const rings = new THREE.Group();
        for (let i = 0; i < (kind === "hollowcandor" ? 3 : 2); i++) {
          const ring = mesh(new THREE.TorusGeometry(R * (1.25 + i * 0.18), 0.012, 6, 40), glow(kind === "hollowcandor" ? "#ff5a3a" : "#5ae0f0", 1.5), 0, R, 0);
          ring.rotation.x = Math.PI / 2 + i * 0.5;
          rings.add(ring);
        }
        g.add(rings);
        g.userData.rings = rings;
      }
      if (kind === "hollowcandor") g.add(crown(R * 2.15, 0.12));
      break;
    }
  }
  const root = new THREE.Group();
  g.scale.multiplyScalar(enemyScale(kind));
  root.add(g);
  root.userData.inner = g;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return root;
}

// ---- Cath ----

/** Cath: an olive field jacket over a cream blouse, slim trousers, boots, a rolling pin; her head is her portrait. */
export function buildCath(faceTexture: THREE.Texture | null): THREE.Group {
  const root = new THREE.Group();
  const fig = new THREE.Group();
  root.add(fig);
  const legs: THREE.Object3D[] = [];
  for (const z of [-0.05, 0.05]) {
    const leg = new THREE.Group();
    leg.position.set(0, 0.24, z);
    leg.add(box(0.06, 0.22, 0.06, matte("#3a3340", 0.7), 0, -0.24, 0));
    leg.add(box(0.08, 0.05, 0.07, matte("#5a3a28", 0.5), 0.015, -0.26, 0));
    fig.add(leg);
    legs.push(leg);
  }
  // Jacket: a gently flared lathe, collar up.
  const pts = [new THREE.Vector2(0.12, 0), new THREE.Vector2(0.11, 0.1), new THREE.Vector2(0.1, 0.2), new THREE.Vector2(0.11, 0.26), new THREE.Vector2(0.05, 0.3)];
  const jacket = mesh(new THREE.LatheGeometry(pts, 12), matte(C.olive, 0.7), 0, 0.22, 0);
  fig.add(jacket);
  fig.add(box(0.02, 0.1, 0.08, matte("#F7F0E3", 0.5), 0.1, 0.38, 0));
  fig.add(ball(0.012, glow("#ffe9a8", 1), 0.112, 0.44, 0.02, 0));
  const arm = new THREE.Group();
  arm.position.set(0, 0.48, 0.12);
  arm.add(box(0.05, 0.18, 0.05, matte("#56623A", 0.7), 0, -0.14, 0));
  const pin = cyl(0.025, 0.025, 0.26, matte("#d9b384", 0.6), 0, -0.3, 0, 8);
  pin.rotation.z = Math.PI / 2;
  pin.position.set(0.05, -0.24, 0.02);
  arm.add(pin);
  fig.add(arm);
  const arm2 = new THREE.Group();
  arm2.position.set(0, 0.48, -0.12);
  arm2.add(box(0.05, 0.18, 0.05, matte("#56623A", 0.7), 0, -0.14, 0));
  fig.add(arm2);
  // Hair falling down her back.
  fig.add(box(0.05, 0.3, 0.2, matte("#2E211C", 0.5), -0.07, 0.32, 0));
  // Her face, always turned to the camera.
  if (faceTexture) {
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTexture, transparent: true }));
    head.scale.set(0.42, 0.5, 1);
    head.position.set(0, 0.72, 0);
    root.add(head);
    root.userData.head = head;
  }
  fig.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  root.userData.legs = legs;
  root.userData.arm = arm;
  root.userData.fig = fig;
  return root;
}

// ---- landmarks ----

export function buildFarmhouse(): THREE.Group {
  const g = new THREE.Group();
  // Whitewashed walls, a pitched red roof of two slabs, gable ends, a chimney, a green door, lit windows.
  g.add(box(0.74, 0.46, 0.56, matte(C.cream, 0.8)));
  const roofMat = matte(C.red, 0.7);
  for (const side of [-1, 1]) {
    const slab = box(0.84, 0.04, 0.38, roofMat, 0, 0, 0);
    slab.position.set(0, 0.6, side * 0.15);
    slab.rotation.x = side * 0.72;
    g.add(slab);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-0.28, 0);
  gable.lineTo(0, 0.26);
  gable.lineTo(0.28, 0);
  gable.lineTo(-0.28, 0);
  const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: 0.72, bevelEnabled: false });
  const gables = mesh(gableGeo, matte(C.cream, 0.8), -0.36, 0.46, 0);
  gables.rotation.y = Math.PI / 2;
  g.add(gables);
  g.add(box(0.1, 0.28, 0.1, matte("#8a5a35"), 0.2, 0.55, -0.1));
  g.add(box(0.14, 0.26, 0.01, matte(C.leaf), 0, 0, 0.285));
  for (const x of [-0.24, 0.24]) g.add(box(0.12, 0.12, 0.01, glow("#ffd98a", 1.2), x, 0.22, 0.285));
  for (const x of [-0.24, 0.24]) g.add(box(0.14, 0.04, 0.05, matte("#e8748b", 0.6), x, 0.14, 0.3));
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  g.userData.chimney = new THREE.Vector3(0.2, 0.86, -0.1);
  return g;
}

export function buildGate(label: string): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-0.55, 0.55]) g.add(box(0.12, 0.9, 0.12, gloss("#cfd6dc", 0.6), 0, 0, z));
  g.add(box(0.1, 0.22, 1.2, gloss(C.teal, 0.2), 0, 0.9, 0));
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1f8a8a";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#f4fbfb";
    ctx.font = "bold 56px 'Atkinson Hyperlegible', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 256, 50);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.2), new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.6 }));
  sign.position.set(0.055, 1.01, 0);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  const back = sign.clone();
  back.position.x = -0.055;
  back.rotation.y = -Math.PI / 2;
  g.add(back);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

export function buildTree(kind: "oak" | "pine" | "dead", rand: () => number, leafColors: string[]): THREE.Group {
  const g = new THREE.Group();
  if (kind === "pine") {
    g.add(cyl(0.05, 0.07, 0.3, matte(C.woodDark)));
    for (let i = 0; i < 3; i++) g.add(cone(0.42 - i * 0.1, 0.5, matte(i % 2 ? "#3f6a3a" : "#467548"), 0, 0.25 + i * 0.28, 0, 7));
  } else if (kind === "dead") {
    g.add(cyl(0.04, 0.07, 0.8, matte("#5b4636")));
    const b = cyl(0.02, 0.03, 0.4, matte("#5b4636"), 0.1, 0.5, 0);
    b.rotation.z = -0.8;
    g.add(b);
  } else {
    g.add(cyl(0.06, 0.09, 0.45, matte(C.woodDark)));
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const r = i === 0 ? 0 : 0.18;
      g.add(ball(0.26 + rand() * 0.1, matte(leafColors[Math.floor(rand() * leafColors.length)]!), Math.cos(a) * r, 0.62 + rand() * 0.2, Math.sin(a) * r, 1));
    }
  }
  const s = 0.8 + rand() * 0.5;
  g.scale.setScalar(s);
  g.rotation.y = rand() * Math.PI * 2;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function buildRock(rand: () => number): THREE.Mesh {
  const m = mesh(new THREE.DodecahedronGeometry(0.16 + rand() * 0.14, 0), matte(rand() > 0.5 ? "#a9a296" : "#8f897d", 0.95));
  m.scale.set(1, 0.6 + rand() * 0.3, 1);
  m.rotation.set(rand(), rand() * 6, rand());
  return m;
}
