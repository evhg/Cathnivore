// The combat bus (S0): combat only emits; the HUD, audio, FX, viewmodel and post only listen. Every listener
// is called once per emit, in the order it subscribed.

import type { BlockedEvent, HitEvent, NearMissEvent } from "../../sim/hitevent";

export interface FireEvent {
  t: number;
  weaponCls: string;
  auto: boolean;
}
export interface KillBusEvent {
  t: number;
  targetUid: string;
  headshot: boolean;
  weaponCls: string;
  /** The last enemy of the encounter. */
  last: boolean;
}

export interface BusEvents {
  fire: FireEvent;
  hit: HitEvent;
  blocked: BlockedEvent;
  nearMiss: NearMissEvent;
  kill: KillBusEvent;
  plateBreak: HitEvent;
  visorBreak: HitEvent;
  sever: HitEvent;
  stagger: HitEvent;
  takedownStart: { t: number; targetUid: string };
  takedownImpact: { t: number; targetUid: string };
  takedownEnd: { t: number; targetUid: string };
  encounterCleared: { t: number };
  cathHit: { t: number; damage: number; bearing: number };
  guardBreak: { t: number };
  cathDown: { t: number };
  pickupSeen: { t: number; id: string };
  pickup: { t: number; id: string };
}

export type BusName = keyof BusEvents;
type Listener<K extends BusName> = (e: BusEvents[K]) => void;

export class CombatBus {
  private listeners = new Map<BusName, Listener<BusName>[]>();
  /** The last events of each kind, for tests and the screenshot hooks. */
  readonly log: { kind: BusName; e: unknown }[] = [];

  on<K extends BusName>(kind: K, fn: Listener<K>): () => void {
    let list = this.listeners.get(kind);
    if (!list) this.listeners.set(kind, (list = []));
    list.push(fn as Listener<BusName>);
    return () => {
      const l = this.listeners.get(kind);
      if (l) l.splice(l.indexOf(fn as Listener<BusName>), 1);
    };
  }

  emit<K extends BusName>(kind: K, e: BusEvents[K]): void {
    this.log.push({ kind, e });
    if (this.log.length > 64) this.log.shift();
    const list = this.listeners.get(kind);
    if (!list) return;
    for (const fn of list.slice()) fn(e);
  }
}
