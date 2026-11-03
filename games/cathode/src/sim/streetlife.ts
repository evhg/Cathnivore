// Plan item 57: street life. The people who live on a district's streets (walkers under umbrellas, vendors behind
// their counters, people sheltering in doorways, a cyclist and a delivery bike) and how they react to gunfire:
// calm -> duck (the first shot within HEAR_M) -> flee (away from the shooter to the nearest exit that leads away)
// -> gone -> return (a minute after the last shot) -> calm. Vendors duck behind their counters and stay there.
// Pure: no three.js. render/streetlife.ts draws them; world.ts feeds it every muzzle flash.

export type StreetTier = "phone" | "high" | "ultra";
export type StreetRole = "walker" | "vendor" | "shelter" | "shopper" | "cyclist" | "courier";
export type Mood = "calm" | "duck" | "flee" | "gone" | "return";

export interface StreetAgent {
  id: number;
  role: StreetRole;
  /** Walkers and riders go back and forth along `path` (x, z); everyone else stands at path[0]. */
  path: Array<[number, number]>;
  /** Facing when standing (radians, 0 faces +x, as crowd.ts). */
  yaw: number;
  /** Metres per second when calm. */
  speed: number;
  /** 0..1, for colours, sway and gait. */
  seed: number;
  umbrella: boolean;
}

export interface StreetPlan {
  agents: StreetAgent[];
  /** Where people run to (x, z): alley mouths, the street's ends, doorways. */
  exits: Array<[number, number]>;
}

/** A shot this near (m) makes a calm bystander duck. */
export const HEAR_M = 30;
/** A suppressed shot only within this (m). */
export const HEAR_SUPPRESSED_M = 8;
/** Seconds crouched before running. */
export const DUCK_S = 0.6;
/** Running pace (m/s); riders go faster. */
export const FLEE_SPEED = 4.6;
export const RIDE_FLEE_SPEED = 8;
/** Seconds of quiet after the last shot before people come back. */
export const RETURN_AFTER_S = 60;
/** Walking pace back to their place (m/s). */
export const RETURN_SPEED = 1.3;

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ------------------------------------------------------------ the districts' people

interface Authored {
  role: StreetRole;
  path: Array<[number, number]>;
  yaw?: number;
  /** Drops out on the phone tier (half the walkers). */
  phoneOut?: boolean;
}

/** The Drowned Market (render/level.ts: west pavement x -10..-6.5, road -6.5..3.5, quay 3.5..9; the street floods
 * between z -10 and -34; the player starts at z 57 looking south). */
