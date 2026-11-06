import { LANDMARKS, landmarkKinds } from "./landmarks";
import "../../../shared/ui/base.css";
import "../../../shared/ui/palette.css";
import { mountWeekChip } from "../../../shared/cath/weekchip";
import "./fonts.css";
import "./tokens.css";
import "./styles.css";
import "./ui/components.css";
import "../../../shared/cath/cath.css";
import { cathSvg, type CathExpression } from "../../../shared/cath/cath";
import { LINE_POSE } from "../../../shared/cath/screenposes";
import { cathSceneSvg, momentForResult } from "../../../shared/cath/scene";
import { growthPlots, harvestAt, occupiedPlots, HARVEST_SECONDS } from "./growth";
import { burst, reducedMotion } from "../../../shared/ui/motion";
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
  heirloomsUnlocked,
  HEIRLOOM_FEE,
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
  twistRule,
  MEGA_FIRST_LEVEL,
  type TwistId,
  bookRound,
  inherentProps,
  canCallEarly,
  drainEvents,
  earlyBonus,
  isBig,
  crownBlock,
  xpBlock,
  XP_T3,
  XP_CROWN,
  makeEnemy,
  isHeavy,
  enemyClass,
  isPlot,
  landmarkAt,
  laneCellsOf,
  hasTwist,
  flooded,
  setPiece,
  pieRadius,
  pieUnlocked,
  place,
  sellValue,
  sendWave,
  waveSpawns,
  specCost,
  specsUnlocked,
  stars as starsOf,
  stepGame,
  neighboursUnlocked,
  rallyUnlocked,
  lastOrdersUnlocked,
  LAST_ORDERS_LEVEL,
  LAST_ORDERS_COOLDOWN,
  NEIGHBOURS_COOLDOWN,
  RALLY_COOLDOWN,
  NEIGHBOURS_FIRST_LEVEL,
  RALLY_FIRST_LEVEL,
  towerAt,
  towerCost,
  towerStats,
  previewStats,
  previewPath,
  pathUpgradeCost,
  towerAllowed,
  plotKind,
  oakAt,
  barnAt,
  OAK_COST,
  upgrade,
  upgradeCost,
  type EnemyClass,
  type TowerKind,
  type EnemyKind,
  type Difficulty,
  type Remix,
  type Game,
  type GameEvent,
  type Level,
  type StoryLine,
  type TargetMode,
  type Tower,
  NO_PERKS,
  isFleet,
} from "./engine";
import { livery, roundBanner, roundLead, roundMix } from "./roundchips";
import { LIVE_CAP, P, PROPERTIES, RUNGS, fvOf, propsOf, type Property } from "./fleet";
import { cardBody, damageLabel, leakReport as fleetLeakReport, lockLine, lossCauses, roundProps, towerBadges, unanswered, vehicleName } from "./counters";
import { roundFor } from "./rounds";
import { fieldCards, initUnlocks, isOpen, markFieldCardSeen, markUnlockSeen, pendingUnlock, type UnlockId } from "./unlocks";
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
import { enemyIcon, img, towerIcon, propIcon } from "./icons";
import { gapAdvice, roundAdvice } from "./advice";
import { barkSpot, type BarkSpot } from "./cathsay";
import { countersFor, needsUpgrade, newThisRound, rosetteSpot, traitsOf, TRAIT_TEXT, type Box, type Trait } from "./intro";
import { enemySilhouette, towerSilhouette, towerTier } from "./sprites";
import { countAt, foldLeaks, tallyTimeline, type LeakRecord, type TallyCounter } from "./tally";
import { PATHS, PATH_TIERS, buildName, hasPaths, legacyPath, pathBlock, topPath, type Path, type PathIndex, type PathKind } from "./paths";
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
  freeAcorns,
  isUnlocked,
  load,
  nextCost,
  perksOf,
  recordStars,
  recordHeroic,
  recordMedal,
  saveRun,
  loadRun,
  clearRun,
  type MedalMode,
  recordEndless,
  recordOrchard,
  recordOrchardDay,
  addSeeds,
  buyHeirloom,
  carryHeirloom,
  recordDaily,
  recordBuild,
  refundAll,
  save,
} from "./store";
import { awardRun, buyPacket, feedCompost, packetCount, spendPacket, COMPOST_FEED, COMPOST_RATE, PACKETS } from "./meta";
import { SHOW_EXTRAS, showFields, showKit, showPacket } from "./show";
import { dailyLevel, dailyRule, dailyScore, dayOf, shareCard } from "./daily";
import { endlessLevel, weekOf } from "./endless";
import { BOONS, orchardLevel, orchardOffers, orchardSeeds, heirloomBoons, HEIRLOOMS, ORCHARD_MAX_DEPTH, type Boon } from "./orchard";
import { Player, Recorder, applyAction, decodeReplay, encodeReplay, restoreRun, rewindToWave, startGame, HOLLOW_SHIFT, type Action, type Replay, type Setup } from "./replay";
import { ROSETTES, newRosettes } from "./rosettes";
import { setupAlmanac } from "./almanac";
import { towerRole, type TowerRole } from "./roles";
import { leakDebrief } from "./debrief";
import { cheer, panic } from "./farmfolk";
import { ringLayout } from "./buildring";
import { depotSvg, entrySide, repMood, repSvg, type RepMood } from "./depot";
import { gateSignRect } from "./theme";
import { KITS } from "./hero";
import { OUTFITS, isUnlocked as outfitUnlocked, outfitFor, shareOutfit, wear, wornOutfit } from "./wardrobe";
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
  buildRing: $<HTMLElement>("build-ring"),
  pieLabel: $<HTMLElement>("pie-label"),
  btnHero: $<HTMLButtonElement>("btn-hero"),
  btnAuto: $<HTMLButtonElement>("btn-auto"),
  heroFace: $<HTMLElement>("hero-face"),
  heroHp: $<HTMLElement>("hero-hp"),
  btnSpeed: $<HTMLButtonElement>("btn-speed"),
  btnPause: $<HTMLButtonElement>("btn-pause"),
  btnSound: $<HTMLButtonElement>("btn-sound"),
  btnMenu: $<HTMLButtonElement>("btn-menu"),
  dlgPause: $<HTMLDialogElement>("dlg-pause"),
  pauseResume: $<HTMLButtonElement>("pause-resume"),
  pauseSound: $<HTMLButtonElement>("pause-sound"),
  pauseLevels: $<HTMLButtonElement>("pause-levels"),
  banner: $<HTMLElement>("banner"),
  toast: $<HTMLElement>("toast"),
  bubble: $<HTMLElement>("bubble"),
  bubbleFace: $<HTMLElement>("bubble-face"),
  bubbleText: $<HTMLElement>("bubble-text"),
  cathSay: $<HTMLElement>("cath-say"),
  cathDock: $<HTMLElement>("cath-dock"),
  cathDockBust: $<HTMLButtonElement>("cath-dock-bust"),
  cathDockLine: $<HTMLElement>("cath-dock-line"),
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
  dlgUnlock: $<HTMLDialogElement>("dlg-unlock"),
  resultTitle: $<HTMLElement>("result-title"),
  resultStars: $<HTMLElement>("result-stars"),
  resultStats: $<HTMLElement>("result-stats"),
  resultNote: $<HTMLElement>("result-note"),
  resultPrimary: $<HTMLButtonElement>("result-primary"),
  resultSecondary: $<HTMLButtonElement>("result-secondary"),
  btnBank: $<HTMLButtonElement>("btn-bank"),
  btnDaily: $<HTMLButtonElement>("btn-daily"),
  btnShow: $<HTMLButtonElement>("btn-show"),
  resultWatch: $<HTMLButtonElement>("result-watch"),
  resultShare: $<HTMLButtonElement>("result-share"),
  replayBar: $<HTMLElement>("replay-bar"),
  replayFill: $<HTMLElement>("replay-fill"),
  replayExit: $<HTMLButtonElement>("replay-exit"),
  btnHeroic: $<HTMLButtonElement>("btn-heroic"),
  bankStars: $<HTMLElement>("bank-stars"),
  dlgBank: $<HTMLDialogElement>("dlg-bank"),
  bankFree: $<HTMLElement>("bank-free"),
  compost: $<HTMLElement>("compost"),
  packets: $<HTMLElement>("packets"),
  compostHead: $<HTMLElement>("compost-head"),
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
// Tower XP arrives with Hedgerow 2 M10: a save that already has progress opens every tier 3 (1,500 XP a kind).
if (!data.xp && Object.keys(data.stars).length) {
  data.xp = {};
  for (const k of Object.keys(TOWERS)) data.xp[k as TowerKind] = XP_T3;
}
wear(outfitFor(data));
ui.hostFace.innerHTML = cath("smirk");
ui.heroFace.innerHTML = cathSvg({ framing: "face", expression: "determined", outfit: art() });

// Plan item 116: `?keyart` is the site poster's frame (scripts/keyart.mjs): the field alone, no HUD, panel,
// controls or Cath's lines (styles.css "key art").
if (new URLSearchParams(location.search).has("keyart")) document.documentElement.dataset.keyart = "";

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
let bubbleFace: CathExpression = "smirk";
/** A tip that waits for the new-unit card to go, so the two never cover the lane together. */
let pendingTip: { id: string; text: string; expression: CathExpression } | null = null;
let introTimer = 0;
/** The last wave that was stacked on early (0 = none this level): a leak soon after names the stacking. */
let stackedWave = 0;
/** The causes a round's leak banners have already named (Fleet: one banner per cause per round), and when the leak slow-motion ends. */
const leakCauses = { wave: -1, seen: new Set<string>() };
let slowUntil = 0;
/** The round last saved for Continue, so each round start saves once. */
let runSavedWave = -1;
/** Which abilities were ready last frame (a tick under the thumb when one comes back). */
const wasReady: Record<Ability, boolean> = { pie: false, neighbours: false, rally: false };
let paused = false;
let aiming = false;
let last = 0;
let acc = 0;
let raf = 0;
let finished = false;
let panelKey = "";
/** Plan item 31: the tower Cath's notebook keeps a page on (the last one looked at). */
let notebookTower: number | null = null;
let earlyCalls = 0;
/** Every leak of this run, in order, for the end tally's replay strip. */
const runLeaks: LeakRecord[] = [];
let startPerkRanks = 0;
let bubbleTimer = 0;
let bannerTimer = 0;

function say(text: string): void {
  ui.announce.textContent = text;
}

/** Crown abilities on the field, in the thumb-reach strip beside Cath's own (one button per crowned tower). */
let lastOrdersBtn: HTMLButtonElement | null = null;
/** Cath's level-10 ability: a tray button that appears once she reaches the level. */
function syncLastOrders(g: Game): void {
  if (!lastOrdersUnlocked(g)) {
    lastOrdersBtn?.remove();
    lastOrdersBtn = null;
    return;
  }
  let b = lastOrdersBtn;
  if (!b) {
    b = document.createElement("button");
    b.type = "button";
    b.className = "ability crown-ability last-orders";
    b.innerHTML = `<span class="ability-ring" aria-hidden="true"></span><span class="crown-glyph" aria-hidden="true">\u{1F37A}</span><span class="ability-label"></span>`;
    b.title = `Last Orders: every Plant on the field takes a hit. Unlocked at Cath's level ${LAST_ORDERS_LEVEL}.`;
    b.onclick = () => {
      if (doAct({ t: "lastOrders" })) {
        sfx.playBoss();
        haptic.boss();
      } else toast("Last Orders isn't ready.");
    };
    ui.btnRally.after(b);
    lastOrdersBtn = b;
  }
  const cd = g.lastOrdersCd;
  b.disabled = g.phase !== "wave" || cd > 0;
  b.classList.toggle("ready", !b.disabled);
  (b.querySelector(".ability-label") as HTMLElement).textContent = cd > 0 ? `${Math.ceil(cd)}s` : "Orders";
  (b.querySelector(".ability-ring") as HTMLElement).style.setProperty("--cd", String(Math.min(1, cd / LAST_ORDERS_COOLDOWN)));
}

const crownTray = new Map<number, HTMLButtonElement>();
function syncCrownTray(g: Game): void {
  syncLastOrders(g);
  const seen = new Set<number>();
  for (const t of g.towers) {
    if (t.crown === undefined || !hasPaths(t.kind)) continue;
    const crown = PATHS[t.kind].paths[t.crown].crown;
    const ab = crown?.ability;
    if (!ab) continue;
    seen.add(t.id);
    let b = crownTray.get(t.id);
    if (!b) {
      b = document.createElement("button");
      b.type = "button";
      b.className = "ability crown-ability";
      b.innerHTML = `<span class="ability-ring" aria-hidden="true"></span><span class="crown-glyph" aria-hidden="true">\u265B</span><span class="ability-label"></span>`;
      b.title = `${ab.name}: ${ab.blurb}`;
      const id = t.id;
      b.onclick = () => {
        if (doAct({ t: "crownUse", id })) {
          sfx.playBoss();
          haptic.boss();
          banner(ab.name, crown!.name, false, "small");
        } else toast(`${ab.name} isn't ready.`);
      };
      ui.btnRally.after(b);
      crownTray.set(t.id, b);
    }
    const cd = t.crownCd ?? 0;
    b.disabled = g.phase !== "wave" || cd > 0;
    b.classList.toggle("ready", !b.disabled);
    (b.querySelector(".ability-label") as HTMLElement).textContent = cd > 0 ? `${Math.ceil(cd)}s` : ab.name;
    (b.querySelector(".ability-ring") as HTMLElement).style.setProperty("--cd", String(Math.min(1, cd / ab.cooldown)));
  }
  for (const [id, b] of crownTray)
    if (!seen.has(id)) {
      b.remove();
      crownTray.delete(id);
    }
}

// ---- level select ----

/** The Continue button: the run saved at its last round start, if there is one for a level that exists. */
function renderContinue(): void {
  const btn = document.getElementById("btn-continue") as HTMLButtonElement | null;
  if (!btn) return;
  const run = loadRun();
  const lv = run ? LEVELS.find((l) => l.id === run.levelId) : undefined;
  btn.hidden = !run || !lv;
  if (!run || !lv) return;
  const word = document.getElementById("continue-word");
  if (word) word.textContent = `Continue: ${lv.name}, round ${run.wave}`;
  btn.onclick = () => {
    const lvl = LEVELS.find((l) => l.id === run.levelId)!;
    toast("Restoring your run…");
    window.setTimeout(() => {
      const back = restoreRun(lvl, run.replay as unknown as Replay);
      startLevel(lvl, back.game.heroic, back);
    }, 50);
  };
}

/** Plan item 3: hide systems a new player hasn't reached yet, and introduce the next one with a card. */
function applyUnlocks(): void {
  const sandbox = new URLSearchParams(location.search).has("sandbox");
  if (initUnlocks(data, LEVELS, MEGA_FIRST_LEVEL)) save(data);
  const show = (id: string, open: boolean): void => {
    const el = document.getElementById(id);
    if (el) el.hidden = !open;
  };
  const o = (id: UnlockId): boolean => isOpen(data, id, sandbox);
  show("btn-almanac", o("almanac"));
  show("select-kits", o("kit"));
  show("btn-daily", o("daily"));
  show("btn-orchard", o("orchard"));
  show("btn-show", o("show"));
  for (const id of ["btn-diff", "btn-remix", "btn-heroic"]) show(id, o("modes"));
  show("btn-modes", o("almanac") || o("modes") || o("orchard") || o("show"));
  const next = pendingUnlock(data, sandbox);
  const dlg = document.getElementById("dlg-unlock") as HTMLDialogElement | null;
  if (!next || !dlg || dlg.open || document.querySelector("dialog[open]")) return;
  $<HTMLElement>("unlock-face").innerHTML = cath("delighted");
  $<HTMLElement>("unlock-eyebrow").textContent = "New on the map";
  $<HTMLElement>("unlock-icon").textContent = next.icon;
  $<HTMLElement>("unlock-title").textContent = next.title;
  $<HTMLElement>("unlock-body").textContent = next.body;
  dlg.dataset.unlock = next.id;
  $<HTMLButtonElement>("unlock-ok").onclick = () => {
    markUnlockSeen(data, next.id);
    save(data);
    dlg.close();
    sfx.playUpgrade();
    applyUnlocks();
  };
  dlg.showModal();
}

function renderLevels(): void {
  ui.bankStars.textContent = String(freeStars(data));
  $<HTMLElement>("daily-new").hidden = data.daily?.[String(dayOf(Date.now()))] !== undefined;
  renderCathButton();
  renderSelectKits();
  renderContinue();
  renderMap(ui.levels, LEVELS, data, (lv) => openLevel(lv), (act) => { dailyDay = null; showRun = null; const week = weekOf(Date.now()); endlessArgs = { act, week }; startLevel(endlessLevel(act, week), false); }, new URLSearchParams(location.search).has("sandbox"));
  applyUnlocks();
  // Plan item 18: the map is the screen. Cath's line and the kit ride at the top of the scrolling world
  // (renderMap replaces the list, so the row goes back in each time), and the glass header floats over it.
  hudRow ??= Object.assign(document.createElement("li"), { className: "map-hud-row" });
  hudRow.append($<HTMLElement>("map-hud"));
  ui.levels.prepend(hudRow);
  const top = document.querySelector<HTMLElement>("#screen-select > .top");
  if (top) ui.levels.style.setProperty("--top-h", `${top.offsetHeight}px`);
}
let hudRow: HTMLLIElement | null = null;

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
  // Plan item 27: each figure wipes in from its own side when it first steps on stage (a fade under reduced motion).
  const enter = (el: HTMLElement) => {
    el.classList.remove("enter");
    void el.offsetWidth;
    el.classList.add("enter");
  };
  const showOther = () => {
    ui.storyRight.innerHTML = other ? castSvg(other, "half") : "";
    ui.storyRight.hidden = !other;
    ui.storyRight.dataset.who = other ?? "";
    if (other) enter(ui.storyRight);
  };
  showOther();
  enter(ui.storyLeft);
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
    ui.storyLeft.innerHTML = cathSvg({ framing: "half", expression: line.who === "cath" ? (line.expression ?? "smirk") : "smirk", pose: line.who === "cath" ? LINE_POSE[line.expression ?? "smirk"] : "clasped", animate: true, outfit: art() });
    ui.storyLeft.classList.toggle("speaking", line.who === "cath");
    ui.storyRight.classList.toggle("speaking", line.who === other);
    // A pose per line: the speaker's body language follows what they say, and the backdrop drifts a little each line.
    const pose = line.who === "cath" ? ({ determined: "lean", worried: "shrink", delighted: "hop", wink: "tilt", smirk: "ease" } as const)[line.expression ?? "smirk"] : /!/.test(line.text) ? "hop" : /\?/.test(line.text) ? "tilt" : "lean";
    const speaker = line.who === "cath" ? ui.storyLeft : ui.storyRight;
    for (const el of [ui.storyLeft, ui.storyRight]) delete el.dataset.pose;
    if (line.who !== "narrator") {
      void speaker.offsetWidth;
      speaker.dataset.pose = pose;
    }
    ui.storyBg.style.setProperty("--pan", `${(i % 3) * -1.5}%`);
    ui.storySpeech.dataset.who = line.who;
    ui.storySpeech.classList.toggle("from-right", line.who !== "cath" && line.who !== "narrator");
    ui.storySpeech.classList.toggle("caption", line.who === "narrator");
    // The line wipes in like the next panel, from the speaker's side.
    ui.storySpeech.classList.remove("wipe");
    void ui.storySpeech.offsetWidth;
    ui.storySpeech.classList.add("wipe");
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
  const skip = () => {
    finishTyping();
    ui.dlgStory.close();
    done();
  };
  ui.storySkip.onclick = skip;
  // Keyboard: Escape skips the scene (it used to close the dialog without starting the level); the arrow keys
  // and Space step on like Next (Enter on the focused Next button already does).
  ui.dlgStory.oncancel = (e) => {
    e.preventDefault();
    skip();
  };
  ui.dlgStory.onkeydown = (e) => {
    if (e.key === "ArrowRight" || (e.key === " " && !(document.activeElement instanceof HTMLButtonElement))) {
      e.preventDefault();
      ui.storyNext.click();
    }
  };
  show();
  if (!ui.dlgStory.open) {
    ui.dlgStory.showModal();
    ui.storyNext.focus();
  }
}

const actOf = (lv: Level) => Math.floor((lv.id - 1) / 10) + 1;

