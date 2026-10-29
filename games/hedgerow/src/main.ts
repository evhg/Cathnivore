import "../../../shared/ui/base.css";
import "../../../shared/ui/palette.css";
import "./fonts.css";
import "./tokens.css";
import "./styles.css";
import "./ui/components.css";
import "../../../shared/cath/cath.css";
import { cathSvg, type CathExpression } from "../../../shared/cath/cath";
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
import { LIVE_CAP, P, PROPERTIES, RUNGS, fvOf, propsOf } from "./fleet";
import { cardBody, damageLabel, leakReport as fleetLeakReport, lockLine, lossCauses, roundProps, towerBadges, unanswered, vehicleName } from "./counters";
import { roundFor } from "./rounds";
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
  recordDaily,
  recordBuild,
  refundAll,
  save,
} from "./store";
import { awardRun, buyPacket, feedCompost, packetCount, spendPacket, COMPOST_FEED, COMPOST_RATE, PACKETS } from "./meta";
import { SHOW_EXTRAS, showFields, showKit, showPacket } from "./show";
import { dailyLevel, dailyRule, dailyScore, dayOf, shareCard } from "./daily";
import { endlessLevel, weekOf } from "./endless";
import { Player, Recorder, applyAction, decodeReplay, encodeReplay, restoreRun, rewindToWave, startGame, HOLLOW_SHIFT, type Action, type Replay, type Setup } from "./replay";
import { ROSETTES, newRosettes } from "./rosettes";
import { setupAlmanac } from "./almanac";
import { KITS } from "./hero";
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
const shortScreen = (): boolean => {
  try {
    return window.matchMedia("(max-height: 520px)").matches;
  } catch {
    return false;
  }
};
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
let earlyCalls = 0;
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

function renderLevels(): void {
  ui.bankStars.textContent = String(freeStars(data));
  $<HTMLElement>("daily-new").hidden = data.daily?.[String(dayOf(Date.now()))] !== undefined;
  renderCathButton();
  renderSelectKits();
  renderContinue();
  renderMap(ui.levels, LEVELS, data, (lv) => openLevel(lv), (act) => { dailyDay = null; showRun = null; const week = weekOf(Date.now()); endlessArgs = { act, week }; startLevel(endlessLevel(act, week), false); });
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
    spawn: (kind: EnemyKind, dist: number) => game && game.enemies.push(makeEnemy(game, kind, dist, undefined, game.wave || 1)),
    cellCenter: (c: number, r: number) => renderer?.cellCenter(c, r) ?? null,
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
      el.style.left = `${at.x}px`;
      el.style.top = `${at.y}px`;
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
  levelTips(lv);
}

