// C18 "Every gun is a hero" in the Arsenal: each class's fire clip moves its parts and fires its cues, the
// reloads move the rounds at their commit, the shotgun loads shell by shell and a pull ends it, the sniper's
// bolt takes the firing hand, an empty SMG holds its bolt open.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Arsenal } from "../games/cathode/src/game/weapons";
import { ARSENAL, HERO_MODELS } from "../games/cathode/src/game/feel/arsenal";

const IDS: Record<string, string> = { revolver: "oldTestament", smg: "rattlecan", rifle: "corridorAR", shotgun: "fishmonger", sniper: "widowmaker", launcher: "bargainBin" };

function setup(id: string) {
  const a = new Arsenal(new THREE.Scene());
  a.owned.add(id);
  a.equipId(id);
  a.settle();
  const cam = new THREE.PerspectiveCamera(54, 16 / 9, 0.01, 10);
  const pose = (dt: number) => a.pose(dt, { yaw: 0, pitch: 0 }, 0, 0, false, 0, cam, 75);
  const eye = new THREE.Vector3();
  const dir = new THREE.Vector3(0, 0, -1);
  const q = new THREE.Quaternion();
  const tick = (dt: number, trigger = false) => {
    const s = a.update(dt, trigger, eye, dir, q, 1);
    pose(dt);
    return s;
  };
  for (let i = 0; i < 40; i++) tick(1 / 60);
  a.cues.length = 0;
  return { a, pose, tick };
}

describe("C18 the hero guns in hand", () => {
  for (const m of HERO_MODELS) {
    it(`${m}: a pull fires, plays the fire clip's cues and kicks the class's pitch`, () => {
      const { a, tick } = setup(IDS[m]!);
      expect(a.hero?.model).toBe(m);
      const shot = tick(1 / 60, true);
      expect(shot, m).toBeTruthy();
      expect(a.heroKick[0]).toBeCloseTo(ARSENAL[m].camPitchDeg, 6);
      const cues: string[] = [];
      for (let i = 0; i < 90; i++) {
        tick(1 / 60);
        cues.push(...a.cues.splice(0));
      }
      const want = (ARSENAL[m].fire.events ?? []).map(([, n]) => n).filter((n) => n !== "fire");
      for (const n of want) expect(cues, `${m} ${n}`).toContain(n);
      expect(a.heroState.fireMs).toBe(-1);
    });

    it(`${m}: the screenshot stages start a reload, tac and empty (C18 review r2: the single-shot launcher's tac stage didn't)`, () => {
      for (const kind of ["tac", "empty"] as const) {
        const { a } = setup(IDS[m]!);
        a.stageHeroReload(kind, 300);
        expect(a.heroState.reload, `${m} ${kind}`).not.toBeNull();
        expect(a.heroState.reloadMs, `${m} ${kind}`).toBeGreaterThan(0);
      }
    });

    it(`${m}: a reload seats at its commit and leaves the parts at rest`, () => {
      const { a, tick } = setup(IDS[m]!);
      const h = a.held[a.current]!;
      // The single-shot launcher is full at 1: it reloads from empty.
      h.ammo = h.mag > 1 ? 1 : 0;
      a.reload();
      expect(a.cr?.active).toBe(true);
      let t = 0;
      while (a.cr?.active && t < 12) {
        tick(1 / 60);
        t += 1 / 60;
      }
      expect(a.cr?.active).toBe(false);
      expect(h.ammo).toBe(h.mag);
      for (let i = 0; i < 20; i++) tick(1 / 60);
      // Parts home: the mag at its rest, the support hand back on the grip.
      const mag = a.rig.parts.mag;
      if (mag) expect(mag.position.distanceTo(new THREE.Vector3(...(mag.userData.rest.pos as [number, number, number])))).toBeLessThan(1e-6);
      expect(a.heroState.handW).toBe(0);
    });
  }

  it("the revolver's cylinder turns 60° on the shot; the SMG bolt runs 16 mm and stays open on an empty mag", () => {
    const r = setup("oldTestament");
    r.tick(1 / 60, true);
    r.tick(0.04);
    const cyl = r.a.rig.parts.cylinder!;
    expect(Math.abs(cyl.rotation.z)).toBeGreaterThan(0.2);
    const s = setup("rattlecan");
    s.a.held[s.a.current]!.ammo = 1;
    s.a.held[s.a.current]!.reserve = 0;
    s.tick(1 / 60, true);
    for (let i = 0; i < 20; i++) s.tick(1 / 60);
    expect(s.a.rig.parts.bolt!.position.z - (s.a.rig.parts.bolt!.userData.rest.pos[2] as number)).toBeCloseTo(0.016, 4);
  });

  it("the shotgun loads shell by shell and a pull between shells fires with what's in", () => {
    const { a, tick } = setup("fishmonger");
    const h = a.held[a.current]!;
    h.ammo = 2;
    a.reload();
    // Open (260 ms) and one shell (in at 300 ms).
    for (let i = 0; i < 36; i++) tick(1 / 60);
    expect(h.ammo).toBe(3);
    expect(a.cr?.kind).toBe("shell");
    const shot = tick(1 / 60, true);
    expect(a.cr?.active).toBe(false);
    expect(shot).toBeTruthy();
    expect(h.ammo).toBe(2);
  });

  it("the sniper's bolt takes the firing hand off the grip and gives it back", () => {
    const { a, tick } = setup("widowmaker");
    tick(1 / 60, true);
    let peak = 0;
    for (let i = 0; i < 70; i++) {
      tick(1 / 60);
      peak = Math.max(peak, a.heroState.handR);
    }
    expect(peak).toBeGreaterThan(0.95);
    expect(a.heroState.handR).toBe(0);
  });

  it("the SMG's sustained fire climbs six shots then walks right", () => {
    const { a, tick } = setup("rattlecan");
    const yaws: number[] = [];
    for (let i = 0; i < 10; i++) {
      tick(0.08, true);
      yaws.push(a.heroKick[1]);
    }
    expect(yaws.slice(6).every((y) => y > 0)).toBe(true);
  });
});
