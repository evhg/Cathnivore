import type { GameConfig, PressureCard, ProducerId, RegionId, RulesEnabled } from '../engine/types'

// SPEC 8.1: "Chapters are data: which regions are active, which rules are switched on, the starting
// state, a scripted Pressure sequence where needed, triggers ..., scenes and tutorial steps." This is
// the shared shape every chapter in `src/content/story/` is defined against.
export interface TutorialStep {
  // 2 sentences maximum (SPEC 8.1), shown as a prompt highlighting part of the screen.
  text: string
  // The one thing the player may do at this step; chapters 1-2 use this to disable every other control
  // ("only the action being taught is enabled" — SPEC 8.1). `null` once the chapter is playing freely.
  highlight: { kind: 'action'; action: string } | { kind: 'region'; region: RegionId } | null
}

export interface Chapter {
  id: string
  title: string
  activeRegions: RegionId[]
  greyedRegions: RegionId[] // shown on the map but not in play (SPEC 8.2 ch1: Kingsmarket)
  producers: ProducerId[]
  difficulty: 'easy' | 'normal' | 'hard'
  rulesEnabled: RulesEnabled
  scriptedPressure?: PressureCard[]
  scriptedMarket?: string[] // SPEC 8.2 ch3: force these Improvement ids into the opening Market
  scriptedTrigger?: { round: number; effect: 'wholesomeHollowReveal'; sceneId: string } // SPEC 8.1/8.2
  winCondition: { regionsRequired: number; requireKingsmarket: boolean }
  goalDescription: string // shown on the chapter-list card, e.g. "Liberate both regions within 6 rounds."
  tutorialSteps: TutorialStep[]
  openingScene: string // key into `src/content/story/<id>.ts`'s scene data
  closingScene: string
}

export function chapterConfig(chapter: Chapter): GameConfig {
  return {
    producers: chapter.producers,
    difficulty: chapter.difficulty,
    activeRegions: chapter.activeRegions,
    rulesEnabled: chapter.rulesEnabled,
    scriptedPressure: chapter.scriptedPressure,
    scriptedMarket: chapter.scriptedMarket,
    scriptedTrigger: chapter.scriptedTrigger,
    winCondition: chapter.winCondition,
  }
}

const RULES_CHAPTER_1: RulesEnabled = {
  agenda: false,
  squeeze: false,
  expand: false,
  rebut: false,
  sell: false,
  improvements: false,
  schemes: false,
  roles: false,
}

// SPEC 8.2: "the enemy only Scouts, using a fixed tutorial sequence." Introduces one region at a time
// (Brindle Hills, then Highmoor) rather than pressuring both at once — a single producer with only
// Harvest/Open Stall/Supply/Graft can't keep pace with Scout hitting two regions every round, and a
// scripted tutorial sequence has no reason to be that harsh in its opening chapter. The setup reveal
// (SPEC 4.3.4) consumes the first card, so 7 cards cover rounds 1-6 plus that one setup reveal.
function chapter1Pressure(): PressureCard[] {
  const card = (id: string, regions: RegionId[]): PressureCard => ({ id, stage: 1, regionTypes: [], regions })
  return [
    card('tutorial-1-setup', ['brindleHills']),
    card('tutorial-1-r1', ['brindleHills']),
    card('tutorial-1-r2', ['brindleHills']),
    card('tutorial-1-r3', ['highmoor']),
    card('tutorial-1-r4', ['highmoor']),
    card('tutorial-1-r5', ['highmoor']),
    card('tutorial-1-r6', ['highmoor']),
  ]
}

