// Replays (ROADMAP 53). The engine is deterministic, so a run is just how it was set up plus every input
// the player made, stamped with how many engine steps had passed. Watching one rebuilds the game from the
// setup and feeds the inputs back at the same steps. A replay packs into a URL (#replay=...) to share.

import {
  callNeighbours,
  callRally,
  duelStrike,
  merge,
  moveHero,
  newGame,
  place,
  sell,
  sendWave,
  setTarget,
  stepGame,
  throwPie,
  upgrade,
  type Ability,
  type ActionResult,
  type Game,
  type Level,
  type Perks,
  type TargetMode,
  type TowerKind,
} from "./engine";

export type Action =
  | { t: "place"; kind: TowerKind; col: number; row: number }
  | { t: "upgrade"; id: number; spec?: 0 | 1 }
  | { t: "sell"; id: number }
  | { t: "target"; id: number; mode: TargetMode }
  | { t: "wave" }
  | { t: "pie"; x?: number; y?: number }
  | { t: "neighbours" }
  | { t: "rally" }
  | { t: "merge"; id: number; partner: number }
  | { t: "strike"; q: number }
  /** Cath takes a new post (between rounds only). */
  | { t: "hero"; x: number; y: number }
  /** An ability's Auto toggle. */
  | { t: "auto"; ability: Ability; on: boolean };

/** How the game was started: which field, which mode, and the perks Cath brought. */
export interface Setup {
  mode: "level" | "endless" | "daily";
  /** Level id, the act for Endless, or the day number for a daily. */
  id: number;
  /** Endless only: the weekly seed. */
  week?: number;
  heroic: boolean;
  perks: Perks;
}

/** v2 (Hedgerow 2 M1): Cath holds a post and abilities are manual, so a v1 run no longer plays back the same. */
export const REPLAY_VERSION = 2;

export interface Replay {
  v: typeof REPLAY_VERSION;
  setup: Setup;
  /** [engine steps before it, the action]. */
  log: Array<[number, Action]>;
  /** Engine steps in the whole run (so playback knows when it's over). */
  steps: number;
}

export function applyAction(game: Game, a: Action): ActionResult {
  switch (a.t) {
    case "place":
      return place(game, a.kind, a.col, a.row);
    case "upgrade":
      return upgrade(game, a.id, a.spec);
    case "sell":
      return sell(game, a.id);
    case "target":
      return setTarget(game, a.id, a.mode);
    case "wave":
      return sendWave(game);
    case "pie":
      return throwPie(game, a.x, a.y);
    case "neighbours":
      return callNeighbours(game);
    case "rally":
      return callRally(game);
    case "merge":
      return merge(game, a.id, a.partner);
    case "strike":
      return duelStrike(game, a.q);
    case "hero":
      return moveHero(game, a.x, a.y);
    case "auto":
      game.auto[a.ability] = a.on;
      return { ok: true };
  }
}

/** A fresh game exactly as a run started (the browser's duels included). */
export function startGame(level: Level, setup: Setup): Game {
  const game = newGame(level, setup.perks, {}, setup.heroic && !level.endless);
  game.duels = true;
  return game;
}

/** Records a live run: every successful action, and every engine step. */
export class Recorder {
  steps = 0;
  log: Array<[number, Action]> = [];
  constructor(readonly setup: Setup) {}

  act(game: Game, a: Action): ActionResult {
    const r = applyAction(game, a);
    if (r.ok) this.log.push([this.steps, a]);
    return r;
  }

  step(game: Game): void {
    stepGame(game);
    this.steps += 1;
  }

  replay(): Replay {
    return { v: REPLAY_VERSION, setup: this.setup, log: this.log.slice(), steps: this.steps };
  }
}

/** Plays a replay back one engine step at a time. */
export class Player {
  readonly game: Game;
  private at = 0;
  private next = 0;
  constructor(
    level: Level,
    readonly replay: Replay,
  ) {
    this.game = startGame(level, replay.setup);
  }

  get done(): boolean {
    return this.at >= this.replay.steps;
  }

  get progress(): number {
    return this.replay.steps ? this.at / this.replay.steps : 1;
  }

  step(): void {
    const log = this.replay.log;
    while (this.next < log.length && log[this.next]![0] <= this.at) applyAction(this.game, log[this.next++]![1]);
    if (this.done) return;
    stepGame(this.game);
    this.at += 1;
  }

  /** Runs to the end (tests, and checking a shared replay). */
  finish(): Game {
    while (!this.done) this.step();
    this.step();
    return this.game;
  }
}

// ---- sharing: a compact, URL-safe string ----

function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text: string): Uint8Array {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodeReplay(r: Replay): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(r));
  return toB64url(await pipe(json, new CompressionStream("deflate-raw")));
}

/**
 * Decodes a shared replay: the replay, "old" for a well-formed link from an older Hedgerow (its rules have
 * changed, so it can't be played back), or null if it's damaged or not one.
 */
export async function decodeReplay(text: string): Promise<Replay | "old" | null> {
  try {
    const json = await pipe(fromB64url(text), new DecompressionStream("deflate-raw"));
    const r = JSON.parse(new TextDecoder().decode(json)) as Replay;
    const v = (r as { v?: unknown } | null)?.v;
    if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v < REPLAY_VERSION && r.setup && Array.isArray(r.log)) return "old";
    if (r?.v !== REPLAY_VERSION || !r.setup || !Array.isArray(r.log) || typeof r.steps !== "number") return null;
    if (!["level", "endless", "daily"].includes(r.setup.mode)) return null;
    return r;
  } catch {
    return null;
  }
}
