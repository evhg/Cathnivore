// Plan item 17: the visit's ledger for the morning-after debrief. One visit runs from a district's load to its case
// closing; a restart from a checkpoint rebuilds the session but stays the same visit (it counts as a restart), so
// the ledger lives here, outside the session. The stills are JPEG frames grabbed just after the best kills.

import { bestStills, emptyLedger, type DebriefLedger } from "../sim/debrief";

export interface VisitStill {
  score: number;
  src: string;
  caption: string;
}

export interface Visit {
  district: string;
  ledger: DebriefLedger;
  stills: VisitStill[];
  xp0: number;
  scrip0: number;
  /** The debrief has been shown for this visit's case. */
  shown: boolean;
}

let visit: Visit | null = null;

/** The visit for a session starting in `district`: the same one on a restart there, else a fresh ledger. */
export function beginVisit(district: string, restart: boolean, c: { xp: number; scrip: number }, maxHp: number): Visit {
  if (restart && visit && visit.district === district) {
    visit.ledger.restarts++;
    return visit;
  }
  visit = { district, ledger: emptyLedger(maxHp), stills: [], xp0: c.xp, scrip0: c.scrip, shown: false };
  return visit;
}

/** Keeps a still if it ranks in the best three so far. */
export function keepStill(v: Visit, s: VisitStill): void {
  v.stills = bestStills([...v.stills, s], 3);
}

/** Whether a kill of this score would make the best three (so the frame is worth grabbing). */
export function wantsStill(v: Visit, score: number): boolean {
  return v.stills.length < 3 || v.stills.some((s) => s.score < score);
}

/** Grabs the canvas into a small JPEG (call right after the frame is drawn, in the same task). */
export function grabFrame(canvas: HTMLCanvasElement, w = 360): string | null {
  const cw = canvas.width;
  const ch = canvas.height;
  if (!cw || !ch) return null;
  const c = document.createElement("canvas");
  // A 4:3 crop from the middle of the frame: the kill is under the crosshair.
  const h = Math.round((w * 3) / 4);
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return null;
  const sh = Math.min(ch, (cw * 3) / 4);
  const sw = (sh * 4) / 3;
  try {
    g.drawImage(canvas, (cw - sw) / 2, (ch - sh) / 2, sw, sh, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}
