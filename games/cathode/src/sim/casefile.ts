// The case board: Cath's open leads in the Drowned Market, derived from the jobs she has finished.

export interface CaseEntry {
  id: string;
  title: string;
  /** What the board pins up for this case. */
  note: string;
  state: "done" | "open" | "locked";
}

const CASES: { id: string; title: string; done: string; open: string; needs?: string }[] = [
  {
    id: "fishMarket",
    title: "The Fish Market",
    done: "The Enforcers are down. A water taxi left a name on the seat: Julian Crisp.",
    open: "Candor Enforcers hold the old fish market. Get in, get the taxi manifest, get out.",
  },
  {
    id: "crispLead",
    title: "Julian Crisp",
    done: "Crisp is dealt with.",
    open: "Crisp keeps a ledger on the quay. Bea is pulling his berth number.",
    needs: "fishMarket",
  },
  {
    id: "quayContracts",
    title: "Ana's contract",
    done: "The quay is quiet.",
    open: "Ana pins small jobs here once Crisp's name is out.",
    needs: "crispLead",
  },
  {
    id: "candorManifest",
    title: "The Candor manifest",
    done: "Bea has the manifest.",
    open: "A courier's dead drop under the south arcade. Bea marked it on your map.",
    needs: "quayContracts",
  },
  {
    id: "crispBoss",
    title: "Julian Crisp",
    done: "Crisp is finished. Act 1 is closed.",
    open: "Page nine names Crisp as Candor's man on the quay. He will not go quietly.",
    needs: "candorManifest",
  },
  {
    id: "vaneLead",
    title: "The clinic register",
    done: "The register names Vane's night shift.",
    open: "Candor logs every patient it breaks. Bea traced the register to a cabinet in the Clinic Bay.",
    needs: "crispBoss",
  },
  {
    id: "vaneBoss",
    title: "Dr Octavia Vane",
    done: "Vane is finished. Act 2 is closed.",
    open: "Crisp's ledger points to the Candor clinic. Vane stitches the people Candor breaks.",
    needs: "vaneLead",
  },
  {
    id: "pellLead",
    title: "The permit ledger",
    done: "The ledger puts Pell on the plaza steps at midnight.",
    open: "Candor's permits all carry one signature. Bea traced the strongbox to Hollowell Plaza.",
    needs: "vaneBoss",
  },
  {
    id: "pellBoss",
    title: "Councillor Marcus Pell",
    done: "Pell is finished. Act 3 is closed.",
    open: "Vane's patient files name Pell, who signs Candor's permits from Hollowell Plaza.",
    needs: "pellLead",
  },
  {
    id: "boardBoss",
    title: "The Chair of the Board",
    done: "The Chair is finished. Act 4 is closed.",
    open: "Pell's permits all trace to the Spire, where the Candor Board sits.",
    needs: "pellBoss",
  },
  {
    id: "vaultBoss",
    title: "HollowCandor",
    done: "HollowCandor is silent. Hardboiled is open.",
    open: "The Board's accounts all lead to the vault, and the machine that runs it.",
    needs: "boardBoss",
  },
];

/** The board for a given set of finished jobs. A case is open when its predecessor is done. */
export function caseBoard(jobsDone: readonly string[]): CaseEntry[] {
  return CASES.map((c) => {
    const done = jobsDone.includes(c.id);
    const unlocked = !c.needs || jobsDone.includes(c.needs);
    return {
      id: c.id,
      title: c.title,
      note: done ? c.done : unlocked ? c.open : "Not enough to go on yet.",
      state: done ? "done" : unlocked ? "open" : "locked",
    };
  });
}
