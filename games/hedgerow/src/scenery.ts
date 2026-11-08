// Plan item 274: the journey map as a painted overworld. Each act's stretch of country carries its own landmark
// props (Brindle's haystacks and sheep, Highmoor's tors and cairns, Saltmarsh's dunes, creek and lighthouse,
// Rivermead's willows, ford and mill), drawn in the same inked hand as the stop coins (stopart.ts). The map
// offers each act a seeded spread of candidate spots; `placeScenery` keeps those that land on open ground, clear
// of every stop, name, Cath and the lane, so the same props settle differently on a phone and a desktop.

import { PALS, type Pal } from "./stopart";

const INK = "#3a2a1e";
const S = `stroke="${INK}" stroke-width=".6" stroke-linejoin="round" stroke-linecap="round"`;
const n1 = (n: number): string => String(Math.round(n * 100) / 100);
const P = (fill: string, d: string): string =>
  `<path d="${d}" fill="${fill}" ${S}/>`;
const L = (d: string, c = INK, w = 0.6): string =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const C = (cx: number, cy: number, r: number, fill: string): string =>
  `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${fill}" ${S}/>`;
const E = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
): string =>
  `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${fill}" ${S}/>`;
const R = (x: number, y: number, w: number, h: number, fill: string): string =>
  P(fill, `M${n1(x)} ${n1(y)}h${n1(w)}v${n1(h)}h${n1(-w)}z`);
const dot = (cx: number, cy: number, r: number, fill: string, a = 1): string =>
  `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${fill}"${a < 1 ? ` opacity="${a}"` : ""}/>`;
const SH = (d: string, a = 0.2): string =>
  `<path d="${d}" fill="#1e140a" opacity="${a}"/>`;
const HI = (d: string, a = 0.35): string =>
  `<path d="${d}" fill="#fffbe8" opacity="${a}"/>`;
/** The soft contact shadow every prop sits on. */
const shadow = (cx: number, w: number, y = 23): string =>
  `<ellipse cx="${n1(cx)}" cy="${n1(y)}" rx="${n1(w / 2)}" ry="1.3" fill="#2a1e10" opacity=".18"/>`;

/** A prop: its drawing in a 32 by 24 box (ground line at y 23) and its nominal width on a desktop, in px. */
export type Prop = { key: string; w: number; svg: string };

type Draw = (p: Pal) => string;

const oak = (x: number, s: number, p: Pal): string =>
  P(
    p.wood,
    `M${n1(x - 1 * s)} 23l${n1(0.4 * s)} ${n1(-8 * s)}h${n1(1.2 * s)}l${n1(0.4 * s)} ${n1(8 * s)}z`,
  ) +
  C(x - 3.2 * s, 23 - 9 * s, 3.6 * s, p.leaf) +
  C(x + 3.2 * s, 23 - 9.4 * s, 3.8 * s, p.leaf) +
  C(x, 23 - 12.4 * s, 4.4 * s, p.leaf) +
  SH(
    `M${n1(x + 1 * s)} ${n1(23 - 16.6 * s)}a${n1(4.4 * s)} ${n1(4.4 * s)} 0 0 1 ${n1(5.8 * s)} ${n1(9 * s)}l${n1(-6 * s)} ${n1(0.8 * s)}z`,
    0.16,
  ) +
  HI(
    `M${n1(x - 3.4 * s)} ${n1(23 - 13 * s)}a${n1(2.4 * s)} ${n1(2.4 * s)} 0 0 1 ${n1(3.4 * s)} ${n1(-2.4 * s)}z`,
  );

