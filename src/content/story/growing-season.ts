import type { Scene } from './types'

// SPEC 8.2 chapter 3, "Growing Season." Tomas Reed's vegetable round grows into a real operation; the
// Market opens, seeded with an attractively cheap "Wholesome Hollow Contract" — whose real owner is
// revealed mid-chapter (the "twist" scene, scripted at the start of round 5 by `CHAPTER_3.scriptedTrigger`).
export const SCENES: Record<'opening' | 'twist' | 'closing', Scene> = {
  opening: {
    lines: [
      { speaker: 'Cath', line: "Tomas Reed runs the Saturday market in Oakvale. He knows everyone's name and most of their orders." },
      { speaker: 'Tomas', line: "Four regions this time. I've got a stall in each, or I will by Tuesday." },
      { speaker: 'Cath', line: "Growth needs money, and money needs a market. Time to buy in, not just dig in." },
      { speaker: 'Tomas', line: 'There’s a lovely little contract going round — "Wholesome Hollow." Two Marks, extra income. Practically a gift.' },
      { speaker: 'Cath', line: 'Nothing with a name that friendly is ever just a gift. But take it. We’ll find out what it costs later.' },
    ],
  },
  twist: {
    lines: [
      { speaker: 'Cath', line: "I read the small print on your contract. The kind of small print that needs a magnifying glass and a lawyer." },
      { speaker: 'Tomas', line: 'Wholesome Hollow. Local, honest, family-run. Says so right on the label.' },
      { speaker: 'Cath', line: 'The label lies. The label is owned, three companies deep, by Hollowell Group.' },
      { speaker: 'Tomas', line: 'So every contract I signed is quietly opening a door in my own market.' },
      { speaker: 'Cath', line: "Exactly. Tear them up when you can afford to — three Marks and a moment's pride." },
    ],
  },
  closing: {
    lines: [
      { speaker: 'Tomas', line: 'Three regions liberated. The market’s busier than it’s been in years.' },
      { speaker: 'Cath', line: 'And your phone is about to ring. Graham Pell doesn’t call people he’s not worried about.' },
      { speaker: 'Tomas', line: 'He wants to buy my farm. Said it like he was doing me a favour.' },
      { speaker: 'Cath', line: 'He always does. Hang up, Tomas. We’re not selling — we’re just getting started.' },
    ],
  },
}
