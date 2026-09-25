import type { Scene } from './types'

// SPEC 8.2 chapter 4, "The Plan." The campaign's first two-producer chapter: Ines Farrow and Tomas Reed
// (SPEC 8.2's "Recommended" pair) team up under Cath's plan, with Cath's Plan (Schemes), the AI teammate
// and the Kingsmarket guard rule all switched on for the first time.
export const SCENES: Record<'opening' | 'closing', Scene> = {
  opening: {
    lines: [
      { speaker: 'Cath', line: "Two farms, one plan. Ines Farrow and Tomas Reed, meet the whiteboard." },
      { speaker: 'Ines', line: 'You drew Kingsmarket in the middle and underlined it three times.' },
      { speaker: 'Cath', line: "It's guarded. We don't walk in the front door until we've taken two of its neighbours." },
      { speaker: 'Tomas', line: "And Cath's Plan? Those cards in your coat pocket?" },
      { speaker: 'Cath', line: 'Schemes. My favourite kind of cheating: all of it legal.' },
      { speaker: 'Ines', line: "I proved Candor's study was fabricated this morning. Small print, big lie." },
      { speaker: 'Cath', line: 'Good. Keep proving things. Liberate three regions and Kingsmarket opens its gate.' },
    ],
  },
  closing: {
    lines: [
      { speaker: 'Tomas', line: 'Three regions down. Kingsmarket is close enough to smell the coffee stalls.' },
      { speaker: 'Ines', line: 'Cath, you look like someone who just found a hole in a fence.' },
      { speaker: 'Cath', line: 'Pip Talbot pulled me aside today. Said someone in our circle is talking to the other side.' },
      { speaker: 'Ines', line: 'Talking how?' },
      { speaker: 'Cath', line: "I don't know yet. But I intend to find out before they finish the sentence." },
    ],
  },
}
