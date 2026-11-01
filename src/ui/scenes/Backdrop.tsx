import type { ReactNode } from 'react'

// Plan item 5 (ROADMAP 58, U7): a painted backdrop per chapter for the graphic-novel Scene. Each is one
// full-bleed SVG (1600x900, sliced to the viewport from the bottom centre) built in layers like a matte
// painting: a sky wash, atmospheric distance that fades toward the sky colour, the set, then a foreground.
// The horizon sits a little above the middle because the bottom third is under the speakers and caption.
// Gradient ids are prefixed per chapter; only one Scene is ever on screen.

const W = 1600
const H = 900

/** A seeded pseudo-random so the scattered details (stars, crates, sheep) are fixed between renders. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function Sky({ id, stops }: { id: string; stops: [number, string][] }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" x2="0" y1="0" y2="1">
          {stops.map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-sky)`} />
    </>
  )
}

function Glow({ id, cx, cy, r, color, opacity = 0.8 }: { id: string; cx: number; cy: number; r: number; color: string; opacity?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-glow-${cx}`}>
          <stop offset="0" stopColor={color} stopOpacity={opacity} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-glow-${cx})`} />
    </>
  )
}

/** A rolling ridge line from x=0 to W at about `y`, with `amp` wobble. */
function ridge(y: number, amp: number, seed: number, step = 160): string {
  const r = rng(seed)
  let d = `M 0 ${y}`
  for (let x = 0; x < W; x += step) {
    const cy = y - amp * (0.3 + r())
    d += ` Q ${x + step / 2} ${cy} ${x + step} ${y + amp * (r() - 0.5) * 0.6}`
  }
  return `${d} V ${H} H 0 Z`
}

