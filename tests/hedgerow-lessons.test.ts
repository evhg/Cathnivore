// Hedgerow 2 M3 (docs/design/hedgerow-2.md section 2 and the M3 milestone): properties as hard locks you can
// read. The immunity matrix, what passes to children, Rebrand and Reinforced, the leak report and loss causes,
// and the lesson tests: a field with no detection leaks on round 22, a Sharp-only field leaks on round 26, a
// Scarecrow-only field loses by act 2, and the best bot wins every level of acts 2 and 3.
import { describe, expect, it } from "vitest";
import {
  canControl,
  canHurt,
  CATH_DAMAGE,
  damageTypeOf,
  fvOf,
  P,
  propMask,
  RUNGS,
  type DamageType,
  type Property,
} from "../games/hedgerow/src/fleet";
import {
  bookRound,
  fieldAnswers,
  hitEnemy,
  isFleet,
  isPlot,
  pointAt,
  makeEnemy,
  newGame,
  place,
  sendWave,
  stepGame,
  upgrade,
  type Game,
  type Level,
  type TowerKind,
} from "../games/hedgerow/src/engine";
import { cardBody, leakReport, lossCauses, roundProps, towerBadges, unanswered, vehicleName } from "../games/hedgerow/src/counters";
import { BOOK, SCOUTS, roundFor, scaleCard, scoutsFor, trafficOf } from "../games/hedgerow/src/rounds";
import { LEVELS } from "../games/hedgerow/src/levels";
import { kept, playLevel } from "../games/hedgerow/src/bot";

const types: DamageType[] = ["sharp", "blast", "sting", "chill", "gust", "crush", "writ"];

describe("hedgerow M3: the counters matrix", () => {
  it("each damage type is locked out by exactly the property the spec's matrix says", () => {
    // Section 2: ✖ where the property is immune.
    const matrix: Record<string, DamageType[]> = {
      plated: ["sharp"],
      wrapped: ["blast"],
      sealed: ["sting"],
      reefer: ["chill"],
      // An Artic is Wrapped and Reefer: no Blast and no Chill.
      artic: ["blast", "chill"],
      plant: [],
      stealth: [],
      reinforced: [],
      rebrand: [],
    };
    for (const [row, immune] of Object.entries(matrix)) {
      const pm = row === "artic" ? P.wrapped | P.reefer : P[row as Property];
      for (const t of types) expect(canHurt(t, pm), `${t} vs ${row}`).toBe(!immune.includes(t));
    }
    // Untyped (Cath's pie) hits everything.
    expect(canHurt(null, 0x1ff)).toBe(true);
  });

  it("Control: a Reefer shrugs off every slow, stun, push and hold except a Writ hold; Heavy Plant can't be pushed or held", () => {
    for (const k of ["slow", "stun", "push", "hold"] as const) expect(canControl(P.reefer, k)).toBe(false);
    expect(canControl(P.reefer, "hold", true)).toBe(true);
    expect(canControl(P.plant, "slow")).toBe(true);
    expect(canControl(P.plant, "push")).toBe(false);
    expect(canControl(P.plant, "hold")).toBe(false);
    expect(canControl(P.plated | P.wrapped | P.sealed, "slow")).toBe(true);
  });

  it("damage types on today's tiers: specialisations change a tower's type where the spec says", () => {
    expect(damageTypeOf("scarecrow", null)).toBe("sharp");
    expect(damageTypeOf("scarecrow", 0)).toBe("blast"); // Pumpkin Lobber
    expect(damageTypeOf("cannon", null)).toBe("blast");
    expect(damageTypeOf("cannon", 1)).toBe("sharp"); // Scatter Shot
    expect(damageTypeOf("beehive", 0)).toBe("sting");
    expect(damageTypeOf("windmill", null)).toBe("gust");
    expect(damageTypeOf("windmill", 1)).toBe("sharp"); // Mill Stones
    expect(damageTypeOf("pond", null)).toBe("chill");
    expect(damageTypeOf("silo", null)).toBe("crush");
    expect(damageTypeOf("court", null)).toBe("writ");
    expect(damageTypeOf("mast", null)).toBeNull();
    expect(CATH_DAMAGE).toBe("blast");
  });

  it("tower cards' badges: green for what it hits or reveals, red for what it can't", () => {
    const crow = new Map(towerBadges({ kind: "scarecrow", tier: 1, spec: null }).map((b) => [b.prop, b.ok]));
    expect(crow.get("plated")).toBe(false);
    expect(crow.get("wrapped")).toBe(true);
    expect(crow.get("airborne")).toBe(true);
    expect(crow.get("stealth")).toBe(false);
    const mast = new Map(towerBadges({ kind: "mast", tier: 1, spec: null }).map((b) => [b.prop, b.ok]));
    expect(mast.get("stealth")).toBe(true);
    expect(mast.get("plated")).toBe(false);
    const cannon = new Map(towerBadges({ kind: "cannon", tier: 1, spec: null }).map((b) => [b.prop, b.ok]));
    expect(cannon.get("wrapped")).toBe(false);
    expect(cannon.get("airborne")).toBe(false);
    expect(new Map(towerBadges({ kind: "cannon", tier: 4, spec: 1 }).map((b) => [b.prop, b.ok])).get("airborne")).toBe(true);
    expect(new Map(towerBadges({ kind: "silo", tier: 1, spec: null }).map((b) => [b.prop, b.ok])).get("airborne")).toBe(true);
  });
});

