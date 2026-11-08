// Plan item 241: each stop on the journey map is a little painted landmark of its place, in its act's palette: a
// skep for Bea's Beehive, the blimp over Saltmarsh, the campaign bus at the Ballot's end. Drawn into a 20x20 box
// (the coin's vignette), each on its own patch of the act's ground, with a lit face and a shaded one. Shading and
// highlights carry `data-sh` so a locked stop (pencil on paper, styles.css) drops them and keeps the line drawing.

export type Pal = { ground: string; leaf: string; wall: string; roof: string; accent: string; wood: string; water: string };

/** One palette per act, from its painted banner (map.ts ACTS). */
export const PALS: Pal[] = [
  { ground: "#9cc068", leaf: "#5f9a3e", wall: "#f1e2bd", roof: "#b5533c", accent: "#d9a53a", wood: "#7a5232", water: "#7fb8d6" },
  { ground: "#a8a46e", leaf: "#6e7f45", wall: "#ddd0b4", roof: "#5e5872", accent: "#9a4a8a", wood: "#6b4a2b", water: "#8aaec0" },
  { ground: "#d8cc9a", leaf: "#7f9a58", wall: "#f6f0e2", roof: "#3f7fa6", accent: "#e8743a", wood: "#8a6a4a", water: "#6fb0cf" },
  { ground: "#86b064", leaf: "#4f8a3c", wall: "#e8d8b6", roof: "#8e4a30", accent: "#3f8fbf", wood: "#6b4a2b", water: "#5fa3cc" },
  { ground: "#79a650", leaf: "#3f7a34", wall: "#ece0c4", roof: "#5b7a3a", accent: "#3aa0a8", wood: "#6a4426", water: "#6cc0d0" },
  { ground: "#bdb4a2", leaf: "#6f8a6a", wall: "#eeeae0", roof: "#33557a", accent: "#d9473b", wood: "#7a6a58", water: "#5b8fae" },
  { ground: "#a99d82", leaf: "#6a7a4a", wall: "#e2d9c8", roof: "#5c4a6e", accent: "#b8892e", wood: "#5e4030", water: "#7a9ab0" },
  { ground: "#a2bb74", leaf: "#5a8a40", wall: "#f1e8d2", roof: "#2f5a8a", accent: "#d63a3a", wood: "#6b4a2b", water: "#7fb0d0" },
  { ground: "#aeb1a6", leaf: "#6f8270", wall: "#d5d9dc", roof: "#4a5662", accent: "#e8743a", wood: "#5e5650", water: "#7fa6bf" },
  { ground: "#8a8a5c", leaf: "#4f6a3a", wall: "#efdcc0", roof: "#7a2a3a", accent: "#e9b44c", wood: "#5a3a2a", water: "#5a7aa0" },
];

const INK = "#3a2a1e";
const PAPER = "#fbf3e0";
const HOLLOWELL = "#e8743a";
const S = `stroke="${INK}" stroke-width=".7" stroke-linejoin="round" stroke-linecap="round"`;
const r1 = (n: number): string => String(Math.round(n * 100) / 100);

/** An inked shape. */
const P = (fill: string, d: string): string => `<path d="${d}" fill="${fill}" ${S}/>`;
/** A plain line. */
const L = (d: string, c = INK, w = 0.7): string => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Shade and light: dropped on a locked (pencil) stop. */
const SH = (d: string, a = 0.22): string => `<path data-sh="" d="${d}" fill="#1e140a" opacity="${a}"/>`;
const HI = (d: string, a = 0.4): string => `<path data-sh="" d="${d}" fill="#fffbe8" opacity="${a}"/>`;
const C = (cx: number, cy: number, r: number, fill: string): string => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${fill}" ${S}/>`;
const R = (x: number, y: number, w: number, h: number, fill: string): string => P(fill, `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}z`);
const dot = (cx: number, cy: number, r: number, fill: string): string => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${fill}"/>`;

/** The patch of the act's ground every landmark stands on. */
const ground = (p: Pal): string =>
  `<ellipse cx="10" cy="16.4" rx="8.8" ry="2.7" fill="${p.ground}" ${S}/>` + `<ellipse data-sh="" cx="8.2" cy="15.8" rx="5" ry="1.1" fill="#fffbe8" opacity=".3"/>`;

const tree = (x: number, y: number, r: number, p: Pal, fruit?: string): string =>
  R(x - 0.5, y, 1, 16.4 - y, p.wood) +
  C(x, y - r * 0.4, r, p.leaf) +
  SH(`M${r1(x)} ${r1(y - r * 1.4)}a${r1(r)} ${r1(r)} 0 010 ${r1(r * 2)}z`, 0.18) +
  HI(`M${r1(x - r * 0.75)} ${r1(y - r * 0.5)}a${r1(r * 0.45)} ${r1(r * 0.45)} 0 01${r1(r * 0.7)} -${r1(r * 0.6)}z`, 0.35) +
  (fruit ? dot(x - r * 0.4, y - r * 0.2, 0.55, fruit) + dot(x + r * 0.35, y - r * 0.6, 0.55, fruit) + dot(x + r * 0.1, y + r * 0.2, 0.55, fruit) : "");

