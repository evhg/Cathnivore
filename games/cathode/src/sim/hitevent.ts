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
export function hitClass(h: Pick<HitEvent, "zone" | "lethal" | "layer" | "penetrated" | "crit"> & { plateBroke?: boolean }): HitClass {
  const head = h.zone === "head" || h.layer === "weakpoint";
  if (h.lethal) return head ? "headKill" : "kill";
  if (h.layer === "plate" || h.layer === "shield" || h.layer === "visor") return h.plateBroke ? "armourBreak" : "armour";
  if (h.penetrated) return "pen";
  if (head || h.crit) return "head";
  return "body";
}

/** The confirm sound for a hit class (S1.3). */
export function confirmSound(c: HitClass): "body" | "head" | "armour" | "plateBreak" | "kill" | "headKill" | "pen" {
  return c === "armourBreak" ? "plateBreak" : c;
}

/** How long a hit holds the world, in ms (S1.5). */
export function hitStopMs(h: Pick<HitEvent, "zone" | "lethal" | "crit" | "weaponCls"> & { plateBroke?: boolean; melee?: boolean }): number {
  const T = tuning.hitStop;
  const auto = AUTOMATIC.has(h.weaponCls);
  if (h.lethal) return h.zone === "head" ? T.headKill : auto ? T.killAuto : T.kill;
  if (h.plateBroke) return T.plateBreak;
  if (h.melee || h.weaponCls === "melee") return T.melee;
  if (h.crit || h.zone === "head") return auto ? T.critAuto : T.crit;
  return auto ? T.bodyAuto : T.body;
}

/** Whether a hit should show the marker at all: never for a round cover stopped (pillar 1). */
export function showsMarker(e: { kind: "hit" | "blocked" | "nearMiss" }): boolean {
  return e.kind === "hit";
}
