// Plan item 36: which vignette a card draws (see Vignette.tsx), keyed by its first tag.
export type VignetteKind = 'pasture' | 'crop' | 'coast' | 'community' | 'media' | 'science' | 'rift' | 'market' | 'plan'

export const VIGNETTE_KINDS: readonly VignetteKind[] = ['pasture', 'crop', 'coast', 'community', 'media', 'science', 'rift', 'market', 'plan']

export function vignetteFor(card: { tags?: readonly string[] }): VignetteKind {
  const tag = card.tags?.[0]
  return tag && (VIGNETTE_KINDS as readonly string[]).includes(tag) ? (tag as VignetteKind) : 'plan'
}

export function vignetteHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
