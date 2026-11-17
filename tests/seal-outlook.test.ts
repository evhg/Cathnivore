import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction } from '../src/engine/actions'
import { createRng } from '../src/engine/rng'
import { HeuristicBot } from '../src/ai/heuristic'
import { CHAPTERS, chapterConfig } from '../src/content/chapters'
import { sealOutlook, sealsEarned, type SealId } from '../src/content/campaignMap'
import type { GameState } from '../src/engine/types'

// Plan item 477: the seals' outlook during play. A seal reads 'lost' exactly when no continuation can earn it: once
// lost it stays lost, and a won game never earns a seal that read lost on the way; a won game's 'sealed' seals are
// exactly the ones `sealsEarned` records.
function play(chapterIndex: number, difficulty: 'normal' | 'hard', seed: number): GameState[] {
  const chapter = CHAPTERS[chapterIndex]!
  let state = createGame({ ...chapterConfig(chapter), difficulty }, seed)
  let rng = createRng(seed * 7919 + 11)
  const out = [state]
  for (let step = 0; step < 400 && !state.result; step++) {
    const [action, next] = HeuristicBot.chooseAction(state, rng)
    rng = next
    state = applyAction(state, action)
    out.push(state)
  }
  return out
}

describe('sealOutlook (plan item 477)', () => {
  it('covers all six chapters: lost stays lost, lost is never earned, and the win seals exactly what is recorded', () => {
    let wins = 0
    let featsLost = 0
    for (let c = 0; c < CHAPTERS.length; c++) {
      const id = CHAPTERS[c]!.id
      for (const difficulty of ['normal', 'hard'] as const) {
        for (let seed = 1; seed <= 6; seed++) {
          const states = play(c, difficulty, seed)
          const final = states[states.length - 1]!
          const earned = new Set<SealId>(sealsEarned(id, final))
          const lostAt = new Map<SealId, number>()
          states.forEach((s, i) => {
            for (const o of sealOutlook(id, s)) {
              if (o.state === 'lost' && !lostAt.has(o.id)) lostAt.set(o.id, i)
              if (lostAt.has(o.id)) expect(o.state, `${id} ${difficulty} ${seed} ${o.id} step ${i}`).toBe('lost')
              if (!s.result) expect(o.state).not.toBe('sealed')
            }
          })
          for (const sealId of lostAt.keys()) expect(earned.has(sealId), `${id} ${sealId} read lost but was earned`).toBe(false)
          if (final.result?.won) {
            wins++
            const sealed = sealOutlook(id, final).filter((o) => o.state === 'sealed').map((o) => o.id)
            expect(sealed).toEqual(sealsEarned(id, final))
          }
          if (lostAt.has('feat')) featsLost++
        }
      }
    }
    // The bot games cover both outcomes, so the checks above aren't vacuous.
    expect(wins).toBeGreaterThan(0)
    expect(featsLost).toBeGreaterThan(0)
  })

  it('counts down a round feat: on track, at risk in its last round, lost after', () => {
    const states = play(0, 'normal', 3)
    const by = (round: number) => states.find((s) => s.round === round && !s.result)
    // chapter 1's feat is a win by round 4
    if (by(3)) expect(sealOutlook('fresh-meat', by(3)!).find((o) => o.id === 'feat')!.state).toBe('onTrack')
    if (by(4)) expect(sealOutlook('fresh-meat', by(4)!).find((o) => o.id === 'feat')!.state).toBe('atRisk')
    if (by(5)) expect(sealOutlook('fresh-meat', by(5)!).find((o) => o.id === 'feat')!.state).toBe('lost')
  })

  it('reads the Hard seal as open on Normal, and on track on Hard', () => {
    const normal = play(1, 'normal', 1)[0]!
    const hard = play(1, 'hard', 1)[0]!
    expect(sealOutlook('word-of-mouth', normal).find((o) => o.id === 'hard')!.state).toBe('open')
    expect(sealOutlook('word-of-mouth', hard).find((o) => o.id === 'hard')!.state).toBe('onTrack')
  })
})
