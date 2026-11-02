import { describe, expect, it } from "vitest";
import { ENTRIES } from "../games/cathode/src/game/encounters";
import { SECRETS } from "../games/cathode/src/game/secrets";
import { TALKS, bossEdge, choose, hasWeakness, intelHeld, intelLine, optionState, squadsRemoved, talkFor, talksHeld, waypoints } from "../games/cathode/src/sim/talk";

const ghost = { grit: 15, aim: 25, nerve: 25, wire: 15 };
const witch = { grit: 15, aim: 15, nerve: 20, wire: 40 };
const steel = { grit: 15, aim: 15, nerve: 40, wire: 15 };

describe("NIGHT SHIFT talks (plan item 14)", () => {
  it("has one talk per district, each with 2 to 4 choices, and every intel points at something real", () => {
    expect(new Set(TALKS.map((t) => t.district))).toEqual(new Set(["market", "clinic", "plaza", "tower", "vault"]));
    for (const t of TALKS) {
      expect(t.options.length).toBeGreaterThanOrEqual(2);
      expect(t.options.length).toBeLessThanOrEqual(4);
      for (const o of t.options) {
        if (o.intel.kind === "squad") expect(Object.keys(ENTRIES[t.district])).toContain(o.intel.entry);
        if (o.intel.kind === "waypoint") expect(SECRETS.map((s) => s.id)).toContain(o.intel.secret);
        if (o.approach === "pay") expect(o.cost).toBeGreaterThan(0);
        if (o.approach === "press") expect(o.gate?.attr).toBe("nerve");
        if (o.approach === "wire") expect(o.gate?.attr).toBe("wire");
      }
    }
  });

  it("gates Press by Nerve, Wire by Wire and Pay by Scrip", () => {
    const clinic = talkFor("clinic")!;
    const opt = (id: string) => clinic.options.find((o) => o.id === id)!;
    expect(optionState(opt("press"), ghost, 0)).toEqual({ open: false, why: "Nerve 30" });
    expect(optionState(opt("press"), steel, 0).open).toBe(true);
    expect(optionState(opt("wire"), ghost, 0)).toEqual({ open: false, why: "Wire 25" });
    expect(optionState(opt("wire"), witch, 0).open).toBe(true);
    expect(optionState(opt("pay"), ghost, 79)).toEqual({ open: false, why: "80 Scrip" });
    expect(optionState(opt("pay"), ghost, 80).open).toBe(true);
  });

  it("pressing the orderly strikes the ward-door squad off the clinic alarm", () => {
    const r = choose(talkFor("clinic")!, "press", steel, 0, []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const done = [r.record];
    expect(squadsRemoved("clinic", done)).toEqual(["ambushBreach"]);
    expect(squadsRemoved("plaza", done)).toEqual([]);
  });

  it("paying spends Scrip and buys a boss weakness", () => {
    const r = choose(talkFor("clinic")!, "pay", ghost, 200, []);
    expect(r.ok && r.scrip).toBe(120);
    if (!r.ok) return;
    expect(hasWeakness("vane", "no-stitch", [r.record])).toBe(true);
    expect(hasWeakness("pell", "turns-back", [r.record])).toBe(false);
  });

  it("charming the foreman marks a waypoint until the secret is found", () => {
    const r = choose(talkFor("market")!, "charm", ghost, 0, []);
    if (!r.ok) throw new Error(r.why);
    expect(waypoints([r.record])).toEqual(["stash-roof"]);
    expect(waypoints([r.record, "secret:stash-roof"])).toEqual([]);
  });

  it("allows one choice per talk and refuses locked ones", () => {
    const t = talkFor("plaza")!;
    expect(choose(t, "press", ghost, 0, [])).toEqual({ ok: false, why: "Nerve 30" });
    const r = choose(t, "charm", ghost, 0, []);
    if (!r.ok) throw new Error(r.why);
    expect(choose(t, "pay", ghost, 500, [r.record])).toEqual({ ok: false, why: "already talked" });
    expect(intelHeld([r.record])).toEqual([{ kind: "weakness", boss: "pell", effect: "turns-back" }]);
  });
});

describe("alarm squads talked off (plan item 14)", () => {
  it("unlessTalkedOff skips only the struck entry", async () => {
    const { unlessTalkedOff } = await import("../games/cathode/src/game/encounters");
    const done = ["talk:orderly:press"];
    expect(unlessTalkedOff("clinic", "ambushBreach", done, () => 1)).toEqual([]);
    expect(unlessTalkedOff("clinic", "ambushVent", done, () => 2)).toEqual([2]);
    expect(unlessTalkedOff("clinic", "ambushBreach", [], () => 3)).toEqual([3]);
  });
});

describe("boss weaknesses in the fight (plan item 14, session 2)", () => {
  it("no intel, no edge", () => {
    for (const b of ["vane", "pell", "chair", "vault"] as const) expect(bossEdge(b, [])).toEqual({ hpMul: 1, noPatch: false, ventLocked: false, lines: [] });
  });
  it("every weakness a talk can give changes its boss's fight and has Bea say so", () => {
    for (const t of TALKS)
      for (const o of t.options) {
        if (o.intel.kind !== "weakness") continue;
        const e = bossEdge(o.intel.boss, [`talk:${t.id}:${o.id}`]);
        expect(e.lines).toHaveLength(1);
        expect(e.hpMul < 1 || e.noPatch || e.ventLocked).toBe(true);
        // It is that boss's edge only.
        for (const other of ["vane", "pell", "chair", "vault"] as const) if (other !== o.intel.boss) expect(bossEdge(other, [`talk:${t.id}:${o.id}`]).lines).toEqual([]);
      }
  });
  it("the orderly's phone stops Vane's stitch; the security chief's tablet locks the right vent", () => {
    expect(bossEdge("vane", ["talk:orderly:pay"]).noPatch).toBe(true);
    expect(bossEdge("chair", ["talk:secchief:wire"]).ventLocked).toBe(true);
    expect(bossEdge("chair", ["talk:secchief:pay"]).hpMul).toBeCloseTo(0.85);
    expect(bossEdge("vault", ["talk:clerk:wire"]).hpMul).toBeCloseTo(0.75);
  });
  it("the case board's intel cards are the talks held, in district order, with a line for each kind", () => {
    const held = talksHeld(["talk:advance:charm", "talk:foreman:pay"]);
    expect(held.map((h) => h.talk.id)).toEqual(["foreman", "advance"]);
    expect(intelLine(held[0]!.option.intel)).toBe("Marked on the market map.");
    expect(intelLine(held[1]!.option.intel)).toBe("A weakness for the fight.");
    expect(intelLine({ kind: "squad", entry: "alarmVan" })).toBe("One alarm squad won't come.");
  });
});
