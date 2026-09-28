# Cathnivore: visual style guide

The build follows this file for every screen, piece, card, portrait and store asset. When it conflicts with anything else, this file wins on looks, and SPEC.md wins on rules and behaviour.

## 1. Direction in one line
**A farmers'-market poster that has wandered into a political cartoon.** The players' world is flat, warm and hand-made: paper, ink, earth. The enemies' world is glossy, plastic and clinical. That contrast *is* the visual joke: natural versus processed.

- **Aim for:** warm, crafted, witty, legible at a glance.
- **Avoid:** cute kawaii cartoon, fantasy-game chrome, neon everywhere, heavy gradients, stock-icon look, clutter.

## 2. Principles
1. **Legibility first.** Every game state must be readable on a 390 px-wide phone in under two seconds.
2. **Two materials.** Player things are flat, with ink outlines and paper texture. Enemy things are glossy, with a single highlight and no outline. Never mix the two.
3. **Shape before colour.** Every piece and marker must be identifiable in greyscale. A test renders the map in greyscale and a subagent checks it.
4. **One accent per screen.** One thing asks for attention at a time, usually the next decision.
5. **Wit lives in words and small details,** such as a price tag reading 0.99 or a fence sign reading SOLD. It never comes from decoration.

## 3. Colour tokens
Define all colours as CSS custom properties. Never hard-code a colour outside the token file.

### 3.1 Base (light theme)
| Token | Hex | Use |
|---|---|---|
| `--paper` | #F4EDE1 | App background |
| `--paper-2` | #EAE0CF | Panels, sheets |
| `--surface` | #FBF8F1 | Cards, plan-strip cards, secondary buttons |
| `--ink` | #2B2320 | Text, outlines |
| `--ink-muted` | #6E625A | Secondary text, flavour lines |
| `--pasture` | #5B7F3A | Co-op seal, success, large shapes |
| `--pasture-deep` | #466A2B | Primary button fill, pasture-coloured text |
| `--soil` | #6B4A2B | Headings on paper, borders |
| `--wheat` | #D9B45A | Highlights, the selected state |
| `--sea` | #3E6E7E | Links, information |
| `--clay` | #B5523B | Lost Land tiles, large danger shapes |
| `--clay-deep` | #9E4430 | Destructive button fill, SQUEEZE badge, danger text |

### 3.2 Regions (fills, with a texture pattern at 8% ink)
| Token | Hex | Pattern |
|---|---|---|
| `--region-pasture` | #CFE0B4 | short diagonal strokes |
| `--region-crop` | #EBD9A6 | dotted furrow rows |
| `--region-coast` | #BFD6DA | wave lines |
| `--region-capital` | #D8CFC4 | cobblestone grid |

### 3.3 Producers (Stall colour, portrait accent)
| Producer | Token | Hex |
|---|---|---|
| Mara | `--p-mara` | #8C2F39 (oxblood) |
| Tomas | `--p-tomas` | #C9962B (mustard) |
| Ines | `--p-ines` | #4E6A8C (slate blue) |
| Sol | `--p-sol` | #6B4E7A (plum) |

### 3.4 Enemies (glossy: base colour plus a lighter highlight)
| Faction | Base | Highlight |
|---|---|---|
| Hollowell | #FF7A1A | #FFB36B |
| Candor | #3FC1D9 | #BFF1FA |

### 3.5 Dark theme
**The table goes dark; the pieces, cards and portraits don't.** They keep their light-theme colours because they are objects on the table. The theme follows the phone's setting, and Settings can force light or dark. The style board's "Dark mode" artboard shows the game screen in both themes side by side.

| Token | Dark value | Use |
|---|---|---|
| `--paper` | #1E1A17 | App background |
| `--paper-2` | #2A2420 | Bars, panels, sheets |
| `--surface` | #332C27 | Plan-strip cards, secondary buttons |
| `--rule` | #8A7D72 | Borders and dividers (at least 3:1 against panels) |
| `--ink` | #F1E9DC | Text, and icon strokes that sit directly on dark |
| `--ink-muted` | #B8AC9F | Secondary text |
| `--pasture` | #7FA35A | Pasture-coloured text and outlines |
| `--soil` | #D9B98A | Headings on paper, borders |
| `--sea` | #6FA3B3 | Links, information |
| `--clay` | #D0705A | Danger text |
| `--pasture-deep`, `--clay-deep`, `--wheat` | unchanged | Fills that carry text |

- **Regions:** pasture #3E4A30, crop #574A2A, coast #2F474C, capital #45403B. Textures use light ink at 12%, and region names are set in light ink.
- **Producer and enemy colours** stay the same in both themes.

### 3.6 Contrast
Text must reach at least 4.5:1 against its background (3:1 for text 24 px and larger). Automated accessibility checks enforce this. Paper-coloured text fails on `--pasture` and `--clay`, so any fill that carries text uses the `-deep` version.

