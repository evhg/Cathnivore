// Plan item 529: Hollowell's fleet gets faces. Each vehicle on the lane has a driver: a caricature in Hollowell's
// uniform (the orange-and-navy livery, the H on the chest), smug, with the prop of their job (the courier's headset,
// the influencer's ring light, the lawyer's tie), and a one-line slogan in Hollowell's voice. Pure: an SVG string per
// kind, drawn from a small spec, so the field guide, the Almanac and the briefing rows can share it.

import { ENEMIES, type EnemyKind } from "./engine";

type Prop = "cap" | "headset" | "ringlight" | "shades" | "hardhat" | "tie" | "pilot" | "earpiece" | "visor" | "crown";
type Hair = "short" | "bun" | "quiff" | "bald" | "long" | "slick";

interface Driver {
  prop: Prop;
  hair: Hair;
  /** skin, from a small set of tones */
  skin: 0 | 1 | 2 | 3;
  /** hair colour */
  ink: 0 | 1 | 2 | 3;
  slogan: string;
}

const SKIN = ["#f2c9a5", "#d9a27c", "#a86e4a", "#6e452c"] as const;
const HAIR = ["#2a1d16", "#6b4a2c", "#c9a15a", "#8a8a8a"] as const;
/** Hollowell's livery: the navy jacket, the orange collar and badge (the depot and lane tags' colours). */
const NAVY = "#24314f";
const ORANGE = "#e8743a";
const INK = "#1d1a16";

const DRIVERS: Partial<Record<EnemyKind, Driver>> = {
  van: { prop: "cap", hair: "short", skin: 1, ink: 0, slogan: "Your parcel, our postcode." },
  courier: { prop: "headset", hair: "bun", skin: 2, ink: 0, slogan: "Left with a neighbour. Any neighbour." },
  hatchback: { prop: "shades", hair: "quiff", skin: 0, ink: 1, slogan: "Running late, running everyone over." },
  pickup: { prop: "cap", hair: "long", skin: 3, ink: 0, slogan: "Tougher than your hedge." },
  sprinter: { prop: "headset", hair: "slick", skin: 0, ink: 2, slogan: "Same day. Same lane. Same smile." },
  lorry: { prop: "cap", hair: "bald", skin: 2, ink: 3, slogan: "Big box, small print." },
  quad: { prop: "visor", hair: "short", skin: 1, ink: 1, slogan: "Over the hedge, under the radar." },
  drone: { prop: "visor", hair: "bun", skin: 0, ink: 0, slogan: "Eyes in the sky, prices on the ground." },
  wrapped: { prop: "cap", hair: "quiff", skin: 3, ink: 0, slogan: "Fragile? Not us." },
  steel: { prop: "hardhat", hair: "short", skin: 1, ink: 3, slogan: "Plated, protected, unstoppable." },
  artic: { prop: "cap", hair: "slick", skin: 2, ink: 1, slogan: "Forty tonnes of convenience." },
  influencer: { prop: "ringlight", hair: "long", skin: 0, ink: 2, slogan: "Like, share, pave over." },
  lawyer: { prop: "tie", hair: "slick", skin: 1, ink: 0, slogan: "Read the small print. We wrote it." },
  lobbyist: { prop: "tie", hair: "quiff", skin: 0, ink: 3, slogan: "A quiet word in the right ear." },
  director: { prop: "earpiece", hair: "slick", skin: 2, ink: 3, slogan: "Synergy, delivered." },
  board: { prop: "crown", hair: "bald", skin: 0, ink: 3, slogan: "The board has decided." },
  execcar: { prop: "shades", hair: "slick", skin: 3, ink: 0, slogan: "Fast lane. Our lane." },
  bulldozer: { prop: "hardhat", hair: "short", skin: 2, ink: 0, slogan: "Progress, in reverse." },
  plantdozer: { prop: "hardhat", hair: "bald", skin: 1, ink: 3, slogan: "Clearing the way for value." },
  megadozer: { prop: "hardhat", hair: "short", skin: 3, ink: 0, slogan: "Bigger is better. We checked." },
  blimp: { prop: "pilot", hair: "quiff", skin: 0, ink: 1, slogan: "Advertising, at altitude." },
  boss: { prop: "crown", hair: "slick", skin: 0, ink: 0, slogan: "Under new ownership." },
  transporter: { prop: "cap", hair: "short", skin: 3, ink: 1, slogan: "Eight cars, one road, no room for you." },
  skip: { prop: "hardhat", hair: "long", skin: 1, ink: 2, slogan: "Your old life, collected weekly." },
  crane: { prop: "hardhat", hair: "slick", skin: 2, ink: 3, slogan: "Lifting standards. And your roof." },
  borer: { prop: "hardhat", hair: "bald", skin: 3, ink: 3, slogan: "Going under. You, not us." },
  truck: { prop: "cap", hair: "quiff", skin: 1, ink: 2, slogan: "Everything 99p. Except the cost." },
  convoy: { prop: "tie", hair: "slick", skin: 0, ink: 1, slogan: "Crisp prices. Crisper margins." },
  phantom: { prop: "shades", hair: "short", skin: 2, ink: 0, slogan: "No logo. No liability." },
  tender: { prop: "visor", hair: "quiff", skin: 1, ink: 3, slogan: "Fast to tender, slow to pay." },
  ship: { prop: "pilot", hair: "bald", skin: 2, ink: 3, slogan: "Imported cheaper. Your harvest included." },
  carrier: { prop: "earpiece", hair: "short", skin: 3, ink: 0, slogan: "Launching a dozen opportunities." },
  rival: { prop: "shades", hair: "slick", skin: 0, ink: 0, slogan: "Pell's personal touch." },
  swarm: { prop: "tie", hair: "bun", skin: 2, ink: 0, slogan: "Billed by the minute, all at once." },
  bus: { prop: "earpiece", hair: "quiff", skin: 1, ink: 2, slogan: "Vote Pell. Pave Hollowell." },
  hollowcandor: { prop: "crown", hair: "slick", skin: 1, ink: 3, slogan: "Two brands, one grip." },
  candor: { prop: "earpiece", hair: "long", skin: 3, ink: 1, slogan: "Honest about nothing." },
  remnant: { prop: "tie", hair: "bald", skin: 0, ink: 3, slogan: "What's left of the deal." },
  clinic: { prop: "headset", hair: "bun", skin: 1, ink: 1, slogan: "Wellness, boxed and billed." },
};

