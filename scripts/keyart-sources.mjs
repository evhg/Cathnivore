// Plan item 116: what each game's key art is drawn from. `npm run keyart` records a hash of these files in
// portfolio/public/work/keyart.json when it shoots a game; tests/keyart-fresh.test.ts fails when they have
// changed since, so the site's posters never go stale behind a game's new look (CI clones at depth 1, so this
// compares content, not git dates).
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const KEYART_SOURCES = {
  cathnivore: ['src/ui/RegionGroundArt.tsx', 'src/ui/Landmark.tsx', 'src/ui/regionGround.ts', 'src/ui/TableProps.tsx'],
  runnel: ['games/runnel/src/valley.ts', 'games/runnel/src/gardenart.ts', 'games/runnel/src/ground.ts', 'games/runnel/src/water.ts'],
  hedgerow: ['games/hedgerow/src/render.ts', 'games/hedgerow/src/sprites.ts', 'games/hedgerow/src/terrain.ts', 'games/hedgerow/src/fieldkit.ts', 'games/hedgerow/src/fieldkitart.ts'],
  nightshift: ['games/cathode/src/render/frontscene.ts', 'games/cathode/src/render/frontcath.ts'],
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

// Plan item 363: NIGHT SHIFT's front-door posters (front-poster-*.webp, the frame every visitor sees until the live
// street draws) are rendered from the same title scene by scripts/cathode-poster.mjs, which records this hash; they
// went 8 days stale behind the coat's relighting, and the critiques kept measuring the old dark coat.
export const POSTER_MANIFEST = 'games/cathode/public/front-poster.json'
/** Every file the title scene is drawn from (plan item 331 lit the facade in frontdiorama.ts, which the first list missed). */
// Plan item 462: and level.ts, the street the title stands in (its bin bags changed shape and no check saw it).
export const POSTER_SOURCES = ['frontscene', 'frontcath', 'frontdiorama', 'frontneon', 'frontwet', 'frontstreet', 'frontstoop', 'level'].map((f) => `games/cathode/src/render/${f}.ts`)
export function posterHash(root = '.') {
  const h = createHash('sha256')
  for (const f of POSTER_SOURCES) {
    h.update(f)
    h.update(readFileSync(`${root}/${f}`, 'utf8').replace(/\r\n/g, '\n'))
  }
  return h.digest('hex').slice(0, 16)
}
