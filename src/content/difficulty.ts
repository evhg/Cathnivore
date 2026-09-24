import type { GameConfig } from '../engine/types'

// SPEC 4.9.
export const DIFFICULTY_SETTINGS: Record<GameConfig['difficulty'], { publicTrust: number; lostLandPool: number }> = {
  easy: { publicTrust: 12, lostLandPool: 10 },
  normal: { publicTrust: 10, lostLandPool: 11 },
  hard: { publicTrust: 8, lostLandPool: 6 },
}
