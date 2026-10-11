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
    // AAA UI M4, the table (src/styles/tokens.css "Market Day Press")
    { label: 'ink on card stock foot', fg: '#2B2320', bg: '#F6F0E4' },
    { label: 'ink-muted on card stock foot (board labels)', fg: '#6E625A', bg: '#F6F0E4' },
    { label: 'soil on card stock (frame titles)', fg: '#6B4A2B', bg: '#FBF8F1' },
    { label: 'newsprint-ink on newsprint (clippings)', fg: '#2B2320', bg: '#EFEAE0' },
    { label: 'gain-ink on surface (ledger +2)', fg: '#466A2B', bg: '#FBF8F1' },
    { label: 'short-ink on paper-2 (why-not chips)', fg: '#9E4430', bg: '#EAE0CF' },
    { label: 'wheat-ink on paper', fg: '#7A5B14', bg: '#F4EDE1' },
    { label: 'ink on wheat (coins)', fg: '#2B2320', bg: '#D9B45A' },
    { label: 'clay-deep on card (Last 3 label)', fg: '#9E4430', bg: '#F6F0E4' },
    { label: 'dark: ink on surface', fg: '#F1E9DC', bg: '#332C27' },
    { label: 'dark: ink-muted on card foot', fg: '#B8AC9F', bg: '#2D2722' },
    { label: 'dark: soil on surface (frame titles)', fg: '#D9B98A', bg: '#332C27' },
    { label: 'dark: gain-ink on surface', fg: '#A5C982', bg: '#332C27' },
    { label: 'dark: short-ink on paper-2', fg: '#E8957F', bg: '#2A2420' },
    { label: 'dark: newsprint-ink on newsprint', fg: '#2B2320', bg: '#C2B9A8' },
    { label: 'round bunting: paper on soil cloth (both themes)', fg: '#F4EDE1', bg: '#6B4A2B' },
    { label: 'round bunting sub: wheat-hi on soil cloth', fg: '#E8C877', bg: '#6B4A2B' },
    { label: 'dark: newsprint-ink on newsprint-lo (clipping foot)', fg: '#2B2320', bg: '#B5AB99' },
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
    // AAA UI M3, the field kit (games/hedgerow/src/tokens.css)
    { label: 'cream on harvest (Next)', fg: '#FFF7E6', bg: '#9A4F12' },
    { label: 'cream on pasture-deep (Go)', fg: '#FFF7E6', bg: '#466A2B' },
    { label: 'cream on oak-ink (HUD counters)', fg: '#FFF7E6', bg: '#3A2716' },
    { label: 'brass-hi on oak-ink (HUD place)', fg: '#F2D27A', bg: '#3A2716' },
    { label: 'cream on oak-lo (tray labels, the plank)', fg: '#FFF7E6', bg: '#4A3220' },
    { label: 'cream on clay-deep (leak ribbon)', fg: '#FFF7E6', bg: '#8F3B27' },
    { label: 'cream on cath (hero ribbon)', fg: '#FFF7E6', bg: '#7A3B52' },
    { label: 'cream on path-1 (packet header)', fg: '#FFF7E6', bg: '#365A8A' },
    { label: 'ink on card', fg: '#2B2320', bg: '#FBF3E2' },
    { label: 'ink-2 on card', fg: '#5E5249', bg: '#FBF3E2' },
    { label: 'ink-3 on card', fg: '#6E625A', bg: '#FBF3E2' },
    { label: 'path-0 on its soft fill (tier label)', fg: '#8F3B27', bg: '#F6DDD3' },
    { label: 'path-1 on its soft fill (tier label)', fg: '#365A8A', bg: '#DCE6F2' },
    { label: 'path-2 on its soft fill (tier label)', fg: '#466A2B', bg: '#E1EBD4' },
    { label: 'ink-2 on path-0 soft (effect line)', fg: '#5E5249', bg: '#F6DDD3' },
    { label: 'corp on plastic (advert label)', fg: '#0E5E63', bg: '#FFFFFF' },
    { label: 'on-oak-dim on oak (Knockouts line, spent abilities)', fg: '#E6D9BF', bg: '#6B4A2B' },
    { label: 'on-oak-dim on oak-lo (tray plank)', fg: '#E6D9BF', bg: '#4A3220' },
    // Dark ("Evening at the fete", M3 subset): the field kit's text under prefers-color-scheme: dark
    { label: 'dark: on-oak-dim on oak (Knockouts line)', fg: '#E6D9BF', bg: '#553A22' },
    { label: 'dark: on-oak-dim on oak-hi (head top)', fg: '#E6D9BF', bg: '#7A5634' },
    { label: 'dark: path-0 glow on its soft fill (tier label)', fg: '#E59A86', bg: '#3B231C' },
    { label: 'dark: path-1 glow on its soft fill (tier label)', fg: '#9DBBE0', bg: '#1E2A3A' },
    { label: 'dark: path-2 glow on its soft fill (tier label)', fg: '#9CCB6E', bg: '#23301A' },
    { label: 'dark: path-0 glow on card (locked tier label)', fg: '#E59A86', bg: '#2A221D' },
    { label: 'dark: ink-2 on card', fg: '#D6C7B2', bg: '#2A221D' },
    { label: 'dark: ink-3 on paper-hi', fg: '#B9AA98', bg: '#3A2F27' },
    { label: 'dark: ink-2 on path-0 soft (effect line)', fg: '#D6C7B2', bg: '#3B231C' },
    { label: 'corp-ink on plastic shade (advert body)', fg: '#0B2E31', bg: '#E6EEF0' },
    { label: 'kraft on oak-lo (waiting Go)', fg: '#D9C9A8', bg: '#4A3220' },
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
