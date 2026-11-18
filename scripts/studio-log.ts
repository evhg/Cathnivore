// Plan item 491: reads the last 24 hours of commits from git and writes the portfolio's studio track data
// (portfolio/src/studioLog.ts) to the path given (default dist-site/studio.json). Subjects only: no authors, emails
// or session links. On a shallow clone with no history in reach it writes no sessions, and the page keeps its numbers.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { studioSessions, type StudioCommit } from '../portfolio/src/studioLog'

export function readCommits(hours = 24): StudioCommit[] {
  let raw = ''
  try {
    raw = execFileSync('git', ['log', `--since=${hours}.hours`, '--no-merges', '--format=%x1e%ct%x1f%s%x1f%(trailers:key=Claude-Session,valueonly,separator=)%x1f', '--name-only'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return []
  }
  return raw
    .split('\x1e')
    .filter((r) => r.trim())
    .map((r) => {
      const [time, subject, session, rest] = r.split('\x1f')
      return { time: Number(time), subject: subject ?? '', session: (session ?? '').trim(), files: (rest ?? '').split('\n').map((f) => f.trim()).filter(Boolean) }
    })
}

export function writeStudioLog(out: string, now = Math.floor(Date.now() / 1000)): number {
  const log = studioSessions(readCommits(), now)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(log))
  return log.sessions.length
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname ?? '', 'studio-log.ts')) {
  const out = resolve(process.argv[2] ?? 'dist-site/studio.json')
  console.log(`studio log: ${writeStudioLog(out)} sessions -> ${out}`)
}
