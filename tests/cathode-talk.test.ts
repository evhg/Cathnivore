import { describe, expect, it } from "vitest";
import { ENTRIES } from "../games/cathode/src/game/encounters";
import { SECRETS } from "../games/cathode/src/game/secrets";
import { TALKS, choose, hasWeakness, intelHeld, optionState, squadsRemoved, talkFor, waypoints } from "../games/cathode/src/sim/talk";

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
