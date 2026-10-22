// The kill-cams (docs/design/cathode-combat.md S5.3; the rules are sim/killcam.ts).
//   Bullet follow (a ballistic round predict() saw kill): time 0.1, the camera 0.5 m behind the round at FOV 50,
//   orbiting it at 8 deg/s; the round a 0.6 m #FFE0B0 streak with a heat shimmer. No steering: the round flies as
//   fired, and a round that misses after all cuts straight back. Impact: time 0.05 for 200 ms with the x-ray (desktop,
//   full violence), then an orbit of the body at 0.3 to 1000 ms, a ramp to 1 over 250 ms and a 120 ms whip-pan.
//   Last-man orbit (everything else): time 0.25, the camera 3.5 m out at 1.4 m, 35 deg off her line, FOV 45, 2.39:1
//   bars in over 150 ms, orbiting at 20 deg/s for 900 ms while he falls, then a 250 ms ramp, bars out and the cut.
// Any input skips after 300 ms (the session asks `canSkip`). The camera's FOV is handed back on the way out.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { World } from "../render/types";
import type { Enemy } from "./enemy";
import { place } from "./body";
import { KILLCAM, bulletDone, bulletScale, canSkip, orbitBars, orbitDone, orbitScale, whipAt, type KillCamShot } from "../sim/killcam";

const UP = new THREE.Vector3(0, 1, 0);

const XRAY_BLUE = new THREE.Color("#9fd8ff");

/**
 * Bone: ivory, lit (the kill-cam's key and rim give it form), with a cool x-ray edge glow: the cortical rim of each
 * bone reads brighter than its face, as on a film. A low emissive keeps it off black through the grade without
 * flattening it (C17 review: a full-strength emissive washed the skull into a white ball with two dots).
 */
const boneMat = boneMaterial(THREE.FrontSide);
const boneMat2 = boneMaterial(THREE.DoubleSide);
function boneMaterial(side: THREE.Side): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xe9e2d0, emissive: 0x6a8fb0, emissiveIntensity: 0.32, roughness: 0.55, metalness: 0, side });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      float bfr = pow( 1.0 - abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 2.0 );
      gl_FragColor.rgb = gl_FragColor.rgb * ( 0.72 + 0.28 * ( 1.0 - bfr ) ) + vec3( 0.55, 0.8, 1.0 ) * bfr * 0.9;`,
    );
  };
  m.customProgramCacheKey = () => `cathode-bone-${side}`;
  return m;
}
/** The holes in the bone (orbits, nasal aperture, the fracture): a deep blue-black, so they read as cavities. */
const socketMat = new THREE.MeshBasicMaterial({ color: 0x03070d });
const chipMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff2ff, emissiveIntensity: 2.2, roughness: 0.3 });

/** The x-ray shell: the body as a translucent #9FD8FF fresnel (bright at the silhouette, thin across the middle). */
function shellMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, depthWrite: false, side: THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uXray = { value: XRAY_BLUE };
    sh.fragmentShader = sh.fragmentShader.replace("void main() {", "uniform vec3 uXray;\nvoid main() {").replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      float fr = pow( 1.0 - abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 2.2 );
      // The silhouette carries it (C17 review: at 0.25 x 0.35 across the middle the shell all but vanished): a
      // bright fresnel edge at up to 0.8, a 0.12 veil across the middle, so his outline reads round the bones.
      gl_FragColor = vec4( uXray * ( 0.45 + 2.6 * fr ), clamp( 0.12 + 0.95 * fr, 0.0, 0.8 ) );`,
    );
  };
  m.customProgramCacheKey = () => "cathode-xray-shell";
  return m;
}
const shellMat = shellMaterial();

/**
 * A trail along -Z from the origin (the round's nose) to -len: a cone from `r0` to `r1`, its vertex alpha 1 at the
 * nose to 0 at the tail.
 */
function taperedTrail(r0: number, r1: number, len: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, len, 8, 6, true);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -len / 2);
  const pos = g.attributes.position!;
  const col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(1, Math.max(0, -pos.getZ(i) / len));
    const a = Math.pow(1 - u, 2.6);
    col.set([1, 1, 1, a], i * 4);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 4));
  return g;
}

let dotTex: THREE.Texture | null = null;
/** A soft round dot (the heat shimmer round the round). */
function softDot(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.4, "rgba(255,255,255,0.35)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

const v = (x: number, y: number) => new THREE.Vector2(x, y);
const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts.map((p) => {
    const f = flat(p);
    // mergeGeometries needs the same attributes on every part.
    for (const k of Object.keys(f.attributes)) if (k !== "position" && k !== "normal") f.deleteAttribute(k);
    return f;
  }), false)!;
  g.computeVertexNormals();
  return g;
}

/**
 * The cranium: a long, high vault (deeper front to back than wide), the forehead flattening into the brow, the
 * temples pinched in, the occiput swelling at the back. In the skull's frame: Y up the neck, +Z where he faces.
 */
function craniumGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.092, 28, 20);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    // Longer front to back, narrower side to side; the vault high.
    z *= 1.18;
    x *= 0.9;
    y *= y > 0 ? 1.0 : 0.72;
    // The occiput: the back swells and drops.
    if (z < 0) {
      z *= 1 + 0.12 * Math.max(0, -y / 0.09);
    }
    // The temples: pinched in at the sides, forward of the ears.
    if (z > 0.02 && y < 0.04) x *= 0.86;
    // The forehead: flatter, near upright.
    if (z > 0.06) z = 0.06 + (z - 0.06) * 0.55;
    p.setXYZ(i, x, y + 0.16, z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * The face, merged (one draw): the brow ridges over the orbits, the orbit rims, the cheekbones and their arches
 * back to the ears, the maxilla with the nasal aperture's rim, the upper teeth.
 */
function faceGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    // The orbit's rim: a squarish ring round the socket.
    const rim = new THREE.TorusGeometry(0.026, 0.0075, 6, 18);
    rim.scale(1.05, 0.9, 1);
    rim.rotateY(sx * 0.22);
    rim.translate(sx * 0.036, 0.142, 0.083);
    parts.push(rim);
    // The brow ridge over it.
    const brow = new THREE.CapsuleGeometry(0.009, 0.034, 3, 8);
    brow.rotateZ(Math.PI / 2 + sx * 0.12);
    brow.translate(sx * 0.034, 0.17, 0.088);
    parts.push(brow);
    // The cheekbone (zygoma) and its arch back toward the ear.
    const cheek = new THREE.SphereGeometry(0.02, 10, 8);
    cheek.scale(1.1, 0.8, 0.8);
    cheek.translate(sx * 0.05, 0.112, 0.07);
    parts.push(cheek);
    const arch = new THREE.CapsuleGeometry(0.007, 0.05, 2, 6);
    arch.rotateX(Math.PI / 2);
    arch.rotateY(sx * 0.18);
    arch.translate(sx * 0.07, 0.112, 0.035);
    parts.push(arch);
  }
  // The maxilla: the upper jaw under the nose, rounded to the tooth row.
  const max = new THREE.CylinderGeometry(0.038, 0.034, 0.04, 16, 1, false, -Math.PI * 0.55, Math.PI * 1.1);
  max.scale(1, 1, 0.8);
  max.translate(0, 0.08, 0.05);
  parts.push(max);
  // The nasal aperture's rim and the nasal bones over it.
  const nose = new THREE.TorusGeometry(0.013, 0.004, 4, 12);
  nose.scale(0.9, 1.4, 1);
  nose.translate(0, 0.108, 0.094);
  parts.push(nose);
  // The upper teeth: a curved row, each a small block with a gap.
  for (let i = 0; i < 12; i++) {
    const a = ((i - 5.5) / 5.5) * 1.05;
    const w = Math.abs(i - 5.5) < 2 ? 0.0078 : 0.0068;
    const t = new THREE.BoxGeometry(w, 0.016, 0.009);
    t.rotateY(a);
    t.translate(Math.sin(a) * 0.033, 0.054, 0.05 + Math.cos(a) * 0.03);
    parts.push(t);
  }
  return merged(parts);
}

/** The mandible: the U of the jaw with a squared chin, the two rami up to the hinge, and the lower teeth. */
function mandibleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = ((i / 16) * 2 - 1) * 1.45;
    pts.push(new THREE.Vector3(Math.sin(a) * 0.044, 0.03 - 0.004 * Math.cos(a), 0.035 + Math.cos(a) * 0.04));
  }
  parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0085, 6));
  // The chin.
  const chin = new THREE.SphereGeometry(0.014, 10, 8);
  chin.scale(1.4, 1, 0.8);
  chin.translate(0, 0.027, 0.075);
  parts.push(chin);
  for (const sx of [-1, 1]) {
    const ramus = new THREE.BoxGeometry(0.008, 0.05, 0.022);
    ramus.rotateX(-0.25);
    ramus.translate(sx * 0.064, 0.057, 0.0);
    parts.push(ramus);
  }
  for (let i = 0; i < 12; i++) {
    const a = ((i - 5.5) / 5.5) * 1.0;
    const t = new THREE.BoxGeometry(0.0068, 0.013, 0.008);
    t.rotateY(a);
    t.translate(Math.sin(a) * 0.03, 0.041, 0.047 + Math.cos(a) * 0.027);
    parts.push(t);
  }
  return merged(parts);
}

/** The cavities, in one draw: the two orbits (deep, squarish, tilted out), the nasal aperture, the ear holes. */
function cavityGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const o = new THREE.SphereGeometry(0.024, 12, 10);
    o.scale(1.05, 0.88, 0.55);
    o.rotateY(sx * 0.22);
    o.translate(sx * 0.036, 0.142, 0.08);
    parts.push(o);
  }
  // The nasal aperture: an inverted heart, wide at the base.
  const n = new THREE.ConeGeometry(0.012, 0.03, 3);
  n.rotateZ(Math.PI);
  n.scale(1, 1, 0.5);
  n.translate(0, 0.106, 0.091);
  parts.push(n);
  return merged(parts);
}

/** The fracture: a jagged line of dark slivers across the cranium's front, turned to face the round on impact. */
function crackGeometry(): THREE.BufferGeometry {
  const pts: Array<[number, number]> = [[-0.026, 0.236], [0.004, 0.214], [-0.008, 0.198], [0.018, 0.184], [0.008, 0.17], [0.024, 0.156]];
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const b = new THREE.BoxGeometry(0.004, len + 0.003, 0.008);
    b.rotateZ(-Math.atan2(x1 - x0, y1 - y0));
    // On the cranium's face (radius about 0.092, the forehead about 0.085 forward).
    b.translate((x0 + x1) / 2, (y0 + y1) / 2, 0.088);
    parts.push(b);
  }
  return merged(parts);
}

/**
 * A long bone along +Y over unit length (stretched to the joints): a lathe with a slender shaft, flaring to the
 * knuckled ends (the epiphyses and condyles), so it reads as bone, not a tube.
 */
function longBoneGeometry(r: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [v(0, -0.005)];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const y = i / N;
    const e0 = Math.exp(-Math.pow(y / 0.075, 2));
    const e1 = Math.exp(-Math.pow((1 - y) / 0.075, 2));
    // The shaft narrows a little toward the middle.
    const mid = 1 - 0.12 * Math.sin(Math.PI * y);
    pts.push(v(r * (mid + 1.05 * e0 + 0.85 * e1), y));
  }
  pts.push(v(0, 1.005));
  return new THREE.LatheGeometry(pts, 10);
}
/** A pair of long bones side by side (the forearm's radius and ulna, the shin's tibia and fibula). */
function pairBoneGeometry(r: number): THREE.BufferGeometry {
  const a = longBoneGeometry(r);
  a.translate(r * 0.9, 0, 0);
  const b = longBoneGeometry(r * 0.62);
  b.translate(-r * 1.15, 0, -r * 0.4);
  return merged([a, b]);
}

