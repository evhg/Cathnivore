import { districtLeads, travelOptions, travelUrl } from "../game/zones";
import { SECRETS, found } from "../game/secrets";
import { districtInfo } from "../render/levels";
import { button, el, svg, trapTab } from "./dom";
import { mapPlan, type PlanInput, type Rect } from "./mapplan";

// Plan item 12: the district map (M) is a drawn plan pinned to the same cork as the case board: a surveyor's
// sheet in ink on paper with the street (or the floor) to scale, everything solid at body height inked in,
// the landmarks and rooms named, the found secrets marked, Cath's dot and the objective ringed in red pencil.
// The notes beside it carry the key, the leads and the water taxi. Layout lives in mapplan.ts (unit-tested).

const f = (v: number): string => String(Math.round(v * 100) / 100);

function rect(r: Rect, cls: string, parent: Element): SVGRectElement {
  return svg("rect", { x: f(r.x0), y: f(r.z0), width: f(r.x1 - r.x0), height: f(r.z1 - r.z0), class: cls }, parent);
}

/** A hand-drawn ring: two loops a little apart, so it reads drawn in pencil, not computed. */
function pencilRing(cx: number, cz: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 44; i++) {
    const a = (i / 36) * Math.PI * 2 - 0.6;
    const rr = r * (1 + 0.06 * Math.sin(i * 1.7)) + (i > 36 ? 0.35 : 0);
    pts.push(`${f(cx + Math.cos(a) * rr)},${f(cz + Math.sin(a) * rr * 0.92)}`);
  }
  return `M ${pts.join(" L ")}`;
}