/** Category fallbacks for the rest of the fleet: fliers have pilots, heavy plant hard hats, suits for the rest. */
function driverFor(kind: EnemyKind): Driver {
  const d = DRIVERS[kind];
  if (d) return d;
  const e = ENEMIES[kind];
  const seed = [...kind].reduce((a, c) => a + c.charCodeAt(0), 0);
  const skin = (seed % 4) as Driver["skin"];
  const ink = ((seed >> 2) % 4) as Driver["ink"];
  if (e.flying) return { prop: "pilot", hair: "short", skin, ink, slogan: "Coming in to land. On your land." };
  if (e.hp >= 1000) return { prop: "hardhat", hair: "bald", skin, ink, slogan: "Nothing personal. Just business." };
  if (e.speed >= 1.5) return { prop: "headset", hair: "quiff", skin, ink, slogan: "Faster than you can say no." };
  return { prop: "cap", hair: (["short", "bun", "long", "slick"] as const)[seed % 4]!, skin, ink, slogan: "Hollowell. Here to help." };
}

export function driverSlogan(kind: EnemyKind): string {
  return driverFor(kind).slogan;
}

function hair(h: Hair, c: string): string {
  switch (h) {
    case "short": return `<path d="M20 25 Q22 13 32 13 Q42 13 44 25 Q40 19 32 19 Q24 19 20 25Z" fill="${c}"/>`;
    case "bun": return `<circle cx="32" cy="11" r="5" fill="${c}"/><path d="M20 26 Q21 14 32 14 Q43 14 44 26 Q41 18 32 18 Q23 18 20 26Z" fill="${c}"/>`;
    case "quiff": return `<path d="M20 26 Q19 12 30 10 Q40 8 45 16 Q38 14 36 18 Q30 16 24 21Z" fill="${c}"/>`;
    case "long": return `<path d="M19 40 Q15 16 32 13 Q49 16 45 40 L42 40 Q43 22 32 19 Q21 22 22 40Z" fill="${c}"/>`;
    case "slick": return `<path d="M20 24 Q22 13 33 13 Q44 14 44 24 Q36 16 22 24Z" fill="${c}"/><path d="M25 18 Q33 14 41 18" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.2" fill="none"/>`;
    default: return "";
  }
}

