// A humanoid built from rigid armoured segments hung between joints. One representation serves three
// jobs: procedural animation writes joint positions, a Verlet ragdoll simulates them after death, and a
// severed limb is just a segment that leaves the body and tumbles on its own. Each segment is a bone placed
// between its two joints every frame, so animation, ragdoll and gore share one code path.
//
// C10 "Enforcer v2" (S3.1): the body draws as skinned meshes over those bones, every piece rigidly bound to its
// segment (or to the helmet or a finger set), from geometry shared by every body of the archetype
// (models/enforcer.ts) on two materials shared by every body in the game (models/materials.ts). What differs per
// body (the hit flash, the rims, the visor, the LOD dither) rides the body's own skeleton as data bones. Three LODs
// swap on distance with a 0.3 s dither; the street's mirror sees a LOD2 stand-in; the tabard is cloth.

import * as THREE from "three";
import { tuning } from "./feel/tuning";
import { DEATH, DroppedProp, limitJoints, type DeathRun } from "./death";
import { BASE_JOINTS, JOINTS, REST, SEGMENTS, FX0, HELM_Y, KNUCKLE_Y, ACCESSORY_BONES, deriveJoints, type Joint, type SegmentDef } from "./rig";
import { LAYER_NO_REFLECT, LAYER_MIRROR_ONLY } from "../render/reflection";
import { archGeometry, type Arch, type Lod } from "./models/enforcer";
import { enemyMaterials, fxBone, setFx, FX_BONES, GORE_MAT } from "./models/materials";
import { CAP, capGeometry, chromeMaterial, chromeSleeve, jawGeometry, prewarmCaps, sharedCapMaterial } from "./models/gorecap";
import { Cloth, TABARD, COAT_TAILS } from "./cloth";

export { JOINTS, REST, SEGMENTS, type Joint, type Zone, type SegmentDef } from "./rig";

const flashTuning = tuning.hitFlash;
const LOOK = tuning.enemyLook;
/** The helmet's radius where it lies on the street. */
const HELM_R = 0.14;

/** The death glow's strength for this session: the phone's fog and lighter grade need it brighter (set by session.ts). */
export const deathGlowScale = { value: 1, rimPow: 0, rimGain: 1 };
/** C19: the kill pulse on a body that was cut (deathGlow(mul, true)): its share, fade and a tighter edge. */
export const SEVER_GLOW = { mul: 0.45, fadeMs: 150, pow: 5 };
/**
 * Phone (S0 budget, C9 review: four death stages at 261 to 300 calls against 260): a body that has gone down leaves
 * the street's mirror and stops casting shadows. On the floor its reflection lies under it and its shadow is a
 * smear the half-resolution mirror and the phone's shadow map lose anyway, so it costs one pass, not three.
 */
export const deadCost = { cheap: false };
/**
 * C10: what every body needs to know about the view: where the eye is (LOD distances), the profile (phone
 * geometry, LOD distances, cloth substeps), and a forced LOD for the review stages (`?lod=`, -1 = by distance).
 */
export const bodyView = { eye: new THREE.Vector3(0, 1.6, 0), phone: false, forceLod: -1 as -1 | Lod, calm: false, clock: () => (typeof performance === "undefined" ? 0 : performance.now()) };

/** S4.1: the flash's level at `ageMs` after a hit: white for a frame, then red at 0.6 fading to 0 over 150 ms. */
export function flashLevel(ageMs: number): number {
  const F = flashTuning;
  if (ageMs < F.whiteMs) return F.white;
  const k = 1 - (ageMs - F.whiteMs) / F.fadeMs;
  return k > 0 ? F.redGain * k * k : 0;
}

/**
 * Rest lengths between joints that the ragdoll keeps (bones plus bracing so the torso stays a box). The ragdoll
 * simulates the sixteen authored joints; the five riding ones (rig.ts) are placed from them after every step, rigid.
 */
export const LINKS: Array<[Joint, Joint, number?]> = [
  ["pelvis", "chest"],
  ["chest", "neck"],
  ["neck", "head"],
  ["shoulderL", "elbowL"],
  ["elbowL", "handL"],
  ["shoulderR", "elbowR"],
  ["elbowR", "handR"],
  ["hipL", "kneeL"],
  ["kneeL", "footL"],
  ["hipR", "kneeR"],
  ["kneeR", "footR"],
  // The torso frame: shoulders and hips braced to the spine and each other.
  ["shoulderL", "shoulderR"],
  ["shoulderL", "neck"],
  ["shoulderR", "neck"],
  ["shoulderL", "chest"],
  ["shoulderR", "chest"],
  ["hipL", "hipR"],
  ["hipL", "pelvis"],
  ["hipR", "pelvis"],
  ["hipL", "chest"],
  ["hipR", "chest"],
  ["shoulderL", "pelvis"],
  ["shoulderR", "pelvis"],
  ["head", "chest"],
];

/** What a body wears: the archetype's geometry and the visor's colour (the faction rim is the visor's, desaturated). */
export interface BodyLook {
  arch: Arch;
  visor: number;
  /** The faction's emissive (S3.1's faction languages): the rim's hue. Hollowell's amber unless said otherwise. */
  faction?: number;
  /** C19: segments that are chrome (Candor's augments): a chrome sleeve over them, coolant and sparks for blood. */
  cyber?: readonly string[];
}

/** Hollowell's amber (S3.1): every Enforcer role's rim, whatever colour its visor shows. */
export const HOLLOWELL_AMBER = 0xffa040;

/** The standard Hollowell Enforcer kit: charcoal plates, black undersuit, an amber visor slit. */
export function enforcerLook(visorColor = HOLLOWELL_AMBER, arch: Arch = "enforcer", faction = HOLLOWELL_AMBER): BodyLook {
  return { arch, visor: visorColor, faction };
}

const IDENT = new THREE.Matrix4();
/** C19 (S4.5): the cut's flesh radius per segment (m, the suit's tube under any plate): the gore cap's size. */
const CUT_R: Record<string, number> = { head: 0.062, upperArmL: 0.066, upperArmR: 0.066, forearmL: 0.058, forearmR: 0.058, handL: 0.045, handR: 0.045, thighL: 0.088, thighR: 0.088, shinL: 0.072, shinR: 0.072 };
/** C19: builds every gore cap a body can show (cached), so the frame that cuts a man doesn't build one (session start). */
export function prewarmGore(phone: boolean): void {
  prewarmCaps(Object.values(CUT_R), CUT_R.head!, phone);
}

/** C19: the severed head's jaw hinge in the head bone's frame (m), how far it drops open (rad) and its swing. */
const JAW = { hingeY: 0.1, hingeZ: 0.03, open: 0.42, tauS: 0.35, ringHz: 3.2 };
/** A cap before any cut (never seen: caps are hidden until a sever gives them their real geometry). */
const capGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 6);
/** Each segment's outer surface round its bone (m): where wounds sit on the plates, the suit and the helmet. */
const SURFACE_R: Record<string, number> = { abdomen: 0.122, chest: 0.142, upperChest: 0.142, head: 0.165, upperArmL: 0.074, upperArmR: 0.074, forearmL: 0.066, forearmR: 0.066, handL: 0.04, handR: 0.04, thighL: 0.104, thighR: 0.104, shinL: 0.088, shinR: 0.088 };

/** Segment slots in the flash: 0 is "not a segment" (the rifle, the shield, the cloth), then SEGMENTS in order. */
const FLASH_SLOTS = SEGMENTS.length + 1;

