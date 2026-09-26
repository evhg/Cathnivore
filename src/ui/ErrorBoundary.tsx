import { Component, type ReactNode } from 'react'
import { loadGame } from '../platform/storage'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// SPEC 11.3: "A global error screen catches crashes and offers Resume From Last Autosave, Copy Bug Report
// (JSON with config, seed, actions and error) and Back to Title." A React error boundary must be a class
// component (there is no hook equivalent of `componentDidCatch`). It stays decoupled from `App`'s own
// screen state — reading the same autosave `Game.tsx` already writes after every action rather than
// needing game state threaded down as a prop — so recovery works even when the crash happened inside `App`
// itself, not just inside `Game`.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  resumeFromAutosave = (): void => {
    // A full reload re-mounts the whole app clean of whatever broke it; `?autoresume=1` tells `App` to
    // replay the last autosave immediately instead of stopping at the title screen (App.tsx's own
    // `resume()` already has the "this save won't replay" fallback, so this can't crash-loop silently).
    window.location.href = `${window.location.pathname}?autoresume=1`
  }

  backToTitle = (): void => {
    window.location.href = window.location.pathname
  }

  copyBugReport = (): void => {
    const saved = loadGame()
    const report = {
      config: saved.save?.config ?? null,
      seed: saved.save?.seed ?? null,
      actions: saved.save?.actions ?? null,
      error: { message: this.state.error?.message ?? String(this.state.error), stack: this.state.error?.stack },
    }
    navigator.clipboard?.writeText(JSON.stringify(report, null, 2)).catch(() => {
      // Clipboard access can fail (permissions, insecure context); there's nothing more this screen can
      // do about it, and the failure must not itself crash the crash screen.
    })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <main className="title">
        <h1>Cathnivore</h1>
        <div className="crash-screen">
          <p>Something went wrong.</p>
          <button onClick={this.resumeFromAutosave}>Resume From Last Autosave</button>
          <button onClick={this.copyBugReport}>Copy Bug Report</button>
          <button onClick={this.backToTitle}>Back to Title</button>
        </div>
      </main>
    )
  }
}
