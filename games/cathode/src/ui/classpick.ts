// The class pick: a full-screen case file where the player chooses how Cath works. Five classes down the
// side (a radio group: arrows, Home/End and 1–5 move, Enter or the button commits), the chosen one's file
// open beside it: emblem, one-liner, how it plays, its three trees, starting attributes and weapon.

import { CLASSES, TREES } from "../sim/classes";
import { STARTING_WEAPON, newCharacter } from "../sim/character";
import { CLASS_START_ATTRIBUTES } from "../sim/stats";
import { ATTRIBUTES, CLASS_IDS, type AttributeId, type ClassId } from "../sim/types";
import { WEAPON_BASES } from "../sim/weapons";
import { CLASS_COPY, classEmblem } from "./classart";
import { button, cssVar, el, reducedMotion, trapTab } from "./dom";
import { WEAPON_CLASS_LABEL } from "./itemtext";

export interface ClassPickHandle {
  /** Removes the screen without picking. */
  close(): void;
}

export const ATTRIBUTE_LABEL: Record<AttributeId, string> = { grit: "Grit", aim: "Aim", nerve: "Nerve", wire: "Wire" };

/** The highest starting value any class has in one attribute (bars are drawn against it). */
const ATTR_SCALE = 40;

/**
 * Opens the class pick over `host` and calls `onPick` once with the chosen class, after the exit
 * transition. Returns a handle to close it early.
 */
export function openClassPick(host: HTMLElement, onPick: (cls: ClassId) => void, initial: ClassId = "ghost"): ClassPickHandle {
  const prevFocus = document.activeElement as HTMLElement | null;
  let selected: ClassId = initial;
  let done = false;

  const root = el("section", "cp", host);
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "cp-title");
  el("div", "cp-rain", root).setAttribute("aria-hidden", "true");
  el("div", "cp-glow", root).setAttribute("aria-hidden", "true");

  const head = el("header", "cp-head", root);
  el("p", "eyebrow cp-eyebrow", head, "Case file · Hollowell Proper");
  const title = el("h1", "cp-title", head, "Who walks back in?");
  title.id = "cp-title";

  const body = el("div", "cp-body", root);
  const list = el("div", "cp-list", body);
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "Cath's class");

  const options = new Map<ClassId, HTMLButtonElement>();
  for (const cls of CLASS_IDS) {
    const opt = button(`cp-opt cls-${cls}`, list);
    opt.setAttribute("role", "radio");
    opt.dataset.cls = cls;
    opt.append(classEmblem(cls));
    const words = el("span", "cp-opt-words", opt);
    el("span", "cp-opt-name", words, CLASSES[cls].name);
    el("span", "cp-opt-fantasy", words, CLASSES[cls].fantasy.replace(/\.$/, ""));
    el("span", "cp-opt-file", opt, CLASS_COPY[cls].file).setAttribute("aria-hidden", "true");
    opt.addEventListener("click", () => select(cls, true));
    opt.addEventListener("dblclick", () => commit());
    options.set(cls, opt);
  }

  const detail = el("article", "cp-detail", body);
  detail.setAttribute("aria-live", "polite");

  const go = button("btn btn-primary cp-go", null);
  go.addEventListener("click", () => commit());

  function renderDetail(): void {
    const cls = selected;
    const def = CLASSES[cls];
    const copy = CLASS_COPY[cls];
    detail.replaceChildren();
    detail.className = `cp-detail cls-${cls}`;

    const art = el("div", "cp-art", detail);
    art.append(classEmblem(cls));
    el("span", "cp-art-file", art, `No. ${copy.file}`).setAttribute("aria-hidden", "true");

    const words = el("div", "cp-words", detail);
    el("p", "cp-kicker", words, def.fantasy);
    el("h2", "cp-name", words, def.name);
    el("p", "cp-line", words, `“${copy.line}”`);
    const plays = el("p", "cp-plays", words);
    el("span", "cp-label", plays, "Plays like");
    plays.append(document.createTextNode(copy.playsLike));

    const trees = el("ul", "cp-trees", words);
    trees.setAttribute("aria-label", "Skill trees");
    for (const t of def.trees) {
      const li = el("li", "cp-tree", trees);
      el("span", "cp-tree-name", li, TREES[t].name);
      el("span", "cp-tree-theme", li, TREES[t].theme);
    }

    const kit = el("div", "cp-kit", detail);
    el("p", "cp-label cp-kit-label", kit, "Starts with");
    const attrs = el("dl", "cp-attrs", kit);
    const start = CLASS_START_ATTRIBUTES[cls];
    for (const a of ATTRIBUTES) {
      const row = el("div", "cp-attr", attrs);
      el("dt", "", row, ATTRIBUTE_LABEL[a]);
      const dd = el("dd", "", row);
      const bar = el("span", "cp-bar", dd);
      bar.setAttribute("aria-hidden", "true");
      cssVar(bar, "--v", Math.min(1, start[a] / ATTR_SCALE).toFixed(3));
      el("span", "cp-attr-n", dd, String(start[a]));
    }
    const fresh = newCharacter(cls);
    const w = WEAPON_BASES[STARTING_WEAPON[cls]];
    const weapon = el("div", "cp-weapon", kit);
    if (w) el("span", "cp-weapon-class", weapon, WEAPON_CLASS_LABEL[w.cls] ?? w.cls);
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
    el("p", "cp-weapon-pin", kit, "and the Pin, her steel baton.");

    go.textContent = `Walk in as the ${def.name}`;
    kit.append(go);
  }

  function select(cls: ClassId, focus: boolean): void {
    selected = cls;
    root.className = `cp cls-${cls}`;
    for (const [c, opt] of options) {
      const on = c === cls;
      opt.setAttribute("aria-checked", String(on));
      opt.tabIndex = on ? 0 : -1;
      if (on && focus) opt.focus();
    }
    renderDetail();
  }

  function commit(): void {
    if (done) return;
    done = true;
    const cls = selected;
    root.classList.add("cp-leaving");
    const finish = () => {
      root.remove();
      document.removeEventListener("keydown", onKey, true);
      onPick(cls);
    };
    if (reducedMotion()) finish();
    else setTimeout(finish, 520);
  }

  function onKey(ev: KeyboardEvent): void {
    if (done) return;
    const i = CLASS_IDS.indexOf(selected);
    const inList = list.contains(document.activeElement);
    let next: number | null = null;
    if (inList && (ev.key === "ArrowDown" || ev.key === "ArrowRight")) next = (i + 1) % CLASS_IDS.length;
    else if (inList && (ev.key === "ArrowUp" || ev.key === "ArrowLeft")) next = (i + CLASS_IDS.length - 1) % CLASS_IDS.length;
    else if (inList && ev.key === "Home") next = 0;
    else if (inList && ev.key === "End") next = CLASS_IDS.length - 1;
    else if (/^[1-5]$/.test(ev.key)) next = Number(ev.key) - 1;
    else if (ev.key === "Enter" && inList) {
      ev.preventDefault();
      commit();
      return;
    } else if (ev.key === "Tab") {
      trapTab(root, ev);
      return;
    }
    if (next !== null) {
      ev.preventDefault();
      select(CLASS_IDS[next]!, true);
    }
  }
  document.addEventListener("keydown", onKey, true);

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
      document.removeEventListener("keydown", onKey, true);
      prevFocus?.focus?.();
    },
  };
}
