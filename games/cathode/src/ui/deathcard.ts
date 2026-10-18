// C8 "Dying, done properly" (docs/design/cathode-combat.md S6.6): everything on screen around her death that the
// grade doesn't draw. The 2.39:1 letterbox sliding in, the killer's name lingering and doubling in a corner (Max
// Payne 3), the death card itself (left-aligned in the 16:9 safe frame, never "Game Over"), the black of the
// re-sync and its cyan line. CSP-safe: every number reaches CSS through a custom property set with the CSSOM.

import { el } from "./dom";

export interface DeathCardInfo {
  /** "FLATLINED · FILE CLOSED · 02:14 · THE FISH MARKET". */
  eyebrow: string;
  /** One of Cath's death lines (voice.ts DEATH_LINES). */
  line: string;
  /** Mono rows: [label, value]. */
  stats: Array<[string, string]>;
  /** The keys shown on the two actions (touch shows none). */
  touch: boolean;
}

export class DeathScreen {
  readonly root: HTMLElement;
  private bars: HTMLElement;
  private killer: HTMLElement;
  private killerName: HTMLElement;
  private card: HTMLElement;
  private eyebrow: HTMLElement;
  private line: HTMLElement;
  private stats: HTMLElement;
  private retryBtn: HTMLButtonElement;
  private quitBtn: HTMLButtonElement;
  private black: HTMLElement;
  private resync: HTMLElement;
  private shown = false;
  /** The card's focused action (0 retry, 1 quit). */
  private focusI = 0;
  onRetry: (() => void) | null = null;
  onQuit: (() => void) | null = null;
  /** The UI tick on a focus change (S6.6). */
  onTick: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.root = el("div", "death", host);
    this.root.setAttribute("aria-hidden", "true");
    this.bars = el("div", "death-bars", this.root);
    el("i", "death-bar death-bar-t", this.bars);
    el("i", "death-bar death-bar-b", this.bars);
    this.killer = el("div", "death-killer", this.root);
    el("span", "death-killer-tag", this.killer, "Killed by");
    this.killerName = el("span", "death-killer-name", this.killer);
    this.card = el("div", "death-card", this.root);
    this.card.setAttribute("role", "dialog");
    this.card.setAttribute("aria-label", "Flatlined");
    const inner = el("div", "death-card-in", this.card);
    this.eyebrow = el("p", "death-eyebrow", inner);
    this.line = el("h2", "death-line", inner);
    el("span", "death-rule", inner);
    this.stats = el("dl", "death-stats", inner);
    const acts = el("div", "death-actions", inner);
    this.retryBtn = this.action(acts, "Retry from checkpoint", "Enter", true);
    this.quitBtn = this.action(acts, "Quit to title", "Esc", false);
    this.retryBtn.addEventListener("click", () => this.onRetry?.());
    this.quitBtn.addEventListener("click", () => this.onQuit?.());
    for (const [i, b] of [this.retryBtn, this.quitBtn].entries()) {
      b.addEventListener("pointerenter", () => this.focus(i));
      b.addEventListener("focus", () => this.focus(i));
    }
    // Staggered rise (60 ms apart) for each line of the card.
    [...inner.children].forEach((c, i) => (c as HTMLElement).style.setProperty("--i", String(i)));
    this.black = el("div", "death-black", this.root);
    this.resync = el("p", "death-resync", this.root);
  }

  private action(parent: HTMLElement, label: string, key: string, primary: boolean): HTMLButtonElement {
    const b = el("button", `death-btn${primary ? " is-primary" : ""}`, parent);
    b.type = "button";
    el("span", "death-btn-bar", b);
    el("span", "death-btn-label", b, label);
    el("kbd", "death-btn-key", b, key);
    return b;
  }

  /** The killer's name for the corner (empty hides it). */
  setKiller(name: string): void {
    this.killerName.textContent = name;
    this.killerName.dataset.name = name;
    this.killer.classList.toggle("is-none", !name);
  }

  /** Per frame through the fall: the letterbox, the killer's name, and the card's fade. */
  update(o: { bars: number; killer: number; card: number }): void {
    this.root.classList.add("on");
    this.root.style.setProperty("--bars", o.bars.toFixed(3));
    this.root.style.setProperty("--killer", o.killer.toFixed(3));
    this.killer.classList.toggle("on", o.killer > 0.01);
    if (o.card > 0 && !this.shown) this.show();
    this.root.style.setProperty("--card", o.card.toFixed(3));
  }

  /** Fills the card. Call before it shows. */
  fill(info: DeathCardInfo): void {
    this.eyebrow.textContent = info.eyebrow;
    this.line.textContent = info.line;
    this.stats.replaceChildren();
    for (const [k, v] of info.stats) {
      const row = el("div", "death-stat", this.stats);
      el("dt", "", row, k);
      el("dd", "", row, v);
    }
    this.root.classList.toggle("is-touch", info.touch);
  }

  private show(): void {
    this.shown = true;
    this.card.classList.add("on");
    this.root.setAttribute("aria-hidden", "false");
    this.focus(0, true);
    this.retryBtn.focus({ preventScroll: true });
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Moves the focus bar (keyboard or pad), with the UI tick. */
  focus(i: number, silent = false): void {
    const j = Math.max(0, Math.min(1, i));
    if (j !== this.focusI && !silent) this.onTick?.();
    this.focusI = j;
    this.retryBtn.classList.toggle("is-focus", j === 0);
    this.quitBtn.classList.toggle("is-focus", j === 1);
  }

  get focused(): number {
    return this.focusI;
  }

  /** The re-sync's black (0..1) and its line. */
  resyncFrame(black: number, line: string | null): void {
    this.root.style.setProperty("--black", black.toFixed(3));
    this.black.classList.toggle("on", black > 0.001);
    if (line !== null) {
      this.resync.textContent = line;
      this.resync.classList.remove("on");
      void this.resync.offsetWidth;
      this.resync.classList.add("on");
    }
  }

  /** Back to play: the card, the bars and the name go; the re-sync's black stays until it fades. */
  hide(): void {
    this.shown = false;
    this.root.classList.remove("on");
    this.card.classList.remove("on");
    this.killer.classList.remove("on");
    this.root.setAttribute("aria-hidden", "true");
    this.root.style.setProperty("--bars", "0");
    this.root.style.setProperty("--card", "0");
  }

  dispose(): void {
    this.root.remove();
  }
}
