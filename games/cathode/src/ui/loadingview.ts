import { bustForBanner, mugshotSvg } from "./busts";
// C14 (docs/design/cathode-combat.md S9.6): the loading screen as a case file. The district's establishing frame
// behind (public/keyart/<id>.webp, rendered from the game by scripts/cathode-keyart.mjs, then duotoned, halftoned,
// grained and pushed in by CSS), the next name in the left column with Cath's lines about them, an ink bleed along
// the rule under the name, an eased percentage (never more than 4% a frame), and The List in the corner with any
// name dealt with since it was last seen striking through. No control tips. `PRESS ANY KEY` only after a load
// that took longer than 2.5 s.

import { easeLoad, type LoadingCard } from "./frontcopy";
import { el, svg } from "./dom";

/** Plan item 629: where the survey sheet's red string runs in each district, [x, z] in metres: in from the way she
 * arrives, out to the place the next name keeps (the last named room of the district; the market office for act 1). */
const ROUTE: Record<string, { from: [number, number]; to: [number, number] | null }> = {
  market: { from: [0, 52], to: [0, -48] },
  clinic: { from: [-6, 15], to: [0, -46] },
  plaza: { from: [0, 48], to: [0, -36] },
  tower: { from: [0, 36], to: [0, -52] },
  vault: { from: [0, 44], to: [0, -48] },
};

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
  // No portrait plate (DECISIONS 2026-10-21): the bosses share one helmeted Enforcer rig, so a plate showed the
  // same trooper for a clinic doctor and a fixer. The name is the picture: typeset at fs-6 over the key art.
  el("p", "ld-place", file, card.place);
  el("h2", "ld-name", file, card.name);
  const meter = el("div", "ld-meter", file);
  const rule = el("div", "ld-rule", meter);
  const ink = el("span", "ld-ink", rule);
  el("span", "ld-trace", rule);
  const pct = el("p", "ld-pct", meter, "0%");
  el("p", "ld-lore", file, `“${card.lore}”`);
  // Plan item 629: the briefing pinned over the frame. The next name's surveillance still, the district's survey
  // sheet (drawn by the map's own plan, a moment later: districtmap is loaded with the session), and Cath's
  // photograph from the title's street (front-poster, the 3D render, not the 2D bust). A red string runs from the
  // still through the route on the sheet to her photograph, and draws itself as the load runs.
  const board = el("div", "ld-board", root);
  board.setAttribute("aria-hidden", "true");
  const next = card.list.find((r) => r.next)?.name;
  const still = el("figure", "ld-still", board);
  still.innerHTML = mugshotSvg(next ? bustForBanner(next) ?? (/mind/i.test(next) ? "mind" : null) : null, next ? next.split(" ").pop()!.toUpperCase() : "CLOSED");
  el("figcaption", "", still, next ?? "The List");
  el("i", "ld-pin", still);
  const sheet = el("div", "ld-map", board);
  el("i", "ld-pin", sheet);
  const print = el("figure", "ld-print", board);
  el("div", "ld-photo", print);
  el("figcaption", "", print, "Cath");
  el("i", "ld-pin", print);
  const strings = svg("svg", { class: "ld-string" }, board);
  const shadow = svg("path", { class: "ld-string-shade", pathLength: 1 }, strings);
  const thread = svg("path", { class: "ld-string-red", pathLength: 1 }, strings);
  let spots: { at: SVGGraphicsElement | null; goal: SVGGraphicsElement | null } = { at: null, goal: null };
  const centre = (e: Element | null, pin = false): [number, number] | null => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    if (!r.width || getComputedStyle(pin ? e.parentElement! : e).display === "none") return null;
    return [r.left + r.width / 2 - o.left, r.top + r.height / 2 - o.top];
  };
  const restring = () => {
    const pts = [centre(still.querySelector(".ld-pin"), true), centre(spots.goal), centre(spots.at), centre(print.querySelector(".ld-pin"), true)].filter((p): p is [number, number] => !!p);
    // Slack: each run sags a little below the straight line, like a string pinned at both ends.
    let d = "";
    pts.forEach(([x, y], i) => {
      if (!i) d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
      else {
        const [px, py] = pts[i - 1]!;
        const sag = Math.hypot(x - px, y - py) * 0.07;
        d += ` Q${((px + x) / 2).toFixed(1)} ${((py + y) / 2 + sag).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });
    thread.setAttribute("d", d);
    shadow.setAttribute("d", d);
  };
  const district = card.district;
  // The office is home: no route to survey (its plan is one room), so the string runs from the still to her.
  if (district === "office") sheet.remove();
  else void import("./districtmap")
    .then(({ drawPlan }) => {
      if (closed) return;
      const r = ROUTE[district] ?? ROUTE.market!;
      const plan = drawPlan({ district, at: { x: r.from[0], z: r.from[1] }, objective: r.to ? { x: r.to[0], z: r.to[1] } : null, jobsDone: [], colliders: [] });
      plan.removeAttribute("role");
      sheet.prepend(plan);
      spots = { at: plan.querySelector(".dmap-cath"), goal: plan.querySelector(".dmap-goal") };
      root.classList.add("has-map");
      restring();
    })
    .catch(() => {
      // No sheet (the chunk failed): the string runs from the still to her photograph.
    });
  addEventListener("resize", restring);
  requestAnimationFrame(restring);

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
    strings.style.setProperty("--ld-left", (1 - shown).toFixed(4));
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
      if (shown < 1 && !closed) await new Promise<void>((r) => waiters.push(r));
      if (closed || !ask || performance.now() - t0 < 2500) return;
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
      removeEventListener("resize", restring);
      // Closed early (she died under it): whoever waits on the finish goes on.
      while (waiters.length) waiters.shift()!();
      root.hidden = true;
      root.classList.remove("is-ready", "is-striking");
    },
  };
}
