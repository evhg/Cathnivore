// Plan item 14: conversations and interrogations. Each district has one lieutenant Cath can grab after a
// takedown and talk to. A talk offers 2 to 4 choices: Press (gated by Nerve), Charm, Pay (costs Scrip) and,
// where he carries a handset, Wire (gated by Wire). Every choice gives intel: a waypoint to a secret, a squad
// struck off the district's alarm (an `ENTRIES` key in game/encounters.ts), or a boss weakness. Pure: the
// choice is recorded in `jobsDone` as `talk:<talk>:<option>`, and everything else is read back from that.

import type { Attributes } from "./types";

export type DistrictName = "market" | "clinic" | "plaza" | "tower" | "vault";
export type Approach = "press" | "charm" | "pay" | "wire";

export type Intel =
  | { kind: "waypoint"; secret: string }
  | { kind: "squad"; entry: string }
  | { kind: "weakness"; boss: "crisp" | "vane" | "pell" | "chair" | "vault"; effect: string };

export interface TalkOption {
  id: string;
  approach: Approach;
  /** What Cath says. */
  line: string;
  /** His answer. */
  reply: string;
  /** Press needs Nerve, Wire needs Wire. */
  gate?: { attr: "nerve" | "wire"; min: number };
  /** Scrip, for Pay. */
  cost?: number;
  intel: Intel;
}

export interface Talk {
  id: string;
  district: DistrictName;
  /** Who she has by the collar. */
  who: string;
  role: string;
  /** His first line, before she picks. */
  opener: string;
  options: TalkOption[];
}

