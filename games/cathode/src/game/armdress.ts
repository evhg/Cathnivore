// Plan item 26: what Cath wears on her arms in first person comes from her wardrobe save, so the hands on the
// gun are hers. The coat slot picks the sleeve (and its turned-back cuff); the gloves slot picks the glove,
// or bare hands with painted nails when the slot is empty; her fine gold bracelet sits on the firing wrist and
// the pearl strand on the support wrist in every outfit. The colours are the hero model's (render/frontcath.ts)
// where the two share a part: her skin and the charcoal trench.

import type { Finish } from "./gunkit";

/** The hero model's shared colours (item 9): the title's 3D Cath and the first-person arms read as one woman. */
export const CATH_HERO = {
  /** Her skin under the street's light (frontcath's `skinMat`). */
  skin: 0xd9ad98,
  /** The charcoal gabardine trench. */
  trench: 0x1d1f25,
} as const;

/** The sleeve for each coat base (and none: her blouse sleeve). */
export type SleeveId = "trench" | "duster" | "armouredMac" | "silkLinedCoat" | "blouse";
/** The glove for each gloves base (and none: bare hands). */
export type GloveId = "leather" | "knuckle" | "wired" | "bare";

export interface ArmDress {
  sleeve: SleeveId;
  glove: GloveId;
  /** The sleeve's cloth (upper arm, forearm and the turned-back cuff). */
  sleeveFin: Finish;
  /** The cuff's button. */
  buttonFin: Finish;
  /** The glove's leather, or her skin on bare hands. */
  handFin: Finish;
  /** The glove's stitching (bare hands: none drawn). */
  seamFin: Finish;
  /** Knuckle gloves: brass studs over the knuckles. Wired gloves: copper traces down the back of the hand. */
  trim: Finish | null;
  /** Painted nails on bare fingertips (fingerless knuckle gloves show them too). */
  nails: Finish | null;
  /** The digits from this far along (m) are bare skin: knuckle gloves are cut off at the first joint. */
  bareFrom: number | null;
}

const SLEEVES: Record<SleeveId, { sleeve: Finish; button: Finish }> = {
  trench: {
    sleeve: { color: CATH_HERO.trench, metal: 0, rough: 0.86, sheen: 0.06, band: "nylon", wear: 0 },
    button: { color: 0x16171a, metal: 0.2, rough: 0.35, coat: 1 },
  },
  // Oxblood-brown hide, oiled: it takes the light in long creases. Sheen held at 0.2 so the glove-blood shader
  // (leather picked by sheen above 0.2) leaves the sleeve alone.
  duster: {
    sleeve: { color: 0x2c1a14, metal: 0, rough: 0.5, sheen: 0.2, coat: 0.15, band: "leather", scale: 2, wear: 0.3 },
    button: { color: 0x8a6a3a, metal: 1, rough: 0.35, wear: 0.6 },
  },
  // Her olive field jacket (VISION's signature look), waxed against the rain over its plates.
  armouredMac: {
    sleeve: { color: 0x2f3324, metal: 0, rough: 0.62, sheen: 0.12, coat: 0.2, band: "nylon", wear: 0.1 },
    button: { color: 0x1c1d18, metal: 0.4, rough: 0.4 },
  },
  // Midnight wool, the burgundy silk lining shows at the turned-back cuff (the cuff band takes `lining`).
  silkLinedCoat: {
    sleeve: { color: 0x171b2b, metal: 0, rough: 0.8, sheen: 0.14, band: "grain", wear: 0 },
    button: { color: 0xc9a25a, metal: 1, rough: 0.25, wear: 0 },
  },
  // No coat: the cream silk blouse sleeve on its own.
  blouse: {
    sleeve: { color: 0xbfb4a0, metal: 0, rough: 0.6, sheen: 0.18, band: "grain", wear: 0 },
    button: { color: 0xf4efe6, metal: 0.05, rough: 0.18, coat: 1, wear: 0 },
  },
};

/**
 * Her skin in first person: the hero's tone a step down in albedo, because the viewmodel's own soft key sits
 * close to her hands (at the hero's value the shot read chalk-white under it; the takedown rig does the same).
 */
export const VIEW_SKIN = 0xb4826c;
const SKIN: Finish = { color: VIEW_SKIN, metal: 0, rough: 0.5, sheen: 0.12, band: "flat", wear: 0 };
/** Oxblood lacquer: the one red she wears, the same family as the game's accent. */
const NAILS: Finish = { color: 0x6a0f1c, metal: 0, rough: 0.16, coat: 1, band: "flat", wear: 0 };
const LEATHER: Finish = { color: 0x141214, metal: 0, rough: 0.45, sheen: 0.4, coat: 0.12, band: "leather", scale: 3, wear: 0.2 };
const SEAM: Finish = { color: 0x1d1a18, metal: 0, rough: 0.48, sheen: 0.25, band: "leather", wear: 0 };

/** Which sleeve a coat base wears. Unknown bases (future coats) fall back to the trench. */
export function sleeveFor(base: string | undefined): SleeveId {
  if (!base) return "blouse";
  return base === "duster" || base === "armouredMac" || base === "silkLinedCoat" || base === "trench" ? base : "trench";
}

/** Which glove a gloves base wears. Unknown bases fall back to black leather. */
export function gloveFor(base: string | undefined): GloveId {
  if (!base) return "bare";
  return base === "knuckleGloves" ? "knuckle" : base === "wiredGloves" ? "wired" : "leather";
}

/** The arms' dress for an equipment set (the wardrobe save). */
export function armDress(eq: { coat?: { base: string }; gloves?: { base: string } } | null | undefined): ArmDress {
  const sleeve = sleeveFor(eq?.coat?.base);
  const glove = gloveFor(eq?.gloves?.base);
  const s = SLEEVES[sleeve];
  const bare = glove === "bare";
  return {
    sleeve,
    glove,
    sleeveFin: s.sleeve,
    buttonFin: s.button,
    handFin: bare ? SKIN : LEATHER,
    seamFin: SEAM,
    trim:
      glove === "knuckle"
        ? { color: 0xb08a48, metal: 1, rough: 0.3, wear: 0.8 }
        : glove === "wired"
          ? { color: 0xb5643a, metal: 1, rough: 0.28, wear: 0.4 }
          : null,
    nails: bare || glove === "knuckle" ? NAILS : null,
    bareFrom: glove === "knuckle" ? 0.03 : null,
  };
}

/** Bare skin, for the parts of a fingerless glove past the cut. */
export const ARM_SKIN = SKIN;
/** A key that changes when the arms must be rebuilt. */
export const dressKey = (d: ArmDress): string => `${d.sleeve}/${d.glove}`;

/** Her starting outfit (the charcoal trench and black leather gloves): arms built before a save is read wear it. */
export const DEFAULT_DRESS: ArmDress = armDress({ coat: { base: "trench" }, gloves: { base: "leatherGloves" } });
