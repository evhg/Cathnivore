// Plan item 57: the people on the street. One instanced kit (crowd.ts's standing figure: coat, skin, the dark parts,
// hair or a hat, an umbrella; plus a bicycle and a courier's box) drawn from sim/streetlife.ts's agents. They walk
// their paths, stand at their stalls and doorways, crouch at a shot, run for the exits and come back a minute after
// the fight. On high and ultra their coats and umbrellas show in the wet road's mirror; the phone tier skips that.
// About ten draw calls for the whole street, whatever the count.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HAIRS, SKINS, UMBRELLAS, standingParts, umbrellaParts } from "./crowd";
import { LAYER_NO_REFLECT } from "./reflection";
import { RIM_DRIPS, addStreetWet, type WetPerson } from "./streetwet";
import { hearShot, initialState, stepStreet, streetLife, visible, type AgentState, type StreetPlan, type StreetTier } from "../sim/streetlife";

/** Wet wool in colours that read under neon: camel, olive, oxblood, slate, mustard, teal, charcoal. */
const STREET_COATS = ["#7a6248", "#5a5e3c", "#5e2a2a", "#45505e", "#8a6a2c", "#2f5552", "#3a3a40", "#6a4a5a", "#8c7a62", "#2c3a4e"];

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function limb(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 6, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

/** A bicycle along +x: two wheels, the frame's diamond, bars and saddle. */
function bikeParts(): THREE.BufferGeometry[] {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const out: THREE.BufferGeometry[] = [];
  for (const x of [-0.52, 0.52]) {
    const w = new THREE.TorusGeometry(0.33, 0.022, 4, 16);
    w.translate(x, 0.34, 0);
    out.push(w);
  }
  const rear = v(-0.52, 0.34, 0);
  const front = v(0.52, 0.34, 0);
  const crank = v(-0.02, 0.32, 0);
  const seat = v(-0.18, 0.86, 0);
  const head = v(0.38, 0.88, 0);
  out.push(limb(rear, crank, 0.016), limb(crank, seat, 0.02), limb(seat, head, 0.018), limb(crank, head, 0.022), limb(rear, seat, 0.014), limb(head, front, 0.018));
  out.push(limb(v(0.36, 1.02, -0.26), v(0.36, 1.02, 0.26), 0.014), limb(head, v(0.36, 1.02, 0), 0.016));
  const saddle = new THREE.BoxGeometry(0.22, 0.04, 0.12);
  saddle.translate(-0.2, 0.9, 0);
  out.push(saddle);
  return out;
}

export interface StreetLifeHandle {
  readonly plan: StreetPlan;
  readonly states: AgentState[];
  /** A gunshot at (x, z); suppressed rounds are heard only close by. */
  shot(x: number, z: number, suppressed?: boolean): void;
  update(dt: number, time: number): void;
  /** Plan item 364: a point no walker is drawn within `r` of (the title and pick's still camera: a passer-by
   * crossing a metre from the lens filled the phone's frame for seconds); null lets them all show. */
  keepClear(at: { x: number; z: number; r: number } | null): void;
  /** Where everyone is, for tests (`window.cathode` reads it through world.street). */
  snapshot(): Array<{ x: number; y: number; z: number; mood: string; role: string }>;
}

export function addStreetLife(
  scene: THREE.Scene,
  district: string | undefined,
  tier: StreetTier,
  ground: (x: number, z: number) => number,
  wrap: (m: THREE.MeshStandardMaterial) => THREE.Material,
): StreetLifeHandle | null {
  const plan = streetLife(district, tier);
  if (!plan.agents.length) return null;
  const states = plan.agents.map(initialState);
  const reflect = tier !== "phone";
  // The phone draws a low-poly cut in four calls: coats, one vertex-coloured mesh for faces, hands, hair and shoes,
  // umbrellas, and bikes; the desktop tiers draw each part with its own per-person colours.
  const lo = tier === "phone";
  const parts = standingParts(lo);
  const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
  const hair = [new THREE.SphereGeometry(0.112, 10, 8).scale(1.02, 0.9, 0.97).translate(0, 1.72, 0)];
  const hat = [
    new THREE.CylinderGeometry(0.1, 0.115, 0.14, 10).translate(0.01, 1.81, 0),
    new THREE.CylinderGeometry(0.22, 0.22, 0.025, 12).translate(0.01, 1.752, 0),
  ];
  const box = [new THREE.BoxGeometry(0.42, 0.4, 0.42).translate(-0.62, 1.15, 0), new THREE.BoxGeometry(0.3, 0.03, 0.3).translate(-0.62, 0.94, 0)];

  const std = (rough: number, metal = 0) => wrap(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: metal }));
  const c = new THREE.Color();
  type Part = { mesh: THREE.InstancedMesh; who: number[]; onBike: boolean };
  const partsList: Part[] = [];
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, who: number[], palette: string[] | null, salt: number, mirrored: boolean, onBike = false) => {
    if (!who.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, who.length);
    if (!(mirrored && reflect)) mesh.layers.set(LAYER_NO_REFLECT);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.name = "streetlife";
    if (palette) who.forEach((a, i) => mesh.setColorAt(i, c.set(palette[Math.floor(hash(plan.agents[a]!.seed * 13 + salt) * palette.length)]!)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    partsList.push({ mesh, who, onBike });
  };
  const all = plan.agents.map((a) => a.id);
  const hatted = (i: number) => !plan.agents[i]!.umbrella && hash(plan.agents[i]!.seed * 5.1) < 0.45;
  mk(merge(parts.coat), std(0.5), all, STREET_COATS, 1, true);
  if (lo) {
    const tint = (gs: THREE.BufferGeometry[], col: string) =>
      gs.map((g) => {
        const n = (g.index ? g.toNonIndexed() : g).clone();
        const k = new THREE.Color(col);
        n.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: n.getAttribute("position").count }, () => [k.r, k.g, k.b]).flat(), 3));
        return n;
      });
    const detail = wrap(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0, vertexColors: true }));
    mk(merge([...tint(parts.skin, SKINS[0]!), ...tint(parts.dark, "#14130f"), ...tint([new THREE.SphereGeometry(0.112, 6, 4).scale(1.02, 0.9, 0.97).translate(0, 1.72, 0)], HAIRS[1]!)]), detail, all, null, 2, false);
  } else {
    mk(merge(parts.skin), std(0.6), all, SKINS, 2, false);
    mk(merge(parts.dark), std(0.7), all, ["#0e0f12", "#1a1816", "#22201e"], 3, false);
    mk(merge(hair), std(0.7), all.filter((i) => !hatted(i)), HAIRS, 4, false);
    mk(merge(hat), std(0.6), all.filter(hatted), ["#121214", "#2a2420", "#1a1c22", "#3a2a22"], 5, false);
  }
  const umbMat = std(0.25);
  umbMat.side = THREE.DoubleSide;
  mk(merge(umbrellaParts()), umbMat, all.filter((i) => plan.agents[i]!.umbrella), [...UMBRELLAS, "#5a1a22", "#1a3a4a", "#2a2a2a"], 6, true);
  const riders = all.filter((i) => plan.agents[i]!.role === "cyclist" || plan.agents[i]!.role === "courier");
  mk(merge(bikeParts()), std(0.4, 0.6), riders, ["#1a1c20", "#3a3e44", "#6a1a1a"], 7, true, true);
  // The courier's insulated box: Hollowell orange, the same as the takeaway bags in the stalls (not on the phone).
  if (!lo) mk(merge(box), std(0.55), riders.filter((i) => plan.agents[i]!.role === "courier"), ["#d8641a"], 8, true, true);

  const q = new THREE.Quaternion();
  const qr = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  /** Per agent this frame: the body's matrix, and the bike's (riders). */
  const body = plan.agents.map(() => new THREE.Matrix4());
  const bike = plan.agents.map(() => new THREE.Matrix4());
  let quiet = 1e9;
  // Rain on the people: umbrella drips and footstep splashes, high and ultra only (plan item 57).
  const wet = lo ? null : addStreetWet(scene, plan.agents.length * (RIM_DRIPS + 1));
  const wetPeople: WetPerson[] = plan.agents.map((a) => ({ x: 0, z: 0, y: 0, yaw: 0, body: null, umbrella: a.umbrella, gait: null, seed: a.seed }));

  let clear: { x: number; z: number; r: number } | null = null;
  const pose = (t: number) => {
    plan.agents.forEach((a, i) => {
      const st = states[i]!;
      const w = wetPeople[i]!;
      if (!visible(st) || (clear && Math.hypot(st.x - clear.x, st.z - clear.z) < clear.r)) {
        body[i]!.copy(zero);
        bike[i]!.copy(zero);
        w.body = null;
        return;
      }
      const rider = a.role === "cyclist" || a.role === "courier";
      const moving = st.mood === "flee" || st.mood === "return" || (st.mood === "calm" && a.path.length > 1);
      const running = st.mood === "flee";
      const ph = t * (running ? 9 : 5.2) + a.seed * 40;
      const k = 0.93 + hash(a.seed * 7) * 0.12;
      let lift = 0;
      let lean = 0;
      let squash = 1;
      let yaw = st.yaw;
      if (rider) {
        lift = 0.36;
        lean = -0.28 - (running ? 0.12 : 0);
      } else if (st.mood === "duck") {
        // Down behind whatever's nearest: knees bent, head low.
        squash = a.role === "vendor" ? 0.52 : 0.64;
        lean = -0.2;
      } else if (moving) {
        lift = Math.abs(Math.sin(ph)) * (running ? 0.07 : 0.028);
        lean = running ? -0.26 : -0.04;
        yaw += Math.sin(ph) * (running ? 0.05 : 0.03);
      } else {
        // A slow weight shift, never in step with the neighbours; vendors busy at the counter.
        yaw += Math.sin(t * 0.4 + a.seed * 9) * (a.role === "vendor" ? 0.25 : 0.06);
        lean = a.role === "vendor" ? -0.12 - Math.max(0, Math.sin(t * 0.7 + a.seed * 20)) * 0.12 : 0;
      }
      const y = ground(st.x, st.z);
      e.set(0, yaw, lean, "YXZ");
      q.setFromEuler(e);
      sc.set(k, k * squash * (0.95 + hash(a.seed * 3) * 0.1), k);
      body[i]!.compose(p.set(st.x, y + lift, st.z), q, sc);
      w.x = st.x;
      w.z = st.z;
      w.y = y;
      w.yaw = st.yaw;
      w.body = body[i]!;
      w.gait = moving && !rider ? ph : null;
      if (rider) {
        qr.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, st.yaw);
        bike[i]!.compose(p.set(st.x, y, st.z), qr, sc.set(1, 1, 1));
      }
    });
    // The bike and the courier's box ride with the bicycle, not the body.
    for (const { mesh, who, onBike } of partsList) {
      who.forEach((a, j) => mesh.setMatrixAt(j, (onBike ? bike : body)[a]!));
      mesh.instanceMatrix.needsUpdate = true;
    }
    wet?.update(wetPeople, t);
  };
  pose(0);

  return {
    plan,
    states,
    shot(x, z, suppressed = false) {
      quiet = 0;
      hearShot(plan, states, x, z, suppressed);
    },
    update(dt, time) {
      if (dt <= 0) return;
      quiet += dt;
      stepStreet(plan, states, Math.min(dt, 0.1), quiet);
      pose(time);
    },
    keepClear(at) {
      clear = at;
    },
    snapshot() {
      return states.map((s, i) => ({ x: s.x, y: ground(s.x, s.z), z: s.z, mood: s.mood, role: plan.agents[i]!.role }));
    },
  };
}
