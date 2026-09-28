import { storage } from './storage'
import { applyStatusBarStyle } from './statusBar'

// SPEC 10.1: "Settings: animations, colour-blind patterns, AI speed, and 'Reset all data' with a
// confirmation."
export type AiSpeed = 'slow' | 'normal' | 'fast'

// STYLE.md 3.5: "The theme follows the phone's setting, and Settings can force light or dark."
// 'system' defers to the OS's `prefers-color-scheme` (handled by tokens.css's media query); 'light'/'dark'
// force one regardless of the OS setting.
export type ThemePreference = 'system' | 'light' | 'dark'

export interface Settings {
  version: 1
  animations: boolean
  sound: boolean
  colourBlindPatterns: boolean
  aiSpeed: AiSpeed
  theme: ThemePreference
}

export const SETTINGS_KEY = 'cathnivore:settings:v1'

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  animations: true,
  sound: true,
  colourBlindPatterns: false,
  aiSpeed: 'normal',
  theme: 'system',
}

export function loadSettings(): Settings {
  const raw = storage.get(SETTINGS_KEY)
  if (!raw) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(raw) as Settings
    if (parsed.version !== 1) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  storage.set(SETTINGS_KEY, JSON.stringify(settings))
  applyAnimationsSetting(settings.animations)
  applyThemeSetting(settings.theme)
  void applyStatusBarStyle(settings.theme)
}

// STYLE.md 11: "with reduced motion switched on, use fades only" is the OS-level `prefers-reduced-motion`
// media query (handled in CSS directly); this is the separate, explicit Settings toggle (SPEC 10.1) that
// turns animations off entirely. A plain `<html>` class keeps every animated element's CSS in one place
// (global.css) rather than threading a prop through Map/sheets/etc.
export function applyAnimationsSetting(animations: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('no-animations', !animations)
}

// tokens.css already defines both a `prefers-color-scheme: dark` media query and a `[data-theme="dark"]`/
// `[data-theme="light"]` attribute override (the media query is itself guarded by `:not([data-theme=
// "light"])` so an explicit light override always wins over a dark OS setting). This just sets or clears
// that attribute; 'system' clears it so the media query alone decides.
export function applyThemeSetting(theme: ThemePreference): void {
  if (typeof document === 'undefined') return
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

// The AI teammate's "thinking" pause before it starts its real decision (Game.tsx) — on top of this, the
// MCTS-in-Worker teammate itself takes up to SPEC 9.2's 400ms deadline (src/ai/mcts.ts's `AI_TEAMMATE_BOT`)
// to actually choose. This delay alone doesn't dictate feel; it's a speed the player controls.
export const AI_SPEED_DELAY_MS: Record<AiSpeed, number> = {
  slow: 500,
  normal: 150,
  fast: 40,
}