/**
 * The spine over unit length (stretched pelvis to chest, or chest to neck): `n` vertebrae, each a body (a short
 * drum) with its spinous process angled down the back and two transverse processes, with a gap (the disc) between.
 * It sits at the back of the trunk (-Z).
 */
function spineGeometry(n: number, r: number, z: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const h = 1 / n;
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5) * h;
    const k = 1 - (i / n) * 0.25;
    const body = new THREE.CylinderGeometry(r * k, r * k, h * 0.62, 10);
    body.translate(0, y, z);
    parts.push(body);
    const spinous = new THREE.BoxGeometry(r * 0.35, h * 0.32, r * 1.5);
    spinous.rotateX(0.5);
    spinous.translate(0, y - h * 0.1, z - r * 1.6);
    parts.push(spinous);
    const trans = new THREE.BoxGeometry(r * 3.0 * k, h * 0.22, r * 0.45);
    trans.translate(0, y, z - r * 0.9);
    parts.push(trans);
  }
  return merged(parts);
}

/**
 * The ribcage in the chest's frame (origin at the chest joint, Y toward the neck, +Z his front): ten pairs of
 * ribs from the spine at the back, round and down to the front (the lower two floating), the costal cartilage to
 * the sternum, the sternum, and the shoulder blades on the back.
 */
function ribcageGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const back = -0.075;
  for (let i = 0; i < 10; i++) {
    const yb = 0.27 - i * 0.027;
    const a = 0.06 + 0.085 * Math.min(1, i / 5.5) - (i > 7 ? 0.012 * (i - 7) : 0);
    const b = 0.075 + 0.025 * Math.min(1, i / 4);
    const drop = 0.06 + i * 0.005;
    const end = i >= 8 ? 0.55 : 0.84;
    for (const sx of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) {
        const th = (k / 10) * end * Math.PI;
        pts.push(new THREE.Vector3(sx * a * Math.sin(th) * (k === 0 ? 0.3 : 1), yb - drop * Math.pow(th / Math.PI, 1.3), back + b - b * Math.cos(th)));
      }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.0058, 5));
      if (i < 7) {
        // The cartilage up and in to the sternum.
        const p = pts[pts.length - 1]!;
        const q = new THREE.Vector3(sx * 0.012, 0.215 - i * 0.024, back + 2 * b - 0.004);
        parts.push(new THREE.TubeGeometry(new THREE.LineCurve3(p, q), 3, 0.0042, 4));
      }
    }
  }
  // The sternum: the manubrium and the blade, tapering down.
  const st = new THREE.CylinderGeometry(0.018, 0.011, 0.17, 6);
  st.scale(1, 1, 0.45);
  st.rotateX(-0.12);
  st.translate(0, 0.15, back + 0.2 - 0.002);
  parts.push(st);
  // The shoulder blades: flat triangles on the upper back.
  for (const sx of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(sx * 0.075, 0.012);
    sh.lineTo(sx * 0.02, -0.12);
    sh.closePath();
    const sc = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 1 });
    sc.rotateY(sx * 0.35);
    sc.translate(sx * 0.035, 0.26, back - 0.03);
    parts.push(sc);
  }
  return merged(parts);
}

/** The pelvis in its own frame (origin at the pelvis joint, Y toward the chest, +Z his front): the iliac wings, the sacrum, the pubic ring and the hip sockets. */
function pelvisGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    // The wing: a curved, flaring plate (part of a shell), its crest a rolled rim.
    const wing = new THREE.SphereGeometry(0.085, 12, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.12, Math.PI * 0.42);
    wing.scale(0.85, 1.0, 0.75);
    wing.rotateY(sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    wing.rotateZ(sx * 0.35);
    wing.translate(sx * 0.03, -0.03, -0.01);
    parts.push(wing);
    const crest = new THREE.TorusGeometry(0.07, 0.007, 5, 14, Math.PI * 0.75);
    crest.rotateY(Math.PI / 2);
    crest.rotateX(-Math.PI * 0.05);
    crest.rotateZ(sx * 0.4);
    crest.translate(sx * 0.07, 0.01, 0.0);
    parts.push(crest);
    // The hip socket.
    const sock = new THREE.TorusGeometry(0.022, 0.007, 5, 12);
    sock.rotateY(Math.PI / 2);
    sock.translate(sx * 0.1, -0.06, 0.02);
    parts.push(sock);
  }
  // The pubic ring: low and forward, closing the basin.
  const ring = new THREE.TorusGeometry(0.06, 0.011, 6, 20);
  ring.rotateX(Math.PI / 2 - 0.5);
  ring.scale(1.25, 1, 0.9);
  ring.translate(0, -0.075, 0.025);
  parts.push(ring);
  // The sacrum: a tapering wedge down the back.
  const sac = new THREE.CylinderGeometry(0.035, 0.012, 0.11, 6);
  sac.scale(1, 1, 0.5);
  sac.rotateX(0.35);
  sac.translate(0, -0.04, -0.06);
  parts.push(sac);
  return merged(parts);
}

/** The hand's bones (unit length, wrist to knuckles): five metacarpals fanning out, the finger bones curled. */
function handGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.22;
    const m = longBoneGeometry(0.05);
    m.scale(1, 0.55, 1);
    m.rotateZ(-x * 0.25);
    m.translate(x * 0.35, 0.2, 0);
    parts.push(m);
    const f = longBoneGeometry(0.04);
    f.scale(1, 0.4, 1);
    f.rotateX(0.5);
    f.rotateZ(-x * 0.3);
    f.translate(x * 0.45, 0.72, 0.03);
    parts.push(f);
  }
  return merged(parts);
}

// Built once (a kill-cam builds its skeleton lazily, at the impact; the geometry is shared after).
let G: ReturnType<typeof buildGeometry> | null = null;
function buildGeometry() {
  return {
    cranium: craniumGeometry(),
    face: faceGeometry(),
    jaw: mandibleGeometry(),
    cavity: cavityGeometry(),
    crack: crackGeometry(),
    humerus: longBoneGeometry(0.016),
    forearm: pairBoneGeometry(0.011),
    femur: longBoneGeometry(0.021),
    shin: pairBoneGeometry(0.016),
    clavicle: longBoneGeometry(0.008),
    lumbar: spineGeometry(5, 0.024, -0.05),
    thoracic: spineGeometry(10, 0.017, -0.07),
    ribs: ribcageGeometry(),
    pelvis: pelvisGeometry(),
    hand: handGeometry(),
  };
}

