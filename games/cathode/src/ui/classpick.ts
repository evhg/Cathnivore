// C14 (docs/design/cathode-combat.md S9.5): the class pick is a wardrobe and a dossier. The live title scene stays
// behind it and the camera comes in close on Cath, her key light turning to the class's colour and the class's idle
// playing (render/frontscene.ts `wardrobe`). Over it, type straight on the scene (C13T: no cards, emblems or
// hatching): the class names down the left edge (a radio group: arrows, Home/End and 1-5 move), Cath's line and how
// the class plays under them; the right column is the stat sheet, whose 1u bars with 6u ticks count up over 350 ms
// when the class changes, the starting weapon and the three trees. Commit is a hold: press and hold the red bar
// (or Enter, or Space) for 600 ms while the heartbeat thumps twice; letting go early cancels.

import { CLASSES, TREES } from "../sim/classes";
import { CLASS_SIGNATURE, newCharacter } from "../sim/character";
import { CLASS_START_ATTRIBUTES } from "../sim/stats";
import { ATTRIBUTES, CLASS_IDS, type AttributeId, type ClassId, type TreeId } from "../sim/types";
import { SKILL_PREVIEWS } from "../game/skillpreview";
import { WEAPON_BASES } from "../sim/weapons";
import { CLASS_COPY } from "./classart";
import { button, el, reducedMotion, trapTab } from "./dom";
import { WEAPON_CLASS_LABEL } from "./itemtext";
import { weaponArtSvg } from "./weaponart";

export interface ClassPickHandle {
  /** Removes the screen without picking. */
  close(): void;
}

export interface ClassPickHooks {
  /** The chosen class changed (the scene relights and plays the idle; the menu ticks). */
  onSelect?(cls: ClassId): void;
  /** One heartbeat thump while the commit is held (twice per hold). */
  onThump?(): void;
  /** Screenshots: no count-up, no fades. */
  still?: boolean;
  /**
   * Plan item 313: the class weapon lit in 3D, as a turntable of frames shot by the street's renderer (it fills as
   * it is shot). null (or no hook) keeps item 199's extruded line-art prop.
   */
  gunReel?(weaponCls: string, cls: ClassId, still: boolean): { readonly total: number; readonly frames: string[] } | null;
  /** Plan item 313: a weapon class's lit thumbnail for the names' rack, from the same meshes. null keeps the stencil. */
  /** Plan item 423: `cls` rims the thumbnail in that class's key colour. */
  gunIcon?(weaponCls: string, cls?: ClassId): string | null;
  /** Plan item 449: the hold is complete (the 520 ms exit starts): she shoulders her weapon and turns to the lens. */
  onCommit?(cls: ClassId): void;
  /** Plan item 464: a test shot of the class weapon (the scene flashes her muzzle, the audio fires the class's gun). */
  onTestFire?(cls: ClassId): void;
  /** Plan item 481: a skill tree's preview to play on the stage (its look and length, game/skillpreview.ts). */
  onSkillPreview?(tree: TreeId): void;
}

export const ATTRIBUTE_LABEL: Record<AttributeId, string> = { grit: "Grit", aim: "Aim", nerve: "Nerve", wire: "Wire" };
/** The stat sheet's full bar (no class starts above 35). */
const ATTR_MAX = 40;
/** Plan item 334: a gun's effective range as one of three steps (shotguns close, sidearms mid, rifles long). */
export function rangeStep(range: number): 1 | 2 | 3 {
  return range <= 50 ? 1 : range <= 150 ? 2 : 3;
}
const RANGE_WORD = ["Close", "Mid", "Long"] as const;
/**
 * Plan item 400: how loud her way of working is, the second meter on a desktop row. Hand-set per class rather than
 * from the gun (the Ghost's rifle is loud, but she kills from where nobody hears; Wirewitch and Fixer share a gun).
 */
export const NOISE_STEP: Record<ClassId, 1 | 2 | 3> = { ghost: 1, wirewitch: 1, gunslinger: 2, butcher: 3, fixer: 3 };
const NOISE_WORD = ["Quiet", "Mixed", "Loud"] as const;
export const HOLD_MS = 600;
/** The armoury prop's depth: copies of the profile stacked front to back (plan item 199). */
const PROP_LAYERS = 6;
/** Plan item 313: each turntable frame's hold (48 frames: one slow sway each way in about 6.7 s). */
const REEL_MS = 140;

/**
 * Opens the class pick over `host` and calls `onPick` once with the chosen class, after the exit
 * transition. Returns a handle to close it early.
 */
