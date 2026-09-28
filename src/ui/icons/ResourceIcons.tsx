import type { ReactNode } from 'react'

// STYLE.md 5: flat-fill icons on a 24px grid with a 2px ink outline, readable at 16px.
// STYLE.md 3.1/3.5: never hard-code a colour outside the token file, since dark theme redefines these.
const INK = 'var(--ink, #2B2320)'
const CLAY = 'var(--clay, #B5523B)'
const PASTURE = 'var(--pasture, #5B7F3A)'
const WHEAT = 'var(--wheat, #D9B45A)'
const PAPER_2 = 'var(--paper-2, #EAE0CF)'

function Base({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-inline">
      {children}
    </svg>
  )
}

export function ProduceIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <path d="M12 10 C 8 10 6 14 7 20 L 17 20 C 18 14 16 10 12 10 Z" fill={CLAY} stroke={INK} strokeWidth={1.5} />
      <path d="M 11 10 Q 8 6 5 7 Q 7 10 11 10 Z" fill={PASTURE} stroke={INK} strokeWidth={1.2} />
      <path d="M 13 10 Q 16 5 19 6 Q 17 10 13 10 Z" fill={PASTURE} stroke={INK} strokeWidth={1.2} />
    </Base>
  )
}

export function MarksIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" fill={WHEAT} stroke={INK} strokeWidth={1.5} />
      <text x="12" y="16.5" fontSize="11" fontWeight="700" textAnchor="middle" fill={INK}>
        m
      </text>
    </Base>
  )
}

export function GoodwillIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="6" fill={WHEAT} stroke={INK} strokeWidth={1.5} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1="12"
          y1="3"
          x2="12"
          y2="5.5"
          stroke={INK}
          strokeWidth={1.5}
          strokeLinecap="round"
          transform={`rotate(${a} 12 12)`}
        />
      ))}
    </Base>
  )
}

export function PublicTrustIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <circle cx="9" cy="11" r="4" fill={PAPER_2} stroke={INK} strokeWidth={1.4} />
      <circle cx="15" cy="11" r="4" fill={PAPER_2} stroke={INK} strokeWidth={1.4} />
    </Base>
  )
}

export function LostLandIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" fill={CLAY} stroke={INK} strokeWidth={1.5} />
      <path d="M 4 12 L 10 8 L 14 13 L 20 9 M 9 20 L 13 14" fill="none" stroke={INK} strokeWidth={1.1} />
    </Base>
  )
}

export function RiftIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" fill={PAPER_2} stroke={INK} strokeWidth={1.5} />
      <path d="M 12 4 L 9 12 L 13 12 L 10 20" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
    </Base>
  )
}

export function RoundIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" fill={PAPER_2} stroke={INK} strokeWidth={1.5} />
      <path d="M 4 9 L 20 9" stroke={INK} strokeWidth={1.3} />
      <path d="M 8 12 Q 10 15 8 17" fill="none" stroke={PASTURE} strokeWidth={1.5} strokeLinecap="round" />
    </Base>
  )
}

export function ActionsLeftIcon({ total, left }: { total: number; left: number }) {
  const n = Math.max(total, 1)
  return (
    <svg width={16 * n} height={16} viewBox={`0 0 ${24 * n} 24`} aria-hidden="true" className="icon-inline">
      {Array.from({ length: total }, (_, i) => (
        <circle key={i} cx={12 + i * 24} cy={12} r={7} fill={i < left ? INK : 'none'} stroke={INK} strokeWidth={1.5} />
      ))}
    </svg>
  )
}

// ROADMAP 10 "Round, Trust, Lost Land and Rift become illustrated gauges": a progress ring drawn on the
// exact same 24px grid as the icon it overlays (see `.hud-icon-ring` in global.css), instead of a
// separate bar next to it — earlier sessions shipped a bar (`MiniGauge`, since removed) but it needed
// extra horizontal width the desktop topbar never had room for (measured directly against
// `desktop-no-scroll.spec.ts`: even an 8px sliver still overflowed by ~17px at 1280px), so it only ever
// shipped on phone. A ring adds zero width — it's the same size as the icon it wraps — so it needs no
// phone/desktop split at all. One neutral fill colour for all 4 stats rather than a good/bad tint per
// stat: Round climbing is neutral progress, Trust climbing is good, but Lost Land and Rift climbing are
// both bad — no single colour-by-direction is honest across all 4 (same reasoning as the HUD tick
// animation staying colourless).
export function GaugeRing({ value, max, size = 16 }: { value: number; max: number; size?: number }) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const radius = 11
  const circumference = 2 * Math.PI * radius
  const dash = fraction * circumference
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="hud-ring">
      <circle cx="12" cy="12" r={radius} fill="none" stroke={PAPER_2} strokeWidth={2} />
      {dash > 0 && (
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke={INK}
          strokeWidth={2}
          opacity={0.55}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 12 12)"
        />
      )}
    </svg>
  )
}
