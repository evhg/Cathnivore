// The level-up moment, in four beats: (1) a red rule slams across with a flash and a small shake, (2) ten
// glass shards burst off it, (3) Cath's portrait and the new number settle in, (4) the points line tallies
// and it all lifts away. About 1.8 s; with reduced motion it keeps the band and the number only (no shards,
// flash or shake) and fades. At most 12 animated nodes.
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
export const LEVEL_UP_MS = 1800;

/** Shards in the burst (beat 2). */
const SHARDS = 10;

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
  if (!reducedMotion()) {
    el("span", "lvl-flash", root).setAttribute("aria-hidden", "true");
    for (let i = 0; i < SHARDS; i++) {
      const shard = el("span", "lvl-shard", root);
      shard.setAttribute("aria-hidden", "true");
      // A deterministic fan, so the burst looks the same every time: even angles, alternating reach.
      const a = (i / SHARDS) * Math.PI * 2 + 0.3;
      const r = i % 2 ? 150 : 210;
      shard.style.setProperty("--sx", `${Math.round(Math.cos(a) * r)}px`);
      shard.style.setProperty("--sy", `${Math.round(Math.sin(a) * r * 0.45)}px`);
      shard.style.setProperty("--sr", `${(i * 47) % 180 - 90}deg`);
    }
  }
  const portrait = el("div", "lvl-cath", root);
  portrait.setAttribute("aria-hidden", "true");
  // cathSvg is our own generator's markup (no user data), so innerHTML is safe here.
  portrait.innerHTML = cathSvg({ framing: "face", expression: "determined", outfit: "trench" });

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