function openLevel(lv: Level): void {
  dailyDay = null;
  showRun = null;
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
  (window as unknown as { hedgerow: object }).hedgerow = {
    game: () => game,
    place,
    upgrade,
    merge,
    sendWave,
    // Plan item 27: open a level's opening scene straight from the hook (each act's opener for shots and e2e).
    story: (id: number) => {
      const lv = LEVELS.find((l) => l.id === id);
      if (lv) showStory(lv.before, lv.place, () => {}, actOf(lv));
    },
    spawn: (kind: EnemyKind, dist: number) => game && game.enemies.push(makeEnemy(game, kind, dist, undefined, game.wave || 1)),
    cellCenter: (c: number, r: number) => renderer?.cellCenter(c, r) ?? null,
    // Plan item 66: the share of the 3D frame's height that is painted sky (null in 2D).
    skyBand: () => (renderer && is3D(renderer) ? renderer.skyBand() : null),
    fieldShare: () => (renderer && is3D(renderer) ? renderer.fieldShare() : null),
    // Plan item 102: Cath's face on screen (CSS px), null in 2D.
    faceBox: () => (renderer && is3D(renderer) ? renderer.faceBox() : null),
    // Plan item 114: Cath's drawn size in 2D (null in 3D).
    heroPx: () => (renderer as { heroPx?: () => { h: number; w: number } } | null)?.heroPx?.() ?? null,
    heroMood: () => (renderer as { heroMood?: string } | null)?.heroMood ?? null,
    // Plan item 162: her face's and hair's brightness in 3D (null in 2D).
    faceTone: () => (renderer && is3D(renderer) ? renderer.faceTone() : null),
    // Plan item 98: the 3D gate signs' letter height on screen (null in 2D).
    gateSigns: () => (renderer && is3D(renderer) ? renderer.gateSigns() : null),
    // Plan item 45: the 2D renderer's convoy (null in 3D).
    convoy: () => (renderer as { convoyStats?: () => unknown } | null)?.convoyStats?.() ?? null,
    // Plan item 72: the gate queue the field drew last frame (leads and count plates, CSS px), null when none.
    gateQueue: () => (renderer as { shownQueue?: unknown } | null)?.shownQueue ?? null,
    // Plan item 160: true once the 3D camera has let go of the gate (a boss queue's look) and stands still; true in 2D.
    camSettled: () => (renderer && is3D(renderer) ? renderer.camSettled() : true),
    // Plan item 132: the 3D gate signs' boards (canvas px, like gateQueue); empty in 2D.
    // Plan item 157: the 3D depots (canvas px and world footprint); empty in 2D.
    depots3d: () => (renderer && is3D(renderer) ? renderer.depotRects() : []),
    dressing3d: () => (renderer && is3D(renderer) ? renderer.dressing() : null),
    cam3d: () => (renderer && is3D(renderer) ? renderer.camState() : null),
    biome3d: () => (renderer && is3D(renderer) ? renderer.biome : null),
    depotShutter3d: () => (renderer && is3D(renderer) ? renderer.depotShutter() : null),
    gateSignBoxes: () => (renderer as { gateSignRects?: () => unknown[] } | null)?.gateSignRects?.() ?? [],
    // Plan item 31: the range ring the 2D field drew last frame (tests compare it with the tower's range).
    ring: () => (renderer && "shownRing" in renderer ? renderer.shownRing : null),
    // Plan item 156: a tower's tier-1 range (cells) on the selected plot's ground, to check the build ring's preview.
    towerRange: (kind: TowerKind) =>
      towerStats({ kind, tier: 1, spec: null, high: !!game && !!selected && plotKind(game.level, selected.col, selected.row) === "high" }).range,
    // Plan item 52: a tower's tier-1 silhouette mask at a cell size (tests keep them apart at 24 px).
    silhouette: towerSilhouette,
    // Plan item 105: a vehicle's 2D silhouette and drawn length at a cell size.
    enemySilhouette,
    // Plan item 64: pin a round-end rosette now (e2e checks it covers no plot), and the plot cells' boxes.
    rosette: (round: number, reward: number, clean: boolean) => game && roundRosette(game, round, reward, clean),
    plotBoxes: () => (game ? plotBoxes(game) : []),
    // Plan item 135: Cath's debrief as if a vehicle of this kind had just got through.
    debrief: (kind: EnemyKind) => {
      if (!game) return;
      // Plan item 143: a leak sends the farmfolk running, as a real one would.
      if (renderer?.farm.world) panic(renderer.farm.world);
      debriefLeaks(game, kind);
    },
    // Plan item 143: set the farmfolk cheering or running, as a cleared round or a leak would.
    folkDo: (what: "cheer" | "panic") => {
      const w = renderer?.farm.world;
      if (w) (what === "cheer" ? cheer : panic)(w);
    },
    // Plan item 143: the farmfolk (cell units, mode), as the renderer last drew them.
    folk: () => {
      if (!renderer || !game) return [];
      const lanes = laneCellsOf(game.level);
      return renderer.shownFolk.map((f) => ({ kind: f.kind, x: f.x, y: f.y, mode: f.mode, moving: f.moving, tending: f.tending, onLane: lanes.has(`${Math.floor(f.x)},${Math.floor(f.y)}`) }));
    },
    // Plan item 114: Cath's box on screen (client px, like plotBoxes).
    cathBox: () => {
      const f = ui.stage.getBoundingClientRect();
      const b = game && renderer ? cathBox(game, f) : null;
      return b && { ...b, x: b.x + f.left, y: b.y + f.top };
    },
    // Plan item 95: Cath's advice bubble on the field (field px), her figure, and the lane cells' boxes.
    cathSay: () => {
      if (!sayShown || !game) return null;
      const f = ui.stage.getBoundingClientRect();
      // Plan item 120: the empty plots in the bubble's own field px.
      const empty = emptyPlotBoxes(game).map((p) => ({ ...p, x: p.x - f.left, y: p.y - f.top }));
      return { ...sayShown, lanes: laneBoxes(game), empty };
    },
    // After setting a field up through the hook: redraw the panel and controls as a tap would have.
    refresh: () => {
      renderPanel(true);
      syncControls();
    },
  };
// Sandbox only: `?sandbox=1&level=N` jumps straight into level N (screenshots of each act's biome).
if (SANDBOX) {
  const jump = Number(new URLSearchParams(location.search).get("level"));
  const target = LEVELS.find((l) => l.id === jump);
  if (target) setTimeout(() => startLevel(target, false), 300);
}

$<HTMLButtonElement>("btn-orchard").addEventListener("click", startOrchard);

/** The Heroic toggle on the level map: the next level starts with one Goodwill and no pies. */
let heroicMode = false;
ui.btnHeroic.addEventListener("click", () => {
  heroicMode = !heroicMode;
  ui.btnHeroic.setAttribute("aria-pressed", String(heroicMode));
  ui.btnHeroic.classList.toggle("on", heroicMode);
});

/** The difficulty button on the level map: Easy, Normal or Hard for the next Fleet level (Hollow is Heroic). */
const DIFFS: Difficulty[] = ["easy", "normal", "hard"];
let difficultyMode: Difficulty = "normal";
{
  const btn = document.getElementById("btn-diff") as HTMLButtonElement | null;
  const word = document.getElementById("diff-word");
  btn?.addEventListener("click", () => {
    difficultyMode = DIFFS[(DIFFS.indexOf(difficultyMode) + 1) % DIFFS.length]!;
    const name = difficultyMode[0]!.toUpperCase() + difficultyMode.slice(1);
    if (word) word.textContent = name;
    btn.setAttribute("aria-label", `Difficulty: ${name}`);
    btn.classList.toggle("on", difficultyMode !== "normal");
  });
}

/** The remix button: no remix, Hand Tools or Lean Year (Fleet levels). */
const REMIXES: (Remix | null)[] = [null, "hand", "lean", "long"];
const REMIX_NAMES = { hand: "Hand Tools", lean: "Lean Year", long: "Long Haul" } as const;
let remixMode: Remix | null = null;
{
  const btn = document.getElementById("btn-remix") as HTMLButtonElement | null;
  const word = document.getElementById("remix-word");
  btn?.addEventListener("click", () => {
    remixMode = REMIXES[(REMIXES.indexOf(remixMode) + 1) % REMIXES.length] ?? null;
    const name = remixMode ? REMIX_NAMES[remixMode] : "No remix";
    if (word) word.textContent = name;
    btn.setAttribute("aria-label", `Remix: ${name}`);
    btn.classList.toggle("on", remixMode !== null);
  });
}

/** Set while a daily challenge is on: the day number. Perks are off so scores compare. */
let dailyDay: number | null = null;
ui.btnDaily.addEventListener("click", () => {
  const day = dayOf(Date.now());
  dailyDay = day;
  startLevel(dailyLevel(day), false);
});

/** The weekly County Show in progress: three fields and a Goodwill purse that carries over. No replay, no Seed Bank. */
type ShowRun = { week: number; field: number; carry: number | null; picks: TowerKind[] };
let showRun: ShowRun | null = null;
let lastPicks: TowerKind[] = [];
/** The draft: the Show's kit is the core four plus two towers picked here. */
ui.btnShow.addEventListener("click", () => {
  dailyDay = null;
  const week = weekOf(Date.now());
  const chosen = new Set<TowerKind>(lastPicks);
  ui.resultCath.innerHTML = cath("smirk");
  ui.resultEyebrow.textContent = "County Show";
  ui.resultTitle.textContent = "Pack your stall.";
  ui.resultStats.textContent = "Three fields, one Goodwill purse. You bring the Scarecrow, Hedgerow, Beehive and Seed Cannon; pick two more.";
  ui.resultNote.textContent = "Win all three for a Seed Packet.";
  ui.resultStars.setAttribute("aria-label", "");
  ui.resultWatch.hidden = ui.resultShare.hidden = true;
  const chips = SHOW_EXTRAS.map((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "show-pick";
    b.dataset.kind = k;
    b.textContent = TOWERS[k].name;
    b.setAttribute("aria-pressed", String(chosen.has(k)));
    b.onclick = () => {
      if (chosen.has(k)) chosen.delete(k);
      else if (chosen.size < 2) chosen.add(k);
      for (const c of chips) c.setAttribute("aria-pressed", String(chosen.has(c.dataset.kind as TowerKind)));
      ui.resultPrimary.disabled = chosen.size !== 2;
    };
    return b;
  });
  ui.resultStars.replaceChildren(...chips);
  ui.resultPrimary.textContent = "Enter the Show";
  ui.resultPrimary.disabled = chosen.size !== 2;
  ui.resultPrimary.onclick = () => {
    ui.resultPrimary.disabled = false;
    ui.dlgResult.close();
    lastPicks = [...chosen];
    showRun = { week, field: 0, carry: null, picks: lastPicks };
    startLevel(showFields(week, lastPicks)[0]!, false);
  };
  ui.resultSecondary.onclick = () => {
    ui.resultPrimary.disabled = false;
    ui.dlgResult.close();
  };
  ui.dlgResult.classList.remove("lost");
  ui.dlgResult.showModal();
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

/** The daily ghost: your best run's tower placements as translucent icons on cells that are still empty. */
const ghostEls = new Map<string, HTMLImageElement>();
function drawGhost(g: Game): void {
  const spots = dailyDay !== null && !player ? data.ghosts?.[String(dailyDay)] : undefined;
  const live = new Set<string>();
  if (spots && g.phase !== "won" && g.phase !== "lost") {
    for (const [kind, col, row] of spots) {
      const key = `${col},${row}`;
      if (g.towers.some((t) => t.col === col && t.row === row)) continue;
      const at = renderer?.cellCenter(col, row);
      if (!at) continue;
      live.add(key);
      let el = ghostEls.get(key);
      if (!el) {
        el = img(towerIcon(kind as TowerKind), "daily-ghost");
        document.body.append(el);
        ghostEls.set(key, el);
      }
      el.style.setProperty("left", `${at.x}px`);
      el.style.setProperty("top", `${at.y}px`);
    }
  }
  for (const [key, el] of ghostEls) if (!live.has(key)) { el.remove(); ghostEls.delete(key); }
}

/** Every input goes through here: applied, and recorded for the replay. Nothing is accepted while watching. */
function doAct(a: Action): boolean {
  if (!game || player) return false;
  const g = game;
  return act(() => (recorder ? recorder.act(g, a) : applyAction(g, a)));
}

/**
 * Starts a level. With `resume`, play picks up from a rewound run instead (Retry from round N): the field, the
 * purse and the recorder exactly as they stood before the lost round was sent.
 */
function startLevel(lv: Level, heroic = heroicMode, resume?: { game: Game; recorder: Recorder }): void {
  for (const b of crownTray.values()) b.remove();
  crownTray.clear();
  document.querySelector(".harvest")?.remove();
  if (renderer) renderer.harvesting = false;
  // First level of the visit: wait for the 3D chunk (usually already prefetched), then start.
  if (USE_3D && !r3d && !r3dSettled) {
    void loadR3D().then(() => {
      r3dSettled = true;
      startLevel(lv, heroic, resume);
    });
    return;
  }
  const setup: Setup = {
    mode: dailyDay !== null ? "daily" : lv.endless ? "endless" : "level",
    id: dailyDay ?? (lv.endless ? (endlessArgs?.act ?? 0) : lv.id),
    ...(lv.endless ? { week: endlessArgs?.week ?? 0 } : {}),
    heroic: heroic && !lv.endless,
    ...(heroic && !lv.endless && lv.rules === "fleet" ? { shift: HOLLOW_SHIFT } : {}),
    difficulty: resume ? resume.game.difficulty : lv.endless ? "normal" : dailyDay !== null ? dailyRule(dailyDay).difficulty : difficultyMode,
    ...(!resume && !lv.endless && dailyDay === null && remixMode ? { remix: remixMode } : !resume && dailyDay !== null && dailyRule(dailyDay).remix ? { remix: dailyRule(dailyDay).remix! } : resume?.game.remix ? { remix: resume.game.remix } : {}),
    perks: dailyDay !== null || showRun ? NO_PERKS : perksOf(data),
  };
  // One-on-one boss duels are a player's moment (on in startGame); the tuner and sims never see them.
  game = resume?.game ?? startGame(lv, setup);
  if (showRun?.carry != null) game.goodwill = Math.min(game.maxGoodwill, Math.max(1, showRun.carry));
  if (!SANDBOX && dailyDay === null && !showRun) game.xpGate = data.xp ??= {};
  recorder = resume?.recorder ?? (SANDBOX || showRun ? null : new Recorder(setup));
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
  leakCauses.wave = -1;
  leakCauses.seen.clear();
  runLeaks.length = 0;
  slowUntil = 0;
  runSavedWave = -1;
  panelKey = "";
  earlyCalls = 0;
  stackedWave = 0;
  const story = !lv.endless && dailyDay === null;
  autoNext = game.remix === "long" || keepGoingFor(data, story ? lv.id : KEEP_GOING_FROM);
  autoLeft = AUTO_SECS;
  ui.btnAuto.hidden = story && lv.id < KEEP_GOING_FROM;
  maxSpeed = story ? fastestSpeed(data, lv.id) : 3;
  if (speed > maxSpeed) speed = maxSpeed;
  // Abilities the player has put on Auto (earned by casting each by hand three times).
  // (A resumed run already has them in its log.)
  if (!SANDBOX && !resume) for (const a of ABILITIES) if (autoOn(data, a)) doAct({ t: "auto", ability: a, on: true });
  for (const a of ABILITIES) wasReady[a] = false;
  startPerkRanks = Object.values(data.bank).reduce((a, b) => a + b, 0);
  ui.select.hidden = true;
  ui.play.hidden = false;
  ui.hudTitle.textContent = `${game.heroic ? "◆ " : ""}${lv.endless ? "∞" : `${lv.id}.`} ${lv.name}`;
  ui.hudPlace.textContent = dailyDay !== null && game.level.rules === "fleet" && dailyRule(dailyDay).name !== "Plain day" ? `${lv.place} · ${dailyRule(dailyDay).name}` : lv.place;
  renderer ??= USE_3D && r3d ? new r3d.Renderer3D(ui.canvas, $<HTMLElement>("fx-layer")) : new Renderer(ui.canvas);
  document.documentElement.classList.toggle("hedgerow-3d", is3D(renderer));
  renderer.reset();
  renderer.selected = null;
  renderer.heroSelected = false;
  renderer.aim = null;
  renderer.cursor = { col: 0, row: 0 };
  hideBubble();
  ui.intro.hidden = true;
  clearTimeout(introTimer);
  introHold = false;
  introQueue = null;
  pendingTip = null;
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
  // Plan item 128: a level's first visit traces its lanes first, then Cath's tips follow.
  // (Decided on the next tick: a replay link sets its player just after startLevel returns, and plays no fly-in.)
  if (!resume && wantsFlyIn(lv))
    window.setTimeout(() => {
      if (game?.level.id === lv.id && !player) laneFlyIn(lv, () => levelTips(lv));
      else levelTips(lv);
    }, 0);
  else levelTips(lv);
}

/** Plan item 128: the fly-in plays once a level, on a story level; `?flyin` forces it (tests and shots), and
 *  `?flyin=once` keeps the once-a-level rule even in the sandbox (the reload test). */
const FLYIN_PARAM = new URLSearchParams(location.search).get("flyin");
function wantsFlyIn(lv: Level): boolean {
  if (FLYIN_PARAM === "once") return !data.seen[`flyin:${lv.id}`];
  if (FLYIN_PARAM !== null) return true;
  if (SANDBOX || lv.endless || dailyDay !== null || showRun || player) return false;
  return !data.seen[`flyin:${lv.id}`];
}

/**
 * Plan item 128: where the vehicles come from. The field dims, and from each Hollowell gate a runner carrying the
 * level's lead vehicle travels the lane to the farmhouse, drawing it as it goes (about 2.5 s); Cath then names the
 * threat. A tap or a key skips it. Drawn over the field from the renderer's own cell centres, so 2D and 3D share it.
 */
function laneFlyIn(lv: Level, done: () => void): void {
  const g = game;
  if (!g || !renderer) return done();
  const field = ui.stage.getBoundingClientRect();
  const lanes = [lv.path, lv.path2].filter((p): p is Level["path"] => !!p && p.length > 1);
  const pts = lanes.map((path) => path.map(([c, r]) => renderer!.cellCenter(c, r)).filter((q): q is { x: number; y: number } => !!q).map((q) => ({ x: q.x - field.left, y: q.y - field.top })));
  if (!field.width || pts.some((p) => p.length < 2)) return done();
  data.seen[`flyin:${lv.id}`] = true;
  save(data);
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "flyin");
  svg.setAttribute("viewBox", `0 0 ${field.width} ${field.height}`);
  svg.setAttribute("aria-hidden", "true");
  const runners: Array<{ line: SVGPolylineElement; dot: SVGGElement; pts: { x: number; y: number }[]; len: number; seg: number[] }> = [];
  pts.forEach((p, i) => {
    const line = document.createElementNS(NS, "polyline");
    line.setAttribute("class", "flyin-trail");
    line.setAttribute("points", p.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" "));
    const seg = p.slice(1).map((q, k) => Math.hypot(q.x - p[k]!.x, q.y - p[k]!.y));
    const len = seg.reduce((a, b) => a + b, 0);
    line.setAttribute("stroke-dasharray", `${len}`);
    line.setAttribute("stroke-dashoffset", `${len}`);
    const dot = document.createElementNS(NS, "g");
    dot.setAttribute("class", "flyin-runner");
    const lead = lv.waves[0]?.find((w) => (w.lane === 1) === (i === 1))?.enemy ?? lv.waves[0]?.[0]?.enemy;
    dot.innerHTML = `<circle r="17"/>${lead ? `<image href="${enemyIcon(lead)}" x="-14" y="-14" width="28" height="28"/>` : ""}`;
    svg.append(line, dot);
    runners.push({ line, dot, pts: p, len, seg });
  });
  ui.stage.append(svg);
  ui.stage.dataset.flyin = "on";
  const dur = REDUCED ? 600 : 2500;
  const t0 = performance.now();
  let raf = 0;
  let over = false;
  const place = (f: number) => {
    for (const r of runners) {
      let d = f * r.len;
      let k = 0;
      while (k < r.seg.length - 1 && d > r.seg[k]!) d -= r.seg[k++]!;
      const a = r.pts[k]!, b = r.pts[k + 1]!;
      const u = r.seg[k] ? Math.min(1, d / r.seg[k]!) : 1;
      r.dot.setAttribute("transform", `translate(${(a.x + (b.x - a.x) * u).toFixed(1)} ${(a.y + (b.y - a.y) * u).toFixed(1)})`);
      r.line.setAttribute("stroke-dashoffset", (r.len * (1 - f)).toFixed(1));
    }
  };
  const finish = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    removeEventListener("keydown", skip, true);
    svg.remove();
    delete ui.stage.dataset.flyin;
    if (game === g) {
      const gate = lv.id >= 81 ? "Hollowcandor" : lv.id >= 41 ? "Candor" : "Hollowell";
      // Spoken from where she stands on the field (placed clear of the empty plots), not the corner card.
      const line = lanes.length > 1 ? `Two gates today: ${gate} comes in at both and they meet at the farm. Cover where the lanes join.` : `${gate} comes in at the gate and follows the lane to the farm. Build where it bends.`;
      sayOverride = { text: line, until: performance.now() + Math.max(5000, line.length * 70) };
      say(`Cath: ${line}`);
    }
    done();
  };
  const skip = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key === "Tab") return;
    e.preventDefault();
    finish();
  };
  svg.addEventListener("pointerdown", skip);
  addEventListener("keydown", skip, true);
  const step = (now: number) => {
    const f = Math.min(1, (now - t0) / dur);
    place(1 - (1 - f) ** 2);
    if (f < 1) raf = requestAnimationFrame(step);
    else window.setTimeout(finish, 250);
  };
  place(0);
  raf = requestAnimationFrame(step);
}

