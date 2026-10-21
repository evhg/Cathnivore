import * as THREE from "three";
import { RayWorld } from "../games/cathode/src/game/ray";
import { ENFORCER, Enemy, type Sight } from "../games/cathode/src/game/enemy";
import { Director } from "../games/cathode/src/game/ai/director";
import type { CoverPoint } from "../games/cathode/src/game/ai/cover";
import { describe, expect, it } from "vitest";
import {
  BarkGate,
  Squad,
  TOKENS,
  barkDuration,
  barkLine,
  coverAngle,
  hitChance,
  isFlanked,
  isWarningRound,
  makeMember,
  missDistance,
  protectionFrom,
  rampAccuracy,
  scoreCover,
  SUPPRESS_CAP,
} from "../games/cathode/src/game/ai/squad";
import { makeMorale, moraleAccuracy, moraleBand, moraleEvent, MORALE_DELTA } from "../games/cathode/src/sim/morale";
import { createRng } from "../games/cathode/src/sim/rng";
import type { Difficulty } from "../games/cathode/src/sim/types";

const cath = { x: 0, z: 0 };

function squadOf(d: Difficulty, n: number, seed = 7): Squad {
  const rng = createRng(seed);
  const s = new Squad(d, () => rng.next());
  for (let i = 0; i < n; i++) s.add(makeMember(i + 1, { x: -8 + i * 3, z: -14 - (i % 2) * 2 }, { leader: i === 0 }));
  return s;
}

describe("CATHODE squad (S11): attack tokens", () => {
  for (const d of ["noir", "hardboiled", "hellWeek"] as const) {
    it(`${d}: never more than ${TOKENS[d]} holders, whatever the squad sees`, () => {
      const s = squadOf(d, 6);
      let peak = 0;
      for (let f = 0; f < 60 * 30; f++) {
        for (const m of s.members) m.los = (f + m.id * 37) % 300 < 220;
        s.tick(1 / 60, cath);
        const held = s.members.filter((m) => m.token).length;
        peak = Math.max(peak, held);
        expect(held).toBeLessThanOrEqual(TOKENS[d]);
      }
      expect(peak).toBe(TOKENS[d]);
    });
  }

  it("a token passes on after 2.5 to 4 s of holding, and at once on a lost line of sight", () => {
    const s = squadOf("noir", 4);
    for (const m of s.members) m.los = true;
    const held = new Map<number, number>();
    const spans: number[] = [];
    for (let f = 0; f < 60 * 20; f++) {
      s.tick(1 / 60, cath);
      for (const m of s.members) {
        if (m.token) held.set(m.id, (held.get(m.id) ?? 0) + 1 / 60);
        else if (held.has(m.id)) {
          spans.push(held.get(m.id)!);
          held.delete(m.id);
        }
      }
    }
    expect(spans.length).toBeGreaterThan(3);
    for (const t of spans) {
      expect(t).toBeGreaterThanOrEqual(2.5 - 0.02);
      expect(t).toBeLessThanOrEqual(4 + 0.05);
    }
    const holder = s.members.find((m) => m.token)!;
    holder.los = false;
    s.tick(1 / 60, cath);
    expect(holder.token).toBe(false);
  });
});

