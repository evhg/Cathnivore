import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hudUnit } from "../games/cathode/src/game/beacon";
import { cssPxProblems, lintCathodeCss } from "../scripts/font-budget";

const styles = (f: string) => readFileSync(resolve(__dirname, "../games/cathode/src/styles", f), "utf8");
/** The N in `<decl>: ... calc(var(--u) * N)` inside the first rule whose selector line matches. */
function uOf(css: string, selector: string, decl: string): number {
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} not found`).toBeGreaterThanOrEqual(0);
  const body = css.slice(at, css.indexOf("}", at));
  const m = new RegExp(`${decl.replace(/[-]/g, "\\-")}:[^;]*?calc\\(var\\(--u\\) \\* ([\\d.]+)\\)`).exec(body);
  expect(m, `${selector} ${decl}`).not.toBeNull();
  return Number(m![1]);
}

describe("CATHODE HUD scale (S8, C3)", () => {
  it("--u at 390, 900, 1440 and 2880 px tall", () => {
    expect(hudUnit(844, 390)).toBeCloseTo(0.62); // a phone held sideways: the floor
    expect(hudUnit(1440, 900)).toBeCloseTo(0.75); // 16:10, the width decides
    expect(hudUnit(2560, 1440)).toBeCloseTo(1.333, 3); // 5K at 2x
    expect(hudUnit(5120, 2880)).toBeCloseTo(2.4); // 5K at 1x: the cap
    expect(hudUnit(2560, 1440, 1.3)).toBeCloseTo(1.733, 3); // the HUD-size setting
  });

  it("tokens.css carries the same formula", () => {
    expect(styles("tokens.css")).toContain("--u: calc(clamp(.62px, min(100svh / 1080, 100vw / 1920), 2.4px) * var(--hud-scale, 1));");
  });

  it("the S8 sizes at 2560x1440 @2 clear their minimums (physical px)", () => {
    const hud = styles("hud.css");
    const phys = (u: number) => u * hudUnit(2560, 1440) * 2;
    expect(phys(uOf(hud, ".hud-wp", "--d"))).toBeGreaterThanOrEqual(48); // waypoint diamond
    expect(phys(uOf(hud, ".hud-wprompt-key", "height"))).toBeGreaterThanOrEqual(58); // prompt keycap
    expect(phys(uOf(hud, ".hud-root", "--t-num-ammo")) * 0.9).toBeGreaterThanOrEqual(150); // ammo numerals (line-height .9)
    expect(phys(uOf(hud, ".hud-hit", "--len"))).toBeGreaterThanOrEqual(26); // hit tick length
    expect(phys(uOf(hud, ".hud-wp.off .hud-wp-arrow", "--a"))).toBeGreaterThanOrEqual(58); // off-screen chevron
  });

  it("no HUD text token can drop under 12 CSS px on a phone", () => {
    const hud = styles("hud.css");
    const root = hud.slice(hud.indexOf(".hud-root {"), hud.indexOf("}", hud.indexOf(".hud-root {")));
    const tokens = [...root.matchAll(/(--t-[\w-]+): max\((\d+)px, calc\(var\(--u\) \* ([\d.]+)\)\)/g)];
    expect(tokens.length).toBeGreaterThanOrEqual(12);
    for (const [, name, floor] of tokens) expect(Number(floor), name).toBeGreaterThanOrEqual(12);
    // Every literal font size written in u in the HUD carries a floor.
    for (const m of hud.matchAll(/font(?:-size)?:[^;]*calc\(var\(--u\)[^;]*;/g)) expect(m[0], m[0]).toMatch(/max\(\d+px,/);
  });
});

describe("CATHODE px lint (S8)", () => {
  it("flags raw px and allows hairlines, floors, media queries and marked lines", () => {
    expect(cssPxProblems(".a { width: 14px; }")).toHaveLength(1);
    expect(cssPxProblems(".a { left: -7px; top: 2.5px; }")).toHaveLength(2);
    expect(cssPxProblems(".a { border: 1px solid; margin: 0px; }")).toHaveLength(0);
    expect(cssPxProblems(".a { font-size: max(12px, calc(var(--u) * 15)); }")).toHaveLength(0);
    expect(cssPxProblems("@media (max-height: 430px) {")).toHaveLength(0);
    expect(cssPxProblems(".a { width: 44px; } /* px-ok: a tap target */")).toHaveLength(0);
    expect(cssPxProblems("/* px-ok:begin */\n.a { width: 44px; }\n/* px-ok:end */\n.b { width: 3px; }")).toHaveLength(1);
    expect(cssPxProblems("/* a 2px band,\n   3px wide */ .a { width: 0; }")).toHaveLength(0);
  });
  it("every CATHODE stylesheet is clean", () => {
    expect(lintCathodeCss()).toEqual([]);
  });
});
