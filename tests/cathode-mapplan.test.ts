import { describe, expect, it } from "vitest";
import { buildDistrict } from "../games/cathode/src/render/levels/index";
import { LANDMARKS } from "../games/cathode/src/game/landmarks";
import { SECRETS, secretKey } from "../games/cathode/src/game/secrets";
import { mapPlan, overlaps, type Plan } from "../games/cathode/src/ui/mapplan";

// Plan item 12: the district map is a drawn plan whose labels never overlap and never leave the sheet.

const ALL_JOBS = ["crispBoss", "vaneBoss", "pellBoss", "boardBoss", "vaultBoss", ...SECRETS.map((s) => secretKey(s.id))];
const SAVES: Record<string, readonly string[]> = { fresh: [], mid: ["crispBoss", "vaneBoss", secretKey("log-bea1")], late: ALL_JOBS };

function check(p: Plan): string[] {
  const bad: string[] = [];
  const s = p.sheet;
  for (const [i, a] of p.labels.entries()) {
    if (a.box.x0 < s.x0 || a.box.x1 > s.x1 || a.box.z0 < s.z0 || a.box.z1 > s.z1) bad.push(`${a.text} leaves the sheet`);
    for (const b of p.labels.slice(i + 1)) if (overlaps(a.box, b.box)) bad.push(`${a.text} overlaps ${b.text}`);
  }
  return bad;
}

describe("district map plan", () => {
  for (const id of ["market", "clinic", "plaza", "tower", "vault"]) {
    const colliders = buildDistrict(id, "phone").builder.colliders;
    for (const [save, jobs] of Object.entries(SAVES)) {
      it(`${id}, ${save} save: labels clear of each other, inside the sheet, solids inked`, () => {
        const p = mapPlan({ district: id, at: { x: 0, z: 40 }, objective: { x: 2, z: -20 }, jobsDone: jobs, colliders });
        expect(check(p)).toEqual([]);
        expect(p.solids.length).toBeGreaterThan(10);
        expect(p.labels.some((l) => l.kind === "goal")).toBe(true);
        expect(p.labels.some((l) => l.kind === "cath")).toBe(true);
      });
    }
  }
  it("crosses the secret a talk pointed her to until she takes it (plan item 14)", () => {
    const colliders = buildDistrict("market", "phone").builder.colliders;
    for (const opt of ["press", "charm", "pay"]) {
      const told = mapPlan({ district: "market", at: { x: 0, z: 57 }, objective: null, jobsDone: [`talk:foreman:${opt}`], colliders });
      expect(told.tips).toHaveLength(1);
      expect(told.labels.filter((l) => l.kind === "tip")).toHaveLength(1);
      expect(check(told)).toEqual([]);
    }
    const taken = mapPlan({ district: "market", at: { x: 0, z: 57 }, objective: null, jobsDone: ["talk:foreman:charm", secretKey("stash-roof")], colliders });
    expect(taken.tips).toHaveLength(0);
  });
  it("names every market landmark she can see, and marks the secrets she found", () => {
    const colliders = buildDistrict("market", "phone").builder.colliders;
    const fresh = mapPlan({ district: "market", at: { x: 0, z: 57 }, objective: null, jobsDone: [], colliders });
    const names = fresh.labels.map((l) => l.text);
    for (const l of LANDMARKS.filter((x) => !x.needs)) expect(names).toContain(l.name);
    expect(names).not.toContain("Dry fountain");
    expect(fresh.secrets).toEqual([]);
    expect(names.filter((n) => n.includes("hidden")).length).toBeGreaterThan(2);
    const late = mapPlan({ district: "market", at: { x: 0, z: 57 }, objective: null, jobsDone: ALL_JOBS, colliders });
    expect(late.secrets.length).toBe(SECRETS.length);
    for (const l of LANDMARKS) expect(late.labels.map((x) => x.text)).toContain(l.name);
    expect(late.labels.some((l) => l.text.includes("hidden"))).toBe(false);
  });
  it("names every room in an interior", () => {
    const colliders = buildDistrict("clinic", "phone").builder.colliders;
    const p = mapPlan({ district: "clinic", at: { x: 0, z: 40 }, objective: null, jobsDone: [], colliders });
    for (const n of ["Waiting room", "Wards", "Flooded morgue", "Theatre", "Way out"]) expect(p.labels.map((l) => l.text)).toContain(n);
  });
});