/** A fleet game on `level` with nothing queued. */
function bare(level: Level): Game {
  const g = newGame(level);
  sendWave(g);
  g.spawnQueue = [];
  return g;
}

describe("hedgerow M3: properties on the lane", () => {
  const L = LEVELS[14]!; // level 15, a fleet level

  it("Stealth and Rebrand pass to children; Plated, Wrapped, Sealed, Reefer and Reinforced come off with the shell", () => {
    const g = bare(L);
    const e = makeEnemy(g, "lorry", 5, undefined, 1, P.stealth | P.plated | P.rebrand);
    g.enemies.push(e);
    hitEnemy(g, e, 1);
    expect(e.kind).toBe("sprinter");
    expect(e.pm! & P.stealth).toBeTruthy();
    expect(e.pm! & P.rebrand).toBeTruthy();
    expect(e.pm! & P.plated).toBeFalsy();
    const twin = g.enemies.find((x) => x !== e)!;
    expect(twin.kind).toBe("sprinter");
    expect(twin.pm! & P.stealth).toBeTruthy();
  });

  it("an Artic pops into one Wrapped and one Reefer lorry", () => {
    const g = bare(L);
    const e = makeEnemy(g, "artic", 5, undefined, 1);
    expect(e.pm! & P.wrapped && e.pm! & P.reefer).toBeTruthy();
    g.enemies.push(e);
    hitEnemy(g, e, 1);
    const kids = g.enemies.map((x) => [x.kind, x.pm ?? 0] as const);
    expect(kids).toEqual([
      ["lorry", P.wrapped],
      ["lorry", P.reefer],
    ]);
  });

  it("Reinforced doubles a shell and its Fleet Value; Rebrand grows a rung back every 3 s up to where it started", () => {
    const g = bare(L);
    const r = makeEnemy(g, "lorry", 5, undefined, 1, P.reinforced);
    expect(r.hp).toBe(2);
    expect(fvOf("lorry", P.reinforced)).toBe(fvOf("lorry") + 1);
    const b = makeEnemy(g, "van", 2, undefined, 1, P.rebrand);
    g.enemies.push(b);
    hitEnemy(g, b, 1);
    expect(b.kind).toBe("hatchback");
    for (let i = 0; i < 95; i++) stepGame(g);
    expect(b.kind).toBe("van");
    for (let i = 0; i < 95; i++) stepGame(g);
    expect(b.kind).toBe("van"); // never above what it started as
  });

  it("a Scarecrow won't shoot a Plated lorry it can't hurt, and lets it through; a Beehive pops it", () => {
    const trial = (kind: TowerKind) => {
      const g = bare(L);
      // A plot beside the lane, and the lane distance closest to it.
      let best: { c: number; r: number; d: number; gap: number } | null = null;
      for (let d = 2; d < g.pathLength - 2; d += 0.25) {
        const q = pointAt(L.path, d);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const c = Math.floor(q.x) + dc;
          const r = Math.floor(q.y) + dr;
          if (!isPlot(L, c, r)) continue;
          const gap = Math.hypot(c + 0.5 - q.x, r + 0.5 - q.y);
          if (!best || gap < best.gap) best = { c, r, d, gap };
        }
        if (best && best.gap <= 1.01) break;
      }
      expect(place(g, kind, best!.c, best!.r).ok).toBe(true);
      const e = makeEnemy(g, "lorry", best!.d - 0.5, undefined, 1, P.plated);
      g.enemies.push(e);
      for (let i = 0; i < 45; i++) stepGame(g);
      return g.towers[0]!.ko ?? 0;
    };
    expect(trial("scarecrow")).toBe(0);
    expect(trial("beehive")).toBeGreaterThan(0);
  });

  it("the round preview knows what a round brings, and warns when the field can't answer it", () => {
    const lv = LEVELS[14]!;
    const r22 = lv.waves[22 - lv.book!.from]!;
    expect(roundProps(lv, r22) & P.stealth).toBeTruthy();
    const g = newGame(lv);
    expect(unanswered(g, P.stealth | P.plated)).toEqual(["stealth", "plated"]);
    expect(fieldAnswers(g, "stealth")).toBe(false);
  });

  it("scouts: a level that ends on a lock round shows a few of them a few rounds early, so the lock isn't a one-round cliff", () => {
    // Level 15 (rounds 8-22) ends on round 22's stealth lorries: eight stealth vans ride in round 19.
    expect(scoutsFor(15, 19)).toEqual({ prop: "stealth", lockRound: 22 });
    const r19 = roundFor(15, 19)!;
    const scouts = r19.groups.filter((x) => x.props?.includes("stealth"));
    expect(scouts).toHaveLength(1);
    expect(scouts[0]!.count).toBe(SCOUTS);
    expect(r19.card).toContain("Stealth vans");
    // Only once per level, and not where the level already showed the lock (Moor Fog's stealth pickups).
    const lv15 = LEVELS[14]!;
    // The level plays them (its Crowds twist brings them a size smaller), and no stealth before round 19.
    expect(lv15.waves[19 - lv15.book!.from]!.some((x) => (x.pm ?? 0) & P.stealth)).toBe(true);
    expect(lv15.waves.slice(0, 19 - lv15.book!.from).flat().some((x) => (x.pm ?? 0) & P.stealth)).toBe(false);
    expect([...Array(15)].some((_, i) => scoutsFor(16, 8 + i))).toBe(false);
    // Act 1 plays the Book as written.
    for (let id = 1; id <= 10; id++) for (let r = 1; r <= 20; r++) expect(scoutsFor(id, r)).toBeNull();
  });

  it("act 2-3 traffic scales a round's vehicles and its card's counts together, and nothing else in the card", () => {
    expect(trafficOf(5)).toBe(1);
    expect(trafficOf(15)).toBeGreaterThan(1);
    expect(scaleCard("Thirty Box Lorries. Splash where they pop.", 1.4)).toBe("42 Box Lorries. Splash where they pop.");
    expect(scaleCard("Ninety lorries and a hundred rush vans.", 1.5)).toBe("135 lorries and 150 rush vans.");
    expect(scaleCard("Round 22: Stealth lorries. Pop the box and two Same-Day vans burst out.", 2)).toBe("Round 22: Stealth lorries. Pop the box and two Same-Day vans burst out.");
    expect(scaleCard("99p eggs, delivered fast: hatchbacks.", 2)).toBe("99p eggs, delivered fast: hatchbacks.");
    const book = BOOK[12]!;
    const r13 = roundFor(13, 13)!;
    const m = trafficOf(13);
    expect(r13.groups.map((x) => x.count)).toEqual(book.groups.map((x) => Math.round(x.count * m)));
    expect(cardBody("Round 8: the first bubble-wrapped Same-Day vans.")).toBe("The first bubble-wrapped Same-Day vans.");
  });

  it("a round's chips look all the way down: a Car Transporter round brings its Artics' Wrapped and Reefer lorries", () => {
    const lv = LEVELS[14]!;
    const pm = roundProps(lv, [{ enemy: "transporter", count: 1, gap: 1, delay: 0 }]);
    expect(pm & P.wrapped).toBeTruthy();
    expect(pm & P.reefer).toBeTruthy();
    expect(pm & P.plated).toBeFalsy();
  });

  it("names a vehicle by the properties it carries beyond its own", () => {
    expect(vehicleName("lorry", P.stealth)).toBe("Stealth Box lorry");
    expect(vehicleName("van", P.plated | P.reinforced)).toBe("Plated Reinforced Delivery van");
    expect(vehicleName("artic", P.wrapped | P.reefer)).toBe("Artic");
    expect(vehicleName("quad", P.airborne)).toBe("Cargo quadcopter");
  });

  it("the Book brings each property when the spec says: Wrapped 8, Sealed 15, Reefer 18, Stealth 22, Plated 26, Rebrand 30, Artic 33, Reinforced 42", () => {
    const first = (prop: Property) => BOOK.findIndex((r) => r.groups.some((g) => g.props?.includes(prop) || RUNGS[g.rung]?.props?.includes(prop))) + 1;
    expect(first("wrapped")).toBe(8);
    expect(first("sealed")).toBe(15);
    expect(first("reefer")).toBe(18);
    expect(first("stealth")).toBe(22);
    expect(first("plated")).toBe(26);
    expect(first("rebrand")).toBe(30);
    expect(BOOK.findIndex((r) => r.groups.some((g) => g.rung === "artic")) + 1).toBe(33);
    expect(first("reinforced")).toBe(42);
    expect(propMask(["stealth", "plated"])).toBe(P.stealth | P.plated);
  });
});

