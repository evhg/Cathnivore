// Plan item 481: each skill tree shown in action on the class pick. A tree's signature active (a real one from the
// rules, sim/classes SKILLS), the look the pick's stage plays for it (built from the world's own effects, aimed at
// item 464's bottle on its crate), and her line under the sheet.
import type { TreeId } from "../sim/types";

export type PreviewLook =
  | "slowShot" // bullet-time: the world slows, a tracer breaks the bottle
  | "camo" // optic camo: her figure shimmers out
  | "mark" // a mark and a weak-spot ring on the target
  | "cleave" // a blade's arc of sparks before her
  | "dragon" // a shotgun's incendiary bloom
  | "warCry" // the lens shakes, her key flares
  | "fan" // six tracers in a breath
  | "hose" // a long burst of flashes
  | "spin" // the cylinder spun, brass in the air
  | "hack" // a cyan spark crawling over the target
  | "overload" // the target arcs and sparks out
  | "moth" // a drone puff rising from her palm
  | "frag" // a grenade's blast at the crate
  | "sentry" // a turret set down, a chatter of brass
  | "molotov"; // a bottle of fire at the crate

export interface SkillPreview {
  /** The rules' active this shows (an id in SKILLS). */
  active: string;
  look: PreviewLook;
  /** Her line under the sheet while it plays. */
  line: string;
  /** How long the stage plays it, ms. */
  ms: number;
}

export const SKILL_PREVIEWS: Record<TreeId, SkillPreview> = {
  longshot: { active: "ghost.slowTime", look: "slowShot", line: "Breathe out. The world waits for me.", ms: 2200 },
  shroud: { active: "ghost.opticCamo", look: "camo", line: "Now you see me. Now you're talking to a wall.", ms: 2200 },
  coldRead: { active: "ghost.dossier", look: "mark", line: "Everyone has a soft spot. I keep a list.", ms: 1800 },
  meat: { active: "butcher.cleave", look: "cleave", line: "Close enough to smell the fear. Closer.", ms: 1600 },
  scattergun: { active: "butcher.dragonsBreath", look: "dragon", line: "One shell. Whole room. Bring marshmallows.", ms: 1800 },
  iron: { active: "butcher.warCry", look: "warCry", line: "I don't knock. I announce.", ms: 1600 },
  sixShooter: { active: "gunslinger.fanTheHammer", look: "fan", line: "Six for six. Count them if you can.", ms: 1800 },
  spray: { active: "gunslinger.bulletHose", look: "hose", line: "Aiming is for people with time.", ms: 1800 },
  showman: { active: "gunslinger.spinReload", look: "spin", line: "Reloading is a performance, darling.", ms: 1600 },
  ghostInTheWire: { active: "wirewitch.backdoor", look: "hack", line: "Your door. My key. Your problem.", ms: 1800 },
  shortCircuit: { active: "wirewitch.overload", look: "overload", line: "Everything with a chip has a temper.", ms: 1800 },
  daemon: { active: "wirewitch.moth", look: "moth", line: "Little friend. Big appetite.", ms: 2000 },
  demolition: { active: "fixer.fragOut", look: "frag", line: "Fire in the hole. Mind the windows.", ms: 1800 },
  workshop: { active: "fixer.sentryKit", look: "sentry", line: "I brought a friend. It doesn't blink.", ms: 2000 },
  chem: { active: "fixer.molotov", look: "molotov", line: "Grandmother's recipe. Mostly.", ms: 1800 },
};
