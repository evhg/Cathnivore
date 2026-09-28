import type { Scene } from './types'

// SPEC 8.2 chapter 6, "Kingsmarket." The finale: the full game, standard win. Cath's Plan starts locked
// (she's not here for it) and unlocks the moment the 2nd region is liberated, per `CHAPTER_6.scriptedTrigger`.
export const SCENES: Record<'opening' | 'planUnlocked' | 'closing', Scene> = {
  opening: {
    lines: [
      { speaker: 'Ines', line: 'No Cath. No Plan. Just the two of us and a very large map.' },
      { speaker: 'Tomas', line: 'She left notes. Mostly underlined. Some of them twice.' },
      { speaker: 'Ines', line: "Then we liberate our way to her. Two regions, and we're getting her out." },
      { speaker: 'Tomas', line: 'Kingsmarket last. Same as always.' },
    ],
  },
  planUnlocked: {
    lines: [
      { speaker: 'Tomas', line: 'Two regions down. And—' },
      { speaker: 'Cath', line: "Did you miss me? Don't answer, I already know." },
      { speaker: 'Ines', line: 'How are you even here.' },
      { speaker: 'Cath', line: "Bea had her school play. I was never missing that for a corporate land grab." },
      { speaker: 'Cath', line: 'A very good lawyer and a very bad case against me. Now. Pass me my Plan.' },
    ],
  },
  closing: {
    lines: [
      { speaker: 'Tomas', line: 'Kingsmarket. Open. Actually open.' },
      { speaker: 'Cath', line: 'Graham Pell just issued a statement welcoming healthy competition.' },
      { speaker: 'Ines', line: 'From a man who spent six months trying to buy every stall in it.' },
      { speaker: 'Cath', line: 'That is the sound of a man who has run out of clever things to say. I could listen to it all day.' },
      { speaker: 'Cath', line: 'The market reopens Saturday. Bring cash, and bring an appetite. We earned both.' },
    ],
  },
}
