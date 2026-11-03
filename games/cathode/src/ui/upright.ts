// Plan item 44: the upright-phone screen. Held upright, the street can't be played (the game freezes under it,
// pauseView's `portrait`), so instead of a dead-end card this is a screen of its own: Cath at half length over the
// blurred street, a phone that turns on its side, one line, and the three things in her office that work upright
// (the case board, the wardrobe, the gun bench), with Back to the title.
import { cathSvg } from "../../../../shared/cath/cath";
import { chosenOutfit } from "../../../../shared/cath/wardrobe";
import { chosenPin } from "../../../../shared/cath/pins";
import { button, el } from "./dom";

export type UprightStation = "board" | "wardrobe" | "bench";

export interface UprightActions {
  /** Opens a station's screen over the game; `done` runs when it closes. */
  open(id: UprightStation, done: () => void): void;
}

const STATIONS: readonly { id: UprightStation; label: string; sub: string }[] = [
  { id: "board", label: "Case board", sub: "Who's left on the List" },
  { id: "wardrobe", label: "Wardrobe", sub: "Coat, gloves, the pearls" },
  { id: "bench", label: "Gun bench", sub: "Parts and tiers" },
];

/** A phone outline that turns a quarter to its side, with the arc it travels (CSS animates the turn). */
function phoneSvg(): string {
  return (
    `<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">` +
    `<path class="up-arc" d="M22 30 A34 34 0 0 1 66 22" />` +
    `<path class="up-tip" d="M60 15 l7 7 -9 4" />` +
    `<g class="up-phone"><rect x="34" y="22" width="28" height="52" rx="5" /><path d="M44 27h8" /><circle cx="48" cy="68" r="1.6" /></g>` +
    `</svg>`
  );
}

/** Fills the `.rotate` element with the upright screen. Returns a teardown (tests). */
export function mountUpright(root: HTMLElement, actions: UprightActions): () => void {
  root.replaceChildren();
  root.classList.add("upright");
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Turn your phone sideways");

  const back = el("a", "up-back", root);
  back.href = "./";
  back.setAttribute("aria-label", "Back to the title");
  back.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>`;
  el("span", "", back, "Title");

  const cath = el("div", "up-cath", root);
  cath.setAttribute("aria-hidden", "true");
  cath.innerHTML = cathSvg({ framing: "half", expression: "smirk", pose: "point", outfit: chosenOutfit(), pin: chosenPin() });

  const copy = el("div", "up-copy", root);
  const turn = el("div", "up-turn", copy);
  turn.innerHTML = phoneSvg();
  el("p", "rotate-line", copy, "Turn your phone sideways to play.");
  el("p", "up-sub", copy, "The street waits. Upright, the office is open:");

  const keys = el("div", "up-keys", copy);
  for (const s of STATIONS) {
    const b = button("up-key", keys);
    b.dataset.station = s.id;
    el("span", "up-key-name", b, s.label);
    el("span", "up-key-sub", b, s.sub);
    b.addEventListener("click", () => {
      root.classList.add("is-away");
      root.parentElement?.classList.add("is-upright-station");
      actions.open(s.id, () => {
        root.classList.remove("is-away");
        root.parentElement?.classList.remove("is-upright-station");
        b.focus({ preventScroll: true });
      });
    });
  }
  return () => {
    root.replaceChildren();
    root.classList.remove("upright", "is-away");
  };
}
