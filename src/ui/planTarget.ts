// Plan item 100: a plan card's target line with each region drawn as a chip. The line comes from
// `planPreview` (words, so the accessible name stays a sentence); this splits it at the region names so the
// card can draw them as chips, dropping the ' · ' and ', ' separators between chips (the chips' gap does that).
export interface TargetPart {
  text: string
  /** Set when this part is a region's name. */
  region?: boolean
  /** Set on the space that stands in for a dropped separator between two chips. */
  sep?: boolean
}

export function splitTarget(line: string, names: readonly string[]): TargetPart[] {
  const wanted = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (wanted.length === 0) return [{ text: line }]
  const escaped = wanted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  const parts: TargetPart[] = []
  for (const bit of line.split(re)) {
    if (bit === '') continue
    if (wanted.includes(bit)) parts.push({ text: bit, region: true })
    else parts.push({ text: bit })
  }
  // A separator between two chips (or a trailing one) goes; the chips' own gap stands in for it.
  return parts
    .map((p, i) => {
      if (p.region) return p
      const sep = /^\s*[·,]\s*$/.test(p.text)
      return sep && parts[i - 1]?.region && parts[i + 1]?.region ? { text: ' ', sep: true } : p
    })
    .filter((p) => p.text !== '')
}
