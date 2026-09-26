// SPEC 10.5: "Every game term ... is explained in the rules reference and in a tap or hover tooltip."
// Shared by `RulesReference.tsx` (the searchable reference) and `Tooltip.tsx` (the in-game popover), so
// the two can never disagree about a term's wording.
import { DIFFICULTY_SETTINGS } from './difficulty'
import { POOL_SIZES } from '../engine/pieces'
import { STALL_LOSS_MARGIN } from '../engine/enemy'

export interface GlossaryEntry {
  term: string
  body: string
}

export const ACTION_TERMS: GlossaryEntry[] = [
  { term: 'Open Stall', body: 'Pay 1 Produce and place one of your Stalls in a region that contains your Stall or borders a region that does. Maximum 3 Stalls per region (all producers combined).' },
  { term: 'Supply', body: 'In a region with your Stall, either pay 2 Produce per Outlet to remove up to 2 Outlets, or pay 3 Produce to remove 1 Buyout (needs at least 2 Stalls in the region).' },
  { term: 'Rebut', body: 'In a region with your Stall, pay 1 Goodwill per Doubt to remove up to 2 Doubt.' },
  { term: 'Invest', body: 'Buy one face-up Improvement from the Market by paying its Marks cost. It joins your tableau and its Market space stays empty until cleanup.' },
  { term: 'Sell', body: 'Turn up to 3 Produce into the same number of Marks.' },
  { term: 'Scheme', body: "Play one face-up Scheme from Cath's Plan by paying its Goodwill cost, then resolve and discard it." },
  { term: 'Graft', body: 'Gain 1 Produce and 1 Marks. Always legal.' },
]

export const GLOSSARY_TERMS: GlossaryEntry[] = [
  { term: 'Liberated', body: 'A region with at least 1 Stall and no Outlets, Buyouts or Doubt. The first time a region is liberated, Public Trust +1 and the liberating producer gains +1 production.' },
  { term: 'Squeeze', body: `An enemy step: in each matching region, Damage (Outlets + 2x Buyouts) compared to Defence (Stalls). If Damage is greater, place 1 Lost Land token; if it is at least Defence + ${STALL_LOSS_MARGIN}, also remove a Stall. Public Trust also drops per Doubt there (up to 2).` },
  { term: 'Expand', body: 'An enemy step: each matching region with at least 1 enemy piece gains an Outlet, or a Buyout if it already has 2+ Outlets and no Buyout.' },
  { term: 'Scout', body: 'An enemy step: reveal the top Pressure card and add 1 Outlet (and, at Stage III, 1 Doubt) to each matching region.' },
  { term: 'Rift', body: 'A shared track (0-6) that rises from Schemes and some Improvements. At 3 ("Cracks"), Agenda bonus effects are skipped. At 6 ("The Split"), the players remove one faction from the game in part.' },
  { term: 'Public Trust', body: `A shared track (0-15, starts at ${DIFFICULTY_SETTINGS.normal.publicTrust}) representing the country's opinion of farmers. Reaching 0 loses the game.` },
  { term: 'Lost Land', body: `A pool of tokens (${DIFFICULTY_SETTINGS.normal.lostLandPool} at Normal). Placing one shrinks a region's Stall cap. Needing one when the pool is empty loses the game.` },
  { term: 'Outlet', body: `A Hollowell enemy piece (pool of ${POOL_SIZES.outlet}). Squeeze deals more Damage per Outlet; Supply removes it for 2 Produce each.` },
  { term: 'Buyout', body: `A Hollowell enemy piece (pool of ${POOL_SIZES.buyout}), worth double an Outlet toward Squeeze Damage. Supply removes one for 3 Produce, needing at least 2 Stalls in the region.` },
  { term: 'Doubt', body: `A Candor enemy piece (pool of ${POOL_SIZES.doubt}). Rebut removes it for 1 Goodwill each; left alone it can lower Public Trust when Squeeze resolves.` },
]

export const GLOSSARY_LOOKUP: Record<string, string> = Object.fromEntries(
  [...GLOSSARY_TERMS, ...ACTION_TERMS].map((e) => [e.term, e.body]),
)

// A stable, DOM-safe id for a glossary/action term entry (SPEC 8.1: the tutorial's "?" link scrolls the
// rules reference to the term it was opened from), shared between `RulesReference.tsx`'s anchors and the
// scroll target it looks up on open.
export function entryDomId(term: string): string {
  return `rules-entry-${term.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
}
