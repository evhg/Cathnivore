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

/** Plan item 690: the name inked down an indoor district's outline on the briefing's sheet. */
const INDOORS: Record<string, string> = { clinic: "THE CANDOR CLINIC", plaza: "HOLLOWELL PLAZA", tower: "THE BOARD TOWER", vault: "THE HOLLOW VAULT" };

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
  // Plan item 690: no percentage. The load is the pencil route drawn on the survey sheet (and the ink on this rule).
  meter.setAttribute("role", "progressbar");
  meter.setAttribute("aria-label", "Loading the case");
  // Cath's line types in, in her italic voice; the untyped rest holds its place (hidden), so the lines never rewrap.
  const lore = el("p", "ld-lore", file);
  const said = `“${card.lore}”`;
  lore.setAttribute("aria-label", said);
  const typed = el("span", "ld-typed", lore);
  const rest = el("span", "ld-untyped", lore, said);
  rest.setAttribute("aria-hidden", "true");
  typed.setAttribute("aria-hidden", "true");
  const reduce = o.still || o.held !== undefined || matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
  if (reduce) {
    typed.textContent = said;
    rest.textContent = "";
  } else {
    // about 1.6 s for the line, after the prints have landed
    // Plan item 700: paced by the clock, not one letter a tick: the street loads on this thread, and a timer per
    // letter stalled with it, leaving the line cut mid-sentence ('Tomas Reed owes') while the load ran. A late tick
    // now catches up to where the line should be.
    const per = Math.max(10, Math.min(24, 1600 / said.length));
    const start = performance.now() + 700;
    const type = () => {
      if (closed) return;
      const n = Math.min(said.length, Math.max(1, Math.floor((performance.now() - start) / per)));
      typed.textContent = said.slice(0, n);
      rest.textContent = said.slice(n);
      if (n < said.length) setTimeout(type, per);
    };
    setTimeout(type, 700);
  }
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
  // (an upright phone stacks the objective under the still: the string leaves from a pin at its foot, not over the face)
  el("i", "ld-pin ld-pin-foot", still);
  // Plan item 690: the objective, a pinned card between the still and her photograph.
  const goalCard = el("figure", "ld-obj", board);
  el("p", "ld-obj-h", goalCard, "Objective");
  el("p", "ld-obj-where", goalCard, card.objective.where);
  el("p", "ld-obj-what", goalCard, card.objective.what);
  el("i", "ld-pin", goalCard);
  const sheet = el("div", "ld-map", board);
  el("i", "ld-pin", sheet);
  const print = el("figure", "ld-print", board);
  el("div", "ld-photo", print);
  el("figcaption", "", print, "Cath");
  el("i", "ld-pin", print);
  // Plan item 705: at D the string comes in to a pin in the caption's corner, under her photograph (into the top pin it
  // ran up across her face)
  el("i", "ld-pin ld-pin-side", print);
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
    const foot = still.querySelector(".ld-pin-foot")!;
    const from = getComputedStyle(foot).display !== "none" ? centre(foot) : centre(still.querySelector(".ld-pin"), true);
    const ring = centre(spots.goal);
    const at = centre(spots.at);
    // Plan item 690: two runs. Still -> objective card -> the ring on the sheet; then from her dot to her photograph.
    // Between the ring and her dot the pencil route is the line (the load), so the string leaves that stretch to it.
    const side = print.querySelector(".ld-pin-side")!;
    const her = getComputedStyle(side).display !== "none" ? centre(side) : centre(print.querySelector(".ld-pin"), true);
    const runs = [[from, centre(goalCard.querySelector(".ld-pin"), true), ring], [at, her]]
      .map((r) => r.filter((p): p is [number, number] => !!p))
      .filter((r) => r.length > 1);
    if (!ring || !at) runs.splice(0, runs.length, [from, centre(goalCard.querySelector(".ld-pin"), true), centre(print.querySelector(".ld-pin"), true)].filter((p): p is [number, number] => !!p));
    // Slack: each run sags a little below the straight line, like a string pinned at both ends.
    // Plan item 700: of a few slacks (a sag either side, or taut), the one that crosses fewest of the sheet's names
    // (D's string lay over 'THE SOUTH ARCADE' on its way to the ring).
    const o = root.getBoundingClientRect();
    const names = [...sheet.querySelectorAll(".dmap-labels .dmap-t")].map((t) => t.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }));
    const crossings = (px: number, py: number, qx: number, qy: number, x: number, y: number) => {
      let n = 0;
      for (let k = 1; k < 24; k++) {
        const t = k / 24;
        const u = 1 - t;
        const sx = u * u * px + 2 * u * t * qx + t * t * x;
        const sy = u * u * py + 2 * u * t * qy + t * t * y;
        n += names.filter((b) => sx >= b.x - 2 && sx <= b.x + b.w + 2 && sy >= b.y - 2 && sy <= b.y + b.h + 2).length;
      }
      return n;
    };
    let d = "";
    for (const pts of runs) pts.forEach(([x, y], i) => {
      if (!i) d += `${d ? " " : ""}M${x.toFixed(1)} ${y.toFixed(1)}`;
      else {
        const [px, py] = pts[i - 1]!;
        const len = Math.hypot(x - px, y - py);
        const mx = (px + x) / 2;
        const my = (py + y) / 2;
        // the sag is downward; the others bow the string sideways off the straight line, normal to it
        const nx = len ? -(y - py) / len : 0;
        const ny = len ? (x - px) / len : 0;
        const tries: Array<[number, number]> = [[mx, my + len * 0.1], ...[0.18, -0.18, 0.32, -0.32].map((f): [number, number] => [mx + nx * len * f, my + ny * len * f])];
        const best = names.length ? tries.reduce((a, b) => (crossings(px, py, b[0], b[1], x, y) < crossings(px, py, a[0], a[1], x, y) ? b : a)) : tries[0]!;
        d += ` Q${best[0].toFixed(1)} ${best[1].toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
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
      label(plan);
      route = pencil(plan, r);
      legible(plan);
      draw();
      spots = { at: plan.querySelector(".dmap-cath"), goal: plan.querySelector(".dmap-goal") };
      root.classList.add("has-map");
      restring();
    })
    .catch(() => {
      // No sheet (the chunk failed): the string runs from the still to her photograph.
    });
  // Plan item 690: every box on the sheet named. The flyover deck is drawn dashed over the street with no name of its own.
  function label(plan: SVGSVGElement): void {
    const labels = plan.querySelector(".dmap-labels");
    if (!labels) return;
    const box = (r: Element) => ["x", "y", "width", "height"].map((k) => Number(r.getAttribute(k))) as [number, number, number, number];
    const fly = plan.querySelector<SVGRectElement>(".dmap-flyover");
    if (fly) {
      const [x, y, , h] = box(fly);
      const t = svg("text", { x: (x + 1.2).toFixed(1), y: (y + h / 2 + 1).toFixed(1), "font-size": 2.4, class: "dmap-t dmap-t-zone ld-fly-t" }, labels);
      t.textContent = "THE FLYOVER";
    }
    // an indoor district's outline (one walled floor) named down its right wall (her route keeps to the left)
    const walls = plan.querySelector(".dmap-walls");
    if (walls) {
      const [x, y, w, h] = box(walls);
      const cx = x + w - 1.8;
      const cy = y + h * 0.84;
      const t = svg("text", { x: cx.toFixed(1), y: cy.toFixed(1), "font-size": 2.2, "text-anchor": "middle", "dominant-baseline": "central", transform: `rotate(90 ${cx.toFixed(1)} ${cy.toFixed(1)})`, class: "dmap-t dmap-t-zone ld-walls-t" }, labels);
      t.textContent = INDOORS[district] ?? "THE BUILDING";
    }
    // the water: the tallest strip named down its length (the market's canal), the flooded road where it lies
    const tall = [...plan.querySelectorAll(".dmap-water")].map(box).filter((b) => b[3] > b[2] * 3).sort((a, b) => b[3] - a[3])[0];
    if (tall) {
      const [x, y, w, h] = tall;
      const cx = x + Math.min(w, 6) / 2;
      const cy = y + h * 0.62;
      const t = svg("text", { x: cx.toFixed(1), y: cy.toFixed(1), "font-size": 2.2, "text-anchor": "middle", "dominant-baseline": "central", transform: `rotate(90 ${cx.toFixed(1)} ${cy.toFixed(1)})`, class: "dmap-t dmap-t-zone ld-water-t" }, labels);
      t.textContent = district === "market" ? "THE CANAL" : "THE RIVER";
    }
    for (const fl of plan.querySelectorAll(".dmap-flood")) {
      const [x, y, w, h] = box(fl);
      const cx = x + w / 2;
      const cy = y + h / 2;
      const t = svg("text", { x: cx.toFixed(1), y: cy.toFixed(1), "font-size": 2, "text-anchor": "middle", "dominant-baseline": "central", transform: `rotate(-90 ${cx.toFixed(1)} ${cy.toFixed(1)})`, class: "dmap-t dmap-t-zone ld-flood-t" }, labels);
      t.textContent = "FLOODED";
    }
    // the street lamps along the quay, inked as small rayed rings (the ones she walks under on arrival)
    const quay = plan.querySelector(".dmap-quay");
    if (quay) {
      const [x, y, w, h] = box(quay);
      const lamps = svg("g", { class: "ld-lamps" }, plan);
      plan.insertBefore(lamps, labels);
      for (let z = y + 8; z < y + h - 4; z += 16) {
        const lx = x + w * 0.3;
        svg("circle", { cx: lx.toFixed(1), cy: z.toFixed(1), r: 0.55 }, lamps);
        svg("path", { d: `M${(lx - 1.3).toFixed(1)} ${z.toFixed(1)}h0.5M${(lx + 0.8).toFixed(1)} ${z.toFixed(1)}h0.5M${lx.toFixed(1)} ${(z - 1.3).toFixed(1)}v0.5M${lx.toFixed(1)} ${(z + 0.8).toFixed(1)}v0.5` }, lamps);
      }
    }
  }
  // Plan item 690: the load is a pencil route drawn from where she arrives to the objective, along the street.
  let route: SVGPathElement | null = null;
  function pencil(plan: SVGSVGElement, r: { from: [number, number]; to: [number, number] | null }): SVGPathElement | null {
    if (!r.to) return null;
    const [x0, z0] = r.from;
    const [x1, z1] = r.to;
    // a hand-drawn line: a gentle S that keeps to the road, not a ruler
    const mz = (z0 + z1) / 2;
    const d = `M${x0} ${z0 - 2.4} C${x0 + 1.6} ${mz + (z0 - mz) * 0.4} ${x1 - 1.6} ${mz - (mz - z1) * 0.4} ${x1} ${z1 + 2.8}`;
    const g = plan.querySelector(".dmap-labels");
    const p = svg("path", { d, class: "ld-route", pathLength: 1 }, plan);
    if (g) plan.insertBefore(p, g);
    return p as SVGPathElement;
  }
  // Plan item 638: the survey sheet is drawn small here, so its labels read at 7-8 px: the loader keeps the names
  // that tell the route (the areas, the objective, Cath), each set to 13 px or more on screen, and
  // leaves the small print (landmarks, rooms, tips; they ran into the route at 13 px) to the full map.
  const KEEP = new Set(["zone", "goal", "cath"]);
  function legible(plan: SVGSVGElement): void {
    // viewBox units per screen pixel from the drawn transform (the box's width overstates it where the sheet letterboxes)
    const m = plan.getScreenCTM();
    const k = m ? Math.hypot(m.a, m.b) : 0;
    if (!k) return;
    const perPx = 1 / k;
    // the legend's 'N' and '10 m' are the full map's small print too (the arrow and the bar still draw)
    for (const t of plan.querySelectorAll<SVGTextElement>(".dmap-legend text")) t.style.setProperty("display", "none");
    for (const l of plan.querySelectorAll<SVGLineElement>(".dmap-labels .dmap-leader")) {
      const kind = [...l.classList].find((c) => c.startsWith("dmap-leader-"))?.slice(12) ?? "";
      if (!KEEP.has(kind)) l.style.setProperty("display", "none");
    }
    for (const t of plan.querySelectorAll<SVGTextElement>(".dmap-labels .dmap-t")) {
      const kind = [...t.classList].find((c) => c.startsWith("dmap-t-"))?.slice(7) ?? "";
      if (!KEEP.has(kind)) {
        t.style.setProperty("display", "none");
        continue;
      }
      const base = Number(t.dataset.size ?? t.getAttribute("font-size") ?? 0);
      t.dataset.size = String(base);
      t.setAttribute("font-size", String(Math.max(base, 13 * perPx)));
    }
  }
  addEventListener("resize", () => {
    const plan = sheet.querySelector<SVGSVGElement>("svg");
    if (plan) legible(plan);
  });
  addEventListener("resize", restring);
  requestAnimationFrame(restring);
  // The prints drop into place over about a second: the string follows their pins until they land.
  for (const e of [still, goalCard, print, sheet]) e.addEventListener("animationend", restring);
  // (the sheet's labels sized once it has landed: measured mid-deal they came out at 11 px)
  sheet.addEventListener("animationend", () => {
    const plan = sheet.querySelector<SVGSVGElement>("svg");
    if (plan) legible(plan);
  });

  const corner = el("div", "ld-corner", root);
  el("p", "ld-list-h", corner, "The List");
  const ol = el("ol", "ld-list", corner);
  for (const r of card.list) {
    const li = el("li", r.done ? (r.fresh ? "is-done is-fresh" : "is-done") : r.next ? "is-next" : "", ol, r.name);
    if (r.done) li.setAttribute("aria-label", `${r.name}, dealt with`);
  }
  if (card.sealed) el("li", "is-more", ol, `${card.sealed} more ${card.sealed === 1 ? "name" : "names"}`);
  // Plan item 705: at D The List is a slip pinned under her photograph (alone in the corner it floated in an empty band)
  el("i", "ld-pin", corner);
  const pinList = () => {
    if (getComputedStyle(corner).position !== "absolute" || !matchMedia("(min-width: 641px) and (min-height: 431px)").matches) {
      corner.style.removeProperty("top");
      return;
    }
    const o = root.getBoundingClientRect();
    const pr = print.getBoundingClientRect();
    if (pr.height) corner.style.setProperty("top", `${Math.round(pr.bottom - o.top + Math.max(16, pr.width * 0.08))}px`);
  };
  addEventListener("resize", pinList);
  requestAnimationFrame(pinList);
  print.addEventListener("animationend", pinList);
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
    meter.setAttribute("aria-valuenow", String(Math.round(shown * 100)));
    route?.style.setProperty("stroke-dashoffset", (1 - shown).toFixed(4));
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
