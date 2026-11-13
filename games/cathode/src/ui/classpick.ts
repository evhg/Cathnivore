// C14 (docs/design/cathode-combat.md S9.5): the class pick is a wardrobe and a dossier. The live title scene stays
// behind it and the camera comes in close on Cath, her key light turning to the class's colour and the class's idle
// playing (render/frontscene.ts `wardrobe`). Over it, type straight on the scene (C13T: no cards, emblems or
// hatching): the class names down the left edge (a radio group: arrows, Home/End and 1-5 move), Cath's line and how
// the class plays under them; the right column is the stat sheet, whose 1u bars with 6u ticks count up over 350 ms
// when the class changes, the starting weapon and the three trees. Commit is a hold: press and hold the red bar
// (or Enter, or Space) for 600 ms while the heartbeat thumps twice; letting go early cancels.

import { CLASSES, TREES } from "../sim/classes";
import { STARTING_WEAPON, newCharacter } from "../sim/character";
import { CLASS_START_ATTRIBUTES } from "../sim/stats";
import { ATTRIBUTES, CLASS_IDS, type AttributeId, type ClassId } from "../sim/types";
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
  gunIcon?(weaponCls: string): string | null;
}

export const ATTRIBUTE_LABEL: Record<AttributeId, string> = { grit: "Grit", aim: "Aim", nerve: "Nerve", wire: "Wire" };
/** The stat sheet's full bar (no class starts above 35). */
const ATTR_MAX = 40;
/** Plan item 334: a gun's effective range as one of three steps (shotguns close, sidearms mid, rifles long). */
export function rangeStep(range: number): 1 | 2 | 3 {
  return range <= 50 ? 1 : range <= 150 ? 2 : 3;
}
const RANGE_WORD = ["Close", "Mid", "Long"] as const;
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
    // Plan item 334: the four unlabelled pips said nothing; a labelled three-step range meter says how close she
    // fights (from her starting gun's effective range).
    const gearBase = WEAPON_BASES[STARTING_WEAPON[cls]];
    const reach = rangeStep(gearBase?.range ?? 0);
    const meter = el("span", "cp-opt-meter", body);
    meter.dataset.step = String(reach);
    el("span", "cp-meter-k", meter, "Range");
    const segs = el("span", "cp-meter-segs", meter);
    segs.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) el("span", i < reach ? "cp-seg is-on" : "cp-seg", segs);
    el("span", "cp-meter-v", meter, RANGE_WORD[reach - 1]);
    if (gearBase) {
      const gear = el("span", "cp-opt-gear", opt);
      gear.setAttribute("aria-hidden", "true");
      gear.dataset.weapon = gearBase.cls;
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
    const url = hooks.gunIcon?.(gear.dataset.weapon ?? "");
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
    d.addEventListener("click", () => select(cls, false));
    dotFor.set(cls, d);
  }
  // Plan item 125: on an upright phone her quote is folded behind a tap so the whole file fits one screen; the
  // toggle is hidden elsewhere, where the quote always shows.
  const fold = button("cp-fold", words);
  fold.setAttribute("aria-expanded", "false");
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
  el("p", "cp-label", sheet, "Starts with");
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
    subTimer = window.setTimeout(() => {
      sub.classList.remove("is-on");
      delete root.dataset.speaking;
    }, 3200);
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
  function renderDetail(): void {
    const cls = selected;
    const def = CLASSES[cls];
    const copy = CLASS_COPY[cls];
    // Plan item 161: the stage names the class (data-class), and a change flashes her rim light (500 ms; a fade
    // under reduced motion), restarted on each switch.
    const was = root.dataset.class;
    root.dataset.cls = cls;
    root.dataset.class = cls;
    if (was && was !== cls) {
      root.classList.remove("cp-swap");
      void root.offsetWidth;
      root.classList.add("cp-swap");
    }
    kicker.textContent = def.fantasy.replace(/\.$/, "");
    nameplate.textContent = def.name;
    fitName();
    for (const [c, d] of dotFor) d.classList.toggle("is-on", c === cls);
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
    const w = WEAPON_BASES[STARTING_WEAPON[cls]];
    if (w) {
      // Plan item 199: the class weapon as a prop on the armoury's rain-wet case table, under a lamp: its profile
      // (item 112's line art) extruded in layers so it has a body, turning slowly; a class change slides the new
      // one in over 250 ms (a fade, and no turn, under reduced motion).
      const art = el("span", "cp-weapon-art cp-case", weapon);
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
      el("span", "cp-label", weapon, WEAPON_CLASS_LABEL[w.cls] ?? w.cls);
    }
    el("span", "cp-weapon-name", weapon, fresh.equipment.weapon1?.name ?? w?.name ?? "");
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
    }
    el("p", "cp-weapon-pin", weapon, "and the Pin, her steel baton.");

    trees.replaceChildren();
    for (const t of def.trees) {
      const li = el("li", "cp-tree", trees);
      el("span", "cp-tree-name", li, TREES[t].name);
      el("span", "cp-tree-theme", li, TREES[t].theme);
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
