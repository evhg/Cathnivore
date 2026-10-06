// Cath's character between the rules core (sim/) and the live game: the saved Character, her derived
// stats, the Build combat reads, kill XP and level-ups, and saving.

import { characterStats, gainXp, newCharacter, type Character } from "../sim/character";
import { deserialize, makeSave, serialize, SAVE_KEY } from "../sim/save";
import { killXp, type DerivedStats } from "../sim/stats";
import { makeEnemy } from "../sim/enemies";
import { createRng, type Rng } from "../sim/rng";
import { itemWeaponStats, makeItem, rollDrop, type Item } from "../sim/loot";
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
    this.unlocks = Progress.loadUnlocks(this);
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

  /** Damage scale for a live weapon from the gear on Cath: its tier, parts, chips and rolls against a fresh one. */
  weaponScale(id: string): number {
    const worn = [this.character.equipment.weapon1, this.character.equipment.weapon2].find((i) => i?.base === id);
    if (!worn) return 1;
    const have = itemWeaponStats(worn)?.damage;
    const fresh = itemWeaponStats(makeItem(id, { uid: "baseline" }))?.damage;
    return have && fresh ? Math.min(6, Math.max(0.5, have / fresh)) : 1;
  }

  /** The game's enemy kit for an archetype at a level, from the rules' tables. */
  static kit(base: EnemyKit, archetype: string, level: number, seed: number, elite = false): EnemyKit {
    const e = makeEnemy(archetype, level, createRng(seed), elite);
    const fast = e.mods.includes("extraFast");
    return {
      ...base,
      name: e.name,
      maxHp: Math.round(e.maxHealth),
      armour: e.armour,
      damage: e.damage * (1 + e.addedShock),
      xp: e.xp,
      walk: (e.walk || base.walk) * (fast ? 1.5 : 1),
      run: (e.run || base.run) * (fast ? 1.5 : 1),
      burst: fast ? [base.burst[0], base.burst[1] / 1.33, base.burst[2] / 1.33] : base.burst,
      elite: e.elite,
      mods: e.mods,
      drain: e.drainsBulletTime,
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
  private rng: Rng = createRng(Date.now() >>> 0);

  /** What a kill drops: Scrip and items go straight into Cath's coat (auto-pickup in the slice). */
  loot(monsterLevel: number, elite: boolean): { items: Item[]; scrip: number } {
    const d = this.rollLoot(monsterLevel, elite);
    this.take(d);
    return d;
  }

  /** Roll a drop without pocketing it: it lies on the ground until she walks over it. */
  rollLoot(monsterLevel: number, elite: boolean): { items: Item[]; scrip: number; gun?: string } {
    return rollDrop(this.rng, monsterLevel, this.character.difficulty, this.stats.magicFind, elite);
  }

  /** Pocket a drop. */
  take(d: { items: Item[]; scrip: number }): void {
    this.character = { ...this.character, inventory: [...this.character.inventory, ...d.items], scrip: this.character.scrip + d.scrip };
    if (d.items.length) this.save();
  }

  // ---- what she owns and what the game has taught her (one thing at a time) ----
  unlocks: Unlocks = { weapons: ["pin"], features: [] };

  static loadUnlocks(p: Progress): Unlocks {
    try {
      const raw = localStorage.getItem(UNLOCKS_KEY);
      if (raw) {
        const u = JSON.parse(raw) as Partial<Unlocks>;
        if (Array.isArray(u.weapons) && Array.isArray(u.features)) return { weapons: u.weapons, features: u.features };
      }
    } catch {
      // Fall through to the defaults.
    }
    // A save that already finished the first job keeps its kit; everyone else starts with the Pin.
    if (p.jobsDone.includes("fishMarket"))
      return { weapons: ["pin", "kestrel", CLASS_WEAPON[p.character.classes[0]!] ?? "kestrel"], features: [...FEATURES] };
    return { weapons: ["pin"], features: [] };
  }

  /** A new Cath starts from scratch: only the Pin, nothing taught. */
  static resetUnlocks(): void {
    try {
      localStorage.removeItem(UNLOCKS_KEY);
    } catch {
      // Nothing stored anyway.
    }
  }

  saveUnlocks(): void {
    try {
      localStorage.setItem(UNLOCKS_KEY, JSON.stringify(this.unlocks));
    } catch {
      // Unsaved: the tutorial would just show again.
    }
  }

  /** Gives her a weapon (once); true if it's new. */
  grantWeapon(id: string): boolean {
    if (this.unlocks.weapons.includes(id)) return false;
    this.unlocks.weapons.push(id);
    this.saveUnlocks();
    return true;
  }

  /** Marks a control or system as taught (it appears on screen from now on). */
  teach(f: Feature): boolean {
    if (this.unlocks.features.includes(f)) return false;
    this.unlocks.features.push(f);
    this.saveUnlocks();
    return true;
  }

  knows(f: Feature): boolean {
    return this.unlocks.features.includes(f);
  }
}

export type Feature = "crouch" | "takedown" | "aim" | "reload" | "focus" | "skills" | "swap";
export const FEATURES: Feature[] = ["crouch", "takedown", "aim", "reload", "focus", "skills", "swap"];
export interface Unlocks {
  weapons: string[];
  features: string[];
}
const UNLOCKS_KEY = "cathode:unlocks:v1";

/** Each class's own weapon, handed over on the walkway in the first job. */
export const CLASS_WEAPON: Partial<Record<ClassId, string>> = {
  ghost: "widowmaker",
  butcher: "fishmonger",
  gunslinger: "oldTestament",
  wirewitch: "candorSeeker",
  fixer: "bargainBin",
};
