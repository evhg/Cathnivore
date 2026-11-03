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
import '../styles/noticeboard.css'

/** Plan item 56: the theme picker shows the table itself in each theme (Auto is half and half). */
export function ThemePreview({ theme }: { theme: ThemePreference }) {
  const swatch = (t: 'light' | 'dark') => ({
    paper: `var(--preview-${t}-paper)`,
    ink: `var(--preview-${t}-ink)`,
    a: `var(--preview-${t}-a)`,
    b: `var(--preview-${t}-b)`,
    c: `var(--preview-${t}-c)`,
  })
  const hex = (cx: number, cy: number, fill: string, stroke: string) => {
    const r = 11
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
    }).join(' ')
    return <polygon points={pts} style={{ fill, stroke, strokeWidth: 1.4 }} />
  }
  const scene = (t: 'light' | 'dark') => {
    const c = swatch(t)
    return (
      <>
        <rect x="0" y="0" width="96" height="56" style={{ fill: c.paper }} />
        {hex(34, 22, c.a, c.ink)}
        {hex(53, 22, c.b, c.ink)}
        {hex(43.5, 38.5, c.c, c.ink)}
        {hex(62.5, 38.5, c.a, c.ink)}
        <rect x="10" y="47" width="22" height="3" rx="1.5" style={{ fill: c.ink, opacity: 0.5 }} />
      </>
    )
  }
  return (
    <svg className="theme-preview" viewBox="0 0 96 56" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="theme-preview-half">
          <path d="M48 -10 L106 -10 L106 66 L40 66Z" />
        </clipPath>
      </defs>
      {theme === 'dark' ? scene('dark') : scene('light')}
      {theme === 'system' && <g clipPath="url(#theme-preview-half)">{scene('dark')}</g>}
    </svg>
  )
}

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
    <main className="settings noticeboard">
      <header className="settings-header">
        <div>
          <h1>Settings</h1>
          <p className="settings-tip">Tweak it your way, love. Nothing here costs a Mark.</p>
        </div>
        <span className="nb-bust">
          <CathArt framing="bust" pose={SCREEN_POSE['cathnivore:settings']} expression="smirk" animate width={64} height={64} title="Cath" />
        </span>
      </header>

      <div className="nb-layout">
      <aside className="nb-cath" aria-hidden="true">
        <CathArt framing="half" pose={SCREEN_POSE['cathnivore:settings']} expression="smirk" animate />
      </aside>
      <div className="nb-board">
      <section className="settings-card nb-note" aria-labelledby="settings-table-head">
        <h2 id="settings-table-head">On the table</h2>
        <div className="settings-switches">
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
        </div>
      </section>

      {/* Plan item 53: the table's sound. */}
      <section className="settings-card nb-note settings-sound" aria-labelledby="settings-sound-head">
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

      <section className="settings-card nb-note">
        <h2>Theme</h2>
        <div className="theme-picker" role="radiogroup" aria-label="Theme">
          {(['system', 'light', 'dark'] as const satisfies readonly ThemePreference[]).map((theme) => (
            <label key={theme} className="theme-option">
              <input type="radio" name="theme" checked={settings.theme === theme} onChange={() => update({ theme })} />
              <ThemePreview theme={theme} />
              <span>{theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card nb-note">
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
        <section className="settings-card nb-note">
          <h2>Tutorial</h2>
          <p className="settings-note">Cath walks you through your first round again, one tap at a time.</p>
          <button onClick={onReplayTutorial}>Replay the tutorial</button>
        </section>
      )}

      <section className="settings-card nb-note nb-data">
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

      </div>
      </div>

      <div className="nb-counter">
        <button className="settings-back" onClick={onClose}>Back</button>
      </div>
    </main>
  )
}
