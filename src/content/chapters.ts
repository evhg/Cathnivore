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
  winCondition: { regionsRequired: number; requireKingsmarket: boolean }
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

export const CHAPTERS: Chapter[] = [CHAPTER_1]
export const CHAPTERS_BY_ID: Map<string, Chapter> = new Map(CHAPTERS.map((c) => [c.id, c]))
