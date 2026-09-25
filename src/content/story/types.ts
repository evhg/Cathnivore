// SPEC 8.3: story scenes are data, at most 12 lines each, at most 160 characters per line.
export interface SceneLine {
  speaker: string
  line: string
}

export interface Scene {
  lines: SceneLine[]
}
