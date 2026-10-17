// A seeded 10-minute fight (docs/design/cathode-combat.md C6): Cath trades fire in bursts from cover, and
// we measure how long she lasts per life under a health model. It checks that the Guard/Flesh model
// (sim/vitals.ts) keeps time-to-death within 10% of the old single pool (regen 6%/s after 5 s), per
// difficulty, so BALANCE.md's curve holds. Logged in BALANCE.md.

import { createRng } from "./rng";
import { Vitals } from "./vitals";

export type HealthModel = "pool" | "vitals";

/** The single pool's damage-taken multipliers (session.ts DAMAGE_TAKEN before C6). */
export const DIFFICULTY_TAKEN: Record<string, number> = { noir: 0.55, hardboiled: 0.85, hellWeek: 1 };
/**
 * The Guard/Flesh model's: Guard comes back whole after every 6 s lull, so the same rounds must hit a little
 * harder for her to last as long as she did (fitted by this sim, BALANCE.md 2026-10-17).
 */
export const VITALS_TAKEN: Record<string, number> = { noir: 0.69, hardboiled: 0.98, hellWeek: 1.1 };

interface Body {
  hit(n: number): void;
  step(dt: number): void;
  alive(): boolean;
  reset(): void;
}

function pool(max: number): Body {
  let hp = max;
  let since = 1e9;
  return {
    hit: (n) => {
      hp = Math.max(0, hp - n);
      since = 0;
    },
    step: (dt) => {
      since += dt;
      if (since > 5 && hp < max) hp = Math.min(max, hp + max * 0.06 * dt);
    },
    alive: () => hp > 0,
    reset: () => {
      hp = max;
      since = 1e9;
    },
  };
}

function vitals(max: number): Body {
  const v = new Vitals(max);
  return {
    hit: (n) => void v.damage(n),
    step: (dt) => void v.update(dt).splice(0),
    alive: () => v.flesh > 0,
    reset: () => v.reset(max),
  };
}

export interface FightOptions {
  minutes?: number;
  /** Cath's level: her max health (60 + 5L + 2 grit, grit 3) and the Enforcer's round (7 x 1.08^L) both grow. */
  level?: number;
  /** Rounds landing per second while she's exposed (two Enforcers' bursts at about half hits: 1.4). */
  rate?: number;
  /** The damage-taken multiplier, if not the model's own table's. */
  taken?: number;
}

/**
 * Mean seconds per life over a fight: exposed 2-7 s taking rounds (Poisson at `rate`, an Enforcer's round x
 * the difficulty's multiplier, +-20%), then 1.5-10 s in cover, for `minutes`.
 */
export function timeToDeath(model: HealthModel, difficulty: string, seed: number, o: FightOptions = {}): { mean: number; deaths: number } {
  const rng = createRng(seed);
  const level = o.level ?? 5;
  const maxHp = 60 + 5 * level + 6;
  const round = 7 * 1.08 ** level;
  const rate = o.rate ?? 1.4;
  const minutes = o.minutes ?? 10;
  const body = model === "pool" ? pool(maxHp) : vitals(maxHp);
  const taken = o.taken ?? (model === "pool" ? DIFFICULTY_TAKEN : VITALS_TAKEN)[difficulty] ?? 1;
  const dt = 1 / 30;
  const end = minutes * 60;
  let t = 0;
  let life = 0;
  let deaths = 0;
  let lived = 0;
  let exposed = true;
  let phase = rng.float(2, 7);
  while (t < end) {
    phase -= dt;
    if (phase <= 0) {
      exposed = !exposed;
      phase = exposed ? rng.float(2, 7) : rng.float(1.5, 10);
    }
    if (exposed && rng.next() < rate * dt) body.hit(round * taken * rng.float(0.8, 1.2));
    body.step(dt);
    t += dt;
    life += dt;
    if (!body.alive()) {
      deaths++;
      lived += life;
      life = 0;
      body.reset();
      exposed = false;
      phase = rng.float(1.5, 4);
    }
  }
  // A life still running at the end counts as at least that long (censored), so a model nobody dies under
  // doesn't read as "dies instantly".
  if (!deaths) return { mean: life, deaths: 0 };
  return { mean: (lived + life) / Math.max(1, deaths), deaths };
}
