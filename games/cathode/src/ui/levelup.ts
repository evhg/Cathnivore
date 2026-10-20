// The level-up moment (C13T): type over the street in the upper third. A red hairline draws out, "Level" and the
// new number settle, and the points line follows; it all lifts away after about 1.8 s. With reduced motion it
// simply shows and fades. Non-modal and non-interactive (pointer-events: none), announced politely to screen readers.

import { el, reducedMotion } from "./dom";

export interface LevelUpPoints {
  /** Attribute points gained (5 per level). */
  attributes: number;
  /** Skill points gained (1 per level, plus any story-job bonus). */
  skills: number;
}

/** Total on-screen time in milliseconds (the CSS choreography is keyed to this). */
export const LEVEL_UP_MS = 1800;

/**
 * Plays the level-up toast over `host` (the HUD layer). Resolves when it's gone. Calling it again while
 * one is showing replaces the old one, so multiple level-ups in one kill show the last level reached.
 */
export function levelUpToast(host: HTMLElement, level: number, points: LevelUpPoints, held = false): Promise<void> {
  host.querySelector(".lvl-toast")?.remove();
  const root = el("div", `lvl-toast${reducedMotion() ? " lvl-still" : ""}${held ? " is-held" : ""}`, host);
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");

  const words = el("div", "lvl-words", root);
  el("p", "lvl-eyebrow", words, "Level");
  el("p", "lvl-num", words, String(level));
  const parts: string[] = [];
  if (points.attributes > 0) parts.push(`+${points.attributes} attribute point${points.attributes === 1 ? "" : "s"}`);
  if (points.skills > 0) parts.push(`+${points.skills} skill point${points.skills === 1 ? "" : "s"}`);
  el("p", "lvl-points", words, parts.join("  ·  "));
  el("span", "lvl-rule", root).setAttribute("aria-hidden", "true");
  root.setAttribute("aria-label", `Level ${level}. ${parts.join(", ")}.`);

  // `held` (screenshot stages only) keeps it on screen at its settled beat.
  if (held) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(() => {
      root.remove();
      resolve();
    }, LEVEL_UP_MS);
  });
}
