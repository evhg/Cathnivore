import "./styles.css";
import "../../../shared/cath/cath.css";
import { cathSvg, type CathExpression } from "../../../shared/cath/cath";
import {
  ABILITIES,
  AUTO_AFTER_CASTS,
  betweenRounds,
  heroCovered,
  towerActive,
  type Ability,
  ENEMIES,
  MEGAS,
  NEIGHBOURS_SECS,
  PIE_DAMAGE,
  PIE_STUN,
  RALLY_SECS,
  RANKS,
  megaFor,
  megasUnlocked,
  merge,
  mergeOptions,
  pieCooldown,
  rankOf,
  PIE_FIRST_LEVEL,
  SPECIALISATIONS,
  SPEC_FIRST_LEVEL,
  STEP,
  TARGET_MODES,
  TOWERS,
  TOWER_VS,
  TWISTS,
  canCallEarly,
  drainEvents,
  earlyBonus,
  isBig,
  isHeavy,
  enemyClass,
  isPlot,
  laneCellsOf,
  pieRadius,
  pieUnlocked,
  place,
  sellValue,
  sendWave,
  specCost,
  specsUnlocked,
  stars as starsOf,
  stepGame,
  neighboursUnlocked,
  rallyUnlocked,
  NEIGHBOURS_COOLDOWN,
  RALLY_COOLDOWN,
  NEIGHBOURS_FIRST_LEVEL,
  RALLY_FIRST_LEVEL,
  towerAt,
  towerCost,
  towerStats,
  plotKind,
  upgrade,
  upgradeCost,
  type EnemyClass,
  type TowerKind,
  type EnemyKind,
  type Game,
  type GameEvent,
  type Level,
  type StoryLine,
  type TargetMode,
  type Tower,
  NO_PERKS,
} from "./engine";
import { LEVELS } from "./levels";
import { Renderer } from "./render";
import type { Renderer3D } from "./render3d";

/** The 3D renderer and three.js load as their own chunk: the map screen doesn't need them, so the first
 * load is a third the size. They're prefetched while the map is up, and awaited before the first level. */
type R3D = typeof import("./render3d");
let r3d: R3D | null = null;
let r3dLoading: Promise<R3D | null> | null = null;
/** Resolves with the module, or null if it couldn't load (offline): the game then falls back to 2D. */
function loadR3D(): Promise<R3D | null> {
  r3dLoading ??= import("./render3d").then(
    (m) => (r3d = m),
    () => null,
  );
  return r3dLoading;
}
/** True once the 3D chunk has loaded or failed: either way, levels stop waiting for it. */
let r3dSettled = false;
const is3D = (r: unknown): r is Renderer3D => !!r3d && r instanceof r3d.Renderer3D;
function webglSupported(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
import { enemyIcon, img, towerIcon } from "./icons";
import * as sfx from "./sound";
import { haptic, setHaptics } from "./haptics";
import {
  KEEP_GOING_FROM,
  autoEarned,
  autoOn,
  fastestSpeed,
  keepGoingFor,
  recordCast,
  setAuto,
  setKeepGoing,
  PERKS,
  buyPerk,
  freeStars,
  isUnlocked,
  load,
  nextCost,
  perksOf,
  recordStars,
  recordHeroic,
  recordEndless,
  recordDaily,
  refundAll,
  save,
} from "./store";
import { dailyLevel, dailyScore, dayOf, shareCard } from "./daily";
import { endlessLevel, weekOf } from "./endless";
import { Player, Recorder, applyAction, decodeReplay, encodeReplay, startGame, type Action, type Replay, type Setup } from "./replay";
import { ROSETTES, newRosettes } from "./rosettes";
import { setupAlmanac } from "./almanac";
import { OUTFITS, outfitFor, wear, wornOutfit } from "./wardrobe";
import { actScene, renderMap } from "./map";
import { castSvg, type CastMember } from "./cast";
import { FINALE } from "./story/acts6to10";
import {
  ATTRS,
  ATTR_CAP,
  TALENTS,
  emptyCath,
  freePoints,
  levelOf,
  pickTalent,
  raise,
  respec,
  talentsWaiting,
  xpOf,
} from "./cath";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const ui = {
  select: $<HTMLElement>("screen-select"),
  play: $<HTMLElement>("screen-play"),
  levels: $<HTMLOListElement>("levels"),
  hostFace: $<HTMLElement>("host-face"),
  hostLine: $<HTMLElement>("host-line"),
  canvas: $<HTMLCanvasElement>("canvas"),
  stage: $<HTMLElement>("stage"),
  panel: $<HTMLElement>("panel"),
  hudTitle: $<HTMLElement>("hud-title"),
  hudPlace: $<HTMLElement>("hud-place"),
  hudGoodwill: $<HTMLElement>("hud-goodwill"),
  hudMarks: $<HTMLElement>("hud-marks"),
  hudWave: $<HTMLElement>("hud-wave"),
  btnLevels: $<HTMLButtonElement>("btn-levels"),
  btnSend: $<HTMLButtonElement>("btn-send"),
  btnPie: $<HTMLButtonElement>("btn-pie"),
  btnNeighbours: $<HTMLButtonElement>("btn-neighbours"),
  neighboursRing: $<HTMLElement>("neighbours-ring"),
  neighboursLabel: $<HTMLElement>("neighbours-label"),
  btnRally: $<HTMLButtonElement>("btn-rally"),
  rallyRing: $<HTMLElement>("rally-ring"),
  rallyLabel: $<HTMLElement>("rally-label"),
  pieRing: $<HTMLElement>("pie-ring"),
  pieLabel: $<HTMLElement>("pie-label"),
  btnHero: $<HTMLButtonElement>("btn-hero"),
  btnAuto: $<HTMLButtonElement>("btn-auto"),
  heroFace: $<HTMLElement>("hero-face"),
  heroHp: $<HTMLElement>("hero-hp"),
  btnSpeed: $<HTMLButtonElement>("btn-speed"),
  btnPause: $<HTMLButtonElement>("btn-pause"),
  btnSound: $<HTMLButtonElement>("btn-sound"),
  banner: $<HTMLElement>("banner"),
  toast: $<HTMLElement>("toast"),
  bubble: $<HTMLElement>("bubble"),
  bubbleFace: $<HTMLElement>("bubble-face"),
  bubbleText: $<HTMLElement>("bubble-text"),
  intro: $<HTMLElement>("intro"),
  pausedNote: $<HTMLElement>("paused-note"),
  chooseChip: $<HTMLElement>("choose-chip"),
  autoBadge: {
    pie: $<HTMLElement>("pie-auto"),
    neighbours: $<HTMLElement>("neighbours-auto"),
    rally: $<HTMLElement>("rally-auto"),
  } as Record<Ability, HTMLElement>,
  announce: $<HTMLElement>("announce"),
  dlgStory: $<HTMLDialogElement>("dlg-story"),
  storyBg: $<HTMLElement>("story-bg"),
  storyLeft: $<HTMLElement>("story-left"),
  storyRight: $<HTMLElement>("story-right"),
  storySpeech: $<HTMLElement>("story-speech"),
  storyFull: $<HTMLElement>("story-full"),
  storyTyped: $<HTMLElement>("story-typed"),
  storySkip: $<HTMLButtonElement>("story-skip"),
  storyPlace: $<HTMLElement>("story-place"),
  storyWho: $<HTMLElement>("story-who"),
  storyText: $<HTMLElement>("story-text"),
  storyNext: $<HTMLButtonElement>("story-next"),
  dlgResult: $<HTMLDialogElement>("dlg-result"),
  resultCath: $<HTMLElement>("result-cath"),
  resultEyebrow: $<HTMLElement>("result-eyebrow"),
  resultTitle: $<HTMLElement>("result-title"),
  resultStars: $<HTMLElement>("result-stars"),
  resultStats: $<HTMLElement>("result-stats"),
  resultNote: $<HTMLElement>("result-note"),
  resultPrimary: $<HTMLButtonElement>("result-primary"),
  resultSecondary: $<HTMLButtonElement>("result-secondary"),
  btnBank: $<HTMLButtonElement>("btn-bank"),
  btnDaily: $<HTMLButtonElement>("btn-daily"),
  resultWatch: $<HTMLButtonElement>("result-watch"),
  resultShare: $<HTMLButtonElement>("result-share"),
  replayBar: $<HTMLElement>("replay-bar"),
  replayFill: $<HTMLElement>("replay-fill"),
  replayExit: $<HTMLButtonElement>("replay-exit"),
  btnHeroic: $<HTMLButtonElement>("btn-heroic"),
  bankStars: $<HTMLElement>("bank-stars"),
  dlgBank: $<HTMLDialogElement>("dlg-bank"),
  bankFree: $<HTMLElement>("bank-free"),
  perks: $<HTMLUListElement>("perks"),
  rosettes: $<HTMLUListElement>("rosettes"),
  rosetteCount: $<HTMLElement>("rosette-count"),
  bankClose: $<HTMLButtonElement>("bank-close"),
  bankRefund: $<HTMLButtonElement>("bank-refund"),
  btnCath: $<HTMLButtonElement>("btn-cath"),
  cathBtnFace: $<HTMLElement>("cath-btn-face"),
  cathLevel: $<HTMLElement>("cath-level"),
  cathDot: $<HTMLElement>("cath-dot"),
  dlgCath: $<HTMLDialogElement>("dlg-cath"),
  cathPortrait: $<HTMLElement>("cath-portrait"),
  cathTitle: $<HTMLElement>("cath-title"),
  cathXp: $<HTMLElement>("cath-xp"),
  cathXpFill: $<HTMLElement>("cath-xp-fill"),
  cathAttrs: $<HTMLUListElement>("cath-attrs"),
  cathTalents: $<HTMLElement>("cath-talents"),
  cathClose: $<HTMLButtonElement>("cath-close"),
  cathRespec: $<HTMLButtonElement>("cath-respec"),
  tooltip: $<HTMLElement>("tooltip"),
  duel: $<HTMLElement>("duel"),
  duelTitle: $<HTMLElement>("duel-title"),
  duelRounds: $<HTMLElement>("duel-rounds"),
  duelMark: $<HTMLElement>("duel-mark"),
  duelStrike: $<HTMLButtonElement>("duel-strike"),
};

const NAMES: Record<StoryLine["who"], string> = {
  cath: "Cath",
  mara: "Mara",
  bea: "Bea",
  tomas: "Tomas",
  sol: "Sol",
  ines: "Ines",
  pip: "Pip Talbot",
  pell: "Graham Pell",
  crisp: "Julian Crisp",
  vane: "Dr Vane",
  narrator: "Marrow",
};
/** Cath's illustrated outfit, from her wardrobe (wardrobe.ts). */
const art = () => wornOutfit().art;
const cath = (expression: CathExpression) => cathSvg({ framing: "face", expression, animate: true, outfit: art() });

const data = load();
wear(outfitFor(data));
ui.hostFace.innerHTML = cath("smirk");
ui.heroFace.innerHTML = cathSvg({ framing: "face", expression: "determined", outfit: art() });

let game: Game | null = null;
/** 3D when WebGL is there (and `?2d` isn't asked for); the 2D canvas renderer otherwise. */
let renderer: Renderer | Renderer3D | null = null;
const USE_3D = !new URLSearchParams(location.search).has("2d") && webglSupported();
if (USE_3D) {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(() => void loadR3D());
  else window.setTimeout(() => void loadR3D(), 1500);
}
setHaptics(!sfx.isMuted());
let selected: { col: number; row: number } | null = null;
/**
 * Keep Going (Hedgerow 2 M1): the next round starts by itself 2 s after a clear. Off on levels 1-5 while
 * new players learn the Go-and-stack rhythm; after that on by default, and the choice is remembered.
 */
const AUTO_SECS = 2;
let autoNext = false;
let autoLeft = AUTO_SECS;
// The old Auto switch's "off" carries over as Keep Going off.
try {
  if (localStorage.getItem("hedgerow:auto") === "off" && data.settings?.keepGoing === undefined) {
    setKeepGoing(data, false);
    save(data);
  }
} catch {
  /* storage blocked */
}

/** x1 and x3; x5 opens on a level once it has been won. */
let speed = (() => {
  try {
    const v = Number(localStorage.getItem("hedgerow:speed"));
    return v === 3 || v === 5 ? v : v === 2 ? 3 : 1;
  } catch {
    return 1;
  }
})();
let maxSpeed: 3 | 5 = 3;
/** Cath is waiting to be given a new post (between rounds: tap her, then tap the field). */
let posting = false;
/** The tip Cath's bubble is showing ("" when hidden). */
let bubbleTip = "";
/** The last wave that was stacked on early (0 = none this level): a leak soon after names the stacking. */
let stackedWave = 0;
/** The round whose first leak has already been reported, and when the leak slow-motion ends. */
let leakReported = 0;
let slowUntil = 0;
/** Which abilities were ready last frame (a tick under the thumb when one comes back). */
const wasReady: Record<Ability, boolean> = { pie: false, neighbours: false, rally: false };
let paused = false;
let aiming = false;
let last = 0;
let acc = 0;
let raf = 0;
let finished = false;
let panelKey = "";
let earlyCalls = 0;
let startPerkRanks = 0;
let bubbleTimer = 0;
let bannerTimer = 0;

function say(text: string): void {
  ui.announce.textContent = text;
}

// ---- level select ----

function renderLevels(): void {
  ui.bankStars.textContent = String(freeStars(data));
  $<HTMLElement>("daily-new").hidden = data.daily?.[String(dayOf(Date.now()))] !== undefined;
  renderCathButton();
  renderMap(ui.levels, LEVELS, data, (lv) => openLevel(lv), (act) => { dailyDay = null; const week = weekOf(Date.now()); endlessArgs = { act, week }; startLevel(endlessLevel(act, week), false); });
}

let typing = 0;
const REDUCED = (() => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
})();

