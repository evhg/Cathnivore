import { describe, expect, it } from "vitest";
import { buildDistrict } from "../games/cathode/src/render/levels/index";
import {
  DUCK_S,
  RETURN_AFTER_S,
  hearShot,
  initialState,
  pickExit,
  stepStreet,
  streetLife,
  visible,
  type AgentState,
  type StreetPlan,
} from "../games/cathode/src/sim/streetlife";

const run = (plan: StreetPlan, st: AgentState[], seconds: number, quietAt: () => number) => {
  for (let t = 0; t < seconds; t += 0.05) stepStreet(plan, st, 0.05, quietAt());
};

describe("NIGHT SHIFT street life (plan item 57)", () => {
  it("is deterministic per district and tier, and phones get about half the walkers", () => {
    for (const d of ["market", "plaza"]) {
      const hi = streetLife(d, "high");
      expect(streetLife(d, "high")).toEqual(hi);
      expect(streetLife(d, "ultra").agents.length).toBe(hi.agents.length);
      const ph = streetLife(d, "phone");
      const walkers = (p: StreetPlan) => p.agents.filter((a) => a.role === "walker").length;
      expect(walkers(ph)).toBeLessThanOrEqual(Math.ceil(walkers(hi) * 0.6));
      expect(walkers(ph)).toBeGreaterThanOrEqual(Math.floor(walkers(hi) * 0.4));
    }
    const m = streetLife("market", "high");
    expect(m.agents.length).toBe(40);
    expect(streetLife("market", "phone").agents.length).toBe(25);
    for (const role of ["walker", "vendor", "shelter", "shopper", "cyclist", "courier"]) expect(m.agents.some((a) => a.role === role)).toBe(true);
    // Indoors, no street.
    expect(streetLife("clinic", "high").agents).toEqual([]);
    expect(streetLife("office", "high").agents).toEqual([]);
  });

  it.each(["market", "plaza"])("%s: nobody stands or walks inside a wall, counter, car or crate", (d) => {
    const level = buildDistrict(d, "high");
    const inside = (x: number, z: number) => level.builder.colliders.some((b) => b.min.y < 1.5 && b.max.y > 0.2 && x > b.min.x - 0.2 && x < b.max.x + 0.2 && z > b.min.z - 0.2 && z < b.max.z + 0.2);
    for (const a of streetLife(d, "high").agents)
      for (let seg = 0; seg < Math.max(1, a.path.length - 1); seg++) {
      const L = a.path.length > 1 ? 24 : 1;
      const [x0, z0] = a.path[seg]!;
      const [x1, z1] = a.path[Math.min(seg + 1, a.path.length - 1)]!;
      for (let k = 0; k < L; k++) {
        const t = L > 1 ? k / (L - 1) : 0;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        expect(inside(x, z), `${a.role} ${a.id} at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(false);
      }
    }
  });

  it("walkers walk; standers stand", () => {
    const plan = streetLife("market", "high");
    const st = plan.agents.map(initialState);
    const before = st.map((s) => [s.x, s.z, s.s]);
    run(plan, st, 2, () => 999);
    plan.agents.forEach((a, i) => {
      const moved = Math.hypot(st[i]!.x - before[i]![0]!, st[i]!.z - before[i]![1]!);
      if (a.path.length > 1) {
        expect(st[i]!.s - before[i]![2]!).toBeCloseTo(a.speed * 2, 0);
        expect(moved).toBeGreaterThan(0.05);
      } else expect(moved).toBe(0);
    });
  });

  it("calm -> duck -> flee -> gone -> return -> calm, on a fake clock", () => {
    const plan = streetLife("market", "high");
    const st = plan.agents.map(initialState);
    const i = plan.agents.findIndex((a) => a.role === "shopper");
    const me = st[i]!;
    // A shot 40 m away: nothing. A shot 10 m away: duck.
    expect(hearShot(plan, st, me.x, me.z - 40)).toBeGreaterThanOrEqual(0);
    expect(me.mood).toBe("calm");
    const shotAt = { x: me.x + 2, z: me.z - 10 };
    let clock = 0;
    let lastShot = 0;
    hearShot(plan, st, shotAt.x, shotAt.z);
    expect(me.mood).toBe("duck");
    const step = (s: number) => {
      for (let t = 0; t < s; t += 0.05) {
        clock += 0.05;
        stepStreet(plan, st, 0.05, clock - lastShot);
      }
    };
    step(DUCK_S * 0.5);
    expect(me.mood).toBe("duck");
    step(DUCK_S);
    expect(me.mood).toBe("flee");
    const d0 = Math.hypot(me.x - shotAt.x, me.z - shotAt.z);
    step(1);
    expect(Math.hypot(me.x - shotAt.x, me.z - shotAt.z)).toBeGreaterThan(d0);
    step(20);
    expect(me.mood).toBe("gone");
    expect(visible(me)).toBe(false);
    // Another shot keeps them away: the clock of quiet restarts.
    lastShot = clock;
    step(RETURN_AFTER_S - 5);
    expect(me.mood).toBe("gone");
    step(6);
    expect(me.mood).toBe("return");
    step(40);
    expect(me.mood).toBe("calm");
    expect(Math.hypot(me.x - plan.agents[i]!.path[0]![0], me.z - plan.agents[i]!.path[0]![1])).toBeLessThan(0.01);
  });

  it("vendors drop behind the counter and stay there until it's quiet; a suppressed shot is heard only up close", () => {
    const plan = streetLife("market", "high");
    const st = plan.agents.map(initialState);
    const v = plan.agents.findIndex((a) => a.role === "vendor");
    hearShot(plan, st, st[v]!.x - 12, st[v]!.z, true);
    expect(st[v]!.mood).toBe("calm");
    hearShot(plan, st, st[v]!.x - 5, st[v]!.z, true);
    expect(st[v]!.mood).toBe("duck");
    const x = st[v]!.x;
    run(plan, st, 10, () => 10);
    expect(st[v]!.mood).toBe("duck");
    expect(st[v]!.x).toBe(x);
    run(plan, st, 0.1, () => RETURN_AFTER_S);
    expect(st[v]!.mood).toBe("calm");
  });

  it("runs away from the shooter, never past him", () => {
    const exits: Array<[number, number]> = [[0, 50], [0, -50]];
    // Shooter north of her: she runs south even though the north exit is nearer.
    expect(pickExit(0, 10, [0, 20], exits)).toBe(1);
    expect(pickExit(0, -10, [0, -20], exits)).toBe(0);
  });

  it("a shot in the market's first view scatters the people round the spawn: their mean distance rises", () => {
    const plan = streetLife("market", "high");
    const st = plan.agents.map(initialState);
    const cath = { x: -2.5, z: 57 };
    const near = st.map((s, i) => ({ s, i })).filter(({ s }) => Math.hypot(s.x - cath.x, s.z - cath.z) < 30);
    expect(near.length).toBeGreaterThanOrEqual(8);
    const mean = () => near.reduce((n, { s }) => n + Math.hypot(s.x - cath.x, s.z - cath.z), 0) / near.length;
    const m0 = mean();
    hearShot(plan, st, cath.x, cath.z);
    run(plan, st, 3, () => 3);
    expect(mean()).toBeGreaterThan(m0);
  });
});