function leaveLevel(): void {
  dailyDay = null;
  orchardRun = null;
  for (const el of ghostEls.values()) el.remove();
  ghostEls.clear();
  showRun = null;
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
  if (!ui.intro.hidden) {
    pendingTip = { id, text, expression };
    return;
  }
  bubbleTip = id;
  bubbleFace = expression;
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

/** Plan item 3: the first field with a twist (or with Heirloom forging) stops for one card from Cath. */
const TWIST_ICON: Record<TwistId, string> = { night: "🌙", rain: "🌧", wind: "🌬", fog: "🌫", drought: "☀", air: "🪂", market: "🧺", tight: "🪙", crowd: "👥", rush: "⏩", fast: "💨", armoured: "🛡", fortified: "🏰", protected: "🌼", nocath: "🧺", noscarecrow: "🚫" };

function fieldCardText(lv: Level, id: string): { icon: string; title: string; body: string } {
  if (id === "heirloom")
    return {
      icon: "👑",
      title: "Heirlooms",
      body: "Two crowned towers standing side by side can be forged into one Heirloom, the strongest thing on a field. Only one stands per field. Tap a crowned tower to see what it would become.",
    };
  const t = id.slice("twist:".length) as TwistId;
  return { icon: TWIST_ICON[t] ?? "⚑", title: TWISTS[t].name, body: `${twistRule(lv, t)} It's written under the field's name on the map, so you'll see it coming next time.` };
}

function showFieldCards(lv: Level, ids: string[]): void {
  const dlg = document.getElementById("dlg-unlock") as HTMLDialogElement | null;
  if (!dlg || !ids.length || game?.level.id !== lv.id) return;
  // Wait for the story or another sheet to close first.
  if (dlg.open || document.querySelector("dialog[open]")) {
    window.setTimeout(() => showFieldCards(lv, ids), 500);
    return;
  }
  const [id, ...rest] = ids as [string, ...string[]];
  const c = fieldCardText(lv, id);
  $<HTMLElement>("unlock-face").innerHTML = cath(id === "heirloom" ? "delighted" : "determined");
  $<HTMLElement>("unlock-eyebrow").textContent = "New on this field";
  $<HTMLElement>("unlock-icon").textContent = c.icon;
  $<HTMLElement>("unlock-title").textContent = c.title;
  $<HTMLElement>("unlock-body").textContent = c.body;
  dlg.dataset.unlock = id;
  $<HTMLButtonElement>("unlock-ok").onclick = () => {
    markFieldCardSeen(data, id);
    save(data);
    dlg.close();
    if (rest.length) window.setTimeout(() => showFieldCards(lv, rest), 250);
  };
  dlg.showModal();
}

function levelTips(lv: Level): void {
  // A twist or system met for the first time gets a card; after that, the twist banner up front, because
  // it's what makes this level a different problem.
  const story = !lv.endless && dailyDay === null && showRun === null;
  const cards = story && !player ? fieldCards(data, lv, MEGA_FIRST_LEVEL, SANDBOX) : [];
  if (cards.length) window.setTimeout(() => showFieldCards(lv, cards), 400);
  else if (lv.twists?.length)
    window.setTimeout(() => {
      if (game?.level.id !== lv.id) return;
      banner(lv.twists!.map((t) => TWISTS[t].name).join(" · "), lv.twists!.map((t) => twistRule(lv, t)).join(" "), false, "rule");
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
  ui.pauseSound.setAttribute("aria-pressed", String(!sfx.isMuted()));
  ui.pauseSound.textContent = sfx.isMuted() ? "Sound off" : "Sound on";
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
  ui.pieRing.style.setProperty("--p", String(1 - Math.min(1, cdFrac)));
  ui.btnNeighbours.hidden = !neighboursUnlocked(g.level);
  ui.btnNeighbours.disabled = g.phase !== "wave" || g.neighboursCd > 0 || g.enemies.length === 0;
  ui.btnNeighbours.classList.toggle("ready", !ui.btnNeighbours.disabled);
  ui.neighboursLabel.textContent = g.neighboursCd > 0 ? `${Math.ceil(g.neighboursCd)}s` : "Neighbours";
  ui.neighboursRing.style.setProperty("--p", String(1 - Math.min(1, g.neighboursCd / NEIGHBOURS_COOLDOWN)));
  ui.btnRally.hidden = !rallyUnlocked(g.level);
  ui.btnRally.disabled = g.phase !== "wave" || g.rallyCd > 0 || g.towers.length === 0;
  ui.btnRally.classList.toggle("ready", !ui.btnRally.disabled);
  ui.rallyLabel.textContent = g.rallyLeft > 0 ? "Go!" : g.rallyCd > 0 ? `${Math.ceil(g.rallyCd)}s` : "Rally";
  ui.rallyRing.style.setProperty("--p", String(1 - Math.min(1, g.rallyCd / RALLY_COOLDOWN)));
  const buttons: Record<Ability, HTMLButtonElement> = { pie: ui.btnPie, neighbours: ui.btnNeighbours, rally: ui.btnRally };
  for (const a of ABILITIES) {
    const b = buttons[a];
    ui.autoBadge[a].hidden = !g.auto[a];
    b.classList.toggle("on-auto", g.auto[a]);
    const ready = !b.hidden && b.classList.contains("ready");
    if (ready && !wasReady[a] && g.phase === "wave" && !g.auto[a]) haptic.ready();
    wasReady[a] = ready;
  }
  syncCrownTray(g);
  const h = g.hero;
  ui.btnHero.classList.toggle("down", h.down > 0);
  const heroName = ui.btnHero.querySelector<HTMLElement>(".ability-label");
  if (heroName) {
    const text = isFleet(g.level) && h.level > 1 ? `Cath Lv ${h.level}` : "Cath";
    if (heroName.textContent !== text) heroName.textContent = text;
  }
  const hpFrac = h.down > 0 ? 0 : h.hp / h.maxHp;
  ui.heroHp.style.setProperty("--p", hpFrac.toFixed(3));
  ui.heroHp.classList.toggle("low", hpFrac < 0.35);
  ui.btnHero.setAttribute(
    "aria-label",
    h.down > 0
      ? `Cath is catching her breath, back in ${Math.ceil(h.down)} seconds`
      : `Cath, level ${h.level}, ${Math.round(h.hp)} of ${h.maxHp} health, ${h.kills} knockouts. She holds her post; move her between waves.`,
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
        ? `${Word(g)} ${waveNo(g, g.wave + 1)} in ${Math.ceil(autoLeft)}`
        : g.wave === 0
          ? "Go"
          : `Go: ${waveWord(g)} ${waveNo(g, g.wave + 1)}`
      : early
        ? `Next +${earlyBonus(g)}`
        : g.phase === "wave"
          ? `${Word(g)} ${waveNo(g, g.wave)}/${lastNo(g)}`
          : g.phase === "won" || g.phase === "lost"
            ? "Level over"
            : `Last ${waveWord(g)}`;
  // A long status ("Round 18 in 2") sets smaller on a narrow phone's pill rather than running off it.
  ui.btnSend.classList.toggle("long", (ui.btnSend.textContent ?? "").length > 9);
  ui.btnSend.setAttribute(
    "aria-label",
    early ? `Stack ${waveWord(g)} ${waveNo(g, g.wave + 1)} on now for ${earlyBonus(g)} bonus Marks` : (ui.btnSend.textContent ?? "").replace("/", " of "),
  );
  // Choosing something (a plot, Cath's new post, a pie's aim) holds the Keep Going countdown: say so.
  ui.chooseChip.hidden = !(counting && (selected || posting || aiming) && !player);
}

/** The selected fleet tower's Knockouts and Marks earned, ticking live in its panel. */
function syncKnockouts(): void {
  const el = document.querySelector<HTMLElement>(".ko-line");
  if (!el || !game) return;
  const t = game.towers.find((x) => String(x.id) === el.dataset.tower);
  if (!t) return;
  const n = Math.floor(t.ko ?? 0);
  const big = el.querySelector(".ko-n")!;
  const text = n.toLocaleString("en-GB");
  if (big.textContent !== text) {
    big.textContent = text;
    el.querySelector(".ko-m")!.textContent = `· ${text} Marks earned`;
  }
}

/**
 * One word for one count (M2 review): fleet levels number the Round Book's rounds ("Round 6 of 13"), classic
 * levels their own waves. `w` is the level's wave (1-based); the result is what the player sees.
 */
function waveWord(g: Game): string {
  return isFleet(g.level) ? "round" : "wave";
}
function Word(g: Game): string {
  return isFleet(g.level) ? "Round" : "Wave";
}
function waveNo(g: Game, w: number): number {
  return isFleet(g.level) ? bookRound(g.level, w) : w;
}
function lastNo(g: Game): number {
  return isFleet(g.level) && g.level.book ? g.level.book.to : g.level.waves.length;
}

const shown = { goodwill: -1, marks: -1, wave: "", bumped: 0, goodBumped: 0 };
/** The next value a rolling counter shows on its way up: about 350 ms to arrive at 60 fps, never a jump. */
const rollTowards = (from: number, to: number): number => from + Math.max(1, Math.ceil((to - from) * 0.3));
function updateHud(): void {
  if (!game) return;
  const g = game;
  syncKnockouts();
  if (g.goodwill !== shown.goodwill) {
    const now = performance.now();
    // A leak shakes the heart and snaps down; mending rolls up like the purse (reduced motion: straight there).
    if (shown.goodwill > g.goodwill) bump(ui.hudGoodwill.parentElement!, "hurt");
    else if (shown.goodwill >= 0 && now - shown.goodBumped > 90) {
      bump(ui.hudGoodwill.parentElement!, "gain");
      shown.goodBumped = now;
    }
    const rolling = shown.goodwill >= 0 && g.goodwill > shown.goodwill && !player && !reducedMotion();
    shown.goodwill = rolling ? rollTowards(shown.goodwill, g.goodwill) : g.goodwill;
    ui.hudGoodwill.textContent = String(shown.goodwill);
  }
  if (g.marks !== shown.marks) {
    const now = performance.now();
    if (shown.marks >= 0 && g.marks > shown.marks && now - shown.bumped > 600) {
      bump(ui.hudMarks.parentElement!, "gain");
      shown.bumped = now;
    }
    // Spending ticks the coin in brass (not the clay of a hurt).
    if (shown.marks >= 0 && g.marks < shown.marks) bump(ui.hudMarks.parentElement!, "spend");
    // Fleet pops pay a Mark a layer: the counter rolls up towards the purse rather than jumping (spending
    // snaps straight down).
    const rolling = isFleet(g.level) && shown.marks >= 0 && g.marks > shown.marks && !player && !reducedMotion();
    shown.marks = rolling ? rollTowards(shown.marks, g.marks) : g.marks;
    ui.hudMarks.textContent = String(shown.marks);
    refreshAffordability();
  }
  // Fleet levels count the Book's rounds: level 2 runs from round 2 to 13 (shown 1/13 before it starts).
  const w = `${isFleet(g.level) ? waveNo(g, g.wave) : g.wave}/${lastNo(g)}`;
  if (w !== shown.wave) {
    ui.hudWave.textContent = w;
    shown.wave = w;
  }
  syncControls();
  renderPanel();
}

function bump(el: HTMLElement, cls: string): void {
  el.classList.remove("gain", "hurt", "spend");
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
  refreshPaths();
}

/**
 * The goal gradient on the path sheet (Hedgerow 2 section 4): each next tier's fill bar, an "affordable" glow,
 * and "in about N rounds" from the last three rounds' income.
 */
function refreshPaths(): void {
  if (!game) return;
  const g = game;
  for (const b of ui.panel.querySelectorAll<HTMLButtonElement>("button.crown-use")) {
    const t = g.towers.find((x) => x.id === Number(b.dataset.tower));
    const eta = b.querySelector<HTMLElement>(".path-eta");
    const wait = t?.crownCd ? Math.ceil(t.crownCd) : 0;
    b.disabled = !t || wait > 0 || g.phase !== "wave";
    b.classList.toggle("afford", !b.disabled);
    if (eta) eta.textContent = wait > 0 ? `Ready in ${wait} s` : g.phase === "wave" ? "Ready" : "Ready in a round";
  }
  for (const b of ui.panel.querySelectorAll<HTMLButtonElement>("button.path-buy[data-cost]")) {
    const cost = Number(b.dataset.cost);
    const locked = b.dataset.locked === "1";
    const afford = !locked && g.marks >= cost;
    b.classList.toggle("afford", afford);
    b.style.setProperty("--fill", String(Math.min(1, g.marks / Math.max(1, cost))));
    const eta = b.querySelector<HTMLElement>(".path-eta");
    if (eta && !locked) {
      // "In about 4 rounds": a narrow packet drops the "In about" (styled away, still read out) to keep one line.
      const text = afford ? "Ready" : etaText(g, cost);
      const m = /^(In about )(.*)$/.exec(text);
      if (!m) eta.textContent = text;
      else {
        const pre = document.createElement("span");
        pre.className = "eta-pre";
        pre.textContent = m[1]!;
        eta.replaceChildren(pre, m[2]!);
      }
    }
  }
}

/** "In about 3 rounds": what's still needed over the average of the last three rounds' income. */
function etaText(g: Game, cost: number): string {
  const need = cost - g.marks;
  const inc = g.roundIncome.length ? g.roundIncome.reduce((a, b) => a + b, 0) / g.roundIncome.length : 0;
  if (inc <= 0) return `${need} more Marks`;
  const n = Math.max(1, Math.ceil(need / inc));
  return n === 1 ? "In about 1 round" : `In about ${n} rounds`;
}

function waveSummary(groups: Level["waves"][number]): Array<{ kind: EnemyKind; count: number }> {
  const m = new Map<EnemyKind, number>();
  for (const g of groups) m.set(g.enemy, (m.get(g.enemy) ?? 0) + g.count);
  return [...m].map(([kind, count]) => ({ kind, count }));
}

function renderPanel(force = false): void {
  renderPanelInner(force);
  syncRing();
}

function renderPanelInner(force = false): void {
  if (!game) return;
  const g = game;
  const sel = selected;
  const t = sel ? towerAt(g, sel.col, sel.row) : undefined;
  const key = [sel?.col, sel?.row, t?.id, t?.tier, t?.spec, t?.path?.join(""), t?.crown, t?.target, t?.mega, rankOf(t?.kills ?? 0), g.wave, g.phase, renderer?.heroSelected, aiming].join("|");
  if (!force && key === panelKey) return;
  panelKey = key;
  const p = ui.panel;
  p.innerHTML = "";
  // A new card starts at its top (a phone's sheet kept the last card's scroll otherwise).
  p.scrollTop = 0;
  p.className = "panel";
  if (renderer) renderer.preview = null;

  if (aiming) {
    p.classList.add("panel-aim");
    p.append(line(`Tap where the pie should land. It freezes everything it hits for 3 seconds. Tap the pie again to aim at the front of the queue.`));
    return;
  }
  // Plan item 156: on an upright phone the build ring builds at the plot, so the panel stays the round preview and
  // its tray (the fallback: a tap on a tray packet plants it on the ringed plot) rather than a sheet over the field.
  if (!sel || (ringWanted() && uprightPhone())) {
    wavePreview(p, g);
    drawerHandle(p);
    fitPreview(p);
    return;
  }
  // Portrait phones: anything chosen on the field opens as a sheet over the bottom of it (plan item 10).
  p.classList.add("panel-sheet");
  if (t) {
    notebookTower = t.id;
    towerCard(p, g, t);
    return;
  }
  const mark = landmarkAt(g.level, sel.col, sel.row);
  if (mark && mark.type !== "bank") {
    p.append(line(`${LANDMARKS[mark.type].name}. ${LANDMARKS[mark.type].note}`));
    return;
  }
  if (!isPlot(g.level, sel.col, sel.row)) {
    p.append(line("That's the lane: towers go on the grass beside it. To move Cath, tap her between waves, then tap her new post."));
    return;
  }
  if (barnAt(g.level, sel.col, sel.row)) {
    p.append(line("A barn. Nothing grows here, and towers on the ground can't shoot through it: build on the far side to see round it."));
    return;
  }
  if (oakAt(g, sel.col, sel.row)) {
    p.append(line(`A fallen oak lies across this plot. Haul it off for ${OAK_COST} Marks and you can build here.`));
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-build btn-oak";
    b.textContent = `Clear the oak (${OAK_COST})`;
    b.disabled = g.marks < OAK_COST;
    b.onclick = () => {
      if (doAct({ t: "clear", col: sel.col, row: sel.row })) {
        sfx.playBuild();
        haptic.build();
        renderPanel(true);
      }
    };
    p.append(b);
    return;
  }
  buildMenu(p, g, sel);
}

/**
 * Plan item 40: the desktop side column never scrolls with no cue, so Cath's notebook keeps its foot. When the round
 * card runs past the column, the lines that repeat something already on screen go first: the round after (Coming up
 * shows it), then the twist's rule (its tag on the ticket carries it), then the "can't answer" keys (the names stay;
 * the keys are the warning's hover text), then the round's card line (kept as the ticket's
 * hover text), then Cath's advice, and last the Coming up / notebook card: the column ends on a whole card, never a cut one.
 * Phones hide these lines anyway.
 */
const PREVIEW_SPARE = [
  ".preview-then",
  ".twist-line",
  ".field-warn .warn-key",
  ".ticket-note:not(.wave-advice)",
  ".wave-advice",
  // Plan item 87: Coming up and the notebook share one tabbed card; when even that runs past the foot it goes.
  ":scope > :is(.field-tabs, .field-notebook)",
] as const;
function fitPreview(p: HTMLElement): void {
  for (const el of p.querySelectorAll<HTMLElement>(".fit-dropped")) el.classList.remove("fit-dropped");
  // Only the desktop side column (plan item 87): a phone's peeking drawer is shorter than its tray, and dropping
  // there took Cath's notebook out of the drawer.
  if (!matchMedia("(min-width: 900px) and (min-height: 520.02px)").matches) return;
  // The last card's foot against the column's content box (scrollHeight also counts the sticky paper fade).
  const over = () => {
    const last = [...p.children].reverse().find((c) => c.getClientRects().length > 0);
    if (!last || !p.clientHeight) return false;
    return last.getBoundingClientRect().bottom > p.getBoundingClientRect().bottom - parseFloat(getComputedStyle(p).paddingBottom) + 1;
  };
  const drop = (sel: string, on: boolean) => {
    for (const el of p.querySelectorAll<HTMLElement>(sel)) {
      el.classList.toggle("fit-dropped", on);
      const ticket = p.querySelector<HTMLElement>(".round-ticket");
      if (on && el.matches(".ticket-note") && ticket && !ticket.title) ticket.title = el.textContent ?? "";
    }
  };
  p.classList.remove("shop-tight");
  const gone: string[] = [];
  for (const sel of PREVIEW_SPARE) {
    if (!over()) break;
    drop(sel, true);
    gone.push(sel);
    // Plan item 87: a long round (five vehicle groups on a ten-tower level) still runs past the foot with only the
    // tabbed card left, so the seed packets go shorter first, and the card goes only if the ticket still won't fit.
    if (sel === PREVIEW_SPARE[PREVIEW_SPARE.length - 2] && over()) p.classList.add("shop-tight");
  }
  // With the last card gone, give back whatever fits again, latest first.
  if (!gone.includes(PREVIEW_SPARE[PREVIEW_SPARE.length - 1]!)) return;
  for (const sel of gone.slice(0, -1).reverse()) {
    drop(sel, false);
    if (over()) drop(sel, true);
  }
}
const refit = () => {
  if (ui.panel.classList.contains("panel-preview")) fitPreview(ui.panel);
};
addEventListener("resize", refit);
void document.fonts?.ready.then(refit);

/** Portrait phones keep the round preview in a drawer under the tower tray: open or shut, it stays as left. */
let drawerOpen = false;

/**
 * The drawer's grip (plan item 10): on a portrait phone the panel peeks just the tower tray, so the field gets the
 * screen; the grip pulls the round ticket up over the field's foot. Hidden by CSS everywhere else.
 */
function drawerHandle(p: HTMLElement): void {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "drawer-handle";
  const sync = () => {
    p.classList.toggle("open", drawerOpen);
    b.setAttribute("aria-expanded", String(drawerOpen));
    // Plan item 47: the grip pulls up the next round's ticket, so it says "Next" (it read "Round 7" beside a bar
    // that said Round 6 while the sixth was on the lane).
    const next = game ? game.wave + 1 : 0;
    b.textContent = drawerOpen
      ? "Hide round"
      : !game
        ? "Round"
        : next <= game.level.waves.length
          ? `Next: Round ${waveNo(game, next)}`
          : `Round ${waveNo(game, game.level.waves.length)}`;
  };
  b.onclick = () => {
    drawerOpen = !drawerOpen;
    sync();
  };
  sync();
  p.prepend(b);
}

function line(text: string, cls = ""): HTMLParagraphElement {
  const el = document.createElement("p");
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

/** "Answered by a Scarecrow or a Beehive." for the notebook's advice page (the kit's counters to a vehicle). */
function answersLine(kind: EnemyKind, g: Game): string {
  const names = countersFor(kind, g.level.towers).slice(0, 3).map((t) => TOWERS[t].name);
  if (!names.length) return "Nothing in this kit answers it outright: slow it and keep Goodwill in hand.";
  return `Answered by ${names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0]}.`;
}

/** Whether the round ticket's (i) is open (kept across rounds and redraws). */
let notesOpen = false;

/**
 * Plan item 95: this round's traits (air, plates, wrap, stealth...) as big icons with their names, those the field
 * can't answer gathered under one red "Can't answer" stamp, so the threat reads at a glance without a paragraph.
 * (A lock only the round after brings stays in the (i)'s warning and in Coming up.)
 */
function traitStrip(pm: number, miss: readonly Property[]): HTMLElement {
  const strip = document.createElement("div");
  strip.className = "threat-traits";
  const gaps = new Set<Property>(miss);
  const props = propsOf(pm);
  const item = (prop: Property) => {
    const t = document.createElement("span");
    t.className = "threat-trait";
    t.dataset.prop = prop;
    t.title = `${PROPERTIES[prop].name}: ${PROPERTIES[prop].lock}`;
    t.append(img(propIcon(prop), "trait-icon"));
    const n = document.createElement("span");
    n.className = "trait-name";
    n.textContent = PROPERTIES[prop].name;
    t.append(n);
    return t;
  };
  const answered = props.filter((x) => !gaps.has(x));
  const missing = props.filter((x) => gaps.has(x));
  if (missing.length) {
    const gap = document.createElement("span");
    gap.className = "trait-gap";
    gap.setAttribute("role", "group");
    gap.setAttribute("aria-label", `Your field can't answer: ${missing.map((x) => PROPERTIES[x].name).join(", ")}`);
    const stamp = document.createElement("span");
    stamp.className = "trait-stamp";
    stamp.textContent = "Can't answer";
    gap.append(stamp, ...missing.map(item));
    strip.append(gap);
  }
  strip.append(...answered.map(item));
  if (!props.length) strip.hidden = true;
  return strip;
}

/**
 * The round preview (AAA UI M3, spec 4.10): the tower tray, then a perforated ticket for the next round. Its stub
 * carries the round's number; the ticket its name, the level's twist and any lock the field can't answer as
 * luggage tags, and the vehicles as roundels with their counts. A phone shows just that; the side panel adds the
 * round's card, the twist's rule, the warning in full, the round after, and Cath's advice.
 */
function wavePreview(p: HTMLElement, g: Game): void {
  p.classList.add("panel-preview");
  if (!player && g.phase !== "won" && g.phase !== "lost") towerTray(p, g);
  const next = g.level.waves[g.wave];
  const fleet = isFleet(g.level);
  const ticket = document.createElement("section");
  ticket.className = "round-ticket";
  const stub = document.createElement("div");
  stub.className = "ticket-stub";
  stub.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "ticket-label";
  const no = document.createElement("span");
  no.className = "ticket-no";
  const of = document.createElement("span");
  of.className = "ticket-of";
  stub.append(label, no, of);
  const body = document.createElement("div");
  body.className = "ticket-body";
  const head = document.createElement("div");
  head.className = "ticket-head";
  const title = document.createElement("p");
  title.className = "ticket-title preview-title";
  head.append(title);
  body.append(head);
  ticket.append(stub, body);
  if (!next) {
    if (g.phase !== "wave") return;
    label.textContent = "Last";
    no.textContent = String(lastNo(g));
    of.textContent = Word(g);
    title.textContent = `Last ${waveWord(g)} on the lane. Hold them.`;
    p.append(ticket);
    return;
  }
  const n = waveNo(g, g.wave + 1);
  label.textContent = g.phase === "wave" ? "Next" : Word(g);
  no.textContent = String(n);
  of.textContent = `of ${lastNo(g)}`;
  const r = fleet ? bookRound(g.level, g.wave + 1) : 0;
  const page = fleet ? roundFor(g.level.id, r) : undefined;
  // The vehicles, merged by kind (and, on Round Book levels, by their properties).
  const seen = new Map<string, { kind: EnemyKind; pm: number; count: number }>();
  for (const gr of next) {
    const pm = fleet ? (gr.pm ?? 0) : 0;
    const key = `${gr.enemy}:${pm}`;
    const e = seen.get(key) ?? { kind: gr.enemy, pm, count: 0 };
    e.count += gr.count;
    seen.set(key, e);
  }
  const total = [...seen.values()].reduce((a, e) => a + e.count, 0);
  title.textContent = page?.theme ?? `${total} on the lane`;
  const boss = [...seen.values()].some((e) => isBig(e.kind));
  if (boss) ticket.classList.add("boss");
  // The stub is drawn for the eye; a screen reader (and the page's text) gets it as words.
  const said = document.createElement("span");
  said.className = "sr-only";
  said.textContent = g.phase === "wave" ? `Coming next: ${waveWord(g)} ${n} of ${lastNo(g)}. ` : `${Word(g)} ${n} of ${lastNo(g)}. `;
  ticket.prepend(said);
  // The level's twists and set pieces, as tags; their rules in full in the side panel.
  const notes: HTMLElement[] = [];
  for (const tw of g.level.twists ?? []) {
    const rule = `${TWISTS[tw].name}: ${twistRule(g.level, tw)}`;
    head.append(tag(TWISTS[tw].name, "twist", rule));
    notes.push(line(rule, "twist-line"));
  }
  for (const sp of g.level.setPieces ?? []) {
    if (sp.kind === "landmark") continue;
    const [name, rule] =
      sp.kind === "flood"
        ? ["Flood", `Flood: from wave ${sp.wave} the river covers the plots by the ford; only Duck Ponds stand there, and vehicles wade.`]
        : sp.kind === "bridge"
          ? ["Swing bridge", `Swing bridge: it opens for ${sp.open}s every ${sp.period}s, and nothing crosses while it's up.`]
          : ["Blackout", "Blackout: no lamps tonight. Towers and Cath light the lane around them; nothing in the dark can be targeted."];
    head.append(tag(name, "twist", rule));
    notes.push(line(rule, "twist-line"));
  }
  const row = document.createElement("ul");
  row.className = "preview-row ticket-chips";
  // It can scroll sideways on a phone: keyboard users can reach it too.
  row.tabIndex = 0;
  row.setAttribute("aria-label", fleet ? "Vehicles in this round" : "Vehicles in this wave");
  for (const { kind, pm, count } of seen.values()) {
    const li = document.createElement("li");
    li.className = "preview-chip" + (isBig(kind) ? " boss" : "");
    const name = fleet ? vehicleName(kind, pm) : ENEMIES[kind].name;
    li.title = `${count} × ${name}`;
    li.append(img(enemyIcon(kind), "chip-icon"));
    const c = document.createElement("span");
    c.className = "chip-n";
    c.textContent = `×${count}`;
    const nm = document.createElement("span");
    nm.className = "chip-name";
    nm.textContent = ` ${name}`;
    li.append(c, nm);
    if (fleet) {
      const own = pm | inherentProps(kind);
      if (own) li.append(propRow(own, "chip-props"));
    } else {
      const cls = enemyClass(kind);
      if (cls !== "light") {
        const t = document.createElement("span");
        t.className = `chip-tag ${cls}`;
        t.textContent = cls === "air" ? "Air" : "Heavy";
        li.append(t);
      }
    }
    row.append(li);
  }
  body.append(row);
  // What the field can't answer in the next two rounds: a red tag on the ticket, the keys in the side panel.
  let warn: HTMLElement | null = null;
  let then: HTMLElement | null = null;
  if (fleet) {
    let pm = roundProps(g.level, next);
    const after = g.level.waves[g.wave + 1];
    if (after) {
      const r2 = bookRound(g.level, g.wave + 2);
      const page2 = roundFor(g.level.id, r2);
      const props = roundProps(g.level, after);
      pm |= props;
      if (page2) {
        then = line(`Then round ${r2}: ${page2.theme}`, "preview-then");
        if (props) then.append(" ", propRow(props, "chip-props"));
      }
    }
    const miss = unanswered(g, pm);
    // Plan item 95: the round's traits as a poster strip of big icons; what the field can't answer is stamped.
    const own = roundProps(g.level, next);
    body.append(traitStrip(own, unanswered(g, own)));
    if (miss.length) {
      warn = line(`Your field can't answer this:`, "field-warn");
      // Each lock's key in its own span, so a crowded column can keep just the names (fitPreview).
      for (const m of miss) {
        const k = document.createElement("span");
        k.className = "warn-key";
        k.textContent = ` ${PROPERTIES[m].key}`;
        warn.append(` ${PROPERTIES[m].name}.`, k);
      }
      warn.title = warn.textContent ?? "";
      warn.setAttribute("role", "status");
    }
  }
  p.append(ticket);
  // Plan item 95: the longer read waits behind the ticket's (i): the locks' keys, the round's card, the twists'
  // rules, the round after, and Cath's advice in full (she says it short on the field, beside her).
  const more: HTMLElement[] = [];
  if (warn) more.push(warn);
  if (page) more.push(line(page.card, "ticket-note"));
  more.push(...notes);
  if (then) more.push(then);
  const facts = cathAdvice(next);
  const spoken = g.phase === "build" ? adviceLine(g) : "";
  const advice = [spoken && `Cath: “${spoken}”`, facts].filter(Boolean).join(" ");
  if (advice) more.push(line(advice, "ticket-note wave-advice"));
  if (more.length) {
    const box = document.createElement("div");
    box.className = "round-notes";
    box.id = "round-notes";
    box.append(...more);
    const info = document.createElement("button");
    info.type = "button";
    info.className = "ticket-info";
    info.textContent = "i";
    info.setAttribute("aria-label", "The round in full");
    info.setAttribute("aria-controls", box.id);
    const sync = () => {
      box.hidden = !notesOpen;
      info.setAttribute("aria-expanded", String(notesOpen));
    };
    info.onclick = () => {
      notesOpen = !notesOpen;
      sync();
      fitPreview(p);
    };
    sync();
    head.append(info);
    p.append(box);
  }
  // How to build is on the notebook's empty page (plan item 31); the hint keeps how to move Cath, on the first
  // fields only (by level 3 she's been moved, and the line pushed the notebook off a 900 px column).
  if (g.phase === "build" && g.wave === 0 && g.level.id <= 2) p.append(line("Between waves, tap Cath, then tap the field to give her a new post.", "hint"));
  // Plan item 87: at D the seed packets take more of the column, so Coming up and Cath's notebook share one card
  // with two tabs (Coming up first). Levels without Coming up keep the notebook alone.
  p.append(fleet ? fieldTabs(p, g) : fieldNotebook(g));
}

/** Which tab of the desktop's Coming up / notebook card is open, and the notebook advice last read there. */
let fieldTab: "intel" | "notebook" = "intel";
let notebookSeen = "";

/**
 * Plan item 87: Coming up and Cath's notebook as one card with two tabs at D. A dot on the Notebook tab says her
 * advice has changed since it was last open. Phones hide the tabs (and Coming up) and show the notebook in the
 * drawer, as before.
 */
function fieldTabs(p: HTMLElement, g: Game): HTMLElement {
  const box = document.createElement("section");
  box.className = "field-tabs";
  const intel = fieldIntel(g);
  const nb = fieldNotebook(g);
  intel.id = "field-tab-intel";
  nb.id = "field-tab-notebook";
  const bar = document.createElement("div");
  bar.className = "field-tabbar";
  bar.setAttribute("role", "tablist");
  bar.setAttribute("aria-label", "Coming up and Cath's notebook");
  const adviceKey = nb.querySelector(".nb-advice")?.textContent ?? "";
  const tabs = (["intel", "notebook"] as const).map((which) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "field-tab";
    b.id = `field-tab-${which}-btn`;
    b.dataset.tab = which;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", which === "intel" ? intel.id : nb.id);
    b.textContent = which === "intel" ? "Coming up" : "Notebook";
    return b;
  });
  intel.setAttribute("role", "tabpanel");
  intel.setAttribute("aria-labelledby", tabs[0]!.id);
  nb.setAttribute("role", "tabpanel");
  nb.setAttribute("aria-labelledby", tabs[1]!.id);
  const sync = () => {
    box.dataset.tab = fieldTab;
    if (fieldTab === "notebook") notebookSeen = adviceKey;
    for (const b of tabs) {
      const on = b.dataset.tab === fieldTab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    tabs[1]!.classList.toggle("has-news", fieldTab !== "notebook" && !!adviceKey && adviceKey !== notebookSeen);
  };
  for (const b of tabs) {
    b.onclick = () => {
      fieldTab = b.dataset.tab as typeof fieldTab;
      sync();
      fitPreview(p);
    };
    b.onkeydown = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const other = tabs.find((x) => x !== b)!;
      other.click();
      other.focus();
    };
  }
  bar.append(...tabs);
  box.append(bar, intel, nb);
  sync();
  return box;
}

/** What a tower stands on at each visible tier (plan item 19's plinths). */
const STANDS = ["Bed", "Plank deck", "Stone drum"] as const;

/**
 * The next vehicle this lane hasn't shown yet (not in an earlier round, never met): its kind and round. `skip` is
 * the one Cath's advice card already sketches (plan item 72), so the lane page looks past it.
 */
function nextNew(g: Game, skip?: EnemyKind): { kind: EnemyKind; wave: number } | null {
  const met = new Set<EnemyKind>(skip ? [skip] : []);
  for (const w of g.level.waves.slice(0, g.wave)) for (const gr of w) met.add(gr.enemy);
  for (let i = g.wave; i < g.level.waves.length; i++)
    for (const gr of g.level.waves[i]!) if (!met.has(gr.enemy) && !data.seen[gr.enemy]) return { kind: gr.enemy, wave: i + 1 };
  return null;
}

/** A tower's growth for picking the notebook's page when none was looked at: tiers bought. */
function grown(t: Tower): number {
  return t.path ? t.path[0] + t.path[1] + t.path[2] : t.tier;
}

/**
 * Plan item 31: Cath's field notebook, the side column's foot on a desktop (and the open drawer on a phone). A page
 * on the last tower looked at (its stand from bed to stone drum, its build along each path, what it sells for) and a
 * pencil sketch of the next new vehicle on the lane with the round it arrives.
 */
function fieldNotebook(g: Game): HTMLElement {
  const nb = document.createElement("section");
  nb.className = "field-notebook";
  nb.setAttribute("aria-label", "Cath's field notebook");
  const h = document.createElement("h3");
  h.textContent = "Cath's notebook";
  nb.append(h);
  // Plan item 72: her advice for the round first: the round's threat sketched, and what in this kit answers it
  // (the next round between rounds, the one on the lane during it).
  const ri = betweenRounds(g) ? g.wave : Math.max(0, g.wave - 1);
  const groups = g.level.waves[ri];
  const advice = groups ? roundAdvice(waveSpawns(g, groups, ri + 1), g.level.towers, g.towers.map((x) => x.kind)) : null;
  if (advice) {
    const card = document.createElement("div");
    card.className = "nb-page nb-advice";
    card.dataset.kind = advice.kind;
    card.append(img(enemyIcon(advice.kind), "nb-sketch"));
    const txt = document.createElement("div");
    txt.className = "nb-text";
    const total = advice.total > advice.count ? ` of ${advice.total}` : "";
    txt.append(
      line(`${Word(g)} ${waveNo(g, ri + 1)} · ${betweenRounds(g) ? "next" : "on the lane"}`, "nb-eyebrow"),
      line(`${ENEMIES[advice.kind].name} ×${advice.count}${total}`, "nb-name"),
      // Plan item 103: while she says her line beside her on the field, the page lists what answers the threat
      // instead of repeating it word for word.
      line(betweenRounds(g) && g.phase === "build" && !player && !hasTwist(g.level, "nocath") ? answersLine(advice.kind, g) : advice.line, "nb-advice-line"),
    );
    card.append(txt);
    nb.append(card);
  }
  const t = g.towers.find((x) => x.id === notebookTower) ?? [...g.towers].sort((a, b) => grown(b) - grown(a))[0];
  const page = document.createElement("div");
  page.className = "nb-page nb-tower";
  if (t) {
    page.dataset.tower = String(t.id);
    page.append(img(towerIcon(t.kind, t.tier, t.spec ?? null, t.path), "nb-sketch"));
    const txt = document.createElement("div");
    txt.className = "nb-text";
    txt.append(line(towerName(t), "nb-name"));
    const tier = towerTier(t);
    const on = STANDS[tier - 1]!;
    // Its stand, bed to stone drum, as three pencil dots and the word for the one it's on.
    const stand = document.createElement("p");
    stand.className = "nb-stand";
    stand.setAttribute("aria-label", `Stands on a ${on.toLowerCase()}, tier ${tier} of 3`);
    const dots = document.createElement("span");
    dots.className = "nb-dots";
    dots.setAttribute("aria-hidden", "true");
    for (let i = 1; i <= 3; i++) {
      const d = document.createElement("i");
      if (i <= tier) d.className = "on";
      dots.append(d);
    }
    stand.append(dots, on);
    txt.append(stand);
    if (t.path && hasPaths(t.kind)) {
      const defs = PATHS[t.kind].paths;
      const bits = ([0, 1, 2] as const).filter((i) => t.path![i] > 0).map((i) => `${defs[i].name} ${t.path![i]}`);
      page.title = `Build ${buildName(t.path)}${bits.length ? `: ${bits.join(", ")}` : ""}`;
    }
    txt.append(line(`Sells ${sellValue(t, g)}`, "nb-sell"));
    page.append(txt);
  } else if (!advice) page.append(line("Nothing planted yet: tap a plot to build.", "nb-empty"));
  // With nothing planted the advice already says how to build, so the lane's page takes the whole row.
  if (t || !advice) nb.append(page);
  const nx = nextNew(g, advice?.kind);
  const lane = document.createElement("div");
  lane.className = t || !advice ? "nb-page nb-enemy" : "nb-page nb-enemy nb-wide";
  if (nx) {
    lane.dataset.kind = nx.kind;
    lane.append(img(enemyIcon(nx.kind), "nb-sketch"));
    const txt = document.createElement("div");
    txt.className = "nb-text";
    txt.append(line(`Next new`, "nb-eyebrow"), line(ENEMIES[nx.kind].name, "nb-name"), line(`${Word(g)} ${waveNo(g, nx.wave)}`, "nb-when"));
    lane.title = describeEnemy(nx.kind);
    lane.append(txt);
  } else lane.append(line("Nothing new to come: you've met it all.", "nb-empty"));
  nb.append(lane);
  return nb;
}

/** Which round ahead has its vehicles open under the strip (kept across redraws). */
let openRound: string | null = null;

/** Desktop side panel: which locks the field answers and the rounds ahead (styles hide it on a phone). */
function fieldIntel(g: Game): HTMLElement {
  // Plan item 19: condensed to what's coming (the field itself shows what stands on it).
  const box = document.createElement("section");
  box.className = "field-intel";
  const h = document.createElement("h3");
  h.textContent = "Coming up";
  box.append(h);
  const locks = levelLocks(g.level);
  const gaps = unanswered(g, locks);
  if (locks) {
    const row = document.createElement("div");
    row.className = "intel-locks";
    const lab = document.createElement("span");
    lab.className = "intel-label";
    lab.textContent = gaps.length ? "Still unanswered" : "Every lock answered";
    row.append(lab);
    if (gaps.length) row.append(propRow(gaps.reduce((a, m) => a | P[m], 0), "chip-props"));
    else row.append(propRow(locks, "chip-props"));
    box.append(row);
  }
  // Plan item 168: the next five rounds after this one as chips: the round, its lead vehicle, a stacked bar of its
  // mix in each vehicle's livery and its count; a boss or flood round under a painted banner. A tap opens its vehicles.
  const ahead = g.level.waves.slice(g.wave + 1, g.wave + 6);
  if (ahead.length) {
    const tl = document.createElement("ol");
    tl.className = "intel-timeline round-strip";
    tl.setAttribute("aria-label", "Coming rounds");
    const detail = document.createElement("div");
    detail.className = "round-detail";
    detail.hidden = true;
    const chips: HTMLButtonElement[] = [];
    const open = (key: string | null) => {
      openRound = key;
      detail.replaceChildren();
      detail.hidden = true;
      for (const c of chips) c.setAttribute("aria-expanded", String(c.dataset.key === key));
      const c = chips.find((x) => x.dataset.key === key);
      if (!c) return;
      const w = Number(c.dataset.wave);
      const groups = g.level.waves[w] ?? [];
      const head = line(`${Word(g)} ${waveNo(g, w + 1)}`, "round-detail-head");
      const b = roundBanner(g.level, w);
      if (b) head.append(" · ", b.twist === "flood" ? "the river floods the ford" : "a boss on the lane");
      detail.append(head);
      const ul = document.createElement("ul");
      for (const m of roundMix(groups)) {
        const li = document.createElement("li");
        li.style.setProperty("--seg", livery(m.kind));
        li.append(img(enemyIcon(m.kind), "round-detail-icon"));
        const t = document.createElement("span");
        t.textContent = `×${m.count} ${ENEMIES[m.kind].name}`;
        li.append(t);
        ul.append(li);
      }
      detail.append(ul);
      detail.hidden = false;
    };
    ahead.forEach((groups, i) => {
      const w = g.wave + 1 + i;
      const n = waveNo(g, w + 1);
      const lead = roundLead(groups);
      const mix = roundMix(groups);
      const total = mix.reduce((a, m) => a + m.count, 0);
      const banner = roundBanner(g.level, w);
      const li = document.createElement("li");
      li.className = "round-chip" + (isBig(lead) ? " boss" : "");
      if (banner) li.dataset.twist = banner.twist;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "round-chip-btn";
      b.dataset.key = `${g.level.id}:${w}`;
      b.dataset.wave = String(w);
      b.setAttribute("aria-expanded", "false");
      b.setAttribute("aria-controls", "round-detail");
      b.title = `${Word(g)} ${n}: ${mix.map((m) => `${m.count} ${ENEMIES[m.kind].name}`).join(", ")}`;
      b.setAttribute("aria-label", `${Word(g)} ${n}${banner ? `, ${banner.label}` : ""}: ${total} vehicles, led by ${ENEMIES[lead].name}`);
      if (banner) {
        const ban = document.createElement("span");
        ban.className = "round-banner";
        // A painted glyph before its word: the river's ripples, or the boss's crown.
        ban.innerHTML =
          banner.twist === "flood"
            ? '<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M1 3.5q2-2 3.5 0t3.5 0 3.5 0 3.5 0M1 7.5q2-2 3.5 0t3.5 0 3.5 0 3.5 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
            : '<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M2 9h12l1-7-4 3-3-4-3 4-4-3z" fill="currentColor"/></svg>';
        ban.append(banner.label);
        b.append(ban);
      }
      const no = document.createElement("span");
      no.className = "round-no";
      no.textContent = String(n);
      b.append(no, img(enemyIcon(lead), "chip-icon"));
      const bar = document.createElement("span");
      bar.className = "mix-bar";
      for (const m of mix) {
        const seg = document.createElement("i");
        seg.dataset.kind = m.kind;
        seg.style.setProperty("--pct", String(m.pct));
        seg.style.setProperty("--seg", livery(m.kind));
        bar.append(seg);
      }
      const count = document.createElement("span");
      count.className = "round-count";
      count.textContent = String(total);
      b.append(bar, count);
      b.onclick = () => open(openRound === b.dataset.key ? null : b.dataset.key!);
      chips.push(b);
      li.append(b);
      tl.append(li);
    });
    detail.id = "round-detail";
    detail.onclick = () => open(null);
    box.append(tl, detail);
    if (openRound && chips.some((c) => c.dataset.key === openRound)) open(openRound);
  }
  return box;
}

/** A luggage tag (spec 4.7): an eyelet, then a short caps word; `title` carries the full sentence. */
function tag(text: string, cls: string, title: string): HTMLSpanElement {
  const t = document.createElement("span");
  t.className = `tag ${cls}`;
  t.title = title;
  const w = document.createElement("span");
  w.textContent = text;
  t.append(w);
  return t;
}

/** The locks a level's rounds bring (its badges show only these: level 1 asks about wrap and the air, not stealth). */
function levelLocks(level: Level): number {
  return roundProps(level, level.waves.flat());
}

/** A tower's lock badges: green for what it can hit (or reveal), red for what it can't, for the locks this level brings. */
function badgeRow(kind: TowerKind, tier: Tower["tier"], spec: 0 | 1 | null, path?: Path): HTMLElement {
  const row = document.createElement("div");
  row.className = "badge-row";
  const label = lockLine(kind, spec, tier, path).trim();
  if (label) row.title = label;
  // Its damage type, in words, before the badges ("Sharp", "Blast").
  const type = damageLabel({ kind, tier, spec, path });
  if (type) {
    const t = document.createElement("span");
    t.className = "dmg-type";
    t.textContent = type;
    row.append(t);
  }
  const here = game ? levelLocks(game.level) : ~0;
  for (const b of towerBadges({ kind, tier, spec, path })) {
    if (!(here & P[b.prop])) continue;
    const el = document.createElement("span");
    el.className = `lock-badge ${b.ok ? "ok" : "no"}`;
    el.dataset.prop = b.prop;
    el.title = b.text;
    el.setAttribute("aria-label", b.text);
    el.append(img(propIcon(b.prop), "prop-icon"));
    // Its name in words, so a phone reads "Plated ✕" without a tooltip.
    const name = document.createElement("span");
    name.className = "badge-name";
    name.setAttribute("aria-hidden", "true");
    name.textContent = PROPERTIES[b.prop].name;
    const mark = document.createElement("span");
    mark.className = "badge-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = b.ok ? "✓" : "✕";
    el.append(name, mark);
    row.append(el);
  }
  return row;
}

/** A row of property icons (Hedgerow 2 section 2), each with its name for screen readers and tooltips. */
function propRow(pm: number, cls = "prop-row"): HTMLSpanElement {
  const row = document.createElement("span");
  row.className = cls;
  for (const prop of propsOf(pm)) {
    const i = img(propIcon(prop), "prop-icon");
    i.removeAttribute("aria-hidden");
    i.alt = PROPERTIES[prop].name;
    i.title = `${PROPERTIES[prop].name}: ${PROPERTIES[prop].lock}`;
    row.append(i);
  }
  return row;
}

/** One line about the coming wave, from its enemy classes (empty for plain light traffic). */
function cathAdvice(next: Level["waves"][number]): string {
  const kinds = waveSummary(next).map((w) => w.kind);
  const classes = new Set(kinds.map(enemyClass));
  const bits: string[] = [];
  if (kinds.some(isBig)) bits.push("A big one is coming. Save Marks for upgrades and keep the pie ready.");
  if (classes.has("air")) bits.push("There's air traffic: ground-only towers can't touch it.");
  if (classes.has("heavy")) bits.push("Heavy plant is slow but tough. Slow it and hit it hard.");
  return bits.slice(0, 2).join(" ");
}

/** A tower's tier-1 numbers in one line (the tray's tooltip and tap note): cost, hit, rate and range. */
function towerStatLine(g: Game, kind: TowerKind): string {
  const fleet = isFleet(g.level);
  const st = towerStats({ kind, tier: 1, spec: null, fleet });
  const bits = [`${towerCost(g, kind)} Marks`];
  // Fleet towers hit in layers, and one shot can hit `pierce` vehicles.
  if (st.damage > 0) bits.push(fleet ? `${st.damage} layer${st.damage === 1 ? "" : "s"} × ${st.pierce}` : `${st.damage} dmg`, `${(1 / st.cooldown).toFixed(1)}/s`);
  bits.push(`range ${st.range}`);
  return bits.join(" · ");
}

const CLASS_NAMES: Record<EnemyClass, string> = { light: "light traffic", heavy: "heavy plant", air: "air" };

/** " Strong vs air; weak vs heavy plant." for the build menu, from TOWER_VS. */
function counterLine(kind: TowerKind): string {
  // Fleet levels have no soft counters (Hedgerow 2 cuts TOWER_VS): a damage type and its hard locks instead.
  if (game && isFleet(game.level)) return lockLine(kind);
  const vs = TOWER_VS[kind] ?? {};
  const ks = Object.keys(vs) as EnemyClass[];
  const strong = ks.filter((k) => vs[k]! > 1).map((k) => CLASS_NAMES[k]);
  const weak = ks.filter((k) => vs[k]! < 1).map((k) => CLASS_NAMES[k]);
  const bits = [strong.length ? `Strong vs ${strong.join(", ")}` : "", weak.length ? `weak vs ${weak.join(", ")}` : ""].filter(Boolean);
  if (!bits.length) return "";
  const text = bits.join("; ");
  return ` ${text[0]!.toUpperCase()}${text.slice(1)}.`;
}

/** Build a tower on a plot, from the build menu or the build ring. */
function plant(g: Game, kind: TowerKind, sel: { col: number; row: number }): boolean {
  if (!doAct({ t: "place", kind, col: sel.col, row: sel.row })) return false;
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
  return true;
}

// ---- the build ring (plan item 156): tap an empty plot and its seed packets ring it ----

const RING_PX = 52;
let ringKey = "";
let ringAt = "";
/** On touch the first tap on a packet previews its range; the second plants it. */
let ringArmed: TowerKind | null = null;

/** An upright phone (the panel's peek and sheet styles: max-width 520px, portrait). */
function uprightPhone(): boolean {
  return matchMedia("(max-width: 520px) and (orientation: portrait)").matches;
}

function ringWanted(): boolean {
  const g = game;
  const sel = selected;
  if (!g || !renderer || !sel || player || aiming || posting || g.phase === "won" || g.phase === "lost") return false;
  if (towerAt(g, sel.col, sel.row) || !isPlot(g.level, sel.col, sel.row)) return false;
  if (laneCellsOf(g.level).has(`${sel.col},${sel.row}`)) return false;
  const mark = landmarkAt(g.level, sel.col, sel.row);
  if ((mark && mark.type !== "bank") || barnAt(g.level, sel.col, sel.row) || oakAt(g, sel.col, sel.row)) return false;
  return true;
}

function ringKinds(g: Game): TowerKind[] {
  return (g.level.towers as TowerKind[]).filter((k) => towerAllowed(g.level, k));
}

/** Open, rebuild or close the ring to match the selection. */
function syncRing(): void {
  const el = ui.buildRing;
  if (!ringWanted()) {
    if (!el.hidden) {
      el.hidden = true;
      el.replaceChildren();
    }
    ringKey = "";
    ringAt = "";
    ringArmed = null;
    return;
  }
  const g = game!;
  const sel = selected!;
  const kinds = ringKinds(g);
  // Seed Bank packets the player holds plant free, as in the build menu (an upright phone has no sheet for them).
  const seeds =
    !(g.heroic && isFleet(g.level)) && !SANDBOX && dailyDay === null
      ? PACKETS.filter((pk) => packetCount(data, pk.id) >= 1 && g.level.towers.includes(pk.kind))
      : [];
  const key = `${sel.col},${sel.row}|${kinds.join(",")}|${seeds.map((pk) => `${pk.id}:${packetCount(data, pk.id)}`).join(",")}|${g.level.id}`;
  if (key !== ringKey) {
    ringKey = key;
    ringAt = "";
    ringArmed = null;
    el.replaceChildren();
    const wet = plotKind(g.level, sel.col, sel.row) === "water";
    for (const kind of kinds) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ring-packet";
      b.dataset.kind = kind;
      b.dataset.role = towerRole(kind);
      if (wet && kind !== "pond") b.dataset.wet = "true";
      const price = document.createElement("span");
      price.className = "ring-cost";
      const name = document.createElement("span");
      name.className = "ring-name";
      name.textContent = TOWERS[kind].name;
      b.append(img(towerIcon(kind), "ring-icon"), price, name);
      const show = () => {
        ringFor(kind);
        el.dataset.preview = kind;
      };
      const hide = () => {
        if (ringArmed) return;
        ringFor(null);
        delete el.dataset.preview;
      };
      b.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && show());
      b.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && hide());
      b.addEventListener("focus", show);
      b.addEventListener("blur", hide);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!game || !selected) return;
        const touch = (e as PointerEvent).pointerType === "touch" || (e as PointerEvent).pointerType === "pen";
        if (touch && ringArmed !== kind) {
          // First tap on touch: show its reach and name; a second tap plants.
          ringArmed = kind;
          for (const o of el.querySelectorAll<HTMLElement>(".ring-packet")) o.toggleAttribute("data-armed", o === b);
          show();
          return;
        }
        if (b.dataset.wet) {
          toast("Wet ground: only a Duck Pond will sit here.");
          return;
        }
        if (b.dataset.affordable === "false") {
          toast(`${TOWERS[kind].name}: ${towerCost(game, kind)} Marks. ${etaText(game, towerCost(game, kind))}`.trim());
          return;
        }
        ringArmed = null;
        plant(game, kind, selected);
      });
      el.append(b);
    }
    for (const pk of seeds) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ring-seed";
      b.dataset.packet = pk.id;
      b.dataset.affordable = "true";
      b.dataset.role = towerRole(pk.kind);
      const n = packetCount(data, pk.id);
      b.setAttribute("aria-label", `Plant a ${pk.name} Seed Packet here, free. You have ${n}.`);
      const price = document.createElement("span");
      price.className = "ring-cost";
      price.textContent = `🌱 ${n}`;
      const name = document.createElement("span");
      name.className = "ring-name";
      name.textContent = pk.name;
      b.append(img(towerIcon(pk.kind), "ring-icon"), price, name);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!game || !selected) return;
        if (doAct({ t: "packet", kind: pk.kind, path: pk.path, col: selected.col, row: selected.row })) {
          spendPacket(data, pk.id);
          save(data);
          sfx.playBuild();
          haptic.build();
          const nt = game.towers[game.towers.length - 1];
          if (nt) renderer?.built_(nt.id, nt.col, nt.row, false);
          renderPanel(true);
        } else toast("This Packet's top tier is not open on this field yet.");
      });
      el.append(b);
    }
    el.hidden = false;
  }
  placeRing();
}

