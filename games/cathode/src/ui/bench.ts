// Plan item 16: the gun bench in Cath's office. The camera looks down on the gun lying on the bench (the session
// draws it with its fitted parts, `game/gunparts.ts`), and this screen sits beside it: the gun's name and tier, its
// numbers as bars, the five part slots, and for the chosen slot the parts that fit it with their price and what
// they change. Fitting a part buys it (Ana's prices) and the gun on the bench changes under the lamp.

import type { Character } from "../sim/character";
import type { Result } from "../sim/skills";
import { fitWeaponPart, stripWeaponPart, upgradeWeaponTier } from "../sim/character";
import { EQUIP_SLOTS, itemMods, type Item } from "../sim/loot";
import { PART_SLOTS, TIER_NAMES, WEAPON_BASES, WEAPON_PARTS, partFits, upgradeCost, weaponStats, type PartSlot, type WeaponPart, type WeaponStats } from "../sim/weapons";
import { button, cssVar, el, trapTab } from "./dom";

export const SLOT_NAME: Record<PartSlot, string> = { barrel: "Barrel", scope: "Optic", suppressor: "Muzzle", mag: "Magazine", stock: "Stock" };

/** The weapons the bench can work on: worn first (in slot order), then the bag. Melee has no parts. */
export function benchWeapons(c: Character): Item[] {
  const worn = EQUIP_SLOTS.map((s) => c.equipment[s]).filter((i): i is Item => i?.kind === "weapon");
  const all = [...worn, ...c.inventory.filter((i) => i.kind === "weapon")];
  return all.filter((i) => {
    const cls = WEAPON_BASES[i.base]?.cls;
    return !!cls && cls !== "melee";
  });
}

/** The numbers the gun fires with, given a parts map (so a part's preview is the same sum as the real thing). */
export function benchStats(item: Item, parts: Item["parts"] = item.parts): WeaponStats | null {
  const base = WEAPON_BASES[item.base];
  if (!base) return null;
  return weaponStats(base, { itemLevel: item.level, tier: item.tier, parts, mods: itemMods(item).local, name: item.name });
}

/** The bars: label, value, which way is better, and the reference that fills the bar. */
const BARS: ReadonlyArray<{ k: string; label: string; of: (s: WeaponStats) => number; fmt: (v: number) => string; low?: boolean }> = [
  { k: "damage", label: "Damage", of: (s) => s.damage * Math.max(1, s.pellets), fmt: (v) => String(Math.round(v)) },
  { k: "rate", label: "Rate", of: (s) => s.fireRate, fmt: (v) => `${v.toFixed(1)}/s` },
  { k: "mag", label: "Magazine", of: (s) => s.magazine, fmt: (v) => String(Math.round(v)) },
  { k: "reload", label: "Reload", of: (s) => s.reload, fmt: (v) => `${v.toFixed(2)} s`, low: true },
  { k: "range", label: "Range", of: (s) => s.falloff.end, fmt: (v) => `${Math.round(v)} m` },
  { k: "noise", label: "Noise", of: (s) => s.noise, fmt: (v) => `${Math.round(v)} m`, low: true },
];

/** A part's effect in words ("+25% falloff, -5% aim speed"). */
const STAT_WORD: Record<string, string> = {
  damage: "damage", fireRate: "rate", magazine: "magazine", reloadSpeed: "reload speed", spread: "spread", recoil: "recoil", falloff: "range",
  range: "reach", noise: "noise", velocity: "velocity", adsSpeed: "aim speed", sway: "sway", zoom: "zoom", pierce: "pierce", critBonus: "crit", pellets: "pellets", penetration: "penetration",
};
export function partLine(p: WeaponPart): string {
  const bits = p.mods.map((m) => (m.kind === "flat" ? `${m.value > 0 ? "+" : "−"}${Math.abs(m.value)}${m.stat === "zoom" ? "×" : ""} ${STAT_WORD[m.stat]}` : `${m.value > 0 ? "+" : "−"}${Math.abs(m.value)}% ${STAT_WORD[m.stat]}`));
  if (p.subsonic) bits.push("subsonic");
  else if (p.suppresses) bits.push("suppressed");
  return bits.join(", ");
}

export interface BenchHandle {
  close(): void;
  /** The weapon on the bench now (the session lays it out). */
  readonly uid: string | null;
}

/**
 * Opens the bench over `parent`. `onShow(item)` is called whenever the gun on the bench changes (a part fitted, a
 * tier raised, another weapon picked) so the session can redraw it; `onClose` when she steps away.
 */
