// C13 (docs/design/cathode-combat.md S9.2, S9.4): every line of the front door that comes from progress. Pure,
// so the title never shows a place or a name the player hasn't reached (tests/cathode-front.test.ts).

/** The list: the five names, each crossed off by its boss job. */
export const THE_LIST: ReadonlyArray<{ job: string; name: string }> = [
  { job: "crispBoss", name: "Julian Crisp" },
  { job: "vaneBoss", name: "Dr Octavia Vane" },
  { job: "pellBoss", name: "Councillor Marcus Pell" },
  { job: "boardBoss", name: "The Chair" },
  { job: "vaultBoss", name: "HollowCandor" },
];

export interface ListRow {
  name: string;
  done: boolean;
  /** The next name: the caret sits on it. */
  next: boolean;
}

export function listRows(jobsDone: readonly string[]): ListRow[] {
  let nextSet = false;
  return THE_LIST.map((n) => {
    const done = jobsDone.includes(n.job);
    const next = !done && !nextSet;
    if (next) nextSet = true;
    return { name: n.name, done, next };
  });
}

export function namesLeft(jobsDone: readonly string[]): number {
  return THE_LIST.filter((n) => !jobsDone.includes(n.job)).length;
}

/** The live subtitle under the logotype: `HOLLOWELL PROPER · 2079 · 3 NAMES LEFT`. */
export function titleSubtitle(jobsDone: readonly string[]): string {
  const n = namesLeft(jobsDone);
  const tail = n === 0 ? "THE LIST IS CLOSED" : n === 1 ? "1 NAME LEFT" : `${n} NAMES LEFT`;
  return `HOLLOWELL PROPER · 2079 · ${tail}`;
}

const DISTRICT_NAME: Record<string, string> = {
  market: "THE DROWNED MARKET",
  clinic: "THE CANDOR CLINIC",
  plaza: "HOLLOWELL PLAZA",
  tower: "THE BOARD TOWER",
  vault: "THE HOLLOW VAULT",
};

/** The open lead the player is on, in the order the case board opens them (null when every case is closed). */
const LEADS: ReadonlyArray<{ job: string; line: string }> = [
  { job: "fishMarket", line: "THE FISH MARKET" },
  { job: "crispLead", line: "CRISP'S LEDGER" },
  { job: "quayContracts", line: "ANA'S CONTRACT" },
  { job: "candorManifest", line: "THE CANDOR MANIFEST" },
  { job: "crispBoss", line: "JULIAN CRISP" },
  { job: "vaneLead", line: "THE CLINIC REGISTER" },
  { job: "vaneBoss", line: "DR OCTAVIA VANE" },
  { job: "pellLead", line: "THE PERMIT LEDGER" },
  { job: "pellBoss", line: "COUNCILLOR PELL" },
  { job: "boardLead", line: "THE VISITOR PASS" },
  { job: "boardBoss", line: "THE CHAIR" },
  { job: "vaultLead", line: "THE VAULT LEDGER" },
  { job: "vaultBoss", line: "HOLLOWCANDOR" },
];

export function openLead(jobsDone: readonly string[]): string | null {
  return LEADS.find((l) => !jobsDone.includes(l.job))?.line ?? null;
}

/** The focus hint for each slot (S9.4: `RESUME · THE FISH MARKET · CHECKPOINT 2`). */
export function slotHint(
  slot: string,
  o: { hasSave: boolean; jobsDone: readonly string[]; district?: string; ngPlus?: boolean; armed?: boolean },
): string {
  const where = DISTRICT_NAME[o.district ?? "market"] ?? DISTRICT_NAME.market!;
  switch (slot) {
    case "continue": {
      if (!o.hasSave) return "NO CASE OPEN";
      if (o.ngPlus) return "THE LIST IS CLOSED · NEW GAME+ · THE NAMES COME BACK HARDER";
      const lead = openLead(o.jobsDone);
      return lead ? `RESUME · ${where} · ${lead}` : `RESUME · ${where}`;
    }
    case "new":
      if (o.armed) return "PRESS AGAIN TO CLOSE THE OLD CASE FOR GOOD";
      return o.hasSave ? "A NEW FILE · THE OLD CASE IS CLOSED" : "TOMAS REED · THE HARBOUR · A DEBT TAG";
    case "settings":
      return "GRAPHICS · VIOLENCE · MOTION";
    case "credits":
      return "WHO MADE THE RAIN";
    default:
      return "";
  }
}

/** The area title after the push (S9.4): Rajdhani caps and a Bodoni italic subline. */
export function areaTitle(district: string | undefined, jobsDone: readonly string[]): { title: string; sub: string } {
  switch (district) {
    case "clinic":
      return { title: "THE CANDOR CLINIC", sub: "Clinic Bay, the night shift" };
    case "plaza":
      return { title: "HOLLOWELL PLAZA", sub: "The council steps, in the rain" };
    case "tower":
      return { title: "THE BOARD TOWER", sub: "Forty floors of marble and glass" };
    case "vault":
      return { title: "THE HOLLOW VAULT", sub: "Below the waterline" };
    default:
      return jobsDone.includes("fishMarket")
        ? { title: "THE DROWNED MARKET", sub: "The quay, after midnight" }
        : { title: "THE FISH MARKET", sub: "Drowned Market, low tide" };
  }
}

/**
 * The title scene's set pieces (S9.2). The scene is always the market (the one place every player has seen);
 * after the Fish Market job the pier sign is dark and a chalk tally counts the names crossed off.
 */
export function frontSet(jobsDone: readonly string[]): { signDark: boolean; tally: number } {
  return { signDark: jobsDone.includes("fishMarket"), tally: THE_LIST.length - namesLeft(jobsDone) };
}

/** The cold open's line (S9.3). */
export const COLD_OPEN_LINE = "Everyone's got a list. Mine's just shorter every night.";
