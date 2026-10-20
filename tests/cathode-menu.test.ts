import { describe, expect, it } from "vitest"
import { MenuModel, menuKey } from "../games/cathode/src/ui/menu"
import { areaTitle, frontSet, listRows, namesLeft, slotHint, titleSubtitle } from "../games/cathode/src/ui/frontcopy"

const SLOTS = () => [
  { id: "continue", enabled: false },
  { id: "new", enabled: true },
  { id: "settings", enabled: true },
  { id: "credits", enabled: true },
]

describe("front door menu model (C13)", () => {
  it("keeps fixed slots: a disabled CONTINUE keeps its row and focus starts on the first enabled one", () => {
    const m = new MenuModel(SLOTS())
    expect(m.slots.map((s) => s.id)).toEqual(["continue", "new", "settings", "credits"])
    expect(m.focus).toBe(1)
  })

  it("wraps at both ends and steps over disabled slots", () => {
    const m = new MenuModel(SLOTS())
    expect(m.move(-1)).toBe(3) // up from NEW CASE wraps past the disabled CONTINUE to CREDITS
    expect(m.move(1)).toBe(1) // down from CREDITS wraps past CONTINUE to NEW CASE
    m.enable("continue", true)
    expect(m.move(-1)).toBe(0)
    expect(m.move(-1)).toBe(3)
  })

  it("ticks once on every focus change and never on a no-op", () => {
    const ticks: number[] = []
    const m = new MenuModel(SLOTS(), (i) => ticks.push(i))
    m.move(1)
    m.move(1)
    m.set(3) // already there
    m.set(0) // disabled
    m.move(1)
    expect(ticks).toEqual([2, 3, 1])
  })

  it("moves the focus on when the focused slot is turned off", () => {
    const m = new MenuModel(SLOTS(), () => {}, 2)
    expect(m.focus).toBe(2)
    m.enable("settings", false)
    expect(m.focus).toBe(3)
  })

  it("maps keys: arrows and WASD move, Enter and Space confirm, Escape goes back", () => {
    expect(menuKey("ArrowUp")).toBe("up")
    expect(menuKey("w")).toBe("up")
    expect(menuKey("s")).toBe("down")
    expect(menuKey("ArrowDown")).toBe("down")
    expect(menuKey("Enter")).toBe("confirm")
    expect(menuKey(" ")).toBe("confirm")
    expect(menuKey("Escape")).toBe("back")
    expect(menuKey("x")).toBe(null)
  })
})

describe("front door copy from progress (C13)", () => {
  it("counts the names left in the subtitle", () => {
    expect(titleSubtitle([])).toBe("HOLLOWELL PROPER · 2079 · 5 NAMES LEFT")
    expect(titleSubtitle(["fishMarket", "crispBoss", "vaneBoss"])).toBe("HOLLOWELL PROPER · 2079 · 3 NAMES LEFT")
    expect(titleSubtitle(["crispBoss", "vaneBoss", "pellBoss", "boardBoss"])).toBe("HOLLOWELL PROPER · 2079 · 1 NAME LEFT")
    expect(titleSubtitle(["crispBoss", "vaneBoss", "pellBoss", "boardBoss", "vaultBoss"])).toMatch(/THE LIST IS CLOSED$/)
    expect(namesLeft(["fishMarket"])).toBe(5)
  })

  it("strikes dealt-with names and puts the caret on the next one", () => {
    const rows = listRows(["crispBoss"])
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatchObject({ done: true, next: false })
    expect(rows[1]).toMatchObject({ name: "Dr Octavia Vane", done: false, next: true })
    expect(rows.filter((r) => r.next)).toHaveLength(1)
  })

  it("hints where Continue resumes, and never a district the save hasn't reached", () => {
    expect(slotHint("continue", { hasSave: false, jobsDone: [] })).toBe("NO CASE OPEN")
    expect(slotHint("continue", { hasSave: true, jobsDone: [] })).toBe("RESUME · THE DROWNED MARKET · THE FISH MARKET")
    expect(slotHint("continue", { hasSave: true, jobsDone: ["fishMarket", "crispLead", "quayContracts", "candorManifest", "crispBoss"], district: "clinic" })).toBe(
      "RESUME · THE CANDOR CLINIC · THE CLINIC REGISTER",
    )
    expect(slotHint("new", { hasSave: true, jobsDone: [], armed: true })).toMatch(/PRESS AGAIN/)
  })

  it("names the area after the push", () => {
    expect(areaTitle(undefined, [])).toEqual({ title: "THE FISH MARKET", sub: "Drowned Market, low tide" })
    expect(areaTitle("market", ["fishMarket"]).title).toBe("THE DROWNED MARKET")
    expect(areaTitle("plaza", []).title).toBe("HOLLOWELL PLAZA")
  })

  it("dresses the title scene from progress", () => {
    expect(frontSet([])).toEqual({ signDark: false, tally: 0 })
    expect(frontSet(["fishMarket", "crispBoss"])).toEqual({ signDark: true, tally: 1 })
  })
})
