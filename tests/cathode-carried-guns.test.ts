import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildGunDisplay } from "../games/cathode/src/game/viewmodel";

// Plan item 362: the gun she carries on the pick is the gun on the inspect. The case table and the rack shoot
// `buildGunDisplay` (render/gunportrait.ts); the figure's carried and slung guns must build from the same source, not a
// second hand-built kit. frontcath.ts needs WebGL to run, so this reads its source for the calls, and checks the
// models themselves have the parts a silhouette reads by.
const src = readFileSync("games/cathode/src/render/frontcath.ts", "utf8");

describe("the carried guns are the inspect's models", () => {
  for (const model of ["sniper", "shotgun", "revolver"] as const) {
    it(`frontcath builds the ${model} from buildGunDisplay`, () => {
      expect(src).toMatch(new RegExp(`buildGunDisplay\\("${model}", phone\\)`));
    });
  }

  it("the portrait studio shoots the same builder", () => {
    expect(readFileSync("games/cathode/src/render/gunportrait.ts", "utf8")).toContain("buildGunDisplay(model)");
  });

  it("no hand-built gun stands in for them any more", () => {
    // the old stand-ins: a scope tube, a suppressor, a magazine tube merged from rods
    expect(src).not.toMatch(/\/\/ the scope tube|\/\/ the suppressor|\/\/ the magazine tube/);
  });

  it("each model has three or more distinct parts, and the shotgun a pump that can rack", () => {
    for (const model of ["sniper", "shotgun", "revolver"] as const) {
      let meshes = 0;
      buildGunDisplay(model).traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes++;
      });
      expect(meshes, model).toBeGreaterThanOrEqual(3);
    }
    expect(buildGunDisplay("shotgun").getObjectByName("pump")).toBeTruthy();
  });
});
