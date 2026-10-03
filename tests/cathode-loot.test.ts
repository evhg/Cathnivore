import { describe, expect, it } from "vitest";
import {
  AFFIXES,
  CHIPS,
  FIRMWARE_CHAINS,
  GEAR_BASES,
  SETS,
  SET_PIECES,
  UNIQUES,
  chainOf,
  equipmentModifiers,
  itemModifiers,
  itemWeaponStats,
  makeItem,
  makeUnique,
  rarityChances,
  rollDrop,
  rollItem,
  rollRarity,
  setBonuses,
  socketChip,
  type Item,
} from "../games/cathode/src/sim/loot";
import { WEAPON_BASES, WEAPON_PARTS, basesOfClass, recoilAt, weaponStats } from "../games/cathode/src/sim/weapons";
import { createRng } from "../games/cathode/src/sim/rng";
import { WEAPON_CLASSES } from "../games/cathode/src/sim/types";
import { sumModifiers } from "../games/cathode/src/sim/stats";

describe("CATHODE weapons", () => {
  it("has at least two bases for each of the nine weapon classes, with the named ones", () => {
    for (const c of WEAPON_CLASSES) expect(basesOfClass(c).length, c).toBeGreaterThanOrEqual(2);
    expect(WEAPON_BASES.widowmaker!.cls).toBe("sniper");
    expect(WEAPON_BASES.rail9!.name).toBe("Rail-9");
    expect(WEAPON_BASES.thePin!.cls).toBe("melee");
    expect(WEAPON_BASES.rail9!.penetration).toBeGreaterThan(WEAPON_BASES.widowmaker!.penetration);
    for (const b of Object.values(WEAPON_BASES)) {
      expect(b.recoil.length).toBeGreaterThan(0);
      expect(b.altFire.description.length).toBeGreaterThan(0);
      if (b.cls !== "melee") expect(b.velocity).toBeGreaterThan(0);
    }
  });

  it("raises damage with tiers I–V and changes handling with parts", () => {
    const b = WEAPON_BASES.widowmaker!;
    const tiers = ([1, 2, 3, 4, 5] as const).map((tier) => weaponStats(b, { tier }).damage);
    for (let i = 1; i < 5; i++) expect(tiers[i]!).toBeGreaterThan(tiers[i - 1]!);
    expect(tiers[4]! / tiers[0]!).toBeCloseTo(2.1);
    const can = weaponStats(b, { parts: { suppressor: "subsonicBaffle", scope: "thermal", stock: "marksmanStock" } });
    expect(can.suppressed).toBe(true);
    expect(can.subsonic).toBe(true);
    expect(can.noise).toBeLessThan(b.noise * 0.2);
    expect(can.zoom).toBe(b.zoom + 6);
    expect(can.sway).toBeLessThan(b.sway);
    // A part that doesn't fit the class is ignored.
    expect(weaponStats(WEAPON_BASES.thePin!, { parts: { suppressor: "can" } }).suppressed).toBe(false);
    expect(Object.values(WEAPON_PARTS).map((p) => p.slot)).toEqual(expect.arrayContaining(["barrel", "scope", "suppressor", "mag", "stock"]));
  });

  it("loops recoil patterns", () => {
    const w = weaponStats(WEAPON_BASES.rattlecan!);
    expect(recoilAt(w, w.recoil.length)).toEqual(recoilAt(w, 0));
  });
});