const DRAW: Record<string, Draw> = {
  oak: (p) => shadow(16, 16) + oak(16, 1.25, p),
  orchard: (p) =>
    shadow(16, 28) +
    oak(9, 0.8, p) +
    oak(22, 0.9, p) +
    dot(6, 13, 0.7, "#d6463a") +
    dot(10.5, 11.6, 0.7, "#d6463a") +
    dot(20, 9.4, 0.7, "#d6463a") +
    dot(24.6, 12.2, 0.7, "#d6463a"),
  sheep: () =>
    shadow(16, 20) +
    [8, 20]
      .map(
        (x, i) =>
          `${L(`M${x - 2} 20v3M${x + 2} 20v3`, INK, 0.9)}${E(x, 18, 4.4, 3, "#f6f1e4")}${C(x + (i ? -4.4 : 4.4), 17, 1.5, "#2e2620")}${HI(`M${x - 3} 16.4a3 1.6 0 0 1 5 -1z`, 0.6)}`,
      )
      .join(""),
  cows: () =>
    shadow(16, 22) +
    L("M7 19v4M12 19v4M19 18v5M24 18v5", INK, 1) +
    P("#f4efe4", "M4.6 15.6h9.4v4.2H4.6z") +
    P("#2e2620", "M7 15.6h3v2.4H7z") +
    P("#f4efe4", "M14 15.2l3 -.6v3.2h-3z") +
    P("#8a5a3a", "M16.4 14.6h9.6v4.4h-9.6z") +
    P("#f4efe4", "M18.6 14.6h3v2.2h-3z") +
    P("#8a5a3a", "M26 14.4l2.6 -.4v3.4H26z"),
  bales: (p) =>
    shadow(16, 26) +
    [7, 17, 25]
      .map(
        (x, i) =>
          `${C(x, 23 - (i === 1 ? 4.4 : 3.6), i === 1 ? 4.4 : 3.6, p.accent)}${L(`M${x} ${23 - (i === 1 ? 4.4 : 3.6)}m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0`, "#8a6a2a", 0.5)}`,
      )
      .join("") +
    SH("M17 14.2a4.4 4.4 0 0 1 0 8.8z", 0.15),
  haystack: (p) =>
    shadow(16, 18) +
    P(p.accent, "M8 23c0-7 3-12 8-13c5 1 8 6 8 13z") +
    L("M10 18c4 1 8 1 12 0M9 21c5 1 9 1 14 0", "#8a6a2a", 0.5) +
    SH("M16 10c5 1 8 6 8 13h-6c1-5 0-10-2-13z", 0.14) +
    L("M16 10v-2", p.wood, 0.9),
  pond: (p) =>
    `<ellipse cx="16" cy="18" rx="14" ry="5" fill="${p.water}" ${S}/>` +
    HI("M8 17c3-2 9-2.4 13-1.6c-4 0-9 .6-13 1.6z", 0.6) +
    E(23, 19.4, 2, 0.8, "#6f9a48") +
    E(9.4, 20, 1.6, 0.6, "#6f9a48") +
    E(16, 16.6, 1.4, 1, "#fbf3e0") +
    C(17.4, 15.4, 0.8, "#fbf3e0") +
    dot(18, 15.4, 0.5, "#e8a33a"),
  scarecrow: (p) =>
    shadow(16, 10) +
    L("M16 23V7M9 11.4h14", p.wood, 1.1) +
    P("#6b8ac0", "M13 10.4h6l.6 6h-7.2z") +
    C(16, 7, 2.2, "#efd9a0") +
    P("#5a4330", "M12.6 5.6h6.8l-1.6-2.6h-3.6z") +
    L("M9 11.4l-1.4 1.6M23 11.4l1.4 1.6", "#d9b47c", 0.8) +
    dot(15.2, 7, 0.35, INK) +
    dot(16.8, 7, 0.35, INK),
  windmill: (p) =>
    shadow(16, 12) +
    P(p.wall, "M12 23l1.4-12h5.2L20 23z") +
    P(p.roof, "M12.8 11.2L16 7l3.2 4.2z") +
    R(15, 18.4, 2, 4.6, p.wood) +
    `<g transform="rotate(20 16 9)">${P("#fbf3e0", "M16 9l-1-8h2z")}${P("#fbf3e0", "M16 9l1 8h-2z")}${P("#fbf3e0", "M16 9l8-1v2z")}${P("#fbf3e0", "M16 9l-8 1v-2z")}</g>` +
    C(16, 9, 0.9, p.wood) +
    SH("M16 11.2h2.6L20 23h-4z", 0.12),
  hives: (p) =>
    shadow(16, 20) +
    [10, 21]
      .map(
        (x) =>
          `${R(x - 3.4, 15, 6.8, 8, "#fbf3e0")}${P(p.roof, `M${x - 4.4} 15.4l4.4 -3l4.4 3z`)}${L(`M${x - 3.4} 18h6.8M${x - 3.4} 20.6h6.8`)}${R(x - 1, 21.6, 2, 1.4, INK)}`,
      )
      .join("") +
    dot(25.6, 10, 0.6, p.accent) +
    dot(27, 12, 0.6, p.accent) +
    dot(6, 9.4, 0.6, p.accent),
  tractor: (p) =>
    shadow(16, 24) +
    P("#c0392b", "M7 13h9v6H5v-3z") +
    R(16, 10, 6, 9, "#c0392b") +
    R(17, 11, 4, 3.6, "#cfe4ee") +
    L("M9 13V9.6", INK, 0.9) +
    C(19.6, 19.4, 3.6, "#2b2320") +
    dot(19.6, 19.4, 1.4, p.accent) +
    C(8, 20.6, 2.4, "#2b2320") +
    dot(8, 20.6, 0.9, p.accent),
  stile: (p) =>
    shadow(16, 26) +
    L("M4 22.6V14M12 22.6V13M20 22.6V13M28 22.6V14", p.wood, 1.2) +
    L("M3 16h26M3 19.6h26", "#b08a5c", 1) +
    E(16, 22.6, 14, 1.2, p.leaf),
  // Highmoor
  tor: (p) =>
    shadow(16, 28) +
    P("#a39c88", "M3 23l2-5h7l1-5h8l2 4h4l2 6z") +
    P("#c4bca6", "M12 13h8l-1-4h-6z") +
    SH("M20 13l3 4h4l2 6h-7z", 0.18) +
    HI("M6 18h5l1-4", 0.4) +
    L("M8 20h6M15 16h4", "#5f594c", 0.5) +
    `<path d="M3 23c4-1 6 0 9-1c4 1 6 0 9 0c3-1 6 0 8 1z" fill="${p.leaf}" opacity=".7"/>`,
  cairn: () =>
    shadow(16, 12) +
    E(16, 21.4, 6, 2, "#9a9480") +
    E(16, 18.2, 4.8, 1.8, "#b8b09c") +
    E(15.6, 15.4, 3.6, 1.5, "#9a9480") +
    E(16.2, 13, 2.6, 1.2, "#c4bca6") +
    E(16, 11, 1.6, 0.9, "#9a9480"),
  stones: () =>
    shadow(16, 26) +
    P("#b8b09c", "M6 23V12l3-1 1 12z") +
    P("#a39c88", "M14 23V8l3-1 1 1v15z") +
    P("#b8b09c", "M23 23v-9l3-1 1 10z") +
    SH("M17 7l1 1v15h-2z", 0.2) +
    HI("M14.6 9l1.6-.6v4h-1.6z", 0.5),
  heather: () =>
    shadow(16, 28) +
    [5, 11, 17, 23, 28]
      .map(
        (x, i) =>
          `<path d="M${x - 4} 23c0-4 2-6 ${4} -6.4c2 .4 4 2.4 4 6.4z" fill="${i % 2 ? "#9a4a8a" : "#b26aa0"}" ${S}/>`,
      )
      .join("") +
    [6, 12, 18, 24].map((x) => dot(x, 18, 0.7, "#e6b8d8")).join(""),
  pony: () =>
    shadow(16, 16) +
    L("M10 18v5M13 18v5M19 18v5M22 18v5", INK, 1) +
    P("#7a5232", "M9 13c3-1 10-1 14 0v5H9z") +
    P("#7a5232", "M22 14l3-5h2.4l-.6 4-2 2z") +
    L("M23 9.6c-1 1-1.6 3-2 4.4", "#2e2620", 1.1) +
    L("M9 14c-1.4 1-1.8 3-1.6 5", "#2e2620", 1) +
    SH("M9 16h14v2H9z", 0.15) +
    dot(26, 10.4, 0.35, INK),
  wall: () =>
    shadow(16, 30) +
    P("#a39c88", "M1 23v-5l6-1 8 .6 8-.8 8 1.2v5z") +
    L(
      "M4 17.6v5.4M10 17.2v5.8M16 17.6v5.4M22 17v6M27 17.6v5.4M1 20.4h30",
      "#5f594c",
      0.5,
    ) +
    HI("M1 18l6-1 8 .6 8-.8 8 1.2v.8H1z", 0.4),
  thorn: (p) =>
    shadow(16, 14) +
    L("M14 23c1-4 0-8 3-12c2-2 6-3 10-3", p.wood, 1.4) +
    L("M17 13c-3-1-6 0-9 2", p.wood, 0.9) +
    P(p.leaf, "M19 7c4-2 9-1 11 1c-3 1-7 2-11 1z") +
    P(p.leaf, "M6 15c2-2 5-3 7-2c-2 1-4 2-7 2z") +
    SH("M19 9c4 .6 8 0 11-1c-3 2-7 2-11 1z", 0.2),
  peat: (p) =>
    shadow(16, 22) +
    [
      [6, 0],
      [12, 0],
      [18, 0],
      [9, 1],
      [15, 1],
    ]
      .map(([x, r]) => R(x!, 19.6 - r! * 3.4, 6, 3.4, "#5a4330"))
      .join("") +
    HI("M6 19.6h18v.6H6z", 0.25) +
    L("M26 23v-8", p.wood, 0.8) +
    P("#b08a5c", "M24.6 15l2.8-1v2z"),
  // Saltmarsh
  dunes: (p) =>
    `<path d="M0 23c3-6 7-8 11-8c4 0 6 3 9 3c4-3 8-4 12 5z" fill="${p.ground}" ${S}/>` +
    HI("M3 21c2-3 5-5 8-5c-3 1-5 3-6 5z", 0.5) +
    L(
      "M8 15l-1-4M9 15l1-4.6M10 15.4l2-3.6M22 17l-1-4M23.4 17l1.4-4M25 17.6l2-3",
      "#7f9a58",
      0.6,
    ),
  creek: (p) =>
    `<path d="M0 21c5-3 9 1 14-1s8-5 13-3c2 1 4 2 5 2v4H0z" fill="${p.water}" ${S}/>` +
    HI("M4 21c3-1 6 0 8 0", 0.6) +
    L(
      "M2 19c1-3 0-5 1-6M5 19.4c-.4-3 .4-4 1-5.4M27 17c0-3 1-4 1-6M30 18c0-2 .6-4 1-5",
      "#7f9a58",
      0.6,
    ) +
    dot(3, 13, 0.8, "#6b4a2b") +
    dot(28, 11, 0.8, "#6b4a2b"),
  lighthouse: (p) =>
    shadow(16, 14) +
    P("#a39c88", "M8 23l3-3h10l3 3z") +
    P("#fbf3e0", "M13 20l1-13h4l1 13z") +
    P("#d6463a", "M13.4 15.4h5.2l.3 2.6h-5.8zM14.2 9.6h3.6l.2 2.4h-4z") +
    R(13.4, 4.4, 5.2, 2.6, "#e9d27a") +
    P(p.roof, "M13 4.6l3-2.6 3 2.6z") +
    `<path d="M19 5.6l9-2v4.4z" fill="#fff4b0" opacity=".55"/>` +
    SH("M16 7h2l1 13h-3z", 0.12),
  boat: (p) =>
    `<path d="M1 21.6c5 1 25 1 30 0" stroke="${p.water}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    P("#c0392b", "M7 18h18l-3 4H10z") +
    L("M16 18V4", p.wood, 0.9) +
    P("#fbf3e0", "M16.6 5l7 11h-7z") +
    P("#f1e2bd", "M15.4 7l-5 9h5z") +
    HI("M10 19h14v.8H10z", 0.4),
  egret: () =>
    shadow(16, 8) +
    L("M15 23l1-6M18 23l-1-6", INK, 0.6) +
    P("#fbf3e0", "M11 15c2-4 8-4 10-1c-2 3-8 3-10 1z") +
    L("M20 14c2-2 2-5 0-7", "#fbf3e0", 1.6) +
    L("M20 14c2-2 2-5 0-7", INK, 0.3) +
    P("#e8a33a", "M20 7l4 .6-4 .6z") +
    dot(20.6, 7.2, 0.35, INK),
  huts: () =>
    shadow(16, 28) +
    [
      ["#d6463a", 3],
      ["#3f7fa6", 12],
      ["#e9b44c", 21],
    ]
      .map(
        ([c, x]) =>
          `${R(Number(x), 14, 7, 9, "#fbf3e0")}${P(String(c), `M${x} 14h7v9h-7z`)}${[1.4, 3.2, 5].map((o) => L(`M${Number(x) + o} 14v9`, "#fbf3e0", 0.7)).join("")}${P("#5e5872", `M${Number(x) - 0.6} 14.4l4.1 -3.4l4.1 3.4z`)}${R(Number(x) + 2.4, 18, 2.2, 5, "#5a4330")}`,
      )
      .join(""),
  pots: (p) =>
    shadow(16, 24) +
    [6, 13, 20]
      .map(
        (x) =>
          `${P("#b08a5c", `M${x - 3} 23v-4c0-3 6-3 6 0v4z`)}${L(`M${x - 3} 20.6h6M${x} 16.6v6.4`, "#6b4a2b", 0.4)}`,
      )
      .join("") +
    C(26, 21, 2, "#e8743a") +
    L("M26 19v-3", INK, 0.4) +
    L("M1 23h30", p.wood, 0.6),
  posts: (p) =>
    `<path d="M0 22c6 1 26 1 32 0" stroke="${p.water}" stroke-width="2" fill="none"/>` +
    [3, 9, 15, 21, 27]
      .map((x, i) => R(x, 12 + (i % 2) * 2, 2.2, 10 - (i % 2) * 2, p.wood))
      .join("") +
    dot(15.6, 10.6, 1.4, "#fbf3e0") +
    P("#fbf3e0", "M14.4 10.4l-2-1 2.6 .4z"),
  // Rivermead
  willow: (p) =>
    shadow(16, 22) +
    P(p.wood, "M15 23l.6-9h1.8l.6 9z") +
    P(
      p.leaf,
      "M16 5c-7 0-11 5-11 11c0 3 1 6 2 7c1-4 3-8 4-10c-1 4-1 8 0 10c1-3 3-7 5-9c1 3 1 6 0 9c2-2 4-6 4-9c1 3 1 6 0 9c2-1 4-5 4-8c0 2 0 5-1 7c2-1 3-4 3-6c0-6-4-11-10-11z",
    ) +
    L("M10 12c-1 3-1 6 0 9M21 12c1 3 1 6 0 8", "#3e6a2a", 0.5) +
    HI("M10 9c2-2 5-3 8-2c-3 0-6 1-8 2z", 0.5),
  ford: (p) =>
    `<path d="M0 17c8-2 24-2 32 0v6H0z" fill="${p.water}" ${S}/>` +
    [4, 10, 16, 22, 28]
      .map((x, i) => E(x, 20 - (i % 2) * 0.6, 2.4, 1.2, "#b8b09c"))
      .join("") +
    HI("M2 18.4c4-.6 8-.6 12 0", 0.6),
  millwheel: (p) =>
    `<path d="M0 21c8-1 24-1 32 0v2H0z" fill="${p.water}"/>` +
    R(14, 8, 16, 15, p.wall) +
    P(p.roof, "M13 8l8.5-6 9.5 6z") +
    R(22, 15, 4, 8, p.wood) +
    C(10, 15, 7, p.wood) +
    C(10, 15, 5, p.wall) +
    L("M10 8v14M3 15h14M5 10l10 10M15 10L5 20", p.wood, 0.9) +
    C(10, 15, 1.2, INK) +
    SH("M21.5 2l9.5 6h-9z", 0.15),
  rowboat: (p) =>
    `<path d="M2 21.4c5 1.2 23 1.2 28 0" stroke="${p.water}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    P("#3f7fa6", "M5 17h22l-3 4H8z") +
    P("#fbf3e0", "M7 17h18l-.6 1H7.6z") +
    L("M9 15l9 7M23 15l-9 7", p.wood, 0.7),
  swans: (p) =>
    `<path d="M0 22c8 1 24 1 32 0" stroke="${p.water}" stroke-width="2.2" fill="none"/>` +
    [9, 22]
      .map(
        (x, i) =>
          `${P("#fbf3e0", `M${x - 4} 20c1-3 7-3 8 0z`)}${L(`M${x + (i ? -3 : 3)} 19c${i ? -1.4 : 1.4} -2 ${i ? -1.4 : 1.4} -5 0 -6`, "#fbf3e0", 1.4)}${L(`M${x + (i ? -3 : 3)} 19c${i ? -1.4 : 1.4} -2 ${i ? -1.4 : 1.4} -5 0 -6`, INK, 0.3)}${dot(x + (i ? -3.6 : 3.6), 13.2, 0.6, "#e8743a")}`,
      )
      .join(""),
  rushes: () =>
    shadow(16, 24) +
    [5, 8, 11, 14, 18, 21, 24, 27]
      .map((x, i) =>
        L(
          `M${x} 23c0-5 ${i % 2 ? 1 : -1} -9 ${i % 2 ? 1.6 : -1.2} -12`,
          "#6e7f45",
          0.7,
        ),
      )
      .join("") +
    [8, 14, 21, 27]
      .map(
        (x, i) =>
          `<rect x="${x + (i % 2 ? 0.4 : -1.6)}" y="9" width="1.2" height="4" rx=".6" fill="#6b4a2b"/>`,
      )
      .join(""),
  footbridge: (p) =>
    `<path d="M0 22c8-1 24-1 32 0v1H0z" fill="${p.water}"/>` +
    P(p.wood, "M2 20c6-6 22-6 28 0l-1 1c-6-5-20-5-26 0z") +
    L(
      "M4 18.6v-4M10 15.6v-4M16 14.6v-4M22 15.6v-4M28 18.6v-4M4 14.6c6-5 18-5 24 0",
      "#b08a5c",
      0.7,
    ),
  heron: () =>
    shadow(16, 6) +
    L("M15 23V16M17 23l-1-7", INK, 0.6) +
    P("#9aa8b4", "M12 15c1-4 7-5 9-2c-1 3-6 4-9 2z") +
    L("M19 13c1-2 0-4-1-6", "#9aa8b4", 1.4) +
    P("#e8a33a", "M18 7l5 .4-5 .8z") +
    L("M17 7.4l-2 1", INK, 0.5) +
    L("M12 15l-2 2", "#5e6a74", 0.8),
  poplars: (p) =>
    shadow(16, 26) +
    [6, 13, 20, 27]
      .map(
        (x, i) =>
          `${R(x - 0.4, 19, 0.8, 4, p.wood)}${E(x, 12 + (i % 2), 2.4, 8 - (i % 2), p.leaf)}${SH(`M${x} ${4 + (i % 2)}a2.4 8 0 0 1 0 16z`, 0.15)}`,
      )
      .join(""),
  // Oakvale
  toadstools: () =>
    shadow(16, 20) +
    [
      [10, 1.1],
      [18, 1.5],
      [24, 0.8],
    ]
      .map(
        ([x, s]) =>
          `${R(x! - 0.9 * s!, 23 - 5 * s!, 1.8 * s!, 5 * s!, "#fbf3e0")}${P("#d6463a", `M${x! - 3.6 * s!} ${23 - 4.6 * s!}c0-3 ${7.2 * s!} -3 ${7.2 * s!} 0z`)}${dot(x! - s!, 23 - 6 * s!, 0.6 * s!, "#fbf3e0")}${dot(x! + 1.4 * s!, 23 - 5.4 * s!, 0.5 * s!, "#fbf3e0")}`,
      )
      .join(""),
  deer: () =>
    shadow(16, 14) +
    L("M11 18v5M13 18v5M19 18v5M21 18v5", INK, 0.8) +
    P("#a8703a", "M10 13c3-1 9-1 12 0v5H10z") +
    P("#a8703a", "M21 14l2-5h2l-.4 3-2 2z") +
    L("M24 9l-1-4M24 9l2-3M23 6.6l-2-1M25 6.4l2-.4", "#6b4a2b", 0.6) +
    dot(13, 15, 0.5, "#fbf3e0") +
    dot(16, 14.6, 0.5, "#fbf3e0") +
    dot(18.6, 15.2, 0.5, "#fbf3e0"),
  logs: (p) =>
    shadow(16, 26) +
    [
      [8, 19.6],
      [16, 19.6],
      [24, 19.6],
      [12, 14.4],
      [20, 14.4],
      [16, 9.2],
    ]
      .map(
        ([x, y]) =>
          `${C(x!, y!, 2.6, "#c8a070")}${L(`M${x! - 1.2} ${y!}a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0`, p.wood, 0.4)}`,
      )
      .join(""),
  foxgloves: () =>
    shadow(16, 20) +
    [9, 15, 22]
      .map(
        (x, i) =>
          `${L(`M${x} 23V${7 + i * 2}`, "#5a7a3a", 0.8)}${[0, 1, 2, 3].map((k) => E(x + (k % 2 ? 1 : -1), 9 + i * 2 + k * 3, 1.2, 1.4, "#c86aa0")).join("")}`,
      )
      .join("") +
    `<path d="M6 23c2-3 4-3 6 0M18 23c2-3 5-3 7 0" fill="#5a7a3a"/>`,
  // The Ballot and later: village and town
  marquee: (p) =>
    shadow(16, 26) +
    P("#fbf3e0", "M4 23v-8h24v8z") +
    [6, 10, 14, 18, 22, 26].map((x) => R(x - 1, 15, 2, 8, p.accent)).join("") +
    P("#fbf3e0", "M3 15l13-8 13 8z") +
    P(p.accent, "M3 15l13-8-4 8zM16 7l4 8h-8z") +
    L("M16 7V3", INK, 0.6) +
    P("#d63a3a", "M16 3l3 1-3 1z"),
  bunting: (p) =>
    L("M2 23V6M30 23V6", p.wood, 1) +
    L("M2 7c8 4 20 4 28 0", INK, 0.4) +
    [5, 9, 13, 17, 21, 25]
      .map((x, i) =>
        P(
          ["#d63a3a", "#3f7fa6", "#e9b44c"][i % 3]!,
          `M${x} ${7.6 + Math.sin((x / 30) * Math.PI) * 2.6}l2 0l-1 3z`,
        ),
      )
      .join(""),
  pylon: () =>
    shadow(16, 14) +
    L(
      "M10 23l5-20h2l5 20M11.6 16h8.8M13 10h6M9 6.4h14M10 12h12M11 16l9-6M21 16l-9-6",
      "#5e5650",
      0.7,
    ),
  crane: () =>
    shadow(16, 10) +
    L("M14 23V3h2v20M16 3h14M8 3h6M16 5l12-2M14 5L9 3", "#e9b44c", 1) +
    R(7, 3, 3, 3, "#5e5650") +
    L("M27 3v10", INK, 0.4) +
    R(25.6, 13, 3, 2.4, "#5e5650"),
  stalls: (p) =>
    shadow(16, 28) +
    [
      [3, "#d63a3a"],
      [17, "#3f7fa6"],
    ]
      .map(
        ([x, c]) =>
          `${R(Number(x) + 1, 17, 11, 6, p.wood)}${P(String(c), `M${x} 17l1-5h11l1 5z`)}${[2, 5, 8, 11].map((o) => L(`M${Number(x) + o} 12v5`, "#fbf3e0", 0.8)).join("")}${dot(Number(x) + 4, 18.6, 1, "#e8743a")}${dot(Number(x) + 7, 18.6, 1, "#9cc068")}`,
      )
      .join(""),
  crag: (p) =>
    shadow(16, 30) +
    P("#8a8478", "M1 23l4-10 4 2 3-9 5 6 4-3 5 8 5 6z") +
    SH("M17 12l4-3 5 8 5 6H19z", 0.2) +
    HI("M5 13l4 2 3-9", 0.4) +
    L("M7 23l2-6M15 23l1-6M23 23l1-4", "#5f594c", 0.5) +
    `<path d="M1 23c6-1 24-1 30 0z" fill="${p.leaf}" opacity=".6"/>`,
  deadtree: (p) =>
    shadow(16, 12) +
    L(
      "M16 23V12M16 14l-5-5M16 12l4-6M11 9l-2-3M20 6l3-1M16 17l4-3",
      p.wood,
      1.1,
    ) +
    P("#2e2620", "M22 4l2-1 1 1-1 1z") +
    P("#2e2620", "M9 5l2-1 1 1-1 1z"),
};

