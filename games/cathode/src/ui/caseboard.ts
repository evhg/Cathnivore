import { cathSceneSvg } from "../../../../shared/cath/scene";
import { caseBoard, type CaseEntry } from "../sim/casefile";
import { MODS, activeMods, broadcastLadder, deckBests } from "../sim/newgameplus";
import { BUST_FOR_CASE, BUST_NAMES, bustSvg } from "./busts";
import { button, cssVar, el, svg } from "./dom";

// Plan item 12: the case board is a cork wall. The List runs across the top as polaroids (Bea's surveillance
// stills once she has a lead on a name, a blank print until then) joined by red string; the leads hang below
// as index cards, closed ones stamped, the open one flagged, and the ones nobody can read yet face down in a
// stack. A fresh save gets a teaser: the same wall, one lead and the names still blank.

/** The List, in the order the string runs: each name's case, and who the print shows. */
const THE_LIST: readonly { id: string; name: string }[] = [
  { id: "crispBoss", name: BUST_NAMES.crisp },
  { id: "vaneBoss", name: BUST_NAMES.vane },
  { id: "pellBoss", name: BUST_NAMES.pell },
  { id: "boardBoss", name: BUST_NAMES.chair },
  { id: "vaultBoss", name: "HollowCandor" },
];

/** A small fixed tilt per pinned thing, so the wall reads pinned by hand, not gridded. */
const tilt = (i: number): string => `${((i * 37) % 7) - 3}deg`;

function polaroid(parent: Element, entry: CaseEntry | undefined, name: string, i: number): void {
  const state = entry?.state ?? "locked";
  const li = el("li", `case-print is-${state}`, parent);
  cssVar(li, "--tilt", tilt(i + 2));
  el("i", "case-pin", li);
  const photo = el("figure", "case-photo", li);
  const who = entry ? BUST_FOR_CASE[entry.id] : undefined;
  if (who && state !== "locked") {
    photo.innerHTML = bustSvg(who);
    photo.setAttribute("role", "img");
    photo.setAttribute("aria-label", `Surveillance still of ${name}`);
  } else {
    // No still yet: a blank print with a question mark in grease pencil.
    el("span", "case-blank", photo, "?");
  }
  const caption = el("b", "case-name", li, state === "locked" ? "Name withheld" : name);
  if (state === "done") caption.setAttribute("aria-label", `${name}, closed`);
}

