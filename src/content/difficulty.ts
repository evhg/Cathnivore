import type { GameConfig } from '../engine/types'

// SPEC 4.9.
// M4 balance-loop iteration 4 (see DECISIONS.md): Normal's lostLandPool nudged 11 -> 9. Iteration 3's
// cheaper Buyout-clearing reduced how often Squeeze damage exceeds defence, which pushed the lostLand
// loss-reason share just under SPEC 9.4's 15% floor (12.7%); a smaller pool makes running out of tokens
// happen sooner again without fully reverting iteration 1's fix for the original (much larger) overshoot.
export const DIFFICULTY_SETTINGS: Record<GameConfig['difficulty'], { publicTrust: number; lostLandPool: number }> = {
  easy: { publicTrust: 12, lostLandPool: 10 },
  normal: { publicTrust: 10, lostLandPool: 9 },
  hard: { publicTrust: 8, lostLandPool: 6 },
}
