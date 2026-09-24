// Placeholder until the engine (src/engine) exists (M1). Once createGame/legalActions/applyAction
// land, this drives RandomBot/HeuristicBot games through validate() per SPEC 11.4 gate 3.
const quick = process.argv.includes('--quick')
console.log(`fuzz: engine not built yet, nothing to fuzz (${quick ? 'quick' : 'full'} mode)`)