/** Gives a geometry the per-vertex segment slot the hit flash reads (S4.1). */
export function tagSegment(geo: THREE.BufferGeometry, seg: number): void {
  const n = geo.getAttribute("position").count;
  geo.setAttribute("aSeg", new THREE.BufferAttribute(new Float32Array(n).fill(seg), 1));
}

/** Tags every mesh under `o` that isn't a body segment (slot 0: never flashes). */
export function tagUnflashed(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && !m.geometry.getAttribute("aSeg")) tagSegment(m.geometry, 0);
  });
}

interface Seg {
  def: SegmentDef;
  /** The segment's bone: placed between its joints each frame (wounds and gore caps ride it). */
  group: THREE.Bone;
  len: number;
  /** Severed: the segment flies on its own (two free points). */
  loose: { a: THREE.Vector3; b: THREE.Vector3; pa: THREE.Vector3; pb: THREE.Vector3; t: number; parent?: Seg } | null;
}

const up = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpX = new THREE.Vector3();
const tmpZ = new THREE.Vector3();

export interface RagdollWorld {
  colliders: THREE.Box3[];
  ground(x: number, z: number): number;
}

/**
 * The faction rim's colour for a faction emissive: the same hue, kept saturated and mid-dark (linear). S3.1's 40%
 * saturation turned pale tan and, through the gain and the AgX shoulder, near white; `sat` and `lum` keep it amber.
 */
function rimTint(faction: number, out: THREE.Color): THREE.Color {
  out.set(faction);
  const hsl = { h: 0, s: 0, l: 0 };
  out.getHSL(hsl);
  out.setHSL(hsl.h, Math.min(1, hsl.s * LOOK.rim.sat), LOOK.rim.lum);
  return out;
}

export class Body {
  readonly root = new THREE.Group();
  /** World-space joint positions this frame. */
  readonly joints = {} as Record<Joint, THREE.Vector3>;
  private prev = {} as Record<Joint, THREE.Vector3>;
  readonly segs = new Map<string, Seg>();
  /** Joints a severed segment took with it no longer exist on the body. */
  readonly lost = new Set<string>();
  ragdoll = false;
  /** C9 (S4.4): the powered fall this death plays, while its active phase runs (and after, for its clock). */
  dying: DeathRun | null = null;
  /** C9: still for 30 frames (or settled by force): the ragdoll stops simulating. */
  asleep = false;
  /** Seconds since the body fell asleep (pools start 600 ms after). */
  asleepFor = 0;
  private stillFrames = 0;
  /** Last frame's animated joints: the ragdoll inherits the motion it died in. */
  private last = {} as Record<Joint, THREE.Vector3>;
  private lastValid = false;
  /** A joint hit the floor (or a box top) faster than DEATH.thudSpeed: the body-fall thud (m/s). */
  onImpact: ((joint: Joint, speed: number, at: THREE.Vector3) => void) | null = null;
  private impactAt = new Float32Array(JOINTS.length).fill(-1);
  private rest = new Map<string, number>();
  /** Which way the body faces (for segment roll), updated by animation. */
  readonly facing = new THREE.Vector3(0, 0, 1);
  /** C15: where the carbine is held (world): the pistol grip and the foregrip (animate.ts; the hands while both hold it). */
  readonly grip = new THREE.Vector3();
  readonly foregrip = new THREE.Vector3();
  restTime = 0;
  /** The hit flash per segment slot (radiance), and ms since each slot was hit. */
  readonly flashUniform = { value: Array.from({ length: FLASH_SLOTS }, () => new THREE.Vector3()) };
  private flashAge = new Float32Array(FLASH_SLOTS).fill(1e9);
  private flashing = false;
  /** Ms since this body died (the death glow, C2), or 1e9 while it lives. */
  private deathAge = 1e9;
  private deathMul = 1;
  /**
   * C19: a body that lost a part to the killing blow: the kill pulse is a thin edge, gone in 150 ms with no hold,
   * so the gore caps and the stump's blood read on his own dark suit, not on a pink-lit mannequin (C19 review).
   */
  private deathFast = false;
  /** C10: the skeleton every LOD's meshes share: segment bones, the helmet, the finger sets, then the fx bones. */
  readonly skeleton: THREE.Skeleton;
  private readonly fx: THREE.Bone[] = [];
  private readonly helmetBone: THREE.Bone;
  private readonly fingers: Record<"L" | "R", THREE.Bone>;
  /** The LODs' meshes (opaque, glow) and the mirror's LOD2 stand-in. */
  private readonly lods: Array<[THREE.SkinnedMesh, THREE.SkinnedMesh]> = [];
  private readonly mirror: THREE.SkinnedMesh[] = [];
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
  /** The LOD showing (the crossfade's target), the one fading out, and when the fade began (ms). */
  lod: Lod = 0;
  private lodFrom: Lod = 0;
  private lodAt = -1e9;
  /** C10: the tabard (or the sniper's coat tails), LOD0 only. */
  readonly cloth: Cloth | null;
  /** The visor's colour (linear) and level (the death fades it, the raise to aim flares it). */
  readonly visor = new THREE.Color();
  visorLevel = 1;
  /** S3.5: the raise to aim flares the visor from x1.0 to x1.6 (set by the brain from its aim). */
  visorAim = 1;
  private readonly facRim = new THREE.Color();
  /** S3.1 rim state: 0 at rest .. 1 in combat, set by the brain; and takedown eligibility (the 3 Hz pulse). */
  alert = 0;
  eligible = false;
  private hitAt = -1e9;
  /** S4.1: each hand's opening (degrees past the grip) and ms since an arm hit opened it. */
  private handAge: Record<"L" | "R", number> = { L: 1e9, R: 1e9 };

