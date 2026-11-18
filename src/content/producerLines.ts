import type { GameEvent, ProducerId, RegionId, RegionState } from '../engine/types'
import { pairKey } from './pairLines'

/**
 * Plan item 489: the producers talk back at the table. Cath narrates; after her line settles, one producer answers
 * the turn's beat in their own voice: Mara dry (a retired magistrate), Tomas warm (the market's oldest stallholder),
 * Ines clinical (the town doctor), Sol a broadcaster (the local radio). One reply a turn, never a second voice over Cath.
 */
export type ReplyBeat = 'round' | 'ability' | 'liberated' | 'squeezed' | 'last'

export const REPLY_BEATS: readonly ReplyBeat[] = ['round', 'ability', 'liberated', 'squeezed', 'last']

export const PRODUCER_LINES: Record<ProducerId, Record<ReplyBeat, readonly string[]>> = {
  mara: {
    round: ['Another morning, another man in a lanyard. Carry on.', 'I have read worse contracts. Not many.', 'Coffee first. Then we ruin his week.'],
    ability: ['Injunction granted. Do try to look surprised.', 'Paperwork, Cath. Still the sharpest knife in the drawer.', 'Struck out. I did warn them.'],
    liberated: ['Case closed. The town keeps its market.', 'Free again. Mark the date.', 'That one will hold. I checked the clauses.'],
    squeezed: ['He has been at my stall. I shall be writing a letter.', 'A squeeze, is it. How very legal of him.', 'Noted. Filed. Not forgotten.'],
    last: ['Final round. Keep it tidy.', 'Last hearing. Let us not be late.', 'One more push, then a proper sit down.'],
  },
  tomas: {
    round: ['Shutters up, kettle on. Morning, everyone!', 'Smells like a good market day, that.', 'Right then. Who wants a turnip?'],
    ability: ['Market day! Stalls up before he has his boots on.', 'There we go, another awning. Mind your heads.', 'Bit of bunting never hurt anybody.'],
    liberated: ['Ha! They are buying from us again!', 'Hear that? That is a queue. A proper queue.', 'Good people, that lot. Knew they would come back.'],
    squeezed: ['Oi, that was my good pitch.', 'He has squeezed my stall. I will set it up again, see.', 'Rough morning. We go again.'],
    last: ['Last round, folks. Sell it like you mean it.', 'Nearly home. Then pie.', 'One more day on the stalls. Let us make it count.'],
  },
  ines: {
    round: ['Vitals stable. Proceed.', 'Morning. Nobody is to panic. Yet.', 'Clinic is open. So is the market.'],
    ability: ['Second opinion: the Doubt was unfounded.', 'Diagnosis revised. The town is fine.', 'Treated. Next patient.'],
    liberated: ['Recovery confirmed. Lovely to see.', 'Clean bill of health for that one.', 'Discharged, and doing well.'],
    squeezed: ['Symptoms worsening at my stall. Monitoring.', 'That will bruise. It will also heal.', 'Pressure noted. I have seen worse.'],
    last: ['Final round. Steady hands, please.', 'Last check-up. Breathe.', 'Nearly there. Do not rush the stitches.'],
  },
  sol: {
    round: ['Good morning, Marrow, you are listening to the market!', 'Coming up: the weather, the turnips, and the truth.', 'Mic is live. Somebody say something nice.'],
    ability: ['We are on air, and the town is on our side!', 'Breaking: Hollowell stuns nobody. Back to you, Cath.', 'That is the sound of Public Trust going up.'],
    liberated: ['And the crowd goes mild! Which is wild, for here.', 'You heard it here first: free market, free town.', 'Stay tuned. That region is ours now.'],
    squeezed: ['Technical difficulties at my stall. Bear with us.', 'He has cut my feed. Rude.', 'We will be right back after this squeeze.'],
    last: ['Final segment, folks. Do not touch that dial.', 'Last round, live from the square.', 'Wrapping up the show. Big finish, please.'],
  },
}

/** The pair's opening exchange on the first round, answering Cath's pair line (item 54) instead of a stock greeting. */
export const PAIR_OPENERS: Record<string, { who: ProducerId; line: string }> = {
  'mara+tomas': { who: 'tomas', line: 'Favourite pair, she says. Mara, she means me.' },
  'ines+mara': { who: 'ines', line: 'Slow and sure is how I like my patients and my markets.' },
  'mara+sol': { who: 'sol', line: 'Mara holds the line, I read it out. Teamwork!' },
  'ines+tomas': { who: 'tomas', line: 'Honest market, healthy stalls. Doctor, after you.' },
  'sol+tomas': { who: 'sol', line: 'Loud, she says. I prefer to call it broadcast quality.' },
  'ines+sol': { who: 'ines', line: 'Watch the borders. I will watch Sol.' },
}

export interface ProducerReply {
  producer: ProducerId
  beat: ReplyBeat
  line: string
}

/**
 * Who answers this turn, and with what. The strongest beat wins (a liberation, then an ability, then a squeeze on
 * a producer's stall, then the last round, then the first round's pair opener or every third round's greeting); the
 * producer it belongs to speaks. The line is
 * picked by `seed` (the round), so a replayed turn says the same thing. Null when nothing in the turn calls for one.
 */
export function producerReply(
  events: readonly GameEvent[],
  regionsBefore: Record<RegionId, RegionState>,
  team: readonly ProducerId[],
  round: number,
  rounds: number,
  seed = round,
): ProducerReply | null {
  const pick = (producer: ProducerId, beat: ReplyBeat): ProducerReply => {
    const lines = PRODUCER_LINES[producer][beat]
    return { producer, beat, line: lines[Math.abs(seed) % lines.length]! }
  }
  const on = (p: ProducerId | undefined): p is ProducerId => !!p && team.includes(p)
  const liberated = events.find((e) => e.type === 'liberated' && on(e.producer))
  if (liberated && 'producer' in liberated) return pick(liberated.producer, 'liberated')
  const ability = events.find((e) => e.type === 'action' && e.action.kind === 'role' && on(e.producer))
  if (ability && 'producer' in ability) return pick(ability.producer, 'ability')
  for (const e of events) {
    if (e.type !== 'squeeze') continue
    const stalls = regionsBefore[e.region]?.stalls ?? {}
    const hit = team.find((p) => (stalls[p] ?? 0) > 0)
    if (hit) return pick(hit, 'squeezed')
  }
  if (round === rounds && team[0]) return pick(team[round % team.length]!, 'last')
  if (round === 1 && team.length === 2) {
    const o = PAIR_OPENERS[pairKey(team[0]!, team[1]!)]
    if (o) return { producer: o.who, beat: 'round', line: o.line }
  }
  // a quiet turn: every third round one of them passes the time of day, so the table isn't silent between beats
  if (round > 1 && round % 3 === 0 && team.length) return pick(team[Math.floor(round / 3) % team.length]!, 'round')
  return null
}
