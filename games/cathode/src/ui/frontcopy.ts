// C13 (docs/design/cathode-combat.md S9.2, S9.4): every line of the front door that comes from progress. Pure,
// so the title never shows a place or a name the player hasn't reached (tests/cathode-front.test.ts).

/** The list: the five names, each crossed off by its boss job. */
export const THE_LIST: ReadonlyArray<{ job: string; name: string }> = [
  { job: "crispBoss", name: "Julian Crisp" },
  { job: "vaneBoss", name: "Dr Octavia Vane" },
  { job: "pellBoss", name: "Councillor Marcus Pell" },
  { job: "boardBoss", name: "The Chair" },
  { job: "vaultBoss", name: "The Mind Under the River" },
];

export interface ListRow {
  name: string;
  done: boolean;
  /** The next name: the caret sits on it. */
  next: boolean;
  /** Not reached yet (after the next name): drawn as a redaction bar, so a fresh save spoils nobody. */
  redacted: boolean;
}

export function listRows(jobsDone: readonly string[]): ListRow[] {
  let nextSet = false;
  return THE_LIST.map((n) => {
    const done = jobsDone.includes(n.job);
    const next = !done && !nextSet;
    const redacted = !done && !next && nextSet;
    if (next) nextSet = true;
    return { name: n.name, done, next, redacted };
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
  { job: "crispLead", line: "CRISP’S LEDGER" },
  { job: "quayContracts", line: "ANA’S CONTRACT" },
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

/** The focus hint for each slot (S9.4; Continue: `BACK TO THE DROWNED MARKET · 2 OF 13 CLOSED`). */
export function slotHint(
  slot: string,
  o: { hasSave: boolean; jobsDone: readonly string[]; district?: string; ngPlus?: boolean; armed?: boolean },
): string {
  const where = DISTRICT_NAME[o.district ?? "market"] ?? DISTRICT_NAME.market!;
  switch (slot) {
    case "continue": {
      if (!o.hasSave) return "NO CASE OPEN";
      if (o.ngPlus) return "THE LIST IS CLOSED · NEW GAME+ · THE NAMES COME BACK HARDER";
      // Plan item 40: plainly what Continue opens (the district it lands in) and how far the case has got; the
      // next lead can sit in another district, so it stays on the case board.
      const closed = LEADS.filter((l) => o.jobsDone.includes(l.job)).length;
      return closed ? `BACK TO ${where} · ${closed} OF ${LEADS.length} CLOSED` : `BACK TO ${where} · YOUR FIRST CASE`;
    }
    case "new":
      if (o.armed) return "PRESS AGAIN TO CLOSE THE OLD CASE FOR GOOD";
      return o.hasSave ? "A NEW FILE · THE OLD CASE IS CLOSED" : "TOMAS REED · THE HARBOUR · A DEBT TAG";
    case "cases":
      return o.hasSave ? `THE CORKBOARD · ${o.jobsDone.length} CLOSED` : "BEA'S WALL · ONE LEAD · FIVE NAMES";
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
    case "office":
      return { title: "CATH'S OFFICE", sub: "Over Tomas's egg stall" };
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
export const COLD_OPEN_LINE = "Everyone’s got a list. Mine’s just shorter every night.";

// ---- C14 (S9.6): the loading screen is a case file ----

/** The districts in act order, and the boss job that opens each (the market is always open). */
const DISTRICT_NEEDS: ReadonlyArray<{ id: string; act: number; place: string; needs: string | null }> = [
  { id: "market", act: 1, place: "The Drowned Market", needs: null },
  { id: "clinic", act: 2, place: "The Candor Clinic", needs: "crispBoss" },
  { id: "plaza", act: 3, place: "Hollowell Plaza", needs: "vaneBoss" },
  { id: "tower", act: 4, place: "The Board Tower", needs: "pellBoss" },
  { id: "vault", act: 5, place: "The Hollow Vault", needs: "boardBoss" },
];

/** Whether the player has reached a district (the loading screen never shows one they haven't). */
export function districtReached(id: string, jobsDone: readonly string[]): boolean {
  const d = DISTRICT_NEEDS.find((x) => x.id === id);
  return !!d && (d.needs === null || jobsDone.includes(d.needs));
}

/**
 * The next name's file, in Cath's voice: who they are and why they are on the list, at most 55 words. No control
 * tips, ever (S9.6): the loading screen is the story, not the manual.
 */
const LORE: Record<string, string> = {
  crispBoss:
    "Julian Crisp runs the water taxis, and the debts that ride in them. Tomas Reed owes him more than eggs. Tonight Crisp’s men come to collect at the fish market. I mean to be there first.",
  vaneBoss:
    "Dr Octavia Vane signs the forms that make people disappear politely. The Candor Clinic takes in the drowned and sends out the paperwork. Her register is down there, under the fluorescent hum. So is she.",
  pellBoss:
    "Councillor Marcus Pell smiles from forty storeys of screen and votes the way Candor pays. Every permit that drowned this city carries his name. The plaza is his stage. I’ve bought a ticket.",
  boardBoss:
    "Nobody has seen the Chair’s face. The Board meets forty floors above the waterline and the Chair sits at the head of it. The lift only goes up. That suits me.",
  vaultBoss:
    "Under the river there is a vault, and in it whatever Candor built to think for it. Every name on my list answered to it. The water is cold down there. I stopped noticing a while ago.",
};
const CLOSED_LORE = "The list is closed. The rain hasn’t heard. I keep walking anyway: there is always another name.";
/**
 * Plan item 69: the office load is the room between cases, not the next name's file (it showed Crisp's headline and
 * the market's lines under "Between cases"). Cath's voice at her desk, the next name only as the card on the board.
 */
function officeLore(next: { name: string } | undefined): string {
  return next
    ? `Coat on the hook, kettle on, rain on the glass. The board waits with ${next.name}’s card pinned at the top. One quiet minute first. Then back to work.`
    : "Coat on the hook, kettle on. Every card on the board has a line through it. I sit with that a while.";
}

export interface LoadingCard {
  /** The district shown: the target if reached, else the market. */
  district: string;
  /** `ACT 2 · THE CANDOR CLINIC`. */
  place: string;
  /** The next name on the list (or "The List", closed). */
  name: string;
  /** The next name's job; undefined once the list is closed. */
  job?: string;
  /** Cath's lines about them, at most 55 words. */
  lore: string;
  /** The list for the corner: every reached name, done ones struck. `fresh` strikes through as it loads. */
  list: ReadonlyArray<{ name: string; done: boolean; next: boolean; fresh: boolean }>;
  /** Names not reached yet (counted, never shown). */
  sealed: number;
  /** "travel" when she is moving between districts (the trace sweep along the rule). */
  motif: "arrive" | "travel";
}

/**
 * The loading card for a load into `target` (S9.6). `seen` is how many names were struck the last time the list was
 * shown, so a name dealt with since then strikes through on this screen. Pure: tests/cathode-front.test.ts.
 */
export function loadingCard(jobsDone: readonly string[], target: string | undefined, o: { seen?: number; travel?: boolean } = {}): LoadingCard {
  const want = target ?? "market";
  // The office is always hers; it has its own key art (plan item 69), and its act line below.
  const id = want === "office" ? "office" : districtReached(want, jobsDone) ? want : "market";
  const d = DISTRICT_NEEDS.find((x) => x.id === id) ?? DISTRICT_NEEDS[0]!;
  const rows = listRows(jobsDone);
  const next = THE_LIST.find((n) => !jobsDone.includes(n.job));
  let struck = 0;
  const list: Array<{ name: string; done: boolean; next: boolean; fresh: boolean }> = [];
  for (const r of rows) {
    if (r.redacted) continue;
    const fresh = r.done && struck >= (o.seen ?? Infinity);
    if (r.done) struck++;
    list.push({ name: r.name, done: r.done, next: r.next, fresh });
  }
  return {
    district: id,
    // Plan item 16: the office is between cases rather than in an act.
    place: want === "office" ? "BETWEEN CASES · CATH’S OFFICE" : `ACT ${d.act} · ${d.place.toUpperCase()}`,
    name: want === "office" ? "Cath’s office" : next ? next.name : "The List",
    job: next?.job,
    lore: want === "office" ? officeLore(next) : next ? LORE[next.job]! : CLOSED_LORE,
    list,
    sealed: rows.filter((r) => r.redacted).length,
    motif: o.travel ? "travel" : "arrive",
  };
}

/** The shown percentage one frame on: it eases toward the real share and never moves more than 4% a frame (S9.6). */
export function easeLoad(shown: number, target: number): number {
  const gap = target - shown;
  if (gap <= 0) return shown;
  return Math.min(target, shown + Math.min(0.04, Math.max(0.004, gap * 0.16)));
}

/** Plan item 89: the case dossier New Case and Continue slide in at D: who the case is after, where, and the tag. */
export interface Dossier {
  /** The List's job whose bust is the polaroid (null: the blank print, a name not on the board yet). */
  job: string | null;
  target: string;
  place: string;
  tag: string;
}

export function dossierFor(slot: string, o: { hasSave: boolean; jobsDone: readonly string[]; district?: string }): Dossier | null {
  if (slot === "new") return { job: null, target: "Tomas Reed", place: "The Harbour", tag: "A debt tag" };
  if (slot !== "continue" || !o.hasSave) return null;
  const next = THE_LIST.find((n) => !o.jobsDone.includes(n.job));
  const lead = openLead(o.jobsDone);
  const place = DISTRICT_NAME[o.district ?? "market"] ?? DISTRICT_NAME.market!;
  if (!next) return { job: null, target: "The List is closed", place: titleCase(place), tag: "New Game+" };
  return { job: next.job, target: next.name, place: titleCase(place), tag: lead ? `Lead: ${titleCase(lead)}` : "The last name" };
}

const titleCase = (s: string): string => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()).replace(/’S\b/gi, "’s");

/**
 * Plan item 137: a name crossed off The List is a front-door moment, once. `seen` is the boss jobs the title has
 * already shown struck; the first done one not in it is struck now (the latest in List order, so a save that
 * closed two cases away from the title strikes the newer). Returns its List index, or -1.
 */
export function freshlyStruck(jobsDone: readonly string[], seen: readonly string[]): number {
  for (let i = THE_LIST.length - 1; i >= 0; i--) {
    const job = THE_LIST[i]!.job;
    if (jobsDone.includes(job)) return seen.includes(job) ? -1 : i;
  }
  return -1;
}

/** The boss jobs to remember as shown once the title has played its strike (every done name on the List). */
export function struckJobs(jobsDone: readonly string[]): string[] {
  return THE_LIST.filter((n) => jobsDone.includes(n.job)).map((n) => n.job);
}

const SHORT: Record<string, string> = { crispBoss: "Crisp", vaneBoss: "Vane", pellBoss: "Pell", boardBoss: "the Chair", vaultBoss: "the Mind" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plan item 137: Cath's word as a name comes off The List (the surname struck, and who is next, or that it's over). */
export function struckLine(index: number): string {
  const n = THE_LIST[index];
  if (!n) return "";
  const next = THE_LIST[index + 1];
  const who = (job: string) => SHORT[job] ?? job;
  return next ? `One off the list. ${cap(who(n.job))}'s done. ${cap(who(next.job))} next.` : `That's the last of them. The list is closed.`;
}
