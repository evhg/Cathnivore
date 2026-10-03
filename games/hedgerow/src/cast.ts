// Portraits for Hedgerow's cast beside Cath (who comes from shared/cath): Mara, the bean farmer in her
// sixties; Bea, Cath's daughter, six; Tomas, the union man who runs the Highmoor market; Sol, who
// broadcasts from a radio mast; Ines, who runs the clinic tent; Pip, the young inventor; and the other
// side: Pell the politician, Mr Crisp the discount king and Dr Octavia Vane of the wellness division. Marrow
// itself, the narrator, is a hedgerow badge.
//
// Same drawing language as Cath (owner feedback 2026-10-03: "the art is simplistic"): storybook cel
// shading with tapered brush line work. They stand on the right of the story panel, so their key light
// comes from the viewer's left: the shadow side is on the right and a rim light catches their left
// edges, warm for the valley's people and a cold, clinical blue for the corporations' (VISION: "glossy,
// plastic, over-lit and clinical"). SVG strings with presentation attributes only (the CSP forbids
// inline style attributes); every gradient, clip, mask and pattern id is unique per call.

export type CastMember = "mara" | "bea" | "tomas" | "sol" | "ines" | "pip" | "pell" | "crisp" | "vane" | "narrator";

const INK = "#3A2A24";
const WARM_RIM = "#FFE9C8";
const COOL_RIM = "#D6F0FF";

type Pt = readonly [number, number];
const n1 = (v: number) => String(Math.round(v * 10) / 10);

/** A tapered brush stroke along a quadratic curve, as a filled shape (w0 at the start, wm mid, w1 end). */
function brush(p0: Pt, c: Pt, p1: Pt, w0: number, wm: number, w1: number, fill: string, opacity = 1): string {
  const steps = 8;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
    let dx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
    let dy = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const w = Math.max(0.05, w0 * (1 - t) * (1 - 2 * t) + wm * 4 * t * (1 - t) + w1 * t * (2 * t - 1)) / 2;
    left.push(`${n1(x - dy * w)} ${n1(y + dx * w)}`);
    right.push(`${n1(x + dy * w)} ${n1(y - dx * w)}`);
  }
  const op = opacity < 1 ? ` opacity="${opacity}"` : "";
  return `<path fill="${fill}"${op} d="M${left.join(" L")} L${right.reverse().join(" L")} Z"/>`;
}

/** Mix two #rrggbb colours. */
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

// ---- shared geometry -------------------------------------------------------------------------------------

const FACE = {
  oval: "M80 42 C99 42 110 58 110 80 C110 100 105 117 97 128 C91 136 86 140 80 140 C74 140 69 136 63 128 C55 117 50 100 50 80 C50 58 61 42 80 42 Z",
  square: "M80 42 C100 42 111 57 111 80 C111 100 109 116 103 127 C97 136 89 140 80 140 C71 140 63 136 57 127 C51 116 49 100 49 80 C49 57 60 42 80 42 Z",
  long: "M80 40 C98 40 108 56 108 80 C108 102 104 120 96 131 C91 138 86 142 80 142 C74 142 69 138 64 131 C56 120 52 102 52 80 C52 56 62 40 80 40 Z",
  round: "M80 54 C100 54 111 68 111 90 C111 112 101 138 80 138 C59 138 49 112 49 90 C49 68 60 54 80 54 Z",
  soft: "M80 44 C99 44 110 59 110 80 C110 100 107 116 100 127 C94 136 87 140 80 140 C73 140 66 136 60 127 C53 116 50 100 50 80 C50 59 61 44 80 44 Z",
};

const TORSO = {
  man: "M6 190 C8 166 22 152 48 146 C58 144 66 141 70 138 L90 138 C94 141 102 144 112 146 C138 152 152 166 154 190 Z",
  woman: "M12 190 C14 168 26 154 50 148 C58 146 64 143 68 140 L92 140 C96 143 102 146 110 148 C134 154 146 168 148 190 Z",
  child: "M26 190 C28 170 38 158 56 154 C62 152 66 150 70 148 L90 148 C94 150 98 152 104 154 C122 158 132 170 134 190 Z",
};

/** A torso with a V opening down to (80, depth). */
const vee = (torso: string, depth: number) => torso.replace(/L(9[02]) (1[34]\d)/, `L80 ${depth} L$1 $2`);

type EyeStyle = "adult" | "child" | "old" | "sly" | "cool";
const EYE: Record<EyeStyle, { w: number; h: number; hb: number; r: number }> = {
  adult: { w: 6.6, h: 5.4, hb: 3.6, r: 4.4 },
  child: { w: 7.4, h: 7.2, hb: 5, r: 5.6 },
  old: { w: 6, h: 4.4, hb: 3, r: 3.9 },
  sly: { w: 6.6, h: 3.2, hb: 3, r: 4.2 },
  cool: { w: 6.8, h: 4, hb: 2.6, r: 4 },
};

interface Skin {
  base: string;
  shade: string;
  deep: string;
  line: string;
  light: string;
}

const skinOf = (base: string): Skin => ({
  base,
  shade: mix(base, "#8A3A2A", 0.2),
  deep: mix(base, "#5A2418", 0.36),
  line: mix(base, "#2A120C", 0.62),
  light: mix(base, "#FFFFFF", 0.5),
});

// ---- the kit: everything one portrait needs, with ids unique to this call ----------------------------------

let uid = 0;

class Kit {
  readonly id = `cast${++uid}`;
  readonly defs: string[] = [];
  private n = 0;
  constructor(
    readonly s: Skin,
    readonly rim: string,
  ) {
    const id = this.id;
    this.defs.push(`<radialGradient id="${id}-face" cx="0.36" cy="0.34" r="0.75"><stop offset="0" stop-color="${mix(s.base, "#FFFFFF", 0.25)}"/><stop offset="0.5" stop-color="${s.base}"/><stop offset="1" stop-color="${mix(s.base, s.shade, 0.6)}"/></radialGradient>
<linearGradient id="${id}-side" gradientUnits="userSpaceOnUse" x1="50" y1="0" x2="111" y2="0"><stop offset="0" stop-color="${s.shade}" stop-opacity="0.25"/><stop offset="0.12" stop-color="${s.shade}" stop-opacity="0"/><stop offset="0.62" stop-color="${s.shade}" stop-opacity="0"/><stop offset="0.84" stop-color="${s.shade}" stop-opacity="0.55"/><stop offset="1" stop-color="${s.deep}" stop-opacity="0.8"/></linearGradient>
<linearGradient id="${id}-jaw" gradientUnits="userSpaceOnUse" x1="0" y1="112" x2="0" y2="142"><stop offset="0" stop-color="${s.shade}" stop-opacity="0"/><stop offset="1" stop-color="${s.shade}" stop-opacity="0.7"/></linearGradient>
<linearGradient id="${id}-neck" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${s.base}"/><stop offset="0.55" stop-color="${s.base}"/><stop offset="1" stop-color="${s.shade}"/></linearGradient>
<radialGradient id="${id}-blush" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#EE8A84" stop-opacity="0.7"/><stop offset="1" stop-color="#EE8A84" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-white" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4D2CC"/><stop offset="0.55" stop-color="#FFFDFB"/></linearGradient>`);
  }

  key(prefix: string): string {
    return `${this.id}-${prefix}${++this.n}`;
  }

  /** The band of a shape left when the shape shifted by (dx, dy) is cut away: shadow side or rim light. */
  band(d: string, dx: number, dy: number, fill: string, opacity: number): string {
    const m = this.key("m");
    return `<mask id="${m}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="200" height="230"><path fill="#fff" d="${d}"/><path fill="#000" transform="translate(${dx} ${dy})" d="${d}"/></mask><path fill="${fill}" opacity="${opacity}" mask="url(#${m})" d="${d}"/>`;
  }

  clip(d: string, inner: string, extra = ""): string {
    const c = this.key("c");
    return `<clipPath id="${c}"><path d="${d}"/></clipPath><g clip-path="url(#${c})"${extra}>${inner}</g>`;
  }

  linear(stops: [number, string][], x2 = 0, y2 = 1, user?: [number, number, number, number]): string {
    const g = this.key("g");
    const pos = user
      ? `gradientUnits="userSpaceOnUse" x1="${user[0]}" y1="${user[1]}" x2="${user[2]}" y2="${user[3]}"`
      : `x1="0" y1="0" x2="${x2}" y2="${y2}"`;
    this.defs.push(`<linearGradient id="${g}" ${pos}>${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`);
    return `url(#${g})`;
  }

  pattern(w: number, h: number, inner: string, transform = ""): string {
    const p = this.key("p");
    this.defs.push(`<pattern id="${p}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"${transform ? ` patternTransform="${transform}"` : ""}>${inner}</pattern>`);
    return `url(#${p})`;
  }

