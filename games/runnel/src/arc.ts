// The weekday arc's dates and words alone (no engine), so the site's market board can name today's board
// without loading Runnel (plan item 682).

/** First daily on the weekday difficulty arc; earlier dailies keep their boards (they are in saves). */
export const ARC_FROM = '2026-11-02'

/** The arc's difficulty word per weekday (Sunday = 0), shown beside the daily's title. */
const ARC_LABELS = ['Hardest', 'Gentle', 'Easy', 'Steady', 'Tricky', 'Hard', 'Harder']

export function arcLabel(dateString: string): string | null {
  if (dateString < ARC_FROM) return null
  return ARC_LABELS[new Date(`${dateString}T00:00:00Z`).getUTCDay()]!
}
