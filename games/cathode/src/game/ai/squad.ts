// S11 firefight AI, the squad layer (docs/design/cathode-combat.md C16). The `Awareness` FSM in enemy.ts stays the
// perception layer; this decides, for each encounter's squad, who shoots for real (attack tokens), who pins her down
// (suppress), who goes round (flank, one at most), who pushes (advance) and who holds; how accurate a round is (the
// 1.2 s ramp and the two warning rounds that open every burst); when a man is flanked; and which bark plays when.
// Pure: plain {x, z} vectors and an injected random source, so the tests and the firefight sim run it headless.

import type { Difficulty } from "../../sim/types";

export interface Flat {
  x: number;
  z: number;
}

export type SquadRole = "suppress" | "flank" | "advance" | "hold";

/** Attack tokens per difficulty (S11): only holders fire with real accuracy. */
export const TOKENS: Readonly<Record<Difficulty, number>> = { noir: 2, hardboiled: 3, hellWeek: 4 };
/** The suppressor's hit chance without a token (S11: 8% to 25%). */
export const SUPPRESS_CAP: Readonly<Record<Difficulty, number>> = { noir: 0.08, hardboiled: 0.15, hellWeek: 0.25 };
/** A token passes on after this long firing (s), or the moment its holder loses sight of her. */
export const TOKEN_HOLD: readonly [number, number] = [2.5, 4];
/** Roles are reassigned this often (s). */
export const ROLE_PERIOD = 1.5;
/** She has been out of every man's sight this long (s): the squad advances. */
export const ADVANCE_AFTER = 5;
/** A flank gives up after this long (s), and the next waits this long. */
export const FLANK_MAX = 9;
export const FLANK_COOLDOWN = 5;

/** S3.5's accuracy ramp: 20% to 70% over 1.2 s of unbroken sight. */
export const RAMP = { from: 0.2, to: 0.7, seconds: 1.2 } as const;
/** The first rounds of every burst land this far from her (m) on purpose: the readable warning. */
export const WARNING_ROUNDS = 2;
export const WARNING_MISS_M: readonly [number, number] = [0.4, 1.0];
/** A cover point is flanked once her bearing is this far off its facing (degrees); new cover within 600 ms. */
export const FLANKED_DEG = 70;
export const RECOVER_MS = 600;

/** Hit chance after `losT` seconds of unbroken sight. */
export function rampAccuracy(losT: number): number {
  const k = Math.max(0, Math.min(1, losT / RAMP.seconds));
  return RAMP.from + (RAMP.to - RAMP.from) * k;
}

/** True for the rounds of a burst that miss on purpose (`round` counts from 0). */
export function isWarningRound(round: number): boolean {
  return round < WARNING_ROUNDS;
}

/**
 * The hit chance a round gets: a warning round never hits; a token holder ramps; the suppressor without a token is
 * capped; anyone else gets the cap at half. `mul` carries suppression, wounds and morale.
 */
export function hitChance(o: { round: number; losT: number; token: boolean; role: SquadRole; difficulty: Difficulty; mul?: number }): number {
  if (isWarningRound(o.round)) return 0;
  const base = o.token ? rampAccuracy(o.losT) : o.role === "suppress" ? SUPPRESS_CAP[o.difficulty] : SUPPRESS_CAP[o.difficulty] * 0.5;
  return Math.max(0, Math.min(1, base * (o.mul ?? 1)));
}

/** How far off a missed round lands (m): warning rounds 0.4 to 1.0 m; other misses a little wider. */
export function missDistance(rand: () => number, warning: boolean): number {
  const [a, b] = WARNING_MISS_M;
  return warning ? a + (b - a) * rand() : a + (1.6 - a) * rand();
}

