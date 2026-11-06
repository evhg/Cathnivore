// Plan item 189: which role ability was just used, and where (AbilityMoment.tsx draws it).
import type { GameState, ProducerId, RegionId } from '../engine/types'

export const ABILITY_MOMENT_MS = 1100

export interface AbilityMomentView {
  producer: ProducerId
  region: RegionId
  /** Bumped per moment so a repeat remounts and replays its animations. */
  key: number
}

/**
 * The producer whose role ability was just used between `prev` and `next`, and the hex it acted on, or null.
 * The engine logs no event for a role, so this reads the flag and the ability's own mark on the board.
 */
export function abilityUsed(prev: GameState, next: GameState): { producer: ProducerId; region: RegionId } | null {
  for (const id of Object.keys(next.producers) as ProducerId[]) {
    const was = prev.producers[id]
    const now = next.producers[id]
    if (!was || !now || was.roleUsedThisRound || !now.roleUsedThisRound) continue
    if (prev.round !== next.round) continue
    const regions = next.config.activeRegions
    let region: RegionId | undefined
    if (id === 'mara') region = next.expandSkip.find((r) => !prev.expandSkip.includes(r))
    else if (id === 'tomas') region = regions.find((r) => (next.regions[r].stalls[id] ?? 0) > (prev.regions[r].stalls[id] ?? 0))
    else if (id === 'ines') region = regions.find((r) => next.regions[r].doubt < prev.regions[r].doubt)
    else {
      // On Air has no target: the rings start from her own Stall (her home first), else the board's first tile.
      const home = regions.find((r) => (next.regions[r].stalls.sol ?? 0) > 0)
      region = home ?? regions[0]
    }
    if (region) return { producer: id, region }
  }
  return null
}
