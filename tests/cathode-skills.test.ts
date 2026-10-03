import { describe, expect, it } from "vitest";
import {
  ALL_SKILLS,
  CLASS_SKILLS,
  HYBRID_SKILLS,
  ROW_LEVELS,
  SKILLS,
  hybridFor,
  mainValue,
  treeSkills,
} from "../games/cathode/src/sim/classes";
import {
  activeSkill,
  addSecondClass,
  cannotSpend,
  effectiveRank,
  refundSkill,
  requiredLevel,
  respec,
  respecCost,
  skillModifiers,
  skillValue,
  spendSkill,
  synergyBonus,
  type SkillHolder,
} from "../games/cathode/src/sim/skills";
import { CLASS_IDS, TREE_IDS, type ClassId } from "../games/cathode/src/sim/types";
import { CLASS_START_ATTRIBUTES, deriveStats, flat, sumModifiers } from "../games/cathode/src/sim/stats";

const holder = (level: number, classes: ClassId[], points = 100, skills: Record<string, number> = {}): SkillHolder => ({
  level,
  classes,
  skills,
  unspentSkills: points,
});

function must<T>(r: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

describe("CATHODE skill catalogue", () => {
  it("has 5 classes × 3 trees × 10 skills plus 10 hybrid capstones, all unique", () => {
    expect(CLASS_SKILLS).toHaveLength(150);
    expect(HYBRID_SKILLS).toHaveLength(10);
    expect(new Set(ALL_SKILLS.map((s) => s.id)).size).toBe(160);
    expect(new Set(ALL_SKILLS.map((s) => s.name)).size).toBe(160);
    for (const t of TREE_IDS) expect(treeSkills(t)).toHaveLength(10);
  });

  it("lays every tree out in 6 rows with prerequisites one row up, in the same class", () => {
    for (const t of TREE_IDS) {
      const rows = treeSkills(t).map((s) => s.row);
      expect(rows).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 5]);
    }
    for (const s of CLASS_SKILLS) {
      expect(s.maxRank).toBe(20);
      expect(s.row === 0 ? s.prereqs.length : s.prereqs.length > 0).toBe(s.row === 0 ? 0 : true);
      for (const p of s.prereqs) {
        const pre = SKILLS[p];
        expect(pre, `${s.id} → ${p}`).toBeDefined();
        expect(pre!.row).toBeLessThan(s.row);
        expect(pre!.tree).toBe(s.tree);
      }
      for (const syn of s.synergies) expect(SKILLS[syn.from], `${s.id} synergy ${syn.from}`).toBeDefined();
    }
  });

  it("gives every skill a description with numbers and actives their cooldown, battery and effect", () => {
    for (const s of ALL_SKILLS) {
      expect(s.description).toMatch(/\d/);
      expect(s.description).not.toContain("{v}");
      if (s.kind === "active") {
        expect(s.active!.cooldown).toBeGreaterThan(0);
        const fx = s.active!.effect(mainValue(s, 1), 1);
        expect(typeof fx.type).toBe("string");
      } else {
        expect(s.modifiers(mainValue(s, 1), 1).length, s.id).toBeGreaterThan(0);
      }
    }
    expect(SKILLS["ghost.slowTime"]!.active!.effect(2, 1)).toMatchObject({ type: "bulletTime", seconds: 2 });
    expect(SKILLS["gunslinger.deadEye"]!.active!.effect(3, 11)).toMatchObject({ type: "deadEye", marks: 3 });
    expect(SKILLS["ghost.silentTakedown"]!.active!.effect(2.5, 6)).toMatchObject({ type: "takedownRange", meters: 2.5 });
  });

  it("has one hybrid capstone for each of the 10 class pairs, including the five named in the bible", () => {
    const pairs = new Set<string>();
    for (let i = 0; i < CLASS_IDS.length; i++)
      for (let j = i + 1; j < CLASS_IDS.length; j++) {
        const h = hybridFor(CLASS_IDS[i]!, CLASS_IDS[j]!);
        expect(h, `${CLASS_IDS[i]}+${CLASS_IDS[j]}`).toBeDefined();
        pairs.add(h!.id);
      }
    expect(pairs.size).toBe(10);
    expect(hybridFor("ghost", "wirewitch")!.name).toBe("Dead Signal");
    expect(hybridFor("fixer", "butcher")!.name).toBe("Wetwork");
    expect(hybridFor("ghost", "gunslinger")!.name).toBe("High Noon");
    expect(hybridFor("butcher", "wirewitch")!.name).toBe("Puppeteer");
    expect(hybridFor("gunslinger", "fixer")!.name).toBe("Trick Shot");
  });
});

