// The level-up moment: a red rule cuts across, Cath's portrait and the new number settle in, the points
// line follows, and it all lifts away. About 1.1 s; with reduced motion it simply appears and fades.
// Non-modal and non-interactive (pointer-events: none), announced politely to screen readers.

import { cathSvg } from "../../../../shared/cath/cath";
import { el, reducedMotion } from "./dom";

export interface LevelUpPoints {
  /** Attribute points gained (5 per level). */
  attributes: number;
  /** Skill points gained (1 per level, plus any story-job bonus). */
  skills: number;
}

/** Total on-screen time in milliseconds (the CSS choreography is keyed to this). */
export const LEVEL_UP_MS = 1150;

/**
 * Plays the level-up toast over `host` (the HUD layer). Resolves when it's gone. Calling it again while
 * one is showing replaces the old one, so multiple level-ups in one kill show the last level reached.
 */
export function levelUpToast(host: HTMLElement, level: number, points: LevelUpPoints): Promise<void> {
  host.querySelector(".lvl-toast")?.remove();
  const root = el("div", `lvl-toast${reducedMotion() ? " lvl-still" : ""}`, host);
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");

  el("span", "lvl-rule", root).setAttribute("aria-hidden", "true");
  const portrait = el("div", "lvl-cath", root);
  portrait.setAttribute("aria-hidden", "true");
  // cathSvg is our own generator's markup (no user data), so innerHTML is safe here.
  portrait.innerHTML = cathSvg({ framing: "face", expression: "determined", outfit: "gown" });

  const words = el("div", "lvl-words", root);
  el("p", "lvl-eyebrow", words, "Level");
  el("p", "lvl-num", words, String(level));
  const parts: string[] = [];
  if (points.attributes > 0) parts.push(`+${points.attributes} attribute point${points.attributes === 1 ? "" : "s"}`);
  if (points.skills > 0) parts.push(`+${points.skills} skill point${points.skills === 1 ? "" : "s"}`);
  el("p", "lvl-points", words, parts.join("  ·  "));
  root.setAttribute("aria-label", `Level ${level}. ${parts.join(", ")}.`);

  return new Promise((resolve) => {
    setTimeout(() => {
      root.remove();
      resolve();
    }, LEVEL_UP_MS);
  });
}
