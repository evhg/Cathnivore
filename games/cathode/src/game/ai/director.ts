// S11 firefight director (docs/design/cathode-combat.md C16): groups the street's Hollowell men into squads (one per
// encounter zone, up to six, by who stands near whom), runs each squad's tokens and roles (squad.ts), hands out and
// reserves cover points, keeps a squad's picture of her shared (one man sees her, they all know where she is),
// applies morale, and turns what happens into barks through the S10 rate limits. The session drains `barks`.

import * as THREE from "three";
import type { Enemy } from "../enemy";
import type { Difficulty } from "../../sim/types";
import { BarkGate, Squad, barkDuration, barkLine, coverAngle, makeMember, protectionFrom, scoreCover, surname, type BarkKind, type Flat, type Member, type SquadRole } from "./squad";
import { ALLY_DEATH_M, moraleEvent } from "../../sim/morale";
import type { CoverPoint } from "./cover";
import { Tactics, type TacEvent } from "./tactics";

export interface Bark {
  e: Enemy;
  kind: BarkKind;
  line: string;
}

/** How near men must stand to share a squad (m), and how far they look for cover (m). */
const SQUAD_LINK_M = 22;
const COVER_RADIUS_M = 16;

interface Entry {
  e: Enemy;
  squad: Squad;
  member: Member;
  claim: number;
  banned: Set<number>;
  strafe: number;
  wasAlive: boolean;
  hpWas: number;
}

export class Director {
  readonly squads: Squad[] = [];
  private readonly byEnemy = new Map<Enemy, Entry>();
  private readonly gates = new Map<Squad, BarkGate>();
  private readonly claims = new Map<number, Enemy>();
  private readonly spotted = new Set<Squad>();
  private readonly lostSaid = new Set<Squad>();
  readonly barks: Bark[] = [];
  cover: CoverPoint[] = [];
  private cath: Flat = { x: 0, z: 0 };
  private cathV = new THREE.Vector3();

  constructor(readonly difficulty: Difficulty) {}

  /** Who fights as a squad: Hollowell riflemen, sergeants, shields and snipers (machines and civilians don't). */
  static joins(e: Enemy): boolean {
    const r = e.kit.role ?? "rifle";
    return r === "rifle" || r === "shield" || r === "sniper";
  }

  /** Riflemen and sergeants run the cover tactics. */
  static tactical(e: Enemy): boolean {
    return (e.kit.role ?? "rifle") === "rifle";
  }

  /** Builds the squads from the street's men (call once they're placed; later spawns call `enlist`). */
  form(enemies: readonly Enemy[]): void {
    for (const e of enemies) this.enlist(e, enemies);
  }

  enlist(e: Enemy, all: readonly Enemy[] = []): void {
    if (this.byEnemy.has(e) || !Director.joins(e) || e.passive) return;
    // The nearest squad with room whose men stand within the link distance.
    let squad: Squad | null = null;
    let best = Infinity;
    for (const s of this.squads) {
      if (s.members.length >= 6) continue;
      for (const m of s.members) {
        const d = Math.hypot(m.pos.x - e.position.x, m.pos.z - e.position.z);
        if (d < SQUAD_LINK_M && d < best) {
          best = d;
          squad = s;
        }
      }
    }
    if (!squad) {
      squad = new Squad(this.difficulty);
      this.squads.push(squad);
      this.gates.set(squad, new BarkGate());
    }
    const role = e.kit.role ?? "rifle";
    const member = squad.add(makeMember(e.id, { x: e.position.x, z: e.position.z }, { leader: !!e.kit.leader, canFlank: role === "rifle" }));
    this.byEnemy.set(e, { e, squad, member, claim: -1, banned: new Set(), strafe: e.id % 2 ? 1 : -1, wasAlive: e.alive, hpWas: e.hp });
    if (Director.tactical(e)) e.tac = new Tactics(e, this);
    void all;
  }

  memberOf(e: Enemy): Member | null {
    return this.byEnemy.get(e)?.member ?? null;
  }

  squadOf(e: Enemy): Squad | null {
    return this.byEnemy.get(e)?.squad ?? null;
  }

  strafeSign(e: Enemy): number {
    const en = this.byEnemy.get(e);
    if (!en) return 1;
    if (Math.random() < 0.006) en.strafe = -en.strafe;
    return en.strafe;
  }

  /** He's the only one of his squad still standing. */
  lastAlive(e: Enemy): boolean {
    const s = this.squadOf(e);
    return !s || s.alive.length <= 1;
  }

