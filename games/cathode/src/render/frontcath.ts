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
  /**
   * C14 (S9.5): a 1.2 s class idle, from the next update (or held at `u`, 0..1, for screenshots): ghost glances over
   * her shoulder, butcher rolls her neck, gunslinger squares up, wirewitch twirls the umbrella, fixer checks her cuff.
   */
  play(kind: string, u?: number): void;
  /** C14: pulls her rim from the street's pink toward `c` by `w` (0..1): the wardrobe's class colour. */
  tint(c: THREE.Color, w: number): void;
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

/**
 * A body part turned along a→b with a radius profile (t from 0 at a to 1 at b), squashed to `depth` front to back
 * around `up` (a thigh is wider than deep). Closed at both ends.
 */
function turned(a: THREE.Vector3, b: THREE.Vector3, profile: Array<[number, number]>, segs: number, depth = 1, twist = 0): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const pts = [new THREE.Vector2(0.0005, 0)];
  for (const [t, r] of profile) pts.push(new THREE.Vector2(r, t * len));
  pts.push(new THREE.Vector2(0.0005, len));
  const g = new THREE.LatheGeometry(pts, segs);
  g.scale(1, 1, depth);
  if (twist) g.rotateY(twist);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  g.computeVertexNormals();
  return g;
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
    : new THREE.MeshPhysicalMaterial({ color: 0x1d1f25, roughness: 0.6, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.14, sheen: 0.5, sheenRoughness: 0.45, sheenColor: new THREE.Color(0x6a7080) });
  // The cloth itself (C13 review: "faceted, no wet"): a gabardine twill and rain running down the drape, baked
  // once into a normal map, so the coat's highlights break up like wet wool instead of shading like plastic.
  const clothNormal = (() => {
    const W = 256;
    const H = 256;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    if (!g) return null;
    const h = new Float32Array(W * H);
    let sd = 11;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) h[y * W + x] = 0.5 + 0.5 * Math.sin(((x + y) / W) * Math.PI * 2 * 48);
    // Rivulets: thin vertical runs of water, slightly wavy, raised over the weave.
    for (let i = 0; i < 26; i++) {
      let x = rnd() * W;
      const y0 = Math.floor(rnd() * H);
      const len = 40 + rnd() * 140;
      for (let k = 0; k < len; k++) {
        x += (rnd() - 0.5) * 0.6;
        const y = (y0 + k) % H;
        for (let d = -1; d <= 1; d++) {
          const xi = ((Math.round(x) + d) % W + W) % W;
          h[y * W + xi] = (h[y * W + xi] ?? 0) + (d === 0 ? 1.6 : 0.7);
        }
      }
    }
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const at = (xx: number, yy: number) => h[((yy + H) % H) * W + ((xx + W) % W)]!;
        const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
        const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
        const n = new THREE.Vector3(-dx, -dy, 1).normalize();
        const o = (y * W + x) * 4;
        img.data[o] = (n.x * 0.5 + 0.5) * 255;
        img.data[o + 1] = (n.y * 0.5 + 0.5) * 255;
        img.data[o + 2] = (n.z * 0.5 + 0.5) * 255;
        img.data[o + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 3);
    return t;
  })();
  if (clothNormal) {
    coatMat.normalMap = clothNormal;
    coatMat.normalScale.set(0.32, 0.32);
  }
  // Gloves, boots, hair and the umbrella: near-black with a wet sheen.
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.32, metalness: 0.05 });
  // Hair: combed-back strands as a streaked colour and roughness map (a shine band reads as hair, not a helmet).
  const strands = (() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 128;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#2a1c17";
      g.fillRect(0, 0, 64, 128);
      let sd = 7;
      const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) {
        const x = rnd() * 64;
        const l = 40 + rnd() * 30;
        g.fillStyle = `rgba(${rnd() < 0.5 ? "90,64,52" : "10,6,5"},${0.25 + rnd() * 0.35})`;
        g.fillRect(x, 0, 0.6 + rnd() * 1.2, 128);
        void l;
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    return t;
  })();
  const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x9a8678, map: strands, roughness: 0.38, metalness: 0, sheen: 0.6, sheenRoughness: 0.3, sheenColor: new THREE.Color(0x7a5a48) });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9ad98, roughness: 0.55, metalness: 0 });
  const mats: THREE.Material[] = [coatMat, blackMat, hairMat, skinMat];
  // The back light's rim (S9.2 "lit from behind"): a Fresnel edge in --neon-pink, strongest on the side facing
  // the light, with a cool cyan edge on the far side. The street's real lights add to it; the rim is what
  // makes her read as a silhouette against the neon at any framing.
  const rimU = {
    uRimDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
    uRimA: { value: new THREE.Color(1.0, 0.3, 0.52).multiplyScalar(phone ? 0.9 : 1.1) },
    uRimB: { value: new THREE.Color(0.1, 0.55, 0.8).multiplyScalar(0.28) },
  };
  const rimA0 = rimU.uRimA.value.clone();
  const tmpC = new THREE.Color();
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
            // A wide, soft Fresnel (C13 review: the narrow pow-4 edge drew as one-pixel pink stair-steps).
            float fr = smoothstep( 0.0, 1.0, pow( 1.0 - facing, 2.2 ) );
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
  // Contrapposto: her weight on the right leg, the left a half step forward and turned out. Dark sheer tights to
  // the knee (a warm skin under charcoal), then knee boots with a shaped calf, a pointed toe and a 7 cm heel.
  const tightsMat = new THREE.MeshStandardMaterial({ color: 0x3a2c2a, roughness: 0.5, metalness: 0 });
  mats.push(tightsMat);
  rimify(tightsMat, 0.9);
  const legs: THREE.Mesh[] = [];
  for (const side of [1, -1]) {
    const fwd = side > 0 ? 0.05 : 0; // her left leg forward
    const hip = V(0.078 * side, 0.92, 0.0);
    const knee = V(0.07 * side, 0.5, 0.012 + fwd * 0.6);
    const ankle = V(0.075 * side + (side > 0 ? 0.012 : 0), 0.105, -0.005 + fwd);
    // Thigh: full at the top, slim to the knee.
    legs.push(add(turned(hip, knee, [[0, 0.066], [0.15, 0.068], [0.45, 0.06], [0.8, 0.047], [1, 0.042]], seg(14), 0.92), tightsMat));
    // The boot shaft: knee to ankle with a calf, a turned-down cuff at the top.
    add(turned(knee.clone().add(V(0, 0.03, 0)), ankle, [[0, 0.05], [0.06, 0.05], [0.1, 0.046], [0.32, 0.05], [0.5, 0.044], [0.8, 0.031], [1, 0.029]], seg(14), 0.95), blackMat);
    // The foot: a pointed toe down on the ground, the heel up on its post.
    const toe = V(ankle.x + (side > 0 ? 0.03 : 0.008) * side, 0.012, ankle.z + 0.15);
    add(turned(V(ankle.x, 0.09, ankle.z - 0.035), toe, [[0, 0.03], [0.3, 0.034], [0.7, 0.028], [0.92, 0.014], [1, 0.004]], seg(10), 0.62, Math.PI / 2), blackMat);
    const heel = new THREE.CylinderGeometry(0.007, 0.012, 0.072, 8);
    heel.translate(ankle.x, 0.036, ankle.z - 0.04);
    add(heel, blackMat);
  }

  // A contact shadow under her: soft, darkest under the boots (ambient occlusion the street's lights can't give).
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    if (g) {
      const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      grd.addColorStop(0, "rgba(0,0,0,0.85)");
      grd.addColorStop(0.45, "rgba(0,0,0,0.5)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
  mats.push(shadowMat);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), shadowMat);
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0.005, 0.004, 0.04);
  contact.renderOrder = -1;
  group.add(contact);
  for (const side of [1, -1]) {
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.26), shadowMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(0.08 * side, 0.005, 0.06 + (side > 0 ? 0.05 : 0));
    group.add(blob);
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
    [0.178, -0.05], // hips
    [0.196, -0.19],
    [0.214, -0.33],
    [0.238, -0.46], // the hem, just below the knee: a trench falls, it doesn't bell
    [0.234, -0.475],
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
      // Deep, irregular drape folds (a turned cone reads as a mannequin): two families plus a sharper crease.
      const fold = Math.sin(a * 7 + 0.6) * 0.5 + Math.sin(a * 13 + 2.1) * 0.3 + Math.pow(Math.abs(Math.sin(a * 5 + 1.3)), 6) * 0.55;
      // A back vent: the two skirts part a little at the back below the hips.
      const vent = Math.max(0, 1 - Math.abs(Math.atan2(x, -z / 0.7)) / 0.18) * Math.max(0, (-0.12 - y) / 0.35);
      const k = 1 + fold * 0.11 * depth - vent * 0.05;
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
  // The popped collar: open at the throat (a gap at the front), flaring out as it rises, and the notched lapels
  // folded back over the chest; double-breasted buttons; epaulettes on the shoulders; a buckle on the belt.
  {
    const open = 1.15; // radians left open at the front
    const pts = [
      [0.1, 0.495],
      [0.104, 0.54],
      [0.118, 0.6],
      [0.13, 0.615],
    ].map(([r, y]) => new THREE.Vector2(r!, y!));
    // Lathe angle 0 faces +x; +z (her front) is at π/2 in three's lathe (x = sin, z = cos): start past the gap.
    const collar = new THREE.LatheGeometry(pts, seg(22), open / 2, Math.PI * 2 - open);
    collar.scale(1, 1, 0.82);
    collar.computeVertexNormals();
    // Its own material: the collar is seen from inside too (double-sided), the coat is not (no shadow acne).
    const collarMat = coatMat.clone();
    collarMat.side = THREE.DoubleSide;
    rimify(collarMat, 1);
    mats.push(collarMat);
    add(collar, collarMat, pelvis);
  }
  for (const side of [1, -1]) {
    // A lapel: a thin folded wedge from the collar's corner down to the top button, angled out.
    const lap = new THREE.BufferGeometry();
    const a = V(0.045 * side, 0.5, 0.098);
    const b = V(0.14 * side, 0.43, 0.088);
    const c = V(0.052 * side, 0.27, 0.112);
    const d = V(0.105 * side, 0.36, 0.1);
    const t = 0.008;
    const v = [a, d, b, a, c, d].flatMap((p) => [p.x, p.y, p.z + t]);
    lap.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    lap.computeVertexNormals();
    add(lap, coatMat, pelvis);
    // Buttons: two columns of three down the front.
    for (let i = 0; i < 3; i++) {
      const bt = new THREE.SphereGeometry(0.009, 8, 6);
      bt.scale(1, 1, 0.5);
      bt.translate(0.06 * side, 0.25 - i * 0.075, 0.112 - i * 0.004);
      add(bt, blackMat, pelvis);
    }
    // Epaulette: a flat strap across the shoulder to the collar.
    const ep = new THREE.BoxGeometry(0.1, 0.012, 0.045);
    ep.rotateZ(-0.38 * side);
    ep.translate(0.135 * side, 0.488, -0.004);
    add(ep, coatMat, pelvis);
  }
  const buckle = new THREE.TorusGeometry(0.022, 0.005, 4, 4);
  buckle.rotateZ(Math.PI / 4);
  buckle.scale(1.3, 1, 1);
  buckle.translate(0.0, 0.12, 0.09);
  add(buckle, blackMat, pelvis);
  // Belt tails hanging at her right hip.
  add(limb(V(-0.1, 0.1, 0.09), V(-0.115, -0.08, 0.1), 0.012, 0.01, 6), blackMat, pelvis);

  // ---- neck, head, the low knot ----
  const neck = new THREE.CylinderGeometry(0.036, 0.042, 0.12, seg(12));
  neck.translate(0, 0.33, 0.0);
  add(neck, skinMat, chest);
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.455, 0.012);
  chest.add(headPivot);
  // The head: an egg with a jaw. The lower front narrows to a chin, the cheekbones sit high, a small nose; C14 (S9.5,
  // the wardrobe sees her from the front): shallow eye sockets under a soft brow, full cheekbones, a lip line.
  const skull = new THREE.SphereGeometry(1, seg(40), seg(28));
  {
    const p = skull.attributes.position as THREE.BufferAttribute;
    const bump = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => Math.max(0, 1 - Math.hypot((x - cx) / rx, (y - cy) / ry));
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const front = Math.max(0, z);
      // Sockets, brow, cheekbones and lips, on the front only (normalised head units).
      let dz = 0;
      for (const sx of [-1, 1]) {
        dz -= 0.07 * Math.pow(bump(x, y, 0.36 * sx, 0.06, 0.2, 0.13), 1.5);
        dz += 0.035 * bump(x, y, 0.33 * sx, 0.24, 0.26, 0.08);
        dz += 0.05 * bump(x, y, 0.5 * sx, -0.2, 0.26, 0.2);
      }
      dz += 0.035 * bump(x, y, 0, -0.5, 0.24, 0.1);
      z += dz * front;
      // Jaw: below the cheekbones the sides draw in, the chin comes forward.
      if (y < 0) {
        const k = -y;
        x *= 1 - 0.32 * k * k;
        z = z > 0 ? z * (1 - 0.1 * k) + 0.06 * k : z * (1 - 0.45 * k);
        y *= 1.06;
      }
      // Nose: a small, straight ridge from between the eyes, its tip a little above the lip.
      const nose = Math.max(0, 1 - Math.hypot(x / 0.13, (y + 0.2) / 0.26)) * front;
      z += nose * nose * 0.2 + nose * 0.04;
      p.setXYZ(i, x, y, z);
    }
  }
  skull.scale(0.072, 0.098, 0.088);
  skull.translate(0, 0.0, 0.01);
  skull.computeVertexNormals();
  // C14: her face, painted (VISION: large bright eyes with a neat winged liner and two highlights, soft brows with
  // the right one a touch raised, a little colour on the cheeks, rose lips in a half-smile). Painted on the skull's
  // own UVs in metres: u = 0.25 is her front, +x her left (the viewer's right), the canvas top is her crown.
  const faceTex = (() => {
    const W = 2048;
    const H = 1024;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#d9ad98";
      g.fillRect(0, 0, W, H);
      // Metres on the face -> canvas: 1 normalised unit is H/π pixels, x in units of 0.072 m, y of 0.098 m.
      const k = H / Math.PI;
      g.setTransform(k / 0.072, 0, 0, -k / 0.098, W / 4, H / 2);
      const blob = (x: number, y: number, rx: number, ry: number, col: string, a: number) => {
        g.save();
        g.translate(x, y);
        g.scale(rx, ry);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, col.replace("A", String(a)));
        gr.addColorStop(1, col.replace("A", "0"));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, 1, 0, Math.PI * 2);
        g.fill();
        g.restore();
      };
      // Shading: warm cheeks, a cooler shadow under the cheekbones and the brow, the lids a touch smoky.
      for (const sx of [-1, 1]) {
        blob(0.036 * sx, -0.016, 0.017, 0.012, "rgba(214,110,112,A)", 0.5);
        blob(0.045 * sx, -0.034, 0.016, 0.01, "rgba(120,70,62,A)", 0.22);
        blob(0.026 * sx, 0.011, 0.016, 0.009, "rgba(92,58,62,A)", 0.45);
      }
      blob(0, -0.024, 0.008, 0.004, "rgba(110,62,54,A)", 0.4); // under the nose
      blob(0, -0.06, 0.016, 0.006, "rgba(120,72,62,A)", 0.25); // under the lip
      // The eyes: almond whites, a hazel iris, the pupil, two highlights, a winged liner and a lower lash line.
      for (const sx of [-1, 1]) {
        const ex = 0.026 * sx;
        const ey = 0.006;
        const hw = 0.0115;
        const hh = 0.0058;
        const almond = () => {
          g.beginPath();
          g.moveTo(ex - hw, ey);
          g.bezierCurveTo(ex - hw * 0.5, ey + hh * 1.5, ex + hw * 0.5, ey + hh * 1.6, ex + hw, ey + hh * 0.2);
          g.bezierCurveTo(ex + hw * 0.5, ey - hh * 1.3, ex - hw * 0.5, ey - hh * 1.25, ex - hw, ey);
          g.closePath();
        };
        g.save();
        almond();
        g.fillStyle = "#efe6e0";
        g.fill();
        g.clip();
        const ix = ex + 0.0012 * sx;
        g.fillStyle = "#5a3a22";
        g.beginPath();
        g.ellipse(ix, ey + 0.0004, 0.0058, 0.0058 * (0.072 / 0.098) * 1.36, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#2e1c10";
        g.beginPath();
        g.ellipse(ix, ey + 0.0004, 0.0058, 0.0058 * (0.072 / 0.098) * 1.36, 0, 0, Math.PI * 2);
        g.lineWidth = 0.0012;
        g.strokeStyle = "#24160c";
        g.stroke();
        g.beginPath();
        g.ellipse(ix, ey + 0.0004, 0.0026, 0.0026 * 1.0, 0, 0, Math.PI * 2);
        g.fill();
        // The lid's shadow across the top of the iris.
        g.fillStyle = "rgba(40,20,16,0.35)";
        g.fillRect(ex - hw, ey + hh * 0.55, hw * 2, hh);
        g.fillStyle = "#fffaf4";
        g.beginPath();
        g.ellipse(ix - 0.0021, ey + 0.0026, 0.0014, 0.0011, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(ix + 0.0022, ey - 0.0019, 0.0007, 0.0006, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
        // The liner: heavier on the upper lid, out to a wing that lifts past the outer corner.
        g.fillStyle = "#120a08";
        const ox = ex + hw * sx;
        g.beginPath();
        g.moveTo(ex - hw * sx * 1.02, ey - 0.0002);
        g.bezierCurveTo(ex - hw * 0.5 * sx, ey + hh * 1.55, ex + hw * 0.5 * sx, ey + hh * 1.65, ox, ey + hh * 0.25);
        g.lineTo(ox + 0.0062 * sx, ey + hh * 1.25);
        g.lineTo(ox - 0.0005 * sx, ey + hh * 0.85);
        g.bezierCurveTo(ex + hw * 0.45 * sx, ey + hh * 2.15, ex - hw * 0.5 * sx, ey + hh * 2.0, ex - hw * sx * 1.02, ey - 0.0002);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(30,16,12,0.7)";
        g.lineWidth = 0.0007;
        g.beginPath();
        g.moveTo(ex - hw * 0.7 * sx, ey - hh * 0.95);
        g.quadraticCurveTo(ex + hw * 0.3 * sx, ey - hh * 1.35, ex + hw * sx, ey + hh * 0.1);
        g.stroke();
        // The lid crease.
        g.strokeStyle = "rgba(110,64,58,0.55)";
        g.lineWidth = 0.0008;
        g.beginPath();
        g.moveTo(ex - hw * 0.8 * sx, ey + hh * 2.1);
        g.quadraticCurveTo(ex + hw * 0.1 * sx, ey + hh * 3.3, ex + hw * 1.05 * sx, ey + hh * 1.9);
        g.stroke();
        // Soft brows, her right (sx -1) a touch higher at the arch.
        const by = 0.0215 + (sx < 0 ? 0.0022 : 0);
        g.fillStyle = "#2a1a14";
        g.beginPath();
        g.moveTo(0.0085 * sx, by - 0.0018);
        g.quadraticCurveTo(0.024 * sx, by + 0.0042, 0.04 * sx, by - 0.0018);
        g.quadraticCurveTo(0.025 * sx, by + 0.0012, 0.0085 * sx, by - 0.0048);
        g.closePath();
        g.fill();
      }
      // Rose lips in a half-smile: her left corner lifts a little.
      const my = -0.047;
      g.fillStyle = "#b24a58";
      g.beginPath();
      g.moveTo(-0.0165, my + 0.0005);
      g.bezierCurveTo(-0.009, my + 0.0058, -0.003, my + 0.0072, 0, my + 0.0048);
      g.bezierCurveTo(0.003, my + 0.0072, 0.009, my + 0.0062, 0.0168, my + 0.0026);
      g.bezierCurveTo(0.009, my - 0.0072, -0.009, my - 0.0078, -0.0165, my + 0.0005);
      g.closePath();
      g.fill();
      g.strokeStyle = "#5e1e28";
      g.lineWidth = 0.0011;
      g.beginPath();
      g.moveTo(-0.0165, my + 0.0005);
      g.bezierCurveTo(-0.008, my + 0.0012, 0.008, my + 0.0018, 0.0168, my + 0.0026);
      g.stroke();
      // The gloss on the lower lip.
      blob(0.003, my - 0.0032, 0.0055, 0.0014, "rgba(255,226,226,A)", 0.55);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  })();
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: faceTex, roughness: 0.5, metalness: 0 });
  rimify(faceMat, 0.35);
  mats.push(faceMat);
  add(skull, faceMat, headPivot);
  // Hair: a glossy shell over the crown, swept back from a centre parting, full at the sides over the tops of the
  // ears, gathered at the nape into a low twisted knot (CATHODE's work look).
  const cap = new THREE.SphereGeometry(1, seg(96), seg(18), 0, Math.PI * 2, 0, Math.PI * 0.7);
  {
    const p = cap.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      // The parting: a shallow groove down the middle at the front; volume at the crown.
      const part = Math.max(0, 1 - Math.abs(x) / 0.12) * Math.max(0, z) * Math.max(0, y) * 0.05;
      const crown = 1 + Math.max(0, y) * Math.max(0, -z) * 0.08;
      // Combed ridges running front to back (around the azimuth): they catch the back light as strands do.
      const az = Math.atan2(x, z);
      const ridge = 1 + 0.018 * Math.sin(az * 38) * (0.4 + 0.6 * Math.max(0, y));
      p.setXYZ(i, x * crown * ridge, y * crown - part, z * crown * ridge);
    }
  }
  cap.scale(0.081, 0.108, 0.1);
  cap.rotateX(-0.5);
  cap.translate(0, 0.008, -0.012);
  {
    // C14: the hairline. The shell came down over her face (nobody saw it from behind); on the front it lifts to a
    // hairline that peaks at the centre parting and sweeps down past the temples, tucked onto the skull.
    const p = cap.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const f = THREE.MathUtils.smoothstep(z, -0.01, 0.045);
      const line = 0.05 - 4.2 * x * x;
      if (y < line && f > 0) {
        const ny = y + (line - y) * f;
        const tuck = 1 - 0.1 * f * Math.min(1, (line - y) / 0.05);
        p.setXYZ(i, x * tuck, ny, z * tuck);
      }
    }
  }
  cap.computeVertexNormals();
  add(cap, hairMat, headPivot);
  // The sides swept back behind the ears to the nape.
  for (const side of [1, -1]) {
    add(turned(V(0.058 * side, 0.03, 0.03), V(0.03 * side, -0.05, -0.085), [[0, 0.02], [0.4, 0.03], [1, 0.022]], seg(10), 0.7), hairMat, headPivot);
  }
  // The knot: a twisted coil (torus) round a core, low on the nape.
  const knot = new THREE.SphereGeometry(1, seg(16), seg(10));
  knot.scale(0.05, 0.04, 0.038);
  knot.translate(0, -0.05, -0.105);
  add(knot, hairMat, headPivot);
  const coil = new THREE.TorusGeometry(0.038, 0.016, seg(8), seg(18));
  coil.scale(1.15, 0.9, 1);
  coil.rotateX(0.35);
  coil.translate(0, -0.05, -0.098);
  add(coil, hairMat, headPivot);
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
  // Set-in sleeves: full at the shoulder seam (inside the coat's shoulder line, so no ball shows), easing to the
  // elbow, flaring a touch at the cuff with a strap; black leather gloves with a thumb.
  const sleeve = (sh: THREE.Vector3, el: THREE.Vector3, wr: THREE.Vector3, parent: THREE.Object3D, fore: THREE.Object3D = parent) => {
    add(turned(sh, el, [[0, 0.03], [0.06, 0.052], [0.3, 0.05], [0.85, 0.042], [1, 0.04]], seg(12), 0.9), coatMat, parent);
    // The elbow: a ball inside the sleeve so the bend never opens a gap between upper arm and forearm.
    const elb = new THREE.SphereGeometry(0.039, seg(12), seg(8));
    elb.scale(1, 1, 0.9);
    elb.translate(el.x, el.y, el.z);
    add(elb, coatMat, fore);
    add(turned(el.clone().add(el.clone().sub(sh).normalize().multiplyScalar(-0.02)), wr, [[0, 0.04], [0.5, 0.039], [0.88, 0.044], [0.97, 0.047], [1, 0.03]], seg(12), 0.9), coatMat, fore);
    parent = fore;
    // The cuff strap.
    const d = wr.clone().sub(el).normalize();
    const strap = new THREE.TorusGeometry(0.044, 0.005, 4, seg(14));
    strap.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d));
    const at = wr.clone().addScaledVector(d, -0.04);
    strap.translate(at.x, at.y, at.z);
    add(strap, blackMat, parent);
  };
  const glove = (at: THREE.Vector3, dir: THREE.Vector3, side: number, parent: THREE.Object3D) => {
    // The hand: a flattened, rounded block along `dir`, fingers curled; the thumb wrapped across.
    const palm = new THREE.SphereGeometry(1, seg(10), seg(8));
    palm.scale(0.026, 0.05, 0.036);
    palm.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir));
    palm.translate(at.x + dir.x * 0.04, at.y + dir.y * 0.04, at.z + dir.z * 0.04);
    add(palm, blackMat, parent);
    const wrist = turned(at.clone().addScaledVector(dir, -0.01), at.clone().addScaledVector(dir, 0.03), [[0, 0.024], [1, 0.027]], seg(8), 0.8);
    add(wrist, blackMat, parent);
    const t0 = at.clone().addScaledVector(dir, 0.03).add(V(-0.02 * side, 0, 0.02));
    add(limb(t0, t0.clone().add(V(0.012 * side, 0.02 * Math.sign(dir.y || 1), 0.02)), 0.011, 0.009, 6), blackMat, parent);
  };
  const shoulderR = V(-0.15, 0.25, -0.005);
  const elbowR = V(-0.192, 0.0, 0.07);
  const handR = V(-0.085, 0.12, 0.185);
  const wristR = handR.clone().add(V(-0.012, -0.045, -0.03));
  sleeve(shoulderR, elbowR, wristR, chest);
  glove(wristR, handR.clone().sub(wristR).normalize(), -1, chest);

  const shoulderL = V(0.15, 0.25, -0.005);
  const elbowL = V(0.192, -0.02, -0.035);
  const handL = V(0.175, -0.26, 0.05);
  const wristL = handL.clone().add(V(0, 0.04, -0.012));
  // C14: her left arm is two bones (the class idles reach with it: a draw on the cigarette, the collar, the hip).
  // Each bone is a group whose matrix moves its rest geometry; armIK() solves them toward a wrist target.
  const upperL = new THREE.Group();
  const foreL = new THREE.Group();
  upperL.matrixAutoUpdate = false;
  foreL.matrixAutoUpdate = false;
  chest.add(upperL, foreL);
  sleeve(shoulderL, elbowL, wristL, upperL, foreL);
  glove(wristL, V(0, -1, 0.15).normalize(), 1, foreL);
  // The cigarette between two fingers, the ember at its tip.
  const cig = new THREE.CylinderGeometry(0.0035, 0.0035, 0.075, 6);
  cig.rotateX(Math.PI / 2 - 0.3);
  cig.translate(handL.x + 0.008, handL.y - 0.05, handL.z + 0.05);
  const cigMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.8 });
  mats.push(cigMat);
  add(cig, cigMat, foreL);
  const emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.1, 0.25), toneMapped: false });
  mats.push(emberMat);
  const emberMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), emberMat);
  emberMesh.position.set(handL.x + 0.008, handL.y - 0.039, handL.z + 0.087);
  foreL.add(emberMesh);
  const ember = emberMesh;
  const L1 = shoulderL.distanceTo(elbowL);
  const L2 = elbowL.distanceTo(wristL);
  const restU = elbowL.clone().sub(shoulderL).normalize();
  const restF = wristL.clone().sub(elbowL).normalize();
  const ikT = new THREE.Vector3();
  const ikE = new THREE.Vector3();
  const ikAx = new THREE.Vector3();
  const ikPerp = new THREE.Vector3();
  const ikQ = new THREE.Quaternion();
  const ikQ2 = new THREE.Quaternion();
  const ikM = new THREE.Matrix4();
  const ikM2 = new THREE.Matrix4();
  /**
   * Two-bone IK for her left arm, in the chest frame: the wrist toward `target`, the elbow bent toward `pole`, the
   * hand turned `roll` radians about the forearm. A target at the rest wrist leaves the arm exactly as modelled.
   */
  function armIK(target: THREE.Vector3, pole: THREE.Vector3, roll: number): void {
    ikAx.copy(target).sub(shoulderL);
    const d = THREE.MathUtils.clamp(ikAx.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    ikAx.normalize();
    ikT.copy(shoulderL).addScaledVector(ikAx, d);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    ikPerp.copy(pole).addScaledVector(ikAx, -pole.dot(ikAx)).normalize();
    ikE.copy(shoulderL).addScaledVector(ikAx, a).addScaledVector(ikPerp, h);
    // The upper arm: rest direction onto shoulder -> elbow, about the shoulder.
    ikQ.setFromUnitVectors(restU, ikE.clone().sub(shoulderL).normalize());
    upperL.matrix.makeTranslation(shoulderL.x, shoulderL.y, shoulderL.z).multiply(ikM.makeRotationFromQuaternion(ikQ)).multiply(ikM2.makeTranslation(-shoulderL.x, -shoulderL.y, -shoulderL.z));
    // The forearm: carried by the upper arm's turn, then onto elbow -> wrist, then the roll.
    const carried = restF.clone().applyQuaternion(ikQ);
    const want = ikT.clone().sub(ikE).normalize();
    ikQ2.setFromUnitVectors(carried, want).multiply(ikQ);
    ikQ2.premultiply(new THREE.Quaternion().setFromAxisAngle(want, roll));
    foreL.matrix.makeTranslation(ikE.x, ikE.y, ikE.z).multiply(ikM.makeRotationFromQuaternion(ikQ2)).multiply(ikM2.makeTranslation(-elbowL.x, -elbowL.y, -elbowL.z));
    upperL.matrixWorldNeedsUpdate = true;
    foreL.matrixWorldNeedsUpdate = true;
  }

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
  const CLIP_S = 1.2;
  let clip: { kind: string; t0: number | null; held?: number } | null = null;
  let clipDraw = 0;
  const tgt = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const restPole = elbowL.clone().sub(shoulderL).normalize();

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
    chest.rotation.x = 0;
    chest.rotation.y = 0;
    umb.rotation.y = 0;
    // C14 (S9.5): the class idle on top, a posed 1.2 s clip: in over the first quarter, held, out over the last
    // fifth, so it starts and ends on the breathing idle (and a held screenshot at 0.5 shows the pose itself).
    // Her left arm reaches by two-bone IK; the head turns to the lens (the wardrobe sees her from the front).
    clipDraw = 0;
    let armOn = false;
    if (clip) {
      if (clip.t0 === null) clip.t0 = t;
      const cu = clip.held ?? (t - clip.t0) / CLIP_S;
      if (cu >= 1 || cu < 0) clip = null;
      else {
        const e = THREE.MathUtils.smootherstep(cu, 0, 0.26) * (1 - THREE.MathUtils.smootherstep(cu, 0.8, 1));
        const reach = (x: number, y: number, z: number, px: number, py: number, pz: number, roll: number) => {
          tgt.copy(wristL).lerp(tmpV.set(x, y, z), e);
          pole.copy(restPole).lerp(tmpV.set(px, py, pz).normalize(), e);
          armIK(tgt, pole, roll * e);
          armOn = true;
        };
        switch (clip.kind) {
          case "ghost":
            // A draw on the cigarette, eyes to the lens: the ember flares.
            reach(0.07, 0.27, 0.17, 1, -1.1, -0.2, -0.5);
            headPivot.rotation.y += 0.32 * e;
            headPivot.rotation.x += 0.1 * e;
            chest.rotation.y += 0.08 * e;
            clipDraw = THREE.MathUtils.smoothstep(cu, 0.3, 0.5) * (1 - THREE.MathUtils.smoothstep(cu, 0.7, 0.85));
            break;
          case "butcher": {
            // The neck roll: chin down, over to the side, up; shoulders drop; her free fist low and forward.
            const ph = Math.PI * 2 * cu + Math.PI / 2;
            headPivot.rotation.z += 0.34 * Math.sin(ph) * e;
            headPivot.rotation.x += (0.12 + 0.16 * Math.cos(ph)) * e;
            headPivot.rotation.y += 0.18 * e;
            chest.rotation.x += 0.06 * e;
            chest.position.y -= 0.012 * e;
            reach(0.21, -0.14, 0.15, 1, 0.2, -0.8, 0.6);
            break;
          }
          case "gunslinger":
            // Squares up to the lens, the umbrella back on her shoulder, a hand on her hip.
            chest.rotation.y += 0.26 * e;
            headPivot.rotation.y += 0.12 * e;
            headPivot.rotation.x -= 0.06 * e;
            umb.rotation.x -= 0.32 * e;
            umb.rotation.z += 0.3 * e;
            reach(0.155, -0.2, 0.05, 1, 0.4, -0.7, 0.9);
            break;
          case "wirewitch": {
            const sp = cu * cu * (3 - 2 * cu);
            umb.rotation.y += Math.PI * 2 * sp;
            headPivot.rotation.z += 0.18 * e;
            headPivot.rotation.y += 0.28 * e;
            reach(0.4, 0.06, 0.2, 0.1, -1, -0.3, 1.2);
            break;
          }
          default:
            // The fixer straightens her collar, eyes down to it.
            reach(0.02, 0.31, 0.15, 1, -0.7, -0.1, -1.2);
            headPivot.rotation.x += 0.2 * e;
            headPivot.rotation.y += 0.22 * e;
            chest.rotation.z += 0.04 * e;
        }
      }
    }
    if (!armOn) {
      upperL.matrix.identity();
      foreL.matrix.identity();
      upperL.matrixWorldNeedsUpdate = true;
      foreL.matrixWorldNeedsUpdate = true;
    }

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
    const glow = 0.75 + 0.25 * Math.sin(t * 2.3) + Math.max(draw, clipDraw) * 1.8;
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
    play(kind, u) {
      clip = { kind, t0: null, held: u };
    },
    tint(c, w) {
      rimU.uRimA.value.copy(rimA0).lerp(tmpC.copy(c).multiplyScalar(0.75), w);
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const m of mats) m.dispose();
      smokeTex.dispose();
      strands.dispose();
      faceTex.dispose();
      group.removeFromParent();
    },
  };
}