function market(): { people: Authored[]; exits: Array<[number, number]> } {
  const people: Authored[] = [];
  const W = 0; // yaw facing +x
  const E = Math.PI; // facing -x
  // Walkers on the west pavement, both ways, spread so the first view south has people at every depth.
  const pave: Array<[number, number, number]> = [
    [-7.9, 58, 20], [-7.6, 50, 10], [-7.8, 44, 26], [-7.55, 36, 2], [-7.95, 30, 48], [-7.7, 18, -6],
    [-7.85, 12, 40], [-7.5, 6, -6], [-7.9, -4, 22], [-7.65, -40, -58],
  ];
  pave.forEach(([x, z0, z1], i) => people.push({ role: "walker", path: [[x, z0], [x + (i % 2 ? 0.1 : -0.1), z1]], phoneOut: i % 2 === 1 }));
  // Walkers along the road's east edge by the quay's bollards, and two crossing the road.
  const quay: Array<[number, number, number]> = [[3.25, 47, 30.5], [3.2, 21, 4], [3.25, 18, -4]];
  quay.forEach(([x, z0, z1], i) => people.push({ role: "walker", path: [[x, z0], [x, z1]], phoneOut: i === 1 }));
  people.push({ role: "walker", path: [[-6.2, 41], [3.2, 37]] }, { role: "walker", path: [[3.2, 31], [-6.0, 32.6]], phoneOut: true });
  // Vendors behind the counters of the open stalls (render/level.ts stall(): counter x 4.3..5.3), facing the street,
  // and shoppers at the front of the first few, facing in.
  for (const z of [39, 33.5, 27.5, 14.5, 8.5, -5]) people.push({ role: "vendor", path: [[5.75, z - 0.4]], yaw: E });
  for (const [z, k] of [[39.6, 0], [33.0, 1], [27.9, 0], [14.1, 1]] as const) people.push({ role: "shopper", path: [[3.75, z]], yaw: W, phoneOut: k === 1 });
  // The noodle cart under the flyover: the cook behind it, two on stools.
  people.push({ role: "vendor", path: [[-5.25, 4.5]], yaw: W }, { role: "shopper", path: [[-3.1, 4.0]], yaw: E }, { role: "shopper", path: [[-3.1, 5.2]], yaw: E, phoneOut: true });
  // Close to where she starts: a pair under one awning on the pavement, a man crossing to the quay, a smoker by the
  // first doorway, so the first view down the street has people in its foreground too.
  people.push(
    { role: "shelter", path: [[-7.7, 47.6]], yaw: -0.4 },
    { role: "shelter", path: [[-7.45, 46.9]], yaw: 2.6, phoneOut: true },
    { role: "walker", path: [[-6.0, 52], [3.1, 50.5]] },
    { role: "shelter", path: [[-9.55, 53.6]], yaw: -0.5, phoneOut: true },
  );
  // Sheltering in doorways on the west facades and under the flyover.
  for (const [x, z, k] of [[-9.55, 52.5, 0], [-9.55, 39.5, 1], [-9.55, 16, 0], [-6.9, 11.5, 1], [-6.9, 0.2, 0], [-9.55, -38, 1]] as const)
    people.push({ role: "shelter", path: [[x, z]], yaw: x < -9 ? W : W + 0.6, phoneOut: k === 1 });
  // A cyclist down the road's middle and a delivery rider up the east lane.
  // The road is parked up, so their lines weave between the cars and the flyover's piers.
  people.push({ role: "cyclist", path: [[2.75, 63], [2.75, 31.5], [-0.2, 29.5], [-0.2, 19], [-2.85, 14], [-2.85, 8.5]] }, { role: "courier", path: [[-3.2, 8.5], [-3.2, 33], [-0.5, 42.2]] });
  const exits: Array<[number, number]> = [
    [-11.5, 23], // the north alley
    [-11.5, -43], // the south alley
    [-2, 66], // the north end
    [-2, -66], // the south end
    [-10.6, 52.5], // doorways
    [-10.6, 16],
    [-10.6, 36],
  ];
  return { people, exits };
}

/** Hollowell Plaza (render/levels/plaza.ts: x -30..30, z 52 down to the steps at -28). Its rally and shoppers are the
 * standing crowds; street life adds people crossing the square and riders on its east road. */
function plaza(): { people: Authored[]; exits: Array<[number, number]> } {
  const people: Authored[] = [];
  const cross: Array<[[number, number], [number, number]]> = [
    [[-26.8, 46], [-26.8, 20]], [[12, 50], [26, 22]], [[-26, 10], [-12, -2]], [[12, 16], [18, -6]],
    [[-4, 50], [-12, 44]], [[6, 46], [16, 50]], [[-22, -6], [-26, 18]], [[24, 8], [22, 30]],
    // Across the square in front of where she comes in, so the first view has people near as well as at the rally.
    [[-12, 40], [12, 36]], [[10, 30], [-8, 26]], [[-4, 46], [6, 48]], [[14, 42], [2, 31]],
  ];
  cross.forEach((p, i) => people.push({ role: "walker", path: p, phoneOut: i % 2 === 1 }));
  for (const [x, z, k] of [[-28.8, 40, 0], [28.8, 34, 1], [-28.8, 6, 1], [28.8, 0, 0]] as const)
    people.push({ role: "shelter", path: [[x, z]], yaw: x < 0 ? 0 : Math.PI, phoneOut: k === 1 });
  people.push({ role: "cyclist", path: [[27, 50], [27, -20]] });
  const exits: Array<[number, number]> = [[-31, 46], [31, 46], [-31, 0], [31, 0], [0, 54], [-31, 24], [31, 24]];
  return { people, exits };
}

const AUTHORED: Record<string, () => { people: Authored[]; exits: Array<[number, number]> }> = { market, plaza };

/** The district's street life for a quality tier: deterministic, phones get about half the walkers. */
export function streetLife(district: string | undefined, tier: StreetTier): StreetPlan {
  const src = AUTHORED[district ?? "market"];
  if (!src) return { agents: [], exits: [] };
  const { people, exits } = src();
  const agents: StreetAgent[] = [];
  people.forEach((p, i) => {
    if (tier === "phone" && p.phoneOut) return;
    const seed = hash(i * 7.31 + 3.7);
    const [a, b] = [p.path[0]!, p.path[1] ?? p.path[0]!];
    const yaw = p.yaw ?? Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    const speed = p.role === "cyclist" ? 4.2 : p.role === "courier" ? 5.2 : p.role === "walker" ? 1.05 + seed * 0.45 : 0;
    // Half the walkers under umbrellas; the riders and the vendors (under their tarps) never.
    const umbrella = (p.role === "walker" || p.role === "shelter") && hash(i * 3.3 + 1) < 0.55;
    agents.push({ id: agents.length, role: p.role, path: p.path.map(([x, z]) => [x, z] as [number, number]), yaw, speed, seed, umbrella });
  });
  return { agents, exits };
}

