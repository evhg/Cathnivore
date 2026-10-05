import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SLICE_WEAPONS } from "../games/cathode/src/game/weapons";
import { SECRETS, Secrets, found, secretKey } from "../games/cathode/src/game/secrets";

describe("quay secrets", () => {
  it("has unique ids and a payload for each kind", () => {
    expect(new Set(SECRETS.map((s) => s.id)).size).toBe(SECRETS.length);
    for (const s of SECRETS) {
      if (s.kind === "log") expect(s.text).toBeTruthy();
      else if (s.kind === "stash") expect(s.scrip ?? 0).toBeGreaterThan(0);
      else expect(SLICE_WEAPONS.some((w) => w.id === s.weapon)).toBe(true);
    }
  });

  it("collects once when walked over and records it", () => {
    const done: string[] = [];
    const sec = new Secrets(done, () => 0);
    const s = SECRETS[0]!;
    done.push("fishMarket");
    expect(sec.update(0.1, new THREE.Vector3(s.x + 30, 0, s.z))).toHaveLength(0);
    expect(sec.update(0.1, new THREE.Vector3(s.x, 0, s.z))).toHaveLength(1);
    expect(done).toContain(secretKey(s.id));
    expect(sec.update(0.1, new THREE.Vector3(s.x, 0, s.z))).toHaveLength(0);
    expect(found(done)).toBe(1);
  });

  it("skips ones already in the save", () => {
    const done = SECRETS.map((s) => secretKey(s.id));
    expect(new Secrets(done, () => 0).remaining()).toHaveLength(0);
  });

  it("weapon caches stay shut until the first job is done", () => {
    const done: string[] = [];
    const sec = new Secrets(done, () => 0);
    const c = SECRETS.find((x) => x.kind === "cache")!;
    expect(sec.update(0.1, new THREE.Vector3(c.x, 0, c.z))).toHaveLength(0);
    done.push("fishMarket");
    expect(sec.update(0.1, new THREE.Vector3(c.x, 0, c.z))[0]?.weapon).toBe(c.weapon);
  });
});
