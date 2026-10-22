// C18 "Every gun is a hero" (S2.6): each class's numbers, fire and reload clip events, the shotgun's shell-by-shell
// loading, the patterned recoil.
import { describe, expect, it } from "vitest";
import { ARSENAL, BOLT, ClassReload, HERO_MODELS, PUMP, SHELL, recoilPattern, type ClassMag } from "../games/cathode/src/game/feel/arsenal";
import { eventsBetween, sampleTrack } from "../games/cathode/src/game/feel/clip";

const at = (clip: { events?: [number, string][] }, name: string) => clip.events?.find(([, n]) => n === name)?.[0];

describe("C18 arsenal: the S2.6 table", () => {
  const table: Record<string, [number, number, number, number]> = {
    // ADS ms, tac ms, empty ms, camera pitch deg
    revolver: [200, 2600, 2600, 2.6],
    smg: [220, 1900, 2400, 0.45],
    rifle: [280, 2100, 2700, 0.7],
    shotgun: [240, 450, 450, 4.5],
    sniper: [320, 2800, 3400, 6],
    launcher: [300, 2600, 2600, 5],
  };
  for (const m of HERO_MODELS) {
    it(`${m} carries its S2.6 numbers`, () => {
      const f = ARSENAL[m];
      const [ads, tac, empty, pitch] = table[m]!;
      expect(f.adsMs).toBe(ads);
      expect(f.tacMs).toBe(tac);
      expect(f.emptyMs).toBe(empty);
      expect(f.camPitchDeg).toBe(pitch);
      expect(f.tac.dur).toBe(tac);
      expect(f.empty.dur).toBe(empty);
      // Weight (S2.2 layer 5): heavier than the pistol's 1.0, the launcher heaviest at 2.4.
      expect(f.mass).toBeGreaterThan(1);
      expect(f.mass).toBeLessThanOrEqual(2.4);
      // The muzzle, the port and both grips are on every model.
      for (const p of ["muzzle", "port", "gripR", "gripL"]) expect(f.parts).toContain(p);
    });

    it(`${m}: the fire clip breaks at 0 ms and every track it moves is a part`, () => {
      const f = ARSENAL[m];
      expect(at(f.fire, "fire")).toBe(0);
      for (const name of Object.keys(f.fire.tracks)) if (!["gun", "handR", "hand", "hand2"].includes(name)) expect(f.parts, name).toContain(name);
      // Clip events in time order inside the clip.
      const ts = (f.fire.events ?? []).map(([t]) => t);
      expect([...ts].sort((a, b) => a - b)).toEqual(ts);
      expect(Math.max(...ts)).toBeLessThanOrEqual(f.fire.dur);
    });

    it(`${m}: the reloads seat at 60% and name parts the model has`, () => {
      const f = ARSENAL[m];
      for (const clip of [f.tac, f.empty]) {
        if (m === "shotgun") {
          expect(at(clip, "shellIn")).toBe(SHELL.inAt);
          continue;
        }
        expect(at(clip, "seat")).toBeCloseTo(clip.dur * 0.6, 6);
        expect(at(clip, "reloadStart")).toBe(0);
        for (const name of Object.keys(clip.tracks)) {
          if (["gun", "hand", "hand2", "handR", "arm", "magVis", "rounds", "caseVis"].includes(name)) continue;
          expect(f.parts, `${m} ${name}`).toContain(name);
        }
        // The gun is back at the hip at the end.
        const g = clip.tracks.gun;
        if (g) {
          const end = sampleTrack(g, clip.dur);
          expect(Math.hypot(...end.pos)).toBeLessThan(1e-6);
          expect(Math.hypot(...end.rot)).toBeLessThan(1e-6);
        }
      }
    });
  }

  it("signature beats: the cylinder turns 60° in 90 ms, the SMG bolt cycles 16 mm, the rifle charges on empty", () => {
    const cyl = ARSENAL.revolver.fire.tracks.cylinder!;
    expect(sampleTrack(cyl, 89.9).rot[2]).toBeCloseTo((60 * Math.PI) / 180, 2);
    expect(at(ARSENAL.revolver.fire, "cylinder")).toBe(90);
    for (const e of ["craneOpen", "eject", "loaderIn", "twist", "craneClose"]) expect(at(ARSENAL.revolver.tac, e), e).toBeGreaterThan(0);
    const bolt = ARSENAL.smg.fire.tracks.bolt!;
    expect(Math.max(...[10, 20, 22, 30].map((t) => sampleTrack(bolt, t).pos[2]))).toBeCloseTo(0.016, 4);
    expect(ARSENAL.smg.fire.dur).toBeLessThanOrEqual(75 + 1);
    expect(at(ARSENAL.rifle.empty, "charge")).toBeGreaterThan(ARSENAL.rifle.empty.dur * 0.6);
    expect(at(ARSENAL.rifle.tac, "charge")).toBeUndefined();
  });

  it("the shotgun pumps 70 mm over 380 ms; the sniper's bolt lifts 60° and runs 90 mm in 700 ms", () => {
    const p = ARSENAL.shotgun.fire.tracks.pump!;
    const peak = Math.max(...Array.from({ length: 80 }, (_, i) => sampleTrack(p, i * 10).pos[2]));
    expect(peak).toBeCloseTo(PUMP.m, 4);
    expect(at(ARSENAL.shotgun.fire, "pumpHome")! - at(ARSENAL.shotgun.fire, "pumpBack")!).toBe(380);
    const b = ARSENAL.sniper.fire.tracks.bolt!;
    let lift = 0;
    let back = 0;
    for (let t = 0; t < 1200; t += 5) {
      const sm = sampleTrack(b, t);
      lift = Math.max(lift, sm.rot[2]);
      back = Math.max(back, sm.pos[2]);
    }
    expect(lift).toBeCloseTo((BOLT.liftDeg * Math.PI) / 180, 3);
    expect(back).toBeCloseTo(BOLT.backM, 4);
    expect(at(ARSENAL.sniper.fire, "boltDown")! - at(ARSENAL.sniper.fire, "boltUp")!).toBeLessThan(BOLT.cycleMs);
    expect(at(ARSENAL.sniper.fire, "boltDown")! - BOLT.fromMs).toBe(BOLT.cycleMs);
    // The firing hand leaves the grip for the bolt and comes back.
    expect(sampleTrack(ARSENAL.sniper.fire.tracks.handR!, 500).pos[0]).toBe(1);
    expect(sampleTrack(ARSENAL.sniper.fire.tracks.handR!, ARSENAL.sniper.fire.dur).pos[0]).toBe(0);
  });

  it("the launcher's round is seen going in before the seat, and the tracers are on the SMG and rifle only", () => {
    expect(at(ARSENAL.launcher.tac, "roundIn")!).toBeLessThan(at(ARSENAL.launcher.tac, "seat")!);
    expect(eventsBetween(ARSENAL.launcher.fire, -1, 10)).toContain("backblast");
    for (const m of HERO_MODELS) expect(ARSENAL[m].tracerEvery, m).toBe(m === "smg" || m === "rifle" ? 3 : 0);
    expect(ARSENAL.shotgun.flash.frames).toBe(2);
  });
});

