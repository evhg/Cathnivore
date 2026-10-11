# AAA UI: the portfolio design system

Owner, 2026-10-11: "I noticed fonts and css is especially rudimentary in your designs. Take it to the next level of AAA games." A design workflow wrote this: AAA UI research, a screenshot audit of every screen, five per-game art directors, and a portfolio art director who merged them. The research and audit are in `aaa-ui-research.md`, and the per-game specs in full are in `aaa-ui-specs.md`. **This doc is the spec for ROADMAP Phase U.**

# Portfolio direction

The portfolio is one studio, five rooms. A thin shared layer carries the house: the Marrow paper palette, one spacing scale, one set of motion tokens, one focus grammar, one way of presenting Cath, and one font-loading rule. Each game then gets its own type, material and voice on top. The rule that ties them together: each game has **one display voice, one reading face and one figures face**. A game may add a fourth face only for Cath's voice. Every face is self-hosted, latin only, OFL-1.1, and under 180 KiB of woff2 per page. Every digit a player reads is tabular and has no slashed zero. Cath is never faux-italicised, recoloured or hidden.

VISION.md ("Type: Fraunces and Atkinson Hyperlegible") and STYLE.md §4 and §14 ("two families only", "no gradients on player-side elements") are amended in milestone 1. Log it in DECISIONS.md as the owner's AAA direction of 2026-10-11. The new rule reads: "Fraunces stays the house display face. Each game has its own type system of at most four faces. Player-side materials may have one painted top-light of at most 6% lightness plus grain. Only enemy and corporate things get gloss."

**Landing (`/`): "Golden hour lobby."**
- A cinema-lobby front door over the live 3D dusk. Cath stands at full height as the host, and each game hangs as a poster set in its own logotype.
- House materials are gold and warm night ink. CATHODE gets a curated "After dark" row.
- Faces and payload:

  | Role | Package | File |
  |---|---|---|
  | Display | `@fontsource-variable/fraunces` | `fraunces-latin-opsz-normal.woff2`, 67.3 KB |
  | UI | `@fontsource-variable/instrument-sans` | `instrument-sans-latin-wght-normal.woff2`, 30.1 KB |
  | Cath's voice | `@fontsource/instrument-serif` | `instrument-serif-latin-400-italic.woff2`, 22.1 KB |
  | Logotypes | 5 glyph subsets in `site/public/marks/` | about 35 KB |
  | **Total** | | **about 155 KB** |

- **Fix to the landing spec:** each card's logotype is cut from **that game's own title face**, not from Playfair or Newsreader. That way a card matches the screen it opens.
  - Cathnivore: Fraunces opsz 144, weight 720.
  - Runnel: Fraunces opsz 144, weight 560.
  - Hedgerow: Fraunces SOFT 100, weight 780.
  - CATHODE: Bodoni Moda opsz 96, weight 560.
  - House mark: Fraunces SOFT 30, WONK 1, gold.

  The Playfair and Newsreader devDependencies are dropped.