  /** A garment piece: fill, optional texture, the shadow side, a rim light and an outline. */
  cloth(d: string, fill: string, line: string, shadow: string, texture = "", shade = 0.55): string {
    return `<path fill="${fill}" d="${d}"/>${texture ? `<path fill="${texture}" d="${d}"/>` : ""}
${this.band(d, -24, 0, shadow, shade)}
${this.band(d, 2.4, 1.5, this.rim, 0.6)}
<path fill="none" stroke="${line}" stroke-width="1.8" stroke-linejoin="round" d="${d}"/>`;
  }

  /** A hair mass: a vertical gradient, the shadow side, light strands, a rim light and a soft outline. */
  hair(d: string, base: string, dark: string, light: string, strands: [Pt, Pt, Pt, number][] = [], outline = true): string {
    const fill = this.linear([[0, mix(base, light, 0.25)], [0.5, base], [1, dark]], 0, 1, [0, 30, 0, 150]);
    const lines = strands
      .map(([a, b, c, w], i) => brush(a, b, c, 0.2, w, 0.1, i % 3 === 2 ? dark : light, i % 3 === 2 ? 0.7 : 0.6))
      .join("");
    return `<path fill="${fill}" d="${d}"/>
${this.clip(d, `${this.band(d, -10, 0, dark, 0.65)}${lines}${this.band(d, 2.2, 1.4, light, 0.75)}`)}
${outline ? `<path fill="none" stroke="${mix(dark, "#000000", 0.45)}" stroke-width="1.6" stroke-linejoin="round" d="${d}"/>` : ""}`;
  }

  neck(top = 118, bottom = 146): string {
    const s = this.s;
    const d = `M69 ${top} C70 ${top + 12} 69 ${bottom - 8} 66 ${bottom} L94 ${bottom} C91 ${bottom - 8} 90 ${top + 12} 91 ${top} Z`;
    return `<path fill="url(#${this.id}-neck)" d="${d}"/>
<path fill="${s.shade}" d="M69 ${top + 4} C74 ${top + 18} 86 ${top + 18} 91 ${top + 4} L91 ${top + 16} C86 ${top + 24} 74 ${top + 24} 69 ${top + 16} Z"/>
<path fill="none" stroke="${s.line}" stroke-width="1.5" stroke-linecap="round" d="M69 ${top} C70 ${top + 12} 69 ${bottom - 8} 66 ${bottom} M91 ${top} C90 ${top + 12} 91 ${bottom - 8} 94 ${bottom}"/>`;
  }

  ears(y: number, earring = ""): string {
    const s = this.s;
    const ear = (x: number, f: 1 | -1) => `<path fill="${f === 1 ? s.base : s.shade}" stroke="${s.line}" stroke-width="1.4" d="M${x} ${y - 8} C${x - 7 * f} ${y - 10} ${x - 9 * f} ${y + 2} ${x - 4 * f} ${y + 9} C${x - 2 * f} ${y + 11} ${x + 1 * f} ${y + 10} ${x + 2 * f} ${y + 8} Z"/>
${brush([x - 2 * f, y - 5], [x - 6 * f, y], [x - 3 * f, y + 5], 0.3, 1.4, 0.3, s.deep, 0.7)}
${earring ? `<circle cx="${x - 3.5 * f}" cy="${y + 10}" r="1.8" fill="${earring}" stroke="${mix(earring, "#000000", 0.5)}" stroke-width="0.6"/>` : ""}`;
    return ear(52, 1) + ear(108, -1);
  }

  /** Face base with clipped cel shading; `shadows` are extra shapes (hair or hat cast shadows). */
  face(d: string, shadows = ""): string {
    const s = this.s;
    return `<path fill="url(#${this.id}-face)" d="${d}"/>
${this.clip(
  d,
  `<rect x="40" y="30" width="80" height="120" fill="url(#${this.id}-side)"/><rect x="40" y="30" width="80" height="120" fill="url(#${this.id}-jaw)"/>
${shadows}
<ellipse cx="70" cy="62" rx="10" ry="5" fill="${s.light}" opacity="0.45"/><ellipse cx="63" cy="104" rx="5" ry="3" fill="${s.light}" opacity="0.4" transform="rotate(20 63 104)"/>`,
)}
<path fill="none" stroke="${s.line}" stroke-width="1.6" stroke-linejoin="round" d="${d}"/>`;
  }

  blush(y: number, opacity = 0.75): string {
    return `<ellipse cx="62" cy="${y}" rx="8" ry="4.6" fill="url(#${this.id}-blush)" opacity="${opacity}"/><ellipse cx="98" cy="${y}" rx="8" ry="4.6" fill="url(#${this.id}-blush)" opacity="${opacity}"/>`;
  }

