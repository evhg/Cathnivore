// C14 (docs/design/cathode-combat.md S9.5): the class pick is a wardrobe and a dossier. The live title scene stays
// behind it and the camera comes in close on Cath, her key light turning to the class's colour and the class's idle
// playing (render/frontscene.ts `wardrobe`). Over it, type straight on the scene (C13T: no cards, emblems or
// hatching): the class names down the left edge (a radio group: arrows, Home/End and 1-5 move), Cath's line and how
// the class plays under them; the right column is the stat sheet, whose 1u bars with 6u ticks count up over 350 ms
// when the class changes, the starting weapon and the three trees. Commit is a hold: press and hold the red bar
// (or Enter, or Space) for 600 ms while the heartbeat thumps twice; letting go early cancels.

import { CLASSES, TREES } from "../sim/classes";
import { STARTING_WEAPON, newCharacter } from "../sim/character";
import { CLASS_START_ATTRIBUTES } from "../sim/stats";
import { ATTRIBUTES, CLASS_IDS, type AttributeId, type ClassId } from "../sim/types";
import { WEAPON_BASES } from "../sim/weapons";
import { CLASS_COPY } from "./classart";
import { button, el, reducedMotion, trapTab } from "./dom";
import { WEAPON_CLASS_LABEL } from "./itemtext";

export interface ClassPickHandle {
  /** Removes the screen without picking. */
  close(): void;
}

export interface ClassPickHooks {
  /** The chosen class changed (the scene relights and plays the idle; the menu ticks). */
  onSelect?(cls: ClassId): void;
  /** One heartbeat thump while the commit is held (twice per hold). */
  onThump?(): void;
  /** Screenshots: no count-up, no fades. */
  still?: boolean;
}

export const ATTRIBUTE_LABEL: Record<AttributeId, string> = { grit: "Grit", aim: "Aim", nerve: "Nerve", wire: "Wire" };
/** The stat sheet's full bar (no class starts above 35). */
const ATTR_MAX = 40;
export const HOLD_MS = 600;

/**
 * Opens the class pick over `host` and calls `onPick` once with the chosen class, after the exit
 * transition. Returns a handle to close it early.
 */