const wheel = (x: number, y: number, r = 1.3): string => C(x, y, r, "#2b2320") + dot(x, y, r * 0.4, "#9a948a");

const ART: Record<string, (p: Pal) => string> = {
  cottage: (p) =>
    R(13.4, 3.6, 1.4, 3.4, p.wall) +
    R(4, 10, 7, 6.4, p.wall) +
    P(p.wall, "M11 10l5-1.7v8.1H11z") +
    SH("M11 10l5-1.7v8.1H11z") +
    P(p.roof, "M7.5 5.2l5.8-1.6 3.9 4.6-5.2 2.2z") +
    SH("M7.5 5.2l5.8-1.6 3.9 4.6-5.2 2.2z", 0.15) +
    P(p.roof, "M3 10.4L7.5 5.2l4.5 5.2z") +
    HI("M4.6 9.6L7.5 6.3l1 1.1-3 2.6z") +
    R(6.6, 12.6, 1.8, 3.8, p.wood) +
    R(12.4, 11.1, 2.2, 1.9, "#f6d27a"),
  windmill: (p) => {
    let o = P(p.wall, "M7.4 16.4L8.6 7.2h2.8l1.2 9.2z") + SH("M10 7.2h1.4l1.2 9.2H10z") + R(9.3, 13.4, 1.4, 3, p.wood) + P(p.roof, "M8.2 7.6a1.8 1.9 0 013.6 0z");
    for (const a of [-0.6, 0.97, 2.54, 4.11]) {
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const nx = -uy;
      const ny = ux;
      const at = (t: number, s: number): string => `${r1(10 + ux * t + nx * s)} ${r1(6.4 + uy * t + ny * s)}`;
      o += P(PAPER, `M${at(1.4, 0)}L${at(6, 0)}L${at(6, 1.6)}L${at(1.4, 1.3)}z`) + L(`M10 6.4L${at(6.3, 0)}`, p.wood, 0.9);
    }
    return o + C(10, 6.4, 0.7, p.accent);
  },
  orchard: (p) => tree(6, 9.5, 3.4, p, "#d9473b") + tree(13.6, 10.6, 3, p, "#e8a33a"),
  oaks: (p) => tree(5.6, 10.6, 2.9, p) + tree(12.4, 8.6, 4.2, p),
  barn: (p) =>
    P(p.roof, "M3.8 16.4V9.8l6.2-4.4 6.2 4.4v6.6z") +
    SH("M10 5.4l6.2 4.4v6.6H10z", 0.16) +
    P("#4a3a32", "M3 10.3l7-5 7 5-.9.8L10 6.7l-6.1 4.4z") +
    R(7.4, 11.6, 5.2, 4.8, p.wood) +
    L("M7.4 11.6l5.2 4.8M12.6 11.6l-5.2 4.8", PAPER, 0.7) +
    R(9, 8.2, 2, 1.7, "#f6d27a"),
  hive: (p) =>
    R(4.6, 15.2, 10.8, 1.2, p.wood) +
    P("#e2bf62", "M5 15.2C5 9.6 7.2 6.2 10 6.2s5 3.4 5 9z") +
    SH("M10 6.2c2.8 0 5 3.4 5 9h-5z", 0.15) +
    L("M5.5 12.4q4.5 1.6 9 0M6.4 9.6q3.6 1.3 7.2 0M5.1 14.6q4.9 1.4 9.8 0", "#a07a24", 0.6) +
    P(INK, "M8.9 15.2a1.1 1.2 0 012.2 0z") +
    dot(15.6, 6, 0.7, "#e2bf62") + L("M15.2 5.4l.4-.9M16 5.4l.4-.8", INK, 0.4) + dot(4.2, 8, 0.6, "#e2bf62"),
  fence: (p) =>
    P(p.wood, "M3 16.2l.6-7.4 1.4.2-.2 7.3z") +
    P(p.wood, "M8.6 16.4l-.3-8 1.5-.1.3 8.1z") +
    P(p.wood, "M14 16.2l.8-7.6 1.4.3-.6 7.4z") +
    P("#a37a50", "M3.3 10.6l12.4-.6.1 1.4-12.4.7z") +
    P("#a37a50", "M3.4 13.4l12.3.4-.1 1.4-12.3-.3z") +
    L("M17 16.2q.4-1.6 1.2-2.2M17.6 16.3q.1-1.3.8-1.6", p.leaf, 0.7),
  van: () =>
    P("#f4f1ea", "M2.4 15.4V8.8h9.8l3 2.8h2.6v3.8z") +
    SH("M2.4 13.6h15.4v1.8H2.4z", 0.15) +
    P(HOLLOWELL, "M2.4 12h15.4v1.4H2.4z") +
    P("#9cc3d8", "M12.6 9.5l2 1.9h-2z") +
    wheel(5.6, 15.5) +
    wheel(14.2, 15.5),
  survey: (p) =>
    L("M10 8.6L6.4 16.2M10 8.6l3.6 7.6M10 8.6v7.8", p.wood, 0.9) +
    R(8.2, 6.4, 3.6, 2.2, "#e2bf62") +
    C(12.6, 7.5, 0.9, "#4d6a86") +
    L("M15.6 16.3V6.5", p.wood, 0.8) +
    P(HOLLOWELL, "M15.6 6.5l2.6.9-2.6 1z"),
  keep: (p) =>
    P(p.wall, "M2.4 16.4V8.4l2-.9v1.9h1.8V7.3h2v2h3.6v-2h2v2.1h1.8V7.5l2 .9v8z") +
    SH("M10 9.3h1.8v-2h2v2.1h1.8V7.5l2 .9v8H10z", 0.18) +
    P(p.wood, "M8.4 16.4v-3.6a1.6 1.6 0 013.2 0v3.6z") +
    R(4.2, 11, 1.4, 1.8, INK) +
    R(14.4, 11, 1.4, 1.8, INK) +
    L("M10 9.3V2.6", INK, 0.7) +
    P(p.accent, "M10 2.6l4.6 1.4L10 5.6z"),
  stall: (p) => {
    let scallop = "M3 9.4";
    for (let i = 0; i < 5; i++) scallop += "a1.4 1.4 0 002.8 0";
    return (
      L("M4.2 9.4v7M15.8 9.4v7", p.wood, 0.9) +
      R(3.6, 12.4, 12.8, 4, p.wood) +
      SH("M3.6 14.6h12.8v1.8H3.6z", 0.18) +
      dot(5.6, 11.8, 1, "#d9473b") + dot(7.8, 11.7, 1, "#e8a33a") + dot(10.1, 11.8, 1, "#7fa84a") + dot(12.4, 11.7, 1, "#d9473b") + dot(14.4, 11.8, 1, "#e2bf62") +
      P(p.accent, "M3 9.4l1.6-3.4h10.8l1.6 3.4z") +
      P(PAPER, "M7.2 6h2l-.5 3.4H6.2zM11 6h2l.8 3.4h-2.4z") +
      P(p.accent, scallop + "z")
    );
  },
  coop: (p) =>
    L("M6 16.4v-2.4M12.6 16.4v-2.4", p.wood, 0.9) +
    R(5, 9.6, 8.6, 4.6, p.wall) +
    SH("M10.8 9.6h2.8v4.6h-2.8z", 0.16) +
    P(p.roof, "M4.2 10l5.1-3.6 5.1 3.6z") +
    P(INK, "M8.2 14.2v-2.2a1.1 1.1 0 012.2 0v2.2z") +
    P("#fbfaf4", "M13.4 16c-.4-2 .6-3.6 2.2-3.6 1 0 1.5.6 1.6 1.4l1 .3-1 .5c0 .9-.7 1.4-1.6 1.4z") +
    dot(16.6, 12.4, 0.5, "#d9473b") +
    `<ellipse cx="3.6" cy="15.6" rx="1" ry="1.3" fill="#f3e3c4" ${S}/>`,
  pricetag: (p) =>
    L("M10 16.4V9", p.wood, 1.1) +
    P(p.accent, "M3.4 7.4l3.2-3.2h10v6.4h-10z") +
    SH("M3.4 7.4h13.2v3.2h-10z", 0.15) +
    C(6.4, 7.4, 0.8, PAPER) +
    L("M9 6.2h5.6M9 8.6h4", PAPER, 0.9),
  inn: (p) =>
    R(3, 9.6, 9, 6.8, p.wall) +
    SH("M9 9.6h3v6.8H9z", 0.15) +
    P(p.roof, "M2.4 10l3-4.2h6l3 4.2z") +
    R(4.6, 11.2, 2, 1.8, "#f6d27a") +
    R(8.4, 12.6, 2, 3.8, p.wood) +
    L("M12 8.6h4.6M15.6 8.6v1.2", INK, 0.7) +
    R(13.8, 9.8, 3.6, 3.2, p.accent) +
    `<ellipse cx="15.6" cy="11.4" rx=".9" ry="1.1" fill="#f6d27a"/>`,
  stones: (p) =>
    P("#a9a49a", "M3.4 16.4l.4-6.6c.8-1 2.2-1 2.8 0l.4 6.6z") +
    P("#b6b1a6", "M8.2 16.4l.2-9.4c1-1.2 2.6-1.2 3.4 0l.2 9.4z") +
    SH("M10.4 6.4c.6.1 1 .3 1.4.6l.2 9.4h-1.6z", 0.2) +
    P("#a09a8e", "M13.6 16.4l.6-5.6c.8-.8 2-.8 2.6 0l.4 5.6z") +
    HI("M2 13.4q4-1.2 8 0t8 0v1.4q-4 1-8 0t-8 0z", 0.55) +
    L("M5 14.2q2-.6 4 0", p.leaf, 0.5),
  truck: () =>
    P("#f4f1ea", "M2.2 14.6V6.8h10v7.8z") +
    SH("M2.2 12.6h10v2H2.2z", 0.15) +
    P(HOLLOWELL, "M2.2 9.6h10v1.6h-10z") +
    P("#c94f2c", "M12.2 14.6V9h3.4l2.4 2.8v2.8z") +
    P("#9cc3d8", "M13.2 9.8h2.1l1.5 1.8h-3.6z") +
    wheel(4.6, 15.2) + wheel(7.6, 15.2) + wheel(15.2, 15.2),
  mast: (p) => {
    let br = "";
    for (let y = 14.6; y > 6; y -= 2.2) br += `M${r1(7.6 + (16.4 - y) * 0.2)} ${r1(y)}L${r1(12.4 - (16.4 - y + 2.2) * 0.2)} ${r1(y - 2.2)}`;
    return (
      L("M7.2 16.4L9.4 4.6M12.8 16.4L10.6 4.6", "#8a8f96", 0.9) +
      L(br, "#8a8f96", 0.5) +
      C(10, 3.8, 1, p.accent) +
      L("M13.2 2.4a3 3 0 010 3.2M14.8 1.4a4.6 4.6 0 010 5.2M6.8 2.4a3 3 0 000 3.2M5.2 1.4a4.6 4.6 0 000 5.2", p.accent, 0.6)
    );
  },
  hut: (p) =>
    R(6, 8.8, 8, 7.6, PAPER) +
    P(p.accent, "M7.4 8.8h1.6v7.6H7.4zM10.6 8.8h1.6v7.6h-1.6z") +
    SH("M12.2 8.8H14v7.6h-1.8z", 0.18) +
    P(p.roof, "M5 9.2l5-4.2 5 4.2z") +
    R(8.8, 12, 2.4, 4.4, p.wood) +
    L("M3 16.6q1-.6 2 0", p.water, 0.6),
  parcel: (p) =>
    P("#d9b07a", "M4 10h8.4v6.4H4z") +
    P("#ecc996", "M4 10l3-2.6h8.4L12.4 10z") +
    P("#b98e5a", "M12.4 10l3-2.6v6.4l-3 2.6z") +
    L("M8.2 10v6.4M5.5 8.7h8.4", p.accent, 1) +
    P(p.accent, "M9.6 7.8c-1.6-1.8-3.4-1-2.4.2zM9.6 7.8c1.4-2 3.4-1.2 2.4.1z"),
  bubble: (p) =>
    P(PAPER, "M3.2 3.6h13.6v7.2h-6.4l-3.2 3v-3H3.2z") +
    SH("M3.2 9.2h13.6v1.6H3.2z", 0.1) +
    dot(6.6, 7.2, 0.9, p.accent) + dot(10, 7.2, 0.9, p.accent) + dot(13.4, 7.2, 0.9, p.accent) +
    P("#e2564a", "M15 15.6l-1.6-1.5a1 1 0 011.6-1.2 1 1 0 011.6 1.2z"),
  sunset: (p) =>
    P("#f6b04a", "M4 13a6 6 0 0112 0z") +
    HI("M6 12a4 4 0 014-4v4z", 0.3) +
    P(p.water, "M1.6 13h16.8l-.4 3.4H2z") +
    L("M6 14.4h3M11.6 14.4h2.6M8 15.6h4", "#fff5d8", 0.6) +
    L("M10 4.4V3M5.6 6.2l-.9-.9M14.4 6.2l.9-.9", "#e08a2a", 0.7),
  blimp: (p) =>
    L("M10 12.8v3.6", INK, 0.5) +
    P("#ebe5d8", "M2.6 7.6c0-2.4 3.4-4 7.6-4s6.8 1.8 6.8 4-2.8 4-6.8 4-7.6-1.6-7.6-4z") +
    SH("M2.8 8.4c.8 1.8 3.8 3.2 7.4 3.2s6.2-1.4 6.6-3.2z", 0.16) +
    P(p.accent, "M6.4 4.1h2.2v7h-2.2z") +
    P("#ebe5d8", "M16.4 6l2-2.2v3.8zM16.4 9.2l2 2.2V7.6z") +
    R(8.6, 11.4, 3, 1.4, INK),
  lighthouse: (p) =>
    P(PAPER, "M7.4 16.4l1.3-10.6h2.6l1.3 10.6z") +
    P(p.accent, "M7.8 13.4l.4-3h3.6l.4 3zM8.6 7.6l.2-1.8h2.4l.2 1.8z") +
    SH("M10 5.8h1.3l1.3 10.6H10z", 0.16) +
    R(8.4, 3.4, 3.2, 2.4, "#f6d27a") +
    P(INK, "M8 3.4L10 1.6l2 1.8z") +
    HI("M11.6 4L18.4 2.4v3.6z", 0.5) +
    HI("M8.4 4L1.6 2.4v3.6z", 0.5),
  sandbags: (p) => {
    let o = P(p.water, "M1.4 16.2q2-.8 4 0t4 0v.6H1.4z");
    const bag = (x: number, y: number): string => P("#cdb486", `M${r1(x)} ${r1(y)}c0-1 .8-1.6 2.2-1.6s2.2.6 2.2 1.6-.8 1.6-2.2 1.6-2.2-.6-2.2-1.6z`) + L(`M${r1(x + 0.6)} ${r1(y - 0.8)}v1.6`, "#9a8058", 0.4);
    for (const [x, y] of [[5, 15], [9.4, 15], [13.8, 15], [7.2, 12.4], [11.6, 12.4], [9.4, 9.8]] as const) o += bag(x - 2.2, y);
    return o;
  },
  bridge: (p) =>
    P(p.water, "M1.6 13.6h16.8v3.2H1.6z") +
    P("#bcae96", "M1.6 9.4h16.8v4.8h-3.6a4.8 4.2 0 00-9.6 0H1.6z") +
    SH("M1.6 12.6h16.8v1.6h-3.6c-.2-.6-.5-1.1-.9-1.6H5.7c-.4.5-.7 1-.9 1.6H1.6z", 0.15) +
    P("#a8997e", "M1.4 8.2h17.2v1.2H1.4z") +
    L("M5 11h2M12 10.8h2.4M8.6 10.2h1.6", "#8a7a62", 0.5) +
    L("M7 15.6h2M11.4 16.2h2", "#fff5d8", 0.5),
  silo: (p) =>
    R(9, 6.4, 5.4, 10, "#cfd2cc") +
    SH("M12.2 6.4h2.2v10h-2.2z", 0.18) +
    P("#b9bdb6", "M9 6.4a2.7 2.2 0 015.4 0z") +
    L("M9 9.6h5.4M9 12.8h5.4", "#9aa098", 0.5) +
    P(p.roof, "M2.6 16.4v-5l3.2-2.6 3.2 2.6v5z") +
    R(4.6, 13, 2.4, 3.4, p.wood),
  dozer: () =>
    P("#3a3530", "M3.2 14.2h9.6a1.2 1.2 0 010 2.4H3.2a1.2 1.2 0 010-2.4z") +
    P("#e8b23a", "M3.2 14.2V10.4h3V7.6h4.6l.8 2.8h1.6v3.8z") +
    SH("M3.2 12.8h10v1.4h-10z", 0.18) +
    P("#9cc3d8", "M6.9 8.3h3.2l.5 2H6.9z") +
    P("#7a7670", "M14 9.4l2.6-.4 1.4 7.4-3.6.2z") +
    L("M13.2 11.8l1.2-.2", INK, 0.8) +
    dot(4.2, 15.4, 0.5, "#9a948a") + dot(7.8, 15.4, 0.5, "#9a948a") + dot(11.4, 15.4, 0.5, "#9a948a"),
  well: (p) =>
    L("M5.6 12V5.4M14.4 12V5.4", p.wood, 0.9) +
    P(p.roof, "M4 6l6-3.2 6 3.2z") +
    L("M10 5.6v3.4", INK, 0.4) +
    R(9.2, 9, 1.6, 1.4, p.wood) +
    P("#b7ab96", "M4.4 16.2v-4.6h11.2v4.6z") +
    SH("M12.2 11.6h3.4v4.6h-3.4z", 0.18) +
    P(p.water, "M4.4 11.6c0-.8 2.4-1.4 5.6-1.4s5.6.6 5.6 1.4-2.4 1.2-5.6 1.2-5.6-.4-5.6-1.2z") +
    L("M6.6 13.4h1.8M10.6 14.6h2", "#8a7a62", 0.5),
  tent: (p) =>
    P(p.accent, "M2.4 16.4L10 4.8l7.6 11.6z") +
    P(PAPER, "M10 4.8l-2.6 11.6h2zM10 4.8l2.6 11.6h-2z") +
    SH("M10 4.8l7.6 11.6H10z", 0.14) +
    P(INK, "M8.6 16.4L10 11.6l1.4 4.8z") +
    L("M10 4.8V2.4", INK, 0.6) +
    P(p.accent, "M10 2.4l2.4.7-2.4.8z"),
  boat: (p) =>
    P(p.water, "M1.4 14.6h17.2v2H1.4z") +
    P(p.roof, "M2.8 12.2h14.4l-2.2 3.4H5z") +
    HI("M3.4 12.2h13.6l-.4.7H3.8z", 0.45) +
    L("M9.6 12.2V2.6", p.wood, 0.8) +
    P(PAPER, "M10 3v8.4h5.6z") +
    SH("M10 8l5.6 3.4H10z", 0.1) +
    P(p.accent, "M9.6 2.6l-2.2.6 2.2.6z"),
  ship: (p) =>
    P(p.water, "M1 15.4h18v1.4H1z") +
    R(3.4, 8.4, 2.8, 3.6, PAPER) +
    R(3.8, 9.2, 2, 0.8, "#9cc3d8") +
    R(7, 9.6, 2.8, 2.4, HOLLOWELL) +
    R(9.8, 9.6, 2.8, 2.4, "#4d86a6") +
    R(12.6, 9.6, 2.8, 2.4, "#6aa04a") +
    R(9.8, 7.2, 2.8, 2.4, "#c9a43a") +
    P("#3d4a5a", "M1.4 12h17.2l-1.8 3.6H3.4z") +
    P(p.accent, "M1.9 13.4h16.2l-.3.6H2.2z"),
  court: (p) =>
    P(p.wall, "M2.6 7.6L10 3.4l7.4 4.2z") +
    HI("M4.6 7l5.4-3v1.4z", 0.35) +
    R(3, 7.6, 14, 1.2, p.wall) +
    R(4.2, 8.8, 1.6, 6, p.wall) + R(7.4, 8.8, 1.6, 6, p.wall) + R(11, 8.8, 1.6, 6, p.wall) + R(14.2, 8.8, 1.6, 6, p.wall) +
    SH("M5 8.8h.8v6H5zM8.2 8.8H9v6h-.8zM11.8 8.8h.8v6h-.8zM15 8.8h.8v6H15z", 0.2) +
    R(2.4, 14.8, 15.2, 1.6, "#cfc5b2") +
    C(10, 6.2, 0.8, p.accent),
  scroll: (p) =>
    P(PAPER, "M5 3.4h9.6v11.2H5z") +
    P("#ecdcb8", "M4 3.4a1 1 0 011-1h9.6a1 1 0 010 2H5a1 1 0 01-1-1zM4.4 14.6a1 1 0 011-1h9.6a1 1 0 010 2H5.4a1 1 0 01-1-1z") +
    L("M6.6 6.4h6.4M6.6 8.2h6.4M6.6 10h4.2", "#8a7a62", 0.5) +
    C(12.6, 11.8, 1.4, p.accent) +
    P(p.accent, "M12 13l-.6 2.2.9-.5.6.7.2-2.2z"),
  gavel: (p) =>
    P(p.wood, "M3.6 16.4v-1.8c0-.6 1.6-1 4-1s4 .4 4 1v1.8z") +
    P("#a37a50", "M3.6 14.6c0-.6 1.6-1 4-1s4 .4 4 1-1.6 1-4 1-4-.4-4-1z") +
    L("M10.2 10.6l6.2 5", p.wood, 1.1) +
    P(p.wood, "M6.6 9.4l4-4.6 2.6 2.2-4 4.6z") +
    SH("M11.6 6l1.6 1.4-4 4.6-1.6-1.4z", 0.2) +
    P(p.accent, "M7.5 8.4l4-4.6.7.6-4 4.6zM9.6 10.2l4-4.6.7.6-4 4.6z"),
  ballot: (p) =>
    P(PAPER, "M8.4 8.6l1-6.2 4.2.8-1 6z") +
    L("M10 5.8l1 1 1.6-2.2", p.accent, 0.7) +
    P(p.wall, "M3.6 16.4V9.6h9.6v6.8z") +
    P(p.roof, "M3.6 9.6l3-2.2h9.6l-3 2.2z") +
    P("#3a4c66", "M13.2 9.6l3-2.2v6.8l-3 2.2z") +
    R(7, 8.2, 4.6, 0.6, INK) +
    P(p.accent, "M5.2 12h6.4v1.6H5.2z"),
  bus: (p) =>
    P(p.accent, "M1.8 14.8V8.4h14.4l2 2.6v3.8z") +
    SH("M1.8 13.2h16.4v1.6H1.8z", 0.18) +
    P("#cfe3ee", "M3 9.4h11v2H3zM14.8 9.4h1.2l1.4 2h-2.6z") +
    L("M5.8 9.4v2M8.6 9.4v2M11.4 9.4v2", INK, 0.4) +
    C(9, 7.2, 1.3, "#2f5a8a") +
    P("#2f5a8a", "M8.4 8.4l-.4 1.6.9-.5zM9.6 8.4l.4 1.6-.9-.5z") +
    wheel(5, 15) + wheel(14.6, 15),
  tower: (p) => {
    let w = "";
    for (let y = 5.6; y < 15; y += 1.9) for (const x of [6.6, 8.6]) w += `M${r1(x)} ${r1(y)}h1.2v1.1h-1.2z`;
    return (
      R(5.6, 3.6, 5.6, 12.8, "#c7ccd0") +
      P("#9ea6ae", "M11.2 3.6l3-1.2v12.8l-3 1.2z") +
      `<path d="${w}" fill="#eaf2f6"/>` +
      L("M11.9 5.6l1.6-.6M11.9 8l1.6-.6M11.9 10.4l1.6-.6M11.9 12.8l1.6-.6", "#7f8890", 0.5) +
      P(p.accent, "M5.6 3.6h5.6v1.2H5.6z") +
      R(7.4, 14.2, 2, 2.2, "#4a5662")
    );
  },
  server: (p) =>
    R(5.6, 3.4, 8.8, 13, "#3d444c") +
    P("#2b3036", "M14.4 3.4l1.8-1v13l-1.8 1z") +
    R(6.6, 5, 6.8, 2, "#59626c") + R(6.6, 8, 6.8, 2, "#59626c") + R(6.6, 11, 6.8, 2, "#59626c") +
    dot(7.6, 6, 0.4, "#7fe08a") + dot(8.8, 6, 0.4, p.accent) + dot(7.6, 9, 0.4, "#7fe08a") + dot(7.6, 12, 0.4, p.accent) +
    L("M14.6 14.4q2.4.4 3 2", "#2b2320", 0.6),
  podium: (p) =>
    P(p.wood, "M6 16.4l1-6.2h6l1 6.2z") +
    SH("M10 10.2h3l1 6.2h-4z", 0.18) +
    P("#a37a50", "M5.4 10.6l1-2h7.2l1 2z") +
    C(10, 13, 1.5, p.accent) +
    L("M11.6 8.6l1.6-3", INK, 0.5) +
    `<ellipse cx="13.5" cy="5" rx=".9" ry="1.2" fill="#3a3530" ${S}/>`,
  chart: (p) =>
    L("M5.2 16.4l1.6-4M14.8 16.4l-1.6-4", p.wood, 0.8) +
    R(3.6, 3.6, 12.8, 9.4, PAPER) +
    `<path d="M5.6 11.6h1.8V9.4H5.6zM8.4 11.6h1.8V8H8.4zM11.2 11.6H13V6.2h-1.8z" fill="${p.accent}"/>` +
    L("M5.6 8l3-1.8 2.6.6 3.6-2.6", "#3a7a4a", 0.7) +
    P("#3a7a4a", "M14.8 4.2l.4 1.2-1.2.2z"),
  parachute: (p) =>
    P("#e8b23a", "M3 8.2a7 5.2 0 0114 0q-1.75-1-3.5 0-1.75-1-3.5 0-1.75-1-3.5 0-1.75-1-3.5 0z") +
    P(PAPER, "M8.2 3.4c-.8 1.4-1.2 3-1.2 4.8q1.5-.8 3 0c0-1.8-.4-3.6-1.8-4.8z") +
    SH("M10 3a7 5.2 0 017 5.2q-1.75-1-3.5 0-1.75-1-3.5 0z", 0.15) +
    L("M3 8.2l6 5.6M17 8.2l-6 5.6M10 8.2v5.6", "#5a4a3a", 0.4) +
    R(8.4, 13.6, 3.2, 2.4, p.wood) +
    L("M9.4 13.6v-.6h1.2v.6", INK, 0.4),
  signpost: (p) =>
    L("M10 16.4V3.4", p.wood, 1.1) +
    P(p.accent, "M10.6 4.2h5.4l1.6 1.4-1.6 1.4h-5.4z") +
    P(PAPER, "M9.4 8h-5.4L2.4 9.4 4 10.8h5.4z") +
    L("M11.6 5.6h3.4M4.6 9.4h3.6", "#8a7a62", 0.5),
  windsock: (p) =>
    L("M5 16.4V3.6", "#8a8f96", 0.9) +
    P(p.accent, "M5.4 4l4.2.6v2.8L5.4 8z") +
    P(PAPER, "M9.6 4.6l3.6.8v1.8l-3.6.8z") +
    P(p.accent, "M13.2 5.4l3.2.6v.8l-3.2.6z") +
    L("M8 11q3-1 6 0M10 13.2q3-1 6 0", "#8aa6b8", 0.6),
  net: (p) =>
    L("M3.4 16.4V5M16.6 16.4V5", p.wood, 1) +
    L("M3.4 5.6q6.6 3.4 13.2 0M3.4 8.4q6.6 3 13.2 0M3.4 11.2q6.6 2.6 13.2 0M6 6.6v6.4M8.6 7.6v6.4M11.4 7.6v6.4M14 6.6v6.4", "#8a7a62", 0.45) +
    C(6, 6.8, 0.8, p.accent) + C(10, 7.8, 0.8, p.accent) + C(14, 6.8, 0.8, p.accent),
  clinic: () =>
    P("#f2f2ee", "M3 16.4V8.4h10.4v8z") +
    P("#d6d8d4", "M13.4 8.4l3.4-1.8v8l-3.4 1.8z") +
    P("#e4e6e2", "M3 8.4l3.4-1.8h10.4l-3.4 1.8z") +
    P("#d9473b", "M7.3 9.6h1.8v1.6h1.6V13H9.1v1.6H7.3V13H5.7v-1.8h1.6z") +
    P(HOLLOWELL, "M3 15.2h10.4v1.2H3z"),
  bottle: (p) =>
    P(p.water, "M5.4 16.4v-7c0-1 1.4-1.6 1.4-2.8V5h2v1.6c0 1.2 1.4 1.8 1.4 2.8v7z") +
    R(5.4, 10.6, 4.8, 2.6, PAPER) +
    R(6.8, 4, 2, 1, p.accent) +
    P(p.water, "M10.8 16.4v-6c0-.8 1.1-1.3 1.1-2.3V6.8h1.6v1.3c0 1 1.1 1.5 1.1 2.3v6z") +
    R(12, 5.8, 1.6, 0.9, p.accent) +
    HI("M6.2 9.4h.8v6.4h-.8z", 0.5),
  clocktower: (p) =>
    R(7, 6.4, 6, 10, p.wall) +
    SH("M11 6.4h2v10h-2z", 0.18) +
    P(p.roof, "M6.4 6.6L10 1.4l3.6 5.2z") +
    C(10, 9.4, 1.9, PAPER) +
    L("M10 9.4V8.2M10 9.4l.9.5", INK, 0.5) +
    P(p.wood, "M8.8 16.4v-2.6a1.2 1.2 0 012.4 0v2.6z") +
    R(3, 12, 4, 4.4, p.wall) +
    P(p.roof, "M2.6 12.2L5 10.2l2 1.8z"),
  crown: (p) =>
    R(5.2, 13.2, 9.6, 3.2, "#b7ab96") +
    SH("M12 13.2h2.8v3.2H12z", 0.18) +
    P("#e2bf62", "M4.8 11.6l.8-6.2 2.6 2.8L10 3.6l1.8 4.6 2.6-2.8.8 6.2z") +
    SH("M10 3.6l1.8 4.6 2.6-2.8.8 6.2H10z", 0.15) +
    R(4.8, 11.4, 10.4, 1.8, "#c9a43a") +
    dot(7.4, 12.3, 0.55, p.accent) + dot(10, 12.3, 0.55, "#4d86a6") + dot(12.6, 12.3, 0.55, p.accent),
};

