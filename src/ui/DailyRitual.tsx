import { useEffect, useState } from "react";
import { countdownText, dailyRitual } from "../content/dailyRitual";
import { dailyRecord } from "../content/daily";
import { plural } from "../content/plural";

/**
 * Plan item 133: the Daily Market's ritual on the title table's front. The last Daily's receipt pinned to it
 * (its score and a SOLD stamp, or HELD on a loss), the streak as a string of pennants, one a day, and tomorrow's
 * market as a face-down card counting down to 00:00 UTC. Decorative: the Daily button carries the same facts.
 */
export default function DailyRitual({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const r = dailyRitual(now, dailyRecord());
  return (
    <div
      className={compact ? "daily-ritual is-compact" : "daily-ritual"}
      aria-hidden="true"
      data-status={r.status}
      data-streak={r.streak}
    >
      {r.last ? (
        <figure
          className="ritual-receipt"
          data-won={r.last.result.won || undefined}
        >
          <span className="ritual-pin" />
          <span className="ritual-receipt-head">Daily #{r.last.number}</span>
          <span className="ritual-receipt-when">
            {r.last.today
              ? "Today"
              : isYesterday(r.last.date, now)
                ? "Yesterday"
                : shortDate(r.last.date)}
          </span>
          <span className="ritual-receipt-row">
            <span>Regions</span>
            <b>{r.last.result.regions}/5</b>
          </span>
          <span className="ritual-receipt-row">
            <span>Trust</span>
            <b>{r.last.result.trust}</b>
          </span>
          {!compact && (
            <span className="ritual-receipt-row is-rounds">
              <span>Rounds</span>
              <b>{r.last.result.rounds}</b>
            </span>
          )}
          <span className="ritual-stamp">
            {r.last.result.won ? "Sold" : "Held"}
          </span>
        </figure>
      ) : (
        <figure className="ritual-receipt is-blank">
          <span className="ritual-pin" />
          <span className="ritual-receipt-head">No sale yet</span>
          <span className="ritual-receipt-when">Today's Daily is open</span>
        </figure>
      )}
      {compact ? (
        <span className="ritual-streak">
          {r.streak > 0 ? `${r.streak} in a row` : ""}
        </span>
      ) : (
        <>
          <div className="ritual-bunting" data-pennants={r.pennants}>
            <svg
              viewBox={`0 0 ${Math.max(1, r.pennants) * 22 + 8} 34`}
              width={Math.max(1, r.pennants) * 22 + 8}
              height={34}
              focusable="false"
            >
              <path
                className="ritual-rope"
                d={`M2 6 Q${(Math.max(1, r.pennants) * 22 + 8) / 2} 14 ${Math.max(1, r.pennants) * 22 + 6} 6`}
              />
              {Array.from({ length: r.pennants }, (_, i) => {
                const x = 6 + i * 22;
                const sag = (t: number) => 6 + 8 * 4 * t * (1 - t);
                const span = Math.max(1, r.pennants) * 22 + 4;
                const y0 = sag((x - 2) / span);
                const y1 = sag((x + 16 - 2) / span);
                return (
                  <path
                    key={i}
                    className={`ritual-pennant p${i % 4}`}
                    data-pennant={i + 1}
                    d={`M${x} ${y0.toFixed(1)} L${x + 16} ${y1.toFixed(1)} L${x + 8} ${((y0 + y1) / 2 + 20).toFixed(1)} Z`}
                  />
                );
              })}
            </svg>
            <span className="ritual-streak">
              {r.streak > 0
                ? `${plural(r.streak, "day")} in a row${r.more ? ` (+${r.more})` : ""}`
                : "Win a Daily to hang the first pennant"}
            </span>
          </div>
          <div className="ritual-card">
            <span className="ritual-card-back" />
            <span className="ritual-card-kicker">Next</span>
            <span className="ritual-card-no">#{r.next}</span>
            <span className="ritual-card-in">
              in {countdownText(r.nextInMs)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function isYesterday(date: string, now: Date): boolean {
  return (
    new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10) === date
  );
}
function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
