// Plan item 16: the wardrobe in Cath's office. The camera turns on Cath at the long mirror (the session stands her
// there and frames her), and this screen sits beside her: what she's wearing on her head, back, hands and feet,
// what it gives her (armour, health, stealth, resistances), and the pieces in the bag for each, with what changes
// if she puts them on. Wearing one is the same `equip` the character sheet uses.

import type { Character } from "../sim/character";
import { characterStats, equip, unequip } from "../sim/character";
import { canEquip, itemMods, type Item } from "../sim/loot";
import type { Result } from "../sim/skills";
import type { DerivedStats } from "../sim/stats";
import { modText } from "./itemtext";
import { button, el, trapTab } from "./dom";

export type WardrobeSlot = "head" | "coat" | "gloves" | "boots";
export const WARDROBE_SLOTS: readonly WardrobeSlot[] = ["head", "coat", "gloves", "boots"];
export const WARDROBE_NAME: Record<WardrobeSlot, string> = { head: "Hat", coat: "Coat", gloves: "Gloves", boots: "Boots" };

/** The numbers the wardrobe shows: what clothes change. */
const NUMS: ReadonlyArray<{ k: string; label: string; of: (s: DerivedStats) => number; fmt: (v: number) => string }> = [
  { k: "armour", label: "Armour", of: (s) => s.armour, fmt: (v) => String(Math.round(v)) },
  { k: "health", label: "Health", of: (s) => s.maxHealth, fmt: (v) => String(Math.round(v)) },
  { k: "stealth", label: "Stealth", of: (s) => s.stealth, fmt: (v) => String(Math.round(v)) },
  { k: "move", label: "Pace", of: (s) => s.moveSpeed, fmt: (v) => `${v.toFixed(1)} m/s` },
  { k: "resist", label: "Resist", of: (s) => (s.resistances.shock + s.resistances.incendiary + s.resistances.toxic) / 3, fmt: (v) => `${Math.round(v * 100)}%` },
];

/** What a piece says in one line: its first few modifiers in words. */
export function pieceLine(item: Item): string {
  return itemMods(item)
    .global.slice(0, 3)
    .map((m) => modText(m.stat, m.kind, m.value))
    .join(", ");
}

/** The bag's pieces for a slot, the ones she can wear first. */
export function piecesFor(c: Character, slot: WardrobeSlot): Item[] {
  const attrs = characterStats(c).attributes;
  return c.inventory.filter((i) => i.kind === "gear" && i.slot === slot).sort((a, b) => Number(canEquip(b, c.level, attrs)) - Number(canEquip(a, c.level, attrs)));
}

export interface WardrobeHandle {
  close(): void;
}