  /** Both eyes, glancing a touch toward Cath on the left. */
  eyes(y: number, iris: string, style: EyeStyle, lashes = false, gap = 13): string {
    const s = this.s;
    const e = EYE[style];
    const irisFill = this.linear([[0, mix(iris, "#000000", 0.45)], [0.55, iris], [1, mix(iris, "#FFFFFF", 0.35)]]);
    const liner = mix(s.line, "#000000", 0.5);
    const one = (cx: number, flip: 1 | -1) => {
      const x = (dx: number) => cx + dx * flip;
      const white = `M${n1(x(-e.w))} ${y} Q${n1(cx)} ${n1(y - 2 * e.h)} ${n1(x(e.w))} ${n1(y - 0.6)} Q${n1(cx)} ${n1(y + 2 * e.hb)} ${n1(x(-e.w))} ${y} Z`;
      const ic = cx - 1;
      let out = `<path fill="url(#${this.id}-white)" d="${white}"/>
${this.clip(
  white,
  `<circle cx="${ic}" cy="${y + 0.4}" r="${e.r}" fill="${irisFill}"/><circle cx="${ic}" cy="${y + 0.4}" r="${e.r}" fill="none" stroke="${mix(iris, "#000000", 0.6)}" stroke-width="0.7"/><circle cx="${ic}" cy="${y + 0.4}" r="${n1(e.r * 0.48)}" fill="#1A100C"/><ellipse cx="${cx}" cy="${n1(y - e.h)}" rx="${e.w + 2}" ry="${n1(e.h * 0.7)}" fill="#3A2018" opacity="0.35"/><circle cx="${n1(ic - e.r * 0.38)}" cy="${n1(y - e.r * 0.4)}" r="${n1(e.r * 0.36)}" fill="#fff"/><circle cx="${n1(ic + e.r * 0.42)}" cy="${n1(y + e.r * 0.42)}" r="${n1(e.r * 0.16)}" fill="#fff" opacity="0.85"/>`,
)}
${brush([x(-e.w - 0.6), y + 0.3], [cx, y - 2 * e.h - 0.6], [x(e.w + 0.8), y - 0.8], 0.6, lashes ? 2.4 : 1.8, lashes ? 2.2 : 1.4, liner)}
${brush([x(-e.w * 0.5), y + e.hb * 0.95], [cx, y + e.hb * 1.25], [x(e.w * 0.9), y + e.hb * 0.6], 0.2, 0.8, 0.3, s.line, 0.45)}
${brush([x(-e.w * 0.8), y - e.h - 2.2], [cx, y - e.h * 1.6 - 2.6], [x(e.w * 0.9), y - e.h - 1.4], 0.2, 0.9, 0.2, s.deep, 0.6)}`;
      if (lashes) out += brush([x(e.w), y - 1.2], [x(e.w + 2), y - 2.5], [x(e.w + 3.5), y - 4.5], 1.6, 1, 0.2, liner);
      if (style === "old") {
        out += brush([x(e.w + 1.5), y - 1], [x(e.w + 4), y - 2], [x(e.w + 6), y - 4], 0.2, 0.8, 0.2, s.deep, 0.7);
        out += brush([x(e.w + 1.5), y + 1.5], [x(e.w + 4.5), y + 2], [x(e.w + 6.5), y + 3], 0.2, 0.8, 0.2, s.deep, 0.7);
        out += brush([x(-e.w * 0.6), y + e.hb + 3], [cx, y + e.hb + 5], [x(e.w * 0.8), y + e.hb + 2.4], 0.2, 0.9, 0.2, s.deep, 0.55);
      }
      if (style === "sly") out += brush([x(-e.w), y - 1.5], [cx, y - e.h * 2.2], [x(e.w + 1), y - 1.5], 0.4, 1.4, 0.4, s.shade);
      return out;
    };
    return one(80 - gap, -1) + one(80 + gap, 1);
  }

  /** Brows as tapered strokes: [outer, peak, inner] y-offsets from `y` for the left and right brow. */
  brows(y: number, colour: string, w: number, l: [number, number, number], r: [number, number, number], gap = 13): string {
    const lx = 80 - gap;
    const rx = 80 + gap;
    return `${brush([lx - 9, y + l[0]], [lx - 1, y + l[1]], [lx + 8, y + l[2]], 0.6, w, w * 1.1, colour)}
${brush([rx - 8, y + r[2]], [rx + 1, y + r[1]], [rx + 9, y + r[0]], w * 1.1, w, 0.6, colour)}`;
  }

  nose(y: number, kind: "button" | "straight" | "strong" | "pointed"): string {
    const s = this.s;
    const len = kind === "button" ? 6 : kind === "strong" ? 16 : kind === "pointed" ? 15 : 13;
    const wide = kind === "strong" ? 6 : kind === "button" ? 3.6 : 4.6;
    const tip = y + len;
    const bridge = kind === "button" ? "" : brush([81.6, y + 1], [84.2, y + len * 0.6], [83, tip - 1], 0.2, kind === "strong" ? 2.4 : 1.8, 0.6, s.shade);
    const point = kind === "pointed" ? brush([80, tip - 2], [83, tip + 1], [81, tip + 2], 0.2, 1.2, 0.2, s.line, 0.6) : "";
    return `${bridge}
<path fill="${s.shade}" opacity="0.75" d="M${80 - wide} ${tip} Q80 ${tip + 5} ${80 + wide} ${tip} Q80 ${tip + 2.5} ${80 - wide} ${tip} Z"/>
${brush([80 - wide, tip], [80, tip + 3], [80 + wide + 0.4, tip - 0.6], 0.3, 1.4, 0.3, s.line)}
<ellipse cx="${80 - wide * 0.5}" cy="${tip + 0.6}" rx="1.1" ry="0.6" fill="${s.deep}"/><ellipse cx="${80 + wide * 0.5}" cy="${tip + 0.6}" rx="1.1" ry="0.6" fill="${s.deep}"/>
<ellipse cx="78.4" cy="${tip - 2.4}" rx="1.6" ry="1.1" fill="#fff" opacity="0.6"/>${point}`;
  }

  /** A closed mouth: lips (or just a line when `lip` is empty) along a smile of the given curve. */
  closedMouth(y: number, half: number, curve: number, lip: string, upper = 1.6, lower = 2.6, tilt = 0): string {
    const s = this.s;
    const l: Pt = [80 - half, y - tilt];
    const r: Pt = [80 + half, y + tilt];
    const m: Pt = [80, y + curve];
    const line = brush(l, m, r, 0.4, 1.3, 0.4, s.line);
    if (!lip) return `${line}<ellipse cx="80" cy="${y + curve + 4}" rx="${half * 0.5}" ry="1.4" fill="${s.shade}" opacity="0.7"/>`;
    return `<path fill="${mix(lip, "#000000", 0.15)}" d="M${l[0]} ${l[1]} Q${m[0]} ${m[1] - upper * 2} ${r[0]} ${r[1]} Q${m[0]} ${m[1]} ${l[0]} ${l[1]} Z"/>
<path fill="${lip}" d="M${l[0]} ${l[1]} Q${m[0]} ${m[1]} ${r[0]} ${r[1]} Q${m[0]} ${m[1] + lower * 2} ${l[0]} ${l[1]} Z"/>
<ellipse cx="78" cy="${n1(m[1] + lower * 0.8)}" rx="${n1(half * 0.28)}" ry="0.8" fill="#fff" opacity="0.45"/>
${line}<ellipse cx="80" cy="${y + curve + lower * 2 + 3}" rx="${half * 0.45}" ry="1.4" fill="${s.shade}" opacity="0.7"/>`;
  }

  /** An open smile with teeth. */
  openMouth(y: number, half: number, depth: number, teeth = "#FFFDF8", gapTooth = false): string {
    const s = this.s;
    const d = `M${80 - half} ${y} Q80 ${y + 3} ${80 + half} ${y} Q${80 + half * 0.6} ${y + depth} 80 ${y + depth} Q${80 - half * 0.6} ${y + depth} ${80 - half} ${y} Z`;
    return `<path fill="#6E2830" d="${d}"/>
${this.clip(
  d,
  `<path fill="${teeth}" d="M${80 - half} ${y - 1} L${80 + half} ${y - 1} L${80 + half} ${y + depth * 0.36} Q80 ${y + depth * 0.46} ${80 - half} ${y + depth * 0.36} Z"/>${gapTooth ? `<rect x="79.2" y="${y}" width="1.6" height="${n1(depth * 0.4)}" fill="#6E2830"/>` : ""}<ellipse cx="80" cy="${y + depth}" rx="${half * 0.6}" ry="${depth * 0.38}" fill="#D8707A"/>`,
)}
<path fill="none" stroke="${mix(s.line, "#000000", 0.2)}" stroke-width="1.2" stroke-linejoin="round" d="${d}"/>
${brush([80 - half - 1.5, y - 1.6], [80 - half - 0.5, y + 0.5], [80 - half + 0.5, y + 1.5], 0.2, 1, 0.2, s.deep)}
${brush([80 + half + 1.5, y - 1.6], [80 + half + 0.5, y + 0.5], [80 + half - 0.5, y + 1.5], 0.2, 1, 0.2, s.deep)}
<ellipse cx="80" cy="${y + depth + 4}" rx="${half * 0.45}" ry="1.4" fill="${s.shade}" opacity="0.7"/>`;
  }
}

// ---- the cast ------------------------------------------------------------------------------------------------

function mara(k: Kit): string {
  // Sixties, a bean farmer: a herringbone tweed flat cap and jacket, a cream cable knit, a red spotted
  // neckerchief, a bean-pod pin. Silver curls, weathered rosy cheeks, crow's feet and a kind smile.
  const tweed = k.pattern(
    6,
    6,
    `<rect width="6" height="6" fill="#7E6B4C"/><path d="M0 0 L3 3 L0 6 M3 0 L6 3 L3 6" stroke="#5C4C34" stroke-width="1" fill="none"/><circle cx="1.5" cy="4.2" r="0.6" fill="#B5A07A"/><circle cx="4.6" cy="1.2" r="0.5" fill="#9A4A34"/>`,
  );
  const knit = k.pattern(5, 6, `<rect width="5" height="6" fill="#EFE4CC"/><path d="M0 0 L2.5 3 L5 0 M0 3 L2.5 6 L5 3" fill="none" stroke="#C9B992" stroke-width="0.9"/>`);
  const spots = k.pattern(6, 6, `<rect width="6" height="6" fill="#B8432F"/><circle cx="1.5" cy="1.5" r="0.9" fill="#F6E9D8"/><circle cx="4.5" cy="4.5" r="0.9" fill="#F6E9D8"/>`);
  const jacket = vee(TORSO.woman, 178);
  const lapel = (f: 1 | -1) => {
    const x = (v: number) => 80 + (v - 80) * f;
    return `M${x(68)} 140 L${x(56)} 152 L${x(62)} 158 L${x(55)} 162 L80 178 Z`;
  };
  const cap = "M44 74 C40 60 48 46 66 42 C84 38 108 40 120 50 C126 55 126 64 118 68 C104 64 70 64 44 74 Z";
  const brim = "M48 72 C62 62 102 60 118 66 C122 70 118 76 110 77 C96 74 66 74 52 78 C46 79 45 75 48 72 Z";
  const back = "M46 72 C40 92 42 110 52 120 C60 125 100 125 108 120 C118 110 120 92 114 72 Z";
  const curls = (f: 1 | -1) => {
    const x = (v: number) => 80 + (v - 80) * f;
    const d = `M${x(52)} 70 C${x(44)} 76 ${x(41)} 88 ${x(44)} 98 C${x(45)} 103 ${x(49)} 106 ${x(52)} 103 C${x(50)} 99 ${x(51)} 95 ${x(54)} 92 C${x(52)} 86 ${x(54)} 80 ${x(58)} 74 Z`;
    return k.hair(d, "#CFCAC2", "#9A948A", "#F6F4F0", [[[x(50), 76], [x(45), 86], [x(47), 98], 1.6], [[x(53), 80], [x(50), 88], [x(52), 94], 1]]);
  };
  return `${k.hair(back, "#C9C4BC", "#9A948A", "#F1EEE8", [[[50, 90], [46, 104], [54, 116], 1.6], [[110, 90], [114, 104], [106, 116], 1.6]])}
${k.cloth(jacket, tweed, "#3E3220", "#2E2416", "", 0.55)}
<path fill="${knit}" d="M68 140 L80 178 L92 140 Z"/>
${k.neck(120, 146)}
<path fill="${knit}" stroke="#9C8A66" stroke-width="1.3" d="M66 138 C72 146 88 146 94 138 L96 144 C88 153 72 153 64 144 Z"/>
<path fill="${spots}" stroke="#6E2418" stroke-width="1.3" stroke-linejoin="round" d="M66 141 C72 149 88 149 94 141 L86 160 L80 166 L74 160 Z"/>
${k.band("M66 141 C72 149 88 149 94 141 L86 160 L80 166 L74 160 Z", -8, 0, "#5A1A10", 0.4)}
<circle cx="80" cy="149" r="4.2" fill="${spots}" stroke="#6E2418" stroke-width="1.2"/>
<path fill="#3E3220" opacity="0.55" transform="translate(-1.5 2.5)" d="${lapel(1)}"/><path fill="#3E3220" opacity="0.7" transform="translate(-1.5 2.5)" d="${lapel(-1)}"/>
<path fill="${tweed}" stroke="#3E3220" stroke-width="1.4" stroke-linejoin="round" d="${lapel(1)}"/>
<path fill="${tweed}" stroke="#3E3220" stroke-width="1.4" stroke-linejoin="round" d="${lapel(-1)}"/>
${k.band(lapel(-1), -6, 0, "#2E2416", 0.45)}
<path fill="none" stroke="#C9B992" stroke-width="0.8" stroke-dasharray="1.6 1.4" d="M66 144 L58 152 M94 144 L102 152 M30 168 C26 176 24 184 24 190 M130 168 C134 176 136 184 136 190"/>
<path fill="#6E9A44" stroke="#2E4A1A" stroke-width="1" d="M100 162 C104 156 112 156 115 160 C110 160 106 164 102 166 Z"/>
<circle cx="105" cy="160" r="1.3" fill="#A8CB78"/><circle cx="109" cy="159" r="1.3" fill="#A8CB78"/>
${k.ears(98, "#D4AE58")}
${k.face(FACE.soft, `<path fill="${k.s.shade}" opacity="0.8" transform="translate(1 6)" d="${brim}"/>`)}
${curls(1)}${curls(-1)}
${brush([66, 70], [80, 67], [94, 70], 0.2, 1, 0.2, k.s.deep, 0.5)}
${k.blush(106, 1)}
${k.eyes(92, "#5C7A44", "old")}
${k.brows(80, "#A39C92", 2.8, [1, -2.5, 0.5], [1, -3, 0.5])}
${k.nose(92, "straight")}
${brush([71, 106], [66, 113], [69, 121], 0.2, 1.2, 0.2, k.s.deep, 0.7)}${brush([89, 106], [94, 113], [91, 121], 0.2, 1.2, 0.2, k.s.deep, 0.7)}
${k.closedMouth(118, 9, 4, "#B76A5C", 0.8, 1.8)}
${k.cloth(cap, tweed, "#3E3220", "#2E2416")}
<path fill="#2E2416" opacity="0.5" transform="translate(0 2)" d="${brim}"/>
${k.cloth(brim, tweed, "#3E3220", "#2E2416")}
${brush([52, 72], [84, 64], [116, 67], 0.3, 1.4, 0.3, "#C9B992", 0.6)}
${brush([52, 66], [80, 52], [116, 54], 0.3, 1.2, 0.3, "#3E3220", 0.5)}`;
}

function bea(k: Kit): string {
  // Cath's daughter, six: her mum's dark hair in two bunches with yellow bobbles, a bee clip for her name,
  // big eyes, freckles, a gap-toothed grin, a pink cardigan with a peter-pan collar and a crayon pocket.
  const H = "#2E211C";
  const cardi = k.linear([[0, "#F08DA0"], [0.6, "#E8748B"], [1, "#C95A72"]], 1, 0.3);
  const rib = k.pattern(4, 5, `<path d="M0 0 L2 2.5 L4 0 M0 2.5 L2 5 L4 2.5" fill="none" stroke="#B94A62" stroke-width="0.8" opacity="0.5"/>`);
  const bunch = (f: 1 | -1) => {
    const x = (v: number) => 80 + (v - 80) * f;
    return `M${x(50)} 82 C${x(32)} 76 ${x(22)} 94 ${x(26)} 110 C${x(30)} 124 ${x(44)} 126 ${x(50)} 114 Z`;
  };
  const cap = "M49 96 C46 64 62 50 80 50 C98 50 114 64 111 96 C110 84 106 76 101 74 L59 74 C54 76 50 84 49 96 Z";
  const fringe =
    "M52 84 C52 62 64 52 80 52 C96 52 108 62 108 84 C105 78 103 75 100 77 C98 72 94 71 90 75 C86 71 82 71 78 75 C74 71 68 71 66 76 C62 73 58 73 56 79 C54 79 53 81 52 84 Z";
  return `${k.hair(bunch(1), H, "#1A110E", "#7E5D4D", [[[46, 86], [34, 92], [32, 108], 1.8], [[48, 96], [40, 104], [42, 116], 1.4]])}
${k.hair(bunch(-1), H, "#1A110E", "#7E5D4D", [[[114, 86], [126, 92], [128, 108], 1.8], [[112, 96], [120, 104], [118, 116], 1.4]])}
${[48, 112].map((x) => `<circle cx="${x}" cy="84" r="5" fill="#F2C94C" stroke="#9A7420" stroke-width="1.1"/><circle cx="${x - 1.5}" cy="82.5" r="1.6" fill="#FFF3C4"/>`).join("")}
${k.hair(cap, H, "#1A110E", "#7E5D4D")}
${k.cloth(TORSO.child, cardi, "#7A2A3E", "#A8405A", rib)}
<path fill="none" stroke="#B94A62" stroke-width="1.6" d="M80 152 L80 190"/>
${[160, 172, 184].map((y) => `<circle cx="84" cy="${y}" r="2" fill="#FFF6E8" stroke="#7A2A3E" stroke-width="0.8"/>`).join("")}
<path fill="#D86078" stroke="#7A2A3E" stroke-width="1.1" d="M100 172 L116 172 L116 186 L100 186 Z"/>
<path fill="#F2C94C" stroke="#9A7420" stroke-width="0.9" d="M104 164 L108 164 L108 173 L104 173 Z"/><path fill="#9A7420" d="M104 164 L106 160 L108 164 Z"/>
${k.neck(126, 150)}
<path fill="#FFFDF8" stroke="#9C8A80" stroke-width="1.2" stroke-linejoin="round" d="M68 146 C74 152 86 152 92 146 C100 152 96 162 82 158 L80 156 L78 158 C64 162 60 152 68 146 Z"/>
${k.band("M68 146 C74 152 86 152 92 146 C100 152 96 162 82 158 L80 156 L78 158 C64 162 60 152 68 146 Z", -6, 0, "#C9BDB2", 0.6)}
${k.ears(102)}
${k.face(FACE.round, `<path fill="${k.s.shade}" opacity="0.8" transform="translate(1 4)" d="${fringe}"/>`)}
${k.blush(114, 1)}
${[[64, 112], [68, 115], [71, 111], [89, 111], [92, 115], [96, 112]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="${k.s.deep}" opacity="0.8"/>`).join("")}
${k.eyes(100, "#7A4A2E", "child", true, 14)}
${k.brows(86, "#3A2A22", 1.8, [0.5, -1.5, 0.5], [0.5, -2, 0.5], 14)}
${k.nose(104, "button")}
${k.openMouth(120, 9, 9, "#FFFDF8", true)}
${k.hair(fringe, H, "#1A110E", "#7E5D4D", [[[60, 60], [70, 56], [82, 56], 2.2], [[86, 56], [98, 58], [104, 66], 1.8]])}
<g transform="translate(100 60) rotate(20)">
<ellipse cx="-3" cy="-5" rx="4" ry="3" fill="#FFFFFF" opacity="0.85" stroke="#8C9AA8" stroke-width="0.6"/><ellipse cx="3" cy="-5" rx="4" ry="3" fill="#FFFFFF" opacity="0.85" stroke="#8C9AA8" stroke-width="0.6"/>
<ellipse rx="6.5" ry="4.5" fill="#F2C94C" stroke="#3A2A10" stroke-width="1"/><path d="M-2 -4.2 L-2 4.2 M2 -4.2 L2 4.2" stroke="#2A1D10" stroke-width="1.6"/><circle cx="-6" cy="-0.5" r="1" fill="#2A1D10"/>
</g>`;
}

function tomas(k: Kit): string {
  // The union man who runs the Highmoor market: a navy donkey jacket with the black shoulder yoke, a
  // check flannel shirt, an enamel union badge; short hair greying at the temples, stubble, a big tash.
  const navy = k.linear([[0, "#3A4560"], [0.6, "#2B3346"], [1, "#20263A"]], 1, 0.3);
  const wool = k.pattern(3, 3, `<circle cx="1" cy="1" r="0.5" fill="#4A5676" opacity="0.6"/>`);
  const check = k.pattern(
    10,
    10,
    `<rect width="10" height="10" fill="#B3402F"/><rect width="10" height="3" y="3.5" fill="#2B3346" opacity="0.55"/><rect width="3" height="10" x="3.5" fill="#2B3346" opacity="0.55"/><path d="M0 8.5 H10 M8.5 0 V10" stroke="#F0D9B8" stroke-width="0.6" opacity="0.6"/>`,
  );
  const stubble = k.pattern(2.2, 2.2, `<circle cx="1.1" cy="1.1" r="0.32" fill="#3A2418" opacity="0.35"/>`, "rotate(30)");
  const jacket = vee(TORSO.man, 172);
  const yoke = "M14 160 C24 150 40 146 56 144 L66 139 L72 148 L88 148 L94 139 L104 144 C120 146 136 150 146 160 L144 168 C124 160 100 158 80 158 C60 158 36 160 16 168 Z";
  const hair = "M49 84 C44 54 62 38 82 38 C102 38 116 54 111 84 C110 79 108 74 105 70 C101 65 94 62 88 64 C84 62 78 62 74 64 C68 62 62 64 58 68 C54 72 52 78 50 84 Z";
  const tash = "M64 117 C68 110 77 109 80 112 C83 109 92 110 96 117 C93 121 87 119 80 118 C73 119 67 121 64 117 Z";
  return `<path fill="${check}" d="M66 138 L80 172 L94 138 Z"/>
${k.cloth(jacket, navy, "#141826", "#0E1220", wool)}
${k.cloth(yoke, k.linear([[0, "#3A3E48"], [0.5, "#15181F"], [1, "#0C0E12"]], 1, 0), "#050608", "#000000", "", 0.4)}
${brush([24, 156], [50, 146], [64, 144], 0.3, 2.2, 0.3, "#8C96A8", 0.7)}
<path fill="none" stroke="#5A6478" stroke-width="0.8" stroke-dasharray="1.8 1.6" d="M18 166 C38 158 60 156 72 156 M88 156 C100 156 122 158 142 166"/>
${k.neck(118, 144)}
<path fill="${check}" stroke="#5A1A12" stroke-width="1.3" stroke-linejoin="round" d="M68 136 L62 152 L74 150 L80 160 Z M92 136 L98 152 L86 150 L80 160 Z"/>
${k.band("M92 136 L98 152 L86 150 L80 160 Z", -5, 0, "#3A0E08", 0.4)}
<circle cx="112" cy="166" r="5" fill="#C23A2E" stroke="#D4AE58" stroke-width="1.6"/><path d="M108.8 166 L115.2 166 M112 162.8 L112 169.2" stroke="#FFF2D8" stroke-width="1.2"/><circle cx="110.4" cy="164.2" r="1" fill="#fff" opacity="0.7"/>
${k.ears(96)}
${k.face(FACE.square, `<path fill="${stubble}" d="M54 102 C56 126 68 140 80 140 C92 140 104 126 106 102 C104 116 96 124 80 124 C64 124 56 116 54 102 Z"/><path fill="${k.s.shade}" opacity="0.7" transform="translate(1 5)" d="${hair}"/>`)}
${k.blush(104, 0.5)}
${k.eyes(90, "#3A5E8A", "adult")}
${k.brows(78, "#3E2A1F", 3.6, [1.5, -1.5, 1], [1.5, -1.5, 1])}
${k.nose(90, "strong")}
${k.closedMouth(123, 6, 1.5, "", 0, 0)}
<path fill="#4A3226" stroke="#24160F" stroke-width="1.2" stroke-linejoin="round" d="${tash}"/>
${brush([68, 114], [73, 112], [78, 113], 0.2, 1, 0.2, "#7A5A46")}${brush([82, 113], [87, 112], [92, 114], 0.2, 1, 0.2, "#6A4A38")}
${k.hair(hair, "#4A3226", "#2A1A12", "#8A6A54", [[[60, 58], [72, 50], [88, 50], 2], [[90, 50], [102, 54], [106, 66], 1.6]])}
${brush([51, 76], [51, 88], [53, 98], 3, 2.6, 1, "#3A2418")}${brush([109, 76], [109, 88], [107, 98], 3, 2.6, 1, "#2A1A12")}
${brush([51, 84], [51, 76], [55, 68], 0.4, 2, 0.4, "#B4ACA2", 0.9)}${brush([109, 84], [109, 76], [105, 68], 0.4, 2, 0.4, "#A39A90", 0.9)}`;
}

function sol(k: Kit): string {
  // Broadcasts from a radio mast: a cloud of curls, big over-ear headphones with a coiled lead and a
  // boom mic, and a mustard utility overshirt with a radio-wave patch and a screwdriver in the pocket.
  const H = "#2A1E1A";
  const shirt = k.linear([[0, "#E8A04A"], [0.6, "#D9822B"], [1, "#B5661C"]], 1, 0.3);
  const twill = k.pattern(4, 4, `<path d="M0 0 V4" stroke="#8A4A10" stroke-width="0.8" opacity="0.25"/>`, "rotate(35)");
  const curls: [number, number, number][] = [
    [46, 70, 13], [54, 54, 13], [68, 44, 13], [84, 41, 13], [99, 45, 13], [110, 56, 13], [116, 72, 12],
    [42, 86, 11], [118, 88, 11], [44, 102, 9], [116, 104, 9],
  ];
  const curl = ([x, y, r]: [number, number, number], i: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? H : "#33251F"}" stroke="#120C0A" stroke-width="1.2"/>${brush([x - r * 0.6, y - r * 0.2], [x - r * 0.3, y - r * 0.75], [x + r * 0.35, y - r * 0.7], 0.2, x < 80 ? 2.2 : 1.4, 0.2, "#6A5246", x < 80 ? 0.9 : 0.6)}`;
  const shirtD = vee(TORSO.man, 166);
  const cup = (x: number, f: 1 | -1) => `<rect x="${x - 8}" y="82" width="16" height="26" rx="7" fill="${k.linear([[0, "#4A4440"], [1, "#1A1614"]], 1, 0)}" stroke="#0C0A09" stroke-width="1.3"/>
<rect x="${x - 4 + 4 * f}" y="85" width="5" height="20" rx="2.5" fill="#5A524C"/>${brush([x - 5, 86], [x - 6, 95], [x - 5, 104], 0.3, 1.4, 0.3, "#8A827A", 0.8)}`;
  const fringe = "M50 84 C46 52 62 38 80 38 C98 38 114 52 110 84 C104 72 96 68 88 70 C84 64 76 64 72 70 C64 68 56 72 50 84 Z";
  return `${curls.map(curl).join("")}
<path fill="${H}" d="M48 64 C56 46 104 46 112 64 L114 100 L46 100 Z"/>
${k.cloth(shirtD, shirt, "#5A3008", "#7A3E08", twill)}
<path fill="#F4F0E8" d="M68 138 L80 166 L92 138 Z"/>
${k.neck(118, 144)}
<path fill="#F4F0E8" stroke="#A89C8A" stroke-width="1.2" d="M66 138 C72 146 88 146 94 138 L92 144 C86 150 74 150 68 144 Z"/>
<path fill="${shirt}" stroke="#5A3008" stroke-width="1.3" stroke-linejoin="round" d="M68 136 L60 152 L72 150 L80 166 Z M92 136 L100 152 L88 150 L80 166 Z"/>
<path fill="${shirt}" stroke="#5A3008" stroke-width="1.2" d="M32 160 L54 160 L54 182 L32 182 Z M106 160 L128 160 L128 182 L106 182 Z"/>
<path fill="#B5661C" stroke="#5A3008" stroke-width="1.1" d="M31 158 L55 158 L55 166 L31 166 Z M105 158 L129 158 L129 166 L105 166 Z"/>
<path fill="none" stroke="#F2C27A" stroke-width="0.7" stroke-dasharray="1.5 1.3" d="M33 168 L53 168 M107 168 L127 168"/>
<rect x="110" y="150" width="3" height="12" rx="1" fill="#C23A2E"/><rect x="110.6" y="146" width="1.8" height="5" fill="#C9CDD3"/>
<circle cx="43" cy="174" r="5" fill="#2B3346" stroke="#F2C27A" stroke-width="1"/><path d="M41 174 a2 2 0 0 1 4 0 M39.4 174 a3.6 3.6 0 0 1 7.2 0" fill="none" stroke="#F2C27A" stroke-width="0.8"/>
${k.face(FACE.oval, `<path fill="${k.s.shade}" opacity="0.8" transform="translate(1 5)" d="${fringe}"/>`)}
${k.blush(104, 0.6)}
${k.eyes(92, "#3A2A24", "adult", true)}
${k.brows(80, "#2A1D18", 2.8, [1.5, -2.5, 0.5], [0.5, -3.5, 0.5])}
${k.nose(92, "straight")}
${k.openMouth(118, 10, 8)}
${k.hair(fringe, H, "#120C0A", "#6A5246", [[[58, 72], [66, 64], [76, 64], 1.8], [[84, 63], [94, 64], [102, 72], 1.4]])}
<path fill="none" stroke="#1A1614" stroke-width="5" stroke-linecap="round" d="M46 88 C42 46 118 46 114 88"/>
${brush([48, 70], [56, 52], [72, 46], 0.3, 1.6, 0.3, "#8A827A", 0.8)}
${cup(46, -1)}${cup(114, 1)}
<path fill="none" stroke="#1A1614" stroke-width="2" stroke-linecap="round" d="M50 104 C52 114 60 120 70 120"/><circle cx="72" cy="120" r="3.6" fill="#2B2320" stroke="#0C0A09" stroke-width="0.8"/><circle cx="71" cy="119" r="1" fill="#8A827A"/>
<path fill="none" stroke="#1A1614" stroke-width="1.4" d="M114 108 C118 120 112 126 118 132 C124 138 116 144 122 150"/>`;
}

function ines(k: Kit): string {
  // Runs the clinic tent: a navy tunic with white piping, a stethoscope round her neck, an upside-down
  // fob watch, a pen; dark hair in a neat bun with loose curls; round tortoiseshell glasses; gold hoops.
  const H = "#2A1D18";
  const tunic = k.linear([[0, "#3A5C8A"], [0.6, "#2D4A73"], [1, "#203858"]], 1, 0.3);
  const tunicD = vee(TORSO.woman, 166);
  const hair = "M48 88 C44 56 60 42 80 42 C100 42 116 56 112 88 C110 74 104 64 94 60 C86 64 74 64 66 60 C56 64 50 74 48 88 Z";
  const bun = "M66 40 C64 26 96 26 94 40 C92 48 68 48 66 40 Z";
  const tortoise = k.pattern(6, 6, `<rect width="6" height="6" fill="#6B3A1F"/><circle cx="2" cy="2" r="1.4" fill="#A86A36"/><circle cx="4.5" cy="4.6" r="1" fill="#3A1E0E"/>`);
  return `${k.hair(bun, H, "#120C0A", "#6A5246", [[[70, 34], [80, 30], [90, 34], 1.6]])}
${k.cloth(tunicD, tunic, "#121E30", "#0E1828")}
<path fill="none" stroke="#F4F6F8" stroke-width="2" stroke-linejoin="round" d="M68 141 L80 166 L92 141"/>
<path fill="${k.s.base}" d="M68 140 L80 165 L92 140 Z"/>
${k.neck(118, 146)}
<path fill="${k.s.shade}" opacity="0.6" d="M68 140 L80 165 L76 146 Z"/>
<rect x="104" y="160" width="2.4" height="14" rx="1" fill="#2B3346"/><rect x="103.6" y="158" width="3.2" height="3" fill="#C9CDD3"/>
<path fill="none" stroke="#3E4652" stroke-width="2.6" stroke-linecap="round" d="M66 142 C58 156 56 172 62 182 M94 142 C102 156 104 170 98 178"/>
<path fill="none" stroke="#7A8290" stroke-width="0.8" d="M65 145 C58 158 57 172 62 181"/>
<circle cx="62" cy="184" r="4.5" fill="${k.linear([[0, "#E8ECF0"], [1, "#8A929C"]])}" stroke="#3E4652" stroke-width="1.2"/>
<path fill="none" stroke="#C9CDD3" stroke-width="1" d="M40 156 L40 162"/><circle cx="40" cy="166" r="4.4" fill="#F4F6F8" stroke="#8A929C" stroke-width="1.2"/><path d="M40 166 L40 168.6 M40 166 L41.8 165" stroke="#3E4652" stroke-width="0.7"/>
${k.ears(98, "#D4AE58")}
<circle cx="50" cy="111" r="3.4" fill="none" stroke="#D4AE58" stroke-width="1.1"/><circle cx="110" cy="111" r="3.4" fill="none" stroke="#B89440" stroke-width="1.1"/>
${k.face(FACE.oval, `<path fill="${k.s.shade}" opacity="0.8" transform="translate(1 5)" d="${hair}"/>`)}
${k.blush(105, 0.55)}
${k.eyes(93, "#3A2A24", "adult", true)}
${k.brows(80, H, 2.4, [1.5, -2.5, 0.5], [1.5, -2.5, 0.5])}
${k.nose(93, "straight")}
${k.closedMouth(120, 8, 2.5, "#9A4A42", 1.2, 2.2)}
${k.hair(hair, H, "#120C0A", "#6A5246", [[[58, 62], [68, 52], [80, 50], 2], [[84, 50], [98, 54], [104, 64], 1.6], [[56, 70], [52, 78], [52, 86], 1.2]])}
${brush([52, 82], [46, 92], [50, 102], 0.3, 1.6, 0.2, H)}${brush([108, 82], [114, 92], [110, 100], 0.3, 1.4, 0.2, H)}
<g fill="none" stroke="${tortoise}" stroke-width="2.4"><circle cx="67" cy="93" r="10"/><circle cx="93" cy="93" r="10"/></g>
<path fill="none" stroke="#6B3A1F" stroke-width="2" d="M77 91 Q80 88 83 91 M57 91 L50 89 M103 91 L110 89"/>
${brush([60, 88], [62, 85], [66, 84], 0.3, 1.4, 0.3, "#FFFFFF", 0.7)}${brush([86, 88], [88, 85], [92, 84], 0.3, 1.4, 0.3, "#FFFFFF", 0.7)}`;
}

function pip(k: Kit): string {
  // The young inventor: messy ginger hair, welding goggles pushed up, freckles, a pencil behind the ear,
  // and a hi-vis vest with reflective tape over a striped tee.
  const vest = k.linear([[0, "#F2FA7A"], [0.6, "#E2EE3A"], [1, "#B8C420"]], 1, 0.3);
  const mesh = k.pattern(3, 3, `<circle cx="1.5" cy="1.5" r="0.5" fill="#8A9410" opacity="0.4"/>`);
  const tee = k.pattern(6, 6, `<rect width="6" height="6" fill="#F4F0E8"/><rect width="6" height="2.4" fill="#2F3A4A"/>`);
  const vestD = vee(TORSO.man, 176);
  const tape = (y: number) => `<path fill="${k.linear([[0, "#E8ECEF"], [0.5, "#AEB6BE"], [1, "#DDE2E6"]], 1, 0)}" stroke="#7A828A" stroke-width="0.9" d="M14 ${y} L66 ${y} L68 ${y + 7} L12 ${y + 7} Z M146 ${y} L94 ${y} L92 ${y + 7} L148 ${y + 7} Z"/>`;
  const hair = "M48 86 C40 70 46 46 64 42 C66 34 76 32 84 38 C94 32 104 36 106 46 C118 52 120 72 112 86 C110 72 104 62 92 60 C86 66 74 66 66 60 C56 64 50 74 48 86 Z";
  const tufts = `${brush([62, 44], [56, 34], [50, 32], 2.4, 1.6, 0.2, "#C8642F")}${brush([82, 38], [86, 28], [94, 26], 2.4, 1.6, 0.2, "#C8642F")}${brush([104, 46], [112, 40], [118, 42], 2.2, 1.4, 0.2, "#B5561F")}`;
  return `${tufts}
<path fill="${tee}" d="M66 138 L80 176 L94 138 Z"/>
${k.cloth(vestD, vest, "#6A7010", "#8A9410", mesh, 0.5)}
${tape(158)}${tape(174)}
${[158, 174].map((y) => `${brush([18, y + 2], [40, y + 1.5], [64, y + 1.5], 0.3, 1.4, 0.3, "#FFFFFF", 0.85)}${brush([96, y + 1.5], [120, y + 1.5], [142, y + 2], 0.3, 1.2, 0.3, "#FFFFFF", 0.6)}`).join("")}
${k.neck(118, 144)}
<path fill="${tee}" stroke="#2F3A4A" stroke-width="1.2" d="M66 138 C72 146 88 146 94 138 L92 144 C86 150 74 150 68 144 Z"/>
${k.ears(96)}
<path fill="#F2C94C" stroke="#8A6A10" stroke-width="0.9" transform="rotate(-60 50 86)" d="M38 84 L60 84 L60 88 L38 88 Z"/><path fill="#F4D7B8" transform="rotate(-60 50 86)" d="M60 84 L65 86 L60 88 Z"/>
${k.face(FACE.oval, `<path fill="${k.s.shade}" opacity="0.8" transform="translate(1 5)" d="${hair}"/>`)}
${k.blush(105, 0.8)}
${[[60, 103], [64, 106], [67, 102], [93, 102], [96, 106], [100, 103], [78, 100], [82, 100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="#C27A4A" opacity="0.8"/>`).join("")}
${k.eyes(93, "#4E7A9A", "adult")}
${k.brows(81, "#A9532A", 2.6, [1, -2.5, 1], [0, -3.5, 0.5])}
${k.nose(93, "pointed")}
${k.openMouth(118, 10, 9, "#FFFDF8", true)}
${k.hair(hair, "#C8642F", "#8A3E18", "#F0A060", [[[58, 52], [66, 44], [76, 44], 2], [[88, 42], [98, 44], [104, 52], 1.6], [[52, 72], [52, 80], [50, 86], 1.2]])}
<path fill="none" stroke="#3A2A20" stroke-width="3" d="M48 72 C56 60 104 60 112 72"/>
${[66, 94].map((x) => `<circle cx="${x}" cy="64" r="9" fill="${k.linear([[0, "#F3D98A"], [1, "#9A7420"]], 1, 1)}" stroke="#5A4010" stroke-width="1.2"/><circle cx="${x}" cy="64" r="6" fill="${k.linear([[0, "#9BE0D8"], [1, "#2A6A70"]], 0.3, 1)}" stroke="#1A3A3E" stroke-width="0.8"/>${brush([x - 4, 62], [x - 2.5, 59.5], [x + 1, 59], 0.3, 1.4, 0.3, "#FFFFFF", 0.85)}`).join("")}
<rect x="74" y="62" width="12" height="4" rx="1.5" fill="#5A4010"/>`;
}

function pell(k: Kit): string {
  // The politician: a spray-tanned smile with too many teeth, a silver bouffant, a navy pinstripe suit, a
  // glossy striped tie, a pocket square and a huge rosette on the lapel. Lit by the corporations' cold rim.
  const suit = k.linear([[0, "#2E3A5A"], [0.6, "#1F2A44"], [1, "#141C30"]], 1, 0.3);
  const stripe = k.pattern(7, 7, `<path d="M3.5 0 V7" stroke="#8A96B4" stroke-width="0.6" opacity="0.55"/>`);
  const tie = k.pattern(6, 6, `<rect width="6" height="6" fill="#5A2A7A"/><rect width="6" height="2" fill="#D4AE58"/>`, "rotate(40)");
  const suitD = vee(TORSO.man, 180);
  const lapel = (f: 1 | -1) => {
    const x = (v: number) => 80 + (v - 80) * f;
    return `M${x(70)} 138 L${x(56)} 150 L${x(62)} 156 L${x(54)} 160 L80 180 Z`;
  };
  const hair = "M48 92 C40 56 60 34 84 34 C106 34 120 50 112 92 L109 92 C109 80 107 70 102 64 C96 58 90 58 84 54 C78 60 68 59 62 63 C56 69 52 80 51 92 Z";
  const rosette = (cx: number, cy: number) => {
    const petals = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return `<circle cx="${n1(cx + Math.cos(a) * 7)}" cy="${n1(cy + Math.sin(a) * 7)}" r="4" fill="${i % 2 ? "#6A3A8A" : "#7E4AA0"}"/>`;
    }).join("");
    return `<path fill="#6A3A8A" stroke="#2A1038" stroke-width="0.9" d="M${cx - 5} ${cy + 6} L${cx - 9} ${cy + 26} L${cx - 5} ${cy + 22} L${cx - 1} ${cy + 26} L${cx} ${cy + 6} Z M${cx + 1} ${cy + 6} L${cx + 3} ${cy + 27} L${cx + 6} ${cy + 22} L${cx + 10} ${cy + 26} L${cx + 6} ${cy + 6} Z"/>
<path fill="#D4AE58" d="M${cx - 3.2} ${cy + 8} L${cx - 6} ${cy + 22} L${cx - 4.4} ${cy + 20.6} Z M${cx + 3} ${cy + 8} L${cx + 5} ${cy + 22} L${cx + 6.4} ${cy + 20.6} Z"/>
<circle cx="${cx}" cy="${cy}" r="11" fill="#2A1038"/>${petals}<circle cx="${cx}" cy="${cy}" r="5.6" fill="${k.linear([[0, "#F6E3A0"], [1, "#B58A2E"]], 1, 1)}" stroke="#5A3A10" stroke-width="0.8"/><circle cx="${cx - 1.6}" cy="${cy - 1.8}" r="1.4" fill="#fff" opacity="0.8"/>`;
  };
  return `${k.cloth(suitD, suit, "#0A0E1A", "#060A14", stripe)}
<path fill="#F4F6F8" d="M68 138 L80 180 L92 138 Z"/>
${k.neck(118, 142)}
<path fill="#F4F6F8" stroke="#8A96A8" stroke-width="1.2" stroke-linejoin="round" d="M68 134 L64 148 L78 146 L80 150 Z M92 134 L96 148 L82 146 L80 150 Z"/>
<path fill="${tie}" stroke="#2A1038" stroke-width="1" stroke-linejoin="round" d="M76 146 L84 146 L82 152 L86 182 L80 190 L74 182 L78 152 Z"/>
${brush([79, 154], [77, 168], [78, 180], 0.3, 1.4, 0.3, "#FFFFFF", 0.5)}
<path fill="#0A0E1A" opacity="0.6" transform="translate(-1.5 2.5)" d="${lapel(1)}"/><path fill="#0A0E1A" opacity="0.7" transform="translate(-1.5 2.5)" d="${lapel(-1)}"/>
<path fill="${suit}" stroke="#0A0E1A" stroke-width="1.3" stroke-linejoin="round" d="${lapel(1)}"/><path fill="${suit}" stroke="#0A0E1A" stroke-width="1.3" stroke-linejoin="round" d="${lapel(-1)}"/>
${brush([60, 152], [70, 162], [79, 176], 0.3, 1.4, 0.3, COOL_RIM, 0.5)}
<path fill="#F4F6F8" stroke="#8A96A8" stroke-width="0.9" d="M108 170 L120 170 L118 166 L114 168 L111 165 Z"/>
${rosette(48, 162)}
${k.ears(96)}
${k.face(FACE.long, `<path fill="${k.s.shade}" opacity="0.8" transform="translate(1 5)" d="${hair}"/>`)}
${k.blush(106, 0.5)}
${k.eyes(92, "#5A7896", "sly")}
${k.brows(79, "#9AA0A6", 2.8, [1.5, -1, 0.5], [-1.5, -5, 0])}
${k.nose(92, "straight")}
${brush([66, 110], [62, 116], [65, 122], 0.2, 1.1, 0.2, k.s.deep, 0.6)}${brush([94, 110], [98, 116], [95, 122], 0.2, 1.1, 0.2, k.s.deep, 0.6)}
${k.openMouth(117, 13, 9, "#FFFFFF")}
<path fill="none" stroke="#E2E6EA" stroke-width="0.5" d="M74 117 V121 M78 117.6 V121.6 M82 117.6 V121.6 M86 117 V121"/>
${k.hair(hair, "#CDD1D7", "#868C95", "#FFFFFF", [
    [[84, 52], [72, 40], [56, 52], 2.4], [[86, 52], [98, 40], [110, 54], 2.4], [[80, 46], [64, 44], [54, 64], 1.4],
    [[64, 60], [56, 66], [53, 84], 1.6], [[90, 46], [106, 46], [110, 70], 1.6], [[100, 60], [108, 70], [109, 86], 1.2],
    [[74, 56], [64, 50], [56, 58], 1.2], [[94, 54], [104, 52], [108, 60], 1.2], [[58, 72], [54, 80], [52, 90], 1],
  ])}
${brush([84, 54], [86, 46], [84, 38], 0.4, 1.2, 0.2, "#8A9098", 0.7)}`;
}

