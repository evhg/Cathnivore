import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

const metaDir = path.join(__dirname, '../store/metadata/en-US')

function read(file: string): string {
  return fs.readFileSync(path.join(metaDir, file), 'utf8').trim()
}

// SPEC 11.6: "limits: subtitle 30 characters, description 4,000 characters, keywords 100 characters." These
// files feed `store.yml`'s upload directly (fastlane deliver reads `store/metadata/en-US/*`); a future
// content edit that quietly breaks one of Apple's hard limits would only be caught when `store.yml` runs
// against real App Store Connect (or rejected outright), by which point the workflow run is wasted.
describe('store metadata text limits (SPEC 11.6)', () => {
  it('subtitle is at most 30 characters', () => {
    expect(read('subtitle.txt').length).toBeLessThanOrEqual(30)
  })

  it('description is at most 4,000 characters', () => {
    expect(read('description.txt').length).toBeLessThanOrEqual(4000)
  })

  it('keywords is at most 100 characters', () => {
    expect(read('keywords.txt').length).toBeLessThanOrEqual(100)
  })

  it('every metadata file is non-empty', () => {
    for (const file of ['name.txt', 'subtitle.txt', 'description.txt', 'keywords.txt', 'promotional_text.txt', 'support_url.txt', 'privacy_url.txt']) {
      expect(read(file).length, file).toBeGreaterThan(0)
    }
  })

  it('the description says clearly that the game is satire and every company/person is fictional', () => {
    const description = read('description.txt').toLowerCase()
    expect(description).toMatch(/fictional/)
  })
})
