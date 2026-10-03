import { describe, expect, it } from "vitest";
import {
  activeWeaponStats,
  allocateAttribute,
  characterStats,
  claimSkillReward,
  equip,
  gainXp,
  newCharacter,
  respecCharacter,
  takeSecondClass,
  type Character,
} from "../games/cathode/src/sim/character";
import {
  SAVE_VERSION,
  deserialize,
  exportCode,
  fromBase64Url,
  importCode,
  makeSave,
  serialize,
  toBase64Url,
} from "../games/cathode/src/sim/save";
import { makeItem, makeUnique, rollDrop } from "../games/cathode/src/sim/loot";
import { spendSkill } from "../games/cathode/src/sim/skills";
import { createRng } from "../games/cathode/src/sim/rng";
import { CLASS_START_ATTRIBUTES, xpForLevel, xpToNext } from "../games/cathode/src/sim/stats";

function must<T>(r: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

describe("CATHODE character", () => {
  it("starts as Cath with her class kit and the Pin", () => {
    const c = newCharacter("ghost");
    expect(c.name).toBe("Cath");
    expect(c.level).toBe(1);
    expect(c.equipment.weapon1?.base).toBe("widowmaker");
    expect(c.equipment.weapon2?.base).toBe("thePin");
    expect(c.attributes).toEqual(CLASS_START_ATTRIBUTES.ghost);
    expect(activeWeaponStats(c)?.cls).toBe("sniper");
    expect(characterStats(c).armour).toBeGreaterThan(0);
  });

  it("levels up from XP, granting 5 attribute points and 1 skill point a level", () => {
    const c = newCharacter("butcher");
    const one = gainXp(c, xpToNext(1) - 1);
    expect(one.levelUps).toEqual([]);
    const jump = gainXp(c, xpForLevel(4));
    expect(jump.levelUps).toEqual([2, 3, 4]);
    expect(jump.character.unspentAttributes).toBe(15);
    expect(jump.character.unspentSkills).toBe(c.unspentSkills + 3);
    const capped = gainXp(c, 1e12).character;
    expect(capped.level).toBe(60);
    expect(gainXp(capped, 1000).levelUps).toEqual([]);
  });

  it("spends attribute points, claims job skill points once, and takes a second class at 15", () => {
    let c = gainXp(newCharacter("gunslinger"), xpForLevel(15)).character;
    c = must(allocateAttribute(c, "aim", 10));
    expect(c.attributes.aim).toBe(CLASS_START_ATTRIBUTES.gunslinger.aim + 10);
    expect(allocateAttribute(c, "aim", 1000).ok).toBe(false);
    const before = c.unspentSkills;
    c = must(claimSkillReward(c, "fishMarket"));
    expect(c.unspentSkills).toBe(before + 1);
    expect(claimSkillReward(c, "fishMarket").ok).toBe(false);
    c = must(takeSecondClass(c, "ghost"));
    expect(c.classes).toEqual(["gunslinger", "ghost"]);
  });

  it("respecs with a free token first, then for Scrip that doubles", () => {
    let c: Character = { ...gainXp(newCharacter("ghost"), xpForLevel(10)).character, scrip: 100000, freeRespecs: 1 };
    c = must(spendSkill(c, "ghost.steadyHands", 5));
    c = must(allocateAttribute(c, "nerve", 20));
    const r1 = must(respecCharacter(c));
    expect(r1.scrip).toBe(100000);
    expect(r1.freeRespecs).toBe(0);
    expect(r1.skills).toEqual({});
    expect(r1.attributes).toEqual(CLASS_START_ATTRIBUTES.ghost);
    expect(r1.unspentAttributes).toBe(c.unspentAttributes + 20);
    const r2 = must(respecCharacter(r1));
    const r3 = must(respecCharacter(r2));
    expect(r1.scrip - r2.scrip).toBeGreaterThan(0);
    expect(r2.scrip - r3.scrip).toBe((r1.scrip - r2.scrip) * 2);
    expect(respecCharacter({ ...r3, scrip: 0 }).ok).toBe(false);
  });

  it("equips gear that changes derived stats, and refuses gear Cath can't use yet", () => {
    let c = newCharacter("ghost");
    const before = characterStats(c);
    const coat = makeUnique("longGoodbye")!;
    c = { ...c, level: 20, inventory: [coat] };
    c = must(equip(c, coat.uid, "coat"));
    expect(c.inventory.map((i) => i.base)).toEqual(["trench"]);
    const after = characterStats(c);
    expect(after.armour).toBeGreaterThan(before.armour + 80);
    expect(after.maxHealth).toBeGreaterThan(before.maxHealth);
    const rail = makeItem("rail9");
    const low = { ...newCharacter("ghost"), inventory: [rail] };
    expect(equip(low, rail.uid, "weapon1").ok).toBe(false);
    expect(equip(low, rail.uid, "head").ok).toBe(false);
  });
});

describe("CATHODE saves", () => {
  const rich = (): Character => {
    let c = gainXp(newCharacter("wirewitch", "hardboiled"), xpForLevel(22)).character;
    c = must(spendSkill(c, "wirewitch.backdoor", 3));
    c = must(takeSecondClass(c, "fixer"));
    const rng = createRng(31);
    const loot = Array.from({ length: 12 }, () => rollDrop(rng, 22, "hardboiled", 50, true).items).flat();
    return { ...c, inventory: loot, scrip: 1234 };
  };

  it("round-trips through JSON and through an export code", () => {
    const save = makeSave(rich(), "2026-10-03T12:00:00Z", { jobsDone: ["fishMarket"], checkpoint: { jobId: "j2", checkpointId: "c1", rngState: 77 } });
    const back = deserialize(serialize(save));
    expect(back.ok && back.save).toEqual(save);
    const code = exportCode(save);
    expect(code).toMatch(/^CATH2\.[A-Za-z0-9_-]+\.[0-9a-z]+$/);
    const imported = importCode(`  ${code.slice(0, 40)}\n${code.slice(40)}  `);
    expect(imported.ok && imported.save).toEqual(save);
  });

  it("rejects damaged codes, junk and saves from the future", () => {
    const code = exportCode(makeSave(newCharacter("fixer"), "2026-10-03T12:00:00Z"));
    const parts = code.split(".");
    const flipped = `${parts[0]}.${parts[1]!.slice(0, -2)}${parts[1]!.slice(-2) === "AA" ? "AB" : "AA"}.${parts[2]}`;
    expect(importCode(flipped).ok).toBe(false);
    expect(importCode("hello").ok).toBe(false);
    expect(deserialize("{").ok).toBe(false);
    expect(deserialize(JSON.stringify({ version: SAVE_VERSION + 1, character: {} })).ok).toBe(false);
    expect(deserialize(JSON.stringify({ version: SAVE_VERSION, character: { level: 0 } })).ok).toBe(false);
  });

  it("migrates a version-1 save (gold, skill pairs) to the current version", () => {
    const c = newCharacter("ghost");
    const scrip = c.scrip;
    const old: Record<string, unknown> = { ...c, gold: scrip + 5, skills: [["ghost.steadyHands", 2]] };
    for (const k of ["scrip", "respecs", "freeRespecs", "rewardsClaimed", "activeWeapon"]) delete old[k];
    const v1 = { version: 1, savedAt: "2026-10-01T00:00:00Z", character: old };
    const r = deserialize(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    expect(r.save.version).toBe(SAVE_VERSION);
    expect(r.save.character.scrip).toBe(scrip + 5);
    expect(r.save.character.skills).toEqual({ "ghost.steadyHands": 2 });
    expect(r.save.character.activeWeapon).toBe("weapon1");
    expect(r.save.jobsDone).toEqual([]);
    expect(characterStats(r.save.character).maxHealth).toBeGreaterThan(0);
  });

  it("encodes base64url both ways for every byte", () => {
    const bytes = new Uint8Array(Array.from({ length: 256 }, (_, i) => i));
    for (const n of [0, 1, 2, 3, 255, 256]) {
      const slice = bytes.slice(0, n);
      expect(Array.from(fromBase64Url(toBase64Url(slice))!)).toEqual(Array.from(slice));
    }
    expect(fromBase64Url("ab+c")).toBeNull();
  });
});