export const CHAPTER_1: Chapter = {
  id: 'fresh-meat',
  title: 'Fresh Meat',
  activeRegions: ['brindleHills', 'highmoor'],
  greyedRegions: ['kingsmarket'],
  producers: ['mara'],
  difficulty: 'normal',
  rulesEnabled: RULES_CHAPTER_1,
  scriptedPressure: chapter1Pressure(),
  winCondition: { regionsRequired: 2, requireKingsmarket: false },
  goalDescription: 'Liberate both regions.',
  tutorialSteps: [
    {
      text: 'This is Brindle Hills, your farm. An Outlet is undercutting you — spend 1 Produce to Open a Stall here.',
      highlight: { kind: 'action', action: 'openStall' },
    },
    {
      text: 'Stalls push Outlets out. Spend Produce to Supply and clear the Outlet from Brindle Hills.',
      highlight: { kind: 'action', action: 'supplyOutlets' },
    },
    {
      text: 'Highmoor borders Brindle Hills, so you can open a Stall there too.',
      highlight: { kind: 'region', region: 'highmoor' },
    },
    {
      text: 'No good move? Graft always works: 1 Produce and 1 Marks, guaranteed.',
      highlight: { kind: 'action', action: 'graft' },
    },
    {
      text: 'Watch the Scout slot — it shows exactly where the next Outlet lands.',
      highlight: null,
    },
    {
      text: 'Clear every Outlet and Buyout from a region with a Stall in it to liberate it. Liberate both regions to win.',
      highlight: null,
    },
  ],
  openingScene: 'opening',
  closingScene: 'closing',
}

const RULES_CHAPTER_2: RulesEnabled = {
  agenda: false,
  squeeze: false, // SPEC 8.2 ch3 explicitly lists Squeeze/Expand as ITS new additions — still off here.
  expand: false,
  rebut: true,
  sell: false,
  improvements: false,
  schemes: false,
  roles: true,
}

// SPEC 8.2: "the enemy only Scouts" is still true in chapter 2 (Squeeze/Expand are chapter 3's addition),
// but "Scout also adds Doubt" — Saltmarsh, Highmoor and Rivermead are three different region types, so
// plain type-matching cards already introduce them one at a time; a couple of Stage III (two-type) cards
// near the end add the Doubt/Rebut lesson without needing the `regions` override chapter 1 needed.
function chapter2Pressure(): PressureCard[] {
  const single = (id: string, stage: 1 | 2, types: PressureCard['regionTypes']): PressureCard => ({ id, stage, regionTypes: types })
  const double = (id: string, types: PressureCard['regionTypes']): PressureCard => ({ id, stage: 3, regionTypes: types })
  return [
    single('tutorial-2-setup', 1, ['coast']),
    single('tutorial-2-r1', 1, ['pasture']),
    single('tutorial-2-r2', 1, ['crop']),
    double('tutorial-2-r3', ['coast', 'pasture']),
    double('tutorial-2-r4', ['pasture', 'crop']),
    single('tutorial-2-r5', 2, ['coast']),
    single('tutorial-2-r6', 2, ['pasture']),
    single('tutorial-2-r7', 2, ['crop']),
  ]
}

export const CHAPTER_2: Chapter = {
  id: 'word-of-mouth',
  title: 'Word of Mouth',
  activeRegions: ['saltmarsh', 'highmoor', 'rivermead'],
  greyedRegions: ['kingsmarket'],
  producers: ['sol'],
  difficulty: 'normal',
  rulesEnabled: RULES_CHAPTER_2,
  scriptedPressure: chapter2Pressure(),
  winCondition: { regionsRequired: 2, requireKingsmarket: false },
  goalDescription: 'Liberate 2 of the 3 regions while keeping Public Trust above 0.',
  tutorialSteps: [
    {
      text: "Doubt is a company's word against yours. Spend Goodwill to Rebut it in a region with your Stall.",
      highlight: { kind: 'action', action: 'rebut' },
    },
    {
      text: 'Public Trust is everyone’s opinion of farmers, shared by both of you. Keep an eye on it.',
      highlight: null,
    },
    {
      text: 'Once a round, your role ability is free: On Air raises Trust or your Goodwill, your choice.',
      highlight: { kind: 'action', action: 'role' },
    },
    {
      text: 'Liberate 2 of these 3 regions to win the chapter.',
      highlight: null,
    },
  ],
  openingScene: 'opening',
  closingScene: 'closing',
}

const RULES_CHAPTER_3: RulesEnabled = {
  agenda: false, // SPEC 8.2 ch3 doesn't list Agenda among its additions; that's the full game (ch4+).
  squeeze: true,
  expand: true,
  rebut: true,
  sell: true,
  improvements: true,
  schemes: false, // SPEC 8.2: Cath's Plan (Schemes) is chapter 4's addition.
  roles: true,
}