/** A story beat as a graphic-novel panel: the act's backdrop, Cath on the left, whoever she's talking to on the right. */
function showStory(lines: StoryLine[], place: string, done: () => void, act = 1): void {
  if (lines.length === 0) {
    done();
    return;
  }
  let i = 0;
  // The right-hand actor is whoever Cath is talking to at the moment (scenes can have two or three people).
  let other = lines.find((l) => l.who !== "cath" && l.who !== "narrator")?.who as CastMember | undefined;
  ui.storyBg.innerHTML = actScene(act);
  const showOther = () => {
    ui.storyRight.innerHTML = other ? castSvg(other) : "";
    ui.storyRight.hidden = !other;
    ui.storyRight.dataset.who = other ?? "";
  };
  showOther();
  const finishTyping = () => {
    clearInterval(typing);
    typing = 0;
    ui.storyTyped.textContent = ui.storyFull.textContent;
  };
  const show = () => {
    const line = lines[i]!;
    if (line.who !== "cath" && line.who !== "narrator" && line.who !== other) {
      other = line.who as CastMember;
      showOther();
    }
    ui.storyPlace.textContent = place;
    ui.storyWho.textContent = NAMES[line.who];
    ui.storyFull.textContent = line.text;
    ui.storyLeft.innerHTML = cathSvg({ framing: "bust", expression: line.who === "cath" ? (line.expression ?? "smirk") : "smirk", animate: true, outfit: art() });
    ui.storyLeft.classList.toggle("speaking", line.who === "cath");
    ui.storyRight.classList.toggle("speaking", line.who === other);
    ui.storySpeech.dataset.who = line.who;
    ui.storySpeech.classList.toggle("from-right", line.who !== "cath" && line.who !== "narrator");
    ui.storySpeech.classList.toggle("caption", line.who === "narrator");
    ui.storyNext.textContent = i === lines.length - 1 ? "Let's go" : "Next";
    clearInterval(typing);
    if (REDUCED) {
      ui.storyTyped.textContent = line.text;
      return;
    }
    let n = 0;
    ui.storyTyped.textContent = "";
    typing = window.setInterval(() => {
      n += 2;
      ui.storyTyped.textContent = line.text.slice(0, n);
      if (n >= line.text.length) finishTyping();
    }, 22);
  };
  // One tap per line (Hedgerow 2 M1): Next always moves on, even mid-typing.
  ui.storyNext.onclick = () => {
    finishTyping();
    i += 1;
    if (i >= lines.length) {
      ui.dlgStory.close();
      done();
    } else show();
  };
  ui.storySkip.onclick = () => {
    finishTyping();
    ui.dlgStory.close();
    done();
  };
  show();
  if (!ui.dlgStory.open) ui.dlgStory.showModal();
}

const actOf = (lv: Level) => Math.floor((lv.id - 1) / 10) + 1;

function openLevel(lv: Level): void {
  dailyDay = null;
  const start = () => startLevel(lv);
  if (!data.seenBefore[String(lv.id)]) {
    showStory(
      lv.before,
      lv.place,
      () => {
        data.seenBefore[String(lv.id)] = true;
        save(data);
        start();
      },
      actOf(lv),
    );
  } else start();
}

/** `?sandbox=1`: unlimited Marks, for screenshots and testing late waves (sessions use it with `npm run shots`). */
const SANDBOX = new URLSearchParams(location.search).has("sandbox");
// Sandbox only: a handle for screenshot scripts to set up a field (towers, merges) without clicking.
if (SANDBOX)
  (window as unknown as { hedgerow: object }).hedgerow = { game: () => game, place, upgrade, merge, sendWave };
// Sandbox only: `?sandbox=1&level=N` jumps straight into level N (screenshots of each act's biome).
if (SANDBOX) {
  const jump = Number(new URLSearchParams(location.search).get("level"));
  const target = LEVELS.find((l) => l.id === jump);
  if (target) setTimeout(() => startLevel(target, false), 300);
}

/** The Heroic toggle on the level map: the next level starts with one Goodwill and no pies. */
let heroicMode = false;
ui.btnHeroic.addEventListener("click", () => {
  heroicMode = !heroicMode;
  ui.btnHeroic.setAttribute("aria-pressed", String(heroicMode));
  ui.btnHeroic.classList.toggle("on", heroicMode);
});

/** Set while a daily challenge is on: the day number. Perks are off so scores compare. */
let dailyDay: number | null = null;
ui.btnDaily.addEventListener("click", () => {
  const day = dayOf(Date.now());
  dailyDay = day;
  startLevel(dailyLevel(day), false);
});

/** Endless runs: which act and week, so a replay can rebuild the field. */
let endlessArgs: { act: number; week: number } | null = null;
/** The live run's recorder (null in the sandbox), or the replay being watched. */
let recorder: Recorder | null = null;
let player: Player | null = null;
let lastReplay: Replay | null = null;

function levelFor(setup: Setup): Level | undefined {
  if (setup.mode === "daily") return dailyLevel(setup.id);
  if (setup.mode === "endless") return endlessLevel(setup.id, setup.week ?? 0);
  return LEVELS.find((l) => l.id === setup.id);
}

/** Every input goes through here: applied, and recorded for the replay. Nothing is accepted while watching. */
function doAct(a: Action): boolean {
  if (!game || player) return false;
  const g = game;
  return act(() => (recorder ? recorder.act(g, a) : applyAction(g, a)));
}

function startLevel(lv: Level, heroic = heroicMode): void {
  // First level of the visit: wait for the 3D chunk (usually already prefetched), then start.
  if (USE_3D && !r3d && !r3dSettled) {
    void loadR3D().then(() => {
      r3dSettled = true;
      startLevel(lv, heroic);
    });
    return;
  }
  const setup: Setup = {
    mode: dailyDay !== null ? "daily" : lv.endless ? "endless" : "level",
    id: dailyDay ?? (lv.endless ? (endlessArgs?.act ?? 0) : lv.id),
    ...(lv.endless ? { week: endlessArgs?.week ?? 0 } : {}),
    heroic: heroic && !lv.endless,
    perks: dailyDay !== null ? NO_PERKS : perksOf(data),
  };
  // One-on-one boss duels are a player's moment (on in startGame); the tuner and sims never see them.
  game = startGame(lv, setup);
  recorder = SANDBOX ? null : new Recorder(setup);
  player = null;
  ui.replayBar.hidden = true;
  document.documentElement.classList.remove("watching");
  if (SANDBOX) {
    game.marks = 99999;
    game.goodwill = game.maxGoodwill = 999;
  }
  selected = null;
  finished = false;
  paused = false;
  aiming = false;
  posting = false;
  leakReported = 0;
  slowUntil = 0;
  panelKey = "";
  earlyCalls = 0;
  stackedWave = 0;
  const story = !lv.endless && dailyDay === null;
  autoNext = keepGoingFor(data, story ? lv.id : KEEP_GOING_FROM);
  autoLeft = AUTO_SECS;
  ui.btnAuto.hidden = story && lv.id < KEEP_GOING_FROM;
  maxSpeed = story ? fastestSpeed(data, lv.id) : 3;
  if (speed > maxSpeed) speed = maxSpeed;
  // Abilities the player has put on Auto (earned by casting each by hand three times).
  if (!SANDBOX) for (const a of ABILITIES) if (autoOn(data, a)) doAct({ t: "auto", ability: a, on: true });
  for (const a of ABILITIES) wasReady[a] = false;
  startPerkRanks = Object.values(data.bank).reduce((a, b) => a + b, 0);
  ui.select.hidden = true;
  ui.play.hidden = false;
  ui.hudTitle.textContent = `${game.heroic ? "◆ " : ""}${lv.endless ? "∞" : `${lv.id}.`} ${lv.name}`;
  ui.hudPlace.textContent = lv.place;
  renderer ??= USE_3D && r3d ? new r3d.Renderer3D(ui.canvas, $<HTMLElement>("fx-layer")) : new Renderer(ui.canvas);
  document.documentElement.classList.toggle("hedgerow-3d", is3D(renderer));
  renderer.reset();
  renderer.selected = null;
  renderer.heroSelected = false;
  renderer.aim = null;
  renderer.cursor = { col: 0, row: 0 };
  hideBubble();
  ui.intro.hidden = true;
  syncControls();
  renderer.resize(game);
  updateHud();
  renderPanel(true);
  cancelAnimationFrame(raf);
  last = performance.now();
  acc = 0;
  raf = requestAnimationFrame(frame);
  sfx.startMusic(Math.floor((lv.id - 1) / 10));
  sfx.setIntensity(0);
  levelTips(lv);
}

function leaveLevel(): void {
  dailyDay = null;
  player = null;
  ui.replayBar.hidden = true;
  document.documentElement.classList.remove("watching");
  cancelAnimationFrame(raf);
  sfx.stopMusic();
  game = null;
  ui.play.hidden = true;
  ui.select.hidden = false;
  hideBubble();
  renderLevels();
}

// ---- Cath's tips ----

function tip(id: string, text: string, expression: CathExpression = "smirk", force = false): void {
  if (!force && data.tips[id]) return;
  data.tips[id] = true;
  save(data);
  bubbleTip = id;
  ui.bubbleFace.innerHTML = cath(expression);
  ui.bubbleText.textContent = text;
  ui.bubble.hidden = false;
  ui.bubble.classList.remove("pop");
  void ui.bubble.offsetWidth;
  ui.bubble.classList.add("pop");
  say(`Cath: ${text}`);
  clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(hideBubble, Math.max(4000, text.length * 70));
}

function hideBubble(): void {
  ui.bubble.hidden = true;
  bubbleTip = "";
}

function levelTips(lv: Level): void {
  // The level's twist, up front: it's what makes this level a different problem.
  if (lv.twists?.length)
    window.setTimeout(() => {
      if (game?.level.id !== lv.id) return;
      banner(lv.twists!.map((t) => TWISTS[t].name).join(" · "), lv.twists!.map((t) => TWISTS[t].rule).join(" "));
    }, 400);
  if (lv.id === 1)
    tip("build", "Tap a plot beside the lane to build. Hedges slow them down; scarecrows throw turnips.", "wink");
  else if (lv.id === 2)
    tip("hero", "I hold my post in the lane: two at a time, so your towers get a clean shot. Between waves, tap me, then tap where I should stand.", "determined");
  else if (lv.id === PIE_FIRST_LEVEL)
    tip("pie", "Pies are out of the oven. Tap the pie, then tap where it should land.", "delighted");
  else if (lv.id === NEIGHBOURS_FIRST_LEVEL)
    tip("neighbours-intro", "The neighbours are on side. In a wave, tap Neighbours (or press B) and three farmhands block the lane for ten seconds.", "delighted");
  else if (lv.id === RALLY_FIRST_LEVEL)
    tip("rally-intro", "Rally! Tap it (or press R) and every tower fires half as fast again for six seconds.", "determined");
  else if (lv.id === SPEC_FIRST_LEVEL)
    tip("spec", "Grow a tower to tier three and it can specialise. Two choices each, and they change everything.", "smirk");
}