/**
 * The skeleton, hung on the body's joints (C17 review: "Sniper Elite-grade bone"): a skull with its vault, orbits,
 * cheekbones, teeth and a hinged mandible; the spine as separate vertebrae; a ribcage of curved ribs on a sternum;
 * the pelvis's wings and ring; long bones with knuckled ends (paired in the forearm and shin); the hands' bones.
 */
class Skeleton {
  readonly root = new THREE.Group();
  private parts: Array<{ o: THREE.Object3D; a: string; b: string; stretch: boolean | "all" }> = [];
  readonly skull = new THREE.Group();
  readonly ribs = new THREE.Group();
  /** The fracture line on the struck side (hidden until the round lands). */
  readonly crack: THREE.Mesh;

  constructor() {
    G ??= buildGeometry();
    const g = G;
    const bone = (geo: THREE.BufferGeometry, a: string, b: string, stretch: boolean | "all", mat = boneMat) => {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(geo, mat));
      this.root.add(grp);
      this.parts.push({ o: grp, a, b, stretch });
      return grp;
    };
    bone(g.lumbar, "pelvis", "chest", true);
    bone(g.thoracic, "chest", "neck", true);
    for (const s of ["L", "R"]) {
      bone(g.humerus, `shoulder${s}`, `elbow${s}`, true);
      bone(g.forearm, `elbow${s}`, `wrist${s}`, true);
      // The hand scales whole with its length (its geometry is in units of it).
      bone(g.hand, `wrist${s}`, `hand${s}`, "all");
      bone(g.femur, `hip${s}`, `knee${s}`, true);
      bone(g.shin, `knee${s}`, `foot${s}`, true);
      bone(g.clavicle, `clavicle${s}`, `shoulder${s}`, true);
    }
    this.ribs.add(new THREE.Mesh(g.ribs, boneMat2));
    this.root.add(this.ribs);
    this.parts.push({ o: this.ribs, a: "chest", b: "neck", stretch: false });
    bone(g.pelvis, "pelvis", "chest", false, boneMat2);
    // The skull: the vault, the face, the cavities and the mandible (hinged at the ears).
    this.skull.add(new THREE.Mesh(g.cranium, boneMat));
    const face = new THREE.Mesh(g.face, boneMat);
    face.name = "face";
    this.skull.add(face);
    this.skull.add(new THREE.Mesh(g.cavity, socketMat));
    const jaw = new THREE.Group();
    jaw.name = "jaw";
    jaw.position.set(0, 0.1, 0.0);
    const jm = new THREE.Mesh(g.jaw, boneMat);
    jm.position.set(0, -0.1, 0);
    jaw.add(jm);
    this.skull.add(jaw);
    this.crack = new THREE.Mesh(g.crack, socketMat);
    this.crack.name = "crack";
    this.crack.visible = false;
    this.skull.add(this.crack);
    this.root.add(this.skull);
    this.parts.push({ o: this.skull, a: "neck", b: "head", stretch: false });
  }

  pose(e: Enemy): void {
    const j = e.body.joints as Record<string, THREE.Vector3>;
    const k = e.body.scale ?? 1;
    for (const p of this.parts) {
      const a = j[p.a];
      const b = j[p.b];
      if (!a || !b) continue;
      place(p.o, a, b, e.body.facing);
      if (p.stretch === "all") p.o.scale.setScalar(Math.max(0.02, a.distanceTo(b) * 1.6));
      else if (p.stretch) p.o.scale.set(k, Math.max(0.02, a.distanceTo(b)), k);
      else p.o.scale.setScalar(k);
    }
    this.skull.visible = !e.body.lost.has("head");
  }
}

interface Chip {
  m: THREE.Mesh;
  v: THREE.Vector3;
  spin: THREE.Vector3;
}

export interface KillCamOptions {
  /** The x-ray at the impact: desktop with full violence only (S5.3). */
  xray: boolean;
  /** Where a camera ray first meets the world from `from` along `dir` within `len` (null: clear). */
  cast?: (from: THREE.Vector3, dir: THREE.Vector3, len: number) => number | null;
  /** The crack's sound, on the impact frame. */
  onCrack?: () => void;
  /** A bullet follow whose round missed after all (the cooldown it took is handed back). */
  onMiss?: () => void;
}

/** What the kill-cam needs of a round in flight. */
export interface FollowedRound {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  alive: boolean;
}

export class KillCam {
  active = false;
  shot: KillCamShot | null = null;
  /** Real ms since it began, and since the round struck (bullet follow; -1 in flight). */
  ms = 0;
  sinceImpact = -1;
  /** Metres from her to the target at the trigger pull (for the caption). */
  distance = 0;
  /**
   * Set by the caller before a start: the lower third's label (by trigger: "Long shot", "Last man · Headshot",
   * "Multi-kill"; null shows none) and the range predict() measured at the trigger pull (0: measure it here).
   */
  caption: string | null = null;
  shotDistance = 0;
  /** The 2.39:1 bars, 0..1, and the whip-pan smear, 0..1. */
  bars = 0;
  whip = 0;
  /** The x-ray shell is on. */
  xrayOn = false;
  private round: FollowedRound | null = null;
  private target: Enemy | null = null;
  private joint: "head" | "chest" = "chest";
  private dir = new THREE.Vector3();
  private side = new THREE.Vector3();
  private sign = 1;
  private readonly streak: THREE.Group;
  private skel: Skeleton | null = null;
  private saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private chips: Chip[] = [];
  private lookAt = new THREE.Vector3();
  private fov0 = 0;
  private from = new THREE.Vector3();
  private missed = false;
  /** The orbit's home direction from him: her line back from him, turned 35 degrees off it (S5.3). */
  private readonly home = new THREE.Vector3();
  /** How far out the orbit stands (3.5 m, less only when no side is clear), and the point on the street it turns round. */
  private radius: number = KILLCAM.orbit.radius;
  private readonly anchor = new THREE.Vector3();
  /** The round's distance to the target when the follow began (the FOV push runs on how much of it is left). */
  private flight0 = 1;
  // Scratch (the cam runs every frame: no allocation).
  private readonly tmp = new THREE.Vector3();
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly v3 = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  // The kill-cam's own lighting: a warm key from the camera's side and a cool rim behind him, through the world's
  // light pool (no new light in the scene, so no shader recompile), so the Enforcer's materials read instead of a
  // grey figure in the noir grade.
  private readonly key = { pos: new THREE.Vector3(), color: new THREE.Color(1.0, 0.78, 0.6), intensity: 0, range: 6 };
  private readonly rim = { pos: new THREE.Vector3(), color: new THREE.Color(0.35, 0.8, 1.0), intensity: 0, range: 6 };
  private lightsOff: Array<() => void> = [];

