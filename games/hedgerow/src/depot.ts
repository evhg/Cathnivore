// Plan item 157: Hollowell's depot at each gate. A glossy plastic shed with a roller door and the brand stripe, a
// departures board with the next round's count, and the rep on the balcony: smug by default, gleeful when something
// got through last round, rattled when the round went clean. Pure picture and placement; main.ts positions it.

export type RepMood = "smug" | "gleeful" | "rattled";

const INK = "#2b2320";
/** The depot's picture in a 100 x 100 box, its door facing down (towards the lane). */
export function depotSvg(): string {
  const ribs = Array.from({ length: 6 }, (_, i) => `<path d="M30 ${62 + i * 5}h40" stroke="#9aa3ad" stroke-width="1.2"/>`).join("");
  // Plan item 295: a glossy megastore, not a shed: a lit white-and-chrome front under an orange canopy with a lit
  // logo, glass windows either side of the shutter, a chrome plinth. Door and board keep their boxes (main.ts and the
  // CSS place the count and roll the shutter by them).
  return (
    `<svg viewBox="0 0 100 100" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="dp-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e6ebf0"/><stop offset="1" stop-color="#c3ccd5"/></linearGradient>` +
    `<linearGradient id="dp-canopy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb066"/><stop offset=".5" stop-color="#ef7a2a"/><stop offset="1" stop-color="#c85a14"/></linearGradient>` +
    `<linearGradient id="dp-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe6ff"/><stop offset=".5" stop-color="#5f9fc8"/><stop offset="1" stop-color="#2f5f80"/></linearGradient>` +
    `<linearGradient id="dp-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset=".5" stop-color="#9aa6b2"/><stop offset="1" stop-color="#dfe5ea"/></linearGradient>` +
    `</defs>` +
    `<ellipse cx="50" cy="96" rx="47" ry="4" fill="rgba(0,0,0,0.3)"/>` +
    // the block, lit from above, on a chrome plinth
    `<rect x="5" y="22" width="90" height="72" rx="3" fill="url(#dp-wall)"/>` +
    `<rect x="4" y="90" width="92" height="5" rx="1.5" fill="url(#dp-chrome)"/>` +
    // a flat roof's chrome cornice with a hard sheen
    `<rect x="3" y="18" width="94" height="6" rx="1.5" fill="url(#dp-chrome)"/>` +
    `<rect x="5" y="19" width="90" height="1.4" fill="#ffffff" opacity=".9"/>` +
    // Plan item 336: the LED departures board built into the front, between cornice and canopy (main.ts lays the
    // count over it; it used to sit over the sign and the shutter), and two floodlights on the cornice lighting the front.
    `<rect x="9" y="25" width="82" height="12" rx="1.5" fill="#0d1116" stroke="url(#dp-chrome)" stroke-width="1.4"/>` +
    `<rect x="11" y="26.5" width="78" height="9" rx="1" fill="#1a1208"/>` +
    `<path d="M8 18l-4 -5h8z M92 18l-4 -5h8z" fill="#3a4148"/>` +
    `<circle cx="8" cy="13.5" r="2.2" fill="#fff4cf"/><circle cx="92" cy="13.5" r="2.2" fill="#fff4cf"/>` +
    `<path class="depot-flood" d="M8 15L1 40H22Z M92 15L78 40H99Z" fill="#fff4cf" opacity=".16"/>` +
    // Plan items 160/281: the brand on the canopy at 14 units, now lit: a glow behind the letters.
    `<rect x="4" y="38" width="92" height="19" rx="2" fill="url(#dp-canopy)"/>` +
    `<rect x="6" y="39.2" width="88" height="2.2" rx="1" fill="#ffffff" opacity=".55"/>` +
    `<text x="40" y="53.2" text-anchor="middle" font-size="14" font-weight="800" fill="#fff6d6" stroke="#ffd59a" stroke-width="2.4" stroke-opacity=".45" paint-order="stroke" font-family="'Hedgerow UI', system-ui, sans-serif" letter-spacing="0.6" textLength="66" lengthAdjust="spacingAndGlyphs">HOLLOWELL</text>` +
    // glass shop windows either side of the shutter, with a diagonal glare
    `<rect x="74" y="60" width="18" height="26" rx="1" fill="url(#dp-glass)" stroke="#c3ccd5" stroke-width="1.2"/>` +
    `<path d="M76 84 90 62" stroke="#ffffff" stroke-width="2" opacity=".45"/>` +
    // the roller shutter in a chrome frame
    `<rect x="26.5" y="57" width="47" height="37" rx="1.5" fill="url(#dp-chrome)"/>` +
    `<rect x="28" y="58" width="44" height="36" fill="#1a1f25"/>` +
    `<rect x="31" y="80" width="38" height="14" fill="#ffd27a" opacity=".35"/>` +
    `<g class="depot-door"><rect x="28" y="58" width="44" height="36" rx="2" fill="#c9d0d7"/>${ribs}</g>` +
    // a second shop window on the left (the count moved up to the LED board)
    `<rect x="8" y="60" width="18" height="26" rx="1" fill="url(#dp-glass)" stroke="#c3ccd5" stroke-width="1.2"/>` +
    `<path d="M10 84 24 62" stroke="#ffffff" stroke-width="2" opacity=".45"/>` +
    // balcony rail on the right, chrome
    `<path d="M74 58h18" stroke="#c3ccd5" stroke-width="2"/>` +
    `</svg>`
  );
}