/** Where a district's people run to, for crowds authored elsewhere (the Plaza rally's standers, render/crowd.ts). */
export function streetExits(district: string | undefined): Array<[number, number]> {
  return AUTHORED[district ?? "market"]?.().exits ?? [];
}

/** A standing crowd as street agents that never walk: they react to shots like everyone else (plan item 57). */
export function standerPlan(standers: ReadonlyArray<{ x: number; z: number; yaw: number; phase: number }>, exits: Array<[number, number]>): StreetPlan {
  return {
    agents: standers.map((s, id) => ({ id, role: "shopper" as const, path: [[s.x, s.z] as [number, number]], yaw: s.yaw, speed: 0, seed: hash(s.phase * 5.1 + id), umbrella: false })),
    exits,
  };
}

// ------------------------------------------------------------ the scatter state machine

export interface AgentState {
  mood: Mood;
  /** Seconds in this mood. */
  t: number;
  x: number;
  z: number;
  /** Facing (radians, 0 faces +x). */
  yaw: number;
  /** Distance travelled along the calm path (walkers ping-pong over it). */
  s: number;
  /** The exit being run to (fleeing) or come back from. */
  exit: number;
  /** Where the shot that scared them came from. */
  from: [number, number];
}

export function initialState(a: StreetAgent): AgentState {
  const st: AgentState = { mood: "calm", t: 0, x: a.path[0]![0], z: a.path[0]![1], yaw: a.yaw, s: a.seed * pathLength(a), exit: -1, from: [0, 0] };
  if (a.path.length > 1) placeOnPath(a, st);
  return st;
}

export function pathLength(a: StreetAgent): number {
  let L = 0;
  for (let i = 1; i < a.path.length; i++) L += Math.hypot(a.path[i]![0] - a.path[i - 1]![0], a.path[i]![1] - a.path[i - 1]![1]);
  return L;
}

/** Puts a walker at distance `s` along its path, going there and back. */
function placeOnPath(a: StreetAgent, st: AgentState): void {
  const L = pathLength(a);
  if (L <= 0) return;
  const m = ((st.s % (2 * L)) + 2 * L) % (2 * L);
  const back = m > L;
  let d = back ? 2 * L - m : m;
  for (let i = 1; i < a.path.length; i++) {
    const [x0, z0] = a.path[i - 1]!;
    const [x1, z1] = a.path[i]!;
    const seg = Math.hypot(x1 - x0, z1 - z0);
    if (d <= seg || i === a.path.length - 1) {
      const k = seg > 0 ? Math.min(1, d / seg) : 0;
      st.x = x0 + (x1 - x0) * k;
      st.z = z0 + (z1 - z0) * k;
      st.yaw = back ? Math.atan2(-(z0 - z1), x0 - x1) : Math.atan2(-(z1 - z0), x1 - x0);
      return;
    }
    d -= seg;
  }
}

