import { zoneBands, mapPoint } from "../game/zones";
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
): () => void {
  const wrap = el("div", "coach case-board district-map", parent);
  const card = el("div", "coach-card", wrap);
  el("h2", "", card, "The Drowned Market");
  const W = 210;
  const H = 440;
  const map = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", style: "max-height:56vh;display:block;margin:0 auto" }, card);
  svg("rect", { x: 0, y: 0, width: W, height: H, fill: "#0b0f16", stroke: "#2c3a4d" }, map);
  zoneBands().forEach(({ zone, y0, y1 }, i) => {
    svg("rect", { x: 0, y: y0 * H, width: W, height: (y1 - y0) * H, fill: i % 2 ? "#121a26" : "#0f1520" }, map);
    const t = svg("text", { x: 8, y: y0 * H + 16, fill: "#8fb3d9", "font-size": 12 }, map);
    t.textContent = zone.name;
    const s = svg("text", { x: 8, y: y0 * H + 29, fill: "#5d7a99", "font-size": 9 }, map);
    s.textContent = zone.sub;
  });
  if (objective) {
    const o = mapPoint(objective.x, objective.z);
    svg("circle", { cx: o.x * W, cy: o.y * H, r: 7, fill: "none", stroke: "#ffcf4a", "stroke-width": 2 }, map);
  }
  const p = mapPoint(at.x, at.z);
  svg("circle", { cx: p.x * W, cy: p.y * H, r: 5, fill: "#ff3d8b" }, map);
  el("p", "", card, "Pink: Cath. Gold ring: the objective.");
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