  constructor(
    private readonly world: World,
    private readonly opts: KillCamOptions = { xray: false },
  ) {
    // The round: a hot streak (a core and a softer glow) behind a brass slug, and a heat shimmer round it. The
    // slug is drawn half again as big as life: from half a metre behind, the real 9 mm is a speck.
    this.streak = new THREE.Group();
    const S = KILLCAM.bullet.streak;
    // The streak fades to nothing along its tail (vertex alpha) and ends short of the lens (the camera rides
    // 0.5 m behind the round), so it reads as a hot trace ahead of the camera, never a bar through the frame.
    const len = Math.min(S.length, KILLCAM.bullet.back * 0.7);
    const core = new THREE.Mesh(taperedTrail(0.0042, 0.0008, len), new THREE.MeshBasicMaterial({ color: S.color, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const glow = new THREE.Mesh(taperedTrail(0.016, 0.003, len * 0.8), new THREE.MeshBasicMaterial({ color: 0xffb070, vertexColors: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const slug = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.018, 4, 10), new THREE.MeshStandardMaterial({ color: 0xc89a48, metalness: 1, roughness: 0.22, emissive: 0x5a3200, emissiveIntensity: 1.4 }));
    slug.rotation.x = Math.PI / 2;
    slug.scale.setScalar(1.5);
    const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffe0b0, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    haze.scale.set(0.07, 0.07, 1);
    this.streak.add(core, glow, slug, haze);
    this.streak.visible = false;
    this.streak.name = "killcam:round";
    world.scene.add(this.streak);
  }

  /** Rides a ballistic round onto `target` (whose `joint` predict() saw it strike). */
  startBullet(round: FollowedRound, target: Enemy, joint: "head" | "chest"): void {
    const dist = this.shotDistance;
    this.begin("bullet", target);
    this.round = round;
    this.joint = joint;
    this.dir.copy(round.vel).normalize();
    const aim = joint === "head" ? target.body.joints.head : target.body.joints.chest;
    // The whole flight (the range at the trigger pull, when the caller measured it): the push runs on how much of
    // it is left, so a follow picked up mid-flight is already part-way pushed in.
    this.flight0 = Math.max(0.5, round.pos.distanceTo(aim), dist);
    this.distance = dist > 0 ? dist : this.flight0;
    this.streak.visible = true;
    this.world.setDrama(0.4);
  }

  /** The last-man orbit round the man just killed, from `eye` (where she is). */
  startOrbit(target: Enemy, eye: THREE.Vector3): void {
    const dist = this.shotDistance;
    this.begin("orbit", target);
    this.from.copy(eye);
    this.distance = dist > 0 ? dist : eye.distanceTo(target.body.joints.chest);
    // Her line onto him, flat: the camera stands 35 degrees off it, on his front (the side she shot).
    this.dir.copy(target.body.joints.chest).sub(eye).setY(0).normalize();
    this.aim(target, KILLCAM.orbit.radius);
    this.world.setDrama(0.45);
  }

  /**
   * Where the camera stands (S5.3): `radius` out from him along the line back to her, turned 35 degrees off it, at
   * 1.4 m. The side is whichever is clear; a wall closer than 2.5 m swings the camera wider (55, then 75 degrees) or
   * to the other side rather than pulling it in onto his chest. `dir` is her line onto him, flat. Sets `home` (the
   * unit direction from him to the camera), `radius` (how far out it can stand) and `sign` (the orbit turns back
   * toward her line, so the shot opens on his side and ends on the face she saw).
   */
  private aim(target: Enemy, radius: number): void {
    const toHer = this.v2.copy(this.dir).negate();
    if (toHer.lengthSq() < 1e-6) toHer.copy(target.body.facing).setY(0);
    toHer.normalize();
    const c = this.v1.copy(target.body.joints.pelvis);
    c.y = this.groundY(target) + 1.0;
    const D = Math.PI / 180;
    const off = KILLCAM.orbit.offDeg;
    // The side first: the one a deterministic coin (his id) prefers, then the other; then wider swings.
    const pref = (target.id ?? 0) % 2 === 0 ? 1 : -1;
    const tries = [off * pref, -off * pref, 55 * pref, -55 * pref, 75 * pref, -75 * pref, 20 * pref, -20 * pref];
    this.triesLog = "";
    let best = tries[0]!;
    let bestClear = -1;
    for (const deg of tries) {
      // The whole sweep must be clear: the start, and where 900 ms of orbit back toward her line leaves it.
      let clear = radius;
      for (const sweep of [0, -Math.sign(deg) * KILLCAM.orbit.degS]) {
        // Cast at the camera itself (out `radius` and up to its 1.4 m), not just level with his hips: a low wall
        // or a stall's awning can sit between the two.
        const dd = this.tmp.copy(toHer).applyAxisAngle(UP, (deg + sweep) * D);
        const flatHit = this.opts.cast?.(c, dd, radius + 0.3) ?? null;
        if (flatHit !== null) clear = Math.min(clear, flatHit - 0.3);
        dd.multiplyScalar(radius);
        dd.y = KILLCAM.orbit.height - 1.0;
        const len = dd.length();
        const hit = this.opts.cast?.(c, dd.divideScalar(len), len + 0.3) ?? null;
        if (hit !== null) clear = Math.min(clear, ((hit - 0.3) / len) * radius);
        // The drawn world too: an awning, a facade or a stall's roof has no collider, and a camera inside one
        // shows a flat grey frame (C17 r3).
        const meshHit = this.meshCast(c, dd, len + 0.3, target);
        if (meshHit !== null) clear = Math.min(clear, ((meshHit - 0.3) / len) * radius);
        // And back from the camera to him: a ray that starts inside a box (he fell against a wall) never sees it.
        const camAt = this.v3.copy(c).addScaledVector(dd, len);
        const back = this.opts.cast?.(camAt, dd.negate(), len) ?? null;
        if (back !== null) clear = Math.min(clear, ((len - back - 0.3) / len) * radius);
      }
      this.triesLog += `${deg}:${clear.toFixed(2)} `;
      if (clear >= radius - 0.01) {
        best = deg;
        bestClear = clear;
        break;
      }
      if (clear > bestClear + 0.05) {
        best = deg;
        bestClear = clear;
      }
    }
    this.radius = Math.max(KILLCAM.orbit.minRadius, Math.min(radius, bestClear));
    this.home.copy(toHer).applyAxisAngle(UP, best * D);
    this.sign = best > 0 ? -1 : 1;
    this.anchor.copy(target.body.joints.pelvis).setY(this.groundY(target));
  }

  private readonly ray = new THREE.Raycaster();
  private readonly rayHits: THREE.Intersection[] = [];
  /** The nearest drawn, opaque world surface along a ray (not him, nor anything see-through), or null. */
  private meshCast(from: THREE.Vector3, dir: THREE.Vector3, len: number, target: Enemy): number | null {
    this.ray.set(from, dir);
    this.ray.near = 0.05;
    this.ray.far = len;
    this.rayHits.length = 0;
    // Only opaque, static meshes are asked (a sprite's or a line's raycast needs more than a ray, and his own
    // body, a see-through sheet or the outline twins never block the shot).
    const skip = new Set<THREE.Object3D>([target.body.root, target.rifle]);
    const walk = (o: THREE.Object3D) => {
      if (!o.visible || skip.has(o) || o.name.startsWith("killcam")) return;
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && !(m as unknown as THREE.InstancedMesh).isInstancedMesh && m.name !== "outline") {
        const mat = m.material as THREE.Material;
        if (mat && !Array.isArray(mat) && !mat.transparent && mat.depthWrite) m.raycast(this.ray, this.rayHits);
      }
      for (const c of o.children) walk(c);
    };
    walk(this.world.scene);
    let best: number | null = null;
    for (const h of this.rayHits) if (best === null || h.distance < best) best = h.distance;
    return best;
  }

  /** For the screenshot stages' sidecar: where the orbit stands and why. */
  frameInfo(): { radius: number; home: number[]; anchor: number[]; cam: number[]; tries: string } {
    const r = (v: THREE.Vector3) => v.toArray().map((x) => Math.round(x * 100) / 100);
    return { radius: this.radius, home: r(this.home), anchor: r(this.anchor), cam: r(this.world.camera.position), tries: this.triesLog };
  }
  private triesLog = "";

  /** The street under him (his feet, or his pelvis on the floor). */
  private groundY(target: Enemy): number {
    return target.position.y;
  }

  private begin(shot: KillCamShot, target: Enemy): void {
    const caption = this.caption;
    if (this.active) this.finish();
    this.caption = caption;
    this.shotDistance = 0;
    this.active = true;
    this.shot = shot;
    this.target = target;
    this.ms = 0;
    this.sinceImpact = -1;
    this.bars = 0;
    this.whip = 0;
    this.missed = false;
    this.sign = Math.random() < 0.5 ? -1 : 1;
    this.fov0 = this.world.camera.fov;
    if (this.world.liveLight && !this.lightsOff.length) this.lightsOff.push(this.world.liveLight(this.key), this.world.liveLight(this.rim));
  }

  /** Game time passes at this rate while the kill-cam runs. */
  get timeScale(): number {
    if (!this.active) return 1;
    if (this.shot === "orbit") return orbitScale(this.ms);
    if (this.missed) return 1;
    return bulletScale(this.sinceImpact < 0 ? null : this.sinceImpact);
  }

  /**
   * The lower third's level, 0..1, on the cam's own clock (so every motion setting shows it at the same moment):
   * the orbit's once the bars are in, the bullet follow's at the impact; out with the ramp back.
   */
  get captionLevel(): number {
    if (!this.active || !this.caption) return 0;
    const ss = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
    if (this.shot === "orbit") {
      const O = KILLCAM.orbit;
      return ss(O.barsMs, O.barsMs + 180, this.ms) * (1 - ss(O.holdMs, O.holdMs + O.rampMs * 0.6, this.ms));
    }
    if (this.sinceImpact < 0) return 0;
    const B = KILLCAM.bullet;
    return ss(0, 180, this.sinceImpact) * (1 - ss(B.orbitEndMs, B.orbitEndMs + B.rampMs * 0.6, this.sinceImpact));
  }

  /** Any input skips after 300 ms. */
  get skippable(): boolean {
    return this.active && canSkip(this.ms);
  }

  skip(): boolean {
    if (!this.skippable) return false;
    this.finish();
    return true;
  }

  /** Moves the world camera for the shot. Real (unscaled) dt. */
  update(realDt: number): void {
    if (!this.active || !this.target) return;
    this.ms += realDt * 1000;
    if (this.shot === "orbit") this.updateOrbit(realDt);
    else this.updateBullet(realDt);
    if (!this.active) return;
    this.updateChips(realDt * this.timeScale);
    if (this.skel && this.target) this.skel.pose(this.target);
    this.light();
  }

  /** The key from the camera's side and above, the rim from behind him; the focus on his head. */
  private light(): void {
    const tgt = this.target;
    if (!tgt) return;
    const cam = this.world.camera;
    const head = tgt.body.joints.head;
    const toCam = this.v1.copy(cam.position).sub(head).setY(0);
    if (toCam.lengthSq() < 1e-6) toCam.set(0, 0, 1);
    toCam.normalize();
    const across = this.v2.crossVectors(toCam, UP).multiplyScalar(this.sign);
    const k = this.shot === "bullet" && this.sinceImpact < 0 ? 0.6 : 1;
    this.key.pos.copy(head).addScaledVector(toCam, 1.3).addScaledVector(across, 0.9).add(this.v3.set(0, 0.7, 0));
    this.key.intensity = 11 * k;
    this.rim.pos.copy(head).addScaledVector(toCam, -1.4).addScaledVector(across, -0.6).add(this.v3.set(0, 0.5, 0));
    this.rim.intensity = 16 * k;
    // The depth of field's focal point: his head, wherever it is on screen (the blur grows away from it).
    const p = this.v3.copy(head).project(cam);
    this.world.setFocus?.(THREE.MathUtils.clamp(p.x * 0.5 + 0.5, 0, 1), THREE.MathUtils.clamp(p.y * 0.5 + 0.5, 0, 1));
  }

  private updateOrbit(realDt: number): void {
    const O = KILLCAM.orbit;
    const cam = this.world.camera;
    const tgt = this.target!;
    const want = this.orbitPose(this.ms / 1000, O.degS, this.v2);
    // The look: between his hips and head (the head lands in the upper third at 3.5 m and FOV 45), never lower
    // than half a metre off the street, so a man on the floor is framed with the street round him.
    const j = tgt.body.joints;
    const centre = this.tmp.copy(j.pelvis).lerp(j.head, 0.32);
    centre.y = Math.max(centre.y, this.anchor.y + 0.5);
    if (this.ms <= realDt * 1000 + 1) {
      cam.position.copy(want);
      this.lookAt.copy(centre);
    } else {
      cam.position.lerp(want, 1 - Math.exp(-realDt * 10));
      this.lookAt.lerp(centre, 1 - Math.exp(-realDt * 6));
    }
    cam.lookAt(this.lookAt);
    this.setFov(O.fov);
    this.bars = orbitBars(this.ms);
    if (orbitDone(this.ms)) this.finish();
  }

  /** The orbit camera `s` seconds in at `degS`: `radius` out along `home` turned by the orbit, 1.4 m off the street. */
  private orbitPose(s: number, degS: number, out: THREE.Vector3): THREE.Vector3 {
    const a = this.sign * ((degS * Math.PI) / 180) * s;
    const d = this.v1.copy(this.home).applyAxisAngle(UP, a);
    out.copy(this.anchor).addScaledVector(d, this.radius);
    out.y = this.anchor.y + KILLCAM.orbit.height;
    return out;
  }

  private updateBullet(realDt: number): void {
    const B = KILLCAM.bullet;
    const cam = this.world.camera;
    const tgt = this.target!;
    const p = this.round!;
    const aimPt = this.joint === "head" ? tgt.body.joints.head : tgt.body.joints.chest;
    if (this.sinceImpact < 0 && !p.alive) {
      // Struck: him (the cam's shot), or something else after all (a miss cuts straight back).
      if (tgt.alive) {
        this.miss();
        return;
      }
      this.sinceImpact = 0;
      this.world.setHaze?.(0, 0, 0, 0);
      // Her line is the round's: the body orbit stands off it as the last-man orbit does, a little closer.
      this.dir.setY(0).normalize();
      this.aim(tgt, B.bodyRadius);
      if (this.opts.xray) this.xray(true);
      this.crack(this.v1.copy(p.pos).lerp(aimPt, 0.5));
      this.opts.onCrack?.();
      this.world.setDrama(0.45);
    } else if (this.sinceImpact >= 0) this.sinceImpact += realDt * 1000;
    if (this.sinceImpact < 0 && this.ms > B.flightCapMs) {
      // Too long a flight for cinema: cut back and let it land on its own.
      this.miss();
      return;
    }
    this.side.crossVectors(this.dir, UP).normalize().multiplyScalar(this.sign);
    this.streak.visible = p.alive;
    if (p.alive) {
      this.dir.copy(p.vel).normalize();
      this.streak.position.copy(p.pos);
      this.streak.lookAt(this.tmp.copy(p.pos).add(this.dir));
      // The push: the FOV closes from 50 toward the one that makes him 40% of the barred frame's height, fast at
      // first (he grows in the frame while the round is still well out), so by 200 ms he is the shot.
      const toT = p.pos.distanceTo(aimPt);
      const left = THREE.MathUtils.clamp(toT / this.flight0, 0, 1);
      const band = Math.min(1, cam.aspect / 2.39);
      const camToT = toT + B.back;
      const fit = THREE.MathUtils.radToDeg(2 * Math.atan(1.9 / (2 * 0.4 * camToT * band)));
      const fov = THREE.MathUtils.lerp(B.fov, THREE.MathUtils.clamp(fit, 7, B.fov), Math.pow(1 - left, 0.4));
      this.setFov(fov);
      // On the round's line: 0.5 m behind it and a touch above (the round sits just under the centre, in the
      // lower-middle), the camera's slow roll round the line at 8 deg/s, and the look straight down the line
      // at his head, so the round leads the eye into him.
      const up = this.v1.crossVectors(this.side, this.dir).normalize();
      if (up.y < 0) up.negate();
      // The 8 deg/s orbit round the line, as a slow swing of the lift (never far enough to slide the round off
      // the centre line: a 0.4 s flight turns it about 3 degrees).
      const spin = (this.sign * ((B.orbitDegS * Math.PI) / 180) * this.ms) / 1000;
      const lift = 0.06;
      cam.position.copy(p.pos).addScaledVector(this.dir, -B.back).addScaledVector(up, lift * Math.cos(spin)).addScaledVector(this.side, lift * Math.sin(spin));
      this.lookAt.copy(aimPt);
      cam.lookAt(this.lookAt);
      cam.updateMatrixWorld();
      // The heat haze round the round (and its wake back to the lens).
      const sp = this.v3.copy(p.pos).project(cam);
      this.world.setHaze?.(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5, 0.05, 1);
      this.bars = Math.min(1, this.ms / KILLCAM.orbit.barsMs);
    } else {
      // The body: the camera cuts round to 35 degrees off the round's line as it lands, then a slow orbit (0.5 of
      // the last-man's 20 deg/s, as time runs at 0.3) while he goes down, opening out a little.
      const t = this.sinceImpact;
      const j = tgt.body.joints;
      const centre = this.tmp.copy(j.pelvis).lerp(j.head, 0.32);
      centre.y = Math.max(centre.y, this.anchor.y + 0.5);
      const want = this.orbitPose(t / 1000, 10, this.v2);
      want.addScaledVector(this.v3.subVectors(want, this.anchor).setY(0).normalize(), t / 2500);
      if (t <= realDt * 1000 + 1) {
        cam.position.copy(want);
        this.lookAt.copy(centre);
      } else {
        cam.position.lerp(want, 1 - Math.exp(-realDt * 8));
        this.lookAt.lerp(centre, 1 - Math.exp(-realDt * 8));
      }
      this.setFov(KILLCAM.orbit.fov);
      if (this.xrayOn && t > B.xrayMs) this.xray(false);
      this.whip = whipAt(t);
      this.bars = Math.max(0, 1 - Math.max(0, t - B.orbitEndMs) / B.rampMs);
      if (bulletDone(t)) {
        this.finish();
        return;
      }
    }
    cam.lookAt(this.lookAt);
  }

  private miss(): void {
    this.missed = true;
    this.opts.onMiss?.();
    this.finish();
  }

  private setFov(f: number): void {
    const cam = this.world.camera;
    if (Math.abs(cam.fov - f) > 1e-3) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }
  }

  /** The struck bone cracks (a fracture line on the side the round came from) and sheds 6 to 10 white chips. */
  private crack(at: THREE.Vector3): void {
    if (!this.xrayOn || !this.skel || !this.target) return;
    // The chips leave from the bone's surface where the round went in, slowly, so they stay in the frame.
    const from = this.v2.copy(this.target.body.joints[this.joint === "head" ? "head" : "chest"]).addScaledVector(this.dir, this.joint === "head" ? -0.07 : -0.11);
    from.lerp(at, 0.25);
    const n = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const g = new THREE.TetrahedronGeometry(0.007 + Math.random() * 0.008);
      const m = new THREE.Mesh(g, chipMat);
      m.position.copy(from);
      const v = this.dir.clone().multiplyScalar(0.5 + Math.random() * 0.4).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, Math.random() * 0.55, (Math.random() - 0.5) * 0.7));
      this.world.scene.add(m);
      this.chips.push({ m, v, spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20) });
    }
    // The bone itself: the fracture turns to face the round, the jaw drops, the ribs jolt apart along the shot.
    this.skel.pose(this.target);
    if (this.joint === "head") {
      const local = this.v3.copy(this.dir).negate().applyQuaternion(this.q.copy(this.skel.skull.quaternion).invert());
      this.skel.crack.rotation.y = Math.atan2(local.x, local.z);
      this.skel.crack.visible = true;
      for (const c of this.skel.skull.children) if (c.name === "jaw") c.rotation.x += 0.3;
    } else {
      for (const c of this.skel.ribs.children) {
        if (c.position.lengthSq() < 1e-8) continue;
        c.position.addScaledVector(this.v3.copy(c.position).normalize(), 0.012);
        c.position.x += (Math.random() - 0.5) * 0.01;
        c.position.z += (Math.random() - 0.5) * 0.01;
      }
    }
  }

  private updateChips(dt: number): void {
    for (const c of this.chips) {
      c.v.y -= 9.8 * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += c.spin.x * dt;
      c.m.rotation.y += c.spin.y * dt;
    }
  }

  private xray(on: boolean): void {
    const tgt = this.target;
    if (!tgt) return;
    if (on && !this.skel) {
      this.skel = new Skeleton();
      this.skel.root.name = "killcam:skeleton";
      this.world.scene.add(this.skel.root);
      tgt.body.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.visible && m.name.startsWith("body:lod")) {
          this.saved.set(m, m.material);
          m.material = shellMat;
        } else if (m.isMesh && m.visible && m.name !== "outline") {
          // Gear and the cloth go too: only the shell and the bones.
          this.saved.set(m, m.material);
          m.visible = false;
        }
      });
      tgt.rifle.visible = false;
      this.skel.pose(tgt);
      this.xrayOn = true;
    } else if (!on && this.skel) {
      for (const [m, mat] of this.saved) {
        if (m.material === shellMat) m.material = mat;
        else m.visible = true;
      }
      this.saved.clear();
      this.skel.root.removeFromParent();
      this.skel = null;
      this.xrayOn = false;
      for (const c of this.chips) c.m.removeFromParent();
      this.chips = [];
    }
  }

  /** Screenshot stages: holds the x-ray on (or off) as it would be `msAfterImpact` in. */
  stageXray(on: boolean): void {
    this.xray(on);
    if (on) this.crack(this.target!.body.joints[this.joint === "head" ? "head" : "chest"].clone());
  }

  finish(): void {
    this.xray(false);
    this.active = false;
    this.round = null;
    this.target = null;
    this.shot = null;
    this.caption = null;
    this.shotDistance = 0;
    this.bars = 0;
    this.whip = 0;
    this.streak.visible = false;
    for (const off of this.lightsOff) off();
    this.lightsOff = [];
    this.key.intensity = this.rim.intensity = 0;
    if (this.fov0 > 0) this.setFov(this.fov0);
    this.world.setDrama(0);
    this.world.setHaze?.(0, 0, 0, 0);
    this.world.setFocus?.(0.5, 0.5);
  }
}