/** Degrees between a cover point's facing (into the cover, toward the threat it hides from) and her bearing. */
export function coverAngle(facing: Flat, from: Flat, cath: Flat): number {
  const dx = cath.x - from.x;
  const dz = cath.z - from.z;
  const l = Math.hypot(dx, dz) || 1;
  const fl = Math.hypot(facing.x, facing.z) || 1;
  const c = (dx * facing.x + dz * facing.z) / (l * fl);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** True once she is round the side of his cover (S11: above 70 degrees). */
export function isFlanked(facing: Flat, from: Flat, cath: Flat): boolean {
  return coverAngle(facing, from, cath) > FLANKED_DEG;
}

/** One fighter as the squad sees him each tick. */
export interface Member {
  readonly id: number;
  alive: boolean;
  pos: Flat;
  /** He can see her right now. */
  los: boolean;
  leader?: boolean;
  /** False for men who never flank (a shield bearer walks straight at her, a sniper keeps his perch). */
  canFlank?: boolean;
  /** Set by the squad. */
  role: SquadRole;
  token: boolean;
  /** Seconds he has held his token. */
  tokenT: number;
  /** When his token passes on (s held). */
  tokenFor: number;
  /** Seconds since he last held a token (fair hand-out). */
  waitT: number;
  /** Seconds into his flank. */
  flankT: number;
}

export function makeMember(id: number, pos: Flat, o: { leader?: boolean; canFlank?: boolean } = {}): Member {
  return { id, alive: true, pos: { ...pos }, los: false, leader: o.leader, canFlank: o.canFlank ?? true, role: "hold", token: false, tokenT: 0, tokenFor: 3, waitT: 0, flankT: 0 };
}

/**
 * One encounter's squad (up to 6). `tick` every frame: tokens pass on, roles are dealt every 1.5 s, and the flank
 * is tracked. The leader is the officer variant; he never flanks while anyone else can.
 */
export class Squad {
  readonly members: Member[] = [];
  private roleT = 0;
  private flankCd = 0;
  /** Seconds since any member last saw her. */
  outOfSight = 0;
  /** Where she was last seen by any of them. */
  readonly lastSeen: Flat = { x: 0, z: 0 };
  seen = false;

  constructor(
    readonly difficulty: Difficulty,
    private readonly rand: () => number = Math.random,
  ) {}

  add(m: Member): Member {
    if (this.members.length < 6) this.members.push(m);
    return m;
  }

  get alive(): Member[] {
    return this.members.filter((m) => m.alive);
  }

  get tokenCap(): number {
    return TOKENS[this.difficulty];
  }

  tick(dt: number, cath: Flat): void {
    const live = this.alive;
    if (live.some((m) => m.los)) {
      this.outOfSight = 0;
      this.seen = true;
      this.lastSeen.x = cath.x;
      this.lastSeen.z = cath.z;
    } else this.outOfSight += dt;
    for (const m of this.members) {
      if (!m.alive) {
        m.token = false;
        continue;
      }
      if (m.token) {
        m.tokenT += dt;
        if (!m.los || m.tokenT >= m.tokenFor) {
          m.token = false;
          m.waitT = 0;
        }
      } else m.waitT += dt;
      if (m.role === "flank") m.flankT += dt;
    }
    this.dealTokens(live);
    this.flankCd = Math.max(0, this.flankCd - dt);
    this.roleT -= dt;
    if (this.roleT <= 0) {
      this.roleT = ROLE_PERIOD;
      this.dealRoles(live, cath);
    }
  }

  private dealTokens(live: Member[]): void {
    let held = live.filter((m) => m.token).length;
    if (held >= this.tokenCap) return;
    // Longest waiting first, among those who can see her.
    const want = live.filter((m) => !m.token && m.los).sort((a, b) => b.waitT - a.waitT);
    for (const m of want) {
      if (held >= this.tokenCap) break;
      // A man who just gave his token up waits a beat before taking another.
      if (m.waitT < 0.6 && live.length > this.tokenCap) continue;
      m.token = true;
      m.tokenT = 0;
      m.tokenFor = TOKEN_HOLD[0] + (TOKEN_HOLD[1] - TOKEN_HOLD[0]) * this.rand();
      held++;
    }
  }

  /** The flank finished or failed: he holds, and the next flank waits. */
  endFlank(m: Member): void {
    if (m.role !== "flank") return;
    m.role = "hold";
    m.flankT = 0;
    this.flankCd = FLANK_COOLDOWN;
    this.roleT = Math.min(this.roleT, 0.2);
  }

  private dealRoles(live: Member[], cath: Flat): void {
    const d = (m: Member) => Math.hypot(m.pos.x - cath.x, m.pos.z - cath.z);
    // The flanker keeps his job until he's round or gives up.
    let flanker = live.find((m) => m.role === "flank") ?? null;
    if (flanker && flanker.flankT > FLANK_MAX) {
      this.endFlank(flanker);
      flanker = null;
    }
    const withLos = live.filter((m) => m.los).sort((a, b) => d(a) - d(b));
    const suppressor = withLos.find((m) => m !== flanker) ?? null;
    if (!flanker && this.flankCd <= 0 && live.length >= 2 && this.seen) {
      // Not the suppressor, not the leader if anyone else can go; the one already furthest round her side.
      const cand = live.filter((m) => m !== suppressor && m.canFlank !== false);
      const pool = cand.filter((m) => !m.leader).length ? cand.filter((m) => !m.leader) : cand;
      if (pool.length) {
        const ax = this.centroid(live);
        const bx = { x: ax.x - cath.x, z: ax.z - cath.z };
        const bl = Math.hypot(bx.x, bx.z) || 1;
        // Most sideways of the squad's line to her.
        flanker = pool.reduce((best, m) => (side(m, cath, bx, bl) > side(best, cath, bx, bl) ? m : best), pool[0]!);
        flanker.role = "flank";
        flanker.flankT = 0;
      }
    }
    const push = this.outOfSight >= ADVANCE_AFTER;
    for (const m of live) {
      if (m === flanker) continue;
      m.role = m === suppressor ? "suppress" : push ? "advance" : "hold";
    }
  }

  private centroid(live: Member[]): Flat {
    let x = 0;
    let z = 0;
    for (const m of live) {
      x += m.pos.x;
      z += m.pos.z;
    }
    return { x: x / live.length, z: z / live.length };
  }
}

/** How far off the squad's line to her a man stands (m, unsigned). */
function side(m: Member, cath: Flat, axis: Flat, len: number): number {
  const rx = m.pos.x - cath.x;
  const rz = m.pos.z - cath.z;
  return Math.abs((rx * axis.z - rz * axis.x) / len);
}

// ---- cover scoring (S11) ----

export interface CoverScoreIn {
  /** 0..1: how much of her side this point hides him from (static protection x the facing toward her). */
  protection: number;
  /** Metres to her. */
  distance: number;
  /** Metres to the nearest ally's spot (claimed or standing). */
  crowd: number;
  /** 0..1: how much of the way there runs through her sight. */
  exposure: number;
  /** 0..1: how far round her side it is (the flanker only). */
  flank?: number;
}

/** S11: `protection x 3 + band(8-20 m) x 1.5 - crowding(<2 m) x 2 - exposure-path x 1 + flank-angle x 1`. */
export function scoreCover(c: CoverScoreIn): number {
  const band = c.distance >= 8 && c.distance <= 20 ? 1 : c.distance < 8 ? Math.max(0, c.distance / 8) : Math.max(0, 1 - (c.distance - 20) / 10);
  const crowd = c.crowd < 2 ? 1 - c.crowd / 2 : 0;
  return c.protection * 3 + band * 1.5 - crowd * 2 - c.exposure + (c.flank ?? 0);
}

/** Protection a point gives against her at `cath`: its static share, faded to nothing at the flanked angle. */
export function protectionFrom(staticProt: number, facing: Flat, from: Flat, cath: Flat): number {
  const a = coverAngle(facing, from, cath);
  if (a >= FLANKED_DEG) return 0;
  return staticProt * Math.cos(((a / FLANKED_DEG) * Math.PI) / 2) ** 0.5;
}

// ---- barks (S10) ----

export type BarkKind = "contact" | "reload" | "manDown" | "flank" | "lost" | "grenade" | "plate" | "suppressed" | "fallBack" | "surrender" | "wounded";

export const BARK_LINES: Readonly<Record<BarkKind, readonly string[]>> = {
  contact: ["Contact!", "There she is!"],
  reload: ["Reloading!"],
  manDown: ["Man down!", "We lost {name}!"],
  flank: ["She's flanking {side}!"],
  lost: ["Where'd she go?"],
  grenade: ["Frag out!"],
  plate: ["Plate's gone!"],
  suppressed: ["Taking fire!"],
  fallBack: ["Fall back! Fall back!"],
  surrender: ["Alright! Alright!"],
  wounded: ["I'm hit, I'm hit!"],
};

/** Barks that always play, past every rate limit ("Frag out!" is the grenade's telegraph, S3.5). */
export const ALWAYS: ReadonlySet<BarkKind> = new Set(["reload", "manDown", "grenade"]);
/** Per man (s), and the squad's cooldown after a bark ends (s). */
export const BARK_PER_MAN = 4;
export const BARK_SQUAD_COOLDOWN = 1.2;

/** Surnames the seed hands out for "We lost Harker!" */
export const SURNAMES: readonly string[] = ["Harker", "Doyle", "Malloy", "Pryce", "Keane", "Voss", "Rourke", "Tully", "Brandt", "Hale", "Crane", "Moss"];

export function surname(seed: number): string {
  return SURNAMES[Math.abs(Math.floor(seed)) % SURNAMES.length]!;
}

/** How long a line holds the radio (s). */
export function barkDuration(line: string): number {
  return 0.55 + line.length * 0.045;
}

/** Fills a line: a name, a side. */
export function barkLine(kind: BarkKind, rand: () => number, o: { name?: string; side?: "left" | "right" } = {}): string {
  const pool = BARK_LINES[kind];
  const raw = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!;
  if (raw.includes("{name}") && !o.name) return pool[0]!;
  return raw.replace("{name}", o.name ?? "").replace("{side}", o.side ?? "left");
}

/**
 * S10's rate limits: one bark per man per 4 s; one on the squad's radio at a time, then 1.2 s of quiet. "Reloading!"
 * and "Man down!" always play (they cut the queue, never wait).
 */
export class BarkGate {
  private clock = 0;
  private busyUntil = -1;
  private lastBy = new Map<number, number>();

  tick(dt: number): void {
    this.clock += dt;
  }

  get now(): number {
    return this.clock;
  }

  /** True when `who` may say a `kind` line now; on true the line is counted as said (it holds the radio for `dur`). */
  ask(who: number, kind: BarkKind, dur: number): boolean {
    const always = ALWAYS.has(kind);
    if (!always) {
      if (this.clock < this.busyUntil) return false;
      const last = this.lastBy.get(who);
      if (last !== undefined && this.clock - last < BARK_PER_MAN) return false;
    }
    this.lastBy.set(who, this.clock);
    this.busyUntil = Math.max(this.busyUntil, this.clock + dur + BARK_SQUAD_COOLDOWN);
    return true;
  }
}
