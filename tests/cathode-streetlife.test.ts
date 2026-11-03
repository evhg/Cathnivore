import { describe, expect, it } from "vitest";
import { buildDistrict } from "../games/cathode/src/render/levels/index";
import * as THREE from "three";
import { crowdStanders } from "../games/cathode/src/render/crowd";
import { RIM_DRIPS, wetLayout, type WetPerson } from "../games/cathode/src/render/streetwet";
import {
  DUCK_S,
  RETURN_AFTER_S,
  hearShot,
  initialState,
  pickExit,
  standerPlan,
  stepStreet,
  streetExits,
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

  it("the Plaza rally's standers scatter too: duck, run for the square's exits, come back a minute after", () => {
    const level = buildDistrict("plaza", "high");
    const standers = crowdStanders(level.crowds ?? []);
    expect(standers.length).toBeGreaterThan(20);
    const exits = streetExits("plaza");
    expect(exits.length).toBeGreaterThan(3);
    const plan = standerPlan(standers, exits);
    expect(standerPlan(standers, exits)).toEqual(plan);
    const st = plan.agents.map(initialState);
    // A shot in the middle of the rally (plaza.ts packs 70 below the steps round (0, -16)): everyone in earshot ducks.
    const [cx, cz] = [0, -16];
    const heard = hearShot(plan, st, cx, cz);
    expect(heard).toBeGreaterThanOrEqual(70);
    expect(heard).toBe(standers.filter((s) => Math.hypot(s.x - cx, s.z - cz) <= 30).length);
    const ran = st.filter((s) => s.mood === "duck");
    const spread = () => ran.reduce((n, s) => n + Math.hypot(s.x - cx, s.z - cz), 0) / ran.length;
    const s0 = spread();
    let quiet = 0;
    run(plan, st, 3, () => (quiet += 0.05));
    expect(spread()).toBeGreaterThan(s0 + 3);
    run(plan, st, 30, () => (quiet += 0.05));
    expect(ran.every((s) => s.mood === "gone")).toBe(true);
    // Past a minute of quiet they walk back to where they stood.
    run(plan, st, 120, () => (quiet += 0.05));
    expect(st.every((s) => s.mood === "calm")).toBe(true);
    st.forEach((s, i) => expect(Math.hypot(s.x - standers[i]!.x, s.z - standers[i]!.z)).toBeLessThan(0.01));
  });
});

describe("NIGHT SHIFT rain on the street's people (plan item 57)", () => {
  const person = (over: Partial<WetPerson> = {}): WetPerson => ({ x: 2, z: 3, y: 0, yaw: 0, body: new THREE.Matrix4().makeTranslation(2, 0, 3), umbrella: true, gait: null, seed: 0.37, ...over });
  it("drips fall from the umbrella's rim and land as a crown on the ground", () => {
    const out = new Float32Array(400);
    let streaks = 0;
    let crowns = 0;
    for (let t = 0; t < 3; t += 0.02) {
      const n = wetLayout([person()], t, out);
      expect(n).toBeLessThanOrEqual(RIM_DRIPS);
      for (let i = 0; i < n; i++) {
        const [x, y, z, w] = [out[i * 4]!, out[i * 4 + 1]!, out[i * 4 + 2]!, out[i * 4 + 3]!];
        expect(Math.hypot(x - 2.08, z - 3)).toBeCloseTo(0.53, 2);
        if (w < 1) {
          streaks++;
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(1.95);
        } else {
          crowns++;
          expect(y).toBe(0);
          expect(w).toBeLessThan(2);
        }
      }
    }
    expect(streaks).toBeGreaterThan(50);
    expect(crowns).toBeGreaterThan(20);
    expect(wetLayout([person()], 1.234, out)).toBe(wetLayout([person()], 1.234, new Float32Array(400)));
  });
  it("footsteps splash left and right in turn; no umbrella, no drips; hidden people, nothing", () => {
    const out = new Float32Array(400);
    const sides = new Set<number>();
    for (let g = 0; g < Math.PI * 4; g += 0.1) {
      const n = wetLayout([person({ umbrella: false, gait: g })], 0, out);
      for (let i = 0; i < n; i++) {
        expect(out[i * 4 + 3]).toBeGreaterThanOrEqual(1);
        sides.add(Math.sign(out[i * 4 + 2]! - 3));
      }
    }
    expect([...sides].sort()).toEqual([-1, 1]);
    expect(wetLayout([person({ umbrella: false })], 0.5, out)).toBe(0);
    expect(wetLayout([person({ body: null, gait: 1 })], 0.5, out)).toBe(0);
  });
});
