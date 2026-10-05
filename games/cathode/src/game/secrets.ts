// Secrets on the quay: audio logs (Bea's drawings and Candor memos) and stashes of Scrip. Each glows faintly
// where it hides; walking over it collects it once. Recorded as `secret:<id>` in `jobsDone`.

import * as THREE from "three";

export interface Secret {
  id: string;
  kind: "log" | "stash" | "cache";
  x: number;
  z: number;
  /** The line played for a log. */
  text?: string;
  /** Scrip in a stash. */
  scrip?: number;
  /** The weapon in a cache (only collectable once the first job is done). */
  weapon?: string;
}

export const SECRETS: readonly Secret[] = [
  { id: "log-bea1", kind: "log", x: -8, z: 40, text: "Bea (tape): Crisp never signs anything twice. Look for the ledger he thinks is burned." },
  { id: "stash-crates", kind: "stash", x: 14, z: 28, scrip: 120 },
  { id: "log-memo1", kind: "log", x: 6, z: -4, text: "Candor memo: Harbour losses to be written off as 'weather'. Do not circulate." },
  { id: "stash-roof", kind: "stash", x: -8, z: 8, scrip: 200 },
  { id: "log-bea2", kind: "log", x: 0, z: 60, text: "Bea (tape): I drew your face on the wall so the rain would remember it. Silly. Come home." },
  { id: "stash-dock", kind: "stash", x: 9, z: 50, scrip: 160 },
  { id: "cache-rattlecan", kind: "cache", x: -12, z: 22, weapon: "rattlecan" },
  { id: "cache-nightshift", kind: "cache", x: 12, z: -26, weapon: "nightShift" },
  { id: "cache-testament", kind: "cache", x: -14, z: -52, weapon: "oldTestament" },
];

export const SECRET_RADIUS = 1.8;

export function secretKey(id: string): string {
  return `secret:${id}`;
}

export function found(jobsDone: readonly string[]): number {
  return SECRETS.filter((s) => jobsDone.includes(secretKey(s.id))).length;
}

export class Secrets {
  private readonly meshes = new Map<string, THREE.Mesh>();
  private t = 0;

  constructor(
    private readonly jobsDone: string[],
    private readonly ground: (x: number, z: number) => number,
    scene?: THREE.Scene,
  ) {
    if (!scene) return;
    for (const s of this.remaining()) {
      const colour = new THREE.Color(s.kind === "log" ? 0x7fe8ff : s.kind === "cache" ? 0xff6a9a : 0xffd27a);
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.1),
        new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 1.6, roughness: 0.4 }),
      );
      m.position.set(s.x, this.ground(s.x, s.z) + 0.5, s.z);
      scene.add(m);
      this.meshes.set(s.id, m);
    }
  }

  remaining(): Secret[] {
    return SECRETS.filter((s) => !this.jobsDone.includes(secretKey(s.id)));
  }

  /** Collects any secret within reach of `at`; returns what she found. */
  update(dt: number, at: THREE.Vector3): Secret[] {
    this.t += dt;
    const got: Secret[] = [];
    const armed = this.jobsDone.includes("fishMarket");
    for (const s of this.remaining()) {
      if (s.kind === "cache" && !armed) continue;
      const dx = at.x - s.x;
      const dz = at.z - s.z;
      if (dx * dx + dz * dz > SECRET_RADIUS * SECRET_RADIUS || Math.abs(at.y - this.ground(s.x, s.z)) > 2.5) continue;
      this.jobsDone.push(secretKey(s.id));
      got.push(s);
      const m = this.meshes.get(s.id);
      if (m) {
        m.parent?.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        this.meshes.delete(s.id);
      }
    }
    for (const m of this.meshes.values()) {
      m.rotation.y = this.t * 1.5;
      m.position.y += Math.sin(this.t * 2.5) * 0.0015;
    }
    return got;
  }
}
