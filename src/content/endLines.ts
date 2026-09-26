import type { LossReason } from '../engine/types'

// SPEC 4.8: "The end screen shows the reason, a short story line, and stats." Cath's voice (section 3.2):
// short sentences, dry, specific rather than sloganeering.
export const WIN_LINE = "Marrow's ledger is ours again. Grass-fed, as promised."

export const LOSS_LINE: Record<LossReason, string> = {
  publicTrust: "Public Trust hit zero. Turns out you can't sell honest food to nobody.",
  lostLand: 'We ran out of land before they ran out of money.',
  pressureDeckEmpty: "The merger went through. There's no undoing a signature.",
}
