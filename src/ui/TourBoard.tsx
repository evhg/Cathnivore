// Plan item 8: How to Play's pages are illustrated with a mini Marrow — the real seven-region layout (Kingsmarket in
// the middle, six regions round it) with the pieces each page is about drawn on it, in the board's own colours.
export type TourPiece = 'stall' | 'stall2' | 'outlet' | 'buyout' | 'doubt'
export interface TourHex {
  fill: string
  /** Up to three pieces in a row across the hex. */
  pieces?: TourPiece[]
  /** A big mark in the hex (an action number, a "?"). */
  mark?: string
  /** A ring round the hex: ours (liberated, solid green) or theirs (at risk, dashed clay). */
  ring?: 'ours' | 'theirs'
  /** Lost Land: the hex is hatched over. */
  lost?: boolean
  /** The hex the page is about: drawn on top, the others dimmed. */
  focus?: boolean
}
export interface TourCard {
  kind: 'improvement' | 'scheme'
  name: string
}

const R = 30
const W = Math.sqrt(3) * R
// Kingsmarket, then the ring clockwise from the top left (as on the real map).
const CENTRES: Array<[number, number]> = [
  [0, 0],
  [-W / 2, -1.5 * R],
  [W / 2, -1.5 * R],
  [W, 0],
  [W / 2, 1.5 * R],
  [-W / 2, 1.5 * R],
  [-W, 0],
]
const hexPts = (r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k - Math.PI / 2
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
const HEX = hexPts(R - 1)
const RING = hexPts(R + 2.5)

function Piece({ kind, x, y }: { kind: TourPiece; x: number; y: number }) {
  switch (kind) {
    case 'stall':
    case 'stall2':
      // A market stall: an awning over a counter, in the producer's colour.
      return (
        <g transform={`translate(${x} ${y})`}>
          <rect x={-5} y={-1} width={10} height={7} fill="var(--paper-on-fixed-fill)" stroke="var(--ink-on-fixed-fill)" strokeWidth={1} />
          <path d="M-7,-1 L-5,-6 L5,-6 L7,-1 Z" fill={kind === 'stall' ? 'var(--sea)' : 'var(--clay-deep)'} stroke="var(--ink-on-fixed-fill)" strokeWidth={1} />
        </g>
      )
    case 'outlet':
      return (
        <g transform={`translate(${x} ${y})`}>
          <rect x={-5} y={-8} width={10} height={14} rx={1} fill="var(--hollowell)" stroke="var(--hollowell-ink)" strokeWidth={1} />
          <path d="M-3,-5 h6 M-3,-2 h6 M-3,1 h6" stroke="var(--hollowell-ink)" strokeWidth={1} />
        </g>
      )
    case 'buyout':
      return (
        <g transform={`translate(${x} ${y})`}>
          <polygon points="0,-8 7,-2 5,6 -5,6 -7,-2" fill="var(--candor)" stroke="var(--candor-ink)" strokeWidth={1} />
        </g>
      )
    case 'doubt':
      return (
        <g transform={`translate(${x} ${y})`}>
          <circle r={6.5} fill="var(--candor-highlight)" stroke="var(--candor-ink)" strokeWidth={1} />
          <text textAnchor="middle" dy={3.5} fontSize={10} fontWeight={800} fill="var(--candor-ink)">?</text>
        </g>
      )
  }
}

function Card({ card, x }: { card: TourCard; x: number }) {
  const improvement = card.kind === 'improvement'
  return (
    <g transform={`translate(${x} 0) rotate(${improvement ? -6 : 5})`}>
      <rect x={-26} y={-36} width={52} height={72} rx={5} fill="var(--paper-hi)" stroke="var(--ink-on-fixed-fill)" strokeWidth={1.4} />
      <rect x={-22} y={-32} width={44} height={30} rx={3} fill={improvement ? 'var(--wheat)' : 'var(--sea)'} />
      <text textAnchor="middle" y={-12} fontSize={16} fontWeight={800} fill="var(--ink-on-fixed-fill)">{improvement ? '+' : '✦'}</text>
      <text textAnchor="middle" y={10} fontSize={6.4} fontWeight={800} fill="var(--ink-on-fixed-fill)">
        {improvement ? 'IMPROVEMENT' : 'SCHEME'}
      </text>
      <text textAnchor="middle" y={22} fontSize={7} fill="var(--ink-on-fixed-fill)">{card.name}</text>
    </g>
  )
}

export default function TourBoard({ hexes, cards, label }: { hexes: TourHex[]; cards?: TourCard[]; label: string }) {
  const anyFocus = hexes.some((h) => h.focus)
  const boardW = 2 * W + W + 8
  const cardsW = cards?.length ? cards.length * 62 + 10 : 0
  const order = hexes.map((h, i) => ({ h, i })).sort((a, b) => Number(!!a.h.focus) - Number(!!b.h.focus))
  return (
    <svg className="tour-board" viewBox={`${-boardW / 2} ${-2.5 * R - 6} ${boardW + cardsW} ${5 * R + 12}`} role="img" aria-label={label}>
      <defs>
        <pattern id="tour-lost" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={6} height={6} fill="var(--paper-3)" />
          <line x1={0} y1={0} x2={0} y2={6} stroke="var(--soil)" strokeWidth={2.2} />
        </pattern>
      </defs>
      {order.map(({ h, i }) => {
        const [cx, cy] = CENTRES[i]!
        const pieces = h.pieces ?? []
        return (
          <g key={i} transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)})`} opacity={anyFocus && !h.focus ? 0.55 : 1}>
            {h.ring && (
              <polygon
                points={RING}
                fill="none"
                stroke={h.ring === 'ours' ? 'var(--pasture-deep)' : 'var(--clay-deep)'}
                strokeWidth={3}
                strokeDasharray={h.ring === 'theirs' ? '6 4' : undefined}
              />
            )}
            <polygon points={HEX} fill={h.lost ? 'url(#tour-lost)' : h.fill} stroke="var(--ink)" strokeWidth={h.focus ? 2.4 : 1.4} />
            {h.mark && (
              <text textAnchor="middle" dy={pieces.length ? -6 : 7} fontSize={pieces.length ? 13 : 20} fontWeight={800} fill="var(--ink-on-fixed-fill)">
                {h.mark}
              </text>
            )}
            {pieces.map((p, k) => (
              <Piece key={k} kind={p} x={(k - (pieces.length - 1) / 2) * 15} y={h.mark ? 12 : 3} />
            ))}
          </g>
        )
      })}
      {cards?.map((c, k) => <Card key={k} card={c} x={boardW / 2 + 36 + k * 62} />)}
    </svg>
  )
}
