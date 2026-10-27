// C20 (S3.3) "ED-Class Mech": two shoulder missile pods you can shoot off. A pod has its own HP; a round that meets
// it spends that HP before it reaches the mech, and a broken pod fires no more missiles. As pure data: the game
// draws the break and `podsAlive` gates the missile volley.

export type PodId = "podL" | "podR";
export interface Pod {
  id: PodId;
  hp: number;
  maxHp: number;
  broken: boolean;
}

/** Each pod holds this share of the mech's max HP; a pod keeps this share of a round from the hull while it stands. */
export const POD = { share: 0.08, absorb: 0.7, volley: 4 } as const;

export function makePods(mechMaxHp: number): Pod[] {
  const hp = Math.round(mechMaxHp * POD.share);
  return (["podL", "podR"] as const).map((id) => ({ id, hp, maxHp: hp, broken: false }));
}

export interface PodHit {
  /** Damage that reached the hull. */
  through: number;
  /** True on the round that broke the pod. */
  broke: boolean;
}

/** A round of `dmg` on a pod. A broken pod is just hull: everything goes through. */
export function podHit(pod: Pod, dmg: number): PodHit {
  if (pod.broken) return { through: dmg, broke: false };
  const taken = Math.min(pod.hp, dmg);
  pod.hp -= taken;
  const broke = pod.hp <= 0;
  if (broke) pod.broken = true;
  // While it stands the pod keeps `absorb` of the round from the hull; the overkill on the breaking round goes through.
  return { through: (dmg - taken) + (broke ? 0 : dmg * (1 - POD.absorb)), broke };
}

export const podsAlive = (pods: readonly Pod[]): number => pods.filter((p) => !p.broken).length;

/** The missile volley: four per live pod, none once both are gone. */
export const missileVolley = (pods: readonly Pod[]): number => podsAlive(pods) * POD.volley;
