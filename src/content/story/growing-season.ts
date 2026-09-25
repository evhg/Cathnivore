import type { Scene } from './types'

// SPEC 8.2 chapter 3, "Growing Season." Tomas Reed's vegetable round grows into a real operation; the
// Market opens, seeded with an attractively cheap "Wholesome Hollow Contract" — whose real owner is
// revealed at the chapter's close.
export const SCENES: Record<'opening' | 'closing', Scene> = {
  opening: {
    lines: [
      { speaker: 'Cath', line: "Tomas Reed runs the Saturday market in Oakvale. He knows everyone's name and most of their orders." },
      { speaker: 'Tomas', line: "Four regions this time. I've got a stall in each, or I will by Tuesday." },
      { speaker: 'Cath', line: "Growth needs money, and money needs a market. Time to buy in, not just dig in." },
      { speaker: 'Tomas', line: 'There’s a lovely little contract going round — "Wholesome Hollow." Two Marks, extra income. Practically a gift.' },
      { speaker: 'Cath', line: 'Nothing with a name that friendly is ever just a gift. But take it. We’ll find out what it costs later.' },
    ],
  },
  closing: {
    lines: [
      { speaker: 'Tomas', line: 'Three regions liberated. The market’s busier than it’s been in years.' },
      { speaker: 'Cath', line: 'And your phone is about to ring. Graham Pell doesn’t call people he’s not worried about.' },
      { speaker: 'Tomas', line: 'He wants to buy my farm. Said it like he was doing me a favour.' },
      { speaker: 'Cath', line: 'He always does. Hang up. We’ve got a Wholesome Hollow contract to have words about, next.' },
    ],
  },
}
