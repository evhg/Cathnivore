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
  canCallEarly,
  drainEvents,
  earlyBonus,
  isBig,
  isPlot,
  laneCells,
  moveHero,
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
  towerAt,
  towerCost,
  towerStats,
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
import { enemyIcon, img, towerIcon } from "./icons";
import * as sfx from "./sound";
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
import { renderMap } from "./map";

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
  pieRing: $<HTMLElement>("pie-ring"),
  pieLabel: $<HTMLElement>("pie-label"),
  btnHero: $<HTMLButtonElement>("btn-hero"),
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
  storyCath: $<HTMLElement>("story-cath"),
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
  narrator: "Marrow",
};
const cath = (expression: CathExpression) => cathSvg({ framing: "face", expression, animate: true });

const data = load();
ui.hostFace.innerHTML = cath("smirk");
ui.heroFace.innerHTML = cathSvg({ framing: "face", expression: "determined" });

let game: Game | null = null;
let renderer: Renderer | null = null;
let selected: { col: number; row: number } | null = null;
let speed = 1;
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

function showStory(lines: StoryLine[], place: string, done: () => void): void {
  let i = 0;
  const show = () => {
    const line = lines[i]!;
    ui.storyPlace.textContent = place;
    ui.storyWho.textContent = NAMES[line.who];
    ui.storyText.textContent = line.text;
    ui.storyCath.classList.toggle("letter", line.who !== "cath");
    ui.storyCath.dataset.who = line.who;
    ui.storyCath.innerHTML = line.who === "cath" ? cath(line.expression ?? "smirk") : NAMES[line.who].charAt(0);
    ui.storyNext.textContent = i === lines.length - 1 ? "Let's go" : "Next";
  };
  ui.storyNext.onclick = () => {
    i += 1;
    if (i >= lines.length) {
      ui.dlgStory.close();
      done();
    } else show();
  };
  if (lines.length === 0) {
    done();
    return;
  }
  show();
  if (!ui.dlgStory.open) ui.dlgStory.showModal();
}

function openLevel(lv: Level): void {
  const start = () => startLevel(lv);
  if (!data.seenBefore[String(lv.id)]) {
    showStory(lv.before, lv.place, () => {
      data.seenBefore[String(lv.id)] = true;
      save(data);
      start();
    });
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
  speed = 1;
  panelKey = "";
  earlyCalls = 0;
  ui.select.hidden = true;
  ui.play.hidden = false;
  ui.hudTitle.textContent = `${lv.id}. ${lv.name}`;
  ui.hudPlace.textContent = lv.place;
  renderer ??= new Renderer(ui.canvas);
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
  if (lv.id === 1)
    tip("build", "Tap a plot beside the lane to build. Hedges slow them down; scarecrows throw turnips.", "wink");
  else if (lv.id === 2)
    tip("hero", "I'm in the lane too. Tap the lane to send me somewhere: I hold two at a time. Drones fly over me.", "determined");
  else if (lv.id === PIE_FIRST_LEVEL)
    tip("pie", "Pies are out of the oven. Tap the pie, then tap where it should land.", "delighted");
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
  const h = g.hero;
  ui.btnHero.setAttribute("aria-pressed", String(!!renderer?.heroSelected));
  ui.btnHero.classList.toggle("down", h.down > 0);
  ui.heroHp.style.setProperty("--hp", String(h.down > 0 ? 0 : h.hp / h.maxHp));
  ui.btnHero.setAttribute(
    "aria-label",
    h.down > 0 ? `Cath is catching her breath, back in ${Math.ceil(h.down)} seconds` : `Cath, ${Math.round(h.hp)} of ${h.maxHp} health. Select to move her.`,
  );
  const more = g.wave < g.level.waves.length;
  const early = canCallEarly(g);
  ui.btnSend.disabled = !(g.phase === "build" && more) && !early;
  ui.btnSend.classList.toggle("early", early);
  ui.btnSend.textContent =
    g.phase === "build" && more
      ? `Send wave ${g.wave + 1}`
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
  if (renderer?.heroSelected) {
    p.append(line("Tap anywhere on the field to send Cath there. In the lane she holds two vehicles at a time; drones and bosses get past her."));
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
  for (const kind of g.level.towers) {
    const spec = TOWERS[kind];
    const cost = towerCost(g, kind);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-build";
    b.dataset.kind = kind;
    b.dataset.cost = String(cost);
    b.disabled = g.marks < cost;
    b.setAttribute("aria-label", `${spec.name}, ${cost} Marks. ${spec.blurb}`);
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
        renderPanel(true);
        if (g.level.id === 1 && g.towers.length === 1)
          tip("send", "Lovely. When you're ready, send the wave. I'll be in the lane.", "delighted");
      }
    };
    row.append(b);
  }
  info.textContent = "Pick something to plant here.";
  p.append(row, info);
}

