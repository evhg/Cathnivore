// Loads a district's build-time cover points (S11, ai/cover.ts) as its own lazy chunk.
import { COVER_DISTRICTS, unpackCover, type CoverFile, type CoverPoint } from "./cover";

const loaders = import.meta.glob<CoverFile>("../../render/levels/*.cover.json", { import: "default" });

/** Loads a district's cover points (lazily: each district's file is its own chunk). */
export async function loadCover(district: string | undefined): Promise<CoverPoint[]> {
  const id = district && (COVER_DISTRICTS as readonly string[]).includes(district) ? district : "market";
  const l = loaders[`../../render/levels/${id}.cover.json`];
  if (!l) return [];
  try {
    return unpackCover(await l());
  } catch {
    return [];
  }
}
