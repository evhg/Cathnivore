// C14 (docs/design/cathode-combat.md S9.6): the loading screen as a case file. The district's establishing frame
// behind (public/keyart/<id>.webp, rendered from the game by scripts/cathode-keyart.mjs, then duotoned, halftoned,
// grained and pushed in by CSS), the next name in the left column with Cath's lines about them, an ink bleed along
// the rule under the name, an eased percentage (never more than 4% a frame), and The List in the corner with any
// name dealt with since it was last seen striking through. No control tips. `PRESS ANY KEY` only after a load
// that took longer than 2.5 s.

import { easeLoad, type LoadingCard } from "./frontcopy";
import { el } from "./dom";

const SEEN_KEY = "cathode.listSeen";

/** How many names were struck the last time the list was shown (null on a first visit). */
export function listSeen(): number | undefined {
  try {
    const v = localStorage.getItem(SEEN_KEY);
    return v === null ? undefined : Number(v) || 0;
  } catch {
    return undefined;
  }
}

export interface LoadingView {
  /** The real share loaded, 0..1 (the shown figure eases toward it). */
  set(share: number): void;
  /** Resolves once the shown figure reaches 100%, then waits for a key if the load was long (and `ask`). */
  finish(ask: boolean): Promise<void>;
  close(): void;
  /** The shown percentage, frame by frame (screenshot runs check the 4% rule against it). */
  readonly trace: number[];
}

export function openLoading(root: HTMLElement, card: LoadingCard, o: { still: boolean; held?: number } = { still: false }): LoadingView {
  root.dataset.district = card.district;
  root.dataset.motif = card.motif;
  root.classList.toggle("is-still", o.still);
  root.replaceChildren();
  const art = el("div", "ld-art", root);
  art.setAttribute("aria-hidden", "true");
  el("div", "ld-img", art);
  el("div", "ld-tone", art);
  el("div", "ld-dots", art);
  el("div", "ld-grain", art);

  const file = el("div", "ld-file", root);
  // S9.6: the halftone plate of the next name, their rig under a top light (scripts/cathode-portraits.mjs).
  if (card.job) {
    const plate = el("figure", "ld-plate", file);
    plate.dataset.job = card.job;
    plate.setAttribute("aria-hidden", "true");
    el("div", "ld-plate-img", plate);
    el("div", "ld-plate-dots", plate);
    const n = ["crispBoss", "vaneBoss", "pellBoss", "boardBoss", "vaultBoss"].indexOf(card.job) + 1;
    el("figcaption", "ld-plate-tag", plate, `Subject ${String(n).padStart(2, "0")}`);
  }
  el("p", "ld-place", file, card.place);
  el("h2", "ld-name", file, card.name);
  const meter = el("div", "ld-meter", file);
  const rule = el("div", "ld-rule", meter);
  const ink = el("span", "ld-ink", rule);
  el("span", "ld-trace", rule);
  const pct = el("p", "ld-pct", meter, "0%");
  el("p", "ld-lore", file, `“${card.lore}”`);

  const corner = el("div", "ld-corner", root);
  el("p", "ld-list-h", corner, "The List");
  const ol = el("ol", "ld-list", corner);
  for (const r of card.list) {
    const li = el("li", r.done ? (r.fresh ? "is-done is-fresh" : "is-done") : r.next ? "is-next" : "", ol, r.name);
    if (r.done) li.setAttribute("aria-label", `${r.name}, dealt with`);
  }
  if (card.sealed) el("li", "is-more", ol, `${card.sealed} more ${card.sealed === 1 ? "name" : "names"}`);
  const ready = el("p", "ld-ready", root, "Press any key");
  ready.hidden = true;

  // Fresh strikes draw after a beat, so the eye is on the list when they land.
  if (card.list.some((r) => r.fresh)) setTimeout(() => root.classList.add("is-striking"), o.still ? 0 : 900);
  try {
    localStorage.setItem(SEEN_KEY, String(card.list.filter((r) => r.done).length));
  } catch {
    // Private mode: every load strikes nothing new.
  }

  const t0 = performance.now();
  let target = 0;
  let shown = 0;
  let raf = 0;
  let closed = false;
  const trace: number[] = [];
  const waiters: Array<() => void> = [];
  const draw = () => {
    ink.style.setProperty("--p", `${(shown * 100).toFixed(2)}%`);
    pct.textContent = `${Math.round(shown * 100)}%`;
  };
  const tick = () => {
    if (closed) return;
    shown = easeLoad(shown, target);
    trace.push(Math.round(shown * 1000) / 10);
    draw();
    if (shown >= 1) while (waiters.length) waiters.shift()!();
    raf = requestAnimationFrame(tick);
  };
  if (o.held !== undefined) {
    // A screenshot stage: the figure held where the stage asks.
    target = shown = o.held;
    draw();
  } else raf = requestAnimationFrame(tick);
  root.hidden = false;

  return {
    trace,
    set(share) {
      target = Math.max(target, Math.min(1, share));
    },
    async finish(ask) {
      target = 1;
      if (shown < 1) await new Promise<void>((r) => waiters.push(r));
      if (!ask || performance.now() - t0 < 2500) return;
      ready.hidden = false;
      root.classList.add("is-ready");
      await new Promise<void>((resolve) => {
        const go = () => {
          removeEventListener("keydown", go, true);
          removeEventListener("pointerdown", go, true);
          resolve();
        };
        addEventListener("keydown", go, true);
        addEventListener("pointerdown", go, true);
      });
    },
    close() {
      closed = true;
      cancelAnimationFrame(raf);
      root.hidden = true;
      root.classList.remove("is-ready", "is-striking");
    },
  };
}