const TARGET_LABEL: Record<TargetMode, string> = { first: "First", last: "Last", strong: "Strongest", close: "Closest" };

function towerCard(p: HTMLElement, g: Game, t: Tower): void {
  p.classList.add("panel-tower");
  const spec = TOWERS[t.kind];
  const st = towerStats(t);
  const head = document.createElement("div");
  head.className = "tower-head";
  head.append(img(towerIcon(t.kind, t.tier, t.spec ?? null), "tower-icon"));
  const titles = document.createElement("div");
  const name = t.tier === 4 && t.spec != null ? SPECIALISATIONS[t.kind][t.spec].name : spec.name;
  const title = line(name, "panel-title");
  title.setAttribute("aria-label", `${name}, tier ${t.tier} of 4`);
  const pips = document.createElement("span");
  pips.className = "pips";
  pips.setAttribute("aria-hidden", "true");
  pips.textContent = "★".repeat(t.tier) + "☆".repeat(4 - t.tier);
  title.append(" ", pips);
  titles.append(title, line(describeStats(st), "panel-stats"));
  head.append(titles);
  p.append(head);

  if (st.damage > 0) {
    const seg = document.createElement("div");
    seg.className = "segmented";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Target");
    for (const mode of TARGET_MODES) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = TARGET_LABEL[mode];
      b.setAttribute("aria-pressed", String((t.target ?? "first") === mode));
      b.onclick = () => {
        setTarget(g, t.id, mode);
        renderPanel(true);
      };
      seg.append(b);
    }
    p.append(seg);
  }

  const row = document.createElement("div");
  row.className = "panel-row";
  if (t.tier < 3) {
    const cost = upgradeCost(t)!;
    const up = document.createElement("button");
    up.type = "button";
    up.className = "btn";
    up.id = "btn-upgrade";
    up.dataset.cost = String(cost);
    up.textContent = `Upgrade · ${cost}`;
    up.disabled = g.marks < cost;
    up.onclick = () => {
      if (act(() => upgrade(g, t.id))) {
        sfx.playUpgrade();
        renderPanel(true);
      }
    };
    row.append(up);
  } else if (t.tier === 3) {
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
      b.append(img(towerIcon(t.kind, 4, i), "spec-icon"));
      const txt = document.createElement("span");
      txt.className = "spec-text";
      const n = document.createElement("strong");
      n.textContent = `${sp.name} · ${cost}`;
      const d = document.createElement("small");
      d.textContent = sp.blurb;
      txt.append(n, d);
      b.append(txt);
      b.onclick = () => {
        if (act(() => upgrade(g, t.id, i))) {
          sfx.playUpgrade();
          renderPanel(true);
        }
      };
      choices.append(b);
    });
    p.append(choices);
    if (!open) p.append(line(`Specialisations open at level ${SPEC_FIRST_LEVEL}.`, "hint"));
  }
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