/** The rep on the balcony (a small figure in a suit with an orange tie), in a 24 x 30 box. */
export function repSvg(mood: RepMood, hatch = false): string {
  const mouth =
    mood === "gleeful" ? `<path d="M9 12q3 4 6 0" fill="${INK}"/>` : mood === "rattled" ? `<path d="M9 13.5q3-3 6 0" fill="none" stroke="${INK}" stroke-width="1.2"/>` : `<path d="M9 12.5q3 1.6 6-0.8" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
  const brows = mood === "rattled" ? `<path d="M8 6.5l3 1M16 6.5l-3 1" stroke="${INK}" stroke-width="1"/>` : `<path d="M8 7l3-1M16 7l-3-1" stroke="${INK}" stroke-width="1"/>`;
  const arm = mood === "gleeful" ? `<path d="M18 19l4-7" stroke="#3a4250" stroke-width="3" stroke-linecap="round"/>` : "";
  return (
    `<svg viewBox="0 0 24 30" aria-hidden="true">` +
    // Plan item 228: in 3D he leans out of a roof hatch, its lid up behind him and its rim across his waist,
    // so he reads as a man on the roof rather than a bust floating on it.
    (hatch ? `<path d="M2.5 25l2.5-11h14l2.5 11z" fill="#4b525d"/><path d="M5.6 15.5h12.8" stroke="#7b8490" stroke-width="0.8"/>` : "") +
    `<path d="M4 30v-9q8-5 16 0v9z" fill="#3a4250"/>${arm}` +
    `<path d="M11.2 20h1.6l1 6-1.8 2-1.8-2z" fill="#ef7a2a"/>` +
    `<circle cx="12" cy="10" r="6" fill="#f0c8a4"/>` +
    `<path d="M6 8q6-7 12 0" fill="#5a4636"/>${brows}` +
    `<circle cx="9.6" cy="9.6" r="0.9" fill="${INK}"/><circle cx="14.4" cy="9.6" r="0.9" fill="${INK}"/>${mouth}` +
    (hatch ? `<rect x="1" y="24" width="22" height="6" rx="1" fill="#6b7380"/><path d="M1.6 24.7h20.8" stroke="#a3acb6" stroke-width="0.9"/><path d="M1 28.6h22" stroke="#4b525d" stroke-width="0.8"/>` : "") +
    `</svg>`
  );
}

export type Side = "left" | "right" | "top" | "bottom";
/** Which field edge a lane enters from, by its first cell. */
export function entrySide(start: readonly [number, number], cols: number, rows: number): Side[] {
  const [c, r] = start;
  const out: Side[] = [];
  if (c <= 0) out.push("left");
  if (c >= cols - 1) out.push("right");
  if (r <= 0) out.push("top");
  if (r >= rows - 1) out.push("bottom");
  return out;
}

/** The other field edges within two cells of a gate (not those it enters from): a fallback home for its depot. */
export function nearSides(start: readonly [number, number], cols: number, rows: number): Side[] {
  const [c, r] = start;
  const enter = entrySide(start, cols, rows);
  const near: Side[] = [];
  if (c <= 2) near.push("left");
  if (c >= cols - 3) near.push("right");
  if (r <= 2) near.push("top");
  if (r >= rows - 3) near.push("bottom");
  return near.filter((s) => !enter.includes(s));
}

/** The rep's mood once a round is over: gleeful if anything got through it, rattled if it went clean. */
export function repMood(leaksAtStart: number, leaksAtEnd: number): RepMood {
  return leaksAtEnd > leaksAtStart ? "gleeful" : "rattled";
}