export const TALKS: readonly Talk[] = [
  {
    id: "foreman",
    district: "market",
    who: "Dace Mulvey",
    role: "Crisp's dock foreman",
    opener: "I just stack the crates, love. Whatever you think I know, I don't.",
    options: [
      { id: "press", approach: "press", gate: { attr: "nerve", min: 25 }, line: "Then you won't mind me checking how deep the canal is.", reply: "All right! Crisp keeps a gun locker under the south stairs. Old shotgun, older than me.", intel: { kind: "waypoint", secret: "cache-testament" } },
      { id: "charm", approach: "charm", line: "Bea used to buy your mum's bread. Help me and I was never here.", reply: "...She was kind, your Bea. There's Scrip in a tin on the roof above the noodle stall. Take it.", intel: { kind: "waypoint", secret: "stash-roof" } },
      { id: "pay", approach: "pay", cost: 60, line: "Sixty Scrip says you remember something.", reply: "Sixty says Crisp's runners hide a pistol in the planter by the bridge.", intel: { kind: "waypoint", secret: "cache-nightshift" } },
    ],
  },
  {
    id: "orderly",
    district: "clinic",
    who: "Orderly Kessel",
    role: "Vane's night supervisor",
    opener: "You can't be on this ward. Visiting hours ended in 2031.",
    options: [
      { id: "press", approach: "press", gate: { attr: "nerve", min: 30 }, line: "Tell the team behind the ward doors to stand down. Now.", reply: "Ward five, stand down, false alarm... There. They're gone. Please.", intel: { kind: "squad", entry: "ambushBreach" } },
      { id: "wire", approach: "wire", gate: { attr: "wire", min: 25 }, line: "Your pager's on the clinic net. Hold still.", reply: "What did you do? The roof team's channel just went dead.", intel: { kind: "squad", entry: "ambushVent" } },
      { id: "pay", approach: "pay", cost: 80, line: "Eighty. What does Vane do when she's losing?", reply: "She calls her stitch team from the theatre phone. Cut it and nobody comes.", intel: { kind: "weakness", boss: "vane", effect: "no-stitch" } },
    ],
  },
  {
    id: "advance",
    district: "plaza",
    who: "Hal Brennick",
    role: "Pell's advance man",
    opener: "Do you know who I work for? Everyone in this square does.",
    options: [
      { id: "press", approach: "press", gate: { attr: "nerve", min: 30 }, line: "Call off the second van, or you go in the fountain.", reply: "Tram-stop unit, hold position. Hold! ...Done.", intel: { kind: "squad", entry: "alarmVanB" } },
      { id: "charm", approach: "charm", line: "You write his speeches. You must hate him a little.", reply: "More than a little. He turns his back to the crowd when he plays to the cameras. Every time.", intel: { kind: "weakness", boss: "pell", effect: "turns-back" } },
      { id: "pay", approach: "pay", cost: 100, line: "A hundred for the west-side van.", reply: "West unit, you're stood down. Pleasure doing business.", intel: { kind: "squad", entry: "alarmVan" } },
    ],
  },
  {
    id: "secchief",
    district: "tower",
    who: "Marta Oyelaran",
    role: "Board Tower night security",
    opener: "Badge, please. No? Then we have a problem.",
    options: [
      { id: "press", approach: "press", gate: { attr: "nerve", min: 35 }, line: "The second rope team. Recall them.", reply: "Atrium two, abort. ...You'll never work in this city again, you know that?", intel: { kind: "squad", entry: "alarmRopeB" } },
      { id: "wire", approach: "wire", gate: { attr: "wire", min: 30 }, line: "Your tablet runs the boardroom vents.", reply: "Don't! ...Fine. The right-hand vent's locked. Nobody's dropping through it.", intel: { kind: "weakness", boss: "chair", effect: "vent-locked" } },
      { id: "charm", approach: "charm", line: "You're paid by the hour. The Chair isn't worth dying for.", reply: "...Lobby team, go on break. Twenty minutes.", intel: { kind: "squad", entry: "alarmRopeA" } },
      { id: "pay", approach: "pay", cost: 120, line: "A hundred and twenty for a story about the Chair.", reply: "He never sits with his back to the window. Get behind him and he panics.", intel: { kind: "weakness", boss: "chair", effect: "panics-flanked" } },
    ],
  },
  {
    id: "clerk",
    district: "vault",
    who: "Ledger clerk Imm",
    role: "keeper of the Hollow Vault",
    opener: "I only count. I don't decide anything. I've never decided anything.",
    options: [
      { id: "press", approach: "press", gate: { attr: "nerve", min: 35 }, line: "Then count the men on that gantry, and send them home.", reply: "Gantry, return to the lift. Ledger's orders. ...They went.", intel: { kind: "squad", entry: "alarmRope" } },
      { id: "wire", approach: "wire", gate: { attr: "wire", min: 35 }, line: "Your ledger talks to the core. So will I.", reply: "You've opened the core's cooling shutters. It'll be exposed for... oh no.", intel: { kind: "weakness", boss: "vault", effect: "core-exposed" } },
      { id: "pay", approach: "pay", cost: 150, line: "Everything has a price. You'd know.", reply: "One hundred and fifty, entered. The lift team is now off the books.", intel: { kind: "squad", entry: "alarmLift" } },
    ],
  },
];

export const talkKey = (talk: string, option: string): string => `talk:${talk}:${option}`;

export function talkFor(district: DistrictName): Talk | undefined {
  return TALKS.find((t) => t.district === district);
}

/** Whether she can pick an option, and why not. */
export function optionState(opt: TalkOption, attrs: Attributes, scrip: number): { open: boolean; why?: string } {
  if (opt.gate && attrs[opt.gate.attr] < opt.gate.min) return { open: false, why: `${opt.gate.attr === "nerve" ? "Nerve" : "Wire"} ${opt.gate.min}` };
  if (opt.cost && scrip < opt.cost) return { open: false, why: `${opt.cost} Scrip` };
  return { open: true };
}

export type ChooseResult = { ok: true; reply: string; intel: Intel; scrip: number; record: string } | { ok: false; why: string };

/** Picks an option: the Scrip left afterwards and the `jobsDone` entry to record. One choice per talk. */
export function choose(talk: Talk, optionId: string, attrs: Attributes, scrip: number, jobsDone: readonly string[]): ChooseResult {
  if (talked(talk.id, jobsDone)) return { ok: false, why: "already talked" };
  const opt = talk.options.find((o) => o.id === optionId);
  if (!opt) return { ok: false, why: "no such option" };
  const st = optionState(opt, attrs, scrip);
  if (!st.open) return { ok: false, why: st.why ?? "locked" };
  return { ok: true, reply: opt.reply, intel: opt.intel, scrip: scrip - (opt.cost ?? 0), record: talkKey(talk.id, opt.id) };
}

