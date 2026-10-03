import { describe, expect, it } from "vitest";
import { CLASS_SKILLS, TREES } from "../games/cathode/src/sim/classes";
import type { TreeId } from "../games/cathode/src/sim/types";
import {
  TREE_COLS,
  TREE_ROWS,
  edgePoints,
  layoutTree,
  passesThrough,
  tracePath,
  tracesCross,
  type LayoutSkill,
} from "../games/cathode/src/ui/treelayout";

const trees = Object.keys(TREES) as TreeId[];
const skillsOf = (t: TreeId) => CLASS_SKILLS.filter((s) => s.tree === t);

describe("skill-tree layout", () => {
  it("places every skill of every tree on the 3×6 grid, one node per cell, in its own row", () => {
    for (const t of trees) {
      const skills = skillsOf(t);
      const l = layoutTree(skills);
      expect(l.nodes).toHaveLength(skills.length);
      const cells = new Set(l.nodes.map((n) => `${n.row},${n.col}`));
      expect(cells.size).toBe(skills.length);
      for (const n of l.nodes) {
        expect(n.col).toBeGreaterThanOrEqual(0);
        expect(n.col).toBeLessThan(TREE_COLS);
        expect(n.row).toBeLessThan(TREE_ROWS);
        expect(n.row).toBe(skills.find((s) => s.id === n.id)!.row);
      }
    }
  });

  it("draws one trace per prerequisite, and no trace runs through another node or crosses another", () => {
    for (const t of trees) {
      const skills = skillsOf(t);
      const l = layoutTree(skills);
      expect(l.edges).toHaveLength(skills.reduce((n, s) => n + s.prereqs.length, 0));
      for (const e of l.edges) {
        for (const n of l.nodes) {
          if (n.id === e.from || n.id === e.to) continue;
          expect(passesThrough(e.points, n), `${t}: ${e.from}→${e.to} runs through ${n.id}`).toBe(false);
        }
      }
      for (let i = 0; i < l.edges.length; i++) {
        for (let j = i + 1; j < l.edges.length; j++) {
          expect(tracesCross(l.edges[i]!, l.edges[j]!), `${t}: traces ${i} and ${j} cross`).toBe(false);
        }
      }
      expect(l.cost).toBeLessThan(10);
    }
  });

  it("centres the lone capstone rows and is deterministic", () => {
    for (const t of trees) {
      const a = layoutTree(skillsOf(t));
      const b = layoutTree(skillsOf(t));
      expect(a.nodes).toEqual(b.nodes);
      for (const n of a.nodes.filter((x) => x.row >= 4)) expect(n.col).toBe(1);
    }
  });

  it("routes a trace straight down within a column and as down-across-down between columns", () => {
    expect(edgePoints({ row: 0, col: 1 }, { row: 2, col: 1 })).toEqual([
      { x: 1.5, y: 0.5 },
      { x: 1.5, y: 2.5 },
    ]);
    const bent = edgePoints({ row: 1, col: 0 }, { row: 3, col: 2 });
    expect(bent).toEqual([
      { x: 0.5, y: 1.5 },
      { x: 0.5, y: 3 },
      { x: 2.5, y: 3 },
      { x: 2.5, y: 3.5 },
    ]);
    expect(tracePath(bent)).toBe("M0.5 1.5 L0.5 3 L2.5 3 L2.5 3.5");
  });

  it("moves a skill out of the way when a straight trace would run through it", () => {
    // a (row 0) → c (row 2) in one column; b sits in row 1 and must not land on that trace.
    const skills: LayoutSkill[] = [
      { id: "a", row: 0, prereqs: [] },
      { id: "x", row: 0, prereqs: [] },
      { id: "b", row: 1, prereqs: ["x"] },
      { id: "y", row: 1, prereqs: ["x"] },
      { id: "c", row: 2, prereqs: ["a"] },
    ];
    const l = layoutTree(skills);
    const at = (id: string) => l.nodes.find((n) => n.id === id)!;
    for (const id of ["b", "y"]) expect(passesThrough(edgePoints(at("a"), at("c")), at(id))).toBe(false);
  });
});