  constructor(
    public look: BodyLook,
    readonly scale = 1,
  ) {
    for (const j of JOINTS) {
      this.joints[j] = REST[j].clone().multiplyScalar(scale);
      this.prev[j] = this.joints[j].clone();
      this.last[j] = this.joints[j].clone();
    }
    this.visor.set(look.visor);
    rimTint(look.faction ?? look.visor, this.facRim);
    const bones: THREE.Bone[] = [];
    for (const def of SEGMENTS) {
      const len = REST[def.from].distanceTo(REST[def.to]) * scale;
      const bone = new THREE.Bone();
      bone.name = def.name;
      bone.userData.segment = def.name;
      bone.scale.setScalar(scale);
      // Where a wound sits (render/gore.ts): the armour's surface round the bone, in the bone's own units.
      bone.userData.surfaceR = SURFACE_R[def.name] ?? def.radius * 0.8;
      bone.userData.len = len / scale;
      // The stump's gore caps, hidden until the segment is severed (one shared material).
      const capA = new THREE.Mesh(capGeo, GORE_MAT);
      const capB = new THREE.Mesh(capGeo, GORE_MAT);
      capB.position.y = len / scale;
      capA.name = "capFrom";
      capB.name = "capTo";
      capA.scale.setScalar(CAP.viewScale);
      capB.scale.setScalar(CAP.viewScale);
      capA.visible = capB.visible = false;
      bone.add(capA, capB);
      this.root.add(bone);
      bones.push(bone);
      this.segs.set(def.name, { def, group: bone, len, loose: null });
    }
    this.helmetBone = new THREE.Bone();
    this.helmetBone.name = "helmet";
    this.helmetBone.position.set(0, HELM_Y, 0);
    this.segs.get("head")!.group.add(this.helmetBone);
    const fingers = (s: "L" | "R") => {
      const b = new THREE.Bone();
      b.name = `fingers${s}`;
      b.position.set(0, KNUCKLE_Y, 0);
      this.segs.get(`hand${s}`)!.group.add(b);
      return b;
    };
    this.fingers = { L: fingers("L"), R: fingers("R") };
    bones.push(this.helmetBone, this.fingers.L, this.fingers.R);
    if (bones.length !== FX0) throw new Error("body skeleton out of step with rig.FX0");
    void ACCESSORY_BONES;
    for (let i = 0; i < FX_BONES; i++) {
      const b = fxBone();
      this.fx.push(b);
      bones.push(b);
    }
    this.skeleton = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
    const phone = bodyView.phone;
    const mats = enemyMaterials(phone, FX0);
    for (const lod of [0, 1, 2] as Lod[]) {
      const g = archGeometry(look.arch, lod, phone);
      const pair = [new THREE.SkinnedMesh(g.opaque, mats.opaque), new THREE.SkinnedMesh(g.glow, mats.glow)] as [THREE.SkinnedMesh, THREE.SkinnedMesh];
      pair.forEach((m, i) => {
        m.name = `body:lod${lod}:${i ? "glow" : "opaque"}`;
        m.bind(this.skeleton, IDENT);
        m.boundingSphere = this.sphere;
        m.layers.set(LAYER_NO_REFLECT);
        m.castShadow = i === 0;
        m.visible = lod === 0;
        this.root.add(m);
      });
      this.lods.push(pair);
    }
    // The mirror's stand-in: LOD2, seen only by the street's reflection.
    const g2 = archGeometry(look.arch, 2, phone);
    for (const [geo, mat] of [
      [g2.opaque, mats.opaque],
      [g2.glow, mats.glow],
    ] as const) {
      const m = new THREE.SkinnedMesh(geo, mat);
      m.name = "body:mirror";
      m.bind(this.skeleton, IDENT);
      m.boundingSphere = this.sphere;
      m.layers.set(LAYER_MIRROR_ONLY);
      m.castShadow = false;
      this.root.add(m);
      this.mirror.push(m);
    }
    const S = LOOK.cloth;
    this.cloth = look.arch === "orderly" || look.arch === "nurse" ? null : look.arch === "sniper" ? new Cloth(COAT_TAILS, mats.opaque, phone ? S.phoneSubsteps : S.desktopSubsteps) : new Cloth(TABARD, mats.opaque, phone ? S.phoneSubsteps : S.desktopSubsteps);
    // S0 phone budget (C10 perf gate: 263 calls for 6 firing enemies): the tabard's thin shadow is a draw call per
    // enemy on every shadow refresh, and in a 1024 map on a phone it is a smudge under his legs.
    if (this.cloth) {
      if (phone) this.cloth.mesh.castShadow = false;
      this.cloth.mesh.layers.set(LAYER_NO_REFLECT);
      this.root.add(this.cloth.mesh);
    }
    for (const [a, b] of LINKS) this.rest.set(`${a}|${b}`, REST[a].distanceTo(REST[b]) * scale);
    this.writeFx();
  }

  /** C17 (S6.5): the meshes Second Wind outlines (every LOD's opaque body and the cloth; hidden LODs stay hidden). */
  outlineMeshes(out: THREE.Mesh[] = [], bodyOnly = false): THREE.Mesh[] {
    // The glow half too (visor, stripes): left out, its shapes are holes in the mask that speckle his body red.
    for (const [o, g] of this.lods) out.push(o, g);
    // Phone: no tabard (one draw fewer per man; it hangs inside his silhouette's 2u rim anyway).
    if (this.cloth && !bodyOnly) out.push(this.cloth.mesh);
    return out;
  }

  /** A round lands on a segment: it flashes white for a frame, then red, fading out (S4.1); the rim flares. */
  flash(segment: string): void {
    const i = SEGMENTS.findIndex((d) => d.name === segment);
    if (i < 0) return;
    this.flashAge[i + 1] = 0;
    this.flashing = true;
    this.hitAt = bodyView.clock();
    this.updateFlash(0);
  }

  /** S4.1: an arm hit opens that hand 30 degrees off the grip for a moment. */
  openHand(side: "L" | "R"): void {
    this.handAge[side] = 0;
  }

  /** How far each hand is open past the grip right now (degrees). */
  handOpenDeg(side: "L" | "R"): number {
    const H = LOOK.hand;
    const a = this.handAge[side];
    if (a < H.inMs) return H.openDeg * (a / H.inMs);
    if (a < H.inMs + H.holdMs) return H.openDeg;
    const k = 1 - (a - H.inMs - H.holdMs) / H.outMs;
    return k > 0 ? H.openDeg * k * k * (3 - 2 * k) : 0;
  }

  /** Advances the hands' clocks (ms, real time). */
  updateHands(dtMs: number): void {
    this.handAge.L += dtMs;
    this.handAge.R += dtMs;
  }

  /** Sets the visor's colour (and level): the vault boss's phases, a stage. */
  setVisor(color: number, level = this.visorLevel): void {
    this.visor.set(color);
    this.visorLevel = level;
  }

  /**
   * The kill confirmed on the body (C2): every segment's rim glows a deep red as he goes down, holds, then
   * dies away, so a dark body falling on a dark street still catches the eye where the kill landed.
   */
  deathGlow(mul = 1, fast = false): void {
    this.deathFast = fast;
    this.deathAge = 0;
    this.rimMul = Math.min(1, mul);
    this.deathMul = deathGlowScale.value * mul;
    this.flashing = true;
    this.updateFlash(0);
  }

  /**
   * Screenshot stages (S0): back on his feet, unlit, as if never hit, every severed piece put back.
   */
  revive(): void {
    this.putHelmetBack();
    // C19: severed pieces go back (stages reuse one guard); the caps hide again.
    for (const sg of this.segs.values()) {
      sg.loose = null;
      for (const n of ["capFrom", "capTo"]) sg.group.getObjectByName(n)!.visible = false;
      const cut = sg.group.getObjectByName("capCut");
      if (cut) sg.group.remove(cut);
    }
    this.lost.clear();
    this.lastCut = null;
    const jaw = this.segs.get("head")?.group.getObjectByName("jaw");
    if (jaw) jaw.visible = false;
    this.jawT = -1;
    this.resetPlates();
    this.setCheap(false);
    this.ragdoll = false;
    this.dying = null;
    this.asleep = false;
    this.asleepFor = 0;
    this.stillFrames = 0;
    this.lastValid = false;
    this.impactAt.fill(-1);
    this.restTime = 0;
    this.deathAge = 1e9;
    this.flashAge.fill(1e9);
    for (const v of this.flashUniform.value) v.set(0, 0, 0);
    this.flashing = false;
    this.rimUniform.value.set(0, 0, 0, 3);
    this.visorLevel = 1;
    this.hitAt = -1e9;
    this.handAge.L = this.handAge.R = 1e9;
    this.clothReset = true;
  }
  private clothReset = true;

  private cheap = false;
  /** deadCost: out of the mirror and the shadow pass (on), or back as it was (off). */
  private setCheap(on: boolean): void {
    if (on === this.cheap) return;
    this.cheap = on;
    for (const m of this.mirror) m.visible = !on;
    for (const [o] of this.lods) o.castShadow = !on;
    if (this.cloth) this.cloth.mesh.castShadow = !on && !bodyView.phone;
  }

