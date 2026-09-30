// Saved progress for Hedgerow: stars per level and which stories were seen. One localStorage key; any
// storage failure degrades to an in-memory copy so the game still plays. Bump `version` and add a
// migration (with a test) for every shape change.

export interface SaveData {
  version: 1;
  /** Best stars per level id (1 to 3). Missing = not cleared. */
  stars: Record<string, number>;
  seenBefore: Record<string, boolean>;
}

const KEY = "hedgerow:v1";
let memory: SaveData | null = null;

export function emptySave(): SaveData {
  return { version: 1, stars: {}, seenBefore: {} };
}

/** Parses stored JSON, repairing anything unexpected instead of throwing. */
export function parseSave(raw: string | null): SaveData {
  const data = emptySave();
  if (!raw) return data;
  try {
    const obj = JSON.parse(raw) as Partial<SaveData>;
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj.stars ?? {})) {
        if (typeof v === "number" && v >= 1 && v <= 3)
          data.stars[k] = Math.floor(v);
      }
      for (const [k, v] of Object.entries(obj.seenBefore ?? {}))
        if (v === true) data.seenBefore[k] = true;
    }
  } catch {
    // corrupt save: start fresh
  }
  return data;
}

export function load(): SaveData {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // storage unavailable
  }
  memory = parseSave(raw);
  return memory;
}

export function save(data: SaveData): void {
  memory = data;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full or blocked: the in-memory copy still works
  }
}

export function recordStars(
  data: SaveData,
  levelId: number,
  stars: number,
): void {
  if (stars > (data.stars[String(levelId)] ?? 0))
    data.stars[String(levelId)] = stars;
  save(data);
}

export function isUnlocked(data: SaveData, levelId: number): boolean {
  return levelId <= 1 || (data.stars[String(levelId - 1)] ?? 0) > 0;
}
