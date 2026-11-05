// Plan item 167: the desktop rail's player mat. The active producer's three resources as things on a wooden mat:
// Produce as a crate heaped with veg, Marks as a stack of coins, Goodwill as a rosette. Each piece fills with its
// count (capped, the figure beside it is exact). Decorative: the chips around them carry the words.

const VEG = ['var(--clay)', 'var(--pasture)', 'var(--wheat)', 'var(--clay-deep)']

/** A crate of produce: one piece of veg showing per Produce, up to 9, heaped over the rim. */
export function MatCrate({ count }: { count: number }) {
  const n = Math.max(0, Math.min(9, count))
  // a heap: the bottom row first (4), then 3, then 2
  const spots = [
    [14, 30], [26, 31], [38, 30], [50, 31],
    [20, 23], [32, 23], [44, 23],
    [26, 16], [38, 16],
  ] as const
  return (
    <svg className="mat-art mat-crate" viewBox="0 0 64 60" aria-hidden="true" focusable="false">
      <ellipse cx="32" cy="57" rx="28" ry="2.6" fill="var(--ink-a15)" />
      {spots.slice(0, n).map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6.2" fill={VEG[(i * 3 + 1) % VEG.length]} stroke="var(--ink)" strokeWidth=".9" />
          <path d={`M${x - 1.5} ${y - 6} q1.5 -3 3.5 -2.4`} fill="none" stroke="var(--pasture-deep)" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ))}
      <rect x="4" y="32" width="56" height="24" rx="2" fill="var(--wood)" stroke="var(--wood-lo)" strokeWidth="1.4" />
      <path d="M4 40 H60 M4 48 H60" stroke="var(--wood-lo)" strokeWidth="1.1" />
      <path d="M8 34 V54 M56 34 V54" stroke="var(--wood-lo)" strokeWidth="1.6" opacity=".75" />
      <path d="M10 37 L54 51" stroke="var(--wood-lo)" strokeWidth="1" opacity=".35" />
    </svg>
  )
}

/** A stack of Marks: one coin per Mark, up to 8, a second short stack beside it past 4. */
export function MatCoins({ count }: { count: number }) {
  const n = Math.max(0, Math.min(8, count))
  const coin = (x: number, y: number, k: number) => (
    <g key={`${x}-${k}`}>
      <ellipse cx={x} cy={y + 2.2} rx="12" ry="4.4" fill="var(--clay-deep)" stroke="var(--ink)" strokeWidth=".9" />
      <ellipse cx={x} cy={y} rx="12" ry="4.4" fill="var(--wheat)" stroke="var(--ink)" strokeWidth=".9" />
      <ellipse cx={x} cy={y} rx="7" ry="2.4" fill="none" stroke="var(--ink-a35)" strokeWidth=".8" />
    </g>
  )
  const left = Math.min(n, 4)
  const right = n - left
  return (
    <svg className="mat-art mat-coins" viewBox="0 0 64 60" aria-hidden="true" focusable="false">
      <ellipse cx="32" cy="55" rx="28" ry="3" fill="var(--ink-a15)" />
      {n === 0 && <ellipse cx="32" cy="50" rx="13" ry="5" fill="none" stroke="var(--ink-a35)" strokeWidth="1" strokeDasharray="2.5 2" />}
      {Array.from({ length: left }, (_, i) => coin(right > 0 ? 22 : 32, 48 - i * 6.4, i))}
      {Array.from({ length: right }, (_, i) => coin(44, 50 - i * 6.4, i + 10))}
    </svg>
  )
}

/** Goodwill as a ribbon rosette: the petals ring fills, one petal a point, up to 8. */
export function MatRosette({ count }: { count: number }) {
  const n = Math.max(0, Math.min(8, count))
  return (
    <svg className="mat-art mat-rosette" viewBox="0 0 64 60" aria-hidden="true" focusable="false">
      <ellipse cx="32" cy="57" rx="20" ry="2.4" fill="var(--ink-a15)" />
      <path d="M26 34 L19 56 L25 52 L28 57 L31 36 Z" fill="var(--clay)" stroke="var(--ink)" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M38 34 L45 56 L39 52 L36 57 L33 36 Z" fill="var(--clay-deep)" stroke="var(--ink)" strokeWidth=".9" strokeLinejoin="round" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2
        const x = 32 + Math.cos(a) * 12
        const y = 25 + Math.sin(a) * 12
        return <circle key={i} cx={x} cy={y} r="7" fill={i < n ? 'var(--pasture)' : 'var(--wood-ink)'} stroke="var(--ink)" strokeWidth=".9" />
      })}
      <circle cx="32" cy="25" r="10" fill="var(--paper-hi)" stroke="var(--ink)" strokeWidth="1" />
      <path d="M27 25 q5 -7 10 0 q-5 7 -10 0 Z" fill="var(--pasture)" opacity=".85" />
    </svg>
  )
}