/** Keep the ring on its plot (the 3D camera moves) and its prices and affordability current. Called every frame. */
function placeRing(): void {
  const el = ui.buildRing;
  if (el.hidden || !game || !renderer || !selected) return;
  const g = game;
  const sel = selected;
  for (const b of el.querySelectorAll<HTMLButtonElement>(".ring-packet")) {
    const kind = b.dataset.kind as TowerKind;
    const cost = towerCost(g, kind);
    const ok = g.marks >= cost && !b.dataset.wet;
    const price = b.querySelector(".ring-cost")!;
    if (price.textContent !== String(cost)) price.textContent = String(cost);
    if (b.dataset.affordable !== String(ok)) {
      b.dataset.affordable = String(ok);
      b.setAttribute(
        "aria-label",
        `Plant a ${TOWERS[kind].name} here, ${cost} Marks.${b.dataset.wet ? " Too wet here." : ok ? "" : " Not enough Marks yet."} ${TOWERS[kind].blurb}`,
      );
    }
  }
  const c = renderer.cellCenter(sel.col, sel.row);
  const r = renderer.cellCenter(sel.col + 1, sel.row);
  const d = renderer.cellCenter(sel.col, sel.row + 1);
  if (!c || !r || !d) return;
  const stage = ui.stage.getBoundingClientRect();
  // Keep off a panel that lies over the field (a phone's peek or sheet).
  const pr = ui.panel.getBoundingClientRect();
  const bottom = pr.height && pr.top < stage.bottom && pr.top > stage.top + stage.height / 2 ? pr.top : stage.bottom;
  const at = { x: c.x - stage.left, y: c.y - stage.top };
  const half = Math.max(Math.hypot(r.x - c.x, r.y - c.y), Math.hypot(d.x - c.x, d.y - c.y)) / 2;
  const w = el.clientWidth || stage.width;
  const key = `${Math.round(at.x)},${Math.round(at.y)},${Math.round(half)},${Math.round(stage.width)}x${Math.round(bottom - stage.top)}`;
  if (key === ringAt) return;
  ringAt = key;
  const packets = [...el.querySelectorAll<HTMLElement>(".ring-packet, .ring-seed")];
  const lay = ringLayout(at, half, packets.length, RING_PX, { x: 0, y: 0, w, h: bottom - stage.top });
  el.style.setProperty("--plot-x", `${Math.round(at.x)}px`);
  el.style.setProperty("--plot-y", `${Math.round(at.y)}px`);
  el.style.setProperty("--plot-r", `${Math.round(half)}px`);
  packets.forEach((b, i) => {
    const p = lay.spots[i]!;
    b.style.setProperty("--x", `${Math.round(p.x - RING_PX / 2)}px`);
    b.style.setProperty("--y", `${Math.round(p.y - RING_PX / 2)}px`);
    // The name tag hangs on the side away from the plot.
    b.dataset.side = p.y < at.y - half ? "up" : "down";
  });
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
      if (isFleet(g.level)) info.append(badgeRow(kind, 1, null));
      if (renderer) renderer.preview = kind;
    };
    b.addEventListener("pointerenter", show);
    b.addEventListener("focus", show);
    // Drag it from here onto any plot instead (Hedgerow 2 M4: drag-to-place on touch).
    b.addEventListener("pointerdown", (e) => startDrag(e, kind));
    b.onclick = () => {
      if (dragEnded()) return;
      plant(g, kind, sel);
    };
    row.append(b);
  }
  if (!(g.heroic && isFleet(g.level)) && !SANDBOX && dailyDay === null) {
    for (const pk of PACKETS) {
      const n = packetCount(data, pk.id);
      if (n < 1 || !g.level.towers.includes(pk.kind)) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-build btn-packet";
      b.dataset.packet = pk.id;
      b.setAttribute("aria-label", `Plant a ${pk.name} Seed Packet, free. You have ${n}.`);
      b.append(img(towerIcon(pk.kind), "build-icon"));
      const name = document.createElement("span");
      name.className = "build-name";
      name.textContent = pk.name;
      const price = document.createElement("span");
      price.className = "build-cost";
      price.textContent = `🌱 ${n}`;
      b.append(name, price);
      b.onclick = () => {
        if (doAct({ t: "packet", kind: pk.kind, path: pk.path, col: sel.col, row: sel.row })) {
          spendPacket(data, pk.id);
          save(data);
          sfx.playBuild();
          haptic.build();
          const nt = g.towers[g.towers.length - 1];
          if (nt) renderer?.built_(nt.id, nt.col, nt.row, false);
          renderPanel(true);
        } else info.textContent = "This Packet's top tier is not open on this field yet.";
      };
      row.append(b);
    }
  }
  info.textContent =
    ground === "water"
      ? "Wet ground: only a Duck Pond will sit here."
      : ground === "high"
        ? "High ground: towers here see 25% further."
        : "Pick something to plant here.";
  p.append(row, info);
}

// ---- drag-to-place (Hedgerow 2 M4): drag a tower from the tray or the build menu onto a plot ----

let drag: {
  kind: TowerKind;
  id: number;
  x0: number;
  y0: number;
  moved: boolean;
  ghost: HTMLImageElement | null;
  cell: { col: number; row: number } | null;
  ok: boolean;
} | null = null;
let dragEndedAt = 0;

/** A click that ends a drag isn't also a tap. */
function dragEnded(): boolean {
  return performance.now() - dragEndedAt < 350;
}

/**
 * The tower tray over the round preview: drag one onto a plot to build it there. A long roster scrolls sideways
 * under a brass "more" tab at the far end (it pages the row along, and hides at the end). Hover a packet, or tap
 * it, for its numbers.
 */
function towerTray(p: HTMLElement, g: Game): void {
  const wrap = document.createElement("div");
  wrap.className = "tray-wrap";
  const tray = document.createElement("div");
  tray.className = "tray";
  tray.setAttribute("role", "group");
  tray.setAttribute("aria-label", "Towers: drag one onto a plot");
  for (const kind of g.level.towers) {
    if (!towerAllowed(g.level, kind)) continue;
    const cost = towerCost(g, kind);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tray-tower";
    b.dataset.kind = kind;
    // Plan item 119: the packet's printed band takes the role's colour.
    b.dataset.role = towerRole(kind);
    b.dataset.cost = String(cost);
    b.disabled = g.marks < cost;
    const stats = towerStatLine(g, kind);
    b.setAttribute("aria-label", `${TOWERS[kind].name}, ${cost} Marks. ${TOWERS[kind].blurb} ${stats}. Drag onto a plot, or pick a plot first.`);
    // Plan item 69: a compact desktop tray drops the names from the cards; the pointer still reads them here.
    b.title = `${TOWERS[kind].name} · ${cost} Marks`;
    const price = document.createElement("span");
    price.className = "build-cost";
    price.textContent = String(cost);
    // Plan item 31: an almanac card: the name, a role glyph, and range and damage as pips against the roster.
    const name = document.createElement("span");
    name.className = "tray-name";
    // Plan item 119: a soft hyphen lets a long one-word name break onto the band's second line (Chromium on Linux
    // has no hyphenation dictionary for `hyphens: auto`).
    name.textContent = TOWERS[kind].name.replace("Courthouse", "Court\u00ADhouse");
    const role = towerRole(kind);
    const glyph = document.createElement("span");
    glyph.className = `tray-role role-${role}`;
    glyph.title = ROLE_NAMES[role];
    glyph.innerHTML = ROLE_GLYPHS[role];
    const pips = trayPips(g, kind);
    b.append(img(towerIcon(kind), "tray-icon"), glyph, name, pips, price);
    b.addEventListener("pointerdown", (e) => startDrag(e, kind));
    b.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || !HOVER) return;
      ringFor(kind);
      clearTimeout(tipTimer);
      tipTimer = window.setTimeout(() => showTipText(b, `${TOWERS[kind].name}: ${stats}. ${TOWERS[kind].blurb}`), 380);
    });
    b.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      hideTip();
      ringFor(null);
    });
    // Plan item 87: keyboard focus shows the tower's range on the field too.
    b.addEventListener("focus", () => ringFor(kind));
    b.addEventListener("blur", () => ringFor(null));
    // On touch a long press shows the ring too (a drag that moves takes over from it).
    b.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      clearTimeout(ringTimer);
      ringTimer = window.setTimeout(() => ringFor(kind), 420);
    });
    for (const ev of ["pointerup", "pointercancel"] as const)
      b.addEventListener(ev, (e) => {
        if (e.pointerType === "mouse") return;
        clearTimeout(ringTimer);
        if (!drag?.moved) ringFor(null);
      });
    b.onclick = () => {
      if (dragEnded()) return;
      hideTip();
      if (selected && ringWanted() && canDrop(g, kind, selected)) {
        const now = towerCost(g, kind);
        if (g.marks >= now) plant(g, kind, selected);
        else toast(`${TOWERS[kind].name}: ${now} Marks. ${etaText(g, now)}`.trim());
        return;
      }
      toast(`Drag the ${TOWERS[kind].name} onto a plot beside the lane, or tap a plot first. ${stats}.`);
    };
    tray.append(b);
  }
  const more = document.createElement("button");
  more.type = "button";
  more.className = "tray-more";
  more.setAttribute("aria-label", "More towers");
  more.hidden = true;
  more.onclick = () => tray.scrollBy({ left: tray.clientWidth * 0.8, behavior: reducedMotion() ? "auto" : "smooth" });
  const sync = () => {
    const over = tray.scrollWidth > tray.clientWidth + 2;
    more.hidden = !over || tray.scrollLeft + tray.clientWidth >= tray.scrollWidth - 4;
    wrap.classList.toggle("overflows", over);
    wrap.classList.toggle("more-shown", !more.hidden);
  };
  tray.addEventListener("scroll", sync, { passive: true });
  requestAnimationFrame(sync);
  wrap.append(tray, more);
  p.append(wrap);
}

const ROLE_NAMES: Record<TowerRole, string> = { slow: "Slows", splash: "Splash", boost: "Boosts", income: "Earns", shot: "Shoots" };
/** Small ink glyphs for each role (24-unit viewBox, stroked in currentColor). */
const ROLE_GLYPHS: Record<TowerRole, string> = {
  slow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15c3-6 6-6 9 0s6 6 9 0"/></svg>',
  splash: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',
  boost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M6 11l6-6 6 6"/></svg>',
  income: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 10h4a2 2 0 0 1 0 4h-3"/></svg>',
  shot: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>',
};
/** Range and damage per second as 1-4 pips each, against the strongest tower in this level's roster. */
function trayPips(g: Game, kind: TowerKind): HTMLElement {
  const fleet = isFleet(g.level);
  const of = (k: TowerKind) => {
    const st = towerStats({ kind: k, tier: 1, spec: null, fleet });
    return { range: st.range, dps: st.damage > 0 ? (st.damage * Math.max(1, st.pierce ?? 1)) / st.cooldown : 0 };
  };
  const all = g.level.towers.filter((k) => towerAllowed(g.level, k)).map(of);
  const me = of(kind);
  const scale = (v: number, max: number) => (v <= 0 || max <= 0 ? 0 : Math.max(1, Math.round((v / max) * 4)));
  const wrap = document.createElement("span");
  wrap.className = "tray-pips";
  wrap.setAttribute("aria-hidden", "true");
  for (const [label, n] of [
    ["Range", scale(me.range, Math.max(...all.map((a) => a.range)))],
    ["Damage", scale(me.dps, Math.max(...all.map((a) => a.dps)))],
  ] as const) {
    const row = document.createElement("span");
    row.className = `pip-row ${label.toLowerCase()}`;
    row.dataset.pips = String(n);
    row.title = label;
    for (let i = 0; i < 4; i++) {
      const pip = document.createElement("b");
      if (i < n) pip.className = "on";
      row.append(pip);
    }
    wrap.append(row);
  }
  return wrap;
}

let ringTimer = 0;
/**
 * Plan item 31: while a tray card is hovered (or long-pressed) its range ring is drawn on the field before placing:
 * on the selected plot if it's free, else on the open plot nearest the middle of the lane.
 */
function ringFor(kind: TowerKind | null): void {
  if (!game || !renderer || drag?.moved) return;
  if (!kind) {
    renderer.selected = selected;
    renderer.preview = null;
    return;
  }
  const g = game;
  let at = selected && canDrop(g, kind, selected) ? selected : null;
  if (!at) {
    const lane = [...laneCellsOf(g.level)].map((k) => k.split(",").map(Number) as [number, number]);
    const mid = lane[Math.floor(lane.length / 2)] ?? [g.level.cols / 2, g.level.rows / 2];
    let best = Infinity;
    for (let row = 0; row < g.level.rows; row++)
      for (let col = 0; col < g.level.cols; col++) {
        const c = { col, row };
        if (!canDrop(g, kind, c)) continue;
        // Plain ground first, so the ring shows the card's own range (high ground would stretch it by a quarter).
        const d = Math.hypot(col - mid[0], row - mid[1]) + (plotKind(g.level, col, row) === "plain" ? 0 : 100);
        if (d < best) {
          best = d;
          at = c;
        }
      }
  }
  if (!at) return;
  renderer.selected = at;
  renderer.preview = kind;
}

function startDrag(e: PointerEvent, kind: TowerKind): void {
  if (!game || player || e.button > 0) return;
  // No native image drag (it would cancel the pointer stream) and no text selection.
  e.preventDefault();
  drag = { kind, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, cell: null, ok: false };
}

/** Can `kind` be built on this cell right now (the same checks the engine makes, bar the price)? */
function canDrop(g: Game, kind: TowerKind, c: { col: number; row: number } | null): boolean {
  if (!c || !isPlot(g.level, c.col, c.row) || towerAt(g, c.col, c.row)) return false;
  if (laneCellsOf(g.level).has(`${c.col},${c.row}`)) return false;
  const ground = plotKind(g.level, c.col, c.row);
  return !(ground === "water" && kind !== "pond") && towerAllowed(g.level, kind);
}

window.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id || !game || !renderer) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 10) return;
  if (!drag.moved) {
    drag.moved = true;
    drag.ghost = img(towerIcon(drag.kind), "drag-ghost");
    document.body.append(drag.ghost);
    renderer.preview = drag.kind;
  }
  drag.ghost!.style.left = `${e.clientX}px`;
  drag.ghost!.style.top = `${e.clientY}px`;
  const r = ui.canvas.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  drag.cell = inside ? renderer.cellAt(e.clientX, e.clientY, game) : null;
  drag.ok = canDrop(game, drag.kind, drag.cell);
  drag.ghost!.classList.toggle("bad", !drag.ok);
  renderer.selected = drag.cell;
});

function endDrag(e: PointerEvent, cancel: boolean): void {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (!d.moved) return;
  dragEndedAt = performance.now();
  d.ghost?.remove();
  if (renderer) {
    renderer.selected = selected;
    renderer.preview = null;
  }
  if (cancel || !game || !d.cell || !d.ok) return;
  if (doAct({ t: "place", kind: d.kind, col: d.cell.col, row: d.cell.row })) {
    sfx.playBuild();
    haptic.build();
    const nt = game.towers[game.towers.length - 1];
    if (nt) renderer?.built_(nt.id, nt.col, nt.row, false);
    if (selected) deselect();
    else renderPanel(true);
  }
}
window.addEventListener("pointerup", (e) => endDrag(e, false));
window.addEventListener("pointercancel", (e) => endDrag(e, true));

const TARGET_LABEL: Record<TargetMode, string> = { first: "First", last: "Last", strong: "Strongest", close: "Closest" };

type Stats = ReturnType<typeof towerStats>;

