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
// towards the targets" — this one didn't.
//
// 2026-09-27 (later session): kept pulling the pace lever as queued: `extraHomeStalls` gives Easy
// producers 1 extra starting Stall in their home region (3 total instead of 2; still within SPEC 4.6's
// 3-per-region cap), so home-region Supply/liberation needs one less Open-Stall action to reach full
// Defence. One number, mirroring `kingsmarketOutlets`'s existing precedent of a difficulty-only setup
// tweak. Confirmed with a 100-game MCTSBot spot check: 56.0% -> 66.0%, real progress, still short of the
// 70-85% target — see DECISIONS.md.
//
// 2026-09-27 (same session): `extraHomeStalls` can't go any higher (2 would put a home region's Stall
// count at 4, over SPEC 4.6's 3-per-region cap), so added a second, independent pace lever the same
// session: `kingsmarketBuyouts`, removing Easy's one starting Kingsmarket Buyout (Normal/Hard keep 1).
// A Buyout costs 4 Produce and needs 2+ Stalls in the region to clear (SPEC 4.6.2), strictly more
// expensive than an Outlet, so removing it from the capital speeds the endgame liberation the same way
// `kingsmarketOutlets` already speeds getting Kingsmarket's Outlet count down. See DECISIONS.md.
//
// 2026-09-27 (later session): a 300-game MCTSBot Easy confirmation (up from the 100-game spot checks
// above) came back at 75.3%, inside SPEC 9.4's 70-85% target band, with every producer pair within 12
// points of that overall rate (the earlier 100-game runs' wider spread was sampling noise). Easy pace
// track closed for now — see DECISIONS.md.
export const DIFFICULTY_SETTINGS: Record<
  GameConfig['difficulty'],
  {
    publicTrust: number
    lostLandPool: number
    kingsmarketOutlets: number
    kingsmarketBuyouts: number
    extraHomeStalls: number
  }
> = {
  easy: { publicTrust: 12, lostLandPool: 20, kingsmarketOutlets: 1, kingsmarketBuyouts: 0, extraHomeStalls: 1 },
  normal: { publicTrust: 10, lostLandPool: 10, kingsmarketOutlets: 2, kingsmarketBuyouts: 1, extraHomeStalls: 0 },
  hard: { publicTrust: 8, lostLandPool: 6, kingsmarketOutlets: 3, kingsmarketBuyouts: 1, extraHomeStalls: 0 },
}
