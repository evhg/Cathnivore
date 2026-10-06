// Input: keyboard and mouse (pointer lock), touch (a left stick, swipe-to-look on the right, buttons) and
// gamepads, all folded into one Intent the game reads each frame. Look deltas are in radians.
import { codesFor, type Binds } from "../controls";


export interface Intent {
  /** Movement on the ground plane, each axis -1..1 (x right, y forward). */
  move: { x: number; y: number };
  /** Look this frame, radians (yaw right, pitch up). */
  look: { yaw: number; pitch: number };
  sprint: boolean;
  crouch: boolean;
  jump: boolean;
  fire: boolean;
  aim: boolean;
  alt: boolean;
  reload: boolean;
  takedown: boolean;
  lean: -1 | 0 | 1;
  /** Weapon slot pressed this frame (0-based), or -1. */
  slot: number;
  /** Weapon wheel scroll this frame: -1, 0 or 1. */
  cycle: number;
  /** Bullet-time / held breath. */
  focus: boolean;
  pause: boolean;
  skills: boolean;
  map: boolean;
  photo: boolean;
  /** Active skill quick-slots. */
  skill1: boolean;
  skill2: boolean;
}

const BUTTONS = ["fire", "aim", "jump", "crouch", "reload", "focus", "takedown", "cycle", "skill", "sheet"] as const;
type TouchButton = (typeof BUTTONS)[number];

