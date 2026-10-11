// SPEC/STYLE's Pressure cards use a stage number (1-3) shown as a Roman numeral.
const ROMAN: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' }
export function romanStage(stage: 1 | 2 | 3): string {
  return ROMAN[stage]
}
