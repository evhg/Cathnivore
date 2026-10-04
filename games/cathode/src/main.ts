// CATHODE's front door: the 18+ gate, the title, settings, and the lazy hand-off to the game (three.js and
// everything heavy load only after "Begin"). Design: docs/design/cathode.md.

import "../../../shared/cath/cath.css";
import "./styles.css";
import { cathSvg } from "../../../shared/cath/cath";
import { loadPrefs, resolveQuality, savePrefs, type Intensity, type QualityChoice } from "./prefs";
import { openClassPick } from "./ui/classpick";
import { Progress } from "./game/progress";
import { newCharacter } from "./sim/character";
import type { ClassId } from "./sim/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const prefs = loadPrefs();
const params = new URLSearchParams(location.search);

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
  $("title-cath").innerHTML = cathSvg({ expression: "determined", framing: "half", outfit: "trench" });
  show("screen-title");
  $<HTMLButtonElement>("btn-begin").focus();
}

$<HTMLButtonElement>("btn-begin").addEventListener("click", () => void begin());

const dlg = $<HTMLDialogElement>("dlg-settings");
$<HTMLButtonElement>("btn-settings").addEventListener("click", () => {
  setChecked("quality", prefs.quality);
  setChecked("intensity2", prefs.intensity);
  dlg.showModal();
});
$<HTMLButtonElement>("settings-close").addEventListener("click", () => {
  prefs.quality = (checked("quality") as QualityChoice | undefined) ?? "auto";
  prefs.intensity = (checked("intensity2") as Intensity | undefined) ?? prefs.intensity;
  savePrefs(prefs);
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
  const loading = $("loading");
  const fill = $("loading-fill");
  const line = $("loading-line");
  loading.hidden = false;
  const progress = (share: number, label: string) => {
    fill.style.setProperty("--p", `${Math.round(share * 100)}%`);
    line.textContent = label;
  };
  const { startSession } = await import("./game/session");
  await startSession({
    canvas: $<HTMLCanvasElement>("view"),
    hud: $("hud"),
    touch: $("touch"),
    quality: resolveQuality(prefs.quality),
    intensity: prefs.intensity,
    shot: params.has("shot"),
    onProgress: progress,
    onExit: () => openTitle(),
  });
  loading.hidden = true;
}

if (!prefs.adult) show("screen-gate");
else if (params.has("play")) void begin();
else openTitle();