describe("CATHODE skill allocation", () => {
  it("gates rows by level: 1, 6, 12, 18, 24, 30", () => {
    expect(ROW_LEVELS).toEqual([1, 6, 12, 18, 24, 30]);
    const h = holder(5, ["ghost"], 10, { "ghost.steadyHands": 1 });
    expect(cannotSpend(h, "ghost.windReader")).toMatch(/level 6/);
    expect(cannotSpend({ ...h, level: 6 }, "ghost.windReader")).toBeNull();
  });

  it("enforces prerequisites and refuses to strand dependent skills on refund", () => {
    const h = holder(30, ["ghost"]);
    expect(cannotSpend(h, "ghost.windReader")).toMatch(/Steady Hands/);
    let g = must(spendSkill(h, "ghost.steadyHands"));
    g = must(spendSkill(g, "ghost.windReader", 3));
    expect(g.skills["ghost.windReader"]).toBe(3);
    expect(g.unspentSkills).toBe(96);
    const blocked = refundSkill(g, "ghost.steadyHands");
    expect(blocked.ok).toBe(false);
    g = must(refundSkill(g, "ghost.windReader"));
    expect(g.skills["ghost.windReader"]).toBe(2);
    expect(g.unspentSkills).toBe(97);
  });

  it("caps ranks at 20, needs points and rejects other classes' skills", () => {
    const g = must(spendSkill(holder(60, ["ghost"]), "ghost.steadyHands", 20));
    expect(cannotSpend(g, "ghost.steadyHands")).toMatch(/maximum/);
    expect(cannotSpend(holder(60, ["ghost"], 0), "ghost.heldBreath")).toMatch(/no skill points/);
    expect(cannotSpend(holder(60, ["ghost"]), "butcher.thePin")).toMatch(/class/);
    expect(spendSkill(holder(60, ["ghost"], 2), "ghost.steadyHands", 3).ok).toBe(false);
  });

  it("opens the second class at 15, delaying its rows by 3 levels", () => {
    expect(addSecondClass(holder(14, ["ghost"]), "butcher").ok).toBe(false);
    expect(addSecondClass(holder(15, ["ghost"]), "ghost").ok).toBe(false);
    const dual = must(addSecondClass(holder(15, ["ghost"]), "butcher"));
    expect(dual.classes).toEqual(["ghost", "butcher"]);
    expect(addSecondClass(dual, "fixer").ok).toBe(false);
    expect(requiredLevel(dual, SKILLS["butcher.butchersEye"]!)).toBe(9);
    expect(requiredLevel(dual, SKILLS["ghost.windReader"]!)).toBe(6);
    const withPin = must(spendSkill(dual, "butcher.thePin"));
    const at17 = { ...withPin, level: 14 + 3 };
    expect(cannotSpend({ ...at17, level: 14 }, "butcher.butchersEye")).toBeNull(); // 12 ≥ 9
    // Row 2 (level 12) needs level 15 for the second class.
    const eye = must(spendSkill(at17, "butcher.butchersEye"));
    expect(cannotSpend({ ...eye, level: 14 }, "butcher.finisher")).toMatch(/level 15/);
    expect(cannotSpend({ ...eye, level: 15 }, "butcher.finisher")).toBeNull();
  });

  it("needs both classes and level 30 for a hybrid capstone", () => {
    const id = hybridFor("ghost", "wirewitch")!.id;
    expect(cannotSpend(holder(40, ["ghost"]), id)).toMatch(/both/);
    expect(cannotSpend(holder(29, ["ghost", "wirewitch"]), id)).toMatch(/level 30/);
    expect(cannotSpend(holder(30, ["wirewitch", "ghost"]), id)).toBeNull();
    expect(cannotSpend(holder(30, ["ghost", "butcher"]), id)).toMatch(/both/);
  });

  it("respecs every point and prices respecs up each time", () => {
    let g = must(spendSkill(holder(30, ["ghost"], 10), "ghost.steadyHands", 4));
    g = respec(g);
    expect(g.skills).toEqual({});
    expect(g.unspentSkills).toBe(10);
    expect(respecCost(1, 20)).toBe(respecCost(0, 20) * 2);
  });
});

