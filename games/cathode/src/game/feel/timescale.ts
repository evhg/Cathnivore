// The only writer of simulation time (S0). Systems push a scale with a hold and ramps; the lowest active scale
// wins (ties go to the higher priority). Hit-stops take the larger of the current and new stop, never stack,
// and cap at 150 ms. Sim, AI, physics and particles use simDt; rendering, audio, springs, camera, HUD and
// input always run on real time.

import { tuning } from "./tuning";

export type ScalePriority = "death" | "takedown" | "secondWind" | "killcam" | "pause" | "hitStop" | "focus" | "active";

const RANK: Record<ScalePriority, number> = { death: 7, takedown: 6, secondWind: 5, killcam: 4, pause: 3, hitStop: 2, focus: 1, active: 0 };

interface Push {
  id: string;
  scale: number;
  /** Real ms since the push began. */
  age: number;
  holdMs: number;
  rampInMs: number;
  rampOutMs: number;
  priority: ScalePriority;
  /** Held until released (no hold timer). */
  sticky: boolean;
}

export class Timescale {
  private pushes: Push[] = [];
  /** The current simulation scale (1 = real time). */
  simScale = 1;
  /** The particle scale: during a hit-stop particles keep drifting at a quarter speed. */
  fxScale = 1;
  /** Real ms of hit-stop granted inside the auto-fire window, for the 30 ms cap. */
  private autoLedger: { at: number; ms: number }[] = [];
  private clock = 0;

  /** Pushes (or replaces, by id) a scale. holdMs < 0 holds until `release(id)`. */
  push(id: string, scale: number, holdMs: number, rampInMs = 0, rampOutMs = 0, priority: ScalePriority = "active"): void {
    const maxHold = priority === "death" ? Infinity : tuning.timescale.maxHoldMs;
    const sticky = holdMs < 0;
    const p: Push = { id, scale: Math.max(0, Math.min(1, scale)), age: 0, holdMs: sticky ? 0 : Math.min(holdMs, maxHold), rampInMs, rampOutMs, priority, sticky };
    const i = this.pushes.findIndex((q) => q.id === id);
    if (i >= 0) this.pushes[i] = p;
    else this.pushes.push(p);
    this.resolve();
  }

  /** Starts the ramp out of a push (sticky or not). */
  release(id: string): void {
    const p = this.pushes.find((q) => q.id === id);
    if (!p) return;
    if (p.sticky) {
      p.sticky = false;
      p.holdMs = Math.max(0, p.age - p.rampInMs);
    } else p.holdMs = Math.min(p.holdMs, Math.max(0, p.age - p.rampInMs));
    this.resolve();
  }

  /** True while the push is in force (holding or ramping). */
  active(id: string): boolean {
    return this.pushes.some((p) => p.id === id);
  }

  /**
   * A hit-stop: the world freezes for `ms`. Takes the larger of the current and new stop (never adds) and
   * caps at 150 ms. With `auto`, stops in any 100 ms window sum to no more than 30 ms.
   */
  hitStop(ms: number, auto = false): number {
    const T = tuning.hitStop;
    let want = Math.min(T.cap, Math.max(0, ms));
    if (auto) {
      this.autoLedger = this.autoLedger.filter((e) => this.clock - e.at < T.autoWindowMs);
      const used = this.autoLedger.reduce((s, e) => s + e.ms, 0);
      want = Math.min(want, Math.max(0, T.autoWindowCap - used));
    }
    if (want <= 0) return 0;
    const cur = this.pushes.find((p) => p.id === "hitStop");
    const left = cur ? cur.holdMs - cur.age : 0;
    if (cur && left >= want) return 0;
    const granted = want - Math.max(0, left);
    if (auto) this.autoLedger.push({ at: this.clock, ms: granted });
    this.push("hitStop", 0, want, 0, 0, "hitStop");
    return granted;
  }

  /** Advances by real time (ms are real, whatever the scale). */
  update(realDt: number): void {
    const ms = realDt * 1000;
    this.clock += ms;
    for (const p of this.pushes) p.age += ms;
    this.pushes = this.pushes.filter((p) => p.sticky || p.age < p.rampInMs + p.holdMs + p.rampOutMs);
    this.resolve();
  }

  /** The scale a push contributes right now (ramping from 1 in, holding, ramping back to 1 out). */
  private level(p: Push): number {
    if (p.rampInMs > 0 && p.age < p.rampInMs) return 1 + (p.scale - 1) * (p.age / p.rampInMs);
    if (p.sticky || p.age < p.rampInMs + p.holdMs) return p.scale;
    if (p.rampOutMs <= 0) return 1;
    const k = Math.min(1, (p.age - p.rampInMs - p.holdMs) / p.rampOutMs);
    return p.scale + (1 - p.scale) * k;
  }

  private resolve(): void {
    let best = 1;
    let bestRank = -1;
    let stopping = false;
    for (const p of this.pushes) {
      const l = this.level(p);
      const r = RANK[p.priority];
      if (l < best - 1e-9 || (Math.abs(l - best) < 1e-9 && r > bestRank)) {
        best = l;
        bestRank = r;
      }
      if (p.priority === "hitStop" && l < 1) stopping = true;
    }
    this.simScale = best;
    // During a hit-stop particles drift slowly instead of freezing; otherwise they follow the sim.
    const others = this.pushes.filter((p) => p.priority !== "hitStop").reduce((m, p) => Math.min(m, this.level(p)), 1);
    this.fxScale = stopping ? Math.min(others, tuning.hitStop.fxScale) : best;
  }

  /** The ids in force, for debugging. */
  get ids(): string[] {
    return this.pushes.map((p) => p.id);
  }
}