  /** His squad saw her in the last few seconds: he knows where she is even from behind cover. */
  knows(e: Enemy): boolean {
    const s = this.squadOf(e);
    return !!s && s.seen && s.outOfSight < 6;
  }

  /** Advance: he's further from where she was last seen than the push wants. */
  tooFar(e: Enemy): boolean {
    const s = this.squadOf(e);
    if (!s) return false;
    return Math.hypot(e.position.x - s.lastSeen.x, e.position.z - s.lastSeen.z) > 11;
  }

  /** The flanker's spot is round her side (his point's angle to her line from the squad is wide). */
  flankSpot(e: Enemy): boolean {
    const en = this.byEnemy.get(e);
    const c = e.tac?.cover;
    if (!en || !c) return false;
    return this.flankTerm(en.squad, c) > 0.55;
  }

  /** 0..1: how far round her side a point is, against the squad's line to her. */
  private flankTerm(s: Squad, c: Flat): number {
    let x = 0;
    let z = 0;
    let n = 0;
    for (const m of s.alive) {
      if (m.role === "flank") continue;
      x += m.pos.x;
      z += m.pos.z;
      n++;
    }
    if (!n) return 0;
    const a = coverAngle({ x: x / n - this.cath.x, z: z / n - this.cath.z }, this.cath, { x: c.x, z: c.z });
    return Math.max(0, Math.min(1, (a - 25) / 65));
  }

  claim(e: Enemy, idx: number): void {
    this.unclaim(e);
    const en = this.byEnemy.get(e);
    if (!en) return;
    en.claim = idx;
    this.claims.set(idx, e);
  }

  unclaim(e: Enemy): void {
    const en = this.byEnemy.get(e);
    if (!en || en.claim < 0) return;
    if (this.claims.get(en.claim) === e) this.claims.delete(en.claim);
    en.claim = -1;
  }

  ban(e: Enemy, idx: number): void {
    if (idx >= 0) this.byEnemy.get(e)?.banned.add(idx);
  }

  /** S11's scoring over the points within reach that no one else holds. */
  pickCover(e: Enemy, role: SquadRole, fallback: boolean): { idx: number; point: CoverPoint } | null {
    const en = this.byEnemy.get(e);
    if (!en || !this.cover.length) return null;
    const s = en.squad;
    const target = s.seen ? s.lastSeen : this.cath;
    const others: Flat[] = [];
    for (const [idx, who] of this.claims) if (who !== e && who.alive) others.push(this.cover[idx]!);
    for (const m of s.alive) if (m.id !== e.id) others.push(m.pos);
    let best: { idx: number; point: CoverPoint; score: number } | null = null;
    const p = e.position;
    for (let i = 0; i < this.cover.length; i++) {
      const c = this.cover[i]!;
      const reach = Math.hypot(c.x - p.x, c.z - p.z);
      if (reach > (fallback ? COVER_RADIUS_M * 1.6 : COVER_RADIUS_M) || Math.abs(c.y - p.y) > 0.6) continue;
      if (en.banned.has(i) || (this.claims.has(i) && this.claims.get(i) !== e)) continue;
      const prot = protectionFrom(c.prot, { x: c.fx, z: c.fz }, c, target);
      if (prot <= 0.05) continue;
      let crowd = 99;
      for (const o of others) crowd = Math.min(crowd, Math.hypot(o.x - c.x, o.z - c.z));
      let dist = Math.hypot(c.x - target.x, c.z - target.z);
      // Advance pushes the band in (8-20 m becomes about 3-14 m).
      if (role === "advance") dist += 6;
      // The path there: how much of it runs toward her (a run across her front is exposure).
      const toward = Math.max(0, (Math.hypot(p.x - target.x, p.z - target.z) - Math.hypot(c.x - target.x, c.z - target.z)) / Math.max(1, reach));
      const exposure = Math.min(1, (reach / 12) * (0.4 + 0.6 * toward));
      let score = scoreCover({ protection: prot, distance: dist, crowd, exposure, flank: role === "flank" ? this.flankTerm(s, c) * 1.8 : 0 });
      if (fallback) score = prot * 3 + Math.hypot(c.x - target.x, c.z - target.z) / 5 - exposure;
      // Don't hop for nothing: the point he's on keeps a small edge.
      if (en.claim === i) score += 0.4;
      // A long run is a long exposure.
      score -= reach * 0.04;
      if (!best || score > best.score) best = { idx: i, point: c, score };
    }
    return best ? { idx: best.idx, point: best.point } : null;
  }