describe("CATHODE squad (S11): roles", () => {
  it("one flanker at most, never the leader while others can go, and one suppressor with sight", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = squadOf("hardboiled", 5, seed);
      for (let f = 0; f < 60 * 40; f++) {
        for (const m of s.members) m.los = (f + m.id * 53 + seed) % 400 < 260;
        if (f % 600 === 300) s.members[f % 5]!.alive = false;
        s.tick(1 / 60, cath);
        const flankers = s.members.filter((m) => m.alive && m.role === "flank");
        expect(flankers.length).toBeLessThanOrEqual(1);
        if (s.alive.length > 1 && flankers[0]) expect(flankers[0].leader && s.alive.some((m) => m !== flankers[0] && !m.leader && m.canFlank !== false)).toBe(false);
        expect(s.members.filter((m) => m.alive && m.role === "suppress").length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("someone flanks once she's been seen, and a squad that lost her for 5 s advances", () => {
    const s = squadOf("noir", 3);
    for (const m of s.members) m.los = true;
    for (let f = 0; f < 120; f++) s.tick(1 / 60, cath);
    expect(s.members.some((m) => m.role === "flank")).toBe(true);
    expect(s.members.some((m) => m.role === "suppress")).toBe(true);
    for (const m of s.members) m.los = false;
    for (let f = 0; f < 60 * 6.6; f++) s.tick(1 / 60, cath);
    expect(s.members.filter((m) => m.role === "advance").length).toBeGreaterThanOrEqual(1);
  });

  it("a flanker who never gets round gives up after 9 s and the next waits", () => {
    const s = squadOf("noir", 3);
    for (const m of s.members) m.los = true;
    for (let f = 0; f < 60 * 2; f++) s.tick(1 / 60, cath);
    const first = s.members.find((m) => m.role === "flank")!;
    for (let f = 0; f < 60 * 9.5; f++) s.tick(1 / 60, cath);
    expect(first.role === "flank" && first.flankT > 9.6).toBe(false);
  });
});

describe("CATHODE squad (S3.5): accuracy ramp and warning rounds", () => {
  it("ramps 20% to 70% over 1.2 s of sight and resets to 20%", () => {
    expect(rampAccuracy(0)).toBeCloseTo(0.2, 5);
    expect(rampAccuracy(0.6)).toBeCloseTo(0.45, 5);
    expect(rampAccuracy(1.2)).toBeCloseTo(0.7, 5);
    expect(rampAccuracy(9)).toBeCloseTo(0.7, 5);
    expect(hitChance({ round: 2, losT: 0, token: true, role: "hold", difficulty: "noir" })).toBeCloseTo(0.2, 5);
  });

  it("the first two rounds of every burst miss, landing 0.4 to 1.0 m off", () => {
    const rng = createRng(3);
    for (let r = 0; r < 6; r++) {
      const p = hitChance({ round: r, losT: 5, token: true, role: "hold", difficulty: "hellWeek" });
      if (r < 2) expect(p).toBe(0);
      else expect(p).toBeCloseTo(0.7, 5);
      expect(isWarningRound(r)).toBe(r < 2);
    }
    for (let i = 0; i < 500; i++) {
      const m = missDistance(() => rng.next(), true);
      expect(m).toBeGreaterThanOrEqual(0.4);
      expect(m).toBeLessThanOrEqual(1.0);
    }
  });

  it("without a token the suppressor is capped at 8% to 25%", () => {
    for (const d of ["noir", "hardboiled", "hellWeek"] as const) {
      const p = hitChance({ round: 4, losT: 9, token: false, role: "suppress", difficulty: d });
      expect(p).toBe(SUPPRESS_CAP[d]);
      expect(p).toBeGreaterThanOrEqual(0.08);
      expect(p).toBeLessThanOrEqual(0.25);
    }
  });
});

describe("CATHODE squad (S11): flanked", () => {
  const facing = { x: 0, z: 1 };
  it("flanked above 70 degrees off the cover's facing, not below", () => {
    const from = { x: 0, z: 0 };
    expect(isFlanked(facing, from, { x: 0, z: 10 })).toBe(false);
    expect(isFlanked(facing, from, { x: Math.tan((65 * Math.PI) / 180) * 10, z: 10 })).toBe(false);
    expect(isFlanked(facing, from, { x: Math.tan((75 * Math.PI) / 180) * 10, z: 10 })).toBe(true);
    expect(coverAngle(facing, from, { x: 10, z: 0 })).toBeCloseTo(90, 5);
    expect(protectionFrom(0.9, facing, from, { x: 10, z: 1 })).toBe(0);
    expect(protectionFrom(0.9, facing, from, { x: 0, z: 10 })).toBeCloseTo(0.9, 5);
  });

  it("cover scoring prefers protected points in the 8-20 m band, away from allies", () => {
    const good = scoreCover({ protection: 0.9, distance: 12, crowd: 6, exposure: 0 });
    expect(good).toBeGreaterThan(scoreCover({ protection: 0.4, distance: 12, crowd: 6, exposure: 0 }));
    expect(good).toBeGreaterThan(scoreCover({ protection: 0.9, distance: 3, crowd: 6, exposure: 0 }));
    expect(good).toBeGreaterThan(scoreCover({ protection: 0.9, distance: 12, crowd: 0.5, exposure: 0 }));
    expect(good).toBeLessThan(scoreCover({ protection: 0.9, distance: 12, crowd: 6, exposure: 0, flank: 1 }));
  });
});

describe("CATHODE morale (S11)", () => {
  it("applies the table, clamps to 0..1 and bands at 0.3 and 0.1", () => {
    const m = makeMorale();
    expect(moraleEvent(m, "allyDied")).toBeCloseTo(1 + MORALE_DELTA.allyDied, 5);
    expect(moraleEvent(m, "leaderDied")).toBeCloseTo(0.35, 5);
    expect(moraleBand(m, false)).toBe("steady");
    moraleEvent(m, "lowHp");
    expect(m.value).toBeCloseTo(0.05, 5);
    expect(moraleBand(m, false)).toBe("fallback");
    expect(moraleAccuracy(m)).toBe(0.5);
    expect(moraleBand(m, true)).toBe("broken");
    moraleEvent(m, "lowHp");
    expect(m.value).toBeCloseTo(0.05, 5);
    moraleEvent(m, "coverSecond", 3);
    expect(m.value).toBeCloseTo(0.35, 5);
    moraleEvent(m, "takedownSeen");
    expect(m.value).toBeCloseTo(0, 5);
    moraleEvent(m, "coverSecond", 50);
    expect(m.value).toBe(1);
  });

  it("machines never break", () => {
    const m = makeMorale(false);
    moraleEvent(m, "leaderDied");
    moraleEvent(m, "takedownSeen");
    expect(m.value).toBe(1);
    expect(moraleBand(m, true)).toBe("steady");
  });
});

describe("CATHODE barks (S10)", () => {
  it("'Reloading!' always barks, through any rate limit", () => {
    const g = new BarkGate();
    expect(g.ask(1, "contact", barkDuration("Contact!"))).toBe(true);
    for (let i = 0; i < 20; i++) {
      expect(g.ask(1, "reload", barkDuration("Reloading!"))).toBe(true);
      expect(g.ask(2, "reload", barkDuration("Reloading!"))).toBe(true);
      g.tick(0.05);
    }
    expect(barkLine("reload", Math.random)).toBe("Reloading!");
  });

  it("one per man per 4 s, one on the squad's radio with 1.2 s after it", () => {
    const g = new BarkGate();
    const dur = barkDuration("Taking fire!");
    expect(g.ask(1, "suppressed", dur)).toBe(true);
    expect(g.ask(2, "contact", dur)).toBe(false);
    g.tick(dur + 1.21);
    expect(g.ask(2, "contact", dur)).toBe(true);
    g.tick(dur + 1.21);
    expect(g.ask(1, "suppressed", dur)).toBe(dur + 1.21 + dur + 1.21 >= 4);
    expect(g.ask(3, "manDown", 1)).toBe(true);
  });

  it("fills the dead man's name and the side", () => {
    expect(barkLine("manDown", () => 0.99, { name: "Harker" })).toBe("We lost Harker!");
    expect(barkLine("manDown", () => 0.99)).toBe("Man down!");
    expect(barkLine("flank", () => 0, { side: "right" })).toBe("She's flanking right!");
  });
});

// ---- C16: the tactics, end to end on a crate in an empty street ----

describe("CATHODE tactics (S11, S3.5) in a street", () => {
  it("a rifleman runs to the crate, peeks over it, fires warning rounds first, reloads out loud and moves when flanked", () => {
    const rnd = createRng(11);
    const orig = Math.random;
    Math.random = () => rnd.next();
    try {
      // A 1.15 m crate between him (z = -14) and Cath (z = 0).
      const crate = new THREE.Box3(new THREE.Vector3(-0.75, 0, -11.4), new THREE.Vector3(0.75, 1.15, -10.6));
      const colliders = [crate];
      const rays = new RayWorld(colliders);
      const cover: CoverPoint[] = [
        { x: 0, y: 0, z: -11.9, fx: 0, fz: 1, kind: "crouch", prot: 0.9, lean: 0 },
        { x: -1.25, y: 0, z: -11, fx: 1, fz: 0, kind: "crouch", prot: 0.9, lean: 0 },
      ];
      const e = new Enemy({ ...ENFORCER }, [new THREE.Vector3(1.5, 0, -15)], 1);
      e.motion.yaw = 0;
      const d = new Director("hardboiled");
      d.cover = cover;
      // A second man well back in the open, who keeps eyes on her.
      const spotter = new Enemy({ ...ENFORCER }, [new THREE.Vector3(16, 0, -26)], 1);
      spotter.motion.yaw = -0.6;
      d.form([e, spotter]);
      expect(e.tac).not.toBeNull();
      const cath = new THREE.Vector3(0, 0, 0);
      const sight = (): Sight => ({ eye: cath.clone().setY(1.6), chest: cath.clone().setY(1.25), light: 1, low: 0, speed: 0, stealth: 1 });
      const acts = new Set<string>();
      const barks: string[] = [];
      let warn = 0;
      let firstRoundsWide = true;
      let rounds = 0;
      let mags = 0;
      let flankedEv = 0;
      for (let f = 0; f < 30 * 40; f++) {
        if (f === 30 * 30) cath.set(9, 0, -11); // she comes round his side
        d.update(1 / 30, sight().chest);
        e.update(1 / 30, sight(), rays, colliders, () => 0);
        spotter.update(1 / 30, sight(), rays, colliders, () => 0);
        d.drain([e, spotter], (en, ev) => {
          if (ev.kind === "flanked") flankedEv++;
          if (ev.kind !== "magOut") return;
          en.dropMag();
          mags++;
        });
        spotter.shots.length = 0;
        for (const s of e.shots) {
          if (rounds < 2 && !s.warning) firstRoundsWide = false;
          if (s.warning) warn++;
          rounds++;
        }
        for (const b of d.barks) barks.push(b.line);
        d.barks.length = 0;
        acts.add(e.tac!.act);
      }
      expect(acts.has("move")).toBe(true);
      expect(acts.has("hide")).toBe(true);
      expect(acts.has("peek")).toBe(true);
      expect(rounds).toBeGreaterThan(10);
      expect(firstRoundsWide).toBe(true);
      expect(warn).toBeGreaterThanOrEqual(2);
      expect(barks).toContain("Reloading!");
      expect(mags).toBeGreaterThan(0);
      // Flanked: he left the crate's front point for the one facing her.
      expect(e.tac!.cover?.x).toBe(-1.25);
      expect(flankedEv).toBeGreaterThan(0);
    } finally {
      Math.random = orig;
    }
  });
});