export function talked(talkId: string, jobsDone: readonly string[]): boolean {
  return jobsDone.some((j) => j.startsWith(`talk:${talkId}:`));
}

/** Every piece of intel she holds, read back from `jobsDone`. */
export function intelHeld(jobsDone: readonly string[]): Intel[] {
  const out: Intel[] = [];
  for (const t of TALKS) for (const o of t.options) if (jobsDone.includes(talkKey(t.id, o.id))) out.push(o.intel);
  return out;
}

/** The alarm entrances in a district that will not come, because she talked them off. */
export function squadsRemoved(district: DistrictName, jobsDone: readonly string[]): string[] {
  const t = talkFor(district);
  if (!t) return [];
  return t.options.filter((o) => o.intel.kind === "squad" && jobsDone.includes(talkKey(t.id, o.id))).map((o) => (o.intel as { entry: string }).entry);
}

export function hasWeakness(boss: string, effect: string, jobsDone: readonly string[]): boolean {
  return intelHeld(jobsDone).some((i) => i.kind === "weakness" && i.boss === boss && i.effect === effect);
}

export function waypoints(jobsDone: readonly string[]): string[] {
  return intelHeld(jobsDone).flatMap((i) => (i.kind === "waypoint" && !jobsDone.includes(`secret:${i.secret}`) ? [i.secret] : []));
}

/** The talks she has had, in district order, with the choice she made (the case board's intel cards). */
export function talksHeld(jobsDone: readonly string[]): Array<{ talk: Talk; option: TalkOption }> {
  const out: Array<{ talk: Talk; option: TalkOption }> = [];
  for (const t of TALKS) for (const o of t.options) if (jobsDone.includes(talkKey(t.id, o.id))) out.push({ talk: t, option: o });
  return out;
}

/** What the intel card says she got, under his words. */
export function intelLine(i: Intel): string {
  if (i.kind === "waypoint") return "Marked on the market map.";
  if (i.kind === "squad") return "One alarm squad won't come.";
  return "A weakness for the fight.";
}

/** Plan item 14: what a boss weakness does in the fight. */
export interface BossEdge {
  /** Multiplies the boss's HP at spawn (under 1: he goes down faster). */
  hpMul: number;
  /** Vane: her half-health stitch (the heal and the team she calls) never comes. */
  noPatch: boolean;
  /** The Chair: the right-hand vent stays shut, so no man drops through it. */
  ventLocked: boolean;
  /** What Bea says as the fight opens, so the player knows the edge is real. */
  lines: string[];
}

const EDGES: Record<string, { hpMul?: number; noPatch?: boolean; ventLocked?: boolean; line: string }> = {
  "vane:no-stitch": { noPatch: true, line: "Bea: Kessel cut the theatre phone. No stitch team tonight." },
  "pell:turns-back": { hpMul: 0.75, line: "Bea: Brennick says he turns his back to play the cameras. Hit him then." },
  "chair:vent-locked": { ventLocked: true, line: "Bea: Oyelaran locked the right-hand vent. That side's clear." },
  "chair:panics-flanked": { hpMul: 0.85, line: "Bea: Get behind the Chair. Oyelaran says that's when the panic starts." },
  "vault:core-exposed": { hpMul: 0.75, line: "Bea: Imm opened the cooling shutters. The core is exposed." },
};

export function bossEdge(boss: "crisp" | "vane" | "pell" | "chair" | "vault", jobsDone: readonly string[]): BossEdge {
  const edge: BossEdge = { hpMul: 1, noPatch: false, ventLocked: false, lines: [] };
  for (const i of intelHeld(jobsDone)) {
    if (i.kind !== "weakness" || i.boss !== boss) continue;
    const e = EDGES[`${i.boss}:${i.effect}`];
    if (!e) continue;
    edge.hpMul *= e.hpMul ?? 1;
    edge.noPatch ||= !!e.noPatch;
    edge.ventLocked ||= !!e.ventLocked;
    edge.lines.push(e.line);
  }
  return edge;
}