function crisp(k: Kit): string {
  // Mr Crisp, who owns the prices: slicked black hair with a hard side parting, thick rectangular glasses,
  // a thin satisfied smile, a cheap-sheen grey suit, a red tie and a yellow price-tag pin; a camel overcoat
  // over the top. Cold rim light.
  const coat = k.linear([[0, "#D2A872"], [0.6, "#B98A50"], [1, "#8E6634"]], 1, 0.3);
  const suit = k.linear([[0, "#7A828E"], [0.45, "#5B6370"], [0.7, "#8A929E"], [1, "#4A515C"]], 1, 0);
  const coatD = vee(TORSO.man, 186);
  const suitV = "M56 144 L66 139 L80 176 L94 139 L104 144 L96 190 L64 190 Z";
  const lapel = (f: 1 | -1) => {
    const x = (v: number) => 80 + (v - 80) * f;
    return `M${x(66)} 139 L${x(60)} 150 L${x(66)} 154 L${x(62)} 158 L80 176 Z`;
  };
  const hair = "M48 86 C44 52 64 40 82 40 C102 40 116 52 112 84 C110 70 104 60 94 58 L68 60 L66 56 C58 62 52 72 48 86 Z";
  return `${k.cloth(coatD, coat, "#4A3010", "#3A2408")}
${brush([44, 148], [30, 160], [24, 190], 0.4, 2, 0.4, "#6A4A20", 0.6)}
${k.cloth(suitV, suit, "#1E2228", "#2A2E36", "", 0.4)}
<path fill="#E8EEF2" d="M68 139 L80 176 L92 139 Z"/>
<path fill="#0A0A0A" opacity="0.5" transform="translate(-1.5 2.5)" d="${lapel(1)}"/><path fill="#0A0A0A" opacity="0.6" transform="translate(-1.5 2.5)" d="${lapel(-1)}"/>
<path fill="${suit}" stroke="#1E2228" stroke-width="1.2" stroke-linejoin="round" d="${lapel(1)}"/><path fill="${suit}" stroke="#1E2228" stroke-width="1.2" stroke-linejoin="round" d="${lapel(-1)}"/>
${brush([62, 150], [70, 160], [78, 172], 0.3, 1.4, 0.3, "#E6EEF4", 0.55)}
${k.neck(118, 142)}
<path fill="#E8EEF2" stroke="#8A96A0" stroke-width="1.1" stroke-linejoin="round" d="M69 134 L66 146 L78 145 L80 149 Z M91 134 L94 146 L82 145 L80 149 Z"/>
<path fill="${k.linear([[0, "#E04A3A"], [1, "#9A2A1E"]], 1, 0)}" stroke="#5A1008" stroke-width="1" stroke-linejoin="round" d="M76.5 145 L83.5 145 L82 150 L84.5 172 L80 178 L75.5 172 L78 150 Z"/>
<g transform="translate(100 160) rotate(-18)"><path fill="#F2D23C" stroke="#7A5A08" stroke-width="0.9" d="M-7 -4 L5 -4 L9 0 L5 4 L-7 4 Z"/><circle cx="4.6" cy="0" r="1" fill="#7A5A08"/><path d="M-5 -1.2 H2 M-5 1.2 H0" stroke="#C23A2E" stroke-width="1"/></g>
${k.ears(96)}
${k.face(FACE.square, `<path fill="${k.s.shade}" opacity="0.8" transform="translate(1 5)" d="${hair}"/>`)}
${k.blush(105, 0.35)}
${k.eyes(93, "#3A3A3A", "sly", false, 13)}
${k.brows(81, "#1E1A1A", 2.6, [-1, -1, 1.5], [-1, -1, 1.5])}
${k.nose(93, "straight")}
${k.closedMouth(121, 9, 0.5, "", 0, 0, -2)}
${k.hair(hair, "#1E1A1A", "#0A0808", "#6A6A72", [[[70, 56], [86, 48], [104, 54], 2.6], [[74, 58], [90, 52], [106, 60], 1.6], [[64, 60], [56, 70], [52, 80], 1.4]])}
${brush([66, 58], [67, 50], [70, 44], 0.3, 1.2, 0.2, "#F0E0D0", 0.6)}
<g fill="none" stroke="#141414" stroke-width="2.6" stroke-linejoin="round"><rect x="55" y="85" width="22" height="15" rx="2"/><rect x="83" y="85" width="22" height="15" rx="2"/><path d="M77 90 L83 90 M55 89 L49 87 M105 89 L111 87"/></g>
${brush([58, 96], [62, 89], [68, 87], 0.3, 1.4, 0.3, "#FFFFFF", 0.6)}${brush([86, 96], [90, 89], [96, 87], 0.3, 1.4, 0.3, "#FFFFFF", 0.6)}`;
}