describe("C18 arsenal: reloads", () => {
  const mag = (ammo: number, size: number, reserve = 60): ClassMag => ({ ammo, mag: size, reserve });

  it("a magazine reload moves the rounds at its commit and a cancel before it loses nothing", () => {
    const h = mag(10, 30);
    const r = new ClassReload(ARSENAL.rifle);
    expect(r.start(h)).toBe(true);
    expect(r.kind).toBe("tac");
    r.step(h, 1000);
    expect(r.cancel()).toBe(true);
    expect(h).toEqual(mag(10, 30));
    r.start(h);
    let out = r.step(h, 1259);
    expect(out.commit).toBe(false);
    out = r.step(h, 2);
    expect(out.commit).toBe(true);
    expect(h.ammo).toBe(30);
    expect(h.reserve).toBe(40);
    // After the commit it can't be cancelled.
    expect(r.cancel()).toBe(false);
    out = r.step(h, 2000);
    expect(out.done).toBe(true);
    expect(r.active).toBe(false);
  });

  it("an empty magazine plays the empty reload with its charge", () => {
    const h = mag(0, 30);
    const r = new ClassReload(ARSENAL.smg);
    r.start(h);
    expect(r.kind).toBe("empty");
    const ev: string[] = [];
    for (let i = 0; i < 300; i++) ev.push(...r.step(h, 10).events);
    expect(ev).toContain("magDrop");
    expect(ev).toContain("charge");
    expect(ev.indexOf("seat")).toBeLessThan(ev.indexOf("charge"));
    expect(h.ammo).toBe(30);
  });

  it("the shotgun loads shell by shell, 450 ms each, counted at 300 ms, and a pull between shells keeps them", () => {
    const h = mag(3, 6, 10);
    const r = new ClassReload(ARSENAL.shotgun);
    r.start(h);
    expect(r.kind).toBe("shell");
    expect(r.phase).toBe("open");
    r.step(h, SHELL.openMs);
    expect(r.phase).toBe("shell");
    r.step(h, SHELL.inAt - 1);
    expect(h.ammo).toBe(3);
    r.step(h, 2);
    expect(h.ammo).toBe(4);
    r.step(h, SHELL.shellMs - SHELL.inAt - 1);
    expect(r.phase).toBe("shell");
    r.step(h, SHELL.inAt);
    expect(h.ammo).toBe(5);
    // A trigger pull between shells: the reload ends with the shells it loaded.
    expect(r.cancel()).toBe(true);
    expect(h.ammo).toBe(5);
    expect(h.reserve).toBe(8);
  });

  it("an empty shotgun fills up, closes and racks the pump", () => {
    const h = mag(0, 6, 4);
    const r = new ClassReload(ARSENAL.shotgun);
    r.start(h);
    const ev: string[] = [];
    let done = false;
    for (let i = 0; i < 500 && !done; i++) {
      const o = r.step(h, 16);
      ev.push(...o.events);
      done = o.done;
    }
    expect(done).toBe(true);
    expect(h.ammo).toBe(4);
    expect(h.reserve).toBe(0);
    expect(ev.filter((e) => e === "shellIn").length).toBe(4);
    expect(ev).toContain("pumpBack");
    expect(ev.at(-1)).toBe("pumpHome");
  });

  it("a full gun or an empty reserve starts nothing", () => {
    expect(new ClassReload(ARSENAL.revolver).start(mag(6, 6))).toBe(false);
    expect(new ClassReload(ARSENAL.revolver).start(mag(2, 6, 0))).toBe(false);
  });
});

describe("C18 arsenal: patterned recoil", () => {
  it("the SMG and rifle climb straight for six shots, then drift right", () => {
    for (const m of ["smg", "rifle"] as const) {
      const shots = Array.from({ length: 12 }, (_, i) => recoilPattern(m, i));
      for (let i = 0; i < 6; i++) {
        expect(shots[i]![0]).toBeCloseTo(ARSENAL[m].camPitchDeg, 6);
        expect(Math.abs(shots[i]![1])).toBeLessThan(ARSENAL[m].camPitchDeg * 0.1);
      }
      const yaw6 = shots.slice(0, 6).reduce((a, s) => a + s[1], 0);
      expect(Math.abs(yaw6)).toBeLessThan(0.01);
      for (let i = 6; i < 12; i++) {
        expect(shots[i]![1]).toBeGreaterThan(0);
        expect(shots[i]![0]).toBeLessThan(ARSENAL[m].camPitchDeg);
      }
    }
  });

  it("the other classes kick their S2.6 pitch", () => {
    expect(recoilPattern("sniper", 0)[0]).toBe(6);
    expect(recoilPattern("revolver", 3, 1)[1]).toBeGreaterThan(0);
  });
});