/** Draws the plan into an SVG whose viewBox is in metres. */
export function drawPlan(input: PlanInput): SVGSVGElement {
  const p = mapPlan(input);
  const s = p.sheet;
  const map = svg("svg", { viewBox: `${f(s.x0)} ${f(s.z0)} ${f(s.x1 - s.x0)} ${f(s.z1 - s.z0)}`, class: "dmap-svg", role: "img" });
  const defs = svg("defs", {}, map);
  const hatch = svg("pattern", { id: "dmap-hatch", width: 1.2, height: 1.2, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  svg("line", { x1: 0, y1: 0, x2: 0, y2: 1.2, class: "dmap-hatch-line" }, hatch);
  const waves = svg("pattern", { id: "dmap-waves", width: 4, height: 2.2, patternUnits: "userSpaceOnUse" }, defs);
  svg("path", { d: "M 0,1.1 q 1,-0.7 2,0 t 2,0", class: "dmap-wave" }, waves);
  const grid = svg("pattern", { id: "dmap-grid", width: 10, height: 10, patternUnits: "userSpaceOnUse" }, defs);
  svg("path", { d: "M 10,0 L 0,0 0,10", class: "dmap-grid-line" }, grid);

  rect(s, "dmap-paper", map);
  rect(s, "dmap-grid", map);
  for (const g of p.ground) {
    rect(g.r, `dmap-g dmap-${g.kind}`, map);
    if (g.kind === "water" || g.kind === "flood") rect(g.r, "dmap-waves", map);
    if (g.kind === "block") rect(g.r, "dmap-hatch", map);
  }
  // The road's centre line.
  const road = p.ground.find((g) => g.kind === "road");
  if (road) {
    const x = (road.r.x0 + road.r.x1) / 2;
    svg("line", { x1: f(x), y1: f(road.r.z0), x2: f(x), y2: f(road.r.z1), class: "dmap-centre" }, map);
  }
  for (const z of p.dividers) svg("line", { x1: f(s.x0 + 0.6), y1: f(z), x2: f(-10), y2: f(z), class: "dmap-divider" }, map);
  const solids = svg("g", { class: "dmap-solids" }, map);
  for (const r of p.solids) rect(r, "", solids);
  if (p.flyover) {
    rect(p.flyover, "dmap-flyover", map);
    const t = svg("text", { x: f(p.flyover.x1 - 1), y: f(p.flyover.z0 + 2.6), "font-size": 2.1, "text-anchor": "end", class: "dmap-t dmap-t-fly" }, map);
    t.textContent = "Flyover overhead";
  }
  if (p.ground.some((g) => g.kind === "floor")) rect(p.bounds, "dmap-walls", map);
  for (const w of p.wings) rect(w, "dmap-wing", map);
  for (const sec of p.secrets) {
    svg("rect", { x: f(sec.x - 0.8), y: f(sec.z - 0.8), width: 1.6, height: 1.6, transform: `rotate(45 ${f(sec.x)} ${f(sec.z)})`, class: "dmap-secret" }, map);
  }
  if (p.goal) svg("path", { d: pencilRing(p.goal.x, p.goal.z, 2.6), class: "dmap-goal" }, map);
  svg("circle", { cx: f(p.cath.x), cy: f(p.cath.z), r: 1.1, class: "dmap-halo" }, map);
  svg("circle", { cx: f(p.cath.x), cy: f(p.cath.z), r: 1.1, class: "dmap-cath" }, map);

  const labels = svg("g", { class: "dmap-labels" }, map);
  for (const l of p.labels) {
    if (l.leader) {
      const lx = Math.max(l.box.x0, Math.min(l.box.x1, l.leader.x));
      const lz = Math.max(l.box.z0, Math.min(l.box.z1, l.leader.z));
      svg("line", { x1: f(l.leader.x), y1: f(l.leader.z), x2: f(lx), y2: f(lz), class: `dmap-leader dmap-leader-${l.kind}` }, labels);
    }
    const t = svg("text", { x: f(l.x), y: f(l.z), "font-size": l.size, class: `dmap-t dmap-t-${l.kind}` }, labels);
    t.textContent = l.text;
  }
  // Compass and a 10 m scale bar in the bottom-right margin.
  const g = svg("g", { class: "dmap-legend", transform: `translate(${f(p.legend.x)} ${f(p.legend.z)})` }, map);
  svg("path", { d: "M -2.4,-1.2 l 1.4,-5 l 1.4,5 l -1.4,-1.2 z", class: "dmap-north" }, g);
  const n = svg("text", { x: -1, y: -7, "font-size": 2.1, "text-anchor": "middle", class: "dmap-t dmap-t-north" }, g);
  n.textContent = "N";
  svg("path", { d: "M -15,0 v -0.8 M -15,0 h 10 v -0.8 M -10,0 v -0.5", class: "dmap-scale" }, g);
  const sc = svg("text", { x: -10, y: -1.6, "font-size": 2, "text-anchor": "middle", class: "dmap-t dmap-t-scale" }, g);
  sc.textContent = "10 m";
  return map;
}

/** The district map (M): the drawn plan, Cath's position and the objective. Returns a close function. */
export function openDistrictMap(
  parent: Element,
  at: { x: number; z: number },
  objective: { x: number; z: number } | null,
  onClose: () => void = () => {},
  jobsDone: readonly string[] = [],
  colliders: PlanInput["colliders"] = [],
): () => void {
  const here = new URLSearchParams(location.search).get("district") ?? "market";
  const info = districtInfo(here);
  const wrap = el("div", "coach case-board district-map", parent);
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-label", `Map of ${info.name}`);
  const cork = el("div", "case-cork dmap-cork", wrap);
  const head = el("header", "case-head", cork);
  const titles = el("div", "case-titles", head);
  el("h2", "", titles, info.name);
  el("p", "case-eyebrow", titles, `Act ${info.act} · Survey sheet · M or Esc to close`);
  const body = el("div", "dmap-body", cork);
  const sheet = el("figure", "dmap-sheet", body);
  el("i", "case-pin dmap-pin-l", sheet);
  el("i", "case-pin dmap-pin-r", sheet);
  const plan = drawPlan({ district: here, at, objective, jobsDone, colliders });
  plan.setAttribute("aria-label", `Plan of ${info.name}${objective ? ", objective ringed" : ""}`);
  sheet.append(plan);

  const notes = el("div", "dmap-notes", body);
  const keyCard = el("div", "dmap-card", notes);
  el("i", "case-pin", keyCard);
  const key = el("ul", "dmap-key", keyCard);
  el("li", "dmap-k-cath", key, "Cath");
  el("li", "dmap-k-goal", key, "Objective");
  if (here === "market") el("li", "dmap-k-secret", key, `Secrets found ${found(jobsDone)} of ${SECRETS.length}`);
  el("li", "dmap-k-solid", key, "Walls, stalls and cover");
  const leadCard = el("div", "dmap-card", notes);
  el("i", "case-pin", leadCard);
  el("h3", "", leadCard, "Leads");
  const leads = el("ul", "dmap-leads", leadCard);
  for (const d of districtLeads(jobsDone)) {
    const li = el("li", d.open ? "is-open" : "is-locked", leads);
    el("b", "", li, `Act ${d.act}`);
    li.append(` ${d.name}`);
    el("span", "dmap-lead-state", li, d.open ? "On the board" : "Locked");
  }
  const trips = travelOptions(jobsDone).filter((d) => d.id !== here);
  if (trips.length) {
    const taxi = el("div", "dmap-card dmap-taxi", notes);
    el("i", "case-pin", taxi);
    el("h3", "", taxi, "Water taxi");
    for (const d of trips) {
      button("btn", taxi, `Travel to ${d.name}`).addEventListener("click", () => {
        // C14: the loading screen on the other side carries the travel motif.
        try {
          sessionStorage.setItem("cathode.travel", "1");
        } catch {
          // No storage: an ordinary arrival.
        }
        location.search = travelUrl(d.id, location.search);
      });
    }
  }
  const back = button("btn btn-primary", notes, "Back to the street");
  const close = (): void => {
    window.removeEventListener("keydown", onKey);
    wrap.remove();
    onClose();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === "KeyM" || e.code === "Escape") close();
    else trapTab(wrap, e);
  };
  window.addEventListener("keydown", onKey);
  back.addEventListener("click", close);
  back.focus({ preventScroll: true });
  return close;
}