function vane(k: Kit): string {
  // Dr Octavia Vane of the wellness division (docs/design/hedgerow-v2.md section 4: elegant, never
  // technically lies): a sleek platinum chignon with a deep side part, rimless glasses, diamond studs,
  // subtle rose lipstick and a composed half-smile; a black mock-neck under a tailored white coat with the
  // glowing teal Candor clinic badge. Over-lit and clinical, with the cold rim.
  const coat = k.linear([[0, "#FFFFFF"], [0.6, "#EEF2F6"], [1, "#C9D2DC"]], 1, 0.3);
  const coatD = vee(TORSO.woman, 184);
  const lapel = (f: 1 | -1) => {
    const x = (v: number) => 80 + (v - 80) * f;
    return `M${x(68)} 140 L${x(55)} 152 L${x(61)} 157 L${x(53)} 161 L80 184 Z`;
  };
  const top =
    "M50 92 C44 56 60 36 84 36 C104 36 118 52 110 92 C108 78 106 70 101 64 C97 59 93 56 92 51 C84 60 70 62 60 69 C55 75 52 83 50 92 Z";
  const bun = "M104 100 C108 90 124 92 124 106 C124 118 110 122 104 114 Z";
  return `${k.hair(bun, "#D6DBE4", "#8E95A1", "#FFFFFF", [[[108, 98], [116, 96], [121, 104], 1.6], [[106, 108], [114, 112], [121, 110], 1.4]])}
${k.cloth(coatD, coat, "#6A7888", "#9AA8B8", "", 0.5)}
<path fill="#16181C" d="M68 140 L80 184 L92 140 Z"/>
${k.neck(118, 142)}
<path fill="${k.linear([[0, "#2A2E36"], [0.6, "#16181C"], [1, "#0A0B0D"]], 1, 0)}" stroke="#000000" stroke-width="1.2" d="M69 126 C74 131 86 131 91 126 L93 142 C86 147 74 147 67 142 Z"/>
${brush([71, 129], [71, 136], [70, 142], 0.3, 1.3, 0.3, "#5A6270", 0.8)}
<path fill="#8A98A8" opacity="0.5" transform="translate(-1.5 2.5)" d="${lapel(1)}"/><path fill="#6A7888" opacity="0.6" transform="translate(-1.5 2.5)" d="${lapel(-1)}"/>
<path fill="${coat}" stroke="#6A7888" stroke-width="1.3" stroke-linejoin="round" d="${lapel(1)}"/><path fill="${coat}" stroke="#6A7888" stroke-width="1.3" stroke-linejoin="round" d="${lapel(-1)}"/>
${brush([58, 152], [68, 164], [78, 180], 0.3, 1.3, 0.3, COOL_RIM, 0.7)}
<path fill="none" stroke="#9AA8B8" stroke-width="1" d="M106 168 L124 168"/><rect x="110" y="158" width="2.4" height="11" rx="1" fill="#C9D2DC" stroke="#6A7888" stroke-width="0.6"/>
<circle cx="46" cy="168" r="9" fill="#3EE0D0" opacity="0.18"/>
<circle cx="46" cy="168" r="7" fill="#0E2A2E"/><circle cx="46" cy="168" r="5.6" fill="none" stroke="#3EE0D0" stroke-width="1.4"/><path d="M46 164.4 V171.6 M42.4 168 H49.6" stroke="#9AFFF4" stroke-width="1.6"/>
${k.ears(96, "#F8FBFF")}
${brush([46.5, 105.4], [48.5, 106.2], [50.5, 105.4], 0.2, 0.8, 0.2, "#FFFFFF")}${brush([104.5, 105.4], [106.5, 106.2], [108.5, 105.4], 0.2, 0.8, 0.2, "#FFFFFF")}
${k.face(FACE.oval, `<path fill="${k.s.shade}" opacity="0.7" transform="translate(1 4)" d="${top}"/>`)}
${k.blush(106, 0.35)}
${k.eyes(93, "#5A6B8A", "cool", true)}
${k.brows(81, "#9CA3AE", 1.9, [1.5, -3, 0.5], [0.5, -4, 0.5])}
${k.nose(93, "pointed")}
${k.closedMouth(121, 8, 1.2, "#B4596A", 1.3, 2.4, -0.7)}
${k.hair(top, "#DDE2EA", "#9198A4", "#FFFFFF", [
    [[92, 52], [70, 56], [54, 80], 2.4], [[90, 48], [66, 50], [52, 70], 1.8], [[94, 54], [80, 62], [60, 70], 1.4],
    [[92, 46], [102, 46], [108, 64], 1.8], [[96, 52], [104, 58], [108, 78], 1.2], [[88, 42], [72, 42], [58, 54], 1.2],
  ])}
${brush([92, 51], [91, 44], [88, 38], 0.4, 1, 0.2, "#8E95A1", 0.7)}
<g fill="none" stroke="#B8C2CE" stroke-width="1" opacity="0.9"><rect x="56" y="86" width="21" height="14" rx="5"/><rect x="83" y="86" width="21" height="14" rx="5"/></g>
<path fill="none" stroke="#8A96A4" stroke-width="1.2" d="M77 91 L83 91 M56 90 L50 88 M104 90 L108 88"/>
${brush([59, 97], [61, 90], [66, 88], 0.3, 1.2, 0.3, "#FFFFFF", 0.8)}${brush([86, 97], [88, 90], [93, 88], 0.3, 1.2, 0.3, "#FFFFFF", 0.8)}`;
}

