// Dev-only harness: mounts the progression screens with sample characters for screenshots.
// Open /ui-lab.html?screen=classpick|character|levelup&char=fresh|mid|eligible|dual&tab=skills.
// Not part of the shipped build (vite builds only index.html).

import "../../../../shared/cath/cath.css";
import "../styles.css";
import { gainXp, newCharacter, type Character } from "../sim/character";
import { makeItem, makeUnique, rollItem, socketChip, type Item } from "../sim/loot";
import { createRng } from "../sim/rng";
import { spendSkill } from "../sim/skills";
import { xpForLevel } from "../sim/stats";
import type { ClassId } from "../sim/types";
import { openCharacter, type CharacterTab } from "./character";
import { openClassPick } from "./classpick";
import { levelUpToast } from "./levelup";

const params = new URLSearchParams(location.search);
const host = document.getElementById("lab")!;

function levelTo(c: Character, level: number): Character {
  return gainXp(c, xpForLevel(level) - c.xp + 40).character;
}

function learn(c: Character, ids: [string, number][]): Character {
  let h = c;
  for (const [id, n] of ids) {
    const r = spendSkill(h, id, n);
    if (r.ok) h = r.value;
    else console.warn(id, r.reason);
  }
  return h;
}

function loot(): Item[] {
  const rng = createRng("lab-loot");
  const out: Item[] = [];
  const lullaby = makeUnique("lullaby");
  if (lullaby) out.push(lullaby);
  for (const id of ["widowsHat", "widowsGloves", "longGoodbye"]) {
    const it = makeUnique(id);
    if (it) out.push(it);
  }
  out.push(rollItem(rng, 14, "rare", "weapon"), rollItem(rng, 14, "rare", "gear"), rollItem(rng, 12, "modded", "gear"));
  out.push(rollItem(rng, 9, "modded", "weapon"));
  let chain: Item | null = makeItem("widowmaker", { sockets: 3, level: 12 });
  for (const chip of ["ash", "rain", "cold"]) chain = chain ? socketChip(chain, chip) : null;
  if (chain) out.push(chain);
  out.push(makeItem("opticImplant"), makeItem("reflexBooster"), makeItem("riotVisor"));
  out.push(makeItem("ash"), makeItem("glass"));
  const big = makeUnique("candorsConscience");
  if (big) out.push(big);
  return out;
}

function sample(kind: string, cls: ClassId): Character {
  let c = newCharacter(cls);
  if (kind === "fresh") return c;
  if (kind === "mid" || kind === "eligible") {
    c = levelTo(c, kind === "mid" ? 13 : 16);
    c = learn(c, [
      ["ghost.steadyHands", 4],
      ["ghost.heldBreath", 1],
      ["ghost.windReader", 2],
      ["ghost.slowTime", 1],
      ["ghost.deadCalm", 2],
      ["ghost.softSoles", 1],
      ["ghost.caseTheRoom", 1],
    ]);
    c = { ...c, unspentAttributes: 7, scrip: 4200, inventory: loot() };
    return c;
  }
  // dual: a level-31 Ghost × Wirewitch
  c = levelTo(c, 31);
  c = { ...c, classes: ["ghost", "wirewitch"] };
  c = learn(c, [
    ["ghost.steadyHands", 8],
    ["ghost.heldBreath", 2],
    ["ghost.windReader", 3],
    ["ghost.slowTime", 2],
    ["ghost.deadCalm", 5],
    ["ghost.tungsten", 1],
    ["ghost.rangefinder", 1],
    ["ghost.railDiscipline", 1],
    ["ghost.longExposure", 1],
    ["ghost.oneShot", 1],
    ["wirewitch.backdoor", 2],
    ["wirewitch.handshake", 1],
  ]);
  c = { ...c, unspentAttributes: 0, scrip: 900, inventory: loot() };
  return c;
}

const screen = params.get("screen") ?? "character";
const cls = (params.get("cls") as ClassId | null) ?? "ghost";
let ch = sample(params.get("char") ?? "mid", cls);

if (screen === "classpick") {
  openClassPick(host, (picked) => {
    host.textContent = `Picked ${picked}`;
  }, cls);
} else if (screen === "levelup") {
  // Screenshots call window.labLevelUp() and capture mid-flight; a click replays it by hand.
  const fire = () => void levelUpToast(host, 12, { attributes: 5, skills: 1 });
  (window as unknown as { labLevelUp: () => void }).labLevelUp = fire;
  document.addEventListener("click", fire);
} else {
  const open = () =>
    openCharacter(
      host,
      () => ch,
      (next) => {
        ch = next;
      },
      () => {
        const b = document.createElement("button");
        b.className = "btn btn-primary";
        b.textContent = "Open character";
        b.addEventListener("click", () => {
          b.remove();
          open();
        });
        host.append(b);
      },
      { tab: (params.get("tab") as CharacterTab | null) ?? undefined },
    );
  open();
}
