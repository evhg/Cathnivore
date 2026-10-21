/**
 * C14 (S9.7): what the frame shows while the game is not running, kept pure so the desktop path the e2e suite
 * can't reach (webdriver ignores pointer lock) is unit-tested.
 *
 * The trap it avoids: Esc in the pause resumes, but a keypress is not a user activation and Chrome refuses to
 * re-lock the pointer right after the player left it with Esc. Without a resume state the next frame saw "mouse
 * free" and opened the pause again. So a resume that has not got the pointer back waits on a quiet
 * "click to resume" line (the click is the activation that locks), and never reopens the menu by itself.
 */
export interface PauseIn {
  touch: boolean;
  locked: boolean;
  /** Screenshot or webdriver runs: the mouse being free never pauses them. */
  exempt: boolean;
  dead: boolean;
  charScreen: boolean;
  portrait: boolean;
  coaching: boolean;
  menuOpen: boolean;
  /** The player asked to resume (Esc or the Resume button) and the pointer is not back yet. */
  resuming: boolean;
}

export interface PauseView {
  /** The world holds still this frame. */
  frozen: boolean;
  /** The pause menu is on screen. */
  menu: boolean;
  /** The "click to resume" line is on screen (desktop, resuming, pointer not yet locked). */
  clickToResume: boolean;
}

export function pauseView(i: PauseIn): PauseView {
  const free = !i.touch && !i.locked && !i.exempt && !i.dead && !i.charScreen;
  const waiting = free && i.resuming && !i.menuOpen;
  const frozen = free || i.portrait || i.coaching || i.menuOpen;
  return {
    frozen,
    menu: frozen && !waiting && !i.portrait && !i.coaching,
    clickToResume: waiting && !i.portrait && !i.coaching,
  };
}

/** The resume flag for the next frame: it clears once the pointer is back, or once the menu opens again. */
export function nextResuming(resuming: boolean, locked: boolean, menuOpen: boolean): boolean {
  return resuming && !locked && !menuOpen;
}

/**
 * An Esc that arrives this soon after the pause opened is the same press that freed the pointer (Chrome can
 * deliver the keydown after the unlock), not a second press asking to resume.
 */
export const ESC_DEBOUNCE_MS = 300;
