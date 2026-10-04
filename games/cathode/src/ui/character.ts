// The character screen: Cath's dossier, in three tabs.
// - Attributes: spend points on Grit/Aim/Nerve/Wire, with every derived number live and a before→after
//   preview while a + button is hovered or focused.
// - Skills: Diablo II-style trees (three per class, six level-gated rows, prerequisite traces), the
//   second class and its hybrid capstone, and respecs.
// - Inventory: the nine equipment slots and the bag, with rarity-coloured item tooltips.
// Everything goes through the pure rules in ../sim; this file only draws and forwards intents.
// CSP-safe: no innerHTML with data (Cath's own SVG generator is the only markup injected), no style
// attributes; positions and sizes travel as CSS custom properties.

import { cathSvg } from "../../../../shared/cath/cath";
import {
  allocateAttribute,
  characterStats,
  equip,
  fitWeaponPart,
  sellItem,
  sellValue,
  socketInto,
  stripWeaponPart,
  upgradeWeaponTier,
  respecCharacter,
  respecRefund,
  takeSecondClass,
  unequip,
  type Character,
} from "../sim/character";
import type { Result } from "../sim/skills";
import { CLASSES, DUAL_CLASS_LEVEL, SKILLS, TREES, hybridFor, treeSkills, type SkillDef } from "../sim/classes";
import {
  CHIP_BY_ID,
  EQUIP_SLOTS,
  GEAR_BASES,
  SET_BY_ID,
  SET_PIECE_BY_ID,
  UNIQUE_BY_ID,
  affixText,
  chainOf,
  cyberwareLoad,
  equipmentModifiers,
  itemLevelRequirement,
  itemRequirements,
  itemWeaponStats,
  slotKind,
  type EquipSlot,
  type Item,
} from "../sim/loot";
import {
  cannotSpend,
  rankOf,
  refundSkill,
  requiredLevel,
  respecCost,
  spendSkill,
  synergyBonus,
  describeAtRank,
  effectiveRank,
} from "../sim/skills";
import { sumModifiers, xpForLevel, xpToNext, MAX_LEVEL, type DerivedStats, type StatTotals } from "../sim/stats";
import { ATTRIBUTES, CLASS_IDS, WEAPON_CLASSES, type AttributeId, type ClassId, type WeaponClass } from "../sim/types";
import { PART_SLOTS, TIER_NAMES, WEAPON_BASES, WEAPON_PARTS, partFits, upgradeCost } from "../sim/weapons";
import { CLASS_COPY, classEmblem, itemGlyph } from "./classart";
import { ATTRIBUTE_LABEL } from "./classpick";
import { attrs, button, cssVar, el, num, reducedMotion, svg, trapTab } from "./dom";
import { RARITY_LABEL, WEAPON_CLASS_LABEL, baseName, fixedModText, itemTypeLine, modText, scripText } from "./itemtext";
import { importCode } from "../sim/save";
import { cachedLayout, tracePath } from "./treelayout";

export type CharacterTab = "attributes" | "skills" | "inventory";

export interface CharacterOptions {
  /** The tab to open on (default: skills if there are skill points to spend, else attributes). */
  tab?: CharacterTab;
  /** The save's export code; when given, the tab bar gets a "Save code" button to copy it or paste one. */
  exportCode?: () => string;
}

export interface CharacterHandle {
  /** Closes the screen (calls `onClose`). */
  close(): void;
  /** Redraws from `getChar()` (call after the character changes from outside, e.g. a level-up). */
  refresh(): void;
  /** Switches tab. */
  show(tab: CharacterTab): void;
}

const TABS: { id: CharacterTab; label: string }[] = [
  { id: "attributes", label: "Attributes" },
  { id: "skills", label: "Skills" },
  { id: "inventory", label: "Inventory" },
];

const ATTRIBUTE_GIVES: Record<AttributeId, string> = {
  grit: "+2 health, +1% melee damage, +2 carry",
  aim: "+1% gun damage, +0.5% crit chance, −0.4% recoil, faster aim",
  nerve: "+1% stealth, +0.5% bullet-time, +1% headshot damage",
  wire: "+2 cyberware capacity, +1% hack strength, +1 battery",
};

const SLOT_LABEL: Record<EquipSlot, string> = {
  head: "Hat",
  coat: "Coat",
  gloves: "Gloves",
  boots: "Boots",
  cyber1: "Cyberware I",
  cyber2: "Cyberware II",
  cyber3: "Cyberware III",
  weapon1: "Weapon I",
  weapon2: "Weapon II",
};