export function openClassPick(host: HTMLElement, onPick: (cls: ClassId) => void, initial: ClassId = "ghost", hooks: ClassPickHooks = {}): ClassPickHandle {
  const prevFocus = document.activeElement as HTMLElement | null;
  const still = hooks.still || reducedMotion();
  let selected: ClassId = initial;
  let done = false;

  const root = el("section", "cp", host);
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "cp-title");

  // ---- left: the question, the names, and the chosen one's words ----
  const left = el("div", "cp-left", root);
  const head = el("header", "cp-head", left);
  el("p", "cp-eyebrow", head, "Case file · Hollowell Proper");
  const title = el("h1", "cp-title", head, "Who walks back in?");
  title.id = "cp-title";

  const list = el("div", "cp-list", left);
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "Cath's class");
  const options = new Map<ClassId, HTMLButtonElement>();
  CLASS_IDS.forEach((cls, i) => {
    const opt = button(`cp-opt cls-${cls}`, list);
    opt.setAttribute("role", "radio");
    opt.dataset.cls = cls;
    el("span", "cp-opt-n", opt, String(i + 1)).setAttribute("aria-hidden", "true");
    // Plan item 233: on a desktop each row is a slot in a lit rack: the name over a four-pip stat strip (Grit,
    // Aim, Nerve, Wire), the class's weapon in neon outline at the row's end. Decorative: the sheet carries the
    // numbers and the weapon's name.
    const body = el("span", "cp-opt-body", opt);
    el("span", "cp-opt-name", body, CLASSES[cls].name);
    // Plan item 400: the row names her signature skill tree beside its range ('Longshot', 'Meat'), so five rows no
    // longer read alike; its theme is the tooltip.
    const sig = TREES[CLASSES[cls].trees[0]!];
    el("span", "cp-opt-role", body, sig.name).title = sig.theme;
    // Plan item 334: the four unlabelled pips said nothing; a labelled three-step range meter says how close she
    // fights (from her starting gun's effective range).
    const gearBase = WEAPON_BASES[CLASS_SIGNATURE[cls]];
    const reach = rangeStep(gearBase?.range ?? 0);
    const meter = el("span", "cp-opt-meter", body);
    meter.dataset.step = String(reach);
    el("span", "cp-meter-k", meter, "Range");
    const segs = el("span", "cp-meter-segs", meter);
    segs.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) el("span", i < reach ? "cp-seg is-on" : "cp-seg", segs);
    el("span", "cp-meter-v", meter, RANGE_WORD[reach - 1]);
    const loud = NOISE_STEP[cls];
    const noise = el("span", "cp-opt-meter is-noise", body);
    noise.dataset.step = String(loud);
    el("span", "cp-meter-k", noise, "Noise");
    const nsegs = el("span", "cp-meter-segs", noise);
    nsegs.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) el("span", i < loud ? "cp-seg is-on" : "cp-seg", nsegs);
    el("span", "cp-meter-v", noise, NOISE_WORD[loud - 1]);
    if (gearBase) {
      const gear = el("span", "cp-opt-gear", opt);
      gear.setAttribute("aria-hidden", "true");
      gear.dataset.weapon = gearBase.cls;
      gear.dataset.cls = cls;
      gear.innerHTML = weaponArtSvg(gearBase.cls);
    }
    opt.addEventListener("click", () => select(cls, true));
    options.set(cls, opt);
  });
  // Plan item 313: the rack's stencils become the guns themselves, shot from the same meshes as the case table's
  // (monochrome until picked, then lit in the class's colour). One per animation frame, after the pick's first
  // frames, so opening the pick doesn't wait on five renders; at once for a still.
  let iconRaf = 0;
  let iconTries = 0;
  const gears = [...list.querySelectorAll<HTMLElement>(".cp-opt-gear")];
  const swapIcon = () => {
    const gear = gears.shift();
    if (!gear) return;
    const url = hooks.gunIcon?.(gear.dataset.weapon ?? "", gear.dataset.cls as ClassId | undefined);
    // Plan item 334: the pick opens before the street's renderer is up, so a gun that can't be shot yet waits its
    // turn again (it kept the flat stencil for good).
    if (!url && iconTries++ < 40) {
      gears.unshift(gear);
      iconTimer = window.setTimeout(() => (iconRaf = requestAnimationFrame(swapIcon)), 500);
      return;
    }
    if (url) {
      const img = document.createElement("img");
      img.className = "cp-opt-gun";
      img.alt = "";
      img.decoding = "sync";
      img.src = url;
      gear.classList.add("is-lit");
      gear.replaceChildren(img);
    }
    if (still) swapIcon();
    else iconRaf = requestAnimationFrame(swapIcon);
  };
  let iconTimer = 0;
  if (hooks.gunIcon) {
    if (still) swapIcon();
    else iconTimer = window.setTimeout(() => (iconRaf = requestAnimationFrame(swapIcon)), 600);
  }

  const words = el("div", "cp-words", left);
  words.setAttribute("aria-live", "polite");
  const kicker = el("p", "cp-kicker", words);
  // Plan item 245: on an upright phone the chosen class is named large over her lower third, with a page dot per
  // class under it (a dot tap or a swipe across her changes class); the names' row is kept for keyboards and
  // screen readers but visually hidden there. Both are hidden elsewhere, where the names' column does this.
  const nameplate = el("p", "cp-nameplate", words);
  nameplate.setAttribute("aria-hidden", "true");
  const dots = el("div", "cp-dots", words);
  dots.setAttribute("aria-hidden", "true");
  const dotFor = new Map<ClassId, HTMLButtonElement>();
  for (const cls of CLASS_IDS) {
    const d = button("cp-dot", dots);
    d.tabIndex = -1;
    d.dataset.cls = cls;
    // Plan item 375: each page dot is a named tab, its gun's silhouette over the class's name, so the four classes
    // not shown still say who they are.
    const base = WEAPON_BASES[CLASS_SIGNATURE[cls]];
    if (base) el("span", "cp-dot-gun", d).innerHTML = weaponArtSvg(base.cls);
    el("span", "cp-dot-name", d, CLASSES[cls].name);
    d.addEventListener("click", () => select(cls, false));
    dotFor.set(cls, d);
  }
  // Plan item 125: on an upright phone her quote is folded behind a tap so the whole file fits one screen; the
  // toggle is hidden elsewhere, where the quote always shows.
  const fold = button("cp-fold", words);
  // Plan item 375: her line shows from the start (the smaller class name and the named tabs leave it room); the
  // fold still tucks it away.
  root.classList.add("cp-quote-open");
  fold.setAttribute("aria-expanded", "true");
  fold.setAttribute("aria-controls", "cp-line");
  el("span", "cp-fold-label", fold, "Her line");
  fold.addEventListener("click", () => {
    const open = !root.classList.contains("cp-quote-open");
    root.classList.toggle("cp-quote-open", open);
    fold.setAttribute("aria-expanded", String(open));
  });
  const line = el("p", "cp-line", words);
  line.id = "cp-line";
  const plays = el("p", "cp-plays", words);

  // ---- right: the stat sheet ----
  const sheet = el("aside", "cp-sheet", root);
  sheet.setAttribute("aria-label", "Starting file");
  // Plan item 210: on an upright phone the sheet is a paper dossier clipped over the street (styles.css).
  sheet.dataset.dossier = "";
  // Plan item 504: at D (1100 px+) the same sheet is a cream case file on the table (styles.css `[data-casefile]`).
  sheet.dataset.casefile = "";
  el("p", "cp-label", sheet, "Starts with");
  // Plan item 397: the phone's key to the bars' marks (hidden at D).
  const key = el("p", "cp-attrs-key", sheet);
  key.setAttribute("aria-hidden", "true");
  el("span", "cp-key-avg", key, "Average");
  el("span", "cp-key-cls", key, "Other classes");
  const attrs = el("dl", "cp-attrs", sheet);
  const bars = new Map<AttributeId, { row: HTMLElement; n: HTMLElement; v: number }>();
  for (const a of ATTRIBUTES) {
    const row = el("div", "cp-attr stat-dial", attrs);
    el("dt", "", row, ATTRIBUTE_LABEL[a]);
    const dd = el("dd", "cp-attr-v", row);
    const bar = el("span", "cp-bar", dd);
    bar.setAttribute("aria-hidden", "true");
    el("span", "cp-bar-fill", bar);
    for (let t = 1; t < ATTR_MAX / 5; t++) el("span", "cp-tick", bar).style.setProperty("--t", String(t / (ATTR_MAX / 5)));
    // Plan item 397: on an upright phone each stat is a bar read against the field: a tick where each other class
    // starts and a notch at the five classes' average (hidden at D, where the dials and her edge do this).
    for (const c of CLASS_IDS) {
      const m = el("span", "cp-mark", bar);
      m.dataset.cls = c;
      m.style.setProperty("--t", String(CLASS_START_ATTRIBUTES[c][a] / ATTR_MAX));
    }
    const mean = CLASS_IDS.reduce((t, c) => t + CLASS_START_ATTRIBUTES[c][a], 0) / CLASS_IDS.length;
    el("span", "cp-avg", bar).style.setProperty("--t", String(mean / ATTR_MAX));
    const n = el("span", "cp-attr-n", dd, "0");
    bars.set(a, { row, n, v: 0 });
  }
  const weapon = el("div", "cp-weapon", sheet);
  const trees = el("ul", "cp-trees", sheet);
  trees.setAttribute("aria-label", "Skill trees");

  // ---- the commit: hold the bar ----
  // Plan item 40: on an upright phone the sheet runs past the screen, so the foot (a "more below" cue over the
  // hold bar) is pinned to the bottom; the cue fades once the sheet has been scrolled to its end. Elsewhere the
  // foot is display: contents and the cue hidden, so the desktop column lays out as before.
  const foot = el("div", "cp-foot", sheet);
  const cue = el("p", "cp-cue", foot, "More below");
  cue.setAttribute("aria-hidden", "true");
  const go = button("cp-hold", foot);
  go.setAttribute("aria-describedby", "cp-hold-how");
  const goFill = el("span", "cp-hold-fill", go);
  goFill.setAttribute("aria-hidden", "true");
  const goLabel = el("span", "cp-hold-label", go);
  const goHow = el("span", "cp-hold-how", go, "Hold");
  goHow.id = "cp-hold-how";

  // Plan item 136: her line spoken over the audition as a subtitle under her, word by word, gone after 3.2 s
  // (the vignette's length). The quote in the column carries it for screen readers, so this one is hidden from them.
  const sub = el("p", "cp-sub", root);
  sub.setAttribute("aria-hidden", "true");
  let subTimer = 0;
  let subToken = 0;
  function placeSub(): void {
    const portrait = innerWidth <= 700 && innerHeight > innerWidth;
    const a = left.getBoundingClientRect();
    const b = sheet.getBoundingClientRect();
    const w = words.getBoundingClientRect();
    // Between the columns at D, its foot level with the left column's; on an upright phone just over her words.
    const l = portrait ? 16 : a.right;
    const r = portrait ? innerWidth - 16 : b.left;
    root.style.setProperty("--sub-l", `${Math.ceil(l)}px`);
    root.style.setProperty("--sub-w", `${Math.max(0, Math.floor(r) - Math.ceil(l))}px`);
    root.style.setProperty("--sub-b", `${Math.round(innerHeight - (portrait ? w.top - 8 : a.bottom))}px`);
  }
  function speak(text: string): void {
    clearTimeout(subTimer);
    sub.replaceChildren();
    text.split(/\s+/).forEach((word, i) => {
      const s = el("span", "cp-sub-w", sub, `${word} `);
      s.style.setProperty("--i", String(i));
    });
    placeSub();
    sub.classList.remove("is-on");
    void sub.offsetWidth;
    sub.classList.add("is-on");
    root.dataset.speaking = "true";
    if (hooks.still) return;
    // The 3.2 s count from the line's first painted frame, not from the click: on a slow device the cut (the lit gun
    // reel, a new class's meshes) can hold the page for seconds, and a wall-clock timer then expired before the line
    // was ever seen.
    const token = ++subToken;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== subToken) return;
      subTimer = window.setTimeout(() => {
        sub.classList.remove("is-on");
        delete root.dataset.speaking;
      }, 3200);
    }));
  }
  addEventListener("resize", placeSub);
  // The columns settle after the first speak (fonts, the fold, the weapon art): re-place it as they move, or a
  // held subtitle sits over the words it was placed above.
  const subRO = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => placeSub());
  for (const e of [left, sheet, words]) subRO?.observe(e);

  // The phone's class title is as large as the longest name allows: a long one (Gunslinger, Wirewitch) shrinks
  // to the column's width rather than running off the screen.
  function fitName(): void {
    nameplate.style.removeProperty("--np-fit");
    const w = nameplate.clientWidth;
    const sw = nameplate.scrollWidth;
    if (w > 0 && sw > w) nameplate.style.setProperty("--np-fit", (Math.floor((w / sw) * 1000) / 1000).toFixed(3));
  }
  addEventListener("resize", fitName);
  void document.fonts?.ready.then(() => fitName());

  let countRaf = 0;
  let reelTimer = 0;
  let reelRetry = 0;
  let reelTries = 0;
  // Plan item 464: the test-fire state for the class shown.
  let testMag = 0;
  let testMax = 0;
  let testGapMs = 250;
  let testReloadMs = 1500;
  let testReloading = false;
  let testLast = -Infinity;
  let testShots = 0;
  let testTimer = 0;
  let testMagEl: HTMLElement | null = null;
  let testCls: ClassId | null = null;
  // Plan item 481: a tree's preview: her line under the sheet for its length, the stage plays its look.
  let previewTimer = 0;
  let previewNext = 0;
  const skillLine = el("p", "cp-skill-line", sheet);
  skillLine.setAttribute("aria-live", "polite");
  function previewTree(t: TreeId): void {
    if (done) return;
    const p = SKILL_PREVIEWS[t];
    clearTimeout(previewTimer);
    root.dataset.skillpreview = t;
    skillLine.textContent = `\u201c${p.line}\u201d`;
    root.dispatchEvent(new CustomEvent("skillpreview", { detail: { tree: t, active: p.active } }));
    hooks.onSkillPreview?.(t);
    previewTimer = window.setTimeout(endPreview, p.ms);
  }
  function endPreview(): void {
    clearTimeout(previewTimer);
    delete root.dataset.skillpreview;
    skillLine.textContent = "";
  }
  function testFire(): void {
    if (done || testMax <= 0 || testReloading) return;
    const now = performance.now();
    if (now - testLast < testGapMs) return;
    testLast = now;
    testMag -= 1;
    testShots += 1;
    root.dataset.testfire = String(testShots);
    root.dispatchEvent(new CustomEvent("testfire", { detail: { cls: selected, left: testMag } }));
    hooks.onTestFire?.(selected);
    // A short kick in the hand where the phone can buzz (iPhone Safari can't; Android Chrome can).
    try {
      navigator.vibrate?.(14);
    } catch {
      // no vibration
    }
    if (testMagEl) testMagEl.textContent = `${testMag} / ${testMax}`;
    if (testMag <= 0) {
      testReloading = true;
      root.dataset.reloading = "";
      if (testMagEl) testMagEl.textContent = "Reloading";
      testTimer = window.setTimeout(() => {
        testReloading = false;
        delete root.dataset.reloading;
        testMag = testMax;
        if (testMagEl) testMagEl.textContent = `${testMag} / ${testMax}`;
      }, testReloadMs);
    }
  }
  function renderDetail(): void {
    const cls = selected;
    const def = CLASSES[cls];
    const copy = CLASS_COPY[cls];
    // Plan item 161: the stage names the class (data-class), and a change flashes her rim light (500 ms; a fade
    // under reduced motion), restarted on each switch.
    const was = root.dataset.class;
    root.dataset.cls = cls;
    root.dataset.class = cls;
    sheet.dataset.class = cls;
    if (was && was !== cls) {
      root.classList.remove("cp-swap");
      void root.offsetWidth;
      root.classList.add("cp-swap");
    }
    kicker.textContent = def.fantasy.replace(/\.$/, "");
    nameplate.textContent = def.name;
    fitName();
    for (const [c, d] of dotFor) d.classList.toggle("is-on", c === cls);
    for (const m of attrs.querySelectorAll<HTMLElement>(".cp-mark")) m.classList.toggle("is-own", m.dataset.cls === cls);
    line.textContent = `“${copy.line}”`;
    plays.textContent = copy.playsLike;
    speak(copy.line);
    for (const e of [kicker, nameplate, line, plays]) {
      e.classList.remove("is-in");
      void e.offsetWidth;
      e.classList.add("is-in");
    }

    // The bars count up from where they were to the new class's numbers over 350 ms.
    const start = CLASS_START_ATTRIBUTES[cls];
    const from = new Map([...bars].map(([a, b]) => [a, b.v]));
    const t0 = performance.now();
    cancelAnimationFrame(countRaf);
    const step = () => {
      const u = still ? 1 : Math.min(1, (performance.now() - t0) / 350);
      const e = 1 - Math.pow(1 - u, 3);
      for (const [a, b] of bars) {
        const v = from.get(a)! + (start[a] - from.get(a)!) * e;
        b.v = v;
        b.row.style.setProperty("--v", (v / ATTR_MAX).toFixed(4));
        b.n.textContent = String(Math.round(v));
      }
      if (u < 1) countRaf = requestAnimationFrame(step);
    };
    step();

    weapon.replaceChildren();
    const fresh = newCharacter(cls);
    const w = WEAPON_BASES[CLASS_SIGNATURE[cls]];
    if (w) {
      // Plan item 199: the class weapon as a prop on the armoury's rain-wet case table, under a lamp: its profile
      // (item 112's line art) extruded in layers so it has a body, turning slowly; a class change slides the new
      // one in over 250 ms (a fade, and no turn, under reduced motion).
      const art = el("span", "cp-weapon-art cp-case", weapon);
      // Plan item 464: a tap on the gun's own plate is a test shot too (the phone's only trigger: its button is
      // hidden, since the sheet's height is her stage's there).
      art.addEventListener("click", (e) => {
        e.stopPropagation();
        testFire();
      });
      art.dataset.armouryProp = cls;
      art.dataset.weapon = w.cls;
      art.setAttribute("role", "img");
      art.setAttribute("aria-label", `${WEAPON_CLASS_LABEL[w.cls] ?? w.cls} on the case table`);
      el("span", "cp-case-lamp", art).setAttribute("aria-hidden", "true");
      const prop = el("span", "cp-prop", art);
      prop.setAttribute("aria-hidden", "true");
      clearInterval(reelTimer);
      const reel = hooks.gunReel?.(w.cls, cls, still) ?? null;
      if (reel && reel.frames.length > 0) {
        // Plan item 313: the class's own gun mesh, lit (a warm key, a rim in the class's colour), turning slowly on
        // the case table; the table's reflection is its wet top. A still three-quarter under reduced motion.
        art.classList.add("is-lit");
        const img = el("img", "cp-gun", prop) as HTMLImageElement;
        img.alt = "";
        img.decoding = "sync";
        img.src = reel.frames[0]!;
        let k = 0;
        if (!still && reel.total > 1) {
          reelTimer = window.setInterval(() => {
            // Hold on the last shot frame while the reel is still filling; loop once it's whole.
            const next = k + 1 >= reel.total ? 0 : k + 1;
            if (next >= reel.frames.length) return;
            k = next;
            img.src = reel.frames[k]!;
          }, REEL_MS);
        }
      } else {
        // Plan item 334: no reel yet (the street's renderer comes up after the pick opens): the stencil stands in and
        // the panel redraws with the lit gun as soon as it can be shot, if the class is still the one shown.
        if (hooks.gunReel) {
          const want = cls;
          const wait = () => {
            if (done || selected !== want || reelTries++ >= 40) return;
            // A reel once the renderer can shoot it (cached, so the redraw takes the same one), else try again.
            if (hooks.gunReel?.(w.cls, cls, still)) renderDetail();
            else reelRetry = window.setTimeout(wait, 500);
          };
          clearTimeout(reelRetry);
          reelRetry = window.setTimeout(wait, 500);
        }
        const turn = el("span", "cp-prop-turn", prop);
        const svg = weaponArtSvg(w.cls);
        for (let i = 0; i < PROP_LAYERS; i++) {
          const layer = el("span", i === PROP_LAYERS - 1 ? "cp-prop-layer is-face" : "cp-prop-layer", turn);
          layer.style.setProperty("--z", String(i - (PROP_LAYERS - 1) / 2));
          layer.innerHTML = svg;
        }
      }
      if (still) art.classList.add("is-still");
      // Plan item 400: the band under the case table holds her edge: the (up to) two stats she starts furthest above
      // the five classes' average, as '+7 NERVE 25 vs 18 avg' (plan item 548: the dot read cryptic), so the classes read apart without the dials.
      const avg = (a: AttributeId) => CLASS_IDS.reduce((t, c) => t + CLASS_START_ATTRIBUTES[c][a], 0) / CLASS_IDS.length;
      const lead = (a: AttributeId) => CLASS_START_ATTRIBUTES[cls][a] - avg(a);
      const best = [...ATTRIBUTES].filter((a) => lead(a) > 0).sort((a, b) => lead(b) - lead(a)).slice(0, 2);
      if (best.length) {
        const edge = el("dl", "cp-edge", weapon);
        edge.setAttribute("aria-label", "Her edge over the other classes");
        for (const a of best) {
          const d = el("div", "", edge);
          el("dt", "", d, ATTRIBUTE_LABEL[a]);
          const dd = el("dd", "", d);
          el("span", "cp-edge-lead", dd, `+${Math.round(lead(a))}`);
          el("span", "cp-edge-of", dd, `${CLASS_START_ATTRIBUTES[cls][a]} vs ${Math.round(avg(a))} avg`);
        }
      }
      el("span", "cp-label", weapon, WEAPON_CLASS_LABEL[w.cls] ?? w.cls);
    }
    el("span", "cp-weapon-name", weapon, w?.name ?? fresh.equipment.weapon1?.name ?? "");
    if (w) {
      const nums = el("dl", "cp-weapon-nums", weapon);
      const pair = (k: string, v: string) => {
        const d = el("div", "", nums);
        el("dt", "", d, k);
        el("dd", "", d, v);
      };
      pair("Damage", w.pellets > 1 ? `${w.damage} × ${w.pellets}` : String(w.damage));
      pair("Rate", `${w.fireRate}/s`);
      pair("Magazine", w.magazine > 0 ? String(w.magazine) : "—");
      // Plan item 464: try it: a test shot per tap (or F), at the weapon's own cadence; the magazine counts down and
      // reloads at its reload time. Fresh for each class.
      // (renderDetail also re-runs for the same class as its gun reel fills: the magazine resets only on a new class)
      if (testCls !== cls) {
        endPreview();
        previewNext = 0;
        testCls = cls;
        testMag = w.magazine;
        testMax = w.magazine;
        testGapMs = 1000 / Math.max(0.1, w.fireRate);
        testReloadMs = w.reload * 1000;
        testReloading = false;
        clearTimeout(testTimer);
      }
      testMagEl = nums.children[2]?.querySelector("dd") ?? null;
      if (testMagEl && testMag < testMax) testMagEl.textContent = testReloading ? "Reloading" : `${testMag} / ${testMax}`;
      // In the numbers' row, so it adds no height (on an upright phone the sheet's height is her stage's; item 422).
      const tf = el("button", "cp-testfire", el("div", "cp-testfire-slot", nums), "Test fire") as HTMLButtonElement;
      tf.type = "button";
      tf.setAttribute("aria-keyshortcuts", "F");
      tf.addEventListener("click", (e) => {
        e.stopPropagation();
        testFire();
      });
    }
    el("p", "cp-weapon-pin", weapon, "and the Pin, her steel baton.");

    trees.replaceChildren();
    for (const t of def.trees) {
      const li = el("li", "cp-tree skill-row", trees);
      el("span", "cp-tree-name", li, TREES[t].name);
      el("span", "cp-tree-theme", li, TREES[t].theme);
      // Plan item 481: a tree is a button: it plays the tree's signature active on the stage.
      li.dataset.tree = t;
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.setAttribute("aria-label", `See ${TREES[t].name} in action`);
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        previewTree(t);
      });
      li.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        // (Enter elsewhere on the pick holds to commit; on a tree row it plays the preview)
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) previewTree(t);
      });
    }
    goLabel.textContent = `Walk in as the ${def.name}`;
  }

  function select(cls: ClassId, focus: boolean): void {
    const changed = cls !== selected || !root.dataset.cls;
    selected = cls;
    for (const [c, opt] of options) {
      const on = c === cls;
      opt.setAttribute("aria-checked", String(on));
      opt.tabIndex = on ? 0 : -1;
      if (on && focus) opt.focus({ preventScroll: true });
      // An upright phone's names are a row wider than the screen: keep the chosen one in view.
      if (on && list.scrollWidth > list.clientWidth) {
        const left = opt.offsetLeft - (list.clientWidth - opt.offsetWidth) / 2;
        list.scrollTo({ left: Math.max(0, left), behavior: still ? "auto" : "smooth" });
      }
    }
    if (changed) {
      renderDetail();
      hooks.onSelect?.(cls);
    }
  }

  // ---- hold to commit ----
  let holdT0 = 0;
  let holdTimer = 0;
  let thumpTimer = 0;
  function holdStart(): void {
    if (done || holdT0) return;
    holdT0 = performance.now();
    go.classList.add("is-holding");
    hooks.onThump?.();
    thumpTimer = window.setTimeout(() => hooks.onThump?.(), HOLD_MS / 2);
    holdTimer = window.setTimeout(commit, still ? 0 : HOLD_MS);
  }
  function holdCancel(): void {
    if (done || !holdT0) return;
    holdT0 = 0;
    clearTimeout(holdTimer);
    clearTimeout(thumpTimer);
    go.classList.remove("is-holding");
  }
  go.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    go.setPointerCapture?.(e.pointerId);
    holdStart();
  });
  go.addEventListener("pointerup", holdCancel);
  go.addEventListener("pointercancel", holdCancel);
  go.addEventListener("lostpointercapture", holdCancel);
  go.addEventListener("contextmenu", (e) => e.preventDefault());

  function commit(): void {
    if (done) return;
    done = true;
    go.classList.add("is-done");
    const cls = selected;
    hooks.onCommit?.(cls);
    root.classList.add("cp-leaving");
    const finish = () => {
      root.remove();
      cleanup();
      onPick(cls);
    };
    if (still) finish();
    else setTimeout(finish, 520);
  }

  function onKey(ev: KeyboardEvent): void {
    if (done) return;
    const i = CLASS_IDS.indexOf(selected);
    const inList = list.contains(document.activeElement);
    let next: number | null = null;
    if (ev.key === "Enter" || (ev.key === " " && document.activeElement === go)) {
      ev.preventDefault();
      if (!ev.repeat) holdStart();
      return;
    }
    // Plan item 481: T plays the class's skill trees in turn.
    if ((ev.key === "t" || ev.key === "T") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      ev.preventDefault();
      if (!ev.repeat) {
        const ts = CLASSES[selected].trees;
        previewTree(ts[previewNext++ % ts.length]!);
      }
      return;
    }
    // Plan item 464: F test-fires the class weapon (held, it fires at the weapon's cadence).
    if ((ev.key === "f" || ev.key === "F") && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      ev.preventDefault();
      testFire();
      return;
    }
    if (inList && (ev.key === "ArrowDown" || ev.key === "ArrowRight")) next = (i + 1) % CLASS_IDS.length;
    else if (inList && (ev.key === "ArrowUp" || ev.key === "ArrowLeft")) next = (i + CLASS_IDS.length - 1) % CLASS_IDS.length;
    else if (inList && ev.key === "Home") next = 0;
    else if (inList && ev.key === "End") next = CLASS_IDS.length - 1;
    else if (/^[1-5]$/.test(ev.key)) next = Number(ev.key) - 1;
    else if (ev.key === "Tab") {
      trapTab(root, ev);
      return;
    }
    if (next !== null) {
      ev.preventDefault();
      holdCancel();
      select(CLASS_IDS[next]!, true);
    }
  }
  function onKeyUp(ev: KeyboardEvent): void {
    if (ev.key === "Enter" || ev.key === " ") holdCancel();
  }
  const onBlur = () => holdCancel();
  // Plan item 112: on a touch screen a sideways swipe across her (anywhere but the names' row, which scrolls, and
  // the hold bar) steps to the next or previous class.
  let swipe: { x: number; y: number; id: number } | null = null;
  root.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    swipe = e.pointerType === "touch" && !list.contains(t) && !go.contains(t) && !fold.contains(t) && !dots.contains(t) ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
  });
  root.addEventListener("pointerup", (e) => {
    if (!swipe || e.pointerId !== swipe.id || done) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const i = CLASS_IDS.indexOf(selected);
    const n = CLASS_IDS.length;
    holdCancel();
    select(CLASS_IDS[(i + (dx < 0 ? 1 : n - 1)) % n]!, false);
  });
  root.addEventListener("pointercancel", () => (swipe = null));
  // The cue shows while there is more of the sheet below the fold (only an upright phone ever scrolls).
  const moreBelow = () => root.classList.toggle("cp-more", root.scrollHeight - root.clientHeight - root.scrollTop > 8);
  root.addEventListener("scroll", moreBelow, { passive: true });
  requestAnimationFrame(moreBelow);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("keyup", onKeyUp, true);
  addEventListener("blur", onBlur);
  function cleanup(): void {
    cancelAnimationFrame(countRaf);
    clearInterval(reelTimer);
    clearTimeout(reelRetry);
    clearTimeout(iconTimer);
    cancelAnimationFrame(iconRaf);
    clearTimeout(holdTimer);
    clearTimeout(thumpTimer);
    clearTimeout(subTimer);
    clearTimeout(previewTimer);
    clearTimeout(testTimer);
    subToken++;
    removeEventListener("resize", placeSub);
    removeEventListener("resize", fitName);
    subRO?.disconnect();
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("keyup", onKeyUp, true);
    removeEventListener("blur", onBlur);
  }

  if (still) root.classList.add("cp-still");
  select(selected, false);
  requestAnimationFrame(() => {
    root.classList.add("cp-in");
    options.get(selected)?.focus();
  });

  return {
    close() {
      if (done) return;
      done = true;
      root.remove();
      cleanup();
      prevFocus?.focus?.();
    },
  };
}
