import CathArt from './CathArt'

// The title screen's illustration (STYLE.md 1: "a farmers'-market poster"): the seven regions of Marrow as
// a hex flower, market stalls popping up across them, co-op seals stamping onto the liberated ones, and
// Cath in front. Purely decorative (aria-hidden); every animation is CSS so reduced motion stills it.
// Stagger delays come from numbered classes (ta-d0..., ta-r0..., ta-s0...), not inline styles: the CSP
// allows no inline style attributes.

const R = 60 // hex circumradius
const W = R * Math.sqrt(3)

type Kind = 'pasture' | 'crop' | 'coast' | 'capital'

// Same layout and region types as the game map: Kingsmarket in the middle, the rest around it.
const REGIONS: Array<{ name: string; q: number; r: number; kind: Kind; seal?: boolean }> = [
  { name: 'Highmoor', q: 0, r: -1, kind: 'pasture', seal: true },
  { name: 'Saltmarsh', q: 1, r: -1, kind: 'coast' },
  { name: 'Brindle Hills', q: -1, r: 0, kind: 'pasture' },
  { name: 'Kingsmarket', q: 0, r: 0, kind: 'capital' },
  { name: 'Rivermead', q: 1, r: 0, kind: 'crop', seal: true },
  { name: 'Oakvale', q: -1, r: 1, kind: 'crop' },
  { name: 'Shingle Bay', q: 0, r: 1, kind: 'coast' },
]

// Stall positions, as offsets inside each region, in the order they pop up.
const STALLS: Array<[number, number, number]> = [
  [2, -14, 8], [0, -16, 24], [4, 16, 24], [2, 12, 16], [1, 14, 14], [5, -10, 12],
  [3, 0, 8], [6, 14, 10], [0, 16, 24], [4, -16, 24],
]

function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = ((60 * k + 30) * Math.PI) / 180
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function centre(q: number, r: number): [number, number] {
  return [W * (q + r / 2), 1.5 * R * r]
}

function Stall({ x, y, i }: { x: number; y: number; i: number }) {
  return (
    <g className={`ta-stall ta-d${i}`} transform={`translate(${x} ${y})`}>
      <g className="ta-stall-inner">
        <rect x={-9} y={-2} width={18} height={11} rx={1.5} className="ta-stall-body" />
        <path d="M-12 -2 L-9 -10 L9 -10 L12 -2 Z" className="ta-awning" />
        <path d="M-6 -10 L-7.5 -2 M0 -10 L0 -2 M6 -10 L7.5 -2" className="ta-awning-stripe" />
        <path d="M-12 -2 q2 3 4 0 q2 3 4 0 q2 3 4 0 q2 3 4 0 q2 3 4 0 q2 3 4 0" className="ta-scallop" />
      </g>
    </g>
  )
}

function Seal({ x, y, i }: { x: number; y: number; i: number }) {
  const petals = Array.from({ length: 6 }, (_, k) => {
    const a = (k * 60 * Math.PI) / 180
    return <circle key={k} cx={Math.cos(a) * 11} cy={Math.sin(a) * 11} r={7} className="ta-seal-petal" />
  })
  return (
    <g className={`ta-seal ta-s${i}`} transform={`translate(${x} ${y})`}>
      <g className="ta-seal-inner">
        {petals}
        <circle r={10} className="ta-seal-centre" />
        <path d="M-4.5 0.5 L-1 4 L5 -3.5" className="ta-seal-tick" />
      </g>
    </g>
  )
}

export default function TitleArt() {
  return (
    <div className="title-art" aria-hidden="true">
      <svg className="title-map" viewBox="-190 -175 380 350">
        <defs>
          <pattern id="ta-strokes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="5" className="ta-texture" />
          </pattern>
          <pattern id="ta-dots" width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" className="ta-texture-fill" />
          </pattern>
          <pattern id="ta-waves" width="16" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 5 q4 -4 8 0 t8 0" className="ta-texture" />
          </pattern>
          <pattern id="ta-cobbles" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect x="1" y="1" width="10" height="10" rx="3" className="ta-texture" />
          </pattern>
        </defs>
        <g className="ta-sunburst">
          {Array.from({ length: 18 }, (_, k) => (
            <path key={k} d="M0 0 L-14 -200 L14 -200 Z" transform={`rotate(${k * 20})`} />
          ))}
        </g>
        <g className="ta-board">
          <g className="ta-shadow">
            {REGIONS.map((reg) => {
              const [x, y] = centre(reg.q, reg.r)
              return <polygon key={reg.name} points={hexPoints(R * 0.97)} transform={`translate(${x} ${y + 9})`} />
            })}
          </g>
          {REGIONS.map((reg, i) => {
            const [x, y] = centre(reg.q, reg.r)
            const pattern = { pasture: 'ta-strokes', crop: 'ta-dots', coast: 'ta-waves', capital: 'ta-cobbles' }[reg.kind]
            return (
              <g key={reg.name} className={`ta-region ta-${reg.kind} ta-r${i}`} transform={`translate(${x} ${y})`}>
                <g className="ta-region-inner">
                  <polygon points={hexPoints(R * 0.97)} className="ta-hex" />
                  <polygon points={hexPoints(R * 0.97)} fill={`url(#${pattern})`} />
                  <text y={-R * 0.42} className="ta-label">
                    {reg.name.toUpperCase()}
                  </text>
                </g>
              </g>
            )
          })}
          {STALLS.map(([region, dx, dy], i) => {
            const reg = REGIONS[region]!
            const [x, y] = centre(reg.q, reg.r)
            return <Stall key={i} x={x + dx} y={y + dy} i={i} />
          })}
          {REGIONS.filter((reg) => reg.seal).map((reg, i) => {
            const [x, y] = centre(reg.q, reg.r)
            return <Seal key={reg.name} x={x} y={y - 2} i={i} />
          })}
        </g>
      </svg>
      <div className="title-cath">
        <CathArt framing="half" expression="smirk" animate />
      </div>
    </div>
  )
}