## 4. Typography
Use two families only, bundled with @fontsource:
- **Fraunces** for headings, card names, story speaker names and Agenda headlines (italic).
- **Atkinson Hyperlegible** for all interface and rules text. It was designed for readers with low vision, which suits small rules text on phones, and it looks less generic than the usual interface fonts.

Use tabular numbers for every count and resource.

| Role | Font | Size (phone) | Weight |
|---|---|---|---|
| Title | Fraunces | 32 | 700 |
| Screen heading | Fraunces | 24 | 600 |
| Section heading | Fraunces | 20 | 600 |
| Body, rules detail, story lines | Atkinson Hyperlegible | 16 | 400 |
| Card rules text (compact card view) | Atkinson Hyperlegible | 14 | 400 |
| Labels (uppercase, tracking +0.04em) | Atkinson Hyperlegible | 12 | 700 |

Nothing players must read is smaller than 14 px, and running text is 16 px. Body line height is 1.4. Desktop sizes go up about 10%.

## 5. Icons (24 px grid)
Icons are flat fills with a 2 px `--ink` outline and rounded joins, and must stay readable at 16 px.

| Thing | Icon |
|---|---|
| Produce | beetroot with two leaves |
| Marks | coin with a lowercase "m" |
| Goodwill | small sun |
| Public Trust | two heads side by side |
| Lost Land | cracked soil square |
| Rift | zigzag crack splitting a circle |
| Round | calendar leaf |
| Actions left | filled or empty dots |

