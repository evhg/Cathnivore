import type { ProducerId, RegionId, Resources } from '../engine/types'

export interface ProducerDef {
  id: ProducerId
  name: string
  home: RegionId
  startingResources: Resources
  startingProduction: Resources
  roleName: string
  roleAbility: string // short description; the engine implements the effect separately
}

export const PRODUCERS: Record<ProducerId, ProducerDef> = {
  mara: {
    id: 'mara',
    name: 'Mara Keel',
    home: 'brindleHills',
    startingResources: { produce: 3, marks: 2, goodwill: 1 },
    startingProduction: { produce: 2, marks: 1, goodwill: 1 },
    roleName: 'Litigator, Injunction',
    roleAbility: 'Choose a region with your Stall. Expand skips it this round.',
  },
  tomas: {
    id: 'tomas',
    name: 'Tomas Reed',
    home: 'oakvale',
    startingResources: { produce: 2, marks: 3, goodwill: 1 },
    startingProduction: { produce: 1, marks: 2, goodwill: 1 },
    roleName: 'Organiser, Market Day',
    roleAbility: "Open a Stall for free in a region bordering any producer's Stall.",
  },
  ines: {
    id: 'ines',
    name: 'Dr Ines Farrow',
    home: 'rivermead',
    startingResources: { produce: 2, marks: 2, goodwill: 2 },
    startingProduction: { produce: 1, marks: 1, goodwill: 2 },
    roleName: 'Doctor, Second Opinion',
    roleAbility: 'Remove 1 Doubt from a region with your Stall, at no cost.',
  },
  sol: {
    id: 'sol',
    name: 'Sol Abara',
    home: 'saltmarsh',
    startingResources: { produce: 2, marks: 2, goodwill: 2 },
    // M4 balance-loop iteration 12 (see DECISIONS.md): produce production 1 -> 2, to close the
    // liberation-pace gap that left Sol-paired producers the weakest pairs in every recent balance run.
    startingProduction: { produce: 2, marks: 1, goodwill: 2 },
    roleName: 'Podcaster, On Air',
    roleAbility: 'Public Trust +1, or gain 2 Goodwill.',
  },
}

export const ALL_PRODUCER_IDS: ProducerId[] = ['mara', 'tomas', 'ines', 'sol']
