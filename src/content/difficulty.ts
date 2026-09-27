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
// spot check to 53.0%; widening it further to 20 gave a statistically flat 50.0% and, per the loss-reason
// breakdown, made Lost Land stop being the bottleneck at all (0% share) — the games that don't win are
// running out of Pressure-deck rounds instead, so the pool isn't the limiting number any more. Kept 20
// (a real, harmless per-game effect) and instead added a new lever that speaks to pace directly:
// `kingsmarketOutlets`, mirroring how Hard already has an asymmetric "extra setup" per SPEC 4.9's table
// (Hard's Kingsmarket already gets 3 instead of the base 2). Easy starts Kingsmarket with 1 fewer,
// making the capital (the 5th liberation required to win) faster to crack. One number this iteration,
// per SPEC 9.3's balance-loop discipline; see DECISIONS.md for the verification run. That change was
// confirmed with a 100-game MCTSBot spot check: 50.0% -> 56.0%, real progress, but it also shifted the
// dominant loss reason to `publicTrust` (47.7%, up from ~20-35% in earlier runs). Tried widening Easy's
// Public Trust gap next (12 -> 14) to address that directly, but a follow-up 100-game spot check came
// back at an identical 56.0% — it only moved losses from `publicTrust` (down to 27.3%) to
// `pressureDeckEmpty` (up to 72.7%), not the win rate itself, confirming liberation pace (not either loss
// track) is still the real bottleneck. Reverted per SPEC 9.4's "keep changes that move the metrics
// towards the targets" — this one didn't. A future session should keep pulling on the pace lever instead
// (another region's starting Outlet, or an extra starting Stall for Easy), not Public Trust again unless
// a further pace change makes `publicTrust` the dominant reason once more.
export const DIFFICULTY_SETTINGS: Record<
  GameConfig['difficulty'],
  { publicTrust: number; lostLandPool: number; kingsmarketOutlets: number }
> = {
  easy: { publicTrust: 12, lostLandPool: 20, kingsmarketOutlets: 1 },
  normal: { publicTrust: 10, lostLandPool: 10, kingsmarketOutlets: 2 },
  hard: { publicTrust: 8, lostLandPool: 6, kingsmarketOutlets: 3 },
}
