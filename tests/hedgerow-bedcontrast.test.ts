// Plan item 688: Saltmarsh's 2D beds read as painted plots under a pale sand lane, not a tinted grid: each bed and
// margin fill, composited over the act's grass, sits 3:1 or more below the lane's track colour.
import { describe, expect, it } from "vitest";
import { FIELD_KITS } from "../games/hedgerow/src/fieldkit";
import { kitBedFill } from "../games/hedgerow/src/fieldkitart";
import { THEMES } from "../games/hedgerow/src/theme";

const rgb = (c: string): [number, number, number, number] => {
  if (c.startsWith("#")) return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
  const m = /rgba?\(([^)]+)\)/.exec(c)!;
  const [r, g, b, a] = m[1]!.split(",").map(Number);
  return [r!, g!, b!, a ?? 1];
};
const lum = ([r, g, b]: [number, number, number, number]): number => {
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const over = (top: string, under: string): [number, number, number, number] => {
  const [r, g, b, a] = rgb(top);
  const [ur, ug, ub] = rgb(under);
  return [r * a + ur * (1 - a), g * a + ug * (1 - a), b * a + ub * (1 - a), 1];
};
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("Saltmarsh 2D beds against the lane", () => {
  const theme = THEMES.find((t) => t.name === "Saltmarsh")!;
  const kit = FIELD_KITS[2]!;
  const lane = lum(rgb(theme.dirt[1]));
  for (const look of [...kit.beds, ...kit.margins])
    it(`${look} is 3:1 under the track`, () => {
      const fill = kitBedFill(look)!;
      expect(fill).toBeDefined();
      for (const stop of fill)
        for (const grass of theme.grass) expect(ratio(lane, lum(over(stop, grass))), `${look} ${stop} over ${grass}`).toBeGreaterThanOrEqual(3);
    });
});