// ---- HUD and controls ----

function syncControls(): void {
  ui.btnSpeed.textContent = `x${speed}`;
  ui.btnSpeed.classList.toggle("fast", speed > 1);
  ui.btnSpeed.setAttribute("aria-pressed", String(speed > 1));
  ui.btnSpeed.setAttribute("aria-label", `Game speed x${speed}`);
  ui.btnSound.setAttribute("aria-pressed", String(!sfx.isMuted()));
  ui.btnSound.classList.toggle("muted", sfx.isMuted());
  ui.btnSound.setAttribute("aria-label", sfx.isMuted() ? "Sound off" : "Sound on");
  ui.btnPause.setAttribute("aria-pressed", String(paused));
  ui.btnPause.setAttribute("aria-label", paused ? "Resume" : "Pause");
  ui.pausedNote.hidden = !paused;
  if (!game) return;
  const g = game;
  // Picking Cath up only lasts between rounds: once a round starts, the next tap is for the field again.
  if (posting && !betweenRounds(g)) {
    posting = false;
    if (renderer) renderer.heroSelected = false;
  }
  ui.btnPie.hidden = !pieUnlocked(g.level);
  ui.btnPie.disabled = g.phase !== "wave" || g.pieCd > 0 || g.enemies.length === 0;
  ui.btnPie.setAttribute("aria-pressed", String(aiming));
  ui.btnPie.classList.toggle("ready", !ui.btnPie.disabled);
  ui.pieLabel.textContent = g.pieCd > 0 ? `Pie ${Math.ceil(g.pieCd)}s` : aiming ? "Aim" : "Pie";
  const cdFrac = g.pieCd > 0 ? g.pieCd / 30 : 0;
  ui.pieRing.style.setProperty("--cd", String(Math.min(1, cdFrac)));
  ui.btnNeighbours.hidden = !neighboursUnlocked(g.level);
  ui.btnNeighbours.disabled = g.phase !== "wave" || g.neighboursCd > 0 || g.enemies.length === 0;
  ui.btnNeighbours.classList.toggle("ready", !ui.btnNeighbours.disabled);
  ui.neighboursLabel.textContent = g.neighboursCd > 0 ? `${Math.ceil(g.neighboursCd)}s` : "Neighbours";
  ui.neighboursRing.style.setProperty("--cd", String(g.neighboursCd / NEIGHBOURS_COOLDOWN));
  ui.btnRally.hidden = !rallyUnlocked(g.level);
  ui.btnRally.disabled = g.phase !== "wave" || g.rallyCd > 0 || g.towers.length === 0;
  ui.btnRally.classList.toggle("ready", !ui.btnRally.disabled);
  ui.rallyLabel.textContent = g.rallyLeft > 0 ? "Go!" : g.rallyCd > 0 ? `${Math.ceil(g.rallyCd)}s` : "Rally";
  ui.rallyRing.style.setProperty("--cd", String(g.rallyCd / RALLY_COOLDOWN));
  const buttons: Record<Ability, HTMLButtonElement> = { pie: ui.btnPie, neighbours: ui.btnNeighbours, rally: ui.btnRally };
  for (const a of ABILITIES) {
    const b = buttons[a];
    ui.autoBadge[a].hidden = !g.auto[a];
    b.classList.toggle("on-auto", g.auto[a]);
    const ready = !b.hidden && b.classList.contains("ready");
    if (ready && !wasReady[a] && g.phase === "wave" && !g.auto[a]) haptic.ready();
    wasReady[a] = ready;
  }
  const h = g.hero;
  ui.btnHero.classList.toggle("down", h.down > 0);
  ui.heroHp.style.setProperty("--hp", String(h.down > 0 ? 0 : h.hp / h.maxHp));
  ui.btnHero.setAttribute(
    "aria-label",
    h.down > 0
      ? `Cath is catching her breath, back in ${Math.ceil(h.down)} seconds`
      : `Cath, ${Math.round(h.hp)} of ${h.maxHp} health, ${h.kills} knockouts. She holds her post; move her between waves.`,
  );
  const more = g.wave < g.level.waves.length;
  const early = canCallEarly(g);
  ui.btnSend.disabled = !(g.phase === "build" && more) && !early;
  ui.btnSend.classList.toggle("early", early);
  ui.btnAuto.setAttribute("aria-pressed", String(autoNext));
  // Go, then (during a round) Next stacks the following round on top for the early bonus.
  const counting = g.phase === "build" && more && autoNext && g.wave > 0 && autoLeft > 0;
  ui.btnSend.textContent =
    g.phase === "build" && more
      ? counting
        ? `Wave ${g.wave + 1} in ${Math.ceil(autoLeft)}`
        : g.wave === 0
          ? "Go"
          : `Go: wave ${g.wave + 1}`
      : early
        ? `Next +${earlyBonus(g)}`
        : g.phase === "wave"
          ? `Wave ${g.wave} of ${g.level.waves.length}`
          : g.phase === "won" || g.phase === "lost"
            ? "Level over"
            : "Last wave";
  ui.btnSend.setAttribute(
    "aria-label",
    early ? `Stack wave ${g.wave + 1} on now for ${earlyBonus(g)} bonus Marks` : ui.btnSend.textContent ?? "",
  );
  // Choosing something (a plot, Cath's new post, a pie's aim) holds the Keep Going countdown: say so.
  ui.chooseChip.hidden = !(counting && (selected || posting || aiming) && !player);
}

const shown = { goodwill: -1, marks: -1, wave: "" };
function updateHud(): void {
  if (!game) return;
  const g = game;
  if (g.goodwill !== shown.goodwill) {
    if (shown.goodwill > g.goodwill) bump(ui.hudGoodwill.parentElement!, "hurt");
    ui.hudGoodwill.textContent = String(g.goodwill);
    shown.goodwill = g.goodwill;
  }
  if (g.marks !== shown.marks) {
    if (shown.marks >= 0 && g.marks > shown.marks) bump(ui.hudMarks.parentElement!, "gain");
    ui.hudMarks.textContent = String(g.marks);
    shown.marks = g.marks;
    refreshAffordability();
  }
  const w = `${g.wave}/${g.level.waves.length}`;
  if (w !== shown.wave) {
    ui.hudWave.textContent = w;
    shown.wave = w;
  }
  syncControls();
  renderPanel();
}

function bump(el: HTMLElement, cls: string): void {
  el.classList.remove("gain", "hurt");
  void el.offsetWidth;
  el.classList.add(cls);
}

// ---- the panel: build menu, tower card or wave preview ----

function refreshAffordability(): void {
  if (!game) return;
  for (const b of ui.panel.querySelectorAll<HTMLButtonElement>("button[data-cost]")) {
    const cost = Number(b.dataset.cost);
    const locked = b.dataset.locked === "1";
    b.disabled = locked || game.marks < cost;
  }
}

function waveSummary(groups: Level["waves"][number]): Array<{ kind: EnemyKind; count: number }> {
  const m = new Map<EnemyKind, number>();
  for (const g of groups) m.set(g.enemy, (m.get(g.enemy) ?? 0) + g.count);
  return [...m].map(([kind, count]) => ({ kind, count }));
}

function renderPanel(force = false): void {
  if (!game) return;
  const g = game;
  const sel = selected;
  const t = sel ? towerAt(g, sel.col, sel.row) : undefined;
  const key = [sel?.col, sel?.row, t?.id, t?.tier, t?.target, t?.mega, rankOf(t?.kills ?? 0), g.wave, g.phase, renderer?.heroSelected, aiming].join("|");
  if (!force && key === panelKey) return;
  panelKey = key;
  const p = ui.panel;
  p.innerHTML = "";
  p.className = "panel";
  if (renderer) renderer.preview = null;

  if (aiming) {
    p.append(line(`Tap where the pie should land. It freezes everything it hits for 3 seconds. Tap the pie again to aim at the front of the queue.`));
    return;
  }
  if (!sel) {
    wavePreview(p, g);
    return;
  }
  if (t) {
    towerCard(p, g, t);
    return;
  }
  if (!isPlot(g.level, sel.col, sel.row)) {
    p.append(line("That's the lane: towers go on the grass beside it. To move Cath, tap her between waves, then tap her new post."));
    return;
  }
  buildMenu(p, g, sel);
}

