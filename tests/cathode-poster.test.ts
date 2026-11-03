import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { posterFor, posterSrcset, POSTER_LANDSCAPE, POSTER_PORTRAIT } from "../games/cathode/src/ui/poster";

// Plan item 65: the front door's poster.
describe("posterFor", () => {
  it("picks portrait art for an upright phone and landscape art otherwise", () => {
    expect(posterFor(390, 844, 2)).toBe("front-poster-portrait-780.webp");
    expect(posterFor(390, 844, 1)).toBe("front-poster-portrait-520.webp");
    expect(posterFor(844, 390, 1)).toBe("front-poster-960.webp");
    expect(posterFor(1440, 900, 1)).toBe("front-poster-1440.webp");
    expect(posterFor(600, 400, 1)).toBe("front-poster-640.webp");
    expect(posterFor(2560, 1440, 2)).toBe("front-poster-1440.webp");
  });
  it("every file it can pick is shipped, and index.html offers the same set", () => {
    const html = readFileSync("games/cathode/index.html", "utf8");
    for (const w of POSTER_LANDSCAPE) expect(existsSync(`games/cathode/public/front-poster-${w}.webp`)).toBe(true);
    for (const w of POSTER_PORTRAIT) expect(existsSync(`games/cathode/public/front-poster-portrait-${w}.webp`)).toBe(true);
    expect(html).toContain(posterSrcset("/nightshift/", false));
    expect(html).toContain(posterSrcset("/nightshift/", true));
  });
});