function narrator(): string {
  return `<circle cx="80" cy="95" r="70" fill="#6E625A" stroke="${INK}" stroke-width="3"/>
<circle cx="80" cy="95" r="58" fill="#F4EDE1"/>
<circle cx="80" cy="70" r="16" fill="#F2C94C"/>
<path d="M30 110 Q80 84 130 110 V130 Q80 150 30 130Z" fill="#7FA35A"/>
${[42, 58, 74, 90, 106, 120].map((x, i) => `<circle cx="${x}" cy="${112 - (i % 2) * 6}" r="10" fill="${i % 2 ? "#5E8F41" : "#4F7F37"}" stroke="${INK}" stroke-width="1.5"/>`).join("")}
<path d="M48 136 h64" stroke="#9A7246" stroke-width="6" stroke-linecap="round"/>`;
}

const PEOPLE: Record<Exclude<CastMember, "narrator">, { skin: string; corporate?: boolean; draw: (k: Kit) => string }> = {
  mara: { skin: "#E8C2A6", draw: mara },
  bea: { skin: "#F7DCCB", draw: bea },
  tomas: { skin: "#D9A882", draw: tomas },
  sol: { skin: "#B7835F", draw: sol },
  ines: { skin: "#A8754F", draw: ines },
  pip: { skin: "#F3D0B5", draw: pip },
  pell: { skin: "#F0C29E", corporate: true, draw: pell },
  crisp: { skin: "#EFD3BE", corporate: true, draw: crisp },
  vane: { skin: "#F1D9CB", corporate: true, draw: vane },
};

export function castSvg(who: CastMember): string {
  let body: string;
  let defs = "";
  if (who === "narrator") {
    body = narrator();
  } else {
    const p = PEOPLE[who];
    const k = new Kit(skinOf(p.skin), p.corporate ? COOL_RIM : WARM_RIM);
    body = p.draw(k);
    defs = `<defs>${k.defs.join("")}</defs>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 190" aria-hidden="true" focusable="false" class="cast cast-${who}">${defs}${body}</svg>`;
}
