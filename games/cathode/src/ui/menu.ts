// C13 (docs/design/cathode-combat.md S9.1, S9.4): the front door's menu. One focus, shared by the mouse, the
// keys (arrows, WASD, Enter, Space, Escape) and a gamepad (d-pad or left stick, A, B). The slots are fixed:
// a disabled slot keeps its row (CONTINUE stays reserved without a save) and focus steps over it. Every focus
// change calls `tick` once (the UI tick); a move that lands where it started calls nothing.
//
// The model is pure (tested in tests/cathode-menu.test.ts); `bindMenu` wires it to buttons in the DOM.

export interface MenuSlot {
  id: string;
  enabled: boolean;
}

export type MenuAction = "up" | "down" | "confirm" | "back";

/** The key a KeyboardEvent.key or .code means to a menu, or null. */
export function menuKey(key: string): MenuAction | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
    case "KeyW":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
    case "KeyS":
      return "down";
    case "Enter":
    case " ":
    case "Space":
      return "confirm";
    case "Escape":
    case "Backspace":
      return "back";
    default:
      return null;
  }
}

export class MenuModel {
  focus: number;
  constructor(
    readonly slots: MenuSlot[],
    private readonly onFocus: (index: number, prev: number) => void = () => {},
    start = 0,
  ) {
    this.focus = -1;
    const first = this.firstEnabledFrom(start, 1);
    this.focus = first;
  }

  get current(): MenuSlot | undefined {
    return this.slots[this.focus];
  }

  private firstEnabledFrom(i: number, dir: 1 | -1): number {
    const n = this.slots.length;
    for (let k = 0; k < n; k++) {
      const j = (((i + k * dir) % n) + n) % n;
      if (this.slots[j]!.enabled) return j;
    }
    return -1;
  }

  /** Steps the focus by one enabled slot, wrapping at either end. Returns the new focus. */
  move(dir: 1 | -1): number {
    if (this.focus < 0) return this.set(this.firstEnabledFrom(0, 1));
    return this.set(this.firstEnabledFrom(this.focus + dir, dir));
  }

  /** Puts the focus on slot `i` (ignored when it is disabled or out of range). True when it moved. */
  set(i: number): number {
    const s = this.slots[i];
    if (!s || !s.enabled || i === this.focus) return this.focus;
    const prev = this.focus;
    this.focus = i;
    this.onFocus(i, prev);
    return i;
  }

  /** Finds a slot by id. */
  indexOf(id: string): number {
    return this.slots.findIndex((s) => s.id === id);
  }

  /** Turns a slot on or off; when the focused slot is turned off, the focus moves on to the next enabled one. */
  enable(id: string, on: boolean): void {
    const i = this.indexOf(id);
    if (i < 0) return;
    this.slots[i]!.enabled = on;
    if (!on && i === this.focus) {
      const next = this.firstEnabledFrom(i + 1, 1);
      this.focus = -1;
      if (next >= 0) this.set(next);
    }
  }
}

export interface MenuBinding {
  model: MenuModel;
  /** Stops listening (keys, pointer, gamepad). */
  unbind(): void;
  /** Re-reads which buttons are disabled. */
  refresh(): void;
  /** Turns input on or off without unbinding (a screen on top of the menu). */
  active: boolean;
}

export interface MenuOptions {
  /** A focus change (the UI tick sound). */
  tick?: (index: number) => void;
  /** Enter, Space, a click, a tap or the pad's A on an enabled slot. */
  confirm: (id: string) => void;
  /** Escape, Backspace or the pad's B. */
  back?: () => void;
  /** Where focus starts (a slot id). */
  start?: string;
}

/**
 * Binds `buttons` (one per slot, `data-slot` = slot id, in order) as one menu. The focused one carries
 * `is-focus` and real DOM focus, so a screen reader follows it too.
 */
export function bindMenu(buttons: HTMLButtonElement[], o: MenuOptions): MenuBinding {
  const slots = buttons.map((b) => ({ id: b.dataset.slot ?? b.id, enabled: !b.disabled }));
  const paint = (i: number) => {
    buttons.forEach((b, k) => {
      b.classList.toggle("is-focus", k === i);
      b.tabIndex = k === i ? 0 : -1;
    });
    const b = buttons[i];
    if (b && document.activeElement !== b && binding.active) b.focus({ preventScroll: true });
  };
  const model = new MenuModel(
    slots,
    (i) => {
      paint(i);
      o.tick?.(i);
    },
    Math.max(0, o.start ? slots.findIndex((s) => s.id === o.start) : 0),
  );
  const act = (a: MenuAction) => {
    if (!binding.active) return;
    if (a === "up") model.move(-1);
    else if (a === "down") model.move(1);
    else if (a === "confirm") {
      const s = model.current;
      if (s?.enabled) o.confirm(s.id);
    } else o.back?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (!binding.active || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
    const a = menuKey(e.key);
    if (!a) return;
    e.preventDefault();
    act(a);
  };
  const cleanups: Array<() => void> = [];
  addEventListener("keydown", onKey);
  cleanups.push(() => removeEventListener("keydown", onKey));
  buttons.forEach((b, i) => {
    const enter = () => binding.active && model.set(i);
    const click = (e: MouseEvent) => {
      e.preventDefault();
      if (!binding.active || b.disabled) return;
      model.set(i);
      o.confirm(slots[i]!.id);
    };
    b.addEventListener("pointerenter", enter);
    b.addEventListener("focus", enter);
    b.addEventListener("click", click);
    cleanups.push(() => {
      b.removeEventListener("pointerenter", enter);
      b.removeEventListener("focus", enter);
      b.removeEventListener("click", click);
    });
  });
  // The pad: polled while bound. The d-pad and stick repeat at 160 ms after a 380 ms hold.
  let raf = 0;
  const held: Record<string, number> = {};
  const pad = (now: number) => {
    raf = requestAnimationFrame(pad);
    if (!binding.active) return;
    const gps = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    let up = false;
    let down = false;
    let a = false;
    let bk = false;
    for (const g of gps) {
      if (!g) continue;
      const ay = g.axes[1] ?? 0;
      up ||= !!g.buttons[12]?.pressed || ay < -0.55;
      down ||= !!g.buttons[13]?.pressed || ay > 0.55;
      a ||= !!g.buttons[0]?.pressed;
      bk ||= !!g.buttons[1]?.pressed;
    }
    const edge = (k: string, on: boolean, repeat: boolean, fire: () => void) => {
      if (!on) {
        delete held[k];
        return;
      }
      const t0 = held[k];
      if (t0 === undefined) {
        held[k] = now;
        fire();
      } else if (repeat && now - t0 > 380) {
        held[k] = now - 380 + 160;
        fire();
      }
    };
    edge("up", up, true, () => act("up"));
    edge("down", down, true, () => act("down"));
    edge("a", a, false, () => act("confirm"));
    edge("b", bk, false, () => act("back"));
  };
  raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(pad) : 0;
  cleanups.push(() => cancelAnimationFrame(raf));
  const binding: MenuBinding = {
    model,
    active: true,
    unbind: () => cleanups.forEach((c) => c()),
    refresh: () => {
      buttons.forEach((b, i) => model.enable(slots[i]!.id, !b.disabled));
      paint(model.focus);
    },
  };
  paint(model.focus);
  return binding;
}
