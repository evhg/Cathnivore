// Each class's voice and mark: the noir one-liner, the "plays like" line, and an emblem drawn in SVG from
// code (no assets). Emblems use `currentColor`, so a class's accent comes from CSS (`.cls-ghost` etc.),
// and every stroke carries `pathLength="1"` so CSS can draw it on with a dash animation.

import type { ClassId } from "../sim/types";
import type { Item } from "../sim/loot";
import { WEAPON_BASES } from "../sim/weapons";
import { svg } from "./dom";

export interface ClassCopy {
  /** The noir one-liner, in Cath's voice. */
  line: string;
  /** How the class plays, plainly. */
  playsLike: string;
  /** The order the class pick lists them in, and its number on the case file. */
  file: string;
}

export const CLASS_COPY: Record<ClassId, ClassCopy> = {
  ghost: {
    line: "Nobody hears the shot. Somebody reads about it in the morning.",
    playsLike: "Long-range sniping, bullet-time and silent takedowns. Patience pays in headshots.",
    file: "01",
  },
  butcher: {
    line: "Up close, every argument ends the same way.",
    playsLike: "Blades, the Pin and shotguns at arm's length. Kills heal you and rage carries you through.",
    file: "02",
  },
  gunslinger: {
    line: "Six chambers. Six names. One long night.",
    playsLike: "Quick pistols, revolvers and SMGs. Chain kills to build style; reload in the flourish.",
    file: "03",
  },
  wirewitch: {
    line: "The whole city's wired. She just picks up the phone.",
    playsLike: "Hijack cameras, turrets and drones, overload chrome, and let a daemon pick your targets.",
    file: "04",
  },
  fixer: {
    line: "Every problem has a fuse. She brought a lighter.",
    playsLike: "Grenades, mines and launchers, deployable turrets and drones, gas and stims.",
    file: "05",
  },
};

type Parent = SVGElement;

/** A stroked path that draws on (pathLength=1 for the dash animation). */
function line(parent: Parent, d: string, cls = "em-line"): SVGPathElement {
  return svg("path", { d, class: cls, pathLength: 1 }, parent);
}

function circle(parent: Parent, cx: number, cy: number, r: number, cls = "em-line"): SVGCircleElement {
  return svg("circle", { cx, cy, r, class: cls, pathLength: 1 }, parent);
}