function line(text: string, cls = ""): HTMLParagraphElement {
  const el = document.createElement("p");
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

function wavePreview(p: HTMLElement, g: Game): void {
  p.classList.add("panel-preview");
  const next = g.level.waves[g.wave];
  const head = document.createElement("div");
  head.className = "preview-head";
  if (!next) {
    head.append(line(g.phase === "wave" ? "Last wave on the lane. Hold them." : "", "preview-title"));
    p.append(head);
    return;
  }
  head.append(line(g.phase === "wave" ? `Coming next: wave ${g.wave + 1}` : `Wave ${g.wave + 1} of ${g.level.waves.length}`, "preview-title"));
  p.append(head);
  if (g.level.twists?.length) {
    const tw = line(g.level.twists.map((t) => `${TWISTS[t].name}: ${TWISTS[t].rule}`).join(" "), "twist-line");
    p.append(tw);
  }
  for (const sp of g.level.setPieces ?? [])
    p.append(
      line(
        sp.kind === "flood"
          ? `Flood: from wave ${sp.wave} the river covers the plots by the ford; only Duck Ponds stand there, and vehicles wade.`
          : sp.kind === "bridge"
            ? `Swing bridge: it opens for ${sp.open}s every ${sp.period}s, and nothing crosses while it's up.`
            : "Blackout: no lamps tonight. Towers and Cath light the lane around them; nothing in the dark can be targeted.",
        "twist-line",
      ),
    );
  const row = document.createElement("ul");
  row.className = "preview-row";
  for (const { kind, count } of waveSummary(next)) {
    const li = document.createElement("li");
    li.className = "preview-chip" + (isBig(kind) ? " boss" : "");
    li.append(img(enemyIcon(kind), "chip-icon"));
    const label = document.createElement("span");
    label.textContent = `${count} × ${ENEMIES[kind].name}`;
    li.append(label);
    const cls = enemyClass(kind);
    if (cls !== "light") {
      const tag = document.createElement("span");
      tag.className = `chip-tag ${cls}`;
      tag.textContent = cls === "air" ? "Air" : "Heavy";
      li.append(tag);
    }
    row.append(li);
  }
  p.append(row);
  if (g.towers.length) {
    const counts = new Map<TowerKind, number>();
    for (const t of g.towers) counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
    const list = [...counts].map(([k, n]) => `${n} × ${TOWERS[k].name}`).join(", ");
    p.append(line(`On the field: ${list}. Tap a tower for its range, upgrades and sell price.`, "hint field-summary"));
  }
  const advice = cathAdvice(g, next);
  if (advice) p.append(line(`Cath: ${advice}`, "cath-tip"));
  towerRoster(p, g);
  if (g.phase === "build" && g.wave === 0) p.append(line("Tap a plot to build. Between waves, tap Cath, then tap the field to give her a new post.", "hint"));
}

/** One line from Cath about the coming wave, from its enemy classes. */
function cathAdvice(g: Game, next: Level["waves"][number]): string {
  const kinds = waveSummary(next).map((w) => w.kind);
  const classes = new Set(kinds.map(enemyClass));
  const bits: string[] = [];
  if (kinds.some(isBig)) bits.push("A big one is coming. Save Marks for upgrades and keep the pie ready.");
  if (classes.has("air")) bits.push("There's air traffic: ground-only towers can't touch it.");
  if (classes.has("heavy")) bits.push("Heavy plant is slow but tough. Slow it and hit it hard.");
  if (!bits.length) bits.push(g.towers.length < 4 ? "Spread a few towers along the bends and let them work." : "Plenty of light traffic. Keep the lane tidy.");
  return bits.slice(0, 2).join(" ");
}

/** A compact stats table of the towers this level allows: cost, damage, range and rate at tier 1. */
function towerRoster(p: HTMLElement, g: Game): void {
  const table = document.createElement("table");
  table.className = "roster";
  const cap = document.createElement("caption");
  cap.textContent = "Towers this level";
  table.append(cap);
  for (const kind of g.level.towers) {
    const s = TOWERS[kind];
    const tr = document.createElement("tr");
    const icon = document.createElement("td");
    icon.append(img(towerIcon(kind), "roster-icon"));
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = s.name;
    const stat = document.createElement("td");
    const bits = [`${s.cost} Marks`];
    if (s.damage[0] > 0) bits.push(`${s.damage[0]} dmg`, `${(1 / s.cooldown[0]).toFixed(1)}/s`);
    bits.push(`range ${s.range[0]}`);
    stat.textContent = bits.join(" · ");
    tr.append(icon, name, stat);
    table.append(tr);
  }
  p.append(table);
}

const CLASS_NAMES: Record<EnemyClass, string> = { light: "light traffic", heavy: "heavy plant", air: "air" };

/** " Strong vs air; weak vs heavy plant." for the build menu, from TOWER_VS. */
function counterLine(kind: TowerKind): string {
  const vs = TOWER_VS[kind] ?? {};
  const ks = Object.keys(vs) as EnemyClass[];
  const strong = ks.filter((k) => vs[k]! > 1).map((k) => CLASS_NAMES[k]);
  const weak = ks.filter((k) => vs[k]! < 1).map((k) => CLASS_NAMES[k]);
  const bits = [strong.length ? `Strong vs ${strong.join(", ")}` : "", weak.length ? `weak vs ${weak.join(", ")}` : ""].filter(Boolean);
  if (!bits.length) return "";
  const text = bits.join("; ");
  return ` ${text[0]!.toUpperCase()}${text.slice(1)}.`;
}

function buildMenu(p: HTMLElement, g: Game, sel: { col: number; row: number }): void {
  p.classList.add("panel-build");
  const row = document.createElement("div");
  row.className = "build-row";
  const info = line("", "build-info");
  const ground = plotKind(g.level, sel.col, sel.row);
  for (const kind of g.level.towers) {
    const spec = TOWERS[kind];
    const cost = towerCost(g, kind);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-build";
    b.dataset.kind = kind;
    b.dataset.cost = String(cost);
    const wet = ground === "water" && kind !== "pond";
    b.disabled = g.marks < cost || wet;
    b.setAttribute("aria-label", `${spec.name}, ${cost} Marks. ${spec.blurb}${counterLine(kind)}${wet ? " Too wet here." : ""}`);
    b.append(img(towerIcon(kind), "build-icon"));
    const name = document.createElement("span");
    name.className = "build-name";
    name.textContent = spec.name;
    const price = document.createElement("span");
    price.className = "build-cost";
    price.textContent = String(cost);
    const hot = document.createElement("span");
    hot.className = "build-key";
    hot.setAttribute("aria-hidden", "true");
    hot.textContent = String(row.children.length + 1);
    b.append(hot, name, price);
    const show = () => {
      info.textContent = `${spec.name}: ${spec.blurb}${counterLine(kind)}`;
      if (renderer) renderer.preview = kind;
    };
    b.addEventListener("pointerenter", show);
    b.addEventListener("focus", show);
    b.onclick = () => {
      if (doAct({ t: "place", kind, col: sel.col, row: sel.row })) {
        sfx.playBuild();
        haptic.build();
        const nt = g.towers[g.towers.length - 1];
        if (nt) renderer?.built_(nt.id, nt.col, nt.row, false);
        renderPanel(true);
        // Cath's post (the ring in the lane) is where she holds vans for the towers: say so while building.
        if (g.level.id <= 5 && !heroCovered(g))
          tip("post-uncovered", "That one can't reach my post, the amber ring in the lane. I hold vans there for the towers: build one in reach and it turns green, or tap me and move me.", "worried");
        else if (g.level.id === 1)
          tip("send", "Lovely: the ring's green, so that tower finishes what I hold at my post. When you're ready, send the wave.", "delighted");
      }
    };
    row.append(b);
  }
  info.textContent =
    ground === "water"
      ? "Wet ground: only a Duck Pond will sit here."
      : ground === "high"
        ? "High ground: towers here see 25% further."
        : "Pick something to plant here.";
  p.append(row, info);
}

const TARGET_LABEL: Record<TargetMode, string> = { first: "First", last: "Last", strong: "Strongest", close: "Closest" };

type Stats = ReturnType<typeof towerStats>;

/** The numbers a player compares: label and value, for a tower at some tier. */
function statList(st: Stats): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (st.damage) {
    rows.push(["Damage/s", (st.damage / st.cooldown).toFixed(0)]);
    rows.push(["Hit", st.damage.toFixed(0)]);
    rows.push(["Rate", `${(1 / st.cooldown).toFixed(1)}/s`]);
  }
  if (st.range) rows.push(["Range", st.range.toFixed(1)]);
  if (st.damage || st.slow < 1 || st.thorns) rows.push(["Hits", st.air ? "air + ground" : "ground only"]);
  if (st.splash) rows.push(["Splash", st.splash.toFixed(1)]);
  if (st.damage || st.gustEvery) {
    const pct = (k: EnemyClass) => `${CLASS_NAMES[k]} ×${+st.vs[k].toFixed(2)}`;
    const classes = (Object.keys(CLASS_NAMES) as EnemyClass[]).filter((k) => st.air || k !== "air");
    const strong = classes.filter((k) => st.vs[k] > 1);
    const weak = classes.filter((k) => st.vs[k] < 1);
    if (strong.length) rows.push(["Strong vs", strong.map(pct).join(", ")]);
    if (weak.length) rows.push(["Weak vs", weak.map(pct).join(", ")]);
  }
  if (st.slow < 1) rows.push(["Slows to", `${Math.round(st.slow * 100)}%`]);
  if (st.thorns) rows.push(["Thorns", `${st.thorns}/s`]);
  if (st.poison) rows.push(["Poison", `${st.poison.dps}/s for ${st.poison.secs}s`]);
  if (st.sticky) rows.push(["Honey", `${Math.round(st.sticky.factor * 100)}% speed, ${st.sticky.secs}s`]);
  if (st.knockback) rows.push(["Knockback", st.knockback.toFixed(2)]);
  if (st.crit) rows.push(["Crit", `every ${st.crit.every} shots ×${st.crit.mult}`]);
  if (st.pierce) rows.push(["Armour", "ignored"]);
  if (st.buff > 1) rows.push(["Nearby towers", `+${Math.round((st.buff - 1) * 100)}% damage`]);
  if (st.aura > 1) rows.push(["Every tower", `+${Math.round((st.aura - 1) * 100)}% damage`]);
  if (st.income) rows.push(["Income", `+${st.income} a wave`]);
  if (st.reveal > 1) rows.push(["Marked", `+${Math.round((st.reveal - 1) * 100)}% damage taken`]);
  if (st.injunction) rows.push(["Injunction", `${st.injunction}s on ${st.classAction ? "everything" : "bosses"}`]);
  if (st.mend) rows.push(["Mends", `+${st.mend} Goodwill a wave`]);
  if (st.pieHaste) rows.push(["Pie", `${Math.round(st.pieHaste * 100)}% faster`]);
  if (st.cleanse) rows.push(["Cures", "charm"]);
  return rows;
}

/** A stat grid; with `next`, each row shows the change ("12 → 19"), changed rows highlighted. */
function statGrid(st: Stats, next?: Stats): HTMLElement {
  const dl = document.createElement("dl");
  dl.className = "stats";
  const now = new Map(statList(st));
  const rows = next ? statList(next) : [...now];
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    const before = now.get(label);
    if (next && before !== value) {
      dd.className = "up";
      dd.textContent = before ? `${before} → ${value}` : `new: ${value}`;
    } else dd.textContent = value;
    dl.append(dt, dd);
  }
  return dl;
}

function towerCard(p: HTMLElement, g: Game, t: Tower): void {
  p.classList.add("panel-tower");
  const spec = TOWERS[t.kind];
  const st = towerStats(t);
  const head = document.createElement("div");
  head.className = "tower-head";
  head.append(img(towerIcon(t.kind, t.tier, t.spec ?? null), "tower-icon"));
  const titles = document.createElement("div");
  titles.className = "tower-titles";
  const name = t.mega ? MEGAS[t.mega].name : t.tier === 4 && t.spec != null ? SPECIALISATIONS[t.kind][t.spec].name : spec.name;
  const title = line(name, "panel-title");
  title.setAttribute("aria-label", `${name}, tier ${t.tier} of 4`);
  const pips = document.createElement("span");
  pips.className = "pips";
  pips.setAttribute("aria-hidden", "true");
  pips.textContent = t.mega ? "◆" : "★".repeat(t.tier) + "☆".repeat(4 - t.tier);
  title.append(" ", pips);
  titles.append(title);
  // Veterans: kills, rank, and how far to the next.
  const kills = t.kills ?? 0;
  const rank = rankOf(kills);
  if (st.damage > 0 || st.thorns > 0 || st.gustEvery > 0) {
    const vet = line(
      rank > 0
        ? `Veteran ${"★".repeat(rank)} · ${kills} knockouts${rank < 3 ? ` · next rank at ${RANKS[rank]}` : ""}`
        : `${kills} knockouts · veteran at ${RANKS[0]}`,
      "vet-line",
    );
    titles.append(vet);
  }
  if (st.damage > 0) {
    // Targeting is one small cycling button: it rarely needs changing.
    const tb = document.createElement("button");
    tb.type = "button";
    tb.className = "target-btn";
    const mode = t.target ?? "first";
    tb.textContent = `Target: ${TARGET_LABEL[mode]}`;
    tb.setAttribute("aria-label", `Target ${TARGET_LABEL[mode]}. Change target`);
    tb.onclick = () => {
      const next = TARGET_MODES[(TARGET_MODES.indexOf(mode) + 1) % TARGET_MODES.length]!;
      doAct({ t: "target", id: t.id, mode: next });
      renderPanel(true);
    };
    titles.append(tb);
  }
  head.append(titles);
  p.append(head);

  const row = document.createElement("div");
  row.className = "panel-row";
  if (t.mega) {
    p.append(line(MEGAS[t.mega].blurb, "hint"), statGrid(st));
  } else if (t.tier < 3) {
    const cost = upgradeCost(t)!;
    const nextStats = towerStats({ kind: t.kind, tier: (t.tier + 1) as 2 | 3, spec: null });
    p.append(statGrid(st, nextStats));
    const up = document.createElement("button");
    up.type = "button";
    up.className = "btn";
    up.id = "btn-upgrade";
    up.dataset.cost = String(cost);
    up.textContent = `Upgrade → T${t.tier + 1} · ${cost}`;
    up.disabled = g.marks < cost;
    up.onclick = () => {
      if (doAct({ t: "upgrade", id: t.id })) {
        sfx.playUpgrade();
        haptic.upgrade();
        renderer?.built_(t.id, t.col, t.row, true);
        renderPanel(true);
      }
    };
    row.append(up);
  } else if (t.tier === 3) {
    // The choice comes first, right under the name, so a phone's short panel shows it without scrolling.
    p.classList.add("choosing");
    const ownStats = statGrid(st);
    const choices = document.createElement("div");
    choices.className = "spec-row";
    const open = specsUnlocked(g.level);
    ([0, 1] as const).forEach((i) => {
      const sp = SPECIALISATIONS[t.kind][i];
      const cost = specCost(t, i)!;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `spec spec-${i}`;
      b.dataset.cost = String(cost);
      b.dataset.locked = open ? "0" : "1";
      b.disabled = !open || g.marks < cost;
      const top = document.createElement("span");
      top.className = "spec-top";
      top.append(img(towerIcon(t.kind, 4, i), "spec-icon"));
      const n = document.createElement("strong");
      n.textContent = sp.name;
      const c = document.createElement("span");
      c.className = "build-cost";
      c.textContent = String(cost);
      top.append(n, c);
      const d = document.createElement("small");
      d.textContent = sp.blurb;
      b.append(top, d, statGrid(st, towerStats({ kind: t.kind, tier: 4, spec: i })));
      b.setAttribute("aria-label", `${sp.name}, ${cost} Marks. ${sp.blurb}`);
      b.onclick = () => {
        if (doAct({ t: "upgrade", id: t.id, spec: i })) {
          haptic.upgrade();
          renderer?.built_(t.id, t.col, t.row, true);
          sfx.playUpgrade();
          renderPanel(true);
        }
      };
      choices.append(b);
    });
    p.append(choices);
    if (!open) p.append(line(`Specialisations open at level ${SPEC_FIRST_LEVEL}.`, "hint"));
    p.append(ownStats);
  } else p.append(statGrid(st));
  if (!t.mega && t.tier >= 3) mergeSection(p, g, t);
  const sl = document.createElement("button");
  sl.type = "button";
  sl.className = "btn btn-quiet";
  sl.id = "btn-sell";
  sl.textContent = `Sell +${sellValue(t)}`;
  sl.onclick = () => {
    if (doAct({ t: "sell", id: t.id })) sfx.playSell();
    deselect();
  };
  row.append(sl);
  p.append(row);
}

