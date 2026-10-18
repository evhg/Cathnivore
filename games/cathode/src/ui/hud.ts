// The HUD, in the DOM over the canvas ("Wet Ink", docs/design/aaa-ui-specs.md §4.11). CSP-safe: no inline
// style attributes, only classes and CSS custom properties set through the CSSOM. Per frame it touches only
// transform-driving custom properties (--v, --trail, --px, --gap), opacity and classes, and writes text only
// when it changed, so a steady frame does no layout. Blood red is danger, cyan is system, amber is reward.

import { tuning, type HitClass } from "../game/feel/tuning";
import { BINDABLE, codesFor, keyLabel, rebind } from "../controls";
import { applyMotionPref, loadPrefs, savePrefs, type DamageFx, type Intensity, type QualityChoice } from "../prefs";
import { showCredits } from "./credits";
import { DamageRing, type HurtSource, type NadeMark } from "./dmgring";

export interface HudState {
  hp: number;
  maxHp: number;
  /** C6 (S6.1): the two layers. Without them the whole pool shows as Flesh. */
  guard?: number;
  maxGuard?: number;
  flesh?: number;
  maxFlesh?: number;
  /** Guard is coming back (the bar's moving highlight). */
  regen?: boolean;
  /** Live grenades within 6 m (bearing in radians, share of the fuse left): a glyph on the damage ring for each. */
  nades?: NadeMark[];
  /** Turns a world position into her current bearing and elevation, so a damage arc tracks its attacker. */
  hurtResolve?: (p: { x: number; y: number; z: number }) => { bearing: number; elevDeg: number };
  level: number;
  xp: number;
  xpNext: number;
  weapon: string;
  mag: number;
  reserve: number;
  /** Rounds a full magazine holds (the low-ammo colour starts at a quarter of it). */
  magSize?: number;
  melee: boolean;
  /** Crosshair gap, pixels. */
  spread: number;
  scoped: boolean;
  /** Each enemy noticing Cath: screen-relative bearing (radians, 0 = ahead) and meter 0..1, plus state. */
  threats: Array<{ bearing: number; amount: number; hunting: boolean }>;
  /** Range in metres under the scope reticle, and wind (m/s, + is left to right). */
  scopeRange: number;
  wind: number;
  objective: string;
  /** The case the objective belongs to ("The Drowned Market"); shown as the note's eyebrow. */
  caseName?: string;
  takedown: boolean;
  bulletTime: number;
  /** The two active-skill slots (name and readiness 0..1), and the battery 0..1. */
  skills: Array<{ name: string; ready: number; key: string } | null>;
  battery: number;
  /** Armour rating (0 hides the armour bar). */
  armour?: number;
  /** Armour and resistances, one short line (empty when she has none). */
  defence?: string;
  /** Where the objective is on screen (0..1 each way), metres away, and whether it's behind her. */
  waypoint?: { x: number; y: number; dist: number; behind: boolean } | null;
  /** Aiming down the sights (the objective marker steps back, S7.2). */
  ads?: boolean;
  /** The aim-down-sights blend, 0 hip .. 1 aimed: the crosshair fades out as the sights (or the dot) take over (S2.2 layer 1). */
  adsBlend?: number;
  /** How far into the inspect's turn the gun is (0..1): the crosshair steps aside so it never sits on the model. */
  inspect?: number; // also the reload turn (Arsenal.reloadW)
  /** A weapon in reach and in sight (S7.1 layer 5): where on screen (CSS px), the key, and its name and stats. */
  pickup?: { x: number; y: number; key: string; verb: string; name: string; stats: Array<[string, string]> } | null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  parent?.append(e);
  return e;
}

/** A segmented bar: a track with a damage-trail ghost and the fill, both driven by transform. */
function bar(className: string, parent: HTMLElement): { root: HTMLElement; fill: HTMLElement; trail: HTMLElement | null } {
  const root = el("div", `c-bar ${className}`, parent);
  const trail = /\bhud-hp\b/.test(className) ? el("span", "trail", root) : null;
  const fill = el("span", "fill", root);
  return { root, fill, trail };
}

/** Speaker colours for subtitles (the case file's map): Cath in blood, Bea on the wire in cyan. */
const SPEAKER: Record<string, string> = { Cath: "var(--blood-hot)", Bea: "var(--cyan)" };

/** HP below this share is "low": the bar pulses and the number turns blood. */
const LOW_HP = 0.3;
/** Armour shown against this cap (the bar is full at 100). */
const ARMOUR_CAP = 100;

const HIT_CLASSES: readonly HitClass[] = ["body", "head", "armour", "armourBreak", "pen", "kill", "headKill"];

export class Hud {
  private aimBusy = false;
  private root: HTMLElement;
  private hpBar: ReturnType<typeof bar>;
  private guardBar: ReturnType<typeof bar>;
  private vbar: HTMLElement;
  private shards: HTMLElement;
  private crackFlash: HTMLElement;
  private rim: HTMLElement;
  private dmg: DamageRing;
  /** The damage ghost per layer (S6.2): where the trail is, and how long it still holds before it shrinks. */
  private ghost = { flesh: -1, guard: -1, fleshHold: 0, guardHold: 0, fleshFrom: 0, guardFrom: 0, fleshT: 0, guardT: 0 };
  private lastGuard = -1;
  private hpText: HTMLElement;
  private lvl: HTMLElement;
  /** C7: the wound state beside her name ("Critical", "Bleeding out"), and the last tier shown. */
  private woundTag!: HTMLElement;
  private woundTier = "fine";
  private xpBar: ReturnType<typeof bar>;
  private armRow: HTMLElement;
  private armBar: ReturnType<typeof bar>;
  private armText: HTMLElement;
  private weapon: HTMLElement;
  private ammo: HTMLElement;
  private mag: HTMLElement;
  private reserve: HTMLElement;
  private cross: HTMLElement;
  private hit: HTMLElement;
  private scope: HTMLElement;
  private scopeRange: HTMLElement;
  private scopeWind: HTMLElement;
  private threats: HTMLElement;
  private feed: HTMLElement;
  private objective: HTMLElement;
  private objText: HTMLElement;
  private prompt: HTMLElement;
  private banner: HTMLElement;
  private focus: HTMLElement;
  private slots: HTMLElement;
  private batBar: ReturnType<typeof bar>;
  private defence: HTMLElement;
  private lastHp = -1;
  private target: HTMLElement;
  private targetFill: HTMLElement;
  private targetT = 0;
  private hitAge = 1e9;
  private hitHold = 0;
  private hitFade = 1;
  private targetDead = 0;
  private hitRing: HTMLElement;
  private blockedEl: HTMLElement;
  private blockedAge = 1e9;
  private blockedUses = 0;
  /** Last value written per element and property, so a steady frame writes nothing. */
  private written = new WeakMap<Element, Map<string, string>>();