// 1. Fresh Meat: Mara's farm gate in Brindle Hills at golden hour; her stall at the gate, and across the
// lane the new Hollowell Outlet with its queue.
function FreshMeat() {
  const id = 'bd1'
  const r = rng(11)
  return (
    <>
      <Sky id={id} stops={[[0, '#F6C98A'], [0.45, '#F9E2B4'], [0.62, '#FCEFD2']]} />
      <Glow id={id} cx={1180} cy={430} r={520} color="#FFE7A8" />
      <circle cx={1180} cy={440} r={58} fill="#FFF3D0" />
      {/* clouds lit from below */}
      <path d="M 160 170 q 60 -50 140 -20 q 50 -40 120 0 q 70 0 60 40 h -330 z M 860 120 q 50 -36 110 -10 q 40 -30 100 4 q 50 6 40 30 h -260 z" fill="#FFF6E2" opacity={0.75} />
      <path d="M 140 196 h 360 M 860 146 h 260" stroke="#F2B878" strokeWidth={6} strokeLinecap="round" opacity={0.5} />
      <path d={ridge(470, 70, 3, 220)} fill="#D9C8A0" />
      <path d={ridge(510, 60, 5, 180)} fill="#BFB884" />
      {/* hedgerow lines and field patchwork */}
      <path d="M 0 540 Q 400 500 800 530 T 1600 520" stroke="#7E8A4E" strokeWidth={10} fill="none" opacity={0.6} />
      <path d={ridge(560, 40, 9, 260)} fill="#A3AE6C" />
      {/* the Hollowell Outlet across the lane: a boxy orange shed with a queue */}
      <g transform="translate(1040 420)">
        <rect x={0} y={40} width={300} height={130} fill="#E46A1E" />
        <rect x={0} y={40} width={300} height={130} fill="url(#bd1-shade)" />
        <rect x={-10} y={28} width={320} height={18} fill="#B4500F" />
        <rect x={110} y={-6} width={110} height={34} rx={4} fill="#FFF3E2" />
        <circle cx={132} cy={11} r={9} fill="#E46A1E" />
        <rect x={146} y={6} width={62} height={10} rx={2} fill="#E46A1E" />
        <rect x={30} y={80} width={70} height={90} fill="#F7B67A" />
        <rect x={200} y={78} width={74} height={40} fill="#FFD9A8" />
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i} transform={`translate(${-20 - i * 26} ${148 + (i % 2) * 3})`}>
            <rect x={-6} y={0} width={12} height={22} rx={5} fill={['#6B5B7A', '#4E6A8C', '#7A4E3E', '#5C6B57'][i % 4]} />
            <circle cx={0} cy={-6} r={6} fill="#D9A876" />
          </g>
        ))}
      </g>
      <defs>
        <linearGradient id="bd1-shade" x1="0" x2="1">
          <stop offset="0" stopColor="#5A1E00" stopOpacity={0.35} />
          <stop offset="0.6" stopColor="#5A1E00" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* the lane */}
      <path d="M 700 900 Q 860 640 980 560 L 1010 560 Q 980 660 1000 900 Z" fill="#D8C08E" />
      <path d="M 0 600 Q 500 560 1000 580 T 1600 590 V 900 H 0 Z" fill="#8FA05A" />
      {/* dry-stone wall and the farm gate */}
      <path d="M 0 640 Q 300 610 640 624 L 640 664 Q 300 650 0 680 Z" fill="#A89C86" />
      {Array.from({ length: 34 }, (_, i) => (
        <ellipse key={i} cx={10 + i * 19} cy={636 - i * 0.6 + (i % 2) * 10} rx={11} ry={7} fill={i % 3 ? '#BDB29C' : '#958A74'} stroke="#7A705E" strokeWidth={1.5} />
      ))}
      <g transform="translate(640 560)" stroke="#5E4024" strokeWidth={8} strokeLinecap="round">
        <path d="M 0 0 V 120 M 200 0 V 120" strokeWidth={14} />
        <path d="M 0 20 H 200 M 0 50 H 200 M 0 80 H 200 M 0 110 H 200 M 0 110 L 200 20" stroke="#8A6238" />
      </g>
      {/* Mara's stall: striped awning, crates and a chalkboard */}
      <g transform="translate(260 460)">
        <path d="M -10 60 L 330 60 L 300 0 L 20 0 Z" fill="#F4EDE1" />
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} d={`M ${20 + i * 40} 0 L ${40 + i * 40} 0 L ${46 + i * 48 - i * 8} 60 L ${-10 + i * 48} 60 Z`} fill="#6E7C4B" />
        ))}
        <path d="M -10 60 q 24 22 48 0 q 24 22 48 0 q 24 22 48 0 q 24 22 48 0 q 24 22 48 0 q 24 22 48 0 q 24 22 48 0" fill="#F4EDE1" stroke="#56623A" strokeWidth={3} />
        <path d="M 4 60 V 220 M 316 60 V 220" stroke="#5E4024" strokeWidth={10} />
        <rect x={-6} y={150} width={332} height={70} fill="#8A6238" />
        <rect x={-6} y={150} width={332} height={10} fill="#A87C4A" />
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i} transform={`translate(${14 + i * 52} 118)`}>
            <rect width={44} height={32} fill="#B98A52" stroke="#6B4A26" strokeWidth={2} />
            {Array.from({ length: 4 }, (_, k) => (
              <circle key={k} cx={8 + k * 10} cy={-2 - r() * 6} r={7} fill={['#A63F55', '#C9566B', '#8A3447', '#D4AE58', '#6E7C4B'][Math.floor(r() * 5)]} />
            ))}
          </g>
        ))}
        <g transform="translate(360 150)">
          <path d="M 0 0 L 70 0 L 64 80 L 6 80 Z" fill="#2E2A26" stroke="#5E4024" strokeWidth={5} />
          <path d="M 14 22 h 40 M 14 38 h 30 M 14 54 h 36" stroke="#F4EDE1" strokeWidth={4} strokeLinecap="round" />
        </g>
      </g>
      {/* long golden-hour shadows across the grass */}
      <path d="M 0 760 Q 400 720 900 740 L 900 900 L 0 900 Z" fill="#5E6E3A" opacity={0.45} />
      {Array.from({ length: 60 }, (_, i) => (
        <path key={i} d={`M ${i * 27 + r() * 10} 900 q ${r() * 8 - 4} -${30 + r() * 30} ${r() * 10 - 5} -${50 + r() * 30}`} stroke="#6E7C3E" strokeWidth={3} fill="none" opacity={0.6} />
      ))}
    </>
  )
}

