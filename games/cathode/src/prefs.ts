// Player preferences, kept per browser: the age gate answer, violence intensity and graphics quality.
// Game progress lives in the save (sim/save.ts), not here.

export type Intensity = "full" | "reduced";
export type QualityChoice = "auto" | "phone" | "high" | "ultra";

export interface Prefs {
  adult: boolean;
  intensity: Intensity;
  quality: QualityChoice;
}

const KEY = "cathode:prefs:v1";
const DEFAULTS: Prefs = { adult: false, intensity: "full", quality: "auto" };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      adult: p.adult === true,
      intensity: p.intensity === "reduced" ? "reduced" : "full",
      quality: p.quality === "phone" || p.quality === "high" || p.quality === "ultra" ? p.quality : "auto",
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