  constructor(host: HTMLElement) {
    host.replaceChildren();
    this.root = el("div", "hud-root is-booting", host);
    window.setTimeout(() => this.root.classList.remove("is-booting"), 1100);
    if (loadPrefs().bigSubs) this.root.classList.add("big-subs");
    document.documentElement.classList.toggle("colour-safe", loadPrefs().colourSafe);
    this.root.style.setProperty("--xs", String(loadPrefs().crossScale));
    // The HUD-size setting (S8): on the root, so --u (and every size written in it) follows.
    this.hudScaleV = loadPrefs().hudScale || 1;
    document.documentElement.style.setProperty("--hud-scale", String(this.hudScaleV));
    // Objective, top left: a case note with the case as its eyebrow.
    // On touch the objective and vitals stack in the top-left corner, the arms and feed in the top right; on
    // desktop these wrappers are `display: contents` and each cluster takes its own corner.
    const tl = el("div", "hud-tl", this.root);
    const tr = el("div", "hud-tr", this.root);
    this.objective = el("p", "hud-objective", tl);
    this.objective.dataset.case = "Case";
    this.objText = el("span", "hud-objective-text", this.objective);
    // Vitals, bottom left (top left on touch): name and level, hero HP over a segmented bar, armour, XP.
    const vit = el("div", "hud-vitals", tl);
    const name = el("p", "hud-name", vit);
    el("span", "hud-name-text", name).textContent = "Cath Hale";
    this.woundTag = el("span", "hud-wound", name);
    this.woundTag.setAttribute("aria-live", "polite");
    this.lvl = el("span", "c-chip lvl hud-level", name);
    const hpRow = el("div", "hud-hp-row", vit);
    this.hpText = el("span", "hud-hp-text num", hpRow);
    // C6 (S6.1): Flesh (red, 60%) then Guard (cyan, 40%) on one line: damage eats Guard from the right first.
    this.vbar = el("div", "hud-vbar", hpRow);
    this.hpBar = bar("is-seg hud-hp", this.vbar);
    this.guardBar = bar("sys hud-guard", this.vbar);
    this.guardBar.trail = el("span", "trail", this.guardBar.root);
    this.guardBar.root.prepend(this.guardBar.trail);
    // The crack across an empty Guard, and the 12 shards it breaks into (each with its own flight).
    const crack = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    crack.setAttribute("class", "hud-guard-crack");
    crack.setAttribute("viewBox", "0 0 100 10");
    crack.setAttribute("preserveAspectRatio", "none");
    const cp = document.createElementNS("http://www.w3.org/2000/svg", "path");
    cp.setAttribute("d", "M2 6L14 3L22 7L35 2L44 8L58 3L66 6L78 2L86 7L98 4");
    crack.append(cp);
    this.guardBar.root.append(crack);
    this.shards = el("div", "hud-shards", this.guardBar.root);
    for (let i = 0; i < 12; i++) {
      // Three shard shapes, sizes 0.55x to 1.4x.
      const sh = el("i", `s${i % 3}`, this.shards);
      // A fixed spread out of the bar's broken end to the right, into open screen (never up over the level chip or
      // the objective): -8 to +32 degrees, 45 to 125u, each spinning up to 270 degrees. The steepest climb
      // (17u) stays under the LV chip's baseline at every size, the phone's included.
      const a = Math.PI * (-0.044 + 0.222 * (((i * 7) % 12) / 11));
      const d = 45 + 80 * (((i * 5) % 12) / 11);
      const k = 0.55 + 0.85 * (((i * 11) % 12) / 11);
      sh.style.setProperty("--x0", `${(35 + (i / 11) * 62).toFixed(1)}%`);
      sh.style.setProperty("--k", k.toFixed(2));
      sh.style.setProperty("--dx", `calc(var(--u) * ${(Math.cos(a) * d).toFixed(1)})`);
      sh.style.setProperty("--dy", `calc(var(--u) * ${(Math.sin(a) * d).toFixed(1)})`);
      sh.style.setProperty("--r", `${(i % 2 ? 1 : -1) * (120 + ((i * 37) % 150))}deg`);
    }
    // The bar itself cracks white-hot for an instant.
    this.crackFlash = el("span", "hud-guard-flash", this.guardBar.root);
    this.armRow = el("div", "hud-arm-row", vit);
    el("span", "hud-arm-label", this.armRow).textContent = "Arm";
    this.armBar = bar("armour hud-armour", this.armRow);
    this.armText = el("span", "hud-arm-text num", this.armRow);
    this.defence = el("p", "hud-defence", vit);
    this.xpBar = bar("xp hud-xp", vit);
    // Arms, bottom right (top right on touch): weapon, mag over reserve, skill slots, battery.
    const arms = el("div", "hud-arms", tr);
    this.weapon = el("p", "hud-weapon", arms);
    this.ammo = el("p", "hud-ammo", arms);
    this.mag = el("span", "hud-mag num", this.ammo);
    this.reserve = el("span", "hud-reserve num", this.ammo);
    this.slots = el("div", "hud-slots", arms);
    this.batBar = bar("sys hud-battery", arms);
    // The middle: crosshair, hit marker, threat arcs.
    this.cross = el("div", "hud-cross", this.root);
    for (const k of ["t", "b", "l", "r"]) el("span", `hud-cross-${k}`, this.cross);
    el("span", "hud-cross-dot", this.cross);
    // The hit marker (S1.2): four ticks whose size and colour come from the class of hit, a centre dot for
    // crits, a shield pip and shatter ring for armour, and a ring (two on a head kill) that bursts on a kill.
    this.hit = el("div", "hud-hit", this.root);
    this.hit.setAttribute("aria-hidden", "true");
    for (const k of ["a", "b", "c", "d"]) el("i", `hud-hit-${k}`, this.hit);
    el("b", "hud-hit-dot", this.hit);
    el("b", "hud-hit-pip", this.hit);
    el("span", "hud-hit-shatter", this.hit);
    this.hitRing = el("span", "hud-hit-ring", this.hit);
    el("span", "hud-hit-ring hud-hit-ring-2", this.hit);
    // Cover ate the round: hollow brackets either side of the crosshair, and "COVER" the first few times.
    this.blockedEl = el("div", "hud-blocked", this.root);
    this.blockedEl.setAttribute("aria-hidden", "true");
    el("i", "hud-blocked-l", this.blockedEl);
    el("i", "hud-blocked-r", this.blockedEl);
    el("span", "hud-blocked-word", this.blockedEl).textContent = "Cover";
    this.threats = el("div", "hud-threats", this.root);
    this.prompt = el("p", "hud-prompt", this.root);
    el("span", "c-key", this.prompt).textContent = "F";
    el("span", "hud-prompt-text", this.prompt).textContent = "Takedown";
    this.focus = el("div", "hud-focus", this.root);
    // Overlays.
    // The cyan rim that flashes for a frame when Guard breaks.
    this.rim = el("div", "hud-rim", this.root);
    this.target = el("div", "hud-target", this.root);
    el("span", "hud-target-name", this.target);
    this.targetFill = el("i", "hud-target-fill", el("b", "hud-target-bar", this.target));
    this.dmg = new DamageRing(this.root, (e, k, v) => this.prop(e as HTMLElement, k, v));
    this.scope = el("div", "hud-scope", this.root);
    const ret = el("div", "hud-reticle", this.scope);
    for (const m of [1, 2, 3, 4, 5]) {
      const t = el("span", "hud-mil", ret);
      t.dataset.mil = String(m);
    }
    this.scopeRange = el("p", "hud-scope-range num", this.scope);
    this.scopeWind = el("p", "hud-scope-wind num", this.scope);
    this.feed = el("div", "hud-feed", tr);
    this.banner = el("div", "hud-banner", this.root);
  }

  /** Sets a custom property only when its value changed. */
  private prop(e: HTMLElement, k: string, v: string): void {
    let m = this.written.get(e);
    if (!m) this.written.set(e, (m = new Map()));
    if (m.get(k) === v) return;
    m.set(k, v);
    e.style.setProperty(k, v);
  }

  /** Sets text only when it changed. */
  private text(e: HTMLElement, v: string): void {
    if (e.textContent !== v) e.textContent = v;
  }

  /** Shows or hides an element only when that changes. */
  private show(e: HTMLElement, on: boolean): void {
    if (e.hidden === on) e.hidden = !on;
  }