/** The numbers a player compares: label and value, for a tower at some tier. */
function statList(st: Stats): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (st.damage && st.sweep) {
    // Whirling Scythe: no aimed shots, a spin every so often.
    rows.push(["Sweep", `every ${+st.gustEvery.toFixed(2)}s`], ["Hit", st.damage.toFixed(0)]);
  } else if (st.damage) {
    // Fleet hits are a layer or two: small rates need a decimal or every tier reads "1".
    const dps = (st.damage * st.fan) / st.cooldown;
    rows.push(["Damage/s", dps < 10 ? `${+dps.toFixed(1)}` : dps.toFixed(0)]);
    rows.push(["Hit", st.damage.toFixed(0)]);
    rows.push(["Rate", `${(1 / st.cooldown).toFixed(1)}/s`]);
  }
  if (st.fan > 1) rows.push(["Targets", `${st.fan} a shot`]);
  if (st.pierce > 1) rows.push(["Pierce", `${st.pierce} vehicles`]);
  if (st.range) rows.push(["Range", st.global ? "the whole field" : st.range.toFixed(1)]);
  if (st.detect) rows.push(["Stealth", "sees it"]);
  if (st.stun) rows.push(["Stun", `${st.stun}s`]);
  if (st.shellMul > 1) rows.push(["Long shells", `×${st.shellMul}`]);
  if (st.plantDamage) rows.push(["vs Plant", `${st.plantDamage} layers`]);
  if (st.piles) rows.push(["Thorn piles", `${st.piles.hits} hits, up to ${st.piles.max}`]);
  if (st.hold) rows.push(["Holds", `${st.hold.count} for ${st.hold.secs}s, every ${st.hold.every}s`]);
  if (st.vuln > 1) rows.push(["Marked", `+${Math.round((st.vuln - 1) * 100)}% layers taken`]);
  if (st.rangeAura > 1) rows.push(["Nearby towers", `+${Math.round((st.rangeAura - 1) * 100)}% range`]);
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
  if (st.ignoresArmour) rows.push(["Armour", "ignored"]);
  // On the Fleet a boost speeds a tower's firing instead of adding damage (engine: cooldown / boost).
  const boostWord = game && isFleet(game.level) ? "faster" : "damage";
  if (st.buff > 1) rows.push(["Nearby towers", `+${Math.round((st.buff - 1) * 100)}% ${boostWord}`]);
  if (st.aura > 1) rows.push(["Every tower", `+${Math.round((st.aura - 1) * 100)}% ${boostWord}`]);
  if (st.income) rows.push(["Income", `+${st.income} a wave`]);
  // On the Fleet a Mast's reveal is detection only (Pirate Radio's marking is `vuln`, above).
  if (st.reveal > 1) rows.push(game && isFleet(game.level) ? ["Reveals", st.global ? "stealth everywhere" : "stealth in range"] : ["Marked", `+${Math.round((st.reveal - 1) * 100)}% damage taken`]);
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
  // Fleet levels: every tower grows on the three-column path sheet (Hedgerow 2 M4; the towers without paths
  // yet show their tiers as path A through the legacy adapter).
  if (t.fleet && !t.mega) {
    pathCard(p, g, t);
    return;
  }
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
  // Fleet: its damage type, and a green or red badge for every lock (Hedgerow 2 section 2), as a compact
  // strip in the header, so a phone held sideways shows them without scrolling past Upgrade and Sell.
  // (At tier 3 the specialisation choice owns the top of the card, so the strip goes below it.)
  const badges = t.fleet && !t.mega ? badgeRow(t.kind, t.tier, t.spec ?? null) : null;
  if (badges && t.tier !== 3) titles.append(badges);
  // Veterans: kills, rank, and how far to the next.
  const kills = t.kills ?? 0;
  const rank = rankOf(kills);
  if (t.fleet && (st.damage > 0 || st.thorns > 0 || st.gustEvery > 0)) {
    // Hedgerow 2: every layer a tower knocks off is a Knockout and a Mark. A big live counter (updateHud
    // keeps it ticking without rebuilding the panel).
    const ko = document.createElement("p");
    ko.className = "ko-line";
    ko.dataset.tower = String(t.id);
    ko.innerHTML = `<strong class="ko-n"></strong> <span>Knockouts</span> <span class="ko-m"></span>`;
    titles.append(ko);
    syncKnockouts();
  } else if (st.damage > 0 || st.thorns > 0 || st.gustEvery > 0) {
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
    const nextStats = previewStats(t, { tier: (t.tier + 1) as 2 | 3, spec: null });
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
      b.append(top, d, statGrid(st, previewStats(t, { tier: 4, spec: i })));
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
    // Right under the choice, above the fold on a phone held upright.
    if (badges) p.append(badges);
    if (!open) p.append(line(`Specialisations open at level ${SPEC_FIRST_LEVEL}.`, "hint"));
    p.append(ownStats);
  } else p.append(statGrid(st));
  if (!t.mega && t.tier >= 3) mergeSection(p, g, t);
  const sl = document.createElement("button");
  sl.type = "button";
  sl.className = "btn btn-quiet";
  sl.id = "btn-sell";
  sl.textContent = `Sell +${sellValue(t, g)}`;
  sl.onclick = () => {
    if (doAct({ t: "sell", id: t.id })) sfx.playSell();
    deselect();
  };
  row.append(sl);
  p.append(row);
  if (badges && t.tier === 3 && !badges.isConnected) p.append(badges);
}

const PATH_COLOURS = ["#d4543c", "#3f7fd0", "#4f9a3e"];

/** A path tower's name as it stands: its tier 3's name once it has one. */
function towerName(t: Tower): string {
  if (t.path && hasPaths(t.kind)) {
    const top = topPath(t.path);
    if (t.crown !== undefined) return PATHS[t.kind].paths[t.crown].crown?.name ?? PATHS[t.kind].paths[t.crown].tiers[2].name;
    if (top !== null) return PATHS[t.kind].paths[top].tiers[2].name;
  }
  if (t.tier === 4 && t.spec != null) return SPECIALISATIONS[t.kind][t.spec].name;
  return TOWERS[t.kind].name;
}

/**
 * The tower sheet on fleet levels (Hedgerow 2 M4): a header (name, build, Knockouts, targeting), then three path
 * columns. Each shows its tiers, bought ones filled, and its next tier as a button with the price, a fill bar,
 * an "affordable" glow and "in about N rounds". On a phone the panel becomes a bottom sheet over the field.
 */
function pathCard(p: HTMLElement, g: Game, t: Tower): void {
  p.classList.add("panel-tower", "panel-paths");
  // A landscape phone docks the sheet to the side away from the tower, so the tower being grown stays in view
  // (styles.css; portrait keeps the bottom sheet, under the field's top half).
  const at = renderer?.cellCenter(t.col, t.row);
  p.classList.toggle("dock-left", !!at && at.x > window.innerWidth / 2);
  const st = towerStats(t);
  const path: Path = t.path ?? legacyPath(t.tier, t.spec);
  const head = document.createElement("div");
  head.className = "tower-head";
  head.append(img(towerIcon(t.kind, t.tier, t.spec ?? null, t.path), "tower-icon"));
  const titles = document.createElement("div");
  titles.className = "tower-titles";
  const name = towerName(t);
  const title = line(name, "panel-title");
  const chip = document.createElement("span");
  chip.className = "build-chip";
  chip.textContent = buildName(path);
  chip.title = `Build ${buildName(path)}: tiers bought along each path`;
  title.setAttribute("aria-label", `${name}, build ${buildName(path)}`);
  title.append(" ", chip);
  titles.append(title);
  if (st.damage > 0 || st.thorns > 0 || st.gustEvery > 0 || st.piles) {
    const ko = document.createElement("p");
    ko.className = "ko-line";
    ko.dataset.tower = String(t.id);
    ko.innerHTML = `<strong class="ko-n"></strong> <span>Knockouts</span> <span class="ko-m"></span>`;
    titles.append(ko);
  }
  if (st.damage > 0) {
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
  // Sell sits in the head beside Target (AAA UI M3 review): always in view, never below the fold of the
  // packets and Details, and away from the close button.
  const sl = document.createElement("button");
  sl.type = "button";
  sl.className = "sell-btn";
  sl.id = "btn-sell";
  sl.textContent = `Sell +${sellValue(t, g)}`;
  sl.onclick = () => {
    if (doAct({ t: "sell", id: t.id })) sfx.playSell();
    deselect();
  };
  titles.append(sl);
  head.append(titles);
  // On a phone the sheet covers the bottom of the field: a clear way to put it away.
  const close = document.createElement("button");
  close.type = "button";
  close.className = "sheet-close";
  close.setAttribute("aria-label", "Close the tower sheet");
  close.textContent = "×";
  close.onclick = () => deselect();
  head.append(close);
  p.append(head);
  syncKnockouts();

  const grid = statGrid(st);
  const sheet = document.createElement("div");
  sheet.className = "path-sheet";
  sheet.setAttribute("role", "group");
  sheet.setAttribute("aria-label", "Upgrade paths");
  if (t.path && hasPaths(t.kind)) {
    const kind = t.kind;
    for (const i of [0, 1, 2] as const) sheet.append(pathColumn(g, t, kind, i, path, () => grid));
  } else sheet.append(...legacyColumns(g, t));
  p.append(sheet);
  const badges = badgeRow(t.kind, t.tier, t.spec ?? null, t.path);
  p.append(badges);
  // Last time's build for this tower, as a reminder of a plan that worked.
  const last = t.path && hasPaths(t.kind) ? data.builds?.[t.kind] : undefined;
  if (last && buildName(last) !== buildName(path)) p.append(line(`Last time: ${buildName(last)}`, "hint last-build"));
  // The numbers fold away under "Details" on a phone, so the three packets come first; the side panel shows them.
  const details = document.createElement("details");
  details.className = "stat-details";
  details.open = statsOpen ?? !phoneSheet();
  const summary = document.createElement("summary");
  summary.textContent = "Details";
  details.append(summary, grid);
  details.addEventListener("toggle", () => (statsOpen = details.open));
  p.append(details);
  refreshPaths();
}

/** Whether the tower sheet is a phone's bottom or side sheet (styles: max-width 899.98px or max-height 520px). */
function phoneSheet(): boolean {
  return matchMedia("(max-width: 899.98px), (max-height: 520px)").matches;
}
/** The "Details" fold's last state this visit (null: open on a desktop, shut on a phone). */
let statsOpen: boolean | null = null;

/**
 * The upgrade-bought beat (AAA UI M3): the button squashes, the new pip fills with an ink-splat ring in the
 * path's colour, the packet's header flashes, the build code ticks, and a tier 3's new name flips in. The sound
 * and haptic already fired with the purchase. Reduced motion keeps only the end state.
 */
function celebrate(path: number, tier: number, renamed: boolean): void {
  const col = ui.panel.querySelector<HTMLElement>(`.path-col[data-path="${path}"]`);
  if (!col) return;
  col.classList.add("just-bought", "flash");
  ui.panel.querySelector(".build-chip")?.classList.add("ticked");
  if (renamed) ui.panel.querySelector(".panel-title")?.classList.add("renamed");
  const pip = col.querySelectorAll<HTMLElement>(".path-pips i")[tier];
  if (!pip || reducedMotion()) return;
  pip.classList.add("fresh");
  const a = pip.getBoundingClientRect();
  const b = col.getBoundingClientRect();
  const host = document.createElement("span");
  host.className = "path-burst";
  host.style.setProperty("left", `${a.left - b.left + a.width / 2 - 6}px`);
  host.style.setProperty("top", `${a.top - b.top + a.height / 2 - 6}px`);
  col.append(host);
  burst(host, { color: "var(--c)", n: 8, ring: true, dist: 26 });
  setTimeout(() => host.remove(), 1300);
}

/** One path's column: its name, its three tiers (bought ones filled) and the button for the next. */
function pathColumn(g: Game, t: Tower, kind: PathKind, i: PathIndex, path: Path, grid: () => HTMLElement): HTMLElement {
  const def = PATHS[kind].paths[i];
  const col = document.createElement("section");
  col.className = "path-col";
  col.dataset.path = String(i);
  col.style.setProperty("--path", PATH_COLOURS[i]!);
  const done = path[i];
  const block = pathBlock(path, i, g.level.id) ?? (done === 2 ? xpBlock(g, kind, 3) : null);
  if (done > 0) col.classList.add("taken");
  if (block && done < PATH_TIERS) col.classList.add("shut");
  const h = document.createElement("h4");
  h.className = "path-name";
  h.innerHTML = `<span class="path-long"></span><span class="path-short"></span>`;
  h.querySelector(".path-long")!.textContent = def.name;
  h.querySelector(".path-short")!.textContent = def.short;
  // The ladder at a glance, on the packet's header: one pip a tier (tier 3 a diamond), then the Crown.
  const pips = document.createElement("span");
  pips.className = "path-pips";
  pips.setAttribute("aria-hidden", "true");
  def.tiers.forEach((_, k) => {
    const pip = document.createElement("i");
    if (k < done) pip.className = "on";
    if (k === 2) pip.classList.add("t3");
    pips.append(pip);
  });
  if (def.crown) {
    const pip = document.createElement("i");
    pip.className = t.crown === i ? "t4 on" : "t4";
    pips.append(pip);
  }
  h.append(pips);
  col.append(h);
  const steps = document.createElement("ol");
  steps.className = "path-steps";
  def.tiers.forEach((tier, k) => {
    const li = document.createElement("li");
    li.className = k < done ? "bought" : k === done ? "next" : "later";
    if (k === 2) li.classList.add("t3");
    li.textContent = tier.name;
    li.title = `${tier.name}: ${tier.blurb}`;
    steps.append(li);
  });
  if (def.crown) {
    const li = document.createElement("li");
    li.className = t.crown === i ? "bought t4" : done >= PATH_TIERS ? "next t4" : "later t4";
    li.textContent = def.crown.name;
    li.title = `${def.crown.name} (Crown): ${def.crown.blurb}`;
    steps.append(li);
  }
  col.append(steps);
  if (done >= PATH_TIERS) {
    const crown = def.crown;
    if (!crown || t.crown === i) {
      col.append(line(t.crown === i ? `Crowned: ${crown!.name}.` : "Complete. Its Crown comes later.", "path-done"));
      const ab = t.crown === i ? crown?.ability : undefined;
      if (ab) {
        const ub = document.createElement("button");
        ub.type = "button";
        ub.className = "path-buy crown-use";
        ub.dataset.tower = String(t.id);
        ub.innerHTML = `<span class="path-tier">Ability</span><strong class="path-next"></strong><span class="path-adds"></span><span class="path-foot"><span class="path-eta"></span></span>`;
        ub.querySelector(".path-next")!.textContent = ab.name;
        ub.querySelector(".path-adds")!.textContent = ab.blurb;
        ub.title = ab.blurb;
        ub.onclick = () => {
          if (doAct({ t: "crownUse", id: t.id })) {
            sfx.playBoss();
            haptic.boss();
            banner(ab.name, `${crown!.name}`, false, "small");
            refreshPaths();
          } else toast(`${ab.name} isn't ready.`);
        };
        col.append(ub);
        refreshPaths();
      }
      return col;
    }
    const cblock = crownBlock(g, t, i);
    const cb = document.createElement("button");
    cb.type = "button";
    cb.className = "path-buy t4";
    cb.dataset.path = String(i);
    cb.dataset.cost = String(crown.cost);
    cb.dataset.locked = cblock ? "1" : "0";
    cb.disabled = !!cblock || g.marks < crown.cost;
    cb.innerHTML = `<span class="path-tier"></span><strong class="path-next"></strong><span class="path-adds"></span><span class="path-foot"><span class="build-cost"></span><span class="path-eta"></span></span>`;
    cb.querySelector(".path-tier")!.textContent = "Crown";
    cb.querySelector(".path-next")!.textContent = crown.name;
    cb.querySelector(".path-adds")!.textContent = crown.adds;
    cb.querySelector(".build-cost")!.textContent = String(crown.cost);
    cb.querySelector(".path-eta")!.textContent = cblock ?? "";
    cb.setAttribute("aria-label", `${def.name} Crown: ${crown.name}, ${crown.cost} Marks. ${crown.blurb}${cblock ? ` ${cblock}` : ""}`);
    cb.title = crown.blurb;
    cb.onclick = () => {
      if (doAct({ t: "upgrade", id: t.id, path: i })) {
        sfx.playUpgrade();
        haptic.upgrade();
        renderer?.built_(t.id, t.col, t.row, true);
        renderPanel(true);
      }
    };
    col.append(cb);
    return col;
  }
  const tier = def.tiers[done]!;
  const cost = pathUpgradeCost(g, t, i) ?? tier.cost;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "path-buy";
  b.dataset.path = String(i);
  b.dataset.cost = String(cost);
  b.dataset.locked = block ? "1" : "0";
  b.disabled = !!block || g.marks < cost;
  if (done === 2) b.classList.add("t3");
  b.innerHTML = `<span class="path-tier"></span><strong class="path-next"></strong><span class="path-adds"></span><span class="path-foot"><span class="build-cost"></span><span class="path-eta"></span></span><span class="path-bar" aria-hidden="true"></span>`;
  b.querySelector(".path-tier")!.textContent = `Tier ${done + 1}`;
  b.querySelector(".path-next")!.textContent = tier.name;
  b.querySelector(".path-adds")!.textContent = tier.adds;
  b.querySelector(".build-cost")!.textContent = String(cost);
  b.querySelector(".path-eta")!.textContent = block ?? "";
  b.setAttribute("aria-label", `${def.name} tier ${done + 1}: ${tier.name}, ${cost} Marks. ${tier.blurb}${block ? ` ${block}` : ""}`);
  b.title = tier.blurb;
  // Hover or focus: the stat grid shows what it would change.
  const next = previewPath(t, i);
  let shown: HTMLElement | null = null;
  const show = () => {
    if (!next || shown) return;
    const base = grid();
    shown = statGrid(towerStats(t), next);
    shown.classList.add("stats-preview");
    base.hidden = true;
    base.after(shown);
  };
  const hide = () => {
    shown?.remove();
    shown = null;
    grid().hidden = false;
  };
  b.addEventListener("pointerenter", show);
  b.addEventListener("pointerleave", hide);
  b.addEventListener("focus", show);
  b.addEventListener("blur", hide);
  b.onclick = () => {
    if (doAct({ t: "upgrade", id: t.id, path: i })) {
      sfx.playUpgrade();
      haptic.upgrade();
      renderer?.built_(t.id, t.col, t.row, true);
      // A tier 3 is a new tower: say its name.
      if (done === 2) banner(tier.name, `${TOWERS[t.kind].name}, ${def.name} tier 3`, false, "small");
      renderPanel(true);
      celebrate(i, done, done === 2);
    }
  };
  col.append(b);
  return col;
}

/**
 * The legacy adapter (M4): a tower without paths yet shows its tiers as path A (tier 2, tier 3, then a choice
 * of its two specialisations), beside two quiet columns saying its other paths come later.
 */
function legacyColumns(g: Game, t: Tower): HTMLElement[] {
  const col = document.createElement("section");
  col.className = "path-col taken legacy";
  col.dataset.path = "0";
  col.style.setProperty("--path", PATH_COLOURS[0]!);
  const h = document.createElement("h4");
  h.className = "path-name";
  h.textContent = "Grow";
  col.append(h);
  const steps = document.createElement("ol");
  steps.className = "path-steps";
  const names = ["Tier 2", "Tier 3", t.tier === 4 && t.spec != null ? SPECIALISATIONS[t.kind][t.spec].name : "Specialise"];
  names.forEach((n, k) => {
    const li = document.createElement("li");
    li.className = k < t.tier - 1 ? "bought" : k === t.tier - 1 ? "next" : "later";
    li.textContent = n;
    steps.append(li);
  });
  col.append(steps);
  const buy = (label: string, adds: string, cost: number, locked: string | null, act: () => void, cls = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `path-buy ${cls}`.trim();
    b.dataset.path = "0";
    b.dataset.cost = String(cost);
    b.dataset.locked = locked ? "1" : "0";
    b.disabled = !!locked || g.marks < cost;
    b.innerHTML = `<strong class="path-next"></strong><span class="path-adds"></span><span class="path-foot"><span class="build-cost"></span><span class="path-eta"></span></span><span class="path-bar" aria-hidden="true"></span>`;
    b.querySelector(".path-next")!.textContent = label;
    b.querySelector(".path-adds")!.textContent = adds;
    b.querySelector(".build-cost")!.textContent = String(cost);
    b.querySelector(".path-eta")!.textContent = locked ?? "";
    b.setAttribute("aria-label", `${label}, ${cost} Marks. ${adds}${locked ? ` ${locked}` : ""}`);
    b.onclick = act;
    col.append(b);
  };
  const grown = () => {
    sfx.playUpgrade();
    haptic.upgrade();
    renderer?.built_(t.id, t.col, t.row, true);
    renderPanel(true);
  };
  if (t.tier < 3) buy(`Tier ${t.tier + 1}`, "Bigger numbers all round.", upgradeCost(t)!, null, () => doAct({ t: "upgrade", id: t.id }) && grown());
  else if (t.tier === 3) {
    const open = specsUnlocked(g.level);
    ([0, 1] as const).forEach((i) => {
      const sp = SPECIALISATIONS[t.kind][i];
      buy(sp.name, sp.blurb, specCost(t, i)!, open ? null : `Opens at level ${SPEC_FIRST_LEVEL}.`, () => doAct({ t: "upgrade", id: t.id, spec: i }) && grown(), `spec spec-${i}`);
    });
  } else col.append(line("Complete.", "path-done"));
  const later = (k: number) => {
    const c = document.createElement("section");
    c.className = "path-col shut legacy-later";
    c.dataset.path = String(k);
    c.append(line("Two more paths for this tower arrive in a later update.", "hint"));
    return c;
  };
  return [col, later(1), later(2)];
}

/** Megastructures: merge buttons for grown neighbours, or a hint about what this tower could become. */
function mergeSection(p: HTMLElement, g: Game, t: Tower): void {
  const heirloom = heirloomsUnlocked(g.level);
  if (!megasUnlocked(g.level) && !heirloom) return;
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
    top.textContent = `${heirloom ? "Forge" : "Merge with"} the ${TOWERS[partner.kind].name} → ${m.name} · ${o.cost}`;
    const d = document.createElement("small");
    d.textContent = m.blurb;
    b.append(top, d, statGrid(st0(t), previewStats(t, { tier: 4, mega: o.mega })));
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
        heirloom
          ? `Heirloom: crown a ${partners.map((k) => `${TOWERS[k].name} (→ ${MEGAS[megaFor(t.kind, k)!].name})`).join(" or a ")} right beside this Crowned tower, then forge them (${HEIRLOOM_FEE} Marks, one a field).`
          : `Megastructure: grow a ${partners.map((k) => `${TOWERS[k].name} (→ ${MEGAS[megaFor(t.kind, k)!].name})`).join(" or a ")} to tier 3 right beside this one, then merge them.`,
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

function leakReport(g: Game, k: EnemyKind, dropped = false, lost = 0): void {
  const cause = leakCause(g, k, dropped, stackedWave > 0 && stackedWave === g.wave);
  // Fleet levels: the banner says what the leak cost (its Fleet Value), "Leaked: Same-Day van (5)".
  const name = isFleet(g.level) && lost > 0 ? `${ENEMIES[k].name} (${lost})` : ENEMIES[k].name;
  banner(`Leaked: ${name}`, cause, false, "leak");
  say(`Leaked: ${name}. ${cause}`);
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

function banner(text: string, sub = "", boss = false, cls = ""): void {
  ui.banner.replaceChildren();
  const big = document.createElement("strong");
  big.textContent = text;
  ui.banner.append(big);
  if (sub) {
    const s = document.createElement("span");
    s.textContent = sub;
    ui.banner.append(s);
  }
  ui.banner.className = `banner show${boss ? " boss" : ""}${cls ? ` ${cls}` : ""}`;
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => ui.banner.classList.remove("show"), boss ? 2600 : 1700);
}

function describeEnemy(kind: EnemyKind): string {
  // Fleet rungs (Hedgerow 2): what it looks like, what it pops into and what a leak costs.
  const rung = game && isFleet(game.level) ? RUNGS[kind] : undefined;
  if (rung && !isBig(kind)) return `${rung.look} Worth ${fvOf(kind)} Mark${fvOf(kind) === 1 ? "" : "s"} popped; a leak costs ${fvOf(kind)} Goodwill.`;
  const e = ENEMIES[kind];
  const bits: string[] = [];
  // A Fleet boss is Heavy Plant by the Fleet's rules (no damage-type resistances): say those, not act 1's.
  if (isBig(kind) && game && isFleet(game.level)) return `A boss: Cath can't hold it and pies only stun it half as long. ${PROPERTIES.plant.lock} ${PROPERTIES.plant.key}`;
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

/**
 * Plan item 64: a new enemy arrives as a page of Cath's field guide. The round's first unmet vehicle rolls on,
 * the sim holds and the field dims, and the page shows its sketch, its traits and the level's towers that reach
 * it. Tap (or Enter, Space, Escape) to carry on. A replay never holds; the sandbox and automated browsers let the
 * page go by itself after a few seconds (`?intro=hold` keeps it, for the e2e), so screenshot scripts never stall.
 */
let introQueue: { g: Game; kinds: EnemyKind[]; at: number } | null = null;
/** The page is up and the sim is held for it. */
let introHold = false;
const INTRO_AUTO = !new URLSearchParams(location.search).has("intro") && (SANDBOX || navigator.webdriver);

function introduce(kinds: EnemyKind[], round?: number): void {
  const g = game;
  if (!g) return;
  const fresh = round ? newThisRound(g.level, round, data.seen) : kinds.filter((k) => !data.seen[k]);
  if (!fresh.length) return;
  for (const k of fresh) data.seen[k] = true;
  save(data);
  // A boss has its own banner; the rest wait for their vehicle to roll on.
  introQueue = { g, kinds: fresh, at: g.waveClock };
}

/** Called each stepped frame: open the queued page once its vehicle is a little way down the lane. */
function introWatch(g: Game): void {
  const q = introQueue;
  if (!q || q.g !== g || introHold || !ui.intro.hidden) return;
  // The round's ribbon says its piece first: the page never lands on it.
  if (g.phase !== "wave" || ui.banner.classList.contains("show")) return;
  const k = q.kinds[0]!;
  const on = g.enemies.some((e) => e.kind === k && e.dist >= 1.2);
  if (!on && g.waveClock - q.at < 7) return;
  q.kinds.shift();
  if (!q.kinds.length) introQueue = null;
  showIntroPage(g, k);
}

const TRAIT_PROP: Partial<Record<Trait, Property>> = { flies: "airborne", armour: "plated", stealth: "stealth", wrapped: "wrapped", sealed: "sealed", reefer: "reefer", heavy: "plant" };
const TRAIT_SVG: Partial<Record<Trait, string>> = {
  boss: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 L5 7 L9.5 12 L12 5 L14.5 12 L19 7 L21 18 Z" fill="currentColor"/></svg>',
  fast: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 L5 14 H11 L10 21 L19 9 H13 Z" fill="currentColor"/></svg>',
  slow: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 9 V13 L15 15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M9 3 H15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  splits: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 V12 M12 12 L5 5 M12 12 L19 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M5 5 h4 M5 5 v4 M19 5 h-4 M19 5 v4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
};

function showIntroPage(g: Game, k: EnemyKind): void {
  const el = ui.intro;
  el.replaceChildren();
  el.className = "intro intro-page";
  el.dataset.kind = k;
  const sheet = document.createElement("div");
  sheet.className = "intro-sheet";
  const sketch = document.createElement("figure");
  sketch.className = "intro-sketch";
  sketch.append(img(enemyIcon(k), "intro-icon"));
  const body = document.createElement("div");
  body.className = "intro-body";
  const eb = document.createElement("p");
  eb.className = "eyebrow";
  eb.textContent = isBig(k) ? "Cath's field guide · Boss" : "Cath's field guide · New on the lane";
  const n = document.createElement("h2");
  n.id = "intro-name";
  n.textContent = ENEMIES[k].name;
  const traits = document.createElement("ul");
  traits.className = "intro-traits";
  for (const t of traitsOf(k)) {
    const li = document.createElement("li");
    const prop = TRAIT_PROP[t];
    if (prop) li.append(img(propIcon(prop), "intro-trait-icon"));
    else if (TRAIT_SVG[t]) li.insertAdjacentHTML("beforeend", TRAIT_SVG[t]!);
    li.append(TRAIT_TEXT[t]);
    traits.append(li);
  }
  const d = document.createElement("p");
  d.className = "intro-desc";
  d.textContent = describeEnemy(k);
  const reachH = document.createElement("p");
  reachH.className = "intro-reach-h";
  reachH.textContent = "Your towers that reach it";
  const reach = document.createElement("ul");
  reach.className = "intro-reach";
  const counters = countersFor(k, g.level.towers);
  for (const t of g.level.towers) {
    const li = document.createElement("li");
    const lit = counters.includes(t);
    li.className = lit ? "lit" : "dim";
    li.append(img(towerIcon(t), "intro-tower"));
    const label = document.createElement("span");
    label.textContent = TOWERS[t].name;
    li.append(label);
    if (lit && needsUpgrade(k, t)) {
      const up = document.createElement("small");
      up.textContent = "once upgraded";
      li.append(up);
    }
    if (!lit) li.setAttribute("aria-label", `${TOWERS[t].name}: can't reach it`);
    reach.append(li);
  }
  if (!counters.length) {
    const none = document.createElement("li");
    none.className = "none";
    none.textContent = "Nothing in this kit reaches it: save Cath's pie for it.";
    reach.append(none);
  }
  const go = document.createElement("button");
  go.type = "button";
  go.className = "btn intro-go";
  go.textContent = "Got it";
  body.append(eb, n, traits, d, reachH, reach, go);
  sheet.append(sketch, body);
  el.append(sheet);
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-labelledby", "intro-name");
  el.hidden = false;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
  say(`${ENEMIES[k].name}. ${describeEnemy(k)}`);
  // Plan item 19: one voice at a time. Cath's tip steps aside and comes back after the page.
  if (!ui.bubble.hidden && bubbleTip) {
    pendingTip = { id: bubbleTip, text: ui.bubbleText.textContent ?? "", expression: bubbleFace };
    clearTimeout(bubbleTimer);
    hideBubble();
  }
  clearTimeout(introTimer);
  // A replay never holds the field; elsewhere the sim waits for the tap.
  introHold = !player;
  if (player || INTRO_AUTO) introTimer = window.setTimeout(hideIntro, player ? 2600 : 3200);
  if (introHold) go.focus({ preventScroll: true });
}

function hideIntro(): void {
  clearTimeout(introTimer);
  ui.intro.hidden = true;
  introHold = false;
  const p = pendingTip;
  pendingTip = null;
  if (p && game) tip(p.id, p.text, p.expression, true);
  if (document.activeElement && ui.intro.contains(document.activeElement)) ui.canvas.focus({ preventScroll: true });
}

ui.intro.addEventListener("click", () => {
  if (!ui.intro.hidden) hideIntro();
});
ui.intro.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
    hideIntro();
  }
});

