import "./styles.css";
import "../../../shared/cath/cath.css";
import { cathSvg, type CathExpression } from "../../../shared/cath/cath";
import {
  ENEMIES,
  PIE_FIRST_LEVEL,
  SPECIALISATIONS,
  SPEC_FIRST_LEVEL,
  STEP,
  TARGET_MODES,
  TOWERS,
  TWISTS,
  canCallEarly,
  drainEvents,
  earlyBonus,
  isBig,
  isPlot,
  laneCellsOf,
  newGame,
  pieRadius,
  pieUnlocked,
  place,
  sell,
  sellValue,
  sendWave,
  setTarget,
  specCost,
  specsUnlocked,
  stars as starsOf,
  stepGame,
  throwPie,
  callNeighbours,
  callRally,
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
  type EnemyKind,
  type Game,
  type GameEvent,
  type Level,
  type StoryLine,
  type TargetMode,
  type Tower,
} from "./engine";
import { LEVELS } from "./levels";
import { Renderer } from "./render";
import { Renderer3D } from "./render3d";
import { enemyIcon, img, towerIcon } from "./icons";
import * as sfx from "./sound";
import { haptic, setHaptics } from "./haptics";
import {
  PERKS,
  buyPerk,
  freeStars,
  isUnlocked,
  load,
  nextCost,
  perksOf,
  recordStars,
  refundAll,
  save,
} from "./store";
import { actScene, renderMap } from "./map";
import { castSvg, type CastMember } from "./cast";
import { FINALE } from "./story/acts6to10";

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
  bankStars: $<HTMLElement>("bank-stars"),
  dlgBank: $<HTMLDialogElement>("dlg-bank"),
  bankFree: $<HTMLElement>("bank-free"),
  perks: $<HTMLUListElement>("perks"),
  bankClose: $<HTMLButtonElement>("bank-close"),
  bankRefund: $<HTMLButtonElement>("bank-refund"),
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
const cath = (expression: CathExpression) => cathSvg({ framing: "face", expression, animate: true });

const data = load();
ui.hostFace.innerHTML = cath("smirk");
ui.heroFace.innerHTML = cathSvg({ framing: "face", expression: "determined" });

let game: Game | null = null;
/** 3D when WebGL is there (and `?2d` isn't asked for); the 2D canvas renderer otherwise. */
let renderer: Renderer | Renderer3D | null = null;
const USE_3D = !new URLSearchParams(location.search).has("2d") && Renderer3D.supported();
setHaptics(!sfx.isMuted());
let selected: { col: number; row: number } | null = null;
/** Auto-continue: the next wave starts by itself after a countdown (the auto-battler default). */
const AUTO_SECS = 6;
let autoNext = (() => {
  try {
    return localStorage.getItem("hedgerow:auto") !== "off";
  } catch {
    return true;
  }
})();
let autoLeft = AUTO_SECS;

let speed = (() => {
  try {
    const v = Number(localStorage.getItem("hedgerow:speed"));
    return v === 2 || v === 3 ? v : 1;
  } catch {
    return 1;
  }
})();
let paused = false;
let aiming = false;
let last = 0;
let acc = 0;
let raf = 0;
let finished = false;
let panelKey = "";
let earlyCalls = 0;
let bubbleTimer = 0;
let bannerTimer = 0;

function say(text: string): void {
  ui.announce.textContent = text;
}

// ---- level select ----

