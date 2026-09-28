import type { Scene } from './types'

// SPEC 8.2 chapter 2, "Word of Mouth." Candor's "Natural Is Risky" campaign targets Sol Abara's podcast.
export const SCENES: Record<'opening' | 'closing', Scene> = {
  opening: {
    lines: [
      { speaker: 'Cath', line: 'Sol Abara runs a lamb farm and a podcast. Today the podcast has more listeners than usual, for a bad reason.' },
      { speaker: 'Sol', line: 'Some outfit called Candor put out a study. "Natural Is a Risk Factor." My comments are a nightmare.' },
      { speaker: 'Cath', line: "A study funded by the people it flatters. Shocking. Truly, be still my heart." },
      { speaker: 'Sol', line: "Doubt spreads faster than facts. I know that. Doesn't make it easier to watch." },
      { speaker: 'Cath', line: "Then we answer it in public, region by region. Rebut what needs rebutting. Keep talking." },
    ],
  },
  closing: {
    lines: [
      { speaker: 'Sol', line: "Two regions clean, and the listeners came back. Turns out 'actually, here's the data' still works." },
      { speaker: 'Cath', line: 'Octavia Vane runs Candor’s public understanding, which is a job title that means the opposite of what it says.' },
      { speaker: 'Cath', line: "She's just invited me to lunch. Personally. That's either a compliment or a warning shot." },
      { speaker: 'Sol', line: 'With her, why not both.' },
    ],
  },
}