describe("CATHODE synergies and effective ranks", () => {
  it("raises a skill's main value by +x% per hard point in its synergy skills", () => {
    let g = must(spendSkill(holder(30, ["ghost"]), "ghost.steadyHands", 5));
    const before = skillValue(g, "ghost.steadyHands");
    expect(before).toBe(mainValue(SKILLS["ghost.steadyHands"]!, 5));
    g = must(spendSkill(g, "ghost.windReader", 10));
    expect(synergyBonus(g, "ghost.steadyHands")).toBe(40);
    expect(skillValue(g, "ghost.steadyHands")).toBeCloseTo(before * 1.4);
  });

  it("adds gear +skills to learned skills only, and +skills don't feed synergies", () => {
    const g = must(spendSkill(holder(30, ["ghost"]), "ghost.steadyHands", 3));
    const totals = sumModifiers([flat("skills.all", 1), flat("skills.tree.longshot", 2), flat("skills.class.butcher", 5)]);
    expect(effectiveRank(g, "ghost.steadyHands", totals)).toBe(6);
    expect(effectiveRank(g, "ghost.heldBreath", totals)).toBe(0);
    expect(skillValue(g, "ghost.steadyHands", totals)).toBe(mainValue(SKILLS["ghost.steadyHands"]!, 6));
  });

  it("aggregates skill modifiers into derived stats", () => {
    const g = must(spendSkill(holder(30, ["ghost"]), "ghost.steadyHands", 10));
    const subject = { level: 30, attributes: { ...CLASS_START_ATTRIBUTES.ghost } };
    const base = deriveStats(subject, [], []);
    const skilled = deriveStats(subject, [], skillModifiers(g));
    const v = skillValue(g, "ghost.steadyHands");
    expect(v).toBe(10 + 3 * 9);
    expect(skilled.gunMultiplier.sniper - base.gunMultiplier.sniper).toBeCloseTo(v / 100);
    expect(skilled.gunMultiplier.rifle).toBeCloseTo(base.gunMultiplier.rifle);
  });

  it("re-caps capped skills after synergies and reports active parameters with cooldown reduction", () => {
    let g = must(spendSkill(holder(30, ["ghost"]), "ghost.heldBreath", 20));
    expect(skillValue(g, "ghost.heldBreath")).toBe(88);
    g = must(spendSkill(g, "ghost.slowTime", 20));
    g = must(spendSkill(g, "ghost.steadyHands"));
    g = must(spendSkill(g, "ghost.windReader"));
    const a = activeSkill(g, "ghost.slowTime", undefined, 0.25)!;
    expect(a.effect.type).toBe("bulletTime");
    expect(a.effect.seconds).toBeCloseTo(2 + 0.15 * 19);
    expect(a.cooldown).toBeCloseTo(15);
    expect(activeSkill(g, "ghost.steadyHands")).toBeNull();
  });
});