// ---- plan item 95: Cath's advice for the round, said beside her on the field before Go ----

/** What the bubble shows now (field px), for the e2e tests through the sandbox hook. */
let sayShown: { text: string; box: BarkSpot; cath: Box } | null = null;
let sayText = "";
let sayAt = -1e9;

/** Her line for the next round (plan item 72's advice), or "" when she has nothing to say. */
function adviceLine(g: Game): string {
  if (!betweenRounds(g)) return "";
  const groups = g.level.waves[g.wave];
  if (!groups) return "";
  // A lock this round brings that nothing on the field answers comes first (the ticket stamps it too).
  const gap = gapAdvice(unanswered(g, roundProps(g.level, groups)), g.level.towers, (k) => towerCost(g, k));
  return gap ?? roundAdvice(waveSpawns(g, groups, g.wave + 1), g.level.towers, g.towers.map((x) => x.kind))?.line ?? "";
}

/** Plan item 128: a line of hers for a few seconds in place of the advice (the fly-in's closing word). */
let sayOverride: { text: string; until: number } | null = null;

/** Plan item 171: an upright phone docks her line over the tray instead of on the field. */
const DOCK_QUERY = matchMedia("(max-width: 599.98px) and (orientation: portrait)");
/** The line a tap folded away; it stays folded until she says something else. */
let dockFolded = "";
/** Once folded, or once the player picks a plot, the dock stays away for that build (`level:wave`), so a new line
 *  after each tower never covers the tray again mid-build. */
let dockQuietFor = "";
let dockText = "";
let dockFace: CathExpression | null = null;
// A tap anywhere on the dock folds it away whole, so the tray under it is free (a drag can start at once after).
const foldDock = () => {
  dockFolded = dockText;
  if (game) dockQuietFor = `${game.level.id}:${game.wave}`;
  syncDockFold();
};
ui.cathDock.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  foldDock();
});
ui.cathDockBust.addEventListener("click", foldDock);
function syncDockFold(): void {
  const folded = !!dockText && dockFolded === dockText;
  ui.cathDock.toggleAttribute("data-folded", folded);
}

/** Her face follows the line: a gap nothing answers worries her, a closing word is a smirk, advice is determined. */
function dockExpression(g: Game, text: string): CathExpression {
  if (sayOverride?.text === text) return "smirk";
  const groups = g.level.waves[g.wave];
  if (groups && gapAdvice(unanswered(g, roundProps(g.level, groups)), g.level.towers, (k) => towerCost(g, k)) === text) return "worried";
  return "determined";
}

function syncCathDock(g: Game, text: string): void {
  const el = ui.cathDock;
  if (!text) {
    if (!el.hidden) el.hidden = true;
    dockText = "";
    return;
  }
  const panel = ui.panel.getBoundingClientRect();
  // The round drawer open (the panel grown over the field's foot) is the player reading on: she folds away.
  if (!panel.height || panel.height > 120) {
    el.hidden = true;
    if (panel.height) dockQuietFor = `${g.level.id}:${g.wave}`;
    return;
  }
  if (text === dockText && dockFolded === text) return;
  const fresh = text !== dockText || el.hidden;
  if (fresh) {
    dockText = text;
    ui.cathDockLine.textContent = text;
    const face = dockExpression(g, text);
    if (face !== dockFace) {
      dockFace = face;
      ui.cathDockBust.innerHTML = cathSvg({ framing: "bust", expression: face, outfit: art(), animate: true });
    }
    el.dataset.expression = face;
    el.hidden = false;
    syncDockFold();
    if (!REDUCED) {
      el.classList.remove("slide");
      void el.offsetWidth;
      el.classList.add("slide");
    }
  }
  // Over the tray (never the field), under the round drawer's handle so that stays a tap away.
  const handle = ui.panel.querySelector(".drawer-handle")?.getBoundingClientRect();
  const top = Math.max(panel.top, handle && handle.height ? handle.bottom + 1 : 0);
  // Plan item 188: the dock reaches the panel's top either side of the handle (a notch round it), so no strip of the
  // tray's cards shows above it; its content stays below the handle.
  const notch = Math.round(top - panel.top);
  el.style.setProperty("--dock-top", `${Math.round(panel.top)}px`);
  el.style.setProperty("--dock-h", `${Math.round(Math.max(66, panel.bottom - top)) + notch}px`);
  el.style.setProperty("--notch-h", `${notch}px`);
  const dl = 8;
  el.style.setProperty("--notch-l", `${handle && handle.height ? Math.round(handle.left - dl - 4) : -1}px`);
  el.style.setProperty("--notch-r", `${handle && handle.height ? Math.round(handle.right - dl + 4) : -1}px`);
}

function syncCathSay(g: Game, now: number): void {
  const el = ui.cathSay;
  const quiet =
    !!player || g.phase !== "build" || !!selected || posting || aiming || !ui.intro.hidden || !ui.bubble.hidden || hasTwist(g.level, "nocath") || !renderer;
  if (sayOverride && (now > sayOverride.until || g.phase !== "build")) sayOverride = null;
  if (debriefGhost && g.phase !== "build") {
    debriefGhost.remove();
    debriefGhost = null;
  }
  const said = quiet ? "" : (sayOverride?.text ?? adviceLine(g));
  const docked = DOCK_QUERY.matches && !document.documentElement.hasAttribute("data-keyart");
  const build = `${g.level.id}:${g.wave}`;
  if (docked && g.phase === "build" && (!!selected || posting || aiming)) dockQuietFor = build;
  syncCathDock(g, docked && dockQuietFor !== build ? said : "");
  const text = docked ? "" : said;
  if (!text) {
    if (!el.hidden) el.hidden = true;
    sayShown = null;
    sayText = "";
    return;
  }
  // Re-place a few times a second (the 3D camera eases; she can be moved) and at once when the line changes.
  if (text === sayText && now - sayAt < 250) return;
  const fresh = text !== sayText || el.hidden;
  sayText = text;
  sayAt = now;
  const p = el.querySelector("p")!;
  if (p.textContent !== text) p.textContent = text;
  if (el.hidden) {
    el.hidden = false;
    el.classList.remove("pop");
  }
  const field = ui.stage.getBoundingClientRect();
  const cath = cathBox(g, field);
  if (!cath || !field.width) return;
  const shift = (b: Box): Box => ({ x: b.x - field.left, y: b.y - field.top, w: b.w, h: b.h });
  const win = { x: cath.x - 360, y: cath.y - 260, w: cath.w + 720, h: cath.h + 520 };
  const near = (b: Box) => b.x < win.x + win.w && win.x < b.x + b.w && b.y < win.y + win.h && win.y < b.y + b.h;
  const avoid: Box[] = [];
  for (const o of ui.stage.querySelectorAll<HTMLElement>(".gate-plate, .banner.show, .round-rosette")) {
    const r = o.getBoundingClientRect();
    if (r.width) avoid.push(shift({ x: r.left, y: r.top, w: r.width, h: r.height }));
  }
  // The gate queue's leads and "N coming" plate (canvas px; the canvas sits at the field's corner).
  const canvas = ui.canvas.getBoundingClientRect();
  const q = (renderer as { shownQueue?: { leads: Box[]; plates: Box[] } | null }).shownQueue;
  // Plan item 132: and the gate's own sign, whose town name the bubble covered at D.
  const signs = (renderer as { gateSignRects?: () => Box[] }).gateSignRects?.() ?? [];
  for (const b of [...(q?.leads ?? []), ...(q?.plates ?? []), ...signs]) avoid.push({ x: b.x + canvas.left - field.left, y: b.y + canvas.top - field.top, w: b.w, h: b.h });
  const size = { w: el.offsetWidth, h: el.offsetHeight };
  const spot = barkSpot(
    cath,
    size,
    { w: field.width, h: field.height },
    // Plan item 120: she only speaks in the build phase, when the lane is empty and an empty plot is what she
    // tells you to tap, so those are the cells to keep clear; the lane and built plots cost little.
    emptyPlotBoxes(g).map(shift).filter(near),
    [...laneBoxes(g), ...builtPlotBoxes(g)].map(shift).filter(near),
    avoid,
  );
  el.dataset.side = spot.side;
  el.style.setProperty("--tail", `${spot.tail}px`);
  el.style.setProperty("--at-x", `${spot.x}px`);
  el.style.setProperty("--at-y", `${spot.y}px`);
  if (fresh && !REDUCED) {
    void el.offsetWidth;
    el.classList.add("pop");
  }
  sayShown = { text, box: spot, cath };
}

/**
 * Plan item 64: a cleared round is a painted rosette pinned on the field, on the spot nearest the lane's end that
 * covers no plot, with the round's Marks flying from it to the Marks chip. A round with no leaks gets the gold
 * "Clean sweep" rosette. Reduced motion: no flight, a fade.
 */
function roundRosette(g: Game, round: number, reward: number, clean: boolean): void {
  if (!renderer || player) return;
  ui.stage.querySelector(".round-rosette")?.remove();
  const el = document.createElement("div");
  el.className = `round-rosette${clean ? " clean" : ""}`;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<svg class="rosette-art" viewBox="0 0 100 120"><path class="tail" d="M34 58 L22 116 L34 106 L44 118 L50 62 Z"/><path class="tail" d="M66 58 L78 116 L66 106 L56 118 L50 62 Z"/><g class="petals">${Array.from({ length: 16 }, (_, i) => `<ellipse cx="50" cy="20" rx="9" ry="16" transform="rotate(${i * 22.5} 50 50)"/>`).join("")}</g><circle class="face" cx="50" cy="50" r="26"/><circle class="ring" cx="50" cy="50" r="21"/></svg><span class="rosette-text"><em>${reward > 0 ? `+${reward}` : "✓"}</em><small>${clean ? "Clean sweep" : `Round ${round}`}</small></span>`;
  ui.stage.append(el);
  const field = ui.stage.getBoundingClientRect();
  const size = { w: el.offsetWidth || 120, h: el.offsetHeight || 144 };
  el.title = `Round ${round} cleared`;
  // The plots as boxes on the field (2D or 3D: cellCenter projects either way).
  const plots = plotBoxes(g).map((p) => ({ ...p, x: p.x - field.left, y: p.y - field.top }));
  // Cath's bubble and the round ribbon are on the field too: keep off them as well as the plots.
  // Plan item 114: and off Cath herself, so a clean sweep doesn't hide her cheer.
  const her = hasTwist(g.level, "nocath") ? null : cathBox(g, field);
  const avoid: Box[] = her ? [her] : [];
  for (const o of [ui.bubble, ui.banner]) {
    const r = o.getBoundingClientRect();
    if (!o.hidden && r.width && (o !== ui.banner || o.classList.contains("show"))) avoid.push({ x: r.left - field.left, y: r.top - field.top, w: r.width, h: r.height });
  }
  const [ec, er] = g.level.path[g.level.path.length - 1]!;
  const end = renderer.cellCenter(ec, er);
  const near = end ? { x: end.x - field.left, y: end.y - field.top } : { x: field.width / 2, y: field.height / 2 };
  const spot = rosetteSpot(plots, size, { w: field.width, h: field.height }, near, 6, avoid);
  el.style.setProperty("--at-x", `${Math.round(spot.x)}px`);
  el.style.setProperty("--at-y", `${Math.round(spot.y)}px`);
  el.classList.add("show");
  if (reward > 0 && !REDUCED) coinFlight(el, Math.min(8, 3 + Math.round(reward / 20)));
  window.setTimeout(() => el.remove(), 2600);
}

/**
 * Cath's box on the field (field px): her feet at her cell, as tall as she is drawn. Plan item 114: the 2D
 * renderer draws her at `HERO_SCALE`, so the 2D box is measured from the sprite, not a fixed guess.
 */
function cathBox(g: Game, field: DOMRect): Box | null {
  const at = renderer!.cellCenter(g.hero.x - 0.5, g.hero.y - 0.5);
  const right = renderer!.cellCenter(g.hero.x + 0.5, g.hero.y - 0.5);
  if (!at) return null;
  const cell = right ? Math.max(16, Math.abs(right.x - at.x)) : 40;
  const px = is3D(renderer!) ? null : (renderer as { heroPx?: () => { h: number; w: number } }).heroPx?.();
  const tall = px?.h ? px.h / cell + 0.3 : is3D(renderer!) ? 1.7 : 1.25;
  const wide = px?.w ? px.w / cell : 0.8;
  return { x: at.x - field.left - cell * wide / 2, y: at.y - field.top - cell * (tall - 0.3), w: cell * wide, h: cell * tall };
}

/**
 * Plan item 135: after a round that leaked, the stretch of lane no tower reached glows red for 1.5 s, a ghost of the
 * tower that answers what got through stands on the free plot beside it (a tap builds it), and Cath's line on the
 * field says so. The ghost goes when the next round starts.
 */
let debriefGhost: HTMLButtonElement | null = null;
function debriefLeaks(g: Game, kind: EnemyKind | undefined): void {
  if (!renderer || hasTwist(g.level, "nocath")) return;
  const fleet = isFleet(g.level);
  const reach = g.towers.map((t) => ({ col: t.col, row: t.row, range: towerStats({ ...t, fleet }).range }));
  const lanes = [g.level.path, g.level.path2].filter((p): p is Level["path"] => !!p);
  const free = (c: number, r: number) => isPlot(g.level, c, r) && !g.towers.some((t) => t.col === c && t.row === r);
  const d = leakDebrief(lanes, reach, free, g.level.cols, g.level.rows);
  if (!d.cells.length) return;
  const field = ui.stage.getBoundingClientRect();
  const want = new Set(d.cells.map(([c, r]) => `${c},${r}`));
  const glow = document.createElement("div");
  glow.className = "debrief-glow";
  glow.setAttribute("aria-hidden", "true");
  for (const b of cellBoxes(g, (c, r) => want.has(`${c},${r}`))) {
    const cell = document.createElement("i");
    cell.style.cssText = `left:${b.x - field.left}px;top:${b.y - field.top}px;width:${b.w}px;height:${b.h}px`;
    glow.append(cell);
  }
  ui.stage.append(glow);
  ui.stage.dataset.leakStretch = String(d.cells.length);
  window.setTimeout(() => {
    glow.remove();
    delete ui.stage.dataset.leakStretch;
  }, 1500);
  debriefGhost?.remove();
  debriefGhost = null;
  const kit = g.level.towers.filter((k) => towerAllowed(g.level, k));
  const pick = (kind ? countersFor(kind, kit)[0] : undefined) ?? kit[0];
  const at = d.plot && renderer.cellCenter(d.plot.col, d.plot.row);
  const plot = d.plot;
  if (pick && plot && at) {
    const ghost = document.createElement("button");
    ghost.type = "button";
    ghost.className = "debrief-ghost";
    ghost.dataset.kind = pick;
    ghost.style.cssText = `left:${at.x - field.left}px;top:${at.y - field.top}px`;
    ghost.setAttribute("aria-label", `Build a ${TOWERS[pick].name} here, as Cath suggests`);
    ghost.append(img(towerIcon(pick), "debrief-ghost-art"));
    ghost.onclick = () => {
      if (doAct({ t: "place", kind: pick, col: plot.col, row: plot.row })) {
        ghost.remove();
        debriefGhost = null;
      } else toast(`Not enough Marks for a ${TOWERS[pick].name} yet.`);
    };
    ui.stage.append(ghost);
    debriefGhost = ghost;
  }
  const what = kind ? ENEMIES[kind].name : "They";
  const laneLen = Math.max(...lanes.map((l) => l.length));
  const where = d.cells.length >= laneLen * 0.8 ? `${what} got through: nothing reaches most of the lane yet` : `${what} got through the stretch nothing covers`;
  const line = pick && plot ? `${where}. A ${TOWERS[pick].name} on the plot I've marked would catch it.` : `${where}. Something there next round.`;
  sayOverride = { text: line, until: performance.now() + Math.max(6000, line.length * 70) };
}

/** Every plot's box on screen (client pixels), each sized from its own projected neighbours (3D shrinks with distance). */
function plotBoxes(g: Game): Box[] {
  return cellBoxes(g, (c, r) => isPlot(g.level, c, r));
}

/** The plots with no tower on them, and those with one (client pixels). */
function emptyPlotBoxes(g: Game): Box[] {
  return cellBoxes(g, (c, r) => isPlot(g.level, c, r) && !g.towers.some((t) => t.col === c && t.row === r));
}
function builtPlotBoxes(g: Game): Box[] {
  return cellBoxes(g, (c, r) => isPlot(g.level, c, r) && g.towers.some((t) => t.col === c && t.row === r));
}

/** Every lane cell's box on screen (client pixels). */
function laneBoxes(g: Game): Box[] {
  const lane = laneCellsOf(g.level);
  return cellBoxes(g, (c, r) => lane.has(`${c},${r}`));
}

function cellBoxes(g: Game, keep: (col: number, row: number) => boolean): Box[] {
  const out: Box[] = [];
  if (!renderer) return out;
  for (let r = 0; r < g.level.rows; r++)
    for (let c = 0; c < g.level.cols; c++) {
      if (!keep(c, r)) continue;
      const p = renderer.cellCenter(c, r);
      if (!p) continue;
      const e = renderer.cellCenter(c + 1, r) ?? renderer.cellCenter(c - 1, r);
      const s = renderer.cellCenter(c, r + 1) ?? renderer.cellCenter(c, r - 1);
      const w = e ? Math.abs(e.x - p.x) : 32;
      const h = s ? Math.abs(s.y - p.y) : w;
      out.push({ x: p.x - w / 2, y: p.y - h / 2, w, h });
    }
  return out;
}

const COIN_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" class="coin-rim"/><circle cx="10" cy="10" r="5.5" class="coin-face"/></svg>';

