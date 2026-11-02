// Plan item 16: the rules of Cath's office, the hub between cases. Pure: which station she stands at, what its
// prompt says, where the stair door takes her (the district the open case runs in), what Bea says on the line,
// and where Continue lands. The session (`session.ts`) and the title (`main.ts`) read these.

import { STATIONS, type StationId } from "../render/levels/office";
import { travelOptions } from "./zones";

/** How close (metres, on the floor) she must stand to a station's spot for its prompt. */
export const STATION_REACH = 1.5;

/** The nearest station within reach of (x, z), or null. */
export function stationAt(x: number, z: number): StationId | null {
  let best: StationId | null = null;
  let bestD = STATION_REACH;
  for (const [id, s] of Object.entries(STATIONS) as Array<[StationId, (typeof STATIONS)[StationId]]>) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

/** The prompt's verb per station ("[F] Read Case board"). */
export const STATION_VERB: Record<StationId, string> = {
  board: "Read",
  bench: "Work",
  wardrobe: "Open",
  phone: "Call",
  door: "Take",
};

/** The story in order: each job and the district it runs in. */
const STORY: ReadonlyArray<readonly [string, string]> = [
  ["fishMarket", "market"],
  ["crispLead", "market"],
  ["quayContracts", "market"],
  ["candorManifest", "market"],
  ["crispBoss", "market"],
  ["vaneLead", "clinic"],
  ["vaneBoss", "clinic"],
  ["pellLead", "plaza"],
  ["pellBoss", "plaza"],
  ["boardLead", "tower"],
  ["boardBoss", "tower"],
  ["vaultLead", "vault"],
  ["vaultBoss", "vault"],
];

/** The first story job not done yet (undefined once the vault is closed). */
export function nextJob(jobsDone: readonly string[]): string | undefined {
  return STORY.find(([j]) => !jobsDone.includes(j))?.[0];
}

/**
 * Where the stair door's water taxi goes: the district the open case runs in, if she can reach it (it always
 * can, since a case's district opens with the boss before it). After the vault, the market's contracts.
 */
export function caseDistrict(jobsDone: readonly string[]): string {
  const j = nextJob(jobsDone);
  const d = STORY.find(([id]) => id === j)?.[1] ?? "market";
  return travelOptions(jobsDone).some((t) => t.id === d) ? d : "market";
}

/** The door's name for where it goes. */
export function doorName(jobsDone: readonly string[]): string {
  const d = caseDistrict(jobsDone);
  return travelOptions(jobsDone).find((t) => t.id === d)?.name ?? "The Drowned Market";
}

/** Bea on the line: two or three lines about the open case, in the order they're said. */
export function beaCall(jobsDone: readonly string[]): string[] {
  switch (nextJob(jobsDone)) {
    case "crispLead":
    case "quayContracts":
    case "candorManifest":
      return [
        "Bea: Mum. The name on the taxi seat. Julian Crisp runs the north quay for Hollowell.",
        "Cath: Then that's where I'm going. Are you in bed?",
        "Bea: I'm in bed with the laptop. That counts.",
      ];
    case "crispBoss":
      return ["Bea: Crisp's on the quay tonight. Everyone else got told to stay home.", "Cath: Good. Fewer people to explain it to."];
    case "vaneLead":
    case "vaneBoss":
      return [
        "Bea: Crisp's ledger points at the Candor Clinic. Octavia Vane signs everything there.",
        "Cath: A clinic. Of course it's a clinic.",
        "Bea: The night shift starts at ten. So do you.",
      ];
    case "pellLead":
    case "pellBoss":
      return [
        "Bea: Vane's register has Pell's signature on every page. He's speaking at the Plaza.",
        "Cath: In the rain?",
        "Bea: He likes the rain. It keeps the crowds small.",
      ];
    case "boardLead":
    case "boardBoss":
      return ["Bea: Pell answered to a board. They meet at the top of the Tower.", "Cath: Then I'll take the stairs."];
    case "vaultLead":
    case "vaultBoss":
      return ["Bea: The Chair kept one thing below the waterline. The Vault. Every debt in Marrow.", "Cath: Last one, darling. Then pancakes."];
    case undefined:
      return ["Bea: Nobody's left on the wall, Mum.", "Cath: There's always someone. Go to sleep, love."];
    default:
      return ["Bea: Mum? Are you still at work?", "Cath: Nearly done, darling."];
  }
}

/**
 * Where Continue lands: the office once the first job is done (the hub between cases); before that, the
 * Fish Market, where the first job runs. `undefined` is the market.
 */
export function continueDistrict(jobsDone: readonly string[]): string | undefined {
  return jobsDone.includes("fishMarket") ? "office" : undefined;
}
