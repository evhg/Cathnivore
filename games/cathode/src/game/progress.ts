// Cath's character between the rules core (sim/) and the live game: the saved Character, her derived
// stats, the Build combat reads, kill XP and level-ups, and saving.

import { characterStats, gainXp, newCharacter, type Character } from "../sim/character";
import { deserialize, makeSave, serialize, SAVE_KEY } from "../sim/save";
import { killXp, type DerivedStats } from "../sim/stats";
import { makeEnemy } from "../sim/enemies";
import { createRng } from "../sim/rng";
import type { ClassId } from "../sim/types";
import type { Build } from "./combat";
import type { EnemyKit } from "./enemy";

export class Progress {
  character: Character;
  stats: DerivedStats;
  jobsDone: string[] = [];

  constructor(cls: ClassId = "ghost") {
    const loaded = Progress.load();
    this.character = loaded?.character ?? newCharacter(cls);
    this.jobsDone = loaded?.jobsDone ?? [];
    this.stats = characterStats(this.character);
  }

  static load(): { character: Character; jobsDone: string[] } | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const r = deserialize(raw);
      return r.ok ? { character: r.save.character, jobsDone: r.save.jobsDone } : null;
    } catch {
      return null;
    }
  }

  static hasSave(): boolean {
    return Progress.load() !== null;
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, serialize(makeSave(this.character, new Date().toISOString(), { jobsDone: this.jobsDone })));
    } catch {
      // Storage full or private mode: the run continues unsaved.
    }
  }

  /** Swap in a changed character (from the character screen) and re-derive. */
  set(next: Character): void {
    this.character = next;
    this.stats = characterStats(next);
    this.save();
  }

  build(): Build {
    const d = this.stats;
    return {
      damage: (cls) => (cls === "melee" ? d.meleeMultiplier : d.gunMultiplier[cls]),
      headshot: d.headshotMultiplier,
      crit: d.critChance.sniper,
      critMul: d.critMultiplier.sniper,
    };
  }

  /** The game's enemy kit for an archetype at a level, from the rules' tables. */
  static kit(base: EnemyKit, archetype: string, level: number, seed: number): EnemyKit {
    const e = makeEnemy(archetype, level, createRng(seed));
    return {
      ...base,
      name: e.name,
      maxHp: Math.round(e.maxHealth),
      armour: e.armour,
      damage: e.damage,
      xp: e.xp,
      walk: e.walk || base.walk,
      run: e.run || base.run,
      vision: { range: e.vision.range || base.vision.range, fov: e.vision.cone ? (e.vision.cone * Math.PI) / 180 : base.vision.fov },
    };
  }

  /** XP for a kill; returns the levels gained. */
  kill(monsterXp: number, monsterLevel: number, unseen: boolean, bonus: number): number[] {
    const xp = Math.round(killXp(monsterXp, monsterLevel, this.character.level, { unseen, xpMultiplier: this.stats.xpMultiplier }) * bonus);
    const g = gainXp(this.character, xp);
    this.character = g.character;
    if (g.levelUps.length) {
      this.stats = characterStats(this.character);
      this.save();
    }
    this.lastXp = xp;
    return g.levelUps;
  }
  lastXp = 0;
}
