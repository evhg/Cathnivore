// The ending: after HollowCandor falls in the vault, the screen fades to black and the credits roll over Cath's
// last lines. Pure DOM, text only through textContent (see dom.ts).

import { button, el } from "./dom";

export const CREDITS: readonly (readonly [string, string])[] = [
  ["CATHODE", "Five names on the list. All of them crossed off."],
  ["Cath Hale", "Mum. Fixer. The only honest ledger in Marrow."],
  ["Bea", "On the radio, every step of the way."],
  ["Dr Vane, Councillor Pell, the Chair", "Gone, and the debts with them. Mostly."],
  ["HollowCandor", "Silent at last. The lights in Candor Tower went out one floor at a time."],
  ["Built with", "three.js, Poly Haven textures (CC0) and a great many neon tubes."],
  ["Thank you for playing", "The city is still hers. Hardboiled is waiting."],
];

/** Shows the credits over a black fade; `onDone` runs when the player presses Continue. */
export function showCredits(host: HTMLElement, onDone: () => void): HTMLElement {
  const root = el("div", "credits", host);
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Credits");
  const roll = el("div", "credits-roll", root);
  CREDITS.forEach(([title, line], i) => {
    const row = el("div", "credits-row", roll);
    row.style.setProperty("--i", String(i));
    el("h2", "credits-title", row, title);
    el("p", "credits-line", row, line);
  });
  const go = button("credits-go", root, "Continue");
  go.addEventListener("click", () => {
    root.remove();
    onDone();
  });
  go.focus();
  return root;
}