/** Megastructures: merge buttons for grown neighbours, or a hint about what this tower could become. */
function mergeSection(p: HTMLElement, g: Game, t: Tower): void {
  if (!megasUnlocked(g.level)) return;
  const opts = mergeOptions(g, t.id);
  const box = document.createElement("div");
  box.className = "merge-row";
  for (const o of opts) {
    const m = MEGAS[o.mega];
    const partner = g.towers.find((x) => x.id === o.partner)!;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn merge-btn";
    b.dataset.cost = String(o.cost);
    b.disabled = g.marks < o.cost;
    const top = document.createElement("strong");
    top.textContent = `Merge with the ${TOWERS[partner.kind].name} → ${m.name} · ${o.cost}`;
    const d = document.createElement("small");
    d.textContent = m.blurb;
    b.append(top, d, statGrid(st0(t), towerStats({ kind: t.kind, tier: 4, mega: o.mega })));
    b.onclick = () => {
      if (doAct({ t: "merge", id: t.id, partner: o.partner })) {
        renderer?.built_(t.id, t.col, t.row, true);
        renderPanel(true);
      }
    };
    box.append(b);
  }
  if (!opts.length) {
    const partners = (Object.keys(TOWERS) as Array<Tower["kind"]>).filter((k) => megaFor(t.kind, k) && g.level.towers.includes(k));
    if (!partners.length) return;
    box.append(
      line(
        `Megastructure: grow a ${partners.map((k) => `${TOWERS[k].name} (→ ${MEGAS[megaFor(t.kind, k)!].name})`).join(" or a ")} to tier 3 right beside this one, then merge them.`,
        "hint",
      ),
    );
  }
  p.append(box);
}

const st0 = (t: Tower) => towerStats(t);

function act(fn: () => { ok: boolean; reason?: string }): boolean {
  const r = fn();
  if (!r.ok && r.reason) {
    say(r.reason);
    toast(r.reason);
  }
  updateHud();
  return r.ok;
}

let toastTimer = 0;
function toast(text: string): void {
  ui.toast.textContent = text;
  ui.toast.className = "banner small show";
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.className = "banner small"), 2200);
}

function deselect(): void {
  selected = null;
  if (renderer) {
    renderer.selected = null;
    renderer.heroSelected = false;
  }
  renderPanel(true);
  syncControls();
}

function select(col: number, row: number): void {
  if (!game || !renderer) return;
  selected = { col, row };
  renderer.selected = selected;
  renderer.heroSelected = false;
  renderer.cursor = { col, row };
  renderPanel(true);
  syncControls();
}

/**
 * Cath holds a post (Hedgerow 2 section 6). Between rounds, tapping her picks her up: the next tap on the
 * field is her new post. During a round, tapping her shows how she's doing.
 */
function heroStatus(): void {
  if (!game || !renderer) return;
  const h = game.hero;
  if (!player && h.down <= 0 && betweenRounds(game) && game.phase !== "won" && game.phase !== "lost") {
    posting = !posting;
    renderer.heroSelected = posting;
    renderer.postPreview = null;
    if (posting) {
      selected = null;
      renderer.selected = null;
      renderPanel(true);
    }
    toast(posting ? "Tap where Cath should stand. She holds that post through the next wave." : "Cath stays put.");
    syncControls();
    return;
  }
  toast(
    h.down > 0
      ? `Cath is catching her breath: back in ${Math.ceil(h.down)}s.`
      : `Cath: ${Math.round(h.hp)}/${h.maxHp} health, ${h.kills} knockouts. She holds her post; move her between waves.`,
  );
}

function placeHero(x: number, y: number): void {
  if (!game || !renderer) return;
  posting = false;
  renderer.heroSelected = false;
  if (doAct({ t: "hero", x, y })) {
    sfx.playSwing();
    toast("Cath takes her new post.");
  }
  syncControls();
}

const ABILITY_NAME: Record<Ability, string> = { pie: "The pie", neighbours: "Neighbours", rally: "Rally" };

/** A cast by hand: three of them earn the ability its Auto toggle. */
function noteCast(a: Ability): void {
  const n = recordCast(data, a);
  save(data);
  if (n === AUTO_AFTER_CASTS)
    toast(`${ABILITY_NAME[a]} has earned Auto: press and hold it (or right-click) to let it cast itself.`);
}

function toggleAuto(a: Ability): void {
  if (!game || player) return;
  if (!autoEarned(data, a)) {
    const left = AUTO_AFTER_CASTS - (data.casts?.[a] ?? 0);
    toast(`Cast it by hand ${left} more time${left === 1 ? "" : "s"} to earn Auto.`);
    return;
  }
  const on = !game.auto[a];
  if (!doAct({ t: "auto", ability: a, on })) return;
  setAuto(data, a, on);
  save(data);
  toast(`${ABILITY_NAME[a]}: Auto ${on ? "on" : "off"}`);
  syncControls();
}

/** Why a leak happened, in today's traits, with the counter that answers it (Hedgerow 2 section 2). */
function leakCause(g: Game, k: EnemyKind, dropped = false, stacked = false): string {
  const e = ENEMIES[k];
  // Cath went down holding it: her post is out of the towers' reach, not short of damage near the farmhouse.
  if (dropped) return "Cath was knocked down holding them. Put towers in range of her post so they finish what she holds.";
  const have = (kind: TowerKind) => g.level.towers.includes(kind);
  const named = (kinds: TowerKind[]) => kinds.filter(have).map((x) => TOWERS[x].name);
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);
  if (e.stealth) {
    const seen = g.towers.some((t) => t.kind === "mast" && towerActive(t));
    return have("mast")
      ? `${seen ? "It slipped past where your Masts could see." : "Nothing could see it."} A Radio Mast reveals stealth, and Cath spots it close to her post.`
      : "Nothing could see it. Cath spots stealth close to her post: put her where it will pass.";
  }
  if (e.flying) {
    const air = (g.level.towers as TowerKind[]).filter((x) => towerStats({ kind: x, tier: 1, spec: null }).air).map((x) => TOWERS[x].name);
    return `It flew over the hedges. Only towers that hit air touch it${air.length ? `: ${list(air)}` : ""}.`;
  }
  if (e.shield) {
    const splash = named(["beehive", "pond", "cannon"]);
    return `Bubble wrap soaked up the single shots. Splash bursts it${splash.length ? `: ${list(splash)}` : ""}, and so does a pie.`;
  }
  if (isBig(k)) return "A boss shrugs off a lot. Upgrade along the last stretch, and save a pie or an Injunction for it.";
  if (isHeavy(k)) {
    const movers = named(["silo", "cannon"]);
    return `Heavy plant ploughs on and hedges slow it only half as much.${movers.length ? ` ${list(movers)} move it.` : " Stack damage where it bunches up."}`;
  }
  if (e.armor) return have("silo") ? "Armour shrugged off the hits. Grain Silos ignore armour." : "Armour shrugged off the hits. Bigger hits get through it: upgrade.";
  if (stacked)
    return "Too many at once: the next wave was stacked on before this one was through. Stack only when the towers clear a wave with room to spare.";
  return "Not enough damage near the farmhouse. Build or upgrade along the last stretch of lane.";
}

function leakReport(g: Game, k: EnemyKind, dropped = false): void {
  const cause = leakCause(g, k, dropped, stackedWave > 0 && stackedWave === g.wave);
  banner(`Leaked: ${ENEMIES[k].name}`, cause);
  say(`Leaked: ${ENEMIES[k].name}. ${cause}`);
  haptic.leakReport();
  if (!REDUCED) slowUntil = performance.now() + 600;
}

function startAim(): void {
  if (!game || !renderer) return;
  if (aiming) {
    // Second press: throw at the front of the queue.
    fire();
    return;
  }
  aiming = true;
  renderer.selected = null;
  selected = null;
  renderer.heroSelected = false;
  renderPanel(true);
  syncControls();
}

function fire(x?: number, y?: number): void {
  if (!game || !renderer) return;
  aiming = false;
  renderer.aim = null;
  if (doAct({ t: "pie", x, y })) {
    sfx.playPie();
    noteCast("pie");
  }
  renderPanel(true);
  syncControls();
}

// ---- banners and enemy introductions ----

function banner(text: string, sub = "", boss = false): void {
  ui.banner.replaceChildren();
  const big = document.createElement("strong");
  big.textContent = text;
  ui.banner.append(big);
  if (sub) {
    const s = document.createElement("span");
    s.textContent = sub;
    ui.banner.append(s);
  }
  ui.banner.className = `banner show${boss ? " boss" : ""}`;
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => (ui.banner.className = "banner"), boss ? 2600 : 1700);
}

function describeEnemy(kind: EnemyKind): string {
  const e = ENEMIES[kind];
  const bits: string[] = [];
  if (isBig(kind)) bits.push("A boss: Cath can't hold it and pies only stun it half as long.");
  if (e.flying) bits.push("Flies over Cath. Scarecrows and Windmills bring it down fastest.");
  else if (isHeavy(kind))
    bits.push("Heavy plant: hedges and honey only half slow it, gusts can't shift it, and turnips and stings barely dent it. Grain Silos and Seed Cannons do.");
  if (e.armor) bits.push(`Armoured: shrugs off ${Math.round(e.armor * 100)}% of ordinary shots. Grain Silos go straight through.`);
  if (e.stealth) bits.push("Invisible until a Radio Mast has it in range.");
  if (e.charm) bits.push("Charms nearby towers into holding fire. A Clinic Tent cures it.");
  if (e.jam) bits.push("Buries nearby towers in paperwork: they fire at half speed.");
  if (e.heal) bits.push("Patches up anything beside it.");
  if (e.splits) bits.push(`Breaks into ${e.splits.count} × ${ENEMIES[e.splits.kind].name}.`);
  if (!bits.length) bits.push(e.speed >= 1.3 ? "Quick and flimsy." : "Slow, steady and very full of parcels.");
  if (e.speed >= 1.3 && bits.length) bits.push("Fast.");
  return bits.join(" ");
}

function introduce(kinds: EnemyKind[]): void {
  const fresh = kinds.filter((k) => !data.seen[k]);
  if (!fresh.length) return;
  for (const k of fresh) data.seen[k] = true;
  save(data);
  const k = fresh[0]!;
  ui.intro.replaceChildren();
  ui.intro.append(img(enemyIcon(k), "intro-icon"));
  const box = document.createElement("div");
  const eb = document.createElement("p");
  eb.className = "eyebrow";
  eb.textContent = isBig(k) ? "Boss" : "New on the lane";
  const n = document.createElement("strong");
  n.textContent = ENEMIES[k].name;
  const d = document.createElement("p");
  d.textContent = describeEnemy(k);
  box.append(eb, n, d);
  ui.intro.append(box);
  ui.intro.hidden = false;
  ui.intro.classList.remove("pop");
  void ui.intro.offsetWidth;
  ui.intro.classList.add("pop");
  say(`${ENEMIES[k].name}. ${describeEnemy(k)}`);
  window.setTimeout(() => (ui.intro.hidden = true), 5200);
}

// ---- the loop ----