/** Each act's set of props (15: twelve or more settle on a desktop band), drawn in its own palette. */
const SETS: string[][] = [
  ["oak", "orchard", "sheep", "cows", "bales", "haystack", "pond", "scarecrow", "windmill", "hives", "tractor", "stile", "oak", "sheep", "bales"],
  ["tor", "cairn", "stones", "heather", "pony", "wall", "thorn", "peat", "sheep", "pond", "deadtree", "crag", "tor", "sheep", "cairn"],
  ["dunes", "creek", "lighthouse", "boat", "egret", "huts", "pots", "posts", "rushes", "heron", "dunes", "creek", "egret", "boat", "huts"],
  ["willow", "ford", "millwheel", "rowboat", "swans", "rushes", "footbridge", "heron", "poplars", "cows", "willow", "pond", "swans", "rushes", "oak"],
  ["oak", "toadstools", "deer", "logs", "foxgloves", "oak", "pond", "heather", "thorn", "stile", "poplars", "orchard", "toadstools", "deer", "logs"],
  ["dunes", "huts", "boat", "lighthouse", "pots", "posts", "egret", "creek", "rowboat", "crag", "dunes", "stalls", "huts", "egret", "boat"],
  ["crag", "deadtree", "cairn", "stones", "tor", "thorn", "heather", "wall", "pony", "peat", "crag", "pylon", "deadtree", "cairn", "stones"],
  ["marquee", "bunting", "stalls", "oak", "cows", "pond", "hives", "orchard", "bales", "windmill", "stile", "sheep", "bunting", "marquee", "oak"],
  ["pylon", "crane", "pylon", "deadtree", "wall", "stalls", "poplars", "pond", "bunting", "crane", "logs", "tractor", "pylon", "crane", "deadtree"],
  ["stalls", "bunting", "marquee", "stalls", "oak", "pond", "poplars", "crane", "huts", "boat", "orchard", "bales", "stalls", "bunting", "oak"],
];