/** A cog outline with `teeth` teeth, as a path (built in code). */
export function cogPath(cx: number, cy: number, rOuter: number, rInner: number, teeth: number): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const corners = [
      [a - step * 0.28, rInner],
      [a - step * 0.16, rOuter],
      [a + step * 0.16, rOuter],
      [a + step * 0.28, rInner],
    ] as const;
    for (const [ang, r] of corners) pts.push(`${(cx + Math.cos(ang) * r).toFixed(2)} ${(cy + Math.sin(ang) * r).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** The outer frame every emblem shares: a hairline ring with 24 ticks, longer at the quarters. */
function frame(g: Parent): void {
  circle(g, 60, 60, 56, "em-ring");
  let d = "";
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r1 = i % 6 === 0 ? 47 : 51;
    d += `M${(60 + Math.cos(a) * r1).toFixed(2)} ${(60 + Math.sin(a) * r1).toFixed(2)} L${(60 + Math.cos(a) * 54).toFixed(2)} ${(60 + Math.sin(a) * 54).toFixed(2)} `;
  }
  svg("path", { d, class: "em-ticks" }, g);
}

function ghost(g: Parent): void {
  // A scope reticle: the ring, a broken crosshair with stadia ticks, and one red drop where the head was.
  circle(g, 60, 60, 32);
  line(g, "M60 18 L60 44 M60 76 L60 102 M18 60 L44 60 M76 60 L102 60");
  line(g, "M36 56 L36 64 M84 56 L84 64 M56 36 L64 36", "em-line em-thin");
  svg("path", { d: "M60 52 C64 57 66 60 66 63 A6 6 0 0 1 54 63 C54 60 56 57 60 52 Z", class: "em-fill" }, g);
}

function butcher(g: Parent): void {
  // The cleaver crossed over the Pin.
  const pin = svg("g", { transform: "rotate(32 60 60)" }, g);
  line(pin, "M60 14 L60 100");
  line(pin, "M55.5 76 L64.5 76 L64.5 102 L55.5 102 Z");
  circle(pin, 60, 12, 4);
  const cleaver = svg("g", { transform: "rotate(-32 60 60)" }, g);
  line(cleaver, "M46 20 L74 20 Q78 20 78 26 L78 60 L46 60 Z");
  circle(cleaver, 70, 28, 3.2, "em-line em-thin");
  line(cleaver, "M56 60 L56 98 Q60 102 64 98 L64 60");
  svg("path", { d: "M46 52 L78 52 L78 60 L46 60 Z", class: "em-fill" }, cleaver);
}

function gunslinger(g: Parent): void {
  // A revolver cylinder seen end-on: six chambers, the flutes between them, one round chambered in red.
  circle(g, 60, 60, 34);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = 60 + Math.cos(a) * 20;
    const y = 60 + Math.sin(a) * 20;
    if (i === 0) svg("circle", { cx: x, cy: y, r: 7.5, class: "em-fill" }, g);
    else circle(g, x, y, 7.5);
    const fa = a + Math.PI / 6;
    line(
      g,
      `M${(60 + Math.cos(fa) * 28).toFixed(2)} ${(60 + Math.sin(fa) * 28).toFixed(2)} L${(60 + Math.cos(fa) * 33).toFixed(2)} ${(60 + Math.sin(fa) * 33).toFixed(2)}`,
      "em-line em-thin",
    );
  }
  circle(g, 60, 60, 4);
}

function wirewitch(g: Parent): void {
  // An eye made of circuitry: traces run out from the lid to solder pads; the pupil is a slit.
  line(g, "M18 60 Q60 24 102 60 Q60 96 18 60 Z");
  circle(g, 60, 60, 14);
  svg("path", { d: "M60 48 Q65 60 60 72 Q55 60 60 48 Z", class: "em-fill" }, g);
  line(g, "M60 39 L60 22 M44 43 L36 30 L28 30 M76 43 L84 30 L92 30 M44 77 L38 88 M76 77 L82 88 M60 81 L60 96", "em-line em-thin");
  for (const [x, y] of [
    [60, 19],
    [25, 30],
    [95, 30],
    [36, 91],
    [84, 91],
    [60, 99],
  ] as const) {
    circle(g, x, y, 2.6, "em-line em-thin");
  }
}

function fixer(g: Parent): void {
  // A cog around a lit fuse.
  line(g, cogPath(60, 60, 36, 29, 10));
  circle(g, 60, 60, 16);
  line(g, "M60 44 Q66 34 60 28 Q54 22 62 14", "em-line em-thin");
  svg("path", { d: "M62 8 L66 14 L62 20 L58 14 Z", class: "em-fill" }, g);
  svg("path", { d: "M55 56 L65 56 L65 70 L55 70 Z", class: "em-fill" }, g);
}

const DRAW: Record<ClassId, (g: Parent) => void> = { ghost, butcher, gunslinger, wirewitch, fixer };

/** A class emblem as an `<svg>` (decorative unless a label is given). */
export function classEmblem(cls: ClassId, label?: string): SVGSVGElement {
  const root = svg("svg", { viewBox: "0 0 120 120", class: `emblem emblem-${cls}` });
  if (label) {
    root.setAttribute("role", "img");
    root.setAttribute("aria-label", label);
  } else {
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("focusable", "false");
  }
  const g = svg("g", { class: "em-art" }, root);
  frame(g);
  DRAW[cls](g);
  return root;
}

/** A small item glyph by slot or weapon class (decorative). */
export function itemGlyph(item: Pick<Item, "kind" | "slot" | "base">): SVGSVGElement {
  const root = svg("svg", { viewBox: "0 0 48 48", class: "glyph", "aria-hidden": "true", focusable: "false" });
  const p = (d: string, cls = "gl") => svg("path", { d, class: cls }, root);
  if (item.kind === "chip") {
    p("M24 8 L38 24 L24 40 L10 24 Z");
    p("M24 16 L30 24 L24 32 L18 24 Z", "gl gl-fill");
    return root;
  }
  if (item.kind === "weapon") {
    const cls = WEAPON_BASES[item.base]?.cls ?? "pistol";
    if (cls === "melee") {
      p("M12 38 L34 12 M30 10 L36 16 M10 34 L16 40");
    } else if (cls === "sniper" || cls === "rifle") {
      p("M4 24 L38 24 L44 22 M10 24 L10 30 L16 30 L18 26 M22 24 L22 32 L26 32 M16 19 L30 19 M18 19 L18 22 M28 19 L28 22");
    } else if (cls === "shotgun") {
      p("M4 22 L40 22 L40 26 L4 26 M10 26 L8 34 L14 34 L16 26 M28 26 L28 30 L34 30");
    } else if (cls === "launcher") {
      p("M6 18 L40 18 L40 28 L6 28 Z M14 28 L14 36 M26 28 L26 34 M40 21 L44 21 L44 25 L40 25");
    } else {
      // pistol, revolver, smg, smart
      p("M8 18 L38 18 L38 24 L20 24 L18 34 L12 34 L14 24 L8 24 Z M24 24 L26 28 L30 28");
    }
    return root;
  }
  switch (item.slot) {
    case "head":
      p("M8 30 Q24 36 40 30 M14 30 Q14 16 24 14 Q34 16 34 30 M14 25 Q24 28 34 25");
      break;
    case "coat":
      p("M16 8 L24 18 L32 8 L40 14 L38 40 L10 40 L8 14 Z M24 18 L24 40 M16 8 L20 26 M32 8 L28 26");
      break;
    case "gloves":
      p("M14 40 L14 20 L18 10 L20 20 L22 8 L25 20 L27 9 L29 21 L32 12 L34 22 L34 40 Z");
      break;
    case "boots":
      p("M16 6 L26 6 L26 30 L40 34 L40 40 L12 40 L14 30 Z");
      break;
    default:
      // cyberware: an implant chip with pins
      p("M14 14 L34 14 L34 34 L14 34 Z M20 20 L28 20 L28 28 L20 28 Z M18 14 L18 8 M24 14 L24 8 M30 14 L30 8 M18 34 L18 40 M24 34 L24 40 M30 34 L30 40");
  }
  return root;
}
