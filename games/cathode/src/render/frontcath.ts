// C13 (docs/design/cathode-combat.md S9.2): Cath on the title, in 3D. Silhouette first, lit from behind: a
// belted charcoal trench with a 12-particle Verlet hem in the wind, dark hair up in a low knot (CATHODE's noir
// look, docs/design/cathode.md section 2), heeled boots, black gloves, a black umbrella (a lathe canopy on 8 ribs,
// rain running off the rib tips) and a cigarette whose ember breathes and puffs smoke every 14 s. Idle: breathing at
// 0.25 Hz and a weight shift every 7 to 11 s. Built once from lathes and tubes (about 14k triangles), 4 materials.
//
// Feet on y = 0 at the group's origin, facing +z, +x her left. The group is placed by render/frontscene.ts.

import * as THREE from "three";

export interface FrontCath {
  readonly group: THREE.Group;
  /** World-space points the scene lights and frames from. */
  readonly head: THREE.Object3D;
  readonly ember: THREE.Object3D;
  readonly umbrellaTop: THREE.Object3D;
  update(dt: number, t: number, wind: { x: number; z: number }): void;
  /** The back light's direction in view space (toward the light), for the rim. */
  setRim(viewDir: THREE.Vector3): void;
  dispose(): void;
  readonly triangles: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A lathe from (radius, height) pairs, squashed front to back (a torso is not round). */
function lathe(profile: Array<[number, number]>, segs: number, depth = 0.74): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segs,
  );
  g.scale(1, 1, depth);
  g.computeVertexNormals();
  return g;
}

/** A tapered tube between two points (a limb), capped with spheres at both ends. */
function limb(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, segs = 12): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rb, ra, len, segs, 3, true);
  g.translate(0, len / 2, 0);
  const capA = new THREE.SphereGeometry(ra, segs, 6);
  const capB = new THREE.SphereGeometry(rb, segs, 6);
  capB.translate(0, len, 0);
  const merged = mergeGeos([g, capA, capB]);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  merged.applyQuaternion(q);
  merged.translate(a.x, a.y, a.z);
  return merged;
}

/** Merges non-indexed copies of geometries that share position and normal attributes. */
function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const p of parts) n += p.attributes.position!.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    if (!p.attributes.normal) p.computeVertexNormals();
    pos.set(p.attributes.position!.array as Float32Array, o * 3);
    nor.set(p.attributes.normal!.array as Float32Array, o * 3);
    o += p.attributes.position!.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return g;
}

