// Plan item 157: Hollowell's depot at each gate. A glossy plastic shed with a roller door and the brand stripe, a
// departures board with the next round's count, and the rep on the balcony: smug by default, gleeful when something
// got through last round, rattled when the round went clean. Pure picture and placement; main.ts positions it.

export type RepMood = "smug" | "gleeful" | "rattled";

const INK = "#2b2320";
/** The depot's picture in a 100 x 100 box, its door facing down (towards the lane). */
export function depotSvg(): string {
  const ribs = Array.from({ length: 6 }, (_, i) => `<path d="M30 ${62 + i * 5}h40" stroke="#9aa3ad" stroke-width="1.2"/>`).join("");
  return (
    `<svg viewBox="0 0 100 100" aria-hidden="true">` +
    `<ellipse cx="50" cy="96" rx="46" ry="4" fill="rgba(0,0,0,0.22)"/>` +
    // body: glossy grey-white plastic with a single highlight, no outline (STYLE.md: the enemies are glossy)
    `<rect x="6" y="30" width="88" height="64" rx="6" fill="#e9edf1"/>` +
    `<rect x="10" y="33" width="80" height="6" rx="3" fill="#ffffff" opacity="0.8"/>` +
    // roof and brand stripe
    `<path d="M2 32 50 10l48 22z" fill="#d7dde3"/>` +
    `<rect x="6" y="42" width="88" height="10" fill="#ef7a2a"/>` +
    `<text x="50" y="50" text-anchor="middle" font-size="7.2" font-weight="800" fill="#fff" font-family="sans-serif" letter-spacing="1">HOLLOWELL</text>` +
    // roller door
    `<rect x="28" y="58" width="44" height="36" fill="#2a2f36"/>` +
    `<g class="depot-door"><rect x="28" y="58" width="44" height="36" rx="2" fill="#c9d0d7"/>${ribs}</g>` +
    // departures board on the left wall
    `<rect x="9" y="56" width="17" height="22" rx="2" fill="#1d2228"/>` +
    // balcony rail on the right
    `<path d="M74 58h18" stroke="#9aa3ad" stroke-width="2"/>` +
    `</svg>`
  );
}

/** The rep on the balcony (a small figure in a suit with an orange tie), in a 24 x 30 box. */
export function repSvg(mood: RepMood): string {
  const mouth =
    mood === "gleeful" ? `<path d="M9 12q3 4 6 0" fill="${INK}"/>` : mood === "rattled" ? `<path d="M9 13.5q3-3 6 0" fill="none" stroke="${INK}" stroke-width="1.2"/>` : `<path d="M9 12.5q3 1.6 6-0.8" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
  const brows = mood === "rattled" ? `<path d="M8 6.5l3 1M16 6.5l-3 1" stroke="${INK}" stroke-width="1"/>` : `<path d="M8 7l3-1M16 7l-3-1" stroke="${INK}" stroke-width="1"/>`;
  const arm = mood === "gleeful" ? `<path d="M18 19l4-7" stroke="#3a4250" stroke-width="3" stroke-linecap="round"/>` : "";
  return (
    `<svg viewBox="0 0 24 30" aria-hidden="true">` +
    `<path d="M4 30v-9q8-5 16 0v9z" fill="#3a4250"/>${arm}` +
    `<path d="M11.2 20h1.6l1 6-1.8 2-1.8-2z" fill="#ef7a2a"/>` +
    `<circle cx="12" cy="10" r="6" fill="#f0c8a4"/>` +
    `<path d="M6 8q6-7 12 0" fill="#5a4636"/>${brows}` +
    `<circle cx="9.6" cy="9.6" r="0.9" fill="${INK}"/><circle cx="14.4" cy="9.6" r="0.9" fill="${INK}"/>${mouth}` +
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

/** The rep's mood once a round is over: gleeful if anything got through it, rattled if it went clean. */
export function repMood(leaksAtStart: number, leaksAtEnd: number): RepMood {
  return leaksAtEnd > leaksAtStart ? "gleeful" : "rattled";
}