export function openBench(
  parent: Element,
  getChar: () => Character,
  setChar: (c: Character) => void,
  onShow: (item: Item | null) => void,
  onClose: () => void,
): BenchHandle {
  const wrap = el("div", "bench", parent);
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", "Gun bench");
  const panel = el("section", "bench-panel", wrap);
  let uid: string | null = benchWeapons(getChar())[0]?.uid ?? null;
  let slot: PartSlot = "barrel";
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
    const guns = benchWeapons(c);
    const item = guns.find((g) => g.uid === uid) ?? guns[0] ?? null;
    uid = item?.uid ?? null;
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.k;
    panel.replaceChildren();
    onShow(item);
    const head = el("header", "bench-head", panel);
    el("p", "bench-eyebrow", head, "Gun bench");
    if (!item) {
      el("h2", "bench-name", head, "Nothing to work on");
      el("p", "bench-note", panel, "Bring a gun home and it goes on the bench.");
    } else {
      el("h2", "bench-name", head, item.name);
      const cls = WEAPON_BASES[item.base]?.cls;
      el("p", "bench-sub", head, `Tier ${TIER_NAMES[item.tier - 1]} · ${(cls ?? "").charAt(0).toUpperCase()}${(cls ?? "").slice(1)} · ${c.scrip} Scrip`);
      if (guns.length > 1) {
        const picks = el("nav", "bench-guns", panel);
        picks.setAttribute("aria-label", "Weapons");
        for (const g of guns) {
          const b = button(`bench-gun${g.uid === item.uid ? " is-on" : ""}`, picks, g.name);
          b.dataset.k = `gun:${g.uid}`;
          b.setAttribute("aria-pressed", String(g.uid === item.uid));
          b.addEventListener("click", () => {
            uid = g.uid;
            note = "";
            render();
          });
        }
      }

      // The numbers, with the chosen slot's hovered part previewed as a ghost over each bar.
      const now = benchStats(item);
      const bars = el("dl", "bench-bars", panel);
      const barEls = new Map<string, HTMLElement>();
      if (now) {
        const ref = benchStats({ ...item, tier: 5 }, {}) ?? now;
        for (const b of BARS) {
          el("dt", "", bars, b.label);
          const dd = el("dd", "", bars);
          const track = el("span", "bench-bar", dd);
          const v = b.of(now);
          const r = b.of(ref) * (b.low ? 1 : 1.6);
          cssVar(track, "--v", Math.max(0.03, Math.min(1, b.low ? 1 - Math.min(1, v / Math.max(1e-6, r * 1.8)) : v / Math.max(1e-6, r))));
          el("i", "bench-bar-ghost", track);
          el("b", "bench-val", dd, b.fmt(v));
          barEls.set(b.k, dd);
        }
      }
      const preview = (p: WeaponPart | null): void => {
        if (!now) return;
        const next = p ? benchStats(item, { ...item.parts, [p.slot]: p.id }) : null;
        for (const b of BARS) {
          const dd = barEls.get(b.k)!;
          const d = next ? b.of(next) - b.of(now) : 0;
          const better = b.low ? d < 0 : d > 0;
          dd.dataset.delta = Math.abs(d) < 1e-3 ? "" : better ? "up" : "down";
          const val = dd.querySelector<HTMLElement>(".bench-val")!;
          val.textContent = next && Math.abs(d) >= 1e-3 ? `${b.fmt(b.of(now))} → ${b.fmt(b.of(next))}` : b.fmt(b.of(now));
        }
      };

      // The slots: what's fitted in each, Factory when nothing.
      const slots = el("ol", "bench-slots", panel);
      slots.setAttribute("aria-label", "Parts");
      for (const s of PART_SLOTS) {
        const fits = Object.values(WEAPON_PARTS).filter((p) => p.slot === s && cls && partFits(p, cls));
        if (fits.length === 0) continue;
        const li = el("li", s === slot ? "is-on" : "", slots);
        const b = button("bench-slot", li);
        b.dataset.k = `slot:${s}`;
        b.setAttribute("aria-expanded", String(s === slot));
        el("span", "bench-slot-name", b, SLOT_NAME[s]);
        const fitted = item.parts[s] ? WEAPON_PARTS[item.parts[s]!] : undefined;
        el("span", "bench-slot-part", b, fitted?.name ?? "Factory");
        b.addEventListener("click", () => {
          slot = s;
          note = "";
          render();
        });
        if (s !== slot) continue;
        const opts = el("ul", "bench-opts", li);
        for (const p of fits) {
          const on = item.parts[s] === p.id;
          const o = button(`bench-opt${on ? " is-fitted" : ""}`, el("li", "", opts));
          o.dataset.k = `part:${p.id}`;
          el("span", "bench-opt-name", o, p.name);
          el("span", "bench-opt-cost", o, on ? "Fitted" : `${p.cost} Scrip`);
          el("span", "bench-opt-line", o, partLine(p));
          o.disabled = !on && c.scrip < p.cost;
          o.addEventListener("pointerenter", () => preview(p));
          o.addEventListener("focus", () => preview(p));
          o.addEventListener("pointerleave", () => preview(null));
          o.addEventListener("blur", () => preview(null));
          o.addEventListener("click", () => (on ? undefined : run(fitWeaponPart(getChar(), item.uid, p.id), `${p.name} fitted.`)));
        }
        if (item.parts[s]) {
          const o = button("bench-opt is-strip", el("li", "", opts));
          o.dataset.k = `strip:${s}`;
          el("span", "bench-opt-name", o, "Back to factory");
          el("span", "bench-opt-line", o, "Ana scraps the part");
          o.addEventListener("click", () => run(stripWeaponPart(getChar(), item.uid, s), "Back to factory."));
        }
      }

      const cost = upgradeCost(item.tier, item.level);
      const tier = button("bench-tier", panel);
      tier.dataset.k = "tier";
      el("span", "", tier, cost === null ? "Tier V, the best Ana does" : `Raise to tier ${TIER_NAMES[Math.min(4, item.tier)]}`);
      if (cost !== null) el("span", "bench-opt-cost", tier, `${cost} Scrip`);
      tier.disabled = cost === null || c.scrip < cost;
      tier.addEventListener("click", () => run(upgradeWeaponTier(getChar(), item.uid), "Tier raised."));
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
    onShow(null);
    onClose();
  }
  window.addEventListener("keydown", onKey, true);
  render();
  return {
    close,
    get uid() {
      return uid;
    },
  };
}