  /**
   * C8 (S6.6): a steady rim on every segment, on top of any hit flash: the killer standing over her body is cut out
   * of the street in a cold edge light. (0, 0, 0) turns it off.
   */
  setRim(r: number, g: number, b: number, width = 3): void {
    this.rimUniform.value.set(r, g, b, width);
  }
  /** The death rims' share (deathGlow's `mul`, capped at 1). */
  private rimMul = 1;
  /** The edge-only rim light (setRim): applied at the silhouette alone, never on the face of the suit; `w` is the falloff power (lower is wider). */
  readonly rimUniform = { value: new THREE.Vector4(0, 0, 0, 3) };

  /**
   * C15 (S4.3): each plate slot's state (sim/armour.ts PLATE_SLOT, 0 intact, 1 cracked, 2 broken) and ms since it
   * changed, read by the shader from fx5; the face's skin tone (0..3) and the crack seed (0..1) ride slot 8.
   */
  private readonly plateState = new Float32Array(8);
  private readonly plateAge = new Float32Array(8).fill(1e7);
  skinTone = 0;
  crackSeed = 0.37;
  /** C15: where the round that last cracked a chest plate landed, in the chest bone's frame (zero: none). */
  readonly crackAt = new THREE.Vector3();
  /** Records a crack's impact (world point) for the shader. */
  markCrack(world: THREE.Vector3): void {
    const chest = this.root.getObjectByName("chest");
    if (!chest) return;
    chest.updateWorldMatrix(true, false);
    this.crackAt.copy(chest.worldToLocal(world.clone()));
  }
  /** Sets a plate slot's state (1..7). */
  setPlate(slot: number, state: 0 | 1 | 2): void {
    if (slot < 1 || slot > 7 || this.plateState[slot] === state) return;
    this.plateState[slot] = state;
    this.plateAge[slot] = 0;
  }
  plateOf(slot: number): number {
    return this.plateState[slot] ?? 0;
  }
  /** Every plate back on (screenshot stages). */
  resetPlates(): void {
    this.plateState.fill(0);
    this.plateAge.fill(1e7);
  }

  /** Advances the flash on real time (it shows through a hit-stop). */
  updateFlash(dtMs: number): void {
    this.updateHands(dtMs);
    for (let i = 1; i < 8; i++) this.plateAge[i] = Math.min(1e7, this.plateAge[i]! + dtMs);
    if (!this.flashing) return;
    const F = flashTuning;
    const D = F.death;
    let any = false;
    let dk = 0;
    if (this.deathAge < 1e8) {
      const a = (this.deathAge += dtMs);
      const L = D.level * this.deathMul;
      const holdMs = this.deathFast ? 0 : D.holdMs;
      const fadeMs = this.deathFast ? SEVER_GLOW.fadeMs : D.fadeMs;
      dk = a < holdMs ? L : a < holdMs + fadeMs ? L * (1 - (a - holdMs) / fadeMs) ** 2 : 0;
      if (dk > 0) any = true;
      else this.deathAge = 1e9;
      // C9: the kill glow is a pulse on the silhouette only (the edge rim), gone within 0.65 s, so the fall reads as
      // a body and not a red mannequin. It hands over to a faint cold street rim that stays on the dead (the noir
      // edge light), so a dark body on a dark street still has a shape.
      const r = L > 0 ? dk / L : 0;
      const g = D.rimGain * deathGlowScale.rimGain * dk;
      const c = (1 - r) * (1 - r);
      const pow = this.deathFast ? SEVER_GLOW.pow : deathGlowScale.rimPow || D.rimPow;
      // A takedown's body (deathGlow(mul < 1)) is at arm's length: both rims scale down with it, or the edge term
      // spreads over his whole front and he reads as a pink (then grey) mannequin.
      const m = this.rimMul;
      this.rimUniform.value.set((D.red[0] * g + D.cold[0] * c) * m, (D.red[1] * g + D.cold[1] * c) * m, (D.red[2] * g + D.cold[2] * c) * m, pow * r + D.coldPow * c);
    }
    for (let i = 1; i < FLASH_SLOTS; i++) {
      const age = (this.flashAge[i] = this.flashAge[i]! + dtMs);
      const v = this.flashUniform.value[i]!;
      const k = flashLevel(age);
      if (age < F.whiteMs) v.setScalar(k);
      else v.set(F.red[0] * k, F.red[1] * k, F.red[2] * k);
      if (k > 0) any = true;
    }
    this.flashing = any;
  }

  /** The flash on a segment right now (for tests and the stage hooks): 0 when dark. */
  flashOf(segment: string): number {
    const i = SEGMENTS.findIndex((d) => d.name === segment);
    return i < 0 ? 0 : this.flashUniform.value[i + 1]!.x;
  }