export function openClassPick(host: HTMLElement, onPick: (cls: ClassId) => void, initial: ClassId = "ghost", hooks: ClassPickHooks = {}): ClassPickHandle {
  const prevFocus = document.activeElement as HTMLElement | null;
  const still = hooks.still || reducedMotion();
  let selected: ClassId = initial;
  let done = false;

  const root = el("section", "cp", host);
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "cp-title");

  // ---- left: the question, the names, and the chosen one's words ----
  const left = el("div", "cp-left", root);
  const head = el("header", "cp-head", left);
  el("p", "cp-eyebrow", head, "Case file · Hollowell Proper");
  const title = el("h1", "cp-title", head, "Who walks back in?");
  title.id = "cp-title";

  const list = el("div", "cp-list", left);
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "Cath's class");
  const options = new Map<ClassId, HTMLButtonElement>();
  CLASS_IDS.forEach((cls, i) => {
    const opt = button(`cp-opt cls-${cls}`, list);
    opt.setAttribute("role", "radio");
    opt.dataset.cls = cls;
    el("span", "cp-opt-n", opt, String(i + 1)).setAttribute("aria-hidden", "true");
    el("span", "cp-opt-name", opt, CLASSES[cls].name);
    opt.addEventListener("click", () => select(cls, true));
    options.set(cls, opt);
  });

  const words = el("div", "cp-words", left);
  words.setAttribute("aria-live", "polite");
  const kicker = el("p", "cp-kicker", words);
  const line = el("p", "cp-line", words);
  const plays = el("p", "cp-plays", words);

  // ---- right: the stat sheet ----
  const sheet = el("aside", "cp-sheet", root);
  sheet.setAttribute("aria-label", "Starting file");
  el("p", "cp-label", sheet, "Starts with");
  const attrs = el("dl", "cp-attrs", sheet);
  const bars = new Map<AttributeId, { row: HTMLElement; n: HTMLElement; v: number }>();
  for (const a of ATTRIBUTES) {
    const row = el("div", "cp-attr", attrs);
    el("dt", "", row, ATTRIBUTE_LABEL[a]);
    const dd = el("dd", "cp-attr-v", row);
    const bar = el("span", "cp-bar", dd);
    bar.setAttribute("aria-hidden", "true");
    el("span", "cp-bar-fill", bar);
    for (let t = 1; t < ATTR_MAX / 5; t++) el("span", "cp-tick", bar).style.setProperty("--t", String(t / (ATTR_MAX / 5)));
    const n = el("span", "cp-attr-n", dd, "0");
    bars.set(a, { row, n, v: 0 });
  }
  const weapon = el("div", "cp-weapon", sheet);
  const trees = el("ul", "cp-trees", sheet);
  trees.setAttribute("aria-label", "Skill trees");

  // ---- the commit: hold the bar ----
  const go = button("cp-hold", sheet);
  go.setAttribute("aria-describedby", "cp-hold-how");
  const goFill = el("span", "cp-hold-fill", go);
  goFill.setAttribute("aria-hidden", "true");
  const goLabel = el("span", "cp-hold-label", go);
  const goHow = el("span", "cp-hold-how", go, "Hold");
  goHow.id = "cp-hold-how";

  let countRaf = 0;
  function renderDetail(): void {
    const cls = selected;
    const def = CLASSES[cls];
    const copy = CLASS_COPY[cls];
    root.dataset.cls = cls;
    kicker.textContent = def.fantasy.replace(/\.$/, "");
    line.textContent = `“${copy.line}”`;
    plays.textContent = copy.playsLike;
    for (const e of [kicker, line, plays]) {
      e.classList.remove("is-in");
      void e.offsetWidth;
      e.classList.add("is-in");
    }

    // The bars count up from where they were to the new class's numbers over 350 ms.
    const start = CLASS_START_ATTRIBUTES[cls];
    const from = new Map([...bars].map(([a, b]) => [a, b.v]));
    const t0 = performance.now();
    cancelAnimationFrame(countRaf);
    const step = () => {
      const u = still ? 1 : Math.min(1, (performance.now() - t0) / 350);
      const e = 1 - Math.pow(1 - u, 3);
      for (const [a, b] of bars) {
        const v = from.get(a)! + (start[a] - from.get(a)!) * e;
        b.v = v;
        b.row.style.setProperty("--v", (v / ATTR_MAX).toFixed(4));
        b.n.textContent = String(Math.round(v));
      }
      if (u < 1) countRaf = requestAnimationFrame(step);
    };
    step();

    weapon.replaceChildren();
    const fresh = newCharacter(cls);
    const w = WEAPON_BASES[STARTING_WEAPON[cls]];
    if (w) el("span", "cp-label", weapon, WEAPON_CLASS_LABEL[w.cls] ?? w.cls);
    el("span", "cp-weapon-name", weapon, fresh.equipment.weapon1?.name ?? w?.name ?? "");
    if (w) {
      const nums = el("dl", "cp-weapon-nums", weapon);
      const pair = (k: string, v: string) => {
        const d = el("div", "", nums);
        el("dt", "", d, k);
        el("dd", "", d, v);
      };
      pair("Damage", w.pellets > 1 ? `${w.damage} × ${w.pellets}` : String(w.damage));
      pair("Rate", `${w.fireRate}/s`);
      pair("Magazine", w.magazine > 0 ? String(w.magazine) : "—");
    }
    el("p", "cp-weapon-pin", weapon, "and the Pin, her steel baton.");

    trees.replaceChildren();
    for (const t of def.trees) {
      const li = el("li", "cp-tree", trees);
      el("span", "cp-tree-name", li, TREES[t].name);
      el("span", "cp-tree-theme", li, TREES[t].theme);
    }
    goLabel.textContent = `Walk in as the ${def.name}`;
  }

  function select(cls: ClassId, focus: boolean): void {
    const changed = cls !== selected || !root.dataset.cls;
    selected = cls;
    for (const [c, opt] of options) {
      const on = c === cls;
      opt.setAttribute("aria-checked", String(on));
      opt.tabIndex = on ? 0 : -1;
      if (on && focus) opt.focus();
    }
    if (changed) {
      renderDetail();
      hooks.onSelect?.(cls);
    }
  }

  // ---- hold to commit ----
  let holdT0 = 0;
  let holdTimer = 0;
  let thumpTimer = 0;
  function holdStart(): void {
    if (done || holdT0) return;
    holdT0 = performance.now();
    go.classList.add("is-holding");
    hooks.onThump?.();
    thumpTimer = window.setTimeout(() => hooks.onThump?.(), HOLD_MS / 2);
    holdTimer = window.setTimeout(commit, still ? 0 : HOLD_MS);
  }
  function holdCancel(): void {
    if (done || !holdT0) return;
    holdT0 = 0;
    clearTimeout(holdTimer);
    clearTimeout(thumpTimer);
    go.classList.remove("is-holding");
  }
  go.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    go.setPointerCapture?.(e.pointerId);
    holdStart();
  });
  go.addEventListener("pointerup", holdCancel);
  go.addEventListener("pointercancel", holdCancel);
  go.addEventListener("lostpointercapture", holdCancel);
  go.addEventListener("contextmenu", (e) => e.preventDefault());

  function commit(): void {
    if (done) return;
    done = true;
    go.classList.add("is-done");
    const cls = selected;
    root.classList.add("cp-leaving");
    const finish = () => {
      root.remove();
      cleanup();
      onPick(cls);
    };
    if (still) finish();
    else setTimeout(finish, 520);
  }

  function onKey(ev: KeyboardEvent): void {
    if (done) return;
    const i = CLASS_IDS.indexOf(selected);
    const inList = list.contains(document.activeElement);
    let next: number | null = null;
    if (ev.key === "Enter" || (ev.key === " " && document.activeElement === go)) {
      ev.preventDefault();
      if (!ev.repeat) holdStart();
      return;
    }
    if (inList && (ev.key === "ArrowDown" || ev.key === "ArrowRight")) next = (i + 1) % CLASS_IDS.length;
    else if (inList && (ev.key === "ArrowUp" || ev.key === "ArrowLeft")) next = (i + CLASS_IDS.length - 1) % CLASS_IDS.length;
    else if (inList && ev.key === "Home") next = 0;
    else if (inList && ev.key === "End") next = CLASS_IDS.length - 1;
    else if (/^[1-5]$/.test(ev.key)) next = Number(ev.key) - 1;
    else if (ev.key === "Tab") {
      trapTab(root, ev);
      return;
    }
    if (next !== null) {
      ev.preventDefault();
      holdCancel();
      select(CLASS_IDS[next]!, true);
    }
  }
  function onKeyUp(ev: KeyboardEvent): void {
    if (ev.key === "Enter" || ev.key === " ") holdCancel();
  }
  const onBlur = () => holdCancel();
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("keyup", onKeyUp, true);
  addEventListener("blur", onBlur);
  function cleanup(): void {
    cancelAnimationFrame(countRaf);
    clearTimeout(holdTimer);
    clearTimeout(thumpTimer);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("keyup", onKeyUp, true);
    removeEventListener("blur", onBlur);
  }

  if (still) root.classList.add("cp-still");
  select(selected, false);
  requestAnimationFrame(() => {
    root.classList.add("cp-in");
    options.get(selected)?.focus();
  });

  return {
    close() {
      if (done) return;
      done = true;
      root.remove();
      cleanup();
      prevFocus?.focus?.();
    },
  };
}
