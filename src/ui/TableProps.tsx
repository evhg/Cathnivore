// Plan item 28: the market table's props. Bea's crayon drawing of her mum at the market, pinned at the top
// left corner of the cloth, and two crates of produce at the foot on the right. They sit under the board
// (the map paints over them wherever a layout reaches the corner) and never take a tap.

export function BeasDrawing() {
  return (
    <svg className="table-prop beas-drawing" viewBox="0 0 100 80" aria-hidden="true" focusable="false">
      <rect x="2" y="3" width="96" height="74" rx="2" fill="var(--paper-hi)" stroke="var(--ink-a35)" strokeWidth="1" />
      <path d="M2 70 Q50 66 98 71" fill="none" stroke="var(--pasture)" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      {/* the sun */}
      <circle cx="84" cy="16" r="7" fill="var(--wheat)" opacity=".9" />
      <path d="M84 4 V7 M84 25 V28 M72 16 H75 M93 16 H96 M76 8 L78 10 M90 22 L92 24 M76 24 L78 22 M90 10 L92 8" stroke="var(--wheat)" strokeWidth="1.6" strokeLinecap="round" />
      {/* the stall */}
      <path d="M50 40 H76 V66 M50 40 V66" fill="none" stroke="var(--clay-deep)" strokeWidth="2" strokeLinecap="round" />
      <path d="M47 40 L52 32 H74 L79 40 Z" fill="var(--clay)" opacity=".85" />
      <path d="M52 52 H74" stroke="var(--clay-deep)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="57" cy="49" r="2.4" fill="var(--clay)" /><circle cx="63" cy="49" r="2.4" fill="var(--pasture)" /><circle cx="69" cy="49" r="2.4" fill="var(--wheat)" />
      {/* Mum: long dark hair, a green coat, a big smile */}
      <path d="M22 26 C14 28 15 48 18 52 M34 26 C42 28 41 48 38 52" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="28" cy="28" r="7" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.4" />
      <path d="M25 30 Q28 33 31 30" fill="none" stroke="var(--clay-deep)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="25.5" cy="27" r=".9" fill="var(--ink)" /><circle cx="30.5" cy="27" r=".9" fill="var(--ink)" />
      <path d="M28 35 L19 58 H37 Z" fill="var(--pasture)" stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M22 44 L13 38 M34 44 L44 40" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M24 58 V66 M32 58 V66" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
      {/* Bea, holding Mum's hand */}
      <circle cx="44" cy="46" r="4.4" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.2" />
      <path d="M44 51 L39 62 H49 Z" fill="var(--clay)" stroke="var(--ink)" strokeWidth="1" strokeLinejoin="round" />
      <path d="M41 63 V67 M47 63 V67" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
      <text x="8" y="17" className="beas-drawing-word">MUM</text>
      {/* the pin */}
      <circle cx="50" cy="6" r="3.4" fill="var(--clay-deep)" stroke="var(--ink)" strokeWidth=".8" />
    </svg>
  )
}

export function ProduceCrates() {
  const crate = (x: number, y: number, fills: string[]) => (
    <g>
      {fills.map((f, i) => (
        <circle key={i} cx={x + 7 + i * 8.5} cy={y - 1 + (i % 2) * -2} r="5" fill={f} stroke="var(--ink)" strokeWidth=".8" />
      ))}
      <rect x={x} y={y} width="40" height="22" rx="1.5" fill="var(--wood)" stroke="var(--wood-lo)" strokeWidth="1.2" />
      <path d={`M${x} ${y + 7.5} H${x + 40} M${x} ${y + 14.5} H${x + 40}`} stroke="var(--wood-lo)" strokeWidth="1" />
      <path d={`M${x + 3} ${y + 2} V${y + 20} M${x + 37} ${y + 2} V${y + 20}`} stroke="var(--wood-lo)" strokeWidth="1.4" opacity=".7" />
    </g>
  )
  return (
    <svg className="table-prop produce-crates" viewBox="0 0 92 52" aria-hidden="true" focusable="false">
      <ellipse cx="46" cy="49" rx="44" ry="3" fill="var(--ink-a15)" />
      {crate(2, 26, ['var(--clay)', 'var(--clay)', 'var(--wheat)', 'var(--clay)'])}
      {crate(48, 26, ['var(--pasture)', 'var(--pasture)', 'var(--pasture)', 'var(--pasture)'])}
      {crate(26, 6, ['var(--wheat)', 'var(--clay-deep)', 'var(--wheat)', 'var(--wheat)'])}
    </svg>
  )
}
