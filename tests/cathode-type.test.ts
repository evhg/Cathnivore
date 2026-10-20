import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATHODE_MAX_FAMILIES, cssTypeProblems, familiesIn, lintCathodeCss } from "../scripts/font-budget";

// C13T "Type and UI that look like a AAA game" (docs/design/cathode-combat.md): two families, one six-step type
// scale, and no wide tracking anywhere in games/cathode/src.
describe("CATHODE type rules (C13T)", () => {
  it("every CATHODE stylesheet passes the type and px lint", () => {
    expect(lintCathodeCss()).toEqual([]);
  });

  it("flags a third family, an off-scale size and wide tracking", () => {
    const bad = cssTypeProblems(
      ".a { font-family: 'Rajdhani'; font-size: 13px; letter-spacing: .3em; font: 700 12px/1 var(--font-num); }\n.b { font: italic 650 var(--fs-6)/1.02 var(--font-voice); letter-spacing: -.01em; }",
    );
    expect(bad).toHaveLength(4);
    expect(bad.join(" ")).toMatch(/font-family 'Rajdhani'/);
    expect(bad.join(" ")).toMatch(/letter-spacing \.3em/);
  });

  it("allows inherit, the six tokens and tracking up to 0.06em", () => {
    expect(cssTypeProblems(".a { font: inherit; font-size: var(--fs-3); letter-spacing: .06em; }\n.b { font: 700 var(--fs-1)/1.2 var(--font-ui); letter-spacing: 0; }")).toEqual([]);
  });

  it("tokens.css defines exactly six sizes", () => {
    const tokens = readFileSync(resolve(__dirname, "../games/cathode/src/styles/tokens.css"), "utf8");
    const root = tokens.slice(tokens.indexOf(":root {"), tokens.indexOf("\n}", tokens.indexOf(":root {")));
    expect([...root.matchAll(/--fs-(\d):/g)].map((m) => m[1])).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(root).not.toMatch(/--t-[a-z]/);
  });

  it("declares only the two families' faces, and none of the retired ones", () => {
    const dir = resolve(__dirname, "../games/cathode/src");
    const all = ["styles/fonts.css", "styles/tokens.css", "styles.css"].map((f) => readFileSync(resolve(dir, f), "utf8")).join("\n");
    expect(familiesIn(all).sort()).toEqual(["Cathode UI", "Cathode Voice"]);
    expect(all.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/rajdhani|jetbrains|Cathode Mono|Cathode Figures|Georgia"/i);
  });

  it("keeps tabular figures through font shorthands (an inherited tnum feature, which a shorthand never resets)", () => {
    const css = readFileSync(resolve(__dirname, "../games/cathode/src/styles.css"), "utf8");
    const body = css.slice(css.indexOf("html,\nbody {"), css.indexOf("}", css.indexOf("html,\nbody {")));
    expect(body).toMatch(/font-feature-settings: "tnum" 1;/);
  });

  it("counts @font-face families, not their metric fallbacks", () => {
    const css = '@font-face{font-family:Cathode UI;src:url(a.woff2)}@font-face{font-family:"Cathode Voice";src:url(b.woff2)}@font-face{font-family:Cathode UI Fallback;src:local(Arial)}';
    expect(familiesIn(css)).toEqual(["Cathode UI", "Cathode Voice"]);
    expect(CATHODE_MAX_FAMILIES).toBe(2);
  });
});
