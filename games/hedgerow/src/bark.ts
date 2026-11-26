// Plan item 713: Cath speaks during a round. A short line with her portrait in a corner of the field when something
// happens that she would react to: a leak, a boss, a run of knocks (a combo), her Pie or her Rally. At most one line
// every 8 s, so she reacts rather than chatters. Pure: which line, whether it may speak now, and which corner.

import type { Box } from "./intro";

export type BarkKind = "leak" | "boss" | "combo" | "pie" | "rally" | "neighbours";
export type BarkFace = "smirk" | "delighted" | "determined" | "worried" | "wink";

/** Seconds between two of her lines. */
export const BARK_GAP = 8;
/** How long a line stays up, in seconds. */
export const BARK_SHOW = 2.6;
/** A combo: this many knocks within `COMBO_WINDOW` seconds. */
export const COMBO_KNOCKS = 5;
export const COMBO_WINDOW = 1.5;

const LINES: Record<BarkKind, { face: BarkFace; lines: readonly string[] }> = {
  leak: { face: "worried", lines: ["One's through! Tighten up.", "That one got past us.", "Mind the end of the lane!", "Not on my doorstep."] },
  boss: { face: "determined", lines: ["Here comes the big one.", "Hold steady. That's their boss.", "Right. Everything on that one."] },
  combo: { face: "delighted", lines: ["Look at them go!", "Beautiful. Keep it coming.", "That's how we do it here.", "Lovely work, all of you."] },
  pie: { face: "wink", lines: ["Fresh from the oven!", "Mind, it's hot.", "Have a slice of that."] },
  rally: { face: "delighted", lines: ["Come on, all of you!", "Everyone, now! Faster!", "Show them what we've got!"] },
  neighbours: { face: "determined", lines: ["Thank you, neighbours!", "Hold that lane for me!"] },
};

/** Her line and face for a moment; `n` picks among the lines so the same moment doesn't repeat itself. */
export function barkLine(kind: BarkKind, n: number): { text: string; face: BarkFace } {
  const set = LINES[kind];
  return { text: set.lines[((n % set.lines.length) + set.lines.length) % set.lines.length]!, face: set.face };
}

/** Rate limit and combo counter. Times in seconds of game time (or any clock that only moves forward). */
export class BarkGate {
  private last = -Infinity;
  private knocks: number[] = [];
  private said: Partial<Record<BarkKind, number>> = {};
  /** Whether she may speak now; when she may, it counts as spoken and returns the line. */
  speak(kind: BarkKind, now: number): { text: string; face: BarkFace } | null {
    if (now - this.last < BARK_GAP) return null;
    this.last = now;
    const n = this.said[kind] ?? 0;
    this.said[kind] = n + 1;
    return barkLine(kind, n);
  }
  /** A knock (a kill); true once when the knocks inside the window first reach a combo. */
  knock(now: number): boolean {
    this.knocks = this.knocks.filter((t) => now - t <= COMBO_WINDOW);
    this.knocks.push(now);
    if (this.knocks.length >= COMBO_KNOCKS) {
      this.knocks = [];
      return true;
    }
    return false;
  }
  reset(): void {
    this.last = -Infinity;
    this.knocks = [];
  }
}

const overlap = (a: Box, b: Box): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

export type BarkCorner = "tl" | "tr" | "bl" | "br";

/**
 * The corner of the field for her line (`field` is the field's box, every box in the same coordinates). `hard` boxes
 * (the seed rack, Go, the gate plates, banners) must stay clear: any corner off them beats any on them. Then the
 * fewest `lane` pixels, then the fewest `soft` ones (towers, plots), then the top corners before the bottom ones.
 * Within a corner the line slides along its edge, then along the side (8 steps each, up to half the field), to find a
 * spot clearer still.
 */
export function barkCorner(
  field: Box,
  size: { w: number; h: number },
  lane: readonly Box[],
  hard: readonly Box[],
  soft: readonly Box[] = [],
  inset = 8,
): Box & { corner: BarkCorner } {
  const w = Math.min(size.w, field.w - inset * 2);
  const h = Math.min(size.h, field.h - inset * 2);
  let best: (Box & { corner: BarkCorner }) | null = null;
  let bestScore = Infinity;
  const corners: BarkCorner[] = ["tl", "tr", "bl", "br"];
  corners.forEach((corner, ci) => {
    const right = corner[1] === "r";
    const bottom = corner[0] === "b";
    for (let step = 0; step <= 16; step++) {
      // Slide along the top or bottom edge toward the middle (steps 0-8), then down or up the side (9-16).
      const along = step <= 8 ? (step / 8) * Math.max(0, field.w / 2 - w) : 0;
      const down = step > 8 ? ((step - 8) / 8) * Math.max(0, field.h / 2 - h) : 0;
      const x = right ? field.x + field.w - inset - w - along : field.x + inset + along;
      const y = bottom ? field.y + field.h - inset - h - down : field.y + inset + down;
      const box = { x, y, w, h };
      let hardA = 0;
      for (const b of hard) hardA += overlap(box, b);
      let laneA = 0;
      for (const b of lane) laneA += overlap(box, b);
      let softA = 0;
      for (const b of soft) softA += overlap(box, b);
      const score = (hardA > 0 ? 1e12 + hardA * 1e6 : 0) + laneA * 1000 + softA + ci * 0.1 + step * 0.01;
      if (score < bestScore) {
        bestScore = score;
        best = { ...box, corner };
      }
    }
  });
  return best!;
}
