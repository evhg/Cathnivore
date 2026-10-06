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
  /** Rebound keys by action id (see controls.ts). */
  binds: Binds;
}

const KEY = "cathode:prefs:v1";
const DEFAULTS: Prefs = { adult: false, intensity: "full", quality: "auto", volume: 1, bigSubs: false, calmCamera: false, colourSafe: false, holdToggle: false, lookScale: 1, invertY: false, crossScale: 1, binds: {} };

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
      binds: cleanBinds(p.binds),
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
