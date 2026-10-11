# AAA UI: per-game art-director specs (2026-10-11)

The merged decisions are in `aaa-ui.md`. Where they differ, `aaa-ui.md` wins.

## cathode
## CATHODE UI design system: "Wet Ink"

Art direction spec for `/cathode/`. The audit shots referred to below are in ``. Engineers should be able to build everything here from this document alone. Class names that already exist are kept wherever possible, so most of the work is in CSS and the TypeScript changes stay small.

---

### 1. Identity

CATHODE's UI is **a detective's case file printed on wet chrome**. There are two type registers. The fashion-noir register (a high-contrast Bodoni, as in Blade Runner 2049's title cards and a Vogue masthead) carries story, names and reward moments. The machine register (condensed technical caps and a mono for numbers, as in Cyberpunk 2077's HUD and Deus Ex's augment readouts) carries everything Cath reads off the world.

What each reference contributes:
- **Cyberpunk 2077:** hairline frames with cut corners and bracket ticks, uppercase condensed labels, and a warm off-white in place of pure white.
- **Deus Ex:** one strong "system" accent, numerals that look like readouts, and panels that draw themselves in.
- **Blade Runner 2049:** huge, quiet, widely tracked display type, letterboxing and brutal negative space on title, loading and boss cards.
- **Disco Elysium:** the character sheet is a dossier with coloured skill voices, and dialogue reads as prose rather than as a chat log.

The colours have strict jobs. **Blood red** means commit or danger, **cyan** means system and selection (the only selection colour, used the way Persona uses its blue), and **amber** means reward and points. Neon pink belongs to the city, and the UI never uses it except for the Wirewitch class accent.

---

### 2. Typography

#### 2.1 Packages (all OFL-1.1, self-hosted, so CSP `font-src 'self'` is satisfied)

| Package | Files actually fetched (latin) | Measured woff2 | Role |
|---|---|---|---|
| `@fontsource-variable/bodoni-moda` (import `opsz.css`) | `bodoni-moda-latin-opsz-normal.woff2`: `opsz` 6–96, `wght` 400–900 | 46.3 KB | **Display (noir):** wordmark, screen titles, boss and district names, Cath's name, rare+ item names, reward numbers |
| `@fontsource-variable/bodoni-moda` (import `opsz-italic.css`) | `bodoni-moda-latin-opsz-italic.woff2` | 53.8 KB | **Voice:** Cath's quotes on title, class pick and kill-cam captions, at 20px or larger only. Never in the HUD. |
| `@fontsource/rajdhani` (import `latin-500.css`, `latin-700.css`) | `rajdhani-latin-500-normal.woff2`, `rajdhani-latin-700-normal.woff2` | 15.1 + 15.7 KB | **UI and HUD:** labels, buttons, tabs, body copy, subtitles, objectives |
| `@fontsource-variable/jetbrains-mono` (import `wght.css`) | `jetbrains-mono-latin-wght-normal.woff2`: `wght` 100–800 | 40.4 KB | **Data:** stat tables, ranks, keycaps, distances, kill feed, timers, scope readouts, terminal and lore |
| **Total** | | **≈171 KB** | Under the 180 KB budget. A HUD-only session fetches about 71 KB (Rajdhani and JetBrains Mono). Bodoni italic is only fetched on screens that use it. |

Sizes were measured from jsDelivr on 2026-10-11. The variable `*.css` entry points declare every subset behind `unicode-range`, so Vite copies those files into `dist-site` but browsers only download latin. Count the budget from the latin files.

**Remove** Fraunces and Atkinson from CATHODE entirely. Delete the four `@font-face` blocks at the top of `games/cathode/src/styles.css`. The root `public/fonts/` files stay for the other games.

**Weights that exist, and the only ones allowed:**
- Rajdhani: 500 and 700.
- Bodoni: 400–900, normally 500 or 600 for display and 700 for small sizes.
- JetBrains Mono: 400–700.

Any other weight is a faux bold and a test will fail it (slice 1). `font-style: italic` is allowed only where `font-family: var(--f-voice)`.

**Glyph coverage gotcha:** the latin subsets don't contain ✕, ◆, ▲ or ▼, and Rajdhani doesn't contain them either. Draw those with CSS shapes or inline SVG, or use `×` (U+00D7) and `·` (U+00B7), which are in latin-1.

#### 2.2 Families and fallbacks

```css
/* games/cathode/src/styles/fonts.css */
@import "@fontsource-variable/bodoni-moda/opsz.css";
@import "@fontsource-variable/bodoni-moda/opsz-italic.css";
@import "@fontsource/rajdhani/latin-500.css";
@import "@fontsource/rajdhani/latin-700.css";
@import "@fontsource-variable/jetbrains-mono/wght.css";

/* Metric-matched fallbacks so the swap doesn't shift the HUD (tune size-adjust by measuring the "Hamburgefonstiv" width) */
@font-face { font-family: "Rajdhani Fallback"; src: local("Arial Narrow"), local("Roboto Condensed"), local("Arial");
  size-adjust: 92%; ascent-override: 98%; descent-override: 36%; line-gap-override: 0%; }
@font-face { font-family: "Bodoni Fallback"; src: local("Didot"), local("Bodoni 72"), local("Times New Roman");
  size-adjust: 100%; }
```

```css
:root {
  --f-display: "Bodoni Moda Variable", "Bodoni Fallback", Didot, serif;
  --f-voice:   "Bodoni Moda Variable", "Bodoni Fallback", Didot, serif;   /* used with font-style: italic */
  --f-ui:      "Rajdhani", "Rajdhani Fallback", "Arial Narrow", system-ui, sans-serif;
  --f-mono:    "JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, monospace;
  /* legacy aliases so existing rules keep working during the migration */
  --display: var(--f-display);
  --ui: var(--f-ui);
}
```

#### 2.3 Type scale

The root font size is 16px. Use rem tokens, and switch phone and desktop values at `(min-width: 1024px) and (min-height: 600px)`. Short landscape (`max-height: 430px`) gets its own HUD overrides (section 4.12).

| Token | Face / weight | Phone (390 / 844w) | Desktop 1440 | Line-height | Tracking | Case |
|---|---|---|---|---|---|---|
| `--t-wordmark` | Bodoni 500, `opsz` 96 | `clamp(3rem, 13vw, 4.5rem)` | `clamp(5rem, 8vw, 9rem)` | 0.9 | +0.28em | CAPS |
| `--t-display-l` (boss name, level-up, district) | Bodoni 600, opsz auto | 2.5rem | 4.5rem | 0.95 | −0.01em | Title Case |
| `--t-display-m` (screen titles, class name) | Bodoni 600 | 2rem | 3rem | 1.0 | −0.01em | Title Case |
| `--t-display-s` (panel titles, Cath's name, rare+ items) | Bodoni 700 | 1.375rem | 1.75rem | 1.1 | 0 | Title Case |
| `--t-voice` (quotes) | Bodoni italic 500 | 1.25rem | 1.5rem | 1.3 | 0 | Sentence |
| `--t-head` (section heads, button labels) | Rajdhani 700 | 1rem | 1.0625rem | 1.1 | +0.12em | CAPS |
| `--t-body-l` (subtitles, objective) | Rajdhani 500 | 1.0625rem | 1.25rem | 1.3 | +0.005em | Sentence |
| `--t-body` (tooltips, descriptions, settings) | Rajdhani 500 | 1rem | 1.0625rem | 1.35 | +0.01em | Sentence |
| `--t-label` (field labels, tabs) | Rajdhani 700 | 0.8125rem | 0.875rem | 1.15 | +0.14em | CAPS |
| `--t-micro` (eyebrows, chip text) | Rajdhani 700 | 0.75rem | 0.75rem | 1.1 | +0.18em | CAPS |
| `--t-data` (stat tables, feed, keycaps) | JetBrains Mono 500 | 0.8125rem | 0.875rem | 1.3 | 0 | as data |
| `--t-num-hero` (HP, ammo in mag) | Rajdhani 700 | 2rem / 2.75rem ammo | 2.5rem / 3.5rem ammo | 0.85 | −0.02em | — |
| `--t-num-l` (points, scrip, level) | JetBrains Mono 700 | 1.25rem | 1.5rem | 1 | −0.02em | — |

**Rules:**
- Never go below 12px (0.75rem). Rajdhani's x-height is small. The current 10.5–11.5px sizes all move up to `--t-micro` or `--t-label`.
- Running text (more than about 6 words) is always **sentence case Rajdhani 500**. Caps are only for labels of 4 words or fewer. This removes the three-line wrapped caps in the pause menu ("COLOUR-/BLIND/COLOURS").
- Display caps (the wordmark only) are tracked wide. Every other Bodoni use is Title Case with no tracking. Labels are tracked +0.14 to +0.18em, and the tracking is trimmed on the trailing letter with `margin-right: -0.14em` on centred labels.
- **Bodoni hairline rule:** Bodoni never sits directly on the 3D view below 28px. Below that size it must have a solid `--mat-ink` behind it.
- **Numerals:**
  - Everything numeric gets `font-variant-numeric: tabular-nums lining-nums`.
  - JetBrains Mono's default zero is distinct from O, which is acceptable because the mono is diegetic machine text. Don't turn on the `zero` feature.
  - Hero HUD numbers use Rajdhani 700 with `tabular-nums`. Engineers must check that Rajdhani honours `tnum` in the browser (measure the widths of `"0"` and `"1"`). If it doesn't, wrap the number in `.num-fixed { display:inline-block; min-width: calc(var(--digits) * 0.55em); text-align: right; }` and set `--digits` with `setProperty`.
- `text-wrap: balance` on all display headings and `text-wrap: pretty` on body copy.
- **Italics:** every `font-style: italic` currently on Fraunces (objective, subtitles, `.voice`, class quotes) is removed. Objectives and subtitles become Rajdhani 500 roman. `.voice` and class quotes become `--f-voice` italic.

#### 2.4 Cath keeps her look

Cath is drawn by `shared/cath/cath.ts` as SVG, and the UI type never touches her. Rules:
- **Outfit:** CATHODE always uses `outfit: "trench"` (the noir edition: charcoal gabardine, pearls, gloves). Change `ui/character.ts:254` and `ui/levelup.ts:32` from `"gown"` to `"trench"`. The title and gate already use the trench. This fixes the "pastel chibi" clash without redrawing her.
- **Allowed treatments, applied only on the wrapper element:**
  - A low-key grade: `filter: brightness(.9) contrast(1.06) saturate(.85)`.
  - Rim lights: `filter: drop-shadow(-2px 0 0 rgb(46 230 255/.55)) drop-shadow(3px 0 6px rgb(255 59 85/.45))`.
  - A floor shadow, and a scanline or grain overlay on the **frame** (a sibling layer).
- **Never allowed:** hue-rotate, glitch, chromatic offset, blur or clip-path through her face. Never put grain above her face at more than 0.05 opacity.
- **Frame:** her name is always set in `--t-display-s` Bodoni with the class in a `--t-micro` cyan eyebrow above it.
- **Idle animation:** her portrait frame may use `animate: true` (blink and breathing) on the title and the sheet. Under reduced motion, don't pass `animate`.

---

### 3. Tokens

New file `games/cathode/src/styles/tokens.css`, imported before everything else.

```css
:root {
  color-scheme: dark;

  /* --- colour: base (contrast vs --night #07080b in comments) --- */
  --night:   #07080b;   /* page */
  --night-2: #0c0e13;
  --panel:   #10131a;   /* opaque panel fill */
  --plate:   #1a1e28;   /* raised plate, keycap, input */
  --line-1:  rgb(235 230 220 / .08);  /* dividers */
  --line-2:  rgb(235 230 220 / .16);  /* frame rims */
  --line-3:  rgb(235 230 220 / .32);  /* hover rims */
  --ink:     #ebe6dc;   /* 16.1:1 body/headings */
  --ink-2:   #b4aea3;   /*  9.1:1 secondary */
  --ink-3:   #8a857c;   /*  5.5:1 tertiary; on --plate 4.5:1 = AA floor; never lighter backgrounds */
  --ink-dim: #4b4842;   /* disabled glyphs only (decorative, not AA) */

  /* --- colour: jobs --- */
  --blood:     #c8102e;  /* fills only (3.4:1 on night: never as small text) */
  --blood-hot: #ff3b55;  /* danger text/numbers: 5.7:1 night, 4.8:1 plate */
  --on-blood:  #fff4f0;  /* text on blood fill: 5.4:1 */
  --cyan:      #2ee6ff;  /* system/selection: 13.2:1 */
  --cyan-ink:  #7ff0ff;  /* cyan text on tinted cyan backgrounds */
  --amber:     #ffb347;  /* reward/points: 11.2:1 */
  --green:     #5fe08f;  /* stat up / heal: 12:1 */
  --steel:     #8fa3b8;  /* armour: 7.7:1 */
  --neon-pink: #ff2e88;  /* WORLD ONLY + Wirewitch accent */
  --cyan-rgb: 46 230 255; --blood-rgb: 255 59 85; --amber-rgb: 255 179 71;

  /* --- materials --- */
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.15' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --scan: repeating-linear-gradient(0deg, rgb(235 230 220 / .028) 0 1px, transparent 1px 3px);
  --mat-ink:   linear-gradient(180deg, rgb(18 21 29 / .94), rgb(9 10 14 / .96));          /* opaque panels */
  --mat-glass: linear-gradient(160deg, rgb(235 230 220 / .07), rgb(235 230 220 / .015)), rgb(10 12 18 / .72); /* only with backdrop-filter */
  --mat-scrim-b: linear-gradient(to top, rgb(4 5 8 / .78), rgb(4 5 8 / .4) 45%, transparent);
  --mat-plate: radial-gradient(closest-side, rgb(4 5 8 / .62), rgb(4 5 8 / .38) 70%, transparent);
  --hatch: repeating-linear-gradient(135deg, rgb(235 230 220 / .05) 0 2px, transparent 2px 7px);

  /* --- shape --- */
  --r-0: 0; --r-1: 2px; --r-2: 4px; --r-pill: 999px;       /* hard corners are the default */
  --cut-s: 6px; --cut-m: 12px; --cut-l: 20px;
  --tick: 10px;                                            /* bracket tick arm */

  /* --- elevation (box-shadow only on unclipped elements; clipped ones use filter) --- */
  --sh-1: 0 1px 0 rgb(0 0 0 / .6), 0 6px 14px -6px rgb(0 0 0 / .7);
  --sh-2: 0 18px 40px -16px rgb(0 0 0 / .85);
  --sh-in: inset 0 1px 0 rgb(235 230 220 / .07), inset 0 -1px 0 rgb(0 0 0 / .5);
  --glow-cyan:  0 0 0 1px rgb(var(--cyan-rgb) / .55), 0 0 18px rgb(var(--cyan-rgb) / .35);
  --glow-blood: 0 0 0 1px rgb(var(--blood-rgb) / .6), 0 0 20px rgb(var(--blood-rgb) / .35);
  --glow-amber: 0 0 0 1px rgb(var(--amber-rgb) / .6), 0 0 22px rgb(var(--amber-rgb) / .4);
  --hud-shadow: 0 1px 0 rgb(0 0 0 / .9), 0 0 8px rgb(0 0 0 / .75);  /* text-shadow for all HUD text */

  /* --- spacing (4px base) --- */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;
  --gutter: max(var(--sp-4), env(safe-area-inset-left), env(safe-area-inset-right));
  --hud-edge: clamp(12px, 2.2vw, 32px);

  /* --- z-layers (replace all 27 raw z-index values) --- */
  --z-world: 0; --z-fx: 10;        /* hurt vignette, scope, grain */
  --z-hud: 20; --z-hud-top: 30;    /* banners, boss intro, kill-cam caption */
  --z-touch: 40; --z-sheet: 50;    /* character sheet, district map */
  --z-modal: 60; --z-toast: 70; --z-tip: 80; --z-gate: 90;

  /* --- type tokens (phone) --- */
  --t-wordmark: clamp(3rem, 13vw, 4.5rem);
  --t-display-l: 2.5rem; --t-display-m: 2rem; --t-display-s: 1.375rem; --t-voice: 1.25rem;
  --t-head: 1rem; --t-body-l: 1.0625rem; --t-body: 1rem; --t-label: .8125rem; --t-micro: .75rem;
  --t-data: .8125rem; --t-num-hero: 2rem; --t-num-ammo: 2.75rem; --t-num-l: 1.25rem;
  --sub-scale: 1;  /* .large-subs sets 1.3 */

  /* --- motion (see section 5) --- */
  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --ease-in: cubic-bezier(.7, 0, .84, 0);
  --ease-io: cubic-bezier(.65, 0, .35, 1);
  --ease-back: cubic-bezier(.34, 1.56, .64, 1);
  --spring: linear(0, .009, .035 2.1%, .141, .281 6.7%, .723 12.9%, .938 16.7%, 1.017, 1.077, 1.121 24%, 1.149 26.8%, 1.159, 1.154 31.7%, 1.106 37.6%, 1.031 46.5%, 1.003 51.3%, .986 56.8%, .991 69.4%, 1 100%);
  --d-tap: 60ms; --d-1: 120ms; --d-2: 200ms; --d-3: 320ms; --d-4: 480ms; --d-hero: 900ms;
  --stagger: 40ms;
}
@media (min-width: 1024px) and (min-height: 600px) {
  :root {
    --t-wordmark: clamp(5rem, 8vw, 9rem);
    --t-display-l: 4.5rem; --t-display-m: 3rem; --t-display-s: 1.75rem; --t-voice: 1.5rem;
    --t-head: 1.0625rem; --t-body-l: 1.25rem; --t-body: 1.0625rem; --t-label: .875rem;
    --t-data: .875rem; --t-num-hero: 2.5rem; --t-num-ammo: 3.5rem; --t-num-l: 1.5rem;
  }
}
:root.large-subs { --sub-scale: 1.3; }

/* colour-safe (keep the existing Okabe-Ito mapping, now on job tokens) */
:root.colour-safe { --blood: #b84a00; --blood-hot: #ff7a1a; --amber: #f0e442; --neon-pink: #56b4e9; --blood-rgb: 255 122 26; --amber-rgb: 240 228 66; }

/* class accents (existing, kept) */
.cls-ghost{--accent:#2ee6ff;--accent-rgb:46 230 255}
.cls-butcher{--accent:#ff4a5e;--accent-rgb:255 74 94}
.cls-gunslinger{--accent:#ffb347;--accent-rgb:255 179 71}
.cls-wirewitch{--accent:#ff4fa0;--accent-rgb:255 79 160}
.cls-fixer{--accent:#a6f05a;--accent-rgb:166 240 90}
```

**Note on `--accent-rgb`:** the existing code uses `rgba(var(--accent-rgb), a)` with comma-separated values. During migration, keep **both** forms: `--accent-rgb: 46, 230, 255` for old rules and `--accent-sp: 46 230 255` for new `rgb(var(--accent-sp) / a)` rules. Then delete the comma form once no rules use it (grep).

**Contrast summary (measured):**

| Text | On night | On panel | On plate |
|---|---|---|---|
| `--ink` | 16.1 | 14.9 | 13.4 |
| `--ink-2` | 9.1 | 8.4 | 7.6 |
| `--ink-3` | 5.5 | 5.1 | 4.5 (the floor) |
| `--blood-hot` | 5.7 | | 4.8 |

- `--on-blood` on `--blood` is 5.4. Cyan and amber are 11 or more everywhere.
- `--blood` is a fill colour only (3.4:1).
- Over the 3D view, text contrast is guaranteed by the plates and `--hud-shadow`, never by the bare scene.

---

### 4. Components

New file `games/cathode/src/styles/components.css`. Existing class names (`.btn`, `.btn-primary`, `.btn-ghost`, `.cx-tab`, `.cx-node`, `.tip-*`, `.hud-*`) are restyled in place so the TypeScript barely changes.

#### 4.1 Frame (`.c-frame`, also applied to `.gate-card`, `.hud-pause-card`, `.cx-panel`, `.cp-detail`, `.dialog`, `.coach-card`)

The frame has three layers: a cut-corner rim, a fill with grain and scanlines, and bracket ticks. Box-shadow can't survive `clip-path`, so lift and glow go on the element as `filter`, and only on static screens.

```css
.c-frame {
  --cut: var(--cut-m); --rim: var(--line-2); --tk: rgb(235 230 220 / .5);
  --shape: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut));
  position: relative; isolation: isolate; padding: var(--sp-5);
}
.c-frame::before { /* rim */
  content: ""; position: absolute; inset: 0; z-index: -2; clip-path: var(--shape);
  background: linear-gradient(180deg, var(--line-3), var(--rim) 30%, var(--rim));
}
.c-frame::after { /* fill + texture + ticks */
  content: ""; position: absolute; inset: 1px; z-index: -1; clip-path: var(--shape);
  background:
    linear-gradient(var(--tk) 0 0) right 0 top 0 / var(--tick) 1px no-repeat,
    linear-gradient(var(--tk) 0 0) right 0 top 0 / 1px var(--tick) no-repeat,
    linear-gradient(var(--tk) 0 0) left 0 bottom 0 / var(--tick) 1px no-repeat,
    linear-gradient(var(--tk) 0 0) left 0 bottom 0 / 1px var(--tick) no-repeat,
    linear-gradient(180deg, rgb(235 230 220 / .06), transparent 2px),   /* top inner highlight */
    var(--scan), var(--grain), var(--mat-ink);
  background-blend-mode: normal, normal, normal, normal, normal, normal, soft-light, normal;
}
.c-frame.is-lifted { filter: drop-shadow(0 18px 30px rgb(0 0 0 / .7)); }
.c-frame.is-accent { --rim: rgb(var(--accent-sp, var(--cyan-rgb)) / .55); --tk: var(--accent, var(--cyan)); }
.c-frame.is-danger { --rim: rgb(var(--blood-rgb) / .55); --tk: var(--blood-hot); }
@supports (corner-shape: bevel) {   /* Chromium 139+: real borders and shadows */
  .c-frame { border-radius: var(--cut) 0 var(--cut) 0; corner-shape: bevel; }
}
```

**Header strip inside a frame:** `.c-frame > header` uses `--t-micro` cyan caps (the "file" eyebrow), then `--t-display-s` Bodoni, then a `1px var(--line-1)` rule with a 24px accent segment at the left made from a `linear-gradient` background.

#### 4.2 Buttons (`.btn` + `.btn-primary` / `.btn-ghost` / new `.btn-icon`)

```css
.btn {
  --cut: var(--cut-s);
  position: relative; display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
  min-height: 48px; padding: 0 var(--sp-5);
  font: 700 var(--t-head)/1 var(--f-ui); letter-spacing: .12em; text-transform: uppercase;
  color: var(--ink); background: transparent; border: 0; border-radius: 0; cursor: pointer;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%); /* ticket-stub: bottom-right cut */
  transition: transform var(--d-2) var(--spring), filter var(--d-2) var(--ease-out), background-color var(--d-2) var(--ease-out), color var(--d-2);
  -webkit-tap-highlight-color: transparent;
}
.btn::after { /* light sweep */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / .22) 50%, transparent 65%);
  transform: translateX(-120%);
}
@media (hover: hover) {
  .btn:hover { filter: brightness(1.08); }
  .btn:hover::after { transform: translateX(120%); transition: transform var(--d-4) var(--ease-out); }
}
.btn:active { transform: translateY(1px) scale(.985); transition-duration: var(--d-tap); filter: brightness(.92); }

.btn-primary { color: var(--on-blood); background:
  linear-gradient(180deg, rgb(255 255 255 / .14), transparent 45%), var(--blood);
  box-shadow: inset 0 -2px 0 rgb(0 0 0 / .35); }
.btn-ghost { background: linear-gradient(var(--line-2) 0 0) bottom / 100% 1px no-repeat, rgb(235 230 220 / .03); }
.btn-ghost::before { /* left tick */ content:""; position:absolute; left:0; top:0; bottom:0; width:2px; background: var(--line-3); transition: background var(--d-2); }
@media (hover: hover) { .btn-ghost:hover { background-color: rgb(235 230 220 / .08); } .btn-ghost:hover::before { background: var(--cyan); } }

.btn-icon { min-width: 44px; min-height: 44px; padding: 0; --cut: 5px; background: rgb(235 230 220 / .05); }
.btn-icon svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 1.6; }

/* focus: clip-path clips outlines, so draw brackets on a wrapper-safe pseudo via outline on a parent? No: use a drop-shadow halo */
.btn:focus-visible { outline: none; filter: drop-shadow(0 0 0 var(--cyan)) drop-shadow(0 0 1px var(--cyan)) drop-shadow(0 0 6px rgb(var(--cyan-rgb) / .8)); }
.btn[disabled], .btn[aria-disabled="true"] {
  cursor: not-allowed; color: var(--ink-dim); background: var(--hatch), var(--plate); box-shadow: none; filter: none; transform: none;
}
.btn .btn-key { /* optional keycap hint inside */ margin-left: var(--sp-2); }
```

Focus must be visible at 3:1 or better. Cyan on night is 13:1, and on blood fills the cyan halo sits outside the shape. Verify it in the screenshots.

#### 4.3 Keycap (`.c-key`, used in the pause binding table, tab hints, prompts and the slot row)

```css
.c-key { display: inline-grid; place-items: center; min-width: 1.9em; height: 1.9em; padding: 0 .45em;
  font: 600 var(--t-data)/1 var(--f-mono); color: var(--ink);
  background: linear-gradient(180deg, #232836, var(--plate)); border-radius: var(--r-1);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .1), 0 2px 0 #05060a, 0 0 0 1px var(--line-2); }
```

#### 4.4 Tabs (`.cx-tabs` / `.cx-tab`; new `.c-tabs` for pause)

```css
.cx-tabs { display: flex; align-items: stretch; gap: 0; border-bottom: 1px solid var(--line-1); }
.cx-tab { position: relative; padding: var(--sp-3) var(--sp-4); font: 700 var(--t-label)/1 var(--f-ui);
  letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); background: none; border: 0; }
.cx-tab::before { /* selection slab, Persona-style */
  content: ""; position: absolute; inset: 6px 4px; z-index: -1; background: rgb(var(--cyan-rgb) / .1);
  transform: skewX(-14deg) scaleX(0); transform-origin: left; transition: transform var(--d-3) var(--ease-out); }
.cx-tab::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px;
  background: var(--cyan); box-shadow: 0 0 10px rgb(var(--cyan-rgb) / .7); transform: scaleX(0); transition: transform var(--d-3) var(--ease-out); }
.cx-tab[aria-selected="true"] { color: var(--ink); }
.cx-tab[aria-selected="true"]::before { transform: skewX(-14deg) scaleX(1); }
.cx-tab[aria-selected="true"]::after { transform: scaleX(1); }
.cx-tab-dot { width: 6px; height: 6px; border-radius: 0; transform: rotate(45deg); background: var(--amber); }
```

At the ends of the tab bar, show `.c-key` hints "Q" and "E" on desktop only (`@media (hover:hover) and (pointer:fine)`). The JS cycles tabs on Q and E while the sheet is open.

#### 4.5 Tooltip (`.tip-*`, the Diablo-style item and skill tooltip)

```css
.tip { --rc: var(--ink); max-width: min(360px, calc(100vw - 2 * var(--gutter))); padding: 0; z-index: var(--z-tip);
  background: var(--mat-ink); box-shadow: 0 0 0 1px rgb(from var(--rc) r g b / .45), var(--sh-2); }
@supports not (color: rgb(from red r g b)) { .tip { box-shadow: 0 0 0 1px var(--line-2), var(--sh-2); } }
.tip-head { padding: var(--sp-3) var(--sp-4); background:
  linear-gradient(90deg, color-mix(in oklab, var(--rc) 22%, transparent), transparent 80%),
  linear-gradient(var(--rc) 0 0) left / 3px 100% no-repeat; }
.tip-name { font: 700 var(--t-display-s)/1.1 var(--f-display); color: var(--rc); }         /* rare, unique, set */
.r-standard .tip-name, .r-modded .tip-name { font: 700 var(--t-head)/1.1 var(--f-ui); letter-spacing: .06em; text-transform: uppercase; }
.tip-sub { font: 700 var(--t-micro)/1.2 var(--f-ui); letter-spacing: .18em; text-transform: uppercase; color: var(--ink-3); }
.tip-nums, .tip-rank, .tip-mods { font: 500 var(--t-data)/1.45 var(--f-mono); font-variant-numeric: tabular-nums; }
.tip-desc { padding: 0 var(--sp-4); font: 500 var(--t-body)/1.35 var(--f-ui); color: var(--ink-2); text-wrap: pretty; }
.tip-lore { font: italic 500 1rem/1.35 var(--f-voice); color: var(--ink-3); }  /* only place italic appears in small text; ≥16px, solid bg */
.tip .up { color: var(--green); } .tip .down { color: var(--blood-hot); }
.tip .up::before, .tip .down::before { content: ""; display: inline-block; width: 0; height: 0; margin-right: .3em; vertical-align: .12em;
  border: .3em solid transparent; }
.tip .up::before { border-bottom-color: currentColor; border-top-width: 0; }
.tip .down::before { border-top-color: currentColor; border-bottom-width: 0; }
```

On touch devices the tooltip becomes a bottom sheet (`.tip.is-sheet`, `position: fixed; inset: auto 0 0 0; max-height: 60dvh; overflow: auto`) with a drag handle bar 36×3px in `--line-3`.

#### 4.6 Cards (class list items `.cp-list > button`, inventory `.cx-cell`, weapon card `.cp-weapon`)

```css
.c-card { position: relative; padding: var(--sp-3) var(--sp-4); background: rgb(235 230 220 / .03);
  box-shadow: inset 0 0 0 1px var(--line-1); transition: background var(--d-2), box-shadow var(--d-2), transform var(--d-3) var(--ease-out); }
.c-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent, var(--cyan));
  transform: scaleY(.2); opacity: .4; transition: transform var(--d-3) var(--ease-out), opacity var(--d-2); }
@media (hover: hover) { .c-card:hover { background: rgb(235 230 220 / .06); } }
.c-card[aria-selected="true"], .c-card[aria-pressed="true"] {
  background: linear-gradient(90deg, rgb(var(--accent-sp) / .16), transparent 75%);
  box-shadow: inset 0 0 0 1px rgb(var(--accent-sp) / .5); transform: translateX(6px); }
.c-card[aria-selected="true"]::before { transform: none; opacity: 1; box-shadow: 0 0 12px var(--accent); }
```

**Inventory cell** (`.cx-cell`): a square with `--rc`. The background is `radial-gradient(circle at 50% 120%, color-mix(in oklab, var(--rc) 28%, transparent), transparent 70%), var(--plate)`. The rim is 1px at 40% of `--rc`. Rare and above get a 1px inner top highlight in `--rc`. Unique and set get the foil sheen from section 5.4 on hover only.

#### 4.7 Bars (HP, armour, XP, battery, boss, stat bars)

```css
.c-bar { --v: 1; --seg: 25; position: relative; height: 6px; background: rgb(235 230 220 / .08);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / .6); overflow: hidden; }
.c-bar > .fill, .hud-fill { position: absolute; inset: 0; transform-origin: left; transform: scaleX(var(--v));
  transition: transform var(--d-2) var(--ease-out); background: linear-gradient(90deg, var(--blood), var(--blood-hot)); }
.c-bar > .trail { /* damage ghost */ position: absolute; inset: 0; transform-origin: left; transform: scaleX(var(--trail, 1));
  background: rgb(235 230 220 / .55); transition: transform var(--d-4) var(--ease-io) 280ms; }
.c-bar.is-seg { /* notches: one gap per --seg units */
  -webkit-mask: repeating-linear-gradient(90deg, #000 0 calc(100% * var(--seg) / var(--max, 100) - 1px), transparent 0 calc(100% * var(--seg) / var(--max, 100)));
          mask: repeating-linear-gradient(90deg, #000 0 calc(100% * var(--seg) / var(--max, 100) - 1px), transparent 0 calc(100% * var(--seg) / var(--max, 100))); }
.c-bar.is-low > .fill { animation: low-pulse 1.1s var(--ease-io) infinite; }
@keyframes low-pulse { 50% { filter: brightness(1.6); } }
.c-bar.armour > .fill { background: linear-gradient(90deg, #5d6f82, var(--steel)); }
.c-bar.xp { height: 2px; } .c-bar.xp > .fill { background: var(--amber); }
```

- **Driving it:** JS sets `--v` (0–1), `--trail` and `--max` with `setProperty`. That means `transform` instead of `width`, so there's no layout. The HUD currently sets widths, so convert `hud.ts` fill updates to `style.setProperty('--v', String(frac))`.
- **Stat bars** (class pick and sheet) are `.c-bar.is-seg` with `--max: 10; --seg: 1`, giving 10 discrete pips, and the fill set to `var(--accent)`.

#### 4.8 Badges and chips

```css
.c-chip { display: inline-flex; align-items: center; gap: .4em; height: 22px; padding: 0 .6em;
  font: 700 var(--t-micro)/1 var(--f-ui); letter-spacing: .16em; text-transform: uppercase;
  color: var(--chip, var(--ink-2)); background: color-mix(in oklab, var(--chip, var(--ink)) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--chip, var(--ink)) 40%, transparent);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%); }
.c-chip .n { font-family: var(--f-mono); letter-spacing: 0; }
.c-chip.lvl { --chip: var(--amber); } .c-chip.danger { --chip: var(--blood-hot); } .c-chip.sys { --chip: var(--cyan); }
.c-points { /* sheet point counters */ display: grid; justify-items: center; gap: 2px; }
.c-points .n { font: 700 var(--t-num-l)/1 var(--f-mono); font-variant-numeric: tabular-nums; color: var(--amber); text-shadow: 0 0 14px rgb(var(--amber-rgb) / .45); }
.c-points .n[data-zero] { color: var(--ink-3); text-shadow: none; }
.c-points .l { font: 700 var(--t-micro)/1 var(--f-ui); letter-spacing: .18em; text-transform: uppercase; color: var(--ink-3); }
```

#### 4.9 Modals and sheets (`.dialog`, `.hud-pause`, `.cx`, `.coach.case-board`)

- **Backdrop:** `background: radial-gradient(120% 90% at 50% 40%, rgb(4 5 8 / .55), rgb(4 5 8 / .9))`, plus the `--grain` layer at opacity 0.06.
- **`backdrop-filter`:** `blur(14px) saturate(115%)` only on `.hud-pause` and `.cx`, because the render loop is paused while they're open, so the blur composites once. **Confirm in `session.ts` that rendering stops when paused or the sheet is open.** If it doesn't, drop the blur and use opaque `--mat-ink`. Add `@supports not (backdrop-filter: blur(1px))` with an opaque fallback.
- **Sheet layout:**
  - Desktop: `width: min(1240px, 100vw - 64px); height: min(820px, 100dvh - 64px)`, centred, as a `.c-frame.is-lifted`.
  - Phone landscape: full-bleed `inset: 0` with `padding: env(safe-area-inset-*)`, and the left rail collapses to a 64px icon rail.
  - Phone portrait: full-bleed, with tabs on top.
- **Scrolling:** content regions scroll internally with `overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--line-3) transparent`. The page itself never scrolls (this fixes the pause overflow).
- **Native `<dialog>` (settings):**
  - Enter: `@starting-style { opacity: 0; transform: translateY(12px) scale(.98) }`, then to none, over `var(--d-3) var(--ease-out)`.
  - Exit: `var(--d-2) var(--ease-in)` with `transition-behavior: allow-discrete` on `display` and `overlay`.

#### 4.10 Toasts and banners

- **Toast** (`.hud-feed-line.item`, `.levelup`, "new" toasts):
  - A plate on the right edge with a 3px left bar in the job colour (`--rc` for loot, amber for points, cyan for system).
  - Label in `--t-micro` caps, value in `--t-data` mono.
  - Enters with `clip-path: inset(0 0 0 100%)` going to `inset(0)` over `--d-3 --ease-out` and exits with opacity over `--d-2`.
  - At most 4 visible. The oldest leaves first.
- **Banner** (`.hud-banner`: district entered, objective complete):
  - Centred at 30% height.
  - Title in `--t-display-l` Bodoni with `text-shadow: var(--hud-shadow)`, over a horizontal `--mat-plate` band that is 100vw wide and 1.6× the text height, with 1px `--line-2` rules above and below that draw in from the centre (`scaleX(0→1)`).
  - Sub-line in `--t-label` cyan caps.
  - Holds 1.6s and exits with opacity plus `letter-spacing` going from +0 to +0.08em over `--d-4`.

#### 4.11 Signature HUD elements

All HUD text uses `text-shadow: var(--hud-shadow)`. No HUD element uses `backdrop-filter` or `filter`, because the HUD is per-frame over WebGL. Animate only `transform` and `opacity`.

**Vitals, bottom-left (`.hud-vitals`).** The block is 280px wide on desktop, 220px on phone, sitting on a `--mat-plate` ellipse behind it.

```
CATH HALE ─────────────── [LV 07]        ← --t-micro ink-2 caps; .c-chip.lvl
95 ▕██████▏██████▏██████▏███░░░▏         ← --t-num-hero Rajdhani 700; .c-bar.is-seg (seg 25, height 8px)
   ARM ▕█████████░░░▏ 35                 ← .c-bar.armour 3px; "ARM" micro steel, 35 in mono
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ (xp 2px amber)
```

- Below 30% HP, add `.is-low` to the bar. The number turns `--blood-hot` and the hurt vignette is already handled.
- On a hit, the HP number gets `.hit` (section 5).

**Arms, bottom-right (`.hud-arms`).** Right-aligned.

```
                      KESTREL .38  [MODDED]   ← --t-head caps; rarity chip in --rc
                           12 / 48            ← mag in --t-num-ammo Rajdhani 700; "/ 48" --t-num-l mono ink-3
             [1] Pistol [2] Shotgun [3] —     ← .hud-slot: .c-key + --t-label; active slot has cyan underline
             ▕██████████░░▏ battery           ← 3px cyan bar
```

- When ammo is at or below 25% of the magazine, the mag number turns amber. At 0 it turns `--blood-hot` and the prompt shows `[R] RELOAD`.

**Objective, top-left (`.hud-objective`).** A "case note".

```css
.hud-objective { max-width: min(42ch, 46vw); padding: var(--sp-2) var(--sp-3) var(--sp-2) var(--sp-4);
  background: linear-gradient(90deg, rgb(4 5 8 / .7), rgb(4 5 8 / .35) 70%, transparent);
  border-left: 2px solid var(--cyan); font: 500 var(--t-body-l)/1.3 var(--f-ui); color: var(--ink); }
.hud-objective::before { content: attr(data-case); display: block; margin-bottom: 2px;
  font: 700 var(--t-micro)/1 var(--f-ui); letter-spacing: .18em; text-transform: uppercase; color: var(--cyan); }
.hud-objective.is-new { animation: obj-in var(--d-4) var(--ease-out) both; }
@keyframes obj-in { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
```

`hud.ts` sets `data-case` (for example "Case · The Fish Market") from the job name. Add `.is-new` for 1s whenever the text changes, and play a soft synth tick.

**Waypoint (`.hud-wp`).**
- A 14px diamond: a rotated square with a 1.5px cyan border and a 4px centre dot, with a `--t-data` mono distance below it ("42 m").
- When the waypoint is off-screen, clamp it to the edge and swap in a chevron that points toward it.
- Within 8 m it fades to 40% opacity.
- It must use `transform: translate3d()` only.

**Subtitles (`.hud-sub`).** Netflix-style per-line backplates that never cross the HUD clusters.

```css
.hud-sub { position: absolute; left: 50%; bottom: calc(var(--hud-edge) + 92px); transform: translateX(-50%);
  width: min(46ch, calc(100vw - 2 * (var(--cluster-w, 280px) + var(--hud-edge) + 16px)));
  text-align: center; font: 500 calc(var(--t-body-l) * var(--sub-scale))/1.32 var(--f-ui); color: var(--ink); margin: 0; }
.hud-sub > .line { display: inline; padding: .12em .45em; background: rgb(4 5 8 / .72);
  -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.hud-sub-name { display: block; margin-bottom: 4px; font: 700 var(--t-micro)/1 var(--f-ui); letter-spacing: .18em;
  text-transform: uppercase; color: var(--speaker, var(--blood-hot)); text-shadow: var(--hud-shadow); }
```

- Wrap the spoken text in `<span class="line">` in `hud.ts`.
- Set `--speaker` per character, using the same speaker-colour map as the case file. Cath's colour is `--blood-hot`.
- `--cluster-w` is 220px on phone, which leaves about 360px of subtitle width in 844px landscape. That fixes the collision with the health block (`cathode-5-hud-phone.png`).

**Kill feed, top-right (`.hud-feed`).**
- Lines in `--t-data` mono, right-aligned, on a fading `--mat-plate`.
- Format: `HOLLOWELL ENFORCER  ·  HEADSHOT  +40 XP`. The kill noun is ink, the modifier is cyan caps and the XP is amber mono.
- A `.strong` line (an elite or boss) gets a 2px left bar in `--blood-hot`, and the name is set in `--t-head`.
- Lines enter with `translateX(12px)` and opacity over `--d-2`, sit for 4s, then fade over `--d-3`.
- Stagger by setting `--i` with `setProperty`.

**Crosshair (`.hud-cross`).**
- 1.5px ink arms with a `0 0 0 1px rgb(0 0 0/.6)` outline, done as box-shadow on each span.
- The spread gap animates through a `--spread` custom property (already numeric in JS), with `transform: translate` per arm.
- Hit marker (`.hud-hit`): four 45° ticks, ink on a body hit, `--blood-hot` on a headshot and amber on a kill. They scale 1.4 to 1 over `--d-2` with `--ease-back`.

**Scope (`.hud-scope`).**
- A full-screen radial mask: `radial-gradient(circle at 50% 50%, transparent 0 34vmin, rgb(0 0 0 / .96) 34.4vmin)`.
- The reticle's mil ticks are ink hairlines with JetBrains Mono 11px labels. Range and wind readouts sit at the lower right of the circle in `--t-data` cyan ("RNG 112 m", "WND ←3").
- A thin cyan ring at the circle's edge is a 1px inset box-shadow on a circular child.

**Boss intro (`.hud-boss`, existing letterbox).**
- Bars are `--night` at 11vh, sliding in over `--d-4 --ease-out`.
- The name is `--t-display-l` Bodoni 600, rising from translateY(16px) with `filter: blur(6px)` going to none over `--d-hero`.
- The title above it is `--t-label` blood-hot caps, for example "THE BUTCHER OF PIER 9".
- The boss HP bar is at the top centre, 50vw wide, `.c-bar.is-seg` with seg 10% and 8px high, with the boss name in `--t-label` above it.

**Interaction prompt (`.hud-prompt`).**
- `.c-key` plus a `--t-label` action ("[E] TAKEDOWN"), centred 18% below the crosshair, on a small plate.
- On touch, show the button glyph instead of the key.

**Touch buttons (`.tbtn`).**
- 56px circles at least (44px minimum), `rgb(4 5 8/.45)` fill, 1px `--line-2` rim and a 22px icon.
- `.tbtn-fire` is 72px with a `--blood` rim.
- Pressed: fill `rgb(var(--cyan-rgb)/.18)` and scale .94.
- Labels go to `aria-label` only, with no tiny text.

#### 4.12 HUD at short landscape (844×390)

```css
@media (max-height: 430px) and (orientation: landscape) {
  :root { --t-num-hero: 1.625rem; --t-num-ammo: 2.125rem; --t-body-l: .9375rem; --hud-edge: 10px; --cluster-w: 200px; }
  .hud-objective { max-width: 36ch; }
  .hud-feed { max-height: 4lh; }   /* 3 lines max visible */
  .hud-sub { bottom: calc(var(--hud-edge) + 64px); }
}
```

Respect safe areas: `.hud-root { padding: env(safe-area-inset-top) max(var(--hud-edge), env(safe-area-inset-right)) env(safe-area-inset-bottom) max(var(--hud-edge), env(safe-area-inset-left)); }`

---

### 5. Motion

#### 5.1 Curves and durations

These are in the tokens:
- `--ease-out` for entrances.
- `--ease-in` for exits.
- `--ease-io` for trails and pulses.
- `--ease-back` for hit markers and chips.
- `--spring` for presses released and reward numbers.

Durations: tap 60ms, d-1 120ms, d-2 200ms, d-3 320ms, d-4 480ms, hero 900ms. **Exits run at about 65% of the matching entrance.**

#### 5.2 Patterns

| Pattern | Recipe | Used on |
|---|---|---|
| **Draw-in frame** | `.c-frame` gets `animation: frame-in var(--d-4) var(--ease-out) both`. `@keyframes frame-in { from { clip-path: inset(0 100% 0 0); opacity: .4 } to { clip-path: inset(0); opacity: 1 } }`. The ticks get a separate fade 120ms later. | Pause, sheet, gate card, class detail |
| **Stagger** | `.stagger > * { animation: rise var(--d-3) var(--ease-out) both; animation-delay: calc(var(--i,0) * var(--stagger) + 60ms) }`. `@keyframes rise { from { opacity:0; transform: translateY(10px) } }`. `--i` is set with `el.style.setProperty('--i', i)` in `dom.ts`. Add a helper `stagger(parent)`. | Title menu, class list, settings rows, skill trees (per column), inventory |
| **Boot** | On session start, `.hud-root.is-booting` runs: the vitals and arms clusters draw in (clip-path) over d-4, the objective types on, and the crosshair scales 1.4 to 1. The whole thing takes about 700ms. | First frame of play, after load |
| **Glitch accent** | `.glitch { animation: glitch 260ms steps(2) 1 }` with `@keyframes glitch { 0% { text-shadow: -2px 0 rgb(var(--cyan-rgb)/.8), 2px 0 rgb(var(--blood-rgb)/.8); transform: translateX(1px) } 50% { text-shadow: 1px 0 rgb(var(--cyan-rgb)/.8), -1px 0 rgb(var(--blood-rgb)/.8); transform: translateX(-1px) } 100% { text-shadow: var(--hud-shadow); transform: none } }` | Wordmark on hover or reveal, HP number on a big hit, "SIGNAL LOST" text. **Never on Cath.** |
| **Hit** | HP number: `@keyframes hp-hit { 0% { transform: translateX(-3px) scale(1.12); color: #fff } 40% { transform: translateX(2px) } 100% { transform: none } }` over 180ms. The bar trail lags behind (4.7). | Damage taken |
| **Count-up** | JS tweens with `requestAnimationFrame` over 600ms using an ease-out cubic. Each integer change toggles `.tick`, which runs `@keyframes tick { from { transform: scale(1.14) } }` over 90ms. Tabular numerals keep the width stable. | Level-up, XP and scrip gained on the sheet, case-closed results |
| **Neon flicker** | `steps(1)` keyframes at 0/96/97/98/99%, with a 7s cycle and a random `animation-delay` set with `setProperty`. | Gate "18" sign and wordmark underline only |

#### 5.3 Reward moments (staged in beats)

**Level-up** (`ui/levelup.ts`; it replaces the current toast):
1. **Anticipation** (0–120ms): the HUD dims to 0.6 and a 1px amber line draws across the screen at 38% height.
2. **Burst** (120–420ms): the line splits into a 22vh letterbox band of `--mat-plate`. Twelve amber shards (`<i>` elements with `--ang` and `--dist` set with `setProperty`) shoot out from the centre (I4 recipe, 700ms). "LEVEL" appears in `--t-label` amber caps.
3. **Count-up** (420–900ms): the number counts from the old level to the new one in `--t-display-l` Bodoni 700, amber, with the tick punch. Cath's trench face portrait slides in from the left at 72px.
4. **Settle** (900–2600ms): "+1 ATTRIBUTE · +1 SKILL" in `--t-data` mono, with a `.c-key` "[K] OPEN SHEET" hint. Then the whole band exits over `--d-3`.

Pair each beat with a synthesised sound in `game/audio`: a riser, a hit, ticks and a chord.

**Loot drop of rare or better:** the kill feed line gets the `--rc` bar. A unique or set item also gets a one-shot sheen across the name: `@property --sheen { syntax:'<percentage>'; inherits:false; initial-value:-30% }`, animated from −30% to 130% over 900ms in a second `linear-gradient` background layer, with `background-clip: text` on a `span`.

**Skill learned:** the node scales .9, then 1.08, then 1 with `--spring`. Its ring fills (`--p` conic) over `--d-3`, the connector to its parent glows (`box-shadow` on the line) over 400ms, and the points counter ticks down.

**Kill-cam caption:** a `--t-voice` Bodoni italic line from Cath at the lower third, on the letterbox bar (never on the bare 3D view). It wipes in left to right over `--d-4`.

#### 5.4 Reduced motion

Honour both `@media (prefers-reduced-motion: reduce)` and `:root.reduce-motion`. Add a "Reduce motion" toggle in Settings → Accessibility, stored in `prefs.ts`, defaulting to the OS setting.

```css
@media (prefers-reduced-motion: reduce) { :root:not(.motion-ok) { --rm: 1; } }
:root.reduce-motion { --rm: 1; }
/* implement as a shared block applied under both selectors: */
.rm *, .rm *::before, .rm *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
.rm .glitch, .rm .hud-hp.hit, .rm .c-bar.is-low > .fill, .rm .flicker { animation: none !important; }
.rm .stagger > *, .rm .c-frame, .rm .hud-banner, .rm .levelup { animation: fade 160ms linear both !important; }
@keyframes fade { from { opacity: 0 } }
```

Put `.rm` on `<html>` from `main.ts`, both from the media query listener and from the pref.

Under reduced motion:
- Count-ups jump to the final value.
- The level-up keeps the band and the number but drops the shards and the shake.
- The objective appears without the wipe.
- Cath gets no `animate`.
- The trail bar keeps its delay. It's informational and slow, not vestibular.

---

### 6. Screens, ranked by impact

#### 1. HUD (`cathode-5-hud-desktop|landscape|phone.png`)

This is where players spend about 90% of their time. Today it's 11px labels, "95" and "ARM 35" in grey, faux-italic Fraunces subtitles running across the weapon, and a subtitle colliding with health on phone.

Changes:
- Vitals and arms clusters as in 4.11, with hero numerals, segmented HP with a damage trail, and armour as its own bar.
- The objective becomes a case note with a cyan rule, a "CASE ·" eyebrow and Rajdhani roman. The italic goes.
- Subtitles get per-line plates, a width clamped between the clusters and a coloured speaker name.
- The kill feed moves to mono.
- Waypoint diamond with a distance readout.
- `.hud-teach` ("WASD to move") becomes a `.c-frame` mini with `--cut-s` and real `.c-key` keycaps.
- The boot animation runs at session start.
- Short-landscape overrides as in 4.12.

#### 2. Gate (`cathode-1-gate-*`): the first impression

Today it has three flat CSS bokeh circles, Cath hidden behind the card and a Fraunces wordmark.

Changes:
- **Key art backdrop:** capture a real Drowned Market frame using `ui/photomode.ts` at 1920×1080. Save it as `games/cathode/public/keyart/market-1920.webp` (aim for 140 KB or less, quality 70) and as a 960 wide version (about 50 KB). Apply it as the `background-image` with `image-set()`, graded `brightness(.55) saturate(.9)` with a heavy bottom and left scrim. It's same-origin, so CSP is fine.
- **Cath:** the trench Cath at full height, left of centre on desktop, `height: 92dvh`, with a blood and cyan rim light, and her feet fading into a floor reflection (a `::after` gradient). On phone she sits behind the card at 60% height and `opacity: .9`, with the card at the bottom.
- **Card:** the right third becomes a `.c-frame.is-danger.is-lifted` card, with these contents in order:
  - "RATED 18" as a `.c-chip.danger`.
  - The CATHODE wordmark in Bodoni 500 at `--t-wordmark` with +0.28em tracking, plus a thin 1px `--blood-hot` underline that flickers.
  - The body text in `--t-body` Rajdhani.
  - The two violence options as `.c-card` radios. The selected card shows the blood accent bar, and the radio is a custom 14px diamond.
  - The buttons: the primary is "I'M 18 OR OVER" and the ghost is "TAKE ME BACK".
- **Rain:** replace the CSS-line rain with two `repeating-linear-gradient` layers at different angles and speeds, `background-position` animated over 0.6s and 0.9s, at 0.12 opacity. Under reduced motion it's static.
- **Bokeh:** delete the three big circles. The key art provides the bokeh.

#### 3. Character sheet (`cathode-4-character-sheet-phone|landscape.png`): "the dossier"

Today the skill nodes are two-letter monograms in dashed boxes, there are tiny tabs and the gown portrait.

Changes:
- **Skill sigils:** new `ui/skillsigil.ts` builds a deterministic 24×24 SVG per skill.
  - A hash of the skill id picks a composition of 2–3 primitives from a set of 12: ring, broken ring, chevron, double chevron, crosshair, bars, diamond, slash, dots triad, bracket pair, wave, arrowhead. Each is stroked `currentColor` at 1.6px.
  - The tree theme picks the base primitive, so each tree reads as a family.
  - This replaces `cx-node-mono`. Keep `monogram()` and its test as the accessible fallback text in `aria-label`.
- **Node shapes:**
  - Passive: a 44px square with `--cut-s`.
  - Active: a 48px circle.
  - Keystone or capstone: a 56px diamond (a rotated square, with the sigil counter-rotated).
- **Node states:**
  - Locked: the sigil at `--ink-dim` on `--night-2` with a `--line-1` rim. Not dashed.
  - Open: an accent rim at 50% and a hatch background.
  - Learned: a `rgb(var(--accent-sp)/.16)` fill, a 1px accent rim, a sigil in `--ink` and an outer rank arc.
  - Maxed: an amber rim with `--glow-amber` and an amber sigil.
  - "Can learn": a 2px cyan corner tick pulse (opacity only).
- **Rank:** a `conic-gradient(var(--accent) calc(var(--p) * 1turn), transparent 0)` ring masked to 2px around the node (`mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0)`), with `--p` set with `setProperty`. Plus a tiny `--t-micro` mono "3/20" under the node, shown on hover or focus and for learned nodes only.
- **Connectors:** 1px `--line-2`. Learned paths are 2px accent with a glow.
- **Tree column header:** the tree name in `--t-display-s` Bodoni, the theme in `--t-micro` caps, and the point total as a `.c-chip`.
- **Labels:** under each node, the skill name in `--t-micro` Rajdhani 700 caps, two lines at most, 72px wide, ink-3, turning ink when learned. Desktop only. On phone, names appear only in the tooltip sheet.
- **Left rail:**
  - The trench Cath portrait in a duotone frame (`.c-frame.is-accent`, `--cut-l`).
  - "GHOST" as a cyan micro eyebrow, "Cath Hale" in Bodoni `--t-display-s`, and level as a `.c-chip.lvl`.
  - The three `.c-points` counters (Attribute, Skill, Scrip) with mono numbers. Zero values are dimmed.
  - Vertical `.cx-tab`s with an icon and label.
  - "Save code" becomes a `.btn-ghost` with a mono code preview.
- **Panel:** the sheet panel is a `.c-frame` with `--scan`. The 2px diagonal hatching behind the trees goes. Use the `--grain` layer instead.
- **Tooltips:** as in 4.5.
- **Respec:** a `.btn-ghost` with a mono scrip cost. Its confirm dialog uses the `.c-frame.is-danger` modal.
- **Desktop:** fix the K key not opening the sheet at 1440×900 (an audit gap). Verify it in an e2e or lab shot.

#### 4. Pause and settings (`cathode-6-pause-*`)

Today it's an overflowing form, three-line caps labels and loud amber segments.

Changes:
- **Structure:** a two-pane `.c-frame` at `min(960px, 100vw - 48px)` × `min(640px, 100dvh - 48px)`.
  - The left rail lists Resume (`.btn-primary`), then the sections Display, Audio, Controls, Accessibility, then Quit to title (`.btn-ghost` danger text).
  - The right pane scrolls internally.
  - On phone landscape the rail becomes a top `.cx-tabs` row and Resume becomes a fixed `.btn-icon` "▶" plus label at the top right.
- **Heading:** "PAUSED" as a `--t-micro` cyan eyebrow and the district name in Bodoni `--t-display-m`. Drop "· click to play" and show "[ESC] RESUME" as a keycap hint.
- **Rows:** `grid-template-columns: minmax(10ch, 1fr) 2fr`. Labels are sentence case `--t-body` Rajdhani 500 in ink-2, so they never wrap into caps stacks. Under 520px of container width (`@container`), the label stacks above the control.
- **Segmented controls:** `--plate` buttons with a 1px `--line-1` divider. The selected one gets an ink text, a 2px cyan underline and `rgb(var(--cyan-rgb)/.1)`. **No amber fills.**
- **Sliders:** custom `input[type=range]` with a 2px `--line-2` track, a cyan filled portion through `--v` (`setProperty` on input), a 14px diamond thumb and a mono value readout on the right.
- **Key bindings:** a two-column table, action in Rajdhani and binding as `.c-key`s. Rebinding state is a pulsing cyan rim with "PRESS A KEY" in micro caps.
- **Accessibility section:** Large subtitles, Colour-safe palette, Reduce motion (new) and Look speed.

#### 5. Title (`cathode-2-title-*`)

- **Background:** the same key art as the gate with a different crop (`background-position: 70% 50%`).
- **Cath:** the trench Cath as a half figure on the right, rim-lit. The boxed portrait over two circles is deleted. The `.back` link moves to the top-left safe area as a `.btn-icon` plus a "GAMES" micro label, so it can't overlap her.
- **Copy column:** left-aligned at 38vw on desktop:
  - Eyebrow "HOLLOWELL PROPER · 2079" in `--t-micro` cyan.
  - The wordmark, with a glitch on first reveal.
  - The tagline in `--t-body-l` ink-2 at 40ch maximum.
  - The voice line in `--t-voice` Bodoni italic ink, with an em-rule before it.
  - The menu as a `.stagger` vertical list: the primary "BEGIN: THE FISH MARKET", then ghost buttons stacked at full column width, each 52px tall.
  - On desktop, show `.c-key` hints ("↵") on the focused item.
- **Hint:** `--t-micro` ink-3 at the bottom.
- **Landscape phone:** a two-column grid, copy left and Cath right at 100dvh height. The wordmark is clamped to 3.25rem so nothing is cut off.

#### 6. Class pick (`cathode-3-classpick-*`)

Today the desktop has 200px of empty space at the top and truncated copy, and on phone the class name is hidden under the tabs.

Changes:
- **Header:** "CHOOSE YOUR TRADE" in `--t-micro` cyan, with Cath's voice line in `--t-voice`.
- **Desktop grid:** `grid-template-columns: minmax(280px, 4fr) 8fr` with `align-content: center` and a 100dvh frame.
- **List:** `.c-card`s with the class name in `--t-head` caps and the fantasy line in `--t-body` ink-3 with **2-line clamp** (`-webkit-line-clamp: 2`) rather than single-line truncation.
- **Detail:**
  - The class name in `--t-display-l` Bodoni with an accent `text-shadow: 0 0 40px rgb(var(--accent-sp)/.35)`.
  - The emblem enlarged to 220px behind the name at 0.35 opacity, slowly rotating (60s per turn, off under reduced motion).
  - Stats as segmented pip bars.
  - The weapon as a ticket-stub `.c-frame` with a mono number table.
  - The quote in Bodoni italic.
- **Phone portrait:** the list becomes a horizontal snap scroller of chips at the top (`scroll-snap-type: x mandatory`). The detail is below it with the name at `--t-display-m`. Add top padding of `calc(env(safe-area-inset-top) + 56px)` so the name clears the tabs.
- **Transition:** switching class crossfades the detail over `--d-2`, and the accent colour transitions through `@property --accent` registered as `<color>`.

#### 7. Loading (`.loading`)

- Full-bleed night with a key-art blur (a pre-blurred 480px webp, about 15 KB, scaled up, since there's no live blur).
- The district name in `--t-display-l` Bodoni, centred at 42% height, with "ENTERING" in micro cyan above it.
- The loading line in `--t-data` mono, typed on with `clip-path` steps.
- The progress bar is a 1px `--line-2` hairline 40vw wide with an amber fill and ticks every 10% (`repeating-linear-gradient` background), with a mono percentage at the right ("064%"). Leading zeros in `--ink-dim` are fine here because it's diegetic.
- Rotating tip lines in `--t-body` ink-3, fading 3s each.

#### 8. District map (`ui/districtmap.ts`, `.coach.case-board.district-map`): the detective's board

- A `.c-frame` sheet with a dark board background: `--night-2` plus a 24px grid of `--line-1` hairlines plus grain.
- Districts as hairline polygons. The current district is filled `rgb(var(--cyan-rgb)/.06)`.
- District labels in `--t-label` caps. The current one is in Bodoni `--t-display-s`.
- Cath's position is a `--blood-hot` pin: a 10px circle with a 1px ring pulse.
- The objective is the cyan diamond.
- Leads are joined to their districts by **red string**: 1.5px `--blood` lines with a slight sag (SVG quadratic), and pinned index cards (`.c-card` with a mono case number).
- The travel options list sits at the right as `.btn-ghost` rows with a mono distance.
- The header is the district name in Bodoni, with "[M] CLOSE" as a keycap.

#### 9. Smaller pieces

- **Credits** (`credits.ts`): rolling Bodoni names with Rajdhani roles.
- **Photomode** (`photomode.ts`): mono readouts with keycap hints.
- **Gunsmith dialogs** (`cx-dlg*`): the `.c-frame` modal with mono costs.
- **Coach cards:** a `.c-frame` with `--cut-s` and keycaps.

---

### 7. Implementation plan

The main tree is being edited by the hourly build session, so every slice is built in a worktree branched from `origin/build` and lands through the normal build flow. Each slice is about one session (≤50 min), ends with `npm run check` green and screenshots taken before and after, and leaves the game shippable.

#### Slice 1: foundation (fonts and tokens)

**Files:**
- `package.json`: add `@fontsource-variable/bodoni-moda`, `@fontsource/rajdhani`, `@fontsource-variable/jetbrains-mono` (latest 5.x, exact versions).
- New `games/cathode/src/styles/fonts.css` and `games/cathode/src/styles/tokens.css`.
- `games/cathode/src/main.ts`: import order is fonts, then tokens, then components, then `styles.css`.
- `games/cathode/src/styles.css`:
  - Delete the 4 `@font-face` blocks.
  - Point `--display` and `--ui` at the new families.
  - Search and replace `font-style: italic` (5 rules): objective and subtitle go roman, `.voice` and class quote go to `--f-voice`.
  - Map every `font-weight: 600` to 700 and `800` to 700 for Rajdhani.
  - Add a global `.num, [data-num] { font-variant-numeric: tabular-nums lining-nums }`.
- `ui/character.ts` and `ui/levelup.ts`: change the outfit from `gown` to `trench`.
- Add `document.fonts.load('500 1em "Bodoni Moda Variable"')` with a 600ms race before revealing the gate (in `main.ts`), so the wordmark doesn't flash in the fallback face.

**New test:** `tests/cathode-ui-fonts.test.ts` reads `styles/*.css` and `styles.css` and asserts:
- No `Fraunces` or `Atkinson`.
- Every `font-weight` is in {400, 500, 600, 700, 800 only where the declared `font-family` or var is the Bodoni or mono variable}. Simpler version: Rajdhani rules may only use 500 or 700, enforced by a lint table of selectors that set `var(--f-ui)`.
- `italic` appears only alongside `--f-voice`.
- `z-index` values are only `var(--z-*)` (warn in slice 1, fail from slice 3).

**Payload check:** after `npm run build:site`, sum the latin woff2 files actually referenced. Run `ls dist-site/cathode/assets/*latin*.woff2 | xargs du -cb`, check the total is ≤ 184,320 bytes, and log the number in `DECISIONS.md`.

#### Slice 2: component layer

- New `games/cathode/src/styles/components.css` with `.c-frame`, `.btn` variants, `.c-key`, `.cx-tab`, `.c-card`, `.c-bar`, `.c-chip`, `.c-points`, `.tip`, dialog transitions and `.stagger`.
- Restyle the existing classes in place: `.gate-card`, `.hud-pause-card`, `.dialog` and `.cx-panel` get the frame recipe.
- `ui/dom.ts`: add `stagger(parent)` and `setVars(el, {k: v})` helpers that call `setProperty`.
- Migrate `--accent-rgb` from the comma form to the space form.
- Add the `.rm` class wiring to `main.ts` and `prefs.ts`.

#### Slice 3: HUD

- `ui/hud.ts`:
  - Bar fills move to `--v` and `--trail`.
  - Add a `.trail` span and the `data-case` attribute.
  - Subtitles wrapped in `.line`.
  - Hit and low classes.
  - Boot class.
  - Waypoint chevron when off-screen.
- `styles.css` HUD block: replace all raw `z-index` with tokens, and px sizes with tokens.
- **Performance check:** run with `?play` on desktop and compare `cathode.stats` frame times before and after. The HUD must add no layout per frame. Check in a Chrome performance trace (no "Layout" under the rAF on steady-state frames).

#### Slice 4: pause and settings

`hud.ts` pause DOM is restructured into the rail and sections. Add the Reduce motion toggle, keycap bindings, custom range and segmented controls, and internal scroll.

#### Slice 5: character sheet

New `ui/skillsigil.ts` with a unit test (`tests/cathode-ui-sigil.test.ts`) asserting determinism, uniqueness of at least 95% across the 150 skills, and that each sigil is valid SVG. Then update `ui/character.ts` node markup, the conic rank ring, the tree headers, the left rail and the tooltip restyle. Keep `treelayout.ts` positions untouched, with sizes as tokens. `tests/cathode-ui-treelayout.test.ts` must still pass.

#### Slice 6: gate, title and key art

Capture key art through photomode, then save it as `public/keyart/*.webp` (two sizes plus the blurred loading version, under 220 KB total). Then do the gate and title recomposition in `index.html`, `main.ts` and `styles.css`, the CSS rain and the wordmark flicker.

#### Slice 7: class pick

`ui/classpick.ts` and `ui/classart.ts`: the grid, line clamps, phone chip scroller and `@property --accent`.

#### Slice 8: loading, district map and reward moments

`districtmap.ts` (red-string board), `levelup.ts` (the four-beat sequence and audio cues), the loot sheen, the boss intro restyle and the kill-cam caption.

#### Slice 9: polish audit

A reduced-motion pass, a contrast audit (scripted, below) and a sweep for leftover raw hex and rgba values (target: fewer than 20 outside `tokens.css`).

#### Verification (every slice)

- **Screenshots:** extend `scripts/cathode-shots.mjs` to capture, at **390×844, 844×390 and 1440×900**:
  - gate (fresh storage);
  - title;
  - class pick;
  - HUD (`?play&shot`);
  - pause (`cathode.input.menuTapped = true`);
  - character sheet. Open it through `window.cathode`, or through the UI lab: `games/cathode/ui-lab.html` under `vite dev`, because K failed headless at desktop size.
  - level-up (trigger through the lab).

  Run each capture again with `page.emulateMedia({ reducedMotion: 'reduce' })`. Wait 1s or more between scripted inputs because swiftshader is slow. Kill any leftover `:4173` or `:4180` preview before shooting (see the CLAUDE.md note).
- **Contrast:** a Playwright `evaluate` in the shots script walks the visible text nodes on the static screens (gate, title, pause, sheet). It computes the WCAG ratio of the computed `color` against the nearest opaque ancestor background and prints any below 4.5 (or 3.0 for text of 24px+ or 18.66px bold). HUD text over the 3D view is checked by eye in the shots, against the bright neon areas of the street.
- **Must stay green:**
  - `npm run check`.
  - `npm run e2e:site`. `e2e-site/site.spec.ts` lines ~609–643 load `/cathode/`, set the prefs and wait for `cathode.stats.frames`. Keep the `#gate-yes`, `#btn-begin` and `cathode:prefs:v1` contract and the landing card `a[href="/cathode/"]`.
  - `e2e/csp.spec.ts`.
  - `tests/cathode-ui-text.test.ts`, `tests/cathode-ui-treelayout.test.ts` and `tests/cathode-skills.test.ts`.
  - The touch overlap report in `cathode-shots.mjs`: no overlap, and buttons at least 44px.
- **Gate 5** (`npm run gates`) before release.

#### Risks and mitigations

| Risk | Mitigation |
|---|---|
| **CSP** (`style-src 'self'`) | No `style=""` attributes anywhere. Per-element values (`--i`, `--v`, `--p`, `--trail`, `--accent`) go through `el.style.setProperty`, which CSSOM allows. Fontsource CSS is bundled by Vite into a same-origin stylesheet. The grain SVG data URI is allowed by `img-src data:`. Run `e2e/csp.spec.ts`, plus a console check for CSP violations in the shots script. |
| **Font payload and FOUT** | 171 KB total, and only 71 KB on the HUD path. `font-display: swap` with metric-matched fallbacks for Rajdhani. Bodoni is awaited for up to 600ms before the gate reveal. Unicode-range keeps the non-latin files from downloading. |
| **Rajdhani legibility at small sizes** | A 12px floor, weight 500 minimum, +0.01em tracking on body text, and sentence case for anything longer than 4 words. If the shots show problems at 390px, raise `--t-body` to 1.0625rem on phone. Don't change the face. |
| **Bodoni hairlines over 3D and at small sizes** | Bodoni sits on the 3D view only at 28px or more, and always with a plate. Smaller Bodoni only sits on opaque `--mat-ink`. Tooltips use Bodoni only for the names of rare and better items. |
| **Performance over WebGL on iPhone** | No `backdrop-filter` or `filter` on per-frame HUD elements. Bars use `transform: scaleX`. Blur is used only on screens where the render loop is paused (verify that). Clip-path frames are static. Grain is a static data URI. At most ~12 animated DOM nodes during the level-up. |
| **`clip-path` kills outlines and shadows** | Focus uses a `drop-shadow` halo. Lift goes on `filter` only on static screens. Use `corner-shape: bevel` when supported. |
| **Safari quirks** | Keep `-webkit-box-decoration-break`, `-webkit-mask` and `-webkit-line-clamp` alongside the unprefixed properties. `rgb(from …)` relative colour has an `@supports` fallback. `linear()` is Safari 17.2+, and older versions fall back to `ease-out` through a second declaration before the token. `@starting-style` is Safari 17.5+; without it the dialog just appears. |
| **Landscape 844×390 crowding** | Short-landscape token overrides (4.12), `--cluster-w`-aware subtitle width, a 3-line feed cap, and safe-area insets. Verify against the touch overlap report. |
| **Colour-blind mode** | All job colours are tokens overridden under `.colour-safe`. The `--*-rgb` triplets are updated as well. |
| **Merge collisions with the hourly session** | `styles.css` is touched by gameplay slices too. Put the new rules in the new `styles/*.css` files and restyle existing selectors there, deleting the old rule in `styles.css` in the same commit, so each slice's diff to `styles.css` is mostly deletions. |
## hedgerow
## Hedgerow UI design system: "The Fête Noticeboard"

Art direction spec, version 1, 2026-10-11. Scope: `/hedgerow/` only (`games/hedgerow/`). It is written for engineers to build from without other input.

**Facts I checked while writing this spec:**
- Font sizes come from the Fontsource 5.3.0 tarballs.
- I decoded the axes and the default figure widths from the woff2 files.
- I computed the contrast ratios with the WCAG formula.
- I looked at the audit shots in `scratchpad/aaa/audit/hedgerow-*`.
- The selectors come from `origin/build`.

I did not edit, build or commit anything.

---

### 1. Identity

1. **The idea.** Hedgerow's UI is a **village-fête noticeboard under siege by a logistics conglomerate**.
   - Everything the players own is painted oak, cream card stock, brass drawing-pins and inked lettering.
   - Everything Hollowell owns is glossy white plastic, corporate teal and smug sans-serif adverts.
   - That clash is the satire, and it follows STYLE.md §2 ("player things flat and inked, enemy things glossy").
2. **What we borrow from each reference:**
   - **Bloons TD 6:** chunky outlined counters, one fat Go button, and three colour-coded upgrade columns with tier pips.
   - **Kingdom Rush:** the world map as a place (flags and medallions on a painted landscape, ribbon banners for rounds and leaks) and wooden frames with metal corners.
   - **Hades:** story scenes with big portraits that break the frame, speaker nameplates in each character's colour, and text set like a book, not a chat bubble.
   - **Wytchwood:** the Almanac as a hand-inked field notebook with bookmark tabs and botanical plates.
3. **Tone.** The UI is cosy enough to sit in for an hour and sharp enough to land a joke. The joke always lives in the enemy's material and in the words, never in clutter.

---

### 2. Typography

#### 2.1 Faces and files (latin subset only, OFL-1.1)

| Role | Package | File to load | Size | Axes |
|---|---|---|---|---|
| **Display and voice** | `@fontsource-variable/fraunces@5.3.0` | `files/fraunces-latin-full-normal.woff2` | 121,016 B | opsz 9–144, wght 100–900, SOFT 0–100, WONK 0–1 |
| **UI, body and numbers** | `@fontsource-variable/nunito@5.3.0` | `files/nunito-latin-wght-normal.woff2` | 39,128 B | wght 200–1000 |
| **Total** | | | **160,144 B (about 156 KB)** | Under the 180 KB budget |

**Why these two:**
- **Fraunces "full", not one of the axis files.**
  - The `soft` file has no `opsz`, so display text would be stuck in the clumsy text-size cut the audit flagged.
  - The `opsz` file has no SOFT. SOFT is the storybook warmth.
  - Only "full" carries all four axes.
- **Nunito rather than Fredoka.**
  - Nunito's default figures are all the same width (600 units each), so counters never jitter. Its zero has no slash, which fixes the audit's "99399" and "0/0" debug look.
  - Its rounded terminals are friendly, and it goes up to weight 1000 for BTD6-style chunky numbers.
  - Fredoka has variable-width digits (396–608) and no `tnum` feature, so it was rejected.
  - Grandstander was rejected on budget grounds and because its figures are proportional by default.
- **STYLE.md's "two families only" rule still holds.** Nunito replaces Atkinson Hyperlegible **in Hedgerow only**. Log this in DECISIONS.md: "Hedgerow UI face: Nunito (tabular by default, no slashed zero, rounded)."

**Rules that follow from the choice of files:**
- **No italic file ships.**
  - Set `font-synthesis: none` on `:root`, which kills the faux italics and faux bolds the audit found.
  - Delete every `font-style: italic` in Hedgerow (`.alm-lore`, the story text, and any others).
  - The voice style in §2.3 replaces italic.
- **Fraunces figures are proportional, and its latin subset has no `tnum`.** Use Fraunces numerals only for numbers that never tick (a level number on a map node, "Round 7" on a banner, the star total on the end screen). Every live counter is Nunito.

#### 2.2 Loading (CSP-safe, no inline styles)

Create `games/hedgerow/src/ui/fonts.css` and import it first in `main.ts`, before `./styles.css`:

```css
@font-face {
  font-family: "Hedgerow Display";
  src: url("../../../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2") format("woff2-variations");
  font-weight: 100 900; font-style: normal; font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "Hedgerow UI";
  src: url("../../../../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2") format("woff2-variations");
  font-weight: 200 1000; font-style: normal; font-display: swap;
  unicode-range: /* same as above */;
}
/* Metric-matched fallbacks so the swap doesn't shift layout */
@font-face { font-family: "Hedgerow Display Fallback"; src: local("Georgia"); size-adjust: 104%; ascent-override: 92%; descent-override: 24%; }
@font-face { font-family: "Hedgerow UI Fallback"; src: local("Arial"); size-adjust: 101%; ascent-override: 101%; descent-override: 35%; }
```

**Notes for the engineer:**
- Vite hashes and emits relative `url()` paths. Adjust the `../` depth to wherever `fonts.css` lives. If you'd rather not use relative node_modules paths, `import url from "@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2?url"` plus `new FontFace(...)` and `document.fonts.add()` is equally CSP-safe.
- Tune the fallback overrides by eye with the shots (step 4 of slice S1).
- Remove the three `@font-face` blocks at the top of `games/hedgerow/src/styles.css` (lines 1–20, which point at `/fonts/`).
- **Leave `public/fonts/` alone.** The site and the other games still use it.

#### 2.3 Type scale

The root size is 16px. Phone means 390 wide or `max-height: 520px` landscape; desktop means 900px and wider. The tokens use `clamp()` so the in-between sizes interpolate.

| Token | Face and settings | Phone | Desktop | Line height | Tracking | Use |
|---|---|---|---|---|---|---|
| `--t-hero` | Display, wght 780, SOFT 100, WONK 0, opsz auto | 40px (2.5rem) | 64px (4rem) | 0.95 | -0.025em | Wordmark, end-screen headline |
| `--t-d1` | Display, wght 740, SOFT 100, WONK 0 | 30px | 44px | 1.0 | -0.02em | Round banner, act title, sheet title |
| `--t-d2` | Display, wght 690, SOFT 80, WONK 0 | 22px | 28px | 1.1 | -0.012em | Tower name, Almanac entry, speaker name |
| `--t-d3` | Display, wght 650, SOFT 60, WONK 0 | 17px | 19px | 1.15 | -0.005em | Path names, card titles, level names |
| `--t-voice` | Display, wght 430, SOFT 100, **WONK 1**, opsz 18 | 18px | 21px | 1.45 | 0 | Story lines, Cath's bubble, lore. This replaces italic. |
| `--t-body` | UI, wght 560 | 16px | 17px | 1.45 | 0.005em | Rules text, end-screen note |
| `--t-small` | UI, wght 600 | 14px | 15px | 1.35 | 0.01em | Path effect text, stats, tooltips (the minimum for prose) |
| `--t-label` | UI, wght 850, uppercase | 12px | 12.5px | 1.15 | +0.09em | Eyebrows, TIER tags, HUD captions (at most 3 words) |
| `--t-num-l` | UI, wght 950, tabular | 22px | 24px | 1.0 | -0.01em | HUD counters, path prices |
| `--t-num-xl` | UI, wght 1000, tabular | 40px | 56px | 0.9 | -0.02em | End-screen stats, the Next bonus |
| `--t-btn` | UI, wght 880 | 17px | 18px | 1.0 | 0.01em | Buttons |

```css
:root {
  --font-display: "Hedgerow Display", "Hedgerow Display Fallback", Georgia, serif;
  --font-ui: "Hedgerow UI", "Hedgerow UI Fallback", system-ui, sans-serif;
  --fs-hero: clamp(2.5rem, 1.4rem + 3.6vw, 4rem);
  --fs-d1: clamp(1.875rem, 1.3rem + 1.9vw, 2.75rem);
  --fs-d2: clamp(1.375rem, 1.15rem + .7vw, 1.75rem);
  --fs-d3: clamp(1.0625rem, 1rem + .2vw, 1.1875rem);
  --fs-voice: clamp(1.125rem, 1rem + .4vw, 1.3125rem);
  --fs-body: clamp(1rem, .97rem + .1vw, 1.0625rem);
  --fs-small: clamp(.875rem, .85rem + .1vw, .9375rem);
  --fs-label: .75rem;
  --fs-num-l: clamp(1.375rem, 1.3rem + .25vw, 1.5rem);
  --fs-num-xl: clamp(2.5rem, 1.9rem + 2vw, 3.5rem);
  --track-label: .09em; --track-display: -.02em;
  font-synthesis: none;
}
.t-display { font-family: var(--font-display); font-optical-sizing: auto;
  font-variation-settings: "SOFT" 100, "WONK" 0; text-wrap: balance; letter-spacing: var(--track-display); }
.t-voice { font-family: var(--font-display); font-weight: 430; font-size: var(--fs-voice); line-height: 1.45;
  font-variation-settings: "opsz" 18, "SOFT" 100, "WONK" 1; text-wrap: pretty; }
.t-label { font: 850 var(--fs-label)/1.15 var(--font-ui); text-transform: uppercase; letter-spacing: var(--track-label); }
.t-num { font-family: var(--font-ui); font-variant-numeric: tabular-nums lining-nums; font-weight: 950; }
/* Outlined BTD6-style numerals for counters over art */
.t-num-ink { color: var(--paper-hi); -webkit-text-stroke: .16em var(--ink); paint-order: stroke fill;
  text-shadow: 0 .09em 0 var(--ink); }
@supports not (paint-order: stroke) { .t-num-ink { -webkit-text-stroke-width: .05em; } }
```

**Rules:**
- **Casing.**
  - Sentence case everywhere, in British English.
  - Proper names (towers, paths, levels and characters) keep their current Title Case.
  - Uppercase only on `--t-label` (eyebrows, "Tier 2", "Round", "Leak") and never on Fraunces.
  - No emoji anywhere (STYLE §12). Replace 📖 ☀ ◆ ★ 🔒 with SVGs from `icons.ts`.
- **Numerals.**
  - Every number that can change uses `.t-num`.
  - Use "/" with thin spaces only where a test doesn't read the text. `#hud-wave` must stay exactly `1/12`.
  - Keep the literal `x1`/`x3` on `#btn-speed`, and keep `Go` and `Next +N` on `#btn-send`. The e2e tests assert these strings.
- **Nothing a player must read goes below 14px.** Labels may be 12px only when they are uppercase, weight 850 or more, and a duplicate of meaning (a caption next to an icon).
- **Text alignment.** Left-align all multi-line text. Centre only one-line headings, numerals and buttons. This fixes the Almanac's centred paragraphs.

#### 2.4 How Cath keeps her look

- `shared/cath/` SVGs are never recoloured, filtered or blended. The only treatments allowed are a `drop-shadow` filter on the frame wrapper and a CSS `clip-path` or mask on the frame.
- Keep the `.cath-animate` idle (`shared/cath/cath.css`) and its reduced-motion rule.
- Cath appears in three standard frames (recipes in §4.12):
  1. **Medallion:** a brass ring over a paper mat, used in the HUD hero ability, the end screen and the Cath button.
  2. **Stage:** frameless, full height, breaking out of the panel edge. Used in story scenes and the end-screen win.
  3. **Bubble face:** a 40px medallion beside the field bubble.
- Cath's speech always uses `--t-voice`. Her nameplate colour is `--cath` (#7A3B52, which already marks her button). She is the only character with a brass nameplate rim. That is her "classy" mark.

---

### 3. Tokens

Create `games/hedgerow/src/ui/tokens.css`. Old names (`--paper`, `--ink`, `--soil`, `--pasture`, `--clay`, `--wheat`, `--surface`, `--paper-2`, `--ink-muted`, `--focus`, `--backdrop`) stay as aliases, so the existing 3,273 lines keep working while the slices migrate them.

#### 3.1 Colour

```css
:root {
  color-scheme: light;
  /* Paper (content) */
  --paper-hi: #FFF7E6;  --paper: #F4EDE1;  --card: #FBF3E2;  --kraft: #D9C9A8;  --paper-shade: #E9DFCB;
  /* Ink */
  --ink: #2B2320;  --ink-2: #5E5249;  --ink-3: #6E625A;
  /* Oak (chrome) */
  --oak-hi: #8A6238;  --oak: #6B4A2B;  --oak-lo: #4A3220;  --oak-ink: #3A2716;
  /* Brass (rims, currency, focus) */
  --brass-hi: #F2D27A;  --brass: #E7C36A;  --brass-mid: #B88A2E;  --brass-lo: #7A5718;
  /* Player semantic */
  --pasture: #5B7F3A;  --pasture-deep: #466A2B;  --pasture-ink: #2C4519;
  --harvest: #9A4F12;  --harvest-hi: #C47A2C;            /* Next / early bonus */
  --clay: #B5523B;  --clay-deep: #8F3B27;                  /* leak, danger */
  --goodwill: #C4433A;  --marks: #D9B45A;  --marks-ink: #7A5718;
  --cath: #7A3B52;
  /* Upgrade paths (left, middle, right) */
  --path-0: #8F3B27; --path-0-soft: #F6DDD3;
  --path-1: #365A8A; --path-1-soft: #DCE6F2;
  --path-2: #466A2B; --path-2-soft: #E1EBD4;
  /* Enemy material (Hollowell): never on player UI */
  --corp: #0E5E63;  --corp-hi: #1E8C8C;  --plastic: #FFFFFF;  --plastic-shade: #E6EEF0;  --corp-ink: #0B2E31;
  /* Overlays */
  --scrim: rgb(28 20 14 / .55);  --scrim-strong: rgb(28 20 14 / .72);
  --focus-ink: var(--ink);  --focus-halo: var(--brass-hi);
}
@media (prefers-color-scheme: dark) { :root {   /* "Evening at the fête" */
  color-scheme: dark;
  --paper-hi: #3A2F27; --paper: #1C1714; --card: #2A221D; --kraft: #4A3B2E; --paper-shade: #241C17;
  --ink: #F3E9D8; --ink-2: #D6C7B2; --ink-3: #B9AA98;
  --oak-hi: #7A5634; --oak: #553A22; --oak-lo: #3A2716; --oak-ink: #120C08;
  --path-0-soft: #3B231C; --path-1-soft: #1E2A3A; --path-2-soft: #23301A;
  --focus-ink: #F3E9D8; --scrim: rgb(0 0 0 / .6);
} }
```

**Checked contrast pairs** (all AA; anything under 4.5 is listed with the rule it falls under):

| Text on fill | Ratio | Rule |
|---|---|---|
| ink #2B2320 on card #FBF3E2 | 13.9 | |
| ink-2 #5E5249 on card | 6.8 | |
| ink-3 #6E625A on card | 5.35 | Secondary text minimum |
| paper-hi #FFF7E6 on pasture-deep #466A2B | 5.87 | Go |
| paper-hi on harvest #9A4F12 | 5.63 | Next. The current #B0631E is only 4.24, so change it. |
| paper-hi on clay-deep #8F3B27 | 6.98 | |
| paper-hi on cath #7A3B52 | 7.65 | |
| paper-hi on path-1 #365A8A | 6.60 | |
| paper-hi on oak-ink #3A2716 | 13.3 | |
| brass-hi #F2D27A on oak-ink | 9.6 | HUD captions on the plank |
| ink on brass #E7C36A | 9.1 | |
| path-0, path-1, path-2 as text on card | 6.7, 6.4, 5.7 | |
| marks-ink #7A5718 on card | 5.94 | Prices on paper |
| corp #0E5E63 and white, either way round | 7.5 | |
| dark theme: ink #F3E9D8 on #241C17 | 13.9 | |
| dark theme: ink-3 #B9AA98 on #241C17 | 7.4 | |

**Never put text** on `--clay` (#B5523B), `--pasture` (#5B7F3A) or `--harvest-hi`. Those are for shapes only, per STYLE §3.6.

#### 3.2 Materials

This is a Hedgerow amendment to STYLE §14. "No gradients on player elements" becomes: **player materials may carry one painted top-light (a lightness change of 6% or less) plus grain. Enemy materials carry the glossy highlight.** Log it in DECISIONS.md.

```css
:root {
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .17 0 0 0 0 .13 0 0 0 0 .1 0 0 0 .5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --woodgrain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='60'%3E%3Cfilter id='w'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.004 .35' numOctaves='2' seed='4'/%3E%3CfeColorMatrix values='0 0 0 0 .1 0 0 0 0 .06 0 0 0 0 .03 0 0 0 .9 -.25'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23w)'/%3E%3C/svg%3E");
  --mat-paper: var(--grain), linear-gradient(180deg, var(--paper-hi), var(--card) 40%, var(--card));
  --mat-oak: var(--woodgrain), linear-gradient(180deg, var(--oak-hi), var(--oak) 45%, var(--oak-lo));
  --mat-brass: linear-gradient(180deg, var(--brass-hi), var(--brass) 38%, var(--brass-mid) 55%, var(--brass) 78%, var(--brass-hi));
  --mat-kraft: var(--grain), var(--kraft);
  --mat-plastic: linear-gradient(180deg, #fff 0 48%, var(--plastic-shade) 52% 100%);  /* hard gloss line = enemy */
}
```

**Grain rules:**
- Grain opacity is built into the SVG (alpha 0.5 × the multiplied layer), so set it with `background-blend-mode: multiply`. It should read at about 5–7%.
- Grain goes on sheets, the HUD plank, the tray and map cards only. That is at most about 8 elements on screen.
- Never put grain on per-enemy floaters, on chips, or on anything full-screen over the canvas.

#### 3.3 Spacing, radii and shadows

```css
:root {
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --sp-6: 32px; --sp-7: 40px; --sp-8: 56px;
  --r-xs: 6px; --r-s: 10px; --r-m: 14px; --r-l: 20px; --r-xl: 28px; --r-pill: 999px;
  --r-note: 5px 9px 6px 8px;          /* slightly hand-cut paper notes only */
  --stroke: 2px;                      /* ink outline width, STYLE §5 */
  /* Elevation: ink outline + hard drop (cartoon), then a soft lift for floating things */
  --sh-0: 0 0 0 var(--stroke) var(--ink);
  --sh-1: 0 0 0 var(--stroke) var(--ink), 0 3px 0 var(--ink);
  --sh-2: 0 0 0 var(--stroke) var(--ink), 0 4px 0 var(--ink), 0 12px 22px -10px rgb(43 35 32 / .45);
  --sh-3: 0 0 0 var(--stroke) var(--ink), 0 6px 0 var(--ink), 0 24px 44px -16px rgb(28 20 14 / .55);
  --bevel: inset 0 2px 0 rgb(255 255 255 / .45), inset 0 -3px 0 rgb(0 0 0 / .18);
  --groove: inset 0 2px 3px rgb(0 0 0 / .35), inset 0 -1px 0 rgb(255 255 255 / .12);
  /* Glows (rewards and readiness only) */
  --glow-brass: 0 0 0 3px var(--brass-hi), 0 0 18px 4px rgb(242 210 122 / .55);
  --glow-pasture: 0 0 0 3px #9CCB6E, 0 0 16px 3px rgb(156 203 110 / .5);
  --glow-clay: 0 0 0 3px #E59A86, 0 0 18px 4px rgb(181 82 59 / .55);
  --safe-t: env(safe-area-inset-top); --safe-b: env(safe-area-inset-bottom);
  --safe-l: env(safe-area-inset-left); --safe-r: env(safe-area-inset-right);
}
```

#### 3.4 Z-layers

These replace the scattered z-index values in `styles.css`.

```css
:root {
  --z-canvas: 0; --z-fx: 10; --z-field-ui: 20;   /* bubble, intro, choose-chip, paused-note, duel */
  --z-hud: 30; --z-panel: 40; --z-banner: 50; --z-toast: 55;
  --z-tooltip: 60; --z-drag: 70;   /* <dialog> sheets use the native top layer */
}
```

#### 3.5 Motion

The motion tokens are defined here; how to use them is in §5.

```css
:root {
  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --ease-in: cubic-bezier(.7, 0, .84, 0);
  --ease-back: cubic-bezier(.34, 1.56, .64, 1);
  --spring: var(--ease-back);   /* fallback for iOS < 17.2 */
  --dur-press: 40ms; --dur-1: 120ms; --dur-2: 200ms; --dur-3: 380ms; --dur-hero: 650ms;
  --stagger: 45ms;
}
@supports (transition-timing-function: linear(0, 1)) { :root {
  --spring: linear(0, .009, .035 2.1%, .141, .281 6.7%, .723 12.9%, .938 16.7%, 1.017, 1.077, 1.121 24%, 1.149 26.8%, 1.159, 1.154 31.7%, 1.106 37.6%, 1.031 46.5%, 1.003 51.3%, .986 56.8%, .991 69.4%, 1 100%);
} }
```

---

### 4. Components

These go in `games/hedgerow/src/ui/components.css`. Each recipe names the existing selectors it should be applied to. Prefer rewriting those rules over adding new classes, so `main.ts`/`map.ts` churn stays small.

#### 4.1 Frames

**A. Noticeboard sheet (dialogs).**
- Used by `.sheet`, `#dlg-result`, `#dlg-almanac`, `#dlg-bank` and `#dlg-cath`.
- Paper inside an oak frame, with brass pins in the corners. Desktop shows the full frame. Phone shows a bottom sheet with the oak frame on the top edge only.

```css
.sheet {
  --frame: 10px;
  border: var(--frame) solid transparent; border-radius: var(--r-xl);
  background: var(--mat-paper) padding-box, var(--mat-oak) border-box;
  background-blend-mode: multiply, normal, normal;
  box-shadow: var(--sh-3), inset 0 0 0 2px rgb(58 39 22 / .35);
  padding: var(--sp-5) var(--sp-5) calc(var(--sp-5) + var(--safe-b));
  color: var(--ink); max-width: min(560px, calc(100vw - 2 * var(--sp-4)));
  position: relative;
}
.sheet::before {   /* brass pins, four corners, one pseudo */
  content: ""; position: absolute; inset: calc(-1 * var(--frame) + 3px); pointer-events: none;
  background:
    radial-gradient(circle at 35% 30%, var(--brass-hi), var(--brass-mid) 55%, var(--brass-lo) 70%, transparent 72%) 0 0 / 12px 12px no-repeat,
    radial-gradient(circle at 35% 30%, var(--brass-hi), var(--brass-mid) 55%, var(--brass-lo) 70%, transparent 72%) 100% 0 / 12px 12px no-repeat,
    radial-gradient(circle at 35% 30%, var(--brass-hi), var(--brass-mid) 55%, var(--brass-lo) 70%, transparent 72%) 0 100% / 12px 12px no-repeat,
    radial-gradient(circle at 35% 30%, var(--brass-hi), var(--brass-mid) 55%, var(--brass-lo) 70%, transparent 72%) 100% 100% / 12px 12px no-repeat;
}
.sheet::backdrop { background: radial-gradient(120% 90% at 50% 40%, rgb(28 20 14 / .35), var(--scrim-strong)); }
@media (max-width: 520px) {
  .sheet:not(.story) { margin: auto 0 0; width: 100%; max-width: none; border-width: var(--frame) 0 0;
    border-radius: var(--r-xl) var(--r-xl) 0 0; max-height: 88svh; overflow-y: auto; }
}
```

- **Ribbon header** (sheet titles; the eyebrow and h2 pair):
  - The `.eyebrow` sits in a kraft tab above the h2.
  - The h2 uses `--t-d1`, is left-aligned on phone and centred on desktop.
  - A hand-ruled underline sits beneath it: `background: linear-gradient(var(--ink), var(--ink)) 0 100%/48px 3px no-repeat; padding-bottom: 10px`.

**B. Oak plank (top HUD bar and bottom tray).**

```css
.hud, .controls {
  background: var(--mat-oak); background-blend-mode: multiply, normal;
  border-radius: var(--r-l); box-shadow: var(--sh-2), var(--bevel); padding: var(--sp-2) var(--sp-3);
  color: var(--paper-hi);
}
.hud { margin: calc(var(--sp-2) + var(--safe-t)) calc(var(--sp-2) + var(--safe-r)) 0 calc(var(--sp-2) + var(--safe-l)); }
```

- **Paper note** (field `.bubble`, `.intro`, `.cath-tip`): `background: var(--mat-paper); border-radius: var(--r-note); box-shadow: var(--sh-1);` plus a brass pin (`::before`, 12px radial, top-left, rotated -6°).
- **Hollowell advert** (enemy material; `#toast` when it introduces an enemy, the boss bar, the boss banner):

```css
.advert { background: var(--mat-plastic); color: var(--corp-ink); border-radius: var(--r-m);
  box-shadow: 0 1px 0 rgb(255 255 255 / .9) inset, 0 10px 24px -10px rgb(11 46 49 / .5); /* NO ink outline */
  font-family: var(--font-ui); }
.advert .t-label { color: var(--corp); }
.advert::after { /* the satirical stripe */ content: ""; position: absolute; inset: auto 0 0 0; height: 6px;
  background: repeating-linear-gradient(90deg, var(--corp) 0 18px, var(--corp-hi) 18px 36px); border-radius: 0 0 var(--r-m) var(--r-m); }
```

#### 4.2 Buttons

```css
.btn {
  --fill: var(--card); --fg: var(--ink); --edge: var(--ink);
  font: 880 var(--fs-btn, 1.0625rem)/1 var(--font-ui); letter-spacing: .01em; color: var(--fg);
  min-height: 48px; padding: 0 var(--sp-5); border: 0; border-radius: var(--r-m);
  background: linear-gradient(rgb(255 255 255 / .28), rgb(255 255 255 / 0) 55%), var(--fill);
  box-shadow: 0 0 0 var(--stroke) var(--edge), 0 4px 0 var(--edge), var(--bevel);
  transform: translateY(0);
  transition: transform var(--dur-2) var(--spring), box-shadow var(--dur-2) var(--spring), filter var(--dur-2);
  text-wrap: balance; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
}
.btn-primary, .win-actions .btn:first-child, #story-next, .btn.send { --fill: var(--pasture-deep); --fg: var(--paper-hi); --edge: var(--pasture-ink); }
.btn.send.early { --fill: var(--harvest); --edge: #4E2606; }
.btn-danger { --fill: var(--clay-deep); --fg: var(--paper-hi); --edge: #4A1C10; }
.btn-quiet { --fill: transparent; box-shadow: inset 0 0 0 var(--stroke) var(--ink-3); }

@media (hover: hover) { .btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.05) saturate(1.06);
  box-shadow: 0 0 0 var(--stroke) var(--edge), 0 6px 0 var(--edge), var(--bevel); } }
.btn:active:not(:disabled) { transform: translateY(4px); transition-duration: var(--dur-press);
  box-shadow: 0 0 0 var(--stroke) var(--edge), 0 0 0 var(--edge), inset 0 3px 0 rgb(0 0 0 / .18); }
.btn:disabled { --fill: var(--paper-shade); --fg: var(--ink-3); --edge: var(--ink-3); cursor: not-allowed;
  background: repeating-linear-gradient(135deg, transparent 0 6px, rgb(0 0 0 / .04) 6px 12px), var(--fill);
  box-shadow: 0 0 0 var(--stroke) var(--edge); transform: none; filter: none; }
.btn:focus-visible, .icon-btn:focus-visible, .path-buy:focus-visible, .node:focus-visible, .ability:focus-visible {
  outline: 3px solid var(--focus-ink); outline-offset: 3px; box-shadow: 0 0 0 var(--stroke) var(--edge, var(--ink)), 0 4px 0 var(--edge, var(--ink)), 0 0 0 9px var(--focus-halo); }
.btn:focus:not(:focus-visible) { outline: none; }   /* fixes the black ring on "Try again" when the dialog opens */
```

**Icon button** (`.icon-btn`: back, pause, sound, sheet close): a 44px brass-rimmed oak disc.

```css
.icon-btn { width: 44px; height: 44px; border-radius: 50%; border: 3px solid transparent; color: var(--paper-hi);
  background: var(--mat-oak) padding-box, var(--mat-brass) border-box; box-shadow: 0 0 0 var(--stroke) var(--ink), 0 3px 0 var(--ink); }
.icon-btn svg { width: 22px; height: 22px; stroke: currentColor; stroke-width: 2.4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.icon-btn[aria-pressed="true"] { background: var(--mat-brass) padding-box, var(--mat-brass) border-box; color: var(--oak-ink); }
```

Press, hover and focus behave as for `.btn`, but with `scale(.94)` instead of `translateY`.

#### 4.3 Tabs (Almanac and Cath sheet): bookmark ribbons

```css
.almanac-tabs { display: flex; gap: var(--sp-1); border-bottom: 3px solid var(--oak); padding-inline: var(--sp-2); overflow-x: auto; scrollbar-width: none; }
.alm-tab { position: relative; min-height: 44px; padding: 0 var(--sp-4) 2px; border: 0; border-radius: var(--r-s) var(--r-s) 0 0;
  font: 800 var(--fs-small)/1 var(--font-ui); color: var(--ink-2); background: var(--mat-kraft); background-blend-mode: multiply, normal;
  box-shadow: inset 0 -4px 6px -4px rgb(0 0 0 / .25); transform: translateY(3px); transition: transform var(--dur-2) var(--ease-out); }
.alm-tab.on, .alm-tab[aria-selected="true"] { color: var(--paper-hi); background: var(--cath); transform: translateY(0); box-shadow: 0 -2px 0 var(--ink) inset; }
.alm-tab.on::after { content: ""; position: absolute; left: 50%; bottom: -10px; width: 14px; height: 10px; translate: -50% 0;
  background: var(--cath); clip-path: polygon(0 0, 100% 0, 50% 100%); }
```

Make sure `almanac.ts` sets `role="tab"`, `aria-selected` and `aria-controls`; check whether it already does. Arrow keys should move between tabs.

#### 4.4 Tooltip (`#tooltip`): a paper tag with a tail

```css
.tooltip { z-index: var(--z-tooltip); max-width: 260px; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-s);
  background: var(--card); color: var(--ink); font: 600 var(--fs-small)/1.35 var(--font-ui); box-shadow: var(--sh-2);
  animation: tip-in var(--dur-2) var(--ease-out) both; }
.tooltip strong { display: block; font: 690 var(--fs-d3)/1.15 var(--font-display); font-variation-settings: "SOFT" 60; }
.tooltip::after { content: ""; position: absolute; left: var(--tail-x, 50%); bottom: -7px; width: 12px; height: 12px; translate: -50% 0;
  rotate: 45deg; background: inherit; box-shadow: 2px 2px 0 0 var(--ink); }
@keyframes tip-in { from { opacity: 0; transform: translateY(4px) scale(.97); } }
```

Set `--tail-x` with `tooltip.style.setProperty('--tail-x', px + 'px')`.

#### 4.5 Cards

**Seed-packet card** (upgrade path column, `.path-col`, §4.11). The general recipe:

```css
.packet { --c: var(--path-0); --soft: var(--path-0-soft); position: relative; border-radius: var(--r-m); overflow: hidden;
  background: var(--mat-paper); background-blend-mode: multiply, normal; box-shadow: var(--sh-1); container: packet / inline-size; }
.packet > header { background: var(--c); color: var(--paper-hi); padding: var(--sp-2) var(--sp-3) 10px;
  font: 690 var(--fs-d3)/1.1 var(--font-display); font-variation-settings: "SOFT" 60;
  -webkit-mask: radial-gradient(6px at 50% 100%, #0000 98%, #000) 0 0 / 14px 100%; }  /* pinked edge */
```

**Almanac entry** (`.alm-card`): left-aligned, with a 64px plate on the left in a kraft roundel with an ink ring. The name is `--t-d2`, the description `--t-body`, the stats are tags (§4.7) and the lore is `--t-voice` at `--fs-small` in `--ink-2`.

**Level node** (map): see §6.5.

#### 4.6 Bars

```css
.bar { --p: 0; --c: var(--pasture); height: 12px; border-radius: var(--r-pill); background: var(--oak-ink); box-shadow: var(--groove), 0 0 0 2px var(--ink);
  overflow: hidden; position: relative; }
.bar > i { position: absolute; inset: 2px auto 2px 2px; width: calc((100% - 4px) * var(--p)); border-radius: inherit;
  background: linear-gradient(rgb(255 255 255 / .35), transparent 50%), var(--c);
  transition: width var(--dur-3) var(--ease-out); }
.bar > i::after { content: ""; position: absolute; inset: 0; border-radius: inherit;   /* painted stripes */
  background: repeating-linear-gradient(115deg, transparent 0 8px, rgb(255 255 255 / .12) 8px 14px); }
.bar.ticks { background-image: repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgb(255 255 255 / .18) calc(10% - 1px) 10%); }
```

Drive `--p` (0 to 1) with `setProperty`. Apply this recipe to:
- `.ability-hp`: Cath's HP, `--c: var(--goodwill)`; when it falls below 30%, use `--c: var(--clay)` with a heartbeat pulse.
- `.xp-bar`: `--c: var(--cath)`.
- `.path-bar`: savings toward the next tier, `--c` is the path colour. When it reaches 100%, switch to `--glow-*`.
- `.replay-track`, `.duel-bar`.
- `.bossbar`: the **Hollowell share price**. It is enemy material: a plastic track, a corp fill, a white tick label and a `.t-label` "HOLLOWELL plc" caption. A falling share price is the satire.

#### 4.7 Badges and tags

- **Property tag** (`.lock-badge`, `.dmg-type`, `.chip-tag`): a luggage tag.

```css
.tag { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px 0 4px; border-radius: 6px var(--r-pill) var(--r-pill) 6px;
  background: var(--card); color: var(--ink); font: 800 .8125rem/1 var(--font-ui); box-shadow: 0 0 0 1.5px var(--ink); }
.tag .prop-icon { width: 20px; height: 20px; border-radius: 50%; box-shadow: 0 0 0 1.5px var(--ink); }
.tag.ok::after { content: ""; width: 14px; height: 14px; background: var(--pasture-deep);
  mask: url("data:image/svg+xml,...tick path...") center/contain no-repeat; }
.tag.no { background: var(--path-0-soft); color: var(--clay-deep); }
.tag.no::after { /* same, cross mask, clay-deep */ }
```

  - The text is 13px weight 800. It is meaningful but duplicated by the icon, so it counts as a label.
  - On phone, show the icon plus the tick or cross only; the name moves to the tooltip.
- **Code chip** (`.build-chip`, "2-0-0"): a brass dog-tag: `background: var(--mat-brass); color: var(--oak-ink); font: 950 .875rem/1 var(--font-ui); letter-spacing: .08em; padding: 4px 8px; border-radius: 6px; box-shadow: var(--sh-0);`. The text must stay `2-0-0`.
- **Dot** (`.new-dot`, `.cath-dot`): a 10px clay dot with a 2px paper ring and a 2px ink ring. It pulses only when motion is allowed.
- **Rosette** (Seed Bank `.rosette.earned`, end screen): §4.12.

#### 4.8 Banners and toasts

**Round banner** (`#banner.round`, plus the plain `#banner` and `.boss`): a cloth ribbon with swallowtail ends, across the top third of the field.

```css
.banner { z-index: var(--z-banner); top: 18%; left: 50%; translate: -50% 0; padding: var(--sp-3) var(--sp-8);
  color: var(--paper-hi); background: linear-gradient(rgb(255 255 255 / .18), transparent 40%, rgb(0 0 0 / .18)), var(--pasture-deep);
  clip-path: polygon(0 0, 100% 0, calc(100% - 22px) 50%, 100% 100%, 0 100%, 22px 50%);
  filter: drop-shadow(0 4px 0 var(--ink)) drop-shadow(0 14px 18px rgb(0 0 0 / .35)); }
.banner strong { display: block; font: 740 var(--fs-d1)/1 var(--font-display); font-variation-settings: "SOFT" 100;
  -webkit-text-stroke: .1em var(--ink); paint-order: stroke fill; text-shadow: 0 .07em 0 var(--ink); }
.banner span { font: 850 var(--fs-label)/1.2 var(--font-ui); text-transform: uppercase; letter-spacing: var(--track-label); color: var(--brass-hi); }
.banner.leak { background-color: var(--clay-deep); }    /* "LEAK: 3 vans through" */
.banner.boss { /* enemy: Hollowell billboard */ clip-path: none; border-radius: var(--r-m); background: var(--mat-plastic); color: var(--corp-ink); filter: drop-shadow(0 14px 18px rgb(11 46 49 / .4)); }
.banner.boss strong { -webkit-text-stroke: 0; text-shadow: none; font-family: var(--font-ui); font-weight: 1000; letter-spacing: -.02em; color: var(--corp); }
```

- `clip-path` cuts off box-shadow, so the depth comes from `filter: drop-shadow`. It is cheap here because the banner is short-lived.
- The **toast** (`#toast`, `.banner.small`) is a paper note when it is a tip or a Cath line. When it introduces an enemy ("New on the lane") it becomes a **Hollowell advert** (`.advert`): a white glossy card, a corp-teal "NEW ON THE LANE" label, the enemy plate, a bold sans name and the stripe. Add the class in `main.ts` wherever enemy intros are posted.

#### 4.9 Signature HUD: the counters ("the purse")

`.hud-stats` holds three brass coins on the plank.

```css
.chip { --c: var(--marks); display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 12px 0 4px; border-radius: var(--r-pill);
  background: var(--oak-ink); box-shadow: var(--groove), 0 0 0 2px var(--ink); }
.chip svg { width: 32px; height: 32px; padding: 5px; border-radius: 50%; background: var(--mat-brass); box-shadow: 0 0 0 2px var(--ink), inset 0 -2px 0 rgb(0 0 0 / .2); }
.chip-heart svg { background: radial-gradient(circle at 35% 30%, #F08A80, var(--goodwill) 60%); }
.chip b { font: 950 var(--fs-num-l)/1 var(--font-ui); font-variant-numeric: tabular-nums; min-width: 3ch; text-align: right;
  color: var(--paper-hi); -webkit-text-stroke: .14em var(--ink); paint-order: stroke fill; text-shadow: 0 2px 0 var(--ink); }
.chip.gain b { animation: tick var(--dur-2) var(--spring); color: var(--brass-hi); }
.chip.hurt { animation: hurt-shake 260ms var(--ease-out); } .chip.hurt b { color: #FFB4A6; }
@keyframes tick { from { transform: scale(1.22); } }
@keyframes hurt-shake { 20% { translate: -3px 0; } 40% { translate: 3px 0; } 60% { translate: -2px 0; } 80% { translate: 1px 0; } }
```

- **Count-up:** `main.ts` already rolls Marks up on the Fleet; extend it to Goodwill. Tween over 350ms with ease-out and re-add `.gain` on each step boundary, throttled to at most one every 90ms. When reduced motion is on, set the final value at once.
- **Title block** (`.hud-place`, `.hud-name`): the place is a brass-hi `--t-label`, and the name is `--t-d3` in paper-hi with a 1px ink stroke.

#### 4.10 Signature HUD: the round card, Go pill, ability tray and Keep Going

**Round card** (`.round-card`, `.preview-row`, `.preview-chip`): a perforated paper ticket for "Round 7: what's coming".
- The left stub reads "ROUND" as a label over the number in Fraunces `--t-d2`.
- The right part shows the enemy plates as 32px roundels, each with a `×12` count in `.t-num`.
- Perforation: `-webkit-mask: radial-gradient(5px at 0 50%, #0000 98%, #000) -0px 0/100% 12px` on the stub edge.
- Boss rounds swap the ticket for the advert material.

**Go, Next and speed pill** (`.go-pill`, `#btn-send`, `#btn-speed`). This is the one button the screen asks you to press (STYLE §2.4, one accent per screen).

```css
.go-pill { display: flex; border-radius: var(--r-l); box-shadow: 0 0 0 3px var(--ink), 0 5px 0 var(--ink); overflow: hidden; }
.btn.send { min-height: 56px; flex: 1; border-radius: 0; font: 950 1.375rem/1 var(--font-ui); letter-spacing: -.005em;
  box-shadow: var(--bevel); -webkit-text-stroke: .08em var(--pasture-ink); paint-order: stroke fill; }
.btn.send.early { -webkit-text-stroke-color: #4E2606; }
.btn.send:not(:disabled):not(.early) { animation: go-breathe 2.4s ease-in-out infinite; } /* only between rounds */
@keyframes go-breathe { 50% { filter: brightness(1.08); box-shadow: var(--bevel), inset 0 0 0 3px rgb(255 255 255 / .25); } }
.speed-btn { width: 64px; background: var(--mat-oak); color: var(--brass-hi); font: 950 1.125rem/1 var(--font-ui);
  border-left: 3px solid var(--ink); box-shadow: var(--bevel); }
.speed-btn.fast { background: var(--mat-brass); color: var(--oak-ink); }
```

- The text content must not change (`Go`, `Next +17`, `x1`/`x3`). Style the "+17" with CSS only if it is already wrapped; otherwise leave it.
- The 844×390 e2e test checks that the pill's box is on screen, so keep its height at 56px or less in landscape.

**Ability tray** (`.ability`, `#btn-hero`, `#btn-pie`, `#btn-neighbours`, `#btn-rally`): brass-rimmed medallions with a cooldown ring.

```css
.ability { position: relative; width: 64px; min-height: 72px; display: grid; justify-items: center; gap: 2px; background: none; border: 0; color: var(--paper-hi); }
.ability-face, .ability .pie-icon { width: 52px; height: 52px; border-radius: 50%; border: 3px solid transparent;
  background: var(--mat-paper) padding-box, var(--mat-brass) border-box; box-shadow: 0 0 0 2px var(--ink), 0 3px 0 var(--ink); }
.ability-ring { position: absolute; top: 0; width: 58px; height: 58px; border-radius: 50%;
  background: conic-gradient(rgb(28 20 14 / .62) calc((1 - var(--p, 1)) * 360deg), transparent 0);
  mask: radial-gradient(circle, #000 66%, transparent 67%); pointer-events: none; }
.ability-label { font: 850 var(--fs-label)/1 var(--font-ui); text-transform: uppercase; letter-spacing: .06em; text-shadow: 0 1px 0 var(--ink); }
.ability.ready .pie-icon, #btn-rally.ready .pie-icon { box-shadow: 0 0 0 2px var(--ink), 0 3px 0 var(--ink), var(--glow-brass); animation: ready-pop var(--dur-3) var(--spring); }
.ability[aria-pressed="true"] .pie-icon, .ability[aria-pressed="true"] .ability-face { translate: 0 3px; box-shadow: 0 0 0 2px var(--ink), var(--glow-pasture); }
.auto-badge { position: absolute; top: -4px; right: -6px; rotate: 8deg; padding: 2px 6px; border-radius: 4px; background: var(--pasture-deep);
  color: var(--paper-hi); font: 900 .6875rem/1 var(--font-ui); text-transform: uppercase; letter-spacing: .06em; box-shadow: 0 0 0 1.5px var(--ink); }  /* a stamp */
@keyframes ready-pop { 0% { scale: .9; } 60% { scale: 1.08; } }
```

- The cooldown is set with `ring.style.setProperty('--p', fraction)`. The current code writes `#pie-ring` some other way; check it uses no style attribute.
- **Keep Going** (`.auto-btn`) is a lever switch: an oak track 56×32 with a brass knob that slides to the right when `aria-pressed="true"`. The word "Keep Going" sits beside it as a label. Its `aria-label` stays unchanged.

#### 4.11 The 3-path upgrade sheet (`#panel` with `.path-col`, `.path-buy`, `.path-steps`)

**Layout:**
- **Tower header.** A 56px plate roundel and the tower name in `--t-d2`. Beside them, the `.build-chip` dog-tag, a "Target: First" segmented control as an oak pill (§4.2), and a stat line: knockouts and Marks earned as `.t-num` with icons.
- **Three seed packets.** `--c` is path-0, path-1 or path-2. Inside each packet:
  1. **Header:** the path name in Fraunces `--t-d3`.
  2. **Ladder:** five rungs (the number of tiers from `paths.ts`).
     - Each rung is a 14px pip. It is hollow when unbought, filled `--c` when bought, and the tier-3 pip is a diamond (keep the current semantics).
     - Only the **next** rung shows its name, and that name wraps to 2 lines. Bought rungs show a tick and the name at 40% ink, and are collapsed on phone.
     - This removes the "Murder of Cr…" truncation.
  3. **Buy button** (`.path-buy`). It sits **first** in the packet on phone and below the ladder on desktop.
     - Contents: "Tier 2" as a label; the name in `--t-d3`; the effect line in `--t-small`; the price as a brass coin followed by `.t-num` 22px.
     - The background is `--soft` with a `--c` 3px ring.
     - **Affordable:** a `.afford` class adds `--glow-*` in the path colour and a 1.6s glint sweep (an `@property --sheen` gradient). The 9px "Affordable now" text goes away: the glow says it, and the visible text becomes "Ready" in the button's label slot.
     - **Not affordable:** an ETA `.bar` toward the price, plus "in about 2 rounds" in `--t-small`.
     - **Shut by the crosspath rule** (`.path-col.shut`): kraft background, a padlock icon and "Closed: two paths chosen". The packet is desaturated with `filter: grayscale(.8)`, which is fine here because it is static.
- **Properties.** One row of `.tag`s.
- **Stats.**
  - A 2-column definition grid: term in `--t-small` ink-2, value in `.t-num` 16px.
  - `dd.up` gets a pasture arrow icon and `+n` in pasture-deep.
  - A preview of the next tier shows as a ghost value: "1.2 → **1.5**".
- **Sell.** A secondary button: "Sell", then a coin and `+140`. Keep the text `Sell +140`.

**Sizing:**
- `#panel { container: panel / inline-size; }`
- `@container panel (width < 520px) { .path-sheet { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px } .path-col header { font-size: .9375rem } .path-steps { display: none } }`. On narrow sheets the ladder collapses to pips in the header.
- `@container panel (width >= 520px)`: the full ladder.

**Phone (390×844):**
- The sheet is a bottom sheet capped at **48svh** (the field shows 52% or more; today it shows about 40%). It has a grab handle and scrolls internally.
- The packets come first and the stats sit under a "Details" disclosure (`<details>` in `main.ts`).

**Landscape (844×390):**
- The sheet stays docked to one side (an e2e test requires this), 340px wide, full height minus the HUD, scrolling inside.
- The three packets sit side by side with the ladders hidden.

#### 4.12 Cath frames, rosettes and stars

```css
.medallion { --s: 112px; width: var(--s); aspect-ratio: 1; border-radius: 50%; padding: 5px; background: var(--mat-brass);
  box-shadow: 0 0 0 2px var(--ink), 0 4px 0 var(--ink), 0 14px 24px -10px rgb(0 0 0 / .45); }
.medallion > * { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: radial-gradient(circle at 50% 35%, var(--paper-hi), var(--kraft)); box-shadow: inset 0 0 0 2px var(--ink); }
.rosette-big { --c: var(--pasture-deep); width: 168px; aspect-ratio: 1; position: relative;
  background: repeating-conic-gradient(var(--c) 0 10deg, color-mix(in oklab, var(--c) 78%, white) 10deg 20deg);
  -webkit-mask: radial-gradient(circle, #000 60%, transparent 61%), conic-gradient(from 0deg, #000 0 0);   /* use an SVG scalloped mask data URI for the frilled edge */
  border-radius: 50%; }
.stars .star { width: 44px; height: 44px; color: var(--kraft); filter: drop-shadow(0 2px 0 var(--ink)); }
.stars .star.earned { color: var(--brass); animation: stamp var(--dur-3) var(--spring) both; animation-delay: calc(var(--i) * 220ms + 300ms); }
@keyframes stamp { 0% { scale: 1.9; rotate: -18deg; opacity: 0; } 55% { scale: .92; rotate: 4deg; opacity: 1; } 100% { scale: 1; rotate: 0deg; } }
```

Replace the `nth-child` delays with `--i` set by `setProperty`.

---

### 5. Motion

| Moment | Duration | Curve | What moves |
|---|---|---|---|
| Press | 40ms down, then 200ms back | Down linear, release `--spring` | translateY(4px), the shadow collapses |
| Hover (pointer only) | 120ms | `--ease-out` | -2px, brightness 1.05 |
| Sheet in (desktop) | 380ms | `--spring` | from `scale(.94) translateY(16px)` and opacity 0, via `@starting-style` |
| Sheet in (phone) | 380ms | `--ease-out` | from `translateY(100%)` |
| Sheet out | 220ms | `--ease-in` | reverse, using `display` and `overlay` with `allow-discrete` |
| Side panel in (landscape) | 320ms | `--ease-out` | from `translateX(±24px)`, opacity 0 (keep the existing `sheet-in-left`/`-right` names) |
| Round banner | in 450ms, hold 1.1s, out 250ms | in `--ease-out`, out `--ease-in` | clip-path wipe from the left (A4), then `strong` scales 1.15 to 1 with `--spring` |
| Leak banner | 450ms | `--ease-out` | wipe, then a ±4px shake over 220ms, a clay vignette pulse on `.stage.hurt::after`, and `.chip-heart.hurt` |
| Boss billboard | 600ms | `--spring` | drops from -40px with `rotate(-2deg)` to 0; a 120ms white flash on the plastic |
| Toast or advert | in 320ms, out 200ms | `--ease-out`, `--ease-in` | slides 16px from its edge |
| List stagger (Almanac, Seed Bank perks, map nodes per act) | 380ms each, `--i` × 45ms, capped at 10 items | `--ease-out` | `translateY(12px)` plus opacity |
| Counter tick | 200ms | `--spring` | scale 1.22 to 1 |
| Upgrade bought | 600ms | staged | see below |
| Level win | about 2.4s | staged | see below |
| Idle | 2.4–3.2s alternate | ease-in-out | the Go button breathes, ready abilities glow, the next map node bobs (only while nothing else animates) |

**Upgrade bought** (the BTD6 chime moment):
1. 0ms: the button squashes to `scale(.94)`.
2. 80ms: the pip fills with an ink-splat ring (I4 burst of 8 `<i>` in the path colour, created in JS with `--ang` set by `setProperty`).
3. 120ms: the packet header flashes with `filter: brightness(1.4)` and decays over 300ms.
4. 200ms: if the tower is renamed (tier 3), the name swaps with a 3D Y-flip (`rotateY(90deg)` out, then in).
5. Then the `.build-chip` text ticks and the Marks chip shows `.hurt` in **brass** (spending), not clay.
6. Sound: `sound.ts` already has a chime; trigger it at step 2.

**Level win:**
1. Field fade to a 0.55 scrim (300ms).
2. The sheet springs in.
3. The Cath medallion pops, then her expression swaps to "smirk".
4. The rosette spins in, `rotate(-90deg)` to 0 over 500ms with `--spring`.
5. The stars stamp at 300, 520 and 740ms, each with a sound and a haptic (`haptics.ts`).
6. The stats count up one after another: Goodwill kept, Marks earned, rounds. 500ms each, ease-out, with tabular figures.
7. The primary button fades in last, 200ms after the final stat, so a stray tap can't skip the moment.

**Loss:** no rosette. The "receipt" (§6.6) prints downward with `clip-path: inset(0 0 100% 0)` going to `inset(0)` over 700ms in steps(14), like a receipt printer.

**Reduced motion** (`@media (prefers-reduced-motion: reduce)`) is a design of its own, not a switch-off:
- Every transform animation becomes a 150ms opacity fade.
- No shakes, wipes, flips, stamps, bobs, breathing or glint sweeps. Ready states show a **steady** glow.
- Count-ups jump straight to the final number. The stars appear filled together, with a single fade.
- The banner holds 1.6s (longer, because it no longer moves).
- `.chip.hurt` becomes a static clay outline for 600ms instead of a shake.
- Keep the shared `cath.css` rule (Cath stays still).
- Implement this as one block at the end of `components.css` that overrides the named animations. Do not use a blanket `* { animation: none }`: some fades carry state.

---

### 6. Screen by screen (ranked by impact)

#### 6.1 Field with a tower selected (`hedgerow-3-field-selected-{phone,landscape,desktop}.png`)

**Highest impact.** This is where players spend their time, and it is the densest UI.

**Upgrade sheet:**
- Apply the whole of §4.11. Key changes:
  - No text below 12px; prose is 14px or more.
  - Names wrap instead of truncating.
  - "Affordable" is said with a glow, not 9px green text.
  - The stat table becomes a grid with deltas.
  - The phone sheet drops to 48svh.
- On desktop, the side panel becomes a paper sheet with an oak header strip carrying the tower name.

**HUD and toast:**
- The top HUD becomes the oak plank with brass coin counters; no more slashed zeros.
- The "NEW ON THE LANE" black rectangle becomes the Hollowell advert.
- The Cath field bubble (bottom left) becomes a paper note with a pinned Cath medallion and `--t-voice` text.

**Bottom tray:**
- The bottom-right tray (Cath, Pie, Neighbours, Keep Going, Next/x1) becomes one oak plank holding the medallions, the lever and the Go pill.
- "Next +17" moves from #B0631E, which fails contrast, to `--harvest`.

#### 6.2 Story scene (`hedgerow-2-story-*`)

Hades staging:
- **Scene.** The scene art fills the whole dialog (phone: 100svh, bleeding to the edges with safe areas; desktop: 1100×680 max with the oak frame).
- **Actors.**
  - Actors are 70–85% of the scene height and anchored to the bottom.
  - The speaking actor moves forward: `scale(1.04)`, full colour, 220ms.
  - The other actor drops back: `brightness(.8) saturate(.85)`, `scale(.97)`.
- **Caption.**
  - The black slab becomes a **paper panel** overlapping the bottom 34% of the scene, sitting on a gradient scrim (`linear-gradient(to top, rgb(28 20 14/.78), transparent)`).
  - **Nameplate.** It sticks up from the panel's top-left as a ribbon in the speaker's colour (`[data-who]` → `--who`). The name is `--t-d2` with a paper-hi fill and ink stroke, above the place as a `--t-label`. Cath's nameplate also gets a brass rim (§2.4).
  - **Line.** `--t-voice` in ink on paper. No italic, no tiny yellow caps.
  - **Buttons.** Next is a pasture tab with a chevron, bottom-right inside the panel. Skip becomes a quiet text button, top-right of the **scene** ("Skip scene"), so it can't be mis-tapped as Next.
- **Landscape (844×390).**
  - The panel docks to the right 46% at full height over a side scrim, and the actors shift left.
  - This fixes the cut-off slab in `hedgerow-2-story-landscape.png`.
- **Typing.**
  - The typed text keeps its `#story-full`/`#story-typed` mechanism.
  - Add a blinking ink caret (`::after`, steps(1)) while typing; reduced motion shows no caret.

#### 6.3 End screen, win and loss (`hedgerow-5-end-*`)

**Win:**
- Layout from top to bottom:
  1. A big Cath medallion (desktop 168px, phone 128px) offset left.
  2. The rosette behind her shoulder.
  3. The eyebrow ("Highmoor · Cheap Eggs") as a `--t-label` on a kraft tab.
  4. The headline in `--t-hero`.
  5. Three stars at 44px.
  6. A **stats strip** of three paper stubs with `--t-num-xl` figures and label captions (Goodwill kept, Marks earned, best tower).
  7. The note in `--t-body`, left-aligned and at most 46ch wide.
  8. The CTA row: a full-width primary, a secondary, and the replay actions as small quiet buttons below a hand-drawn rule.
- Choreography as in §5.

**Loss: "Hollowell delivery receipt".**
- Headline: "They got through."
- `.loss-causes` is restyled as a thermal-printer receipt in **enemy material**: a white paper strip, monospaced-looking Nunito with tabular figures, a dashed tear-off edge and corp-teal header text "HOLLOWELL · PROOF OF DELIVERY". The causes are line items ("3 × Wrapped van … 9 Goodwill").
- This turns the loss into a joke and a lesson at once.
- "Try again" stays primary. Its black ring was the default focus style on autofocus; §4.2 fixes it.

#### 6.4 HUD everywhere (in all field shots)

- Plank, counters, Go pill and tray as in §4.9–4.10.
- On phone, the HUD is a single 56px plank: back button, title (place hidden under 420px), the three counters, and pause/sound collapsed into one "⋯" menu button. That button opens a **pause card** sheet with Resume, Sound, Speed, Reduced effects and All levels. This also covers the "settings" brief.
- Field overlays (`.paused-note`, `.choose-chip`) become paper notes, centred, using `--z-field-ui`.

#### 6.5 Level map (`hedgerow-1-map-*`)

**Act cards:**
- The painted act banner stays. Under it, the cream slab becomes a **painted meadow board**: `--mat-paper` tinted with the act's hue, with a faint field-boundary pattern in an SVG data URI.
- The act title is a ribbon (§4.8 shape) over the banner, set in `--t-d1`.
- "Act 1" is a brass `--t-label` medallion on the ribbon's left end.
- The tally (★ 0/30) is a brass coin chip.
- Locked acts get a kraft "Opens after Act 1" luggage tag. Drop the 0.88 opacity wash, which reads as broken.

**Nodes:**
- 56px medallions with a brass rim and the number in Fraunces `--t-d2` (static, so proportional figures are fine).
  - **Cleared:** pasture-deep fill with a paper-hi number, and three 14px brass stars on a tiny ribbon under the medallion.
  - **Next:** paper fill with a pulsing brass ring (`--glow-brass`), and Cath's bobbing marker (the existing `.you`) on a brass stand.
  - **Locked:** kraft fill, ink-3 number, a 16px SVG padlock on the rim at 4 o'clock (no emoji). The level name is in ink-2 (7.78:1 on paper-shade).
  - **Boss:** a 64px medallion with a corp-teal plastic inner and the boss's silhouette (`.level-sil`).
- Level names are `--t-small` weight 700, centred under the node, at most 2 lines.

**Trail:** a stitched path, `stroke: var(--oak); stroke-width: 4; stroke-dasharray: 2 9; stroke-linecap: round`, plus a 1px paper highlight path offset by -1px. Cleared segments get `stroke: var(--pasture-deep)`.

**"Start here":** a pinned paper tag **above** the next node with a tail pointing down, placed with `--tail-x`. This fixes the collision with node 2.

**Top bar:**
- One oak plank. The emoji become SVG icons in 32px brass coins (Almanac: book; Daily: sun; Heroic: diamond-shield; Seed Bank: star with a seed).
- Cath's button is a medallion with a level badge and the clay dot.
- Phone: icons only plus Cath's name, 48px targets, with the label in `aria-label` (most already have one).

**Host line (`.host`):** a paper note with Cath's medallion overlapping its left edge by 50%, set in `--t-voice`.

**Landscape:** the act banner shrinks to 120px tall and the host note goes to the right column, which fixes the text crowding Cath's head.

#### 6.6 Almanac (`hedgerow-4-almanac-*`)

**Container:** Cath's field notebook.
- The sheet becomes a book: `--mat-paper` with a 14px leather spine on the left (`--cath` with a `--woodgrain` multiply) and ruled faint blue lines (repeating-linear-gradient at 6% opacity) behind the list only.
- Tabs are bookmark ribbons (§4.3).

**Layout:**
- **Desktop:** a two-page spread at 960px wide. The left page is a scrollable list of entries (64px plate, name, one-line role, tags). The right page is the selected entry: the large 3D turntable (`#almanac-view`, an existing canvas), name in `--t-d1`, description, stats as a grid, and lore as a `--t-voice` note.
- **Phone:** the list only. Tapping an entry expands it in place to show the turntable.

**Entries:**
- Remove the per-row "3D" pills. The row itself is the button; a small rotate icon appears on hover or focus.
- **Locked entries:** kraft background, the silhouette plate, "Not yet spotted" in `--t-voice`, and no grayscale filter (it looks broken).
- **Enemy entries** carry a small corp-teal "Hollowell asset" stamp; player towers carry a pasture "Ours" stamp.

#### 6.7 Cath sheet, Seed Bank, duel and replay (no audit shots; build to the same kit)

- **Cath sheet.**
  - A 128px Cath medallion with the level in a brass coin badge.
  - The XP `.bar` in `--cath`.
  - Attributes as rows: name, a pips bar, and a "+" icon button.
  - The wardrobe as 3-up cards with a brass ring on the chosen outfit (replace `#f2c94c`).
  - Talents as seed packets in the `--cath` colour.
- **Seed Bank.**
  - Perks as seed packets with a star cost coin.
  - Rosettes as small rosettes: grey kraft when unearned, coloured when earned, with a stagger-in.
- **Duel overlay.**
  - An oak frame around a "fairground strength-tester" bar: an oak `.bar` with a gold sweet-spot zone and an ink pin.
  - Strike is a big harvest button; the title is in `--t-d1`.
- **Replay bar.** Oak plank, `.bar` track, a quiet Leave button.

---

### 7. Implementation plan

Each slice follows the CLAUDE.md slice rule:
- Run `npm run check` and `npm run e2e:site`.
- Screenshot before and after.
- Commit and push to `build`.

#### Verification kit (build in S1)

- **Shot spec.** Add `e2e-site/hedgerow-shots.spec.ts`, tagged `@shots` and skipped unless `SHOTS=1`, plus an npm script: `"shots:hedgerow": "SHOTS=1 playwright test -c playwright.site.config.ts e2e-site/hedgerow-shots.spec.ts"`.
  - **Sizes:** 390×844, 844×390 and 1440×900, all in `?2d&sandbox=1`.
  - **Screens:** map, story (level 1 intro), field with a tower selected (level 12 via `window.hedgerow.place`/`upgrade` so the field is busy), Almanac, end win, end loss, Cath sheet, Seed Bank.
  - **3D:** one extra 1440×900 shot in 3D with the swiftshader flags, to check legibility over the 3D view.
  - **Reduced motion:** re-run the map and end screens with `page.emulateMedia({ reducedMotion: 'reduce' })`.
  - **Output:** `e2e/screenshots/hedgerow-*`, matching the audit's names so before and after can be compared.
- **Contrast.** Add `tests/hedgerow-contrast.test.ts`, a pure node test that parses `tokens.css` and asserts the pair table in §3.1 meets 4.5:1 (3:1 for the listed large or bold uses).
- **Tests that must stay green** (all in `e2e-site/site.spec.ts`):
  - the 844×390 Go-pill test (the box must be on screen, and the texts `Go`, `Next +N`, `x1`/`x3`, `1/12` unchanged);
  - the three-paths side-by-side test (`.path-col` count of 3, `.build-chip` text `2-0-0`, the sheet docked beside the tower, `button.path-buy` visible);
  - the buy-every-path test;
  - the replay, Cath-sheet and Seed Bank tests;
  - `noSideways` (no horizontal scroll).
- **Selectors.** Every id in §4 and §6 (`#btn-send`, `#btn-speed`, `#hud-wave`, `#hud-marks`, `#panel`, `#toast`, `#banner`, `#story-next`, `#story-full`, `#btn-hero`, `#btn-pie`, `#btn-auto`, `#choose-chip`, `#bank-*`, `#cath-*`) and the classes `button.level[data-level]`, `.path-col`, `.path-buy[data-path]`, `.build-chip` and `.btn-build[data-kind]` must keep their names.

#### Slices

| # | Slice | Files | Done when |
|---|---|---|---|
| **S1** | **Foundation: fonts and tokens.** `npm i @fontsource-variable/fraunces@5.3.0 @fontsource-variable/nunito@5.3.0`. Add `ui/fonts.css` and `ui/tokens.css`, imported in `main.ts` before `styles.css`. Delete the old `@font-face` blocks. Alias the old variables to the new tokens. Set `font-family` on `body` and `h1`–`h3`. Add `font-synthesis: none`. Remove every `font-style: italic`. Add the shot spec and the contrast test. | `package.json`, `games/hedgerow/src/ui/{fonts,tokens}.css`, `main.ts`, `styles.css` (top 60 lines and 2 italic rules), `e2e-site/hedgerow-shots.spec.ts`, `tests/hedgerow-contrast.test.ts` | No CSP errors (the e2e `trackErrors` passes). The network panel shows exactly 2 woff2 files totalling about 160 KB on `/hedgerow/`. No faux italics. Shots show Nunito digits without slashed zeros. |
| **S2** | **Type pass.** Replace the 143 px `font-size` declarations with tokens: 9–11px caps → `--fs-label`; 10–13px prose → `--fs-small`; 14–16px → `--fs-body`; headings → `--fs-d*`. Replace the `!important` rules where possible. Drop the half-pixel sizes. | `styles.css` | `grep -c "font-size: [0-9]*px" styles.css` is under 10. All site e2e pass, especially at 844×390. |
| **S3** | **Component kit:** buttons, icon buttons, sheets and frame, tooltip, tags, bars, tabs, focus, `@starting-style` sheet motion, the reduced-motion block. | `ui/components.css`, `styles.css` (delete the superseded rules) | Shots show the noticeboard sheets. Keyboard focus is visible on every control. "Try again" has no black ring on open. |
| **S4** | **HUD:** plank, counters with count-up, Go pill, ability tray with the `--p` ring, Keep Going lever, banners (round, leak, boss) and the Hollowell advert toast. | `components.css`, `main.ts` (count-up, `.advert`/`.leak` classes, `setProperty('--p')`) | The 844×390 pill test passes. The 3D desktop shot is legible: every HUD text sits on a material, none directly over the canvas. |
| **S5** | **Upgrade sheet:** seed packets, ladder, buy states, ETA bars, stat grid, container queries, 48svh phone sheet, upgrade-bought choreography. | `components.css`, `main.ts` (panel markup: ladder, `<details>`, burst) | The three-paths tests pass. Phone shot: the field shows 50% or more. No ellipsis anywhere in the panel. |
| **S6** | **Level map:** medallion nodes, stitched trail, ribbons, "Start here" tag, SVG top-bar icons (no emoji), landscape fix. | `map.ts`, `icons.ts`, `index.html` (the emoji spans become SVGs), `components.css` | Map shots at all 3 sizes have no collisions. Locked nodes are readable. |
| **S7** | **Story scene:** full-bleed staging, nameplates, paper caption, landscape dock, caret. | `main.ts`/`cast.ts` (`--who` colour via `setProperty`), `components.css` | Story shots at 3 sizes have nothing cut off. The story e2e (`#story-next`, `#story-full`) passes. |
| **S8** | **End screen:** win choreography (rosette, stars via `--i`, count-up stats), loss receipt, CTA hierarchy. | `main.ts` (result sheet), `components.css`, `sound.ts`/`haptics.ts` hooks | Win and loss shots look right. The reduced-motion shot shows the final state immediately. |
| **S9** | **Almanac** notebook: spread on desktop, expand in place on phone, tab ARIA. | `almanac.ts`, `components.css` | Almanac shots look right. Arrow keys switch tabs. |
| **S10** | **Polish:** Cath sheet, Seed Bank, duel, replay bar, pause card, dark "evening" theme pass, DECISIONS and STYLE amendments (Nunito for Hedgerow; the painted top-light rule). | `index.html`, `main.ts`, `components.css`, `STYLE.md` (a Hedgerow subsection), `DECISIONS.md` | Dark-mode shots pass the contrast test. The whole e2e:site suite passes. |

S1–S4 is about one session. S5–S7 is another, and S8–S10 a third. Release after S5 (the HUD and the sheet are the milestone a player notices) and again after S10.

#### Risks and mitigations

- **CSP.**
  - Never use `style=""`. Every per-element value (`--p`, `--i`, `--ang`, `--tail-x`, `--who`) goes through `el.style.setProperty`.
  - SVG data URIs are allowed in CSS (`img-src data:`).
  - Fonts must load from `'self'`, which the Vite-hashed assets do. Don't use Google Fonts or `@import url(https://…)`.
- **Font payload and FOUT.**
  - About 156 KB on first visit, then cached.
  - `font-display: swap` plus metric-matched fallbacks keep the layout shift negligible. Check by comparing a throttled "Slow 4G" shot with the final shot.
  - Never import the packages' `index.css`/`full.css`: they bring in latin-ext and vietnamese faces and every axis file.
- **Legibility over the 3D view.**
  - No HUD text sits directly on the canvas: everything sits on oak, paper or plastic, or has a scrim.
  - Never use `backdrop-filter` in Hedgerow. It is expensive over WebGL on iPhone, and opaque materials make it unnecessary.
- **Performance.**
  - Animate only `transform`, `opacity` and (briefly) `filter` on short-lived elements.
  - Grain only on the 8 or fewer large surfaces.
  - Nothing animates infinitely while a wave is running, except the Go-button breathe, which is only on between rounds.
  - Bursts are removed from the DOM on `animationend`.
  - Measure with the existing 3D shot plus a 30-second Performance trace on the desktop build before and after S4.
- **Browser support.**
  - `linear()` (iOS 17.2+) has a cubic-bezier fallback via `@supports`.
  - `paint-order` on HTML text (iOS 17.4+) has a thinner-stroke fallback.
  - Container queries need iOS 16+, `@starting-style` iOS 17.5+ (older versions just skip the entrance), `@property` iOS 16.4+ (the glint is static otherwise), and `text-wrap: balance`/`pretty` is progressive enhancement.
  - `color-mix` is used only in decorative layers.
- **iPhone.**
  - Use `env(safe-area-inset-*)` on the HUD, the tray, bottom sheets and the full-bleed story.
  - Use `svh` rather than `vh` for sheet heights.
  - Touch targets are 44px or more (abilities 64×72, icon buttons 44, buy buttons 48 or more).
  - `touch-action: manipulation` on buttons.
- **Text-dependent tests.** Never change visible strings that the tests assert. Restyle around them.
- **STYLE.md conflicts.**
  - The changes are: Nunito for Atkinson (still two families), a painted top-light on player materials, and glossy materials reserved for the enemy.
  - Record them as a Hedgerow subsection of STYLE.md and a DECISIONS.md line in S10 (or S1), so later sessions don't "fix" them back.
## cathnivore
## Cathnivore UI design system: "Market Day Press"

Scope: `/cathnivore/` only (React, `src/`, styles in `src/styles/*.css`). Screens covered: title, campaign, story scene, setup, game table, sheets, end screen, settings, rules, credits and pass-device.

I measured the font payloads in this spec from the real `@fontsource-variable/*@5.3.0` tarballs, and checked each file's axes, OpenType features and zero glyph with fontTools. I computed the contrast ratios from the hex values. I edited, built and committed nothing in `/home/user/Cathnivore`.

---

### 1. Identity

Cathnivore is a farmers'-market broadsheet printed on a letterpress. The players' world is warm paper, card stock, ink, wax seals and rubber stamps. The two corporations push glossy, over-lit, injection-moulded plastic into it.

- **From Wingspan digital and Root digital:** the table is a physical tabletop of tactile, slightly imperfect paper objects. Panels are cards, ledgers and clippings, never rounded web boxes.
- **From Hearthstone:** every press goes physically down and springs back, and objects lift toward the cursor.
- **From Marvel Snap:** the big moments are staged in beats (anticipation, slam, count-up, settle). A liberation, a Squeeze or the end of a game earns a short, choreographed reveal with oversized numerals.

The STYLE.md amendments this needs are listed at the end of slice 1, to be logged in `DECISIONS.md`.

---

### 2. Typography

#### 2.1 Packages to install (all OFL-1.1, latin subset only)

```
npm i @fontsource-variable/fraunces@5.3.0 \
      @fontsource-variable/atkinson-hyperlegible-next@5.3.0 \
      @fontsource-variable/figtree@5.3.0
```

Remove these five lines from `src/main.tsx`:

```
@fontsource/fraunces/600.css, 700.css, 700-italic.css
@fontsource/atkinson-hyperlegible/400.css, 700.css
```

Keep the old packages in `package.json` only if `grep -rn "@fontsource/" games site shared` still finds an importer.

Do not import the packages' `index.css` or the axis CSS files. Write `src/styles/fonts.css` with your own `@font-face` rules, so that only the files below can ever load.

| Family name in CSS | File (in `node_modules/@fontsource-variable/...`) | Axes | woff2 size | Role |
|---|---|---|---|---|
| `"Marrow Display"` | `fraunces/files/fraunces-latin-opsz-normal.woff2` | `opsz` 9–144, `wght` 100–900 | 67.3 KB | Wordmark, headings, card names, speaker names, map region names |
| `"Marrow Display"` italic | `fraunces/files/fraunces-latin-wght-italic.woff2` | `wght` 100–900 (optical size fixed at text size) | 45.7 KB | Cath's voice, Agenda headlines, flavour lines |
| `"Marrow Text"` | `atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2` | `wght` 200–800 | 34.0 KB | All UI text, rules text and body copy |
| `"Marrow Figures"` | `figtree/files/figtree-latin-wght-normal.woff2` with `unicode-range: U+0030-0039, U+002B, U+002D, U+002E, U+002F, U+0025, U+00D7, U+2212` | `wght` 300–900, has `tnum` | 20.2 KB | Every digit in the UI, plus price tags and hero numerals |

**Total: 167.2 KB** of woff2, under the 180 KB budget. Atkinson italic is not shipped, so it must never be requested. Fraunces `full` (121 KB) is also not shipped: the `SOFT` and `WONK` axes are not worth 54 KB here.

##### Why the figures face is needed (verified in the font files)

- **Atkinson Hyperlegible Next still has a three-contour zero.** Its `0` is slashed or dotted, so "Round 1/10" keeps rendering as "1Ø". It also has no `zero` feature to switch this off.
- **The Fraunces latin subset has only `liga` and `rvrn`.** It has no `tnum`, `onum` or `smcp`, and its digits vary from 1024 to 1461 units wide.
- **Figtree has a plain two-contour zero and real `tnum`.**

Composing the families with `unicode-range` puts Figtree digits inside every Atkinson string with no markup changes. A side effect is that small caps are impossible, so labels use tracked caps (see 2.4).

##### `src/styles/fonts.css`

Vite rewrites and hashes relative `url()`s. Import this file first in `main.tsx`.

```css
@font-face {
  font-family: "Marrow Display"; font-style: normal; font-display: swap;
  font-weight: 100 900;
  src: url("../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2") format("woff2-variations");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "Marrow Display"; font-style: italic; font-display: swap;
  font-weight: 100 900;
  src: url("../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2") format("woff2-variations");
  unicode-range: /* same as above */;
}
@font-face {
  font-family: "Marrow Text"; font-style: normal; font-display: swap;
  font-weight: 200 800;
  src: url("../../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2") format("woff2-variations");
  unicode-range: /* same */;
}
@font-face {
  font-family: "Marrow Figures"; font-style: normal; font-display: swap;
  font-weight: 300 900;
  src: url("../../node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+0030-0039, U+002B, U+002D, U+002E, U+002F, U+0025, U+00D7, U+2212;
}
/* Metric-matched fallbacks to stop layout shift while the fonts swap in */
@font-face { font-family: "Marrow Display Fallback"; src: local("Georgia"); size-adjust: 104%; ascent-override: 92%; descent-override: 24%; }
@font-face { font-family: "Marrow Text Fallback"; src: local("Arial"); size-adjust: 103%; ascent-override: 95%; descent-override: 24%; }
```

If Vite refuses the `node_modules` path in the worktree, the fallback is `import url from '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url'` followed by `document.fonts.add(new FontFace('Marrow Figures', \`url(${url})\`, {unicodeRange, weight:'300 900'}))`. The FontFace API is CSP-safe under `font-src 'self'`.

Add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the Display normal and Text files. Generate the tags through a small Vite `transformIndexHtml` plugin from the hashed asset names, so the HTML gains no inline code.

The font-family stacks become tokens (section 3):

```css
--font-display: "Marrow Display", "Marrow Display Fallback", Georgia, serif;
--font-text:    "Marrow Figures", "Marrow Text", "Marrow Text Fallback", system-ui, sans-serif;
--font-figures: "Marrow Figures", "Marrow Text", system-ui, sans-serif;
```

Display text gets Figures-free digits on purpose. Fraunces old-style digits in a headline ("Chapter 3") are charming. Any digit that counts goes in a `.num` span.

#### 2.2 Variable-axis rules

```css
:root { font-optical-sizing: auto; }  /* opsz follows font-size automatically */
.display-xl { font-variation-settings: "opsz" 144; font-weight: 720; }  /* wordmark: hairline contrast */
.display    { font-weight: 640; }   /* headings: between the old 600 and 700 */
.voice      { font-family: var(--font-display); font-style: italic; font-weight: 460; }  /* Cath's lines: lighter, more human */
.headline-agenda { font-style: italic; font-weight: 780; }
svg .region-name { font-variation-settings: "opsz" 24; font-weight: 700; }  /* SVG text is scaled, so pin opsz */
```

- Never write `font-weight: 800` on Text. Its maximum is 800, so 800 is legal, but use it only on numerals; 700 is the UI ceiling.
- Hover swell on primary CTAs: `transition: font-variation-settings`, with `wght` going from 700 to 760 on Display labels only.

#### 2.3 Type scale

Use `rem` with a 16px root and fluid `clamp()` between 390px and 1440px.

The game table keeps its own denser desktop step, because `e2e/desktop-no-scroll.spec.ts` enforces no scrolling at 1280x800. The dense step (`.game` sets `--density: compact`) leaves `--fs-small` and `--fs-body` at their phone values on desktop.

| Token | Phone 390 | Desktop 1440 | `clamp()` | Line-height | Tracking | Face, weight |
|---|---|---|---|---|---|---|
| `--fs-label` | 12 | 12.5 | `clamp(.75rem,.74rem+.05vw,.78rem)` | 1.2 | `+.12em`, caps | Text 700 |
| `--fs-caption` | 13 | 14 | `clamp(.8125rem,.79rem+.1vw,.875rem)` | 1.35 | 0 | Text 400/600 |
| `--fs-small` (cards, rules in cards) | 14 | 15 | `clamp(.875rem,.85rem+.1vw,.9375rem)` | 1.4 | 0 | Text 400 |
| `--fs-body` | 16 | 17 | `clamp(1rem,.98rem+.1vw,1.0625rem)` | 1.45 | 0 | Text 400 |
| `--fs-lead` (story lines, dialogue) | 17 | 20 | `clamp(1.0625rem,.99rem+.29vw,1.25rem)` | 1.45 | -.003em | Text 400 |
| `--fs-voice` (Cath asides) | 17 | 19 | `clamp(1.0625rem,1.02rem+.19vw,1.1875rem)` | 1.35 | 0 | Display italic 460 |
| `--fs-h3` (panel titles) | 18 | 21 | `clamp(1.125rem,1.06rem+.29vw,1.3125rem)` | 1.15 | -.005em | Display 640 |
| `--fs-h2` (screen heading) | 26 | 34 | `clamp(1.625rem,1.44rem+.76vw,2.125rem)` | 1.08 | -.015em | Display 640 |
| `--fs-h1` (end verdict, chapter title) | 36 | 60 | `clamp(2.25rem,1.69rem+2.29vw,3.75rem)` | 1.0 | -.025em | Display 700 |
| `--fs-display` (wordmark) | 56 | 132 | `clamp(3.5rem,1.7rem+7.3vw,8.25rem)` | .9 | -.035em | Display 720, opsz 144 |
| `--fs-num-hud` | 18 | 20 | `clamp(1.125rem,1.08rem+.19vw,1.25rem)` | 1 | -.01em | Figures 760, tnum |
| `--fs-num-hero` | 48 | 88 | `clamp(3rem,2.06rem+3.81vw,5.5rem)` | .85 | -.03em | Figures 850, tnum |

Rules:

- **Minimum sizes:** nothing a player must read is below 14px. `--fs-label` and `--fs-caption` are only for overlines, units and meta.
- **Wrapping:** `text-wrap: balance` on h1, h2 and h3. `text-wrap: pretty` on body.
- **Measure:** at most 62ch for body and 48ch for dialogue.
- **Line height:** body stays at 1.4 or above (STYLE 4).

#### 2.4 Numerals and casing

```css
.num, .hud-value, .action-cost, .stat-card dd, [data-num] {
  font-family: var(--font-figures);
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: "tnum" 1;
  font-weight: 760; letter-spacing: -.01em;
}
.num .of { font-size: .62em; font-weight: 600; color: var(--ink-muted); margin-inline: .12em; } /* "3 / 10" */
.num .unit { font-family: var(--font-text); font-size: .42em; letter-spacing: .12em; text-transform: uppercase; vertical-align: .55em; }
```

Casing:

- **Sentence case:** screen and panel headings.
- **Verb Title Case:** action buttons, per STYLE 12 ("Open Stall").
- **Caps:** only `--fs-label` overlines, badges (SQUEEZE, EXPAND, PICKED), map region names and the end stamp.
- **Never** set Display in caps, apart from region names and the stamp.
- **Italic** means Cath's voice, Agenda headlines and flavour text, nothing else.
- **No underlines in UI.** Delete the dotted `abbr` and tooltip underlines (see 4.5). Links in legal text use a 1px underline offset by 3px.

#### 2.5 Cath's art keeps its look

`shared/cath/cath.ts` and `cath.css` are not touched. The system wraps Cath and never restyles her:

- Every Cath mount sits in `.cameo` (4.9) with `isolation: isolate`.
- Grain, filters, `mix-blend-mode` and tilt never apply to her SVG. The grain layers sit at `z-index: -1` inside panels, and `.cameo svg { filter: none !important; }` guards against inherited filters.
- Her only motion is the existing companion idle plus an optional breathing scale on the frame, never on the SVG.
- Her speech is always `.voice` (Display italic), which ties her to the type system.

---

### 3. Tokens

Create `src/styles/tokens.css`, extended from the current file. Keep every existing token name; the new ones below are added.

#### 3.1 Colour

```css
:root {
  /* existing hex unchanged: --paper #F4EDE1, --paper-2 #EAE0CF, --surface #FBF8F1, --ink #2B2320,
     --ink-muted #6E625A, --pasture #5B7F3A, --pasture-deep #466A2B, --soil #6B4A2B, --wheat #D9B45A,
     --sea #3E6E7E, --clay #B5523B, --clay-deep #9E4430, regions, producers, corps, --rule */

  --paper-3: #DDCFB8;          /* stacked-sheet edge, deckle shadow */
  --newsprint: #F7F4EC;        /* Agenda clippings (STYLE 8) */
  --kraft: #CFAE7E;            /* market tray, ledger spine: fill only */
  --wheat-ink: #7A5B14;        /* wheat as TEXT: 5.41:1 on paper, 4.82:1 on paper-2 */
  --wheat-hi: #E8C877;         /* wheat foil highlight; ink on it 9.5:1 */
  --seal: #2F4A1F;             /* wax-seal dark; paper on it 8.51:1 */
  --focus: #1F5F99;            /* focus ring; 5.72:1 on paper, 3:1+ against pasture-deep */
  --ink-a08: rgb(43 35 32 / .08);  --ink-a15: rgb(43 35 32 / .15);
  --ink-a35: rgb(43 35 32 / .35);  --ink-a60: rgb(43 35 32 / .60);
  --shadow-ink: 28 18 10;      /* warm brown shadow channel, never black */
  --scrim: rgb(30 22 16 / .52);
  --hollowell-ink: #7A2E00; --candor-ink: #0B4F5C;  /* corp text on corp-tinted fills */
}
```

Dark mode keeps the existing overrides and adds:

```css
--paper-3: #3A322C; --newsprint: #EDE6D6; --wheat-ink: #E5C46F; --focus: #8EC5F5;
--scrim: rgb(0 0 0 / .6); --shadow-ink: 0 0 0;
```

`--newsprint` stays light in dark mode, because clippings are objects (STYLE 3.5). `--wheat-ink` in dark is 10.25:1 on `--paper`.

**Measured contrast:**

| Text on background | Ratio |
|---|---|
| ink on paper | 13.23 |
| ink-muted on paper | 5.07 |
| ink-muted on paper-2 | 4.51 (the floor; never put muted text on paper-3) |
| paper on pasture-deep | 5.38 |
| paper on clay-deep | 5.43 |
| ink on wheat | 7.79 |
| ink on Hollowell | 5.9 |
| ink on Candor | 7.22 |
| dark-mode ink on dark paper | 14.34 |

**Banned as text:** `--wheat` (1.7:1), `--pasture` (3.97:1) and `--clay` (4.26:1) fail as text below 24px. Use `--wheat-ink`, `--pasture-deep` and `--clay-deep` instead.

#### 3.2 Materials

```css
:root {
  --grain-paper: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.62' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .17 0 0 0 0 .13 0 0 0 0 .1 0 0 0 .5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --fibres: repeating-linear-gradient(97deg, rgb(43 35 32/.018) 0 1px, transparent 1px 7px);
  --halftone: radial-gradient(rgb(43 35 32/.10) .7px, transparent .9px) 0 0/4px 4px;
  --ruled: repeating-linear-gradient(transparent 0 23px, rgb(62 110 126/.22) 23px 24px);
  --mat-paper:   var(--grain-paper), var(--fibres), radial-gradient(140% 90% at 30% 0%, #FBF6EC, var(--paper));
  --mat-card:    var(--grain-paper), linear-gradient(180deg, var(--surface), #F6F0E4);
  --mat-ledger:  var(--grain-paper), var(--ruled), linear-gradient(var(--surface), var(--surface));
  --mat-news:    var(--halftone), var(--grain-paper), linear-gradient(var(--newsprint), #EFEAE0);
  --mat-plastic-h: linear-gradient(180deg, var(--hollowell-highlight) 0 14%, var(--hollowell) 42%, #E5620A);
  --mat-plastic-c: linear-gradient(180deg, var(--candor-highlight) 0 14%, var(--candor) 42%, #23A6BF);
  --grain-opacity: .07;
}
```

In dark mode, set `--grain-opacity: .05`, and give `--mat-paper` and `--mat-card` the dark base colours with the same grain.

Player-side gradients may vary lightness by at most 6% (paper tooth). Only plastic gets real gloss. That keeps STYLE's "two materials" rule.

#### 3.3 Radii, spacing, elevation, glows, z-layers

```css
:root {
  --r-xs: 4px; --r-sm: 8px; --r-card: 10px; --r-btn: 12px; --r-sheet: 16px; --r-pill: 999px;
  --sp-0: 2px; --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px;
  --sp-6: 32px; --sp-7: 48px; --sp-8: 64px; --sp-9: 96px;
  --gutter: max(16px, env(safe-area-inset-left));

  /* elevation: paper edge + warm soft lift */
  --e1: 0 1px 0 var(--ink-a15);
  --e2: 0 1px 0 var(--ink-a15), 0 3px 8px -3px rgb(var(--shadow-ink) / .22);
  --e3: 0 1px 0 var(--ink-a15), 0 2px 0 -1px var(--paper-3), 0 10px 22px -10px rgb(var(--shadow-ink) / .35);
  --e4: 0 1px 0 var(--ink-a15), 0 18px 40px -16px rgb(var(--shadow-ink) / .45);
  --e5: 0 30px 70px -24px rgb(var(--shadow-ink) / .55);
  --inset-hi: inset 0 1px 0 rgb(255 255 255 / .55);
  --inset-lo: inset 0 -2px 0 var(--ink-a08);

  --glow-select: 0 0 0 3px var(--wheat), 0 0 0 7px rgb(217 180 90 / .30);
  --glow-target: 0 0 0 3px var(--wheat), 0 0 18px 4px rgb(217 180 90 / .55);
  --glow-danger: 0 0 0 2px var(--clay-deep), 0 0 16px rgb(158 68 48 / .45);
  --glow-plastic-h: 0 0 0 1px #E5620A, 0 6px 16px -4px rgb(255 122 26 / .55);
  --glow-plastic-c: 0 0 0 1px #23A6BF, 0 6px 16px -4px rgb(63 193 217 / .5);

  --z-base: 0; --z-map-fx: 5; --z-hud: 10; --z-sticky: 20; --z-tooltip: 30; --z-sheet: 40;
  --z-banner: 50; --z-modal: 60; --z-toast: 70; --z-fx: 80; --z-pass-device: 90;
}
```

Replace every literal `z-index` in `src/styles/*.css` with these tokens. There are 12 today.

---

### 4. Components

Put these in the new file `src/styles/components.css`, imported after `global.css`. Each recipe lists the existing selectors it restyles.

#### 4.1 Frame: card stock (`.frame`)

Applies to `.desktop-col` panels, `.active-producer`, the setup groups and `.stat-card`.

```css
.frame {
  position: relative; isolation: isolate;
  background: var(--mat-card); border-radius: var(--r-card);
  border: 1px solid var(--ink-a35);
  box-shadow: var(--inset-hi), var(--inset-lo), var(--e3);
  padding: var(--sp-4);
  container: frame / inline-size;
}
.frame > .frame-title {               /* replaces bare h2/h3 */
  display: flex; align-items: baseline; gap: var(--sp-2);
  font: 640 var(--fs-h3)/1.15 var(--font-display); color: var(--soil);
  padding-bottom: var(--sp-2); margin-bottom: var(--sp-3);
  background: linear-gradient(var(--ink-a35) 0 0) bottom/100% 1px no-repeat,
              linear-gradient(var(--ink-a15) 0 0) 0 calc(100% - 3px)/100% 1px no-repeat; /* double rule */
}
.frame-title .label { margin-left: auto; }        /* e.g. "3 OPEN" */
.frame--ledger { background: var(--mat-ledger); }  /* Farm, Log */
.frame--tray { background: var(--grain-paper), linear-gradient(var(--kraft), #C49F6E); border-color: rgb(var(--shadow-ink)/.5); } /* Market */
.frame--tray > .frame-title { color: var(--ink); }
@container frame (width < 300px) { .frame { padding: var(--sp-3); } }
```

**Rule:** a frame never sits inside a frame. A nested group becomes `.group`, which has a top hairline and `padding-top: var(--sp-3)` and no border. This fixes the boxes-in-boxes look of the setup screen.

#### 4.2 Buttons

The base `button` selector in `global.css` (around line 1288) and its `:active` and `:disabled` rules are replaced.

```css
.btn, button.primary, button.secondary, button.danger {
  --lip: 4px; --lip-c: rgb(var(--shadow-ink) / .55);
  position: relative; min-height: 48px; min-width: 44px;
  padding: 0 var(--sp-5); border-radius: var(--r-btn);
  font: 700 var(--fs-body)/1 var(--font-text); letter-spacing: .01em;
  border: 1.5px solid var(--ink);
  box-shadow: var(--inset-hi), 0 var(--lip) 0 var(--lip-c), var(--e2);
  transform: translateY(0);
  transition: transform var(--dur-1) var(--spring), box-shadow var(--dur-1) var(--spring),
              filter var(--dur-2) var(--ease-out), background-color var(--dur-2);
  text-box: trim-both cap alphabetic;  /* progressive enhancement */
}
button.primary { background: linear-gradient(180deg, #4E7631, var(--pasture-deep)); color: var(--paper-on-fixed-fill); --lip-c: var(--seal); }
button.danger  { background: linear-gradient(180deg, #A94B36, var(--clay-deep)); color: var(--paper-on-fixed-fill); --lip-c: #6A2B1E; }
button.secondary, .btn { background: var(--mat-card); color: var(--ink); --lip: 3px; --lip-c: var(--paper-3); }
@media (hover: hover) {
  .btn:hover:not(:disabled), button.primary:hover:not(:disabled) { transform: translateY(-1px); --lip: 5px; filter: brightness(1.04) saturate(1.06); }
}
button:active:not(:disabled) { transform: translateY(3px); --lip: 1px; transition-duration: 40ms; transition-timing-function: linear; }
button:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
button:disabled {
  background: var(--grain-paper), repeating-linear-gradient(-45deg, var(--ink-a08) 0 2px, transparent 2px 7px), var(--paper-2);
  color: var(--ink-muted); border-style: dashed; border-color: var(--ink-a35);
  box-shadow: none; transform: none; cursor: not-allowed;
}
.btn-icon { width: 44px; height: 44px; padding: 0; border-radius: 50%; --lip: 2px; display: grid; place-items: center; }
.btn-quiet { background: none; border: 0; box-shadow: none; min-height: 44px; padding: 0 var(--sp-2);
  font-weight: 600; color: var(--soil);
  background-image: linear-gradient(currentColor 0 0); background-size: 0 1.5px; background-position: 0 85%; background-repeat: no-repeat;
  transition: background-size var(--dur-2) var(--ease-out); }
.btn-quiet:hover, .btn-quiet:focus-visible { background-size: 100% 1.5px; }
.btn-lg { min-height: 56px; font-size: var(--fs-lead); padding: 0 var(--sp-6); }
```

`--lip` must be a registered custom property so it animates:

```css
@property --lip { syntax: '<length>'; inherits: false; initial-value: 4px; }
```

- **Action rows** (`.action-item` buttons) use `.btn` with the icon on the left, the label, and the cost as a price-tag chip on the right (4.6).
- **Two-line costs** ("Invest: buy Cold Store (5 Marks)") put the cost in the chip only. The label keeps the accessible name through `aria-label`, so e2e regexes such as `/^Invest/` still match.

#### 4.3 Tabs: folder tabs (Rules, Settings, the phone bottom bar)

```css
.tabs { display: flex; gap: var(--sp-1); padding-inline: var(--sp-3); position: relative; z-index: 1; }
.tab { min-height: 44px; padding: 0 var(--sp-4); border: 1px solid var(--ink-a35); border-bottom: 0;
  border-radius: var(--r-card) var(--r-card) 0 0; background: var(--paper-2); color: var(--ink-muted);
  font: 700 var(--fs-caption)/1 var(--font-text); letter-spacing: .02em; transform: translateY(3px);
  transition: transform var(--dur-1) var(--ease-out), color var(--dur-1); }
.tab[aria-selected="true"] { background: var(--surface); color: var(--ink); transform: none;
  box-shadow: inset 0 3px 0 var(--wheat); }
.tabs + .tab-panel { margin-top: -1px; border-top-left-radius: 0; }  /* joins the selected tab */
```

The phone bottom bar (Undo, Farm, Market, Cath's Plan, Log) becomes a "tab rail" on a kraft strip. It sits above `env(safe-area-inset-bottom)`, uses 28px icons over `--fs-label` names, and the selected item gets a wheat underbar 3px tall and 24px wide.

#### 4.4 Tooltip: hanging price tag (`.tooltip-popover`)

```css
.tooltip-popover { z-index: var(--z-tooltip); max-width: 34ch; padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
  background: var(--mat-card); border: 1.5px solid var(--ink); border-radius: var(--r-sm);
  font: 400 var(--fs-small)/1.4 var(--font-text); box-shadow: var(--e4);
  transform-origin: var(--tt-origin, 50% 0); animation: tt-in var(--dur-2) var(--ease-out) both; }
.tooltip-popover::before { content: ""; position: absolute; left: 8px; top: 50%; width: 6px; height: 6px;
  margin-top: -3px; border-radius: 50%; background: var(--paper); box-shadow: inset 0 0 0 1.5px var(--ink); } /* tag eyelet */
.tooltip-popover strong { font-family: var(--font-display); font-weight: 640; display: block; font-size: var(--fs-body); margin-bottom: 2px; }
@keyframes tt-in { from { opacity: 0; transform: translateY(-4px) scale(.96) rotate(-1deg); } }
.tooltip-trigger-button { width: 28px; height: 28px; border-radius: 50%; font: 800 13px/1 var(--font-display); font-style: italic; } /* italic "i", not "?" */
```

The tooltip triggers keep a 44px hit area through `::after { inset: -8px }`. Remove the dotted underlines on resource text: the visible ⓘ trigger is the affordance.

#### 4.5 Cards

- **Improvement** (`.card-framed[data-tag]`): `--mat-card`, `--r-card`, `--e3`. The tag band is 10px tall, in the `--frame` colour, with the tag's pattern at 25%. The name is `.display` at `--fs-body`. The cost coin sits top-right: a 28px wheat disc with a 1.5px ink rim and a Figures 800 number. Rules text is `--fs-small`. The flavour line is `.voice` in `--ink-muted`, under a short hairline rule.
  - Hover tilt (pointer: fine only): set `--mx` and `--my` in `pointermove` with `el.style.setProperty`.
  - `transform: perspective(800px) rotateX(calc(var(--my)*-6deg)) rotateY(calc(var(--mx)*8deg)) translateY(-3px)`, plus a soft-light spotlight `::after`.
- **Cath's Plan:** `--mat-ledger` (ruled index card), a 3px `--p-mara` left margin rule, the 32px `.cameo` top-right, Cath's line in `.voice`, and Goodwill suns as cost.
- **Replace `.card-hand`:** it currently falls back to Segoe Print or Comic Sans. Use `.voice` at weight 420 instead.
- **Agenda clipping** (`.plan-strip-item`): `--mat-news`, with a torn top edge done as a mask. The mask is CSP-safe because `img-src data:` is allowed.

  ```css
  .plan-strip-item { -webkit-mask: url("data:image/svg+xml,...zigzag 6px path...") top/12px 6px repeat-x, linear-gradient(#000 0 0) 0 6px/100% 100% no-repeat; mask: ...same...; }
  ```

  The headline is Display italic 780 at `--fs-body`, with `--hollowell-ink`/`--candor-ink` logos top-left. Each clipping sits at a fixed rotation from `:nth-child` (-1.2deg, .7deg, -.4deg), with a strip of washi tape (`::before`, 36x12px, `rgb(217 180 90/.55)`, rotated 4deg).
  - Hover/focus straightens it to 0deg, lifts it 3px and raises it to `--e4`.
  - The active slot (`.plan-strip-active`) gets `--glow-select` and a wheat "TODAY" label tab.

#### 4.6 Price-tag chips, badges and stamps

```css
.chip { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 8px 0 6px;
  border-radius: var(--r-xs) var(--r-pill) var(--r-pill) var(--r-xs); background: var(--surface);
  border: 1.5px solid var(--ink); font: 760 var(--fs-caption)/1 var(--font-figures); font-variant-numeric: tabular-nums; }
.chip--short { background: var(--paper-2); border-style: dashed; color: var(--clay-deep); } /* "need 3 more" */
.badge { height: 22px; padding: 0 8px; border-radius: var(--r-pill); font: 800 var(--fs-label)/22px var(--font-text);
  letter-spacing: .12em; text-transform: uppercase; border: 1.5px solid var(--ink); box-shadow: var(--inset-hi), 0 2px 0 var(--ink-a35); }
.badge--squeeze { background: var(--clay-deep); color: var(--paper-on-fixed-fill); }
.badge--expand  { background: var(--wheat); color: var(--ink-on-fixed-fill); }
.badge--ribbon { border-radius: 0; clip-path: polygon(0 0,100% 0,calc(100% - 6px) 50%,100% 100%,0 100%); padding-right: 14px; } /* PICKED, RECOMMENDED */
.stamp { font: 800 var(--fs-h2)/1 var(--font-display); text-transform: uppercase; letter-spacing: .08em;
  color: var(--clay-deep); border: 4px double currentColor; padding: .15em .5em; transform: rotate(-7deg);
  -webkit-mask: var(--grain-paper) 0 0/180px, linear-gradient(#000 0 0); -webkit-mask-composite: source-over; mask-mode: luminance; opacity: .92; }
.stamp--win { color: var(--pasture-deep); }
```

- The inline "Need 3 more Marks" text in Market rows becomes a `.chip--short`.
- The map's SQUEEZE and EXPAND pills (`.badge-text` in `Map.tsx`) keep their SVG geometry. Update their CSS to the Figures and Text weights above, plus a 1px highlight line.

#### 4.7 Meters: Trust, Lost Land and Rift (`.meter`)

These replace the `.hud-icon-ring` rings with segmented seed-packet meters.

```css
.meter { display: grid; grid-auto-flow: column; gap: 2px; height: 8px; }
.meter > i { border-radius: 2px; background: var(--ink-a15); box-shadow: inset 0 0 0 1px var(--ink-a15); }
.meter > i.on { background: var(--pasture-deep); }
.meter--danger > i.on { background: var(--clay-deep); }
.meter > i.on:last-of-type { animation: seg-pop var(--dur-3) var(--spring); }
@keyframes seg-pop { from { transform: scaleY(1.9); filter: brightness(1.4); } }
```

- Lost Land counts down. At 3 or below it switches to `--danger` and shows the `.label` "LAST 3" in `--clay-deep`.
- Rift uses 3 segments with `--candor`/`--hollowell` split fills (the plastic material).

#### 4.8 Sheets, modals, toasts and banners

```css
.sheet-overlay { background: var(--scrim); backdrop-filter: blur(3px) saturate(.9); z-index: var(--z-sheet); }
.sheet { background: var(--mat-paper); border-radius: var(--r-sheet) var(--r-sheet) 0 0; box-shadow: var(--e5);
  padding: var(--sp-2) var(--gutter) calc(var(--sp-5) + env(safe-area-inset-bottom));
  transition: transform var(--dur-3) var(--ease-out), opacity var(--dur-2), display var(--dur-3) allow-discrete; }
@starting-style { .sheet { transform: translateY(24px); opacity: 0; } }
.sheet::before { content: ""; display: block; width: 40px; height: 5px; border-radius: 3px; background: var(--ink-a35); margin: 0 auto var(--sp-3); } /* grabber */
.sheet header h2 { font: 640 var(--fs-h2)/1.08 var(--font-display); }
@media (min-width: 900px) { .sheet { border-radius: var(--r-sheet); max-width: 560px; margin: auto;
  outline: 1px solid var(--ink-a35); outline-offset: -8px; } }  /* inner deckle rule */
.modal { /* dialog version: same material, --e5, scale .96→1 entrance with --spring */ }

.toast { /* a receipt slip: --mat-card, perforated bottom edge */
  -webkit-mask: radial-gradient(4px at 50% 100%, #0000 98%, #000) 0 0/12px 100%; mask: same;
  padding: var(--sp-3) var(--sp-4) var(--sp-4); box-shadow: var(--e4); z-index: var(--z-toast);
  font: 600 var(--fs-small)/1.35 var(--font-text); }

.round-banner { /* market bunting */ z-index: var(--z-banner); background: var(--grain-paper), var(--soil); color: var(--paper-on-fixed-fill);
  clip-path: polygon(0 0,100% 0,calc(100% - 18px) 50%,100% 100%,0 100%,18px 50%); padding: var(--sp-3) var(--sp-7);
  font: 700 var(--fs-h2)/1 var(--font-display); text-align: center; animation: wipe var(--dur-4) var(--ease-out) both; }
.round-banner-sub { display: block; font: 700 var(--fs-label)/1.6 var(--font-text); letter-spacing: .14em; text-transform: uppercase; color: var(--wheat-hi); }
.rift-banner { background: var(--mat-plastic-c); color: var(--candor-ink); clip-path: none; border-radius: var(--r-pill); } /* corporate = plastic */
```

#### 4.9 Signature HUD elements

- **Cameo** (`.cameo`), used wherever Cath or a producer portrait appears:
  - A circular frame with a 3px `--wheat` ring, a 1.5px `--ink` outer rim and an `--e2` shadow, filled with `--surface`.
  - The producer cameos take their ring colour from `--p-*`.
  - Sizes: 32, 48, 96 and 160px.
  - Idle: `@keyframes breathe { to { transform: scale(1.012) } }` over 3.2s, alternate, on the frame only.
- **Cath's aside** (`.cath-companion` line):
  - A 48px cameo, then a torn paper strip (`--mat-card` with a 4px zigzag mask on the right edge) holding `.voice` text at `--fs-voice`.
  - A new line slides 8px in from the left and the cameo nods (`rotate(-3deg)` then 0 over 260ms).
- **Market board** (the top HUD with Round, Trust, Lost Land and Rift):
  - One `.frame` strip split into four cells by `1px var(--ink-a15)` rules.
  - Each cell has a 20px icon, a `.num` at `--fs-num-hud` ("3 / 10" with `.of`), and a `.meter` or a `.label` underneath.
  - This replaces the four pills and their dotted underlines.
  - On phone (390) the cells shrink to icon + number + meter, with the label visually hidden and still read by screen readers.
- **Ledger chips** (Produce, Marks, Goodwill on the active producer):
  - `.chip` with the icon and a `.num`. The "/round" income shows as `--fs-caption` "+2", without parentheses.
  - On change the number counts up (A6) and a "+2" or "−1" ghost floats up 14px and fades over 600ms.
- **Action pips:** three 12px seeds (filled pasture-deep, empty hollow ink ring). A spent pip shrinks to 0.6 and drops 2px with `--ease-in`.
- **Enemy plan strip:** "Tomorrow's papers", the clippings from 4.5.
- **Map labels:** region-name plates keep their SVG plate and type (`opsz` 24, 700, tracking .06em, a 1px `--surface` inner stroke).
  - Targeting dims everything else to 45% (STYLE 7) and pulses the legal regions with `--glow-target`, 1.6s, ease-in-out.

---

### 5. Motion

```css
:root {
  --ease-out: cubic-bezier(.16, 1, .3, 1);       /* entrances (alias: --ease-settle) */
  --ease-in: cubic-bezier(.55, 0, .75, 0);       /* exits */
  --ease-back: cubic-bezier(.34, 1.56, .64, 1);  /* chips, badges (alias: --ease-pop) */
  --spring: linear(0, .009, .035 2.1%, .141, .281 6.7%, .723 12.9%, .938 16.7%, 1.017, 1.077, 1.121 24%, 1.149 26.8%, 1.159, 1.154 31.7%, 1.106 37.6%, 1.031 46.5%, 1.003 51.3%, .986 56.8%, .991 69.4%, 1 100%);
  --ease-corp: cubic-bezier(.45, 0, .55, 1);     /* corporations: mechanical, never overshoot */
  --dur-1: 120ms; --dur-2: 200ms; --dur-3: 320ms; --dur-4: 480ms; --dur-hero: 900ms;
  --stagger: 40ms;
}
```

Keep `--ease-settle`, `--ease-pop`, `--dur-quick`, `--dur-base`, `--dur-slow` and `--dur-moment` as aliases so existing rules keep working.

| Thing | Entrance | Exit |
|---|---|---|
| Press and hover | 40ms down (linear); spring back over `--dur-1` | n/a |
| Tooltip | 200ms `--ease-out`, scale .96, y -4px, rotate -1deg | 120ms fade |
| Sheet or modal | 320ms `--ease-out`, y 24px (phone); scale .96 with `--spring` (desktop) | 220ms `--ease-in`, y 16px |
| Screen change | View Transition: old screen fades and scales to .98 over 200ms, new screen rises 12px over 480ms `--ease-out` | — |
| Lists and menus | `.stagger > *` rise 12px + fade over `--dur-3`, delay `calc(var(--i) * var(--stagger))`, capped at 8 items (`min()`) | — |
| Player pieces (Stall, seal) | drop from -18px with `--spring` over 420ms | shrink to .6 + fade over 200ms |
| Corporate pieces (Outlet, Doubt) | slide in from the map edge with `--ease-corp` over 360ms, plus a 1-frame specular flash | linear wipe over 180ms |

**View Transitions:** call `document.startViewTransition` in `App.tsx` when the screen changes, guarded by `if (!document.startViewTransition || reduce)`. Name the shared elements `view-transition-name: cath-cameo` and `wordmark`, so Cath's cameo travels between the title, setup and game screens.

**Stagger indices:** set `--i` with `el.style.setProperty('--i', String(i))` in a `useLayoutEffect`. Never use a `style=""` attribute, because of the CSP.

#### Reward moments (each paired with existing or new `platform/sound` cues and haptics)

1. **Liberation** (region freed), 1,300ms total:
   - 0ms: the region scales to .97 over 120ms (anticipation).
   - 120ms: the wax seal drops with `--spring` over 360ms and a 2px map nudge. Medium haptic and a "thock" sound.
   - 240ms: a 12-seed burst (I4 recipe, pasture and wheat colours), plus a ring scaling from .3 to 1.8.
   - 480ms: the Trust meter segment pops and its `.num` counts up over 600ms.
   - 1,300ms: settle.
2. **Squeeze lands**, 600ms, corporate grammar:
   - The badge slams in with no overshoot, using `--ease-corp` over 160ms.
   - The target region gets a 1-frame clay flash and a 160ms ±2px shake.
   - The Lost Land meter loses a segment, with a warning buzz.
3. **Round banner:** a bunting wipe over 480ms, a 900ms hold, then exit to the right over 300ms.
4. **End screen**, 2.4s choreography: see screen 3 below.
5. **Chapter complete:** the campaign node turns from an outline to a filled seal (same as Liberation), and the path stitches to the next node with `stroke-dashoffset` over 800ms.

Count-ups (A6) are tweened with `requestAnimationFrame` and an `--ease-out` curve. Each integer step toggles `.tick` (scale 1.12 to 1 over 90ms), and the tabular figures keep the width stable.

#### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important;
    transition-duration: 1ms !important; scroll-behavior: auto !important; }
  .stagger > *, .sheet, .modal, .tooltip-popover, .round-banner { animation: fade 180ms ease-out both !important; transition: opacity 180ms !important; }
  .burst, .shake, .breathe, .seg-pop, .tick { animation: none !important; }
  ::view-transition-group(*) { animation-duration: 180ms; } ::view-transition-old(*), ::view-transition-new(*) { animation-name: -ua-view-transition-fade-in, -ua-view-transition-fade-out; }
}
@keyframes fade { from { opacity: 0; } }
html.no-animations *, html.no-animations *::before, html.no-animations *::after { animation: none !important; transition: none !important; }
```

- **JavaScript:** count-ups and bursts check `matchMedia('(prefers-reduced-motion: reduce)')` and the `no-animations` class, then jump to the final value.
- **Haptics and sound:** these still fire, because they are not motion.

---

### 6. Screen by screen, ranked by impact

Screenshots are in `scratchpad/aaa/audit/`.

#### 1. Game table (`cathnivore-5-game-desktop.png`, `-phone.png`)

Today it reads as a dashboard.

- **Desktop layout:** 3 columns (`320px | 1fr | 320px`). The side columns sit on `--mat-paper` with no outer box. Each section is one `.frame`: Producer, Farm (`--ledger`), Actions, Market (`--tray`), Cath's Plan, Log (`--ledger`). That is 6 frames instead of about 15 nested boxes.
- **The map becomes the hero:**
  - Remove its beige bordered container.
  - The map sits directly on a slightly darker "tabletop" (`--paper-3` radial vignette with an inset shadow of 120px at 18% warm).
  - At 1440 it grows to fill the centre column. On phone it stays full width.
- **Top bar:** the Market board (4.9), with the Menu as a `.btn-icon` (hamburger glyph).
- **Below the board:** the Cath aside strip, then the plan-strip clippings.
- **Delete the map legend row** (Outlet, Buyout, Doubt, Co-op marker). Its content moves into a tooltip on an ⓘ at the map's corner. This frees vertical space for the 1280x800 rule.
- **Actions:**
  - Each row is a `.btn` with the icon, the verb label and a price-tag chip.
  - Unaffordable rows use the disabled hatch plus a `.chip--short`.
  - The "?" buttons shrink to 28px italic-i triggers inside the row's padding.
- **Market:** rows become mini cards (tag band, name, cost coin), with no wrapping. Use `text-wrap: balance` and `min-width: 0` on the name, with the cost in a fixed 72px column.
- **Phone:**
  - Order: board, then aside, then clippings, then map, then producer ledger.
  - The bottom tab rail sits on kraft. Undo becomes a `.btn-icon` at the left of the rail.
  - The Start-style sticky bars are given `padding-bottom` space on their scroll container so nothing hides behind them.

#### 2. Story scene (`cathnivore-3-story-scene-desktop.png`, `-phone.png`)

This is currently the weakest screen.

- **Stage:** full-bleed on every width (remove the 560px column). Sky gradient and hills span 100vw (`Scene.tsx` background layers), and there are 5vh ink letterbox bars top and bottom.
- **Top letterbox:** the chapter's `.label` ("CHAPTER 1 · BRINDLE HILLS") in `--wheat-hi`, with Skip as `.btn-quiet` in paper on the right.
- **Characters:** the speaking character's half-body figure stands left at 62vh. A second speaker stands right, mirrored. The non-speaker dims to 70% brightness and drops 8px.
- **Dialogue card:** bottom third, `width: min(880px, 100% - 2*var(--gutter))`, `--mat-card` with `--e4`.
  - The speaker's name sits on a tab at the card's top-left (Display 640 at `--fs-h3`, `--p-*` underline).
  - The line is `--fs-lead` Text. Cath's lines are `.voice` at `--fs-lead`.
- **Controls:** Next is `button.primary` with a "›" glyph at the card's bottom-right. Progress shows as seeds (pips). Continue stays as the accessible name (18 e2e uses), styled `.btn-quiet` as "Continue to game".
- **New lines:** a fade and a 6px rise per line. No typewriter effect.
- **Phone:** the figure is 40vh, behind the card. The card is full width, with the bottom padding plus the safe area.

#### 3. End screen (`cathnivore-6-end-*`)

- **Layout:** the hero spans the full width, and the sunburst is a `conic-gradient` on a pseudo-element with `inset: -50vmax`, clipped by the screen and not by a box. That fixes the hard square on phone.
- **Choreography** (2.4s):
  - The `.stamp` slams in at 0ms (scale 1.6 to 1, rotate -14 to -7deg, `--ease-corp` for REPOSSESSED or `--spring` for LIBERATED) with a 1-frame flash.
  - The `--fs-h1` verdict rises at 300ms.
  - Cath's cameo (160px) reacts at 600ms (delighted or worried expression).
  - The stat cards stagger in at 900ms, each `.num` at `--fs-num-hero` counting up.
  - The CTAs fade in at 2,000ms.
- **CTA hierarchy:** one primary ("Play Again" or "Next Chapter") as `.btn-lg`, then "Back to Title" as `.btn` secondary, inside a normal-flow footer, not absolutely positioned. That fixes the overlap and the ghost duplicate (check `end-screen` for a doubled render or a stale `::after`).
- **Stat cards:** `.frame` cards with a `.label` on top and a hero number. The best stat gets a wheat foil edge (`border-image: var(--gold-ish) 1`; a wheat gradient only for wins).

#### 4. Setup (`cathnivore-4-setup-*`)

- **Single frame:** one `.frame` per step, with `.group` dividers inside.
- **Mode toggle:** a two-segment control (48px tall). The selected segment is a raised card-stock key with `--glow-select`; the other is recessed `--paper-2`. This replaces the giant yellow pill.
- **Producer cards:**
  - Each becomes a 5:7 card: a `.cameo` at 96px on a producer-colour band, the name in Display at `--fs-h3`, the role as a `.label`, and the ability at `--fs-small`.
  - "Picked" shows as a `.badge--ribbon` plus `--glow-select` and a lift (`translateY(-4px)`, `--e4`).
  - "Recommended" becomes a small wheat ribbon.
- **Start button:** sits in a sticky footer bar (`--mat-paper`, top hairline, `--e4` reversed) holding "2 of 2 picked" and the Start `.btn-lg` primary. The scroll container gets `padding-bottom: calc(88px + env(safe-area-inset-bottom))`, which fixes Start covering Ines.

#### 5. Title (`cathnivore-1-title-*`)

- **Wordmark:** `.display-xl` at `--fs-display` in `--soil`, with a 1px `--surface` highlight underneath (`text-shadow: 0 1px 0 var(--surface), 0 2px 0 rgb(var(--shadow-ink)/.25)`).
- **Overline:** stays as a `.label` in `--pasture-deep`.
- **Subtitle:** `.voice` at `--fs-lead`.
- **Menu:**
  - Campaign is `.btn-lg` primary with a small seal icon. Quick Game is `.btn-lg` secondary.
  - How to Play, Settings and Credits become three 44px `.btn-icon` + label "keys" in a row (book, gear and ribbon icons), not underlined links.
  - The menu staggers in at 40ms per item.
- **Footer:** `--fs-caption` in `--ink-muted`, with links as `.btn-quiet`.
- **Phone:** Cath scales up to about 46vh, with a 50% overlap behind the menu's top edge (z under the buttons) instead of tucked into a corner. The hexes become a background layer at 60% scale, top-right, under a radial paper fade.

#### 6. Campaign (`cathnivore-2-campaign-*`)

- **Path:** chapter cards on a vertical journey path (a dashed `stroke-dasharray` SVG line that stitches through the nodes). Each node is a wax seal: filled when cleared, wheat outline when current, ink-a35 when locked.
- **Cards:**
  - `.frame` with chapter key art at 100% opacity (it is 10% today). A dim scrim and grain sit behind the art only on locked cards.
  - The title is Display at `--fs-h3`, the chapter number is a Figures `.label`, and there is a "2 / 3 regions" mini meter.
- **Current chapter:** larger (spans 2 columns on desktop), with a "CONTINUE" ribbon and `--glow-select`.
- **Locked chapters:** the lock moves into the seal. The title stays legible in `--ink-muted` at 5.07:1.

#### 7. Settings, Rules, Credits and pass-device

- **Settings:** folder tabs and `.frame` sections. Toggles become physical switches: 52x32 track, an inset shadow, a card-stock knob with `--e2`, and a pasture-deep track when on. Each row has the label (`--fs-body`) on the left and the control on the right, never wrapping caps.
- **Rules:** folder tabs, body at `--fs-body` with 62ch measure and h3 in Display. Keyword terms become `.chip`s, and icons are inline at 1.1em.
- **Pass-device:** a full-screen `--mat-paper` with a 160px cameo, the next producer's name at `--fs-h1` and "Ready" as `.btn-lg`.

---

### 7. Implementation plan

Work in a worktree off `origin/build`. Each slice is one commit: run `npm run check`, then `npm run shots` before and after (kill any stale `:4173` server first, per CLAUDE.md).

#### Slice 1: fonts and type tokens

Files touched:

- `package.json`
- `src/main.tsx` (font imports)
- new `src/styles/fonts.css`
- `src/styles/tokens.css` (fonts, type scale, `.num`)
- `src/styles/global.css` (body, h1–h3, every `font-family:` literal, of which there are 15, and `font-weight: 800` on Text)
- `campaign.css`, `table.css`
- a Vite preload plugin in `vite.config.ts`

Steps:

1. Replace `.card-hand`.
2. Add `.num` spans in `Game.tsx` (`.hud-value`), the action costs and `.stat-card dd`.
3. Measure the woff2 payload in `dist/assets` (expect about 167 KB) and add a check in `scripts/` that fails the build above 180 KB.

Log the STYLE.md amendments in `DECISIONS.md` and edit STYLE §4, §10 and §14 to match:

- **§4:** three faces with fixed roles (display, text, figures).
- **§14 gradients:** material gradients of at most 6% lightness are allowed on player-side elements.
- **§10 and §14 shadows:** shadows follow the elevation tokens.

#### Slice 2: material, spacing, radius, elevation and z tokens, plus the frame component

- New `src/styles/components.css`; convert `.desktop-col` sections to `.frame`.
- Tokenise the z-indexes.

#### Slice 3: buttons, chips, badges, tooltips and tabs

- Restyle the global `button` rules and `Tooltip.tsx` (remove the underline triggers).
- Action rows in `Game.tsx`.
- **Accessible names must not change:** every `getByRole('button', {name})` in `e2e/` must still match.

#### Slice 4: game table recomposition

- `Game.tsx`, `table.css`, `Map.tsx` CSS, the plan strip, the Market board, meters, the Cath aside, the tab rail.
- Must pass `desktop-no-scroll.spec.ts` (1280x800), `phone-map-hero.spec.ts`, `plan-strip.spec.ts`, `disabled-actions.spec.ts` and `tooltip.spec.ts`.

#### Slice 5: motion layer

- New `src/ui/motion.ts` with `countUp`, `staggerIndex` and `burst`, all honouring reduced motion and `no-animations`.
- `@starting-style` sheets, View Transitions in `App.tsx`, and the Liberation and Squeeze choreography.
- Run e2e with `reducedMotion: 'reduce'`, which most specs already use for stability.

#### Slice 6: story scene (`Scene.tsx`, `global.css` scene block)

Must pass `campaign.spec.ts`, `tutorial.spec.ts` and `chapter-resume.spec.ts`.

#### Slice 7: end screen

The `end-screen*` block. Fix the overlap and the ghost button.

#### Slice 8: setup

`Setup.tsx`. Must pass `quick-game.spec.ts`, `hotseat.spec.ts` and `ai-teammate.spec.ts`.

#### Slice 9: title and campaign

`title.css`, `TitleArt.tsx`, `CampaignScreen.tsx`, `campaign.css`. Must pass `title.spec.ts` and `campaign.spec.ts`.

#### Slice 10: settings, rules, credits and pass-device

Dark-mode pass across every component.

#### Verification for every slice

- **Screenshots:** `npm run shots` at 390x844 (phone) and 1440x900 (desktop). Add an 844x390 landscape project to `e2e/screenshots.spec.ts` for the game, story and end screens.
- **Themes and motion:** shots in light and forced dark (`data-theme`), plus one run with `reducedMotion: 'reduce'`.
- **Automated checks:** `npm run check`; `npx playwright test e2e/accessibility.spec.ts e2e/csp.spec.ts e2e/desktop-no-scroll.spec.ts` plus the slice's own specs; `npm run gates` before any release.
- **Contrast:** `accessibility.spec.ts` (axe) must stay green. Check every text-on-material combination against the token table in 3.1. Text never sits on `--kraft` without a `--surface` label backing.

#### Risks and mitigations

- **CSP:**
  - Fonts load from hashed `self` URLs.
  - Data-URI SVG for grain and masks needs `img-src data:`, which is already allowed.
  - Per-element values go through `setProperty` only.
  - `csp.spec.ts` catches regressions.
  - The View Transitions API and `@starting-style` need no inline code.
- **Performance on iPhone:**
  - Grain is one static data URI, cached and never animated.
  - `backdrop-filter` only on the sheet scrim, which is DOM over SVG, never every frame.
  - Animate only `transform` and `opacity`, apart from the registered `--lip`, which is short. Animating `font-variation-settings` is limited to hover on desktop.
  - Burst particles are capped at 12 and removed on `animationend`.
  - Fonts total about 167 KB, with the two critical files preloaded.
- **Legibility:**
  - Map labels keep their solid plates (no text on texture, STYLE 14).
  - Grain stays at or below 0.07 opacity and never sits under body text at more than 0.05.
  - The Figures digits mean the slashed zero is gone, and the O/0 distinction comes from Figtree's narrower zero. Verify it at 14px.
- **Layout regressions:**
  - The larger desktop type could break the 1280x800 no-scroll rule. The `--density: compact` scope on `.game` holds small and body text at phone sizes, and removing the legend row buys about 28px.
  - `text-box: trim` is progressive enhancement and must not be relied on for heights.
- **Safari:**
  - `linear()` needs Safari 17.2 or later. The fallback is `--ease-back` via `@supports not (transition-timing-function: linear(0,1))`.
  - `@property` needs 16.4 or later; without it the lip snaps instead of animating, which is acceptable.
  - View Transitions need 18 or later and are guarded.
  - Masks need the `-webkit-mask` prefix, included above.
- **Cath:** no filter, blend or tilt rule may match inside `.cameo svg` or `shared/cath` mounts. Grep for `.cameo svg` overrides in review, and confirm her rendering in the title, setup, scene and end shots before and after each slice.
## runnel
## Runnel: UI design system ("Dawn Ledger")

Spec for `/runnel/` (`games/runnel/`). Every font figure below was measured from the actual `@fontsource-variable` 5.3.0 tarballs: woff2 byte sizes, axes, and the OpenType features left in the latin subset after fontsource's subsetting. They are not estimates. The audit shots referenced are in ``.

---

### 1. Identity

Runnel is a quiet morning ritual. Cath's hex fields sit as a small lit diorama on a warm paper sky, and water is the only saturated colour on screen, so your eye always goes to the flow. From **Monument Valley** and **Alto** it takes almost no chrome, a sky gradient that follows the player's local time (dawn, day, dusk, night) and slow eased motion with a single beat of overshoot. From **NYT Games** and **Wordle** it takes an editorial masthead ("No. 15 · Sunday 11 October"), a confident stats sheet with a result distribution, and a staged share flow that shows you the card before you send it.

---

### 2. Typography

#### 2.1 Faces (total 171.2 KB woff2, latin only, 4 files)

| Role | Package | File (latin only) | Bytes | Axes used |
|---|---|---|---|---|
| **Display**: wordmark, sheet titles, win headline, section heads | `@fontsource-variable/fraunces` | `files/fraunces-latin-opsz-normal.woff2` | 67,304 | `opsz` 9–144, `wght` 100–900 |
| **Numerals**: timer, taps, par, stats, countdown, puzzle number | `@fontsource-variable/outfit` | `files/outfit-latin-wght-normal.woff2` | 32,292 | `wght` 100–900; features `tnum`, `pnum`, `frac` |
| **UI and body** | `@fontsource-variable/atkinson-hyperlegible-next` | `files/atkinson-hyperlegible-next-latin-wght-normal.woff2` | 33,996 | `wght` 200–800 |
| **Cath's voice** (host bubble, how-to intro) | same package | `files/atkinson-hyperlegible-next-latin-wght-italic.woff2` | 37,644 | `wght` 200–800, real italic |

All four are OFL-1.1. The faces and files rejected after measurement, and why:
- **Fraunces `full` (121 KB):** over budget. **Fraunces `soft` (62 KB):** it has no `opsz` axis and is pinned to the text cut, which is exactly the "clumsy display" problem the audit found.
- **Newsreader:** `opsz` is 132 KB.
- **Recursive:** `wght` alone is 56 KB.
- **Numbers must not use Fraunces.** Its latin subset ships only `liga` and `rvrn` (no `tnum`), and its digit advances vary from 1,019 to 1,457 units, so a ticking timer would jitter.
- **Numbers must not use Atkinson Hyperlegible Next.** Its zero is still slashed (three contours, with the slash crossing the counter). That is the audit's "1Ø" problem.

**Hard rule:** every digit a player reads is wrapped in `.num` (Outfit). This includes digits inside prose, such as "3 of 34 fields watered".

#### 2.2 `games/runnel/src/fonts.css` (new; replaces the three `@font-face` blocks at the top of `styles.css`)

```css
@font-face { font-family: "Runnel Display"; font-style: normal; font-weight: 100 900; font-display: swap;
  src: url("../../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2") format("woff2-variations"); }
@font-face { font-family: "Runnel Numerals"; font-style: normal; font-weight: 100 900; font-display: swap;
  src: url("../../../node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2") format("woff2-variations"); }
@font-face { font-family: "Runnel UI"; font-style: normal; font-weight: 200 800; font-display: swap;
  src: url("../../../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2") format("woff2-variations"); }
@font-face { font-family: "Runnel UI"; font-style: italic; font-weight: 200 800; font-display: swap;
  src: url("../../../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-italic.woff2") format("woff2-variations"); }

/* Metric-matched fallbacks to stop layout shift. Tune size-adjust with the screenshot diff in Slice 1. */
@font-face { font-family: "Runnel Display Fallback"; src: local("Georgia"), local("Times New Roman"); size-adjust: 104%; ascent-override: 96%; descent-override: 25%; }
@font-face { font-family: "Runnel UI Fallback"; src: local("Arial"), local("Helvetica"); size-adjust: 103%; ascent-override: 92%; descent-override: 22%; }
```

- Use relative `node_modules` paths on purpose: Vite always resolves them and emits hashed files to `/runnel/assets/`. A bare-specifier `url()` is not reliable.
- Do **not** import the packages' `index.css`, which pulls vietnamese and latin-ext `@font-face` rules too.
- The `/fonts/*.woff2` files stay at the site root because the other pages still use them. Runnel just stops referencing them.

#### 2.3 Type scale

The root size is 16px. "Desktop" means `@media (min-width: 700px)`. Each row is a CSS class and a token pair.

| Token / class | Face | Phone | Desktop | Line height | Tracking | Variation |
|---|---|---|---|---|---|---|
| `.t-wordmark` | Display | 1.875rem (30) | 2.5rem (40) | 1 | −0.025em | `"opsz" 144`, wght 560 |
| `.t-title` (sheet h2, win headline) | Display | 1.75rem (28) | 2.125rem (34) | 1.08 | −0.02em | `"opsz" 96`, wght 540 |
| `.t-head` (section h3) | Display | 1.25rem (20) | 1.375rem (22) | 1.2 | −0.01em | `"opsz" 32`, wght 620 |
| `.t-hero-num` (win stats) | Numerals | 3.5rem (56) | 4.5rem (72) | 0.9 | −0.035em | wght 300 |
| `.t-hud-num` | Numerals | 1.375rem (22) | 1.625rem (26) | 1 | −0.015em | wght 520 |
| `.t-stat-num` (stats tiles) | Numerals | 2rem (32) | 2.25rem (36) | 1 | −0.025em | wght 380 |
| `.t-voice` (Cath) | UI italic | 1.0625rem (17) | 1.125rem (18) | 1.42 | 0 | wght 500 |
| `.t-body` | UI | 1rem (16) | 1.0625rem (17) | 1.5 | 0.003em | wght 400 |
| `.t-button` | UI | 1rem (16) | 1rem | 1 | 0.01em | wght 680 |
| `.t-small` | UI | 0.875rem (14) | 0.9375rem (15) | 1.4 | 0.005em | wght 450 |
| `.t-label` | UI, UPPERCASE | 0.75rem (12) | 0.78rem (12.5) | 1 | +0.12em | wght 700 |
| `.t-masthead` | Numerals, UPPERCASE | 0.8125rem (13) | 0.875rem (14) | 1 | +0.14em | wght 500 |

The numeral classes all carry `font-variant-numeric: tabular-nums lining-nums; font-feature-settings: "tnum" 1;`. Outfit's default figures are already lining and its zero has no slash.

**Casing:**
- Sentence case everywhere, including buttons ("Share result").
- UPPERCASE only for `.t-label` (at most 3 words: "TIME", "TAPS", "PAR", "BEST STREAK") and for `.t-masthead`.
- Never uppercase anything set in Fraunces.
- Use the typographic "No." (not "#") for the puzzle number in UI. The share text keeps `#` for Wordle-style parsing.
- Use `text-wrap: balance` on `.t-title` and `.t-head`, and `text-wrap: pretty` on `.t-body` and `.t-voice`.

**Weight rule:** use only the weights in the table. Animating `wght` is allowed on the wordmark hover (560 to 620) and on the segmented-control label (600 to 700 when selected).

#### 2.4 Cath's art keeps its look

- `cathMarkup()` SVG and `shared/cath/cath.css` stay untouched: same art, same idle blink, sway and breathe.
- Runnel only styles the **frame** around her (the cameo, §4.11).
- Never apply `filter` other than `drop-shadow`, `mix-blend-mode` or sky-tint tokens to her SVG. The time-of-day tint affects the page background only.
- Her expressions stay as they are now: host lines use the current set, and the win sheet uses `'delighted'` in `'bust'`.
- Her voice gets its own face (Atkinson Next italic, a real italic). This replaces the smeared faux-italic Fraunces bubble (`runnel-1-puzzle-phone.png`).

---

### 3. Tokens: `games/runnel/src/tokens.css` (new, imported before `styles.css`)

Keep the existing board variables (`--dry`, `--wet`, `--groove`, `--water`, …) exactly as they are: the board SVG depends on them. The tokens below are added; old names map onto them where noted.

```css
:root {
  color-scheme: light;
  /* ---- type ---- */
  --font-display: "Runnel Display", "Runnel Display Fallback", Georgia, serif;
  --font-num: "Runnel Numerals", "Runnel UI Fallback", system-ui, sans-serif;
  --font-ui: "Runnel UI", "Runnel UI Fallback", system-ui, sans-serif;

  /* ---- colour: ink ---- */
  --ink: #2b2320;          /* 13.2:1 on --paper */
  --ink-2: #6b5d54;        /* muted; 5.4:1 on --paper, 6.0:1 on --linen */
  --ink-3: #8f8177;        /* decorative only (rules, disabled glyphs); never text */
  --soil: #5c3e22;         /* wordmark and titles; 8.3:1 on --paper */
  /* ---- colour: accents (water is the hero) ---- */
  --well: #1d5d74;         /* primary fill; #fbf8f1 on it 6.9:1; as text on --linen 6.9:1 */
  --well-hi: #2f7d99;      /* gloss stop */
  --well-lo: #164a5d;      /* bevel */
  --water: #3b8db0;        /* existing; 3.2:1 on paper: graphics only, never text */
  --water-hi: #bfeaf4;
  --sprout: #3f6327;       /* success text and badges; 6.5:1 on --linen */
  --sun: #d9b45a;          /* streak, today; graphics only */
  --sun-ink: #8a5a12;      /* sun-coloured text; 5.6:1 on --linen */
  --clay: #b5523b;         /* "over par"; graphics and 18px+ text only */
  /* ---- surfaces and materials ---- */
  --paper: #f4ede1;
  --linen: #fbf8f1;        /* sheets and cards (old --surface) */
  --pebble: #e9e0d0;       /* inset tracks and stat stones; --ink 11.8:1, --well 5.6:1 */
  --hairline: rgb(92 62 34 / 0.14);
  --hairline-strong: rgb(92 62 34 / 0.24);
  --sky-top: #f7f0e3; --sky-mid: #f4ede1; --sky-low: #efe2cd; --sky-haze: rgb(191 234 244 / 0.28);
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .36 0 0 0 0 .24 0 0 0 0 .13 0 0 0 .5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --grain-opacity: 0.05;
  --backdrop: rgb(43 35 32 / 0.32);
  --focus: #1d5d74;        /* 3:1+ against paper, linen and pebble */
  --focus-halo: rgb(191 234 244 / 0.9);
  /* ---- radii ---- */
  --r-xs: 6px; --r-sm: 10px; --r-md: 14px; --r-lg: 20px; --r-xl: 28px; --r-pill: 999px;
  /* ---- elevation: warm, two-part (contact + ambient) ---- */
  --e-1: 0 1px 0 rgb(92 62 34 / .06), 0 2px 6px -2px rgb(92 62 34 / .14);
  --e-2: 0 1px 0 rgb(92 62 34 / .06), 0 8px 18px -8px rgb(92 62 34 / .26);
  --e-3: 0 2px 0 rgb(92 62 34 / .05), 0 18px 40px -16px rgb(60 40 20 / .38);
  --e-4: 0 2px 0 rgb(92 62 34 / .05), 0 32px 70px -24px rgb(40 26 12 / .5);
  --inset-hi: inset 0 1px 0 rgb(255 255 255 / .75);
  --inset-track: inset 0 1px 2px rgb(92 62 34 / .18), inset 0 0 0 1px var(--hairline);
  /* ---- glows ---- */
  --glow-water: 0 0 0 1px rgb(59 141 176 / .35), 0 0 22px rgb(59 141 176 / .35);
  --glow-sun: 0 0 0 1px rgb(217 180 90 / .5), 0 0 18px rgb(217 180 90 / .45);
  /* ---- spacing (4-based) ---- */
  --s-0: 2px; --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-7: 32px; --s-8: 40px; --s-9: 56px;
  --gutter: max(16px, env(safe-area-inset-left));
  /* ---- z ---- */
  --z-sky: 0; --z-board: 1; --z-chrome: 10; --z-host: 20; --z-tooltip: 50; --z-toast: 60; --z-fx: 70;
  /* ---- motion ---- */
  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --ease-in: cubic-bezier(.7, 0, .84, 0);
  --ease-inout: cubic-bezier(.65, 0, .35, 1);
  --ease-back: cubic-bezier(.34, 1.4, .64, 1);
  --spring: cubic-bezier(.34, 1.4, .64, 1); /* fallback, overridden below */
  --dur-press: 60ms; --dur-1: 140ms; --dur-2: 240ms; --dur-3: 420ms; --dur-4: 640ms; --dur-hero: 900ms;
  --stagger: 60ms;

  /* compatibility aliases for existing rules */
  --surface: var(--linen); --ink-muted: var(--ink-2); --paper-2: var(--pebble);
}
@supports (transition-timing-function: linear(0, 1)) {
  :root { --spring: linear(0, .009, .035 2.1%, .141, .281 6.7%, .723 12.9%, .938 16.7%, 1.017, 1.077, 1.121 24%, 1.149 26.8%, 1.159, 1.154 31.7%, 1.106 37.6%, 1.031 46.5%, 1.003 51.3%, .986 56.8%, .991 69.4%, 1 100%); }
}

/* Time-of-day sky: main.ts sets <html data-sky="dawn|day|dusk"> from local hour (5-10 dawn, 10-17 day, 17-21 dusk, else dusk). */
:root[data-sky="dawn"] { --sky-top: #f6e9e0; --sky-mid: #f4ede1; --sky-low: #eedfc8; --sky-haze: rgb(246 196 170 / .25); }
:root[data-sky="dusk"] { --sky-top: #efe2d6; --sky-mid: #f1e6d6; --sky-low: #e8d5bb; --sky-haze: rgb(210 160 190 / .18); }

@media (prefers-color-scheme: dark) { :root {   /* "night", regardless of data-sky */
  color-scheme: dark;
  --ink: #f3e9d8; --ink-2: #b9aa98; --ink-3: #7d6f62; --soil: #ecd6b4;
  --well: #5fbde0; --well-hi: #8ad3ee; --well-lo: #3f97b8;   /* text on well: #0e2430, 7.5:1 */
  --sprout: #9ccf72; --sun-ink: #e2bf68; --clay: #e0775d;     /* 8.6:1 and 8.8:1 on --pebble */
  --paper: #1c1714; --linen: #2a221d; --pebble: #332a24;
  --hairline: rgb(243 233 216 / .1); --hairline-strong: rgb(243 233 216 / .18);
  --sky-top: #141826; --sky-mid: #1c1714; --sky-low: #231b16; --sky-haze: rgb(79 179 217 / .10);
  --grain-opacity: .07; --backdrop: rgb(0 0 0 / .55);
  --focus: #8ad3ee; --focus-halo: rgb(20 40 52 / .9);
  --e-2: 0 8px 18px -8px rgb(0 0 0 / .6); --e-3: 0 18px 40px -16px rgb(0 0 0 / .7); --e-4: 0 32px 70px -24px rgb(0 0 0 / .8);
  --inset-hi: inset 0 1px 0 rgb(255 255 255 / .06);
} }
```

Two contrast rules:
1. `--water`, `--sun`, `--clay` and `--ink-3` are never used for body text.
2. Any text on the sky gradient uses `--ink`, `--ink-2` or `--soil`, which pass AA at every sky stop because the lightest-to-darkest sky range is under 6% L.

---

### 4. Components (CSS recipes)

#### 4.1 Page and sky

```css
html, body { background: var(--sky-mid); color: var(--ink); font: 400 1rem/1.5 var(--font-ui); }
body { background:
  radial-gradient(120% 60% at 50% 62%, var(--sky-haze), transparent 70%),
  linear-gradient(180deg, var(--sky-top), var(--sky-mid) 45%, var(--sky-low)); background-attachment: fixed; }
body::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: var(--z-sky);
  background: var(--grain); opacity: var(--grain-opacity); mix-blend-mode: multiply; }
```

This **deletes** the diagonal-line paper texture, which the audit described as "reads as noise".

#### 4.2 Masthead (header)

- Grid: `1fr auto 1fr`. Back link on the left (icon button plus a "Games" `.t-small` label; the label is hidden below 360px). Wordmark in the centre. Icon buttons on the right.
- Below the wordmark, add `<p class="masthead">`: `.t-masthead`, `--ink-2`, with flanking hairline rules:

```css
.masthead { display: flex; align-items: center; gap: var(--s-3); justify-content: center; }
.masthead::before, .masthead::after { content: ""; flex: 0 1 48px; height: 1px; background: var(--hairline-strong); }
.wordmark { font: 560 var(--fs-wordmark, 1.875rem)/1 var(--font-display); font-variation-settings: "opsz" 144;
  letter-spacing: -.025em; color: var(--soil); margin: 0; transition: font-variation-settings var(--dur-2) var(--ease-out), font-weight var(--dur-2); }
@media (hover: hover) { .top:hover .wordmark { font-weight: 620; } }
```

#### 4.3 Buttons

```css
.btn { --bg: var(--linen); --fg: var(--ink); --edge: var(--hairline-strong);
  display: inline-flex; align-items: center; justify-content: center; gap: var(--s-2);
  min-height: 52px; padding: 0 var(--s-6); border: 0; border-radius: var(--r-md);
  font: 680 1rem/1 var(--font-ui); letter-spacing: .01em; color: var(--fg); background: var(--bg);
  box-shadow: var(--inset-hi), inset 0 0 0 1px var(--edge), var(--e-1);
  transition: transform var(--dur-2) var(--spring), box-shadow var(--dur-1), filter var(--dur-1); cursor: pointer;
  -webkit-tap-highlight-color: transparent; }
.btn-primary { --fg: #fbf8f1; --edge: transparent;
  background: linear-gradient(rgb(255 255 255 / .18), rgb(255 255 255 / 0) 55%), linear-gradient(var(--well-hi), var(--well));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .28), inset 0 -3px 0 var(--well-lo), 0 6px 14px -6px rgb(29 93 116 / .55); }
@media (prefers-color-scheme: dark) { .btn-primary { --fg: #0e2430; } }
.btn-quiet { background: transparent; box-shadow: none; color: var(--well); padding: 0 var(--s-3); min-height: 44px; }
@media (hover: hover) { .btn:hover { transform: translateY(-1px); filter: brightness(1.04) saturate(1.05); }
  .btn-primary:hover { box-shadow: inset 0 1px 0 rgb(255 255 255 / .28), inset 0 -3px 0 var(--well-lo), var(--glow-water); } }
.btn:active { transform: translateY(2px) scale(.98); transition-duration: var(--dur-press); }
.btn-primary:active { box-shadow: inset 0 1px 0 rgb(255 255 255 / .2), inset 0 -1px 0 var(--well-lo), 0 2px 4px -2px rgb(29 93 116 / .5); }
.btn:disabled { opacity: .45; filter: saturate(.4); transform: none; cursor: default; }
.btn:focus-visible, .icon-btn:focus-visible, [role="tab"]:focus-visible {
  outline: 3px solid var(--focus); outline-offset: 3px; box-shadow: 0 0 0 7px var(--focus-halo); }
```

This replaces the default-looking yellow focus ring in `runnel-2-howto-*`.

**Icon button:**

```css
.icon-btn { inline-size: 44px; block-size: 44px; border-radius: 50%; border: 0; display: grid; place-items: center;
  background: transparent; color: var(--ink-2); transition: background var(--dur-1), transform var(--dur-2) var(--spring), color var(--dur-1); }
.icon-btn svg { inline-size: 22px; block-size: 22px; stroke: currentColor; stroke-width: 1.75; fill: none; stroke-linecap: round; stroke-linejoin: round; }
@media (hover: hover) { .icon-btn:hover { background: var(--pebble); color: var(--ink); } }
.icon-btn:active { transform: scale(.9); transition-duration: var(--dur-press); }
```

#### 4.4 Segmented tabs (Daily / Practice) and size picker

The thumb slides; it is driven by `:has()`, so no JS is needed.

```css
.segmented { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; padding: 4px;
  border-radius: var(--r-pill); background: var(--pebble); box-shadow: var(--inset-track); min-inline-size: 232px; }
.segmented::before { content: ""; position: absolute; inset: 4px auto 4px 4px; inline-size: calc(50% - 4px);
  border-radius: var(--r-pill); background: var(--linen); box-shadow: var(--inset-hi), var(--e-1);
  transition: translate var(--dur-3) var(--spring); }
.segmented:has(#tab-practice[aria-selected="true"])::before { translate: 100% 0; }
.segmented button { position: relative; z-index: 1; min-height: 40px; border: 0; background: none; border-radius: var(--r-pill);
  font: 600 .9375rem/1 var(--font-ui); color: var(--ink-2); transition: color var(--dur-2), font-weight var(--dur-2); }
.segmented button[aria-selected="true"] { color: var(--ink); font-weight: 700; }
```

`.sizes` uses the same recipe with three columns. The thumb moves by `translate: calc(var(--seg-i) * 100%) 0`. Here `--seg-i` is the one value that needs JS (`sizes.style.setProperty('--seg-i', idx)`), which is CSP-safe.

#### 4.5 Tooltip (desktop hover and keyboard focus; streak calendar cells, icon buttons)

The tooltip uses a `data-tip` attribute, not `title`.

```css
[data-tip] { position: relative; }
@media (hover: hover) { [data-tip]:hover::after, [data-tip]:focus-visible::after {
  content: attr(data-tip); position: absolute; inset-block-end: calc(100% + 8px); inset-inline-start: 50%; translate: -50% 0;
  z-index: var(--z-tooltip); white-space: nowrap; padding: 6px 10px; border-radius: var(--r-sm);
  font: 600 .8125rem/1.2 var(--font-ui); color: var(--linen); background: var(--ink); box-shadow: var(--e-2);
  animation: tip-in var(--dur-2) var(--ease-out) both; pointer-events: none; } }
@keyframes tip-in { from { opacity: 0; translate: -50% 4px; } }
```

#### 4.6 Cards and stat stones

```css
.stone { display: grid; gap: var(--s-1); justify-items: center; padding: var(--s-3) var(--s-2) var(--s-3);
  border-radius: var(--r-md); background: var(--pebble); box-shadow: var(--inset-track); }
.stone .num { font: 380 2rem/1 var(--font-num); letter-spacing: -.025em; font-variant-numeric: tabular-nums lining-nums; color: var(--ink); }
.stone .lbl { font: 700 .75rem/1 var(--font-ui); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-2); }
```

#### 4.7 Bars

**Water channel** (replaces `.progress`; this is the signature HUD element):

```css
.channel { position: relative; block-size: 10px; border-radius: var(--r-pill);
  background: color-mix(in oklab, var(--groove) 30%, var(--pebble)); box-shadow: var(--inset-track); overflow: hidden; }
.channel-fill { position: absolute; inset: 2px auto 2px 2px; border-radius: inherit;
  inline-size: calc((100% - 4px) * var(--progress, 0));
  background: repeating-linear-gradient(110deg, rgb(255 255 255 / 0) 0 14px, rgb(255 255 255 / .35) 14px 18px, rgb(255 255 255 / 0) 18px 34px),
              linear-gradient(var(--water-hi) -40%, var(--water) 60%);
  background-size: 34px 100%, 100% 100%; animation: channel-flow 1.6s linear infinite;
  transition: inline-size var(--dur-4) var(--ease-out); }
.channel-fill::after { content: ""; position: absolute; inset-inline-end: -3px; inset-block: -1px; inline-size: 8px; border-radius: 50%;
  background: var(--water-hi); box-shadow: 0 0 10px var(--water); } /* the "drop head" */
.channel.done .channel-fill { background: linear-gradient(var(--water-hi) -40%, var(--sprout) 80%); animation: none; }
@keyframes channel-flow { to { background-position: 34px 0, 0 0; } }
```

Under the channel, add the line "<span class=num>3</span> of <span class=num>34</span> fields watered" in `.t-small` `--ink-2`.

**Distribution bars** (stats sheet, Wordle-style, by drops 3/2/1):

```css
.dist-row { display: grid; grid-template-columns: 3.2em 1fr; gap: var(--s-2); align-items: center; }
.dist-bar { block-size: 24px; border-radius: var(--r-xs); background: var(--pebble); min-inline-size: 28px;
  inline-size: calc(var(--share, 0) * 100%); display: flex; justify-content: flex-end; padding-inline: 8px;
  font: 600 .875rem/24px var(--font-num); color: var(--ink); transition: inline-size var(--dur-4) var(--ease-out); }
.dist-row.today .dist-bar { background: var(--well); color: #fbf8f1; }
```

#### 4.8 Badges and chips

```css
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px 6px 10px; border-radius: var(--r-pill);
  font: 700 .75rem/1 var(--font-ui); letter-spacing: .1em; text-transform: uppercase; }
.badge-under { color: var(--sprout); background: color-mix(in oklab, var(--sprout) 14%, var(--linen)); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--sprout) 35%, transparent); }
.badge-par   { color: var(--well);   background: color-mix(in oklab, var(--water) 14%, var(--linen)); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--water) 35%, transparent); }
.badge-over  { color: var(--ink-2);  background: var(--pebble); }
.chip-streak { color: var(--sun-ink); background: color-mix(in oklab, var(--sun) 18%, var(--linen)); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--sun) 45%, transparent); }
```

- `.chip-streak` contains an inline SVG flame, replacing the 🔥 emoji in UI text. The emoji stays in share text only.
- Badge copy: "Under par", "On par", "Over par".

#### 4.9 Sheets (help, stats, win)

Phone (below 700px) uses a **bottom sheet**; desktop uses a centred card.

```css
.sheet { border: 0; padding: 0; color: var(--ink); background: transparent; max-inline-size: min(480px, 100vw - 32px); }
.sheet form { position: relative; padding: var(--s-7) var(--s-6) calc(var(--s-6) + env(safe-area-inset-bottom));
  border-radius: var(--r-xl); background: var(--grain) 0 0 / 180px, linear-gradient(180deg, var(--linen), color-mix(in oklab, var(--linen) 92%, var(--pebble)));
  box-shadow: var(--inset-hi), 0 0 0 1px var(--hairline), var(--e-4); }
