// The HUD, in the DOM over the canvas. CSP-safe: no inline style attributes, only classes and CSS custom
// properties set through the CSSOM. Noir-quiet by default: thin rules, small caps, red only for blood.

import { loadPrefs, savePrefs, type Intensity, type QualityChoice } from "../prefs";

export interface HudState {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  weapon: string;
  mag: number;
  reserve: number;
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
  takedown: boolean;
  bulletTime: number;
  /** The two active-skill slots (name and readiness 0..1), and the battery 0..1. */
  skills: Array<{ name: string; ready: number; key: string } | null>;
  battery: number;
  /** Armour and resistances, one short line (empty when she has none). */
  defence?: string;
  /** Where the objective is on screen (0..1 each way), metres away, and whether it's behind her. */
  waypoint?: { x: number; y: number; dist: number; behind: boolean } | null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  parent?.append(e);
  return e;
}

export class Hud {
  private root: HTMLElement;
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private lvl: HTMLElement;
  private xpFill: HTMLElement;
  private weapon: HTMLElement;
  private ammo: HTMLElement;
  private cross: HTMLElement;
  private hit: HTMLElement;
  private vignette: HTMLElement;
  private scope: HTMLElement;
  private scopeRange: HTMLElement;
  private scopeWind: HTMLElement;
  private threats: HTMLElement;
  private feed: HTMLElement;
  private objective: HTMLElement;
  private prompt: HTMLElement;
  private banner: HTMLElement;
  private focus: HTMLElement;
  private slots: HTMLElement;
  private bat: HTMLElement;
  private defence: HTMLElement;
  private lastHp = -1;
  private hurt = 0;
  private hitT = 0;

  constructor(host: HTMLElement) {
    host.replaceChildren();
    this.root = el("div", "hud-root", host);
    if (loadPrefs().bigSubs) this.root.classList.add("big-subs");
    // Objective, top left.
    this.objective = el("p", "hud-objective", this.root);
    // Health and level, bottom left.
    const vit = el("div", "hud-vitals", this.root);
    const name = el("p", "hud-name", vit);
    name.textContent = "Cath Hale";
    this.lvl = el("span", "hud-level", name);
    const hp = el("div", "hud-bar hud-hp", vit);
    this.hpFill = el("span", "hud-fill", hp);
    this.hpText = el("span", "hud-hp-text", vit);
    this.defence = el("p", "hud-defence", vit);
    const xp = el("div", "hud-bar hud-xp", vit);
    this.xpFill = el("span", "hud-fill", xp);
    // Weapon and ammo, bottom right.
    const arms = el("div", "hud-arms", this.root);
    this.weapon = el("p", "hud-weapon", arms);
    this.ammo = el("p", "hud-ammo", arms);
    this.slots = el("div", "hud-slots", arms);
    const bat = el("div", "hud-bar hud-battery", arms);
    this.bat = el("span", "hud-fill", bat);
    // The middle: crosshair, hit marker, threat arcs.
    this.cross = el("div", "hud-cross", this.root);
    for (const k of ["t", "b", "l", "r"]) el("span", `hud-cross-${k}`, this.cross);
    el("span", "hud-cross-dot", this.cross);
    this.hit = el("div", "hud-hit", this.root);
    this.threats = el("div", "hud-threats", this.root);
    this.prompt = el("p", "hud-prompt", this.root);
    this.focus = el("div", "hud-focus", this.root);
    // Overlays.
    this.vignette = el("div", "hud-hurt", this.root);
    this.scope = el("div", "hud-scope", this.root);
    const ret = el("div", "hud-reticle", this.scope);
    for (const m of [1, 2, 3, 4, 5]) {
      const t = el("span", "hud-mil", ret);
      t.dataset.mil = String(m);
    }
    this.scopeRange = el("p", "hud-scope-range", this.scope);
    this.scopeWind = el("p", "hud-scope-wind", this.scope);
    this.feed = el("div", "hud-feed", this.root);
    this.banner = el("div", "hud-banner", this.root);
  }

