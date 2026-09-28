import type { Scene } from './types'

// SPEC 8.2 chapter 5, "Friends in Low Places." The full game switches on: all 7 regions, the Agenda deck
// and Rift. Story: Julian Crisp's leak points suspicion at Mara; the closing twist reveals Pip Talbot was
// Crisp's informant all along, replaying three of his "helpful" chapter-1 lines (`fresh-meat.ts`) — now
// read as reconnaissance rather than tips.
export const SCENES: Record<'opening' | 'closing', Scene> = {
  opening: {
    lines: [
      { speaker: 'Cath', line: 'Someone leaked our numbers. Julian Crisp had them before we did.' },
      { speaker: 'Ines', line: 'Crisp works both companies. He doesn’t need a source. He needs a rumour.' },
      { speaker: 'Cath', line: 'The rumour points at Mara. Convenient, since she’s the one who’d sue back.' },
      { speaker: 'Tomas', line: 'So we ignore it and keep liberating regions.' },
      { speaker: 'Cath', line: 'We ignore it loudly. Three more regions. Kingsmarket can wait its turn.' },
    ],
  },
  closing: {
    lines: [
      { speaker: 'Ines', line: 'Three regions. Kingsmarket is one good round away.' },
      { speaker: 'Cath', line: 'Good. Because I am about to be extremely inconvenienced.' },
      { speaker: 'Tomas', line: 'Cath, there are cameras outside. And two officers. And Graham Pell, smiling.' },
      { speaker: 'Cath', line: 'Fraud, apparently. Fabricated, obviously. The evidence came from Pip Talbot.' },
      { speaker: 'Pip', line: "I clip badges, I don't take sides. Open a Stall here and you're back in business." },
      { speaker: 'Pip', line: "I keep a tally of every Stall in Marrow. Habit of the job. Or so I always say." },
      { speaker: 'Pip', line: "Speaking of noticed — there's a van outside the market with a cyan logo on it." },
      { speaker: 'Cath', line: 'He was never on our side. He was counting badges for the other one.' },
      { speaker: 'Ines', line: 'Cath—' },
      { speaker: 'Cath', line: "Tell Bea I'll be home for her story. Even if it's a very late one." },
      { speaker: 'Cath', line: 'Get her out, they said. Well. Get me out, then. I’ll be waiting.' },
    ],
  },
}
