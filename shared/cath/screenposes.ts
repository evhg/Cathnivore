// Plan item 23: each screen picks its own pose, so moving between two screens never shows the same Cath.
// Bust-framed screens use poses whose hands show at the shoulders (wave, point, cheer, thinking); basket
// and crossed sit below a bust's frame, so they're for half-length art. The table is the source of truth; `tests/cath-poses.test.ts` checks that no two adjacent screens share one.
import type { CathExpression, CathPoseId } from './cath'

export type PoseScreen =
  | 'cathnivore:title'
  | 'cathnivore:setup'
  | 'cathnivore:campaign'
  | 'cathnivore:game'
  | 'cathnivore:rules'
  | 'cathnivore:settings'
  | 'cathnivore:credits'
  | 'site:games'
  | 'site:portfolio'

export const SCREEN_POSE: Record<PoseScreen, CathPoseId> = {
  'cathnivore:title': 'wave',
  'cathnivore:setup': 'point',
  'cathnivore:campaign': 'cheer',
  'cathnivore:game': 'clasped',
  'cathnivore:rules': 'thinking',
  'cathnivore:settings': 'thinking',
  'cathnivore:credits': 'cheer',
  'site:games': 'wave',
  'site:portfolio': 'point',
}

/** Screens a player can step between directly (either way). */
export const ADJACENT: readonly (readonly [PoseScreen, PoseScreen])[] = [
  ['cathnivore:title', 'cathnivore:setup'],
  ['cathnivore:title', 'cathnivore:campaign'],
  ['cathnivore:title', 'cathnivore:rules'],
  ['cathnivore:title', 'cathnivore:settings'],
  ['cathnivore:title', 'cathnivore:credits'],
  ['cathnivore:settings', 'cathnivore:credits'],
  ['cathnivore:setup', 'cathnivore:game'],
  ['cathnivore:campaign', 'cathnivore:game'],
  ['site:portfolio', 'site:games'],
]

/** Story scenes pose her per line, from the line's expression. */
export const LINE_POSE: Record<CathExpression, CathPoseId> = {
  smirk: 'clasped',
  delighted: 'cheer',
  determined: 'point',
  worried: 'crossed',
  wink: 'wave',
}
