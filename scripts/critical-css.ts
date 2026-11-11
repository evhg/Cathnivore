import postcss, { type AtRule, type Root, type Rule } from 'postcss'
import type { Plugin, ResolvedConfig } from 'vite'

// Gate 7 (Lighthouse mobile >= 85), 2026-11-11: about 90% of the entry stylesheet styles the game table, which
// the title never shows, yet the whole 65 kB (gzip) blocked the first paint. The build now links a *critical*
// copy render-blocking: every rule except those that can only match inside the Game chunk's markup. The
// untouched full stylesheet loads right after the first paint (`src/platform/fullCss.ts`), and the Game screen
// waits for it. The full sheet comes after the critical one and holds every critical rule again at a later
// position with the same specificity, so once it has loaded the cascade is exactly the one-sheet cascade: no rule
// order can flip (the per-rule split tried earlier moved rules into a later file and flipped about 150 game-screen
// properties).
//
// A rule is game-only when every one of its selectors requires a class (outside :not()/:is()/:where()/:has())
// whose name appears as a token in the Game chunk and in no other chunk or the HTML. Classes built at run time
// from parts never appear whole anywhere, so they stay critical.

export const FULL_CSS_META = 'cathnivore-full-css'

const TOKEN = /[A-Za-z_][\w-]*/g

function tokens(code: string, into: Set<string>): void {
  for (const m of code.matchAll(TOKEN)) into.add(m[0])
}

/**
 * Whether code outside the Game chunk could produce class `cls`: it names it whole, or names a prefix that a
 * template literal could finish (`tone-${x}` leaves the token `tone-`; `a${n}` leaves `a` before digits).
 */
export function reachable(cls: string, elsewhere: Set<string>): boolean {
  if (elsewhere.has(cls)) return true
  const digits = /^(.*?)\d+$/.exec(cls)
  if (digits && digits[1] && elsewhere.has(digits[1])) return true
  for (let i = 1; i < cls.length; i++) {
    if ((cls[i - 1] === '-' || cls[i - 1] === '_') && elsewhere.has(cls.slice(0, i))) return true
  }
  return false
}

function requiredClasses(selector: string): string[] {
  // Drop functional pseudo-class arguments: classes inside them aren't required for a match.
  let s = selector
  for (let guard = 0; guard < 20 && /\([^()]*\)/.test(s); guard++) s = s.replace(/\([^()]*\)/g, '')
  return [...s.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]!)
}

export function splitCritical(css: string, gameOnly: (cls: string) => boolean): { critical: string; moved: number } {
  const root: Root = postcss.parse(css)
  let moved = 0
  root.walkRules((rule: Rule) => {
    // Keyframe steps aren't selectors.
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as AtRule).name)) return
    const selectors = rule.selectors
    if (selectors.length && selectors.every((sel) => requiredClasses(sel).some(gameOnly))) {
      rule.remove()
      moved++
    }
  })
  // Remove at-rules (media, supports, layer blocks) that the split left empty.
  root.walkAtRules((at) => {
    if (at.nodes && at.nodes.length === 0) at.remove()
  })
  return { critical: root.toString(), moved }
}

export function criticalCss(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'cathnivore-critical-css',
    apply: 'build',
    enforce: 'post',
    configResolved(c) {
      config = c
    },
    generateBundle(_opts, bundle) {
      const chunks = Object.values(bundle).flatMap((f) => (f.type === 'chunk' ? [f] : []))
      const game = chunks.find((c) => c.isDynamicEntry && /\/ui\/Game\.tsx$/.test(c.facadeModuleId ?? ''))
      const entry = chunks.find((c) => c.isEntry)
      const htmlFile = bundle['index.html']
      const html = htmlFile?.type === 'asset' ? htmlFile : undefined
      if (!game || !entry || !html) return
      const cssName = [...((entry as { viteMetadata?: { importedCss: Set<string> } }).viteMetadata?.importedCss ?? [])][0]
      const cssFile = cssName ? bundle[cssName] : undefined
      const cssAsset = cssFile?.type === 'asset' ? cssFile : undefined
      if (!cssName || !cssAsset) return

      const inGame = new Set<string>()
      const elsewhere = new Set<string>()
      tokens(game.code, inGame)
      for (const c of chunks) if (c !== game) tokens(c.code, elsewhere)
      tokens(String(html.source), elsewhere)
      const gameOnly = (cls: string) => inGame.has(cls) && !reachable(cls, elsewhere)

      const full = String(cssAsset.source)
      const { critical, moved } = splitCritical(full, gameOnly)
      if (moved === 0) return
      const ref = this.emitFile({ type: 'asset', name: 'critical.css', source: critical })
      const criticalName = this.getFileName(ref)
      const base = config.base.endsWith('/') ? config.base : `${config.base}/`
      html.source = String(html.source)
        .replace(`${base}${cssName}"`, `${base}${criticalName}"`)
        .replace('</head>', `  <meta name="${FULL_CSS_META}" content="${base}${cssName}" />\n</head>`)
      config.logger.info(
        `critical-css: ${moved} game-only rules deferred; first-paint CSS ${(critical.length / 1024).toFixed(0)} kB of ${(full.length / 1024).toFixed(0)} kB`,
      )
    },
  }
}
