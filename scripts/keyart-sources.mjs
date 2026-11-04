// Plan item 116: what each game's key art is drawn from. `npm run keyart` records a hash of these files in
// portfolio/public/work/keyart.json when it shoots a game; tests/keyart-fresh.test.ts fails when they have
// changed since, so the site's posters never go stale behind a game's new look (CI clones at depth 1, so this
// compares content, not git dates).
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const KEYART_SOURCES = {
  cathnivore: ['src/ui/RegionGroundArt.tsx', 'src/ui/Landmark.tsx', 'src/ui/regionGround.ts', 'src/ui/TableProps.tsx'],
  runnel: ['games/runnel/src/valley.ts', 'games/runnel/src/gardenart.ts', 'games/runnel/src/ground.ts', 'games/runnel/src/water.ts'],
  hedgerow: ['games/hedgerow/src/render.ts', 'games/hedgerow/src/sprites.ts', 'games/hedgerow/src/terrain.ts'],
  nightshift: ['games/cathode/public/keyart/market.webp'],
}

export const KEYART_MANIFEST = 'portfolio/public/work/keyart.json'

/** sha256 over the game's source files, in order (line endings normalised for text files). */
export function keyartHash(game, root = '.') {
  const h = createHash('sha256')
  for (const f of KEYART_SOURCES[game]) {
    const buf = readFileSync(`${root}/${f}`)
    h.update(f)
    h.update(f.endsWith('.webp') ? buf : buf.toString('utf8').replace(/\r\n/g, '\n'))
  }
  return h.digest('hex').slice(0, 16)
}
