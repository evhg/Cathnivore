// Plan item 33: one place for "1 Mark" and "2 Marks". Card and log text built from numbers goes through this
// (a fixed card text is written with the right form; tests/plural.test.ts checks every card's text).
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
