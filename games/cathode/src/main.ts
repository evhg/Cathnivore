// CATHODE's front door (C13, docs/design/cathode-combat.md S9): the cold open, the 18+ gate, the title over the
// live street (render/frontscene.ts), settings and credits, and the push into the game. three.js and the street
// load behind the cold open; the game's own code loads during the push. Design: docs/design/cathode.md.

// The 2D Cath art (character sheet, level-up) needs its stylesheet; the front door itself has no 2D Cath (S9.1).
import { LAST_DISTRICT_KEY, resumeDistrict } from "./game/zones";
import "../../../shared/cath/cath.css";
import "../../../shared/ui/base.css";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/hud.css";
import "./styles/death.css";
import "./styles/front.css";
import "./styles.css";
import { applyMotionPref, loadPrefs, resolveQuality, savePrefs, type Intensity, type QualityChoice } from "./prefs";
import { openClassPick } from "./ui/classpick";
import { Progress } from "./game/progress";
import { canStartNewGamePlus, startSecondBroadcast } from "./sim/newgameplus";
import { pickDeck } from "./ui/deck";
import { newCharacter } from "./sim/character";
import { SAVE_KEY } from "./sim/save";
import type { ClassId } from "./sim/types";
import type { World } from "./render/types";
import type { FrontScene } from "./render/frontscene";
import { bindMenu, menuKey, type MenuBinding } from "./ui/menu";
import { areaTitle, COLD_OPEN_LINE, dossierFor, freshlyStruck, struckLine, frontSet, listRows, loadingCard, slotHint, struckJobs, THE_LIST, titleSubtitle } from "./ui/frontcopy";
import { BUST_FOR_CASE, mugshotSvg } from "./ui/busts";
import { listSeen, openLoading } from "./ui/loadingview";
import { FrontAudio, renderRack } from "./ui/frontaudio";
import { el, reducedMotion } from "./ui/dom";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const prefs = loadPrefs();
const params = new URLSearchParams(location.search);
// Reduce motion: html.reduce-motion from Settings, else from the system (and it follows a system change).
applyMotionPref(prefs);
try {
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => applyMotionPref(loadPrefs()));
} catch {
  // Very old Safari: the setting still applies on the next load.
}

type ScreenId = "screen-gate" | "screen-title" | "screen-game" | "none";
function show(id: ScreenId): void {
  for (const s of document.querySelectorAll<HTMLElement>(".screen")) s.hidden = s.id !== id;
}