/** Nominal widths (px, desktop): a broad scene wider than a single figure. */
const WIDE = new Set([
  "orchard",
  "bales",
  "pond",
  "tor",
  "wall",
  "heather",
  "dunes",
  "creek",
  "huts",
  "posts",
  "ford",
  "millwheel",
  "footbridge",
  "poplars",
  "marquee",
  "bunting",
  "stalls",
  "crag",
  "stile",
  "peat",
  "logs",
  "pots",
  "swans",
  "rowboat",
  "boat",
  "cows",
]);

/** The act's props, in the order the map offers them spots. */
export function actProps(act: number): Prop[] {
  const i = (((act - 1) % SETS.length) + SETS.length) % SETS.length;
  const pal = PALS[i % PALS.length]!;
  return SETS[i]!.map((key) => ({
    key,
    w: WIDE.has(key) ? 64 : 46,
    svg: `<svg viewBox="0 0 32 24" aria-hidden="true">${DRAW[key]!(pal)}</svg>`,
  }));
}

export const SCENERY_KINDS = Object.keys(DRAW);

/** A seeded spread of candidate spots across the band, as fractions of its width and height. */
export function scenerySpots(act: number, n = 120): [number, number][] {
  let a = (act * 2654435761) >>> 0;
  const rand = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // A jittered grid, so the spots cover the band evenly, shuffled so each prop gets its pick across the whole band.
  const cols = 10;
  const rows = Math.ceil(n / cols);
  const out: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push([
        (c + 0.15 + rand() * 0.7) / cols,
        (r + 0.15 + rand() * 0.7) / rows,
      ]);
  for (let k = out.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [out[k], out[j]] = [out[j]!, out[k]!];
  }
  return out;
}