### 5.1 Action icons (ROADMAP 9)
Same 24 px grid, flat fill, 2 px ink outline. Sits at the start of each action button, before the label.
| Action | Icon |
|---|---|
| Sell | a downward arrow feeding into a wheat coin |
| Invest | a paper card with a wheat coin badge at top right (echoes the Improvement card itself) |
| Scheme | a folded paper dart (a note "sent" — Cath's Plan cards are "notes from her pocket") |
| Graft | a thin pasture-green sprout growing from a small clay soil mound |
| Open Stall | the Stall piece's own scalloped awning, in clay rather than a producer colour (no producer context yet at icon scale) |
| Supply | a faded Outlet box struck through with a clay X |
| Rebut | a faded Doubt bubble struck through with a clay X |
| Role | a plain wheat 5-point star badge (one shared icon; the 4 producers' role abilities differ too much for a per-role icon yet) |

## 6. Game pieces (SVG, 32 px on the map, readable at 20 px)
| Piece | Shape | Material |
|---|---|---|
| Stall | small awning with scalloped edge, striped in the producer's colour and paper | flat, ink outline |
| Outlet | little shopfront box with a price tag reading 0.99 | glossy Hollowell orange |
| Buyout | picket-fence segment with a SOLD sign | glossy Hollowell orange |
| Doubt | speech bubble with "?" | glossy Candor cyan |
| Lost Land | cracked hatched tile | flat clay, ink outline |
| Co-op marker | wax-seal rosette | flat pasture green, ink outline |

On a region, Stalls sit along the bottom edge (up to 3 slots) and enemy pieces cluster at the top. Lost Land sits under everything as a hatched overlay.

## 7. Map
- A hex flower of rounded hexes with a 3 px paper gap between them. Each region uses its type fill and texture.
- The region name is set in Fraunces, 13 px, uppercase, near the top.
- **Warning badges:** a clay-deep "SQUEEZE" pill or a wheat "EXPAND" pill on targeted regions. These are the most important signals on the screen.
- In targeting mode, legal regions glow with a 3 px wheat outline and a soft pulse, and everything else drops to 45% opacity.

## 8. Cards (5:7 ratio, 10 px corner radius)
- **Improvement:** a coloured band at the top per tag, the name in Fraunces, a coin with the cost at top right, rules text in Atkinson Hyperlegible, and an optional flavour line in italic `--ink-muted` at the bottom.
- **Cath's Plan (Scheme):** an index card with faint ruled lines, the name in Fraunces, and Goodwill suns for the cost. Cath's line sits in Fraunces italic beside a 32 px avatar of her. These should feel like notes from her pocket.
- **Agenda:** a newspaper clipping on off-white newsprint (#F7F4EC) with a torn top edge. The faction logo sits top-left and the headline is in Fraunces bold italic. The effect sits in a boxed panel, and the bonus effect in a dashed box that greys out at Rift 3.
- **Pressure:** a minimal card showing the stage number in Roman numerals and one or two region-type icons. The enemy plan strip shows these at 56 px wide.

**Enemy logos** are original and simple:
- **Hollowell:** a glossy orange rounded "H" in a rounded square, with one cheerful leaf that is clearly plastic.
- **Candor:** a cyan open "C" circling a small plus sign.

Neither may resemble any real brand. In particular, avoid red-and-yellow food logos and any existing pharmacy mark.

## 9. Portraits
- Flat geometric busts built from simple shapes (ovals, rounded rectangles), with 3 to 5 colours each plus a skin tone and a 2 px ink outline.
- Eyes are ellipses with a small highlight. Expression comes from eyebrow angle and mouth line only. Cath is the exception (below).
- Sizes are 32, 48, 96 and 160 px, and each must read at 32.
- Characters:
  - **Cath** is drawn by the shared, framework-free `shared/cath/cath.ts` module, not by the flat-geometric rules above — see `VISION.md` "Cath: character bible" for the full brief. In summary: a classy, cute, stylish mum in her early-to-mid thirties, drawn in richer detail than the rest of the cast (soft shading and more than 5 colours are allowed for her):
    - large bright eyes with a neat winged liner and two highlights, soft brows with the right one a touch raised (sharp, not just sweet), rosy cheeks, a small nose and glossy rose lips with a warm half-smile;
    - very long, glossy, centre-parted hair falling in soft waves with a light shine band, sometimes with a pasture-green leaf clip;
    - two outfits: her classic field look (fitted olive field jacket, cream silk blouse, pearl studs, a fine gold necklace with a leaf pendant) and a market-day look (camel trench, cream knit scarf); every outfit keeps a cute touch (the leaf clip, a rolled sleeve, a gingham hair ribbon);
    - five expressions — warm smirk (default), delighted, determined, worried, wink — and two framings, a bust portrait for 32-160 px UI and a half-body figure for heroes and scenes.

    Her hair and skin colours come from `OWNER.md`. `shared/cath/` is the only source of truth for how she looks; nothing elsewhere in the app should draw her separately.
  - **Mara:** grey braid, waxed jacket.
  - **Tomas:** curly hair, apron.
  - **Ines:** short natural hair, cardigan over scrubs.
  - **Sol:** headphones around his neck, knitted beanie.
  - **Pell:** grey suit, a smile that's slightly too white.
  - **Vane:** sleek silver bob, cyan scarf.
  - **Crisp:** slicked hair, orange tie.
  - **Pip:** flat cap, clipboard, very friendly.
- The cast covers a natural range of ages, skin tones and builds, drawn with respect and no caricature of any group.

## 10. Layout and spacing
- The base unit is 4 px, with a spacing scale of 4, 8, 12, 16, 24 and 32.
- Corner radii: cards 10, sheets 14, buttons 12, pills fully rounded.
- **Shadows:** player UI uses a flat paper edge (`0 1px 0` of ink at 15%). Glossy enemy items get an inner highlight instead of a drop shadow.
- **Buttons:** primary is pasture-deep fill with paper text. Secondary is a paper fill with an ink outline. Destructive is clay-deep. Every tap target is at least 44×44.
- Respect iOS safe areas (the notch and the home indicator) on every screen.

## 11. Motion and feel
- Durations are 150 to 250 ms with ease-out.
  - A placed Stall drops in with a small spring.
  - Enemy pieces slide in from the edge like a delivery.
  - Lost Land cracks in with a quick wipe.
  - Cards flip on the vertical axis.
- With reduced motion switched on, use fades only.
- **iPhone haptics:** a light tap when placing, a medium tap on liberation, and a warning buzz on Lost Land and loss.

## 12. Words on screen
- Buttons are verbs: Open Stall, Supply, Rebut, Invest, Sell, Scheme, Graft.
- Rules text is plain and exact, with no jokes. Jokes belong only in flavour lines, headlines and story.
- Errors say what happened and what to do next, for example: "Not enough Produce. You need 2 and have 1."
- No exclamation marks and no emoji anywhere in the interface.

## 13. App icon and store assets
- **App icon (1024×1024, no transparency):** a close crop of the new Cath (`shared/cath/cath.ts`, see section 9 and VISION.md "Cath: character bible"), drawn from `cathSvg({framing: 'face', outfit: 'field', expression: 'smirk'})` — her very long, centre-parted hair falling to the edges, the raised right eyebrow and warm smirk. A small pasture-green leaf clip shows on the right side of her hair. The background is wheat for dark hair and pasture-deep for light hair, so the hair always stands out. No text. It must read at 60 px. `public/favicon.svg` is a frozen, static copy of that same render (favicons can't run the module's JS); the app icon and other static Cath assets (touch icon, social preview) should match it.
- **Launch screen:** paper background with the icon drawing centred, and nothing else.
- **App Store screenshots:** 5 portrait screenshots at the size Apple currently requires for the largest iPhone, each with a caption banner in Fraunces at the top:
  1. mid-game map with the enemy plan visible ("See their next move. Beat it.");
  2. Cath's Plan with a witty scheme ("Her schemes. Your call.");
  3. a story scene ("A campaign with a twist. Or three.");
  4. an Agenda headline during the enemy turn ("Big Food. Big Pharma. Small print.");
  5. a victory screen ("Take back Kingsmarket.").
- **Social preview image** (1200×630): the same style as screenshot 1.

## 14. Never
- Real brand colours or logos, or anything resembling them.
- Gradients on player-side elements.
- More than two fonts.
- Text over busy texture.
- Drop shadows heavier than section 10 allows.
- Decorative clutter that competes with the enemy plan strip.