function checked(name: string): string | undefined {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

function setChecked(name: string, value: string): void {
  const el = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

// ?front=gate|title|settings|credits|loading|areatitle|classpick&shot&t=30&focus=continue: the screenshot stages (scripts/cathode-feel-shots.mjs).
const frontStage = params.get("front");
const shot = params.has("shot");
// C19: screenshot runs shoot the reduced-violence stages at every size (&intensity=reduced, ?shot only; never saved).
if (shot && params.get("intensity") === "reduced") prefs.intensity = "reduced";
const audio = new FrontAudio(prefs.volume);
/** Read at each use, not once at boot: Settings → Reduce motion can change it mid-session (C14 review). */
const still = (): boolean => reducedMotion();

// ---- the live street behind the front door ----
let scene: FrontScene | null = null;
let sceneReady: Promise<FrontScene | null> = Promise.resolve(null);
function webgl2(): boolean {
  try {
    // A probe, so give its context straight back: an unreleased probe holds a second GL context for the page's life.
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
function quality() {
  return resolveQuality((["phone", "high", "ultra"].includes(params.get("quality") ?? "") ? params.get("quality") : prefs.quality) as typeof prefs.quality);
}
/** The boot line (index.html) goes once the street has drawn its first frame, or once there is no street. */
function built(): void {
  const line = document.getElementById("front-building");
  line?.classList.add("is-done");
  // Plan item 89: the progress line only while loading. After its fade it leaves the page for good (a frozen
  // frame, as in ?shot, held it at full strength under the title).
  if (line) setTimeout(() => (line.hidden = true), shot || reducedMotion() ? 0 : 650);
}
let sceneStarted = false
function startScene(): void {
  if (sceneStarted) return
  sceneStarted = true
  if (!webgl2()) return built();
  const rs = Math.max(0.25, Math.min(1, Number(params.get("rs") ?? 1) || 1));
  sceneReady = import("./render/frontscene")
    .then(({ openFrontScene }) =>
      openFrontScene($<HTMLCanvasElement>("view"), {
        quality: quality(),
        intensity: prefs.intensity,
        shot,
        still: still(),
        renderScale: rs,
        set: frontSet(Progress.load()?.jobsDone ?? []),
      }),
    )
    .then((s) => {
      scene = s;
      stageTitle();
      // Leaving the page (or a bfcache eviction): free the street's GPU memory and its context now, not at GC.
      addEventListener("pagehide", (e) => {
        if (e.persisted || scene !== s) return;
        scene = null;
        s.dispose();
        ($<HTMLCanvasElement>("view").getContext("webgl2") as WebGL2RenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
      });
      // Plan item 65: the poster stays until the street has drawn a frame, then cross-fades to it (no black gap).
      const reveal = () => {
        if (s.stats.frames > 0) {
          $("front-fallback").classList.add("is-off");
          $("front-grain").classList.add("is-baked");
          built();
        } else if (scene === s) requestAnimationFrame(reveal);
      };
      reveal();
      return s;
    })
    .catch((e: unknown) => {
      console.warn("front scene unavailable", e);
      built();
      return null;
    });
}

// Pointer parallax and the bars easing open on the first interaction.
let interacted = false;
function interact(): void {
  audio.wake();
  if (interacted) return;
  interacted = true;
  if (!shot) $("front-bars").classList.add("is-wide");
}
addEventListener("pointerdown", interact, { passive: true });
addEventListener("keydown", interact);
addEventListener(
  "pointermove",
  (e) => {
    if (e.pointerType !== "mouse") return;
    scene?.parallax((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  },
  { passive: true },
);

// ---- the cold open (S9.3) ----
async function coldOpen(full: boolean): Promise<void> {
  const co = $("coldopen");
  co.hidden = false;
  $("coldopen-line").textContent = full ? COLD_OPEN_LINE : "";
  audio.bed(true);
  let skip = false;
  const onKey = () => (skip = true);
  addEventListener("keydown", onKey, { once: true });
  addEventListener("pointerdown", onKey, { once: true });
  const wait = async (ms: number) => {
    const t0 = performance.now();
    while (!skip && performance.now() - t0 < ms) await sleep(50);
  };
  if (full) {
    await sleep(60);
    co.classList.add("is-line");
    await wait(1200);
  }
  // The street fades up behind the line once it is built (at most 4 s more; the fallback night if not).
  const t0 = performance.now();
  await Promise.race([sceneReady, sleep(skip ? 600 : 4000)]);
  // A hard bound: if the build held the main thread past the 4 s (a slow GPU, software WebGL), the player has
  // waited long enough; the line goes at once instead of holding through more slow frames.
  const late = performance.now() - t0 > 4500;
  co.classList.add("is-up");
  if (!late) await wait(full ? 1400 : 500);
  co.classList.add("is-out");
  await sleep(full && !late ? 450 : 0);
  co.hidden = true;
  co.classList.remove("is-boot", "is-line", "is-up", "is-out");
  removeEventListener("keydown", onKey);
  removeEventListener("pointerdown", onKey);
}

// ---- the gate (S9.3) ----
/** On a phone held sideways the gate plate takes the left 55%: Cath moves to 80% of the width so she stays in view. */
const gateFraming = () => (innerHeight <= 520 && innerWidth > innerHeight ? 0.62 : 0.42);
function openGate(): Promise<void> {
  show("screen-gate");
  scene?.setFraming(gateFraming());
  scene?.setLift(1);
  void sceneReady.then((s) => {
    if (!$("screen-gate").hidden) {
      s?.setFraming(gateFraming());
      s?.setLift(1);
    }
  });
  const gate = $("screen-gate");
  requestAnimationFrame(() => gate.classList.add("is-in"));
  const tiles = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="intensity"]'));
  (tiles.find((t) => t.checked) ?? tiles[0])?.focus({ preventScroll: true });
  return new Promise<void>((resolve) => {
    const accept = () => {
      removeEventListener("keydown", onKey);
      prefs.adult = true;
      prefs.intensity = (checked("intensity") as Intensity | undefined) ?? "full";
      savePrefs(prefs);
      audio.confirm();
      const plate = $("gate-plate");
      plate.classList.add("is-wiping");
      setTimeout(() => {
        scene?.setFraming(0.42);
        scene?.setLift(0);
        gate.classList.remove("is-in");
        plate.classList.remove("is-wiping");
        resolve();
      }, still() ? 0 : 460);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "a" || e.key === "d") {
        e.preventDefault();
        const i = tiles.findIndex((t) => t.checked);
        const n = tiles[(i + (e.key === "ArrowLeft" || e.key === "a" ? -1 : 1) + tiles.length) % tiles.length]!;
        n.checked = true;
        n.focus({ preventScroll: true });
        audio.tick();
      } else if (e.key === "Enter" && document.activeElement?.tagName !== "A") {
        e.preventDefault();
        accept();
      } else if (e.key === "Escape") location.href = "/";
    };
    addEventListener("keydown", onKey);
    for (const t of tiles) t.addEventListener("change", () => audio.tick());
    $<HTMLButtonElement>("gate-yes").addEventListener("click", accept, { once: true });
  });
}

// ---- the title (S9.4) ----
let menu: MenuBinding | null = null;
let armed = false;
let starting = false;
const hasSave = () => Progress.hasSave();
const jobs = () => Progress.load()?.jobsDone ?? [];

function hint(id: string): void {
  const done = jobs();
  let district: string | undefined;
  try {
    // Where Continue really lands (a district no longer open to this save sends it to the Market).
    district = resumeDistrict(localStorage.getItem(LAST_DISTRICT_KEY), done);
  } catch {
    district = undefined;
  }
  $("menu-hint").textContent = slotHint(id, { hasSave: hasSave(), jobsDone: done, district, ngPlus: hasSave() && canStartNewGamePlus(done), armed: armed && id === "new" });
  showDossier(dossierFor(id, { hasSave: hasSave(), jobsDone: done, district }));
}

/** Plan item 89: the case file that slides in beside the menu at D while New Case or Continue has the focus. */
function showDossier(d: ReturnType<typeof dossierFor>): void {
  const box = document.getElementById("dossier") ?? el("aside", "dossier", $("menu").parentElement!);
  box.id = "dossier";
  box.setAttribute("aria-hidden", "true");
  box.classList.toggle("is-open", !!d);
  box.style.setProperty("--dossier-top", `${$("menu").offsetTop}px`);
  if (!d) return;
  box.replaceChildren();
  el("i", "dossier-pin", box);
  const photo = el("figure", "dossier-photo", box);
  // Plan item 99: the focused target's mugshot (Tomas Reed's for the opening case), clipped to the file.
  const who = d.job ? BUST_FOR_CASE[d.job] : d.target === "Tomas Reed" ? "reed" : undefined;
  // Plan item 139: the dossier's print is about 150 px wide, where the slate's lettering drew at 8 px; it carries
  // item 107's lettered shapes instead, and the name stands in type under the print.
  photo.innerHTML = mugshotSvg(who ?? null, who ? d.target.toUpperCase().slice(0, 16) : "CASE FILE", true);
  el("p", "dossier-kicker", box, "Case file");
  el("b", "dossier-target", box, d.target);
  el("span", "dossier-place", box, d.place);
  el("span", "dossier-tag", box, d.tag);
}

/** Plan item 137: the boss jobs whose names the title has already shown struck off The List. */
const LIST_STRUCK_KEY = "cathode:list-struck:v1";
let subTick = 0;

function fillTitle(): void {
  const done = jobs();
  // Plan item 137: the first title visit after a boss case closes strikes that name with a red marker, develops
  // the next target's photo and ticks the count down. Once: the strike is remembered as soon as it plays.
  let seen: string[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(LIST_STRUCK_KEY) ?? "[]") as unknown;
    if (Array.isArray(raw)) seen = raw.filter((j): j is string => typeof j === "string");
  } catch {
    seen = [];
  }
  const fresh = freshlyStruck(done, seen);
  try {
    localStorage.setItem(LIST_STRUCK_KEY, JSON.stringify(struckJobs(done)));
  } catch {
    // private mode: the strike may play again next visit
  }
  const sub = $("title-sub");
  window.clearTimeout(subTick);
  if (fresh >= 0) {
    const before = done.filter((j) => j !== THE_LIST[fresh]!.job);
    sub.textContent = titleSubtitle(before);
    sub.classList.remove("is-ticking");
    subTick = window.setTimeout(() => {
      sub.textContent = titleSubtitle(done);
      sub.classList.add("is-ticking");
    }, 1300);
  } else sub.textContent = titleSubtitle(done);
  // Plan item 137: and Cath says so, under The List's heading, on that visit only.
  const say = $("list-line");
  say.hidden = fresh < 0;
  say.textContent = fresh >= 0 ? `\u201C${struckLine(fresh)}\u201D \u2014 Cath` : "";
  const list = $("the-list");
  list.replaceChildren();
  // C13T: names the player hasn't reached are not drawn as grey bars (they read as a web skeleton loader): the
  // file just says how many more there are.
  let sealed = 0;
  for (const r of listRows(done)) {
    if (r.redacted) {
      sealed++;
      continue;
    }
    const li = el("li", r.done ? "is-done" : r.next ? "is-next" : "", list, r.name);
    if (r.done) li.setAttribute("aria-label", `${r.name}, dealt with`);
    if (r.done) li.dataset.struck = THE_LIST[fresh]?.name === r.name ? "fresh" : "";
  }
  if (sealed) el("li", "is-more", list, `${sealed} more ${sealed === 1 ? "name" : "names"}`);
  // Plan item 89: at D the List is five pinned mugshots (the case board's stills): the dealt-with struck through,
  // the next one lit, the unreached blank prints with their names withheld. The names list stays for phones.
  const wall = document.getElementById("the-list-wall") ?? el("ol", "the-list-wall", list.parentElement!);
  wall.id = "the-list-wall";
  wall.setAttribute("aria-hidden", "true");
  wall.replaceChildren();
  listRows(done).forEach((r, i) => {
    const li = el("li", `mug${r.done ? " is-done" : r.next ? " is-next" : r.redacted ? " is-sealed" : ""}`, wall);
    if (r.done) li.dataset.struck = i === fresh ? "fresh" : "";
    if (r.next && fresh >= 0) li.dataset.developing = "";
    li.style.setProperty("--tilt", `${((i * 37) % 7) - 3}deg`);
    const photo = el("figure", "mug-photo", li);
    // Plan item 99: a noir mugshot for every name; one not reached yet is a redacted silhouette, never a black square.
    const who = r.redacted ? undefined : BUST_FOR_CASE[THE_LIST[i]!.job];
    photo.innerHTML = mugshotSvg(who ?? null, `NO. ${i + 1}`, true);
    el("b", "mug-name", li, r.redacted ? "Withheld" : r.name);
  });
  // Plan item 159: a slot that can't be used says why, on the sign itself.
  const cont = $<HTMLButtonElement>("btn-continue");
  cont.disabled = !hasSave();
  cont.setAttribute("aria-disabled", String(cont.disabled));
  $("continue-why").hidden = !cont.disabled;
  // Plan item 12: the board opens on a fresh save too, as a teaser (one lead, five blank prints).
  $<HTMLButtonElement>("btn-cases").disabled = false;
  const ng = hasSave() && canStartNewGamePlus(done);
  $("btn-continue").querySelector(".menu-label")!.textContent = ng ? "New Game+" : "Continue";
}

/**
 * Plan item 148: on an upright phone the title gives her the screen above The List's photo strip, edge to edge, and
 * the scene fits her whole figure, umbrella to shoes, into it (right-aligned, beside the menu).
 */
function stageTitle(): void {
  const wall = document.getElementById("the-list-wall")?.getBoundingClientRect();
  const upright = innerWidth < innerHeight && innerWidth < 900;
  if (!upright || !wall || wall.height <= 0) {
    scene?.setStage(null);
    return;
  }
  const m = Math.round(Math.min(innerWidth, innerHeight) * 0.02);
  // The top leaves the umbrella room under the screen's edge so her face falls below the logotype's subtitle.
  scene?.setStage({ left: m, top: Math.round(innerHeight * 0.03), right: innerWidth - m, bottom: wall.top - Math.max(4, m / 2) });
}
addEventListener("resize", () => stageTitle());

/**
 * Plan item 161: on a landscape class pick she stands whole in the gap between the class list and the stat sheet
 * (its plate bleeds left of the type), key-lit and centred, never behind either column.
 */
function stagePick(): void {
  const left = document.querySelector(".cp .cp-left")?.getBoundingClientRect();
  const sheet = document.querySelector(".cp .cp-sheet");
  if (!left || !sheet || innerWidth < innerHeight) {
    scene?.setPickStage(null);
    return;
  }
  // The sheet's dark plate (its ::before) runs past the type on the left; she clears the plate, not just the words.
  const plate = parseFloat(getComputedStyle(sheet, "::before").left) || 0;
  const r = sheet.getBoundingClientRect();
  const gap = Math.round(innerWidth * 0.012);
  const list = Array.from(document.querySelectorAll(".cp .cp-opt-name, .cp .cp-title")).reduce((m, el) => Math.max(m, el.getBoundingClientRect().right), left.left);
  scene?.setPickStage({
    left: Math.max(list, left.right - left.width * 0.25) + gap,
    top: Math.round(innerHeight * 0.05),
    right: r.left + Math.min(0, plate) - gap,
    bottom: Math.round(innerHeight * 0.95),
  });
}
addEventListener("resize", () => {
  if (document.querySelector(".cp")) stagePick();
});

function openTitle(drawLogo: boolean): void {
  fillTitle();
  show("screen-title");
  stageTitle();
  const title = $("screen-title");
  title.classList.remove("is-leaving");
  const logo = $("title-word");
  if (drawLogo && !shot) {
    logo.classList.remove("is-drawing");
    void logo.offsetWidth;
    logo.classList.add("is-drawing");
  }
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("#menu .menu-item"));
  if (!menu) {
    menu = bindMenu(buttons, {
      start: params.get("focus") ?? (hasSave() ? "continue" : "new"),
      tick: (i) => {
        audio.tick();
        hook.ticks++;
        const id = buttons[i]?.dataset.slot ?? "";
        if (armed && id !== "new") disarm();
        hint(id);
        scene?.focusBias((i - (buttons.length - 1) / 2) / ((buttons.length - 1) / 2));
      },
      confirm: (id) => void confirm(id),
      back: () => {
        if (armed) disarm();
      },
    });
  } else menu.refresh();
  menu.active = true;
  hint(menu.model.current?.id ?? "new");
}

function disarm(): void {
  armed = false;
  $("btn-begin").classList.remove("is-armed");
  hint(menu?.model.current?.id ?? "new");
}

function flash(id: string): void {
  const b = document.querySelector<HTMLElement>(`#menu [data-slot="${id}"]`);
  if (!b) return;
  b.classList.add("is-confirm");
  requestAnimationFrame(() => requestAnimationFrame(() => b.classList.remove("is-confirm")));
}

async function confirm(id: string): Promise<void> {
  if (starting) return;
  if (id === "new" && hasSave() && !armed) {
    armed = true;
    $("btn-begin").classList.add("is-armed");
    audio.tick();
    hint("new");
    return;
  }
  flash(id);
  audio.confirm();
  if (id === "settings") return openSettings();
  if (id === "credits") return openCredits();
  if (id === "cases") return openCases();
  if (id === "new") {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem("cathode.district");
    } catch {
      // Private mode: nothing was saved.
    }
    Progress.resetUnlocks();
    armed = false;
  } else if (id === "continue" && canStartNewGamePlus(jobs())) {
    const p = new Progress();
    if (menu) menu.active = false;
    const picks = await pickDeck($("screen-title"), p.jobsDone);
    p.jobsDone = startSecondBroadcast(p.jobsDone, picks);
    p.save();
  }
  void begin(true);
}

// ---- credits: who made it, no story (the ending roll stays for the ending) ----
async function openCases(): Promise<void> {
  if (menu) menu.active = false;
  const { openCaseBoard } = await import("./ui/caseboard");
  openCaseBoard($("screen-title"), jobs(), () => {
    setTimeout(() => {
      if (menu) menu.active = true;
      document.querySelector<HTMLElement>("#menu .is-focus")?.focus({ preventScroll: true });
    }, 0);
  });
}

async function openCredits(): Promise<void> {
  if (menu) menu.active = false;
  const title = $("screen-title");
  const { showFrontCredits } = await import("./ui/credits");
  title.classList.add("is-credits");
  showFrontCredits(title, {
    tick: () => audio.tick(),
    onClose: () => {
      title.classList.remove("is-credits");
      // The key that closed it must not reach the menu as a "back" in the same event.
      setTimeout(() => {
        if (menu) menu.active = true;
        document.querySelector<HTMLElement>("#menu .is-focus")?.focus({ preventScroll: true });
      }, 0);
    },
  });
}

// ---- settings ----
const dlg = $<HTMLDialogElement>("dlg-settings");
function openSettings(): void {
  if (menu) menu.active = false;
  setChecked("quality", prefs.quality);
  setChecked("intensity2", prefs.intensity);
  setChecked("motion", prefs.reduceMotion === null ? "auto" : prefs.reduceMotion ? "on" : "off");
  dlg.showModal();
}
function closeSettings(): void {
  prefs.quality = (checked("quality") as QualityChoice | undefined) ?? "auto";
  prefs.intensity = (checked("intensity2") as Intensity | undefined) ?? prefs.intensity;
  const motion = checked("motion");
  prefs.reduceMotion = motion === "on" ? true : motion === "off" ? false : null;
  savePrefs(prefs);
  applyMotionPref(prefs);
  if (dlg.open) dlg.close();
}
$<HTMLButtonElement>("settings-close").addEventListener("click", closeSettings);
dlg.addEventListener("close", () => {
  if (menu) menu.active = true;
  document.querySelector<HTMLElement>("#menu .is-focus")?.focus();
});
dlg.addEventListener("cancel", () => closeSettings());
// Escape always goes back (S9.1), even where the browser's close watcher would swallow a quick second Escape.
dlg.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  e.preventDefault();
  closeSettings();
});

