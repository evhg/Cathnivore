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

## Cath: character bible (owner, 2026-09-28)

**Cath is the face of every game.** She stars in every title on cathnivore.com: the heroine and narrator of Cathnivore, the host of Runnel, the centrepiece of the landing page, and the lead of any future game. If a screen has room for a character, it's Cath.

**Look: a classy, cute, stylish mum.** She is elegant and warm, the kind of person who looks put together at a farmers' market at 7 a.m. and makes it seem effortless. Keep her tasteful: the appeal is style, confidence and charm, never anything suggestive.
- **Age and build:** early-to-mid thirties, a graceful posture, a confident half-smile.
- **Hair:** very long, glossy, centre-parted, falling in soft waves, with a light shine band. Colour from `OWNER.md`. Sometimes a pasture-green leaf clip.
- **Face:** large bright eyes with a neat winged liner and two highlights, soft brows with the right one a touch raised (she's sharp, not just sweet), rosy cheeks, a small nose and glossy rose lips. Skin tone from `OWNER.md`.
- **Style:** tailored and classy. Her signature look is a fitted olive field jacket with the collar up over a cream silk blouse, pearl stud earrings and a fine gold necklace with a small leaf pendant. Her market-day look is a camel trench and a cream knit scarf. Every outfit has a cute touch: the leaf clip, a rolled sleeve, a gingham hair ribbon.
- **Expressions:** warm smirk (default), delighted, determined, worried, wink. She reacts to what the player does.
- **Mum:** she has a six-year-old daughter, Bea, who appears now and then as a small, wholesome detail (a drawing pinned to the farm stall, a line in a scene). Being a mum is part of why she fights for local food. It's never the punchline.

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
