import type { GameState, RegionId } from '../engine/types'

// Plan item 35: the campaign as a map of Marrow you travel. Each chapter is a place on the map (its pin
// sits on the first of its home regions), and winning it frees its home regions: they turn from
// Hollowell orange to green, with bunting. Between them, every region of the Republic is freed once.
export const CHAPTER_HOMES: Record<string, RegionId[]> = {
  'fresh-meat': ['brindleHills', 'highmoor'],
  'word-of-mouth': ['saltmarsh'],
  'growing-season': ['oakvale'],
  'the-plan': ['rivermead'],
  'friends-in-low-places': ['shingleBay'],
  kingsmarket: ['kingsmarket'],
}

// The map's seven regions, as axial hex coordinates (the board's own ring around Kingsmarket).
export const MAP_AXIAL: Record<string, [number, number]> = {
  highmoor: [0, -1],
  saltmarsh: [1, -1],
  brindleHills: [-1, 0],
  kingsmarket: [0, 0],
  rivermead: [1, 0],
  oakvale: [-1, 1],
  shingleBay: [0, 1],
}

/** The regions freed by the chapters won so far. */
export function liberatedRegions(completed: readonly string[]): Set<RegionId> {
  const out = new Set<RegionId>()
  for (const id of completed) for (const r of CHAPTER_HOMES[id] ?? []) out.add(r)
  return out
}

/** Where Cath stands: the first chapter not yet won, in campaign order (the last one once all are won). */
export function currentChapterIndex(chapterIds: readonly string[], completed: readonly string[]): number {
  const i = chapterIds.findIndex((id) => !completed.includes(id))
  return i === -1 ? chapterIds.length - 1 : i
}

// Three wax seals per chapter (plan item 35): the win, the win on Hard, and one chapter feat. Chapter 1
// can't be won on Hard (Hard seeds a Doubt in every region, and chapter 1 has no Rebut), so its second
// seal is a swift win instead. Each feat was checked against bot and random play (DECISIONS 2026-11-02):
// reachable, and not what an ordinary win gives you.
export type SealId = 'win' | 'hard' | 'feat'

export interface ChapterSeals {
  hard: { label: string; earned(state: GameState): boolean }
  feat: { label: string; earned(state: GameState): boolean }
}

const onHard = { label: 'Won on Hard', earned: (s: GameState) => s.config.difficulty === 'hard' }
const byRound = (n: number) => (s: GameState) => (s.result?.round ?? 99) <= n
const lostLand = (s: GameState) => Object.values(s.regions).reduce((a, r) => a + r.lostLand, 0)

export const CHAPTER_SEALS: Record<string, ChapterSeals> = {
  'fresh-meat': { hard: { label: 'Swift: won by round 3', earned: byRound(3) }, feat: { label: 'Won by round 4', earned: byRound(4) } },
  'word-of-mouth': { hard: onHard, feat: { label: 'Won by round 5', earned: byRound(5) } },
  'growing-season': { hard: onHard, feat: { label: 'No more than 3 Lost Land', earned: (s) => lostLand(s) <= 3 } },
  'the-plan': { hard: onHard, feat: { label: 'Won by round 4', earned: byRound(4) } },
  'friends-in-low-places': { hard: onHard, feat: { label: 'Won in the first round', earned: byRound(1) } },
  kingsmarket: { hard: onHard, feat: { label: 'Public Trust 12 or more', earned: (s) => s.publicTrust >= 12 } },
}

/** The seals a won chapter's final state earns. */
export function sealsEarned(chapterId: string, state: GameState): SealId[] {
  if (!state.result?.won) return []
  const seals = CHAPTER_SEALS[chapterId]
  const out: SealId[] = ['win']
  if (seals?.hard.earned(state)) out.push('hard')
  if (seals?.feat.earned(state)) out.push('feat')
  return out
}

/** Whether a chapter offers a Hard replay (chapter 1's second seal is a swift win instead). */
export function hasHardSeal(chapterId: string): boolean {
  return CHAPTER_SEALS[chapterId]?.hard === onHard
}

// Plan item 477: each seal's outlook while the chapter is played, so the seals are goals on the table, not a
// surprise on the end screen. 'open' means nothing to read yet (or a seal this game can't give: the Hard seal on
// Normal); 'onTrack' would be earned if the game were won now; 'atRisk' has one round (or one Lost Land) left;
// 'lost' can no longer be met by any continuation; 'sealed' is earned (a won game).
export type SealState = 'open' | 'onTrack' | 'atRisk' | 'lost' | 'sealed'

export interface SealOutlook {
  id: SealId
  label: string
  state: SealState
}

/** Whether this is the last round (the Pressure deck is spent: the game ends with this round's enemy turn). */
const finalRound = (s: GameState) => s.pressureDeck.length === 0

function featOutlook(chapterId: string, which: 'hard' | 'feat', s: GameState): SealState {
  const seal = CHAPTER_SEALS[chapterId]?.[which]
  if (!seal) return 'open'
  if (s.result) return s.result.won && seal.earned(s) ? 'sealed' : 'lost'
  if (seal === onHard) return s.config.difficulty === 'hard' ? (finalRound(s) ? 'atRisk' : 'onTrack') : 'open'
  const by = ROUND_FEATS[chapterId]?.[which]
  if (by !== undefined) return s.round > by ? 'lost' : s.round === by || finalRound(s) ? 'atRisk' : 'onTrack'
  if (chapterId === 'growing-season') {
    const n = lostLand(s)
    return n > 3 ? 'lost' : n === 3 ? 'atRisk' : 'onTrack'
  }
  if (chapterId === 'kingsmarket') return s.publicTrust >= 12 ? 'onTrack' : finalRound(s) ? 'atRisk' : 'open'
  return 'open'
}

/** The round-limited seals' rounds (they're won 'by round n'), so the outlook can count down to them. */
const ROUND_FEATS: Record<string, Partial<Record<'hard' | 'feat', number>>> = {
  'fresh-meat': { hard: 3, feat: 4 },
  'word-of-mouth': { feat: 5 },
  'the-plan': { feat: 4 },
  'friends-in-low-places': { feat: 1 },
}

/** The chapter's three seals as they stand in `state`: the win, the Hard (or swift) seal, and the feat. */
export function sealOutlook(chapterId: string, state: GameState): SealOutlook[] {
  const seals = CHAPTER_SEALS[chapterId]
  const win: SealState = state.result ? (state.result.won ? 'sealed' : 'lost') : finalRound(state) ? 'atRisk' : 'open'
  return [
    { id: 'win', label: 'Win the chapter', state: win },
    { id: 'hard', label: seals?.hard === onHard && state.config.difficulty !== 'hard' ? 'Won on Hard (replay on Hard)' : (seals?.hard.label ?? 'Won on Hard'), state: featOutlook(chapterId, 'hard', state) },
    { id: 'feat', label: seals?.feat.label ?? 'Chapter feat', state: featOutlook(chapterId, 'feat', state) },
  ]
}
