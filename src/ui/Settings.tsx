import { useState } from 'react'
import {
  loadSettings,
  saveSettings,
  type AiSpeed,
  type Settings as SettingsData,
  type ThemePreference,
} from '../platform/settings'
import CathArt from './CathArt'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import { clearGame, storage, CAMPAIGN_KEY } from '../platform/storage'

interface Props {
  onClose(): void
  // Plays chapter 1's guided tutorial again, whether or not it was finished before.
  onReplayTutorial?(): void
}

// SPEC 10.1: "Settings: animations, colour-blind patterns, AI speed, and 'Reset all data' with a
// confirmation."
export default function Settings({ onClose, onReplayTutorial }: Props) {
  const [settings, setSettings] = useState<SettingsData>(loadSettings)
  const [confirmingReset, setConfirmingReset] = useState(false)

  function update(patch: Partial<SettingsData>): void {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  function resetAllData(): void {
    clearGame()
    storage.remove(CAMPAIGN_KEY)
    setConfirmingReset(false)
    onClose()
  }

  return (
    <main className="settings">
      <header className="settings-header">
        <div>
          <h1>Settings</h1>
          <p className="settings-tip">Tweak it your way, love. Nothing here costs a Mark.</p>
        </div>
        <CathArt framing="bust" pose={SCREEN_POSE['cathnivore:settings']} expression="smirk" animate width={64} height={64} title="Cath" />
      </header>

      <section className="settings-card settings-switches">
        <label>
          <input
            type="checkbox"
            checked={settings.animations}
            onChange={(e) => update({ animations: e.target.checked })}
          />
          <span>Animations</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.colourBlindPatterns}
            onChange={(e) => update({ colourBlindPatterns: e.target.checked })}
          />
          <span>Colour-blind patterns</span>
        </label>
      </section>

      {/* Plan item 53: the table's sound. */}
      <section className="settings-card settings-sound" aria-labelledby="settings-sound-head">
        <h2 id="settings-sound-head">Sound</h2>
        <div className="settings-switches">
          <label>
            <input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} />
            <span>Sound on</span>
          </label>
        </div>
        <label className="settings-volume">
          <span>Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(settings.volume * 100)}
            disabled={!settings.sound}
            aria-valuetext={`${Math.round(settings.volume * 100)}%`}
            onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
          />
          <output>{Math.round(settings.volume * 100)}%</output>
        </label>
        <div className="settings-switches">
          <label>
            <input type="checkbox" checked={settings.effects} disabled={!settings.sound} onChange={(e) => update({ effects: e.target.checked })} />
            <span className="settings-named">
              Effects
              <small>Wood, paper and coin on the table; Hollowell's chimes</small>
            </span>
          </label>
          <label>
            <input type="checkbox" checked={settings.ambient} disabled={!settings.sound} onChange={(e) => update({ ambient: e.target.checked })} />
            <span className="settings-named">
              Market ambience
              <small>Chatter and birdsong behind the game</small>
            </span>
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h2>Theme</h2>
        <div className="segmented">
          {(['system', 'light', 'dark'] as const satisfies readonly ThemePreference[]).map((theme) => (
            <label key={theme}>
              <span>
                <input type="radio" checked={settings.theme === theme} onChange={() => update({ theme })} />
                {theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2>AI speed</h2>
        <div className="segmented">
          {(['slow', 'normal', 'fast'] as const satisfies readonly AiSpeed[]).map((speed) => (
            <label key={speed}>
              <span>
                <input type="radio" checked={settings.aiSpeed === speed} onChange={() => update({ aiSpeed: speed })} />
                {speed}
              </span>
            </label>
          ))}
        </div>
      </section>

      {onReplayTutorial && (
        <section className="settings-card">
          <h2>Tutorial</h2>
          <p className="settings-note">Cath walks you through your first round again, one tap at a time.</p>
          <button onClick={onReplayTutorial}>Replay the tutorial</button>
        </section>
      )}

      <section className="settings-card">
        <h2>Data</h2>
        {confirmingReset ? (
          <div className="reset-confirm">
            <p>This deletes your saved game and campaign progress. This can&rsquo;t be undone.</p>
            <button className="destructive" onClick={resetAllData}>
              Yes, reset all data
            </button>
            <button onClick={() => setConfirmingReset(false)}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmingReset(true)}>Reset all data</button>
        )}
      </section>

      <button className="settings-back" onClick={onClose}>Back</button>
    </main>
  )
}
