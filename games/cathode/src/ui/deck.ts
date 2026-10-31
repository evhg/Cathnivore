// Second Broadcast: the modifier deck picker shown when a New Game+ lap starts (ROADMAP 230).
import { MODS, scoreMultiplier, startSecondBroadcast } from "../sim/newgameplus";
import { el } from "./dom";

/** Shows the deck over `host`; resolves with the picked mod ids (empty for a plain lap). */
export function pickDeck(host: HTMLElement, jobsDone: readonly string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const root = el("div", "deck", host);
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Second Broadcast");
    el("h2", "deck-title", root, "SECOND BROADCAST");
    el("p", "deck-sub", root, "Pick up to three. Harder street, bigger score.");
    const picked = new Set<string>();
    const mult = el("p", "deck-mult", root);
    const refresh = (): void => {
      mult.textContent = `SCORE ×${scoreMultiplier(startSecondBroadcast(jobsDone, [...picked])).toFixed(2)}`;
    };
    for (const m of MODS) {
      const b = el("button", "deck-card", root);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      el("strong", "", b, m.name);
      el("span", "", b, m.line);
      b.addEventListener("click", () => {
        if (picked.has(m.id)) picked.delete(m.id);
        else if (picked.size < 3) picked.add(m.id);
        b.setAttribute("aria-pressed", String(picked.has(m.id)));
        refresh();
      });
    }
    refresh();
    const go = el("button", "deck-go", root, "BEGIN BROADCAST");
    go.type = "button";
    go.addEventListener("click", () => {
      root.remove();
      resolve([...picked]);
    });
    go.focus();
  });
}
