// Remappable keyboard actions. Everything not listed here keeps its fixed key (shown in the pause card).

export interface Bindable {
  id: string;
  label: string;
  /** Default key codes; a rebind replaces all of them with the one chosen key. */
  def: readonly string[];
}

export const BINDABLE: readonly Bindable[] = [
  { id: "forward", label: "Move forward", def: ["KeyW"] },
  { id: "back", label: "Move back", def: ["KeyS"] },
  { id: "left", label: "Move left", def: ["KeyA"] },
  { id: "right", label: "Move right", def: ["KeyD"] },
  { id: "sprint", label: "Sprint", def: ["ShiftLeft", "ShiftRight"] },
  { id: "crouch", label: "Crouch / slide", def: ["KeyC", "ControlLeft"] },
  { id: "jump", label: "Jump / climb", def: ["Space"] },
  { id: "reload", label: "Reload", def: ["KeyR"] },
  { id: "takedown", label: "Takedown", def: ["KeyF"] },
];

export type Binds = Record<string, string>;

/** The key codes that trigger an action under the player's bindings. */
export function codesFor(binds: Binds, id: string): readonly string[] {
  const b = BINDABLE.find((x) => x.id === id);
  if (!b) return [];
  return binds[id] ? [binds[id]] : b.def;
}

/** Sets a binding; any other action using the same key falls back to its default, so a key never does two jobs. */
export function rebind(binds: Binds, id: string, code: string): Binds {
  if (!BINDABLE.some((x) => x.id === id)) return binds;
  const out: Binds = {};
  for (const [k, v] of Object.entries(binds)) if (v !== code && BINDABLE.some((x) => x.id === k)) out[k] = v;
  out[id] = code;
  return out;
}

/** A readable key name for a code (KeyW -> W). */
export function keyLabel(code: string): string {
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace("Left", " L").replace("Right", " R");
}

/** Drops anything that isn't a known action bound to a string code. */
export function cleanBinds(raw: unknown): Binds {
  const out: Binds = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string" && v && BINDABLE.some((x) => x.id === k)) out[k] = v;
    }
  }
  return out;
}