// ---- the game: the push (S9.4), then the street in first person ----
async function begin(fromTitle: boolean): Promise<void> {
  if (starting) return;
  starting = true;
  if (menu) menu.active = false;
  // A new game starts with the case file: who walks back in? (?class=ghost picks for tests and links; ?shot
  // skips it for screenshots.)
  const given = params.get("class") as ClassId | null;
  if (!Progress.hasSave() && (given || shot)) new Progress(given ?? "ghost").set(newCharacter(given ?? "ghost"));
  if (!Progress.hasSave()) {
    $("screen-title").classList.add("is-leaving");
    // Plan item 112: a `?play` link opens the case file before the street exists, so the pick showed the static
    // poster (her back under the umbrella). Build the street now and turn her to the camera once it's up; the
    // game below disposes of it, as it does for another district.
    let shown: ClassId = "ghost";
    let picking = true;
    if (!sceneStarted) startScene();
    void sceneReady.then((s) => {
      if (!picking) return;
      stagePick();
      s?.wardrobe(shown, true);
    });
    const cls = await new Promise<ClassId | null>((resolve) => {
      const h = openClassPick(
        document.body,
        (c) => {
          h.close();
          resolve(c);
        },
        "ghost",
        { onSelect: (c) => ((shown = c), scene?.wardrobe(c), audio.rack(c)), onThump: () => audio.thump() },
      );
      stagePick();
      // Escape from the case file goes back to the title.
      const onKey = (e: KeyboardEvent) => {
        if (menuKey(e.key) !== "back" || e.key === "Backspace") return;
        removeEventListener("keydown", onKey, true);
        h.close();
        resolve(null);
      };
      addEventListener("keydown", onKey, true);
    });
    picking = false;
    scene?.setPickStage(null);
    if (!cls) {
      scene?.wardrobe(null);
      starting = false;
      openTitle(false);
      return;
    }
    Progress.resetUnlocks();
    const p = new Progress(cls);
    p.set(newCharacter(cls));
  }
  // Per-district save: Continue returns to the district last played (an explicit ?district= or ?shot wins).
  let district = params.get("district") ?? undefined;
  const zones = await import("./game/zones");
  const { continueDistrict } = await import("./game/office");
  try {
    // Plan item 16: Continue from the title lands in Cath's office once the first job is done (the hub between
    // cases); a `?play` link keeps the last district.
    if (!district && !shot && fromTitle) district = continueDistrict(new Progress().jobsDone);
    if (!district && !shot) district = zones.resumeDistrict(localStorage.getItem(zones.LAST_DISTRICT_KEY), new Progress().jobsDone);
    if (district !== "office") localStorage.setItem(zones.LAST_DISTRICT_KEY, district ?? "market");
  } catch {
    // Private mode: no resume.
  }
  const sessionMod = import("./game/session");
  const fade = $("front-fade");
  const s = fromTitle ? scene : null;
  if (!fromTitle && sceneStarted) {
    // Plan item 112: the street built for a `?play` case file goes; the game builds its own on a fresh canvas.
    // It may still be building, so it is disposed of whenever it's up (drawing to the detached canvas till then).
    const old = $<HTMLCanvasElement>("view");
    old.replaceWith(old.cloneNode(false));
    void sceneReady.then((fs) => {
      fs?.dispose();
      if (scene === fs) scene = null;
    });
  }
  const sameWorld = !!s && (district ?? "market") === "market";
  let world: World | undefined;
  if (fromTitle) {
    // The UI fades over 400 ms while the camera flies past her into the street; the swell carries it.
    $("screen-title").classList.add("is-leaving");
    audio.swell(1.6);
    if (s) {
      const pushing = s.push(1.6);
      await sleep(still() ? 300 : 1350);
      fade.style.setProperty("--fade-ms", "250ms");
      fade.classList.add("is-black");
      await pushing;
      await sleep(still() ? 0 : 200);
    } else {
      fade.style.setProperty("--fade-ms", "400ms");
      fade.classList.add("is-black");
      await sleep(420);
    }
    if (sameWorld && s) world = s.handover();
    else if (s) {
      // Another district: the title's street goes, and the game builds its own on a fresh canvas.
      s.dispose();
      const old = $<HTMLCanvasElement>("view");
      const fresh = old.cloneNode(false) as HTMLCanvasElement;
      old.replaceWith(fresh);
    }
    scene = null;
    $("front-bars").classList.add("is-gone");
  }
  $("front-grain").classList.add("is-off");
  show("screen-game");
  // C14 (S9.6): the case file, unless the push handed over a built street (no load to cover).
  const travel = takeTravel();
  const card = loadingCard(jobs(), district, { seen: listSeen(), travel });
  const loading = world ? null : openLoading($("loading"), card, { still: still() });
  if (loading) fade.classList.remove("is-black");
  const progress = (share: number) => loading?.set(share);
  const { startSession } = await sessionMod;
  await startSession({
    canvas: $<HTMLCanvasElement>("view"),
    hud: $("hud"),
    touch: $("touch"),
    // ?quality=phone|high|ultra overrides the setting (screenshot runs pick the phone profile).
    quality: quality(),
    intensity: prefs.intensity,
    shot,
    district,
    world,
    areaTitle: true,
    onProgress: progress,
    onExit: () => location.reload(),
    // A death while the case file is still easing out drops it: the fall is never played under the loading card.
    onDying: () => loading?.close(),
  });
  $("front-fallback").classList.add("is-off");
  if (loading) {
    // A long load waits for the player (S9.6); a quick one walks straight in. Automated runs never wait.
    // Screenshot runs drop it at once (the eased figure takes dozens of frames under software WebGL).
    if (!shot) await loading.finish(!navigator.webdriver);
    loading.close();
  }
  audio.close();
  // 300 ms up from black into first person, then the area title.
  fade.style.setProperty("--fade-ms", "300ms");
  fade.classList.remove("is-black");
  showAreaTitle(district);
  // Plan item 14: `?talk` opens the district's talk once she is in the street (tests and shots).
  if (new URLSearchParams(location.search).has("talk") && !shot) setTimeout(() => window.cathode?.talk?.(), 1500);
}