function onEvents(g: Game, evs: GameEvent[]): void {
  let shots = 0;
  let gusts = 0;
  for (const ev of evs) {
    switch (ev.type) {
      case "shot":
        if (shots++ < 2) sfx.playShot(ev.kind, !!ev.crit);
        break;
      case "kill":
        sfx.playKill(isBig(ev.kind));
        break;
      case "leak":
        sfx.playLeak();
        haptic.leak();
        // The first leak of a round gets a moment of slow motion and a banner naming the cause.
        if (ev.kind && !player && leakReported !== g.wave) {
          leakReported = g.wave;
          leakReport(g, ev.kind, !!ev.dropped);
        }
        if (g.goodwill <= g.maxGoodwill / 2 && g.goodwill > 0)
          tip(`low-${g.level.id}`, "They're getting through! Hedges near the farmhouse, and between waves move me to the end of the lane.", "worried", true);
        break;
      case "wave": {
        sfx.playWave();
        const groups = g.level.waves[ev.wave - 1] ?? [];
        const kinds = waveSummary(groups).map((x) => x.kind);
        const boss = kinds.find((k) => isBig(k));
        if (boss) {
          banner(ENEMIES[boss].name, "Boss incoming", true);
          sfx.playBoss();
          haptic.boss();
        } else banner(`Wave ${ev.wave}`, ev.early ? `Stacked early · +${ev.early} Marks` : `of ${g.level.waves.length}`);
        introduce(kinds);
        if (ev.early) {
          earlyCalls += 1;
          stackedWave = ev.wave;
        }
        break;
      }
      case "cleared":
        sfx.playCleared();
        if (canCallEarlyHintable(g)) break;
        break;
      case "pie":
        break;
      case "neighbours":
        tip("neighbours", "The neighbours are in the lane. Nothing on wheels gets past them for ten seconds.", "determined");
        break;
      case "rally":
        tip("rally", "Come on, all of you! Everything fires faster for a few seconds.", "delighted");
        break;
      case "swing":
        sfx.playSwing();
        break;
      case "heroDown":
        sfx.playHeroDown();
        tip("down", "Oof. Give me a few seconds. They hit harder than they look.", "worried");
        break;
      case "heroUp":
        break;
      case "injunction":
        sfx.playInjunction();
        break;
      case "split":
        break;
      case "gust":
        if (gusts++ < 1) sfx.playGust();
        break;
      case "pop":
        sfx.playPop();
        tip("pop", "Bubble wrap! Single shots barely dent it. Splash (bees, ponds, the Seed Cannon), gusts and my pies burst it.", "determined");
        break;
      case "rankUp":
        toast(`${TOWERS[g.towers.find((t) => t.id === ev.tower)?.kind ?? "scarecrow"].name} is a veteran now: ${"★".repeat(ev.rank)}`);
        break;
      case "merge":
        banner(MEGAS[ev.mega].name, "Megastructure raised", true);
        sfx.playUpgrade();
        haptic.boss();
        break;
      case "ambush":
        banner("Ambush!", `${ENEMIES[ev.kind].name}s are lying in wait halfway down the lane.`);
        tip("ambush", "Scouts say some of them are hiding partway down the lane. The red ring marks the spot: cover it.", "worried");
        break;
      case "duel":
        sfx.playBoss();
        haptic.boss();
        say(`Cath squares up to ${ENEMIES[ev.kind].name}. Tap Strike when the pin is in the gold.`);
        break;
      case "duelStrike":
        sfx.playSwing();
        if (ev.quality >= 0.85) haptic.upgrade();
        break;
      case "duelEnd":
        toast(ev.won ? `Cath wins the duel: the ${ENEMIES[ev.kind].name} reels.` : "Cath's knocked back. She'll be up in a moment.");
        break;
      case "flood":
        if (ev.warn) banner("The river's rising", "Next wave it floods the plots by the ford. Only Duck Ponds will stand there.");
        else {
          banner("Flood!", "The plots by the ford are under water; anything but a pond is washed out for a while.", true);
          haptic.boss();
        }
        break;
      case "bridge":
        if (ev.open) tip("bridge", "The swing bridge is up! Nothing crosses while it's open, so they bunch up in front of it. Splash them there.", "determined");
        break;
      case "bossMove":
        sfx.playBossMove(ev.move);
        toast(ev.text);
        if (ev.towers.length) tip("boss-move", "Bosses have tricks. Knocked-out towers come back in a few seconds; a pie or an Injunction buys time.", "determined");
        break;
    }
  }
}

function canCallEarlyHintable(g: Game): boolean {
  return g.level.id <= 4 && canCallEarly(g);
}

function frame(now: number): void {
  raf = requestAnimationFrame(frame);
  if (!game || !renderer) return;
  const g = game;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused && !ui.dlgStory.open && !ui.dlgResult.open) {
    if (!player && g.phase === "build" && g.wave > 0 && g.wave < g.level.waves.length && autoNext) {
      // Hold the countdown while the player is choosing something.
      if (!selected && !posting && !aiming) autoLeft -= dt * speed;
      if (autoLeft <= 0) {
        autoLeft = AUTO_SECS;
        doAct({ t: "wave" });
      }
      syncControls();
    } else if (g.phase !== "build") autoLeft = AUTO_SECS;
    // A duel runs in real time, whatever the game speed; a replay runs at least x2.
    const slow = now < slowUntil ? 0.4 : 1;
    acc += dt * (player ? Math.max(2, speed) : g.duel ? 1 : speed * slow);
    let stepped = false;
    while (acc >= STEP) {
      acc -= STEP;
      if (player) player.step();
      else if (recorder) recorder.step(g);
      else stepGame(g);
      stepped = true;
    }
    if (player) {
      ui.replayFill.style.setProperty("--p", String(player.progress));
      if (player.done && !finished) {
        finished = true;
        toast("End of the replay.");
        window.setTimeout(() => {
          if (game === g) leaveLevel();
        }, 2500);
      }
    }
    if (stepped) {
      const evs = drainEvents(g);
      onEvents(g, evs);
      renderer.feed(evs, g);
      updateHud();
      sfx.setIntensity(g.phase !== "wave" ? 0 : g.enemies.some((e) => isBig(e.kind)) ? 2 : 1);
      // The stacking tip waits for the wave banner and any new-unit card to clear, and goes once Next can't stack.
      if (canCallEarly(g) && g.level.id <= 3 && g.waveClock >= 4 && ui.intro.hidden)
        tip("early", "Feeling brave? Tap Next to stack the next wave on this one for bonus Marks.", "wink");
      if (bubbleTip === "early" && !canCallEarly(g)) hideBubble();
      if (pieUnlocked(g.level) && g.pieCd === 0 && g.phase === "wave" && g.enemies.length > 3)
        tip("pie-ready", "Pie's ready. Tap it, then tap the thick of them.", "delighted");
    }
  }
  renderer.draw(g, paused ? 0 : dt * Math.min(speed, 2));
  drawDuel(g);
  if (!finished && !player && (g.phase === "won" || g.phase === "lost")) {
    finished = true;
    lastReplay = recorder?.replay() ?? null;
    ui.resultWatch.hidden = ui.resultShare.hidden = !lastReplay;
    sfx.setIntensity(0);
    if (g.phase === "won") {
      sfx.playWin();
      haptic.win();
      renderer?.celebrate();
    } else {
      sfx.playLose();
      haptic.lose();
    }
    window.setTimeout(() => finish(g), g.phase === "won" ? 1800 : 700);
  }
}


function finish(g: Game): void {
  if (game !== g) return;
  const lv = g.level;
  if (lv.endless) return finishEndless(g, lv);
  if (dailyDay !== null) return finishDaily(g, lv, dailyDay);
  const won = g.phase === "won";
  const n = starsOf(g);
  const idx = LEVELS.findIndex((l) => l.id === lv.id);
  const next = LEVELS[idx + 1];
  const before = data.stars[String(lv.id)] ?? 0;
  ui.resultCath.innerHTML = cath(won ? (n === 3 ? "delighted" : "smirk") : "worried");
  ui.resultEyebrow.textContent = `${lv.place}: ${lv.name}`;
  ui.resultTitle.textContent = won ? (n === 3 ? "Not a scratch on the farmhouse." : "The lane holds.") : "They got through.";
  ui.resultStars.replaceChildren();
  if (won) {
    for (let i = 0; i < 3; i++) {
      const sEl = document.createElement("span");
      sEl.className = `star${i < n ? " earned" : ""}`;
      sEl.textContent = i < n ? "★" : "☆";
      ui.resultStars.append(sEl);
    }
  }
  ui.resultStars.setAttribute("aria-label", won ? `${n} of 3 stars` : "");
  const stats = [
    `Goodwill kept ${g.goodwill}/${g.maxGoodwill}`,
    `Cath's knockouts ${g.hero.kills}`,
  ];
  if (g.heroic) stats.push("Heroic run ◆");
  if (earlyCalls) stats.push(`Waves called early ${earlyCalls}`);
  ui.resultStats.textContent = won ? stats.join(" · ") : `Reached wave ${g.wave} of ${lv.waves.length}`;
  const gained = won ? Math.max(0, n - before) : 0;
  ui.resultNote.textContent = won
    ? `${lv.reward}${gained ? ` · +${gained} star${gained > 1 ? "s" : ""} for the Seed Bank.` : ""}`
    : "Regroup and try again. Hedges slow them, scarecrows finish them, and Cath can hold the lane where it bends. Stars buy perks in the Seed Bank.";
  if (won) {
    const cathBefore = levelOf(xpOf(data.stars)).level;
    recordStars(data, lv.id, n);
    if (g.heroic) {
      recordHeroic(data, lv.id);
      ui.resultNote.textContent += " · Heroic ◆ earned: one Goodwill, no pies.";
    }
    const cathAfter = levelOf(xpOf(data.stars)).level;
    if (cathAfter > cathBefore)
      ui.resultNote.textContent += ` · Cath reached level ${cathAfter}: ${cathAfter - cathBefore} skill point${cathAfter - cathBefore > 1 ? "s" : ""} to spend${TALENTS.some(([l]) => l > cathBefore && l <= cathAfter) ? ", and a talent to choose" : ""}.`;
    const fresh = newRosettes(
      {
        levelId: lv.id,
        won: true,
        stars: n,
        kept: g.goodwill / g.maxGoodwill,
        heroKills: g.hero.kills,
        earlyCalls,
        heroic: g.heroic,
        towerKinds: new Set(g.towers.map((t) => t.kind)).size,
        towers: g.towers.length,
        perkRanks: startPerkRanks,
      },
      data,
    );
    if (fresh.length) {
      data.rosettes = { ...data.rosettes, ...Object.fromEntries(fresh.map((id) => [id, true])) };
      save(data);
      const names = fresh.map((id) => ROSETTES.find((r) => r.id === id)?.name ?? id);
      ui.resultNote.textContent += ` · Rosette${names.length > 1 ? "s" : ""}: ${names.join(", ")}.`;
    }
    ui.resultPrimary.textContent = next ? "Continue" : "Finale";
    ui.resultPrimary.onclick = () => {
      ui.dlgResult.close();
      showStory(
        next ? lv.after : [...lv.after, ...FINALE],
        lv.place,
        () => {
          if (next && isUnlocked(data, next.id)) openLevel(next);
          else leaveLevel();
        },
        actOf(lv),
      );
    };
  } else {
    ui.resultPrimary.textContent = "Try again";
    ui.resultPrimary.onclick = () => {
      ui.dlgResult.close();
      startLevel(lv);
    };
  }
  ui.resultSecondary.onclick = () => {
    ui.dlgResult.close();
    leaveLevel();
  };
  ui.dlgResult.classList.toggle("lost", !won);
  ui.dlgResult.showModal();
}

/** A daily challenge ends: the score, today's best and a share card to copy. */
function finishDaily(g: Game, lv: Level, day: number): void {
  const won = g.phase === "won";
  const score = dailyScore(won, g.goodwill / g.maxGoodwill, earlyCalls);
  const record = recordDaily(data, day, score);
  ui.resultCath.innerHTML = cath(won ? "delighted" : "worried");
  ui.resultEyebrow.textContent = `Daily #${day + 1}: ${lv.name}`;
  ui.resultTitle.textContent = won ? `${score} out of 100.` : "Not today.";
  ui.resultStars.replaceChildren();
  ui.resultStars.setAttribute("aria-label", "");
  ui.resultStats.textContent = `Today's best ${data.daily?.[String(day)] ?? 0}${record && won ? " (new)" : ""} · Goodwill ${g.goodwill}/${g.maxGoodwill}`;
  const card = shareCard(day, lv, won, score);
  ui.resultNote.textContent = "Same field for everyone today, no Seed Bank. Copy your card and send it round.";
  ui.resultPrimary.textContent = "Copy card";
  ui.resultPrimary.onclick = () => {
    void navigator.clipboard?.writeText(card).then(
      () => (ui.resultPrimary.textContent = "Copied"),
      () => (ui.resultNote.textContent = card),
    );
  };
  ui.resultSecondary.onclick = () => {
    ui.dlgResult.close();
    leaveLevel();
  };
  ui.dlgResult.classList.toggle("lost", !won);
  ui.dlgResult.showModal();
}

