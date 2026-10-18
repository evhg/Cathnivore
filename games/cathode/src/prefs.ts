// Player preferences, kept per browser: the age gate answer, violence intensity and graphics quality.
// Game progress lives in the save (sim/save.ts), not here.

import { cleanBinds, type Binds } from "./controls";

export type Intensity = "full" | "reduced";
export type QualityChoice = "auto" | "phone" | "high" | "ultra";

export interface Prefs {
  adult: boolean;
  intensity: Intensity;
  quality: QualityChoice;
  /** Master volume, 0..1. */
  volume: number;
  /** Larger subtitles on a solid backing. */
  bigSubs: boolean;
  /** Less camera shake and sway (also on when the system asks for reduced motion). */
  calmCamera: boolean;
  /** Colour-blind-safe palette: red and amber UI colours swap for vermillion, yellow and blue-leaning tones. */
  colourSafe: boolean;
  /** Sprint and aim toggle on a press instead of being held. */
  holdToggle: boolean;
  /** Look sensitivity multiplier, 0.4..2.5. */
  lookScale: number;
  /** Moving the mouse or stick up looks down. */
  invertY: boolean;
  /** Crosshair size multiplier, 0.7..2. */
  crossScale: number;
  /** HUD size multiplier, 0.8..1.3 (S8: --hud-scale scales every HUD size in --u). */
  hudScale: number;
  /** Rebound keys by action id (see controls.ts). */
  binds: Binds;
  /** Settings → Reduce motion; null follows the system setting. */
  reduceMotion: boolean | null;
  /** C7 (S9.8): how hard the screen sells a wound (see damageFxLevels). */
  damageFx: DamageFx;
  /** C7: the wounded heartbeat's sound (the vignette still beats). */
  heartbeat: boolean;
}

export type DamageFx = "full" | "reduced" | "minimal";

/**
 * What each Damage effects setting keeps (S9.8). `grade` scales the Vitals grade (the blood vignette, the hit's
 * flare and lobe, the colour drain, the regen and stim washes); `ca` keeps the wound's chromatic aberration and
 * radial smear; `lens` puts blood on the lens; `wobble` the bleeding roll and FOV breathe; `muffle` scales how far
 * the world dulls. The damage indicator (the arc, chevrons and grenade glyph) is never touched.
 *   Full     everything.
 *   Reduced  the grade at 70%, the CA and smear kept, no lens blood, no wobble, a lighter muffle.
 *   Minimal  the vignette halved, no CA or smear, no lens blood, no wobble, a lighter muffle.
 */
export function damageFxLevels(fx: DamageFx): { grade: number; ca: number; lens: boolean; wobble: boolean; muffle: number; indicator: true } {
  if (fx === "minimal") return { grade: 0.5, ca: 0, lens: false, wobble: false, muffle: 0.6, indicator: true };
  if (fx === "reduced") return { grade: 0.7, ca: 1, lens: false, wobble: false, muffle: 0.6, indicator: true };
  return { grade: 1, ca: 1, lens: true, wobble: true, muffle: 1, indicator: true };
}

const KEY = "cathode:prefs:v1";
const DEFAULTS: Prefs = { adult: false, intensity: "full", quality: "auto", volume: 1, bigSubs: false, calmCamera: false, colourSafe: false, holdToggle: false, lookScale: 1, invertY: false, crossScale: 1, hudScale: 1, binds: {}, reduceMotion: null, damageFx: "full", heartbeat: true };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      adult: p.adult === true,
      intensity: p.intensity === "reduced" ? "reduced" : "full",
      quality: p.quality === "phone" || p.quality === "high" || p.quality === "ultra" ? p.quality : "auto",
      volume: typeof p.volume === "number" && p.volume >= 0 && p.volume <= 1 ? p.volume : 1,
      bigSubs: p.bigSubs === true,
      calmCamera: p.calmCamera === true,
      colourSafe: p.colourSafe === true,
      holdToggle: p.holdToggle === true,
      lookScale: typeof p.lookScale === "number" && p.lookScale >= 0.4 && p.lookScale <= 2.5 ? p.lookScale : 1,
      invertY: p.invertY === true,
      crossScale: typeof p.crossScale === "number" && p.crossScale >= 0.7 && p.crossScale <= 2 ? p.crossScale : 1,
      hudScale: typeof p.hudScale === "number" && p.hudScale >= 0.8 && p.hudScale <= 1.3 ? p.hudScale : 1,
      binds: cleanBinds(p.binds),
      reduceMotion: typeof p.reduceMotion === "boolean" ? p.reduceMotion : null,
      damageFx: p.damageFx === "reduced" || p.damageFx === "minimal" ? p.damageFx : "full",
      heartbeat: p.heartbeat !== false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode or storage full: the game still runs, it just asks again next time.
  }
}

/** Auto quality: phones (coarse pointer, small screen) get the phone preset, everything else high. */
export function resolveQuality(choice: QualityChoice): "phone" | "high" | "ultra" {
  if (choice !== "auto") return choice;
  const coarse = matchMedia("(pointer: coarse)").matches;
  return coarse && Math.min(screen.width, screen.height) < 600 ? "phone" : "high";
}

/** Whether camera jolt and scope sway should be damped: the setting, or the system's reduced-motion request. */
export function calmCameraOn(p: Prefs = loadPrefs()): boolean {
  if (p.calmCamera) return true;
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Whether menus and the HUD should hold still: the Reduce motion setting, else the system's request. */
export function reduceMotionOn(p: Prefs = loadPrefs()): boolean {
  if (p.reduceMotion !== null) return p.reduceMotion;
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Puts `reduce-motion` on <html> from the setting (and keeps following the system while it's on Auto). */
export function applyMotionPref(p: Prefs = loadPrefs()): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("reduce-motion", reduceMotionOn(p));
}
