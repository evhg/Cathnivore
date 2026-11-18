// Plan item 491: the portfolio's "today in the studio" track: the last 24 hours of build sessions shown as work.
// Pure: `studioSessions` turns git commits into sessions (scripts/studio-log.ts reads git at build time and writes
// dist-site/studio.json). The repo is public, but the page carries commit subjects only: never an author, an email
// or a session link (the session id groups commits here and is dropped).

export type StudioGame = 'cathnivore' | 'hedgerow' | 'runnel' | 'nightshift' | 'portfolio'
export type StudioLane = 'A' | 'B' | 'owner'

export interface StudioCommit {
  /** Unix seconds. */
  time: number
  subject: string
  /** The Claude-Session trailer, used only to group a session's commits. */
  session: string
  files: string[]
}

export interface StudioSession {
  lane: StudioLane
  /** Unix seconds of its first and last code commit. */
  start: number
  end: number
  /** The game it touched most. */
  game: StudioGame
  /** Its code commits' subjects, newest first, each cut at its first sentence. */
  subjects: string[]
}

export interface StudioLog {
  generated: number
  sessions: StudioSession[]
}

const NOTES = /^(?:docs\/|.*\.md$|\.build-lock(?:-b)?$)/

export function gameOf(file: string): StudioGame | null {
  if (file.startsWith('games/hedgerow/')) return 'hedgerow'
  if (file.startsWith('games/runnel/')) return 'runnel'
  if (file.startsWith('games/cathode/')) return 'nightshift'
  if (file.startsWith('portfolio/') || file.startsWith('site/')) return 'portfolio'
  if (file.startsWith('src/')) return 'cathnivore'
  return null
}

/** A subject's first sentence, at most 140 characters, with anything shaped like an email or a link removed. */
export function shortSubject(subject: string): string {
  const clean = subject.replace(/\S+@\S+/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
  const first = clean.split(/(?<=[.!?])\s|:\s(?=[A-Z])/)[0] ?? clean
  const cut = first.length > 140 ? `${first.slice(0, 139).replace(/\s+\S*$/, '')}…` : first
  return cut.replace(/[.\s]+$/, '')
}

export function studioSessions(commits: readonly StudioCommit[], now: number, hours = 24): StudioLog {
  const since = now - hours * 3600
  const bySession = new Map<string, StudioCommit[]>()
  for (const c of commits) {
    if (c.time < since || c.time > now) continue
    const key = c.session || `t${Math.floor(c.time / 3600)}`
    bySession.set(key, [...(bySession.get(key) ?? []), c])
  }
  const sessions: StudioSession[] = []
  for (const group of bySession.values()) {
    const tagged = group.find((c) => /^Lane [AB]\b/.test(c.subject))
    const lane: StudioLane = tagged ? (tagged.subject[5] as 'A' | 'B') : 'owner'
    const code = group.filter((c) => !/^Lane [AB]\b/.test(c.subject) && c.files.some((f) => !NOTES.test(f)))
    if (code.length === 0) continue
    const count = new Map<StudioGame, number>()
    for (const c of code) for (const f of c.files) {
      const g = gameOf(f)
      if (g) count.set(g, (count.get(g) ?? 0) + 1)
    }
    const game = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'cathnivore'
    const sorted = [...code].sort((a, b) => b.time - a.time)
    sessions.push({ lane, start: sorted[sorted.length - 1]!.time, end: sorted[0]!.time, game, subjects: sorted.map((c) => shortSubject(c.subject)) })
  }
  sessions.sort((a, b) => a.start - b.start)
  return { generated: now, sessions }
}
