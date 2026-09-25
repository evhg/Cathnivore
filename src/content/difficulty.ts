import type { GameConfig } from '../engine/types'

// SPEC 4.9.
// M4 balance-loop iteration 4 tried Normal's lostLandPool at 9 (down from 11) but overshot: the
// 1,000-game confirmation showed lostLand's loss-reason share jumping to 33.8% while publicTrust's
// fell to 10.3%, under SPEC 9.4's 15% floor, with win rate flat (12.7% -> 12.4%). Reverted to 11 —
// see DECISIONS.md.
export const DIFFICULTY_SETTINGS: Record<GameConfig['difficulty'], { publicTrust: number; lostLandPool: number }> = {
  easy: { publicTrust: 12, lostLandPool: 10 },
  normal: { publicTrust: 10, lostLandPool: 11 },
  hard: { publicTrust: 8, lostLandPool: 6 },
}
