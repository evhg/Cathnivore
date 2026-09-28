import type { CathExpression } from '../../shared/cath/cath'
import { REGIONS } from './map'
import type { RegionId } from '../engine/types'

// The game-screen Cath companion (ROADMAP "Cath in Cathnivore, as guide and narrator"): short, witty
// reaction lines in her voice (SPEC 3.2 — short sentences, dry, specific, at most an occasional "!").
// Deterministic, not random: each reaction picks a line by hashing the region/detail it's about, so the
// same event always shows the same line (screenshots and e2e stay stable; SPEC 9's determinism spirit).
export type CathReaction = 'liberated' | 'expand' | 'squeezeLostLand' | 'squeeze' | 'riftSplit' | 'win' | 'loss' | 'greeting'

export const CATH_REACTION_EXPRESSION: Record<CathReaction, CathExpression> = {
  liberated: 'delighted',
  expand: 'determined',
  squeezeLostLand: 'worried',
  squeeze: 'determined',
  riftSplit: 'determined',
  win: 'delighted',
  loss: 'worried',
  greeting: 'smirk',
}

const LINES: Record<CathReaction, string[]> = {
  liberated: [
    'One more market that isn\'t theirs. Put the kettle on.',
    "That's a region back on real food. Told you it'd hold.",
    'Liberated. Turns out grass-fed beats a press release.',
    "They'll notice that one on the quarterly call.",
    'That stall stays open. Bea already wants to draw it a sign.',
    "Ground held, honestly. It's not complicated, whatever they say.",
  ],
  expand: [
    'Another Outlet. They do love a discount.',
    "They're moving in. We were moving in first.",
    'Cheap and everywhere. Their whole business model in two words.',
    'A new sign, same old plastic underneath it.',
  ],
  squeeze: [
    "A Squeeze. Cute. We've had worse from the weather.",
    "They're leaning on us. We lean back.",
    "That's meant to scare us off. It won't.",
    'Somewhere a consultant is very pleased with themselves.',
    "I've been squeezed by tighter people than a quarterly strategy deck.",
  ],
  squeezeLostLand: [
    "We lost that ground. I'm not pretending otherwise.",
    "That one hurt. Noted, and we keep moving.",
    'Land gone. We get it back the slow, honest way.',
    "Not our best round. We've had worse mornings and still made market.",
  ],
  riftSplit: [
    "They're splitting the field between them. Efficient, I'll give them that.",
    'A merger of convenience. Not the first, won\'t be the last.',
    "That's a bigger play than usual. Eyes up.",
    'Two logos, one appetite. Nothing new there.',
  ],
  win: [
    "Marrow's ledger is ours again. Grass-fed, as promised.",
    "Every stall standing, every ledger honest. That's the whole plan working.",
    "Home in time for dinner, and every field still ours. Bea's going to want the whole story.",
  ],
  loss: [
    "Not this round. We still know how to farm.",
    "That one goes to them. Doesn't change what we grow.",
    "We'll be back at the stall tomorrow regardless.",
  ],
  greeting: [
    "Right. Let's get something honest into the ground.",
    "Morning. The Republic isn't going to liberate itself.",
    "Bea packed the good jam for the stall today. Good omen, that.",
  ],
}

// A small, stable hash so the same `seed` (a region id, faction, etc.) always lands on the same line.
function pick(reaction: CathReaction, seed: string): string {
  const lines = LINES[reaction]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return lines[h % lines.length]!
}

export function cathLineForRegion(reaction: CathReaction, region: RegionId): string {
  return pick(reaction, REGIONS[region].name)
}

export function cathLine(reaction: CathReaction, seed: string = reaction): string {
  return pick(reaction, seed)
}
