// Input: keyboard and mouse (pointer lock), touch (a left stick, swipe-to-look on the right, buttons) and
// gamepads, all folded into one Intent the game reads each frame. Look deltas are in radians.

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
}

const BUTTONS = ["fire", "aim", "jump", "crouch", "reload", "focus", "takedown", "cycle"] as const;
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
  sensitivity = 0.0022;
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
      this.lock();
      return;
    }
    if (e.button === 0) this.mouse.left = down;
    if (e.button === 2) this.mouse.right = down;
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
    this.stickEl = el("div", "stick");
    this.knobEl = el("div", "stick-knob");
    this.stickEl.append(this.knobEl);
    layer.append(this.stickEl);
    const labels: Record<TouchButton, string> = {
      fire: "Fire",
      aim: "Aim",
      jump: "Jump",
      crouch: "Crouch",
      reload: "Reload",
      focus: "Focus",
      takedown: "Takedown",
      cycle: "Swap",
    };
    for (const b of BUTTONS) {
      const btn = el("button", `tbtn tbtn-${b}`);
      btn.setAttribute("type", "button");
      btn.setAttribute("aria-label", labels[b]);
      btn.textContent = labels[b];
      btn.dataset.btn = b;
      layer.append(btn);
    }
    const area = this.canvas.parentElement!;
    area.addEventListener("touchstart", this.onTouch, { passive: false });
    area.addEventListener("touchmove", this.onTouch, { passive: false });
    area.addEventListener("touchend", this.onTouch, { passive: false });
    area.addEventListener("touchcancel", this.onTouch, { passive: false });
  }

  private onTouch = (e: TouchEvent) => {
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
        } else if (t.clientX < innerWidth * 0.42 && this.stick.id < 0) {
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

  /** Reads and clears this frame's input. */
  read(): Intent {
    const k = (c: string) => this.keys.has(c);
    const p = (c: string) => this.pressed.has(c);
    const pad = navigator.getGamepads?.().find((g) => g && g.connected) ?? null;
    let mx = (k("KeyD") ? 1 : 0) - (k("KeyA") ? 1 : 0) + this.stick.x;
    let my = (k("KeyW") ? 1 : 0) - (k("KeyS") ? 1 : 0) + this.stick.y;
    let yaw = this.mouse.x * this.sensitivity + this.touchLook.x * this.touchSensitivity;
    let pitch = -this.mouse.y * this.sensitivity - this.touchLook.y * this.touchSensitivity;
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
    const intent: Intent = {
      move: { x: mx, y: my },
      look: { yaw, pitch },
      sprint: k("ShiftLeft") || k("ShiftRight") || padSprint || (this.isTouch && Math.hypot(this.stick.x, this.stick.y) > 0.95),
      crouch: p("ControlLeft") || p("KeyC") || padCrouch || tt.has("crouch"),
      jump: p("Space") || padJump || tt.has("jump"),
      fire: this.mouse.left || padFire || this.touchHeld.has("fire"),
      aim: this.mouse.right || padAim || this.touchHeld.has("aim"),
      alt: this.mouse.middle || k("KeyV"),
      reload: p("KeyR") || padReload || tt.has("reload"),
      takedown: p("KeyF") || tt.has("takedown"),
      lean: k("KeyQ") ? -1 : k("KeyE") ? 1 : 0,
      slot,
      cycle: Math.sign(this.wheel) + (tt.has("cycle") ? 1 : 0),
      focus: k("AltLeft") || k("KeyX") || this.touchHeld.has("focus"),
      pause: p("Escape") || p("KeyP"),
      skills: p("KeyK") || p("Tab"),
    };
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
