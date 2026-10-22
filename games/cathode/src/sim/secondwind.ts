// Second Wind (docs/design/cathode-combat.md S6.5), pure: the killing blow, once per checkpoint, puts her on one
// knee instead of on the floor. The world slows to 0.3 for 3.5 s and goes grey, every live enemy is outlined in red
// (through walls), and her gun keeps real time. A kill in the window gets her up with +30% Flesh; no kill and the
// death sequence starts from its 400 ms state. Disabled on Hell Week; the Second Wind skill adds a charge.
//
// Times are real milliseconds from the lethal hit (t = 0), whatever the world's scale.

export const SECOND_WIND = {
  /** The hit's hit-stop (ms). */
  stopMs: 140,
  /** The slow motion: pushed at the end of the stop, held for the window. */
  scale: 0.3,
  windowMs: 3500,
  /** A kill in the window: Flesh back (share of max Flesh), time back to 1 over this. */
  reviveShare: 0.3,
  rampOutMs: 400,
  /** Colour floods back between these (ms after the kill); the outlines fade over `outlineFadeMs`. */
  colourBackMs: [300, 600] as const,
  outlineFadeMs: 200,
  /** The world's grey at full (0..1), and how fast it comes in (ms after the stop). */
  grey: 0.9,
  greyInMs: 160,
  /** On one knee: the eye drops this far and the camera rolls this much, over `dropMs`. */
  dropM: 0.35,
  rollDeg: 12,
  dropMs: 220,
  /** No kill: the death starts from this state of its own sequence (S6.6), with no second hit-stop. */
  deathFromMs: 400,
  /** The heartbeat while it lasts (bpm). */
  heartBpm: 40,
} as const;

export type SecondWindPhase = "ready" | "spent" | "stop" | "window" | "revived";

export interface SecondWindLook {
  /** The world's grey (0..1), the outlines' strength (0..1), the eye's drop (m), the roll (radians). */
  grey: number;
  outline: number;
  drop: number;
  roll: number;
  /** The timer line, 1 at the start of the window to 0 at its end (0 outside it). */
  timer: number;
  /** "SECOND WIND" on screen (0..1). */
  title: number;
}

const ease = (u: number) => {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
};

export class SecondWind {
  /** Charges this checkpoint (1, +1 with the skill; 0 on Hell Week). */
  private charges: number;
  private readonly perCheckpoint: number;
  phase: SecondWindPhase;
  /** Real ms since the lethal hit (or since the revive, while revived). */
  t = 0;
  private reviveT = -1;
  /** The look at the moment of the kill, so the revive eases out from where it was. */
  private fromLook: SecondWindLook | null = null;

  constructor(o: { hellWeek?: boolean; extraCharges?: number } = {}) {
    this.perCheckpoint = o.hellWeek ? 0 : 1 + Math.max(0, Math.floor(o.extraCharges ?? 0));
    this.charges = this.perCheckpoint;
    this.phase = this.charges > 0 ? "ready" : "spent";
  }

  /** A charge is waiting. */
  get ready(): boolean {
    return this.phase === "ready";
  }

  /** In force: the stop or the window (the world grey, the gun on real time). */
  get active(): boolean {
    return this.phase === "stop" || this.phase === "window";
  }

  /** Charges left this checkpoint (not counting one in use). */
  get left(): number {
    return this.charges;
  }

  /** A checkpoint (or a fresh resume): the charges come back. Not mid-window. */
  checkpoint(): void {
    if (this.active) return;
    this.charges = this.perCheckpoint;
    this.phase = this.charges > 0 ? "ready" : "spent";
    this.reviveT = -1;
  }

  /** A lethal blow. True when Second Wind takes it (she lives on 1 Flesh); false when she dies. */
  lethal(): boolean {
    if (this.phase !== "ready") return false;
    this.charges--;
    this.phase = "stop";
    this.t = 0;
    this.reviveT = -1;
    return true;
  }

  /** A kill she made. In the window (or the stop) it revives her: returns the Flesh share to give back. */
  kill(): number {
    if (!this.active) return 0;
    this.fromLook = this.look();
    this.phase = "revived";
    this.reviveT = 0;
    return SECOND_WIND.reviveShare;
  }

  /**
   * Advances by real ms. Returns "window" when the slow motion should start (end of the stop), "expired" when the
   * window ran out with no kill (the death starts), "done" when a revive has faded out, else null.
   */
  update(realMs: number): "window" | "expired" | "done" | null {
    if (this.phase === "stop" || this.phase === "window") {
      this.t += realMs;
      if (this.phase === "stop" && this.t >= SECOND_WIND.stopMs) {
        this.phase = "window";
        return "window";
      }
      if (this.phase === "window" && this.t >= SECOND_WIND.stopMs + SECOND_WIND.windowMs) {
        this.phase = this.charges > 0 ? "ready" : "spent";
        return "expired";
      }
      return null;
    }
    if (this.phase === "revived") {
      this.reviveT += realMs;
      if (this.reviveT >= Math.max(SECOND_WIND.colourBackMs[1], SECOND_WIND.rampOutMs, SECOND_WIND.dropMs * 2)) {
        this.phase = this.charges > 0 ? "ready" : "spent";
        this.fromLook = null;
        return "done";
      }
    }
    return null;
  }

  /** What the screen, camera and HUD show right now. */
  look(): SecondWindLook {
    const S = SECOND_WIND;
    if (this.phase === "revived" && this.fromLook) {
      const f = this.fromLook;
      const r = this.reviveT;
      const colour = 1 - ease((r - S.colourBackMs[0]) / (S.colourBackMs[1] - S.colourBackMs[0]));
      const up = 1 - ease(r / (S.dropMs * 2));
      return {
        grey: f.grey * colour,
        outline: f.outline * Math.max(0, 1 - r / S.outlineFadeMs),
        drop: f.drop * up,
        roll: f.roll * up,
        timer: 0,
        title: f.title * Math.max(0, 1 - r / 250),
      };
    }
    if (!this.active) return { grey: 0, outline: 0, drop: 0, roll: 0, timer: 0, title: 0 };
    const t = this.t;
    const knee = ease(t / S.dropMs);
    const inWin = Math.max(0, t - S.stopMs);
    return {
      grey: S.grey * ease(inWin / S.greyInMs),
      outline: t >= S.stopMs ? 1 : 0,
      drop: S.dropM * knee,
      roll: ((S.rollDeg * Math.PI) / 180) * knee,
      timer: t >= S.stopMs ? Math.max(0, 1 - inWin / S.windowMs) : 0,
      title: t >= S.stopMs ? ease(inWin / 180) : 0,
    };
  }
}

/**
 * The weapon's clock (S6.5): while Second Wind is in force the gun fires and reloads at real-time rate, so the
 * shots per real second don't change with the world's scale. Otherwise it runs on sim time like the rest.
 */
export function weaponDt(realDt: number, simDt: number, secondWind: boolean): number {
  return secondWind ? realDt : simDt;
}