  update(dt: number, s: HudState): void {
    // A frozen screenshot stage holds every timer (markers, brackets, the target bar).
    if (this.frozen) dt = 0;
    const set = (e: HTMLElement, k: string, v: string) => this.prop(e, k, v);
    // Health (S6.1, S6.2): the hero numeral is the total; the bar is Flesh then Guard, each with a white damage
    // ghost that holds 350 ms where she was, then shrinks to the new value over 400 ms.
    const maxG = s.maxGuard ?? 0;
    const maxF = s.maxFlesh ?? s.maxHp;
    const g = Math.max(0, Math.min(1, (s.guard ?? 0) / Math.max(1e-6, maxG || 1)));
    const f = Math.max(0, Math.min(1, (s.flesh ?? s.hp) / Math.max(1, maxF)));
    const frac = Math.max(0, Math.min(1, s.hp / Math.max(1, s.maxHp)));
    if (this.lastHp >= 0 && s.hp < this.lastHp - 1e-6 && this.lastHp - s.hp >= 4) this.punch(this.hpText, "hit");
    const gh = this.ghost;
    const ghostStep = (v: number, k: "flesh" | "guard") => {
      const hold = `${k}Hold` as const;
      const from = `${k}From` as const;
      const tt = `${k}T` as const;
      if (gh[k] < 0 || v >= gh[k]) {
        gh[k] = v;
        gh[hold] = 0;
        gh[tt] = 0;
        return v;
      }
      // A fresh drop restarts the hold from where the ghost is now.
      if (this.ghostPrev[k] >= 0 && v < this.ghostPrev[k] - 1e-6) {
        gh[hold] = 0.35;
        gh[from] = gh[k];
        gh[tt] = 0;
      }
      if (gh[hold] > 0) gh[hold] = Math.max(0, gh[hold] - dt);
      else {
        gh[tt] = Math.min(1, gh[tt] + dt / 0.4);
        const u = gh[tt];
        gh[k] = gh[from] + (v - gh[from]) * (u * u * (3 - 2 * u));
        if (u >= 1) gh[k] = v;
      }
      return gh[k];
    };
    const fg = ghostStep(f, "flesh");
    let gg = ghostStep(g, "guard");
    // A broken Guard shows no ghost: the shards, the flash and the crack carry the break, and a white ghost
    // filling the empty slot would read as a fuller bar than an intact one.
    if (g <= 1e-3) {
      gh.guard = g;
      gh.guardHold = 0;
      gg = g;
    }
    this.ghostPrev.flesh = f;
    this.ghostPrev.guard = g;
    set(this.hpBar.root, "--v", f.toFixed(3));
    set(this.hpBar.root, "--trail", fg.toFixed(3));
    set(this.hpBar.root, "--max", String(Math.max(1, Math.round(maxF))));
    set(this.guardBar.root, "--v", g.toFixed(3));
    set(this.guardBar.root, "--trail", gg.toFixed(3));
    this.show(this.guardBar.root, maxG > 0);
    // Guard breaks: the shards fly, the rim flashes cyan for a frame, the crack shows while it's empty.
    if (maxG > 0 && this.lastGuard > 1e-3 && g <= 1e-3) this.guardBreak();
    this.lastGuard = maxG > 0 ? g : -1;
    this.vbar.classList.toggle("is-broken", maxG > 0 && g <= 1e-3);
    this.vbar.classList.toggle("is-regen", !!s.regen);
    this.text(this.hpText, `${Math.ceil(s.hp)}`);
    const low = maxG > 0 ? f < LOW_HP : frac < LOW_HP;
    this.hpBar.root.classList.toggle("is-low", low);
    this.hpText.classList.toggle("low", low);
    this.lastHp = s.hp;
    this.targetT = Math.max(0, this.targetT - dt);
    this.show(this.target, this.targetT > 0);
    this.dmg.setUrgent(low);
    this.dmg.update(dt, s.hurtResolve ?? null, s.nades ?? []);
    // Armour as its own bar; the resistances line only when she has some.
    const arm = Math.max(0, Math.round(s.armour ?? 0));
    this.show(this.armRow, arm > 0);
    if (arm > 0) {
      set(this.armBar.root, "--v", Math.min(1, arm / ARMOUR_CAP).toFixed(3));
      this.text(this.armText, String(arm));
    }
    const resist = (s.defence ?? "").split(" · ").filter((b) => b && !/^ARM /.test(b)).join(" · ");
    this.text(this.defence, resist);
    this.show(this.defence, !!resist);
    this.text(this.lvl, `Lv ${String(s.level).padStart(2, "0")}`);
    set(this.xpBar.root, "--v", Math.min(1, s.xp / Math.max(1, s.xpNext)).toFixed(3));
    // Arms: mag goes amber at a quarter, blood at empty (with a reload prompt).
    // A variant in brackets ("Kestrel 9 (suppressed)") becomes a small tag chip after the name, not header text.
    if (this.weapon.dataset.full !== s.weapon) {
      this.weapon.dataset.full = s.weapon;
      const m = /^(.*?)\s*\(([^)]+)\)$/.exec(s.weapon);
      this.weapon.replaceChildren(m ? m[1]! : s.weapon);
      if (m) el("span", "hud-weapon-tag", this.weapon).textContent = m[2]!;
    }
    this.show(this.ammo, !s.melee);
    if (!s.melee) {
      this.text(this.mag, String(s.mag));
      this.text(this.reserve, `/ ${s.reserve}`);
      const quarter = Math.max(1, Math.floor((s.magSize ?? 8) / 4));
      this.ammo.classList.toggle("low", s.mag > 0 && s.mag <= quarter);
      this.ammo.classList.toggle("empty", s.mag <= 0);
    }
    // The gap opens with spread, in HUD units so it reads the same at every screen size (S8).
    set(this.cross, "--gap", `calc(var(--u) * ${Math.round((6 + s.spread) * 4 / 3)})`);
    this.show(this.cross, !s.scoped);
    // Aimed, the sights are the reticle: the crosshair is gone by 60% of the blend so it never sits over the dot.
    // Inspecting, the gun is the subject: the crosshair fades with the turn (C4 review: it sat on the optic).
    const away = Math.max((s.adsBlend ?? 0) / 0.6, (s.inspect ?? 0) * 1.6);
    set(this.cross, "--ads", Math.max(0, 1 - away).toFixed(2));
    // Aimed or inspecting, the touch "Drag to aim" hint gets out of the way of the sights and the gun.
    const busy = (s.adsBlend ?? 0) > 0.15 || (s.inspect ?? 0) > 0.15;
    if (busy !== this.aimBusy) {
      this.aimBusy = busy;
      document.documentElement.classList.toggle("hud-aiming", busy);
    }
    this.show(this.scope, s.scoped);
    if (s.scoped) {
      this.text(this.scopeRange, `Rng ${Math.round(s.scopeRange)} m`);
      this.text(this.scopeWind, `Wnd ${s.wind > 0 ? "→" : "←"}${Math.abs(s.wind).toFixed(1)}`);
    }
    // The objective: a case note that wipes in whenever it changes.
    if (s.caseName && this.objective.dataset.case !== `Case · ${s.caseName}`) this.objective.dataset.case = `Case · ${s.caseName}`;
    if (this.objText.textContent !== s.objective) {
      const first = this.objText.textContent === "";
      this.objText.textContent = s.objective;
      if (!first) this.punch(this.objective, "is-new", 1000);
      this.wpPulse = 6;
    }
    this.show(this.objective, !!s.objective);
    // The objective marker (S7.2): an 18u diamond over the objective with its distance under it; off screen, a 22u
    // chevron on an ellipse at 42% x 40% of the viewport points the way (S7.1 layer 6). Within 5 m or aiming, it
    // shrinks to 60% and fades to 40%; for 6 s after the objective changes it pulses at 1 Hz.
    if (!this.wp) {
      this.wp = el("div", "hud-wp", this.root);
      this.wp.setAttribute("aria-hidden", "true");
      el("span", "hud-wp-mark", this.wp);
      el("span", "hud-wp-arrow", this.wp);
      this.wpDist = el("span", "hud-wp-dist num", this.wp);
    }
    this.show(this.wp, !!s.waypoint);
    this.wpPulse = Math.max(0, this.wpPulse - dt);
    if (s.waypoint) {
      const w = s.waypoint;
      const W = innerWidth;
      const H = innerHeight;
      let dx = (w.x - 0.5) * W;
      let dy = (w.y - 0.5) * H;
      if (w.behind) {
        // Behind her: point to whichever side is nearer, level with the centre.
        dx = (dx < 0 ? -1 : 1) * Math.max(Math.abs(dx), W);
        dy *= 0.3;
      }
      const a = 0.42 * W;
      const b = 0.4 * H;
      const k = Math.hypot(dx / a, dy / b);
      const off = w.behind || w.x < 0.03 || w.x > 0.97 || w.y < 0.05 || w.y > 0.95;
      // On screen the diamond rides the objective; off it, the chevron sits on the ellipse in its direction.
      let px = off ? W / 2 + dx / Math.max(k, 1e-6) : w.x * W;
      let py = off ? H / 2 + dy / Math.max(k, 1e-6) : w.y * H;
      // On touch the chevron, its halo and its plate stay clear of the stick and the button arc: it walks in
      // along the same ray until the box is clear (the ellipse alone puts it on FIRE for an objective to the right).
      if (off) [px, py] = this.clearOfControls(px, py, W, H);
      set(this.wp, "--px", `${Math.round(px)}px`);
      set(this.wp, "--py", `${Math.round(py)}px`);
      set(this.wp, "--ang", `${Math.atan2(dy, dx).toFixed(3)}rad`);
      this.wp.classList.toggle("off", off);
      // Over the reticle it steps back (CoD, DOOM Eternal): within a reticle's reach of the centre it shrinks and
      // fades, so the player aiming past it at the Enforcers sees the crosshair, not the marker.
      const u = Math.min(2.4, Math.max(0.62, Math.min(H / 1080, W / 1920))) * this.hudScaleV;
      const rc = Math.hypot(px - W / 2, py - H / 2);
      const onCross = !off && rc < Math.max(56, 64 * u);
      this.wp.classList.toggle("near", !off && (w.dist < 5 || !!s.ads || onCross));
      this.wp.classList.toggle("on-cross", onCross);
      // The distance plate goes on the side away from the centre: below when the marker is under the reticle's
      // line, above when it's over it.
      this.wp.classList.toggle("lbl-up", !off && py < H / 2 && rc < Math.max(160, 180 * u));
      this.wp.classList.toggle("pulse", this.wpPulse > 0);
      this.text(this.wpDist!, `${Math.round(w.dist)} m`);
    }
    // The world prompt on a weapon in reach (S7.1 layer 5).
    this.updatePickup(s.pickup ?? null);
    set(this.batBar.root, "--v", Math.max(0, Math.min(1, s.battery)).toFixed(3));
    while (this.slots.children.length < 2) {
      const c = el("div", "hud-slot", this.slots);
      el("span", "c-key hud-slot-key", c);
      el("span", "hud-slot-name", c);
    }
    s.skills.forEach((k, i) => {
      const c = this.slots.children[i] as HTMLElement;
      this.show(c, !!k);
      if (!k) return;
      this.text(c.children[0] as HTMLElement, k.key);
      this.text(c.children[1] as HTMLElement, k.name);
      set(c, "--ready", k.ready.toFixed(2));
      c.classList.toggle("ready", k.ready >= 1);
    });
    this.show(this.prompt, s.takedown);
    set(this.focus, "--a", s.bulletTime.toFixed(2));
    // The marker holds at full strength, then fades (per-class hold and fade, S1.2), on real time.
    this.hitAge += dt * 1000;
    const hitA = this.hitAge < this.hitHold ? 1 : Math.max(0, 1 - (this.hitAge - this.hitHold) / this.hitFade);
    set(this.hit, "--a", hitA.toFixed(2));
    this.blockedAge += dt * 1000;
    const glyph = tuning.blocked.glyphMs;
    const blockedA = this.blockedAge < glyph * 0.6 ? 1 : Math.max(0, 1 - (this.blockedAge - glyph * 0.6) / (glyph * 0.4));
    set(this.blockedEl, "--a", blockedA.toFixed(2));
    // While a marker or the brackets show, the crosshair's arms step back so the confirm reads alone.
    set(this.cross, "--arm", (1 - 0.85 * Math.max(hitA, blockedA)).toFixed(2));
    // A killed target's bar: flash, collapse, then hide.
    if (this.targetDead > 0) {
      this.targetDead -= dt;
      if (this.targetDead <= 0) {
        this.targetT = 0;
        this.target.classList.remove("is-dead");
      }
    }