describe("CATHODE loot tables", () => {
  it("has the content counts the bible asks for", () => {
    expect(AFFIXES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(AFFIXES.map((a) => a.id)).size).toBe(AFFIXES.length);
    expect(AFFIXES.filter((a) => a.kind === "prefix").length).toBeGreaterThanOrEqual(12);
    expect(AFFIXES.filter((a) => a.kind === "suffix").length).toBeGreaterThanOrEqual(12);
    expect(UNIQUES.length).toBeGreaterThanOrEqual(12);
    expect(SETS.length).toBeGreaterThanOrEqual(2);
    for (const s of SETS) {
      expect(s.pieces.length).toBeGreaterThanOrEqual(3);
      expect(s.pieces.length).toBeLessThanOrEqual(4);
    }
    expect(CHIPS.length).toBeGreaterThanOrEqual(12);
    expect(FIRMWARE_CHAINS.length).toBeGreaterThanOrEqual(8);
    for (const u of UNIQUES) expect(WEAPON_BASES[u.base] ?? GEAR_BASES[u.base], u.id).toBeDefined();
    for (const p of SET_PIECES) expect(WEAPON_BASES[p.base] ?? GEAR_BASES[p.base], p.id).toBeDefined();
    for (const c of FIRMWARE_CHAINS) for (const chip of c.chips) expect(CHIPS.some((x) => x.id === chip), chip).toBe(true);
  });

  it("has level-banded affixes whose bands climb", () => {
    for (const a of AFFIXES) {
      for (let i = 1; i < a.bands.length; i++) {
        expect(a.bands[i]!.level).toBeGreaterThan(a.bands[i - 1]!.level);
        expect(Math.abs(a.bands[i]!.max)).toBeGreaterThanOrEqual(Math.abs(a.bands[i - 1]!.max));
      }
    }
  });

  it("rolls the same drops for the same seed", () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 40 }, () => rollDrop(rng, 25, "hardboiled", 100, true));
    };
    expect(run(9)).toEqual(run(9));
    expect(JSON.stringify(run(9))).not.toBe(JSON.stringify(run(10)));
  });

  it("follows the rarity distribution, and magic find and elites shift it up", () => {
    const tally = (mf: number, elite: boolean) => {
      const rng = createRng(1234);
      const counts = { standard: 0, modded: 0, rare: 0, unique: 0, set: 0 };
      for (let i = 0; i < 20000; i++) counts[rollRarity(rng, mf, elite)]++;
      return counts;
    };
    const plain = tally(0, false);
    const c = rarityChances(0, false, "noir");
    expect(plain.rare / 20000).toBeGreaterThan(c.rare * 0.7);
    expect(plain.rare / 20000).toBeLessThan(c.rare * 1.3 + 0.01);
    expect(plain.standard).toBeGreaterThan(plain.modded);
    expect(plain.modded).toBeGreaterThan(plain.rare);
    expect(plain.rare).toBeGreaterThan(plain.unique);
    const lucky = tally(300, true);
    expect(lucky.rare).toBeGreaterThan(plain.rare * 2);
    expect(lucky.unique + lucky.set).toBeGreaterThan(plain.unique + plain.set);
    // Diminishing returns: 1000% MF doesn't make uniques 11× likelier.
    expect(rarityChances(1000, false, "noir").unique).toBeLessThan(rarityChances(0, false, "noir").unique * 4);
  });

  it("gives modded items 1–2 affixes and rares 3–5 with a generated name", () => {
    const rng = createRng(5);
    for (let i = 0; i < 200; i++) {
      const kind = i % 2 ? "weapon" : "gear";
      const m = rollItem(rng, 30, "modded", kind);
      expect(m.affixes.length).toBeGreaterThanOrEqual(1);
      expect(m.affixes.length).toBeLessThanOrEqual(2);
      const r = rollItem(rng, 30, "rare", kind);
      expect(r.affixes.length).toBeGreaterThanOrEqual(3);
      expect(r.affixes.length).toBeLessThanOrEqual(5);
      expect(r.name.split(" ")).toHaveLength(2);
      expect(new Set(r.affixes.map((a) => a.id)).size).toBe(r.affixes.length);
    }
  });

  it("keeps affix values inside their band at the item level", () => {
    const rng = createRng(77);
    for (let i = 0; i < 300; i++) {
      const it = rollItem(rng, 10, "rare", "weapon");
      for (const a of it.affixes) {
        const def = AFFIXES.find((x) => x.id === a.id)!;
        const band = def.bands[a.band]!;
        expect(band.level).toBeLessThanOrEqual(10);
        expect(a.value).toBeGreaterThanOrEqual(Math.min(band.min, band.max));
        expect(a.value).toBeLessThanOrEqual(Math.max(band.min, band.max));
      }
    }
  });

  it("turns uniques and sets into modifiers, with set bonuses by pieces worn", () => {
    const lullaby = makeUnique("lullaby")!;
    expect(lullaby.rarity).toBe("unique");
    const w = itemWeaponStats(lullaby)!;
    expect(w.damage).toBeGreaterThan(weaponStats(WEAPON_BASES.widowmaker!, { itemLevel: lullaby.level }).damage * 2);
    expect(sumModifiers(itemModifiers(lullaby))["skills.tree.longshot"]!.flat).toBe(2);
    const pieces = ["widowsHat", "widowsTrench", "widowsGloves", "widowsDue"].map((id) => makeUnique(id)!);
    expect(setBonuses(pieces.slice(0, 1))).toHaveLength(0);
    expect(sumModifiers(setBonuses(pieces.slice(0, 2))).stealth!.increased).toBe(20);
    expect(sumModifiers(setBonuses(pieces))["skills.class.ghost"]!.flat).toBe(2);
    const eq = { head: pieces[0], coat: pieces[1], gloves: pieces[2], weapon2: pieces[3] };
    // Only the active weapon counts: wielding weapon1 (empty) drops the rifle out of the set.
    expect(sumModifiers(equipmentModifiers(eq, "weapon1"))["skills.class.ghost"]).toBeUndefined();
    expect(sumModifiers(equipmentModifiers(eq, "weapon2"))["skills.class.ghost"]!.flat).toBe(2);
  });
});

