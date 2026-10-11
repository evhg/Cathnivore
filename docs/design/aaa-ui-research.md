# AAA UI: research and audit (2026-10-11)

## A. AAA game UI craft
## Making the games' UI feel AAA: research and technique catalogue

### 0. What I found in the codebase (read-only survey)

- **Fonts:** every game imports only static `@fontsource/fraunces` (600, 700, 700-italic) and `@fontsource/atkinson-hyperlegible` (400, 700). Fraunces is a variable font with `opsz` 9–144, `wght` 100–900, `SOFT` 0–100 and `WONK` 0–1. Because the static cuts are used, those axes, which carry most of the font's character, are never used. Atkinson Hyperlegible also has a newer variable successor, `atkinson-hyperlegible-next` (`wght` 200–800, italic).
- **Existing techniques:** `tabular-nums` (23 uses), `linear()` easing (21 uses), `feTurbulence` (2 uses) and `paint-order` (1 use) are already in place. Missing: container queries, variable-axis use, small caps or tracking rules, stroked or gradient display text, layered frame systems, and `@property`-animated gradients.
- **CSP:** `img-src 'self' data:` means SVG noise and frame data URIs inside CSS are allowed. `style-src 'self'` means per-element values such as stagger indices must be set with `el.style.setProperty('--i', n)`, never with `style=""`.
- Total CSS is about 11,200 lines across `games/*/src/styles.css`, `src/styles/*.css` and `site/src/styles.css`.

---

### 1. Research: how top-tier games make UI feel premium

A caveat on sources first. Most studios never publish their UI font credits. Identifications from font blogs (madegooddesigns, etc.) are marked *unverified* below. Fonts In Use, Wikipedia and studio postings or talks are the stronger sources.

| Game | Typography | Panels and frames | Colour and material | Motion and feedback |
|---|---|---|---|---|
| **Hades / Hades II** (Supergiant; AD Jen Zee) | Custom lettering. The usual close substitutes are Cinzel and Cormorant (unverified). Engraved roman capitals for titles, a clean serif or sans for body text. | Ornamental bronze and gold borders, painterly portraits that break out of the frame, boon cards with a coloured "god" header band. | Deep oxblood and black, with metallic gold as a *material* (light-to-dark gradient plus a highlight line), not as a flat colour. Each god has its own hue. | Hand-animated illustrated menu transitions and background loops (the Hades II UI Animator posting). Boon pick-ups use a radial flash and a hold. |
| **Persona 5** (Atlus) | A mix of sans, slab and serif at extreme scale contrast, upper and lower case mixed like ransom notes. Black-and-white text was chosen to sit on the crimson theme. | Jagged, skewed polygons; nothing sits orthogonal. Text sits on rotated black or white slabs. | Red, black and white only, with one off-palette accent (blue) for the selection. | The hovered item grows and gains colour. Fast skew-in, hold, skew-out. Producer Katsura Hashino says Atlus gives UI to senior designers because "the interface itself is part of the game". Tactica moved to Constructivist geometry for readability. |
| **Cyberpunk 2077** (CDPR) | Rajdhani (Regular to Bold) for most of the UI and Orbitron for secondary text (Fonts In Use). Uppercase, wide tracking, technical numerals. | Thin 1px hairline frames, cut corners, bracketed corner ticks, scanline data panels. The same UI framework drives the in-world billboards (GDC). | Muted red and cyan on near-black. Menus use a warm off-white instead of pure white for a retro feel. Glitch and chromatic offset. | Glitch reboots, typing-on text, panels drawing their borders in. |
| **Hearthstone** (Blizzard) | Belwe (Wikipedia) for card names and UI: a warm, chunky display serif. | A physical box: wood, stone, brass hinges, a board you can poke. GDC 2015 talk "How to Create an Immersive User Interface" (Derek Sakamoto). Because there is no world, "the interface is the whole game". Tavern Brawl used chalkboard and cork textures to signal rule changes. | Bevelled 3D materials, warm candlelight gradients. | Cards lift and tilt toward the cursor. Heavy squash on play, screen shake on big impacts, a long anticipation on legendary reveals. |
| **Marvel Snap** (Second Dinner; Ben Brode, GDC 2023) | Bold condensed comic display caps. | Card frames that *break*: art pops out of the frame at higher variants. Location tiles. | Comic halftone, foil and prismatic shaders as reward materials. | The reveal is staged: flip, a pause, then the power number counts up with a punch scale. Snapping doubles the stakes with a big full-screen beat. |
| **Disco Elysium** (ZA/UM) | Book-like serif dialogue in a tall right-hand column (no official credit). Skill names in caps with colour coding. | An almost frameless parchment column; the UI reads as a novel. | Desaturated oil-painting palette. Each skill colour group (Intellect, Psyche, Physique, Motorics) is a strong hue. | A swipe-in and typewriter sound on new text. Check results animate a dice line. Accessibility: added OpenDyslexic. |
| **Death Stranding** (Kojima Productions) | Reportedly SST plus custom faces (BO CD Mono, EX PS Neon; not official). A mono for numbers. | Long hairline rules, dense info rows, logistics "spreadsheet" aesthetic. | Soft blue on dark, low saturation. | Minimal animation. Criticised for density; a font-size option was added after launch. **Lesson:** premium is not the same as dense. |
| **Destiny 2** (Bungie) | A clean, slightly squared sans (no official credit). Huge display numerals for Power. | Glass panels, generous negative space, thin dividers. | Translucent dark glass, rarity colours (exotic gold, legendary purple) used as *edge light*. | The "engram decode" reward: hold, glow ramp, burst, item flies to its slot. |
| **Slay the Spire** | Custom logo; slab-ish UI (unverified). | Parchment and stone. Cards with a cost gem and a banner. | Muted, with high-contrast energy orbs. | Cards fan out and lift on hover. Damage numbers pop. |
| **Balatro** | m6x11 pixel font by Daniel Linssen (modder reports). | Rounded chunky pills with 2–3px hard drop shadows. | A CRT and wobble shader, reportedly below the UI so text stays crisp. | Everything jiggles: score counters tick up with punch scale, cards wobble on hover. A masterclass in juice. |
| **Bloons TD 6** | Luckiest Guy for headers and labels (Bloons wiki; Apache-2.0). | Thick dark outlines around everything, glossy rounded buttons. | Saturated, with a top-gloss highlight and a bottom bevel. | Bouncy pop-in buttons, cash counters, upgrade chimes. |
| **Clash Royale** | Supercell-Magic, a heavy rounded display face with a thick stroke and drop shadow (community identification). | Chunky bevelled panels, banner ribbons, wood and gold. | Strong top-light gradients, inner highlight, 2–4px dark outline. | Chest opening: anticipation shake, burst, items one by one with count-up. |
| **Overwatch 2** | Big Noodle Too (custom extension of Big Noodle Titling); Futura-like body (blogs). Italic condensed caps for energy. | Skewed parallelogram tabs and buttons. | Bright white and orange with a clean, sporty look. | Skewed wipes, heavy ease-out, play-of-the-game title cards. |
| **Monument Valley** | Minimal, airy, lightly tracked text. Colour does most of the work. | Almost no chrome. | Pastel gradients, soft geometry. | Slow, eased, meditative motion. A template for a calm puzzle. |
| **Alto's Odyssey** | Sparse, lightly tracked sans (no source found). | Chrome-free overlays. | Time-of-day gradient skies drive the whole palette. | Slow fades; zen mode. |