  /** The faction rim's strength right now (S3.1): rest, combat, a hit's flare, the takedown pulse. */
  rimLevel(now = bodyView.clock()): number {
    const R = LOOK.rim;
    if (this.ragdoll) return 0;
    let k = R.rest + (R.combat - R.rest) * Math.max(0, Math.min(1, this.alert));
    if (now - this.hitAt < R.hitMs) k = R.hit;
    // Takedown-eligible (staggered or down, S4.2): the rim throbs at 3 Hz from a dim floor up past a hit's flare, so
    // the window reads at a glance, not as a flicker of the resting rim.
    // Reduced motion (and photosensitivity, C15 review): no 3 Hz swing over the whole silhouette, a steady raised rim
    // with a slow, shallow 1 Hz breath instead.
    if (this.eligible)
      k = bodyView.calm
        ? R.hit * R.eligiblePeak * (R.calmFloor + (1 - R.calmFloor) * (0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 2 * R.calmHz)))
        : R.hit * R.eligiblePeak * (R.eligibleFloor + (1 - R.eligibleFloor) * (0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 2 * R.pulseHz)));
    return k;
  }

  /** Writes this body's state into its fx bones (models/materials.ts's layout). */
  private writeFx(): void {
    const now = bodyView.clock();
    const F = this.fx;
    const fl = this.flashUniform.value;
    for (let s = 0; s < 16; s++) {
      const v = fl[s];
      setFx(F[s >> 2]!, s & 3, v ? v.x : 0, v ? v.y : 0, v ? v.z : 0, 0);
    }
    const R = LOOK.rim;
    const rim = this.rimUniform.value;
    const P = F[4]!;
    setFx(P, 0, rim.x, rim.y, rim.z, rim.w);
    const lvl = this.visorLevel * (this.ragdoll ? 1 : this.visorAim);
    setFx(P, 1, this.visor.r, this.visor.g, this.visor.b, lvl);
    // The faction rim is for reading him at 10 m in the rain. Up close (inside 2 m, fading in by 6 m) it would wash his
    // whole figure peach: it falls to 30% there, so the suit's own paint and the street's light carry him. The
    // takedown pulse keeps most of its strength (it is a call to act, not a silhouette aid).
    const dEye = this.joints.chest.distanceTo(bodyView.eye);
    const nearK = THREE.MathUtils.smoothstep(dEye, 2, 6);
    const rimNear = this.eligible ? Math.max(0.75, 0.3 + 0.7 * nearK) : 0.3 + 0.7 * nearK;
    const k = this.rimLevel(now) * rimNear * (bodyView.phone ? R.phoneGain : R.gain);
    setFx(P, 2, this.facRim.r * k, this.facRim.g * k, this.facRim.b * k, bodyView.phone ? R.phonePow : R.pow);
    const fade = Math.min(1, (now - this.lodAt) / LOOK.lod.fadeMs);
    const blink = this.visorLevel > 0.05 && Math.floor(((now / 1000) * LOOK.blinkHz * 2) % 2) === 0 ? 1 : 0.06;
    setFx(P, 3, this.lodFrom, this.lod, fade, blink * Math.min(1, this.visorLevel * 1.5));
    // The coolant window's pulse rides the spare flash slot (15): a slow 1.2 Hz swell, out when he dies.
    const pulse = this.plateState[7] === 2 ? 0 : this.ragdoll ? 0.15 * this.visorLevel : 0.55 + 0.45 * Math.sin((now / 1000) * Math.PI * 2 * LOOK.coolantHz);
    // C15: the last crack's impact in the chest bone's frame (z = 0: none yet), so the fracture radiates from it.
    setFx(F[3]!, 3, pulse, this.crackAt.x, this.crackAt.y, this.crackAt.z);
    // C15: the plates (two floats a slot), slot 8 the skin tone and the crack seed.
    const ps = this.plateState;
    const pa = this.plateAge;
    for (let c = 0; c < 4; c++) {
      const a = c * 2 + 1;
      const b = a + 1;
      if (b === 8) setFx(F[5]!, c, ps[a]!, pa[a]! / 1000, this.skinTone, this.crackSeed);
      else setFx(F[5]!, c, ps[a]!, pa[a]! / 1000, ps[b]!, pa[b]! / 1000);
    }
    // Dithering away a LOD: both stay visible until the fade ends.
    if (fade >= 1 && this.lodFrom !== this.lod) {
      this.lods[this.lodFrom]!.forEach((m) => (m.visible = false));
      this.lodFrom = this.lod;
    }
  }

  /**
   * C11: the takedown's close-up. On, LOD0 draws the hero geometry (twice the segments round, refined profiles:
   * the helmet's rim and the pauldrons' domes stay curves at 0.3 m); off, the shared LOD0 again.
   */
  heroDetail(on: boolean): void {
    if (this.hero === on) return;
    this.hero = on;
    const g = archGeometry(this.look.arch, 0, bodyView.phone, on);
    this.lods[0]![0].geometry = g.opaque;
    this.lods[0]![1].geometry = g.glow;
  }
  private hero = false;

  /** Picks the LOD for the eye's distance (with hysteresis) and starts the crossfade when it changes. */
  private chooseLod(): void {
    const L = LOOK.lod;
    const [a, b] = bodyView.phone ? L.phone : L.desktop;
    let want: Lod;
    if (bodyView.forceLod >= 0) want = bodyView.forceLod as Lod;
    else {
      const d = this.joints.pelvis.distanceTo(bodyView.eye) / this.scale;
      const h = L.hyst;
      const cur = this.lod;
      want = d < a - (cur === 0 ? -h : h) ? 0 : d < b - (cur <= 1 ? -h : h) ? 1 : 2;
    }
    if (want === this.lod) return;
    const now = bodyView.clock();
    // A change in mid-fade snaps the fade-out (one pair dithering out at a time).
    if (this.lodFrom !== this.lod) this.lods[this.lodFrom]!.forEach((m) => (m.visible = false));
    this.lodFrom = this.lod;
    this.lod = want;
    this.lodAt = bodyView.forceLod >= 0 ? -1e9 : now;
    this.lods[want]!.forEach((m) => (m.visible = true));
    if (bodyView.forceLod >= 0) {
      this.lods[this.lodFrom]!.forEach((m) => (m.visible = false));
      this.lodFrom = want;
    }
  }

  /** C9 (S4.4): the helmet a headshot knocked off, tumbling on its own (null while he wears it). */
  helmetOff: DroppedProp | null = null;
  private helmG: THREE.Object3D | null = null;
  private readonly helmFacing = new THREE.Vector3(0, 0, 1);

  /**
   * The headshot drop's helmet pop (S4.4, 40% of headshots): the helmet leaves the head with `vel` (m/s) and a
   * tumble, rolls on its shell and clatters, and the black balaclava under it shows. False if it can't come off.
   */
  popHelmet(vel: THREE.Vector3, spin: number, onClatter?: (speed: number, at: THREE.Vector3) => void): boolean {
    const head = this.segs.get("head");
    const hg = this.helmetBone;
    if (!head || head.loose || this.helmetOff) return false;
    this.pose();
    head.group.updateMatrixWorld(true);
    const a = hg.getWorldPosition(new THREE.Vector3());
    const b = hg.localToWorld(new THREE.Vector3(0, 0.15, 0));
    this.helmFacing.set(0, 0, 1).transformDirection(hg.matrixWorld);
    this.root.add(hg);
    this.helmG = hg;
    const prop = new DroppedProp(a, b, vel, spin, onClatter);
    prop.lift = HELM_R;
    this.helmetOff = prop;
    this.pose();
    return true;
  }

  private putHelmetBack(): void {
    const head = this.segs.get("head");
    if (!this.helmG || !head) return;
    head.group.add(this.helmG);
    this.helmG.position.set(0, HELM_Y, 0);
    this.helmG.quaternion.identity();
    this.helmG.scale.setScalar(1);
    this.helmG = null;
    this.helmetOff = null;
  }

  /**
   * Places every attached segment between its joints, the fingers at their grip (opened by an arm hit), the LOD
   * for the eye, the cloth (stepped `dt` seconds), and the body's fx data.
   */
  pose(dt = 0): void {
    if (this.helmetOff && this.helmG) {
      place(this.helmG, this.helmetOff.a, this.helmetOff.b, this.helmFacing);
      this.helmG.scale.setScalar(this.scale);
    }
    tmpZ.copy(this.facing).normalize();
    // A ragdoll's segments roll with his torso, not with the way he faced standing: a body lying along that
    // direction otherwise leaves every bone's roll to chance, and the plates scatter into a heap of boxes.
    const J = this.joints;
    let upperF = tmpZ;
    let lowerF = tmpZ;
    if (this.ragdoll) {
      fUp.crossVectors(fA.subVectors(J.shoulderL, J.shoulderR), fB.subVectors(J.neck, J.chest));
      fLo.crossVectors(fA.subVectors(J.hipL, J.hipR), fB.subVectors(J.chest, J.pelvis));
      if (fUp.lengthSq() > 1e-8 && fLo.lengthSq() > 1e-8) {
        upperF = fUp.normalize();
        lowerF = fLo.normalize();
      }
    }
    for (const s of this.segs.values()) {
      if (s.loose) {
        place(s.group, s.loose.a, s.loose.b, looseZ);
        continue;
      }
      const z = s.def.zone === "legL" || s.def.zone === "legR" || s.def.name === "abdomen" ? lowerF : upperF;
      place(s.group, J[s.def.from], J[s.def.to], z);
    }
    // The fingers wrap the grip; a hit on the arm opens them (S4.1). On a ragdoll they slacken half open.
    const H = LOOK.hand;
    for (const sd of ["L", "R"] as const) {
      const out = sd === "L" ? -1 : 1;
      const open = this.ragdoll ? H.openDeg * 0.8 : this.handOpenDeg(sd);
      this.fingers[sd].rotation.set(0, 0, ((H.gripDeg - open) * Math.PI * out) / 180);
    }
    this.sphere.center.copy(J.pelvis);
    this.sphere.radius = 1.4 * this.scale;
    this.chooseLod();
    if (this.cloth) {
      if (this.clothReset) {
        this.cloth.reset(J, this.scale);
        this.clothReset = false;
      }
      const show = (this.lod === 0 || this.lodFrom === 0) && !this.lost.has("abdomen");
      this.cloth.mesh.visible = show;
      if (dt > 0 && show) this.cloth.step(dt, J, this.scale, this.asleep);
    }
    this.writeFx();
  }

  /**
   * Hands animation over to physics, with an impulse at a point (S4.4's lethal frame): every joint keeps the
   * velocity it was animated with (prev was last frame's pose), plus the round's push, strongest at the hit and
   * falling off as max(0.25, 1 - 0.8 d). With `run`, the powered fall's dying pose takes the body for its active
   * phase before the plain ragdoll does.
   */
  goLimp(impulse: THREE.Vector3, at?: THREE.Vector3, run?: DeathRun): void {
    if (this.ragdoll) return;
    this.ragdoll = true;
    if (deadCost.cheap) this.setCheap(true);
    this.asleep = false;
    this.asleepFor = 0;
    this.stillFrames = 0;
    this.restTime = 0;
    this.dying = run ?? null;
    // No death pushes harder than this: a launcher at point blank is a hard shove, not a cannon shot.
    if (impulse.lengthSq() > DEATH.maxImpulse ** 2) impulse = impulse.clone().setLength(DEATH.maxImpulse);
    if (run) run.impulse.copy(impulse);
    for (const j of JOINTS) {
      const near = at ? Math.max(0.25, 1 - this.joints[j].distanceTo(at) * 0.8) : 0.6;
      if (run) run.near[j] = near;
      // The animated motion of the last frame, clamped (a stage teleport is not a velocity).
      tmpA.subVectors(this.joints[j], this.prev[j]);
      if (tmpA.lengthSq() > 0.04) tmpA.set(0, 0, 0);
      this.prev[j].copy(this.joints[j]).sub(tmpA).addScaledVector(impulse, -near / 60);
    }
  }

  /** An extra kick on one joint after goLimp (the headshot's backward snap, S4.4), m/s. */
  kick(j: Joint, vel: THREE.Vector3): void {
    this.prev[j].addScaledVector(vel, -1 / 60);
  }

  /**
   * Keeps prev one frame behind the animated joints, so the ragdoll inherits the body's velocity when it starts.
   * (Called after each animated frame: prev becomes last frame's pose, last becomes this one.)
   */
  carry(): void {
    for (const j of JOINTS) {
      if (this.lastValid && this.last[j].distanceToSquared(this.joints[j]) < 0.04) this.prev[j].copy(this.last[j]);
      else this.prev[j].copy(this.joints[j]);
      this.last[j].copy(this.joints[j]);
    }
    this.lastValid = true;
  }

  /** C19: the last cut's two caps (the stump's and the flying piece's), for the spurt and the trail (render/gore.ts). */
  lastCut: { stump: THREE.Object3D | null; piece: THREE.Object3D; seg: string; cyber: boolean } | null = null;

  /** C19: seconds since the head (and its jaw) came off; the jaw's swing runs on it. */
  private jawT = -1;

  /** C19: true when this segment is chrome (its look's cyber list). */
  isCyber(seg: string): boolean {
    return !!this.look.cyber?.includes(seg);
  }

  /** C19: makes these segments chrome (a stage, or a kit with augments): sleeves over them now, cyber caps when cut. */
  setCyber(segs: readonly string[]): void {
    this.look = { ...this.look, cyber: segs };
    for (const s of this.segs.values()) {
      const old = s.group.getObjectByName("chrome");
      if (old) s.group.remove(old);
      if (!segs.includes(s.def.name)) continue;
      const sleeve = new THREE.Mesh(chromeSleeve(s.len / this.scale, CUT_R[s.def.name] ?? s.def.radius * 0.8, s.def.name.startsWith("hand"), bodyView.phone), chromeMaterial(bodyView.phone));
      sleeve.name = "chrome";
      sleeve.castShadow = true;
      s.group.add(sleeve);
    }
  }

  /**
   * Severs a segment (and what it carries): it flies off with `vel`, spinning at `spin` rad/s (S4.5: 10 to 20), and
   * the cut shows the lathe gore caps (flesh or chrome) on the stump and on the piece.
   */
  sever(name: string, vel: THREE.Vector3, spin = 14): string[] {
    const s = this.segs.get(name);
    if (!s || s.loose) return [];
    const out: string[] = [];
    const cyber = this.isCyber(name);
    const r = CUT_R[name] ?? s.def.radius * 0.8;
    const neck = name === "head";
    const geo = capGeometry(r, cyber, bodyView.phone, neck);
    const mat = sharedCapMaterial(bodyView.phone);
    // The spin: the piece's two ends get opposite tangential velocities about an axis across the bone.
    const axis = tmpA.subVectors(this.joints[s.def.to], this.joints[s.def.from]);
    // The ends move apart across both the bone and the flight (the piece spins about its line of flight like a thrown
    // baton, its cap sweeping round where she can see it), so the same cut tumbles the same way every time (C19 review: the stages framed differently run to run).
    const across = vel.clone().cross(axis);
    if (across.lengthSq() < 1e-8) across.set(1, 0, 0).cross(axis);
    if (across.lengthSq() < 1e-8) across.set(0, 0, 1);
    across.normalize().multiplyScalar((spin * s.len) / 2);
    const go = (seg: Seg, v: THREE.Vector3, parent: Seg | undefined) => {
      const a = this.joints[seg.def.from].clone();
      const b = this.joints[seg.def.to].clone();
      const root = !parent;
      const va = root ? v.clone().sub(across) : v;
      const vb = v.clone().add(root ? across : across.clone().multiplyScalar(2));
      seg.loose = { a, b, pa: a.clone().addScaledVector(va, -1 / 60), pb: b.clone().addScaledVector(vb, -1 / 60), t: 0, ...(parent ? { parent } : {}) };
      this.lost.add(seg.def.name);
      out.push(seg.def.name);
      for (const c of seg.def.carries ?? []) {
        const cs = this.segs.get(c);
        // A carried segment hangs off the flying part (pinned at the joint they share, free to swing).
        if (cs && !cs.loose) go(cs, v, seg);
      }
    };
    go(s, vel, undefined);
    // The piece's cap faces out of its "from" end; the stump's out of the parent's end at the cut.
    const pc = s.group.getObjectByName("capFrom") as THREE.Mesh;
    pc.geometry = geo;
    pc.material = mat;
    pc.rotation.set(Math.PI, 0, 0);
    pc.visible = true;
    let stump: THREE.Object3D | null = null;
    for (const p of this.segs.values()) {
      if (p.loose) continue;
      const parentEnd = p.def.to === s.def.from ? "capTo" : p.def.from === s.def.from && p.def.zone !== s.def.zone ? "capFrom" : null;
      if (!parentEnd) continue;
      const cap = p.group.getObjectByName(parentEnd) as THREE.Mesh;
      cap.geometry = geo;
      cap.material = mat;
      cap.rotation.set(parentEnd === "capFrom" ? Math.PI : 0, 0, 0);
      cap.visible = true;
      stump ??= cap;
    }
    if (!stump && s.def.zone !== "head") {
      // A cut at the shoulder or the hip: no segment ends there, so the trunk carries a cap at the joint, its face
      // along the limb that went.
      const host = this.segs.get(s.def.zone === "legL" || s.def.zone === "legR" ? "abdomen" : "upperChest");
      if (host) {
        const cap = new THREE.Mesh(geo, mat);
        cap.name = "capCut";
        cap.scale.setScalar(CAP.viewScale);
        host.group.updateMatrixWorld(true);
        const at = host.group.worldToLocal(this.joints[s.def.from].clone());
        const toward = host.group.worldToLocal(this.joints[s.def.to].clone()).sub(at).normalize();
        cap.position.copy(at);
        cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toward);
        host.group.add(cap);
        stump = cap;
      }
    }
    if (s.def.zone === "head") {
      const chest = this.segs.get("upperChest");
      if (chest) {
        const cap = chest.group.getObjectByName("capTo") as THREE.Mesh;
        cap.geometry = geo;
        cap.material = mat;
        cap.rotation.set(0, 0, 0);
        cap.visible = true;
        stump = cap;
      }
    }
    if (neck && !cyber) {
      // The jaw goes with the head, on its hinge under the ears: it drops open and swings as the head tumbles.
      const head = this.segs.get("head")!.group;
      let jaw = head.getObjectByName("jaw") as THREE.Mesh | undefined;
      if (!jaw) {
        jaw = new THREE.Mesh(jawGeometry(bodyView.phone), mat);
        jaw.name = "jaw";
        jaw.position.set(0, JAW.hingeY, JAW.hingeZ);
        head.add(jaw);
      }
      jaw.rotation.set(0, 0, 0);
      jaw.visible = true;
      this.jawT = 0;
    }
    this.lastCut = { stump, piece: pc, seg: name, cyber };
    return out;
  }

  /**
   * Verlet step for the ragdoll and every severed piece. A dying body (C9) is pulled toward its variant's pose
   * for the active phase, then falls as a plain ragdoll with joint limits and floor friction, and sleeps when
   * it has been still for 30 frames.
   */
  physics(dt: number, w: RagdollWorld): void {
    const g = -19 * dt * dt;
    if (this.helmetOff && dt > 0) this.helmetOff.step(dt, (x, z) => w.ground(x, z), w.colliders);
    if (this.ragdoll && this.asleep) this.asleepFor += dt;
    if (this.ragdoll && !this.asleep && dt > 0) {
      this.restTime += dt;
      const run = this.dying;
      if (run) run.t += dt * 1000;
      const k = run ? run.k : 0;
      const tgt = k > 0 && run ? run.targets(dt) : null;
      const blend = Math.min(1, k * dt * 60);
      const limpS = this.restTime - (run && !run.fellBack ? run.dur / 1000 : 0);
      // Settling (S4.4: bodies settle within 2 s): extra damping once limp for a while.
      const settle = limpS > DEATH.settleS ? Math.min(0.6, (limpS - DEATH.settleS) * 0.9) : 0;
      const keep = 0.985 * (1 - settle);
      // C9 review: once the fall is over he is drawn into a lying pose that reads (not a heap of plates).
      const rb = run && !run.active ? run.restK(limpS) : 0;
      if (rb > 0 && run && !run.rest && run.restKind === null) run.anchorRest(this.joints, (x, z) => w.ground(x, z));
      const rest = rb > 0 && run ? run.rest : null;
      const vmax = DEATH.maxSpeed * dt;
      let fast = false;
      for (const j of BASE_JOINTS) {
        const p = this.joints[j];
        const q = this.prev[j];
        let vx = (p.x - q.x) * keep;
        let vy = (p.y - q.y) * keep;
        let vz = (p.z - q.z) * keep;
        const sp = Math.hypot(vx, vy, vz);
        if (sp > vmax) {
          fast = true;
          const c = vmax / sp;
          vx *= c;
          vy *= c;
          vz *= c;
        }
        if (rest) {
          // Coming to rest: drawn into the lying pose, the fall's speed bled off as it takes him.
          const T = rest[j];
          vx -= vx * rb;
          vy -= vy * rb;
          vz -= vz * rb;
          p.x += (T.x - p.x) * rb;
          p.y += (T.y - p.y) * rb;
          p.z += (T.z - p.z) * rb;
        }
        if (tgt) {
          // The powered fall: position and velocity both blend toward the pose's (no spring to ring).
          const T = tgt.at[j];
          const Tp = tgt.prev[j];
          vx += (T.x - Tp.x - vx) * blend;
          vy += (T.y - Tp.y - vy) * blend;
          vz += (T.z - Tp.z - vz) * blend;
          p.x += (T.x - p.x) * blend;
          p.y += (T.y - p.y) * blend;
          p.z += (T.z - p.z) * blend;
        }
        q.copy(p);
        p.x += vx;
        p.y += vy + g * (1 - blend) * Math.max(0, 1 - rb * 4);
        p.z += vz;
      }
      // (Not a takedown's script: it owns the body to its end. A hit-stop shortens his step to a millisecond or two
      // while the Verlet velocity still holds a whole frame's travel, so a fast authored move such as Front C's gut
      // fold read as "too fast" and he dropped as a plain ragdoll at her feet, 350 ms early. The cap above still holds.)
      if (fast && run && !run.script) run.fellBack = true;
      const fr = DEATH.friction;
      for (let it = 0; it < 6; it++) {
        for (const [a, b] of LINKS) {
          const r = this.rest.get(`${a}|${b}`)!;
          solve(this.joints[a], this.joints[b], r, 0.5, 0.5);
        }
        if (it >= 3) limitJoints(this.joints, this.lost);
        for (let i = 0; i < BASE_JOINTS.length; i++) {
          const j = BASE_JOINTS[i]!;
          const v = collide(this.joints[j], this.prev[j], w, fr, it === 0 ? dt : 0);
          if (v > DEATH.thudSpeed && this.onImpact && this.restTime - this.impactAt[i]! > 0.25) {
            this.impactAt[i] = this.restTime;
            this.onImpact(j, v, this.joints[j]);
          }
        }
      }
      // The limits have the last word (the floor pass can bend a knee past them by a few degrees).
      limitJoints(this.joints, this.lost);
      // C10: the riding joints (spine2, clavicles, wrists) follow the simulated ones rigidly.
      deriveJoints(this.joints, this.scale);
      // NaN guard: a broken step puts the body back where it was, at rest.
      let bad = false;
      let moved = 0;
      for (const j of BASE_JOINTS) {
        const p = this.joints[j];
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) bad = true;
        else moved = Math.max(moved, p.distanceTo(this.prev[j]));
      }
      if (bad) {
        for (const j of JOINTS) {
          const q = this.prev[j];
          if (!Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(q.z)) q.copy(this.last[j]);
          this.joints[j].copy(q);
        }
        deriveJoints(this.joints, this.scale);
        if (run) run.fellBack = true;
      }
      // Sleep: still under 2 mm a frame for 30 frames, once the pose has let go.
      const poseDone = !run || !run.active;
      if (poseDone && moved < DEATH.sleepM * dt * 60 && (!run || run.restSettled(limpS))) this.stillFrames++;
      else this.stillFrames = 0;
      if (poseDone && (this.stillFrames >= DEATH.sleepFrames || limpS > DEATH.forceSleepS)) {
        // C10: before he freezes, the bones are relaxed back to their lengths (the pose pull and the joint limits
        // fight the links by a few millimetres; 2% of a 16 cm chest segment shows on the 21-joint rig).
        for (let it = 0; it < 24; it++) {
          for (const [a, b] of LINKS) solve(this.joints[a], this.joints[b], this.rest.get(`${a}|${b}`)!, 0.5, 0.5);
          for (const j of BASE_JOINTS) collide(this.joints[j], this.prev[j], w, fr, 0);
        }
        deriveJoints(this.joints, this.scale);
        this.asleep = true;
        this.asleepFor = 0;
        for (const j of JOINTS) this.prev[j].copy(this.joints[j]);
      }
    }
    if (this.jawT >= 0 && dt > 0) {
      // The jaw drops open on its hinge and rings about it as the head tumbles (a damped swing, settling half open).
      const t = (this.jawT += dt);
      const jaw = this.segs.get("head")!.group.getObjectByName("jaw");
      if (jaw) jaw.rotation.x = JAW.open * (1 - Math.exp(-t / JAW.tauS) * Math.cos(t * JAW.ringHz * Math.PI * 2));
    }
    // (Verlet carries its velocity in the last step: a frozen frame (dt 0, a screenshot stage's or a hit-stop) must not
    // step the pieces, or they fly on through the freeze; C19 review: the piece drifted into the reticle.)
    if (dt <= 0) return;
    for (const s of this.segs.values()) {
      const l = s.loose;
      if (!l) continue;
      l.t += dt;
      for (const [p, q] of [
        [l.a, l.pa],
        [l.b, l.pb],
      ] as const) {
        const vx = (p.x - q.x) * 0.99;
        const vy = (p.y - q.y) * 0.99;
        const vz = (p.z - q.z) * 0.99;
        q.copy(p);
        p.x += vx;
        p.y += vy + g;
        p.z += vz;
      }
      for (let it = 0; it < 3; it++) {
        // A carried piece hangs off its parent piece at the joint they share.
        const pl = l.parent?.loose;
        if (pl) l.a.copy(pl.b);
        solve(l.a, l.b, s.len, pl ? 0 : 0.5, pl ? 1 : 0.5);
        collide(l.a, l.pa, w);
        collide(l.b, l.pb, w);
      }
    }
  }

  /** Hit test a ray against the attached segments' capsules; returns the nearest hit. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): { seg: SegmentDef; dist: number; point: THREE.Vector3 } | null {
    let best: { seg: SegmentDef; dist: number; point: THREE.Vector3 } | null = null;
    for (const s of this.segs.values()) {
      if (s.loose) continue;
      const a = this.joints[s.def.from];
      const b = this.joints[s.def.to];
      const t = rayCapsule(origin, dir, a, b, s.def.radius * (s.def.zone === "head" ? 1.15 : 1.25));
      if (t !== null && t <= maxDist && (!best || t < best.dist))
        best = { seg: s.def, dist: t, point: origin.clone().addScaledVector(dir, t) };
    }
    // The chest's rounded top reaches past the neck: anything that lands above the neck is a headshot.
    const head = this.segs.get("head");
    if (best && (best.seg.name === "upperChest" || best.seg.name === "chest") && head && !head.loose) {
      const spine = new THREE.Vector3().subVectors(this.joints.neck, this.joints.chest).normalize();
      if (new THREE.Vector3().subVectors(best.point, this.joints.neck).dot(spine) > 0) best = { ...best, seg: head.def };
    }
    return best;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.skeleton.dispose();
    this.cloth?.mesh.geometry.dispose();
  }
}

const looseZ = new THREE.Vector3(0, 0, 1);
const fUp = new THREE.Vector3();
const fLo = new THREE.Vector3();
const fA = new THREE.Vector3();
const fB = new THREE.Vector3();

export function place(group: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, facing: THREE.Vector3): void {
  // An orthonormal frame: Y along the bone, Z as close to the facing direction as the bone allows.
  tmpA.subVectors(b, a).normalize();
  tmpX.crossVectors(tmpA, facing);
  if (tmpX.lengthSq() < 1e-6) tmpX.crossVectors(tmpA, Math.abs(tmpA.y) > 0.9 ? tmpB.set(1, 0, 0) : up);
  tmpX.normalize();
  tmpB.crossVectors(tmpX, tmpA).normalize();
  tmpM.makeBasis(tmpX, tmpA, tmpB);
  group.position.copy(a);
  group.quaternion.setFromRotationMatrix(tmpM);
}

function solve(a: THREE.Vector3, b: THREE.Vector3, rest: number, wa: number, wb: number): void {
  tmpA.subVectors(b, a);
  const d = tmpA.length();
  if (d < 1e-6) return;
  const diff = (d - rest) / d;
  a.addScaledVector(tmpA, diff * wa);
  b.addScaledVector(tmpA, -diff * wb);
}

/** Pushes a point out of the floor and the boxes; returns the speed it hit the floor at (m/s, when `dt` > 0). */
function collide(p: THREE.Vector3, q: THREE.Vector3, w: RagdollWorld, friction = 0.6, dt = 0): number {
  const floor = w.ground(p.x, p.z) + 0.05;
  let hit = 0;
  if (p.y < floor) {
    if (dt > 0) hit = Math.max(0, (q.y - p.y) / dt);
    p.y = floor;
    // Ground friction: kill most sliding.
    q.x = p.x - (p.x - q.x) * (1 - friction);
    q.z = p.z - (p.z - q.z) * (1 - friction);
    q.y = p.y + (p.y - q.y) * 0.2;
  }
  for (const c of w.colliders) {
    if (p.x <= c.min.x || p.x >= c.max.x || p.y <= c.min.y || p.y >= c.max.y || p.z <= c.min.z || p.z >= c.max.z) continue;
    // Push out along the shallowest axis.
    const dx1 = p.x - c.min.x,
      dx2 = c.max.x - p.x,
      dy1 = p.y - c.min.y,
      dy2 = c.max.y - p.y,
      dz1 = p.z - c.min.z,
      dz2 = c.max.z - p.z;
    const m = Math.min(dx1, dx2, dy1, dy2, dz1, dz2);
    if (m === dy2) {
      p.y = c.max.y + 0.01;
      q.x = p.x - (p.x - q.x) * (1 - friction);
      q.z = p.z - (p.z - q.z) * (1 - friction);
      continue;
    }
    if (m === dx1) p.x = c.min.x - 0.01;
    else if (m === dx2) p.x = c.max.x + 0.01;
    else if (m === dz1) p.z = c.min.z - 0.01;
    else if (m === dz2) p.z = c.max.z + 0.01;
    else p.y = c.min.y - 0.01;
    // A wall grips too (a slumped back stays on it instead of sliding off like ice).
    if (m !== dy1) q.y = p.y - (p.y - q.y) * (1 - friction * 0.7);
  }
  return hit;
}

/** Distance along a unit ray to a capsule a-b of radius r, or null. */
export function rayCapsule(o: THREE.Vector3, d: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r: number): number | null {
  // Closest approach between the ray and the segment, then a sphere test at that point on the segment.
  const ba = new THREE.Vector3().subVectors(b, a);
  const oa = new THREE.Vector3().subVectors(o, a);
  const baba = ba.dot(ba);
  const bard = ba.dot(d);
  const baoa = ba.dot(oa);
  const rdoa = d.dot(oa);
  const oaoa = oa.dot(oa);
  const A = baba - bard * bard;
  let B = baba * rdoa - baoa * bard;
  let C = baba * oaoa - baoa * baoa - r * r * baba;
  let h = B * B - A * C;
  if (h >= 0) {
    const t = (-B - Math.sqrt(h)) / A;
    const y = baoa + t * bard;
    if (y > 0 && y < baba && t > 0) return t;
    // The caps.
    const oc = y <= 0 ? oa : new THREE.Vector3().subVectors(o, b);
    B = d.dot(oc);
    C = oc.dot(oc) - r * r;
    h = B * B - C;
    if (h > 0) {
      const tc = -B - Math.sqrt(h);
      if (tc > 0) return tc;
    }
  }
  return null;
}
