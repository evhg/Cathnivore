# Vision: world-class games from the Republic of Marrow

The owner's goal (2026-09-27/28): **keep improving and beautifying the games indefinitely, until the vision and the craft are world-class.** Cathnivore comes first. This file is the north star for every improvement session, and `STYLE.md` remains the detailed style guide. When they disagree on looks, update `STYLE.md` to match this file and log the change in `DECISIONS.md`.

## What world-class means here

Measure the work against the best-crafted games on phones and the web: Wingspan's digital edition, Mini Metro, Monument Valley, Slay the Spire, Root, Townscaper. Don't copy them. Match their bar:

1. **Every screen is designed, not laid out.** Each has a clear focal point, an illustration or scene, and a deliberate hierarchy. Nothing looks like a default form, a plain list or unstyled HTML.
2. **The table is the hero.** In Cathnivore the map and the pieces on it are the most beautiful thing on screen: big, rich, legible and alive. Menus and panels support the table and never compete with it.
3. **Everything responds.** Every tap, purchase, turn and enemy move gets immediate, tactile feedback: motion, a state change, haptics on iPhone and, once added, sound. There are no dead clicks and no mystery waits.
4. **Choreographed moments.** Liberating a region, a Squeeze landing, finishing a chapter, winning or losing: each is a small staged moment, with timing, easing and a payoff, never just a text line.
5. **Characters with presence.** Cath and the producers are people you remember: expressive portraits, poses, reactions and voice in the writing. Story scenes feel staged like a graphic novel, not like a chat log.
6. **Craft in the details.** A consistent spacing and type scale, pixel-crisp SVG at every size, a dark mode that is designed rather than inverted, and wit in the small print (a 0.99 price tag, a SOLD sign).
7. **Fast and smooth on a mid-range phone.** 60 fps animations, a first screen in under 2 s on 4G, no layout jank. Beauty never costs performance.
8. **Accessible by default.** WCAG AA contrast, full keyboard play, screen reader labels, reduced motion respected, and colour-blind-safe shapes. Beautiful for everyone.

## Art direction (extends STYLE.md)

- **Look:** a farmers'-market poster that has wandered into a political cartoon. Warm paper, ink outlines, flat colour with hand-made texture for the players' world; glossy, plastic, over-lit and clinical for the corporations. That contrast is the joke and the design system.
- **Illustration:** all art is authored as code (SVG, CSS, canvas or WebGL): shapes, patterns and procedural texture. Use no stock art. Use no third-party images, audio or fonts unless the licence is CC0 or OFL, and record them in the credits.
- **Type:** Fraunces (display, with italics for voice) and Atkinson Hyperlegible (UI and body). Use a strict type scale.
- **Motion:** UI responses take 120-250 ms with ease-out. Moments take 400-1200 ms, choreographed, with overshoot allowed on player-world things and not on the corporations' things. Reduced motion leaves fades only.
- **Colour:** use `src/styles/tokens.css` only; add tokens rather than hard-coding colours.
- **Sound** (a roadmap item): soft, organic sounds (wood, paper, market chatter) for the players' world and sterile synth blips for the corporations, synthesised with WebAudio or CC0. Off switch in Settings, and respect the silent switch on iPhone.

## Principles for an indefinite run

- **Depth before breadth.** Polish what exists until it's world-class before adding modes, games or content. A new game or major feature needs its own design note in `docs/design/` and a place in `ROADMAP.md`.
- **Small, shippable steps.** Every session leaves `build` green and the live site better, never half-redesigned. Put big redesigns behind a setting or a feature flag until they're complete, then switch them on.
- **Players' trust first.** Never break saves: add a migration and a test for any change to the save format. Rules must stay correct and match the in-game text. The live site must never be broken; SPEC 1.3's priority order still applies.
- **Look before and after.** Every visual change is checked with screenshots at 390×844 and 1440×900, in light and dark mode, before it ships.
