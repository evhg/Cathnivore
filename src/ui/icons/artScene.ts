import { createContext } from 'react'

// Plan item 218: inside the desktop hand each card's picture is a wide painted window (the subject in its
// landscape) rather than a small square tile. ActionArt's Tile reads this to draw the wider scene.
export const ArtSceneContext = createContext(false)

// Plan item 225: the Role card's picture is the active producer's own ability (Mara's injunction, Tomas's
// market day, Ines's second opinion, Sol's broadcast), not one rosette for everyone. Game.tsx provides it.
export const RoleProducerContext = createContext<'mara' | 'tomas' | 'ines' | 'sol' | undefined>(undefined)
