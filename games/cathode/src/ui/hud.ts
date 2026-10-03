// The HUD, in the DOM over the canvas. CSP-safe: no inline style attributes, only classes and CSS custom
// properties set through the CSSOM. Noir-quiet by default: thin rules, small caps, red only for blood.

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
  private lastHp = -1;
  private hurt = 0;
  private hitT = 0;

  constructor(host: HTMLElement) {
    host.replaceChildren();
    this.root = el("div", "hud-root", host);
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
    const xp = el("div", "hud-bar hud-xp", vit);
    this.xpFill = el("span", "hud-fill", xp);
    // Weapon and ammo, bottom right.
    const arms = el("div", "hud-arms", this.root);
    this.weapon = el("p", "hud-weapon", arms);
    this.ammo = el("p", "hud-ammo", arms);
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

  /** The desktop pause card: the game waits behind it until a click captures the mouse again. */
  showPause(on: boolean): void {
    if (!this.pause) {
      this.pause = el("div", "hud-pause", this.root.parentElement ?? this.root);
      const card = el("div", "hud-pause-card", this.pause);
      const h = el("p", "hud-pause-title", card);
      h.textContent = "Click to play";
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
        ["1–4", "The Pin · Kestrel 9 · Fishmonger · Widowmaker"],
      ];
      const dl = el("dl", "hud-keys", card);
      for (const [k, v] of keys) {
        el("dt", "", dl).textContent = k;
        el("dd", "", dl).textContent = v;
      }
      const quit = el("a", "hud-quit", card);
      quit.textContent = "Back to the title";
      quit.setAttribute("href", "./");
    }
    this.pause.hidden = !on;
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
  }
}
