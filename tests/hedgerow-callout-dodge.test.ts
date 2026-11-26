import { describe, expect, it } from "vitest";
import { Floaters } from "../games/hedgerow/src/render3d/fx";

// Plan item 691: a callout rising over a tower ('Bridge up!' over the windmill) steps clear of every tower box.
const meets = (x: number, y: number, lw: number, lh: number, b: { x: number; y: number; w: number; h: number }) =>
  x - lw / 2 < b.x + b.w && x + lw / 2 > b.x && y - lh / 2 < b.y + b.h && y + lh / 2 > b.y;

describe("Floaters.dodge", () => {
  it("leaves a clear callout where it rose", () => {
    expect(Floaters.dodge(100, 100, 60, 20, [{ x: 200, y: 200, w: 40, h: 80 }], 390, 640)).toEqual({ x: 0, y: 0 });
  });
  it("steps a callout off a tower, inside the frame", () => {
    const towers = [{ x: 80, y: 80, w: 50, h: 90 }];
    const o = Floaters.dodge(105, 120, 80, 22, towers, 390, 640);
    expect(meets(105 + o.x, 120 + o.y, 80, 22, towers[0]!)).toBe(false);
  });
  it("holds a callout over an edge tower inside the frame first", () => {
    const towers = [{ x: 274, y: 139, w: 76, h: 94 }, { x: 317, y: 178, w: 72, h: 102 }];
    const o = Floaters.dodge(358, 236, 84, 30, towers, 390, 645);
    const x = 358 + o.x;
    const y = 236 + o.y;
    expect(x + 42).toBeLessThanOrEqual(390);
    for (const t of towers) expect(meets(x, y, 84, 30, t)).toBe(false);
  });
  it("keeps the whole climb off a tower, not only where the label starts", () => {
    // CI E2E red on 5773e1e6: dodged just under a tower, the label then rose 20 px back into it.
    const towers = [{ x: 63, y: 162, w: 54, h: 94 }];
    const rise = 20;
    const o = Floaters.dodge(90, 230, 84, 30, towers, 390, 640, rise);
    const x = 90 + o.x;
    const y = 230 + o.y;
    for (let t = 0; t <= rise; t += 2) expect(meets(x, y - t, 84, 30, towers[0]!)).toBe(false);
  });
});