/** Coins lift off the rosette and land on the Marks chip, which bumps as the last one lands. */
function coinFlight(from: HTMLElement, n: number): void {
  const chip = ui.hudMarks.parentElement;
  if (!chip) return;
  const a = from.getBoundingClientRect();
  const z = chip.getBoundingClientRect();
  if (!z.width) return;
  const sx = a.left + a.width / 2;
  const sy = a.top + a.height * 0.42;
  const dx = z.left + 16 - sx;
  const dy = z.top + z.height / 2 - sy;
  for (let i = 0; i < n; i++) {
    const coin = document.createElement("span");
    coin.className = "flying-coin";
    coin.innerHTML = COIN_SVG;
    coin.style.setProperty("--at-x", `${sx - 9}px`);
    coin.style.setProperty("--at-y", `${sy - 9}px`);
    document.body.append(coin);
    const lift = -40 - (i % 3) * 14;
    const spread = (i - n / 2) * 10;
    const anim = coin.animate(
      [
        { transform: "translate(0, 0) scale(0.6)", opacity: 0 },
        { transform: `translate(${spread}px, ${lift}px) scale(1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 1 },
      ],
      { duration: 820, delay: 260 + i * 70, easing: "cubic-bezier(0.45, 0, 0.3, 1)", fill: "backwards" },
    );
    anim.onfinish = () => {
      coin.remove();
      if (i === n - 1) bump(chip, "gain");
    };
    anim.oncancel = () => coin.remove();
  }
}

// ---- the loop ----

/** Pop pitch steps by rung: the smaller the rung that was hit, the higher the pop. */
const RUNG_STEP: Partial<Record<EnemyKind, number>> = { courier: 7, drone: 7, hatchback: 5, quad: 5, van: 4, pickup: 2, sprinter: 1, lorry: 0, boss: -5 };

function onEvents(g: Game, evs: GameEvent[]): void {
  let shots = 0;
  let gusts = 0;
  const knocks: number[] = [];
  let peeled = false;
  for (const ev of evs) {
    switch (ev.type) {
      case "knock":
        knocks.push(RUNG_STEP[ev.from] ?? 3);
        if (ev.to) peeled = true;
        break;
      case "crown": {
        // A Crown is a moment: a gold banner and a stinger (the camera beat is the banner's 1 s).
        banner(ev.name, "Crown", false, "hero");
        sfx.playBoss();
        haptic.boss();
        break;
      }
      case "wreck":
        banner(`${ENEMIES[ev.kind].name.toUpperCase()} WRECKED`, `+${ev.marks} layers`);
        sfx.playKill(true);
        haptic.boss();
        if (!REDUCED) slowUntil = performance.now() + 80;
        break;
      case "closeCall":
        banner("Close call!", "Popped at the gate", false, "leak");
        if (!REDUCED) slowUntil = performance.now() + 400;
        break;
      case "shot":
        if (shots++ < 2) sfx.playShot(ev.kind, !!ev.crit);
        break;
      case "kill":
        // Fleet: the last layer's pop already sounded (its Mark came with the knock); bosses still crash.
        if (ev.bounty > 0 || isBig(ev.kind)) sfx.playKill(isBig(ev.kind));
        // Defeat vignette: a beat of slow motion, a gold banner and a word from Cath.
        if (isBig(ev.kind) && !player) {
          banner(`${ENEMIES[ev.kind].name} is beaten`, "The lane is quiet again", true, "hero");
          say(`That's the last of ${ENEMIES[ev.kind].name}. Tea, everyone?`);
          if (!REDUCED) slowUntil = performance.now() + 900;
        }
        break;
      case "leak":
        if (ev.kind) runLeaks.push({ kind: ev.kind, lost: ev.lost ?? 1, round: waveNo(g, g.wave) });
        sfx.playLeak();
        haptic.leak();
        // The first leak of a round gets a moment of slow motion and a banner naming the cause; on the Fleet so
        // does the first leak of each further cause in it (scouts after a filler leak still get named).
        if (leakCauses.wave !== g.wave) {
          leakCauses.wave = g.wave;
          leakCauses.seen.clear();
        }
        if (ev.kind && !player && !leakCauses.seen.has(isFleet(g.level) ? (ev.cause ?? "damage") : "any")) {
          leakCauses.seen.add(isFleet(g.level) ? (ev.cause ?? "damage") : "any");
          if (isFleet(g.level)) {
            // Hedgerow 2 section 2: the property that got through, what it cost, and the key to it.
            const r = fleetLeakReport({ kind: ev.kind, pm: ev.pm, lost: ev.lost, cause: ev.cause });
            banner(r.title, r.sub, false, "leak");
            say(`${r.title}. ${r.sub}`);
            haptic.leakReport();
            if (!REDUCED) slowUntil = performance.now() + 600;
          } else leakReport(g, ev.kind, !!ev.dropped, ev.lost ?? 0);
        }
        if (g.goodwill <= g.maxGoodwill / 2 && g.goodwill > 0) {
          // When the leak report named a property, Cath backs it up rather than giving generic advice that
          // would contradict it (hedges don't help against stealth).
          const lock = isFleet(g.level) && ev.cause && ev.cause in PROPERTIES ? PROPERTIES[ev.cause as keyof typeof PROPERTIES] : null;
          tip(
            `low-${g.level.id}`,
            lock ? `They're getting through! ${lock.why} ${lock.key}` : "They're getting through! Hedges near the farmhouse, and between waves move me to the end of the lane.",
            "worried",
            true,
          );
        }
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
        } else if (isFleet(g.level) && g.level.book) {
          // Fleet levels name the Round Book's round and read its one-line card.
          const r = g.level.book.from + ev.wave - 1;
          const page = roundFor(g.level.id, r);
          if (page?.spike) sfx.playSpike();
          banner(`Round ${r}${page ? `: ${page.theme}` : ""}`, ev.early ? `Stacked early · +${ev.early} Marks` : page ? cardBody(page.card) : `Round ${r} of ${lastNo(g)}`, false, "round");
        } else banner(`Wave ${ev.wave}`, ev.early ? `Stacked early · +${ev.early} Marks` : `of ${g.level.waves.length}`);
        // Let the round's banner say its piece first: the new-unit card follows it rather than stacking on it.
        introduce(kinds, ev.wave);
        if (ev.early) {
          earlyCalls += 1;
          stackedWave = ev.wave;
        }
        break;
      }
      case "cleared":
        sfx.playCleared();
        if (ev.wave < g.level.waves.length) roundRosette(g, waveNo(g, ev.wave), ev.reward, !runLeaks.some((l) => l.round === waveNo(g, ev.wave)));
        // Plan item 135: a round that leaked gets Cath's debrief on the field.
        if (ev.wave < g.level.waves.length && !player) {
          const leaked = runLeaks.filter((l) => l.round === waveNo(g, ev.wave)).at(-1);
          if (leaked) debriefLeaks(g, leaked.kind);
        }
        break;
      case "pie":
        break;
      case "neighbours":
        tip("neighbours", "The neighbours are in the lane. Nothing on wheels gets past them for ten seconds.", "determined");
        break;
      case "rally":
        tip("rally", "Come on, all of you! Everything fires faster for a few seconds.", "delighted");
        break;
      case "lastOrders":
        banner("Last orders, please!", `${ev.hit} Plants take a hit`, false, "small");
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
      case "heroLevel":
        banner(`Cath is level ${ev.level}`, "Stronger and tougher for the rest of the run");
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
        banner(MEGAS[ev.mega].name, "Megastructure raised", false, "hero");
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
        toast(ev.perfect ? `Perfect duel! The ${ENEMIES[ev.kind].name} loses a tenth of its health, and you pocket 150 Marks.` : ev.won ? `Cath wins the duel: the ${ENEMIES[ev.kind].name} reels.` : "Cath's knocked back. She'll be up in a moment.");
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
  if (knocks.length) {
    sfx.playKnocks(knocks);
    // The first time something actually peels down a rung (not a courier vanishing), say what happened.
    if (peeled && isFleet(g.level)) tip("knock", "Every pop knocks a layer off and pays a Mark. A hatchback peels down to a courier; vans peel to hatchbacks.", "delighted");
  }
}

/** Phones: x5 steps down to x3 while the lane is crowded, so a big cascade doesn't cost frames (section 5). */
const PHONE_BUSY = Math.round(LIVE_CAP * 0.85);
const coarse = (() => {
  try {
    return window.matchMedia("(pointer: coarse)");
  } catch {
    return null;
  }
})();
function runSpeed(g: Game): number {
  const capped = speed > 3 && !!coarse?.matches && g.enemies.length >= PHONE_BUSY;
  ui.btnSpeed.classList.toggle("capped", capped);
  return capped ? 3 : speed;
}

// Plan item 152: the level's twists you can see on the field. A flood that's up marks the stage
// `data-twist-active~="flood"` with the count of plots under it (the renderers draw the water); a fog level's
// sea fret is a drifting layer over the field (`.field-fog`) that thickens as the round runs.
// Plan item 157: Hollowell's depot at each gate (2D, where the field has a margin beside the gate wide enough for
// a 2 x 2-cell depot clear of every plot). Its departures board shows the next round's count; the rep's mood follows
// the last round (smug, then gleeful after a leak or rattled after a clean one).
let signCtx: CanvasRenderingContext2D | null = null;
const signMeasure = (): CanvasRenderingContext2D => (signCtx ??= document.createElement("canvas").getContext("2d")!);
let depotLeaksAtStart = 0;
let depotMood: RepMood = "smug";
let depotJudged = 0;
let depotKey = "";
let depotLevel = -1;
function syncDepots(g: Game): void {
  const layer0 = document.getElementById("depots");
  const show = !!renderer && g.phase !== "won" && g.phase !== "lost";
  if (!show) {
    layer0?.remove();
    depotKey = "";
    if (renderer && !is3D(renderer)) (renderer as Renderer).depotLanes.clear();
    return;
  }
  // The mood: each time a round is over (the round counter moves on and the field is between rounds), compare the
  // leaks with the last time he judged. A new level starts him smug.
  const L0 = g.level;
  if (depotLevel !== L0.id) {
    depotLevel = L0.id;
    depotMood = "smug";
    depotJudged = g.wave;
    depotLeaksAtStart = g.leaks ?? 0;
  } else if (betweenRounds(g) && g.wave !== depotJudged) {
    depotMood = repMood(depotLeaksAtStart, g.leaks ?? 0);
    depotJudged = g.wave;
    depotLeaksAtStart = g.leaks ?? 0;
  }
  // The door rolls up as a round's convoy pulls out of it (the first 2.5 s of a wave).
  const doorOpen = g.phase === "wave" && g.waveClock < 2.5;
  if (renderer && is3D(renderer)) {
    // 3D: the depot is in the world (buildDepot); its rep leans out over its roof as a small overlay.
    const canvas3 = ui.stage.querySelector("#canvas")!.getBoundingClientRect();
    const stage3 = ui.stage.getBoundingClientRect();
    const reps = renderer
      .depotRects()
      .map((d, i) => ({ x: canvas3.left - stage3.left + d.x + d.w / 2, y: canvas3.top - stage3.top + d.y, w: d.w, lane: i }))
      .filter((d) => d.x > 0 && d.x < canvas3.width && d.y > 0 && d.y < canvas3.height);
    const key3 = `3d|${depotMood}|${reps.map((d) => `${Math.round(d.x)},${Math.round(d.y)}`).join(";")}`;
    if (key3 === depotKey) return;
    depotKey = key3;
    let layer3 = layer0;
    if (!layer3) {
      layer3 = document.createElement("div");
      layer3.id = "depots";
      layer3.className = "depots";
      layer3.setAttribute("aria-hidden", "true");
      ui.stage.querySelector("#fx-layer")?.before(layer3);
    }
    layer3.replaceChildren(
      ...reps.map((d) => {
        const el = document.createElement("div");
        el.className = "depot depot-3d";
        el.dataset.depot = String(d.lane);
        el.dataset.repMood = depotMood;
        el.style.setProperty("--x", `${Math.round(d.x)}px`);
        el.style.setProperty("--y", `${Math.round(d.y)}px`);
        el.style.setProperty("--size", `${Math.round(Math.max(28, Math.min(56, d.w * 0.45)))}px`);
        el.innerHTML = `<span class="depot-rep">${repSvg(depotMood)}</span>`;
        return el;
      }),
    );
    return;
  }
  const r = renderer as Renderer;
  const L = g.level;
  const c00 = r.cellCenter(0, 0);
  const c11 = r.cellCenter(1, 1);
  if (!c00 || !c11) return;
  const cell = c11.x - c00.x;
  const size = Math.round(cell * 2);
  const canvas = ui.stage.querySelector("#canvas")!.getBoundingClientRect();
  const stage = ui.stage.getBoundingClientRect();
  const fieldL = c00.x - cell / 2, fieldT = c00.y - cell / 2;
  const fieldR = fieldL + L.cols * cell, fieldB = fieldT + L.rows * cell;
  const counts = [0, 0];
  if (betweenRounds(g) && L.waves[g.wave]) for (const q of waveSpawns(g, L.waves[g.wave]!, g.wave + 1)) counts[(q as { lane?: number }).lane ? 1 : 0]!++;
  const lanes = [L.path, L.path2].map((path, i) => ({ path, i })).filter((l) => !!l.path);
  const spots: Array<{ x: number; y: number; count: number; lane: number }> = [];
  for (const { path, i } of lanes) {
    const start = path![0] as unknown as [number, number];
    const gate = r.cellCenter(start[0], start[1]);
    if (!gate) continue;
    for (const side of entrySide(start, L.cols, L.rows)) {
      const room = side === "left" ? fieldL - canvas.left : side === "right" ? canvas.right - fieldR : side === "top" ? fieldT - canvas.top : canvas.bottom - fieldB;
      // Only where the margin outside the field holds the whole depot: it never stands on a plot.
      if (room < size + 12) continue;
      const x = side === "left" ? fieldL - 8 - size : side === "right" ? fieldR + 8 : gate.x - size / 2;
      const y = side === "top" ? fieldT - 8 - size : side === "bottom" ? fieldB + 8 : gate.y - size / 2;
      // Plan item 160: the gate's town sign (painted by theme.ts's paintOneGate) stays readable: the depot slides
      // along the margin to clear it (it hid all but '…WELL' of the second gate's sign on level 34).
      const sr = gateSignRect(L, path!, { width: canvas.width, height: canvas.height, cell, offX: r.view.offX, offY: r.view.offY }, signMeasure());
      const sign = { left: canvas.left + sr.sx, top: canvas.top + sr.sy, right: canvas.left + sr.sx + sr.sw, bottom: canvas.top + sr.sy + sr.sh };
      const tries = side === "left" || side === "right" ? [y, sign.top - 6 - size, sign.bottom + 6] : [x, sign.left - 6 - size, sign.right + 6];
      let placed = false;
      for (const t of tries) {
        const clampY = Math.max(canvas.top + 4, Math.min(canvas.bottom - size - 4, side === "left" || side === "right" ? t : y));
        const clampX = Math.max(canvas.left + 4, Math.min(canvas.right - size - 4, side === "left" || side === "right" ? x : t));
        // A clamp that pulls it onto the field (a top margin shorter than the depot) rules the spot out.
        const meetsField = clampX < fieldR && clampX + size > fieldL && clampY < fieldB && clampY + size > fieldT;
        const meetsSign = clampX < sign.right && clampX + size > sign.left && clampY < sign.bottom && clampY + size > sign.top;
        if (meetsField || meetsSign) continue;
        spots.push({ x: clampX - stage.left, y: clampY - stage.top, count: counts[i]!, lane: i });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
  r.depotLanes = new Set(spots.map((sp) => sp.lane));
  const key = `${L.id}|${size}|${depotMood}|${doorOpen}|${spots.map((s) => `${Math.round(s.x)},${Math.round(s.y)},${s.count}`).join(";")}`;
  if (key === depotKey) return;
  depotKey = key;
  let layer = layer0;
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "depots";
    layer.className = "depots";
    layer.setAttribute("aria-hidden", "true");
    ui.stage.querySelector("#fx-layer")?.before(layer);
  }
  layer.replaceChildren(
    ...spots.map((sp) => {
      const el = document.createElement("div");
      el.className = "depot";
      el.dataset.depot = String(sp.lane);
      el.dataset.repMood = depotMood;
      el.toggleAttribute("data-door-open", doorOpen);
      el.style.setProperty("--x", `${Math.round(sp.x)}px`);
      el.style.setProperty("--y", `${Math.round(sp.y)}px`);
      el.style.setProperty("--size", `${size}px`);
      // Plan item 160: a phone's small depot shows the count alone ('485 NEXT' overflowed its board at 12 px).
      el.toggleAttribute("data-small", size < 100);
      // Plan item 166: a quiet gate reads "0 next" (a bare dash read as a broken board).
      el.innerHTML = `${depotSvg()}<span class="depot-board" data-depot-count="${sp.count}"><b>${sp.count}</b><span class="depot-next"> next</span></span><span class="depot-rep">${repSvg(depotMood)}</span>`;
      return el;
    }),
  );
}

let twistKey = "";
let twistWarned = "";
function syncTwists(g: Game): void {
  const flood = setPiece(g.level, "flood");
  // Cath calls it on the field in the build before it bites: the round whose Go floods the ford, and a fog
  // level's first build. Once per level and round; the stage says which (data-twist-warn) for tests.
  const warn = g.phase === "build" && !player && !hasTwist(g.level, "nocath")
    ? flood && g.wave + 1 === flood.wave
      ? "flood"
      : hasTwist(g.level, "fog") && g.wave === 0
        ? "fog"
        : ""
    : "";
  const warnKey = warn ? `${g.level.id}:${g.wave}:${warn}` : "";
  if (warnKey !== twistWarned) {
    twistWarned = warnKey;
    if (warn) {
      ui.stage.dataset.twistWarn = warn;
      const line =
        warn === "flood"
          ? "The river's coming over the ford when you press Go. Only Duck Ponds stand by the water: move what you can't lose."
          : "Sea fret's rolled in. Every tower reaches a fifth less, so build closer to the lanes.";
      sayOverride = { text: line, until: performance.now() + Math.max(8000, line.length * 80) };
    } else delete ui.stage.dataset.twistWarn;
  }
  const under = flood ? flood.cells.filter(([c, r]) => flooded(g, c, r)).length : 0;
  const active = [under > 0 ? "flood" : "", hasTwist(g.level, "fog") ? "fog" : ""].filter(Boolean).join(" ");
  const key = `${active}|${under}`;
  if (key === twistKey) return;
  twistKey = key;
  if (active) ui.stage.dataset.twistActive = active;
  else delete ui.stage.dataset.twistActive;
  if (under) ui.stage.dataset.flooded = String(under);
  else delete ui.stage.dataset.flooded;
  let fog = document.getElementById("field-fog");
  if (hasTwist(g.level, "fog")) {
    if (!fog) {
      fog = document.createElement("div");
      fog.id = "field-fog";
      fog.className = "field-fog";
      fog.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 3; i++) fog.appendChild(document.createElement("span"));
      ui.stage.querySelector("#fx-layer")?.before(fog);
    }
  } else fog?.remove();
}

function frame(now: number): void {
  raf = requestAnimationFrame(frame);
  if (!game || !renderer) return;
  placeRing();
  const g = game;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused && !introHold && !ui.dlgStory.open && !ui.dlgResult.open && !ui.dlgUnlock.open) {
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
    acc += dt * (player ? Math.max(2, speed) : g.duel ? 1 : runSpeed(g) * slow);
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
    if (stepped && recorder && !SANDBOX && !player && recorder.setup.mode === "level" && isFleet(g.level) && g.phase === "wave" && g.wave !== runSavedWave) {
      runSavedWave = g.wave;
      saveRun({ levelId: g.level.id, wave: g.wave, replay: recorder.replay() });
    }
    if (stepped) {
      const evs = drainEvents(g);
      onEvents(g, evs);
      renderer.feed(evs, g);
      updateHud();
      introWatch(g);
      sfx.setIntensity(g.phase !== "wave" ? 0 : g.enemies.some((e) => isBig(e.kind)) ? 2 : 1);
      // The field takes on the boss's colours while it is alive.
      const bossNow = g.enemies.find((e) => isBig(e.kind) && e.hp > 0);
      if (bossNow) ui.stage.dataset.arena = bossNow.kind;
      else delete ui.stage.dataset.arena;
      // The stacking tip waits for the wave banner and any new-unit card to clear, and goes once Next can't stack.
      if (canCallEarly(g) && g.level.id <= 3 && g.waveClock >= 4 && ui.intro.hidden && ui.bubble.hidden)
        tip("early", "Feeling brave? Tap Next to stack the next wave on this one for bonus Marks.", "wink");
      if (bubbleTip === "early" && !canCallEarly(g)) hideBubble();
      // Act 1's cliff is the player who keeps building and never upgrades (M2 review): once Marks pile up,
      // Cath says what to spend them on, before the rounds that need it.
      if (isFleet(g.level) && g.level.id <= 3 && g.wave >= 3 && ui.intro.hidden && bubbleTip !== "early") {
        const cheapest = Math.min(...g.towers.filter((t) => t.tier < 3 && !t.mega).map((t) => upgradeCost(t) ?? Infinity));
        if (cheapest < Infinity && g.marks >= cheapest + 100)
          tip("upgrade", "Marks burning a hole in your apron? Tap a tower and upgrade it: a tier-two Scarecrow knocks four vehicles a throw.", "wink");
      }
      if (pieUnlocked(g.level) && g.pieCd === 0 && g.phase === "wave" && g.enemies.length > 3)
        tip("pie-ready", "Pie's ready. Tap it, then tap the thick of them.", "delighted");
    }
  }
  renderer.draw(g, paused || introHold ? 0 : dt * Math.min(speed, 2));
  syncCathSay(g, now);
  syncTwists(g);
  // Plan item 162: her pose on the stage (rest, cheer after a clean round, worried after a leak), for tests and CSS.
  const pose = (renderer as { heroMood?: string } | null)?.heroMood;
  if (pose && ui.stage.dataset.cathPose !== pose) ui.stage.dataset.cathPose = pose;
  syncDepots(g);
  drawGhost(g);
  drawDuel(g);
  if (!finished && !player && (g.phase === "won" || g.phase === "lost")) {
    finished = true;
    clearRun();
    lastReplay = recorder?.replay() ?? null;
    ui.resultWatch.hidden = ui.resultShare.hidden = !lastReplay;
    sfx.setIntensity(0);
    if (g.phase === "won") {
      sfx.playWin();
      haptic.win();
      renderer?.celebrate();
      // The last enemy falls in slow motion under a gold banner; the result card follows it.
      if (!REDUCED) slowUntil = performance.now() + 1200;
      banner("The lane holds", "Last one down", false, "hero");
      harvest(g);
    } else {
      sfx.playLose();
      haptic.lose();
    }
    window.setTimeout(() => finish(g), g.phase === "won" ? 1800 : 700);
  }
}


/** A wicker basket of the act's harvest, for Cath's arm in the harvest (plan item 59). */
const BASKET_SVG = `<svg class="harvest-basket" viewBox="0 0 40 30" aria-hidden="true"><path d="M6 12 Q20 -6 34 12" fill="none" stroke="#7a5a32" stroke-width="2.4"/><circle cx="13" cy="11" r="4" fill="#e7c25a"/><circle cx="20" cy="9" r="4.4" fill="#e07a26"/><circle cx="27" cy="11" r="4" fill="#8cbf5a"/><path d="M4 12 H36 L32 28 H8 Z" fill="#b8874a" stroke="#6e4e26" stroke-width="1.4"/><path d="M6 17 H34 M7 22 H33" stroke="#8a6436" stroke-width="1.2"/></svg>`;
const SHEAF_SVG = `<svg viewBox="0 0 24 32" aria-hidden="true"><g stroke="#b8902f" stroke-width="1.6" stroke-linecap="round"><path d="M12 30 L6 6"/><path d="M12 30 L12 4"/><path d="M12 30 L18 6"/></g><g fill="#e7c25a"><ellipse cx="6" cy="6" rx="2.4" ry="5"/><ellipse cx="12" cy="4" rx="2.4" ry="5"/><ellipse cx="18" cy="6" rx="2.4" ry="5"/></g><rect x="7" y="18" width="10" height="3" rx="1.5" fill="#c4621c"/></svg>`;

/**
 * Plan item 59: the win's harvest on the field. While the renderers ripen every empty plot in a wave from the
 * farmhouse, Cath walks the nearest beds with a basket and a sheaf lifts off each plot as it ripens, flying up
 * to where the result card's Seed Bank chip will land. The card (finish) clears it. Reduced motion: she stands
 * by the farmhouse with the basket, no flights.
 */
function harvest(g: Game): void {
  document.querySelector(".harvest")?.remove();
  if (!renderer) return;
  renderer.harvesting = true;
  const occupied = occupiedPlots(g);
  const plots = growthPlots(g.level).filter((p) => !occupied.has(p.key));
  const box = document.createElement("div");
  box.className = "harvest";
  box.setAttribute("aria-hidden", "true");
  const cath = document.createElement("div");
  cath.className = "harvest-cath";
  cath.innerHTML = cathSvg({ framing: "half", expression: "delighted", outfit: art() }) + BASKET_SVG;
  box.append(cath);
  document.body.append(box);
  const end = g.level.path[g.level.path.length - 1]!;
  const home = renderer.cellCenter(end[0], end[1]);
  const walk = [home, ...plots.slice(0, 3).map((p) => renderer!.cellCenter(p.col, p.row))];
  const at = (q: { x: number; y: number }) => `translate(${Math.round(q.x)}px, ${Math.round(q.y)}px) translate(-50%, -92%)`;
  cath.style.setProperty("--x", `${Math.round(walk[0]!.x)}px`);
  cath.style.setProperty("--y", `${Math.round(walk[0]!.y)}px`);
  if (REDUCED || typeof cath.animate !== "function") return;
  cath.animate(
    walk.map((q, i) => ({ transform: at(q), offset: i / Math.max(1, walk.length - 1) })),
    { duration: HARVEST_SECONDS * 1000 + 300, easing: "ease-in-out", fill: "forwards" },
  );
  // Sheaves from up to ten plots, spread along the harvest wave, toward the top centre (the card's Seed Bank chip).
  const pick = plots.length <= 10 ? plots : Array.from({ length: 10 }, (_, k) => plots[Math.floor((k * plots.length) / 10)]!);
  const to = { x: innerWidth / 2, y: Math.min(innerHeight * 0.32, 260) };
  for (const p of pick) {
    const from = renderer.cellCenter(p.col, p.row);
    const sheaf = document.createElement("span");
    sheaf.className = "harvest-sheaf";
    sheaf.innerHTML = SHEAF_SVG;
    box.append(sheaf);
    sheaf.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%) scale(0.4)`, opacity: 0 },
        { transform: `translate(${from.x}px, ${from.y - 26}px) translate(-50%, -50%) scale(1.1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${(from.x + to.x) / 2}px, ${Math.min(from.y, to.y) - 50}px) translate(-50%, -50%) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) scale(0.5)`, opacity: 0 },
      ],
      { duration: 900, delay: harvestAt(p) * 1000, easing: "ease-in", fill: "both" },
    );
  }
}

/** Save v3: each path tower kind's most grown build this run, for its sheet's "Last time" next run. */
function rememberBuilds(g: Game): void {
  if (player) return;
  const best = new Map<PathKind, Path>();
  for (const t of g.towers) {
    if (!t.path || !hasPaths(t.kind)) continue;
    const have = best.get(t.kind);
    if (!have || t.path[0] + t.path[1] + t.path[2] > have[0] + have[1] + have[2]) best.set(t.kind, t.path);
  }
  for (const [k, p] of best) recordBuild(data, k, p);
  if (best.size) save(data);
}

/** The end screen's XP bars: each kind that scored, filling toward its next gate (tier 3 at 1,500, Crown at 10,000). */
function renderXpBars(gain: Partial<Record<TowerKind, number>>): void {
  const box = document.getElementById("result-xp");
  if (!box) return;
  box.replaceChildren();
  const rows = Object.entries(gain).filter(([, n]) => (n ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 4);
  for (const [k, n] of rows) {
    const have = data.xp?.[k as TowerKind] ?? 0;
    const goal = have < XP_T3 ? XP_T3 : XP_CROWN;
    const row = document.createElement("div");
    row.className = "xp-row";
    const name = document.createElement("span");
    name.textContent = TOWERS[k as TowerKind].name;
    const track = document.createElement("span");
    track.className = "xp-track";
    const fill = document.createElement("span");
    fill.className = "xp-fill";
    fill.style.setProperty("--fill", `${Math.min(100, Math.round((have / goal) * 100))}%`);
    track.append(fill);
    const num = document.createElement("span");
    num.textContent = have >= XP_CROWN ? `${have.toLocaleString()} XP (+${(n ?? 0).toLocaleString()})` : `${have.toLocaleString()} / ${goal.toLocaleString()} (+${(n ?? 0).toLocaleString()})`;
    row.append(name, track, num);
    box.append(row);
  }
  box.hidden = rows.length === 0;
}

/**
 * The end tally (plan item 10): after the stars, the run's Marks, knockouts and Goodwill count up, then the
 * leaks are replayed in round order, each vehicle landing with what it cost. Reduced motion: all at once.
 */
function renderTally(g: Game, won: boolean, stars: number): void {
  const box = document.createElement("div");
  box.id = "result-tally";
  box.className = "tally";
  const knockouts = g.towers.reduce((a, t) => a + (t.kills ?? 0), 0) + g.hero.kills;
  const counters: TallyCounter[] = [
    { label: "Marks earned", value: g.earned },
    { label: "Knockouts", value: knockouts },
    { label: "Goodwill kept", value: Math.max(0, g.goodwill), suffix: ` / ${g.maxGoodwill}` },
  ];
  const row = document.createElement("dl");
  row.className = "tally-counts";
  const nums: Array<[HTMLElement, TallyCounter]> = [];
  for (const c of counters) {
    const cell = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = c.label;
    const dd = document.createElement("dd");
    const num = document.createElement("span");
    num.className = "tally-num";
    dd.append(num);
    if (c.suffix) {
      const sfxEl = document.createElement("span");
      sfxEl.className = "tally-of";
      sfxEl.textContent = c.suffix;
      dd.append(sfxEl);
    }
    cell.append(dt, dd);
    row.append(cell);
    nums.push([num, c]);
  }
  const { chips, more } = foldLeaks(runLeaks);
  const reel = document.createElement("div");
  reel.className = "tally-leaks";
  const head = document.createElement("p");
  head.className = "tally-head";
  head.textContent = chips.length ? "What got through" : "Nothing got through";
  const strip = document.createElement("ol");
  strip.className = "tally-strip";
  const chipEls: HTMLElement[] = [];
  for (const c of chips) {
    const li = document.createElement("li");
    li.className = "tally-leak";
    li.append(img(enemyIcon(c.kind), "tally-icon"));
    const cap = document.createElement("span");
    cap.className = "tally-cap";
    cap.textContent = `${waveWord(g)[0]!.toUpperCase()}${c.round} −${c.lost}`;
    li.append(cap);
    if (c.n > 1) {
      const b = document.createElement("span");
      b.className = "tally-n";
      b.textContent = `×${c.n}`;
      li.append(b);
    }
    li.title = `${ENEMIES[c.kind].name}${c.n > 1 ? ` ×${c.n}` : ""}, ${waveWord(g)} ${c.round}: −${c.lost} Goodwill`;
    strip.append(li);
    chipEls.push(li);
  }
  if (more) {
    const li = document.createElement("li");
    li.className = "tally-leak tally-more";
    li.textContent = `+${more}`;
    strip.append(li);
    chipEls.push(li);
  }
  reel.append(head);
  if (chipEls.length) reel.append(strip);
  reel.setAttribute(
    "aria-label",
    chips.length ? `Leaks: ${chips.map((c) => `${ENEMIES[c.kind].name}${c.n > 1 ? ` times ${c.n}` : ""} in ${waveWord(g)} ${c.round}, ${c.lost} Goodwill`).join("; ")}${more ? `; ${more} more` : ""}` : "Nothing got through",
  );
  box.append(row, reel);
  ui.resultStats.after(box);
  box.classList.toggle("lost", !won);

  const settle = () => {
    for (const [el, c] of nums) el.textContent = c.value.toLocaleString();
    for (const el of chipEls) el.classList.add("in");
  };
  if (REDUCED || reducedMotion()) return settle();
  const tl = tallyTimeline(stars, chipEls.length);
  for (const [el] of nums) el.textContent = "0";
  const t0 = performance.now();
  const tick = () => {
    if (!box.isConnected) return;
    const t = performance.now() - t0 - tl.counters;
    for (const [el, c] of nums) el.textContent = countAt(c.value, t, tl.countMs).toLocaleString();
    if (t < tl.countMs) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  chipEls.forEach((el, i) =>
    setTimeout(() => {
      if (!box.isConnected) return;
      el.classList.add("in");
      if (i === 0) sfx.playLeak();
    }, tl.leaks[i]),
  );
}

function finish(g: Game): void {
  if (game !== g) return;
  document.querySelector(".harvest")?.remove();
  if (renderer) renderer.harvesting = false;
  document.getElementById("loss-causes")?.remove();
  document.getElementById("result-tally")?.remove();
  const xpBox = document.getElementById("result-xp");
  if (xpBox) xpBox.hidden = true;
  document.getElementById("result-retry")?.remove();
  document.getElementById("orchard-offers")?.remove();
  ui.resultPrimary.classList.remove("btn-quiet");
  ui.resultNote.hidden = false;
  ui.resultStars.hidden = false;
  ui.resultPrimary.hidden = false;
  ui.dlgResult.classList.remove("has-causes");
  const lv = g.level;
  rememberBuilds(g);
  if (lv.orchard) return finishOrchard(g, lv);
  if (lv.endless) return finishEndless(g, lv);
  if (dailyDay !== null) return finishDaily(g, lv, dailyDay);
  if (showRun) return finishShow(g, lv, showRun);
  const won = g.phase === "won";
  const n = starsOf(g);
  const idx = LEVELS.findIndex((l) => l.id === lv.id);
  const next = LEVELS[idx + 1];
  const before = data.stars[String(lv.id)] ?? 0;
  ui.resultCath.innerHTML = cathSceneSvg(momentForResult(won, n), { framing: "bust", outfit: art() });
  ui.resultEyebrow.textContent = `${lv.place}: ${lv.name}`;
  ui.resultTitle.textContent = won ? (n === 3 ? "Not a scratch on the farmhouse." : "The lane holds.") : "They got through.";
  ui.resultStars.replaceChildren();
  if (won) {
    for (let i = 0; i < 3; i++) {
      const sEl = document.createElement("span");
      sEl.className = `star${i < n ? " earned" : ""}`;
      sEl.textContent = i < n ? "★" : "☆";
      ui.resultStars.append(sEl);
      if (i < n) {
        // The fanfare: a gold spark burst and a rising chime as each star lands.
        setTimeout(() => {
          burst(sEl, { color: "#f2c94c", n: 10, dist: 54 });
          sfx.playStar(i);
        }, 260 * i + 200);
      }
    }
  }
  ui.resultStars.setAttribute("aria-label", won ? `${n} of 3 stars` : "");
  // A loss has no stars: don't leave an empty row where the causes should be.
  ui.resultStars.hidden = !won;
  // Goodwill and knockouts count up in the tally below; this line keeps the run's other honours.
  const stats = [`Cath's knockouts ${g.hero.kills}`];
  const crew = g.towers.filter((t) => (t.kills ?? 0) > 0).sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0));
  if (g.closeCalls) stats.push(`Close calls ${g.closeCalls}`);
  if (crew[0]) stats.push(`MVP ${TOWERS[crew[0].kind].name} (${(crew[0].kills ?? 0).toLocaleString()})`);
  if (g.difficulty !== "normal") stats.push(`${g.difficulty[0]!.toUpperCase() + g.difficulty.slice(1)} difficulty`);
  if (g.remix) stats.push(`${REMIX_NAMES[g.remix]} remix`);
  if (g.heroic) stats.push("Heroic run ◆");
  if (earlyCalls) stats.push(`${Word(g)}s called early ${earlyCalls}`);
  if (!SANDBOX) {
    const reward = awardRun(data, g, won);
    save(data);
    if (won && reward.acorns) stats.push(`Acorns +${reward.acorns}`);
    if (reward.packet) stats.push(`Seed Packet: ${reward.packet}`);
    const top = Object.entries(reward.xp).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
    if (won && top) stats.push(`${TOWERS[top[0] as TowerKind].name} XP +${(top[1] ?? 0).toLocaleString()}`);
    renderXpBars(reward.xp);
  }
  ui.resultStats.textContent = won ? stats.join(" · ") : `Reached ${waveWord(g)} ${waveNo(g, g.wave)} of ${lastNo(g)}`;
  const gained = won ? Math.max(0, n - before) : 0;
  // Plan item 46: a win's rewards are staged as their own pieces (renderPayout), not one dot-separated line.
  const pay: Payout = { bank: gained, rosettes: [] };
  ui.resultNote.textContent = won
    ? lv.reward
    : "Regroup and try again. Hedges slow them, scarecrows finish them, and Cath can hold the lane where it bends. Stars buy perks in the Seed Bank.";
  document.getElementById("result-payout")?.remove();
  ui.resultNote.hidden = false;
  ui.dlgResult.classList.remove("levelup");
  renderLossCauses(g, won);
  renderTally(g, won, won ? n : 0);
  if (won) {
    const cathBefore = levelOf(xpOf(data.stars)).level;
    recordStars(data, lv.id, n);
    if (!lv.endless && dailyDay === null) {
      const mode: MedalMode = g.remix ?? (g.heroic ? "hollow" : g.difficulty);
      if (recordMedal(data, lv.id, mode)) pay.medal = `${mode[0]!.toUpperCase() + mode.slice(1)} medal`;
    }
    if (g.heroic) {
      recordHeroic(data, lv.id);
      pay.heroic = true;
    }
    const cathAfter = levelOf(xpOf(data.stars)).level;
    if (cathAfter > cathBefore) pay.level = { to: cathAfter, points: cathAfter - cathBefore, talent: TALENTS.some(([l]) => l > cathBefore && l <= cathAfter) };
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
      pay.rosettes = names;
    }
    renderPayout(pay, next, lv.reward);
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
    retryButton(g, lv);
  }
  ui.resultSecondary.onclick = () => {
    ui.dlgResult.close();
    leaveLevel();
  };
  ui.dlgResult.classList.toggle("lost", !won);
  ui.dlgResult.showModal();
}

interface Payout {
  /** New stars for the Seed Bank. */
  bank: number;
  medal?: string;
  heroic?: boolean;
  level?: { to: number; points: number; talent: boolean };
  rosettes: string[];
}

/**
 * Plan item 46: a win pays out on stage, after the tally: the Seed Bank stars as a chip, a medal, the rosettes
 * pinned on a ribbon with their names, Cath's level-up with her whole figure cheering and the talent choice one
 * tap away, then a Next card naming the next level's landmark and its twist in a plain sentence. Each piece lands
 * in turn (CSS, `--i`); reduced motion shows them at once.
 */