// 2. Word of Mouth: Sol's lambing shed at dusk, the podcast light on, and a cyan Candor van in the yard.
function WordOfMouth() {
  const id = 'bd2'
  const r = rng(23)
  return (
    <>
      <Sky id={id} stops={[[0, '#3E3866'], [0.35, '#8A5C86'], [0.55, '#E9967A'], [0.66, '#F7C58E']]} />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={r() * W} cy={r() * 260} r={r() * 1.8 + 0.6} fill="#FFF6E8" opacity={0.5 + r() * 0.5} />
      ))}
      <Glow id={id} cx={300} cy={560} r={420} color="#FFB37A" opacity={0.7} />
      <path d={ridge(500, 80, 7, 240)} fill="#7A5A7A" opacity={0.85} />
      <path d={ridge(540, 60, 13, 200)} fill="#5E4A6A" />
      {/* signal mast with a red light */}
      <path d="M 1380 520 L 1400 260 L 1420 520 M 1386 440 L 1414 440 M 1390 360 L 1410 360 M 1384 470 L 1412 400 M 1390 400 L 1416 470" stroke="#2E2440" strokeWidth={4} fill="none" />
      <circle cx={1400} cy={256} r={6} fill="#FF4A4A" />
      <Glow id={id} cx={1400} cy={256} r={40} color="#FF4A4A" opacity={0.6} />
      <path d="M 0 590 Q 400 560 800 580 T 1600 570 V 900 H 0 Z" fill="#43395A" />
      {/* sheep on the slope, lit pink on the sunset side */}
      {Array.from({ length: 14 }, (_, i) => {
        const x = 60 + i * 110 + r() * 40
        const y = 600 + r() * 50
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${0.7 + r() * 0.3})`}>
            <ellipse cx={0} cy={0} rx={22} ry={14} fill="#E8DDE6" />
            <ellipse cx={-6} cy={-4} rx={14} ry={8} fill="#F8EEF2" />
            <ellipse cx={22} cy={-4} rx={7} ry={6} fill="#2E2440" />
            <path d="M -10 12 v 8 M 10 12 v 8" stroke="#2E2440" strokeWidth={3} />
          </g>
        )
      })}
      {/* the lambing shed with the studio window */}
      <g transform="translate(820 400)">
        <path d="M -20 110 L 210 0 L 440 110 Z" fill="#3A2E3E" />
        <rect x={0} y={108} width={420} height={210} fill="#6E4A3E" />
        {Array.from({ length: 21 }, (_, i) => (
          <path key={i} d={`M ${i * 20} 108 V 318`} stroke="#563A30" strokeWidth={2} />
        ))}
        <rect x={60} y={160} width={130} height={90} fill="#FFC870" />
        <Glow id={id} cx={125} cy={205} r={160} color="#FFB45A" opacity={0.55} />
        <path d="M 60 160 h 130 v 90 h -130 Z M 125 160 v 90 M 60 205 h 130" stroke="#3A2620" strokeWidth={5} fill="none" />
        {/* microphone on a boom in the window */}
        <path d="M 96 250 L 112 196 L 140 186" stroke="#2A1E1A" strokeWidth={4} fill="none" />
        <rect x={134} y={176} width={16} height={24} rx={7} fill="#2A1E1A" />
        <g transform="translate(-95 -90)">
        <rect x={250} y={150} width={110} height={34} rx={4} fill="#3A1414" />
        <rect x={258} y={156} width={94} height={22} rx={3} fill="#FF4A3A" />
        </g>
        <Glow id={id} cx={1030} cy={477} r={90} color="#FF4A3A" opacity={0.45} />
        <text x={210} y={83} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={16} letterSpacing={3} fill="#FFE2D6">ON AIR</text>
        <rect x={250} y={210} width={110} height={108} fill="#4A3028" />
      </g>
      {/* Candor's van */}
      <g transform="translate(300 640)">
        <path d="M 0 30 Q 0 0 30 0 L 230 0 Q 270 0 290 40 L 300 70 L 300 100 L 0 100 Z" fill="#E6F4F6" />
        <path d="M 210 6 L 252 6 Q 270 10 282 40 L 210 40 Z" fill="#5A7A88" />
        <rect x={0} y={56} width={300} height={16} fill="#2FB4CC" />
        <circle cx={60} cy={100} r={22} fill="#1E1A28" />
        <circle cx={240} cy={100} r={22} fill="#1E1A28" />
        <circle cx={34} cy={34} r={14} fill="none" stroke="#2FB4CC" strokeWidth={5} />
        <path d="M 58 28 h 70 M 58 42 h 50" stroke="#2FB4CC" strokeWidth={6} />
        <path d="M 0 0 h 300 v 100 h -300 z" fill="url(#bd2-dusk)" />
      </g>
      <defs>
        <linearGradient id="bd2-dusk" x1="0" x2="1">
          <stop offset="0" stopColor="#E9967A" stopOpacity={0.3} />
          <stop offset="1" stopColor="#3E3866" stopOpacity={0.4} />
        </linearGradient>
      </defs>
      <path d="M 0 790 Q 600 760 1600 800 V 900 H 0 Z" fill="#2E2640" />
    </>
  )
}

// 3. Growing Season: Oakvale's Saturday market on a bright morning, bunting across the square.
function GrowingSeason() {
  const id = 'bd3'
  const r = rng(37)
  const colours = ['#6E7C4B', '#C9566B', '#D4AE58', '#4E6A8C', '#E46A1E']
  return (
    <>
      <Sky id={id} stops={[[0, '#8EC3E6'], [0.5, '#CFE6F2'], [0.62, '#F4F0DE']]} />
      <path d="M 120 150 q 50 -46 120 -16 q 46 -34 110 4 q 60 4 52 36 h -282 z M 1100 110 q 40 -40 100 -12 q 40 -30 96 6 q 46 6 40 30 h -236 z M 680 210 q 30 -26 70 -8 q 30 -20 66 4 h -136 z" fill="#FFFFFF" opacity={0.9} />
      <path d={ridge(470, 50, 17, 260)} fill="#B9CFC0" />
      {/* the town: roofs and a spire */}
      <g fill="#A8A08E">
        {Array.from({ length: 12 }, (_, i) => {
          const x = i * 140 - 20
          const h = 60 + r() * 50
          return <path key={i} d={`M ${x} 520 V ${520 - h} L ${x + 60} ${490 - h} L ${x + 130} ${520 - h} V 520 Z`} fill={i % 2 ? '#B3AA96' : '#9E967F'} />
        })}
      </g>
      <path d="M 760 520 V 330 L 800 210 L 840 330 V 520 Z" fill="#8E8670" />
      <circle cx={800} cy={360} r={18} fill="#F4F0DE" stroke="#6E6650" strokeWidth={4} />
      <path d="M 800 360 V 348 M 800 360 L 810 364" stroke="#3A3428" strokeWidth={3} />
      {/* the square */}
      <path d="M 0 520 H 1600 V 900 H 0 Z" fill="#D6C7A6" />
      {Array.from({ length: 14 }, (_, i) => (
        <path key={i} d={`M ${-400 + i * 170} 900 L ${400 + i * 60} 520`} stroke="#C4B492" strokeWidth={2} />
      ))}
      {[560, 610, 680, 780].map((y) => (
        <path key={y} d={`M 0 ${y} H 1600`} stroke="#C4B492" strokeWidth={2} />
      ))}
      {/* a row of stalls with striped awnings and crates of veg */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = 30 + i * 260
        const c = colours[i % colours.length]!
        return (
          <g key={i} transform={`translate(${x} 470)`}>
            <path d="M 0 50 L 220 50 L 200 0 L 20 0 Z" fill="#FBF6EC" />
            {Array.from({ length: 5 }, (_, k) => (
              <path key={k} d={`M ${20 + k * 36} 0 L ${38 + k * 36} 0 L ${44 * k + 44 - k * 8} 50 L ${44 * k + 22 - k * 8} 50 Z`} fill={c} />
            ))}
            <path d="M 8 50 V 150 M 212 50 V 150" stroke="#6B4A26" strokeWidth={7} />
            <rect x={0} y={110} width={220} height={44} fill="#9A7044" />
            {Array.from({ length: 4 }, (_, k) => (
              <g key={k} transform={`translate(${12 + k * 52} 92)`}>
                <rect width={46} height={22} fill="#C49A62" stroke="#6B4A26" strokeWidth={2} />
                {Array.from({ length: 5 }, (_, j) => (
                  <circle key={j} cx={6 + j * 9} cy={-2 - r() * 4} r={6} fill={['#E46A1E', '#86AC5B', '#C9566B', '#F2C94C', '#5B7F3A'][(i + k + j) % 5]} />
                ))}
              </g>
            ))}
          </g>
        )
      })}
      {/* bunting */}
      {[0, 1].map((row) => (
        <g key={row}>
          <path d={`M 0 ${90 + row * 120} Q 400 ${240 + row * 120} 800 ${120 + row * 110} T 1600 ${100 + row * 130}`} stroke="#6B4A26" strokeWidth={2} fill="none" />
          {Array.from({ length: 24 }, (_, i) => {
            const t = i / 23
            const x = t * W
            const y = row * 120 + 90 + Math.sin(t * Math.PI * 2) * 60 + 70 * Math.sin(t * Math.PI)
            return <path key={i} d={`M ${x - 14} ${y} L ${x + 14} ${y} L ${x} ${y + 30} Z`} fill={colours[(i + row) % colours.length]} opacity={0.95} />
          })}
        </g>
      ))}
      <path d="M 0 800 Q 800 770 1600 800 V 900 H 0 Z" fill="#BFAE8A" />
    </>
  )
}

// 4. The Plan: Cath's kitchen as a war room after dark. The whiteboard carries the map of Marrow with
// Kingsmarket in the middle, circled and underlined three times (Ines's line), sticky notes and string.
function ThePlan() {
  const id = 'bd4'
  const r = rng(41)
  // the seven regions as a ring of hexes round Kingsmarket
  const hexPath = (cx: number, cy: number, s: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6
      return `${i ? 'L' : 'M'} ${cx + s * Math.cos(a)} ${cy + s * Math.sin(a)}`
    }).join(' ') + ' Z'
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return [800 + 92 * Math.cos(a), 330 + 92 * Math.sin(a)] as const
  })
  return (
    <>
      <Sky id={id} stops={[[0, '#3A2C24'], [0.5, '#5A4232'], [1, '#2A1E18']]} />
      {/* tiled wall */}
      <rect x={0} y={0} width={W} height={620} fill="#E8DCC4" />
      {Array.from({ length: 32 }, (_, i) => (
        <path key={`v${i}`} d={`M ${i * 50} 380 V 620`} stroke="#CDBFA4" strokeWidth={2} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <path key={`h${i}`} d={`M 0 ${380 + i * 48} H ${W}`} stroke="#CDBFA4" strokeWidth={2} />
      ))}
      <rect x={0} y={0} width={W} height={380} fill="#B8A57E" />
      <rect x={0} y={372} width={W} height={12} fill="#8A6A44" />
      {/* the window: dusk over the hills */}
      <g transform="translate(110 90)">
        <rect width={300} height={240} fill="#3E3866" />
        <rect y={120} width={300} height={120} fill="#E9967A" opacity={0.5} />
        <path d="M 0 190 Q 80 150 160 180 T 300 170 V 240 H 0 Z" fill="#4A3A5A" />
        <circle cx={220} cy={60} r={12} fill="#FFF3D0" />
        <path d="M 150 0 V 240 M 0 120 H 300" stroke="#6B4A2B" strokeWidth={10} />
        <rect width={300} height={240} fill="none" stroke="#6B4A2B" strokeWidth={16} />
        <rect x={-20} y={240} width={340} height={18} fill="#8A6A44" />
        <path d="M 20 236 q 10 -30 24 -6 q 8 -24 20 -2 v 8 h -44 Z" fill="#5B7F3A" />
        <rect x={22} y={236} width={40} height={20} fill="#B4500F" />
      </g>
      {/* the whiteboard */}
      <g>
        <rect x={540} y={110} width={520} height={400} rx={6} fill="#9AA0A6" />
        <rect x={552} y={122} width={496} height={376} fill="#F8F7F2" />
        <rect x={552} y={122} width={496} height={376} fill="url(#bd4-board)" />
        <path d={hexPath(800, 330, 52)} fill="#F2C46A" fillOpacity={0.35} stroke="#2E3A5A" strokeWidth={4} />
        {ring.map(([x, y], i) => (
          <path key={i} d={hexPath(x, y, 46)} fill={['#86AC5B', '#E9967A', '#8EC3E6', '#86AC5B', '#D4AE58', '#8EC3E6'][i]} fillOpacity={0.35} stroke="#2E3A5A" strokeWidth={3} />
        ))}
        {/* Kingsmarket, circled in red and underlined three times */}
        <ellipse cx={800} cy={330} rx={70} ry={62} fill="none" stroke="#C9302C" strokeWidth={5} transform="rotate(-8 800 330)" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${736 + i * 4} ${408 + i * 10} q 64 ${-6 + i * 3} 130 ${2 - i * 2}`} stroke="#C9302C" strokeWidth={4} fill="none" strokeLinecap="round" />
        ))}
        <path d="M 780 330 h 40 M 800 316 v 28" stroke="#2E3A5A" strokeWidth={3} />
        {/* arrows from two farms */}
        <path d="M 640 200 Q 700 220 728 286 M 722 274 l 6 12 l 8 -10" stroke="#2E7A4A" strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M 980 460 Q 920 440 880 392 M 892 394 l -12 -2 l 2 12" stroke="#2E7A4A" strokeWidth={4} fill="none" strokeLinecap="round" />
        {/* sticky notes and string */}
        {[[590, 150, '#F2E36A', -4], [960, 150, '#F7A6B8', 5], [590, 420, '#A6E3F7', 3], [990, 300, '#F2E36A', -6]].map(([x, y, c, a], i) => (
          <g key={i} transform={`rotate(${a} ${x} ${y})`}>
            <rect x={Number(x)} y={Number(y)} width={56} height={52} fill={String(c)} />
            <path d={`M ${Number(x) + 8} ${Number(y) + 16} h 36 M ${Number(x) + 8} ${Number(y) + 28} h 28 M ${Number(x) + 8} ${Number(y) + 40} h 32`} stroke="#4A4A5A" strokeWidth={2} />
          </g>
        ))}
        <path d="M 618 176 L 800 330 L 988 176 M 800 330 L 1018 326" stroke="#C9302C" strokeWidth={1.6} fill="none" opacity={0.7} />
        <rect x={600} y={498} width={400} height={12} rx={3} fill="#7A8086" />
        <rect x={660} y={490} width={40} height={8} rx={3} fill="#2E3A5A" />
        <rect x={720} y={490} width={40} height={8} rx={3} fill="#C9302C" />
      </g>
      <defs>
        <linearGradient id="bd4-board" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.6} />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="1" stopColor="#B8B0A0" stopOpacity={0.25} />
        </linearGradient>
      </defs>
      {/* shelves with jars */}
      <g transform="translate(1160 120)">
        {[0, 1].map((row) => (
          <g key={row} transform={`translate(0 ${row * 120})`}>
            <rect x={0} y={90} width={330} height={14} fill="#8A6238" />
            {Array.from({ length: 6 }, (_, i) => {
              const h = 50 + r() * 30
              return (
                <g key={i} transform={`translate(${14 + i * 52} ${90 - h})`}>
                  <rect width={40} height={h} rx={6} fill={['#D4AE58', '#A63F55', '#86AC5B', '#E46A1E', '#F4EDE1', '#6E7C4B'][(i + row) % 6]} opacity={0.85} />
                  <rect x={-2} y={-8} width={44} height={10} rx={2} fill="#6B4A26" />
                  <rect x={8} y={h * 0.35} width={24} height={14} fill="#F8F2E4" />
                </g>
              )
            })}
          </g>
        ))}
      </g>
      {/* the pendant lamp and its pool of light */}
      <path d="M 800 0 V 40" stroke="#2A1E18" strokeWidth={4} />
      <path d="M 750 70 Q 800 20 850 70 Z" fill="#2E3A3A" />
      <ellipse cx={800} cy={72} rx={18} ry={6} fill="#FFF3D0" />
      <Glow id={id} cx={800} cy={300} r={720} color="#FFD98A" opacity={0.35} />
      {/* the table edge in the foreground: mugs, papers, a pen */}
      <path d="M 0 640 H 1600 V 900 H 0 Z" fill="#6E4A2E" />
      <path d="M 0 640 H 1600 V 664 H 0 Z" fill="#8A6238" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M 0 ${690 + i * 22} Q 800 ${680 + i * 24} 1600 ${694 + i * 21}`} stroke="#5E3E24" strokeWidth={2} fill="none" opacity={0.6} />
      ))}
      <g transform="rotate(-6 700 690)">
        <rect x={620} y={660} width={180} height={120} fill="#F8F2E4" />
        <path d="M 640 690 h 120 M 640 712 h 90 M 640 734 h 110" stroke="#8A7A6A" strokeWidth={3} />
      </g>
      <g transform="translate(980 640)">
        <rect x={0} y={0} width={60} height={70} rx={8} fill="#F4EDE1" />
        <path d="M 60 18 q 26 4 0 36" stroke="#F4EDE1" strokeWidth={10} fill="none" />
        <ellipse cx={30} cy={4} rx={28} ry={6} fill="#5A3A24" />
        <path d="M 22 -10 q 6 -16 0 -30 M 36 -12 q 6 -14 0 -26" stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.5} />
      </g>
    </>
  )
}

// 5. Friends in Low Places: Saltmarsh harbour at night; warehouses, boats and a long reflection.
function FriendsInLowPlaces() {
  const id = 'bd5'
  const r = rng(53)
  return (
    <>
      <Sky id={id} stops={[[0, '#0E1424'], [0.45, '#1E2A44'], [0.6, '#33405E']]} />
      {Array.from({ length: 90 }, (_, i) => (
        <circle key={i} cx={r() * W} cy={r() * 420} r={r() * 1.6 + 0.4} fill="#E6ECFF" opacity={0.3 + r() * 0.7} />
      ))}
      <Glow id={id} cx={1260} cy={170} r={220} color="#C8D4FF" opacity={0.35} />
      <circle cx={1260} cy={170} r={44} fill="#EEF2FF" />
      <circle cx={1276} cy={160} r={40} fill="#1E2A44" opacity={0.25} />
      {/* warehouses and a crane on the quay */}
      <g fill="#141A2C">
        <path d="M 0 540 V 400 L 120 350 L 240 400 V 540 Z M 240 540 V 420 L 380 380 L 520 420 V 540 Z M 980 540 V 380 L 1120 330 L 1260 380 V 540 Z M 1260 540 V 430 H 1600 V 540 Z" />
        <path d="M 640 540 V 260 H 660 V 540 Z M 560 270 H 900 V 286 H 560 Z M 860 286 V 400" />
        <path d="M 600 270 L 650 230 L 660 270" fill="none" stroke="#141A2C" strokeWidth={8} />
      </g>
      <path d="M 860 286 V 400" stroke="#141A2C" strokeWidth={3} />
      {[[40, 460], [90, 460], [150, 460], [290, 470], [340, 470], [430, 470], [1010, 440], [1070, 440], [1150, 440], [1210, 440], [1310, 470], [1400, 470], [1500, 470]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={28} height={22} fill={i % 3 === 1 ? '#3A3E50' : '#F2C46A'} opacity={0.9} />
      ))}
      <rect x={0} y={540} width={W} height={20} fill="#2A2E3E" />
      {/* string of harbour lights */}
      <path d="M 0 520 Q 400 580 800 530 T 1600 530" stroke="#3A3E50" strokeWidth={2} fill="none" />
      {Array.from({ length: 20 }, (_, i) => {
        const t = i / 19
        const x = t * W
        const y = 530 + Math.sin(t * Math.PI * 2) * 22 + 24 * Math.sin(t * Math.PI) * (t < 0.5 ? 1 : -0.2)
        return <circle key={i} cx={x} cy={y} r={4} fill="#FFD98A" />
      })}
      {/* water with long reflections */}
      <defs>
        <linearGradient id="bd5-water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1E2840" />
          <stop offset="1" stopColor="#0A0E1A" />
        </linearGradient>
      </defs>
      <rect x={0} y={560} width={W} height={340} fill="url(#bd5-water)" />
      {Array.from({ length: 40 }, (_, i) => (
        <path key={i} d={`M ${1200 + r() * 120} ${580 + i * 8} h ${20 + r() * 40}`} stroke="#DDE4FF" strokeWidth={2} opacity={0.4 - i * 0.008} />
      ))}
      {[[40, 460], [150, 460], [340, 470], [1070, 440], [1210, 440], [1400, 470]].map(([x], i) =>
        Array.from({ length: 8 }, (_, k) => <path key={`${i}-${k}`} d={`M ${x! + r() * 10} ${590 + k * 16} h ${16 + r() * 14}`} stroke="#F2C46A" strokeWidth={3} opacity={0.45 - k * 0.05} />),
      )}
      {/* fishing boats at the quay */}
      {[[220, 600], [700, 620], [1040, 606]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M 0 0 L 220 0 L 196 40 L 20 40 Z" fill={['#7A2A2A', '#2A4A5A', '#3A3A2A'][i]} />
          <rect x={60} y={-46} width={70} height={46} fill="#D9D2C2" />
          <rect x={72} y={-36} width={20} height={16} fill="#F2C46A" />
          <path d="M 150 0 V -110 M 150 -100 L 60 -46 M 150 -100 L 210 0" stroke="#1A1E2A" strokeWidth={4} fill="none" />
          <path d="M 0 40 q 110 14 220 0" stroke="#6E7A9A" strokeWidth={2} fill="none" opacity={0.5} />
        </g>
      ))}
      {/* a lamp on the near quay */}
      <path d="M 1480 900 V 640" stroke="#0A0E18" strokeWidth={12} />
      <circle cx={1480} cy={630} r={14} fill="#FFE2A8" />
      <Glow id={id} cx={1480} cy={630} r={150} color="#FFC870" opacity={0.5} />
      <path d="M 0 840 H 1600 V 900 H 0 Z" fill="#0A0E18" />
    </>
  )
}

// 6. Kingsmarket: the great iron-and-glass market hall, warm shafts of light and Hollowell's banners.
function Kingsmarket() {
  const id = 'bd6'
  const r = rng(71)
  return (
    <>
      <Sky id={id} stops={[[0, '#3A2A22'], [0.4, '#6E4A32'], [0.62, '#C08A54']]} />
      {/* the arched glass roof, rib by rib */}
      <path d="M 0 520 V 300 Q 800 -160 1600 300 V 520 Z" fill="#8FA4A8" opacity={0.35} />
      {Array.from({ length: 31 }, (_, i) => {
        const x = i * 53.3
        const t = x / W
        const top = (1 - t) ** 2 * 300 + 2 * t * (1 - t) * -160 + t * t * 300
        return <path key={i} d={`M ${x} 520 V ${top}`} stroke="#2E241E" strokeWidth={i % 3 ? 2 : 5} opacity={0.75} />
      })}
      {[300, 210, 140].map((y, i) => (
        <path key={y} d={`M 0 ${y + 120} Q 800 ${y - 300 + i * 40} 1600 ${y + 120}`} stroke="#2E241E" strokeWidth={6} fill="none" />
      ))}
      <path d="M 0 300 Q 800 -160 1600 300" stroke="#1E1612" strokeWidth={14} fill="none" />
      {/* light shafts */}
      {[[500, 0.18], [860, 0.22], [1180, 0.16]].map(([x, o], i) => (
        <path key={i} d={`M ${x! - 40} 40 L ${x! + 40} 40 L ${x! + 220} 900 L ${x! - 20} 900 Z`} fill="#FFE2A8" opacity={o} />
      ))}
      {/* the clock */}
      <circle cx={800} cy={250} r={54} fill="#F4E6C8" stroke="#2E241E" strokeWidth={8} />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M 800 204 v 8`} stroke="#2E241E" strokeWidth={3} transform={`rotate(${i * 30} 800 250)`} />
      ))}
      <path d="M 800 250 V 214 M 800 250 L 826 262" stroke="#2E241E" strokeWidth={4} strokeLinecap="round" />
      {/* Hollowell banners */}
      {[260, 560, 1040, 1340].map((x) => (
        <g key={x} transform={`translate(${x} 250)`}>
          <path d="M 0 0 H 90 V 200 L 45 176 L 0 200 Z" fill="#E46A1E" />
          <path d="M 0 0 H 30 V 190 L 0 200 Z" fill="#B4500F" opacity={0.6} />
          <circle cx={45} cy={60} r={20} fill="#FFF3E2" />
          <circle cx={45} cy={60} r={10} fill="#E46A1E" />
          <path d="M 18 110 h 54 M 24 128 h 42" stroke="#FFF3E2" strokeWidth={6} />
          <path d="M 0 0 H 90" stroke="#2E241E" strokeWidth={6} />
        </g>
      ))}
      {/* the floor and the stalls under the gallery */}
      <path d="M 0 520 H 1600 V 900 H 0 Z" fill="#6E4E36" />
      {Array.from({ length: 20 }, (_, i) => (
        <path key={i} d={`M ${-600 + i * 180} 900 L ${560 + i * 26} 520`} stroke="#5E4230" strokeWidth={2} />
      ))}
      <rect x={0} y={460} width={W} height={60} fill="#2E241E" />
      {Array.from({ length: 16 }, (_, i) => (
        <g key={i} transform={`translate(${i * 100 + 10} 470)`}>
          <rect width={80} height={40} fill={i % 4 === 1 ? '#E46A1E' : '#4A3828'} />
          <rect x={6} y={6} width={68} height={18} fill={i % 4 === 1 ? '#FFD9A8' : '#F2C46A'} opacity={0.8} />
        </g>
      ))}
      {/* the crowd's silhouettes in the light */}
      {Array.from({ length: 26 }, (_, i) => {
        const x = 20 + i * 62 + r() * 20
        const s = 0.8 + r() * 0.4
        return (
          <g key={i} transform={`translate(${x} ${600 + r() * 40}) scale(${s})`} fill="#3A2A20" opacity={0.75}>
            <circle cx={0} cy={-58} r={11} />
            <path d="M -16 -44 Q 0 -50 16 -44 L 20 10 H -20 Z" />
          </g>
        )
      })}
      <path d="M 0 820 H 1600 V 900 H 0 Z" fill="#4A3424" />
    </>
  )
}

const BACKDROPS: Record<string, () => ReactNode> = {
  'fresh-meat': FreshMeat,
  'word-of-mouth': WordOfMouth,
  'growing-season': GrowingSeason,
  'the-plan': ThePlan,
  'friends-in-low-places': FriendsInLowPlaces,
  kingsmarket: Kingsmarket,
}

export default function Backdrop({ chapterId }: { chapterId?: string }) {
  const Paint = BACKDROPS[chapterId ?? ''] ?? FreshMeat
  return (
    <svg className="scene-backdrop" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <Paint />
      {/* Print finish over every painting: paper grain, and halftone dots that shade the top corners. */}
      <defs>
        <filter id="bd-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.1" />
          </feComponentTransfer>
        </filter>
        <pattern id="bd-dots" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx={5} cy={5} r={2} fill="#1a100a" />
        </pattern>
        <radialGradient id="bd-dot-fade" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.55" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
        <mask id="bd-dot-mask">
          <rect width={W} height={H} fill="url(#bd-dot-fade)" />
        </mask>
      </defs>
      <rect width={W} height={H} fill="url(#bd-dots)" mask="url(#bd-dot-mask)" opacity={0.16} />
      <rect width={W} height={H} filter="url(#bd-grain)" />
    </svg>
  )
}