.sheet::backdrop { background: var(--backdrop); backdrop-filter: blur(6px) saturate(115%); }
@media (max-width: 699px) {
  .sheet { margin: auto 0 0; inline-size: 100vw; max-inline-size: 100vw; max-block-size: 92dvh; }
  .sheet form { border-radius: var(--r-xl) var(--r-xl) 0 0; padding-top: var(--s-8); }
  .sheet form::before { content: ""; position: absolute; inset-block-start: 10px; inset-inline-start: 50%; translate: -50% 0;
    inline-size: 40px; block-size: 5px; border-radius: 3px; background: var(--hairline-strong); } }
.sheet[open] { opacity: 1; translate: 0 0; scale: 1;
  transition: opacity var(--dur-3) var(--ease-out), translate var(--dur-4) var(--spring), scale var(--dur-4) var(--spring),
              display var(--dur-3) allow-discrete, overlay var(--dur-3) allow-discrete; }
@starting-style { .sheet[open] { opacity: 0; translate: 0 24px; scale: .97; } }
@media (max-width: 699px) { @starting-style { .sheet[open] { translate: 0 100%; scale: 1; } } }
.sheet { opacity: 0; translate: 0 16px; transition: opacity var(--dur-2) var(--ease-in), translate var(--dur-2) var(--ease-in),
  display var(--dur-2) allow-discrete, overlay var(--dur-2) allow-discrete; } /* exit ~35% faster */
