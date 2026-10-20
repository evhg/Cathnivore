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
  ["Set in", "Archivo and Bodoni Moda, under the SIL Open Font License."],
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

/**
 * The title menu's CREDITS (C13, S9.1): who made it and with what, and nothing of the story (the ending roll above
 * is for the ending). The front door's one grotesk (Archivo) for roles, names and the small
 * print. Escape, Backspace, the pad's B or BACK closes it.
 */
export const STUDIO_CREDITS: readonly { role: string; name: string; note?: string }[] = [
  { role: "A game by", name: "Cathnivore" },
  { role: "Starring", name: "Cath Hale", note: "Mum. Fixer. Best-dressed woman in Hollowell." },
  { role: "World, code and art", name: "three.js · TypeScript · WebGL 2" },
  { role: "Textures", name: "Poly Haven", note: "CC0, with thanks" },
  { role: "Sound", name: "Synthesised live", note: "Web Audio, no samples" },
  { role: "Type", name: "Archivo · Bodoni Moda", note: "SIL Open Font License 1.1" },
  { role: "Thank you", name: "for walking in out of the rain." },
];

export interface FrontCreditsHandle {
  close(): void;
}

export function showFrontCredits(host: HTMLElement, o: { onClose: () => void; tick?: () => void }): FrontCreditsHandle {
  const root = el("section", "front-credits", host);
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "front-credits-h");
  const plate = el("div", "front-credits-plate", root);
  el("p", "front-credits-eyebrow", plate, "Credits");
  const h = el("h2", "front-credits-h", plate, "CATHODE");
  h.id = "front-credits-h";
  const list = el("dl", "front-credits-list", plate);
  STUDIO_CREDITS.forEach((c, i) => {
    const row = el("div", "front-credits-row", list);
    row.style.setProperty("--i", String(i));
    el("dt", "front-credits-role", row, c.role);
    const dd = el("dd", "front-credits-name", row, c.name);
    if (c.note) el("span", "front-credits-note", dd, c.note);
  });
  const foot = el("div", "front-credits-foot", plate);
  const back = button("front-credits-back", foot);
  el("span", "front-credits-key", back, "Esc");
  el("span", "", back, "Back");
  let open = true;
  let raf = 0;
  const close = () => {
    if (!open) return;
    open = false;
    cancelAnimationFrame(raf);
    removeEventListener("keydown", onKey, true);
    o.tick?.();
    root.classList.add("is-out");
    setTimeout(() => root.remove(), 220);
    o.onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      // One control: Tab stays on it.
      e.preventDefault();
      back.focus();
    }
  };
  addEventListener("keydown", onKey, true);
  back.addEventListener("click", close);
  // The pad's B (or A on BACK, its one control) closes it; held buttons from the menu's A don't count.
  let armed = false;
  const pad = () => {
    raf = requestAnimationFrame(pad);
    const gps = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    let down = false;
    for (const g of gps) if (g && (g.buttons[1]?.pressed || g.buttons[0]?.pressed)) down = true;
    if (!down) armed = true;
    else if (armed) close();
  };
  raf = requestAnimationFrame(pad);
  requestAnimationFrame(() => root.classList.add("is-in"));
  back.focus({ preventScroll: true });
  return { close };
}