function leaveLevel(): void {
  dailyDay = null;
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

function levelTips(lv: Level): void {
  // The level's twist, up front: it's what makes this level a different problem.
  if (lv.twists?.length)
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

function line(text: string, cls = ""): HTMLParagraphElement {
  const el = document.createElement("p");
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
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
    if (miss.length) {
      const names = miss.map((m) => PROPERTIES[m].name);
      const t = tag(`Can't answer`, "warn", `Your field can't answer ${names.join(", ")}`);
      t.append(propRow(miss.reduce((a, m) => a | P[m], 0), "chip-props"));
      head.append(t);
      warn = line(`Your field can't answer this: ${miss.map((m) => `${PROPERTIES[m].name}. ${PROPERTIES[m].key}`).join(" ")}`, "field-warn");
      warn.setAttribute("role", "status");
    }
  }
  p.append(ticket);
  // The side panel's longer read (a phone shows the ticket alone: styles hide these there).
  if (warn) p.append(warn);
  if (page) p.append(line(page.card, "ticket-note"));
  p.append(...notes);
  if (then) p.append(then);
  const advice = cathAdvice(g, next);
  if (advice) p.append(line(`Cath: ${advice}`, "cath-tip"));
  if (g.phase === "build" && g.wave === 0) p.append(line("Tap a plot to build. Between waves, tap Cath, then tap the field to give her a new post.", "hint"));
  if (fleet) p.append(fieldIntel(g));
}

/** Desktop side panel: what stands on the field and which locks it answers (styles hide it on a phone). */
function fieldIntel(g: Game): HTMLElement {
  const box = document.createElement("section");
  box.className = "field-intel";
  const h = document.createElement("h3");
  h.textContent = "Your field";
  box.append(h);
  const by = new Map<TowerKind, { n: number; tier: number }>();
  for (const t of g.towers) {
    const e = by.get(t.kind) ?? { n: 0, tier: 0 };
    e.n++;
    e.tier = Math.max(e.tier, t.tier);
    by.set(t.kind, e);
  }
  if (!by.size) {
    box.append(line("Nothing planted yet. Pick a packet from the tray and tap a plot.", "intel-empty"));
  } else {
    const ul = document.createElement("ul");
    ul.className = "intel-towers";
    for (const [kind, e] of by) {
      const li = document.createElement("li");
      li.title = `${e.n} × ${TOWERS[kind].name}, best at tier ${e.tier}`;
      li.append(img(towerIcon(kind), "chip-icon"));
      const nm = document.createElement("span");
      nm.textContent = `${TOWERS[kind].name} ×${e.n}`;
      const tr = document.createElement("span");
      tr.className = "intel-tier";
      tr.textContent = `T${e.tier}`;
      li.append(nm, tr);
      ul.append(li);
    }
    box.append(ul);
  }
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
    b.dataset.cost = String(cost);
    b.disabled = g.marks < cost;
    const stats = towerStatLine(g, kind);
    b.setAttribute("aria-label", `${TOWERS[kind].name}, ${cost} Marks. ${TOWERS[kind].blurb} ${stats}. Drag onto a plot, or pick a plot first.`);
    const price = document.createElement("span");
    price.className = "build-cost";
    price.textContent = String(cost);
    b.append(img(towerIcon(kind), "tray-icon"), price);
    b.addEventListener("pointerdown", (e) => startDrag(e, kind));
    b.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || !HOVER) return;
      clearTimeout(tipTimer);
      tipTimer = window.setTimeout(() => showTipText(b, `${TOWERS[kind].name}: ${stats}. ${TOWERS[kind].blurb}`), 380);
    });
    b.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") hideTip();
    });
    b.onclick = () => {
      if (dragEnded()) return;
      hideTip();
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
  };
  tray.addEventListener("scroll", sync, { passive: true });
  requestAnimationFrame(sync);
  wrap.append(tray, more);
  p.append(wrap);
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
  // A "New on the lane" advert already up steps down out of the ribbon's way (short screens; CSS .dodge).
  if (!ui.intro.hidden) ui.intro.classList.add("dodge");
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => ui.banner.classList.remove("show"), boss ? 2600 : 1700);
}

function describeEnemy(kind: EnemyKind): string {
  // Fleet rungs (Hedgerow 2): what it looks like, what it pops into and what a leak costs.
  const rung = game && isFleet(game.level) ? RUNGS[kind] : undefined;
  if (rung && !isBig(kind)) return `${rung.look} Worth ${fvOf(kind)} Mark${fvOf(kind) === 1 ? "" : "s"} popped; a leak costs ${fvOf(kind)} Goodwill.`;
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
  // The lead sentence, then the rest: a short landscape phone shows only the lead, whole, never an ellipsis
  // (the full text is read out and lives in the Almanac).
  const d = document.createElement("p");
  const desc = describeEnemy(k);
  const cut = desc.search(/\.\s/);
  const lead = document.createElement("span");
  lead.className = "intro-lead";
  lead.textContent = cut > 0 ? desc.slice(0, cut + 1) : desc;
  d.append(lead);
  if (cut > 0) {
    const more = document.createElement("span");
    more.className = "intro-more";
    more.textContent = desc.slice(cut + 1);
    d.append(more);
  }
  box.append(eb, n, d);
  ui.intro.append(box);
  // Keep the card off the side the Fleet comes in from: that corner is where the first pops happen.
  const spawn = game && renderer ? spawnSide(game) : "left";
  ui.intro.classList.toggle("left", spawn === "right");
  ui.intro.classList.toggle("dodge", ui.banner.classList.contains("show"));
  ui.intro.hidden = false;
  ui.intro.classList.remove("pop");
  void ui.intro.offsetWidth;
  ui.intro.classList.add("pop");
  say(`${ENEMIES[k].name}. ${describeEnemy(k)}`);
  // A short landscape phone has no room for both: Cath's tip steps aside and comes back after the card.
  if (shortScreen() && !ui.bubble.hidden && bubbleTip) {
    pendingTip = { id: bubbleTip, text: ui.bubbleText.textContent ?? "", expression: bubbleFace };
    clearTimeout(bubbleTimer);
    hideBubble();
  }
  clearTimeout(introTimer);
  introTimer = window.setTimeout(hideIntro, shortScreen() ? 3600 : 5200);
}