function renderLevels(): void {
  ui.bankStars.textContent = String(freeStars(data));
  renderMap(ui.levels, LEVELS, data, (lv) => openLevel(lv));
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
    ui.storyLeft.innerHTML = cathSvg({ framing: "bust", expression: line.who === "cath" ? (line.expression ?? "smirk") : "smirk", animate: true });
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
  ui.storyNext.onclick = () => {
    if (typing) {
      finishTyping();
      return;
    }
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

function startLevel(lv: Level): void {
  game = newGame(lv, perksOf(data));
  if (SANDBOX) {
    game.marks = 99999;
    game.goodwill = game.maxGoodwill = 999;
  }
  selected = null;
  finished = false;
  paused = false;
  aiming = false;
  panelKey = "";
  earlyCalls = 0;
  ui.select.hidden = true;
  ui.play.hidden = false;
  ui.hudTitle.textContent = `${lv.id}. ${lv.name}`;
  ui.hudPlace.textContent = lv.place;
  renderer ??= USE_3D ? new Renderer3D(ui.canvas, $<HTMLElement>("fx-layer")) : new Renderer(ui.canvas);
  document.documentElement.classList.toggle("hedgerow-3d", renderer instanceof Renderer3D);
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
    tip("hero", "I'm in the lane too. Tap the lane to send me somewhere: I hold two at a time. Drones fly over me.", "determined");
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
  const h = g.hero;
  ui.btnHero.classList.toggle("down", h.down > 0);
  ui.heroHp.style.setProperty("--hp", String(h.down > 0 ? 0 : h.hp / h.maxHp));
  ui.btnHero.setAttribute(
    "aria-label",
    h.down > 0
      ? `Cath is catching her breath, back in ${Math.ceil(h.down)} seconds`
      : `Cath, ${Math.round(h.hp)} of ${h.maxHp} health, ${h.kills} knockouts. She goes where she's needed.`,
  );
  const more = g.wave < g.level.waves.length;
  const early = canCallEarly(g);
  ui.btnSend.disabled = !(g.phase === "build" && more) && !early;
  ui.btnSend.classList.toggle("early", early);
  ui.btnAuto.setAttribute("aria-pressed", String(autoNext));
  ui.btnSend.textContent =
    g.phase === "build" && more
      ? autoNext && g.wave > 0 && autoLeft > 0
        ? `Wave ${g.wave + 1} in ${Math.ceil(autoLeft)}…`
        : `Send wave ${g.wave + 1}`
      : early
        ? `Call wave ${g.wave + 1} early +${earlyBonus(g)}`
        : g.phase === "wave"
          ? `Wave ${g.wave} on the lane`
          : g.phase === "won" || g.phase === "lost"
            ? "Level over"
            : "All waves sent";
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
  const key = [sel?.col, sel?.row, t?.id, t?.tier, t?.target, g.wave, g.phase, renderer?.heroSelected, aiming].join("|");
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
    p.append(line("That's the lane. Tap it again to send Cath there."));
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
  const row = document.createElement("ul");
  row.className = "preview-row";
  for (const { kind, count } of waveSummary(next)) {
    const li = document.createElement("li");
    li.className = "preview-chip" + (isBig(kind) ? " boss" : "");
    li.append(img(enemyIcon(kind), "chip-icon"));
    const label = document.createElement("span");
    label.textContent = `${count} × ${ENEMIES[kind].name}`;
    li.append(label);
    row.append(li);
  }
  p.append(row);
  if (g.phase === "build" && g.wave === 0) p.append(line("Tap a plot to build. Tap the lane to move Cath.", "hint"));
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
    b.setAttribute("aria-label", `${spec.name}, ${cost} Marks. ${spec.blurb}${wet ? " Too wet here." : ""}`);
    b.append(img(towerIcon(kind), "build-icon"));
    const name = document.createElement("span");
    name.className = "build-name";
    name.textContent = spec.name;
    const price = document.createElement("span");
    price.className = "build-cost";
    price.textContent = String(cost);
    b.append(name, price);
    const show = () => {
      info.textContent = `${spec.name}: ${spec.blurb}`;
      if (renderer) renderer.preview = kind;
    };
    b.addEventListener("pointerenter", show);
    b.addEventListener("focus", show);
    b.onclick = () => {
      if (act(() => place(g, kind, sel.col, sel.row))) {
        sfx.playBuild();
        haptic.build();
        const nt = g.towers[g.towers.length - 1];
        if (nt) renderer?.built_(nt.id, nt.col, nt.row, false);
        renderPanel(true);
        if (g.level.id === 1 && g.towers.length === 1)
          tip("send", "Lovely. When you're ready, send the wave. I'll be in the lane.", "delighted");
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
  const name = t.tier === 4 && t.spec != null ? SPECIALISATIONS[t.kind][t.spec].name : spec.name;
  const title = line(name, "panel-title");
  title.setAttribute("aria-label", `${name}, tier ${t.tier} of 4`);
  const pips = document.createElement("span");
  pips.className = "pips";
  pips.setAttribute("aria-hidden", "true");
  pips.textContent = "★".repeat(t.tier) + "☆".repeat(4 - t.tier);
  title.append(" ", pips);
  titles.append(title);
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
      setTarget(g, t.id, next);
      renderPanel(true);
    };
    titles.append(tb);
  }
  head.append(titles);
  p.append(head);

  const row = document.createElement("div");
  row.className = "panel-row";
  if (t.tier < 3) {
    const cost = upgradeCost(t)!;
    const nextStats = towerStats({ kind: t.kind, tier: (t.tier + 1) as 2 | 3, spec: null });
    p.append(statGrid(st, nextStats));
    const up = document.createElement("button");
    up.type = "button";
    up.className = "btn";
    up.id = "btn-upgrade";
    up.dataset.cost = String(cost);
    up.textContent = `Upgrade to tier ${t.tier + 1} · ${cost}`;
    up.disabled = g.marks < cost;
    up.onclick = () => {
      if (act(() => upgrade(g, t.id))) {
        sfx.playUpgrade();
        haptic.upgrade();
        renderer?.built_(t.id, t.col, t.row, true);
        renderPanel(true);
      }
    };
    row.append(up);
  } else if (t.tier === 3) {
    p.append(statGrid(st));
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
        if (act(() => upgrade(g, t.id, i))) {
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
  } else p.append(statGrid(st));
  const sl = document.createElement("button");
  sl.type = "button";
  sl.className = "btn btn-quiet";
  sl.id = "btn-sell";
  sl.textContent = `Sell +${sellValue(t)}`;
  sl.onclick = () => {
    if (act(() => sell(g, t.id))) sfx.playSell();
    deselect();
  };
  row.append(sl);
  p.append(row);
}

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

/** Cath runs herself (the auto-battler): tapping her shows how she's doing. */
function heroStatus(): void {
  if (!game) return;
  const h = game.hero;
  toast(
    h.down > 0
      ? `Cath is catching her breath: back in ${Math.ceil(h.down)}s.`
      : `Cath: ${Math.round(h.hp)}/${h.maxHp} health, ${h.kills} knockouts. She goes where she's needed.`,
  );
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
  if (act(() => throwPie(game!, x, y))) sfx.playPie();
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
  if (e.flying) bits.push("Flies over Cath.");
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
        if (g.goodwill <= g.maxGoodwill / 2 && g.goodwill > 0)
          tip(`low-${g.level.id}`, "They're getting through! Hedges near the farmhouse, and send me to the end of the lane.", "worried", true);
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
        } else banner(`Wave ${ev.wave}`, ev.early ? `Called early · +${ev.early} Marks` : `of ${g.level.waves.length}`);
        introduce(kinds);
        if (ev.early) earlyCalls += 1;
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
    if (g.phase === "build" && g.wave > 0 && g.wave < g.level.waves.length && autoNext) {
      // Hold the countdown while the player is choosing something.
      if (!selected) autoLeft -= dt * speed;
      if (autoLeft <= 0) {
        autoLeft = AUTO_SECS;
        act(() => sendWave(g));
      }
      syncControls();
    } else if (g.phase !== "build") autoLeft = AUTO_SECS;
    acc += dt * speed;
    let stepped = false;
    while (acc >= STEP) {
      acc -= STEP;
      stepGame(g);
      stepped = true;
    }
    if (stepped) {
      const evs = drainEvents(g);
      onEvents(g, evs);
      renderer.feed(evs, g);
      updateHud();
      sfx.setIntensity(g.phase !== "wave" ? 0 : g.enemies.some((e) => isBig(e.kind)) ? 2 : 1);
      if (canCallEarly(g) && g.level.id <= 3)
        tip("early", "Feeling brave? Call the next wave early for bonus Marks.", "wink");
      if (pieUnlocked(g.level) && g.pieCd === 0 && g.phase === "wave" && g.enemies.length > 3)
        tip("pie-ready", "Pie's ready. Tap it, then tap the thick of them.", "delighted");
    }
  }
  renderer.draw(g, paused ? 0 : dt * Math.min(speed, 2));
  if (!finished && (g.phase === "won" || g.phase === "lost")) {
    finished = true;
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
  if (earlyCalls) stats.push(`Waves called early ${earlyCalls}`);
  ui.resultStats.textContent = won ? stats.join(" · ") : `Reached wave ${g.wave} of ${lv.waves.length}`;
  const gained = won ? Math.max(0, n - before) : 0;
  ui.resultNote.textContent = won
    ? `${lv.reward}${gained ? ` · +${gained} star${gained > 1 ? "s" : ""} for the Seed Bank.` : ""}`
    : "Regroup and try again. Hedges slow them, scarecrows finish them, and Cath can hold the lane where it bends. Stars buy perks in the Seed Bank.";
  if (won) {
    recordStars(data, lv.id, n);
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

// ---- the Seed Bank ----

function renderBank(): void {
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

ui.canvas.addEventListener("click", (e) => {
  if (!game || !renderer) return;
  sfx.unlock();
  const w = renderer.worldAt(e.clientX, e.clientY);
  if (aiming) {
    fire(w.x, w.y);
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
  if (!game || !renderer || !aiming) return;
  const w = renderer.worldAt(e.clientX, e.clientY);
  renderer.aim = { x: w.x, y: w.y, r: pieRadius(game) };
});
ui.canvas.addEventListener("pointerleave", () => {
  if (renderer && aiming) renderer.aim = null;
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
    else if (!laneCellsOf(g.level).has(`${cur.col},${cur.row}`)) select(cur.col, cur.row);
  } else if (e.key === "Escape") {
    aiming = false;
    renderer.aim = null;
    deselect();
  } else if (e.key === "c" || e.key === "C") {
    heroStatus();
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
  act(() => sendWave(game!));
});
ui.btnPie.addEventListener("click", () => {
  sfx.unlock();
  startAim();
});
ui.btnNeighbours.addEventListener("click", () => {
  if (!game) return;
  sfx.unlock();
  if (act(() => callNeighbours(game!))) sfx.playNeighbours();
  syncControls();
});
ui.btnRally.addEventListener("click", () => {
  if (!game) return;
  sfx.unlock();
  if (act(() => callRally(game!))) sfx.playRally();
  syncControls();
});
ui.btnHero.addEventListener("click", () => {
  sfx.unlock();
  heroStatus();
});
ui.btnAuto.addEventListener("click", () => {
  autoNext = !autoNext;
  autoLeft = AUTO_SECS;
  try {
    localStorage.setItem("hedgerow:auto", autoNext ? "on" : "off");
  } catch {
    /* storage blocked */
  }
  syncControls();
});
ui.btnSpeed.addEventListener("click", () => {
  speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
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

renderLevels();