/** Whether this page load is a travel from the district map (C14: the loading screen's motif). Read once. */
function takeTravel(): boolean {
  try {
    const t = sessionStorage.getItem("cathode.travel") === "1";
    sessionStorage.removeItem("cathode.travel");
    return t;
  } catch {
    return false;
  }
}

function showAreaTitle(district: string | undefined): void {
  const a = areaTitle(district, Progress.load()?.jobsDone ?? []);
  const box = $("area-title");
  $("area-name").textContent = a.title;
  $("area-sub").textContent = a.sub;
  box.hidden = false;
  // One instruction at a time: the touch coach chips step aside while the area is named (hud.css).
  const root = document.documentElement;
  root.classList.add("hud-banner-on");
  box.classList.toggle("is-held", frontStage === "areatitle" && shot);
  // The area title plays alone: the HUD, touch controls and Cath's first line wait for it (hud.css, Hud.hold).
  root.classList.add("area-arriving");
  if (!(frontStage === "areatitle" && shot))
    setTimeout(() => {
      box.hidden = true;
      root.classList.remove("hud-banner-on", "area-arriving");
    }, 3300);
}

// AAA UI M1: give the UI and voice faces up to 600 ms before the first screen, so the wordmark doesn't
// visibly swap from the fallback. Never blocks longer than that.
function fontsReady(ms = 600): Promise<void> {
  const fonts = document.fonts;
  if (!fonts?.load) return Promise.resolve();
  const loads = Promise.all([
    fonts.load('700 16px "Cathode UI"'),
    fonts.load('italic 400 32px "Cathode Voice"'),
  ]).then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([loads, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

void fetch(`${import.meta.env.BASE_URL}../version.json`)
  .then((r) => (r.ok ? r.json() : null))
  .then((v: { commit?: string } | null) => {
    $("build-ver").textContent = v?.commit && v.commit !== "unknown" ? `Build ${v.commit.slice(0, 7)}` : "Build dev";
  })
  .catch(() => ($("build-ver").textContent = "Build dev"));

/**
 * C14 stages: the case file 40% in (`loading`, `loading-fishmarket`, `loading-office`) and a travel into a reached district
 * (`loading-travel`, the clinic after Crisp), over the district's key art (screenshot runs only).
 */
function stageLoading(name: string): void {
  show("screen-game");
  $("hud").hidden = true;
  $("front-bars").classList.add("is-gone");
  $("front-grain").classList.add("is-off");
  const travel = name === "loading-travel";
  const done = travel ? ["fishMarket", "crispLead", "quayContracts", "candorManifest", "crispBoss"] : [];
  const card = loadingCard(done, travel ? "clinic" : name === "loading-office" ? "office" : "market", { seen: travel ? 0 : undefined, travel });
  const v = openLoading($("loading"), card, { still: true, held: travel ? 0.62 : 0.4 });
  (hook as { loadTrace?: number[] }).loadTrace = v.trace;
  // The percentage trace for the 4% rule: a real ease over a load that jumps (0, 40%, 90%, 100%) in its own view.
  const probe = openLoading(document.createElement("div"), card, { still: true });
  const jumps = [0.4, 0.9, 1];
  let i = 0;
  const step = () => {
    probe.set(jumps[Math.min(i++ >> 3, jumps.length - 1)]!);
    if (i < 120) requestAnimationFrame(step);
    else {
      (hook as { loadTrace?: number[] }).loadTrace = probe.trace.slice();
      probe.close();
    }
  };
  requestAnimationFrame(step);
}

// The screenshot hook: the stages wait on `ready`.
const hook = {
  ready: false,
  ticks: 0,
  scene: () => scene,
  stage: frontStage,
  /** Plan item 129: the class pick's weapon-rack stinger rendered offline (the audio check). */
  rack: (cls: string) => renderRack(cls),
  begin: () => begin(true),
  /** Screenshot runs only: a save with these jobs done, written by the game's own serializer. */
  demoSave: (done: string[]) => {
    if (!shot) return;
    const p = new Progress("ghost");
    p.jobsDone = done;
    p.set(newCharacter("ghost"));
  },
};
(window as unknown as { cathodeFront: typeof hook }).cathodeFront = hook;

// ?play&shot is for screenshots: skip the gate for this visit only, without saving the 18+ answer.
const shotBypass = params.has("play") && shot;
// C10: ?shot&arch=<id> is the enemy review turntable (game/turntable.ts), not the game.
const turntable = shot && params.has("arch");
async function boot(): Promise<void> {
  // The boot card and line are painted by the HTML; the paths below that skip the cold open take them down.
  const skipBoot = () => {
    $("coldopen").hidden = true;
    $("coldopen").classList.remove("is-boot");
    built();
  };
  if (turntable) {
    skipBoot();
    show("screen-game");
    $("hud").hidden = true;
    $("front-bars").classList.add("is-gone");
    $("front-grain").classList.add("is-off");
    // The no-WebGL fallback sky would sit over the studio (C14: the portrait plates came out as its gradient).
    $("front-fallback").hidden = true;
    const { openTurntable } = await import("./game/turntable");
    openTurntable($<HTMLCanvasElement>("view"));
    return;
  }
  if (params.has("play") && (prefs.adult || shotBypass)) {
    skipBoot();
    $("front-bars").classList.add("is-gone");
    return begin(false);
  }
  show("none");
  // A first visit: the age gate is a question, so it never waits on the street. The cold open plays over black,
  // the gate paints, and only then does the street start building behind it (a slow GPU or software WebGL can
  // hold the main thread for a long time while it builds). A returning player's street builds at once.
  const firstVisit = !prefs.adult && !(frontStage && shot);
  // Plan item 24: the street starts building at once on a first visit too, so the cold-open line fades up over
  // the rain and the gate asks its question in front of Cath under her umbrella. Shaders now compile in the
  // background (render/warm.ts), so the gate stays responsive while it builds. Automated runs keep the old order:
  // software WebGL there still holds the main thread for seconds, and the gate's keys would wait behind it.
  if (!firstVisit || !navigator.webdriver) startScene();
  await fontsReady();
  if (firstVisit) {
    await coldOpen(true);
    const gate = openGate();
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120))));
    // Plan item 40: the front door is ready once the gate has painted (it waited on the answer, so a run on a
    // fresh profile never saw it); it stays true through the title that follows.
    hook.ready = true;
    startScene();
    void sceneReady.then((s) => {
      if (!$("screen-gate").hidden) {
        s?.setFraming(gateFraming());
        s?.setLift(1);
      }
    });
    await gate;
    openTitle(true);
    hook.ready = true;
    return;
  }
  if (frontStage && shot) {
    // A stage: the scene at a fixed time, no cold open.
    const s = await sceneReady;
    skipBoot();
    const t = Number(params.get("t") ?? 8);
    if (frontStage === "gate") {
      void openGate();
      $("screen-gate").classList.add("is-in");
    } else openTitle(false);
    s?.setTime(t);
    if (frontStage === "credits") await openCredits();
    if (frontStage === "settings") openSettings();
    if (frontStage?.startsWith("loading")) stageLoading(frontStage);
    if (frontStage === "areatitle") await begin(true);
    if (frontStage === "classpick") {
      // A still: the title is gone at once (its 'is-leaving' fade showed the menu under the list in a shot).
      $("screen-title").classList.add("is-leaving");
      $("screen-title").hidden = true;
      const cls = (params.get("class") as ClassId | null) ?? "ghost";
      s?.wardrobe(cls, true);
      openClassPick(document.body, () => undefined, cls, { still: true });
      stagePick();
      s?.wardrobe(cls, true);
    }
    hook.ready = true;
    return;
  }
  await coldOpen(false);
  openTitle(true);
  hook.ready = true;
}
void boot();