/** The exit to run to: the nearest one that is farther from the shooter than the agent is (else the farthest). */
export function pickExit(x: number, z: number, from: [number, number], exits: ReadonlyArray<[number, number]>): number {
  const dShot = Math.hypot(x - from[0], z - from[1]);
  let best = -1;
  let bestD = Infinity;
  let far = 0;
  let farD = -1;
  exits.forEach(([ex, ez], i) => {
    const fromShot = Math.hypot(ex - from[0], ez - from[1]);
    if (fromShot > farD) {
      farD = fromShot;
      far = i;
    }
    // Don't run past the shooter: the exit must lie away from him.
    const away = (ex - x) * (x - from[0]) + (ez - z) * (z - from[1]) > -1;
    if (fromShot <= dShot || !away) return;
    const d = Math.hypot(ex - x, ez - z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best >= 0 ? best : far;
}

/** A shot at (x, z): everyone calm (or walking back) within earshot ducks. Returns how many it scared. */
export function hearShot(plan: StreetPlan, states: AgentState[], x: number, z: number, suppressed = false): number {
  const r = suppressed ? HEAR_SUPPRESSED_M : HEAR_M;
  let n = 0;
  plan.agents.forEach((_, i) => {
    const st = states[i]!;
    if (st.mood !== "calm" && st.mood !== "return") return;
    if (Math.hypot(st.x - x, st.z - z) > r) return;
    st.mood = "duck";
    st.t = 0;
    st.from = [x, z];
    n++;
  });
  return n;
}

/**
 * One step of everyone's behaviour. `quiet` is the seconds since the last shot anywhere (people only come back once
 * the fight has been over a minute).
 */
export function stepStreet(plan: StreetPlan, states: AgentState[], dt: number, quiet: number): void {
  plan.agents.forEach((a, i) => stepAgent(a, states[i]!, plan.exits, dt, quiet));
}

function moveTo(st: AgentState, tx: number, tz: number, speed: number, dt: number): boolean {
  const dx = tx - st.x;
  const dz = tz - st.z;
  const d = Math.hypot(dx, dz);
  const step = speed * dt;
  if (d <= step || d < 1e-6) {
    st.x = tx;
    st.z = tz;
    return true;
  }
  st.x += (dx / d) * step;
  st.z += (dz / d) * step;
  st.yaw = Math.atan2(-dz, dx);
  return false;
}

export function stepAgent(a: StreetAgent, st: AgentState, exits: ReadonlyArray<[number, number]>, dt: number, quiet: number): void {
  st.t += dt;
  const rider = a.role === "cyclist" || a.role === "courier";
  switch (st.mood) {
    case "calm":
      if (a.path.length > 1) {
        st.s += a.speed * dt;
        placeOnPath(a, st);
      }
      return;
    case "duck":
      // Vendors stay down behind the counter; riders don't stop to crouch.
      if (a.role === "vendor") {
        if (quiet >= RETURN_AFTER_S) {
          st.mood = "calm";
          st.t = 0;
        }
        return;
      }
      if (st.t >= (rider ? 0 : DUCK_S)) {
        st.mood = "flee";
        st.t = 0;
        st.exit = exits.length ? pickExit(st.x, st.z, st.from, exits) : -1;
      }
      return;
    case "flee": {
      if (st.exit < 0) return;
      const [ex, ez] = exits[st.exit]!;
      if (moveTo(st, ex, ez, rider ? RIDE_FLEE_SPEED : FLEE_SPEED, dt)) {
        st.mood = "gone";
        st.t = 0;
      }
      return;
    }
    case "gone":
      if (quiet >= RETURN_AFTER_S) {
        st.mood = "return";
        st.t = 0;
      }
      return;
    case "return": {
      // Back to where they were: a walker rejoins the path where it last was, the rest go to their place.
      const home = a.path.length > 1 ? nearestOnPath(a, st.x, st.z) : a.path[0]!;
      if (moveTo(st, home[0], home[1], rider ? a.speed : RETURN_SPEED, dt)) {
        st.mood = "calm";
        st.t = 0;
        if (a.path.length > 1) st.s = sAt(a, home[0], home[1]);
        else st.yaw = a.yaw;
      }
      return;
    }
  }
}

function nearestOnPath(a: StreetAgent, x: number, z: number): [number, number] {
  let best: [number, number] = a.path[0]!;
  let bd = Infinity;
  for (let i = 1; i < a.path.length; i++) {
    const [x0, z0] = a.path[i - 1]!;
    const [x1, z1] = a.path[i]!;
    const vx = x1 - x0;
    const vz = z1 - z0;
    const L2 = vx * vx + vz * vz || 1;
    const k = Math.max(0, Math.min(1, ((x - x0) * vx + (z - z0) * vz) / L2));
    const px = x0 + vx * k;
    const pz = z0 + vz * k;
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bd) {
      bd = d;
      best = [px, pz];
    }
  }
  return best;
}

function sAt(a: StreetAgent, x: number, z: number): number {
  let s = 0;
  for (let i = 1; i < a.path.length; i++) {
    const [x0, z0] = a.path[i - 1]!;
    const [x1, z1] = a.path[i]!;
    const seg = Math.hypot(x1 - x0, z1 - z0);
    const d = Math.hypot(x - x0, z - z0);
    if (d <= seg + 1e-6 && Math.abs(d + Math.hypot(x1 - x, z1 - z) - seg) < 1e-3) return s + d;
    s += seg;
  }
  return s;
}

/** Whether the agent is drawn (gone people have left the street). */
export function visible(st: AgentState): boolean {
  return st.mood !== "gone";
}