/** Two-letter monogram for a skill node ("Held Breath" → "HB", "Ricochet" → "Ri"). */
export function monogram(name: string): string {
  const parts = name
    .replace(/[^A-Za-z\s-]/g, "")
    .split(/[\s-]+/)
    .filter((w) => w && !/^(the|of|in|a|on|for)$/i.test(w));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

// ---------------------------------------------------------------------------------------------------------
// Derived-stat rows
// ---------------------------------------------------------------------------------------------------------

interface StatRow {
  label: string;
  get(s: DerivedStats, c: Character): number;
  show(v: number, s: DerivedStats, c: Character): string;
  /** +1 when bigger is better, −1 when smaller is better. */
  better: 1 | -1;
  delta(d: number): string;
}

const pct = (v: number) => (Math.abs(v) < 0.5 ? "0%" : `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}%`);
const dp = (v: number, n = 1) => (Math.round(v * 10 ** n) / 10 ** n).toFixed(n);
const signed = (v: number, n = 0) => `${v >= 0 ? "+" : "−"}${n ? dp(Math.abs(v), n) : Math.round(Math.abs(v))}`;

function activeClass(c: Character): WeaponClass {
  const it = c.equipment[c.activeWeapon];
  return (it && WEAPON_BASES[it.base]?.cls) || "pistol";
}

const STAT_GROUPS: { title: string; rows: StatRow[] }[] = [
  {
    title: "Survival",
    rows: [
      { label: "Health", get: (s) => s.maxHealth, show: (v) => num(v), better: 1, delta: (d) => signed(d) },
      { label: "Armour", get: (s) => s.armour, show: (v) => num(v), better: 1, delta: (d) => signed(d) },
      { label: "Shield", get: (s) => s.shield, show: (v) => num(v), better: 1, delta: (d) => signed(d) },
      { label: "Carry", get: (s) => s.carry, show: (v) => num(v), better: 1, delta: (d) => signed(d) },
    ],
  },
  {
    title: "Gunplay",
    rows: [
      { label: "Melee damage", get: (s) => (s.meleeMultiplier - 1) * 100, show: pct, better: 1, delta: (d) => `${signed(d, 1)}%` },
      {
        label: "Weapon damage",
        get: (s, c) => (s.gunMultiplier[activeClass(c)] - 1) * 100,
        show: pct,
        better: 1,
        delta: (d) => `${signed(d, 1)}%`,
      },
      { label: "Critical chance", get: (s, c) => s.critChance[activeClass(c)] * 100, show: (v) => `${dp(v)}%`, better: 1, delta: (d) => `${signed(d, 1)}%` },
      { label: "Critical damage", get: (s, c) => s.critMultiplier[activeClass(c)], show: (v) => `×${dp(v, 2)}`, better: 1, delta: (d) => signed(d, 2) },
      { label: "Headshot", get: (s) => s.headshotMultiplier, show: (v) => `×${dp(v, 2)}`, better: 1, delta: (d) => signed(d, 2) },
      { label: "Recoil", get: (s, c) => s.recoilMultiplier[activeClass(c)] * 100, show: (v) => `${Math.round(v)}%`, better: -1, delta: (d) => `${signed(d, 1)}%` },
      { label: "Aim speed", get: (s) => s.adsSpeed * 100, show: (v) => `${Math.round(v)}%`, better: 1, delta: (d) => `${signed(d, 1)}%` },
    ],
  },
  {
    title: "Stealth",
    rows: [
      { label: "Stealth", get: (s) => s.stealth, show: (v) => `${Math.round(v)}%`, better: 1, delta: (d) => `${signed(d)}%` },
      { label: "Detection", get: (s) => s.detectionMultiplier, show: (v) => `×${dp(v, 2)}`, better: -1, delta: (d) => signed(d, 3) },
      { label: "Bullet-time", get: (s) => s.bulletTimeSeconds, show: (v) => `${dp(v, 2)} s`, better: 1, delta: (d) => `${signed(d, 2)} s` },
      { label: "Takedown reach", get: (s) => s.takedownRange, show: (v) => `${dp(v)} m`, better: 1, delta: (d) => `${signed(d, 1)} m` },
    ],
  },
  {
    title: "Wire",
    rows: [
      {
        label: "Cyberware",
        get: (s) => s.cyberwareCapacity,
        show: (v, _s, c) => `${cyberwareLoad(c.equipment)} / ${v}`,
        better: 1,
        delta: (d) => signed(d),
      },
      { label: "Hack strength", get: (s) => (s.hackStrength - 1) * 100, show: pct, better: 1, delta: (d) => `${signed(d)}%` },
      { label: "Battery", get: (s) => s.battery, show: (v) => num(v), better: 1, delta: (d) => signed(d) },
      { label: "Cooldowns", get: (s) => s.cooldownReduction * 100, show: (v) => (v < 0.5 ? "0%" : `−${Math.round(v)}%`), better: 1, delta: (d) => `${signed(d)}%` },
    ],
  },
  {
    title: "Resistances",
    rows: (["kinetic", "shock", "incendiary", "toxic", "monowire"] as const).map(
      (t): StatRow => ({
        label: t === "incendiary" ? "Fire" : t.charAt(0).toUpperCase() + t.slice(1),
        get: (s) => s.resistances[t] * 100,
        show: (v) => `${Math.round(v)}%`,
        better: 1,
        delta: (d) => `${signed(d)}%`,
      }),
    ),
  },
  {
    title: "Rewards",
    rows: [
      { label: "Experience", get: (s) => (s.xpMultiplier - 1) * 100, show: pct, better: 1, delta: (d) => `${signed(d)}%` },
      { label: "Magic find", get: (s) => s.magicFind, show: (v) => `${Math.round(v)}%`, better: 1, delta: (d) => `${signed(d)}%` },
      { label: "Scrip find", get: (s) => s.scripFind, show: (v) => `${Math.round(v)}%`, better: 1, delta: (d) => `${signed(d)}%` },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------------------------------------

/**
 * Opens the character screen over `host`. `getChar` reads the live character; `apply` hands back a new
 * one after any change (spend, refund, equip, respec, second class); `onClose` runs once on close.
 */
export function openCharacter(
  host: HTMLElement,
  getChar: () => Character,
  apply: (next: Character) => void,
  onClose: () => void,
  opts: CharacterOptions = {},
): CharacterHandle {
  const prevFocus = document.activeElement as HTMLElement | null;
  const first = getChar();
  let tab: CharacterTab = opts.tab ?? (first.unspentSkills > 0 ? "skills" : "attributes");
  let classView = 0;
  let closed = false;
  let pinned: string | null = null;
  let lastPointer: string = "mouse";
  let preview: AttributeId | null = null;
  let statusTimer = 0;
  let dialog: HTMLElement | null = null;
  let entering = true;

  const root = el("div", "cx", host);
  attrs(root, { role: "dialog", "aria-modal": "true", "aria-labelledby": "cx-name" });
  const panel = el("div", "cx-panel", root);

  // ---- header ----
  const head = el("header", "cx-head", panel);
  const portrait = el("div", "cx-portrait", head);
  portrait.setAttribute("aria-hidden", "true");
  portrait.innerHTML = cathSvg({ framing: "bust", expression: "determined", outfit: "gown" });
  const id = el("div", "cx-id", head);
  const classLine = el("p", "cx-classes", id);
  const name = el("h2", "cx-name", id);
  name.id = "cx-name";
  const levelLine = el("p", "cx-level", id);
  const xp = el("div", "cx-xp", id);
  xp.setAttribute("role", "progressbar");
  xp.setAttribute("aria-label", "Experience to the next level");
  const xpFill = el("span", "cx-xp-fill", xp);
  const xpText = el("p", "cx-xp-text", id);
  const quote = el("p", "cx-quote", head);
  const badges = el("div", "cx-badges", head);
  const closeBtn = button("cx-close", head);
  closeBtn.setAttribute("aria-label", "Close (Esc)");
  closeBtn.append(svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }));
  svg("path", { d: "M6 6 L18 18 M18 6 L6 18" }, closeBtn.firstElementChild);
  closeBtn.addEventListener("click", () => close());

  // ---- tabs ----
  const tabs = el("nav", "cx-tabs", panel);
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Character");
  const tabBtns = new Map<CharacterTab, HTMLButtonElement>();
  for (const t of TABS) {
    const b = button("cx-tab", tabs);
    attrs(b, { role: "tab", id: `cx-tab-${t.id}`, "aria-controls": "cx-main", "data-k": `tab:${t.id}` });
    el("span", "cx-tab-label", b, t.label);
    el("span", "cx-tab-dot", b).setAttribute("aria-hidden", "true");
    b.addEventListener("click", () => show(t.id, true));
    tabBtns.set(t.id, b);
  }
  if (opts.exportCode) {
    const code = opts.exportCode;
    button("cx-savecode", tabs, "Save code").addEventListener("click", () => openSaveCode(code));
  }
  tabs.addEventListener("keydown", (ev) => {
    const order = TABS.map((t) => t.id);
    const i = order.indexOf(tab);
    let n: number | null = null;
    if (ev.key === "ArrowRight") n = (i + 1) % order.length;
    if (ev.key === "ArrowLeft") n = (i + order.length - 1) % order.length;
    if (ev.key === "Home") n = 0;
    if (ev.key === "End") n = order.length - 1;
    if (n !== null) {
      ev.preventDefault();
      show(order[n]!, true);
      tabBtns.get(order[n]!)?.focus();
    }
  });

  const main = el("div", "cx-main", panel);
  attrs(main, { role: "tabpanel", id: "cx-main" });
  const status = el("p", "cx-status", panel);
  attrs(status, { role: "status", "aria-live": "polite" });

  const tip = el("div", "cx-tip", root);
  attrs(tip, { role: "tooltip", id: "cx-tip", hidden: true });

  // ---- helpers ----
  function say(text: string, tone: "bad" | "good" = "bad"): void {
    status.textContent = text;
    status.className = `cx-status on ${tone}`;
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => (status.className = "cx-status"), 2600);
  }

  function commit(next: Character, flashKey?: string): void {
    apply(next);
    render();
    if (flashKey) {
      const n = root.querySelector<HTMLElement>(`[data-k="${CSS.escape(flashKey)}"]`);
      if (n && !reducedMotion()) {
        n.classList.remove("cx-pop");
        void n.offsetWidth;
        n.classList.add("cx-pop");
      }
    }
  }

  function hideTip(): void {
    tip.hidden = true;
    tip.classList.remove("pinned");
    pinned = null;
    root.querySelectorAll("[aria-describedby='cx-tip']").forEach((e) => e.removeAttribute("aria-describedby"));
  }

  function placeTip(anchor: HTMLElement): void {
    tip.hidden = false;
    anchor.setAttribute("aria-describedby", "cx-tip");
    const r = anchor.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 12;
    let x = r.right + gap;
    if (x + t.width > vw - 8) x = r.left - gap - t.width;
    if (x < 8) x = Math.max(8, Math.min(vw - t.width - 8, r.left + r.width / 2 - t.width / 2));
    let y = r.top + r.height / 2 - t.height / 2;
    if (x === r.right + gap || x === r.left - gap - t.width) {
      y = Math.max(8, Math.min(vh - t.height - 8, y));
    } else {
      y = r.bottom + gap;
      if (y + t.height > vh - 8) y = Math.max(8, r.top - gap - t.height);
    }
    cssVar(tip, "--tx", `${Math.round(x)}px`);
    cssVar(tip, "--ty", `${Math.round(y)}px`);
  }

  // ---- header render ----
  function renderHead(c: Character): void {
    root.className = `cx cls-${c.classes[0] ?? "ghost"}`;
    classLine.replaceChildren();
    c.classes.forEach((cls, i) => {
      if (i > 0) el("span", "cx-amp", classLine, " × ");
      el("span", `cx-cls cls-${cls}`, classLine, CLASSES[cls].name);
    });
    name.textContent = c.name === "Cath" ? "Cath Hale" : c.name;
    levelLine.textContent = `Level ${c.level}`;
    quote.textContent = `“${CLASS_COPY[c.classes[0] ?? "ghost"].line}”`;
    const base = xpForLevel(c.level);
    const need = xpToNext(c.level);
    const share = c.level >= MAX_LEVEL || need === 0 ? 1 : Math.max(0, Math.min(1, (c.xp - base) / need));
    cssVar(xpFill, "--p", share.toFixed(4));
    attrs(xp, { "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(share * 100) });
    xpText.textContent = c.level >= MAX_LEVEL ? `${num(c.xp)} XP · the top` : `${num(c.xp - base)} / ${num(need)} XP`;

    badges.replaceChildren();
    const badge = (n: number, label: string, to: CharacterTab) => {
      const b = button(`cx-badge${n > 0 ? " on" : ""}`, badges);
      b.dataset.k = `badge:${to}`;
      el("span", "cx-badge-n", b, String(n));
      const l = el("span", "cx-badge-l", b, label);
      el("span", "cx-badge-pts", l, " points");
      b.setAttribute("aria-label", `${n} unspent ${label.toLowerCase()} points. Open ${to}.`);
      b.addEventListener("click", () => show(to, true));
    };
    badge(c.unspentAttributes, "Attribute", "attributes");
    badge(c.unspentSkills, "Skill", "skills");
    const scrip = el("p", "cx-scrip", badges);
    el("span", "cx-scrip-n", scrip, num(c.scrip));
    el("span", "cx-scrip-l", scrip, "Scrip");

    for (const [t, b] of tabBtns) {
      const on = t === tab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      const dot = (t === "attributes" && c.unspentAttributes > 0) || (t === "skills" && c.unspentSkills > 0);
      b.classList.toggle("has-points", dot);
    }
    main.setAttribute("aria-labelledby", `cx-tab-${tab}`);
  }

  // ---- attributes ----
  function renderAttributes(c: Character): void {
    const stats = characterStats(c);
    const wrap = el("div", "cx-attr-wrap", main);

    const left = el("section", "cx-attrs", wrap);
    left.setAttribute("aria-labelledby", "cx-attrs-h");
    const lh = el("header", "cx-sec-head", left);
    el("h3", "cx-sec-title", lh, "Attributes").id = "cx-attrs-h";
    el("p", "cx-sec-note", lh, c.unspentAttributes > 0 ? `${c.unspentAttributes} to spend` : "No points to spend");

    for (const a of ATTRIBUTES) {
      const row = el("div", `cx-arow attr-${a}`, left);
      const words = el("div", "cx-aword", row);
      el("p", "cx-aname", words, ATTRIBUTE_LABEL[a]);
      el("p", "cx-agives", words, ATTRIBUTE_GIVES[a]);
      const val = el("p", "cx-aval", row);
      el("span", "cx-aval-n", val, String(stats.attributes[a]));
      const bonus = stats.attributes[a] - c.attributes[a];
      if (bonus !== 0) el("span", "cx-aval-bonus", val, `${c.attributes[a]} ${bonus > 0 ? "+" : "−"} ${Math.abs(bonus)} gear`);
      const plus = button("cx-plus", row);
      plus.dataset.k = `plus:${a}`;
      plus.disabled = c.unspentAttributes < 1;
      plus.setAttribute(
        "aria-label",
        `Add a point to ${ATTRIBUTE_LABEL[a]} (${stats.attributes[a]}). ${c.unspentAttributes} left. Shift adds 5.`,
      );
      plus.append(svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }));
      svg("path", { d: "M12 5 L12 19 M5 12 L19 12" }, plus.firstElementChild);
      const on = () => {
        preview = a;
        updatePreview();
      };
      const off = () => {
        if (preview === a) preview = null;
        updatePreview();
      };
      plus.addEventListener("pointerenter", on);
      plus.addEventListener("focus", on);
      plus.addEventListener("pointerleave", off);
      plus.addEventListener("blur", off);
      plus.addEventListener("click", (ev) => {
        const cur = getChar();
        const n = ev.shiftKey ? Math.min(5, cur.unspentAttributes) : 1;
        const r = allocateAttribute(cur, a, Math.max(1, n));
        if (!r.ok) return say(r.reason);
        commit(r.value, `plus:${a}`);
        if (getChar().unspentAttributes < 1) preview = null;
        updatePreview();
      });
    }
    if (c.unspentAttributes > 0) el("p", "cx-hint", left, "Hover or focus + to preview. Shift adds 5.");

    const right = el("section", "cx-stats", wrap);
    right.setAttribute("aria-label", "Derived stats");
    const cells: { row: StatRow; val: HTMLElement; delta: HTMLElement }[] = [];
    for (const g of STAT_GROUPS) {
      const grp = el("div", "cx-sgroup", right);
      el("h4", "cx-sgroup-title", grp, g.title);
      const dl = el("dl", "cx-slist", grp);
      for (const row of g.rows) {
        const d = el("div", "cx-srow", dl);
        el("dt", "", d, row.label);
        const dd = el("dd", "", d);
        const val = el("span", "cx-sval", dd, row.show(row.get(stats, c), stats, c));
        const delta = el("span", "cx-sdelta", dd);
        cells.push({ row, val, delta });
      }
    }

    // Weapon classes: damage and crit, the active one marked.
    const wgrp = el("div", "cx-sgroup cx-wgroup", right);
    el("h4", "cx-sgroup-title", wgrp, "By weapon");
    const table = el("table", "cx-wtable", wgrp);
    const thead = el("thead", "", table);
    const hr = el("tr", "", thead);
    for (const h of ["", "Damage", "Crit"]) el("th", "", hr, h).setAttribute("scope", "col");
    const tbody = el("tbody", "", table);
    const active = activeClass(c);
    const wcells: { cls: WeaponClass; dmg: HTMLElement; crit: HTMLElement }[] = [];
    for (const wc of WEAPON_CLASSES) {
      const tr = el("tr", wc === active ? "on" : "", tbody);
      el("th", "", tr, WEAPON_CLASS_LABEL[wc] ?? wc).setAttribute("scope", "row");
      const mult = wc === "melee" ? stats.meleeMultiplier : stats.gunMultiplier[wc];
      const dmg = el("td", "", tr, pct((mult - 1) * 100));
      const crit = el("td", "", tr, `${dp(stats.critChance[wc] * 100)}%`);
      wcells.push({ cls: wc, dmg, crit });
    }

    function updatePreview(): void {
      const cur = getChar();
      const now = characterStats(cur);
      const r = preview && cur.unspentAttributes > 0 ? allocateAttribute(cur, preview, 1) : null;
      const next = r && r.ok ? characterStats(r.value) : null;
      wrap.classList.toggle("previewing", !!next);
      for (const { row, val, delta } of cells) {
        const a = row.get(now, cur);
        val.textContent = row.show(a, now, cur);
        delta.textContent = "";
        delta.className = "cx-sdelta";
        if (!next) continue;
        const b = row.get(next, cur);
        const d = b - a;
        if (Math.abs(d) < 1e-6) continue;
        delta.textContent = row.delta(d);
        delta.className = `cx-sdelta ${d * row.better > 0 ? "up" : "down"}`;
      }
      for (const w of wcells) {
        const m = (s: DerivedStats) => (w.cls === "melee" ? s.meleeMultiplier : s.gunMultiplier[w.cls]);
        w.dmg.classList.toggle("up", !!next && m(next) > m(now) + 1e-9);
        w.crit.classList.toggle("up", !!next && next.critChance[w.cls] > now.critChance[w.cls] + 1e-9);
      }
    }
    updatePreview();
  }

  // ---- skills ----
  function skillTotals(c: Character): StatTotals {
    return sumModifiers(equipmentModifiers(c.equipment, c.activeWeapon));
  }

  /** Why a point can't go in, ignoring the point count (that's shown separately). */
  function lockReason(c: Character, sid: string): string | null {
    return cannotSpend({ ...c, unspentSkills: Math.max(1, c.unspentSkills) }, sid);
  }

  function nodeState(c: Character, s: SkillDef): { rank: number; reason: string | null; state: string; can: boolean } {
    const rank = rankOf(c, s.id);
    const reason = lockReason(c, s.id);
    const maxed = rank >= s.maxRank;
    const state = maxed ? "maxed" : rank > 0 ? "learned" : reason ? "locked" : "open";
    return { rank, reason: maxed ? null : reason, state, can: !reason && !maxed && c.unspentSkills > 0 };
  }

  function spend(sid: string): void {
    const r = spendSkill(getChar(), sid);
    if (!r.ok) return say(capital(r.reason));
    commit(r.value, `node:${sid}`);
    if (pinned === sid) showSkillTip(sid, true);
  }

  function refund(sid: string): void {
    const r = refundSkill(getChar(), sid);
    if (!r.ok) return say(capital(r.reason));
    commit(r.value, `node:${sid}`);
    if (pinned === sid) showSkillTip(sid, true);
  }

  function skillNode(c: Character, s: SkillDef, parent: HTMLElement, hybrid = false): HTMLButtonElement {
    const st = nodeState(c, s);
    const b = button(`cx-node kind-${s.kind} st-${st.state}${st.can ? " can" : ""}${hybrid ? " hybrid" : ""}`, parent);
    b.dataset.k = `node:${s.id}`;
    b.dataset.sid = s.id;
    el("span", "cx-node-mono", b, monogram(s.name)).setAttribute("aria-hidden", "true");
    const rank = el("span", "cx-node-rank", b, `${st.rank}/${s.maxRank}`);
    rank.setAttribute("aria-hidden", "true");
    const why = st.reason ? ` Locked: ${st.reason}.` : "";
    b.setAttribute(
      "aria-label",
      `${s.name}, ${s.kind}, rank ${st.rank} of ${s.maxRank}.${why}${st.can ? " Enter to learn." : ""}${st.rank > 0 ? " Shift+Enter to refund." : ""}`,
    );
    b.addEventListener("pointerdown", (ev) => (lastPointer = ev.pointerType));
    b.addEventListener("click", (ev) => {
      if (lastPointer === "touch") {
        if (pinned !== s.id) {
          showSkillTip(s.id, true);
          return;
        }
        spend(s.id);
        return;
      }
      if (ev.shiftKey) refund(s.id);
      else spend(s.id);
    });
    b.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      refund(s.id);
    });
    b.addEventListener("pointerenter", (ev) => {
      if (ev.pointerType !== "touch" && !pinned) showSkillTip(s.id, false);
    });
    b.addEventListener("pointerleave", (ev) => {
      if (ev.pointerType !== "touch" && !pinned) hideTip();
    });
    b.addEventListener("focus", () => {
      if (pinned !== s.id) showSkillTip(s.id, pinned !== null && lastPointer === "touch");
    });
    b.addEventListener("blur", () => {
      if (!pinned) hideTip();
    });
    b.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (ev.shiftKey) refund(s.id);
        else spend(s.id);
      } else if (ev.key === "Backspace" || ev.key === "Delete" || ev.key === "-") {
        ev.preventDefault();
        refund(s.id);
      } else if (ev.key.startsWith("Arrow")) {
        ev.preventDefault();
        moveNode(b, ev.key);
      }
    });
    return b;
  }

  /** Arrow-key navigation across every node on screen: nearest in the pressed direction. */
  function moveNode(from: HTMLElement, key: string): void {
    const nodes = Array.from(main.querySelectorAll<HTMLElement>(".cx-node"));
    const a = from.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const n of nodes) {
      if (n === from) continue;
      const r = n.getBoundingClientRect();
      const dx = r.left + r.width / 2 - ax;
      const dy = r.top + r.height / 2 - ay;
      const along = key === "ArrowRight" ? dx : key === "ArrowLeft" ? -dx : key === "ArrowDown" ? dy : -dy;
      const across = key === "ArrowRight" || key === "ArrowLeft" ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4) continue;
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (best) {
      best.focus();
      best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }

  function showSkillTip(sid: string, pin: boolean): void {
    const c = getChar();
    const s = SKILLS[sid];
    const anchor = main.querySelector<HTMLElement>(`[data-sid="${CSS.escape(sid)}"]`);
    if (!s || !anchor) return;
    const totals = skillTotals(c);
    const stats = characterStats(c);
    const st = nodeState(c, s);
    tip.replaceChildren();
    tip.className = `cx-tip skill-tip cls-${s.cls}${pin ? " pinned" : ""}`;
    pinned = pin ? sid : null;

    const h = el("header", "tip-head", tip);
    el("p", "tip-name", h, s.name);
    const treeName = s.tree === "hybrid" ? `Hybrid · ${s.classes.map((k) => CLASSES[k].name).join(" × ")}` : TREES[s.tree].name;
    el("p", "tip-sub", h, `${s.kind === "active" ? "Active" : "Passive"} · ${treeName}`);
    const eff = effectiveRank(c, sid, totals);
    const rankLine = el("p", "tip-rank", tip);
    el("span", "tip-rank-n", rankLine, `Rank ${st.rank} / ${s.maxRank}`);
    if (eff > st.rank) el("span", "tip-gear", rankLine, ` +${eff - st.rank} from gear`);

    if (st.rank > 0) {
      el("p", "tip-label", tip, "Now");
      el("p", "tip-desc", tip, describeAtRank(c, sid, totals));
    }
    if (st.rank < s.maxRank) {
      el("p", "tip-label", tip, st.rank > 0 ? "Next rank" : "First rank");
      el("p", `tip-desc${st.rank > 0 ? " next" : ""}`, tip, describeAtRank({ skills: { ...c.skills, [sid]: st.rank + 1 } }, sid, totals));
    }
    if (s.active) {
      const cd = s.active.cooldown * (1 - stats.cooldownReduction);
      const meta = el("p", "tip-meta", tip);
      el("span", "", meta, `Cooldown ${cd < 10 ? dp(cd) : Math.round(cd)} s`);
      el("span", "", meta, `Battery ${s.active.battery}`);
    }
    if (s.synergies.length > 0) {
      el("p", "tip-label", tip, `Synergies · +${Math.round(synergyBonus(c, sid))}%`);
      const ul = el("ul", "tip-syn", tip);
      for (const syn of s.synergies) {
        const pts = rankOf(c, syn.from);
        const li = el("li", pts > 0 ? "on" : "", ul);
        el("span", "", li, SKILLS[syn.from]?.name ?? syn.from);
        el("span", "tip-syn-n", li, `+${syn.perPoint}%/pt${pts > 0 ? ` · +${Math.round(syn.perPoint * pts)}%` : ""}`);
      }
    }
    const reqs = el("ul", "tip-reqs", tip);
    const need = requiredLevel(c, s);
    el("li", c.level >= need ? "ok" : "no", reqs, `Level ${need}`);
    for (const p of s.prereqs) el("li", rankOf(c, p) > 0 ? "ok" : "no", reqs, SKILLS[p]?.name ?? p);
    if (s.hybrid) for (const k of s.classes) el("li", c.classes.includes(k) ? "ok" : "no", reqs, `${CLASSES[k].name} class`);
    if (st.reason) el("p", "tip-why", tip, capital(st.reason) + ".");
    else if (c.unspentSkills < 1 && st.rank < s.maxRank) el("p", "tip-why soft", tip, "No skill points to spend.");

    if (pin) {
      const acts = el("div", "tip-acts", tip);
      const learn = button("btn btn-primary tip-btn", acts, "Learn");
      learn.disabled = !st.can;
      learn.addEventListener("click", () => spend(sid));
      const back = button("btn btn-ghost tip-btn", acts, "Refund");
      back.disabled = st.rank < 1;
      back.addEventListener("click", () => refund(sid));
    } else {
      el("p", "tip-keys", tip, "Click or Enter to learn · Shift-click or right-click to refund");
    }
    placeTip(anchor);
  }

  function renderSkills(c: Character): void {
    const view = Math.min(classView, c.classes.length - 1);
    const cls = c.classes[view] ?? c.classes[0] ?? "ghost";
    const wrap = el("div", `cx-skills cls-${cls}`, main);

    const bar = el("div", "cx-skbar", wrap);
    if (c.classes.length > 1) {
      const ct = el("div", "cx-ctabs", bar);
      attrs(ct, { role: "tablist", "aria-label": "Class" });
      c.classes.forEach((k, i) => {
        const b = button(`cx-ctab cls-${k}`, ct);
        attrs(b, { role: "tab", "aria-selected": String(i === view), "data-k": `ctab:${k}` });
        b.tabIndex = i === view ? 0 : -1;
        b.append(classEmblem(k));
        el("span", "", b, CLASSES[k].name);
        el("span", "cx-ctab-role", b, i === 0 ? "Primary" : "Second");
        b.addEventListener("click", () => {
          classView = i;
          render();
          root.querySelector<HTMLElement>(`[data-k="ctab:${k}"]`)?.focus();
        });
        b.addEventListener("keydown", (ev) => {
          if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
            ev.preventDefault();
            classView = 1 - i;
            render();
            root.querySelector<HTMLElement>(`[data-k="ctab:${c.classes[classView]}"]`)?.focus();
          }
        });
      });
    } else {
      const solo = el("div", `cx-solo cls-${cls}`, bar);
      solo.append(classEmblem(cls));
      el("span", "cx-solo-name", solo, CLASSES[cls].name);
      if (c.level >= DUAL_CLASS_LEVEL) {
        const b = button("btn cx-second", bar, "Take a second class");
        b.dataset.k = "second";
        b.addEventListener("click", () => openSecondClass());
      } else {
        el("span", "cx-second-note", bar, `Second class at level ${DUAL_CLASS_LEVEL}`);
      }
    }
    const pts = el("p", `cx-pts${c.unspentSkills > 0 ? " on" : ""}`, bar);
    el("span", "cx-pts-n", pts, String(c.unspentSkills));
    el("span", "", pts, c.unspentSkills === 1 ? " skill point" : " skill points");
    const rs = button("btn btn-ghost cx-respec", bar, "Respec…");
    rs.dataset.k = "respec";
    rs.addEventListener("click", () => openRespec());

    const trees = el("div", "cx-trees", wrap);
    const second = view === 1;
    for (const t of CLASSES[cls].trees) {
      const skills = treeSkills(t);
      const layout = cachedLayout(t, skills);
      const sec = el("section", "cx-tree", trees);
      sec.setAttribute("aria-label", `${TREES[t].name} tree`);
      const th = el("header", "cx-tree-head", sec);
      el("h3", "cx-tree-name", th, TREES[t].name);
      const spent = skills.reduce((n, s) => n + rankOf(c, s.id), 0);
      el("span", `cx-tree-pts${spent > 0 ? " on" : ""}`, th, `${spent}`).setAttribute("aria-label", `${spent} points in ${TREES[t].name}`);
      el("p", "cx-tree-theme", th, TREES[t].theme);

      const grid = el("div", "cx-grid", sec);
      // Row bands with their unlock level; rows above Cath's level are shaded.
      for (let r = 0; r < layout.rows; r++) {
        const anyInRow = skills.find((s) => s.row === r);
        const need = anyInRow ? requiredLevel(c, anyInRow) : 1;
        const band = el("div", `cx-band${c.level < need ? " locked" : ""}`, grid);
        cssVar(band, "--r", r + 1);
        el("span", "cx-band-lvl", band, String(need)).setAttribute("aria-hidden", "true");
      }
      const traces = svg("svg", { class: "cx-traces", viewBox: `0 0 ${layout.cols} ${layout.rows}`, preserveAspectRatio: "none", "aria-hidden": "true" }, grid);
      for (const e of layout.edges) {
        const lit = rankOf(c, e.from) > 0;
        const full = lit && rankOf(c, e.to) > 0;
        svg("path", { d: tracePath(e.points), class: `cx-trace${lit ? " lit" : ""}${full ? " full" : ""}`, "vector-effect": "non-scaling-stroke" }, traces);
      }
      for (const n of layout.nodes) {
        const s = SKILLS[n.id];
        if (!s) continue;
        const cell = el("div", "cx-cell", grid);
        cssVar(cell, "--r", n.row + 1);
        cssVar(cell, "--c", n.col + 1);
        skillNode(c, s, cell);
      }
    }
    if (second) trees.classList.add("second");

    // The hybrid capstone, once Cath has two classes.
    const [a, b] = c.classes;
    if (a && b) {
      const hy = hybridFor(a, b);
      if (hy) {
        const band = el("section", "cx-hybrid", wrap);
        band.setAttribute("aria-label", "Hybrid capstone");
        const words = el("div", "cx-hy-words", band);
        el("p", "cx-hy-kicker", words, `Hybrid capstone · ${CLASSES[a].name} × ${CLASSES[b].name} · level 30`);
        el("p", "cx-hy-name", words, hy.name);
        el("p", "cx-hy-desc", words, hy.description);
        const cell = el("div", "cx-hy-cell", band);
        skillNode(c, hy, cell, true);
      }
    }

    // Narrow screens show one tree at a time: chips jump between them.
    const chips = el("div", "cx-tree-chips", wrap);
    chips.setAttribute("aria-hidden", "true");
    CLASSES[cls].trees.forEach((t, i) => {
      const chip = button("cx-chip", chips, TREES[t].name);
      chip.tabIndex = -1;
      chip.addEventListener("click", () => {
        const target = trees.children[i] as HTMLElement | undefined;
        target?.scrollIntoView({ inline: "start", block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
      });
    });
    trees.addEventListener(
      "scroll",
      () => {
        const i = Math.round(trees.scrollLeft / Math.max(1, trees.clientWidth));
        Array.from(chips.children).forEach((ch, j) => ch.classList.toggle("on", j === i));
      },
      { passive: true },
    );
    chips.firstElementChild?.classList.add("on");

    el("p", "cx-hint cx-sk-hint", wrap, "Click or Enter to learn · Shift-click, right-click or Backspace to refund · Arrows move");
  }

  // ---- dialogs (second class, respec) ----
  function openDialog(title: string, build: (body: HTMLElement, close: () => void) => void): void {
    hideTip();
    const back = el("div", "cx-dlg-back", root);
    const d = el("div", "cx-dlg", back);
    attrs(d, { role: "alertdialog", "aria-modal": "true", "aria-labelledby": "cx-dlg-title" });
    el("h3", "cx-dlg-title", d, title).id = "cx-dlg-title";
    const body = el("div", "cx-dlg-body", d);
    panel.setAttribute("inert", "");
    dialog = d;
    const done = () => {
      back.remove();
      panel.removeAttribute("inert");
      dialog = null;
      render();
    };
    build(body, done);
    back.addEventListener("click", (ev) => {
      if (ev.target === back) done();
    });
    requestAnimationFrame(() => (d.querySelector<HTMLElement>("[data-autofocus]") ?? d.querySelector<HTMLElement>("button"))?.focus());
  }

  function openSaveCode(code: () => string): void {
    openDialog("Save code", (body, done) => {
      el("p", "cx-dlg-text", body, "Copy this code to keep Cath safe or move her to another device. To load one, paste it below.");
      const out = el("textarea", "cx-code", body);
      attrs(out, { readonly: "", rows: "3", "aria-label": "Your save code" });
      out.value = code();
      const inn = el("textarea", "cx-code", body);
      attrs(inn, { rows: "3", placeholder: "Paste a code here", "aria-label": "Paste a save code", "data-autofocus": "" });
      const why = el("p", "cx-dlg-why", body);
      const acts = el("div", "cx-dlg-acts", body);
      const copy = button("btn", acts, "Copy");
      copy.addEventListener("click", () => {
        out.select();
        navigator.clipboard?.writeText(out.value).then(
          () => (copy.textContent = "Copied"),
          () => (copy.textContent = "Press Ctrl+C"),
        );
      });
      const load = button("btn btn-primary", acts, "Load code");
      load.addEventListener("click", () => {
        const r = importCode(inn.value);
        if (!r.ok) {
          why.textContent = `Can't load that: ${r.error}.`;
          return;
        }
        apply(r.save.character);
        done();
      });
      button("btn", acts, "Close").addEventListener("click", done);
    });
  }

  function openSecondClass(): void {
    const c = getChar();
    const primary = c.classes[0] ?? "ghost";
    let pick: ClassId | null = null;
    openDialog("Take a second class", (body, done) => {
      el(
        "p",
        "cx-dlg-text",
        body,
        `Cath learns a second trade. Its skills cost the same but unlock ${3} levels later, and the pair shares a hybrid capstone at level 30. This is for good.`,
      );
      const list = el("div", "cx-sc-list", body);
      attrs(list, { role: "radiogroup", "aria-label": "Second class" });
      const go = button("btn btn-primary", null, "Choose a class");
      go.disabled = true;
      const opts: HTMLButtonElement[] = [];
      for (const k of CLASS_IDS) {
        if (k === primary) continue;
        const o = button(`cx-sc cls-${k}`, list);
        attrs(o, { role: "radio", "aria-checked": "false" });
        o.tabIndex = opts.length === 0 ? 0 : -1;
        o.append(classEmblem(k));
        const w = el("span", "cx-sc-words", o);
        el("span", "cx-sc-name", w, CLASSES[k].name);
        el("span", "cx-sc-line", w, CLASS_COPY[k].playsLike);
        const hy = hybridFor(primary, k);
        if (hy) el("span", "cx-sc-hy", w, `Capstone: ${hy.name}`);
        o.addEventListener("click", () => {
          pick = k;
          for (const x of opts) {
            const on = x === o;
            x.setAttribute("aria-checked", String(on));
            x.tabIndex = on ? 0 : -1;
          }
          go.disabled = false;
          go.textContent = `Take ${CLASSES[k].name}`;
        });
        o.addEventListener("keydown", (ev) => {
          const i = opts.indexOf(o);
          let n: number | null = null;
          if (ev.key === "ArrowDown" || ev.key === "ArrowRight") n = (i + 1) % opts.length;
          if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") n = (i + opts.length - 1) % opts.length;
          if (n !== null) {
            ev.preventDefault();
            opts[n]!.focus();
            opts[n]!.click();
          }
        });
        opts.push(o);
      }
      opts[0]?.setAttribute("data-autofocus", "");
      const acts = el("div", "cx-dlg-acts", body);
      const cancel = button("btn btn-ghost", acts, "Not yet");
      cancel.addEventListener("click", done);
      acts.append(go);
      go.addEventListener("click", () => {
        if (!pick) return;
        const r = takeSecondClass(getChar(), pick);
        if (!r.ok) return say(capital(r.reason));
        apply(r.value);
        classView = 1;
        done();
        say(`${CLASSES[pick].name} taken. Its trees are open.`, "good");
      });
    });
  }

  function openRespec(): void {
    const c = getChar();
    const free = c.freeRespecs > 0;
    const cost = free ? 0 : respecCost(c.respecs, c.level);
    const refundPts = respecRefund(c);
    openDialog("Start over?", (body, done) => {
      el(
        "p",
        "cx-dlg-text",
        body,
        `A respec returns every skill point (${refundPts.skills}) and every attribute point above ${CLASSES[c.classes[0] ?? "ghost"].name}'s start (${refundPts.attributes}). Gear stays on.`,
      );
      const dl = el("dl", "cx-dlg-cost", body);
      const pair = (k: string, v: string, cls = "") => {
        const d = el("div", cls, dl);
        el("dt", "", d, k);
        el("dd", "", d, v);
      };
      pair("Cost", free ? "Free (banked)" : scripText(cost));
      pair("You have", scripText(c.scrip), c.scrip < cost ? "short" : "");
      if (!free) pair("Next one", scripText(respecCost(c.respecs + 1, c.level)));
      const acts = el("div", "cx-dlg-acts", body);
      const cancel = button("btn btn-ghost", acts, "Keep my build");
      cancel.setAttribute("data-autofocus", "");
      cancel.addEventListener("click", done);
      const go = button("btn btn-primary", acts, free ? "Respec for free" : `Respec for ${scripText(cost)}`);
      go.disabled = c.scrip < cost;
      if (go.disabled) el("p", "cx-dlg-why", body, `Not enough Scrip: a respec costs ${scripText(cost)}.`);
      go.addEventListener("click", () => {
        const r = respecCharacter(getChar());
        if (!r.ok) return say(capital(r.reason));
        apply(r.value);
        done();
        say("Clean slate. Every point is back.", "good");
      });
    });
  }

  // ---- inventory ----
  function slotFor(c: Character, item: Item): EquipSlot | null {
    if (item.kind === "chip") return null;
    const fits = EQUIP_SLOTS.filter((s) => slotKind(s) === item.slot);
    if (fits.length === 0) return null;
    const empty = fits.find((s) => !c.equipment[s]);
    if (empty) return empty;
    if (item.slot === "weapon") return c.activeWeapon;
    return fits[0]!;
  }

  function itemTile(c: Character, item: Item, parent: HTMLElement, where: { slot?: EquipSlot }): HTMLButtonElement {
    const b = button(`cx-item r-${item.rarity}`, parent);
    b.dataset.k = where.slot ? `slot:${where.slot}` : `item:${item.uid}`;
    b.dataset.uid = item.uid;
    b.append(itemGlyph(item));
    el("span", "cx-item-name", b, item.name);
    if (item.sockets > 0) {
      const sk = el("span", "cx-item-sockets", b);
      sk.setAttribute("aria-hidden", "true");
      for (let i = 0; i < item.sockets; i++) el("span", item.chips[i] ? "full" : "", sk);
    }
    const can = item.kind !== "chip" && itemLevelRequirement(item) <= c.level;
    if (!where.slot && !can) b.classList.add("cant");
    const verb = where.slot ? "Enter to take off." : item.kind === "chip" ? "Chips go in sockets at the gunsmith." : "Enter to equip.";
    b.setAttribute("aria-label", `${item.name}, ${RARITY_LABEL[item.rarity].toLowerCase()} ${itemTypeLine(item).toLowerCase()}. ${verb}`);
    b.addEventListener("pointerdown", (ev) => (lastPointer = ev.pointerType));
    b.addEventListener("click", () => {
      if (lastPointer === "touch" && pinned !== b.dataset.k) {
        showItemTip(b, item, where, true);
        return;
      }
      act();
    });
    const act = () => {
      const cur = getChar();
      if (where.slot) {
        const r = unequip(cur, where.slot);
        if (!r.ok) return say(capital(r.reason));
        hideTip();
        commit(r.value, `item:${item.uid}`);
        return;
      }
      const slot = slotFor(cur, item);
      if (!slot) return say(item.kind === "chip" ? "Chips go into a socket, at Ana's gunsmith." : `${item.name} has nowhere to go.`);
      const r = equip(cur, item.uid, slot);
      if (!r.ok) return say(capital(r.reason) + ".");
      hideTip();
      commit(r.value, `slot:${slot}`);
    };
    b.addEventListener("pointerenter", (ev) => {
      if (ev.pointerType !== "touch" && !pinned) showItemTip(b, item, where, false);
    });
    b.addEventListener("pointerleave", (ev) => {
      if (ev.pointerType !== "touch" && !pinned) hideTip();
    });
    b.addEventListener("focus", () => showItemTip(b, item, where, false));
    b.addEventListener("blur", () => {
      if (!pinned) hideTip();
    });
    return b;
  }

  function showItemTip(anchor: HTMLElement, item: Item, where: { slot?: EquipSlot }, pin: boolean): void {
    const c = getChar();
    const stats = characterStats(c);
    tip.replaceChildren();
    tip.className = `cx-tip item-tip r-${item.rarity}${pin ? " pinned" : ""}`;
    pinned = pin ? (anchor.dataset.k ?? null) : null;

    const h = el("header", "tip-head", tip);
    el("p", "tip-name", h, item.name);
    const bn = baseName(item);
    el("p", "tip-sub", h, `${RARITY_LABEL[item.rarity]} ${itemTypeLine(item).toLowerCase()}${bn ? ` · ${bn}` : ""}`);
    const meta = el("p", "tip-meta", tip);
    el("span", "", meta, `Item level ${item.level}`);
    if (item.kind === "weapon" && item.tier > 1) el("span", "", meta, `Tier ${TIER_NAMES[item.tier - 1]}`);
    const ws = itemWeaponStats(item);
    if (ws) {
      const dl = el("dl", "tip-nums", tip);
      const pair = (k: string, v: string) => {
        const d = el("div", "", dl);
        el("dt", "", d, k);
        el("dd", "", d, v);
      };
      pair("Damage", ws.pellets > 1 ? `${Math.round(ws.damage)} × ${ws.pellets}` : `${Math.round(ws.damage)}`);
      pair("Rate", `${dp(ws.fireRate)}/s`);
      if (ws.magazine > 0) pair("Magazine", `${Math.round(ws.magazine)}`);
      pair("Range", `${Math.round(ws.range)} m`);
    }
    const gear = item.kind === "gear" ? GEAR_BASES[item.base] : undefined;
    const lines = el("ul", "tip-mods", tip);
    if (gear) for (const m of gear.implicit) el("li", "implicit", lines, modText(m.stat, m.kind, m.value));
    if (gear?.capacity) el("li", "implicit", lines, `Uses ${gear.capacity} cyberware capacity`);
    for (const a of item.affixes) el("li", "affix", lines, affixText(a));
    const uq = item.uniqueId ? UNIQUE_BY_ID[item.uniqueId] : undefined;
    const sp = item.setPieceId ? SET_PIECE_BY_ID[item.setPieceId] : undefined;
    const fixed = uq?.mods ?? sp?.mods ?? [];
    fixed.forEach((m, i) => el("li", "fixed", lines, fixedModText(m, item.rolls?.[i])));
    if (item.kind === "chip") {
      const chip = CHIP_BY_ID[item.base];
      if (chip) {
        for (const m of chip.weapon) el("li", "affix", lines, `In a weapon: ${fixedModText(m)}`);
        for (const m of chip.gear) el("li", "affix", lines, `In gear: ${fixedModText(m)}`);
      }
    }
    if (item.sockets > 0) {
      const so = el("div", "tip-sockets", tip);
      el("span", "tip-label", so, `Sockets ${item.chips.length}/${item.sockets}`);
      const row = el("span", "tip-socket-row", so);
      for (let i = 0; i < item.sockets; i++) {
        const chip = item.chips[i];
        el("span", chip ? "full" : "", row, chip ? (CHIP_BY_ID[chip]?.name ?? chip) : "empty");
      }
    }
    const chain = chainOf(item);
    if (chain) {
      const ch = el("div", "tip-chain", tip);
      el("p", "tip-label", ch, `Firmware chain · ${chain.name}`);
      el("p", "", ch, chain.description);
      const cm = el("ul", "tip-mods", ch);
      for (const m of chain.mods) el("li", "chain", cm, fixedModText(m));
    }
    if (sp) {
      const set = SET_BY_ID[sp.setId];
      if (set) {
        const worn = new Set(
          EQUIP_SLOTS.map((s) => c.equipment[s])
            .filter((i): i is Item => !!i && !!i.setPieceId)
            .map((i) => i.setPieceId!),
        );
        const sd = el("div", "tip-set", tip);
        el("p", "tip-label", sd, `${set.name} · ${set.pieces.filter((p) => worn.has(p)).length}/${set.pieces.length}`);
        const ul = el("ul", "tip-set-pieces", sd);
        for (const p of set.pieces) el("li", worn.has(p) ? "on" : "", ul, SET_PIECE_BY_ID[p]?.name ?? p);
        const bl = el("ul", "tip-mods", sd);
        for (const [n, mods] of Object.entries(set.bonuses)) {
          for (const m of mods) el("li", worn.size >= Number(n) ? "set on" : "set", bl, `(${n}) ${modText(m.stat, m.kind, m.value)}`);
        }
      }
    }
    if (uq) el("p", "tip-lore", tip, uq.lore);

    const reqs = el("ul", "tip-reqs", tip);
    const lvl = itemLevelRequirement(item);
    if (lvl > 1) el("li", c.level >= lvl ? "ok" : "no", reqs, `Level ${lvl}`);
    const ar = itemRequirements(item);
    for (const a of ATTRIBUTES) {
      const n = ar[a];
      if (n) el("li", stats.attributes[a] >= n ? "ok" : "no", reqs, `${n} ${ATTRIBUTE_LABEL[a]}`);
    }
    if (reqs.childElementCount === 0) reqs.remove();

    if (pin) {
      const acts = el("div", "tip-acts", tip);
      const go = button("btn btn-primary tip-btn", acts, where.slot ? "Take off" : "Equip");
      go.disabled = item.kind === "chip";
      go.addEventListener("click", () => anchor.click());
    } else {
      el("p", "tip-keys", tip, where.slot ? "Click or Enter to take off" : item.kind === "chip" ? "Socket chips at the gunsmith" : "Click or Enter to equip");
    }
    placeTip(anchor);
  }

  function renderInventory(c: Character): void {
    const stats = characterStats(c);
    const wrap = el("div", "cx-inv", main);

    const eq = el("section", "cx-equip", wrap);
    eq.setAttribute("aria-labelledby", "cx-eq-h");
    const eh = el("header", "cx-sec-head", eq);
    el("h3", "cx-sec-title", eh, "Worn").id = "cx-eq-h";
    const load = cyberwareLoad(c.equipment);
    const cap = el("p", `cx-sec-note cx-cyberload${load > stats.cyberwareCapacity ? " over" : ""}`, eh);
    cap.textContent = `Cyberware ${load} / ${stats.cyberwareCapacity}`;
    const meter = el("span", "cx-meter", eq);
    meter.setAttribute("aria-hidden", "true");
    cssVar(meter, "--p", Math.min(1, load / Math.max(1, stats.cyberwareCapacity)).toFixed(3));

    const doll = el("div", "cx-doll", eq);
    for (const s of EQUIP_SLOTS) {
      const slot = el("div", `cx-slot slot-${s}${s === c.activeWeapon ? " in-hand" : ""}`, doll);
      el("span", "cx-slot-label", slot, s === c.activeWeapon ? `${SLOT_LABEL[s]} · in hand` : SLOT_LABEL[s]);
      const it = c.equipment[s];
      if (it) itemTile(c, it, slot, { slot: s });
      else {
        const empty = el("div", "cx-empty", slot, "Empty");
        empty.setAttribute("aria-label", `${SLOT_LABEL[s]}: empty`);
      }
    }

    const bag = el("section", "cx-bag", wrap);
    bag.setAttribute("aria-labelledby", "cx-bag-h");
    const bh = el("header", "cx-sec-head", bag);
    el("h3", "cx-sec-title", bh, "Bag").id = "cx-bag-h";
    el("p", "cx-sec-note", bh, `${c.inventory.length} ${c.inventory.length === 1 ? "item" : "items"}`);
    const grid = el("div", "cx-bag-grid", bag);
    for (const it of c.inventory) itemTile(c, it, grid, {});
    const fill = Math.max(0, 24 - c.inventory.length) + ((8 - ((Math.max(24, c.inventory.length)) % 8)) % 8);
    for (let i = 0; i < fill; i++) el("div", "cx-bag-empty", grid).setAttribute("aria-hidden", "true");
    if (c.inventory.length === 0) el("p", "cx-hint", bag, "Nothing in the bag yet. The Drowned Market will see to that.");
    renderGunsmith(c, wrap);
  }

  // ---- gunsmith: tiers, parts, chips and the fence ----
  let smithUid: string | null = null;
  function renderGunsmith(c: Character, wrap: HTMLElement): void {
    const all = [...EQUIP_SLOTS.map((s) => c.equipment[s]).filter((i): i is Item => !!i), ...c.inventory];
    const pickable = all.filter((i) => i.kind !== "chip");
    const sec = el("section", "cx-smith", wrap);
    sec.setAttribute("aria-labelledby", "cx-smith-h");
    const sh = el("header", "cx-sec-head", sec);
    el("h3", "cx-sec-title", sh, "Ana's gunsmith").id = "cx-smith-h";
    el("p", "cx-sec-note", sh, `${c.scrip} Scrip`);
    if (pickable.length === 0) return void el("p", "cx-hint", sec, "Bring Ana a gun or a coat and she'll make it better. For a price.");
    const item = pickable.find((i) => i.uid === smithUid) ?? pickable[0]!;
    smithUid = item.uid;
    const sel = document.createElement("select");
    sel.className = "cx-smith-pick";
    sel.setAttribute("aria-label", "Item to work on");
    sel.dataset.k = "smith:pick";
    for (const i of pickable) {
      const o = document.createElement("option");
      o.value = i.uid;
      o.textContent = i.name + (c.inventory.includes(i) ? "" : " (worn)");
      o.selected = i.uid === item.uid;
      sel.append(o);
    }
    sel.addEventListener("change", () => {
      smithUid = sel.value;
      render();
    });
    sec.append(sel);
    const row = (label: string, cost: number | null, enabled: boolean, run: () => Result<Character>, key: string) => {
      const b = button("cx-smith-act", sec);
      b.dataset.k = key;
      el("span", "", b, label);
      if (cost !== null) el("span", "cx-smith-cost", b, `${cost} Scrip`);
      b.disabled = !enabled;
      b.addEventListener("click", () => {
        const r = run();
        if (!r.ok) return say(capital(r.reason) + ".");
        commit(r.value, key);
        say("Done.", "good");
      });
    };
    if (item.kind === "weapon") {
      const cost = upgradeCost(item.tier, item.level);
      row(cost === null ? "Tier V (maximum)" : `Raise to tier ${TIER_NAMES[Math.min(4, item.tier)]}`, cost, cost !== null && c.scrip >= cost, () => upgradeWeaponTier(getChar(), item.uid), "smith:tier");
      const cls = WEAPON_BASES[item.base]?.cls;
      for (const part of Object.values(WEAPON_PARTS)) {
        if (!cls || !partFits(part, cls)) continue;
        const on = item.parts[part.slot] === part.id;
        row(`${part.name} (${part.slot})${on ? " · fitted" : ""}`, on ? null : part.cost, !on && c.scrip >= part.cost, () => fitWeaponPart(getChar(), item.uid, part.id), `smith:part:${part.id}`);
      }
      for (const slot of PART_SLOTS) {
        if (item.parts[slot]) row(`Strip the ${slot}`, null, true, () => stripWeaponPart(getChar(), item.uid, slot), `smith:strip:${slot}`);
      }
    }
    if (item.sockets > item.chips.length) {
      for (const chip of c.inventory.filter((i) => i.kind === "chip")) {
        row(`Socket ${chip.name}`, null, true, () => socketInto(getChar(), item.uid, chip.uid), `smith:chip:${chip.uid}`);
      }
    }
    if (c.inventory.includes(item)) row("Sell to the fence", null, true, () => sellItem(getChar(), item.uid), "smith:sell");
    el("p", "cx-hint", sec, c.inventory.includes(item) ? `The fence pays ${sellValue(item)} Scrip.` : "Take it off to sell it.");
  }

  // ---- render, focus and keys ----
  function render(): void {
    if (closed) return;
    const c = getChar();
    const key = (document.activeElement as HTMLElement | null)?.dataset?.k;
    const scroll = main.querySelector(".cx-trees")?.scrollLeft ?? 0;
    const mainScroll = main.scrollTop;
    const wasPinned = pinned;
    tip.hidden = true;
    main.replaceChildren();
    renderHead(c);
    main.className = `cx-main tab-${tab}${entering ? " enter" : ""}`;
    entering = false;
    if (tab === "attributes") renderAttributes(c);
    else if (tab === "skills") renderSkills(c);
    else renderInventory(c);
    const trees = main.querySelector(".cx-trees");
    if (trees) trees.scrollLeft = scroll;
    main.scrollTop = mainScroll;
    if (key) root.querySelector<HTMLElement>(`[data-k="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
    pinned = null;
    // A pinned skill card (touch) stays up across a spend; item cards close because the item moved.
    if (wasPinned && SKILLS[wasPinned] && tab === "skills") showSkillTip(wasPinned, true);
  }

  function show(t: CharacterTab, focusTab = false): void {
    if (t !== tab) {
      tab = t;
      entering = true;
      hideTip();
      main.scrollTop = 0;
    }
    render();
    if (focusTab) tabBtns.get(t)?.focus();
  }

  function close(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onDocPointer, true);
    window.removeEventListener("resize", onResize);
    clearTimeout(statusTimer);
    const finish = () => {
      root.remove();
      prevFocus?.focus?.();
      onClose();
    };
    if (reducedMotion()) finish();
    else {
      root.classList.add("cx-out");
      setTimeout(finish, 180);
    }
  }

  function onKey(ev: KeyboardEvent): void {
    if (closed) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      if (dialog) {
        dialog.parentElement?.remove();
        panel.removeAttribute("inert");
        dialog = null;
        render();
      } else if (pinned) hideTip();
      else close();
      return;
    }
    if (ev.key === "Tab") {
      trapTab(dialog ?? root, ev);
      ev.stopPropagation();
      return;
    }
    const typing = (ev.target as HTMLElement | null)?.closest?.("input, textarea, select");
    if (!dialog && !typing && (ev.key === "k" || ev.key === "K" || ev.key === "i" || ev.key === "I") && !ev.metaKey && !ev.ctrlKey) {
      ev.preventDefault();
      if (ev.key.toLowerCase() === "i" && tab !== "inventory") show("inventory", true);
      else close();
    }
    ev.stopPropagation();
  }

  function onDocPointer(ev: PointerEvent): void {
    if (!pinned) return;
    const t = ev.target as Node;
    if (tip.contains(t)) return;
    if ((t as HTMLElement).closest?.(".cx-node, .cx-item")) return;
    hideTip();
  }

  function onResize(): void {
    hideTip();
  }

  document.addEventListener("keydown", onKey, true);
  document.addEventListener("pointerdown", onDocPointer, true);
  window.addEventListener("resize", onResize);

  render();
  requestAnimationFrame(() => {
    root.classList.add("cx-in");
    tabBtns.get(tab)?.focus({ preventScroll: true });
  });

  return {
    close,
    refresh: render,
    show: (t) => show(t),
  };
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
