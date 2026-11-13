import { useEffect, useState } from 'react'
import { countdownText, dailyRitual } from '../content/dailyRitual'
import { dailyMarket, dailyRecord } from '../content/daily'
import { MARKET_EVENTS } from '../engine/marketEvent'
import { plural } from '../content/plural'

/**
 * Plan item 133: the Daily Market's ritual on the title table's front. The last Daily's receipt pinned to it
 * (its score and a SOLD stamp, or HELD on a loss), the streak as a string of pennants, one a day, and tomorrow's
 * market as a face-down card counting down to 00:00 UTC. Decorative: the Daily button carries the same facts.
 */
export default function DailyRitual({ compact = false }: { compact?: boolean }) {
  const [opened] = useState(() => new Date())
  const [now, setNow] = useState(opened)
  useEffect(() => {
    // Every 30 s, and on the dot of the turnover, so the card flips as the new Daily opens.
    const first = dailyRitual(opened, { results: {} }).nextInMs
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, 30_000)
    const at = window.setTimeout(tick, first + 50)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(at)
    }
  }, [opened])
  // The card is tomorrow's market as of when the title opened; once that day comes it turns face up.
  const r = dailyRitual(opened, dailyRecord())
  const live = dailyRitual(now, dailyRecord())
  const flipped = live.next > r.next
  const fresh = dailyMarket(now)
  const today = dailyMarket(opened)
  if (!compact) return <RitualBoard r={r} live={live} flipped={flipped} fresh={fresh} today={today.number} now={now} />
  return (
    <div className="daily-ritual is-compact" aria-hidden="true" data-status={r.status} data-streak={r.streak}>
      {r.last ? (
        <figure className="ritual-receipt" data-won={r.last.result.won || undefined}>
          <span className="ritual-pin" />
          <span className="ritual-receipt-head">Daily #{r.last.number}</span>
          <span className="ritual-receipt-when">{r.last.today ? 'Today' : isYesterday(r.last.date, now) ? 'Yesterday' : shortDate(r.last.date)}</span>
          <span className="ritual-receipt-row">
            <span>Regions</span>
            <b>{r.last.result.regions}/5</b>
          </span>
          <span className="ritual-receipt-row">
            <span>Trust</span>
            <b>{r.last.result.trust}</b>
          </span>
          {r.streak > 0 && (
            <span className="ritual-mini-bunting" data-pennants={Math.min(r.streak, 5)}>
              {Array.from({ length: Math.min(r.streak, 5) }, (_, i) => (
                <span key={i} className={`ritual-mini-pennant p${i % 4}`} data-pennant={i + 1} />
              ))}
              {r.streak > 5 && <b>+{r.streak - 5}</b>}
            </span>
          )}
          <span className="ritual-stamp">{r.last.result.won ? 'Sold' : 'Held'}</span>
        </figure>
      ) : (
        <figure className="ritual-receipt is-blank">
          <span className="ritual-pin" />
          <span className="ritual-receipt-head">No sale yet</span>
          <span className="ritual-receipt-when">The Daily is open</span>
        </figure>
      )}
    </div>
  )
}

type Ritual = ReturnType<typeof dailyRitual>

/**
 * Plan item 342: at D the Daily is one chalk price board standing on the counter (it was a receipt, a pennant tag and
 * a face-down card strewn along it): today's number in large chalk (the menu's Daily button reads the same
 * `dailyMarket`), the last result with its stamp, the pennants and the goal, and the next Daily's countdown.
 */
function RitualBoard({ r, live, flipped, fresh, today, now }: { r: Ritual; live: Ritual; flipped: boolean; fresh: ReturnType<typeof dailyMarket>; today: number; now: Date }) {
  const last = r.last
  // Three pennants at most on the board: its words carry the count ('12 days in a row').
  const hung = Math.min(r.pennants, 3)
  return (
    <div className="daily-ritual" aria-hidden="true" data-status={r.status} data-streak={r.streak}>
      <div className="ritual-board">
        <div className="ritual-today">
          <span className="ritual-kicker">
            Today<span className="ritual-more">'s Daily</span>
          </span>
          <span className="ritual-today-no">#{today}</span>
        </div>
        <div className="ritual-mid">
          {last ? (
            <figure className="ritual-receipt" data-won={last.result.won || undefined}>
              <span className="ritual-receipt-head">
                {last.today ? 'Today' : isYesterday(last.date, now) ? 'Yesterday' : shortDate(last.date)}
                <span className="ritual-more"> · #{last.number}</span>
              </span>
              <span className="ritual-receipt-when">
                {last.result.regions}/5 regions<span className="ritual-more"> · Trust {last.result.trust}</span>
              </span>
              <span className="ritual-stamp">{last.result.won ? 'Sold' : 'Held'}</span>
            </figure>
          ) : (
            <figure className="ritual-receipt is-blank">
              <span className="ritual-receipt-head">No sale yet</span>
              <span className="ritual-receipt-when">The Daily is open</span>
            </figure>
          )}
          <div className="ritual-bunting" data-pennants={r.pennants}>
            {hung > 0 ? (
              <svg viewBox={`0 0 ${hung * 15 + 6} 22`} width={hung * 15 + 6} height={22} focusable="false">
                <path className="ritual-rope" d={`M2 4 Q${(hung * 15 + 6) / 2} 9 ${hung * 15 + 4} 4`} />
                {Array.from({ length: hung }, (_, i) => (
                  <path key={i} className={`ritual-pennant p${i % 4}`} data-pennant={i + 1} d={`M${4 + i * 15} 5 L${16 + i * 15} 5 L${10 + i * 15} 19 Z`} />
                ))}
              </svg>
            ) : null}
            <span className="ritual-streak">
              {r.streak > 0 ? `${plural(r.streak, 'day')} in a row` : 'Win for a pennant'}
            </span>
          </div>
        </div>
        <div className="ritual-card" data-flipped={flipped || undefined}>
          <span className="ritual-card-face ritual-card-down">
            <span className="ritual-card-kicker">Next</span>
            <span className="ritual-card-no">#{r.next}</span>
            <span className="ritual-card-in">in {countdownText(live.nextInMs > 0 && !flipped ? live.nextInMs : 0)}</span>
          </span>
          <span className="ritual-card-face ritual-card-up">
            <span className="ritual-card-kicker">Open</span>
            <span className="ritual-card-no">#{fresh.number}</span>
            <span className="ritual-card-event">{MARKET_EVENTS[fresh.marketEvent].name}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function isYesterday(date: string, now: Date): boolean {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10) === date
}
function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}