  update(dt: number, s: HudState): void {
    const set = (e: HTMLElement, k: string, v: string) => e.style.setProperty(k, v);
    set(this.hpFill, "--w", `${Math.max(0, (s.hp / s.maxHp) * 100)}%`);
    this.hpText.textContent = `${Math.ceil(s.hp)}`;
    if (this.lastHp >= 0 && s.hp < this.lastHp) this.hurt = Math.min(1, this.hurt + (this.lastHp - s.hp) / 30);
    this.lastHp = s.hp;
    this.hurt = Math.max(0, this.hurt - dt * 1.2);
    set(this.vignette, "--a", (this.hurt * 0.9 + (s.hp / s.maxHp < 0.3 ? 0.35 : 0)).toFixed(3));
    this.defence.textContent = s.defence ?? "";
    this.defence.hidden = !s.defence;
    this.lvl.textContent = `Level ${s.level}`;
    set(this.xpFill, "--w", `${Math.min(100, (s.xp / Math.max(1, s.xpNext)) * 100)}%`);
    this.weapon.textContent = s.weapon;
    this.ammo.textContent = s.melee ? "" : `${s.mag} / ${s.reserve}`;
    this.ammo.classList.toggle("low", !s.melee && s.mag <= 2);
    set(this.cross, "--gap", `${Math.round(6 + s.spread)}px`);
    this.cross.hidden = s.scoped;
    this.scope.hidden = !s.scoped;
    if (s.scoped) {
      this.scopeRange.textContent = `${Math.round(s.scopeRange)} m`;
      this.scopeWind.textContent = `Wind ${s.wind > 0 ? "→" : "←"} ${Math.abs(s.wind).toFixed(1)} m/s`;
    }
    this.objective.textContent = s.objective;
    // The waypoint: a diamond over the objective, pinned to the screen edge when it's off screen.
    if (!this.wp) {
      this.wp = el("div", "hud-wp", this.root);
      el("span", "hud-wp-dist", this.wp);
    }
    this.wp.hidden = !s.waypoint;
    if (s.waypoint) {
      const w = s.waypoint;
      let x = w.x;
      let y = w.y;
      if (w.behind) {
        x = x < 0.5 ? 0.04 : 0.96;
        y = 0.5;
      }
      set(this.wp, "--x", `${Math.min(0.96, Math.max(0.04, x)) * 100}%`);
      set(this.wp, "--y", `${Math.min(0.9, Math.max(0.1, y)) * 100}%`);
      (this.wp.firstElementChild as HTMLElement).textContent = `${Math.round(w.dist)} m`;
    }
    set(this.bat, "--w", `${Math.round(s.battery * 100)}%`);
    while (this.slots.children.length < 2) {
      const c = el("div", "hud-slot", this.slots);
      el("span", "hud-slot-key", c);
      el("span", "hud-slot-name", c);
    }
    s.skills.forEach((k, i) => {
      const c = this.slots.children[i] as HTMLElement;
      c.hidden = !k;
      if (!k) return;
      (c.children[0] as HTMLElement).textContent = k.key;
      (c.children[1] as HTMLElement).textContent = k.name;
      set(c, "--ready", k.ready.toFixed(2));
      c.classList.toggle("ready", k.ready >= 1);
    });
    this.prompt.textContent = s.takedown ? "F  Takedown" : "";
    this.prompt.hidden = !s.takedown;
    set(this.focus, "--a", s.bulletTime.toFixed(2));
    this.hitT = Math.max(0, this.hitT - dt);
    set(this.hit, "--a", (this.hitT * 4).toFixed(2));

    // Threat arcs: one per enemy that has noticed her, pointing their way.
    const arcs = this.threats.children;
    while (arcs.length < s.threats.length) el("span", "hud-threat", this.threats);
    for (let i = 0; i < arcs.length; i++) {
      const a = arcs[i] as HTMLElement;
      const t = s.threats[i];
      a.hidden = !t;
      if (!t) continue;
      set(a, "--rot", `${t.bearing}rad`);
      set(a, "--fill", t.amount.toFixed(2));
      a.classList.toggle("hunting", t.hunting);
    }
  }

  hitMarker(kill: boolean): void {
    this.hitT = 0.25;
    this.hit.classList.toggle("kill", kill);
  }

  /** A line in the feed: "+90 XP · Headshot · Unseen". */
  feedLine(text: string, strong = false): void {
    const p = el("p", strong ? "hud-feed-line strong" : "hud-feed-line", this.feed);
    p.textContent = text;
    setTimeout(() => p.remove(), 2600);
    while (this.feed.children.length > 5) this.feed.firstElementChild?.remove();
  }

  /** A pickup line in the item's rarity colour. */
  feedItem(name: string, rarity: string): void {
    const p = el("p", `hud-feed-line item rarity-${rarity}`, this.feed);
    p.textContent = name;
    setTimeout(() => p.remove(), 3400);
    while (this.feed.children.length > 6) this.feed.firstElementChild?.remove();
  }

  private teachEl?: HTMLElement;
  private teachText: string | null = null;
  private wp?: HTMLElement;

  /** The how-to line for what the game is teaching right now (null hides it). */
  teach(text: string | null): void {
    if (text === this.teachText) return;
    this.teachText = text;
    if (!this.teachEl) this.teachEl = el("p", "hud-teach", this.root);
    this.teachEl.textContent = text ?? "";
    this.teachEl.classList.toggle("on", !!text);
  }

  private sub?: HTMLElement;
  private subTimer = 0;

  /** Cath's voiceover, as a subtitle. */
  subtitle(text: string): void {
    if (!this.sub) {
      this.sub = el("p", "hud-sub", this.root);
    }
    this.sub.replaceChildren();
    const m = /^(Bea|Cath): /.exec(text);
    el("span", "hud-sub-name", this.sub).textContent = m?.[1] ?? "Cath";
    this.sub.append(m ? text.slice(m[0].length) : text);
    this.sub.classList.add("on");
    clearTimeout(this.subTimer);
    this.subTimer = window.setTimeout(() => this.sub?.classList.remove("on"), 1800 + text.length * 45);
  }

  showBanner(title: string, sub: string): void {
    this.banner.replaceChildren();
    const h = el("p", "hud-banner-title", this.banner);
    h.textContent = title;
    const p = el("p", "hud-banner-sub", this.banner);
    p.textContent = sub;
    this.banner.classList.remove("on");
    void this.banner.offsetWidth;
    this.banner.classList.add("on");
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
      const choice = <T extends string>(name: string, opts: Array<[T, string]>, current: T, apply: (v: T) => void) => {
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
            location.reload();
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

      const toggle = (name: string, key: "bigSubs" | "calmCamera", apply?: (on: boolean) => void) => {
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
      toggle("Calm camera", "calmCamera");

      if (!touch) {
        const keys: Array<[string, string]> = [
          ["WASD", "Move"],
          ["Mouse", "Look · Left fire · Right aim"],
          ["Shift", "Sprint"],
          ["C", "Crouch · slide when sprinting"],
          ["Space", "Jump · climb a ledge"],
          ["Q / E", "Lean"],
          ["F", "Takedown from behind"],
          ["X", "Focus: slow time"],
          ["R", "Reload"],
          ["1–9 · Wheel", "Switch weapons"],
          ["K", "Cath's sheet: skills and kit"],
        ];
        const dl = el("dl", "hud-keys", card);
        for (const [k, v] of keys) {
          el("dt", "", dl).textContent = k;
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