// SPEC 8.2: "Growing Season" is where Squeeze/Expand/Lost Land start actually threatening the player, so
// (like chapter 1) the scripted sequence targets one region at a time via the `regions` override rather
// than by type — Oakvale and Rivermead are both Crop, so a type-matching card would otherwise double up,
// and a lone producer covering 4 regions against a real Squeeze/Expand pipeline can't handle more than
// one new threat a round. SPEC 8.2's stated goal is "within 8 rounds," but empirically (HeuristicBot,
// measured directly — see DECISIONS.md) that's far too tight for a single producer; a round-robin cycle
// through all 4 regions, long enough to cover ~16 rounds, clears SPEC 9.4's >=70% chapters-2-4 win-rate
// target with room to spare. Every 4th card is Stage III (adds Doubt), matching SPEC 8.2's Rebut/Doubt
// lesson already taught in chapter 2.
function chapter3Pressure(): PressureCard[] {
  const cycle: RegionId[] = ['oakvale', 'brindleHills', 'rivermead', 'shingleBay']
  return Array.from({ length: 16 }, (_, i) => ({
    id: `tutorial-3-${i}`,
    stage: i % 4 === 3 ? (3 as const) : (1 as const),
    regionTypes: [],
    regions: [cycle[i % cycle.length]!],
  }))
}

export const CHAPTER_3: Chapter = {
  id: 'growing-season',
  title: 'Growing Season',
  activeRegions: ['oakvale', 'brindleHills', 'rivermead', 'shingleBay'],
  greyedRegions: ['kingsmarket', 'highmoor', 'saltmarsh'],
  producers: ['tomas'],
  difficulty: 'normal',
  rulesEnabled: RULES_CHAPTER_3,
  scriptedPressure: chapter3Pressure(),
  // SPEC 8.2: "the Improvements Market (seeded with the attractive Wholesome Hollow Contract cards)."
  // Only 1 copy, not all 3 SPEC 7 prints of the card (see DECISIONS.md): a lone chapter-3 producer facing
  // Squeeze/Expand across 4 regions plus the twist's per-contract Outlet flood couldn't clear SPEC 9.4's
  // >=70% HeuristicBot win-rate floor with more than one copy in play (measured directly — 3 copies gave
  // 10%, 1 copy gives ~78% over 60 seeds).
  scriptedMarket: ['wholesome-hollow-contract'],
  // SPEC 8.2 twist: "scripted at the start of round 5, a scene reveals that Wholesome Hollow is owned by
  // Hollowell, and the contract rule from section 7 switches on immediately."
  scriptedTrigger: { round: 5, effect: 'wholesomeHollowReveal', sceneId: 'twist' },
  winCondition: { regionsRequired: 3, requireKingsmarket: false },
  goalDescription: 'Liberate 3 of the 4 regions.',
  tutorialSteps: [
    {
      text: 'The Squeeze slot shows where the enemy strikes this round. Clear it before the enemy turn, or lose a Lost Land token.',
      highlight: null,
    },
    {
      text: 'Sell turns spare Produce into Marks — spend Marks to Invest in an Improvement from the Market.',
      highlight: { kind: 'action', action: 'sell' },
    },
    {
      text: 'An Improvement in your tableau works every round from now on. Buy one that fits your plan.',
      highlight: { kind: 'action', action: 'invest' },
    },
    {
      text: 'Expand adds enemy pieces before Scout does. Watch both slots, not just Squeeze.',
      highlight: null,
    },
    {
      text: 'Liberate 3 of these 4 regions within 8 rounds to win.',
      highlight: null,
    },
  ],
  openingScene: 'opening',
  closingScene: 'closing',
}

export const CHAPTERS: Chapter[] = [CHAPTER_1, CHAPTER_2, CHAPTER_3]
export const CHAPTERS_BY_ID: Map<string, Chapter> = new Map(CHAPTERS.map((c) => [c.id, c]))