/** Draws the red string through the List's pins, with a little sag between each pair. */
function stringUp(wall: HTMLElement, line: SVGSVGElement): void {
  const box = wall.getBoundingClientRect();
  if (box.width === 0) return;
  line.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  line.replaceChildren();
  const pins = Array.from(wall.querySelectorAll(".case-print .case-pin")).map((p) => {
    const r = p.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
  });
  for (let i = 1; i < pins.length; i++) {
    const a = pins[i - 1]!;
    const b = pins[i]!;
    // On a phone the prints wrap to a second row: the string runs along each row, not across the wall.
    if (Math.abs(b.y - a.y) > 40) continue;
    const sag = Math.min(28, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
    svg("path", { d: `M ${a.x},${a.y} Q ${(a.x + b.x) / 2},${Math.max(a.y, b.y) + sag} ${b.x},${b.y}`, class: "case-string" }, line);
  }
}

/** Opens the case board over `parent`: the List across the top, the leads below. Returns a close function. */
export function openCaseBoard(parent: Element, jobsDone: readonly string[], onClose: () => void = () => {}): () => void {
  const wrap = el("div", "coach case-board", parent);
  const card = el("div", "coach-card case-cork", wrap);
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Case board");
  const cases = caseBoard(jobsDone);
  const byId = new Map(cases.map((c) => [c.id, c]));
  const teaser = jobsDone.length === 0;
  const closed = cases.filter((c) => c.state === "done").length;
  const allClosed = cases.length > 0 && closed === cases.length;
  wrap.classList.toggle("is-teaser", teaser);

  const head = el("header", "case-head", card);
  const scene = el("div", "case-cath", head);
  scene.setAttribute("aria-hidden", "true");
  scene.innerHTML = cathSceneSvg(allClosed ? "perfect" : "thinking");
  const titles = el("div", "case-titles", head);
  el("h2", "", titles, "Case board");
  el(
    "p",
    "case-eyebrow",
    titles,
    teaser ? "Bea's wall. One lead, five names, no faces yet." : allClosed ? "Every name crossed off." : `${closed} of ${cases.length} closed`,
  );

  // The List: five prints on string.
  const wall = el("div", "case-wall", card);
  const prints = el("ol", "case-prints", wall);
  prints.setAttribute("aria-label", "The List");
  THE_LIST.forEach((n, i) => polaroid(prints, byId.get(n.id), n.name, i));
  // After the prints, so the string runs over them from pin to pin.
  const line = svg("svg", { class: "case-strings", "aria-hidden": "true" }, wall);

  // The leads: closed and open cards, and the rest face down.
  const leads = cases.filter((c) => !THE_LIST.some((n) => n.id === c.id));
  const ol = el("ol", "case-list", card);
  ol.setAttribute("aria-label", "Leads");
  let i = 0;
  for (const c of leads) {
    if (c.state === "locked") continue;
    const li = el("li", `case-${c.state}`, ol);
    cssVar(li, "--tilt", tilt(i++));
    el("i", "case-pin", li);
    el("b", "", li, c.title);
    if (c.state === "done") el("em", "case-stamp", li, "Closed");
    else el("em", "case-flag", li, "Open lead");
    el("span", "", li, c.note);
  }
  // The open name on the List gets its card too, so the next step is always written down.
  for (const n of THE_LIST) {
    const c = byId.get(n.id);
    if (c?.state !== "open") continue;
    const li = el("li", "case-open case-target", ol);
    cssVar(li, "--tilt", tilt(i++));
    el("i", "case-pin", li);
    el("b", "", li, c.title);
    el("em", "case-flag", li, "On the List");
    el("span", "", li, c.note);
  }
  const sealed = leads.filter((c) => c.state === "locked").length;
  if (sealed > 0) {
    const li = el("li", "case-sealed", ol);
    cssVar(li, "--tilt", tilt(i++));
    el("b", "", li, `${sealed} more ${sealed === 1 ? "lead" : "leads"}`);
    el("span", "", li, "Face down until Bea has more to go on.");
  }

  const ladder = broadcastLadder(jobsDone);
  if (ladder.length > 0) {
    const names = activeMods(jobsDone).map((id) => MODS.find((m) => m.id === id)?.name ?? id);
    const box = el("div", "case-ladder", card);
    el("h3", "", box, "Second Broadcast");
    if (names.length > 0) el("p", "", box, `Deck: ${names.join(" · ")}`);
    const bests = deckBests(jobsDone);
    if (bests.length > 0) el("p", "", box, `Best: ${bests.slice(0, 3).map((b) => `${b.names.join(" + ")} ×${b.mult.toFixed(2)}`).join(" · ")}`);
    const rungs = el("ol", "", box);
    for (const r of [...ladder].reverse()) el("li", r.current ? "is-now" : "", rungs, `Lap ${r.lap} · score ×${r.mult.toFixed(2)}`);
  }

  const redraw = (): void => stringUp(wall, line);
  const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(redraw);
  ro?.observe(wall);
  requestAnimationFrame(redraw);

  const close = (): void => {
    ro?.disconnect();
    window.removeEventListener("keydown", onKey, true);
    wrap.remove();
    // The caller puts focus back where it belongs (the title menu re-arms and focuses its item).
    onClose();
  };
  const go = button("btn btn-primary", card, "Back to the street");
  go.addEventListener("click", close);
  // Escape closes it; Tab stays on the board (its one control) rather than wandering into the page behind.
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.code === "Tab") {
      e.preventDefault();
      go.focus();
    }
  };
  window.addEventListener("keydown", onKey, true);
  go.focus({ preventScroll: true });
  return close;
}
