import type { GameConfig } from '../engine/types'

// SPEC 4.9.
// M4 balance-loop iteration 4 tried Normal's lostLandPool at 9 (down from 11) but overshot: the
// 1,000-game confirmation showed lostLand's loss-reason share jumping to 33.8% while publicTrust's
// fell to 10.3%, under SPEC 9.4's 15% floor, with win rate flat (12.7% -> 12.4%). Reverted to 11.
// Iteration 10 tries a gentler single-step nudge, 11 -> 10, to push lostLand's share (12.6% after
// iteration 9) back over the 15% floor without repeating iteration 4's overshoot — see DECISIONS.md.
//
// 2026-09-27: that Normal-only loop left Easy's lostLandPool equal to Normal's (both landed at 10),
// so Easy differed from Normal by only +2 Public Trust — nowhere near enough to separate SPEC 9.4's
// two target bands (Easy 70-85% vs Normal 45-60%). No prior session had ever actually simulated Easy
// or Hard (every BALANCE.md entry before this date used --difficulty normal); a 100-game MCTSBot Easy
// run came back at 43.0%, below even Normal's own band. Widening Easy's pool 10 -> 16 moved a 100-game
// spot check to 53.0% — real progress, still short of the 70-85% target. This iteration widens it
// further, 16 -> 20 (one number, per SPEC 9.3's balance-loop discipline), continuing the same track;
// see DECISIONS.md for the verification run.
export const DIFFICULTY_SETTINGS: Record<GameConfig['difficulty'], { publicTrust: number; lostLandPool: number }> = {
  easy: { publicTrust: 12, lostLandPool: 20 },
  normal: { publicTrust: 10, lostLandPool: 10 },
  hard: { publicTrust: 8, lostLandPool: 6 },
}