export function buildFrontCath(phone: boolean): FrontCath {
  const group = new THREE.Group();
  group.name = "front-cath";
  const S = phone ? 0.6 : 1; // segment scale on phone
  const seg = (n: number) => Math.max(6, Math.round(n * S));

  // ---- materials (4) ----
  const coatMat = phone
    ? new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.45, metalness: 0 })
    : new THREE.MeshPhysicalMaterial({ color: 0x1d1f25, roughness: 0.55, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.35, sheen: 0.5, sheenRoughness: 0.45, sheenColor: new THREE.Color(0x6a7080) });
  // Gloves, boots, hair and the umbrella: near-black with a wet sheen.
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.32, metalness: 0.05 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a110e, roughness: 0.38, metalness: 0 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9ad98, roughness: 0.55, metalness: 0 });
  const mats: THREE.Material[] = [coatMat, blackMat, hairMat, skinMat];
  // The back light's rim (S9.2 "lit from behind"): a Fresnel edge in --neon-pink, strongest on the side facing
  // the light, with a cool cyan edge on the far side. The street's real lights add to it; the rim is what
  // makes her read as a silhouette against the neon at any framing.
  const rimU = {
    uRimDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
    uRimA: { value: new THREE.Color(1.0, 0.1, 0.42).multiplyScalar(phone ? 1.6 : 2.0) },
    uRimB: { value: new THREE.Color(0.1, 0.55, 0.8).multiplyScalar(0.28) },
  };
  const rimify = (m: THREE.MeshStandardMaterial, gain: number) => {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, rimU);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uRimDir;\nuniform vec3 uRimA;\nuniform vec3 uRimB;")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            float facing = saturate( dot( normal, normalize( vViewPosition ) ) );
            float fr = pow( 1.0 - facing, 4.0 );
            float side = dot( normal, uRimDir );
            totalEmissiveRadiance += ${gain.toFixed(2)} * fr * ( uRimA * smoothstep( -0.2, 0.7, side ) + uRimB * smoothstep( 0.1, -0.8, side ) );
          }`,
        );
    };
    m.customProgramCacheKey = () => `front-rim-${gain}`;
  };
  rimify(coatMat, 1);
  rimify(blackMat, 0.8);
  rimify(hairMat, 0.9);
  rimify(skinMat, 0.35);

  let tris = 0;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    tris += (geo.index ? geo.index.count : geo.attributes.position!.count) / 3;
    return m;
  };

  // A pelvis pivot carries the body above the legs (the weight shift sways it); the chest carries breathing.
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  group.add(pelvis);
  const chest = new THREE.Group();
  chest.position.set(0, 0.24, 0);
  pelvis.add(chest);

  // ---- legs and heeled boots (in the group: the feet stay planted) ----
  const legs: THREE.Mesh[] = [];
  for (const side of [1, -1]) {
    const hip = V(0.072 * side, 0.9, 0);
    const knee = V(0.078 * side, 0.5, 0.02);
    const calf = V(0.082 * side, 0.34, -0.012);
    const ankle = V(0.086 * side, 0.12, -0.01);
    legs.push(add(limb(hip, knee, 0.064, 0.044, seg(12)), skinMat));
    // Dark tights would vanish in the night: the shin is the boot, knee-high, with a calf.
    add(limb(knee.clone().add(V(0, -0.02, 0)), calf, 0.046, 0.05, seg(12)), blackMat);
    add(limb(calf, ankle, 0.05, 0.03, seg(12)), blackMat);
    // The foot on a 7 cm heel: the toe down at the front, a thin heel post at the back.
    const foot = limb(V(0.087 * side, 0.095, -0.025), V(0.089 * side, 0.02, 0.1), 0.026, 0.017, seg(10));
    add(foot, blackMat);
    const heel = new THREE.CylinderGeometry(0.006, 0.01, 0.075, 8);
    heel.translate(0.087 * side, 0.038, -0.04);
    add(heel, blackMat);
  }

  // ---- the trench: body lathe from collar to hem (belted waist), hem rows driven by the Verlet ring ----
  // Profile in the pelvis frame (y up from the pelvis pivot at 0.92 m).
  const coatProfile: Array<[number, number]> = [
    [0.001, 0.555],
    [0.07, 0.55],
    [0.105, 0.53], // collar base
    [0.172, 0.497], // shoulder slope
    [0.184, 0.455], // shoulders
    [0.166, 0.36], // chest
    [0.148, 0.24],
    [0.117, 0.12], // the belted waist
    [0.138, 0.05],
    [0.172, -0.05], // hips
    [0.198, -0.19],
    [0.232, -0.33],
    [0.268, -0.46], // the hem, just below the knee
    [0.264, -0.475],
  ];
  const HEM_FROM = 9; // profile rows from here down follow the hem particles
  const coatSegs = seg(32);
  // LatheGeometry faces outward when the profile climbs: hem first.
  coatProfile.reverse();
  const HEM_ROWS = coatProfile.length - HEM_FROM;
  const coatGeo = lathe(coatProfile, coatSegs, 0.7);
  {
    // Folds: the skirt falls in soft pleats below the belt (more at the hem), a back vent and a front overlap.
    const p = coatGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0.08) continue;
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z / 0.7);
      if (r < 1e-4) continue;
      const a = Math.atan2(z / 0.7, x);
      const depth = Math.min(1, (0.08 - y) / 0.5);
      const fold = Math.sin(a * 7 + 0.6) * 0.5 + Math.sin(a * 11 + 2.1) * 0.3;
      const k = 1 + fold * 0.045 * depth;
      p.setXYZ(i, x * k, y, z * k);
    }
    coatGeo.computeVertexNormals();
  }
  const coat = add(coatGeo, coatMat, pelvis);
  coat.name = "coat";
  const coatRest = (coatGeo.attributes.position!.array as Float32Array).slice();
  // The belt and its buckle, and a popped collar.
  const belt = new THREE.TorusGeometry(0.12, 0.015, 6, seg(28));
  belt.rotateX(Math.PI / 2);
  belt.scale(1, 1, 0.72);
  belt.translate(0, 0.12, 0);
  add(belt, blackMat, pelvis);
  const collar = lathe(
    [
      [0.098, 0.5],
      [0.108, 0.56],
      [0.128, 0.645],
    ],
    seg(20),
    0.8,
  );
  add(collar, coatMat, pelvis);
  // Belt tails hanging at her right hip.
  add(limb(V(-0.1, 0.1, 0.09), V(-0.115, -0.08, 0.1), 0.012, 0.01, 6), blackMat, pelvis);

  // ---- neck, head, the low knot ----
  const neck = new THREE.CylinderGeometry(0.036, 0.042, 0.12, seg(12));
  neck.translate(0, 0.33, 0.0);
  add(neck, skinMat, chest);
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.455, 0.012);
  chest.add(headPivot);
  const skull = new THREE.SphereGeometry(1, seg(24), seg(16));
  skull.scale(0.076, 0.1, 0.09);
  skull.translate(0, 0.0, 0.006);
  add(skull, skinMat, headPivot);
  // Hair: a cap over the crown and back, swept back from a centre parting, and the knot at the nape.
  const cap = new THREE.SphereGeometry(1, seg(24), seg(14), 0, Math.PI * 2, 0, Math.PI * 0.62);
  cap.scale(0.084, 0.108, 0.098);
  cap.rotateX(-0.42);
  cap.translate(0, 0.006, -0.008);
  add(cap, hairMat, headPivot);
  const knot = new THREE.SphereGeometry(1, seg(16), seg(10));
  knot.scale(0.046, 0.036, 0.034);
  knot.translate(0, -0.05, -0.09);
  add(knot, hairMat, headPivot);
  // Pearl studs catch the back light.
  const pearlMat = new THREE.MeshStandardMaterial({ color: 0xf2ebe2, roughness: 0.18, metalness: 0.1, emissive: 0x2a2624 });
  mats.push(pearlMat);
  for (const side of [1, -1]) {
    const p = new THREE.SphereGeometry(0.0075, 8, 6);
    p.translate(0.077 * side, -0.032, 0.0);
    add(p, pearlMat, headPivot);
  }
  const head = new THREE.Object3D();
  headPivot.add(head);

  // ---- arms: her right holds the umbrella up, her left hangs with the cigarette ----
  const shoulderR = V(-0.162, 0.245, -0.005);
  const elbowR = V(-0.192, 0.0, 0.07);
  const handR = V(-0.085, 0.12, 0.185);
  add(limb(shoulderR, elbowR, 0.052, 0.043, seg(12)), coatMat, chest);
  add(limb(elbowR, handR.clone().add(V(0, -0.02, -0.02)), 0.043, 0.04, seg(12)), coatMat, chest);
  const fistR = new THREE.SphereGeometry(1, seg(12), seg(8));
  fistR.scale(0.036, 0.045, 0.04);
  fistR.translate(handR.x, handR.y + 0.01, handR.z + 0.01);
  add(fistR, blackMat, chest);

  const shoulderL = V(0.162, 0.245, -0.005);
  const elbowL = V(0.192, -0.02, -0.035);
  const handL = V(0.175, -0.26, 0.05);
  add(limb(shoulderL, elbowL, 0.052, 0.043, seg(12)), coatMat, chest);
  add(limb(elbowL, handL.clone().add(V(0, 0.03, -0.01)), 0.043, 0.04, seg(12)), coatMat, chest);
  const fistL = new THREE.SphereGeometry(1, seg(12), seg(8));
  fistL.scale(0.034, 0.05, 0.038);
  fistL.translate(handL.x, handL.y - 0.03, handL.z + 0.01);
  add(fistL, blackMat, chest);
  // The cigarette between two fingers, the ember at its tip.
  const cig = new THREE.CylinderGeometry(0.0035, 0.0035, 0.075, 6);
  cig.rotateX(Math.PI / 2 - 0.3);
  cig.translate(handL.x + 0.008, handL.y - 0.05, handL.z + 0.05);
  const cigMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.8 });
  mats.push(cigMat);
  add(cig, cigMat, chest);
  const emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.1, 0.25), toneMapped: false });
  mats.push(emberMat);
  const emberMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), emberMat);
  emberMesh.position.set(handL.x + 0.008, handL.y - 0.039, handL.z + 0.087);
  chest.add(emberMesh);
  const ember = emberMesh;

  // ---- the umbrella: shaft from her right fist up and a little back, the canopy on 8 ribs ----
  const umb = new THREE.Group();
  umb.position.set(handR.x, handR.y, handR.z);
  umb.rotation.set(-0.05, 0, 0.06);
  chest.add(umb);
  const shaft = new THREE.CylinderGeometry(0.0075, 0.0075, 0.82, 8);
  shaft.translate(0, 0.41, 0);
  add(shaft, blackMat, umb);
  const crook = new THREE.TorusGeometry(0.035, 0.009, 6, 12, Math.PI);
  crook.rotateZ(Math.PI);
  crook.translate(0.035, -0.04, 0);
  add(crook, blackMat, umb);
  // The canopy: a lathe whose rim scallops between the 8 ribs (the cloth sags up between them).
  const R = 0.5;
  const canopyProfile: Array<[number, number]> = [];
  const rows = 9;
  for (let i = 0; i <= rows; i++) {
    const u = i / rows;
    canopyProfile.push([0.006 + R * Math.sin(u * Math.PI * 0.46) / Math.sin(Math.PI * 0.46), 0.86 - 0.31 * (1 - Math.cos(u * Math.PI * 0.46)) / (1 - Math.cos(Math.PI * 0.46))]);
  }
  const canopySegs = 8 * Math.max(4, Math.round(6 * S));
  canopyProfile.reverse();
  const canopy = new THREE.LatheGeometry(
    canopyProfile.map(([r, y]) => new THREE.Vector2(r, y)),
    canopySegs,
  );
  {
    const p = canopy.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const a = Math.atan2(z, x);
      const between = Math.abs(Math.sin(a * 4)); // 0 on a rib, 1 between two
      const k = Math.pow(r / R, 2.2);
      const rr = r * (1 - 0.06 * between * k);
      p.setXYZ(i, (x / r) * rr, p.getY(i) + 0.05 * between * k, (z / r) * rr);
    }
    canopy.computeVertexNormals();
  }
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.22, metalness: 0.0, side: THREE.DoubleSide });
  mats.push(canopyMat);
  add(canopy, canopyMat, umb);
  // Ribs and their tips.
  const tips: THREE.Vector3[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const tip = V(Math.cos(a) * R * 1.005, 0.55 - 0.004, Math.sin(a) * R * 1.005);
    tips.push(tip);
    const mid = V(Math.cos(a) * R * 0.6, 0.78, Math.sin(a) * R * 0.6);
    add(limb(mid, tip, 0.0035, 0.004, 5), blackMat, umb);
    const ferrule = new THREE.SphereGeometry(0.008, 6, 4);
    ferrule.translate(tip.x, tip.y - 0.004, tip.z);
    add(ferrule, blackMat, umb);
  }
  const finial = new THREE.CylinderGeometry(0.004, 0.009, 0.07, 8);
  finial.translate(0, 0.89, 0);
  add(finial, blackMat, umb);
  const umbrellaTop = new THREE.Object3D();
  umbrellaTop.position.set(0, 0.88, 0);
  umb.add(umbrellaTop);

  // ---- rain running off the rib tips: short falling streaks (Points would be square; thin quads read as water) ----
  const DROPS = phone ? 16 : 32;
  const dropGeo = new THREE.BufferGeometry();
  const dropPos = new Float32Array(DROPS * 2 * 3);
  dropGeo.setAttribute("position", new THREE.BufferAttribute(dropPos, 3));
  const dropMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.62, 0.75), transparent: true, opacity: 0.55, depthWrite: false });
  mats.push(dropMat);
  const dropLines = new THREE.LineSegments(dropGeo, dropMat);
  dropLines.frustumCulled = false;
  group.add(dropLines);
  const drops = Array.from({ length: DROPS }, (_, i) => ({ tip: i % 8, y: 0, vy: 0, wait: (i * 0.137) % 1.1, x: 0, z: 0 }));
  const tipW = new THREE.Vector3();

  // ---- smoke: a soft billboard that rises from the ember every 14 s ----
  const smokeTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, "rgba(220,220,230,0.55)");
      grd.addColorStop(1, "rgba(220,220,230,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const smokeMat = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0xb8bcc8 });
  mats.push(smokeMat);
  const smoke = new THREE.Sprite(smokeMat);
  smoke.scale.setScalar(0.12);
  group.add(smoke);
  const emberW = new THREE.Vector3();

  // ---- the hem: 12 particles round the hem, each pulled back to its rest by a spring, pushed by wind ----
  const HEM = 12;
  const hem = Array.from({ length: HEM }, () => ({ x: 0, z: 0, px: 0, pz: 0 }));

  // Weight shift: 7 to 11 s apart, deterministic.
  let shiftAt = 7;
  let shiftFrom = 0;
  let shiftTo = 1;
  let shiftT0 = 0;
  let n = 0;
  const legRest = legs.map((l) => l.rotation.z);

  function update(dt: number, t: number, wind: { x: number; z: number }): void {
    const step = Math.min(dt, 1 / 20);
    // Breathing at 0.25 Hz.
    const br = Math.sin(t * Math.PI * 2 * 0.25);
    chest.scale.set(1 + br * 0.008, 1 + br * 0.004, 1 + br * 0.014);
    chest.position.y = 0.24 + br * 0.003;
    headPivot.rotation.x = -0.05 + br * 0.012;
    // The weight shift: the hips slide over the standing leg and the body counters.
    if (t >= shiftAt) {
      n++;
      shiftFrom = shiftTo;
      shiftTo = shiftTo > 0 ? -1 : 1;
      shiftT0 = t;
      shiftAt = t + 7 + ((n * 2.618) % 4);
    }
    const u = Math.min(1, (t - shiftT0) / 1.4);
    const e = u * u * (3 - 2 * u);
    const w = shiftFrom + (shiftTo - shiftFrom) * e;
    pelvis.position.x = w * 0.022;
    pelvis.rotation.z = -w * 0.035;
    chest.rotation.z = w * 0.05;
    headPivot.rotation.z = -w * 0.03 + Math.sin(t * 0.31) * 0.015;
    headPivot.rotation.y = Math.sin(t * 0.17) * 0.12;
    legs.forEach((l, i) => (l.rotation.z = legRest[i]! + w * 0.01));
    // The umbrella sways a touch in the wind.
    umb.rotation.z = 0.06 + Math.sin(t * 0.9) * 0.015 + wind.x * 0.004;

    // The hem: Verlet with a spring home, wind and a gust that comes and goes.
    const gust = 0.5 + 0.5 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1);
    const wx = (wind.x * 0.004 + 0.012) * gust;
    const wz = (wind.z * 0.004 + 0.006) * gust;
    const k = 1 - Math.exp(-step * 9);
    for (let i = 0; i < HEM; i++) {
      const p = hem[i]!;
      const vx = (p.x - p.px) * 0.94;
      const vz = (p.z - p.pz) * 0.94;
      p.px = p.x;
      p.pz = p.z;
      const flutter = Math.sin(t * 3.1 + i * 1.7) * 0.004 * gust;
      p.x += vx + (wx + flutter - p.x * 6) * k;
      p.z += vz + (wz - p.z * 6) * k;
    }
    // Neighbours hold each other (a soft ring).
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < HEM; i++) {
        const a = hem[i]!;
        const b = hem[(i + 1) % HEM]!;
        const mx = (a.x + b.x) * 0.5;
        const mz = (a.z + b.z) * 0.5;
        a.x += (mx - a.x) * 0.15;
        a.z += (mz - a.z) * 0.15;
        b.x += (mx - b.x) * 0.15;
        b.z += (mz - b.z) * 0.15;
      }
    }
    // Write the coat's lower rows from the ring (weighted down the skirt).
    const pos = coatGeo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const nRows = coatProfile.length;
    for (let s = 0; s <= coatSegs; s++) {
      const ang = (s / coatSegs) * HEM;
      const i0 = Math.floor(ang) % HEM;
      const i1 = (i0 + 1) % HEM;
      const f = ang - Math.floor(ang);
      const ox = hem[i0]!.x * (1 - f) + hem[i1]!.x * f;
      const oz = hem[i0]!.z * (1 - f) + hem[i1]!.z * f;
      for (let r = 0; r < HEM_ROWS; r++) {
        const wgt = Math.pow((HEM_ROWS - r) / HEM_ROWS, 1.6);
        const vi = (s * nRows + r) * 3;
        arr[vi] = coatRest[vi]! + ox * wgt;
        arr[vi + 2] = coatRest[vi + 2]! + oz * wgt;
      }
    }
    pos.needsUpdate = true;

    // The ember breathes; every 14 s she draws on it (brighter) and a curl of smoke rises.
    const cyc = t % 14;
    const draw = cyc > 1 && cyc < 2.2 ? Math.sin(((cyc - 1) / 1.2) * Math.PI) : 0;
    const glow = 0.75 + 0.25 * Math.sin(t * 2.3) + draw * 1.8;
    emberMat.color.setRGB(4 * glow, 1.1 * glow, 0.25 * glow);
    ember.getWorldPosition(emberW);
    const st = cyc - 2.2;
    if (st > 0 && st < 4) {
      const v = st / 4;
      smoke.position.set(emberW.x + wx * 20 * v, emberW.y + 0.05 + v * 0.55, emberW.z + wz * 20 * v);
      smoke.position.sub(group.position);
      smoke.position.applyQuaternion(group.quaternion.clone().invert());
      smoke.scale.setScalar(0.08 + v * 0.34);
      smokeMat.opacity = Math.sin(v * Math.PI) * 0.32;
      smokeMat.rotation = v * 1.2;
    } else smokeMat.opacity = 0;

    // Rain off the rib tips: each drop waits, then falls from a tip.
    umb.updateWorldMatrix(true, false);
    group.updateWorldMatrix(true, false);
    const inv = group.matrixWorld.clone().invert();
    for (let i = 0; i < DROPS; i++) {
      const d = drops[i]!;
      if (d.wait > 0) {
        d.wait -= step;
        if (d.wait <= 0) {
          tipW.copy(tips[d.tip]!).applyMatrix4(umb.matrixWorld).applyMatrix4(inv);
          d.x = tipW.x;
          d.y = tipW.y;
          d.z = tipW.z;
          d.vy = 0;
        }
        dropPos.fill(0, i * 6, i * 6 + 6);
        continue;
      }
      d.vy -= 9.8 * step;
      d.y += d.vy * step;
      d.x += wx * 2 * step * 10;
      if (d.y < 0.02) {
        d.wait = 0.25 + ((i * 0.37 + t) % 0.9);
        d.tip = (d.tip + 3) % 8;
      }
      const len = Math.min(0.12, 0.02 - d.vy * 0.025);
      dropPos[i * 6] = d.x;
      dropPos[i * 6 + 1] = d.y;
      dropPos[i * 6 + 2] = d.z;
      dropPos[i * 6 + 3] = d.x;
      dropPos[i * 6 + 4] = d.y + len;
      dropPos[i * 6 + 5] = d.z;
    }
    (dropGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  return {
    group,
    head,
    ember,
    umbrellaTop,
    update,
    triangles: Math.round(tris),
    setRim(viewDir) {
      rimU.uRimDir.value.copy(viewDir).normalize();
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const m of mats) m.dispose();
      smokeTex.dispose();
      group.removeFromParent();
    },
  };
}
