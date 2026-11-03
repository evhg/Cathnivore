import { ACTION_TERMS, GLOSSARY_TERMS } from './terms'
import { PRODUCERS, ALL_PRODUCER_IDS } from './producers'
import { IMPROVEMENTS } from './improvements'
import { SCHEMES } from './schemes'
import { AGENDA_CARDS } from './agenda'
import type { VignetteKind } from '../ui/vignetteKind'

/**
 * Plan item 56: How to Play as Cath's almanac. Each chapter is a page: the rules entries that belong to it, the
 * galleries it shows, Cath's note in the margin and the picture that shows the rule. Every action and glossary
 * term lives on exactly one page (tests/almanac.test.ts), so search always has a page to land on.
 */
export type AlmanacChapterId = 'round' | 'selling' | 'investing' | 'hollowell' | 'winning' | 'producers' | 'cards'
export type AlmanacGallery = 'producers' | 'improvements' | 'schemes' | 'agenda' | 'difficulty'

export interface AlmanacChapter {
  id: AlmanacChapterId
  title: string
  /** Cath's margin note, in her voice. */
  note: string
  /** The picture on the page: a mini-board page of the quick tour, or a card vignette. */
  illustration: { tour: number } | { vignette: VignetteKind }
  /** Action and glossary terms on this page, in reading order. */
  terms: string[]
  galleries: AlmanacGallery[]
}

export const ALMANAC: AlmanacChapter[] = [
  {
    id: 'round',
    title: 'Your round',
    note: 'Three actions each, love. Spend them where Hollowell is thinnest, never where he is strongest.',
    illustration: { tour: 0 },
    terms: ['Open Stall', 'Graft', 'Scout', 'Co-op marker'],
    galleries: [],
  },
  {
    id: 'selling',
    title: 'Selling',
    note: 'Produce is worth nothing in the barn. Sell it where people can see you selling it.',
    illustration: { vignette: 'market' },
    terms: ['Produce', 'Sell', 'Marks', 'Goodwill'],
    galleries: [],
  },
  {
    id: 'investing',
    title: 'Investing',
    note: 'An Improvement pays every round after. Buy early, buy where you mean to stay.',
    illustration: { tour: 3 },
    terms: ['Invest'],
    galleries: ['improvements'],
  },
  {
    id: 'hollowell',
    title: 'Hollowell',
    note: 'He doesn’t fight fair, he fights cheap. Watch the Agenda and you’ll see him coming.',
    illustration: { tour: 2 },
    terms: ['Outlet', 'Buyout', 'Doubt', 'Squeeze', 'Expand', 'Rift', 'Rebut', 'Supply'],
    galleries: ['agenda'],
  },
  {
    id: 'winning',
    title: 'Winning and losing',
    note: 'Free the regions and keep them free. Lose the town’s trust and nothing else matters.',
    illustration: { tour: 1 },
    terms: ['Liberated', 'Public Trust', 'Lost Land'],
    galleries: ['difficulty'],
  },
  {
    id: 'producers',
    title: 'Producers',
    note: 'Four of the best people I know. Pick two who cover each other’s gaps.',
    illustration: { vignette: 'community' },
    terms: [],
    galleries: ['producers'],
  },
  {
    id: 'cards',
    title: 'Cards',
    note: 'My Plan is a hand of tricks. Play them late, when Hollowell has already moved.',
    illustration: { vignette: 'plan' },
    terms: ['Scheme'],
    galleries: ['schemes'],
  },
]

const ALL_TERMS = [...ACTION_TERMS, ...GLOSSARY_TERMS]

/** Everything one page is searched by: its title, note, terms and their bodies, and its galleries' cards. */
export function almanacText(ch: AlmanacChapter): string[] {
  const out = [ch.title, ch.note]
  for (const t of ch.terms) {
    const e = ALL_TERMS.find((x) => x.term === t)
    if (e) out.push(e.term, e.body)
  }
  for (const g of ch.galleries) {
    if (g === 'producers') for (const id of ALL_PRODUCER_IDS) out.push(PRODUCERS[id].name, PRODUCERS[id].roleName, PRODUCERS[id].roleAbility)
    if (g === 'improvements') for (const c of IMPROVEMENTS) out.push(c.name, c.text, c.flavor ?? '', ...c.tags)
    if (g === 'schemes') for (const c of SCHEMES) out.push(c.name, c.text, c.line ?? '', ...(c.tags ?? []))
    if (g === 'agenda') for (const c of AGENDA_CARDS) out.push(c.headline, c.faction)
    if (g === 'difficulty') out.push('Easy', 'Normal', 'Hard', 'Difficulty')
  }
  return out
}

/**
 * The pages a search hits, best first: a page whose own term or title matches comes before one that only
 * mentions the word in passing, so "Squeeze" lands on Hollowell's page, not the first page that says it.
 */
export function almanacSearch(query: string): AlmanacChapterId[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored = ALMANAC.map((ch, i) => {
    const own = ch.title.toLowerCase().includes(q) || ch.terms.some((t) => t.toLowerCase().includes(q))
    const any = almanacText(ch).some((s) => s.toLowerCase().includes(q))
    return { id: ch.id, score: own ? 2 : any ? 1 : 0, i }
  })
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((s) => s.id)
}
