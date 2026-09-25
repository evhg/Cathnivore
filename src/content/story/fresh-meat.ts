import type { Scene } from './types'

// SPEC 8.2 chapter 1, "Fresh Meat." Cath arrives at Mara Keel's farm in Brindle Hills; a new Hollowell
// Outlet is undercutting her beef. Pip Talbot, the friendly market inspector, is helping — for now.
export const SCENES: Record<'opening' | 'closing', Scene> = {
  opening: {
    lines: [
      { speaker: 'Cath', line: "Mara Keel. Brindle Hills. Best beef in Marrow, and a queue outside her gate for once." },
      { speaker: 'Cath', line: "Wrong kind of queue. It's for the Outlet that opened across the lane." },
      { speaker: 'Mara', line: 'They sell my own cattle back to my neighbours, cheaper. I looked into suing. There is no law against being awful.' },
      { speaker: 'Cath', line: "There's a market stall, though. And a farmer who still shows up to it." },
      { speaker: 'Pip', line: "Pip Talbot, market inspector. I clip badges, I don't take sides. Open a Stall here and you're back in business." },
      { speaker: 'Cath', line: 'One stall. One farmer. Against a company with a marketing department. Normal Tuesday, honestly.' },
    ],
  },
  closing: {
    lines: [
      { speaker: 'Mara', line: 'Highmoor and Brindle Hills, clean. First time in months my ledger looks like mine.' },
      { speaker: 'Cath', line: "Don't get used to it. Kingsmarket's still theirs, and they noticed us." },
      { speaker: 'Pip', line: "Speaking of noticed — there's a van outside the market with a cyan logo on it. Wasn't there yesterday." },
      { speaker: 'Cath', line: "Candor. If Hollowell sells the food, Candor sells the doubt. Different company, same lane." },
    ],
  },
}
