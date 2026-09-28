import type { Scene } from './types'

// SPEC 8.2 chapter 4, "The Plan." The campaign's first two-producer chapter: Ines Farrow and Tomas Reed
// (SPEC 8.2's "Recommended" pair) team up under Cath's plan, with Cath's Plan (Schemes), the AI teammate
// and the Kingsmarket guard rule all switched on for the first time.
// SPEC 8.2 ch3 carry-over: "each contract not torn up by the end of the chapter adds 1 Outlet to Oakvale
// in chapter 4 (maximum 2), with a rueful line from Tomas." Shown (App.tsx) right before `opening`, only
// when at least 1 "Wholesome Hollow Contract" survived chapter 3 — one short scene per surviving count.
export const SCENES: Record<'opening' | 'closing' | 'contracts1' | 'contracts2', Scene> = {
  contracts1: {
    lines: [{ speaker: 'Tomas', line: "Never did tear up that last contract. There's an Outlet in Oakvale market this morning to prove it." }],
  },
  contracts2: {
    lines: [{ speaker: 'Tomas', line: "Kept both contracts too long. Oakvale's got two new Outlets to show for my hesitation." }],
  },
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
