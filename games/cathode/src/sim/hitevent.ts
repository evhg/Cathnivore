// What one round did, as data (docs/design/cathode-combat.md S0, S1). Combat resolves a shot into a HitEvent
// and emits it; the HUD, audio, FX and camera only listen. The class of hit decides the marker and the
// confirm sound, never the damage dealt (pillar 2: Overwatch's marker-size lesson). Pure: no three.js.

import type { WeaponClass } from "./types";
import { tuning, type HitClass } from "../game/feel/tuning";

export type HitZone = "head" | "torso" | "armL" | "armR" | "legL" | "legR";
export type HitLayer = "flesh" | "plate" | "visor" | "cyber" | "shield" | "weakpoint";
export type Vec3Like = { x: number; y: number; z: number };

export interface HitEvent {
  t: number;
  targetUid: string;
  seg: string;
  zone: HitZone;
  point: Vec3Like;
  normal: Vec3Like;
  dir: Vec3Like;
  distance: number;
  weaponCls: WeaponClass;
  damage: number;
  crit: boolean;
  layer: HitLayer;
  plateId?: string;
  plateBroke?: boolean;
  visorStage?: 0 | 1 | 2;
  penetrated: boolean;
  lethal: boolean;
  severed?: string[];
  reaction: "flinch" | "stagger" | "knockdown" | "none";
  staggerDir?: "front" | "back" | "left" | "right";
  /** C15 (S4.3): this round shot the carbine out of his hands. */
  disarmed?: boolean;
}

/** A round that cover ate with an enemy in line behind it. */
export interface BlockedEvent {
  t: number;
  point: Vec3Like;
  normal: Vec3Like;
  mat: string;
  /** The enemy it was meant for. */
  targetUid: string;
}

/** A round that passed within half a metre of an enemy's head. */
export interface NearMissEvent {
  t: number;
  targetUid: string;
  /** Closest approach to the head, metres. */
  miss: number;
}

/** The weapon classes that fire automatically: they get no per-hit hit-stop (S1.5). */
export const AUTOMATIC: ReadonlySet<WeaponClass> = new Set<WeaponClass>(["smg", "rifle", "smart"]);

/** The marker class for a hit (S1.2). Plates and shields read as armour; a kill outranks everything. */
export function hitClass(h: Pick<HitEvent, "zone" | "lethal" | "layer" | "penetrated" | "crit"> & { plateBroke?: boolean; visorStage?: 0 | 1 | 2 }): HitClass {
  const head = h.zone === "head" || h.layer === "weakpoint";
  if (h.lethal) return head ? "headKill" : "kill";
  // A shattering visor is a break (S1.2's break marker), like a plate coming off.
  if (h.layer === "plate" || h.layer === "shield" || h.layer === "visor") return h.plateBroke || visorShatter(h) ? "armourBreak" : "armour";
  if (h.penetrated) return "pen";
  if (head || h.crit) return "head";
  return "body";
}

/** The round that shatters a visor (its second hit): the face shows. */
export function visorShatter(h: { layer: HitLayer; visorStage?: 0 | 1 | 2 }): boolean {
  return h.layer === "visor" && h.visorStage === 2;
}

/** A round that met something hard (a plate, the can, a shield, chrome, a visor still up): no meat sound (S4.5). */
export function hardHit(h: { layer: HitLayer; visorStage?: 0 | 1 | 2 }): boolean {
  return h.layer === "plate" || h.layer === "weakpoint" || h.layer === "shield" || h.layer === "cyber" || (h.layer === "visor" && h.visorStage !== 2);
}

/** The confirm sound for a hit class (S1.3); a visor shatter has its own (six glassy sines and a sizzle). */
export function confirmSound(c: HitClass, h?: { layer: HitLayer; visorStage?: 0 | 1 | 2 }): "body" | "head" | "armour" | "plateBreak" | "visor" | "kill" | "headKill" | "pen" {
  if (c === "armourBreak") return h && visorShatter(h) ? "visor" : "plateBreak";
  return c;
}

/** How long a hit holds the world, in ms (S1.5). */
export function hitStopMs(h: Pick<HitEvent, "zone" | "lethal" | "crit" | "weaponCls"> & { plateBroke?: boolean; melee?: boolean; layer?: HitLayer; visorStage?: 0 | 1 | 2 }): number {
  const T = tuning.hitStop;
  const auto = AUTOMATIC.has(h.weaponCls);
  if (h.lethal) return h.zone === "head" ? T.headKill : auto ? T.killAuto : T.kill;
  if (h.plateBroke || (h.layer && visorShatter({ layer: h.layer, ...(h.visorStage !== undefined ? { visorStage: h.visorStage } : {}) }))) return T.plateBreak;
  if (h.melee || h.weaponCls === "melee") return T.melee;
  if (h.crit || h.zone === "head") return auto ? T.critAuto : T.crit;
  return auto ? T.bodyAuto : T.body;
}

/** Whether a hit should show the marker at all: never for a round cover stopped (pillar 1). */
export function showsMarker(e: { kind: "hit" | "blocked" | "nearMiss" }): boolean {
  return e.kind === "hit";
}
