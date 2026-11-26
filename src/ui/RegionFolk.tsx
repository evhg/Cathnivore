import type { CSSProperties } from 'react'
import type { FolkControl, Shopper } from './regionFolk'

// Plan item 717: the market's shoppers (regionFolk.ts places them), drawn in the board's ink: a coat, a head, a
// basket on some. Each strolls between its two ends and pauses at each (styles: .region-folk in table.css), turning
// to face the way it walks; still under reduced motion. Held land's few shoppers go grey.

export default function RegionFolk({ folk, control, seed }: { folk: readonly Shopper[]; control: FolkControl; seed: number }) {
  if (!folk.length) return null
  return (
    <g className="region-folk" data-control={control ?? 'none'} data-folk={folk.length} pointerEvents="none" aria-hidden="true">
      {folk.map((f, i) => {
        const dx = f.x1 - f.x0
        const walk = { ['--wx' as string]: `${dx}px`, ['--wy' as string]: `${f.y1 - f.y0}px` } as CSSProperties
        return (
          <g key={i} transform={`translate(${f.x0},${f.y0})`}>
            <g className={dx ? 'folk-walk' : 'folk-stand'} data-pace={(i + seed) % 3} style={walk}>
              <g transform={`scale(${f.s})`}>
                <g className="folk-face" data-dir={dx < 0 ? 'l' : 'r'}>
                  <ellipse cx={0} cy={0} rx={3.8} ry={0.9} className="folk-shadow" />
                  <path className="folk-legs" d="M-1.4,0 L-1.1,-5.2 M1.4,0 L1.1,-5.2" />
                  <path className="folk-coat" data-tone={f.tone} d="M-3.6,-4.6 L-2.5,-11.6 Q0,-13 2.5,-11.6 L3.6,-4.6 Z" />
                  {f.tone % 2 === 0 && <path className="folk-basket" d="M2.4,-8.6 h3.6 l-0.6,2.8 h-2.4 Z M2.9,-8.6 q1.3,-2.2 2.6,0" />}
                  <circle className="folk-head" data-skin={(f.tone + i) % 3} cx={0} cy={-14.6} r={2.5} />
                  {f.tone % 3 === 1 && <path className="folk-hat" d="M-3.6,-15.6 h7.2 M-2.1,-15.6 v-1.8 h4.2 v1.8" />}
                </g>
              </g>
            </g>
          </g>
        )
      })}
    </g>
  )
}
