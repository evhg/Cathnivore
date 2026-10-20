import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

// C13T (docs/design/cathode-combat.md): CATHODE's type rules, enforced on every stylesheet under games/cathode/src.
// Two families only (the --font-* tokens), and caps tracking of 0.06em at most: wide-tracked labels were the
// owner's "looks like a 5 year old made them".
const root = resolve(import.meta.dirname, "../games/cathode/src")
function cssUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? cssUnder(p) : n.endsWith(".css") ? [p] : []
  })
}
const sheets = cssUnder(root).map((f) => ({ f: f.slice(root.length + 1), css: readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "") }))
const TOKENS = /^var\(--(font-ui|font-num|font-display|font-voice|ui|display|mono)\)$/

describe("CATHODE type rules (C13T)", () => {
  it("declares only the two families' faces", () => {
    const faces = new Set(sheets.flatMap(({ css }) => [...css.matchAll(/@font-face\s*{[^}]*font-family:\s*"([^"]+)"/g)].map((m) => m[1]!)))
    expect([...faces].filter((f) => !/Fallback$/.test(f)).sort()).toEqual(["Cathode UI", "Cathode Voice"])
    const all = sheets.map((s) => s.css).join("\n")
    expect(all).not.toMatch(/rajdhani|jetbrains|Cathode Mono|Cathode Figures|Cathode Display"/i)
  })
  it("sets every font-family through a token", () => {
    const bad: string[] = []
    for (const { f, css } of sheets) {
      const noFaces = css.replace(/@font-face\s*{[^}]*}/g, "")
      for (const m of noFaces.matchAll(/font-family:\s*([^;}]+)/g)) if (!TOKENS.test(m[1]!.trim()) && m[1]!.trim() !== "inherit") bad.push(`${f}: ${m[0]}`)
      for (const m of noFaces.matchAll(/\bfont:\s*([^;}]+)/g)) if (!/var\(--[\w-]+\)\s*$/.test(m[1]!.trim()) && m[1]!.trim() !== "inherit") bad.push(`${f}: ${m[0]}`)
    }
    expect(bad).toEqual([])
  })
  it("never tracks wider than 0.06em", () => {
    const bad: string[] = []
    for (const { f, css } of sheets) {
      for (const m of css.matchAll(/letter-spacing:\s*([^;}]+)/g)) {
        const v = m[1]!.trim()
        const em = v.match(/^(-?\d*\.?\d+)em$/)
        if (em ? Number(em[1]) > 0.06 : !/^(0|normal|var\(--num-hero-track\))$/.test(v)) bad.push(`${f}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })
})
