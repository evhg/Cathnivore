import type { LossReason } from '../engine/types'

// SPEC 4.8: "The end screen shows the reason, a short story line, and stats." Cath's voice (section 3.2):
// short sentences, dry, specific rather than sloganeering.
export const WIN_LINE = "Marrow's ledger is ours again. Grass-fed, as promised."

export const LOSS_LINE: Record<LossReason, string> = {
  publicTrust: "Public Trust hit zero. Turns out you can't sell honest food to nobody.",
  lostLand: 'We ran out of land before they ran out of money.',
  pressureDeckEmpty: "The merger went through. There's no undoing a signature.",
}

// SPEC 10.5: "Use plain English." `LossReason`'s own values (`publicTrust`, `lostLand`,
// `pressureDeckEmpty`) are internal engine identifiers, not display text — Game.tsx's end screen was
// interpolating them directly, leaking camelCase straight onto the screen (found by a gate-8 visual
// review screenshot). These match SPEC 4.8's own wording for each loss condition.
export const LOSS_REASON_LABEL: Record<LossReason, string> = {
  publicTrust: 'Public Trust',
  lostLand: 'Lost Land',
  pressureDeckEmpty: 'Pressure deck empty',
}