  /** Every frame, before the enemies update (who saw her is last frame's `seesHer`). */
  update(dt: number, cath: THREE.Vector3): void {
    this.cath = { x: cath.x, z: cath.z };
    this.cathV.copy(cath);
    for (const s of this.squads) {
      this.gates.get(s)!.tick(dt);
    }
    // Deaths: allies within 15 m lose nerve, the leader's death shakes the whole squad; "Man down!".
    for (const en of this.byEnemy.values()) {
      const e = en.e;
      if (en.wasAlive && !e.alive) {
        en.member.alive = false;
        this.unclaim(e);
        const lead = !!e.kit.leader;
        for (const o of this.byEnemy.values()) {
          if (o === en || !o.e.alive || o.squad !== en.squad) continue;
          if (lead) moraleEvent(o.e.morale, "leaderDied");
          else if (o.e.position.distanceTo(e.position) < ALLY_DEATH_M) moraleEvent(o.e.morale, "allyDied");
        }
        const witness = en.squad.alive.map((m) => this.enemyOf(m)).find((o) => o && o.alive && o !== e);
        if (witness) this.say(witness, "manDown", { name: e.id % 2 ? surname(e.id * 7 + 3) : undefined });
      }
      en.wasAlive = e.alive;
      if (e.alive && e.hp < en.hpWas) {
        if (e.hp < e.kit.maxHp * 0.25) moraleEvent(e.morale, "lowHp");
        if (e.hp < e.kit.maxHp * 0.5 && en.hpWas >= e.kit.maxHp * 0.5 && Math.random() < 0.5) this.say(e, "wounded");
      }
      en.hpWas = e.hp;
      en.member.pos.x = e.position.x;
      en.member.pos.z = e.position.z;
      en.member.los = e.alive && e.state === "combat" && e.seesHer && !e.tac?.surrendered;
    }
    for (const s of this.squads) {
      s.tick(dt, this.cath);
      const live = s.alive.map((m) => this.enemyOf(m)).filter((e): e is Enemy => !!e && e.alive);
      // One man sees her: the squad comes into the fight together and shares where she is.
      const fighting = live.some((e) => e.state === "combat");
      if (fighting && s.seen && s.outOfSight < 6) {
        if (!this.spotted.has(s)) {
          this.spotted.add(s);
          const first = live.find((e) => e.seesHer) ?? live[0];
          if (first) this.say(first, "contact");
        }
        this.lostSaid.delete(s);
        for (const e of live) {
          if (e.passive) continue;
          e.joinFight(s.lastSeen);
        }
      }
      if (s.seen && s.outOfSight > 5 && !this.lostSaid.has(s) && live.length) {
        this.lostSaid.add(s);
        this.say(live[0]!, "lost");
      }
      // Quiet seconds in cover build nerve back.
      for (const e of live) {
        // "No damage" read strictly: a round cracking past him (suppression) stops it too.
        if (e.tac && e.tac.act === "hide" && e.sinceHit > 1 && e.tac.lastNearMiss > 1.5) moraleEvent(e.morale, "coverSecond", dt);
      }
    }
  }

  /**
   * After the enemies update: each man's tactical events (the chirp, the mag out and in, the bolt) go to `on` for the
   * session's sound and props, and the ones that are lines become barks.
   */
  drain(enemies: readonly Enemy[], on: (e: Enemy, ev: TacEvent) => void): void {
    for (const e of enemies) {
      if (!e.tac || !e.tac.events.length) continue;
      for (const ev of e.tac.events) {
        if (ev.kind === "reloadStart") this.say(e, "reload");
        else if (ev.kind === "flanked") this.say(e, "flank", { side: ev.side });
        else if (ev.kind === "fallBack") this.say(e, "fallBack");
        else if (ev.kind === "surrender") this.say(e, "surrender");
        on(e, ev);
      }
      e.tac.events.length = 0;
    }
  }

  /** A takedown in his view (S11: -0.35). */
  takedownSeen(at: THREE.Vector3): void {
    for (const en of this.byEnemy.values()) {
      if (en.e.alive && en.e.state === "combat" && en.e.position.distanceTo(at) < 25) moraleEvent(en.e.morale, "takedownSeen");
    }
  }

  /** A bark through the squad's radio, if the rate limits allow it. */
  say(e: Enemy, kind: BarkKind, o: { name?: string; side?: "left" | "right" } = {}): boolean {
    const s = this.squadOf(e);
    const gate = s ? this.gates.get(s) : null;
    const line = barkLine(kind, Math.random, o);
    if (gate && !gate.ask(e.id, kind, barkDuration(line))) return false;
    this.barks.push({ e, kind, line });
    return true;
  }

  private enemyOf(m: Member): Enemy | null {
    for (const en of this.byEnemy.values()) if (en.member === m) return en.e;
    return null;
  }
}