```

- Keep the existing `sheet-in` keyframe as an `@supports not selector(:open)`-style fallback: Safari before 17.5 has no `@starting-style`.
- **Close button** (`.close-x`): an icon button pinned at `inset: 12px 12px auto auto`, using an SVG ×, not the "×" glyph.

#### 4.10 Toast

The toast lives inside the sheet (it is `role=status`):

```css
.toast { position: absolute; inset-inline: 0; inset-block-end: calc(100% + 12px); margin: 0 auto; inline-size: max-content;
  padding: 10px 16px 10px 12px; border-radius: var(--r-pill); background: var(--ink); color: var(--linen);
  font: 600 .875rem/1 var(--font-ui); box-shadow: var(--e-3); display: flex; gap: 8px; align-items: center; }
.toast:empty { display: none; }
.toast:not(:empty) { animation: toast-in var(--dur-3) var(--spring) both; }
@keyframes toast-in { from { opacity: 0; translate: 0 10px; scale: .94; } }
```

JS clears the text after 2.4 s.

#### 4.11 Signature: Cath's cameo and voice card (the host row)

```css
.host { display: grid; grid-template-columns: auto 1fr; gap: var(--s-3); align-items: center; z-index: var(--z-host); }
.host-face { inline-size: 56px; block-size: 56px; border-radius: 50%; padding: 3px; overflow: hidden;
  background: conic-gradient(from 200deg, #f3d98f, var(--sun), #b88a2c, #f3d98f); /* thin gilt rim */
  box-shadow: 0 0 0 3px var(--linen), 0 0 0 4px var(--hairline-strong), var(--e-2); }
.host-face svg { border-radius: 50%; background: radial-gradient(circle at 50% 35%, #f8e7b8, #e7c46c); }
.host-line { position: relative; margin: 0; padding: var(--s-3) var(--s-4); border-radius: var(--r-lg);
  background: var(--linen); box-shadow: var(--inset-hi), 0 0 0 1px var(--hairline), var(--e-1);
  font: italic 500 1.0625rem/1.42 var(--font-ui); color: var(--ink); text-wrap: pretty; }
.host-line::before { content: ""; position: absolute; inset-inline-start: -6px; inset-block-start: 50%; inline-size: 12px; block-size: 12px;
  translate: 0 -50%; rotate: 45deg; background: var(--linen); box-shadow: -1px 1px 0 var(--hairline); }
.host-line.enter { animation: voice-in var(--dur-3) var(--ease-out) both; }
@keyframes voice-in { from { opacity: 0; translate: -6px 0; filter: blur(3px); } }
@media (min-width: 700px) { .host-face { inline-size: 72px; block-size: 72px; } }
```

#### 4.12 Signature: the HUD "ledger"

The three stat stones become a single ledger line:

`[ 0:42 TIME ]  │  [ 3 TAPS · par 79 ]`

- Time and taps use `.t-hud-num`, with labels in `.t-label` underneath.
- Par is shown as "par 79" in `.t-small` `--ink-2` beside the taps, so the player reads taps *against* par.
- Separator: a 1px × 28px `--hairline-strong` rule.
- When taps exceed par, the taps number shifts to `--clay` (22px is large text, so 3:1 is enough). When it's within par, it stays `--ink`.
- On each tap, the number runs the `tick` animation (§5).

#### 4.13 Signature: the board diorama

```css
.stage { position: relative; display: grid; place-items: center; min-block-size: 0; }
.stage::before { content: ""; position: absolute; inset: auto 12% 4% 12%; block-size: 14%; border-radius: 50%;
  background: radial-gradient(closest-side, rgb(92 62 34 / .22), transparent); filter: blur(6px); z-index: 0; } /* contact shadow */
.board { position: relative; z-index: var(--z-board); inline-size: 100%; block-size: 100%; max-block-size: 100%;
  filter: drop-shadow(0 10px 14px rgb(92 62 34 / .18)); }
.board.won { animation: exhale var(--dur-hero) var(--ease-inout) both; }
@keyframes exhale { 50% { scale: 1.015; } }
```

The `drop-shadow` is static: never animate `filter` on the board.

---

### 5. Motion

| Use | Duration | Easing |
|---|---|---|
| Press down | 60 ms | linear |
| Release | 240 ms | `--spring` |
| Hover | 140 ms | `--ease-out` |
| Panel or sheet enter | 420–640 ms | `--ease-out` for opacity, `--spring` for translate |
| Exit | 240 ms | `--ease-in` (about 35% faster than enter) |
| Stagger | 60 ms per item, base delay 120 ms | `--ease-out` |
| Number tick (each tap) | 180 ms | `--ease-back` |
| Count-up (win) | 700 ms | ease-out cubic in JS |
| Idle breathing | Cath only (shared) | none on chrome |

```css
.stagger > * { animation: rise var(--dur-3) var(--ease-out) both; animation-delay: calc(var(--i, 0) * var(--stagger) + 120ms); }
@keyframes rise { from { opacity: 0; translate: 0 12px; } }
.num.tick { animation: tick 180ms var(--ease-back); }
@keyframes tick { from { scale: 1.14; color: var(--well); } }
```

Stagger indices are set via `el.style.setProperty('--i', String(i))` (CSP-safe).

#### Solve choreography (win)

Times are measured from the solving tap.

1. **0–600 ms:** the existing flood and sprout runs.
2. **600 ms:** `.board.won` exhales (900 ms) and the channel turns sprout-green.
3. **1,300 ms:** the sheet rises (spring).
4. **+120 ms:** the cameo pops (`scale .6 → 1`, `--ease-back`, 420 ms).
5. **+60 ms steps (stagger):** eyebrow, headline, stat stones.
6. **Stones in:** time counts up 0:00 → final and taps 0 → final over 700 ms; par is static.
7. **Count-up done:** the par badge stamps in (`scale 1.35 → 1`, 320 ms, `--spring`) and fires a **water burst**:
   - 10 `<i>` drops on `--ang` and `--dist`, plus a ring. Recipe I4 from the research, `--c: var(--water)`.
   - Sits in `.fx` at `z-index: var(--z-fx)` and is removed after 900 ms.
   - Plays a `sound.ts` chime.
8. **+200 ms:** if the streak grew, the streak chip's number ticks from old to new.
9. **+300 ms:** the share button glows once (`box-shadow` to `--glow-water` and back, 1.2 s).
10. **Count-down:** "Next Runnel in <span class=num>13:53:02</span>" ticks every second.

The new module `games/runnel/src/fx.ts` holds this. It exports `countUp(el, to, fmt, ms)`, `burst(host, color)`, `stagger(container)` and `tick(el)`. **Every function checks `matchMedia('(prefers-reduced-motion: reduce)')` and writes the final state immediately.**

#### Reduced motion: a designed fallback

- Keep the existing global 1 ms rule.
- Add `.channel-fill { animation: none }`, no burst or exhale, and `.stagger > * { animation: fade 160ms both }` (opacity only).
- Count-ups write final values at once.
- The sheet fades in with no translate.
- Cath's own idle animation is already disabled by `cath.css`.

---

### 6. Screen by screen (ranked by impact)

#### 1. Win sheet (`runnel-3-win-desktop.png`, `runnel-3-win-phone.png`)

Today this is the generic cream modal.

- **Layout:**
  - Cameo (88px phone, 104px desktop) overlapping the top edge with a gilt rim.
  - Masthead eyebrow "NO. 15 · SUN 11 OCT" (`.t-masthead`, `--sprout`).
  - Headline "Every field is watered." (`.t-title`, `--soil`, centred).
  - Then **two hero stones** (Time, Taps) in `.t-hero-num` Outfit 300, with "par 79" and the par **badge** under Taps.
- **Streak row:** `.chip-streak` "5-day streak" plus "best 9" in `.t-small`. This replaces the run-on `win-note` sentence: `parNote` becomes the badge plus one short line.
- **Share-card preview (the Wordle move):**
  - A 4:3 "postcard": linen, perforated edge via `radial-gradient` mask dots along the top, a small stamp-style hex holding the drop count as 1–3 SVG drops, and the same text the share produces.
  - The heading "Here's what you'll share" in `.t-label`.
  - This shows people exactly what Share does.
- **Actions:** the primary **Share result** (`.btn-primary`, full width, with a share or copy icon) above the secondary **Play practice**. The actions are now stacked, not two equal pills.
- **Footer:** "Next Runnel in 13:53:02", live countdown, centred `.t-small`.
- On phone this is a bottom sheet; on desktop a 480px card.
- Fixes in passing: no ghost duplicate, and nothing overlaps on phone.

#### 2. Puzzle screen (`runnel-1-puzzle-phone.png`, `runnel-1-puzzle-desktop.png`)

- **Masthead:** the Fraunces `opsz` 144 wordmark at weight 560 (lighter and airier than today's 700), plus the masthead date line. Move "Daily #15 · Sun, Oct 11" out of `.hud-title` into the masthead. Keep `#hud-title` in the DOM, because e2e checks `toContainText('Practice')`; it becomes the masthead `<p>`.
- **Controls:** a sliding segmented control and 44px icon buttons with stroke icons.
- **HUD:** the HUD ledger (§4.12) replaces the "0:00 time 3 taps 79 par" line.
- **Host:** the cameo and a real-italic voice card.
- **Board fills the height:** the 100px of dead space on phone goes. `.app` grid rows are `auto auto auto 1fr auto` and the `.stage` SVG gets `block-size: 100%`. The board gains about 18% in size at 390x844.
- **Diorama:** a contact shadow under the board, plus the sky gradient and grain replacing the diagonal lines.
- **Footer:** the water channel with its drop head, the "3 of 34 fields watered" line in `.num` spans, and Cath's tip and New puzzle as `.btn-quiet` with icons.
- **Landscape 844x390** (not covered today: the single 760px column makes the board tiny):

```css
@media (orientation: landscape) and (max-height: 500px) {
  .app { max-width: none; grid-template-columns: minmax(260px, 34%) 1fr; grid-template-rows: auto auto auto 1fr auto;
    column-gap: var(--s-6); }
  .top, .modes, .hud, .host, .foot { grid-column: 1; }
  .stage { grid-column: 2; grid-row: 1 / -1; }
  .wordmark { font-size: 1.5rem; } .host-face { inline-size: 44px; block-size: 44px; } .host-line { font-size: 1rem; }
}
```

#### 3. How to play (`runnel-2-howto-phone.png`, `runnel-2-howto-desktop.png`)

- **Header:** a cameo ("Hi, I'm Cath…" in the voice card style), then the title "How to play" in `.t-title`.
- **Step cards:** the three outline hex pictograms become **step cards**:
  - Each card is a pebble stone holding a filled mini-tile: dry tile colours, wet water stroke, and a sprout in `--sprout`.
  - Under each card is a `.t-label` caption with a number disc (Outfit 600 in a 22px `--well` circle).
  - The cards stagger in, and each one's demo animates once on entry (the turn rotates 60°, the water dashes along, the sprout scales up).
- **Rules:** the numbered `<ol>` becomes 4 icon rows (tap, spring, no spill, pin) with a 32px icon disc on the left and `.t-body` on the right. Text is left-aligned.
- **Footnote:** the "midnight UTC / par" note becomes a `.t-small` `--ink-2` line with a hairline above it.
- **Start:** a full-width `.btn-primary` "Start today's Runnel" with the new focus ring.

#### 4. Stats sheet ("Your Runnel")

There is no audit shot of this screen; capture it in Slice 1.

- **Tiles:** a 3×2 grid of `.stone` tiles (`.t-stat-num`). Streak tiles use the flame SVG, not the emoji.
- **Distribution:** a new block, "Drops", with 3 bars computed from `data.results` via `dropsFor(taps, par)`. Today's bucket is highlighted `--well`.
- **Calendar:** the 28-day grid becomes a **hex calendar**:
  - 7 per row, `clip-path: polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)`, 28px.
  - Unsolved days are `--pebble`; solved days are water-filled with an inner highlight.
  - Today has a `--sun` ring via a wrapper `drop-shadow`, since `clip-path` cuts `box-shadow`.
  - `data-tip` shows "Sun 11 Oct · solved".

#### 5. Practice size picker, dark mode and sky

- **Size picker:** uses the sliding thumb.
- **Dark mode:** becomes "night" (the `prefers-color-scheme: dark` tokens).
- **Sky:** the `data-sky` dawn and dusk tints are a small but noticeable daily-ritual touch.

---

### 7. Implementation plan

Work in a separate worktree per the session rules. Each slice must leave the game shippable.

#### Slice 1: Foundation (fonts and tokens)

- **Install:** `npm i @fontsource-variable/fraunces @fontsource-variable/outfit @fontsource-variable/atkinson-hyperlegible-next`.
- **Add** `games/runnel/src/fonts.css` and `games/runnel/src/tokens.css`. Import both in `games/runnel/src/main.ts` before `./styles.css`.
- **Change:**
  - Delete the three `@font-face` blocks and the `:root` palette from `styles.css`; keep the board variables via the aliases.
  - Set `font-family` to `var(--font-ui)` and apply the type classes to the wordmark, `.sheet h2`, `.win-numbers b`, `.stat-grid b`, `.hud-stats b` and `.host-line`.
  - Add `.num` spans in `main.ts` wherever digits are rendered.
- **Verify:**
  - Run `npm run build:site` and `ls -l dist-site/runnel/assets/*.woff2`. Exactly 4 files should be emitted, totalling about 171 KB.
  - Run a Playwright check on `/runnel/` that counts `font` responses (expect 4 or fewer) and asserts `document.fonts.check('16px "Runnel Numerals"')`.
  - Tune `size-adjust` until the before and after screenshots show no reflow during swap.

#### Slice 2: Components

- **What:** buttons, icon buttons, segmented control and sizes, sheet (bottom sheet plus `@starting-style`), toast, focus ring, tooltip.
- **Files:** `styles.css`, plus a small change in `main.ts` (`--seg-i`; `data-tip` instead of `title`).

#### Slice 3: Puzzle screen

- **What:** masthead and date, HUD ledger, cameo and voice card, board fills the stage, diorama shadow, water channel, sky and grain, landscape layout.
- **Files:**
  - `index.html`: the markup for the masthead, ledger and channel. Keep the ids `hud-title`, `hud-time`, `hud-taps`, `hud-par` and `progress-fill`; the last becomes `.channel-fill`, so keep the id.
  - `main.ts`: `data-sky`, `.host-line.enter`, `tick()` on taps.
  - `styles.css`.

#### Slice 4: Win sheet and choreography

- **What:** new markup (badge, streak chip, share postcard, countdown) and the new `fx.ts`, with sounds via `sound.ts`.
- **Keep the existing ids:** `win-time`, `win-taps`, `win-par`, `btn-share`, `btn-next`, `toast`.
- **Count-up and e2e:** the count-up must **finish on the exact value**. `e2e-site/site.spec.ts` line 121 asserts `#win-taps` equals par, and Playwright's auto-retry absorbs the 700 ms. Under `navigator.webdriver`, skip the count-up anyway for determinism.

#### Slice 5: How-to and stats

- **What:** step cards, icon rule rows, drop distribution, hex calendar.
- **Files:** `index.html`, `main.ts` (`showStats`), `styles.css`.

#### Slice 6: Polish pass

- Dark and night contrast audit, a reduced-motion audit (emulate `reducedMotion: 'reduce'` in screenshots), dawn and dusk sky checks, and removing the unused old rules (`.hud-title` styles, the line texture, `sheet-in` once `@starting-style` is verified on Safari 17.5 or later).

#### Verification for every slice

- `npm run check`, then `npm run e2e:site`, which covers the `Runnel` describe block: tap counting, solve to `#win-taps` and `.board.won`, practice sizes, keyboard roving tabindex, and the help dialog on first visit.
- Screenshots of `/runnel/`, `/runnel/?nohelp`, the solved state (solve with `tapsToSolve` as the e2e does) and the stats sheet, at **390x844, 844x390 and 1440x900**, in light, dark and reduced-motion. Use `npm run shots` if it covers Runnel; otherwise use the audit's script against `npx vite preview --outDir dist-site`. Kill any stale `:4173` server first.
- The CSP spec must stay green.
- Contrast: spot-check any new text-on-colour pair with a ratio script. The table in §3 gives the baseline.

#### Risks

| Risk | Mitigation |
|---|---|
| **CSP** `style-src 'self'` | No `style=""` anywhere; dynamic values only via `style.setProperty` (`--progress`, `--i`, `--seg-i`, `--share`, `--ang`, `--dist`). `data-tip` and `attr()` are fine. The grain SVG is a `data:` URL in CSS, which is allowed by `img-src 'self' data:`. Cath's markup is still injected as SVG, not styles. |
| **Font payload** | The budget is enforced by importing only 4 latin files. Never import `@fontsource-variable/*/index.css`, `full.css` or `standard.css`. Fraunces `opsz` without italic is deliberate: no italic Fraunces anywhere (a faux italic would come back). |
| **Wrong numerals** | Fraunces has no `tnum` and Atkinson Next slashes its zero, so any digit outside `.num` regresses. Add a unit or e2e check that `getComputedStyle(#hud-taps).fontFamily` starts with "Runnel Numerals". |
| **iPhone** | Bottom sheet padding uses `env(safe-area-inset-bottom)`; `100dvh`; `backdrop-filter` only on `::backdrop` (static, over SVG, not WebGL), which is cheap. Never animate `filter` or `drop-shadow` on the board: it has hundreds of SVG nodes. Burst drops are about 10 DOM nodes and are removed after 900 ms. `@starting-style` needs Safari 17.5+ and `linear()` needs 17.2+; both have fallbacks declared. |
| **Legibility** | Sky stops stay within a narrow lightness band, so `--ink-2` passes AA everywhere. The voice card is always on `--linen`, never on the sky. Minimum readable size is 14px; 12px only for uppercase labels, per STYLE.md §4. |
| **STYLE.md drift** | STYLE.md §4 says "two families only". Log a `DECISIONS.md` line that Runnel's identity pass adds Outfit for numerals (and Atkinson Next instead of classic Atkinson) under the owner's AAA direction. |
## landing
## Landing page (`/`, `site/`): AAA UI design system

**Art director's brief, studio front door.** This spec covers the hero, the game cards (CATHODE in its own 18+ row) and the footer. It is written to be built from alone, and every recipe here works under the live CSP (`style-src 'self'`, `font-src 'self' data:`, `img-src 'self' data:`).

**What the e2e suite pins down** (`e2e-site/site.spec.ts`). The rebuild must keep all of the following:
- `<h1>` with the accessible name **"Cathnivore"**.
- Four visible plain `<a href="/cathnivore/" | "/runnel/" | "/hedgerow/" | "/cathode/">` links. The tests click them.
- The page works with reduced motion.
- No sideways scroll.
- No serious or critical axe issues.

---

### 1. Identity

The landing page is **the house of Cath at golden hour**: a cinema-lobby front door where the live 3D dusk over Marrow is the backdrop. Cath stands full-height as the host, and each game hangs in the lobby as a framed poster in its own typeface and material.

It borrows from four places:
- **Supergiant's** key-art-first game pages and Hades' **gold as a material** (gradient, highlight line and drop shadow, never a flat yellow) for the house wordmark and the primary button.
- **Riot's** hub layouts for the **poster card**: big art, a logotype that breaks the frame, a short line, and one strong CTA.
- **Apple Arcade's** editorial restraint for the type hierarchy: one display face, one quiet UI face, one italic voice, and plenty of negative space.

CATHODE gets an **Annapurna-style "after dark" row**. The page's palette flips to wet neon and chrome there, so the tonal shift reads as deliberate curation, not as a footer afterthought.

---

### 2. Typography

#### 2.1 Faces and payload (latin subset, woff2)

| Role | Package (licence) | File actually fetched | Axes / weights used | Size |
|---|---|---|---|---|
| **Display** (section heads, house wordmark fallback) | `@fontsource-variable/fraunces` (OFL) via `opsz.css` | `fraunces-latin-opsz-normal.woff2` | `opsz` 9–144 (auto), `wght` 500–720 | 67.3 KB |
| **UI / body** | `@fontsource-variable/instrument-sans` (OFL) via `index.css` (wght) | `instrument-sans-latin-wght-normal.woff2` | `wght` 400–700 | 30.1 KB |
| **Cath's voice** (daily line, pull-quotes) | `@fontsource/instrument-serif` (OFL), `latin-400-italic.css` | `instrument-serif-latin-400-italic.woff2` | real italic, 400 | 22.1 KB |
| **Logotypes** (house mark plus one per game) | glyph subsets cut at build time (§2.4), committed to `site/public/marks/` | 5 files | see §2.4 | about 4–12 KB each, about 35 KB total |
| | | | **Total** | **about 155 KB** (under the 180 KB budget) |

All sizes were measured from the npm-published v5.3.0 files on 2026-10-11.

Font loading rules:
- Import with CSS `@import` from `site/src/fonts.css`. Vite resolves package CSS, and the `unicode-range` blocks mean browsers fetch only the latin file.
- `font-display: swap` for the text faces, `block` for the logotype subsets (they are tiny).
- The site stops loading `/fonts/fraunces-*` and `/fonts/atkinson-*`. **Do not delete `/fonts/`**: the other games still load from it until their own specs land.
- Preload the two hero-critical files (the house mark subset and Instrument Sans) by adding `<link rel="preload" as="font" type="font/woff2" crossorigin>` from `scripts/build-site.ts` after the Vite build. Read the hashed names from the manifest; the house mark has a fixed name in `/marks/`.
- **Why Instrument Sans replaces Atkinson Hyperlegible here:** Atkinson's slashed zero makes "100 story levels" read "1Ø0". Instrument Sans has a plain zero and lining tabular figures, and it pairs natively with Instrument Serif. Contrast and the body size (≥16 px) keep legibility.

Fallback metrics to stop layout shift (tune `size-adjust` by eye in shots):
```css
@font-face { font-family: "Instrument Sans Fallback"; src: local("Arial"), local("Helvetica Neue");
  size-adjust: 96%; ascent-override: 98%; descent-override: 25%; line-gap-override: 0%; }
@font-face { font-family: "Fraunces Fallback"; src: local("Georgia"), local("Times New Roman");
  size-adjust: 104%; ascent-override: 95%; descent-override: 24%; }
:root {
  --font-display: "Fraunces Variable", "Fraunces Fallback", Georgia, serif;
  --font-ui: "Instrument Sans Variable", "Instrument Sans Fallback", system-ui, sans-serif;
  --font-voice: "Instrument Serif", "Fraunces Fallback", Georgia, serif;
  --font-mark-house: "Mark House", var(--font-display);
}
```

#### 2.2 Type scale

The base is `html { font-size: 100% }` (16 px). Use rem and clamp; no px font sizes in the new CSS. Phone means 390 wide and desktop means 1440 wide.

| Token | Face / settings | Phone | Desktop | Line height | Tracking | Use |
|---|---|---|---|---|---|---|
| `--fs-mark` | house mark, `wght` 660 to 700, `SOFT` 30, `WONK` 1, `opsz` 144 | 3.5rem (56) | 9rem (144) | .86 | −.035em | h1 wordmark: `clamp(3.5rem, 1.6rem + 7.8vw, 9rem)` |
| `--fs-d1` | Fraunces, `wght` 620, opsz auto | 2rem (32) | 3.25rem (52) | 1.0 | −.02em | section heads ("The games", "After dark") |
| `--fs-logo` | per-game mark | 2.125rem (34) | 2.75rem (44) | .95 | per mark | card logotypes |
| `--fs-voice` | Instrument Serif italic | 1.375rem (22) | 2rem (32) | 1.18 | −.005em | Cath's daily line |
| `--fs-body-lg` | Instrument Sans 420 | 1.0625rem (17) | 1.125rem (18) | 1.55 | 0 | card copy, lede |
| `--fs-body` | Instrument Sans 420 | 1rem (16) | 1rem | 1.5 | 0 | footer copy |
| `--fs-meta` | Instrument Sans 560, tnum | .875rem (14) | .9375rem (15) | 1.35 | .01em | card meta, progress |
| `--fs-label` | Instrument Sans 650, caps | .75rem (12) | .8125rem (13) | 1.2 | .16em | eyebrows, badges |
| `--fs-btn` | Instrument Sans 640 | 1rem | 1.0625rem | 1 | .01em | buttons (sentence case) |

Sizing and wrapping rules:
- **Floor:** 12 px for caps labels, 16 px for anything read as a sentence.
- Headings get `text-wrap: balance`, paragraphs `text-wrap: pretty`.
- The lede is at most 34ch wide, card copy at most 40ch.

#### 2.3 Numerals and casing

Numerals:
```css
.num, .card-meta, .progress, .foot-ver { font-variant-numeric: lining-nums tabular-nums; font-feature-settings: "lnum" 1, "tnum" 1; }
.eyebrow, .badge, .rating { font-feature-settings: "case" 1; }
```
Make the "1–2 players" en dash and the "·" separators real characters with thin spaces (` · `).

Casing:
- **Sentence case** for buttons, card copy and section heads ("Play today's Runnel", "The games").
- **Tracked caps** only for eyebrows, badges and the rating plate. The audit called out the same tracked caps appearing everywhere, so there are at most three caps labels in the hero viewport.
- Game names are always their logotype, never caps-styled UI text. "CATHODE" is the only all-caps name, because it is spelled that way.

#### 2.4 Logotypes (per-game identity without per-game font payloads)

`scripts/site-wordmarks.ts` uses the **`subset-font`** devDependency (BSD-3, harfbuzz). It writes the woff2 subsets below to `site/public/marks/` and commits them. It is run by hand only, and the source files are devDependencies.

| File | Source font | Glyphs | Axes |
|---|---|---|---|
| `house.woff2` | `@fontsource-variable/fraunces` `full` normal | `Cathnivore` | keep `wght` 500–760 (for the hover swell), pin `opsz` 144, `SOFT` 30, `WONK` 1 |
| `cathnivore.woff2` | `@fontsource-variable/playfair` | `Cathnivore` | pin `opsz` 120, `wdth` 95, `wght` 720 |
| `runnel.woff2` | `@fontsource-variable/newsreader` | `Runnel` | pin `opsz` 72, `wght` 640 |
| `hedgerow.woff2` | Fraunces `full` | `Hedgerow` | pin `SOFT` 100, `WONK` 0, `opsz` 72, `wght` 820 |
| `cathode.woff2` | `@fontsource-variable/bodoni-moda` | `CATHODE18+` | pin `opsz` 96, `wght` 560 |

Declare each as its own family (`"Mark Cathnivore"`, …) with `font-display: block` and the display face as fallback. If another art director's spec gives a game a different display face, change one row in the script's config map and re-run it; the card CSS does not change.

#### 2.5 How Cath's shared art keeps its look

- `shared/cath/` is untouched. It contains no text, so font changes can't reach it.
- She keeps her colours everywhere except the CATHODE row. There she appears as a **silhouette with a neon rim**, made purely by CSS on the wrapper: `filter: brightness(0) drop-shadow(1px 0 0 var(--neon-c)) drop-shadow(-1px 0 0 var(--neon-m)) drop-shadow(0 0 10px rgb(255 61 139/.45))`.
- Expressions still swap on card hover and focus (existing `data-cath`). Her idle animation (`cath.css`) is kept, and reduced motion still stops it.
- Never crop her face or put text over it. On desktop she is never overlapped by cards (§6.1).

---

### 3. Tokens (`site/src/tokens.css`, imported first)

```css
:root {
  color-scheme: dark;
  /* Ink: warm night (the sky above the dusk scene) */
  --ink-950:#120b10; --ink-900:#1a1119; --ink-850:#20151d; --ink-800:#271a23; --ink-700:#36242f; --ink-600:#4a3340;
  /* Cream: text */
  --cream-50:#fff8ec; --cream-100:#fbf1df;   /* primary text 15.6:1 on ink-900 */
  --cream-300:#e6d6bd;                       /* secondary 11.9:1 */
  --cream-500:#b9a68f;                       /* tertiary/meta ≥7.4:1 on ink-900, ≥6.6:1 on ink-800 */
  /* Gold: house material */
  --gold-200:#fff1c4; --gold-300:#ffe3a3; --gold-400:#f4c774; --gold-600:#c8913a; --gold-800:#7a4f16; --gold-ink:#2a1608;
  --ember:#e88a50;                           /* sunset accent, decoration only (5.9:1 on ink-900) */
  /* Per-game accents (set on the card as --g-*) */
  --cn-accent:#e7b955; --cn-leaf:#8fb35a;    /* Cathnivore: gold leaf + hex green */
  --rn-accent:#62cbd4; --rn-deep:#1f5d66;    /* Runnel: spring water */
  --hg-accent:#a9cc72; --hg-brick:#c25a3f;   /* Hedgerow: meadow + brick */
  --cd-neon-m:#ff3d8b; --cd-neon-c:#3de0ff; --cd-blood:#b5102a; --cd-chrome:#cfd6dd; --cd-ink:#07080c;
  /* Focus: double ring, readable on art and on night */
  --focus:#ffd98a; --focus-gap:var(--ink-950);

  /* Materials */
  --mat-gold: linear-gradient(180deg,var(--gold-200) 0%,var(--gold-400) 38%,var(--gold-600) 56%,#e3b45a 74%,var(--gold-300) 100%);
  --mat-gold-btn: linear-gradient(180deg,#ffe7a8 0%,#f4c774 48%,#dca24b 100%);
  --mat-chrome: linear-gradient(180deg,#fff 0%,#b9c2cc 42%,#5d6670 54%,#cfd6dd 78%,#fff 100%);
  --mat-plate: linear-gradient(180deg,rgb(39 26 35/.92),rgb(26 17 25/.96));          /* opaque card body; no blur */
  --mat-glass: linear-gradient(160deg,rgb(255 248 236/.10),rgb(255 248 236/.03));
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --scanlines: repeating-linear-gradient(180deg, rgb(255 255 255/.035) 0 1px, transparent 1px 3px);

  /* Radii */
  --r-xs:6px; --r-sm:10px; --r-md:16px; --r-lg:22px; --r-pill:999px; --cut:16px;
  /* Elevation (warm-tinted, never pure black) */
  --elev-1: 0 1px 2px rgb(8 3 6/.4), 0 4px 10px -4px rgb(8 3 6/.45);
  --elev-2: 0 2px 4px rgb(8 3 6/.35), 0 18px 36px -14px rgb(8 3 6/.7);
  --elev-3: 0 4px 8px rgb(8 3 6/.35), 0 34px 60px -20px rgb(8 3 6/.8);
  --hl-top: inset 0 1px 0 rgb(255 248 236/.12);
  /* Glows */
  --glow-gold: 0 0 0 1px rgb(244 199 116/.35), 0 0 28px -4px rgb(244 199 116/.45);
  --glow-neon: 0 0 0 1px rgb(255 61 139/.55), 0 0 24px -2px rgb(255 61 139/.5), 0 0 60px -10px rgb(61 224 255/.35);
  /* Spacing (4 px base) */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px; --sp-7:48px; --sp-8:64px; --sp-9:96px; --sp-10:128px;
  --gutter: max(16px, env(safe-area-inset-left));
  --content: min(1240px, 100% - 2*var(--gutter));
  /* Z layers */
  --z-scene:0; --z-shade:1; --z-page:2; --z-cath:3; --z-raised:4; --z-topbar:20; --z-toast:40;
  /* Motion */
  --ease-out: cubic-bezier(.16,1,.3,1); --ease-in: cubic-bezier(.7,0,.84,0); --ease-inout: cubic-bezier(.65,0,.35,1);
  --ease-back: cubic-bezier(.34,1.56,.64,1);
  --spring: linear(0,.009,.035 2.1%,.141,.281 6.7%,.723 12.9%,.938 16.7%,1.017,1.077,1.121 24%,1.149 26.8%,1.159,1.154 31.7%,1.106 37.6%,1.031 46.5%,1.003 51.3%,.986 56.8%,.991 69.4%,1 100%);
  --dur-press:40ms; --dur-1:140ms; --dur-2:240ms; --dur-3:440ms; --dur-hero:900ms; --stagger:55ms;
}
@property --rim-a { syntax:"<number>"; inherits:true; initial-value:.35; }
@property --sheen { syntax:"<percentage>"; inherits:false; initial-value:-40%; }
```

Contrast rules:
- Text never sits directly on key art or on the live scene. It sits on `--mat-plate`, or on a scrim of at least 0.7 alpha behind the text box.
- Ember and per-game accents are for edges, glows and icons, not for text under 18 px. The only exception is `--gold-400` on `--ink-900` (11.6:1).
- The 18+ plate is `--cream-50` on `--cd-blood` (6.6:1).

Grain rule: grain sits on cards, the footer and the CATHODE banner only, at 0.05–0.08 opacity with `mix-blend-mode: overlay`. **It is never a fixed full-screen layer over the WebGL canvas**: that forces a blend with every scene frame on iPhone.

---

### 4. Components (`site/src/components.css`)

#### 4.1 Buttons
```css
.btn { --h:52px; display:inline-flex; align-items:center; gap:var(--sp-2); min-height:var(--h); padding:0 var(--sp-5);
  border-radius:var(--r-pill); font:640 var(--fs-btn)/1 var(--font-ui); letter-spacing:.01em; text-decoration:none;
  transition: transform var(--dur-2) var(--spring), box-shadow var(--dur-2) var(--ease-out), filter var(--dur-2); }
.btn-primary { color:var(--gold-ink); background: linear-gradient(rgb(255 255 255/.5),rgb(255 255 255/0)) top/100% 48% no-repeat, var(--mat-gold-btn);
  box-shadow: inset 0 1px 0 rgb(255 255 255/.7), inset 0 -3px 0 rgb(122 79 22/.45), 0 0 0 1px rgb(42 22 8/.6), 0 4px 0 var(--gold-800), var(--elev-2); }
.btn-secondary { color:var(--cream-100); background: var(--mat-glass); box-shadow: inset 0 0 0 1px rgb(255 248 236/.28), var(--hl-top); }
.btn-icon { --h:44px; inline-size:44px; padding:0; justify-content:center; border-radius:50%; color:var(--cream-100);
  background: var(--mat-glass); box-shadow: inset 0 0 0 1px rgb(255 248 236/.22); }
@media (hover:hover) { .btn:hover { transform: translateY(-2px); filter: brightness(1.06) saturate(1.06); }
  .btn-primary:hover { box-shadow: inset 0 1px 0 #fff, inset 0 -3px 0 rgb(122 79 22/.45), 0 0 0 1px rgb(42 22 8/.6), 0 6px 0 var(--gold-800), var(--glow-gold); } }
.btn:active { transform: translateY(3px) scale(.985); transition-duration: var(--dur-press);
  box-shadow: inset 0 1px 0 rgb(255 255 255/.5), inset 0 -1px 0 rgb(122 79 22/.4), 0 0 0 1px rgb(42 22 8/.6), 0 1px 0 var(--gold-800); }
.btn[aria-disabled="true"] { filter: grayscale(.8) brightness(.7); pointer-events:none; }
:where(a,button):focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; box-shadow: 0 0 0 3px var(--focus-gap); }
```

#### 4.2 Poster card (`.gcard`, the core component; the whole card is the `<a>`)

Anatomy, top to bottom:
1. The art window (a key-art `<img>`, 4:3 on desktop and 16:9 on phone) with the SVG emblem as fallback.
2. The logotype, overlapping the art's bottom edge by 0.45em ("breaks the frame").
3. The copy.
4. The meta line (tabular).
5. The progress chip (optional).
6. The CTA row: a fake button span "Play", plus the `.btn-icon` arrow.
7. A Cath face chip (40 px) pinned top-right of the art, with her ring in the card's accent.

```css
.gcard { --g: var(--cn-accent); position:relative; isolation:isolate; display:grid; grid-template-rows:auto 1fr;
  border-radius:var(--r-lg); color:var(--cream-100); text-decoration:none; container: gcard / inline-size;
  border:1px solid transparent;
  background: var(--mat-plate) padding-box,
    linear-gradient(180deg, color-mix(in oklab, var(--g) calc(var(--rim-a)*100%), white 0%), rgb(255 248 236/.06) 45%, rgb(255 248 236/.02)) border-box;
  box-shadow: var(--hl-top), var(--elev-2);
  transform: perspective(900px) rotateX(calc(var(--my,0)*-4deg)) rotateY(calc(var(--mx,0)*5deg)) translateY(var(--lift,0));
  transition: transform var(--dur-3) var(--ease-out), box-shadow var(--dur-3) var(--ease-out), --rim-a var(--dur-3); }
.gcard::after { /* grain + pointer spotlight */ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:2;
  background: radial-gradient(420px circle at calc(50% + var(--mx,0)*50%) calc(30% + var(--my,0)*50%), rgb(255 248 236/.10), transparent 60%), var(--grain);
  mix-blend-mode: overlay; opacity:.7; }
.gcard-art { position:relative; aspect-ratio:4/3; overflow:hidden; border-radius: calc(var(--r-lg) - 1px) calc(var(--r-lg) - 1px) 0 0; }
.gcard-art img { inline-size:100%; block-size:100%; object-fit:cover; transform: scale(1.02) translate(calc(var(--mx,0)*-6px), calc(var(--my,0)*-4px));
  transition: transform var(--dur-hero) var(--ease-out); }
.gcard-art::after { content:""; position:absolute; inset:0; background: linear-gradient(180deg, transparent 45%, rgb(26 17 25/.75) 82%, var(--ink-850) 100%); }
.gcard-logo { font: 400 var(--fs-logo)/.95 var(--mark, var(--font-display)); margin: -0.55em var(--sp-5) 0; position:relative; z-index:3;
  color:var(--cream-50); text-shadow: 0 2px 0 rgb(8 3 6/.55), 0 10px 24px rgb(8 3 6/.6); }
.gcard-body { padding: var(--sp-3) var(--sp-5) var(--sp-5); display:grid; gap:var(--sp-3); align-content:start; }
.gcard-copy { font: 420 var(--fs-body-lg)/1.55 var(--font-ui); color:var(--cream-300); max-inline-size:40ch; }
.gcard-meta { font: 560 var(--fs-meta)/1.35 var(--font-ui); color:var(--cream-500); }
.gcard-cta { margin-top:auto; display:flex; align-items:center; justify-content:space-between; }
@media (hover:hover) { .gcard:hover { --lift:-6px; --rim-a:.9; box-shadow: var(--hl-top), var(--elev-3), 0 0 40px -12px var(--g); }
  .gcard:hover .gcard-art img { transform: scale(1.06) translate(calc(var(--mx,0)*-10px), calc(var(--my,0)*-6px)); } }
.gcard:active { --lift:2px; transition-duration: var(--dur-1); }
.gcard:focus-visible { --rim-a:1; }
.gcard[data-game="runnel"] { --g:var(--rn-accent); --mark:"Mark Runnel"; }
.gcard[data-game="hedgerow"] { --g:var(--hg-accent); --mark:"Mark Hedgerow"; }
.gcard[data-game="cathnivore"] { --g:var(--cn-accent); --mark:"Mark Cathnivore"; }
@container gcard (width < 300px) { .gcard-logo { font-size:1.875rem; } .gcard-body { padding-inline: var(--sp-4); } }
```

Two implementation notes:
- `--mark` holds a family name, so set `font-family` per modifier instead of through `font:` shorthand. Example: `.gcard[data-game=runnel] .gcard-logo { font-family:"Mark Runnel", var(--font-display) }`.
- JS sets `--mx`/`--my` (−0.5 to 0.5) on `pointermove` with `setProperty`, only when `matchMedia('(hover:hover) and (prefers-reduced-motion: no-preference)')` matches, and resets them on `pointerleave`.

Logotype materials per game:
- **Hedgerow:** cream fill with `-webkit-text-stroke:.06em #3a2410; paint-order:stroke fill;` and a 0.08em brown drop, giving a storybook poster.
- **Cathnivore:** the gold `--mat-gold` text fill via `background-clip:text` and `filter: drop-shadow(0 2px 0 #4a2a06)`.
- **Runnel:** cream, with a 2 px `--rn-accent` underline swash made from `::after`, a hand-drawn SVG data URI.
- **CATHODE:** see §4.8.

#### 4.3 Badges and chips
```css
.badge { display:inline-flex; align-items:center; gap:.4em; padding:.32em .7em .28em; border-radius:var(--r-pill);
  font:650 var(--fs-label)/1 var(--font-ui); letter-spacing:.14em; text-transform:uppercase; font-feature-settings:"case" 1; }
.badge-new { color:var(--gold-ink); background:var(--mat-gold-btn); box-shadow: inset 0 1px 0 rgb(255 255 255/.6), 0 0 0 1px rgb(42 22 8/.5); }
.badge-daily { color:#062a2e; background: linear-gradient(180deg,#9be6ec,var(--rn-accent)); }
.badge-dev { color:var(--cream-300); box-shadow: inset 0 0 0 1px rgb(255 248 236/.3); }
.progress { display:inline-flex; gap:var(--sp-2); align-items:center; padding:var(--sp-1) var(--sp-3); border-radius:var(--r-pill);
  font:600 var(--fs-meta)/1 var(--font-ui); font-variant-numeric: tabular-nums lining-nums; color:var(--cream-100);
  background: color-mix(in oklab, var(--g) 18%, transparent); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--g) 45%, transparent); }
```

#### 4.4 Progress bar (on the Hedgerow card: "Level 14 of 100")
```css
.bar { block-size:6px; border-radius:var(--r-pill); background: rgb(255 248 236/.10); overflow:hidden; box-shadow: inset 0 1px 1px rgb(0 0 0/.4); }
.bar > i { display:block; block-size:100%; inline-size: calc(var(--p) * 100%); border-radius:inherit;
  background: linear-gradient(90deg, color-mix(in oklab,var(--g) 70%, black), var(--g)); box-shadow: 0 0 10px -2px var(--g);
  transform-origin:left; animation: bar-in var(--dur-hero) var(--ease-out) both 300ms; }
@keyframes bar-in { from { transform: scaleX(0); } }
```
JS sets `--p` with `setProperty`.

#### 4.5 Eyebrow, divider and section head
```css
.eyebrow { font:650 var(--fs-label)/1.2 var(--font-ui); letter-spacing:.16em; text-transform:uppercase; color:var(--gold-400); display:flex; align-items:center; gap:var(--sp-3); }
.eyebrow::before { content:""; inline-size:28px; block-size:1px; background: linear-gradient(90deg, transparent, var(--gold-400)); }
.section-head { font: 620 var(--fs-d1)/1 var(--font-display); font-optical-sizing:auto; letter-spacing:-.02em; color:var(--cream-50); text-wrap:balance; }
```

#### 4.6 Tooltip (icon-only controls only, e.g. the top-bar game shortcuts; rating info is visible text, never a tooltip)
```css
[data-tip] { position:relative; }
[data-tip]::after { content:attr(data-tip); position:absolute; inset-block-start: calc(100% + 8px); inset-inline-start:50%; translate:-50% 4px; opacity:0;
  white-space:nowrap; padding:var(--sp-2) var(--sp-3); border-radius:var(--r-sm); font:560 .8125rem/1 var(--font-ui); color:var(--cream-50);
  background: var(--ink-800); box-shadow: inset 0 0 0 1px rgb(255 248 236/.14), var(--elev-1); pointer-events:none;
  transition: opacity var(--dur-1), translate var(--dur-2) var(--ease-out); z-index:var(--z-toast); }
[data-tip]:is(:hover,:focus-visible)::after { opacity:1; translate:-50% 0; }
```
The control also carries `aria-label` with the same text.

#### 4.7 Banner and toast (one announcement ribbon, optional, e.g. "New: Hedgerow Act 3")
```css
.ribbon { display:flex; gap:var(--sp-3); align-items:center; padding:var(--sp-2) var(--sp-4); border-radius:var(--r-pill);
  background: var(--mat-glass); box-shadow: inset 0 0 0 1px rgb(244 199 116/.35), var(--hl-top); font:560 var(--fs-meta)/1.2 var(--font-ui);
  animation: wipe var(--dur-3) var(--ease-out) both 1.6s; }
@keyframes wipe { from { clip-path: inset(0 100% 0 0 round 999px); } to { clip-path: inset(0 0 0 0 round 999px); } }
```
There are no modals or sheets on the landing page. That is deliberate: every action is navigation.

#### 4.8 Signature elements

**A. The house wordmark.** It is the `h1` and keeps `aria-label="Cathnivore"`. It stays split into per-letter spans by `main.ts` as today.
```css
.title { font: 400 var(--fs-mark)/.86 var(--font-mark-house); letter-spacing:-.035em; margin:0; font-variation-settings:"wght" 680;
  transition: font-variation-settings var(--dur-3) var(--ease-out); }
.title .letter { display:inline-block; color:transparent; -webkit-background-clip:text; background-clip:text;
  background: linear-gradient(105deg, transparent calc(var(--sheen) - 12%), rgb(255 255 255/.85) var(--sheen), transparent calc(var(--sheen) + 12%)), var(--mat-gold);
  filter: drop-shadow(0 2px 0 #4a2a06) drop-shadow(0 12px 22px rgb(8 3 6/.55));
  animation: letter-rise var(--dur-hero) var(--ease-out) both calc(450ms + var(--i)*var(--stagger)),
             sheen 1.4s var(--ease-inout) both calc(1300ms + var(--i)*60ms); }
@keyframes letter-rise { from { opacity:0; transform: translateY(.35em) rotate(4deg); filter: blur(6px); } }
@keyframes sheen { from { --sheen:-40%; } to { --sheen:140%; } }
@media (hover:hover) { .hero-text:hover .title { font-variation-settings:"wght" 740; } }
```
The gradient is vertical, so applying it per letter is seamless. The sheen is per letter and staggered, so it reads as one sweep. If `@property` is unsupported, the sheen is simply absent.

**B. Cath's daily line** (replaces the current tagline-style lede):
```html
<figure class="voice reveal"><blockquote class="voice-line">…</blockquote><figcaption class="voice-by"><span class="voice-face" aria-hidden="true"></span>Cath</figcaption></figure>
```
```css
.voice-line { font: 400 var(--fs-voice)/1.18 var(--font-voice); font-style: italic; color:var(--cream-50); margin:0; max-inline-size:30ch; hanging-punctuation:first;
  text-shadow: 0 1px 0 rgb(8 3 6/.6), 0 0 18px rgb(8 3 6/.5); }
.voice-line::before { content:"\201C"; } .voice-line::after { content:"\201D"; }
.voice-by { display:flex; align-items:center; gap:var(--sp-2); margin-top:var(--sp-3); font:600 var(--fs-meta)/1 var(--font-ui); color:var(--cream-300); }
.voice-face { inline-size:28px; block-size:28px; border-radius:50%; overflow:hidden; box-shadow: 0 0 0 1.5px var(--gold-400); }
```
The figcaption carries her face chip, filled with `cathSvg({framing:'face'})` as `.art-cath` does today.

**C. The Today CTA** (primary hero button):
- It reads Runnel's own `localStorage` (`runnel:v1`, same origin).
- Unplayed: "Play today's Runnel".
- In progress: "Finish today's Runnel".
- Solved: "Solved today · Streak 6", with a `.badge-daily` and the button switched to `.btn-secondary`. The primary role then moves to "Play the games" (an anchor to `#games`).

**D. The CATHODE after-dark banner** (`.gcard.cd`, full width):
```css
.cd { --g:var(--cd-neon-m); border-radius:0; background: var(--cd-ink); box-shadow:none;
  clip-path: polygon(var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%,0 var(--cut)); }
.cd-wrap { filter: drop-shadow(0 0 1px var(--cd-neon-m)) drop-shadow(0 18px 40px rgb(0 0 0/.7)); } /* glow survives clip-path */
.cd .gcard-art { aspect-ratio: 21/9; border-radius:0; }
.cd .gcard-art::before { content:""; position:absolute; inset:0; z-index:1; background: var(--scanlines), radial-gradient(120% 90% at 70% 40%, transparent 40%, rgb(0 0 0/.65)); }
.cd .gcard-logo { font-family:"Mark Cathode", var(--font-display); letter-spacing:.18em; color:#fdf6ff;
  text-shadow: 0 0 .04em #fff, 0 0 .22em var(--cd-neon-m), 0 0 .7em rgb(255 61 139/.55); }
.rating { display:inline-grid; grid-template-columns:auto 1fr; gap:var(--sp-3); align-items:center; padding:var(--sp-2) var(--sp-3);
  background: var(--mat-chrome) border-box; border:1px solid transparent; }
.rating b { font:650 1rem/1 "Mark Cathode", var(--font-ui); color:var(--cream-50); background:var(--cd-blood); padding:.4em .5em; }
.rating span { font:560 .8125rem/1.3 var(--font-ui); color:var(--cream-300); }   /* "Strong violence · Gore · Language" */
@media (hover:hover) and (prefers-reduced-motion:no-preference) { .cd:hover .gcard-logo { animation: flicker 2.4s steps(1) 1; } }
@keyframes flicker { 0%,100%{opacity:1} 8%{opacity:.55} 10%{opacity:1} 12%{opacity:.35} 14%{opacity:1} }
```
Cath stands in the right third of the banner art as the neon-rim silhouette (§2.5), at `z-index: var(--z-cath)`, overlapping the frame's top edge by 24 px.

---

### 5. Motion

**Curves:**
- Enter with `--ease-out`.
- Exit with `--ease-in`, about 30% faster.
- Rewards and presses release with `--spring`.
- Small pops use `--ease-back`.

**Hero timeline** (desktop and phone are the same):

| t | Beat |
|---|---|
| 0 | Dark sky. `.ready` is added on the second rAF (existing). |
| 200 ms | The scene fades up (scene.ts, as now). |
| 350 ms | The eyebrow wipes in, left to right (`clip-path`, 440 ms). |
| 450 ms | Wordmark letters rise, 55 ms stagger (about 950 ms total). |
| 900 ms | Cath rises 24 px and fades in over 1,200 ms with `--ease-out` (existing hook). |
| 1,100 ms | Cath's line fades and lifts 10 px, then the figcaption. |
| 1,250 ms | CTAs rise in at 80 ms apart, the primary with `--spring`. |
| 1,300 ms | The gold sheen sweeps the wordmark once (never loops). |

**Cards:**
- Scroll-driven reveal behind `@supports (animation-timeline: view())`: `animation: rise linear both; animation-timeline: view(); animation-range: entry 5% cover 25%`.
- Fallback: an IntersectionObserver adds `.in`, with stagger `calc(var(--i)*70ms)`. `--i` is set with `setProperty`.
- The CATHODE banner reveals with a **horizontal wipe plus a 120 ms neon power-on** (opacity steps 0, .6, .2, 1).

**Interaction:**
- Hover lift and tilt over 440 ms `--ease-out`.
- Press: 40 ms down, released on the spring.
- The `--rim-a` rim brightens via `@property`.
- Cath's expression swaps instantly (her own blink and idle carry it).

**Reward moment, at most once per day per device:**
1. If Runnel reports solved today and `sessionStorage['site:dew']` is unset, the Today button plays a dew burst.
2. The burst is 10 `<i>` drops coloured `--rn-accent`, each with `--ang`/`--dist` set by `setProperty`, plus one ring: 100 ms squash to 0.94, burst over 700 ms, then the streak number counts up from n−1 to n over 500 ms.
3. Then set the flag.

**Ambient:**
- The scene, as now.
- Cath's idle, as now.
- No looping UI animation anywhere else.

**Reduced motion is a design, not just an off switch:**
```css
@media (prefers-reduced-motion: reduce) {
  .title .letter { animation: fade 240ms ease both; filter: drop-shadow(0 2px 0 #4a2a06); }
  .gcard, .gcard-art img { transform:none !important; transition: box-shadow var(--dur-2), --rim-a var(--dur-2); }
  .reveal, .gcard { animation: fade 240ms ease both !important; animation-timeline: auto !important; }
  .ribbon, .cd .gcard-logo, .burst { animation: none !important; }
}
@keyframes fade { from { opacity:0; } }
```
Hover feedback stays as rim light and shadow, so hover still reads. `scene.ts` already receives `reducedMotion`. The pointer-tilt JS is not attached.

---

### 6. Screen by screen (ranked by impact)

Audit shots: `…/scratchpad/aaa/audit/site-landing-desktop.png`, `-full-desktop.png`, `-phone.png`, `-full-phone.png`.

#### 6.1 Hero (impact 1)

Problems: the wordmark says "Cathnivore" but the copy is a Runnel tagline, cards sit on Cath's hips, and everything is centred.

**Desktop 1440x900.** The hero is exactly `100svh`, on a 12-column grid.
- **Cath** spans cols 1–5. Her height is `min(82svh, 760px)`, and she stands on the hero's bottom edge, bleeding 6 svh past it into a `--ink-900` fade. **No card overlaps her.**
- **Text** spans cols 6–12, left-aligned, its block centred at 44% height, with this order:
  - eyebrow: "Four free games starring Cath"
  - wordmark
  - Cath's daily line (voice figure)
  - CTA row: `.btn-primary` Today CTA plus `.btn-secondary` "All games ↓" (`href="#games"`)
  - one quiet meta line in `--cream-500`: "Free · No ads · No accounts".
- **Scroll cue:** a 1 px gold line, 40 px, with a 6 px dot that drifts down. Reduced motion makes it static.
- Add a radial scrim behind the text column only (`radial-gradient(60% 50% at 70% 45%, rgb(18 11 16/.55), transparent 70%)`) in place of the current global shade top band.

**Phone 390x844.** Stack in this order:
1. Eyebrow at `safe-area-top + 24px`.
2. Wordmark at 56 px.
3. Cath's line at 22 px.
4. Cath at `min(46svh, 400px)`, centred.
5. The CTA pair pinned 24 px above the bottom of the hero as a full-width primary and a text-style secondary, on a bottom scrim `linear-gradient(to top, rgb(18 11 16/.85), transparent)`.

The first card starts below the fold, so cards no longer cover her (they currently start at y≈450).

**Landscape 844x390.** Two columns: Cath on the left at 92svh, the text on the right with the wordmark at `clamp(2.75rem, 9vh + 1rem, 4rem)`. Hide the eyebrow, and keep the line to 2 lines (no truncation, at 18 px).

#### 6.2 Game cards (impact 2)

Problems: generic glass tiles, Hedgerow orphaned on a centred row, 14 px grey copy and a tiny amber meta line.

- **Desktop:** an `<h2 class="section-head" id="games">The games</h2>` with the eyebrow "Free in your browser". Below it, a **3-up grid** of poster cards (`grid-template-columns: repeat(3, 1fr)`, gap 24 px, max width 1240) in this order: Cathnivore, Runnel, Hedgerow.
- **Card content:**
  - **Key art** (4:3).
  - **Logotype.**
  - **Copy.** Keep the existing strings; Hedgerow drops "one on one".
  - **Meta**, as today but tabular.
  - **Badges:** Runnel `New`, Hedgerow `New` (until the content owner says otherwise).
  - **Progress chip** when available: Runnel "Streak 6"; Hedgerow "Level 14 of 100" plus `.bar`; Cathnivore "Game in progress" if `cathnivore:save:v1` exists.
  - **CTA row:** "Play" for an unplayed game, "Continue" when progress exists.
- **Remove `backdrop-filter`** from cards (four blurs over a live WebGL canvas on iPhone). The plate is opaque enough.
- **Phone:** one column, art 16:9, card padding 16 px, no tilt, press only.
- **Landscape:** a horizontal scroll-snap rail inside its own `overflow-x:auto` container (cards 300 px wide, `scroll-snap-type:x mandatory`, edge fade masks). The page itself must not scroll sideways: the container clips. Show full copy; nothing is truncated.
- **Key art.** Today the cards show only an SVG emblem.
  - Add `<img>`s from `site/public/key/<game>-{640,1200}.jpg` with `srcset`/`sizes`, `width`/`height` attributes, `loading="lazy"` and `decoding="async"`, plus empty `alt=""` (the card text names the game).
  - Keep the existing SVG emblems as a 56 px chip at the art's top-left (and as the fallback if an image fails: `.gcard-art.noimg` shows the emblem large on the accent gradient).
  - Each card art has Cath's face chip at the top-right, with her expression from `data-cath`.

#### 6.3 CATHODE after-dark row (impact 3)

Problem: currently "For grown-ups" with Fraunces caps.

- Add a section `<h2 class="section-head">After dark</h2>`, with the eyebrow "For adults only" in `--cd-neon-m`.
- Behind the section, the page background crossfades from `--ink-900` to `--cd-ink`. Use a section-level gradient (`background: linear-gradient(var(--ink-900), var(--cd-ink) 120px)`), no JS.
- The banner is the full content width at 21:9 on desktop, 4:5 on phone (with the art on top and the body below) and 16:9 in landscape.
- Banner contents:
  - The street key art with scanlines.
  - Cath's neon-rim silhouette.
  - The CATHODE logotype with neon glow.
  - The rating plate "18+ · Strong violence · Gore · Language" as visible text.
  - Copy and meta.
  - A `.badge-dev` "In development".
  - The CTA "Enter" with a chrome-ringed `.btn-icon`.
- **No gore in the landing art.** The link still goes to `/cathode/`, whose own age gate remains the gate.

#### 6.4 Footer (impact 4)

Problem: one 13 px grey line.

- Use a 3-column grid on desktop and stack on phone:
  - **Column 1:** Cath's 40 px face chip and the house mark at 1.75rem gold, with "Made in the Republic of Marrow" in the voice italic underneath.
  - **Column 2:** a list of the four game links (`--cream-300`, with a gold underline on hover via `text-decoration-color` transition, `text-underline-offset:.25em`).
  - **Column 3:** "Free. No ads. No accounts.", then Privacy and Support, then the build tag in tabular numerals (`v{version}` from `version.json`, fetched with `connect-src 'self'`; hide it on failure).
- Top hairline: a 1 px `linear-gradient(90deg, transparent, rgb(244 199 116/.35), transparent)`. Grain at 0.05.
- Bottom padding: `max(24px, env(safe-area-inset-bottom))`.

#### 6.5 Sticky top bar (impact 5, optional last slice)

- It is hidden over the hero. After the hero leaves the viewport (IntersectionObserver on `.hero`), a 56 px bar fades in with these contents:
  - house mark at 1.375rem
  - four game emblem `.btn-icon`s with `data-tip` names and `aria-label`
  - "Today's Runnel" as a small primary button.
- This is the only element allowed `backdrop-filter: blur(14px)`, with an `@supports not` fallback to `rgb(26 17 25/.92)`. `z-index: var(--z-topbar)`.

---

### 7. Implementation plan

Work in a worktree, never the main tree, while hourly sessions run. Each slice must leave the page shippable. Run these after every slice:
- `npm run check`
- `npm run build:site`
- `npm run e2e:site`
- screenshots of `/` at **390x844, 844x390, 1440x900**, plus 390x844 and 1440x900 with `reducedMotion: 'reduce'`, plus one run with WebGL disabled (the `.no-webgl` fallback). Use `npm run shots` if it covers the site; otherwise use a scratch Playwright script against `npx vite preview --outDir dist-site`. Kill any stale `:4173` server first (CLAUDE.md note).

**S1. Foundation: tokens and fonts** (no layout change)
- `npm i -D @fontsource-variable/fraunces @fontsource-variable/instrument-sans @fontsource/instrument-serif`. They are bundled by Vite, so this is effectively a runtime dependency; follow the repo's convention.
- New files: `site/src/tokens.css`, `site/src/fonts.css` (imports plus fallback faces).
- In `site/src/styles.css`: delete the four `/fonts/` `@font-face` blocks, map the old vars (`--night`, `--cream`, `--gold`) to the new tokens, set `body { font-family: var(--font-ui) }`, and convert every px font size to the scale tokens.
- `main.ts`: import order is tokens, fonts, styles.
- Verify: no faux bold or italic (DevTools "Rendered fonts" shows Instrument Sans Variable, Fraunces Variable and Instrument Serif Italic); the Network panel shows only latin woff2 files; transfer is under 125 KB at this point; no zero renders slashed.

**S2. Logotypes and hero recomposition**
- `npm i -D subset-font @fontsource-variable/playfair @fontsource-variable/newsreader @fontsource-variable/bodoni-moda`.
- Add `scripts/site-wordmarks.ts` and commit `site/public/marks/*.woff2`. Check that `scripts/build-site.ts` carries `site/public/` into `dist-site/` and that the marks sit at `/marks/`.
- Restructure the hero in `site/index.html` and `styles.css`.
- `main.ts`: build the voice figure, the Today CTA and the scroll cue.
- `h1` keeps `aria-label="Cathnivore"`.
- Verify: Cath is not overlapped at any of the three sizes; the wordmark's gold reads at 144 px and 56 px.

**S3. Poster cards and key art**
- Add `scripts/site-keyart.ts` (Playwright against the built site, writing JPEG at q 78, 1200 and 640 wide, into `site/public/key/`). Capture each game's strongest scene:
  - Cathnivore: the game map mid-game.
  - Runnel: the won board.
  - Hedgerow: the `?sandbox=1` 3D field with towers, set up via `window.hedgerow`. Launch with swiftshader flags, falling back to `?2d`.
  - CATHODE: `?play&shot`, a street still with no enemies on screen.
- Review every image by eye before committing it. Budget: each 1200 image ≤ 110 KB and each 640 image ≤ 45 KB.
- Rebuild the `.card` markup as `.gcard`. Keep each card's `<a href>` exactly as it is.
- Add `site/src/tilt.ts` for pointer tilt (hover devices, motion allowed).
- **Lighthouse targets** for the slice:
  - Lighthouse mobile LCP stays an h1 text node, not an image.
  - CLS < 0.02.

**S4. CATHODE after-dark row**
- Section, banner, rating plate, Cath silhouette, scanlines and power-on.
- Verify: the 18+ plate meets AA, the neon logotype is legible at the 390 width, and there is no sideways scroll at 390.

**S5. Progress and the Today rail**
- `site/src/progress.ts`: pure and defensive (try/catch around `localStorage` and `JSON.parse`, shape-checked fields, and `null` on anything unexpected). Read field names from the games' storage modules; do not import game code.
- Add `tests/site-progress.test.ts` covering empty, corrupt, old-schema and solved-today inputs.
- Add the chips, the bar, the CTA states and the once-a-day dew burst.
- Verify: with empty storage the page looks complete (this is the e2e default).

**S6. Footer, top bar, motion polish and reduced-motion pass**
- Footer grid, `version.json` tag, sticky bar, scroll-driven reveals with the IO fallback, and the final reduced-motion and no-webgl shots.

**E2E that must still pass (`e2e-site/site.spec.ts`):**
- the h1 accessible name "Cathnivore"
- all game anchors visible and clickable (in the landscape rail, the click target must be in view, so the rail starts at the first card)
- the reduced-motion test
- no sideways scroll
- the axe scan with no serious or critical issues. Gradient-clip text may come back as axe "incomplete", which is fine, but the per-letter spans stay `aria-hidden` inside the labelled h1.
- `e2e/csp.spec.ts` still passes: no `style=""` anywhere (only `setProperty`), no external font hosts.

**Risks and mitigations:**
- **CSP:**
  - All dynamic values go through `el.style.setProperty` (already the pattern for `--i`).
  - Fonts and key art are same-origin files.
  - The SVG grain and drop swashes are `data:` URIs inside CSS, which `img-src 'self' data:` allows.
  - Do not use `@import url(https://fonts…)`.
- **Performance on iPhone:**
  - No `backdrop-filter` on cards.
  - No full-screen blend layers over the canvas.
  - Tilt only on `(hover:hover)`.
  - Key art is lazy below the hero, and the hero never waits on images.
  - The `drop-shadow` filter on the wordmark is applied once to static text, not animated after the entrance. Set `will-change: auto` after `animationend`.
- **Legibility over the 3D scene:** every text block in the hero has a local scrim or text-shadow pair. Check the 844x390 landscape shot specifically, where the sun can sit behind the text column. `scene.ts` already keeps the sun off-centre right, so move the text column's scrim to cover it.
- **Font fallback flash:** the marks use `block`, so a missing mark shows Fraunces after 3 s, which is still on-brand. Fallback metrics limit the swap shift on body text.
- **`@property` and `linear()` support:** the sheen and rim animation degrade to static. `linear()` falls back to the previous declaration, so declare `--spring` users with a `cubic-bezier` fallback first (`transition-timing-function: var(--ease-back); transition-timing-function: var(--spring);`).
- **Key art going stale:** `scripts/site-keyart.ts` is the single regeneration path. Note it in CLAUDE.md, and re-run it when a game's look changes materially.

Files touched:
- `site/index.html`
- `site/src/{main.ts,styles.css,tokens.css,fonts.css,components.css,tilt.ts,progress.ts}`
- `site/public/{marks/*,key/*}`
- `scripts/{site-wordmarks.ts,site-keyart.ts,build-site.ts}` (preload links)
- `package.json`
- `tests/site-progress.test.ts`
- `shared/cath/*` is unchanged.