function prop(p: Prop): string {
  switch (p) {
    case "cap": return `<path d="M19 22 Q20 11 32 11 Q44 11 45 22Z" fill="${ORANGE}" stroke="${INK}" stroke-width="1.4"/><path d="M40 21 Q50 21 52 24 L40 24Z" fill="${NAVY}" stroke="${INK}" stroke-width="1.4"/><text x="32" y="20" font-size="7" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">H</text>`;
    case "headset": return `<path d="M19 28 Q19 12 32 12 Q45 12 45 28" fill="none" stroke="${INK}" stroke-width="2.2"/><rect x="16" y="26" width="5" height="8" rx="2" fill="${ORANGE}" stroke="${INK}" stroke-width="1.2"/><path d="M19 33 Q22 41 29 40" fill="none" stroke="${INK}" stroke-width="1.6"/><circle cx="29.5" cy="40" r="1.6" fill="${INK}"/>`;
    case "ringlight": return `<circle cx="51" cy="13" r="8" fill="none" stroke="#fff6c2" stroke-width="3"/><circle cx="51" cy="13" r="8" fill="none" stroke="${INK}" stroke-width=".8"/><rect x="49" y="21" width="4" height="10" rx="1" fill="${INK}"/><rect x="45" y="30" width="9" height="13" rx="2" fill="${INK}"/><rect x="46.5" y="31.5" width="6" height="9" rx="1" fill="#9fd8ff"/>`;
    case "shades": return `<path d="M22 28 H42 L41 32 Q37 34 34 31 H30 Q27 34 23 32Z" fill="${INK}"/><path d="M24 29 L27 29" stroke="#ffffff" stroke-opacity=".6" stroke-width="1"/>`;
    case "hardhat": return `<path d="M18 23 Q18 10 32 10 Q46 10 46 23Z" fill="#f2c230" stroke="${INK}" stroke-width="1.4"/><rect x="15" y="22" width="34" height="3.5" rx="1.5" fill="#f2c230" stroke="${INK}" stroke-width="1.4"/><path d="M32 10 V22" stroke="${INK}" stroke-width="1.2"/>`;
    case "tie": return `<path d="M30 49 L34 49 L35.5 62 L32 64 L28.5 62Z" fill="${ORANGE}" stroke="${INK}" stroke-width="1.1"/>`;
    case "pilot": return `<path d="M19 24 Q19 11 32 11 Q45 11 45 24Z" fill="#6b4a2c" stroke="${INK}" stroke-width="1.4"/><rect x="21" y="18" width="9" height="6" rx="2.5" fill="#9fd8ff" stroke="${INK}" stroke-width="1.2"/><rect x="34" y="18" width="9" height="6" rx="2.5" fill="#9fd8ff" stroke="${INK}" stroke-width="1.2"/>`;
    case "earpiece": return `<path d="M44 29 Q47 30 46 35 Q45 40 40 44" fill="none" stroke="${INK}" stroke-width="1.3"/><circle cx="44.5" cy="30" r="1.8" fill="${INK}"/>`;
    case "visor": return `<path d="M20 25 H44 Q44 31 32 31 Q20 31 20 25Z" fill="#7fd0ff" fill-opacity=".85" stroke="${INK}" stroke-width="1.3"/>`;
    case "crown": return `<path d="M22 15 L25 6 L29 12 L32 4 L35 12 L39 6 L42 15Z" fill="#f2c230" stroke="${INK}" stroke-width="1.3"/>`;
    default: return "";
  }
}

/**
 * The driver's portrait, a 64-unit square: shoulders in Hollowell's navy with the orange collar and H badge, the head
 * with its hair and the job's prop, a smug half-smile and one raised brow (the corporate grin).
 */
export function driverFace(kind: EnemyKind): string {
  const d = driverFor(kind);
  const skin = SKIN[d.skin];
  const ink = HAIR[d.ink];
  const top = d.prop === "cap" || d.prop === "hardhat" || d.prop === "pilot" || d.prop === "crown" ? "" : hair(d.hair, ink);
  return (
    `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="driver-face" data-kind="${kind}" data-prop="${d.prop}" aria-hidden="true">` +
    // shoulders: the navy jacket, orange collar, the H badge
    `<path d="M8 64 Q10 47 32 45 Q54 47 56 64Z" fill="${NAVY}" stroke="${INK}" stroke-width="1.5"/>` +
    `<path d="M24 46 L32 54 L40 46" fill="none" stroke="${ORANGE}" stroke-width="3.2" stroke-linejoin="round"/>` +
    `<circle cx="45" cy="55" r="3.6" fill="${ORANGE}" stroke="${INK}" stroke-width="1"/><text x="45" y="57.4" font-size="5.4" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">H</text>` +
    // neck and head
    `<rect x="28" y="38" width="8" height="9" fill="${skin}" stroke="${INK}" stroke-width="1.2"/>` +
    `<ellipse cx="32" cy="29" rx="12" ry="13" fill="${skin}" stroke="${INK}" stroke-width="1.5"/>` +
    top +
    // the corporate grin: one brow up, eyes narrowed, a lopsided smile
    `<path d="M24.5 25 Q27 23 29.5 24.5" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M34.5 23 Q37 20.5 40 22.5" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M25 29 Q27 27.6 29 29" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M35 29 Q37 27.6 39 29" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M27 35 Q32 38.5 38 34" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<circle cx="24" cy="33" r="1.8" fill="#e88a7a" fill-opacity=".45"/><circle cx="40" cy="33" r="1.8" fill="#e88a7a" fill-opacity=".45"/>` +
    prop(d.prop) +
    `</svg>`
  );
}
