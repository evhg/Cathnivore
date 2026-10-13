/** Deterministic SVG sigils for skill nodes: the same skill id always draws the same mark, and ids differ. */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Base frames, drawn in a 24-unit box centred on 12,12. */
const FRAMES: readonly string[] = [
  "M12 3 21 12 12 21 3 12Z",
  "M12 3 20 8v8l-8 5-8-5V8Z",
  "M12 3.5 21 20H3Z",
  "M5 5h14v14H5Z",
  "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  "M4 12 12 4l8 8-8 8Z M8 12l4-4 4 4-4 4Z",
  "M3 9 12 3l9 6v6l-9 6-9-6Z",
  "M6 4h12l3 8-3 8H6l-3-8Z",
];

const pt = (n: number): number => 5 + (n % 5) * 3.5;

/** SVG markup (no wrapper element's size) for a skill id. */
export function skillSigil(id: string): string {
  const r = rng(hash(id));
  const frame = FRAMES[Math.floor(r() * FRAMES.length)]!;
  const strokes: string[] = [];
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x1 = pt(Math.floor(r() * 5));
    const y1 = pt(Math.floor(r() * 5));
    const x2 = pt(Math.floor(r() * 5));
    const y2 = pt(Math.floor(r() * 5));
    if (x1 === x2 && y1 === y2) continue;
    strokes.push(`M${x1} ${y1}L${x2} ${y2}`);
  }
  const dots: string[] = [];
  const d = 1 + Math.floor(r() * 3);
  for (let i = 0; i < d; i++) dots.push(`<circle cx="${pt(Math.floor(r() * 5))}" cy="${pt(Math.floor(r() * 5))}" r="1.1"/>`);
  const rot = Math.floor(r() * 4) * 90;
  return (
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">` +
    `<g transform="rotate(${rot} 12 12)"><path d="${frame}" opacity=".55"/></g>` +
    `<path d="${strokes.join("")}"/>` +
    `<g fill="currentColor" stroke="none">${dots.join("")}</g></svg>`
  );
}
