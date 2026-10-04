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
    title: "Side contracts",
    done: "The quay is quiet.",
    open: "Ana pins small jobs here once Crisp's name is out.",
    needs: "crispLead",
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
