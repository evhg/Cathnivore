import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SECRETS, Secrets, found, secretKey } from "../games/cathode/src/game/secrets";

describe("quay secrets", () => {
  it("has unique ids and a payload for each kind", () => {
    expect(new Set(SECRETS.map((s) => s.id)).size).toBe(SECRETS.length);
    for (const s of SECRETS) expect(s.kind === "log" ? !!s.text : (s.scrip ?? 0) > 0).toBe(true);
  });

  it("collects once when walked over and records it", () => {
    const done: string[] = [];
    const sec = new Secrets(done, () => 0);
    const s = SECRETS[0]!;
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
});
