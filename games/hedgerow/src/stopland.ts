// Plan item 230: the journey map's country changes as you win. Round a won stop the land is coloured in (a field in
// crop, a hedge, a stook and a figure at work); round a stop not yet won Hollowell has its clutter (grey flats, a
// delivery van on the verge, a fenced "coming soon" plot). The next stop keeps the plain act ground. Pure: map.ts
// puts the SVG behind each stop's coin.

export type LandState = "won" | "next" | "held";

/** A stop's land state from its stars and whether it's the next stop. */
export function landState(stars: number, isNext: boolean): LandState {
  if (stars > 0) return "won";
  return isNext ? "next" : "held";
}

const CROPS = [
  { field: "#9cc45a", rows: "#6f9a38", hi: "#c8e08a" },
  { field: "#e3c45e", rows: "#b8962e", hi: "#f2dc8c" },
  { field: "#7fb862", rows: "#4f8a3c", hi: "#b4d98e" },
  { field: "#d9a65a", rows: "#a8772e", hi: "#ecc68a" },
];

/** The coloured-in land round a won stop: a field in crop with rows, a hedge on its far side, a stook and a figure. */
function wonLand(id: number): string {
  const c = CROPS[id % CROPS.length]!;
  const left = id % 2 === 0;
  let rows = "";
  for (let k = 0; k < 5; k++) {
    const y = 58 + k * 6;
    rows += `<path d="M${20 + k * 2} ${y}L${140 - k * 2} ${y - 4}" stroke="${c.rows}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
  }
  const fx = left ? 34 : 128;
  return (
    `<path d="M8 52Q80 40 152 50L158 92Q80 100 4 90Z" fill="${c.field}"/>` +
    `<path d="M8 52Q80 40 152 50" stroke="${c.hi}" stroke-width="3" fill="none" opacity=".8"/>` +
    rows +
    // the hedge along the far edge
    `<path d="M6 50Q80 36 154 48" stroke="#4f7a3c" stroke-width="7" stroke-dasharray="0 8" stroke-linecap="round" fill="none"/>` +
    // a stook
    `<path d="M${left ? 128 : 30} 80l6 -16l6 16z" fill="#e8c86a" stroke="#8a6a2e" stroke-width="1.2"/>` +
    // a figure at work: a hat, a shirt, a hoe
    `<g transform="translate(${fx} 66)"><ellipse cx="0" cy="18" rx="7" ry="2" fill="#2a2a1a" opacity=".25"/><path d="M-3 8h6l1 9h-8z" fill="#3f6fb5"/><circle cx="0" cy="5" r="3" fill="#f0c9a0"/><path d="M-5 3h10l-2 -3h-6z" fill="#d9b25a"/><path d="M4 9l7 9" stroke="#6e5236" stroke-width="1.4"/></g>`
  );
}

/** Hollowell's clutter round a stop not yet won: one of grey flats, a van on the verge, or a fenced plot. */
function heldLand(id: number): string {
  const kind = id % 3;
  if (kind === 0) {
    // grey flats
    let win = "";
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) win += `<rect x="${104 + k * 9}" y="${44 + r * 11}" width="5" height="6" fill="#c9d2da"/>`;
    return (
      `<ellipse cx="124" cy="86" rx="30" ry="5" fill="#2a2a24" opacity=".2"/>` +
      `<rect x="98" y="36" width="40" height="50" fill="#8a9098" stroke="#5a6068" stroke-width="1.5"/>` +
      `<rect x="98" y="36" width="40" height="5" fill="#ff7a1a"/>` +
      win
    );
  }
  if (kind === 1) {
    // a Hollowell van parked on the verge
    return (
      `<ellipse cx="36" cy="84" rx="26" ry="4" fill="#2a2a24" opacity=".22"/>` +
      `<path d="M14 62h30v18h-30z" fill="#f4f1ea" stroke="#3a3a3a" stroke-width="1.4"/>` +
      `<path d="M44 66h9l5 7v7h-14z" fill="#f4f1ea" stroke="#3a3a3a" stroke-width="1.4"/>` +
      `<path d="M14 70h30" stroke="#ff7a1a" stroke-width="4"/>` +
      `<path d="M46 68h6l3 5h-9z" fill="#9fc2d6"/>` +
      `<circle cx="22" cy="81" r="4" fill="#2a2a2a"/><circle cx="48" cy="81" r="4" fill="#2a2a2a"/>`
    );
  }
  // a fenced "coming soon" plot
  let posts = "";
  for (let k = 0; k < 6; k++) posts += `<path d="M${100 + k * 9} 66v18" stroke="#9a9a96" stroke-width="1.6"/>`;
  return (
    `<path d="M96 70h52v16h-52z" fill="#b3aa94" opacity=".7"/>` +
    posts +
    `<path d="M98 70h50M98 78h50" stroke="#9a9a96" stroke-width="1"/>` +
    `<path d="M120 46v24" stroke="#5a5a5a" stroke-width="1.6"/>` +
    `<rect x="104" y="40" width="34" height="14" rx="1.5" fill="#1e2b34"/>` +
    `<rect x="104" y="51" width="34" height="3" fill="#ff7a1a"/>` +
    `<path d="M108 45h22M108 48h16" stroke="#f4fbfb" stroke-width="1.4"/>`
  );
}

/** The SVG behind a stop's coin, in a 160x100 box; empty for the next stop. */
export function stopLandSvg(id: number, state: LandState): string {
  if (state === "next") return "";
  // Plan item 273: Hollowell's clutter stands up and out of the name row under the coin (a van ran into 'Going Live'):
  // lifted 16 units and pushed 8 outward, toward its own side.
  // Plan item 314: and out past the coin's rim, so a grey block or a billboard never stands against the medallion
  // (24 units outward; the svg lets it run past its box).
  const art =
    state === "won" ? wonLand(id) : `<g class="held" transform="translate(${id % 3 === 1 ? -24 : 24} -16)">${heldLand(id)}</g>`;
  return `<svg viewBox="0 0 160 100" aria-hidden="true" focusable="false" overflow="visible">${art}</svg>`;
}