**Game UI Database** ([gameuidatabase.com](https://www.gameuidatabase.com), by Edd Coates; 55,000+ screenshots, filterable by screen type, texture, pattern, HUD element and colour) is the best place to pull reference screens for each game before restyling it.

#### The common patterns

1. **Two or three faces with jobs.** A characterful display face (often custom or condensed), a neutral UI face, and a mono or tabular face for numbers. Contrast in scale is extreme: hero numbers 3–6x the body size.
2. **Caps plus tracking for labels.** Small labels are uppercase with +0.08 to +0.2em tracking. Display caps are tracked tighter (−0.01 to −0.03em).
3. **Frames are layered:** an outer dark outline, a coloured or metallic rim, an inner highlight line, a fill with gradient and texture, and an inset shadow. A flat `border: 1px solid` is what reads as rudimentary.
4. **Materials, not colours:** gold, glass, paper and neon are each a recipe of gradient, highlight, texture and glow.
5. **One accent for selection.** Persona's blue, Destiny's rarity edges.
6. **Motion has anticipation, overshoot and a hold.** Rewards are staged in beats: anticipation, burst, count-up, settle.
7. **Every press is physical.** It goes down (translate and shadow shrink) and then springs back.
8. **Legibility over the 3D view** comes from scrims, stroke and shadow, never from bare text.

---

### 2. Technique catalogue (plain CSS and DOM)

Feel tags: **N** = noir cyberpunk (CATHODE), **C** = cosy countryside (Hedgerow), **S** = stylish board game (Cathnivore), **P** = calm puzzle (Runnel), **L** = landing page.

#### Typography

**T1. Use the variable axes (opsz, SOFT, WONK, wdth).** Feel: S, C, L.
```css
@import "@fontsource-variable/fraunces/full.css"; /* includes opsz/SOFT/WONK */
.display { font-family: "Fraunces Variable"; font-optical-sizing: auto;
  font-variation-settings: "SOFT" 100, "WONK" 1; font-weight: 640; }
.h-cosy { font-variation-settings: "SOFT" 100, "WONK" 0; }   /* rounder, friendlier */
.h-chic { font-variation-settings: "SOFT" 0, "WONK" 1; }     /* sharper, fashion */
```
Animate `wght` on hover (`transition: font-variation-settings .2s`) for a premium "swell".

**T2. Hero and tabular numerals.** Feel: all.
```css
.num { font-variant-numeric: tabular-nums lining-nums slashed-zero;
  font-feature-settings: "tnum" 1, "lnum" 1, "zero" 1; letter-spacing: -0.02em; }
.hero-num { font-size: clamp(2.5rem, 9vw, 5rem); line-height: .85; font-weight: 800; }
.hero-num .unit { font-size: .38em; vertical-align: .9em; letter-spacing: .1em; text-transform: uppercase; }
```

**T3. Tracking rules (a typographic scale with built-in tracking).**
```css
:root { --track-label: .14em; --track-caps: .06em; --track-display: -.025em; }
.label { font-size: .72rem; text-transform: uppercase; letter-spacing: var(--track-label);
  font-weight: 700; font-feature-settings: "case" 1, "cpsp" 1; }
.smallcaps { font-variant-caps: all-small-caps; letter-spacing: .08em; } /* falls back gracefully */
h1 { letter-spacing: var(--track-display); text-wrap: balance; }
p { text-wrap: pretty; hanging-punctuation: first; }
```

**T4. Stroked display text (Clash or Bloons outline style).** Feel: C, S.
```css
.title { color: #fff6df; -webkit-text-stroke: .12em #3a2410; paint-order: stroke fill;
  text-shadow: 0 .08em 0 #3a2410, 0 .14em .2em rgb(0 0 0 / .35); }
```
`paint-order` on HTML text has been Baseline since March 2024. Without it the stroke eats the glyph, so keep the stroke at 0.06em or less as a fallback.

**T5. Gradient or metallic text (Hades gold, Destiny exotic).** Feel: S, N, L.
```css
.gold { background: linear-gradient(180deg,#fff3c4 0%,#f2c94c 42%,#a8741a 55%,#ffe39a 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 2px 0 #4a2a06) drop-shadow(0 6px 10px rgb(0 0 0 / .4)); }
/* use filter:drop-shadow, not text-shadow: text-shadow paints over clipped text */
```
Shimmer: `@property --sheen { syntax:'<percentage>'; inherits:false; initial-value:-30% }`, then add a second `linear-gradient(105deg, transparent calc(var(--sheen) - 10%), #fff8 var(--sheen), transparent calc(var(--sheen)+10%))` layer and animate `--sheen`.

**T6. Neon text that stays legible.** Feel: N.
```css
.neon { color: #fdf6ff; text-shadow: 0 0 .04em #fff, 0 0 .2em var(--neon), 0 0 .6em var(--neon), 0 0 1.4em color-mix(in oklab, var(--neon) 60%, transparent); }
@media (prefers-reduced-motion: no-preference) { .neon { animation: flicker 6s steps(1) infinite; } }
@keyframes flicker { 0%,96%,100%{opacity:1} 97%{opacity:.55} 98%{opacity:.9} 99%{opacity:.4} }
```

**T7. Text over the 3D view.** Feel: N, C.
```css
.hud-text { text-shadow: 0 1px 0 rgb(0 0 0/.9), 0 0 6px rgb(0 0 0/.7); }
.scrim { background: linear-gradient(to top, rgb(0 0 0/.7), transparent 70%); }
/* or a soft local backplate */
.plate { background: radial-gradient(closest-side, rgb(5 6 12/.65), transparent); }
```

**T8. Trimmed text boxes for pixel-perfect pill buttons.** `text-box: trim-both cap alphabetic;` (Safari 18.2+, Chrome 133+). Progressive enhancement only.

#### Panels and frames

**F1. A layered frame from multiple backgrounds and shadows (no images).** Feel: S, C.
```css
.panel {
  --rim: #c79a4a; --ink: #2a1a10;
  background:
    linear-gradient(#0000, #0000) padding-box,
    var(--grain) padding-box,
    linear-gradient(180deg, #fffaf0, #f3e6cf) padding-box,
    linear-gradient(180deg, #f6d68c, var(--rim) 45%, #7b5520) border-box;
  border: 3px solid transparent; border-radius: 14px;
  box-shadow:
    0 0 0 2px var(--ink),                 /* outer outline */
    inset 0 1px 0 rgb(255 255 255/.8),   /* top inner highlight */
    inset 0 -3px 0 rgb(0 0 0/.08),       /* bottom inner bevel */
    0 10px 24px -8px rgb(0 0 0/.45);     /* lift */
}
```

**F2. A double rule with corner ornaments (Hades, Art Deco).** Feel: S, L.
```css
.deco { position: relative; outline: 1px solid var(--rim); outline-offset: -8px; }
.deco::before, .deco::after { content:""; position:absolute; inset:4px; pointer-events:none;
  background:
    conic-gradient(from 90deg at 1px 1px, #0000 90deg, var(--rim) 0) 0 0 / 14px 14px no-repeat,
    conic-gradient(from 180deg at calc(100% - 1px) 1px, #0000 90deg, var(--rim) 0) 100% 0 / 14px 14px no-repeat; }
```
For the richest version, put an SVG ornament in a `border-image` data URI: `border-image: url("data:image/svg+xml,...") 24 / 24px / 0 round;`.

**F3. Cut corners and bracket ticks (Cyberpunk, Destiny).** Feel: N.
```css
.cut { --c: 14px; clip-path: polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c)); }
@supports (corner-shape: bevel) { .cut { clip-path:none; border-radius: 14px; corner-shape: bevel; } } /* Chromium 139+; keeps border and shadow */
.ticks { background:
  linear-gradient(var(--neon) 0 0) 0 0/12px 1px, linear-gradient(var(--neon) 0 0) 0 0/1px 12px,
  linear-gradient(var(--neon) 0 0) 100% 100%/12px 1px, linear-gradient(var(--neon) 0 0) 100% 100%/1px 12px;
  background-repeat: no-repeat; }
```
`clip-path` cuts off box-shadow. Put the glow on a wrapper with `filter: drop-shadow()`.

**F4. Skewed slabs (Persona, Overwatch).** Feel: N (titles), L.
```css
.slab { transform: skewX(-12deg); background: #0b0b0f; padding: .3em 1em; }
.slab > span { display:inline-block; transform: skewX(12deg); }  /* unskew the text */
.slab.alt { transform: rotate(-3deg) skewX(-12deg); background:#fff; color:#0b0b0f; }
```

**F5. Glass (Destiny, CATHODE HUD).** Feel: N, L.
```css
.glass { background: linear-gradient(160deg, rgb(255 255 255/.10), rgb(255 255 255/.02));
  backdrop-filter: blur(14px) saturate(140%); border: 1px solid rgb(255 255 255/.14);
  box-shadow: inset 0 1px 0 rgb(255 255 255/.18), 0 20px 40px -20px rgb(0 0 0/.8); }
@supports not (backdrop-filter: blur(1px)) { .glass { background: rgb(14 16 24/.86); } }
```
Over a live WebGL canvas, `backdrop-filter` is expensive on iPhone. Use it on at most one or two large panels and never on per-frame HUD elements.

**F6. Paper and card stock (Disco Elysium, cosy).** Feel: C, S, P.
```css
.paper { background: var(--grain), radial-gradient(120% 80% at 30% 0%, #fffdf6, #f1e7d3);
  box-shadow: 0 1px 1px rgb(0 0 0/.08), 0 6px 0 -3px #e3d6bc, 0 12px 20px -10px rgb(60 40 10/.35); } /* stacked-sheet edge */
```

#### Materials and texture

**M1. Grain from an feTurbulence data URI.** Feel: all (strength varies).
```css
:root { --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.grainy::after { content:""; position:absolute; inset:0; background: var(--grain); mix-blend-mode: overlay; opacity:.08; pointer-events:none; }
```
Keep opacity between 0.03 and 0.12 (above 0.15 reads as dirt). Use paper or linen grain at a low frequency for C and S, film grain at a high frequency for N. Static only: animated SVG noise is janky.

**M2. A metal rim gradient (gold, brass, chrome).**
```css
--gold: linear-gradient(180deg,#fff1bf,#e7b955 35%,#9c6a1c 52%,#d9a744 70%,#fff0b8);
--chrome: linear-gradient(180deg,#fff,#b9c2cc 40%,#5d6670 52%,#cfd6dd 75%,#fff);
```
Use these as `border-box` backgrounds (F1) or `background-clip:text` (T5).

**M3. Glossy button (Clash or Bloons top-light).** Feel: C.
```css
.btn { background:
    linear-gradient(rgb(255 255 255/.45), rgb(255 255 255/0) 50%) top/100% 50% no-repeat,
    linear-gradient(#7fd35a, #3f9a2a);
  border: 2px solid #1f3a12; border-radius: 12px;
  box-shadow: inset 0 -4px 0 rgb(0 0 0/.22), inset 0 2px 0 rgb(255 255 255/.5), 0 4px 0 #1f3a12; }
```

**M4. Colour in OKLCH with `color-mix`.** Define one hue per game and derive the ramps:
```css
:root{ --h: 28; --accent: oklch(.72 .16 var(--h)); --accent-ink: oklch(.28 .06 var(--h));
  --accent-soft: color-mix(in oklch, var(--accent) 22%, var(--paper)); }
```
This keeps AA contrast predictable: lightness (L) controls contrast directly.

**M5. Vignette and edge light (cinematic framing).** Feel: N, S.
`box-shadow: inset 0 0 120px rgb(0 0 0/.55);` on screen roots, plus a 1px coloured `inset 0 1px 0` top highlight on dark panels.

**M6. Holo or foil for rare items (Marvel Snap, Hearthstone golden).**
```css
@property --a { syntax:'<angle>'; inherits:false; initial-value:0deg; }
.foil { background: conic-gradient(from var(--a), #ff9ad5,#9ae7ff,#d3ff9a,#ffe79a,#ff9ad5);
  mix-blend-mode: color-dodge; opacity:.35; animation: spin 6s linear infinite; }
@keyframes spin { to { --a: 360deg; } }
```
To make it follow the pointer, set `--a` with `pointermove` and `setProperty`.

#### Motion

**A1. Spring easing tokens.** `linear()` is supported in Chrome 113+, Safari 17.2+ and Firefox 112+.
```css
:root{
  --ease-out: cubic-bezier(.16,1,.3,1);          /* expo-out: panels entering */
  --ease-in:  cubic-bezier(.7,0,.84,0);          /* exits */
  --ease-back: cubic-bezier(.34,1.56,.64,1);     /* small overshoot: chips, badges */
  --spring: linear(0,.009,.035 2.1%,.141,.281 6.7%,.723 12.9%,.938 16.7%,1.017,1.077,1.121 24%,1.149 26.8%,1.159,1.154 31.7%,1.106 37.6%,1.031 46.5%,1.003 51.3%,.986 56.8%,.991 69.4%,1 100%);
  --dur-1: 120ms; --dur-2: 220ms; --dur-3: 420ms; --dur-hero: 700ms; }
```
Generate the stops with Jake Archibald's linear-easing generator. Rule: UI enters with `--ease-out`, rewards use `--spring`, exits are about 30% faster than entrances.

**A2. Staggered entrance through custom properties (CSP-safe).**
```css
.stagger > * { animation: rise var(--dur-3) var(--ease-out) both; animation-delay: calc(var(--i, 0) * 45ms + 80ms); }
@keyframes rise { from { opacity:0; transform: translateY(14px) scale(.98); filter: blur(4px); } }
```
```js
list.querySelectorAll(':scope > *').forEach((el,i)=>el.style.setProperty('--i', i));
```
Where supported, `sibling-index()` (Chromium 138+) can replace the JS.

**A3. `@starting-style` for show and hide without JS timers.**
```css
dialog[open] { opacity:1; transform:none; transition: opacity .3s, transform .4s var(--spring), display .4s allow-discrete, overlay .4s allow-discrete; }
@starting-style { dialog[open] { opacity:0; transform: scale(.94) translateY(10px); } }
```

**A4. Wipes and reveals with clip-path (Persona, Overwatch title cards).**
```css
@keyframes wipe { from { clip-path: polygon(0 0,0 0,-20% 100%,-20% 100%); } to { clip-path: polygon(0 0,120% 0,100% 100%,-20% 100%); } }
.banner { animation: wipe .45s var(--ease-out) both; }
```

**A5. Impact frame.** A one-frame white flash plus a punch scale (damage, a SNAP moment, a boss intro).
```css
.hit { animation: punch .32s var(--spring); }
@keyframes punch { 0%{transform:scale(1.18); filter: brightness(2.2) saturate(0);} 12%{filter:none;} }
.flash::after{ content:""; position:fixed; inset:0; background:#fff; mix-blend-mode:overlay; animation: f .12s steps(2) both; }
```
Add a shake with `translate` keyframes of ±3px over 180ms. Both must be gated behind reduced motion (A10).

**A6. Count-up numbers (Balatro, Clash).** In JS, tween the value with the same easing (`requestAnimationFrame`), and on each step change toggle a class that runs `@keyframes tick { from { transform: scale(1.12); } }` at 90ms. Use `tabular-nums` so the width doesn't jitter.

**A7. View Transitions between screens.** Feel: all. `document.startViewTransition(() => render())` with `view-transition-name: hero-card` on shared elements (Safari 18+, Chrome 111+, Firefox 144+). This gives the "card flies from shop to deck" moment for free.

**A8. Scroll-driven reveals (landing).** `animation-timeline: view(); animation-range: entry 10% cover 30%;` behind `@supports (animation-timeline: view())`.

**A9. Idle life (breathing).** Cath's portrait frame or the selected tile does `scale(1.0)` to `1.012` over 3.2s with `ease-in-out` alternate. Very cheap and reads as premium.

**A10. Reduced motion as a design, not a switch-off.**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
  .hit, .shake, .flicker { animation: none !important; }
  .stagger > * { animation: fade .2s both !important; }  /* keep a soft opacity cue */
}
```

#### Feedback and micro-interactions

**I1. A physical press.** Feel: all.
```css
.btn { transition: transform var(--dur-1) var(--ease-out), box-shadow var(--dur-1), filter var(--dur-2); }
@media (hover:hover) { .btn:hover { transform: translateY(-2px); filter: brightness(1.06) saturate(1.08); } }
.btn:active { transform: translateY(3px) scale(.98); box-shadow: inset 0 -1px 0 rgb(0 0 0/.22), 0 1px 0 #1f3a12; transition-duration: 40ms; }
```
Press fast (40ms) and release with the spring (`transition-timing-function: var(--spring)` on the base state).

**I2. Hover tilt and spotlight on cards (Hearthstone, Snap).** Set `--mx`/`--my` with `setProperty` on `pointermove`:
```css
.card { transform: perspective(700px) rotateX(calc(var(--my,0) * -8deg)) rotateY(calc(var(--mx,0) * 10deg)); transition: transform .2s var(--ease-out); }
.card::before { background: radial-gradient(circle at calc(50% + var(--mx,0)*50%) calc(50% + var(--my,0)*50%), rgb(255 255 255/.35), transparent 45%); mix-blend-mode: soft-light; }
```

**I3. Selection, Persona style.** The selected row scales to 1.06, gains the single accent colour, and a skewed slab slides under it (`transform: scaleX(0)` to `1` with `transform-origin:left`).

**I4. Reward burst (pure DOM).** Twelve `<i>` spans, each given `--ang`/`--dist` via `setProperty`:
```css
.burst i { position:absolute; width:6px; height:14px; border-radius:3px; background: var(--c);
  animation: shoot .7s var(--ease-out) both; }
@keyframes shoot { from { transform: rotate(var(--ang)) translateY(0) scale(1); opacity:1; }
  to { transform: rotate(var(--ang)) translateY(calc(-1 * var(--dist))) scale(.3); opacity:0; } }
.burst::before { /* ring */ content:""; position:absolute; inset:-10px; border:3px solid var(--c); border-radius:50%; animation: ring .5s var(--ease-out) both; }
@keyframes ring { from { transform:scale(.3); opacity:1; } to { transform:scale(1.8); opacity:0; } }
```
Stage it as anticipation (100ms squash to 0.92), burst, count-up, then settle.

**I5. Focus rings that match the style.**
```css
:focus-visible { outline: 3px solid var(--focus, oklch(.8 .15 85)); outline-offset: 3px; border-radius: inherit; }
.n :focus-visible { outline: 1px solid var(--neon); box-shadow: 0 0 0 4px color-mix(in oklab, var(--neon) 30%, transparent), 0 0 18px var(--neon); }
```
The ring must keep 3:1 contrast against its neighbours, and it should never be removed.

**I6. Haptic and audio pairing.** On a press, call `navigator.vibrate?.(8)` (Android) and play a short synthesised click; every reward beat in I4 gets its own sound. The impression of premium quality comes about half from sound.

#### Layout

**L1. Container queries for phone panels.**
```css
.panel { container: panel / inline-size; }
@container panel (width < 360px) { .stats { grid-template-columns: 1fr 1fr; } .label { letter-spacing:.1em; font-size:.68rem; } }
@container panel (width > 560px) { .stats { grid-template-columns: repeat(4, 1fr); } }
```
Combine with `@media (orientation: landscape) and (max-height: 430px)` for the 844x390 HUD (compress the vertical chrome and move panels to the sides).

**L2. Fluid type scale.** `--step-0: clamp(.95rem, .9rem + .25vw, 1.05rem); --step-5: clamp(2.2rem, 1.4rem + 4vw, 4.8rem);` Use `dvh`/`svh` and `env(safe-area-inset-*)` for the iPhone notch and home bar.

**L3. `font-display` and subsetting for speed.** Import only the `latin` subset (`@fontsource-variable/x/latin.css` or the `wght.css` axis file), preload the hero face, and add `size-adjust`/`ascent-override` fallback metrics to avoid layout shift. One variable file usually weighs less than three static weights.

---

### 3. Font shortlist (all on Fontsource, OFL-1.1 unless noted)

Checked against the npm registry and the Fontsource API on 2026-10-11. "Var" means `@fontsource-variable/<id>` exists; the axes are listed.

#### (a) CATHODE: noir cyberpunk shooter
| Font | Var / axes | Why |
|---|---|---|
| **Rajdhani** | static 300–700 | What Cyberpunk 2077 actually uses for its UI (Fonts In Use). Squared, condensed, technical. A strong HUD face. |
| **Saira** | var `wdth` 50–125, `wght`, ital | One family covers condensed HUD labels through wide titles. Animating `wdth` on alerts looks very slick. |
| **Tektur** | var `wdth` 75–100, `wght` 400–900 | Angular sci-fi with cut corners, matching F3 frames. Good for weapon names. |
| **Oxanium** | var `wght` 200–800 | Squarish techno, more readable than Orbitron for body-size HUD text. |
| **Orbitron** | var `wght` 400–900 | Cyberpunk's secondary face. Use only for short logos and badges, never body text. |
| **Big Shoulders** | var `opsz` 10–72, `wght` 100–900 | Chicago-industrial condensed. Its `opsz` gives a noir-poster display at large sizes and a tight HUD at small ones. |
| **Antonio** | var `wght` 100–700 | Tall, thin condensed sans for kill-cam titles and noir chapter cards. |
| **Bodoni Moda** | var `opsz` 6–96, `wght`, ital | The *noir* half: high-contrast didone for title cards and Cath's dialogue (Blade Runner meets Vogue). |
| **JetBrains Mono** | var `wght` 100–800, ital | Ammo counts, terminal hacking, stat readouts. Excellent zero and tabular figures. |
| **Share Tech Mono** | static 400 | Retro terminal flavour for lore logs. |

#### (b) Hedgerow: cosy British countryside tower defence
| Font | Var / axes | Why |
|---|---|---|
| **Fraunces** (already installed) | var `opsz` 9–144, `wght`, `SOFT` 0–100, `WONK`, ital | `SOFT 100` makes it a soft, buttery storybook serif. It is the ideal Hedgerow display face once the variable version is used. |
| **Young Serif** | static 400 | Heavy, warm, old-fashioned serif with a village-fête poster feel. |
| **Caprasimo** | static 400 | Chunky 1970s soft serif. A cosy equivalent of Clash's display face, good for wave banners with T4 stroke. |
| **Grandstander** | var `wght` 100–900, ital | Playful rounded display for numbers popping off enemies. |
| **Fredoka** | var `wdth` 75–125, `wght` 300–700 | Rounded, friendly button labels. `wdth` lets labels fit the 390px width. |
| **Shantell Sans** | var `wght`, `BNCE`, `INFM`, `SPAC`, ital | Hand-lettered marker; the `BNCE` (bounce) and `INFM` (informality) axes animate. Good for chalkboard and notice-board tips. |
| **Alegreya** | var `wght` 400–900, ital | A calligraphic, bookish body serif for story scenes and the almanac. |
| **IM Fell English** | static 400, ital | Seventeenth-century English print. Use sparingly, for level names and old maps. |
| **Luckiest Guy** (Apache-2.0) | static 400 | What Bloons TD 6 uses. Only if the team wants the louder cartoon register. |

#### (c) Cathnivore: stylish board game about a mum
| Font | Var / axes | Why |
|---|---|---|
| **Playfair** (2.0) | var `opsz` 5–1200, `wdth` 87.5–112.5, `wght`, ital | Fashion-magazine didone with a huge optical range: masthead titles and fine captions from one file. |
| **Bodoni Moda** | var `opsz`, `wght`, ital | Vogue-cover elegance for Cath's name and victory screens. |
| **Instrument Serif** | static 400, ital | Condensed editorial serif; its italic is very chic for pull-quotes and card flavour text. |
| **DM Serif Display** | static 400, ital | Bold, high-contrast headline serif that holds up at phone size. |
| **Cormorant Garamond** | var `wght` 300–700, ital | Refined Garamond display. Its italic is gorgeous for flourishes. |
| **Gloock** | static 400 | Characterful high-contrast serif with a boutique, "label" feel. |
| **Italiana** | static 400 | Thin, tracked caps for labels (a perfume-bottle look). Use only at 18px and above. |
| **Libre Caslon Display** | static 400 | Classic luxury serif for big headings. |
| **Mona Sans** | var `wdth` 75–125, `wght`, ital | A modern grotesk UI partner with width control for tight board labels. |
| **Figtree** | var `wght` 300–900, ital | Friendly, clean geometric UI or body face that pairs with any of the didones above. |

#### (d) Runnel: calm daily puzzle
| Font | Var / axes | Why |
|---|---|---|
| **Atkinson Hyperlegible Next** | var `wght` 200–800, ital | The successor to the current body face: more weights, same legibility. Upgrade in place. |
| **Inter** | var `opsz` 14–32, `wght`, ital | Neutral, superb tabular figures, `cv`/`ss` features (`"cv11","ss01"`). |
| **DM Sans** | var `opsz` 9–40, `wght` 100–1000, ital | Soft geometric with optical sizes. Calm and Monument Valley-adjacent. |
| **Lexend** | var `wght` 100–900 | Designed for reading fluency. Airy, which suits a daily ritual. |
| **Recursive** | var `MONO`, `CASL`, `wght` 300–1000, `slnt`, `CRSV` | Can animate from casual to linear and from proportional to mono. Lovely for grid or number tiles and a "solved" moment. |
| **Newsreader** | var `opsz` 6–72, `wght`, ital | A newspaper-puzzle-page serif for the date, title and share card. |
| **Outfit** | var `wght` 100–900 | Clean geometric for big puzzle numerals. |

#### (e) The games-studio landing page
| Font | Var / axes | Why |
|---|---|---|
| **Bricolage Grotesque** | var `opsz` 12–96, `wdth` 75–100, `wght` 200–800 | Quirky, contemporary studio feel. `opsz` gives an expressive display and a sober body from one file. |
| **Hubot Sans** / **Mona Sans** | var `wdth` 75–125, `wght`, ital | Width axes let a hero headline breathe or condense responsively. |
| **Unbounded** | var `wght` 200–900 | Wide, bold, game-forward display for the studio wordmark. |
| **Syne** | var `wght` 400–800 | Art-gallery character; its extra-bold weights widen. Distinctive hero text. |
| **Instrument Serif** | static, ital | An editorial italic accent ("games *worth* playing"), currently fashionable on premium studio sites. |
| **Space Grotesk** | var `wght` 300–700 | Techy-friendly grotesk that bridges CATHODE and the cosier games. |
| **Geist** / **Geist Mono** | var `wght` 100–900, ital | Crisp, modern UI and metadata text (dates, version, tags). |
| **Hanken Grotesk** | var `wght` 100–900, ital | A neutral body face if the display face is loud. |

#### Suggested pairings (one display, one UI, one numerals face per game)
- **CATHODE:** Bodoni Moda (noir titles) + Saira variable (HUD; condensed `wdth` 70) + JetBrains Mono (numbers).
- **Hedgerow:** Fraunces variable with `SOFT 100, WONK 0` + Fredoka variable (buttons) + Grandstander (damage and counters).
- **Cathnivore:** Playfair 2.0 (high `opsz` titles) + Mona Sans + Instrument Serif italic (flavour text).
- **Runnel:** Newsreader (title and date) + Atkinson Hyperlegible Next + Recursive (tiles).
- **Landing:** Bricolage Grotesque + Instrument Serif italic accent + Geist Mono (tags).

Budget: at most 3 variable files per game, latin subset only, about 30–60 KB each as woff2.

---

### 4. Implementation order (highest visible impact per hour)

1. **Tokens first:** `--ease-*`, `--spring`, durations, `--track-*`, an OKLCH palette and `--grain` in one shared `shared/ui/tokens.css`.
2. **Swap to `@fontsource-variable/*`** and use `opsz`, `SOFT` and `wdth`. The type change alone lifts every screen.
3. **Frame and material components:** F1 (S, C), F3/F5 (N), F6 (P), and the M3 button. Then replace flat borders everywhere.
4. **Motion layer:** A2 stagger on every list or menu, I1 press on every button, A3 dialogs, A7 view transitions between screens.
5. **Reward moments:** I4, A5 and A6 on level clear, a Cathnivore win, a CATHODE kill-cam and a Runnel solve, each paired with sound.
6. **Check every change** with `npm run shots` at 390x844, 844x390 and 1440x900, with reduced motion on, and with AA contrast checks on any text over gradients or the 3D view.

---

### Sources

- Hades and Supergiant: [Jen Zee (Wikipedia)](https://en.wikipedia.org/wiki/Jen_Zee) · [Hades II UI Illustrator posting](https://www.supergiantgames.com/blog/job-opportunity-ui-illustrator-for-hades-ii) · [Hades II UI Animator posting](https://www.workwithindies.com/careers/supergiant-games-ui-animator-hades-ii) · [What font does Hades use (unverified IDs)](https://madegooddesigns.com/hades-font/) · [Pixel P&L, "The Art of Hades"](https://pixelpnl.beehiiv.com/p/happy-holi-from-pixel-p-l)
- Persona: [Push Square on Atlus UI staffing (Hashino)](https://www.pushsquare.com/news/2024/02/persona-3-reloads-sexy-ui-result-of-retaining-key-staff-says-atlus) · [Mechanics of Magic: Visual Design of Persona 5](https://mechanicsofmagic.com/2022/04/23/visual-design-of-games-persona-5/) · [Inverse on the Persona 5 Tactica UI](https://inverse.com/gaming/persona-5-tactica-user-interface) · [Famitsu interview with the P5 art leads (SegaBits)](https://segabits.com/?p=54918) · [ActuGaming on Atlus menus](https://www.actugaming.net/?p=678450) · [Robin Rendle, "video games and wiggletech"](https://robinrendle.com/adventures/video-games-and-wiggletech/)
- Cyberpunk 2077: [Fonts In Use: Cyberpunk 2077](https://www.fontsinuse.com/uses/60926/cyberpunk-2077-video-game) · [GDC Showcase on the Cyberpunk UI](https://expo.gdconline.com/news/learn-how-cyberpunk-2077-built-its-impressive-ui-gdc-showcase-session) · [HUDs and GUIs: Cyberpunk 2077](https://www.hudsandguis.com/home/2019/cyberpunk-2077)
- Hearthstone: [Belwe Roman (Wikipedia)](https://en.wikipedia.org/wiki/Belwe_Roman) · [GDC Vault: Hearthstone, How to Create an Immersive UI](https://gdcvault.com/play/1022036/Hearthstone-How-to-Create-an) · [mein-mmo write-up of the talk](https://mein-mmo.de/en/hearthstone-weg-zum-megahit063,32034/) · [Blizzard Watch on Tavern Brawl art](https://blizzardwatch.com/2015/08/04/blizzard-designed-hearthstones-tavern-brawl/)
- Marvel Snap: [GDC Vault: Designing MARVEL SNAP](https://gdcvault.com/play/1029024/Designing-MARVEL-SNAP) · [mobilegamer.biz on Snap onboarding and card design](https://mobilegamer.biz/second-dinner-reveals-the-secrets-of-marvel-snaps-onboarding-and-card-design/)
- Disco Elysium: [80.lv: Working on UI design](https://80.lv/articles/disco-elysium-working-on-ui-design) · [Can I Play That: dyslexic fonts](https://caniplaythat.com/2022/06/30/disco-elysium-the-final-cut-pc-accessibility-update-implements-dyslexic-fonts/) · [Dialogue UI case study](https://tommartin.myblog.arts.ac.uk/page/3/) · [madegooddesigns: Disco Elysium font](https://madegooddesigns.com/disco-elysium-font/)
- Death Stranding: [Fonts In Use: Death Stranding](https://fontsinuse.com/uses/67648/death-stranding-video-game) · [Wccftech: font-size update](https://wccftech.com/death-stranding-december-update/amp/)
- Destiny: [madegooddesigns: Destiny font (no official credit)](https://madegooddesigns.com/?p=9934)
- Balatro: [m6x11 Cyrillic asset (m6x11 lineage)](https://nattogames.itch.io/m6x11cyrillic) · [itch.io modder note on m6x11plus](https://itch.io/post/11449537) · [madegooddesigns: Balatro font](https://madegooddesigns.com/?p=10884)
- Bloons and Clash: [Bloons Wiki: list of fonts (Luckiest Guy)](https://www.bloonswiki.com/List_of_fonts) · [Vaadin cr-fonts (Supercell Magic)](https://vaadin.com/forum/t/about-the-cr-fonts-category/174526)
- Slay the Spire and Overwatch: [madegooddesigns: Slay the Spire](https://madegooddesigns.com/slay-the-spire-font/) · [madegooddesigns: Overwatch](https://madegooddesigns.com/overwatch-font/) · [Design Your Way: Overwatch font](https://www.designyourway.net/blog/overwatch-font/)
- Monument Valley: [Mechanics of Magic exercise](https://mechanicsofmagic.com/2023/04/20/short-exercise-visual-design-of-games-29/) · [Typeroom: Monument Valley-inspired typeface](https://www.typeroom.eu/content/monument-valley-inspires-typeface)
- Game UI Database: [Aftermath on the Game UI Database 2.0](https://aftermath.site/game-ui-database) · [80.lv: UI artist created a database](https://80.lv/articles/ui-artist-created-a-database-of-games-menus) · [Game UI Bible book](https://aftermath.site/game-ui-bible-database-book-lost-in-cult-edd-coates/)
- Game feel: [Juice it or lose it summary](https://roblog.co.uk/2024/03/juicy-games/) · [GDQuest: juicing glossary](https://school.gdquest.com/glossary/juicing) · [Wayline: UI animation and immersion (Hollow Knight menus)](https://www.wayline.io/blog/ui-animation-game-immersion)
- CSS: [Chrome for Developers: linear() easing](https://developer.chrome.com/docs/css-ui/css-linear-easing-function) · [Smashing: the path to CSS easing with linear()](https://smashingmagazine.com/2023/09/path-css-easing-linear-function) · [MDN: paint-order (Baseline 2024)](https://developer.mozilla.org/ko/docs/Web/CSS/Reference/Properties/paint-order) · [MDN BCD issue on paint-order for HTML text](https://github.com/mdn/browser-compat-data/issues/17951) · [CSS-Tricks: paint-order](https://css-tricks.com/?p=321460) · [freeCodeCamp: grainy CSS backgrounds with SVG filters](https://www.freecodecamp.org/news/grainy-css-backgrounds-using-svg-filters/) · [CSS-Tricks: grainy gradients](https://css-tricks.com/?p=351302) · [Smashing 2026: corner-shape](https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/) · [corner-shape support](https://squircle.js.org/blog/squircles-in-css)
- Fonts: availability, licences and axes checked live against `registry.npmjs.org/@fontsource[-variable]/<id>` and `api.fontsource.org/v1/{fonts,variable}/<id>`.

No files were created or modified. The repo was only read; no worktree was needed.
## B. Audit of the current UI
## Portfolio UI audit: typography and CSS against an AAA bar

I screenshotted and looked at 54 screens. Fonts, CSS structure and layout are all well below an AAA bar. The type system is the biggest single cause.

The shots are in ``. File names follow `<game>-<n>-<screen>-<phone|landscape|desktop>.png`. The worktree is removed, the preview server is stopped and nothing was committed.

**Gaps in coverage:**
- **CATHODE character sheet on desktop:** neither the K key nor `input.forced={skills:true}` opened it at 1440x900, so only the phone and landscape shots exist.
- **CATHODE pause menu:** it only appeared after I set `cathode.input.menuTapped = true` directly. Esc doesn't open it while the intro coaching prompt is on screen.
- **Hedgerow field shot:** only one tower and a beehive got placed on level 12, so the field is sparse. It is mid-wave with the Scarecrow selected.

---

### Portfolio-wide findings (fonts and CSS)

**Fonts actually used.** Every product uses the same two families: Fraunces for display and Atkinson Hyperlegible for UI. That includes a farm board game, a cosy puzzle, a countryside tower defence and an R-rated cyberpunk shooter.
- **Loading:** fonts load two different ways.
  - Cathnivore imports `@fontsource` (`src/main.tsx`: Fraunces 600, 700 and 700-italic; Atkinson 400 and 700).
  - The site, Runnel, Hedgerow and CATHODE each declare their own `@font-face` pointing at `/fonts/`. Only four files are shipped there: Fraunces 400 and 700, Atkinson 400 and 700.
- **Faux weights:** the CSS asks for weight 800 fourteen times and 600 eight times. Outside Cathnivore those files don't exist, so the browser fakes the bold.
- **Faux italics:** italic is styled in CATHODE (5 rules), Hedgerow (2) and Runnel (1), but those builds ship no italic file. The browser slants the roman instead. This shows on CATHODE's title and class-pick quotes, Hedgerow's story captions and Runnel's speech bubble.
- **Variable axes unused:** Fraunces is a variable font with optical-size, SOFT and WONK axes. All of them are thrown away by using static 400 and 700 cuts. Display headlines are set at 120–220px in a text-optical-size cut, which is why they look heavy and clumsy rather than crafted.
- **Slashed zero:** Atkinson Hyperlegible's zero has a slash. Every score and stat reads like debug output: "Round 1/1Ø", "Trust 1Ø", "99399", "Ø Knockouts".
- **No numeric typography:** only 23 `font-variant` or `font-feature` declarations exist across all the CSS. There are no consistently applied tabular figures, no small caps and no tuned stat numerals.
- **Sizes are ad-hoc pixels:**

  | File | Main sizes | Hardcoded `px` sizes |
  |---|---|---|
  | `src/styles/global.css` | 14, 13 and 12px | 56 of 69 |
  | `games/hedgerow/src/styles.css` | 13, 12, 14, 11 and 10px | 133 of 143 |
  | `games/cathode/src/styles.css` | 13, 12, 15, 14, 12.5, 11, 10.5, 13.5 and 11.5px | 150 of 158 |
  | `games/runnel/src/styles.css` | mostly 14–16px | 21 of 22 |

  There is no type scale, no `rem`, and `clamp()` appears only on hero titles. Body copy is 11–14px in most UI, which is too small for AAA readability on a 1440px screen and makes panels look cramped.
- **Tracked caps everywhere:** the same overline style (wide-tracked tiny caps, e.g. "A COOPERATIVE STRATEGY GAME", "RATED 18", "CASE FILE") is used in every game. Nothing gives a game its own voice.

**CSS architecture.** About 12,100 lines, hand-rolled, with no shared design system.

| File | Lines | Custom properties | Hardcoded hex / rgba | Notes |
|---|---|---|---|---|
| `src/styles/tokens.css` (Cathnivore) | 85 | 61 | 55 hex | The only real token file: colour plus motion tokens. No type, spacing, radius or elevation tokens. |
| `src/styles/global.css` | 2,594 | 1 | 28 / 26 | 250 `var()` uses, 27 media queries, 24 keyframes |
| `src/styles/title.css` / `campaign.css` / `table.css` | 458 / 475 / 215 | 0–1 | few | Uses the tokens |
| `site/src/styles.css` | 854 | 8 | 52 / 30 | Its own `@font-face` |
| `games/runnel/src/styles.css` | 1,288 | 51 | 79 / 9 | Its own palette |
| `games/hedgerow/src/styles.css` | 3,273 | 23 | 150 / 84 | 18 `!important`, 41 media queries, 59 shadows. Re-declares the Cathnivore palette (paper, ink, pasture) by hand, with slightly different values (`--pasture` #4c7a34 vs #5B7F3A). |
| `games/cathode/src/styles.css` | 2,799 | 21 | 110 / 152 | 394 `var()` uses but 152 raw rgba values, 56 gradients, 27 z-indexes. Its `--display` is Fraunces, a farmhouse serif, for a noir cyberpunk shooter. |
| `shared/cath/cath.css` | 54 | | | The only shared CSS |

Nothing is shared between games: no type ramp, spacing scale, elevation scale, button component or panel component. Each game has rebuilt its own buttons, pills, cards and dialogs. Every dialog in the portfolio comes out as the same generic shape: a cream rounded card, a centred serif heading and two pill buttons.

---

### Landing page (`/`)

Shots: `site-landing-desktop.png`, `site-landing-full-desktop.png`, `site-landing-phone.png`, `site-landing-full-phone.png`

- **Strongest screen in the portfolio.** It has a painted sunset hex plain, a large Cath and a big Fraunces wordmark.
- **The wordmark says "Cathnivore"** although the page is the portfolio hub. The tagline under it is Runnel copy ("New day, new Runnel…"). The hierarchy is muddled.
- **The game cards are generic glassmorphism tiles:** icon, title, 14px grey copy, a tiny amber meta line and a circle arrow. Hedgerow sits alone on a centred second row, which reads as a layout leftover. CATHODE is pushed into a "For grown-ups" footer strip and its title is Fraunces caps. It has no key art and no motion.
- **Cath's figure is cut off at the hip by the cards on desktop.** The cards visually sit on her.
- **No AAA hub moves:** no hero key art per game, no video loops or parallax, no featured or "continue" rail, and no per-game type identity.

### Cathnivore (`/cathnivore/`)

Fonts: Fraunces 600, 700 and 700-italic plus Atkinson 400 and 700 via `@fontsource`. Body text is mostly 12–14px.

- **Title** (`cathnivore-1-title-*`)
  - A clean brown Fraunces wordmark and an attractive hex vignette with sun rays.
  - The menu is two plain full-width buttons and three underlined text links. It feels like a web form, not a game front end: no focus states with depth, no hover motion and no sound-design affordance.
  - The footer legal line is 13px grey web boilerplate.
  - On phone, Cath is shrunk into a corner overlapping the hexes.
- **Campaign** (`cathnivore-2-campaign-*`)
  - A vertical list of identical beige cards on a beige page.
  - Locked chapters are greyed beige-on-beige with a lock in a circle. The art in the cards is faint ghost line drawings at about 10% opacity.
  - It reads as a settings list, not a campaign map. There is no illustrated journey and no chapter key art.
- **Story scene** (`cathnivore-3-story-scene-*`): one of the worst screens.
  - On desktop a 560px pastel column floats in a 1440px beige void, with flat CSS hills.
  - A small Cath bust and a bordered speech bubble in 15px Atkinson, plus two tiny Next and Continue buttons with unclear difference.
  - There is no scene art, no character staging and no letterboxing.
- **Setup** (`cathnivore-4-setup-*`)
  - A stack of bordered beige boxes inside bordered boxes.
  - The mode toggle is a giant yellow pill. Producer cards are flat cartoon busts in ovals with tiny copy.
  - On desktop the Start bar overlays the cards. On phone, the "Start" button covers "Dr Ines Farrow".
- **Game** (`cathnivore-5-game-*`)
  - The map is good, but it is surrounded by about 15 bordered beige panels with 11–13px text and dotted underlines everywhere ("Produce 3 (2/round) · Marks 2 (1/round) ·").
  - The HUD pills read "Round 1/1Ø". Market items wrap awkwardly ("Cold / Store", "Anonymous / Tip" with an orphaned triangle).
  - It looks like an admin dashboard.
- **End** (`cathnivore-6-end-*`)
  - A rubber-stamp "REPOSSESSED" or "LIBERATED" badge, then a centred headline and four plain stat boxes.
  - On phone, the sunburst behind Cath is clipped to a hard square, and "Back to Title" sits over the stat cards.
  - On desktop, a ghost duplicate button shows behind "Back to Title".
  - There is no score count-up, no reward choreography and no CTA hierarchy.

### Runnel (`/runnel/`)

Fonts: Fraunces 700 and Atkinson 400 and 700 via its own `@font-face`. The speech bubble uses a faux-italic Fraunces bold.

- **Puzzle** (`runnel-1-puzzle-*`)
  - Tidy and charming board art, but the chrome is web-app thin: a 15px "‹ Games" link, a segmented pill and tiny stats ("0:00 time 3 taps 79 par") at 13–14px.
  - The faux-italic bold Fraunces bubble looks smeared.
  - The faint diagonal-line paper texture reads as noise.
  - On phone there is about 100px of dead space above and below the board.
- **How to play** (`runnel-2-howto-*`)
  - A cream sheet with a Cath avatar badge, three outline-hex pictograms and a numbered HTML list.
  - The Start button has a yellow focus ring that looks like a default outline.
  - The look is a Medium article, not an onboarding sequence.
- **Win** (`runnel-3-win-*`)
  - A cream modal with three beige stat tiles and two pill buttons.
  - There is no celebration typography or count-up, and no share-card art preview.
  - It is the same template as every other dialog in the portfolio.

### Hedgerow (`/hedgerow/`)

Fonts: Fraunces 700 and Atkinson via its own `@font-face`. 143 font-size declarations, mostly 10–14px, plus 18 `!important`.

- **Map** (`hedgerow-1-map-*`)
  - Nice painted act banners, but the level nodes are flat beige circles with grey numbers and a lock emoji under each, joined by dotted lines on a cream slab.
  - The top bar is five chunky brown pills with emoji icons (📖 ☀ ◆ ★). The "Start here" tag collides with node 2.
  - In landscape the act banner text crowds Cath's head.
  - It reads as a list of links, not a world map.
- **Story** (`hedgerow-2-story-*`)
  - The illustration is good.
  - The caption is a black slab with tiny tracked yellow caps, a Fraunces name and faux-italic body text.
  - On phone the caption runs into the buttons. In landscape the slab is cut off at the bottom.
  - Skip and Next are generic.
- **Field with a tower selected** (`hedgerow-3-field-selected-*`)
  - The side panel is the densest UI in the portfolio. Three path columns of 10–12px text are truncated ("Murder of Cr…", "Whirling Scy…").
  - It has 9px green "Affordable now", a row of rainbow pills, a raw stat table ("Damage/s 1.2") and "Next +17" in a big orange bar.
  - On phone, the sheet covers about 60% of the field.
  - The "NEW ON THE LANE" toast is a plain dark rectangle.
  - Nothing feels like a game HUD: no iconography system, no number styling, no state animation.
- **Almanac** (`hedgerow-4-almanac-*`)
  - A cream modal of centred paragraphs with bold inline figures, outline-pill tabs and a brown "3D" pill on every row.
  - Centred body text in list rows is a basic typographic error.
  - It reads as a FAQ, not a bestiary or codex.
- **End** (`hedgerow-5-end-*`)
  - The shared cream dialog again: circle portrait, a tiny tracked-caps eyebrow, a serif headline, an 18px paragraph and two buttons.
  - "Try again" has a thick black outer ring.
  - There are no stars, score breakdown, stats or replay highlight in the layout.

### CATHODE (`/cathode/`)

Fonts: Fraunces, used as `--display`, and Atkinson as `--ui`. The faux italic is used heavily for objectives, subtitles and quotes. 158 font-size declarations with half-pixel sizes (10.5, 11.5, 12.5, 13.5px). 27 z-indexes.

- **Gate** (`cathode-1-gate-*`)
  - Three flat blurred CSS circles pretend to be neon bokeh. Fake rain is CSS diagonal lines.
  - Cath's silhouette is almost entirely hidden behind the card, so she isn't the face of the screen.
  - "CATHODE" is set in letterspaced Fraunces caps, which reads Victorian or Wild West, not neon noir.
  - The radio cards and buttons are flat web forms.
- **Title** (`cathode-2-title-*`)
  - A cute pastel chibi Cath, in the same style as the farm games, is framed in a box over two circles. The tone clashes hard with the R-rated promise.
  - The menu is one red rectangle and one outline rectangle.
  - On phone, "‹ Games" overlaps the portrait frame. In landscape the portrait and hint are cut off.
- **Class pick** (`cathode-3-classpick-*`)
  - The best UI here: a reticle emblem, stat bars and a weapon card.
  - On desktop, the top 200px are empty, the class list floats mid-left with truncated copy ("Pistols, revolvers and SMGs w…"), and the reticle is lonely.
  - On phone, the "Ghost" headline is cut off under the tab strip.
  - There is no class key art and no character render.
- **Character sheet** (`cathode-4-character-sheet-phone.png`, `-landscape.png`)
  - Skill nodes are two-letter abbreviations in dashed boxes ("SH", "HB", "WR") labelled "0/20". It looks like a wireframe.
  - The tabs are tiny tracked caps. "Respec…" and "Save code" are plain outline buttons.
  - The portrait is the pastel chibi again.
- **HUD** (`cathode-5-hud-*`)
  - The 3D world is genuinely atmospheric. The HUD is minimal to the point of placeholder: an 11px "CATH HALE  LEVEL 1" over a thin red line, "95" and "ARM 35" in tiny grey, and "THE PIN" bottom right.
  - Objectives and subtitles are faux-italic Fraunces on flat dark bars. The subtitle runs across the weapon.
  - The "WASD to move" tooltip is a plain black box.
  - On phone, the subtitle collides with the health block.
- **Pause** (`cathode-6-pause-*`)
  - A tall settings form: tracked-caps labels wrap to two or three lines ("COLOUR-/BLIND/COLOURS", "TOGGLE/SPRINT/AND AIM").
  - Bright amber segmented controls dominate, and the key-binding table has no keycap styling.
  - The heading is "Paused · click to play" in big serif, and the content overflows the viewport.
  - There are no tabs or sections, and no game-menu identity.

---

### The 10 weakest screens in the portfolio

1. **Cathnivore story scene, desktop** (`cathnivore-3-story-scene-desktop.png`): a narrow pastel column in a beige void, a small bust and a web speech bubble. There is no staging at all.
2. **CATHODE character sheet / skill tree** (`cathode-4-character-sheet-phone.png`, `-landscape.png`): placeholder two-letter nodes in dashed boxes. It reads as a wireframe.
3. **CATHODE pause menu** (`cathode-6-pause-*`): an overflowing settings form with three-line wrapped caps labels and loud amber toggles.
4. **CATHODE gate** (`cathode-1-gate-*`): flat CSS-circle bokeh, Cath hidden behind the card and a western-serif wordmark. It's the first impression of the "AAA" game.
5. **Hedgerow tower panel, mid-wave** (`hedgerow-3-field-selected-*`): 10–12px truncated text, a pill soup and a raw stat table. The phone sheet covers the battlefield.
6. **Cathnivore game screen** (`cathnivore-5-game-*`): a dashboard of bordered beige panels, dotted underlines and slashed-zero numerals around a good map.
7. **CATHODE title** (`cathode-2-title-*`): the pastel chibi in a box clashes with the noir tone, with two flat buttons. On phone the link overlaps the portrait.
8. **Hedgerow Almanac** (`hedgerow-4-almanac-*`): centred paragraphs in a cream modal plus "3D" pills. FAQ, not codex.
9. **Cathnivore setup** (`cathnivore-4-setup-*`): nested bordered boxes and a giant yellow pill. The Start bar covers content on phone and desktop.
10. **Hedgerow level map** (`hedgerow-1-map-*`): flat beige number circles with lock emoji on a cream slab and emoji pill buttons. It reads as a link list, not a world map.

Close runners-up:
- The shared end and win dialogs: `hedgerow-5-end-*`, `runnel-3-win-*` and `cathnivore-6-end-phone.png`, which has the clipped sunburst and the overlapping button.
- The CATHODE HUD (`cathode-5-hud-phone.png`), where the subtitle collides with the health block.

### What would close the gap

- **Type identity per game.** OFL fonts via `@fontsource`, self-hosted. These are suggestions, not tested.
  - **CATHODE:** a condensed grotesk or industrial display face (e.g. Oswald, Big Shoulders Display or Saira Condensed) with a mono for data (JetBrains Mono or IBM Plex Mono). Drop Fraunces entirely.
  - **Hedgerow:** a warmer storybook display face (e.g. Fraunces with the SOFT and WONK axes on, or Young Serif) with a rounded UI sans (e.g. Nunito).
  - **Cathnivore and Runnel:** variable Fraunces with optical size set properly. Keep Atkinson for body text only, or replace it with a sans that doesn't slash the zero.
  - **Everywhere:** ship the real italic and weight files. Turn on `font-variant-numeric: tabular-nums` and switch off the slashed zero.
- **A shared token layer** (`shared/ui/`) for a type ramp (rem plus clamp), spacing, radius, elevation, motion and z-index. Each game sets its own theme on top. It would replace the roughly 300 hardcoded px font sizes and roughly 440 raw hex values.
- **Component kits per game instead of one cream dialog template:** frames, buttons with states, tooltips, stat numerals and tab bars styled to match each game's world (painted wood and paper for Hedgerow, chrome, scanlines and glitch for CATHODE).
- **Screens to recompose first:** the full-bleed Cathnivore story scene, the illustrated Hedgerow world map, and a CATHODE HUD and skill tree with real iconography in place of the two-letter codes.