export function openWardrobe(parent: Element, getChar: () => Character, setChar: (c: Character) => void, onClose: () => void): WardrobeHandle {
  const wrap = el("div", "bench wardrobe", parent);
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", "Wardrobe");
  const panel = el("section", "bench-panel", wrap);
  let slot: WardrobeSlot = "coat";
  let note = "";
  let closed = false;

  const run = (r: Result<Character>, ok: string): void => {
    if (!r.ok) note = r.reason.charAt(0).toUpperCase() + r.reason.slice(1) + ".";
    else {
      setChar(r.value);
      note = ok;
    }
    render();
  };

  function render(): void {
    const c = getChar();
    const now = characterStats(c);
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.k;
    panel.replaceChildren();
    const head = el("header", "bench-head", panel);
    el("p", "bench-eyebrow", head, "Wardrobe");
    el("h2", "bench-name", head, "Tonight's coat");
    el("p", "bench-sub", head, "Rain on the glass. Something that won't show the blood.");

    const nums = el("dl", "bench-bars wardrobe-nums", panel);
    const vals = new Map<string, HTMLElement>();
    for (const n of NUMS) {
      el("dt", "", nums, n.label);
      const dd = el("dd", "", nums);
      vals.set(n.k, el("b", "bench-val", dd, n.fmt(n.of(now))));
    }
    const preview = (next: Character | null): void => {
      const s = next ? characterStats(next) : null;
      for (const n of NUMS) {
        const v = vals.get(n.k)!;
        const d = s ? n.of(s) - n.of(now) : 0;
        const dd = v.parentElement!;
        dd.dataset.delta = Math.abs(d) < 1e-3 ? "" : d > 0 ? "up" : "down";
        v.textContent = s && Math.abs(d) >= 1e-3 ? `${n.fmt(n.of(now))} → ${n.fmt(n.of(s))}` : n.fmt(n.of(now));
      }
    };

    const slots = el("ol", "bench-slots", panel);
    slots.setAttribute("aria-label", "Clothes");
    for (const s of WARDROBE_SLOTS) {
      const worn = c.equipment[s];
      const li = el("li", s === slot ? "is-on" : "", slots);
      const b = button("bench-slot", li);
      b.dataset.k = `slot:${s}`;
      b.setAttribute("aria-expanded", String(s === slot));
      el("span", "bench-slot-name", b, WARDROBE_NAME[s]);
      const name = el("span", "bench-slot-part", b, worn?.name ?? "Nothing");
      if (worn) name.dataset.rarity = worn.rarity;
      b.addEventListener("click", () => {
        slot = s;
        note = "";
        render();
      });
      if (s !== slot) continue;
      const opts = el("ul", "bench-opts", li);
      if (worn) {
        const o = button("bench-opt is-fitted", el("li", "", opts));
        o.dataset.k = `worn:${s}`;
        el("span", "bench-opt-name", o, worn.name).dataset.rarity = worn.rarity;
        el("span", "bench-opt-cost", o, "Wearing");
        el("span", "bench-opt-line", o, pieceLine(worn) || "Plain");
        o.addEventListener("click", () => run(unequip(getChar(), s), `${worn.name} back in the wardrobe.`));
        o.setAttribute("aria-label", `${worn.name}, wearing. Take it off`);
      }
      const attrs = now.attributes;
      const bag = piecesFor(c, s);
      for (const it of bag) {
        const o = button("bench-opt", el("li", "", opts));
        o.dataset.k = `wear:${it.uid}`;
        el("span", "bench-opt-name", o, it.name).dataset.rarity = it.rarity;
        const ok = canEquip(it, c.level, attrs);
        el("span", "bench-opt-cost", o, ok ? "Wear" : "Can't yet");
        el("span", "bench-opt-line", o, pieceLine(it) || "Plain");
        o.disabled = !ok;
        const trial = equip(c, it.uid, s);
        o.addEventListener("pointerenter", () => preview(trial.ok ? trial.value : null));
        o.addEventListener("focus", () => preview(trial.ok ? trial.value : null));
        o.addEventListener("pointerleave", () => preview(null));
        o.addEventListener("blur", () => preview(null));
        o.addEventListener("click", () => run(equip(getChar(), it.uid, s), `${it.name} on.`));
      }
      if (!worn && bag.length === 0) el("li", "bench-empty", opts, "Nothing in the bag for this.");
      else if (bag.length === 0) el("li", "bench-empty", opts, "Nothing else in the bag. The street drops better.");
    }

    const foot = el("footer", "bench-foot", panel);
    const say = el("p", "bench-note", foot, note);
    say.setAttribute("role", "status");
    const back = button("btn btn-primary bench-back", foot, "Step away");
    back.dataset.k = "back";
    back.addEventListener("click", close);
    const again = focusKey ? panel.querySelector<HTMLElement>(`[data-k="${CSS.escape(focusKey)}"]`) : null;
    (again ?? panel.querySelector<HTMLElement>(".bench-slot") ?? back).focus({ preventScroll: true });
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.code === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.code === "Tab") trapTab(wrap, e);
  };
  function close(): void {
    if (closed) return;
    closed = true;
    window.removeEventListener("keydown", onKey, true);
    wrap.remove();
    onClose();
  }
  window.addEventListener("keydown", onKey, true);
  render();
  return { close };
}
