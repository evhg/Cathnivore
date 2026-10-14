import { zoneBands, mapPoint, districtLeads, travelOptions, travelUrl, WINGS } from "../game/zones";
import { SECRETS, found, secretKey } from "../game/secrets";
import { districtBounds, districtInfo, districtLabels } from "../render/levels";
import { button, el } from "./dom";

const NS = "http://www.w3.org/2000/svg";

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.append(e);
  return e;
}

/** The district map (M): the named quarters, Cath's position and the objective. Returns a close function. */
export function openDistrictMap(
  parent: Element,
  at: { x: number; z: number },
  objective: { x: number; z: number } | null,
  onClose: () => void = () => {},
  jobsDone: readonly string[] = [],
): () => void {
  const wrap = el("div", "coach case-board district-map", parent);
  const card = el("div", "coach-card", wrap);
  el("h2", "", card, districtInfo(new URLSearchParams(location.search).get("district") ?? undefined).name);
  const W = 210;
  const H = 440;
  const map = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", class: "dmap-svg" }, card);
  svg("rect", { x: 0, y: 0, width: W, height: H, class: "dmap-bg" }, map);
  const here = new URLSearchParams(location.search).get("district") ?? "market";
  const local = districtBounds(here);
  // A district of its own: draw its floor plan to scale, with the way out at the south edge.
  const sc = local ? Math.min((W - 20) / (local.xMax - local.xMin), (H - 20) / (local.zMax - local.zMin)) : 1;
  const ox = local ? (W - (local.xMax - local.xMin) * sc) / 2 : 0;
  const oz = local ? (H - (local.zMax - local.zMin) * sc) / 2 : 0;
  const lx = (x: number): number => (local ? ox + (x - local.xMin) * sc : 0);
  const lz = (z: number): number => (local ? oz + (z - local.zMin) * sc : 0);
  if (local) {
    svg("rect", { x: lx(local.xMin), y: lz(local.zMin), width: lx(local.xMax) - lx(local.xMin), height: lz(local.zMax) - lz(local.zMin), class: "dmap-floor" }, map);
    const t = svg("text", { x: W / 2, y: lz(local.zMax) + 10, class: "dmap-exit", "text-anchor": "middle" }, map);
    t.textContent = "Way out (south)";
    for (const [name, x, z] of districtLabels(here)) {
      const l = svg("text", { x: lx(x), y: lz(z), class: "dmap-label", "text-anchor": "middle" }, map);
      l.textContent = name;
    }
  }
  (local ? [] : zoneBands()).forEach(({ zone, y0, y1 }, i) => {
    svg("rect", { x: 0, y: y0 * H, width: W, height: (y1 - y0) * H, class: i % 2 ? "dmap-band dmap-band-b" : "dmap-band" }, map);
    const t = svg("text", { x: 8, y: y0 * H + 16, class: "dmap-zone" }, map);
    t.textContent = zone.name;
    const s = svg("text", { x: 8, y: y0 * H + 29, class: "dmap-sub" }, map);
    s.textContent = zone.sub;
  });
  for (const w of local ? [] : WINGS) {
    if (!jobsDone.includes(w.needs)) continue;
    const a = mapPoint(w.xMin, w.zMin);
    const b = mapPoint(w.xMin, w.zMax);
    svg("rect", { x: a.x * W - 36, y: a.y * H, width: W - a.x * W + 36, height: (b.y - a.y) * H, class: "dmap-wing" }, map);
    const t = svg("text", { x: a.x * W - 32, y: a.y * H + 14, class: "dmap-wing-name" }, map);
    t.textContent = w.name;
  }
  if (objective) {
    const o = local ? { x: lx(objective.x) / W, y: lz(objective.z) / H } : mapPoint(objective.x, objective.z);
    svg("circle", { cx: o.x * W, cy: o.y * H, r: 7, class: "dmap-goal" }, map);
  }
  for (const sec of local ? [] : SECRETS) {
    if (!jobsDone.includes(secretKey(sec.id))) continue;
    const q = mapPoint(sec.x, sec.z);
    svg("rect", { x: q.x * W - 3, y: q.y * H - 3, width: 6, height: 6, class: "dmap-secret", transform: `rotate(45 ${q.x * W} ${q.y * H})` }, map);
  }
  const p = local ? { x: lx(at.x) / W, y: lz(at.z) / H } : mapPoint(at.x, at.z);
  svg("circle", { cx: p.x * W, cy: p.y * H, r: 5, class: "dmap-halo" }, map);
  svg("circle", { cx: p.x * W, cy: p.y * H, r: 5, class: "dmap-cath" }, map);
  const key = el("ul", "dmap-key", card);
  el("li", "dmap-k-cath", key, "Cath");
  el("li", "dmap-k-goal", key, "Objective");
  el("li", "dmap-k-secret", key, `Secrets ${found(jobsDone)}/${SECRETS.length}`);
  const leads = el("ul", "dmap-leads", card);
  for (const d of districtLeads(jobsDone)) el("li", "", leads, `Act ${d.act}: ${d.name} ${d.open ? "(on the board)" : "(locked)"}`);
  const trips = travelOptions(jobsDone).filter((d) => d.id !== here);
  if (trips.length) {
    el("p", "dmap-taxi", card, "Water taxi");
    for (const d of trips) {
      button("btn", card, `Travel to ${d.name}`).addEventListener("click", () => {
        location.search = travelUrl(d.id, location.search);
      });
    }
  }
  const close = (): void => {
    window.removeEventListener("keydown", onKey);
    wrap.remove();
    onClose();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === "KeyM" || e.code === "Escape") close();
  };
  window.addEventListener("keydown", onKey);
  button("btn btn-primary", card, "Back to the street").addEventListener("click", close);
  return close;
}