    // Threat arcs: one per enemy that has noticed her, pointing their way.
    const arcs = this.threats.children;
    while (arcs.length < s.threats.length) el("span", "hud-threat", this.threats);
    for (let i = 0; i < arcs.length; i++) {
      const a = arcs[i] as HTMLElement;
      const t = s.threats[i];
      this.show(a, !!t);
      if (!t) continue;
      set(a, "--rot", `${t.bearing.toFixed(2)}rad`);
      set(a, "--fill", t.amount.toFixed(2));
      a.classList.toggle("hunting", t.hunting);
    }
  }

  /** Restarts a one-shot class animation (the HP hit punch, the objective wipe). */
  private punchTimers = new WeakMap<HTMLElement, number>();
  private punch(e: HTMLElement, cls: string, ms = 260): void {
    // Restart a running punch by dropping the class and adding it back next frame, rather than remove/reflow/add,
    // so a hit frame never forces a synchronous layout inside the rAF update.
    clearTimeout(this.punchTimers.get(e));
    if (e.classList.contains(cls)) {
      e.classList.remove(cls);
      requestAnimationFrame(() => e.classList.add(cls));
    } else e.classList.add(cls);
    this.punchTimers.set(
      e,
      window.setTimeout(() => {
        if (!this.frozen) e.classList.remove(cls);
      }, ms),
    );
  }

  private ghostPrev = { flesh: -1, guard: -1 };

  /** A damage arc on the ring pointing where the hit came from (S6.2). A bare bearing is a one-off source. */
  hurtFrom(bearing: number | HurtSource): void {
    this.dmg.hit(typeof bearing === "number" ? { key: null, bearing, elevDeg: 0, kind: "bullet", share: 0.12 } : bearing);
  }

  /**
   * C7 (S6.3): the wounded loop on the HUD, once a frame. `pulse` is the heartbeat (0..1): bleeding, the Flesh bar
   * swells 1.0 to 1.15 tall on each beat and its numeral turns blood-hot. The tag beside her name says the tier.
   */
  setWound(pulse: number, tier: "fine" | "hurt" | "critical" | "bleeding"): void {
    const bleeding = tier === "bleeding";
    this.hpBar.root.style.setProperty("--beat", bleeding ? pulse.toFixed(3) : "0");
    this.vbar.classList.toggle("is-critical", tier === "critical");
    this.vbar.classList.toggle("is-bleeding", bleeding);
    this.hpText.classList.toggle("is-bleeding", bleeding);
    this.woundTag.style.setProperty("--beat", pulse.toFixed(3));
    if (tier !== this.woundTier) {
      this.woundTier = tier;
      // Critical or worse, the tag takes the name's place: the row never grows past the cluster (phone review).
      this.woundTag.parentElement?.classList.toggle("is-wounded", tier === "critical" || bleeding);
      this.woundTag.textContent = tier === "critical" ? "Critical" : bleeding ? "Bleeding out" : "";
      this.woundTag.className = `hud-wound${tier === "critical" || bleeding ? ` is-${tier}` : ""}`;
    }
  }

  /** Screenshot stages: the bars were last drawn at these shares, so the next drop shows its damage ghost. */
  primeVitals(guard: number, flesh: number): void {
    this.ghost.guard = this.ghostPrev.guard = guard;
    this.ghost.flesh = this.ghostPrev.flesh = flesh;
    this.lastGuard = guard;
  }

  /** The strongest damage arc's opacity (tests and the screenshot runner). */
  get hurtAlpha(): number {
    return this.dmg.alpha;
  }

  /** Guard broke: 12 cyan shards fly 45 to 125u out to the right spinning over 380 ms, the bar cracks white-hot, and the edges flash cyan for a frame. */
  private guardBreak(): void {
    this.punch(this.shards, "go", 400);
    this.punch(this.crackFlash, "go", 200);
    this.punch(this.rim, "flash", 120);
  }

  /**
   * A short health bar for whoever she just hit. On a kill (`lethal`) the bar flashes, collapses to nothing
   * over 180 ms and hides 400 ms later, so a dead man's bar never hangs about (S1.2's target-bar fix).
   */
  targetHit(name: string, frac: number, lethal = false): void {
    this.text(this.target.firstElementChild as HTMLElement, name);
    // A living target never reads empty: a hair of health left shows as a visible sliver (6%), so an empty bar
    // always means a kill.
    this.targetFill.style.setProperty("--v", String(lethal ? 0 : Math.max(frac > 0 ? 0.06 : 0, Math.min(1, frac))));
    if (lethal) {
      this.targetT = Math.max(this.targetT, 1);
      this.targetDead = (tuning.targetBar.collapseMs + tuning.targetBar.hideAfterMs) / 1000;
      this.punch(this.target, "is-dead", tuning.targetBar.collapseMs + tuning.targetBar.hideAfterMs + 40);
    } else {
      this.targetT = tuning.targetBar.holdS;
      this.targetDead = 0;
      this.target.classList.remove("is-dead");
    }
  }

  /** True while a killed target's bar is collapsing (for tests and the screenshot checks). */
  get targetVisible(): boolean {
    return this.targetT > 0 && this.targetDead <= 0;
  }

  /**
   * The hit marker (S1.2). The class (body, head, armour, armour break, pen, kill, head kill) sets the size,
   * colour, pop, hold and fade; it never depends on the damage. A new hit restarts the animation.
   * The old boolean form (kill, head, soft) still works.
   */
  hitMarker(cls: HitClass | boolean, head = false, soft = false): void {
    const c: HitClass = typeof cls === "string" ? cls : cls ? (head ? "headKill" : "kill") : head ? "head" : soft ? "armour" : "body";
    const m = tuning.marker[c];
    for (const k of HIT_CLASSES) this.hit.classList.toggle(`c-${k}`, k === c);
    this.hit.classList.add("on");
    // Sizes come straight from the tuning table, in --u (S8), so tests and the HUD read the same numbers.
    this.prop(this.hit, "--len", `calc(var(--u) * ${m.len})`);
    this.prop(this.hit, "--th", `max(2px, calc(var(--u) * ${m.thick}))`);
    this.prop(this.hit, "--gap", `calc(var(--u) * ${m.gap})`);
    this.prop(this.hit, "--ring", `calc(var(--u) * ${tuning.killRing.toU})`);
    this.prop(this.hit, "--pop", String(m.pop));
    this.prop(this.hit, "--pop-ms", `${m.popMs}ms`);
    this.hitAge = 0;
    this.hitHold = m.holdMs;
    this.hitFade = m.fadeMs;
    if (c === "kill" || c === "headKill") {
      // The ring outlives the ticks: give the marker long enough to finish it.
      this.hitFade = Math.max(m.fadeMs, tuning.killRing.ms);
    }
    this.punch(this.hit, "pop", Math.max(120, m.popMs + 40));
    if (c === "kill" || c === "headKill") this.punch(this.hitRing, "go", tuning.killRing.ms + 40);
    if (c === "headKill") this.punch(this.hit.querySelector(".hud-hit-ring-2") as HTMLElement, "go", tuning.killRing.ms + 160);
    if (c === "armourBreak") this.punch(this.hit.querySelector(".hud-hit-shatter") as HTMLElement, "go", 260);
  }

  /** Screenshot stages: hold the marker, brackets and their animations at `tMs` after the event. */
  private frozen = false;
  freeze(tMs: number | null): void {
    this.frozen = tMs !== null;
    this.root.classList.toggle("is-frozen", this.frozen);
    if (tMs === null) return;
    // Only what actually fired is held at tMs; the rest stays hidden.
    if (this.hitAge < 1e8) this.hitAge = tMs;
    if (this.blockedAge < 1e8) this.blockedAge = tMs;
    this.dmg.advance(tMs / 1000);
    // A killed target's bar runs its real collapse up to tMs (flash and fade, then hidden after 580 ms).
    if (this.targetDead > 0) {
      this.targetDead -= tMs / 1000;
      if (this.targetDead <= 0) {
        this.targetDead = 0;
        this.targetT = 0;
        this.target.classList.remove("is-dead");
      }
    }
    this.root.style.setProperty("--freeze-t", `${-tMs}ms`);
  }

  /** Clears the marker and the brackets (a new screenshot stage starts clean). */
  clearFeedback(): void {
    this.dmg.clear();
    this.lastHp = -1;
    this.lastGuard = -1;
    this.ghost.flesh = this.ghost.guard = -1;
    this.ghostPrev.flesh = this.ghostPrev.guard = -1;
    this.targetT = 0;
    this.targetDead = 0;
    this.target.classList.remove("is-dead");
    this.hitAge = 1e9;
    this.blockedAge = 1e9;
    for (const k of HIT_CLASSES) this.hit.classList.remove(`c-${k}`);
    this.prop(this.hit, "--a", "0");
    this.prop(this.blockedEl, "--a", "0");
    // Kill-feed lines from the stage before would read as this stage's.
    this.feed.replaceChildren();
    this.toastEl?.classList.remove("on");
    // One-shot animations (the kill rings, the armour shatter, the pops) are held while frozen: drop them.
    const oneShots: Array<[HTMLElement | null, string[]]> = [
      [this.hit, ["pop"]],
      [this.hitRing, ["go"]],
      [this.hit.querySelector<HTMLElement>(".hud-hit-ring-2"), ["go"]],
      [this.hit.querySelector<HTMLElement>(".hud-hit-shatter"), ["go"]],
      [this.blockedEl, ["pop"]],
      [this.shards, ["go"]],
      [this.crackFlash, ["go"]],
      [this.rim, ["flash"]],
    ];
    for (const [e, classes] of oneShots) {
      if (!e) continue;
      clearTimeout(this.punchTimers.get(e));
      this.punchTimers.delete(e);
      e.classList.remove(...classes);
    }
  }

  /** The class the marker last showed (for tests and the screenshot sidecars). */
  get hitClass(): HitClass | null {
    return HIT_CLASSES.find((k) => this.hit.classList.contains(`c-${k}`)) ?? null;
  }

  /** Cover stopped a round aimed at someone she can see: brackets, never a hit marker (S1.1). */
  blocked(): void {
    this.blockedAge = 0;
    this.blockedUses++;
    this.blockedEl.classList.toggle("worded", this.blockedUses <= tuning.blocked.wordUses);
    this.punch(this.blockedEl, "pop", 200);
  }

  /** Lays a feed line out as data: "+90 XP" in amber mono, short modifiers in cyan caps, the rest in ink. */
  private feedBits(p: HTMLElement, text: string): void {
    text.split(" · ").forEach((bit, i) => {
      if (i > 0) el("span", "sep", p).textContent = "·";
      const xp = /^\+\d[\d,]*\s+(XP|Scrip)$/.test(bit);
      const mod = !xp && /^[A-Z][a-z]+( [a-z]+)?$/.test(bit) && bit.length <= 14;
      el("span", xp ? "xp" : mod ? "mod" : "noun", p).textContent = bit;
    });
  }

  private feedPush(p: HTMLElement, ms: number, cap: number): void {
    const lines = Array.from(this.feed.children) as HTMLElement[];
    lines.forEach((l, i) => l.style.setProperty("--i", String(lines.length - i)));
    setTimeout(() => p.remove(), ms);
    while (this.feed.children.length > cap) this.feed.firstElementChild?.remove();
  }

  /** A line in the feed: "+90 XP · Headshot · Unseen". */
  feedLine(text: string, strong = false): void {
    const p = el("p", strong ? "hud-feed-line strong" : "hud-feed-line", this.feed);
    this.feedBits(p, text);
    this.feedPush(p, 4400, 4);
  }

  /** A pickup line in the item's rarity colour. */
  feedItem(name: string, rarity: string): void {
    const p = el("p", `hud-feed-line item r-${rarity}`, this.feed);
    el("span", "hud-feed-tag", p).textContent = "Picked up";
    el("span", "noun", p).textContent = name;
    this.feedPush(p, 4400, 4);
  }

  /** The touch controls' boxes (CSS px), re-measured on a resize or every 2 s (the stick's home moves with it). */
  private ctrlZones: { x0: number; y0: number; x1: number; y1: number }[] | null = null;
  private ctrlKey = "";
  private ctrlAt = 0;
  private clearOfControls(px: number, py: number, W: number, H: number): [number, number] {
    const now = performance.now();
    const key = `${W}x${H}`;
    if (key !== this.ctrlKey || now - this.ctrlAt > 2000) {
      this.ctrlKey = key;
      this.ctrlAt = now;
      const zones: { x0: number; y0: number; x1: number; y1: number }[] = [];
      for (const e of document.querySelectorAll<HTMLElement>(".tbtn, .tbtn-menu, .stick:not(.on), .look-hint:not(.gone)")) {
        if (e.closest("[hidden]")) continue;
        const b = e.getBoundingClientRect();
        if (b.width > 0) zones.push({ x0: b.left - 6, y0: b.top - 6, x1: b.right + 6, y1: b.bottom + 6 });
      }
      this.ctrlZones = zones.length ? zones : null;
    }
    const zones = this.ctrlZones;
    if (!zones) return [px, py];
    // The marker's box around its anchor: the 52u halo, and the distance plate under it.
    const u = Math.min(2.4, Math.max(0.62, Math.min(H / 1080, W / 1920))) * this.hudScaleV;
    const hx = Math.max(30, 28 * u);
    const top = Math.max(30, 28 * u);
    const bot = Math.max(30, 30 * u) + Math.max(20, 22 * u);
    const hit = (x: number, y: number) => zones.some((z) => x + hx > z.x0 && x - hx < z.x1 && y + bot > z.y0 && y - top < z.y1);
    const cx = W / 2;
    const cy = H / 2;
    for (let t = 1; t > 0.15; t -= 0.03) {
      const x = cx + (px - cx) * t;
      const y = cy + (py - cy) * t;
      if (!hit(x, y)) return [x, y];
    }
    return [px, py];
  }

  private teachEl?: HTMLElement;
  private teachText: string | null = null;
  private wp?: HTMLElement;
  private wpDist?: HTMLElement;
  private wpPulse = 6;
  private wprompt?: { root: HTMLElement; chip: HTMLElement; key: HTMLElement; verb: HTMLElement; name: HTMLElement; stats: HTMLElement };
  private wpromptKey = "";
  /** A tap on the world prompt (touch): the session takes the weapon. */
  onTake: (() => void) | null = null;

  private updatePickup(p: HudState["pickup"]): void {
    if (!p) {
      if (this.wprompt && !this.wprompt.root.hidden) this.wprompt.root.hidden = true;
      return;
    }
    if (!this.wprompt) {
      const root = el("div", "hud-wprompt", this.root);
      el("i", "hud-wprompt-pin", root);
      el("i", "hud-wprompt-lead", root);
      // A real button (touch): its name says what a tap does, and it presses in like the action buttons.
      const chip = el("button", "hud-wprompt-chip", root);
      chip.setAttribute("type", "button");
      const key = el("span", "c-key hud-wprompt-key", chip);
      const main = el("p", "hud-wprompt-main", chip);
      const verb = el("span", "hud-wprompt-verb", main);
      el("span", "hud-wprompt-sep", main).textContent = "·";
      const name = el("span", "hud-wprompt-name", main);
      const stats = el("p", "hud-wprompt-stats", chip);
      chip.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.onTake?.();
      });
      this.wprompt = { root, chip, key, verb, name, stats };
      root.hidden = true;
    }
    const w = this.wprompt;
    const was = w.root.hidden;
    w.root.hidden = false;
    if (was) this.punch(w.root, "is-in", 320);
    this.prop(w.root, "--px", `${Math.round(p.x)}px`);
    this.prop(w.root, "--py", `${Math.round(p.y)}px`);
    // Too near the right edge: the chip opens to the left of the gun instead.
    w.root.classList.toggle("flip", p.x > innerWidth * 0.62);
    const tap = p.key === "Tap";
    this.text(w.key, tap ? "" : p.key);
    w.key.classList.toggle("tap", tap);
    w.key.classList.toggle("wide", !tap && p.key.length > 1);
    w.key.setAttribute("aria-label", p.key);
    this.text(w.verb, p.verb);
    this.text(w.name, p.name);
    const label = `${p.verb} ${p.name}`;
    if (w.chip.getAttribute("aria-label") !== label) w.chip.setAttribute("aria-label", label);
    const sig = p.stats.map((x) => x.join(":")).join("|");
    if (sig !== this.wpromptKey) {
      this.wpromptKey = sig;
      w.stats.replaceChildren();
      for (const [label, value] of p.stats) {
        const c = el("span", "hud-wprompt-stat", w.stats);
        el("i", "", c).textContent = label;
        el("b", "num", c).textContent = value;
      }
    }
  }

  /** The HUD-size setting (S8), for sizes the script needs in px. */
  private hudScaleV = 1;
  private toastEl?: HTMLElement;
  private toastTimer = 0;
  /** An amber toast for a new weapon (S7.1): "NEW WEAPON" over the name, sliding in, gone after 3.2 s. */
  toast(kind: string, name: string, sub?: string): void {
    if (!this.toastEl) {
      // On a phone it joins the top-right stack under the arms and the feed, so it never lands on either.
      const tr = matchMedia("(pointer: coarse)").matches ? this.root.querySelector<HTMLElement>(".hud-tr") : null;
      this.toastEl = el("div", "hud-toast", tr ?? this.root);
      this.toastEl.setAttribute("role", "status");
    }
    const t = this.toastEl;
    t.replaceChildren();
    el("p", "hud-toast-kind", t).textContent = kind;
    el("p", "hud-toast-name", t).textContent = name;
    el("i", "hud-toast-rule", t);
    if (sub) el("p", "hud-toast-sub", t).textContent = sub;
    t.classList.remove("on");
    void t.offsetWidth;
    t.classList.add("on");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      if (!this.frozen) t.classList.remove("on");
    }, 3200);
  }

  /** The how-to line for what the game is teaching right now (null hides it). Key names become keycaps. */
  teach(text: string | null): void {
    if (text === this.teachText) return;
    this.teachText = text;
    if (!this.teachEl) this.teachEl = el("p", "hud-teach", this.root);
    this.teachEl.replaceChildren();
    for (const part of (text ?? "").split(/(\b(?:WASD|Shift|Space|Esc|[A-Z])\b)/)) {
      if (!part) continue;
      if (/^(WASD|Shift|Space|Esc|[A-Z])$/.test(part) && part !== "I" && part !== "A") el("span", "c-key", this.teachEl).textContent = part;
      else this.teachEl.append(part);
    }
    this.teachEl.classList.toggle("on", !!text);
  }

  private cap?: HTMLElement;
  private capTimer = 0;

  /** The kill-cam's lower-third: the range of the shot, in a red-ruled plate. Fades by itself. */
  killcamCaption(metres: number): void {
    if (!this.cap) {
      this.cap = el("p", "hud-killcap", this.root);
      this.cap.setAttribute("aria-hidden", "true");
    }
    this.cap.replaceChildren();
    el("span", "hud-killcap-tag", this.cap).textContent = "Long shot";
    el("span", "hud-killcap-m", this.cap).textContent = `${Math.round(metres)} m`;
    this.cap.classList.remove("on");
    requestAnimationFrame(() => this.cap?.classList.add("on"));
    clearTimeout(this.capTimer);
    this.capTimer = window.setTimeout(() => this.cap?.classList.remove("on"), 3000);
  }

  private sub?: HTMLElement;
  private subTimer = 0;

  /** Cath's voiceover (or Bea on the wire), as a subtitle on per-line plates with the speaker's colour. */
  subtitle(text: string): void {
    if (!this.sub) {
      this.sub = el("p", "hud-sub", this.root);
    }
    this.sub.replaceChildren();
    const m = /^(Bea|Cath): /.exec(text);
    const who = m?.[1] ?? "Cath";
    this.sub.style.setProperty("--speaker", SPEAKER[who] ?? "var(--ink-2)");
    el("span", "hud-sub-name", this.sub).textContent = who;
    el("span", "line", this.sub).textContent = m ? text.slice(m[0].length) : text;
    this.sub.classList.add("on");
    clearTimeout(this.subTimer);
    this.subTimer = window.setTimeout(() => this.sub?.classList.remove("on"), 1800 + text.length * 45);
  }

  private introTimer = 0;
  /**
   * The district or boss banner. While it is up the HUD gives it the stage: `banner-on` fades the feed and
   * the touch look hint (they sit in the band's path on a short landscape phone), and a boss intro's
   * letterbox fades every corner cluster instead of slicing through them.
   */
  showBanner(title: string, sub: string, kind?: "boss"): void {
    this.banner.replaceChildren();
    this.root.classList.toggle("boss-intro", kind === "boss");
    this.root.classList.add("banner-on");
    document.documentElement.classList.add("hud-banner-on");
    clearTimeout(this.introTimer);
    this.introTimer = window.setTimeout(() => {
      this.root.classList.remove("boss-intro", "banner-on");
      document.documentElement.classList.remove("hud-banner-on");
    }, 3200);
    const p = el("p", "hud-banner-sub", this.banner);
    p.textContent = sub;
    const h = el("p", "hud-banner-title", this.banner);
    h.textContent = title;
    // Restart the entrance without forcing a layout: drop the class now, put it back on the next frame.
    this.banner.classList.remove("on");
    requestAnimationFrame(() => this.banner.classList.add("on"));
  }

  /** The ending credits (vault finale). */
  showCredits(onDone: () => void): void {
    if (document.pointerLockElement) document.exitPointerLock();
    showCredits(this.root, onDone);
  }

  private pause?: HTMLElement;
  private pauseTitle?: HTMLElement;
  /** The pause card's Resume button (and, on desktop, a click anywhere behind the card). */
  onResume?: () => void;
  /** The volume slider moved (0..1). */
  onVolume?: (v: number) => void;
  /** The difficulties she may pick and the current one; the pause card shows a row when more than Noir is open. */
  /** The last checkpoint's name, shown in the pause card (null before the first one). */
  checkpoint: (() => string | null) | null = null;
  private pauseCheck?: HTMLElement;
  difficulty?: { current: string; options: Array<[string, string]>; apply: (v: string) => void };

  /**
   * The pause menu: Esc on desktop, the menu button on a phone (owner, iPhone, 2026-10-04: "once started no
   * way to open settings or access a menu"). Resume, volume, graphics, violence, the controls, and the way out.
   */
  showPause(on: boolean, touch = false): void {
    if (!this.pause) {
      this.pause = el("div", "hud-pause", this.root.parentElement ?? this.root);
      const card = el("div", "hud-pause-card", this.pause);
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", "Paused");
      this.pauseTitle = el("p", "hud-pause-title", card);
      this.pauseCheck = el("p", "hud-pause-check", card);
      const resume = el("button", "btn btn-primary hud-resume", card);
      resume.setAttribute("type", "button");
      resume.textContent = "Resume";
      resume.addEventListener("click", () => this.onResume?.());

      const prefs = loadPrefs();
      const set = el("div", "hud-settings", card);
      const vol = el("label", "hud-set", set);
      el("span", "hud-set-name", vol).textContent = "Volume";
      const slider = el("input", "hud-slider", vol) as HTMLInputElement;
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.value = String(Math.round(prefs.volume * 100));
      slider.addEventListener("input", () => {
        const v = Number(slider.value) / 100;
        this.onVolume?.(v);
        savePrefs({ ...loadPrefs(), volume: v });
      });
      // Graphics and violence take effect on a reload into the same job (the street is built for them).
      // `live` settings apply on the spot (through the "cathode:prefs" event): no reload mid-mission.
      const choice = <T extends string>(name: string, opts: Array<[T, string]>, current: T, apply: (v: T) => void, live = false) => {
        const row = el("div", "hud-set", set);
        el("span", "hud-set-name", row).textContent = name;
        const seg = el("div", "hud-seg", row);
        for (const [v, label] of opts) {
          const b = el("button", "hud-seg-btn", seg);
          b.setAttribute("type", "button");
          b.textContent = label;
          b.setAttribute("aria-pressed", String(v === current));
          b.addEventListener("click", () => {
            if (v === current) return;
            apply(v);
            if (!live) {
              location.reload();
              return;
            }
            current = v;
            for (const x of seg.children) x.setAttribute("aria-pressed", String(x === b));
          });
        }
      };
      if (this.difficulty && this.difficulty.options.length > 1) {
        choice<string>("Difficulty", this.difficulty.options, this.difficulty.current, this.difficulty.apply);
      }
      choice<QualityChoice>(
        "Graphics",
        [
          ["auto", "Auto"],
          ["phone", "Fast"],
          ["high", "High"],
          ["ultra", "Ultra"],
        ],
        prefs.quality,
        (v) => savePrefs({ ...loadPrefs(), quality: v }),
      );
      choice<Intensity>(
        "Violence",
        [
          ["full", "Full"],
          ["reduced", "Reduced"],
        ],
        prefs.intensity,
        (v) => savePrefs({ ...loadPrefs(), intensity: v }),
      );
      // C7: how hard the screen sells a wound, and the heartbeat you hear when she's in trouble.
      choice<DamageFx>(
        "Damage effects",
        [
          ["full", "Full"],
          ["reduced", "Reduced"],
          ["minimal", "Minimal"],
        ],
        prefs.damageFx,
        (v) => {
          savePrefs({ ...loadPrefs(), damageFx: v });
          window.dispatchEvent(new Event("cathode:prefs"));
        },
        true,
      );

      const toggle = (name: string, key: "bigSubs" | "calmCamera" | "colourSafe" | "holdToggle" | "invertY" | "heartbeat", apply?: (on: boolean) => void) => {
        const row = el("div", "hud-set", set);
        el("span", "hud-set-name", row).textContent = name;
        const seg = el("div", "hud-seg", row);
        const cur = loadPrefs()[key];
        const btns = ([false, true] as const).map((on) => {
          const b = el("button", "hud-seg-btn", seg);
          b.setAttribute("type", "button");
          b.textContent = on ? "On" : "Off";
          b.setAttribute("aria-pressed", String(on === cur));
          b.addEventListener("click", () => {
            savePrefs({ ...loadPrefs(), [key]: on });
            btns.forEach((x, i) => x.setAttribute("aria-pressed", String((i === 1) === on)));
            apply?.(on);
          });
          return b;
        });
      };
      toggle("Large subtitles", "bigSubs", (on) => this.root.classList.toggle("big-subs", on));
      toggle("Heartbeat", "heartbeat", () => window.dispatchEvent(new Event("cathode:prefs")));
      if (!touch) {
        const sens = el("label", "hud-set", set);
        el("span", "hud-set-name", sens).textContent = "Look speed";
        const ss = el("input", "hud-slider", sens) as HTMLInputElement;
        ss.type = "range";
        ss.min = "40";
        ss.max = "250";
        ss.value = String(Math.round(prefs.lookScale * 100));
        ss.addEventListener("input", () => {
          savePrefs({ ...loadPrefs(), lookScale: Number(ss.value) / 100 });
          window.dispatchEvent(new Event("cathode:prefs"));
        });
        toggle("Invert look Y", "invertY", () => window.dispatchEvent(new Event("cathode:prefs")));
      }
      const xs = el("label", "hud-set", set);
      el("span", "hud-set-name", xs).textContent = "Crosshair size";
      const xi = el("input", "hud-slider", xs) as HTMLInputElement;
      xi.type = "range";
      xi.min = "70";
      xi.max = "200";
      xi.value = String(Math.round(prefs.crossScale * 100));
      xi.addEventListener("input", () => {
        savePrefs({ ...loadPrefs(), crossScale: Number(xi.value) / 100 });
        this.root.style.setProperty("--xs", String(Number(xi.value) / 100));
      });
      const hs = el("label", "hud-set", set);
      el("span", "hud-set-name", hs).textContent = "HUD size";
      const hi = el("input", "hud-slider", hs) as HTMLInputElement;
      hi.type = "range";
      hi.min = "80";
      hi.max = "130";
      hi.step = "5";
      hi.value = String(Math.round(prefs.hudScale * 100));
      hi.addEventListener("input", () => {
        savePrefs({ ...loadPrefs(), hudScale: Number(hi.value) / 100 });
        this.hudScaleV = Number(hi.value) / 100;
        document.documentElement.style.setProperty("--hud-scale", String(this.hudScaleV));
        window.dispatchEvent(new Event("cathode:prefs"));
      });
      toggle("Calm camera", "calmCamera");
      {
        // Reduce motion: Auto follows the system; On or Off overrides it (menus, the HUD boot, count-ups).
        const row = el("div", "hud-set", set);
        el("span", "hud-set-name", row).textContent = "Reduce motion";
        const seg = el("div", "hud-seg", row);
        const opts: Array<[boolean | null, string]> = [
          [null, "Auto"],
          [true, "On"],
          [false, "Off"],
        ];
        const cur = loadPrefs().reduceMotion;
        const btns = opts.map(([v, label]) => {
          const b = el("button", "hud-seg-btn", seg);
          b.setAttribute("type", "button");
          b.textContent = label;
          b.setAttribute("aria-pressed", String(v === cur));
          b.addEventListener("click", () => {
            const p = { ...loadPrefs(), reduceMotion: v };
            savePrefs(p);
            applyMotionPref(p);
            // The Kestrel's clip turns and the camera trauma read this live (not only at session start).
            window.dispatchEvent(new Event("cathode:prefs"));
            btns.forEach((x, i) => x.setAttribute("aria-pressed", String(opts[i]![0] === v)));
          });
          return b;
        });
      }
      toggle("Colour-blind colours", "colourSafe", (on) => document.documentElement.classList.toggle("colour-safe", on));
      toggle("Toggle sprint and aim", "holdToggle", () => window.dispatchEvent(new Event("cathode:prefs")));

      if (!touch) {
        el("h3", "hud-set-head", set).textContent = "Keys (click to rebind)";
        const rows = el("div", "hud-binds", set);
        const drawBinds = () => {
          rows.replaceChildren();
          const cur = loadPrefs().binds;
          for (const b of BINDABLE) {
            const row = el("div", "hud-set", rows);
            el("span", "hud-set-name", row).textContent = b.label;
            const btn = el("button", "hud-seg-btn hud-bind", row);
            btn.setAttribute("type", "button");
            const cap = el("span", "c-key", btn);
            cap.textContent = keyLabel(codesFor(cur, b.id)[0] ?? "");
            btn.addEventListener("click", () => {
              cap.textContent = "Press a key…";
              const onKey = (e: KeyboardEvent) => {
                e.preventDefault();
                e.stopPropagation();
                removeEventListener("keydown", onKey, true);
                if (e.code !== "Escape") {
                  savePrefs({ ...loadPrefs(), binds: rebind(loadPrefs().binds, b.id, e.code) });
                  window.dispatchEvent(new Event("cathode:prefs"));
                }
                drawBinds();
              };
              addEventListener("keydown", onKey, true);
            });
          }
          const reset = el("button", "hud-seg-btn", rows);
          reset.setAttribute("type", "button");
          reset.textContent = "Reset keys";
          reset.addEventListener("click", () => {
            savePrefs({ ...loadPrefs(), binds: {} });
            window.dispatchEvent(new Event("cathode:prefs"));
            drawBinds();
          });
        };
        drawBinds();
      }

      if (!touch) {
        const keys: Array<[string, string]> = [
          ["WASD", "Move"],
          ["Mouse", "Look · Left fire · Right aim"],
          ["Shift", "Sprint"],
          ["C", "Crouch · slide when sprinting"],
          ["Space", "Jump · climb a ledge"],
          ["Q / E", "Lean"],
          ["B", "Photo mode"],
          ["F", "Takedown from behind"],
          ["X", "Focus: slow time"],
          ["R", "Reload"],
          ["1–9 · Wheel", "Switch weapons"],
          ["K", "Cath's sheet: skills and kit"],
        ];
        const dl = el("dl", "hud-keys", card);
        for (const [k, v] of keys) {
          const dt = el("dt", "", dl);
          // "Q / E" and "1–9 · Wheel" become one keycap per key.
          k.split(/\s*[/·]\s*/).forEach((part, i) => {
            if (i > 0) dt.append(" ");
            el("span", "c-key", dt).textContent = part;
          });
          el("dd", "", dl).textContent = v;
        }
      }
      const quit = el("a", "hud-quit", card);
      quit.textContent = "Back to the title";
      quit.setAttribute("href", "./");
    }
    if (this.pauseTitle) this.pauseTitle.textContent = touch ? "Paused" : "Paused · click to play";
    if (this.pauseCheck) {
      const c = this.checkpoint?.() ?? null;
      this.pauseCheck.textContent = c ? `Checkpoint: ${c}. Dying restarts you there.` : "";
      this.pauseCheck.hidden = !c;
    }
    this.pause.hidden = !on;
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
  }
}
