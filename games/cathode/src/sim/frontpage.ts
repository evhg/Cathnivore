// Plan item 494: the morning paper on the title. Hollowell's own rag reports the last closed case the way the city's
// PR men would like it read: the headline slanted, the dek dry, the weather always rain and a classified carrying the
// joke. Pure: main.ts builds the page from `frontPageFor`, session.ts records the case on its debrief.

import type { DebriefGrade } from "./debrief";

/** What the debrief leaves for the morning paper (localStorage `LAST_CASE_KEY`). */
export interface LastCase {
  caseId: string;
  grade: DebriefGrade;
  spotted: boolean;
  kills: number;
  /** The debrief's best kill-cam still (a small JPEG data URL), when one was grabbed. */
  still?: string;
}

export const LAST_CASE_KEY = "cathode:last-case:v1";
/** The last front page the title spun in (its `edition`), so a fresh one spins once. */
export const PAPER_SEEN_KEY = "cathode:paper-seen:v1";

export const MASTHEAD = "The Hollowell Ledger";

export interface FrontPage {
  /** The case the page reports: a closed case id, or "reed" (a fresh save's teaser on the first case). */
  caseId: string;
  /** Changes whenever the story does (the case and its grade). */
  edition: string;
  kicker: string;
  headline: string;
  dek: string;
  /** The halftone's caption. */
  caption: string;
  weather: string;
  classified: string;
}

interface Story {
  kicker: string;
  headline: string;
  dek: string;
  caption: string;
  classified: string;
}

/** The stories, in List order. `fishMarket` is the opening job (no debrief, so no grade). */
const STORIES: Record<string, Story> = {
  reed: {
    kicker: "Harbour",
    headline: "Water-Taxi Debts ‘Entirely Voluntary’, Says Spokesman",
    dek: "Fishmonger Tomas Reed ‘grateful for the opportunity’ to owe Crisp Transit more than eggs.",
    caption: "Mr Reed, who declined to comment, at the fish market.",
    classified: "SEEKING babysitter, school nights, late finishes. Must like cats. No questions.",
  },
  fishMarket: {
    kicker: "Harbour",
    headline: "Fish Market Scuffle Blamed On Wet Floor",
    dek: "Crisp Transit staff ‘slipped on their own initiative’, the firm says. Mr Reed’s eggs unharmed.",
    caption: "The fish market, after the floor was mopped.",
    classified: "LOST: one umbrella, black, sentimental value. Reward. Ask for C.",
  },
  crispBoss: {
    kicker: "Business",
    headline: "Water-Taxi Chief Takes Early Retirement At Sea",
    dek: "Julian Crisp’s debts ‘forgiven in full’, a spokesman confirms. Fares unchanged.",
    caption: "Crisp Transit’s offices, where staff were ‘not available’.",
    classified: "FOR SALE: water taxi, one careful owner (deceased). Offers.",
  },
  vaneBoss: {
    kicker: "Health",
    headline: "Clinic Director Retires Suddenly, Says Spokesman",
    dek: "Dr Octavia Vane leaves the Candor clinic ‘with immediate effect’. Patients’ debts ‘under review’.",
    caption: "The Candor clinic, closed for ‘deep cleaning’.",
    classified: "WANTED: second opinion. Any doctor. Cash. The Candor clinic need not apply.",
  },
  pellBoss: {
    kicker: "Politics",
    headline: "Councillor Pell’s Seat ‘Will Not Be Contested’",
    dek: "Hollowell Plaza mourns a public servant ‘who never once left office voluntarily’.",
    caption: "Hollowell Plaza, where the councillor last held a surgery.",
    classified: "SITUATION VACANT: councillor, Hollowell Plaza. Spine an advantage.",
  },
  boardBoss: {
    kicker: "Markets",
    headline: "Board Announces Restructuring ‘From The Top Floor Down’",
    dek: "Candor shares steady as the Chair takes ‘a long goodbye’. The lifts are back in service.",
    caption: "The Board Tower, after the restructuring.",
    classified: "TO LET: corner office, panoramic views, new window. Board meetings optional.",
  },
  vaultBoss: {
    kicker: "Technology",
    headline: "HollowCandor Offline For ‘Routine Maintenance’",
    dek: "The city’s systems run unwatched for the first time in living memory. Nobody has noticed yet.",
    caption: "The Hollow Vault, quiet.",
    classified: "FREE TO A GOOD HOME: one city, slightly used. Collect in person.",
  },
};

/** The cases the paper reports, newest last (List order: the opening job, then the five names). */
export const PAPER_CASES = ["fishMarket", "crispBoss", "vaneBoss", "pellBoss", "boardBoss", "vaultBoss"] as const;

const WEATHER = ["Rain. Tomorrow: rain.", "Rain, heavy at times. Outlook: rain.", "Drizzle, turning to rain.", "Rain. The harbour wall holds."];

/** The line under the headline that the grade earns: nobody saw her, or somebody saw a woman with an umbrella. */
function witness(last: LastCase | null): string {
  if (!last) return "";
  if (!last.spotted) return " Police have no witnesses and no interest.";
  if (last.grade === "C" || last.grade === "D") return " Residents report ‘fireworks’ well into the night.";
  return " One witness describes ‘a woman with an umbrella’.";
}

/**
 * The page for the title: the newest closed case in `jobsDone` (List order), graded by `last` when the debrief
 * recorded that case; a save with nothing closed reads the teaser on Tomas Reed.
 */
export function frontPageFor(jobsDone: readonly string[], last: LastCase | null): FrontPage {
  let caseId = "reed";
  for (const id of PAPER_CASES) if (jobsDone.includes(id)) caseId = id;
  const graded = last && last.caseId === caseId ? last : null;
  const s = STORIES[caseId]!;
  const n = Math.max(0, PAPER_CASES.indexOf(caseId as (typeof PAPER_CASES)[number]) + 1);
  return {
    caseId,
    edition: `${caseId}:${graded ? `${graded.grade}${graded.spotted ? "s" : ""}` : "-"}`,
    kicker: s.kicker,
    headline: s.headline,
    dek: s.dek + witness(graded),
    caption: s.caption,
    weather: WEATHER[n % WEATHER.length]!,
    classified: s.classified,
  };
}

/** Reads the recorded case defensively (old or hand-edited storage reads as none). */
export function parseLastCase(raw: string | null): LastCase | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LastCase>;
    if (typeof v.caseId !== "string" || typeof v.grade !== "string" || !"SABCD".includes(v.grade)) return null;
    return {
      caseId: v.caseId,
      grade: v.grade,
      spotted: v.spotted === true,
      kills: typeof v.kills === "number" ? v.kills : 0,
      still: typeof v.still === "string" && v.still.startsWith("data:image/") ? v.still : undefined,
    };
  } catch {
    return null;
  }
}