function renderPayout(pay: Payout, next: Level | undefined, reward = ""): void {
  const box = document.createElement("div");
  box.id = "result-payout";
  box.className = "payout";
  let i = 0;
  const piece = (cls: string): HTMLElement => {
    const el = document.createElement("div");
    el.className = `payout-piece ${cls}`;
    el.style.setProperty("--i", String(i++));
    box.append(el);
    return el;
  };
  const chips: string[] = [];
  if (pay.bank) chips.push(`+${pay.bank} ★ for the Seed Bank`);
  const bankAt = chips.length - 1;
  if (pay.medal) chips.push(`${pay.medal} ●`);
  if (pay.heroic) chips.push("Heroic ◆ one Goodwill, no pies");
  if (chips.length) {
    const row = piece("payout-chips");
    row.dataset.payout = "bank";
    chips.forEach((c, k) => {
      const chip = document.createElement("span");
      chip.className = "payout-chip";
      chip.textContent = c;
      if (k === bankAt && pay.bank) {
        chip.dataset.bank = String(pay.bank);
        flyCoins(chip, pay.bank);
      }
      row.append(chip);
    });
  }
  if (pay.rosettes.length) {
    const rib = piece("payout-ribbon");
    rib.dataset.payout = "rosettes";
    const head = document.createElement("p");
    head.className = "payout-head";
    head.textContent = pay.rosettes.length > 1 ? "Rosettes won" : "Rosette won";
    const list = document.createElement("ul");
    for (const name of pay.rosettes) {
      const li = document.createElement("li");
      const badge = document.createElement("span");
      badge.className = "payout-rosette";
      badge.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = name;
      li.append(badge, label);
      list.append(li);
    }
    rib.append(head, list);
  }
  if (pay.level) {
    const lvl = piece("payout-level");
    lvl.dataset.payout = "level";
    const fig = document.createElement("div");
    fig.className = "payout-cath";
    fig.setAttribute("aria-hidden", "true");
    fig.innerHTML = cathSceneSvg("perfect", { framing: "half", outfit: art() });
    const text = document.createElement("div");
    const h = document.createElement("p");
    h.className = "payout-level-title";
    h.textContent = `Cath reached level ${pay.level.to}`;
    const sub = document.createElement("p");
    sub.textContent = `${pay.level.points} skill point${pay.level.points > 1 ? "s" : ""} to spend${pay.level.talent ? ", and a talent to choose" : ""}.`;
    const go = document.createElement("button");
    go.type = "button";
    go.className = "btn btn-small";
    go.id = "payout-spend";
    go.textContent = pay.level.talent ? "Choose her talent" : "Spend her points";
    go.onclick = () => renderCath();
    text.append(h, sub);
    // A talent level reached: its two choices are right here, and a pick is saved at once.
    const { c, level } = cathState();
    const at = talentsWaiting(c, level)[0];
    const opts = at !== undefined ? TALENTS.find(([l]) => l === at)?.[1] : undefined;
    if (at !== undefined && opts) {
      const pick = document.createElement("div");
      pick.className = "payout-talents";
      pick.setAttribute("role", "group");
      pick.setAttribute("aria-label", `Choose a talent for level ${at}`);
      ([0, 1] as const).forEach((i) => {
        const t = opts[i];
        const b = document.createElement("button");
        b.type = "button";
        b.className = "talent";
        b.dataset.talent = String(i);
        const n = document.createElement("strong");
        n.textContent = t.name;
        const d = document.createElement("small");
        d.textContent = t.blurb;
        b.append(n, d);
        b.onclick = () => {
          if (!pickTalent(c, level, at, i)) return;
          save(data);
          sfx.playUpgrade();
          renderCathButton();
          const done = document.createElement("p");
          done.className = "payout-picked";
          done.textContent = `${t.name}: ${t.blurb}`;
          pick.replaceWith(done);
          sub.textContent = `${pay.level!.points} skill point${pay.level!.points > 1 ? "s" : ""} to spend.`;
        };
        pick.append(b);
      });
      text.append(pick);
      go.textContent = "Spend her points";
    }
    text.append(go);
    lvl.append(fig, text);
    ui.dlgResult.classList.add("levelup");
  }
  if (next) {
    const card = piece("payout-next");
    card.dataset.payout = "next";
    const kicker = document.createElement("p");
    kicker.className = "payout-head";
    kicker.textContent = `Next: ${next.id}. ${next.name}`;
    const what = document.createElement("p");
    const mark = landmarkKinds(next).map((k) => LANDMARKS[k].name);
    const tw = next.twists ?? [];
    const twist = tw.length ? ` ${tw.map((t) => `${TWISTS[t].name}: ${twistRule(next, t)}`).join(" ")}` : " No twist: a straight fight.";
    what.textContent = `${mark.join(" and ")} on the field.${twist}`;
    card.append(kicker, what);
    // The level's own reward line (what it unlocks) belongs with what comes next.
    if (reward) {
      const r = document.createElement("p");
      r.className = "payout-reward";
      r.textContent = reward;
      card.append(r);
      ui.resultNote.hidden = true;
    }
  }
  if (!box.childElementCount) return;
  (document.getElementById("result-xp") ?? ui.resultStats).after(box);
  // A tap on the card (not on a button) skips the sequence: every piece lands at once.
  ui.dlgResult.classList.remove("payout-skip");
  ui.dlgResult.addEventListener(
    "pointerdown",
    (ev) => {
      if ((ev.target as HTMLElement).closest("button")) return;
      ui.dlgResult.classList.add("payout-skip");
      for (const a of coinFlights.splice(0)) a.finish();
    },
    { once: true },
  );
}

/** The Seed Bank coins in flight (a skip finishes them). */
const coinFlights: Animation[] = [];

/**
 * Plan item 46: the new stars fly as coins from the stars row into the Seed Bank chip, which counts up as each
 * lands. (The game's Seed Bank button is on the map, not the play screen, so the card's chip is where they go.)
 * Reduced motion: no flight, the chip simply says the total.
 */
function flyCoins(chip: HTMLElement, n: number): void {
  const word = (k: number) => `+${k} ★ for the Seed Bank`;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || typeof chip.animate !== "function") return;
  chip.textContent = word(0);
  const stars = [...ui.resultStars.querySelectorAll<HTMLElement>(".star.earned")].slice(-n);
  setTimeout(() => {
    if (!chip.isConnected) return;
    // Skipped before the coins set off: bank them at once.
    if (ui.dlgResult.classList.contains("payout-skip")) {
      chip.textContent = word(n);
      return;
    }
    const to = chip.getBoundingClientRect();
    stars.forEach((st, k) => {
      const from = st.getBoundingClientRect();
      const coin = document.createElement("span");
      coin.className = "coin-fly";
      coin.textContent = "★";
      coin.setAttribute("aria-hidden", "true");
      ui.dlgResult.append(coin);
      const dlg = ui.dlgResult.getBoundingClientRect();
      const x0 = from.left + from.width / 2 - dlg.left;
      const y0 = from.top + from.height / 2 - dlg.top + ui.dlgResult.scrollTop;
      const x1 = to.left + 18 - dlg.left;
      const y1 = to.top + to.height / 2 - dlg.top + ui.dlgResult.scrollTop;
      const a = coin.animate(
        [
          { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
          { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 40}px) scale(1.25)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${x1}px, ${y1}px) scale(0.6)`, opacity: 0.2 },
        ],
        { duration: 620, delay: k * 180, easing: "cubic-bezier(0.4, 0, 0.6, 1)", fill: "both" },
      );
      coinFlights.push(a);
      a.finished
        .catch(() => {})
        .then(() => {
          coin.remove();
          chip.textContent = word(Math.min(n, k + 1));
          chip.classList.remove("bump");
          void chip.offsetWidth;
          chip.classList.add("bump");
        });
    });
  }, 900);
}

/**
 * Retry from round N (Hedgerow 2 section 2): on a lost fleet level, a button that replays the run up to just
 * before the lost round and hands it back, so a fix (a Radio Mast for the stealth round) can be tried without
 * replaying every clean round first. The rewind is a deterministic re-run of the recorded inputs.
 */
function retryButton(g: Game, lv: Level): void {
  const replay = lastReplay;
  if (!isFleet(lv) || !replay || replay.setup.mode !== "level" || g.wave < 1) return;
  const lost = g.wave;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn";
  b.id = "result-retry";
  b.textContent = `Retry from ${waveWord(g)} ${waveNo(g, lost)}`;
  b.onclick = () => {
    const back = rewindToWave(lv, replay, lost);
    ui.dlgResult.close();
    if (!back) return startLevel(lv);
    startLevel(lv, back.game.heroic, back);
    toast(`Back to the start of ${waveWord(g)} ${waveNo(g, lost)}: your field, Marks and Goodwill as they were.`);
  };
  ui.resultPrimary.before(b);
  ui.resultPrimary.textContent = "Start over";
  ui.resultPrimary.classList.add("btn-quiet");
}

/**
 * The loss screen's top three leak causes (Hedgerow 2 section 2): what got through, the Goodwill it cost from
 * which round, and the towers this level has that answer it, highlighted.
 */
function renderLossCauses(g: Game, won: boolean): void {
  if (won || !isFleet(g.level)) return;
  const causes = lossCauses(g);
  if (!causes.length) return;
  // The causes and their answers are the advice: the generic line goes.
  ui.resultNote.textContent = "";
  ui.resultNote.hidden = true;
  const box = document.createElement("div");
  box.id = "loss-causes";
  box.className = "loss-causes";
  box.append(line("What got through", "loss-head"));
  const list = document.createElement("ol");
  for (const c of causes) {
    const li = document.createElement("li");
    li.dataset.cause = c.cause;
    if (c.cause in PROPERTIES) li.append(img(propIcon(c.cause as keyof typeof PROPERTIES), "prop-icon"));
    const text = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${c.title}: ${c.lost} Goodwill from round ${c.round}.`;
    text.append(strong, ` ${c.why} ${c.key}`);
    li.append(text);
    if (c.towers.length) {
      const keys = document.createElement("span");
      keys.className = "loss-keys";
      for (const k of c.towers) {
        const k1 = img(towerIcon(k), "loss-key");
        k1.removeAttribute("aria-hidden");
        k1.alt = TOWERS[k].name;
        k1.title = `${TOWERS[k].name} answers it`;
        keys.append(k1);
      }
      li.append(keys);
    }
    list.append(li);
  }
  box.append(list);
  // Right under the title and stars (on a phone held sideways, at the head of the card's right-hand column).
  ui.resultStars.parentElement!.after(box);
  ui.dlgResult.classList.add("has-causes");
}

/** A County Show field ends: on to the next with the Goodwill left, or the prize after the third. */
function finishShow(g: Game, lv: Level, run: ShowRun): void {
  const won = g.phase === "won";
  const fields = showFields(run.week, run.picks);
  const last = run.field >= fields.length - 1;
  ui.resultCath.innerHTML = cath(won ? "delighted" : "worried");
  ui.resultEyebrow.textContent = `County Show · field ${run.field + 1} of ${fields.length}: ${lv.name}`;
  ui.resultStars.replaceChildren();
  ui.resultStars.setAttribute("aria-label", "");
  ui.resultWatch.hidden = ui.resultShare.hidden = true;
  ui.resultStats.textContent = `Goodwill ${g.goodwill}/${g.maxGoodwill} · kit: ${showKit(run.week, run.picks).map((k) => TOWERS[k].name).join(", ")}`;
  ui.resultSecondary.onclick = () => {
    ui.dlgResult.close();
    leaveLevel();
  };
  if (!won) {
    ui.resultTitle.textContent = "Out of the running.";
    ui.resultNote.textContent = "The Show runs all week: have another go.";
    ui.resultPrimary.textContent = "Try again";
    ui.resultPrimary.onclick = () => {
      ui.dlgResult.close();
      showRun = { week: run.week, field: 0, carry: null, picks: run.picks };
      startLevel(fields[0]!, false);
    };
  } else if (last) {
    const id = showPacket(run.week);
    const key = `show${run.week}`;
    const first = !(data.showWon ??= {})[key];
    if (first) {
      data.showWon[key] = true;
      (data.packets ??= {})[id] = (data.packets[id] ?? 0) + 1;
      save(data);
    }
    ui.resultTitle.textContent = "Best in Show.";
    ui.resultNote.textContent = first ? "A Seed Packet for the winner, waiting in the Seed Bank." : "Won again. The ribbon's already yours this week.";
    ui.resultPrimary.textContent = "Back to the map";
    ui.resultPrimary.onclick = ui.resultSecondary.onclick;
  } else {
    ui.resultTitle.textContent = `Field ${run.field + 1} is yours.`;
    ui.resultNote.textContent = `${g.goodwill} Goodwill goes with you into the next field.`;
    ui.resultPrimary.textContent = "Next field";
    ui.resultPrimary.onclick = () => {
      ui.dlgResult.close();
      showRun = { ...run, field: run.field + 1, carry: g.goodwill };
      startLevel(fields[run.field + 1]!, false);
    };
  }
  ui.dlgResult.classList.toggle("lost", !won);
  ui.dlgResult.showModal();
}

/** A daily challenge ends: the score, today's best and a share card to copy. */
function finishDaily(g: Game, lv: Level, day: number): void {
  const won = g.phase === "won";
  const score = dailyScore(won, g.goodwill / g.maxGoodwill, earlyCalls);
  const placed: Array<[string, number, number]> = [];
  for (const [, a] of recorder?.replay().log ?? []) if (a.t === "place" || a.t === "packet") placed.push([a.kind, a.col, a.row]);
  const record = recordDaily(data, day, won ? score : 0, won ? placed : undefined);
  ui.resultCath.innerHTML = cath(won ? "delighted" : "worried");
  ui.resultEyebrow.textContent = `Daily #${day + 1}: ${lv.name}`;
  ui.resultTitle.textContent = won ? `${score} out of 100.` : "Not today.";
  ui.resultStars.replaceChildren();
  ui.resultStars.setAttribute("aria-label", "");
  ui.resultStats.textContent = `Today's best ${data.daily?.[String(day)] ?? 0}${record && won ? " (new)" : ""} · Goodwill ${g.goodwill}/${g.maxGoodwill}`;
  const card = shareCard(day, lv, won, score, dailyRule(day));
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

/** An Endless Orchard run: the day's seed, how deep it is and the boons taken so far. */
let orchardRun: { seed: number; depth: number; taken: string[] } | null = null;

function startOrchard(): void {
  dailyDay = null;
  showRun = null;
  endlessArgs = null;
  if (!data.heirlooms?.length && (data.seeds ?? 0) < HEIRLOOMS[0]!.cost && !data.orchard) return plantOrchard();
  openPantry();
}

/** The daily ladder in one line: today's best, then the last few days as depths. */
function orchardLadderLine(): string {
  const today = dayOf(Date.now());
  const at = (d: number): string => {
    const e = data.orchardDays?.[String(d)];
    return e ? String(e.depth) : "\u2013";
  };
  const past = [1, 2, 3, 4, 5, 6].map((i) => at(today - i)).reverse().join(" ");
  return `Today's orchard: ${at(today) === "\u2013" ? "not planted yet" : `${at(today)} fields so far`} · last 6 days ${past}`;
}

function plantOrchard(): void {
  const start = heirloomBoons(data.heirloom);
  orchardRun = { seed: dayOf(Date.now()), depth: 1, taken: [...start] };
  startLevel(orchardLevel(orchardRun.seed, 1, orchardRun.taken), false);
}

/** Cath's pantry: spend Seeds on Heirlooms, carry one into the run, then plant. */
function openPantry(): void {
  document.getElementById("dlg-pantry")?.remove();
  const dlg = document.createElement("dialog");
  dlg.id = "dlg-pantry";
  dlg.className = "sheet pantry";
  const draw = (): void => {
    const h = document.createElement("h2");
    h.textContent = "Cath's pantry";
    const seeds = document.createElement("p");
    seeds.className = "pantry-seeds";
    seeds.textContent = `${data.seeds ?? 0} Seeds · every field you clear in the Orchard earns more`;
    const ladder = document.createElement("p");
    ladder.className = "pantry-seeds";
    ladder.textContent = orchardLadderLine();
    const list = document.createElement("div");
    list.className = "orchard-offers";
    for (const hl of HEIRLOOMS) {
      const owned = data.heirlooms?.includes(hl.id) ?? false;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "orchard-boon";
      btn.disabled = !owned && (data.seeds ?? 0) < hl.cost;
      btn.setAttribute("aria-pressed", String(data.heirloom === hl.id));
      const n = document.createElement("strong");
      n.textContent = owned ? (data.heirloom === hl.id ? `\u2713 ${hl.name} (carried)` : `${hl.name} (tap to carry)`) : `${hl.name} · ${hl.cost} Seeds`;
      const t = document.createElement("small");
      t.textContent = hl.text;
      btn.append(n, t);
      btn.onclick = () => {
        if (owned) carryHeirloom(data, hl.id);
        else if (!buyHeirloom(data, hl.id, hl.cost)) return;
        dlg.replaceChildren();
        draw();
      };
      list.append(btn);
    }
    const go = document.createElement("button");
    go.type = "button";
    go.className = "btn primary";
    go.textContent = "Plant today's orchard";
    go.onclick = () => {
      dlg.close();
      dlg.remove();
      plantOrchard();
    };
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn";
    back.textContent = "Not now";
    back.onclick = () => {
      dlg.close();
      dlg.remove();
    };
    dlg.append(h, seeds, ladder, list, go, back);
  };
  draw();
  document.body.append(dlg);
  dlg.showModal();
}

/** Win a field: pick one of three boons and walk on. Lose one: the run is over and its depth is kept. */
function finishOrchard(g: Game, lv: Level): void {
  const run = orchardRun;
  if (!run) return leaveLevel();
  const won = g.phase === "won";
  const cleared = won ? run.depth : run.depth - 1;
  const record = recordOrchard(data, cleared);
  if (!won || run.depth >= ORCHARD_MAX_DEPTH) recordOrchardDay(data, run.seed, cleared, run.taken);
  const ended = !won || run.depth >= ORCHARD_MAX_DEPTH;
  const earned = ended ? orchardSeeds(cleared) : 0;
  if (ended) addSeeds(data, earned);
  ui.resultCath.innerHTML = cath(won ? "delighted" : record ? "smirk" : "worried");
  ui.resultEyebrow.textContent = lv.name;
  ui.resultStars.replaceChildren();
  ui.resultStars.setAttribute("aria-label", "");
  const best = data.orchard ?? cleared;
  ui.resultSecondary.onclick = () => {
    ui.dlgResult.close();
    leaveLevel();
  };
  if (!won || run.depth >= ORCHARD_MAX_DEPTH) {
    ui.resultTitle.textContent = won ? "The whole orchard, picked clean." : record ? "A new deepest row." : "The row fell.";
    ui.resultStats.textContent = `${cleared} field${cleared === 1 ? "" : "s"} cleared · best ${best} · ${run.taken.length} boon${run.taken.length === 1 ? "" : "s"}`;
    ui.resultNote.textContent = `+${earned} Seeds for Cath's pantry (${data.seeds ?? 0} banked). Same orchard for everyone today; a new one tomorrow.`;
    ui.resultPrimary.hidden = false;
    ui.resultStars.hidden = true;
    const card = `Hedgerow Orchard #${run.seed + 1}\n${"\u{1F34E}".repeat(Math.min(cleared, 10))}${cleared > 10 ? "+" : ""}\n${cleared} of ${ORCHARD_MAX_DEPTH} fields · ${run.taken.length} boons\n${run.taken.map((id) => BOONS.find((b) => b.id === id)?.name ?? id).join(", ")}`;
    ui.resultPrimary.textContent = "Copy card";
    ui.resultPrimary.onclick = () => {
      void navigator.clipboard?.writeText(card).then(
        () => (ui.resultPrimary.textContent = "Copied"),
        () => (ui.resultNote.textContent = card),
      );
    };
    ui.dlgResult.classList.add("lost");
    ui.dlgResult.showModal();
    return;
  }
  ui.resultTitle.textContent = "Field cleared. Pick a boon.";
  ui.resultStats.textContent = `Field ${run.depth} of the orchard · best ${best}`;
  ui.resultNote.textContent = "";
  const offers = orchardOffers(run.seed, run.depth, run.taken);
  const take = (b: Boon): void => {
    run.taken.push(b.id);
    run.depth += 1;
    ui.dlgResult.close();
    startLevel(orchardLevel(run.seed, run.depth, run.taken), false);
  };
  ui.resultPrimary.hidden = true;
  ui.resultStars.hidden = true;
  const row = document.createElement("div");
  row.id = "orchard-offers";
  row.className = "orchard-offers";
  for (const b of offers) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "orchard-boon";
    const n = document.createElement("strong");
    n.textContent = b.kind === "cath" ? `\u2665 ${b.name}` : b.name;
    const t = document.createElement("small");
    t.textContent = b.text;
    btn.append(n, t);
    btn.onclick = () => {
      ui.resultPrimary.hidden = false;
      ui.resultStars.hidden = false;
      take(b);
    };
    row.append(btn);
  }
  document.getElementById("orchard-offers")?.remove();
  ui.resultNote.after(row);
  ui.dlgResult.classList.remove("lost");
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

/** The Compost Heap: XP past a kind's Crown gate, spent on any kind that still has room, 2 compost per XP. */
function renderCompost(): void {
  const heap = data.compost ?? 0;
  const show = heap > 0;
  ui.compost.hidden = ui.compostHead.hidden = !show;
  ui.compost.replaceChildren();
  if (!show) return;
  ui.compostHead.textContent = `Compost Heap ${heap.toLocaleString()}`;
  for (const [kind, spec] of Object.entries(TOWERS) as [TowerKind, (typeof TOWERS)[TowerKind]][]) {
    const have = data.xp?.[kind] ?? 0;
    if (have >= XP_CROWN || have === 0) continue;
    const li = document.createElement("li");
    li.className = "perk";
    const text = document.createElement("div");
    const n = document.createElement("strong");
    n.textContent = spec.name;
    const sm = document.createElement("small");
    sm.textContent = `XP ${have.toLocaleString()} of ${XP_CROWN.toLocaleString()}`;
    text.append(n, sm);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    const give = Math.min(COMPOST_FEED, XP_CROWN - have);
    b.textContent = `+${give} XP`;
    b.disabled = heap < give * COMPOST_RATE;
    b.onclick = () => {
      if (feedCompost(data, kind)) sfx.playUpgrade();
      save(data);
      renderBank();
    };
    li.append(text, b);
    ui.compost.append(li);
  }
}

/** The Seed Packet shop: one-use pre-grown towers, bought with Acorns and planted free from the build menu. */
function renderPackets(): void {
  ui.packets.replaceChildren();
  for (const pk of PACKETS) {
    const li = document.createElement("li");
    li.className = "perk";
    const text = document.createElement("div");
    const n = document.createElement("strong");
    n.textContent = pk.name;
    const have = document.createElement("small");
    have.textContent = `Plants a ready-grown ${TOWERS[pk.kind].name}, free, once. You have ${packetCount(data, pk.id)}.`;
    text.append(n, have);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = `🌰 ${pk.cost}`;
    b.disabled = freeAcorns(data) < pk.cost;
    b.setAttribute("aria-label", `Buy a ${pk.name} Seed Packet for ${pk.cost} acorns`);
    b.onclick = () => {
      if (buyPacket(data, pk.id)) sfx.playUpgrade();
      save(data);
      renderBank();
    };
    li.append(text, b);
    ui.packets.append(li);
  }
}

function renderBank(): void {
  renderRosettes();
  renderPackets();
  renderCompost();
  ui.bankFree.textContent = `${freeStars(data)} stars to spend. Earn more by clearing levels with three stars.${(data.acorns ?? 0) > 0 ? ` ${freeAcorns(data)} acorns to spend (earned by winning).` : ""}`;
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
    const purse = p.acorns ? freeAcorns(data) : freeStars(data);
    const coin = p.acorns ? "acorns" : "stars";
    b.textContent = cost === null ? "Full" : `${p.acorns ? "🌰" : "★"} ${cost}`;
    b.disabled = cost === null || cost > purse;
    b.setAttribute("aria-label", cost === null ? `${p.name}: fully grown` : `Buy ${p.name} rank ${rank + 1} for ${cost} ${coin}`);
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
ui.canvas.addEventListener("dblclick", (e) => {
  // Plan item 191: a double-tap pushes in on the plot; a second comes back to the whole field.
  if (!is3D(renderer)) return;
  if (renderer.zoomed) renderer.resetView();
  else renderer.pushTo(e.clientX, e.clientY);
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
// Phones fold Pause and Sound into one button: it pauses and opens the pause card; closing it resumes.
let pausedByMenu = false;
ui.btnMenu.addEventListener("click", () => {
  pausedByMenu = !paused;
  paused = true;
  syncControls();
  $<HTMLElement>("pause-cath").innerHTML = cath("smirk");
  ui.dlgPause.showModal();
});
ui.dlgPause.addEventListener("close", () => {
  if (pausedByMenu) paused = false;
  pausedByMenu = false;
  syncControls();
});
ui.pauseResume.addEventListener("click", () => {
  pausedByMenu = true;
  ui.dlgPause.close();
});
ui.pauseSound.addEventListener("click", () => ui.btnSound.click());
ui.pauseLevels.addEventListener("click", () => {
  pausedByMenu = false;
  ui.dlgPause.close();
  leaveLevel();
});
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
    $<HTMLElement>("duel-cath").innerHTML = cath("determined");
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
  "btn-show": () => "The County Show: three fields, one kit of six towers and one Goodwill purse. A new Show every week; win it for a Seed Packet.",
  "btn-daily": () => "Today's challenge: one level a day, no Seed Bank, and a score to share.",
  "btn-orchard": () => "Orchard: a run of fields, one boon after each, ending when a field falls. Same orchard for everyone today.",
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
  if (text) showTipText(el, text);
}
/** The paper-tag tooltip over (or under) `el`, saying `text`. */
function showTipText(el: HTMLElement, text: string): void {
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
  // The paper tag's tail points at the control, above or below it.
  ui.tooltip.style.setProperty("--tail-x", `${Math.round(Math.max(14, Math.min(w - 14, r.left + r.width / 2 - x)))}px`);
  ui.tooltip.classList.toggle("below", !(above > 8));
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

/** Kit chips on the level-select screen, so the kit is chosen before the field, not buried in her sheet. */
function renderSelectKits(): void {
  const box = $<HTMLElement>("select-kits");
  box.replaceChildren();
  const lab = document.createElement("span");
  lab.className = "select-kits-label";
  lab.textContent = "Cath's kit";
  box.append(lab);
  for (const k of [null, ...KITS]) {
    const b = document.createElement("button");
    b.type = "button";
    const on = (data.kit ?? null) === (k?.id ?? null);
    b.className = `kit-chip${on ? " picked" : ""}`;
    b.setAttribute("aria-pressed", String(on));
    b.textContent = k?.name ?? "Plain";
    b.title = k?.blurb ?? "No kit: Cath plays as she is.";
    b.onclick = () => {
      if (k) data.kit = k.id;
      else delete data.kit;
      save(data);
      sfx.playUpgrade();
      renderSelectKits();
    };
    box.append(b);
  }
}

function renderKits(): void {
  const box = $<HTMLElement>("cath-kits");
  box.replaceChildren();
  const h = document.createElement("h3");
  h.className = "rosette-head";
  h.textContent = "Kit";
  const row = document.createElement("div");
  row.className = "wardrobe";
  for (const k of [null, ...KITS]) {
    const b = document.createElement("button");
    b.type = "button";
    const on = (data.kit ?? null) === (k?.id ?? null);
    b.className = `outfit${on ? " picked" : ""}`;
    b.setAttribute("aria-pressed", String(on));
    const n = document.createElement("strong");
    n.textContent = k?.name ?? "Plain";
    const d = document.createElement("small");
    d.textContent = k?.blurb ?? "No kit: Cath plays as she is.";
    b.append(n, d);
    b.onclick = () => {
      if (k) data.kit = k.id;
      else delete data.kit;
      save(data);
      sfx.playUpgrade();
      renderKits();
      renderSelectKits();
    };
    row.append(b);
  }
  box.append(h, row);
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
    const ok = outfitUnlocked(o, data);
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
      shareOutfit(o);
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
  renderKits();
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
// U225: the Modes drawer (desktop/landscape) opens on the toggle and closes on a pick, an outside click or Escape.
{
  const drawer = $<HTMLElement>("tools-drawer");
  const toggle = $<HTMLButtonElement>("btn-modes");
  const setOpen = (open: boolean): void => {
    drawer.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(!drawer.classList.contains("open")));
  drawer.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (btn && btn.id !== "btn-diff" && btn.id !== "btn-remix") setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (!drawer.contains(e.target as Node) && !toggle.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

$<HTMLButtonElement>("almanac-close").addEventListener("click", () => $<HTMLDialogElement>("dlg-almanac").close());

ui.btnCath.addEventListener("click", () => {
  renderCath();
  ui.dlgCath.showModal();
  ui.dlgCath.scrollTop = 0;
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

mountWeekChip(document.getElementById("week-slot"), "Hedgerow");
