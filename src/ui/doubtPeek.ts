// Plan item 654: what a Doubt piece says about itself, on the board (its accessible name) and in its peek card.
export const DOUBT_PEEK = {
  title: 'Doubt',
  body: "Candor's leaflet, a rumour about the co-op. While it's here, each Squeeze costs Public Trust. Rebut it, 1 Goodwill each, from a region with your Stall.",
} as const

export function doubtLabel(n: number, region: string): string {
  return `${n} Doubt in ${region}: Candor's leaflet. It costs Public Trust when Hollowell squeezes here; Rebut removes it.`
}
