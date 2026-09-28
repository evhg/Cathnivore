import { useState } from 'react'
import {
  loadSettings,
  saveSettings,
  type AiSpeed,
  type Settings as SettingsData,
  type ThemePreference,
} from '../platform/settings'
import { clearGame, storage, CAMPAIGN_KEY } from '../platform/storage'

interface Props {
  onClose(): void
}

// SPEC 10.1: "Settings: animations, colour-blind patterns, AI speed, and 'Reset all data' with a
// confirmation."
export default function Settings({ onClose }: Props) {
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
      <h1>Settings</h1>

      <section>
        <label>
          <input type="checkbox" checked={settings.animations} onChange={(e) => update({ animations: e.target.checked })} />
          Animations
        </label>
        <label>
          <input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} />
          Sound
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.ambient}
            disabled={!settings.sound}
            onChange={(e) => update({ ambient: e.target.checked })}
          />
          Ambient music
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.colourBlindPatterns}
            onChange={(e) => update({ colourBlindPatterns: e.target.checked })}
          />
          Colour-blind patterns
        </label>
      </section>

      <section>
        <h2>Theme</h2>
        {(['system', 'light', 'dark'] as const satisfies readonly ThemePreference[]).map((theme) => (
          <label key={theme}>
            <input type="radio" checked={settings.theme === theme} onChange={() => update({ theme })} />{' '}
            {theme === 'system' ? 'Match device' : theme === 'light' ? 'Light' : 'Dark'}
          </label>
        ))}
      </section>

      <section>
        <h2>AI speed</h2>
        {(['slow', 'normal', 'fast'] as const satisfies readonly AiSpeed[]).map((speed) => (
          <label key={speed}>
            <input type="radio" checked={settings.aiSpeed === speed} onChange={() => update({ aiSpeed: speed })} /> {speed}
          </label>
        ))}
      </section>

      <section>
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

      <button onClick={onClose}>Back</button>
    </main>
  )
}
