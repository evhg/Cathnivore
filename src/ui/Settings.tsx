import { useState } from 'react'
import {
  loadSettings,
  saveSettings,
  type AiSpeed,
  type Settings as SettingsData,
  type ThemePreference,
} from '../platform/settings'
import CathArt from './CathArt'
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
      <header className="settings-header">
        <h1>Settings</h1>
        <CathArt framing="bust" expression="smirk" animate width={64} height={64} title="Cath" />
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
          <input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} />
          <span>Sound</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.ambient}
            disabled={!settings.sound}
            onChange={(e) => update({ ambient: e.target.checked })}
          />
          <span>Ambient music</span>
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

      <button onClick={onClose}>Back</button>
    </main>
  )
}