function hideIntro(): void {
  ui.intro.hidden = true;
  const p = pendingTip;
  pendingTip = null;
  if (p && game) tip(p.id, p.text, p.expression, true);
}

/** Which half of the screen the lane starts in. */
function spawnSide(g: Game): "left" | "right" {
  const [c, r] = g.level.path[0]!;
  const rect = ui.canvas.getBoundingClientRect();
  const p = renderer?.cellCenter(c, r);
  if (!p || !rect.width) return c < g.level.cols / 2 ? "left" : "right";
  return p.x < rect.left + rect.width / 2 ? "left" : "right";
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
        break;
      case "leak":
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
        if (isFleet(g.level) && !boss) window.setTimeout(() => game === g && introduce(kinds), 1800);
        else introduce(kinds);
        if (ev.early) {
          earlyCalls += 1;
          stackedWave = ev.wave;
        }
        break;
      }
      case "cleared":
        sfx.playCleared();
        if (ev.wave < g.level.waves.length) banner(isFleet(g.level) ? `Round ${ev.wave} cleared` : `Wave ${ev.wave} cleared`, ev.reward > 0 ? `+${ev.reward} Marks` : "", false, "small");
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
      sfx.setIntensity(g.phase !== "wave" ? 0 : g.enemies.some((e) => isBig(e.kind)) ? 2 : 1);
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
  renderer.draw(g, paused ? 0 : dt * Math.min(speed, 2));
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
    } else {
      sfx.playLose();
      haptic.lose();
    }
    window.setTimeout(() => finish(g), g.phase === "won" ? 1800 : 700);
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

function finish(g: Game): void {
  if (game !== g) return;
  document.getElementById("loss-causes")?.remove();
  const xpBox = document.getElementById("result-xp");
  if (xpBox) xpBox.hidden = true;
  document.getElementById("result-retry")?.remove();
  ui.resultPrimary.classList.remove("btn-quiet");
  ui.resultNote.hidden = false;
  ui.resultStars.hidden = false;
  ui.dlgResult.classList.remove("has-causes");
  const lv = g.level;
  rememberBuilds(g);
  if (lv.endless) return finishEndless(g, lv);
  if (dailyDay !== null) return finishDaily(g, lv, dailyDay);
  if (showRun) return finishShow(g, lv, showRun);
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
  const stats = [
    `Goodwill kept ${g.goodwill}/${g.maxGoodwill}`,
    `Cath's knockouts ${g.hero.kills}`,
  ];
  const crew = g.towers.filter((t) => (t.kills ?? 0) > 0).sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0));
  const totalKO = crew.reduce((a, t) => a + (t.kills ?? 0), 0);
  if (totalKO) stats.unshift(`Knockouts ${totalKO.toLocaleString()}`);
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
  ui.resultNote.textContent = won
    ? `${lv.reward}${gained ? ` · +${gained} star${gained > 1 ? "s" : ""} for the Seed Bank.` : ""}`
    : "Regroup and try again. Hedges slow them, scarecrows finish them, and Cath can hold the lane where it bends. Stars buy perks in the Seed Bank.";
  renderLossCauses(g, won);
  if (won) {
    const cathBefore = levelOf(xpOf(data.stars)).level;
    recordStars(data, lv.id, n);
    if (!lv.endless && dailyDay === null) {
      const mode: MedalMode = g.remix ?? (g.heroic ? "hollow" : g.difficulty);
      if (recordMedal(data, lv.id, mode)) ui.resultNote.textContent += ` · ${mode[0]!.toUpperCase() + mode.slice(1)} medal ●`;
    }
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
    retryButton(g, lv);
  }
  ui.resultSecondary.onclick = () => {
    ui.dlgResult.close();
    leaveLevel();
  };
  ui.dlgResult.classList.toggle("lost", !won);
  ui.dlgResult.showModal();
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
  // Right under the title, so the top cause is on screen even on a phone held sideways (390 px tall).
  ui.resultTitle.after(box);
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