/** An Endless run ends when Goodwill does: the best wave reached is kept for the act. */
function finishEndless(g: Game, lv: Level): void {
  const act = actOf(lv);
  const reached = Math.max(1, g.wave - 1);
  const record = recordEndless(data, act, reached);
  ui.resultCath.innerHTML = cath(record ? "delighted" : "smirk");
  ui.resultEyebrow.textContent = lv.name;
  ui.resultTitle.textContent = record ? "A new best." : "They got through, in the end.";
  ui.resultStars.replaceChildren();
  ui.resultStars.setAttribute("aria-label", "");
  ui.resultStats.textContent = `Wave ${reached} · best ${data.endless?.[String(act)] ?? reached} · Cath's knockouts ${g.hero.kills}`;
  ui.resultNote.textContent = "Same field and same waves all week; a new run next Monday.";
  ui.resultPrimary.textContent = "Go again";
  ui.resultPrimary.onclick = () => {
    ui.dlgResult.close();
    startLevel(lv, false);
  };
  ui.resultSecondary.onclick = () => {
    ui.dlgResult.close();
    leaveLevel();
  };
  ui.dlgResult.classList.add("lost");
  ui.dlgResult.showModal();
}

// ---- the Seed Bank ----

function renderRosettes(): void {
  ui.rosettes.replaceChildren();
  let got = 0;
  for (const r of ROSETTES) {
    const has = data.rosettes?.[r.id] === true;
    if (has) got += 1;
    const li = document.createElement("li");
    li.className = `rosette${has ? " earned" : ""}`;
    const n = document.createElement("strong");
    n.textContent = `${has ? "✿" : "·"} ${r.name}`;
    const how = document.createElement("small");
    how.textContent = r.how;
    li.append(n, how);
    ui.rosettes.append(li);
  }
  ui.rosetteCount.textContent = `Rosettes ${got}/${ROSETTES.length}`;
}

function renderBank(): void {
  renderRosettes();
  ui.bankFree.textContent = `${freeStars(data)} stars to spend. Earn more by clearing levels with three stars.`;
  ui.perks.replaceChildren();
  for (const p of PERKS) {
    const rank = data.bank[p.id] ?? 0;
    const li = document.createElement("li");
    li.className = "perk";
    const text = document.createElement("div");
    const n = document.createElement("strong");
    n.textContent = p.name;
    const pips = document.createElement("span");
    pips.className = "pips";
    pips.textContent = "●".repeat(rank) + "○".repeat(p.costs.length - rank);
    pips.setAttribute("aria-label", `rank ${rank} of ${p.costs.length}`);
    const each = document.createElement("small");
    each.textContent = `${p.each} per rank. ${p.blurb}`;
    text.append(n, " ", pips, each);
    const cost = nextCost(data, p.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = cost === null ? "Full" : `★ ${cost}`;
    b.disabled = cost === null || cost > freeStars(data);
    b.setAttribute("aria-label", cost === null ? `${p.name}: fully grown` : `Buy ${p.name} rank ${rank + 1} for ${cost} stars`);
    b.onclick = () => {
      if (buyPerk(data, p.id)) sfx.playUpgrade();
      renderBank();
      ui.bankStars.textContent = String(freeStars(data));
    };
    li.append(text, b);
    ui.perks.append(li);
  }
}

ui.btnBank.addEventListener("click", () => {
  renderBank();
  ui.dlgBank.showModal();
});
ui.bankClose.addEventListener("click", () => ui.dlgBank.close());
ui.bankRefund.addEventListener("click", () => {
  refundAll(data);
  renderBank();
  ui.bankStars.textContent = String(freeStars(data));
});

// ---- input ----

// Pan and zoom on the 3D field: pinch or scroll to zoom, drag (when zoomed in) to look around. A drag
// doesn't count as a tap.
const pointers = new Map<number, { x: number; y: number }>();
let dragged = 0;
let pinch = 0;
ui.canvas.addEventListener("pointerdown", (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) dragged = 0;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
  }
});
ui.canvas.addEventListener("pointermove", (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev || !is3D(renderer)) return;
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    if (pinch > 0) renderer.zoomBy(d / pinch);
    pinch = d;
    dragged = 99;
  } else if (pointers.size === 1 && renderer.zoomed && !aiming) {
    dragged += Math.abs(dx) + Math.abs(dy);
    if (dragged > 8) renderer.panBy(dx, dy);
  }
});
for (const ev of ["pointerup", "pointercancel", "pointerleave"] as const)
  ui.canvas.addEventListener(ev, (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
  });
ui.canvas.addEventListener(
  "wheel",
  (e) => {
    if (!is3D(renderer)) return;
    e.preventDefault();
    renderer.zoomBy(Math.exp(-e.deltaY * 0.0015));
  },
  { passive: false },
);
ui.canvas.addEventListener("dblclick", () => {
  if (is3D(renderer)) renderer.resetView();
});

ui.canvas.addEventListener("click", (e) => {
  if (!game || !renderer) return;
  if (dragged > 8) {
    dragged = 0;
    return;
  }
  sfx.unlock();
  const w = renderer.worldAt(e.clientX, e.clientY);
  if (aiming) {
    fire(w.x, w.y);
    return;
  }
  if (posting && !renderer.onHero(e.clientX, e.clientY, game)) {
    placeHero(w.x, w.y);
    return;
  }
  if (renderer.onHero(e.clientX, e.clientY, game)) {
    heroStatus();
    return;
  }
  const c = renderer.cellAt(e.clientX, e.clientY, game);
  if (!c) {
    deselect();
    return;
  }
  if (laneCellsOf(game.level).has(`${c.col},${c.row}`)) {
    deselect();
    return;
  }
  if (selected && selected.col === c.col && selected.row === c.row) {
    deselect();
    return;
  }
  select(c.col, c.row);
});
ui.canvas.addEventListener("pointermove", (e) => {
  if (!game || !renderer) return;
  if (posting) {
    const w = renderer.worldAt(e.clientX, e.clientY);
    renderer.postPreview = { x: w.x, y: w.y };
  }
  if (!aiming) return;
  const w = renderer.worldAt(e.clientX, e.clientY);
  renderer.aim = { x: w.x, y: w.y, r: pieRadius(game) };
});
ui.canvas.addEventListener("pointerleave", () => {
  if (renderer && aiming) renderer.aim = null;
  if (renderer) renderer.postPreview = null;
});

ui.canvas.addEventListener("keydown", (e) => {
  if (!game || !renderer) return;
  const g = game;
  const cur = renderer.cursor ?? { col: 0, row: 0 };
  const d: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const m = d[e.key];
  if (m) {
    e.preventDefault();
    renderer.cursor = {
      col: Math.min(g.level.cols - 1, Math.max(0, cur.col + m[0])),
      row: Math.min(g.level.rows - 1, Math.max(0, cur.row + m[1])),
    };
    if (aiming) renderer.aim = { x: renderer.cursor.col + 0.5, y: renderer.cursor.row + 0.5, r: pieRadius(g) };
    const lane = laneCellsOf(g.level).has(`${renderer.cursor.col},${renderer.cursor.row}`);
    const tw = towerAt(g, renderer.cursor.col, renderer.cursor.row);
    say(`Column ${renderer.cursor.col + 1}, row ${renderer.cursor.row + 1}: ${tw ? TOWERS[tw.kind].name : lane ? "lane" : "empty plot"}`);
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (aiming) fire(cur.col + 0.5, cur.row + 0.5);
    else if (posting) placeHero(cur.col + 0.5, cur.row + 0.5);
    else if (!laneCellsOf(g.level).has(`${cur.col},${cur.row}`)) select(cur.col, cur.row);
  } else if (e.key === "Escape") {
    aiming = false;
    posting = false;
    renderer.heroSelected = false;
    renderer.aim = null;
    deselect();
  } else if (e.key === "c" || e.key === "C") {
    heroStatus();
  } else if ((e.key === "p" || e.key === "P") && e.shiftKey) {
    toggleAuto("pie");
  } else if ((e.key === "b" || e.key === "B") && e.shiftKey) {
    toggleAuto("neighbours");
  } else if ((e.key === "r" || e.key === "R") && e.shiftKey) {
    toggleAuto("rally");
  } else if (e.key === "p" || e.key === "P") {
    if (!ui.btnPie.disabled) startAim();
  } else if (e.key === "b" || e.key === "B") {
    if (!ui.btnNeighbours.disabled) ui.btnNeighbours.click();
  } else if (e.key === "r" || e.key === "R") {
    if (!ui.btnRally.disabled) ui.btnRally.click();
  } else if (e.key === "n" || e.key === "N") {
    ui.btnSend.click();
  }
});
ui.btnSend.addEventListener("click", () => {
  if (!game) return;
  sfx.unlock();
  doAct({ t: "wave" });
});
ui.btnPie.addEventListener("click", () => {
  sfx.unlock();
  startAim();
});
ui.btnNeighbours.addEventListener("click", () => {
  if (!game) return;
  sfx.unlock();
  if (doAct({ t: "neighbours" })) {
    sfx.playNeighbours();
    noteCast("neighbours");
  }
  syncControls();
});
ui.btnRally.addEventListener("click", () => {
  if (!game) return;
  sfx.unlock();
  if (doAct({ t: "rally" })) {
    sfx.playRally();
    noteCast("rally");
  }
  syncControls();
});
ui.btnHero.addEventListener("click", () => {
  sfx.unlock();
  heroStatus();
});
ui.btnAuto.addEventListener("click", () => {
  autoNext = !autoNext;
  autoLeft = AUTO_SECS;
  setKeepGoing(data, autoNext);
  save(data);
  syncControls();
});
ui.btnSpeed.addEventListener("click", () => {
  speed = speed === 1 ? 3 : speed === 3 && maxSpeed === 5 ? 5 : 1;
  if (speed === 3 && maxSpeed === 3) tip("x5", "Win this level once and x5 opens here.", "wink");
  try {
    localStorage.setItem("hedgerow:speed", String(speed));
  } catch {
    /* storage blocked: speed lasts this visit */
  }
  syncControls();
});
ui.btnSound.addEventListener("click", () => {
  sfx.setMuted(!sfx.isMuted());
  setHaptics(!sfx.isMuted());
  syncControls();
});
ui.btnPause.addEventListener("click", () => {
  paused = !paused;
  syncControls();
});
ui.btnLevels.addEventListener("click", leaveLevel);
window.addEventListener("resize", () => {
  if (game && renderer) renderer.resize(game);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game && game.phase === "wave") {
    paused = true;
    syncControls();
  }
});

  // ---- one-on-one boss duels ----

let duelShownFor = -1;
function drawDuel(g: Game): void {
  const d = g.duel;
  ui.duel.hidden = !d;
  if (!d) {
    duelShownFor = -1;
    return;
  }
  if (duelShownFor !== d.enemy) {
    duelShownFor = d.enemy;
    ui.duelTitle.textContent = `Cath vs ${ENEMIES[d.kind].name}`;
    ui.duelStrike.focus({ preventScroll: true });
  }
  ui.duelRounds.textContent = [0, 1, 2]
    .map((i) => (i < d.strikes.length ? (d.strikes[i]! >= 0.85 ? "★" : d.strikes[i]! >= 0.45 ? "●" : "✕") : i === d.round ? "◉" : "○"))
    .join(" ");
  ui.duelMark.style.setProperty("--x", String(duelPos(d.clock, d.round)));
}

/** Where the rolling pin is on the bar (0 to 1): it swings faster each round. */
function duelPos(clock: number, round: number): number {
  return 0.5 + 0.5 * Math.sin(clock * (2.6 + round * 0.9) - Math.PI / 2);
}

function strike(): void {
  if (!game?.duel) return;
  const d = game.duel;
  const off = Math.abs(duelPos(d.clock, d.round) - 0.5);
  const q = Math.max(0, Math.min(1, 1 - Math.max(0, off - 0.06) * 2.6));
  if (!doAct({ t: "strike", q })) return;
  const evs = drainEvents(game);
  onEvents(game, evs);
  renderer?.feed(evs, game);
  toast(q >= 0.85 ? "Perfect!" : q >= 0.45 ? "Good hit." : "Missed!");
}
ui.duelStrike.addEventListener("click", () => {
  sfx.unlock();
  strike();
});
document.addEventListener("keydown", (e) => {
  // 1-9 plant the nth tower in the open build menu (the badge on each card).
  if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement)) {
    const b = document.querySelectorAll<HTMLButtonElement>(".panel-build .btn-build")[Number(e.key) - 1];
    if (b && !b.disabled) {
      e.preventDefault();
      b.click();
    }
  }
  if (game?.duel && (e.key === " " || e.key === "Enter")) {
    e.preventDefault();
    strike();
  }
});