describe("CATHODE chips and firmware chains", () => {
  const socketed = (base: string, sockets: number, chips: string[], rarity: Item["rarity"] = "standard"): Item =>
    chips.reduce<Item>((it, c) => socketChip(it, c) ?? it, makeItem(base, { sockets, rarity }));

  it("recognises Last Call: Ash + Rain + Cold in a 3-socket sniper rifle", () => {
    const item = socketed("widowmaker", 3, ["ash", "rain", "cold"]);
    expect(chainOf(item)?.name).toBe("Last Call");
    expect(item.name).toContain("Last Call");
    expect(sumModifiers(itemModifiers(item)).bulletTimeOnKill!.flat).toBe(2);
    expect(itemWeaponStats(item)!.damage).toBeGreaterThan(weaponStats(WEAPON_BASES.widowmaker!).damage * 1.5);
  });

  it("needs the exact order, the full socket count, the right class and a standard base", () => {
    expect(chainOf(socketed("widowmaker", 3, ["rain", "ash", "cold"]))).toBeNull();
    expect(chainOf(socketed("widowmaker", 4, ["ash", "rain", "cold"]))).toBeNull();
    expect(chainOf(socketed("corridorAR", 3, ["ash", "rain", "cold"]))).toBeNull();
    expect(chainOf(socketed("widowmaker", 3, ["ash", "rain", "cold"], "modded"))).toBeNull();
    expect(chainOf(socketed("streetSweeper", 3, ["salt", "bone", "rust"]))?.name).toBe("Fish Market");
  });

  it("refuses chips beyond the sockets and gives chips different powers in weapons and armour", () => {
    const full = socketed("kestrel", 1, ["neon"]);
    expect(socketChip(full, "ash")).toBeNull();
    const weapon = sumModifiers(itemModifiers(full));
    const coat = sumModifiers(itemModifiers(socketed("trench", 1, ["neon"])));
    expect(weapon["added.shock"]!.flat).toBe(10);
    expect(coat["resist.shock"]!.flat).toBe(10);
    expect(coat["added.shock"]).toBeUndefined();
  });
});