/** Each act's ten stops, in order (the tenth the boss), named for the level they stand for. */
const ACT_STOPS: string[][] = [
  ["cottage", "windmill", "stall", "hive", "pricetag", "orchard", "fence", "survey", "barn", "van"],
  ["stall", "coop", "inn", "van", "pricetag", "stones", "gavel", "windmill", "fence", "truck"],
  ["mast", "bubble", "hut", "pricetag", "parcel", "lighthouse", "stall", "sunset", "blimp", "podium"],
  ["bridge", "sandbags", "scroll", "windmill", "cottage", "barn", "fence", "silo", "boat", "dozer"],
  ["well", "oaks", "scroll", "bottle", "mast", "bubble", "inn", "truck", "cottage", "clinic"],
  ["hut", "boat", "net", "windsock", "tent", "lighthouse", "cottage", "parcel", "bubble", "ship"],
  ["cottage", "signpost", "scroll", "van", "gavel", "podium", "bubble", "pricetag", "inn", "court"],
  ["ballot", "tent", "cottage", "scroll", "court", "stall", "chart", "podium", "signpost", "bus"],
  ["signpost", "podium", "pricetag", "parcel", "scroll", "server", "court", "parachute", "chart", "tower"],
  ["scroll", "clocktower", "boat", "silo", "inn", "stall", "court", "bubble", "tent", "crown"],
];

/** The landmark's name for level `id` (1-based; acts of ten). */
export function stopArtKey(id: number): string {
  const act = Math.floor((id - 1) / 10) % ACT_STOPS.length;
  return ACT_STOPS[act]![(id - 1) % 10]!;
}

/** The painted landmark for level `id`, as the inner markup of a `viewBox="0 0 20 20"` svg. */
export function stopArtSvg(id: number): string {
  const act = Math.floor((id - 1) / 10) % PALS.length;
  const pal = PALS[act]!;
  return ground(pal) + ART[stopArtKey(id)]!(pal);
}

export const STOP_ART_KEYS = Object.keys(ART);
