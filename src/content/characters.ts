// STYLE.md 9: portrait colours and shape traits, one entry per named character.
// Cath's hair/skin come from OWNER.md (hardcoded here since OWNER.md isn't read at build time).
export type HairStyle = 'braid' | 'curly' | 'short' | 'bob' | 'slick' | 'beanie' | 'flatcap' | 'curtain'
export type Mouth = 'smile' | 'neutral' | 'smirk' | 'grin'
export type Accessory = 'waxedJacket' | 'apron' | 'cardigan' | 'headphones' | 'suit' | 'tie' | 'clipboard' | 'scarf'

export interface CharacterPortrait {
  skin: string
  hair: string
  hairStyle: HairStyle
  outfit: string
  outfitAccent: string
  accessory?: Accessory
  browAngle: number
  mouth: Mouth
}

const CATH_HAIR = '#2E211C' // OWNER.md: Cathnivore's hair colour
const CATH_SKIN = '#F7DCCB' // OWNER.md: Cathnivore's skin colour

export const CHARACTERS: Record<string, CharacterPortrait> = {
  cath: {
    skin: CATH_SKIN,
    hair: CATH_HAIR,
    hairStyle: 'curtain',
    outfit: '#6B7A4A',
    outfitAccent: '#F4EDE1',
    browAngle: -6,
    mouth: 'smirk',
  },
  mara: {
    skin: '#C98F5E',
    hair: '#9AA0A6',
    hairStyle: 'braid',
    outfit: '#5C6B57',
    outfitAccent: '#3E4A38',
    accessory: 'waxedJacket',
    browAngle: 6,
    mouth: 'neutral',
  },
  tomas: {
    skin: '#8C5A3C',
    hair: '#3A2A20',
    hairStyle: 'curly',
    outfit: '#D9B45A',
    outfitAccent: '#F4EDE1',
    accessory: 'apron',
    browAngle: -4,
    mouth: 'grin',
  },
  ines: {
    skin: '#E0B08C',
    hair: '#2B2320',
    hairStyle: 'short',
    outfit: '#4E6A8C',
    outfitAccent: '#F4EDE1',
    accessory: 'cardigan',
    browAngle: 0,
    mouth: 'smile',
  },
  sol: {
    skin: '#D9A876',
    hair: '#4A3A55',
    hairStyle: 'beanie',
    outfit: '#6B4E7A',
    outfitAccent: '#B49BC0',
    accessory: 'headphones',
    browAngle: -2,
    mouth: 'neutral',
  },
  pell: {
    skin: '#EFCBA8',
    hair: '#B8AC9F',
    hairStyle: 'slick',
    outfit: '#3B3F45',
    outfitAccent: '#FFFFFF',
    accessory: 'suit',
    browAngle: 8,
    mouth: 'grin',
  },
  vane: {
    skin: '#F0D6BE',
    hair: '#C9CDD1',
    hairStyle: 'bob',
    outfit: '#2F474C',
    outfitAccent: '#3FC1D9',
    accessory: 'scarf',
    browAngle: 4,
    mouth: 'smirk',
  },
  crisp: {
    skin: '#C98F5E',
    hair: '#1E1A17',
    hairStyle: 'slick',
    outfit: '#3B3F45',
    outfitAccent: '#FF7A1A',
    accessory: 'tie',
    browAngle: 6,
    mouth: 'neutral',
  },
  pip: {
    skin: '#E0B08C',
    hair: '#6B4A2B',
    hairStyle: 'flatcap',
    outfit: '#8C6A4A',
    outfitAccent: '#D9B45A',
    accessory: 'clipboard',
    browAngle: -8,
    mouth: 'smile',
  },
}

// Normalizes a story speaker name ("Mara", "Cath's inner voice") to a portrait key, if any.
export function portraitKeyFor(speaker: string): string | undefined {
  const key = speaker.trim().toLowerCase().split(/[\s'()]/)[0] ?? ''
  return key in CHARACTERS ? key : undefined
}
