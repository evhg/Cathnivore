// CATHODE saves: a versioned JSON envelope around the character, a migration chain so an old save always
// loads (VISION: never broken, always migrated), and a compact export/import code (base64url with a
// checksum) players can paste between devices. localStorage itself belongs to the game layer.
//
// Adding a field: bump SAVE_VERSION and add a migration from the previous version that fills it in.

import type { Character } from "./character";
import { CLASS_IDS, DIFFICULTIES } from "./types";

export const SAVE_VERSION = 2;
export const SAVE_KEY = "cathode.save";
const CODE_PREFIX = "CATH";

export interface Checkpoint {
  jobId: string;
  checkpointId: string;
  /** The job's Rng state when the checkpoint was taken, so a resume replays the same spawns and drops. */
  rngState: number;
}

export interface SaveFile {
  version: number;
  /** ISO timestamp, supplied by the caller (the rules never read the clock). */
  savedAt: string;
  character: Character;
  checkpoint?: Checkpoint;
  /** Jobs completed, by id. */
  jobsDone: string[];
}

export type LoadResult = { ok: true; save: SaveFile; migratedFrom?: number } | { ok: false; error: string };

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Migrations: `MIGRATIONS[n]` turns a version-n save into a version-(n+1) one.
 * - v1 (the vertical slice): money was `gold`, skills were `[id, rank]` pairs, and there were no respec
 *   counters, rewards list or active weapon.
 */
export const MIGRATIONS: Readonly<Record<number, (old: Json) => Json>> = {
  1: (old) => {
    const c = isObj(old.character) ? { ...old.character } : {};
    if ("gold" in c && !("scrip" in c)) {
      c.scrip = c.gold;
      delete c.gold;
    }
    if (Array.isArray(c.skills)) {
      c.skills = Object.fromEntries((c.skills as unknown[]).filter(Array.isArray).map((p) => [String(p[0]), Number(p[1]) || 0]));
    }
    c.respecs ??= 0;
    c.freeRespecs ??= 0;
    c.rewardsClaimed ??= [];
    c.activeWeapon ??= "weapon1";
    return { ...old, version: 2, character: c, jobsDone: Array.isArray(old.jobsDone) ? old.jobsDone : [] };
  },
};

/** Builds a save envelope. */
export function makeSave(character: Character, savedAt: string, extra: Partial<Omit<SaveFile, "version" | "character" | "savedAt">> = {}): SaveFile {
  return { version: SAVE_VERSION, savedAt, character, jobsDone: extra.jobsDone ?? [], ...(extra.checkpoint ? { checkpoint: extra.checkpoint } : {}) };
}

/** The save as JSON. */
export function serialize(save: SaveFile): string {
  return JSON.stringify(save);
}

/** Checks the fields the game can't run without. */
function validate(s: Json): string | null {
  const c = s.character;
  if (!isObj(c)) return "no character";
  if (typeof c.level !== "number" || c.level < 1) return "bad level";
  if (!Array.isArray(c.classes) || c.classes.length < 1 || !c.classes.every((x) => (CLASS_IDS as readonly unknown[]).includes(x))) return "bad classes";
  if (!isObj(c.attributes)) return "bad attributes";
  if (!isObj(c.skills)) return "bad skills";
  if (!Array.isArray(c.inventory) || !isObj(c.equipment)) return "bad items";
  if (!(DIFFICULTIES as readonly unknown[]).includes(c.difficulty)) return "bad difficulty";
  return null;
}

/** Applies every migration from the save's version up to SAVE_VERSION. */
export function migrate(raw: Json): LoadResult {
  let s = raw;
  const from = typeof s.version === "number" ? s.version : 1;
  if (from > SAVE_VERSION) return { ok: false, error: `save version ${from} is newer than this game (${SAVE_VERSION})` };
  for (let v = from; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, error: `no migration from version ${v}` };
    s = step({ ...s, version: v });
  }
  const why = validate(s);
  if (why) return { ok: false, error: why };
  return { ok: true, save: s as unknown as SaveFile, ...(from < SAVE_VERSION ? { migratedFrom: from } : {}) };
}

/** Parses and migrates a saved JSON string. Never throws. */
export function deserialize(json: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "not JSON" };
  }
  if (!isObj(raw)) return { ok: false, error: "not a save" };
  return migrate(raw);
}

// ---------------------------------------------------------------------------------------------------------
// Export codes: CATH<version>.<base64url payload>.<checksum>
// ---------------------------------------------------------------------------------------------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** base64url without padding. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    const left = bytes.length - i;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    if (left > 1) out += B64[(n >> 6) & 63]!;
    if (left > 2) out += B64[n & 63]!;
  }
  return out;
}

/** Decodes base64url (no padding); null on a bad character. */
export function fromBase64Url(text: string): Uint8Array | null {
  const vals: number[] = [];
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    vals.push(v);
  }
  if (vals.length % 4 === 1) return null;
  const out: number[] = [];
  for (let i = 0; i < vals.length; i += 4) {
    const n = ((vals[i] ?? 0) << 18) | ((vals[i + 1] ?? 0) << 12) | ((vals[i + 2] ?? 0) << 6) | (vals[i + 3] ?? 0);
    const left = vals.length - i;
    out.push((n >> 16) & 255);
    if (left > 2) out.push((n >> 8) & 255);
    if (left > 3) out.push(n & 255);
  }
  return new Uint8Array(out);
}

/** FNV-1a over a string, as base36. */
function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** A compact, URL-safe code for a save. */
export function exportCode(save: SaveFile): string {
  const payload = toBase64Url(new TextEncoder().encode(serialize(save)));
  return `${CODE_PREFIX}${save.version}.${payload}.${checksum(payload)}`;
}

/** Reads a code from `exportCode` (whitespace ignored), verifying the checksum and migrating. */
export function importCode(code: string): LoadResult {
  const clean = code.replace(/\s+/g, "");
  const m = /^CATH(\d+)\.([A-Za-z0-9_-]+)\.([0-9a-z]+)$/.exec(clean);
  if (!m) return { ok: false, error: "not a CATHODE code" };
  const [, , payload = "", sum = ""] = m;
  if (checksum(payload) !== sum) return { ok: false, error: "the code is damaged (checksum mismatch)" };
  const bytes = fromBase64Url(payload);
  if (!bytes) return { ok: false, error: "the code is damaged" };
  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, error: "the code is damaged" };
  }
  return deserialize(json);
}
