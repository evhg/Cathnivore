import { storage } from './storage'

// SPEC 10.1: "Settings: animations, colour-blind patterns, AI speed, and 'Reset all data' with a
// confirmation."
export type AiSpeed = 'slow' | 'normal' | 'fast'

export interface Settings {
  version: 1
  animations: boolean
  colourBlindPatterns: boolean
  aiSpeed: AiSpeed
}

export const SETTINGS_KEY = 'cathnivore:settings:v1'

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  animations: true,
  colourBlindPatterns: false,
  aiSpeed: 'normal',
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
}

// The AI teammate's "thinking" pause before it acts (Game.tsx) — SPEC 9.2's real budget (up to 600
// simulations/400ms) applies once the MCTS-in-Worker teammate exists; until then this just paces
// HeuristicBot's stand-in moves so they don't feel instant, at a speed the player controls.
export const AI_SPEED_DELAY_MS: Record<AiSpeed, number> = {
  slow: 500,
  normal: 150,
  fast: 40,
}
