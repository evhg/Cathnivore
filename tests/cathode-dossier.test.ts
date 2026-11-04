import { describe, expect, it } from "vitest";
import { dossierFor } from "../games/cathode/src/ui/frontcopy";

// Plan item 89: the dossier New Case and Continue slide in at D.
describe("NIGHT SHIFT front dossier", () => {
  it("New Case is Tomas Reed at the harbour, on a debt tag", () => {
    expect(dossierFor("new", { hasSave: false, jobsDone: [] })).toEqual({ job: null, target: "Tomas Reed", place: "The Harbour", tag: "A debt tag" });
  });
  it("Continue is the next name on the List, where the save lands, and the open lead", () => {
    const d = dossierFor("continue", { hasSave: true, jobsDone: ["fishMarket", "crispLead"], district: "market" })!;
    expect(d.job).toBe("crispBoss");
    expect(d.target).toBe("Julian Crisp");
    expect(d.place).toBe("The Drowned Market");
    expect(d.tag).toBe("Lead: Ana’s Contract");
  });
  it("no dossier for Continue without a save, nor for the other rows", () => {
    expect(dossierFor("continue", { hasSave: false, jobsDone: [] })).toBeNull();
    expect(dossierFor("settings", { hasSave: true, jobsDone: [] })).toBeNull();
  });
});
