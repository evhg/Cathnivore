import { useRef } from 'react'

// Plan item 184: the Market Board's four readings as objects on the table, not web bar meters. Round is a
// chalk slate of tally marks, Trust a glass jar of tokens, Land a stack of deed cards and the Rift a plate
// that cracks. Each is decorative (the cell's number and label are the readable value) and stages its
// change: a tally chalks on, a token drops in, a deed tears off, a crack runs. A fade under reduced motion.

export type BoardObjectKind = 'slate' | 'jar' | 'deeds' | 'plate'

/** The last change of `value`: its direction and a counter that remounts the staged element. */
function useChange(value: number): { dir: number; tick: number; from: number } {
  const prev = useRef(value)
  const state = useRef({ dir: 0, tick: 0, from: value })
  if (prev.current !== value) {
    state.current = { dir: Math.sign(value - prev.current), tick: state.current.tick + 1, from: prev.current }
    prev.current = value
  }
  return state.current
}

const ghostClass = (i: number, lit: number, next: number) =>
  next > lit && i >= lit && i < next ? 'bo-ghost-gain' : next < lit && i >= next && i < lit ? 'bo-ghost-loss' : ''

export function BoardObject({ kind, value, max, preview }: { kind: BoardObjectKind; value: number; max: number; preview?: number }) {
  const n = Math.max(1, max)
  const lit = Math.max(0, Math.min(n, value))
  const next = preview === undefined ? lit : Math.max(0, Math.min(n, preview))
  const change = useChange(lit)
  const fresh = (i: number) => change.dir > 0 && change.tick > 0 && i >= change.from && i < lit
  const cls = (base: string, i: number) => [base, i < lit ? 'on' : 'off', fresh(i) ? 'bo-new' : '', ghostClass(i, lit, next)].filter(Boolean).join(' ')
  const freshKey = (i: number) => (fresh(i) ? `${i}-${change.tick}` : `${i}`)

  if (kind === 'slate') {
    // Groups of five: four upright strokes and the fifth struck through them. Rounds to come are faint.
    const groups = Math.ceil(n / 5)
    const step = Math.min(4.6, 46 / (groups * 4 + (groups - 1) * 1.6))
    const gw = step * 4 + step * 1.6
    const x0 = 30 - (groups * gw - step * 1.6) / 2 + step / 2
    const marks = Array.from({ length: n }, (_, i) => {
      const g = Math.floor(i / 5)
      const k = i % 5
      const gx = x0 + g * gw
      const d = k < 4 ? `M${(gx + k * step).toFixed(1)} 12.5 l0.6 19` : `M${(gx - step * 0.7).toFixed(1)} 28 L${(gx + step * 3.7).toFixed(1)} 15`
      return <path key={freshKey(i)} className={cls('bo-tally', i)} d={d} pathLength={1} />
    })
    return (
      <svg className="board-object bo-slate-obj" viewBox="0 0 60 44" aria-hidden="true" data-object="slate">
        <rect className="bo-wood" x="1" y="3" width="58" height="38" rx="4" />
        <rect className="bo-slate" x="4.5" y="6.5" width="51" height="31" rx="2" />
        <path className="bo-smudge" d="M9 33 q10 -3 20 0 t20 -1" />
        {marks}
      </svg>
    )
  }

  if (kind === 'jar') {
    // Tokens settle from the bottom, four to a row with alternate rows offset, fifteen in a full jar.
    const pos = (i: number) => {
      const row = Math.floor(i / 4)
      const col = i % 4
      return { x: 9.6 + col * 5.4 + (row % 2 ? 2.7 : 0), y: 37 - row * 6 }
    }
    const tokens: JSX.Element[] = []
    for (let i = 0; i < n; i++) {
      if (i >= Math.max(lit, next) && !(change.dir < 0 && i < change.from && i >= lit)) continue
      const { x, y } = pos(i)
      const leaving = change.dir < 0 && i >= lit && i < change.from
      tokens.push(<circle key={leaving ? `${i}-out-${change.tick}` : freshKey(i)} className={leaving && !ghostClass(i, lit, next) ? 'bo-token bo-out' : cls('bo-token', i)} cx={x} cy={y} r="2.75" />)
    }
    return (
      <svg className="board-object bo-jar-obj" viewBox="0 0 36 44" aria-hidden="true" data-object="jar">
        <ellipse className="bo-shadow" cx="18" cy="42" rx="13" ry="1.8" />
        <path className="bo-glass" d="M8 9 h20 v3 q5 2 5 8 v17 q0 4 -4 4 h-22 q-4 0 -4 -4 v-17 q0 -6 5 -8 z" />
        {tokens}
        <path className="bo-glint" d="M7.5 19 v13" />
        <rect className="bo-lid" x="7" y="3.5" width="22" height="6" rx="1.6" />
      </svg>
    )
  }

  if (kind === 'deeds') {
    // A squared stack, one deed a region still to lose; the top deed carries a seal. A lost deed tears off.
    const cards: JSX.Element[] = []
    const top = Math.max(lit, next)
    const step = Math.min(2.6, 22 / n)
    for (let i = 0; i < top; i++) {
      const y = 33 - i * step
      const tilt = i % 3 === 0 ? -1.2 : i % 3 === 1 ? 0.9 : 0
      cards.push(<rect key={freshKey(i)} className={cls('bo-deed', i)} x="7" y={y - 12} width="34" height="13" rx="1.4" transform={`rotate(${tilt} 24 ${y - 6})`} />)
    }
    if (change.dir < 0 && change.tick > 0) {
      for (let i = lit; i < change.from; i++) {
        const y = 33 - i * step
        cards.push(<rect key={`${i}-out-${change.tick}`} className="bo-deed bo-tear" x="7" y={y - 12} width="34" height="13" rx="1.4" />)
      }
    }
    const sealY = 33 - (Math.max(1, lit) - 1) * step - 5.5
    return (
      <svg className="board-object bo-deeds-obj" viewBox="0 0 48 44" aria-hidden="true" data-object="deeds">
        <ellipse className="bo-shadow" cx="24" cy="40" rx="19" ry="2" />
        {lit === 0 && <rect className="bo-deed-empty" x="7" y="21" width="34" height="13" rx="1.4" />}
        {cards}
        {lit > 0 && <circle className="bo-seal" cx="34" cy={sealY} r="3" />}
        {lit > 0 && <path className="bo-deed-line" d={`M11 ${sealY - 2} h14 M11 ${sealY + 1.5} h10`} />}
      </svg>
    )
  }

  // The plate: one crack a Rift step, each running from the rim further in; from the fourth it splits.
  const cracks = ['M22 2.5 l-1.5 6 l2 4 l-1.6 5', 'M41 18 l-6 2 l-3 4 l-5 1', 'M8 37 l5 -5 l1 -4 l4 -3', 'M37 36 l-4 -5 l-4 -1 l-3 -5', 'M3 16 l6 2 l3 4 l5 1', 'M24 41.5 l-1 -6 l2 -4 l-2 -9.5']
  return (
    <svg className={lit >= 4 ? 'board-object bo-plate-obj bo-split' : 'board-object bo-plate-obj'} viewBox="0 0 44 44" aria-hidden="true" data-object="plate">
      <ellipse className="bo-shadow" cx="22" cy="41.5" rx="17" ry="2" />
      <circle className="bo-plate" cx="22" cy="21.5" r="19.5" />
      <circle className="bo-plate-well" cx="22" cy="21.5" r="12.5" />
      {cracks.slice(0, n).map((d, i) => (i < Math.max(lit, next) ? <path key={freshKey(i)} className={cls('bo-crack', i)} d={d} pathLength={1} /> : null))}
    </svg>
  )
}
