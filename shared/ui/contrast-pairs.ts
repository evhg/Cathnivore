// Declared text-on-fill pairs, one block per game, checked by tests/ui-contrast.test.ts (WCAG AA 4.5:1,
// or 3:1 where `large` is set: 24 px and up, or 18.66 px bold). Add a pair whenever a milestone adds a
// token that carries text. Values are the token values, not names, so the test needs no CSS parser.

export interface ContrastPair {
  label: string
  fg: string
  bg: string
  large?: boolean
  /** Focus rings and UI strokes: WCAG 1.4.11, 3:1. */
  ui?: boolean
}

export const CONTRAST_PAIRS: Record<string, ContrastPair[]> = {
  house: [
    { label: 'ink on paper', fg: '#2B2320', bg: '#F4EDE1' },
    { label: 'ink-muted on paper', fg: '#6E625A', bg: '#F4EDE1' },
    { label: 'ink-muted on paper-2', fg: '#6E625A', bg: '#EAE0CF' },
    { label: 'soil heading on paper', fg: '#6B4A2B', bg: '#F4EDE1' },
    { label: 'paper on pasture-deep (primary button)', fg: '#F4EDE1', bg: '#466A2B' },
    { label: 'paper on clay-deep (destructive)', fg: '#F4EDE1', bg: '#9E4430' },
    { label: 'ink on wheat (selected)', fg: '#2B2320', bg: '#D9B45A' },
    { label: 'dark: ink on paper', fg: '#F1E9DC', bg: '#1E1A17' },
    { label: 'dark: ink-muted on paper-2', fg: '#B8AC9F', bg: '#2A2420' },
    { label: 'dark: soil on paper', fg: '#D9B98A', bg: '#1E1A17' },
    { label: 'dark: clay danger text on paper', fg: '#D0705A', bg: '#1E1A17' },
  ],
  cathnivore: [
    { label: 'focus ring on paper', fg: '#1F5F99', bg: '#F4EDE1', ui: true },
    { label: 'dark: focus ring on paper', fg: '#8EC5F5', bg: '#1E1A17', ui: true },
  ],
  runnel: [
    { label: 'ink on surface', fg: '#2B2320', bg: '#FBF8F1' },
    { label: 'dark: ink on paper', fg: '#F3E9D8', bg: '#1C1714' },
    { label: 'dark: ink-muted on paper', fg: '#B9AA98', bg: '#1C1714' },
    { label: 'focus on paper', fg: '#2B2320', bg: '#F4EDE1', ui: true },
    { label: 'focus on surface', fg: '#2B2320', bg: '#FBF8F1', ui: true },
    { label: 'dark: focus on paper', fg: '#F3E9D8', bg: '#1C1714', ui: true },
  ],
  hedgerow: [
    { label: 'paper on harvest (Next button)', fg: '#FBF8F1', bg: '#9A4F12' },
    { label: 'ink on surface', fg: '#2B2320', bg: '#FBF8F1' },
    { label: 'dark: ink on paper', fg: '#F3E9D8', bg: '#1C1714' },
  ],
  cathode: [
    { label: 'ink on night', fg: '#EBE6DC', bg: '#07080B' },
    { label: 'ink-muted on night', fg: '#9A958C', bg: '#07080B' },
    { label: 'ink-muted on night-3', fg: '#9A958C', bg: '#181B24' },
    { label: 'blood-hot text on night', fg: '#FF2A47', bg: '#07080B' },
    { label: 'cream on blood (rating plate)', fg: '#FBF1DF', bg: '#C8102E' },
    { label: 'cyan system text on night', fg: '#2EE6FF', bg: '#07080B' },
    { label: 'amber reward text on night', fg: '#FFB347', bg: '#07080B' },
    { label: 'focus ring on night', fg: '#2EE6FF', bg: '#07080B', ui: true },
  ],
  landing: [
    { label: 'cream on night', fg: '#FBF1DF', bg: '#1A1119' },
    { label: 'gold eyebrow on night', fg: '#F4C774', bg: '#1A1119' },
    { label: 'focus ring on night', fg: '#FFD98A', bg: '#1A1119', ui: true },
  ],
}

function channel(v: number): number {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6)
  const n = parseInt(full, 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