**Cathnivore (`/cathnivore/`): "Market Day Press."**
- A farmers'-market broadsheet on a letterpress: card stock, ledgers, newsprint clippings, wax seals and stamps. The corporations are glossy injection-moulded plastic.
- Big moments are staged like Marvel Snap reveals, and every press is physical.
- Faces and payload:

  | Family | Package | File |
  |---|---|---|
  | `Marrow Display` | `@fontsource-variable/fraunces` | `fraunces-latin-opsz-normal.woff2`, 67.3 KB |
  | `Marrow Display` italic (Cath's voice, Agenda headlines) | `@fontsource-variable/fraunces` | `fraunces-latin-wght-italic.woff2`, 45.7 KB |
  | `Marrow Text` | `@fontsource-variable/atkinson-hyperlegible-next` | `atkinson-hyperlegible-next-latin-wght-normal.woff2`, 34.0 KB |
  | `Marrow Figures` (digits only, via `unicode-range`) | `@fontsource-variable/figtree` | `figtree-latin-wght-normal.woff2`, 20.2 KB |
  | **Total** | | **167.2 KB** |

**Runnel (`/runnel/`): "Dawn Ledger."**
- A quiet morning ritual. The board is a small lit diorama on a paper sky that follows the player's local time of day, and water is the only saturated colour on screen.
- An NYT-style masthead, a stats sheet and a staged share card.
- Faces and payload:

  | Family | Package | File |
  |---|---|---|
  | `Runnel Display` | `@fontsource-variable/fraunces` | `fraunces-latin-opsz-normal.woff2`, 67.3 KB |
  | `Runnel UI` | `@fontsource-variable/atkinson-hyperlegible-next` | `atkinson-hyperlegible-next-latin-wght-normal.woff2`, 34.0 KB |
  | `Runnel UI` italic (Cath's voice) | same package | `atkinson-hyperlegible-next-latin-wght-italic.woff2`, 37.6 KB |
  | `Runnel Figures` | `@fontsource-variable/outfit` | `outfit-latin-wght-normal.woff2`, 32.3 KB |
  | **Total** | | **171.2 KB** |

- What sets it apart from Cathnivore: a lighter display weight (560 against 640–720), light hero numerals (Outfit 300 against Figtree 760–850), slower motion, and a cool water accent instead of wheat and ink.

**Hedgerow (`/hedgerow/`): "The Fête Noticeboard."**
- A village fête noticeboard under siege. The players own painted oak, cream card, brass pins and inked lettering. Hollowell owns white gloss plastic, corporate teal and smug sans adverts.
- Bloons TD 6-style outlined counters and a fat Go pill. Kingdom Rush ribbons and medallions.
- Faces and payload:

  | Family | Package | File |
  |---|---|---|
  | `Hedgerow Display` | `@fontsource-variable/fraunces` | `fraunces-latin-full-normal.woff2`, 121.0 KB, all four axes (SOFT is the storybook warmth) |
  | `Hedgerow UI` | `@fontsource-variable/nunito` | `nunito-latin-wght-normal.woff2`, 39.1 KB |
  | **Total** | | **160.1 KB** |

- Nunito replaces Atkinson **in Hedgerow only**. Its default figures are equal width and its zero has no slash. Cath's voice is Fraunces with WONK 1 and SOFT 100 in roman, and no italic file ships.

**CATHODE (`/cathode/`): "Wet Ink."**
- A detective's case file printed on wet chrome. Fashion-noir Bodoni carries story, names and rewards. Condensed technical caps and a mono carry everything Cath reads off the world.
- Colours have strict jobs: blood red means commit or danger, cyan means system and selection, and amber means reward.
- Faces and payload:

  | Family | Package | File |
  |---|---|---|
  | `Cathode Display` | `@fontsource-variable/bodoni-moda` | `bodoni-moda-latin-opsz-normal.woff2`, 46.3 KB |
  | `Cathode Voice` | `@fontsource-variable/bodoni-moda` | `bodoni-moda-latin-opsz-italic.woff2`, 53.8 KB, fetched only on screens that show voice lines |
  | `Cathode UI` | `@fontsource/rajdhani` | 500 + 700 latin files, 30.8 KB |
  | `Cathode Mono` | `@fontsource-variable/jetbrains-mono` | `jetbrains-mono-latin-wght-normal.woff2`, 40.4 KB |
  | **Total** | | **about 171 KB** (a HUD-only session fetches about 71 KB) |

- Fraunces and Atkinson leave CATHODE completely.

**Licences.**
- All seven families are SIL OFL-1.1: Fraunces, Atkinson Hyperlegible Next, Figtree, Outfit, Nunito, Instrument Sans and Serif, Rajdhani, Bodoni Moda, JetBrains Mono.
- `subset-font` is BSD-3 and a devDependency only.
- Before subsetting the marks, check each source font's `OFL.txt` for a Reserved Font Name. None is expected for Fraunces or Bodoni Moda. If one exists, rename the subset's internal name table.
- Ship the OFL texts at `/licences/fonts/` (copied by `scripts/build-site.ts`) and list every face in each game's Credits screen and the landing footer, as VISION.md "Illustration" requires.

**Loading rule (one way everywhere; fixes the specs' disagreement).**
- Every page hand-writes its `@font-face` rules against the specific latin files (`url("…/node_modules/@fontsource…/files/<file>.woff2")`, relative path).
- No page imports a package's `index.css`, `wght.css` or `opsz.css`. Those emit every subset into `dist-site` and make the budget check unreliable. This replaces the CATHODE and landing specs' `@import` of package CSS.
- Fallback if Vite rejects the path: `import url from "…woff2?url"` plus `new FontFace()` and `document.fonts.add()`. This is CSP-safe.
- Text faces use `font-display: swap` with metric-matched local fallbacks. Logotype subsets use `block`.
- Root `public/fonts/` stays until the last game stops using it (the end of milestone 1), and is deleted in that same milestone's last slice.

# Shared foundation

## Files (new `shared/ui/`, imported first by every page; no build step)

| File | Contents |
|---|---|
| `shared/ui/base.css` | Spacing, motion, safe-area and type-floor tokens; the focus grammar; `.stagger` and shared keyframes; `.visually-hidden`; `.num`. About 120 lines. |
| `shared/ui/palette.css` | The **Marrow house palette** (STYLE §3.1 light and §3.5 dark: paper, paper-2, surface, ink, ink-muted, pasture, pasture-deep, soil, wheat, clay, clay-deep, sea, the producer and corp colours). Imported by Cathnivore, Runnel and Hedgerow, not by CATHODE or the landing. This ends Hedgerow's hand-copied drift (`--pasture #4c7a34` becomes `#5B7F3A`). Existing per-game names stay as aliases. |
| `shared/ui/motion.ts` | `reducedMotion()`, `stagger(parent, cap = 10)`, `countUp(el, to, {ms, fmt})`, `tick(el)`, `burst(host, {color, n ≤ 12, ring})`, `setVars(el, record)`. Every function writes the final state at once when reduced motion is on, under `navigator.webdriver` (keeps e2e deterministic), or under `html.reduce-motion`. Bursts remove themselves on `animationend`, with a 1.2 s safety timeout. |
| `shared/ui/cath-frame.css` | Cath presentation conventions (below). |
| `shared/ui/studio.ts` + `studio.css` | `studioBack({label})`, the house back link used by every game. It is a 44 px icon button holding an inline SVG hex-and-leaf monogram (drawn as code) plus "Games" set in the host game's UI face, top-left inside the safe area. It replaces the four different "‹ Games" links. |
| `scripts/font-budget.ts` | After `build:site`, sums the woff2 per page (`dist-site/<page>/assets`, plus `/marks` for `/`). It fails above 184,320 bytes, fails on any emitted non-latin woff2, and prints the table. It runs in `npm run gates` (gate 1). A Cathnivore-only variant runs against `dist/` in `npm run check`. |
| `tests/ui-css-lint.test.ts` | A ratchet against `tests/ui-css-baseline.json` (see below). |
| `tests/ui-contrast.test.ts` | WCAG ratios for every declared text-on-fill pair in `shared/ui/contrast-pairs.ts`, one block per game, taken from the spec tables. AA 4.5, or 3.0 where marked large. |
| `e2e-site/helpers/shots.ts` | `shoot(page, name, sizes)` at 390×844, 844×390 and 1440×900, with light, dark and reduced-motion variants; `contrastWalk(page)` (walks visible text against the nearest opaque background and lists failures); and a CSP-violation console guard. |
| `scripts/portfolio-shots.mjs` (`npm run shots:portfolio`) | Landing and Runnel screens. Cathnivore keeps `npm run shots`, now with an added 844×390 project. Hedgerow keeps `shots:hedgerow` and CATHODE keeps `shots:cathode`; both are extended to use the helper. |

**What `tests/ui-css-lint.test.ts` checks.** It ratchets counts per file in `tests/ui-css-baseline.json`, and a count may only go down:
- raw `font-size: <n>px`;
- literal `z-index` numbers;
- raw hex and rgba values outside token files;
- `font-style: italic` without a declared italic face for that family;
- `@font-face` pointing at `/fonts/`;
- `Fraunces` or `Atkinson` inside `games/cathode`;
- any `style="` attribute or `.style.<prop> =` assignment in HTML, TSX or TS (CSP);
- the font weights each family allows: Rajdhani 500/700; Nunito 200–1000; Atkinson Next 200–800; Figtree and Outfit 100–900.

When a game's milestone finishes a migration, set that file's count to 0 in the baseline, so it can never regress.

## Tokens in `base.css`

```css
:root {
  /* spacing, 4-based (replaces Runnel --s-*, Hedgerow's 40/56 steps) */
  --sp-0:2px; --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px; --sp-7:48px; --sp-8:64px; --sp-9:96px;
  --safe-t:env(safe-area-inset-top); --safe-r:env(safe-area-inset-right); --safe-b:env(safe-area-inset-bottom); --safe-l:env(safe-area-inset-left);
  --gutter:max(var(--sp-4), var(--safe-l), var(--safe-r));
  --r-pill:999px;
  /* motion: one vocabulary, games may retune durations (Runnel slower, CATHODE same) */
  --ease-out:cubic-bezier(.16,1,.3,1); --ease-in:cubic-bezier(.7,0,.84,0);
  --ease-io:cubic-bezier(.65,0,.35,1); --ease-back:cubic-bezier(.34,1.56,.64,1);
  --spring:var(--ease-back);
  --dur-press:50ms; --dur-1:120ms; --dur-2:200ms; --dur-3:320ms; --dur-4:480ms; --dur-hero:900ms; --stagger:45ms;
  /* font role tokens: every game defines all four */
  --font-display:serif; --font-ui:system-ui,sans-serif; --font-num:var(--font-ui); --font-voice:var(--font-display);
  /* focus: games set colour; must be ≥3:1 against adjacent colours */
  --focus:#1F5F99; --focus-halo:transparent; --focus-w:3px;
  font-synthesis:none;           /* kills every faux bold/italic, portfolio-wide */
}
@supports (transition-timing-function: linear(0,1)) { :root { --spring: linear(0,.009,.035 2.1%,.141,.281 6.7%,.723 12.9%,.938 16.7%,1.017,1.077,1.121 24%,1.149 26.8%,1.159,1.154 31.7%,1.106 37.6%,1.031 46.5%,1.003 51.3%,.986 56.8%,.991 69.4%,1 100%); } }
.num,[data-num]{ font-family:var(--font-num); font-variant-numeric:tabular-nums lining-nums; font-feature-settings:"tnum" 1,"lnum" 1; }
```

**Fix to every spec:** `--spring` is declared only under `@supports`. The CATHODE, landing and Cathnivore specs declared `linear()` unconditionally, so iOS before 17.2 would drop the whole transition.

`font-synthesis: none` is portfolio-wide: a missing weight or style now shows as the regular cut instead of a smeared fake. The lint test catches the cause.

Legacy aliases per game (`--ease-settle`, `--ease-pop`, `--dur-quick`, `--dur-base`, `--dur-slow`, `--dur-moment`, CATHODE `--display` and `--ui`, CATHODE `--f-*`) map onto these names. Rename CATHODE's `--f-display`, `--f-ui` and `--f-mono` to `--font-display`, `--font-ui` and `--font-num`, so every game uses one vocabulary with different values.

## Typography conventions (rewrite STYLE §4 to these)

- **Size floors:** nothing a player must read is under 14 px. Running text is at least 16 px. 12 px is allowed only for uppercase labels of four words or fewer, at weight 700 or more, that duplicate an icon or a value.
- **Units:** sizes in rem through tokens, with `clamp()` between 390 and 1440. No new px font sizes (enforced by the lint ratchet).
- **Casing:** sentence case for headings and running text. Verb Title Case for Cathnivore action buttons (STYLE §12). Tracked caps (+0.12 to +0.18em) only for labels. A display face is never set in caps, except a wordmark or a stamp.
- **Wrapping:** `text-wrap: balance` on headings and `text-wrap: pretty` on body. Multi-line text is left-aligned: centre only one-line headings, numerals and buttons.
- **Numerals:** every counted number is `.num` (or comes from a figures face composed through `unicode-range`) and is tabular. There is no slashed zero anywhere.
- **Cath's voice:** always a distinct real face, never a faux italic. Cathnivore uses Fraunces italic; Runnel uses Atkinson Next italic; Hedgerow uses Fraunces WONK roman; CATHODE uses Bodoni italic at 20 px or more on a solid backing; the landing uses Instrument Serif italic.

## Focus grammar (`base.css`)

```css
:where(a,button,[role="tab"],[tabindex],input,select,summary):focus-visible{ outline:var(--focus-w) solid var(--focus); outline-offset:3px; box-shadow:0 0 0 calc(var(--focus-w) + 4px) var(--focus-halo); }
:where(button,a):focus:not(:focus-visible){ outline:none; }
```

- Games set `--focus` and `--focus-halo`.
- An element with `clip-path` (CATHODE frames and buttons, the landing CATHODE banner) draws focus as a `drop-shadow` halo on itself or on a wrapper, because a clip path clips outlines.
- A focus ring is never removed and never below 3:1 against its neighbours.
- The `:not(:focus-visible)` rule fixes the black ring Hedgerow's "Try again" button gets on autofocus.

## Motion conventions (`base.css` + `motion.ts`)

- **Curves:** entrances use `--ease-out`. Exits use `--ease-in` at about 65% of the entrance duration. Rewards and press releases use `--spring`. Corporations never overshoot: Cathnivore's `--ease-corp` and Hedgerow's Hollowell elements.
- **What may animate:** only `transform`, `opacity`, `clip-path` and registered custom properties. `filter` may animate only on short-lived elements and never over WebGL every frame.
- **Stagger:** `.stagger > *{animation:rise var(--dur-3) var(--ease-out) both; animation-delay:calc(min(var(--i,0),10) * var(--stagger) + 60ms)}`. Set `--i` with `setProperty` only.
- **Reduced motion is a designed state**, not a blanket switch-off:
  - Each game keeps its own block, keyed on `@media (prefers-reduced-motion: reduce)` and on `:root.reduce-motion`.
  - Cathnivore's existing `html.no-animations` also sets `reduce-motion`.
  - CATHODE gets a Settings toggle that sets the class.
  - Fades of at most 200 ms remain. Shakes, wipes, bursts, flips, bobs, breathing, glints and count-ups are off: count-ups jump to the final value.
  - Haptics and sound still fire, because they are not motion.
  - Hedgerow keeps targeted overrides rather than `* { animation: none }`, because some of its fades carry state.

## Cath's presentation (`cath-frame.css`; `shared/cath/cath.ts` and `cath.css` are untouched)

- Cath is always mounted in a wrapper (`.cath-frame`, with `isolation: isolate`). Treatments go on the wrapper only:
  - `drop-shadow` anywhere;
  - in CATHODE only, a mild grade (`brightness ≥ .88`, `contrast ≤ 1.08`, `saturate ≥ .82`) and coloured rim drop-shadows.
- **Never:** hue-rotate, blend modes, glitch or chromatic offset, blur, a silhouette, grain above 0.05 over her face, text over her face, or a crop through her face. `.cath-frame svg{filter:none!important; mix-blend-mode:normal!important}` guards against inherited filters.
- **Fix to the landing spec:** the CATHODE row's "black silhouette with neon rim" is **cut**, because Cath is the face of every game. The row shows the trench Cath with the CATHODE rim-light grade instead.
- **Outfits per game:**
  - Cathnivore: field, plus market for scenes.
  - Runnel: field.
  - Hedgerow: as cast today.
  - CATHODE: **always `trench`**. Change `ui/character.ts:254` and `ui/levelup.ts:32` from `gown`.
- **Sizes:** 32, 48, 96 and 160 px for cameos (STYLE §9); full height for heroes. Cameo frames per game are a wheat ring (Cathnivore), a gilt ring (Runnel), a brass medallion (Hedgerow), a cut-corner duotone frame (CATHODE) and a gold ring (landing).
- **Idle:** `animate: true` is passed only when motion is allowed. A breathing scale (1 to 1.012 over 3.2 s) goes on the frame, never on the SVG.

## Performance and CSP guardrails (they apply to every spec)

- **No `style=""`, ever.** Per-element values (`--i`, `--v`, `--p`, `--trail`, `--mx`, `--my`, `--ang`, `--dist`, `--tail-x`, `--who`, `--seg-i`, `--share`, `--progress`) are set through `el.style.setProperty`, or the `setVars` helper.
- **Data-URI SVG** for grain, masks and swashes is allowed by `img-src 'self' data:`. External font or style hosts are not allowed.
- **`backdrop-filter`:**
  - Allowed over static DOM or SVG only: Cathnivore's sheet scrim (3 px) and Runnel's `::backdrop` (6 px).
  - **Cut from CATHODE.** `session.ts:812` keeps calling `render()` every frame while paused, so a blur over the canvas would recomposite every frame. Pause, the character sheet and dialogs use opaque `--mat-ink` instead.
  - **Cut from the landing.** That means the cards and the sticky top bar: the top bar uses `rgb(26 17 25/.94)`.
- **Grain** is a static data-URI layer, at most about 8 elements per screen, never a fixed full-screen layer over WebGL (landing, Hedgerow, CATHODE), and never animated.
- **Over WebGL:**
  - HUD text never uses `filter` or `backdrop-filter`.
  - Bars use `transform: scaleX(var(--v))`, not width.
  - Text over a canvas sits on a material, a plate or a scrim, with a text-shadow pair.

# Per-game specs

Each game's own spec (as written by its art director) stands, apart from the changes listed here. What is below is the merged spec. It condenses the detail an engineer needs and corrects what was wrong.

## Landing (`site/`)

**Typography**
- Families: `--font-display` "Site Display" (Fraunces opsz, wght 500–720), `--font-ui` "Site UI" (Instrument Sans, 400–700), `--font-voice` "Site Voice" (Instrument Serif italic), and the `Mark *` logotype families.
- Scale:
  - mark `clamp(3.5rem, 1.6rem + 7.8vw, 9rem)`
  - d1 2 to 3.25rem
  - logo 2.125 to 2.75rem
  - voice 1.375 to 2rem
  - body-lg 1.0625 to 1.125rem
  - body 1rem
  - meta 0.875 to 0.9375rem (tabular)
  - label 0.75 to 0.8125rem, caps, +0.16em
  - button 1 to 1.0625rem
- At most three caps labels in the hero viewport.

**Tokens:** as in the landing spec: the ink-950…600 ramp, cream 50/100/300/500, gold 200…800 and gold-ink, the per-game accents, the CATHODE neon set, the gold, chrome, plate and glass materials, elevation 1–3, glows, z-layers, `@property --rim-a` and `--sheen`. Motion comes from shared `base.css`. `--focus: #ffd98a`, with an `--ink-950` gap.

**Components**
- `.btn-primary`: a gold material pill with a lip.
- `.btn-secondary`: glass.
- `.btn-icon`: 44 px.
- `.gcard` poster card: the whole card is the existing `<a href>`. It has a 4:3 key-art window (16:9 on phone), a logotype breaking the frame, copy at most 40ch, a tabular meta line, an optional progress chip and bar, a CTA row, and Cath's face chip in the game's accent ring.
  - Pointer tilt sets `--mx` and `--my` (only with `hover:hover` and no reduced motion).
  - The card has **no `backdrop-filter`**.
- Badges New, Daily and In development.
- `[data-tip]` tooltips, only for icon-only controls.
- The announcement ribbon.

**Signature elements**
1. The gold per-letter wordmark with a single staggered sheen. The h1 keeps `aria-label="Cathnivore"` and the letter spans are `aria-hidden`.
2. Cath's daily line as a `<figure>` in the voice face, replacing the Runnel tagline (fixes the muddled hierarchy).
3. The Today CTA, which reads `runnel:v1` defensively and shows Play, Finish, or Solved with the streak.
4. The CATHODE after-dark banner: a cut-corner `clip-path`, with its glow carried by a `drop-shadow` on a wrapper, 21:9 key art with scanlines, a neon logotype, a visible rating plate ("18+ · Strong violence · Gore · Language", `--cream-50` on `--cd-blood`, 6.6:1), and **the trench Cath with the rim grade, not a silhouette**.

**Motion**
- The hero timeline from the spec, 0 to 1,300 ms.
- Scroll-driven card reveals behind `@supports (animation-timeline: view())`, with an IntersectionObserver fallback.
- A neon power-on for CATHODE.
- A once-a-day dew burst on the Today button (shared `burst`, 10 drops).
- Reduced motion: fades only, no tilt, and hover still reads through rim light and shadow.

**Screen by screen**
- **Hero, 1440:**
  - 12 columns.
  - Cath on columns 1–5 at `min(82svh, 760px)`, never overlapped.
  - The text column on 6–12, left-aligned: eyebrow "Four free games starring Cath", wordmark, voice line, CTAs, meta "Free · No ads · No accounts".
  - A local radial scrim behind the text.
- **Hero, 390:** stacked in this order: eyebrow, 56 px wordmark, line, Cath at `min(46svh, 400px)`, then the CTAs pinned on a bottom scrim. The first card starts below the fold.
- **Hero, 844×390:** two columns, with the wordmark at `clamp(2.75rem, 9vh + 1rem, 4rem)`.
- **Games section:**
  - "The games" in a 3-up grid; one column on phone.
  - In landscape, a scroll-snap rail inside its own `overflow-x: auto` container. The page itself never scrolls sideways, and the rail starts at the first card so the e2e clicks stay in view.
- **After dark:** a section gradient from `--ink-900` to `--cd-ink`. No gore in the art.
- **Footer:** three columns (house mark and voice line; game links; the "Free. No ads." line, Privacy, Support, the `version.json` tag and the font credits link) on a gold hairline with grain at 0.05.
- **Sticky top bar:** optional, last, and opaque.

**Key art**
- One script, `scripts/keyart.ts`, shared with CATHODE. It drives the built games with Playwright and writes **WebP**, at 1200 and 640 wide for cards plus 1920 and 960 for the CATHODE gate.
- Size budgets: at most 110 KB per 1200-wide image, 45 KB per 640-wide, and 140 KB for the 1920 CATHODE image.
- Images use `srcset`, `width` and `height`, `loading="lazy"` and `alt=""`, with the SVG emblem as the fallback.
- LCP stays the h1 text node. CLS must be below 0.02.

## Cathnivore (`src/`)

**Typography**
- Families from the portfolio table. `--font-text: "Marrow Figures", "Marrow Text", …`.
- **Fix:** the Figures `unicode-range` is **`U+0030-0039, U+00D7, U+2212` only**. The spec also included `+ - . / %`, which would swap hyphens and full stops inside prose into Figtree. Those characters now come from Atkinson.
- Scale tokens as in the spec: `--fs-label` 12 to 12.5, caption 13 to 14, small 14 to 15, body 16 to 17, lead 17 to 20, voice 17 to 19, h3 18 to 21, h2 26 to 34, h1 36 to 60, display 56 to 132, num-hud 18 to 20, num-hero 48 to 88.
- `.game` sets `--density: compact`, which keeps small and body text at phone values on desktop, so `desktop-no-scroll` still passes at 1280×800.
- Weights:
  - wordmark `.display-xl`: opsz 144, weight 720
  - headings: 640
  - voice: italic 460
  - Agenda headlines: italic 780
  - SVG region names: opsz 24, weight 700
- `.card-hand` (Segoe Print or Comic Sans) becomes `.voice` at weight 420.
- Preload the Display normal file and the Text file through a `transformIndexHtml` Vite plugin, using hashed names and adding no inline code.

**Tokens**
- Keep every existing name. Add:
  - colours: `--paper-3`, `--newsprint`, `--kraft` (a fill only), `--wheat-ink`, `--wheat-hi`, `--seal`, `--focus #1F5F99` (dark mode `#8EC5F5`), the `--ink-a*` ramp, `--shadow-ink`, `--scrim`, the corp inks;
  - materials: `--grain-paper`, fibres, halftone, ruled, and the paper, card, ledger, news and plastic mats;
  - radii, the shared spacing scale, elevation `--e1` to `--e5`, the inset highlights, glows, and `--z-*` (which replaces the 12 literal z-indexes);
  - `--ease-corp`.
- **Fix:** the end screen's `border-image: var(--gold-ish)` was undefined. Define `--foil-wheat: linear-gradient(135deg, var(--wheat-hi), var(--wheat) 45%, var(--wheat-ink) 55%, var(--wheat-hi))`.
- Banned as text: `--wheat`, `--pasture`, `--clay`.

**Components**
- `.frame`: card stock with a double-rule title and `--ledger` and `--tray` variants. A frame is never nested inside a frame; a nested group becomes `.group`.
- Buttons with a registered `--lip` press, primary, secondary, danger, icon, quiet and large variants, and a hatched dashed disabled state.
- Folder tabs.
- The hanging price-tag tooltip, with its trigger shrunk to a 28 px italic "i" with a 44 px hit area. The dotted underlines go.
- Improvement cards with a pointer-fine tilt.
- Cath's Plan as a ruled index card.
- Agenda clippings: newsprint with a torn edge mask, a fixed small rotation and washi tape.
- `.chip`, `.chip--short`, `.badge`, `--ribbon`.
- `.stamp`. **Fix:** use a dedicated `--stamp-wear` SVG (alpha noise) as `mask-image`, not `mask-mode: luminance` on the grain.
- Segmented `.meter` (Trust, Lost Land, Rift).
- Sheets with `@starting-style`, a receipt-slip toast, and a bunting round banner. The Rift banner is plastic.
- The `.cameo` frame.
- The Market Board HUD: one frame in four cells, with an icon, a `.num` and a meter.
- Ledger chips with a count-up and a floating ±n ghost.
- Seed action pips.

**Motion**
- The spec's table.
- View Transitions in `App.tsx`, guarded, with `cath-cameo` and `wordmark` as named shared elements.
- Choreography for Liberation (1.3 s), Squeeze landing (600 ms, corporate grammar), the round banner, the end screen (2.4 s) and chapter complete.
- Use the shared `motion.ts`, not a new `src/ui/motion.ts`.

**Screen by screen**
1. **Game table:**
   - Columns `320px | 1fr | 320px`, with six frames.
   - The map sits on a tabletop vignette as the hero.
   - Market Board, then the Cath aside, then the clippings.
   - The legend row is removed (it moves to an ⓘ tooltip).
   - Actions as `.btn` rows with price chips; Market rows as mini cards.
   - The phone tab rail sits on kraft.
2. **Story scene:**
   - Full bleed with 5vh letterbox bars.
   - Speaker staging, with the non-speaker dimmed.
   - The dialogue card is `min(880px, …)` with a name tab.
   - Next is primary. "Continue" stays the accessible name and is styled as a quiet button.
   - Lines fade in; no typewriter.
3. **End screen:**
   - A full-bleed sunburst pseudo-element, which fixes the clipped square on phone.
   - Stamp, verdict, cameo and count-up stats.
   - The footer CTAs are in normal flow, which fixes the overlap and the ghost button.
4. **Setup:**
   - One frame per step.
   - A segmented mode control.
   - 5:7 producer cards with a cameo.
   - A sticky Start bar, with the scroll container padded so it covers nothing.
5. **Title:**
   - The display-xl wordmark.
   - Primary Campaign and secondary Quick Game.
   - Three icon "keys" for the other options.
   - Cath at about 46vh on phone.
6. **Campaign:**
   - A stitched path through wax-seal nodes.
   - Chapter art at full opacity.
   - The current chapter is larger.
7. **Settings, rules, credits and pass-device:** tabs, physical switches, chips in the rules text, font credits in Credits.

**e2e contracts**
- Every accessible name used in `getByRole` stays: `/^Invest/`, "Continue" and others.
- Specs to keep green: `desktop-no-scroll`, `phone-map-hero`, `plan-strip`, `disabled-actions`, `tooltip`, `accessibility` (axe), `csp`, `campaign`, `tutorial`, `chapter-resume`, `quick-game`, `hotseat`, `ai-teammate`, `title`.

## Runnel (`games/runnel/`)

**Typography**
- `--font-display` "Runnel Display", `--font-ui` "Runnel UI" (with italic), and `--font-num` "Runnel Figures".
- **Fix:** add a digits-only `unicode-range` face of Outfit as the first family in `--font-ui`, so stray digits in prose can never show Atkinson's slashed zero. `.num` spans stay for the size and weight hero styling.
- Scale, as in the spec:
  - wordmark 30 to 40, opsz 144, weight 560
  - title 28 to 34
  - head 20 to 22
  - hero-num 56 to 72, weight 300
  - hud-num 22 to 26
  - stat-num 32 to 36
  - voice 17 to 18, italic 500
  - body 16 to 17
  - button 16 at weight 680
  - small 14 to 15
  - label 12, caps
  - masthead 13 to 14, Outfit caps
- Use "No." for the puzzle number in the UI. Share text keeps "#".

**Tokens**
- Import the shared palette.
- Runnel additions:
  - colours: `--well`, `--well-hi`, `--well-lo`, `--water-hi`, `--sprout`, `--sun-ink`, `--linen`, `--pebble`, the hairlines, sky stops, `--grain`;
  - shadows: elevation `--e-1` to `--e-4`, `--inset-track`, the glows;
  - motion: `--dur-2: 240ms`, `--dur-3: 420ms`, `--dur-4: 640ms` (the calm retune).
- `data-sky` dawn, day and dusk is set from the local hour; dark mode is "night".
- Board variables are untouched.
- Rename `--s-*` to the shared `--sp-*`.

**Components**
- `.btn` with a well-gloss primary and quiet variant.
- 44 px stroke `.icon-btn`.
- A `:has()`-driven sliding `.segmented` control; `.sizes` uses `--seg-i` set through `setProperty`.
- `[data-tip]` tooltips.
- `.stone` stat stones.
- The `.channel` water progress bar with a drop head. Its fill animation runs only while the puzzle is unsolved and the tab is visible.
- Distribution bars.
- Badges for under, on and over par, and the streak chip with an SVG flame (no emoji in the UI).
- Bottom-sheet or centred `.sheet` with `@starting-style`, keeping the existing keyframe as the pre-17.5 Safari fallback.
- The in-sheet pill toast.
- The host cameo with a gilt rim and a real-italic voice card.
- The HUD ledger: time and taps, with taps read against par.
- The board diorama, with a **static** drop-shadow (never animate a filter on the board).

**Motion:** the solve choreography from the spec, built on shared `motion.ts`. The count-up is skipped under webdriver, and `#win-taps` always ends on the exact value.

**Screens, ranked**
1. **Win sheet:** cameo, masthead eyebrow, headline, two hero stones with the par badge, the streak row, the share-postcard preview, a stacked Share (primary) and Play practice, and a live countdown.
2. **Puzzle screen:**
   - masthead and date line (`#hud-title` stays in the DOM);
   - segmented control and icon buttons;
   - the HUD ledger;
   - the host row;
   - the board fills the stage, gaining about 18% at 390;
   - the water channel and its "3 of 34 fields watered" line;
   - the **844×390 two-column layout**.
3. **How to play:** step cards, icon rule rows, a full-width Start.
4. **Stats:** stones, the Drops distribution, a hex calendar.
5. **Night and sky polish.**

**Contract ids:** `hud-title`, `hud-time`, `hud-taps`, `hud-par`, `progress-fill`, `win-time`, `win-taps`, `win-par`, `btn-share`, `btn-next`, `toast`, and `.board.won`.

## Hedgerow (`games/hedgerow/`)

**Typography**
- Families and sizes from the Hedgerow spec. Variation settings:
  - hero: weight 780, SOFT 100
  - d1: weight 740
  - d2: weight 690
  - d3: weight 650
  - voice: weight 430, SOFT 100, **WONK 1**, opsz 18 (this replaces italic)
- Numbers:
  - body: Nunito 560
  - small: 600
  - label: 850, caps
  - num-l: 950
  - num-xl: 1000
  - button: 880
- `.t-num-ink` gives BTD6-style outlined numerals, using `paint-order` with a thinner-stroke fallback.
- Fraunces figures only for numbers that never tick; every live counter is Nunito.
- No emoji (STYLE §12): 📖 ☀ ◆ ★ 🔒 become `icons.ts` SVGs.
- Strings asserted by tests stay exact: `1/12`, `Go`, `Next +N`, `x1`/`x3`, `2-0-0`, `Sell +140`.

**Tokens**
- Import the shared palette.
- Hedgerow additions:
  - colours: `--paper-hi`, `--card`, `--kraft`, `--paper-shade`, ink-2 and ink-3, the oak ramp, the brass ramp, `--harvest #9A4F12` (fixes the Next button's 4.24:1), `--goodwill`, `--marks`, `--cath`, `--path-0/1/2` with soft variants, the corp/plastic enemy set, scrims;
  - materials: grain, woodgrain, paper, oak, brass, kraft, plastic;
  - radii, shadows `--sh-0` to `--sh-3`, bevel, groove, the glows, `--z-*`.
- Map Hedgerow's `--sp-7 40` and `--sp-8 56` onto the shared scale (48 and 64), or `calc()` where an exact size matters.
- The dark "Evening at the fête" theme stays scoped to the last milestone, since `color-scheme: dark` already exists.

**Components**
- The noticeboard `.sheet`: paper inside an oak frame with four brass pins; a bottom sheet with a top oak edge on phone.
- An oak plank for `.hud` and `.controls`.
- Paper notes.
- `.advert`, Hollowell plastic with no ink outline.
- `.btn` with an ink lip and states.
- `.icon-btn`: a brass-rimmed oak disc.
- Kraft bookmark tabs with `role="tab"` and arrow keys.
- A paper-tag tooltip with `--tail-x`.
- Seed-packet `.packet`s.
- `.bar` with `--p`. The boss bar is the Hollowell share price.
- Luggage `.tag`s.
- The brass `.build-chip` dog-tag.
- Dots, ribbon banners (round, leak, boss billboard).
- Brass-coin counters (`.chip`) with count-up, gain and hurt states.
- The ticket-stub round card.
- The Go/Next/speed pill, at most 56 px tall in landscape.
- Ability medallions with a conic cooldown `--p` ring.
- The Keep Going lever.
- **Fix:** the rosette uses a scalloped SVG data-URI mask; the spec left the composite unfinished. Stars use `--i`.

**Motion**
- The Hedgerow motion table: press, sheet in and out, banners, toast and advert, stagger, counter tick, upgrade bought (6 beats), level win (7 beats), loss receipt in steps(14).
- Infinite animation only on the Go breathe, and only between rounds.
- Reduced motion uses targeted overrides at the end of `components.css`.

**Screens, ranked**
1. **Field with a tower selected:**
   - The HUD plank and counters, the advert toast, the Cath note, one oak tray.
   - The 3-path upgrade sheet: seed packets, a ladder showing only the next rung's name (no truncation), "Ready" shown as a glow instead of 9 px text, an ETA bar, a stat grid with deltas, `<details>` on phone, and container queries.
   - Phone sheet capped at 48svh. Landscape: docked at 340 px.
2. **Story:** full-bleed staging with speaker emphasis, a paper caption panel, a colour nameplate (brass for Cath), Skip moved to the scene's top right, a landscape dock to the right 46%, and a typing caret.
3. **End screen:** the win rosette, the medallion, stamped stars, the stats strip and the CTA hierarchy. The loss screen is the Hollowell delivery receipt.
4. **HUD on phone:** a single 56 px plank with the "⋯" pause card.
5. **Level map:** meadow board act cards and ribbons; medallion nodes (cleared, next, locked with an SVG padlock, boss in plastic); a stitched trail; the "Start here" tag above the node; SVG icons in the top bar; the landscape fix.
6. **Almanac:** the notebook spread on desktop, expand-in-place on phone, the "3D" pills removed, no grayscale.
7. **Cath sheet, Seed Bank, duel and replay** to the same kit.

**Contracts**
- Every id and class in the Hedgerow spec's selector list.
- `e2e-site/site.spec.ts` Hedgerow tests: the 844×390 pill test, three paths side by side, buy every path, replay, Cath sheet, Seed Bank, `noSideways`.

**Verification:** `shots:hedgerow` (in `?2d&sandbox=1`), plus one 1440 shot in 3D with the swiftshader flags to check legibility over the scene.

## CATHODE (`games/cathode/`)

**Typography**
- Families from the portfolio table, with `--font-display` and `--font-voice` set to Bodoni.
- Scale from the CATHODE spec:
  - wordmark: Bodoni 500 at opsz 96 with +0.28em tracking, the only caps Bodoni
  - display l, m, s: Bodoni 600 or 700, Title Case
  - voice: Bodoni italic, at least 20 px, always on a solid plate
  - head and label: Rajdhani 700, caps
  - body-l and body: Rajdhani 500, sentence case
  - micro: 12 px, 700, caps
  - data: JetBrains Mono 500
  - num-l: Mono 700
  - num-hero and num-ammo: see the decision below
- Everything switches at `(min-width: 1024px) and (min-height: 600px)`, with short-landscape overrides at `max-height: 430px`.
- **Decision (replaces "verify, then hack"):** milestone 1 measures Rajdhani's `0` and `1` advance widths in the browser.
  - If they are equal, hero numerals are Rajdhani 700 with `tabular-nums`.
  - If not, hero numerals are **JetBrains Mono 700 at −0.04em**. No `min-width` hacks.
- Glyphs missing from the latin subsets (✕ ◆ ▲ ▼) are drawn as CSS or SVG, or replaced with `×` and `·`.
- Bodoni sits over the 3D view only at 28 px or more, and only with a plate.
- A 600 ms `document.fonts.load` race before the gate reveal.

**Tokens:** the CATHODE spec's `tokens.css`, kept as written:
- night, panel, plate, line and ink ramps;
- the job colours (`--blood` is a fill only; `--blood-hot` is for text);
- the class accents and the colour-safe overrides;
- materials, cut sizes and the tick;
- elevation, glows and `--hud-shadow`;
- spacing (now from shared); the z-layers (`--z-world` … `--z-gate`), which replace the 27 raw values;
- type tokens.

Motion comes from shared `base.css`. Migrate `--accent-rgb` from the comma form to `--accent-sp` in the space form.

**Components**
- `.c-frame`: a cut-corner rim, a fill with grain and scanlines, and bracket ticks. Lift through `filter` on static screens only. `corner-shape: bevel` where supported.
- Buttons: a ticket-stub cut, a light sweep on hover, a cyan drop-shadow focus halo, and hatched disabled.
- `.c-key` keycaps.
- `.cx-tab`: a Persona selection slab with a cyan underline, and Q and E hints.
- `.tip`: rarity-tinted, with a bottom sheet on touch and an `rgb(from)` fallback.
- `.c-card` with the accent bar. `.cx-cell` inventory cells.
- `.c-bar`: `--v`, `--trail`, `--max`, segmented, the low pulse.
- `.c-chip` and `.c-points`.
- Modals and sheets. **Fix:** opaque `--mat-ink` with a radial scrim and **no backdrop-filter**, because the render loop keeps running while paused. The native `<dialog>` uses `@starting-style`.
- Toasts that clip in from the right (at most 4), and the banner band.
- HUD signature elements:
  - vitals: segmented HP with a damage trail, armour, XP;
  - arms: weapon name and rarity chip, mag and reserve, slots, battery;
  - the objective as a "case note" with `data-case`;
  - the diamond waypoint with an off-screen chevron;
  - subtitles: per-line plates clamped between the HUD clusters, with a speaker colour;
  - the mono kill feed;
  - crosshair and hit markers;
  - scope;
  - the boss intro;
  - the interaction prompt;
  - touch buttons.
- No `filter` or `backdrop-filter` anywhere on the HUD. Animate only `transform` and `opacity`. Safe-area padding.

**Motion:** the CATHODE spec's patterns: draw-in frames, stagger, the HUD boot (about 700 ms), the glitch accent (never on Cath), the hit punch, count-up, and a neon flicker only on the gate's "18" and the wordmark underline. Reward beats:
- level-up: 4 beats with synth cues, at most 12 shards;
- a rare-loot sheen;
- skill learned;
- a kill-cam caption in the voice face on the letterbox bar.

Reduced motion: `.reduce-motion` from a new Settings toggle (stored in `prefs.ts`, defaulting to the OS setting), plus the media query.

**Screens, ranked**
1. **HUD**, all of the above. This fixes the subtitle colliding with health on phone through `--cluster-w`.
2. **Gate:**
   - Key art from `scripts/keyart.ts` (WebP, 1920 and 960), graded with a scrim.
   - The trench Cath at full height with rim lights; behind the card on phone.
   - A danger `c-frame` card holding the Rated 18 chip, the wordmark, body text, radio cards and the buttons.
   - Two-layer gradient rain, static under reduced motion. The fake bokeh circles are deleted.
3. **Character sheet ("the dossier"):**
   - Deterministic SVG skill sigils (`ui/skillsigil.ts`, with a test for 95% or more uniqueness across the 150 skills). `monogram()` stays as the `aria-label`.
   - Node shapes and states, conic rank rings, tree headers.
   - The left rail: trench Cath, name and class, points counters, vertical tabs.
   - **Also fix K not opening the sheet at 1440×900, with an e2e.**
4. **Pause and settings:** a two-pane frame, sentence-case row labels (no stacked caps), segmented controls without amber fills, diamond-thumb sliders, a keycap binding table, internal scroll, and the Reduce motion toggle.
5. **Title:** key art cropped differently from the gate, a half-figure Cath on the right, a left copy column, a stagger menu, and the back link from shared `studioBack()`, so it can no longer overlap her.
6. **Class pick:** a centred 4/8 grid; line clamps instead of truncation; a phone chip scroller with a safe top padding; an `@property --accent` crossfade.
7. **Loading:** a pre-blurred 480 px WebP, the district name, a mono progress readout.
8. **District map:** the red-string detective board.
9. **Smaller pieces:** credits (with font credits), photomode, gunsmith dialogs, coach cards.

**Contracts**
- `#gate-yes`, `#btn-begin`, `cathode:prefs:v1`, and `window.cathode` with its `stats.frames`.
- `tests/cathode-ui-text.test.ts`, `cathode-ui-treelayout.test.ts` and `cathode-skills.test.ts`.
- The touch overlap report in `cathode-shots.mjs`: no overlaps, buttons 44 px or more.

**Collisions with gameplay work:** new rules go in `games/cathode/src/styles/{fonts,tokens,components,hud}.css`. Each slice deletes the superseded rules from `styles.css` in the same commit.

# Build milestones

Each milestone is one ROADMAP item, Phase U ("AAA UI"). The first session to pick this up logs the owner's request (2026-10-11, "fonts and CSS … next level of AAA games") in `FEEDBACK.md` and adds Phase U to `ROADMAP.md`. Schedule it alongside the owner's Phase D/H split: one Phase U milestone in place of a polish day, and sooner if the owner says so.

A milestone may take two or three sessions. Every slice must leave the game shippable. After each slice:
- run `npm run check`;
- take before and after shots;
- run the specs listed for the slice;
- commit and push to `build`.

Release (`npm run release`, at most 4 a day) only when the whole milestone passes `npm run gates`, which now includes the font budget. Kill any stale `:4173` server before trusting a shots run.

**Standard sizes:** P = 390×844, L = 844×390, D = 1440×900. Every screen is shot in light, in dark where the game has a dark mode, and with reduced motion.

### M1. Shared foundation and fonts (every page, no layout changes)

**Goal:** the type and token switch that lifts every screen at once. Every faux bold, faux italic and slashed zero is gone, and every page is under budget.

**Slices**
1. **Shared layer and kit:**
   - `shared/ui/{base.css, palette.css, motion.ts, cath-frame.css, studio.ts, studio.css}`;
   - `scripts/font-budget.ts`, wired into gates;
   - `tests/ui-css-lint.test.ts` with its baseline; `tests/ui-contrast.test.ts`; `tests/shared-ui-motion.test.ts`;
   - `e2e-site/helpers/shots.ts` and `scripts/portfolio-shots.mjs`;
   - an L project added to `e2e/screenshots.spec.ts`.
2. **Landing fonts:** `site/src/{fonts,tokens}.css`, import order shared then fonts then tokens then styles, px sizes converted to tokens.
3. **Runnel fonts:** fonts and tokens, plus `.num` spans.
4. **Hedgerow fonts:** fonts and tokens, `font-synthesis: none`, every italic removed, `--harvest` fixed.
5. **Cathnivore fonts:** `src/styles/fonts.css`, the preload plugin, `.num`, `.card-hand` replaced, the 15 `font-family` literals.
6. **CATHODE fonts:** fonts and tokens; the outfit changed to trench; the Rajdhani tnum measurement and decision; the 4 `@font-face` blocks deleted; the italics remapped.
7. **Remove the old fonts:** delete `public/fonts/` and the old `@fontsource/*` dependencies once `grep` finds no importer. Update VISION "Type" and STYLE §4, §10 and §14, add the credits entries and `/licences/fonts/`, and add the DECISIONS lines.

**Files:** `package.json` (exact versions):
- `@fontsource-variable/fraunces@5.3.0`
- `@fontsource-variable/atkinson-hyperlegible-next@5.3.0`
- `@fontsource-variable/figtree@5.3.0`
- `@fontsource-variable/outfit@5.3.0`
- `@fontsource-variable/nunito@5.3.0`
- `@fontsource-variable/instrument-sans@5.3.0`
- `@fontsource/instrument-serif`
- `@fontsource/rajdhani` (latest 5.x)
- `@fontsource-variable/bodoni-moda`
- `@fontsource-variable/jetbrains-mono`

Plus the files listed in the slices.

**Verification**
- `npm run gates` prints the font-budget table:

  | Page | Expected |
  |---|---|
  | `/` | about 155 KB |
  | `/cathnivore/` | about 167 KB |
  | `/runnel/` | about 171 KB |
  | `/hedgerow/` | about 160 KB |
  | `/cathode/` | about 171 KB |

  Every page must be at most 180 KiB, with only latin files.
- Shots of every existing screen at P, L and D before and after.
- `npm run e2e`, `npm run e2e:site`, `e2e/csp.spec.ts`, `e2e/accessibility.spec.ts`.
- A Playwright check on each page that `getComputedStyle` of a counter starts with that game's figures family, and that `document.fonts.check` passes.

**Acceptance**
- No zero renders slashed: check `Round 1/10`, Trust, Hedgerow counters and the CATHODE HUD.
- No faux italic or faux bold anywhere.
- CATHODE contains no Fraunces.
- Layout shift during the swap is not visible in the throttled shots.
- The lint baseline is committed.

### M2. CATHODE component layer and HUD

**Goal:** the screen players spend about 90% of their CATHODE time on reads as AAA.

**Slices:** CATHODE spec slices 2 and 3:
- `components.css`;
- `dom.ts` gets `stagger` and `setVars` (thin wrappers over the shared ones);
- `.reduce-motion` wiring;
- `hud.ts` moves to `--v`/`--trail` fills, the `.trail` span, `data-case`, subtitle `.line` spans, hit and low states, boot, and the off-screen waypoint chevron;
- `hud.css` with z-tokens.

**Verification**
- `shots:cathode` of the HUD (`?play&shot`) at P, L and D, plus gate and pause, to check the frame recipe on existing selectors.
- The touch overlap report.
- A Chrome performance trace on steady frames shows no "Layout" under rAF.
- `cathode.stats` frame times do not get worse.
- `npm run e2e:site` (the CATHODE block), the CATHODE unit tests, csp.

**Acceptance**
- The subtitle never overlaps the vitals at L or P.
- All HUD text is at least 12 px, on a plate or with `--hud-shadow`.
- CATHODE has 0 raw z-indexes in the lint baseline.

### M3. Hedgerow field: kit, HUD and upgrade sheet

**Goal:** the densest screen in the portfolio becomes a readable game HUD, and the battlefield shows on phone.

**Slices:** Hedgerow S2, S3, S4 and S5:
- the type pass (the px sizes ratchet below 10);
- `components.css`;
- the HUD plank, counters with count-up, Go pill, ability tray, lever, banners, the advert toast;
- the upgrade sheet with ladder, buy states, ETA, stat grid, `<details>`, 48svh, and the upgrade-bought choreography.

**Files:** `games/hedgerow/src/ui/components.css`, `styles.css`, `main.ts`, `icons.ts`.

**Verification**
- `shots:hedgerow`: field selected and the busy level 12 (via `window.hedgerow`) at P, L and D, plus the 3D shot at D.
- `npm run e2e:site`: the Hedgerow tests listed above.
- A 30 s performance trace before and after.

**Acceptance**
- No ellipsis in the panel.
- The field shows 50% or more on P.
- No text under 12 px, and prose at 14 px or more.
- Next passes AA.
- The pill test passes at L.

### M4. Cathnivore table

**Goal:** turn the "admin dashboard" into a tabletop with the map as the hero (VISION point 2).

**Slices:** Cathnivore slices 2, 3 and 4:
- materials and `.frame`, z-tokens;
- buttons, chips, tooltips, tabs;
- the table recomposition: Market Board, meters, Cath aside, clippings, legend removed, action and market rows, tab rail.

**Verification**
- `npm run shots`: game at P, L and D, light and dark.
- `desktop-no-scroll`, `phone-map-hero`, `plan-strip`, `disabled-actions`, `tooltip`, `accessibility`, csp.

**Acceptance**
- 6 frames, with no frame inside a frame.
- No dotted underlines.
- The map is larger at D than before.
- No scroll at 1280×800.
- axe is clean.

### M5. Landing hero, poster cards and key art

**Goal:** a front door worthy of the games.

**Slices:** landing S2 and S3:
- `scripts/site-wordmarks.ts` (devDependency `subset-font`; game-matched marks; RFN check) with the committed `site/public/marks/*`;
- the hero recomposition;
- `scripts/keyart.ts`, writing WebP for all four games plus the CATHODE gate sizes, each reviewed by eye;
- `.gcard` cards, `tilt.ts`.

**Verification**
- `shots:portfolio` of `/` at P, L and D, with reduced motion and with no WebGL.
- `npm run e2e:site`: h1 name, four anchors clickable, reduced motion, no sideways scroll, axe.
- Lighthouse mobile: LCP is the h1 text, CLS below 0.02.

**Acceptance**
- No card overlaps Cath at any size.
- Each card's logotype matches its game's title.
- No backdrop-filter on the page.
- The key art is within budget.

### M6. Runnel puzzle and win sheet

**Goal:** the daily ritual and its payoff.

**Slices:** Runnel slices 2, 3 and 4:
- components;
- the puzzle screen with masthead, ledger, host, stage, channel, sky and the L layout;
- the win sheet and choreography through shared `motion.ts`.

**Verification**
- `shots:portfolio`: `/runnel/`, `?nohelp`, solved state, at P, L and D in light, dark and reduced motion.
- `npm run e2e:site`: the Runnel block, especially that `#win-taps` equals par.

**Acceptance**
- The board grows 15% or more at P.
- L is two columns.
- The voice is a real italic.
- No emoji in the UI.

### M7. Cathnivore story scene and end screen

**Goal:** fix the two weakest Cathnivore screens (audit #1 and the runner-up).

**Slices:** Cathnivore slices 6 and 7, plus the Liberation and Squeeze choreography from slice 5.

**Verification**
- `npm run shots` (story and end at P, L and D).
- `campaign`, `tutorial`, `chapter-resume`, `quick-game`, `accessibility`.

**Acceptance**
- The story is full bleed with staging.
- The end screen has no overlap and no ghost button, and its sunburst is unclipped at P.
- Reduced motion shows the final state at once.

### M8. CATHODE front door: gate, title and class pick

**Slices:** CATHODE slices 6 and 7, reusing the M5 key art.

**Verification**
- `shots:cathode`: gate (fresh storage), title and class pick at P, L and D, plus reduced motion.
- The e2e-site CATHODE flow (`#gate-yes`, `#btn-begin`).

**Acceptance**
- Cath is visible and rim-lit on the gate and the title, never hidden by the card.
- No pastel gown anywhere.
- The class name is not clipped at P.
- The back link never overlaps Cath.

### M9. CATHODE dossier and pause

**Slices:** CATHODE slices 4 and 5: the pause and settings rebuild with the Reduce motion toggle; skill sigils; the sheet; the K-at-1440 fix.

**Verification**
- `shots:cathode`: pause and character sheet at P, L and D.
- New e2e: K opens the sheet at D.
- `cathode-ui-sigil`, `cathode-ui-treelayout` and `cathode-ui-text` tests.

**Acceptance**
- No caps label wraps.
- The page never scrolls; content scrolls inside the panes.
- No two-letter nodes visible.
- No backdrop-filter.

### M10. Hedgerow map, story and end screen

**Slices:** Hedgerow S6, S7 and S8.

**Verification**
- `shots:hedgerow`: map, story, end win and end loss at P, L and D, plus reduced motion.
- The story e2e (`#story-next`, `#story-full`).

**Acceptance**
- No emoji.
- "Start here" never collides with a node.
- The story is never cut off at L.
- The stars stamp, and show statically under reduced motion.

### M11. Cathnivore setup, title, campaign, settings and motion

**Slices:** Cathnivore slices 5 (View Transitions, `@starting-style` sheets), 8, 9 and 10.

**Verification**
- `npm run shots`: all screens at P, L and D, light and dark.
- `title`, `campaign`, `quick-game`, `hotseat`, `ai-teammate`, `accessibility`.

**Acceptance**
- Start covers nothing at P or D.
- The campaign has a stitched path with legible locked titles.
- Cath's cameo travels between screens when motion is allowed.

### M12. CATHODE rewards and world screens

**Slices:** CATHODE slice 8: loading, the district map, the four-beat level-up, the loot sheen, the boss intro, the kill-cam caption.

**Verification:** `shots:cathode` level-up (through the UI lab) at P, L and D; the touch report; a performance trace during the level-up (at most 12 animated nodes).

**Acceptance:** every reward plays in beats with sound, and under reduced motion it keeps the band and the number without shards or shake.

### M13. Remaining screens across the portfolio

**Slices**
- Landing S4 to S6: after dark, progress, footer, opaque top bar.
- Runnel slices 5 and 6: how-to and stats.
- Hedgerow S9 and S10: the Almanac, the Cath sheet, Seed Bank, duel, replay, the pause card, the evening theme.

**Verification:** each game's shots plus `npm run e2e:site` in full.

**Acceptance:** no audit screen is left untouched.

### M14. Portfolio polish audit

**Goal:** a sweep across every page:
- `contrastWalk` on every static screen;
- a reduced-motion pass;
- dark modes;
- raw hex and rgba below 20 per game outside token files;
- the lint ratchet at 0 for px font sizes and z-indexes in every migrated file;
- a fresh `font-budget` table;
- a subagent critique of the shots against VISION.md.

**Acceptance:** `npm run gates` is green, and the before and after shot sets are archived in the PROGRESS session log (names only).

# Risks and guardrails

- **CSP.**
  - No `style=""` and no `el.style.x =`: the lint test enforces this.
  - Dynamic values go only through `setProperty`.
  - Fonts, key art and marks are same-origin hashed or public files. Data-URI SVGs are used only inside CSS.
  - The preload `<link>`s are generated at build time, so no inline script is added.
  - `e2e/csp.spec.ts` and the shots helper's console guard run on every milestone.
- **Font payload.**
  - Hand-written `@font-face` rules point at latin files only. Never import a package's `index.css`, `full.css`, `wght.css` or `opsz.css`.
  - `font-budget.ts` fails the gate above 180 KiB per page or on any non-latin file.
  - Fontsource versions are pinned exactly. A version bump re-runs the budget.
  - Per-game Vite builds don't share a cache across pages, so each page is budgeted on its own.
- **Font licences.** All faces are OFL-1.1, and `subset-font` is BSD-3. The OFL texts ship at `/licences/fonts/`, and every page's credits list the faces. Check for a Reserved Font Name before cutting the marks.
- **Legibility.**
  - The 14/16/12 floors.
  - `font-synthesis: none`.
  - Figures faces end the slashed zero, and a counter check in M1 proves it.
  - Rajdhani stays at weight 500 or more and 12 px or more. If the P shots look thin, raise `--t-body` to 1.0625rem; don't change the face.
  - Bodoni goes over the 3D view only at 28 px or more with a plate.
  - Text never sits on bare key art, the 3D scene or busy texture.
  - Grain is at most 0.07 opacity, and at most 0.05 under body text.
- **iPhone performance.**
  - No `backdrop-filter` over WebGL: CATHODE renders while paused, as verified at `session.ts:812`.
  - No full-screen grain or blend layers over a canvas.
  - HUD bars use `transform`.
  - No animated `filter` on the Runnel board or the CATHODE HUD.
  - Bursts are at most 12 nodes and remove themselves.
  - Infinite animations run only between rounds or while idle (the Go breathe, the channel flow) and stop when the tab is hidden.
  - Pointer tilt only on `hover:hover`.
  - Images are lazy below the fold. The landing hero never waits on an image.
- **Browser support.**
  - `--spring` sits behind `@supports` (iOS before 17.2 gets `--ease-back`).
  - `@starting-style` (iOS 17.5+) degrades to an instant show, and the existing keyframes stay where they are already relied on.
  - `@property` (16.4+) degrades to a static sheen or lip.
  - `paint-order` (17.4+) falls back to a thinner stroke.
  - `corner-shape`, `text-box`, `sibling-index` and View Transitions are progressive enhancement only.
  - `rgb(from)` has an `@supports` fallback.
  - Keep the `-webkit-` prefixes for mask, `box-decoration-break`, `line-clamp` and `background-clip: text`.
- **Tests and contracts.**
  - Never change a string, id or accessible name that an e2e asserts. The lists are in each per-game spec above.
  - Count-ups skip under webdriver and always end on the exact value.
  - Cath's look is not touched: `shared/cath/*` is unchanged, the `cath-frame` guards apply, and Cath is checked in every before and after shot set.
- **Merge collisions with the hourly sessions.**
  - New rules go in new per-game files (`fonts.css`, `tokens.css`, `components.css`, and `hud.css` for CATHODE).
  - Each slice deletes superseded rules from the old `styles.css` in the same commit, so the old files mostly shrink.
  - Gameplay slices keep adding to the old files until a milestone touches that area.
- **Scope.** Cut scope before stability. Any milestone can stop after its first slice and ship. Big recompositions (Cathnivore story, CATHODE dossier, Hedgerow upgrade sheet) are done screen by screen, so `build` is never half-redesigned.
- **Documentation drift.**
  - M1 updates VISION "Type", STYLE §4, §10 and §14, and DECISIONS: three or four faces per game; Nunito for Hedgerow; Bodoni, Rajdhani and JetBrains Mono for CATHODE; painted top-light on player materials; elevation tokens.
  - Later sessions must not "fix" these back.
  - Add a CLAUDE.md note covering: `scripts/keyart.ts` regenerates key art, `scripts/site-wordmarks.ts` regenerates the marks, and `font-budget.ts` is part of gates.