export class Input {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private mouse = { x: 0, y: 0, left: false, right: false, middle: false };
  private wheel = 0;
  private touchLook = { x: 0, y: 0 };
  private stick = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
  private lookTouch = { id: -1, x: 0, y: 0 };
  private touchHeld = new Set<TouchButton>();
  private touchTapped = new Set<TouchButton>();
  /** Test and replay hook: fields here override what the devices say for the next read. */
  forced: Partial<Intent> = {};
  sensitivity = 0.0022;
  /** Player look-speed multiplier and vertical invert (prefs). */
  lookScale = 1;
  invertY = false;
  binds: Binds = {};
  touchSensitivity = 0.0055;
  readonly isTouch: boolean;
  private stickEl?: HTMLElement;
  private knobEl?: HTMLElement;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly touchLayer: HTMLElement,
  ) {
    this.isTouch = matchMedia("(pointer: coarse)").matches;
    addEventListener("keydown", this.onKey);
    addEventListener("keyup", this.onKey);
    canvas.addEventListener("mousedown", this.onMouse);
    addEventListener("mouseup", this.onMouse);
    addEventListener("mousemove", this.onMove);
    canvas.addEventListener("wheel", this.onWheel, { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    if (this.isTouch) this.buildTouch();
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  lock(): void {
    if (!this.isTouch && !this.locked) void this.canvas.requestPointerLock?.();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.type === "keydown") {
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (["Space", "Tab", "KeyK"].includes(e.code)) e.preventDefault();
    } else this.keys.delete(e.code);
  };

  private onMouse = (e: MouseEvent) => {
    const down = e.type === "mousedown";
    if (down && !this.locked) {
      // Clicks on the pause card's controls (volume, graphics) stay with the card.
      if (!(e.target as Element | null)?.closest?.(".hud-pause-card, .cx, dialog")) this.lock();
      return;
    }
    if (e.button === 0) this.mouse.left = down;
    if (e.button === 2) {
      this.mouse.right = down;
      if (down && this.holdToggle) this.aimLatched = !this.aimLatched;
    }
    if (e.button === 1) this.mouse.middle = down;
  };

  private onMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.mouse.x += e.movementX;
    this.mouse.y += e.movementY;
  };

  private onWheel = (e: WheelEvent) => {
    this.wheel += Math.sign(e.deltaY);
  };

  // ---- touch: a floating stick on the left half, look on the right half, buttons on the right ----
  private buildTouch(): void {
    const layer = this.touchLayer;
    layer.hidden = false;
    // The stick rests visibly at its home spot (bottom left) and follows the thumb wherever it lands.
    this.stickEl = el("div", "stick");
    this.knobEl = el("div", "stick-knob");
    const label = el("span", "stick-label");
    label.textContent = "Move";
    this.stickEl.append(this.knobEl, label);
    layer.append(this.stickEl);
    const look = el("div", "look-hint");
    look.textContent = "Drag to aim";
    layer.append(look);
    const labels: Record<TouchButton, string> = {
      fire: "Fire",
      aim: "Aim",
      jump: "Jump",
      crouch: "Crouch",
      reload: "Reload",
      focus: "Focus",
      takedown: "Takedown",
      cycle: "Swap",
      skill: "Skill",
      sheet: "Cath",
    };
    for (const b of BUTTONS) {
      const btn = el("button", `tbtn tbtn-${b}`);
      btn.setAttribute("type", "button");
      btn.setAttribute("aria-label", labels[b]);
      btn.textContent = labels[b];
      btn.dataset.btn = b;
      layer.append(btn);
    }
    // The way into the pause menu (settings, the title), top right where a thumb won't hit it by accident.
    const menu = el("button", "tbtn-menu");
    menu.setAttribute("type", "button");
    menu.setAttribute("aria-label", "Menu");
    for (let i = 0; i < 2; i++) menu.append(el("span", "tbtn-menu-bar"));
    menu.addEventListener("click", () => (this.menuTapped = true));
    layer.append(menu);
    const area = this.canvas.parentElement!;
    area.addEventListener("touchstart", this.onTouch, { passive: false });
    area.addEventListener("touchmove", this.onTouch, { passive: false });
    area.addEventListener("touchend", this.onTouch, { passive: false });
    area.addEventListener("touchcancel", this.onTouch, { passive: false });
  }

  private onTouch = (e: TouchEvent) => {
    // Menus over the game (the coach card, the character screen, dialogs) take their own taps: cancelling
    // the touch here would stop iOS from ever turning it into a click.
    const tgt = e.target as Element | null;
    if (tgt?.closest(".coach, .cx, .cp, dialog, a, button:not([data-btn]), input, label")) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const target = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
      const btn = target?.dataset.btn as TouchButton | undefined;
      if (e.type === "touchstart") {
        if (btn) {
          this.touchHeld.add(btn);
          this.touchTapped.add(btn);
          this.btnTouches.set(t.identifier, btn);
          // Fire and aim double as look: keep turning while the thumb drags off the button.
          if (btn === "fire" || btn === "aim") this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        } else if (t.clientX < innerWidth * 0.45 && this.stick.id < 0) {
          this.touched = true;
          this.stick = { x: 0, y: 0, id: t.identifier, ox: t.clientX, oy: t.clientY };
          this.stickEl?.classList.add("on");
          this.stickEl?.style.setProperty("--sx", `${t.clientX}px`);
          this.stickEl?.style.setProperty("--sy", `${t.clientY}px`);
        } else if (this.lookTouch.id < 0) this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      } else if (e.type === "touchmove") {
        if (t.identifier === this.stick.id) {
          const r = 56;
          let dx = (t.clientX - this.stick.ox) / r;
          let dy = (t.clientY - this.stick.oy) / r;
          const m = Math.hypot(dx, dy);
          if (m > 1) {
            dx /= m;
            dy /= m;
          }
          this.stick.x = dx;
          this.stick.y = -dy;
          this.knobEl?.style.setProperty("--kx", `${dx * r}px`);
          this.knobEl?.style.setProperty("--ky", `${dy * r}px`);
        }
        if (t.identifier === this.lookTouch.id) {
          this.touchLook.x += t.clientX - this.lookTouch.x;
          this.touchLook.y += t.clientY - this.lookTouch.y;
          this.lookTouch.x = t.clientX;
          this.lookTouch.y = t.clientY;
        }
      } else {
        if (t.identifier === this.stick.id) {
          this.stick = { x: 0, y: 0, id: -1, ox: 0, oy: 0 };
          this.stickEl?.classList.remove("on");
          this.stickEl?.style.removeProperty("--sx");
          this.stickEl?.style.removeProperty("--sy");
          this.knobEl?.style.setProperty("--kx", "0px");
          this.knobEl?.style.setProperty("--ky", "0px");
        }
        if (t.identifier === this.lookTouch.id) this.lookTouch.id = -1;
        const held = this.btnTouches.get(t.identifier);
        if (held) {
          this.touchHeld.delete(held);
          this.btnTouches.delete(t.identifier);
        }
      }
    }
  };
  private btnTouches = new Map<number, TouchButton>();
  /** Shows only the touch buttons the game has introduced so far (one thing at a time). */
  allow(features: readonly string[], weapons: number): void {
    const need: Record<string, string | null> = {
      fire: null,
      jump: null,
      aim: "aim",
      reload: "reload",
      crouch: "crouch",
      takedown: "takedown",
      focus: "focus",
      skill: "skills",
      sheet: "skills",
      cycle: "swap",
    };
    const key = features.join(",") + "|" + weapons;
    if (key === this.allowedKey) return;
    this.allowedKey = key;
    for (const b of this.touchLayer.querySelectorAll<HTMLElement>("[data-btn]")) {
      const f = need[b.dataset.btn!];
      b.hidden = !!f && !features.includes(f) && !(b.dataset.btn === "cycle" && weapons > 1);
    }
  }
  private allowedKey = "";

  private menuTapped = false;
  /** True once after the phone's menu button is tapped. */
  takeMenu(): boolean {
    const m = this.menuTapped;
    this.menuTapped = false;
    return m;
  }

  /** Set once the player has moved with the stick (the coach card waits for it). */
  touched = false;
  /** Touch auto-fire: the session pulls the trigger when aim assist has her on a target. */
  autoFire = false;

  /** Accessibility: sprint and aim switch on and off with a press instead of being held. */
  holdToggle = false;
  private aimLatched = false;
  private sprintLatched = false;

  /** Reads and clears this frame's input. */
  read(): Intent {
    const k = (c: string) => this.keys.has(c);
    const p = (c: string) => this.pressed.has(c);
    const ka = (id: string) => codesFor(this.binds, id).some(k);
    const pa = (id: string) => codesFor(this.binds, id).some(p);
    const pad = navigator.getGamepads?.().find((g) => g && g.connected) ?? null;
    let mx = (ka("right") ? 1 : 0) - (ka("left") ? 1 : 0) + this.stick.x;
    let my = (ka("forward") ? 1 : 0) - (ka("back") ? 1 : 0) + this.stick.y;
    let yaw = this.mouse.x * this.sensitivity * this.lookScale + this.touchLook.x * this.touchSensitivity;
    let pitch = (-this.mouse.y * this.sensitivity * this.lookScale) * (this.invertY ? -1 : 1) - this.touchLook.y * this.touchSensitivity;
    let padFire = false,
      padAim = false,
      padJump = false,
      padCrouch = false,
      padReload = false,
      padSprint = false;
    if (pad) {
      const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
      mx += dz(pad.axes[0] ?? 0);
      my -= dz(pad.axes[1] ?? 0);
      yaw += dz(pad.axes[2] ?? 0) * 0.05;
      pitch -= dz(pad.axes[3] ?? 0) * 0.04;
      padFire = (pad.buttons[7]?.value ?? 0) > 0.4;
      padAim = (pad.buttons[6]?.value ?? 0) > 0.4;
      padJump = !!pad.buttons[0]?.pressed;
      padCrouch = !!pad.buttons[1]?.pressed;
      padReload = !!pad.buttons[2]?.pressed;
      padSprint = !!pad.buttons[10]?.pressed;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    let slot = -1;
    for (let i = 1; i <= 9; i++) if (p(`Digit${i}`)) slot = i - 1;
    const tt = this.touchTapped;
    if (this.holdToggle) {
      if (pa("sprint")) this.sprintLatched = !this.sprintLatched;
      if (len === 0) this.sprintLatched = false;
    } else {
      this.aimLatched = false;
      this.sprintLatched = false;
    }
    const intent: Intent = {
      move: { x: mx, y: my },
      look: { yaw, pitch },
      sprint: (this.holdToggle ? this.sprintLatched : ka("sprint")) || padSprint || (this.isTouch && Math.hypot(this.stick.x, this.stick.y) > 0.95),
      crouch: pa("crouch") || padCrouch || tt.has("crouch"),
      jump: pa("jump") || padJump || tt.has("jump"),
      fire: this.mouse.left || padFire || this.touchHeld.has("fire") || this.autoFire,
      aim: (this.holdToggle ? this.aimLatched : this.mouse.right) || padAim || this.touchHeld.has("aim"),
      alt: this.mouse.middle || k("KeyV"),
      reload: pa("reload") || padReload || tt.has("reload"),
      takedown: pa("takedown") || tt.has("takedown"),
      lean: k("KeyQ") ? -1 : k("KeyE") ? 1 : 0,
      slot,
      cycle: Math.sign(this.wheel) + (tt.has("cycle") ? 1 : 0),
      focus: k("AltLeft") || k("KeyX") || this.touchHeld.has("focus"),
      pause: p("Escape") || p("KeyP"),
      skills: p("KeyK") || p("Tab") || tt.has("sheet"),
      map: p("KeyM"),
      photo: p("KeyB"),
      skill1: p("KeyG") || tt.has("skill"),
      skill2: p("KeyZ"),
    };
    Object.assign(intent, this.forced);
    this.forced = {};
    this.mouse.x = this.mouse.y = 0;
    this.touchLook.x = this.touchLook.y = 0;
    this.wheel = 0;
    this.pressed.clear();
    this.touchTapped.clear();
    return intent;
  }

  dispose(): void {
    removeEventListener("keydown", this.onKey);
    removeEventListener("keyup", this.onKey);
    removeEventListener("mouseup", this.onMouse);
    removeEventListener("mousemove", this.onMove);
    this.canvas.removeEventListener("mousedown", this.onMouse);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
