// Runnel seasons: the date picks the palette, the weather in Bea's drawing and her postcard line.

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export function seasonOf(date: string): Season {
  const month = Number(date.slice(5, 7))
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

const POSTCARDS: Record<Season, string> = {
  spring: 'Postcard from Bea: "The lambs came out today and one sat in the carrots!"',
  summer: 'Postcard from Bea: "It is so hot the sunflowers are looking at the water."',
  autumn: 'Postcard from Bea: "I jumped in the leaves and found a pumpkin the size of me."',
  winter: 'Postcard from Bea: "Frost on the cabbages. I drew faces in it before breakfast."',
}

export function postcard(season: Season): string {
  return POSTCARDS[season]
}

/** Falling weather for Bea's sky, as SVG: blossom, sun rays, leaves or snow. */
export function weatherMarkup(season: Season): string {
  const dots = (n: number, fill: string, r: number): string => {
    let s = ''
    for (let i = 0; i < n; i++) {
      const x = 18 + ((i * 53) % 200)
      const y = 6 + ((i * 29) % 36)
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" class="bea-bloom"/>`
    }
    return s
  }
  if (season === 'spring') return dots(7, '#f4b6c8', 2.4)
  if (season === 'autumn') return dots(7, '#d9772b', 2.6)
  if (season === 'winter') return dots(10, '#ffffff', 1.8)
  return ''
}