// ---- tooltips: hover (or press and hold) any control to see what it does ----

const AUTO_HINT = ` Cast it by hand ${AUTO_AFTER_CASTS} times and it earns Auto: press and hold (or right-click) to switch it on.`;
const AUTO_BUTTONS: Record<string, Ability> = { "btn-pie": "pie", "btn-neighbours": "neighbours", "btn-rally": "rally" };
let lastPointer = "mouse";

const TIPS: Record<string, () => string> = {
  "btn-pie": () =>
    `Cath's pie. Tap it, then tap where it should land: everything in the splash freezes for ${PIE_STUN}s (bosses half that) and takes ${PIE_DAMAGE} damage. Ready again ${Math.round(game ? pieCooldown(game) : 30)}s later. Tap the pie twice to throw at the front of the queue.${AUTO_HINT}`,
  "btn-neighbours": () =>
    `Call the neighbours: three farmhands block the lane just ahead of the leading vehicle for ${NEIGHBOURS_SECS}s. Nothing on wheels gets past; bosses crawl. Unlocks at level ${NEIGHBOURS_FIRST_LEVEL}.${AUTO_HINT}`,
  "btn-rally": () => `Rally: every tower fires half as fast again for ${RALLY_SECS}s. Unlocks at level ${RALLY_FIRST_LEVEL}.${AUTO_HINT}`,
  "btn-auto": () =>
    autoNext
      ? "Keep Going is on: the next wave starts by itself 2 seconds after the last is cleared. Tap to send each wave yourself."
      : "Keep Going is off: you press Go for each wave. Tap to let the waves roll on.",
  "btn-hero": () => "Cath holds her post: two vehicles at a time, so your towers get a clean shot. Between waves, tap her, then tap where she should stand.",
  "btn-speed": () => `Game speed (now x${speed}). Tap to cycle x1, x3${maxSpeed === 5 ? ", x5" : " (x5 once you've won this level)"}; it's remembered.`,
  "btn-pause": () => (paused ? "Resume the game." : "Pause the game."),
  "btn-sound": () => (sfx.isMuted() ? "Sound and vibration are off." : "Sound and vibration are on."),
  "btn-send": () => "Go starts the next wave. While a wave is on the lane, Next stacks the following one on top for bonus Marks.",
  "btn-levels": () => "Back to the map.",
  "btn-cath": () => "Cath's character sheet: spend skill points on her attributes and pick talents as she levels up.",
  "btn-daily": () => "Today's challenge: one level a day, no Seed Bank, and a score to share.",
  "btn-heroic": () => "Heroic: the next level starts with one Goodwill and no pies. Win it for a gold diamond.",
  "btn-bank": () => "The Seed Bank: spend stars on perks for every level.",
};

const HOVER = (() => {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch {
    return true;
  }
})();
let tipTimer = 0;
let tipHide = 0;
let tipSuppress = false;
function showTip(el: HTMLElement): void {
  const text = TIPS[el.id]?.();
  if (!text) return;
  ui.tooltip.textContent = text;
  ui.tooltip.hidden = false;
  const r = el.getBoundingClientRect();
  const w = ui.tooltip.offsetWidth;
  const h = ui.tooltip.offsetHeight;
  const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const above = r.top - h - 10;
  const y = above > 8 ? above : Math.min(window.innerHeight - h - 8, r.bottom + 10);
  ui.tooltip.style.setProperty("--x", `${x}px`);
  ui.tooltip.style.setProperty("--y", `${y}px`);
  clearTimeout(tipHide);
  tipHide = window.setTimeout(hideTip, Math.max(3500, text.length * 55));
}
function hideTip(): void {
  clearTimeout(tipTimer);
  ui.tooltip.hidden = true;
}
for (const id of Object.keys(TIPS)) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.classList.add("has-tip");
  el.addEventListener("pointerenter", (e) => {
    // Hover tips only where there's real hover (a phone's emulated mouse events don't count).
    if (e.pointerType !== "mouse" || !HOVER) return;
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => showTip(el), 380);
  });
  el.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") hideTip();
  });
  // Press and hold on a touch screen: the tip, and the press doesn't count as a tap.
  el.addEventListener("pointerdown", (e) => {
    lastPointer = e.pointerType;
    if (e.pointerType === "mouse") return;
    tipSuppress = false;
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => {
      tipSuppress = true;
      haptic.build();
      // An ability that has earned Auto: press and hold switches it.
      const ab = AUTO_BUTTONS[el.id];
      if (ab && game && autoEarned(data, ab)) toggleAuto(ab);
      else showTip(el);
    }, 450);
  });
  for (const ev of ["pointerup", "pointercancel"] as const) el.addEventListener(ev, () => clearTimeout(tipTimer));
  el.addEventListener(
    "click",
    (e) => {
      hideTip();
      if (tipSuppress) {
        tipSuppress = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    // Right-click switches an ability's Auto (a touch long-press is handled above).
    const ab = AUTO_BUTTONS[el.id];
    if (ab && lastPointer === "mouse") toggleAuto(ab);
  });
}

// ---- Cath's character sheet ----

function cathState() {
  data.cath ??= emptyCath();
  const xp = xpOf(data.stars);
  const lv = levelOf(xp);
  return { c: data.cath, xp, ...lv };
}

function renderCathButton(): void {
  const { c, level } = cathState();
  ui.cathLevel.textContent = String(level);
  ui.cathDot.hidden = freePoints(c, level) === 0 && talentsWaiting(c, level).length === 0;
  ui.cathBtnFace.innerHTML = cathSvg({ framing: "face", expression: "smirk", outfit: art() });
}

function renderWardrobe(): void {
  const box = $<HTMLElement>("cath-wardrobe");
  box.replaceChildren();
  const h = document.createElement("h3");
  h.className = "rosette-head";
  h.textContent = "Wardrobe";
  const row = document.createElement("div");
  row.className = "wardrobe";
  const on = outfitFor(data);
  for (const o of OUTFITS) {
    const ok = o.unlocked(data);
    const b = document.createElement("button");
    b.type = "button";
    b.className = `outfit${o === on ? " picked" : ""}`;
    b.disabled = !ok;
    b.setAttribute("aria-pressed", String(o === on));
    const sw = document.createElement("span");
    sw.className = "outfit-pic";
    sw.innerHTML = cathSvg({ framing: "bust", expression: "smirk", outfit: o.art });
    const n = document.createElement("strong");
    n.textContent = ok ? o.name : "Locked";
    const d = document.createElement("small");
    d.textContent = ok ? "" : o.how;
    b.append(sw, n, d);
    b.onclick = () => {
      data.outfit = o.id;
      wear(o);
      save(data);
      ui.cathPortrait.innerHTML = cath("delighted");
      ui.heroFace.innerHTML = cathSvg({ framing: "face", expression: "determined", outfit: o.art });
      renderCathButton();
      sfx.playUpgrade();
      renderWardrobe();
    };
    row.append(b);
  }
  box.append(h, row);
}

function renderCath(): void {
  const { c, level, into, need, xp } = cathState();
  ui.cathPortrait.innerHTML ||= cath("delighted");
  ui.cathTitle.textContent = `Cath, level ${level}`;
  ui.cathXpFill.style.setProperty("--xp", String(into / need));
  const free = freePoints(c, level);
  ui.cathXp.textContent = `${xp} XP · ${need - into} to level ${level + 1} · ${free} skill point${free === 1 ? "" : "s"} to spend. Every level cleared earns XP, and each star earns more.`;
  ui.cathAttrs.replaceChildren();
  for (const a of ATTRS) {
    const n = c.attrs[a.id] ?? 0;
    const li = document.createElement("li");
    li.className = "attr";
    const text = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = a.name;
    const pips = document.createElement("span");
    pips.className = "pips";
    pips.textContent = "●".repeat(n) + "○".repeat(ATTR_CAP - n);
    pips.setAttribute("aria-label", `${n} of ${ATTR_CAP}`);
    const each = document.createElement("small");
    each.textContent = `${a.each} per point`;
    text.append(name, " ", pips, each);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = "+";
    b.disabled = free === 0 || n >= ATTR_CAP;
    b.setAttribute("aria-label", `Raise ${a.name}`);
    b.onclick = () => {
      if (raise(c, level, a.id)) {
        save(data);
        sfx.playUpgrade();
      }
      renderCath();
      renderCathButton();
    };
    li.append(text, b);
    ui.cathAttrs.append(li);
  }
  renderWardrobe();
  ui.cathTalents.replaceChildren();
  const head = document.createElement("h3");
  head.className = "rosette-head";
  head.textContent = "Talents";
  ui.cathTalents.append(head);
  for (const [at, opts] of TALENTS) {
    const row = document.createElement("div");
    row.className = "talent-row";
    const lab = document.createElement("span");
    lab.className = "talent-at";
    lab.textContent = `Lv ${at}`;
    row.append(lab);
    const picked = c.talents[String(at)];
    ([0, 1] as const).forEach((i) => {
      const t = opts[i];
      const b = document.createElement("button");
      b.type = "button";
      b.className = `talent${picked === i ? " picked" : ""}`;
      b.disabled = level < at || picked !== undefined;
      const n = document.createElement("strong");
      n.textContent = t.name;
      const d = document.createElement("small");
      d.textContent = t.blurb;
      b.append(n, d);
      b.setAttribute("aria-pressed", String(picked === i));
      b.onclick = () => {
        if (pickTalent(c, level, at, i)) {
          save(data);
          sfx.playUpgrade();
        }
        renderCath();
        renderCathButton();
      };
      row.append(b);
    });
    ui.cathTalents.append(row);
  }
}

const openAlmanac = setupAlmanac(
  $<HTMLDialogElement>("dlg-almanac"),
  $<HTMLElement>("almanac-tabs"),
  $<HTMLElement>("almanac-list"),
  () => data.seen,
  describeEnemy,
  { box: $<HTMLElement>("almanac-view"), canvas: $<HTMLCanvasElement>("almanac-canvas"), caption: $<HTMLElement>("almanac-caption") },
);
$<HTMLButtonElement>("btn-almanac").addEventListener("click", openAlmanac);
$<HTMLButtonElement>("almanac-close").addEventListener("click", () => $<HTMLDialogElement>("dlg-almanac").close());

ui.btnCath.addEventListener("click", () => {
  renderCath();
  ui.dlgCath.showModal();
});
ui.cathClose.addEventListener("click", () => ui.dlgCath.close());
ui.cathRespec.addEventListener("click", () => {
  respec(cathState().c);
  save(data);
  renderCath();
  renderCathButton();
});

renderLevels();

// ---- replays: watch a finished run again, or share it as a link ----

function watch(r: Replay): void {
  if (USE_3D && !r3d && !r3dSettled) {
    void loadR3D().then(() => {
      r3dSettled = true;
      watch(r);
    });
    return;
  }
  const lv = levelFor(r.setup);
  if (!lv) {
    toast("That replay is for a field this version doesn't have.");
    return;
  }
  dailyDay = null;
  startLevel(lv, r.setup.heroic);
  recorder = null;
  player = new Player(lv, r);
  game = player.game;
  renderer?.reset();
  renderer?.resize(game);
  ui.hudTitle.textContent = `Replay · ${ui.hudTitle.textContent}`;
  ui.replayBar.hidden = false;
  document.documentElement.classList.add("watching");
  hideBubble();
  syncControls();
  renderPanel(true);
}

ui.resultWatch.addEventListener("click", () => {
  if (!lastReplay) return;
  ui.dlgResult.close();
  watch(lastReplay);
});
ui.resultShare.addEventListener("click", async () => {
  if (!lastReplay) return;
  try {
    const url = `${location.origin}${location.pathname}#replay=${await encodeReplay(lastReplay)}`;
    await navigator.clipboard.writeText(url);
    toast("Replay link copied.");
  } catch {
    toast("Couldn't copy the link here.");
  }
});
ui.replayExit.addEventListener("click", () => {
  history.replaceState(null, "", location.pathname + location.search);
  leaveLevel();
});

/** A shared replay link opens straight into the replay. */
async function openSharedReplay(): Promise<void> {
  const m = /^#replay=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (!m) return;
  const r = await decodeReplay(m[1]!);
  if (r === "old") toast("This replay is from an older Hedgerow and can't be played back.");
  else if (r) watch(r);
  else toast("That replay link is damaged.");
}
void openSharedReplay();
