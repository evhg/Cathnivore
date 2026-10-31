import { cathSceneSvg } from "../../../../shared/cath/scene";
import { caseBoard } from "../sim/casefile";
import { MODS, activeMods, broadcastLadder } from "../sim/newgameplus";
import { button, el } from "./dom";

/** Opens the case board over `parent`: pinned cards joined by red string, solved ones stamped. Returns a close function. */
export function openCaseBoard(parent: Element, jobsDone: readonly string[], onClose: () => void = () => {}): () => void {
  const wrap = el("div", "coach case-board", parent);
  const card = el("div", "coach-card case-cork", wrap);
  const cases = caseBoard(jobsDone);
  const allClosed = cases.length > 0 && cases.every((c) => c.state === "done");
  const scene = el("div", "case-cath", card);
  scene.setAttribute("aria-hidden", "true");
  scene.innerHTML = cathSceneSvg(allClosed ? "perfect" : "thinking");
  el("h2", "", card, "Case board");
  const ol = el("ol", "case-list", card);
  cases.forEach((c, i) => {
    const li = el("li", `case-${c.state}`, ol);
    // A small tilt and drop per card so the board reads pinned by hand, not gridded.
    li.style.setProperty("--tilt", `${((i * 37) % 7) - 3}deg`);
    el("i", "case-pin", li);
    el("b", "", li, c.title);
    if (c.state === "done") el("em", "case-stamp", li, "Closed");
    el("span", "", li, c.note);
  });
  const ladder = broadcastLadder(jobsDone);
  if (ladder.length > 0) {
    const names = activeMods(jobsDone).map((id) => MODS.find((m) => m.id === id)?.name ?? id);
    const box = el("div", "case-ladder", card);
    el("h3", "", box, "Second Broadcast");
    if (names.length > 0) el("p", "", box, `Deck: ${names.join(" · ")}`);
    const rungs = el("ol", "", box);
    for (const r of [...ladder].reverse()) el("li", r.current ? "is-now" : "", rungs, `Lap ${r.lap} · score ×${r.mult.toFixed(2)}`);
  }
  const close = (): void => {
    wrap.remove();
    onClose();
  };
  const go = button("btn btn-primary", card, "Back to the street");
  go.addEventListener("click", close);
  return close;
}