/** A level with some towers taken away (a field without detection, a Sharp-only field). */
const only = (lv: Level, towers: TowerKind[]): Level => ({ ...lv, towers: lv.towers.filter((t) => towers.includes(t)) });

describe("hedgerow M3: lessons", () => {
  it("acceptance: losing level 15 without a Mast says Stealth, and that a Radio Mast reveals stealth", () => {
    const lv = LEVELS[14]!;
    // The balanced bot never builds a Mast (the Mast is on offer, it just isn't used).
    expect(lv.towers).toContain("mast");
    const g = playLevel(lv, "balanced");
    expect(g.phase).toBe("lost");
    expect(bookRound(lv, g.wave)).toBe(22);
    const top = lossCauses(g)[0]!;
    expect(top.cause).toBe("stealth");
    expect(top.round).toBe(22);
    expect(top.towers).toContain("mast");
    const banner = leakReport({ kind: "lorry", pm: P.stealth, lost: 11, cause: "stealth" });
    expect(banner.title).toBe("Leaked: Stealth Box lorry (11)");
    expect(`${banner.title} ${banner.sub}`).toMatch(/Stealth.*Radio Mast reveals stealth/);
    // With the Mast, the same bot wins.
    expect(playLevel(lv, "best").phase).toBe("won");
  }, 120_000);

  it("a bot without detection leaks on round 22, whichever level plays it", () => {
    // (Not level 15: its Crowds bring the stealth lorries a size smaller, and the best bot's thorn hedges, which
    // need no sight, shred them. The balanced bot's field still loses it to stealth: the acceptance test above.)
    for (const id of [17, 18, 21]) {
      const lv = LEVELS[id - 1]!;
      const g = playLevel(only(lv, lv.towers.filter((t) => t !== "mast")), "best");
      expect(g.leakLog.stealth?.round, `level ${id}`).toBe(22);
      expect(g.leakLog.stealth!.lost, `level ${id}`).toBeGreaterThan(20);
    }
  }, 180_000);

  it("a Sharp-only field leaks on round 26: Plated lorries", () => {
    for (const id of [26, 27]) {
      // Every lane-side plot a tier 3 Scarecrow (Sharp), with Masts for stealth, and Marks to spare: it clears
      // everything the Book sends until steel arrives, then the beaks bounce off.
      const lv = { ...LEVELS[id - 1]!, startMarks: 1e6, twists: [] };
      const g = newGame(lv);
      const lane = new Set<string>();
      for (let d = 0; d < g.pathLength; d += 0.5) {
        const q = pointAt(lv.path, d);
        lane.add(`${Math.floor(q.x)},${Math.floor(q.y)}`);
      }
      let n = 0;
      for (let r = 0; r < lv.rows; r++)
        for (let c = 0; c < lv.cols; c++) {
          if (!isPlot(lv, c, r)) continue;
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => lane.has(`${c + dc!},${r + dr!}`));
          if (!near) continue;
          const kind: TowerKind = n++ % 6 === 0 ? "mast" : "scarecrow";
          if (place(g, kind, c, r).ok) {
            const t = g.towers[g.towers.length - 1]!;
            while (t.tier < 3 && upgrade(g, t.id).ok);
          }
        }
      while (g.phase !== "won" && g.phase !== "lost" && bookRound(lv, g.wave) < 26) {
        if (g.phase === "build") sendWave(g);
        stepGame(g);
      }
      while (g.phase === "wave") stepGame(g);
      expect(Object.keys(g.leakLog), `level ${id}`).toEqual(["plated"]);
      expect(g.leakLog.plated!.round, `level ${id}`).toBe(26);
      expect(g.leakLog.plated!.lost, `level ${id}`).toBeGreaterThan(20);
    }
  }, 180_000);

  it("a Scarecrow-only (naive) bot loses by act 2, and loses every level that plays round 22", () => {
    const act2 = LEVELS.filter((l) => l.id >= 11 && l.id <= 20);
    const lost = act2.filter((l) => playLevel(l, "naive").phase === "lost").map((l) => l.id);
    expect(lost.length).toBeGreaterThanOrEqual(5);
    for (const id of [15, 16, 17, 18, 19, 20]) expect(lost, `level ${id}`).toContain(id);
  }, 240_000);

  it("the best bot wins every level of acts 2 and 3 on fleet rules", () => {
    for (const lv of LEVELS.filter((l) => l.id >= 11 && l.id <= 30)) {
      expect(isFleet(lv)).toBe(true);
      expect(kept(playLevel(lv, "best")), `level ${lv.id}`).toBeGreaterThanOrEqual(0.5);
    }
  }, 600_000);
});
