import { caseBoard } from "../sim/casefile";
import { button, el } from "./dom";

/** Opens the case board over `parent`. Returns a close function. */
export function openCaseBoard(parent: Element, jobsDone: readonly string[], onClose: () => void = () => {}): () => void {
  const wrap = el("div", "coach case-board", parent);
  const card = el("div", "coach-card", wrap);
  el("h2", "", card, "Case board");
  const ol = el("ol", "case-list", card);
  for (const c of caseBoard(jobsDone)) {
    const li = el("li", `case-${c.state}`, ol);
    el("b", "", li, c.title);
    li.append(` ${c.state === "done" ? "(closed) " : ""}${c.note}`);
  }
  const close = (): void => {
    wrap.remove();
    onClose();
  };
  const go = button("btn btn-primary", card, "Back to the street");
  go.addEventListener("click", close);
  return close;
}