function describeStats(st: ReturnType<typeof towerStats>): string {
  const parts: string[] = [];
  if (st.range) parts.push(`range ${st.range}`);
  if (st.damage) parts.push(`${(st.damage / st.cooldown).toFixed(0)} damage a second`);
  if (st.splash) parts.push("splash");
  if (st.slow < 1) parts.push(`slows to ${Math.round(st.slow * 100)}%`);
  if (st.thorns) parts.push(`thorns ${st.thorns}/s`);
  if (st.poison) parts.push("poison");
  if (st.sticky) parts.push("sticky honey");
  if (st.knockback) parts.push("knockback");
  if (st.crit) parts.push(`every ${st.crit.every}rd shot ×${st.crit.mult}`);
  if (st.pierce) parts.push("ignores armour");
  if (st.buff > 1) parts.push(`+${Math.round((st.buff - 1) * 100)}% to neighbours`);
  if (st.aura > 1) parts.push(`+${Math.round((st.aura - 1) * 100)}% to every tower`);
  if (st.income) parts.push(`+${st.income} Marks a wave`);
  if (st.reveal > 1) parts.push(`reveals, +${Math.round((st.reveal - 1) * 100)}% damage taken`);
  if (st.injunction) parts.push(`stops ${st.classAction ? "everything" : "bosses"} for ${st.injunction}s`);
  if (st.mend) parts.push(`+${st.mend} Goodwill a wave`);
  if (st.pieHaste) parts.push("faster pies");
  if (st.cleanse) parts.push("cures charm");
  return parts.join(" · ");
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
  if (selected && selected.col === col && selected.row === row && !towerAt(game, col, row) && !isPlot(game.level, col, row)) {
    // Second tap on the lane: send Cath.
    sendCath(col + 0.5, row + 0.5);
    return;
  }
  selected = { col, row };
  renderer.selected = selected;
  renderer.heroSelected = false;
  renderer.cursor = { col, row };
  renderPanel(true);
  syncControls();
}

function sendCath(x: number, y: number): void {
  if (!game) return;
  if (act(() => moveHero(game!, x, y))) {
    sfx.playMove();
    deselect();
  }
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
    if (g.phase === "won") sfx.playWin();
    else sfx.playLose();
    window.setTimeout(() => finish(g), 700);
  }
}

const FINALE: StoryLine[] = [
  {
    who: "cath",
    expression: "delighted",
    text: "That's the last of them. The hedges are still standing, and so is everyone who planted them.",
  },
  {
    who: "bea",
    text: "Mum, the whole county is on the lane. Somebody brought a trestle table.",
  },
  {
    who: "cath",
    expression: "smirk",
    text: "Then we'd better put the pies out. Nobody owns a hedgerow. You just look after it for the next person.",
  },
  {
    who: "narrator",
    text: "Hedgerow. Every bush, every scarecrow and every pie was made by the people of Marrow. Thank you for holding the lane.",
  },
];

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
      showStory(next ? lv.after : [...lv.after, ...FINALE], lv.place, () => {
        if (next && isUnlocked(data, next.id)) openLevel(next);
        else leaveLevel();
      });
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
  if (renderer.heroSelected) {
    sendCath(w.x, w.y);
    return;
  }
  if (renderer.onHero(e.clientX, e.clientY, game) && game.hero.down === 0) {
    selectHero();
    return;
  }
  const c = renderer.cellAt(e.clientX, e.clientY, game);
  if (!c) {
    deselect();
    return;
  }
  // Tapping the lane sends Cath straight there.
  if (laneCells(game.level.path).has(`${c.col},${c.row}`)) {
    sendCath(w.x, w.y);
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

function selectHero(): void {
  if (!game || !renderer) return;
  if (game.hero.down > 0) {
    say("Cath is catching her breath.");
    return;
  }
  renderer.heroSelected = !renderer.heroSelected;
  renderer.selected = null;
  selected = null;
  aiming = false;
  renderer.aim = null;
  renderPanel(true);
  syncControls();
}

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
    const lane = laneCells(g.level.path).has(`${renderer.cursor.col},${renderer.cursor.row}`);
    const tw = towerAt(g, renderer.cursor.col, renderer.cursor.row);
    say(`Column ${renderer.cursor.col + 1}, row ${renderer.cursor.row + 1}: ${tw ? TOWERS[tw.kind].name : lane ? "lane" : "empty plot"}`);
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (aiming) fire(cur.col + 0.5, cur.row + 0.5);
    else if (renderer.heroSelected) sendCath(cur.col + 0.5, cur.row + 0.5);
    else if (laneCells(g.level.path).has(`${cur.col},${cur.row}`)) sendCath(cur.col + 0.5, cur.row + 0.5);
    else select(cur.col, cur.row);
  } else if (e.key === "Escape") {
    aiming = false;
    renderer.aim = null;
    deselect();
  } else if (e.key === "c" || e.key === "C") {
    selectHero();
  } else if (e.key === "p" || e.key === "P") {
    if (!ui.btnPie.disabled) startAim();
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
ui.btnHero.addEventListener("click", () => {
  sfx.unlock();
  selectHero();
});
ui.btnSpeed.addEventListener("click", () => {
  speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
  syncControls();
});
ui.btnSound.addEventListener("click", () => {
  sfx.setMuted(!sfx.isMuted());
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
