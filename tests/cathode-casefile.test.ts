import { describe, expect, it } from "vitest";
import { caseBoard } from "../games/cathode/src/sim/casefile";

describe("case board", () => {
  it("opens the next lead when a job is done", () => {
    expect(caseBoard([]).map((c) => c.state)).toEqual(["open", "locked", "locked", "locked"]);
    expect(caseBoard(["fishMarket"]).map((c) => c.state)).toEqual(["done", "open", "locked", "locked"]);
  });
});
