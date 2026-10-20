// CATHODE's front door (C13, docs/design/cathode-combat.md S9): the cold open, the 18+ gate, the title over the
// live street (render/frontscene.ts), settings and credits, and the push into the game. three.js and the street
// load behind the cold open; the game's own code loads during the push. Design: docs/design/cathode.md.

// The 2D Cath art (character sheet, level-up) needs its stylesheet; the front door itself has no 2D Cath (S9.1).
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
import { canStartNewGamePlus, startNewGamePlus } from "./sim/newgameplus";
import { newCharacter } from "./sim/character";
import { SAVE_KEY } from "./sim/save";
import type { ClassId } from "./sim/types";
import type { World } from "./render/types";
import type { FrontScene } from "./render/frontscene";
import { bindMenu, menuKey, type MenuBinding } from "./ui/menu";
import { areaTitle, COLD_OPEN_LINE, frontSet, listRows, slotHint, titleSubtitle } from "./ui/frontcopy";
import { FrontAudio } from "./ui/frontaudio";
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

// ?front=gate|title|areatitle&shot&t=30&focus=continue: the screenshot stages (scripts/cathode-feel-shots.mjs).
const frontStage = params.get("front");
const shot = params.has("shot");
const audio = new FrontAudio(prefs.volume);
const still = reducedMotion();

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
function startScene(): void {
  if (!webgl2()) return;
  const rs = Math.max(0.25, Math.min(1, Number(params.get("rs") ?? 1) || 1));
  sceneReady = import("./render/frontscene")
    .then(({ openFrontScene }) =>
      openFrontScene($<HTMLCanvasElement>("view"), {
        quality: quality(),
        intensity: prefs.intensity,
        shot,
        still,
        renderScale: rs,
        set: frontSet(Progress.load()?.jobsDone ?? []),
      }),
    )
    .then((s) => {
      scene = s;
      // Leaving the page (or a bfcache eviction): free the street's GPU memory and its context now, not at GC.
      addEventListener("pagehide", (e) => {
        if (e.persisted || scene !== s) return;
        scene = null;
        s.dispose();
        ($<HTMLCanvasElement>("view").getContext("webgl2") as WebGL2RenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
      });
      $("front-fallback").classList.add("is-off");
      $("front-grain").classList.add("is-baked");
      return s;
    })
    .catch((e: unknown) => {
      console.warn("front scene unavailable", e);
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
  co.classList.remove("is-line", "is-up", "is-out");
  removeEventListener("keydown", onKey);
  removeEventListener("pointerdown", onKey);
}

// ---- the gate (S9.3) ----
/** On a phone held sideways the gate plate takes the left 55%: Cath moves to 80% of the width so she stays in view. */
const gateFraming = () => (innerHeight <= 520 && innerWidth > innerHeight ? 0.62 : 0.42);
function openGate(): Promise<void> {
  show("screen-gate");
  scene?.setFraming(gateFraming());
  void sceneReady.then((s) => {
    if (!$("screen-gate").hidden) s?.setFraming(gateFraming());
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
        gate.classList.remove("is-in");
        plate.classList.remove("is-wiping");
        resolve();
      }, still ? 0 : 460);
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
    district = localStorage.getItem("cathode.district") ?? undefined;
  } catch {
    district = undefined;
  }
  $("menu-hint").textContent = slotHint(id, { hasSave: hasSave(), jobsDone: done, district, ngPlus: hasSave() && canStartNewGamePlus(done), armed: armed && id === "new" });
}

function fillTitle(): void {
  const done = jobs();
  $("title-sub").textContent = titleSubtitle(done);
  const list = $("the-list");
  list.replaceChildren();
  for (const r of listRows(done)) {
    const li = el("li", r.done ? "is-done" : r.next ? "is-next" : r.redacted ? "is-redacted" : "", list, r.name);
    if (r.done) li.setAttribute("aria-label", `${r.name}, dealt with`);
    if (r.redacted) li.setAttribute("aria-label", "A name you haven't reached");
  }
  $<HTMLButtonElement>("btn-continue").disabled = !hasSave();
  const ng = hasSave() && canStartNewGamePlus(done);
  $("btn-continue").querySelector(".menu-label")!.textContent = ng ? "New Game+" : "Continue";
}

function openTitle(drawLogo: boolean): void {
  fillTitle();
  show("screen-title");
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
    p.jobsDone = startNewGamePlus(p.jobsDone);
    p.save();
  }
  void begin(true);
}

// ---- credits: who made it, no story (the ending roll stays for the ending) ----
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
    const cls = await new Promise<ClassId | null>((resolve) => {
      const h = openClassPick(document.body, (c) => {
        h.close();
        resolve(c);
      });
      // Escape from the case file goes back to the title.
      const onKey = (e: KeyboardEvent) => {
        if (menuKey(e.key) !== "back" || e.key === "Backspace") return;
        removeEventListener("keydown", onKey, true);
        h.close();
        resolve(null);
      };
      addEventListener("keydown", onKey, true);
    });
    if (!cls) {
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
  try {
    if (!district && !shot) district = zones.resumeDistrict(localStorage.getItem(zones.LAST_DISTRICT_KEY), new Progress().jobsDone);
    localStorage.setItem(zones.LAST_DISTRICT_KEY, district ?? "market");
  } catch {
    // Private mode: no resume.
  }
  const sessionMod = import("./game/session");
  const fade = $("front-fade");
  const s = fromTitle ? scene : null;
  const sameWorld = !!s && (district ?? "market") === "market";
  let world: World | undefined;
  if (fromTitle) {
    // The UI fades over 400 ms while the camera flies past her into the street; the swell carries it.
    $("screen-title").classList.add("is-leaving");
    audio.swell(1.6);
    if (s) {
      const pushing = s.push(1.6);
      await sleep(still ? 300 : 1350);
      fade.style.setProperty("--fade-ms", "250ms");
      fade.classList.add("is-black");
      await pushing;
      await sleep(still ? 0 : 200);
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
  const loading = $("loading");
  const fill = $("loading-fill");
  const line = $("loading-line");
  if (!world) {
    loading.hidden = false;
    fade.classList.remove("is-black");
  }
  loading.dataset.district = district ?? "market";
  line.textContent = zones.loadingFlavour(district);
  $("loading-eyebrow").textContent = zones.loadingTitle(district);
  const progress = (share: number, label: string) => {
    fill.style.setProperty("--p", `${Math.round(share * 100)}%`);
    line.textContent = label;
  };
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
  });
  loading.hidden = true;
  audio.close();
  $("front-fallback").classList.add("is-off");
  // 300 ms up from black into first person, then the area title.
  fade.style.setProperty("--fade-ms", "300ms");
  fade.classList.remove("is-black");
  showAreaTitle(district);
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
  if (!(frontStage === "areatitle" && shot))
    setTimeout(() => {
      box.hidden = true;
      root.classList.remove("hud-banner-on");
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
    $("build-ver").textContent = v?.commit && v.commit !== "unknown" ? `BUILD ${v.commit.slice(0, 7).toUpperCase()}` : "BUILD DEV";
  })
  .catch(() => ($("build-ver").textContent = "BUILD DEV"));

// The screenshot hook: the stages wait on `ready`.
const hook = {
  ready: false,
  ticks: 0,
  scene: () => scene,
  stage: frontStage,
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
  if (turntable) {
    show("screen-game");
    $("hud").hidden = true;
    $("front-bars").classList.add("is-gone");
    $("front-grain").classList.add("is-off");
    const { openTurntable } = await import("./game/turntable");
    openTurntable($<HTMLCanvasElement>("view"));
    return;
  }
  if (params.has("play") && (prefs.adult || shotBypass)) {
    $("front-bars").classList.add("is-gone");
    return begin(false);
  }
  show("none");
  startScene();
  await fontsReady();
  if (frontStage && shot) {
    // A stage: the scene at a fixed time, no cold open.
    const s = await sceneReady;
    const t = Number(params.get("t") ?? 8);
    if (frontStage === "gate") {
      void openGate();
      $("screen-gate").classList.add("is-in");
    } else openTitle(false);
    s?.setTime(t);
    if (frontStage === "credits") await openCredits();
    if (frontStage === "areatitle") await begin(true);
    hook.ready = true;
    return;
  }
  if (!prefs.adult) {
    await coldOpen(true);
    await openGate();
    openTitle(true);
  } else {
    await coldOpen(false);
    openTitle(true);
  }
  hook.ready = true;
}
void boot();
