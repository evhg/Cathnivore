// Plan item 491: the portfolio's "today in the studio" track: the last 24 hours of build sessions shown as work.
// Pure: `studioSessions` turns git commits into sessions (scripts/studio-log.ts reads git at build time and writes
// dist-site/studio.json). The repo is public, but the page carries commit subjects only: never an author, an email
// or a session link (the session id groups commits here and is dropped).

export type StudioGame = 'cathnivore' | 'hedgerow' | 'runnel' | 'nightshift' | 'portfolio'
export type StudioLane = 'A' | 'B'

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

/** A subject's first sentence, at most 140 characters, with anything shaped like an email or a link removed. A short
 *  lead before a colon ("Hedgerow 3D: The ...") is a label, not a sentence, so it keeps the clause after it. */
export function shortSubject(subject: string): string {
  const clean = subject.replace(/\S+@\S+/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
  let first = clean.split(/(?<=[.!?])\s/)[0] ?? clean
  const colon = first.search(/:\s(?=[A-Z])/)
  if (colon >= 30) first = first.slice(0, colon)
  const cut = first.length > 140 ? `${first.slice(0, 139).replace(/\s+\S*$/, '')}…` : first
  return cut.replace(/[.\s]+$/, '')
}

const LANE_TAG = /^Lane ([AB])\b/
const LOCK = /^Lane [AB]\b.*\block\b(?! released)/
const SUBJECT_GAME: [RegExp, StudioGame][] = [
  [/^Cathnivore\b/, 'cathnivore'],
  [/^Hedgerow\b/, 'hedgerow'],
  [/^Runnel\b/, 'runnel'],
  [/^(?:NIGHT SHIFT|CATHODE)\b/, 'nightshift'],
  [/^(?:Portfolio|Site|\/games\/)/i, 'portfolio'],
]

/** One commit's game: the game its subject names, else the one most of its files belong to. */
export function commitGame(c: StudioCommit): StudioGame | null {
  for (const [re, g] of SUBJECT_GAME) if (re.test(c.subject)) return g
  const count = new Map<StudioGame, number>()
  for (const f of c.files) {
    const g = gameOf(f)
    if (g) count.set(g, (count.get(g) ?? 0) + 1)
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/** Lane A's runs start at :51, lane B's at :21; a run's first commit lands 5-40 minutes in. */
function laneByClock(time: number): StudioLane {
  const m = Math.floor(time / 60) % 60
  const sinceA = (m - 51 + 60) % 60
  const sinceB = (m - 21 + 60) % 60
  return Math.abs(sinceA - 20) <= Math.abs(sinceB - 20) ? 'A' : 'B'
}

/** A session's commits split into its runs: a lane's routine can reuse one session for every run, so a lock commit
 *  or a gap of 45 minutes starts a new one. */
function runsOf(group: StudioCommit[], locks: readonly number[]): StudioCommit[][] {
  const runs: StudioCommit[][] = []
  let run: StudioCommit[] = []
  for (const c of [...group].sort((a, b) => a.time - b.time)) {
    const last = run[run.length - 1]
    const locked = last ? locks.some((t) => t > last.time && t <= c.time) : false
    if (run.length > 0 && (LOCK.test(c.subject) || locked || (last && c.time - last.time > 45 * 60))) {
      runs.push(run)
      run = []
    }
    run.push(c)
  }
  if (run.length > 0) runs.push(run)
  return runs
}

export function studioSessions(commits: readonly StudioCommit[], now: number, hours = 24): StudioLog {
  const since = now - hours * 3600
  const bySession = new Map<string, StudioCommit[]>()
  for (const c of commits) {
    if (c.time < since || c.time > now) continue
    const key = c.session || `t${Math.floor(c.time / 3600)}`
    bySession.set(key, [...(bySession.get(key) ?? []), c])
  }
  // Every lane's lock commits, whichever session made them (a lock commit may carry no session trailer).
  const locks: Record<StudioLane, number[]> = { A: [], B: [] }
  for (const c of commits) if (LOCK.test(c.subject)) locks[LANE_TAG.exec(c.subject)?.[1] === 'B' ? 'B' : 'A'].push(c.time)
  const sessions: StudioSession[] = []
  for (const group of bySession.values()) {
    const groupTag = group.find((c) => LANE_TAG.test(c.subject))
    const groupLane = groupTag ? (LANE_TAG.exec(groupTag.subject)![1] as StudioLane) : null
    for (const run of runsOf(group, groupLane ? locks[groupLane] : [])) {
    const tagged = run.find((c) => LANE_TAG.test(c.subject)) ?? groupTag
    const code = run.filter((c) => !LANE_TAG.test(c.subject) && c.files.some((f) => !NOTES.test(f)))
    if (code.length === 0) continue
    const lane: StudioLane = tagged ? (LANE_TAG.exec(tagged.subject)![1] as StudioLane) : laneByClock(code[0]!.time)
    const count = new Map<StudioGame, number>()
    for (const c of code) {
      const g = commitGame(c)
      if (g) count.set(g, (count.get(g) ?? 0) + 1)
    }
    const game = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'cathnivore'
    const sorted = [...code].sort((a, b) => b.time - a.time)
    sessions.push({ lane, start: sorted[sorted.length - 1]!.time, end: sorted[0]!.time, game, subjects: sorted.map((c) => shortSubject(c.subject)) })
    }
  }
  sessions.sort((a, b) => a.start - b.start)
  return { generated: now, sessions }
}
