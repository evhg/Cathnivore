// Plan item 116: the site's posters are shot from each game's `?keyart` frame (`npm run keyart`). When a game's
// art changes after its poster was shot, this fails: re-shoot that game (see scripts/keyart.mjs) and commit.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error: a plain ES module shared with the Node script
import { KEYART_MANIFEST, KEYART_SOURCES, keyartHash } from '../scripts/keyart-sources.mjs'

const manifest = JSON.parse(readFileSync(KEYART_MANIFEST, 'utf8')) as Record<string, string>

describe('site key art is fresh', () => {
  for (const game of Object.keys(KEYART_SOURCES as Record<string, string[]>)) {
    it(`${game}'s poster was shot after its art last changed`, () => {
      expect(manifest[game], `re-shoot it: npm run build:site, preview on :4186, npm run keyart ${game}`).toBe(keyartHash(game))
    })
  }

  it('tells a changed art file from the shot one', () => {
    const files = (KEYART_SOURCES as Record<string, string[]>).runnel!
    const root = mkdtempSync(join(tmpdir(), 'keyart-'))
    try {
      for (const f of files) {
        cpSync(f, join(root, f), { recursive: true })
      }
      expect(keyartHash('runnel', root)).toBe(keyartHash('runnel'))
      writeFileSync(join(root, files[0]!), `${readFileSync(files[0]!, 'utf8')}\n// a new hill\n`)
      expect(keyartHash('runnel', root)).not.toBe(keyartHash('runnel'))
      expect(dirname(files[0]!)).toBe('games/runnel/src')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
