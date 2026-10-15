// CATHODE's front door: the 18+ gate, the title, settings, and the lazy hand-off to the game (three.js and
// everything heavy load only after "Begin"). Design: docs/design/cathode.md.

import "../../../shared/cath/cath.css";
import "../../../shared/ui/base.css";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/hud.css";
import "./styles.css";
import { cathSvg } from "../../../shared/cath/cath";
import { applyMotionPref, loadPrefs, resolveQuality, savePrefs, type Intensity, type QualityChoice } from "./prefs";
import { openClassPick } from "./ui/classpick";
import { Progress } from "./game/progress";
import { canStartNewGamePlus, ngPlusLap, startNewGamePlus } from "./sim/newgameplus";
import { newCharacter } from "./sim/character";
import type { ClassId } from "./sim/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const prefs = loadPrefs();
const params = new URLSearchParams(location.search);
// Reduce motion: html.reduce-motion from Settings, else from the system (and it follows a system change).
applyMotionPref(prefs);
try {
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => applyMotionPref(loadPrefs()));
} catch {
  // Very old Safari: the setting still applies on the next load.
}

function show(id: "screen-gate" | "screen-title" | "screen-game"): void {
  for (const s of document.querySelectorAll<HTMLElement>(".screen")) s.hidden = s.id !== id;
}

function checked(name: string): string | undefined {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

function setChecked(name: string, value: string): void {
  const el = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

// ---- the gate ----
$<HTMLButtonElement>("gate-yes").addEventListener("click", () => {
  prefs.adult = true;
  prefs.intensity = (checked("intensity") as Intensity | undefined) ?? "full";
  savePrefs(prefs);
  openTitle();
});

// ---- the title ----
function openTitle(): void {
  $("title-cath").innerHTML = cathSvg({ expression: "smirk", framing: "half", outfit: "trench" });
  show("screen-title");
  const ng = $<HTMLButtonElement>("btn-ngplus");
  const done = Progress.load()?.jobsDone ?? [];
  const lap = ngPlusLap(done);
  ng.hidden = !canStartNewGamePlus(done);
  ng.textContent = `New Game+ (lap ${lap + 2})`;
  $<HTMLButtonElement>("btn-begin").focus();
}

$<HTMLButtonElement>("btn-begin").addEventListener("click", () => void begin());
$<HTMLButtonElement>("btn-ngplus").addEventListener("click", () => {
  const p = new Progress();
  if (!canStartNewGamePlus(p.jobsDone)) return;
  p.jobsDone = startNewGamePlus(p.jobsDone);
  p.save();
  void begin();
});

const dlg = $<HTMLDialogElement>("dlg-settings");
$<HTMLButtonElement>("btn-settings").addEventListener("click", () => {
  setChecked("quality", prefs.quality);
  setChecked("intensity2", prefs.intensity);
  setChecked("motion", prefs.reduceMotion === null ? "auto" : prefs.reduceMotion ? "on" : "off");
  dlg.showModal();
});
$<HTMLButtonElement>("settings-close").addEventListener("click", () => {
  prefs.quality = (checked("quality") as QualityChoice | undefined) ?? "auto";
  prefs.intensity = (checked("intensity2") as Intensity | undefined) ?? prefs.intensity;
  const motion = checked("motion");
  prefs.reduceMotion = motion === "on" ? true : motion === "off" ? false : null;
  savePrefs(prefs);
  applyMotionPref(prefs);
  dlg.close();
});

// ---- the game ----
async function begin(): Promise<void> {
  // A new game starts with the case file: who walks back in?
  // (?class=ghost picks for tests and links; ?shot skips it for screenshots.)
  const given = params.get("class") as ClassId | null;
  if (!Progress.hasSave() && (given || params.has("shot"))) new Progress(given ?? "ghost").set(newCharacter(given ?? "ghost"));
  if (!Progress.hasSave()) {
    const cls = await new Promise<ClassId>((resolve) => {
      const h = openClassPick(document.body, (c) => {
        h.close();
        resolve(c);
      });
    });
    Progress.resetUnlocks();
    const p = new Progress(cls);
    p.set(newCharacter(cls));
  }
  show("screen-game");
  // Per-district save: Continue returns to the district last played (an explicit ?district= or ?shot wins).
  let district = params.get("district") ?? undefined;
  const { resumeDistrict, LAST_DISTRICT_KEY } = await import("./game/zones");
  try {
    if (!district && !params.has("shot")) district = resumeDistrict(localStorage.getItem(LAST_DISTRICT_KEY), new Progress().jobsDone);
    localStorage.setItem(LAST_DISTRICT_KEY, district ?? "market");
  } catch {
    // Private mode: no resume.
  }
  const loading = $("loading");
  const fill = $("loading-fill");
  const line = $("loading-line");
  loading.hidden = false;
  const { loadingTitle, loadingFlavour } = await import("./game/zones");
  loading.dataset.district = district ?? "market";
  line.textContent = loadingFlavour(district);
  $("loading-eyebrow").textContent = loadingTitle(district);
  const progress = (share: number, label: string) => {
    fill.style.setProperty("--p", `${Math.round(share * 100)}%`);
    line.textContent = label;
  };
  const { startSession } = await import("./game/session");
  await startSession({
    canvas: $<HTMLCanvasElement>("view"),
    hud: $("hud"),
    touch: $("touch"),
    // ?quality=phone|high|ultra overrides the setting (screenshot runs pick the phone profile).
    quality: resolveQuality((["phone", "high", "ultra"].includes(params.get("quality") ?? "") ? params.get("quality") : prefs.quality) as typeof prefs.quality),
    intensity: prefs.intensity,
    shot: params.has("shot"),
    district,
    onProgress: progress,
    onExit: () => openTitle(),
  });
  loading.hidden = true;
}

// ?play&shot is for screenshots: skip the gate for this visit only, without saving the 18+ answer.
const shotBypass = params.has("play") && params.has("shot");
// AAA UI M1: give the display and UI faces up to 600 ms before the first screen, so the wordmark doesn't
// visibly swap from the fallback. Never blocks longer than that.
function fontsReady(ms = 600): Promise<void> {
  const fonts = document.fonts;
  if (!fonts?.load) return Promise.resolve();
  const loads = Promise.all([fonts.load('560 64px "Cathode Display"'), fonts.load('500 16px "Cathode UI"')]).then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([loads, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

if (!prefs.adult && !shotBypass) {
  $("gate-cath").innerHTML = cathSvg({ expression: "smirk", framing: "half", outfit: "trench" });
  void fontsReady().then(() => show("screen-gate"));
}
else if (params.has("play")) void begin();
else void fontsReady().then(openTitle);
