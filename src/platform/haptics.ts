import type { Action, GameEvent, GameState } from '../engine/types'

// STYLE.md 11: "a light tap when placing, a medium tap on liberation, and a warning buzz on Lost Land and
// loss." Capacitor's haptics plugin is a thin native wrapper that silently no-ops in a plain browser
// (confirmed by its own docs), but we still gate on `Capacitor.isNativePlatform()` and skip the import
// entirely on the web build so `@capacitor/haptics` never has to load there, mirroring how
// `main.tsx` already gates the service-worker registration on the same check.
function isNative(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as { Capacitor?: { isNativePlatform?(): boolean } }).Capacitor?.isNativePlatform?.())
}

async function impact(style: 'Light' | 'Medium'): Promise<void> {
  if (!isNative()) return
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
  await Haptics.impact({ style: style === 'Light' ? ImpactStyle.Light : ImpactStyle.Medium })
}

async function warning(): Promise<void> {
  if (!isNative()) return
  const { Haptics, NotificationType } = await import('@capacitor/haptics')
  await Haptics.notification({ type: NotificationType.Warning })
}

// Called after every `applyAction` with the events it appended to the log (SPEC's own action/enemy-turn
// log, the same slice `enemyTurnEvents` reads) plus the action taken, if any (the AI teammate/autoplay also
// call `advance`, so this fires for every producer, not just a human's own taps — STYLE.md doesn't say to
// limit it to the human, and a spurious haptic on an AI turn was judged the lesser cost).
export function playHapticsFor(action: Action | null, newEvents: GameEvent[], result: GameState['result']): void {
  if (action?.kind === 'openStall') void impact('Light')
  if (newEvents.some((e) => e.type === 'liberated')) void impact('Medium')
  const lostLand = newEvents.some((e) => e.type === 'squeeze' && e.lostLand)
  if (lostLand || (result && !result.won)) void warning()
}