type Box = { left: number; top: number; right: number; bottom: number };
const hit = (a: Box, b: Box, pad = 0): boolean =>
  a.left < b.right + pad &&
  b.left < a.right + pad &&
  a.top < b.bottom + pad &&
  b.top < a.bottom + pad;

/**
 * Settles the act's props on open ground: each prop tries the spots in turn and takes the first where it overlaps
 * no obstacle (stops, names, Cath, the card, the lane's samples) and no prop already placed. Props with no spot are
 * hidden. `obstacles` and `lane` are in the band's px; the band is `w` by `h`. Returns each prop's top-left and width (or null).
 */
export function settle(
  props: { w: number; h: number }[],
  spots: [number, number][],
  w: number,
  h: number,
  obstacles: Box[],
  lane: [number, number][],
  laneR: number,
): ([number, number, number] | null)[] {
  // The lane as a grid of 8 px cells it covers (widened by laneR), so each spot's test is a few lookups.
  const G = 8;
  const lanes = new Set<number>();
  const key = (cx: number, cy: number): number => cx * 4096 + cy;
  for (const [x, y] of lane)
    for (
      let cx = Math.floor((x - laneR) / G);
      cx <= Math.floor((x + laneR) / G);
      cx++
    )
      for (
        let cy = Math.floor((y - laneR) / G);
        cy <= Math.floor((y + laneR) / G);
        cy++
      )
        lanes.add(key(cx, cy));
  const onLane = (b: Box): boolean => {
    for (let cx = Math.floor(b.left / G); cx <= Math.floor(b.right / G); cx++)
      for (let cy = Math.floor(b.top / G); cy <= Math.floor(b.bottom / G); cy++)
        if (lanes.has(key(cx, cy))) return true;
    return false;
  };
  const taken: Box[] = [];
  const used = new Set<number>();
  // Full size first; a prop with no room tries again smaller (a crowded phone band, a short pencil act).
  return props.map((full) => {
    for (const scale of [1, 0.78, 0.6, 0.45])
      for (let k = 0; k < spots.length; k++) {
        const p = {
          w: Math.round(full.w * scale),
          h: Math.round(full.h * scale),
        };
        if (used.has(k)) continue;
        const [fx, fy] = spots[k]!;
        const left = Math.round(fx * w - p.w / 2);
        const top = Math.round(fy * h - p.h);
        const b: Box = { left, top, right: left + p.w, bottom: top + p.h };
        if (b.left < 2 || b.top < 2 || b.right > w - 2 || b.bottom > h - 2)
          continue;
        if (obstacles.some((o) => hit(b, o, 4))) continue;
        if (taken.some((o) => hit(b, o, 6))) continue;
        // The prop's art fills its lower part; the lane may pass over the empty sky above it, not its body.
        const body: Box = {
          left: b.left + 2,
          top: b.top + p.h * 0.25,
          right: b.right - 2,
          bottom: b.bottom,
        };
        if (onLane(body)) continue;
        used.add(k);
        taken.push(b);
        return [left, top, p.w];
      }
    return null;
  });
}
