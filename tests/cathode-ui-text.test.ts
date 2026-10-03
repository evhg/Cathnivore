import { describe, expect, it } from "vitest";
import { FIRMWARE_CHAINS, UNIQUE_BY_ID, makeItem, makeUnique } from "../games/cathode/src/sim/loot";
import { fixedModText, itemTypeLine, baseName, modText, words } from "../games/cathode/src/ui/itemtext";
import { monogram } from "../games/cathode/src/ui/character";
import { cogPath } from "../games/cathode/src/ui/classart";

describe("item text", () => {
  it("phrases modifiers the way a tooltip should", () => {
    expect(modText("critChance", "flat", 5)).toBe("+5% critical chance");
    expect(modText("armour", "flat", 20)).toBe("+20 armour");
    expect(modText("stealth", "increased", 15)).toBe("+15% stealth");
    expect(modText("footstepNoise", "increased", -50)).toBe("−50% footstep noise");
    expect(modText("damage.sniper", "more", 20)).toBe("20% more sniper rifle damage");
    expect(modText("skills.tree.longshot", "flat", 2)).toBe("+2 to Longshot skills");
    expect(modText("skills.class.ghost", "flat", 1)).toBe("+1 to Ghost skills");
    expect(modText("skills.all", "flat", 1)).toBe("+1 to all skills");
    expect(modText("resist.incendiary", "flat", 20)).toBe("+20% fire resistance");
    expect(modText("added.shock", "flat", 25)).toBe("Adds 25% of damage as shock");
    expect(modText("bulletTimeOnKill", "flat", 1)).toBe("+1 s bullet-time on kill");
    expect(modText("bulletTime", "increased", 10)).toBe("+10% bullet-time");
    expect(modText("damage", "increased", 110, true)).toBe("+110% weapon damage");
    expect(modText("lastRoundDamage", "increased", 30)).toBe("+30% last round damage");
    expect(words("lastRoundDamage")).toBe("last round damage");
  });

  it("formats every unique, set and chain modifier without leaking a raw key", () => {
    for (const u of Object.values(UNIQUE_BY_ID)) {
      for (const m of u.mods) expect(fixedModText(m)).not.toMatch(/[a-z][A-Z]|[a-z]\.[a-z]|undefined/);
    }
    for (const c of FIRMWARE_CHAINS) for (const m of c.mods) expect(fixedModText(m)).not.toMatch(/undefined/);
  });

  it("names an item's type and base", () => {
    const lullaby = makeUnique("lullaby")!;
    expect(itemTypeLine(lullaby)).toBe("Sniper rifle");
    expect(baseName(lullaby)).toBe("Widowmaker");
    const trench = makeItem("trench");
    expect(itemTypeLine(trench)).toBe("Coat");
    expect(baseName(trench)).toBeNull();
    expect(itemTypeLine(makeItem("ash"))).toBe("Chip");
  });
});

describe("skill monograms and emblem geometry", () => {
  it("abbreviates skill names to two letters", () => {
    expect(monogram("Held Breath")).toBe("HB");
    expect(monogram("One Shot, One Name")).toBe("OS");
    expect(monogram("Ricochet")).toBe("Ri");
    expect(monogram("Kill-Cam Junkie")).toBe("KC");
    expect(monogram("The Pin")).toBe("Pi");
  });

  it("builds a closed cog path with four points per tooth", () => {
    const d = cogPath(60, 60, 36, 29, 10);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.split("L").length).toBe(40);
  });
});
