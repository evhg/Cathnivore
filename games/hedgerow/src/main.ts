import "./styles.css";
import "../../../shared/cath/cath.css";
import { cathSvg, type CathExpression } from "../../../shared/cath/cath";
import {
  STEP,
  TOWERS,
  drainEvents,
  isPlot,
  newGame,
  place,
  sell,
  sellValue,
  sendWave,
  throwPie,
  pieUnlocked,
  stars as starsOf,
  stepGame,
  towerAt,
  upgrade,
  upgradeCost,
  type Game,
  type Level,
  type StoryLine,
  type TowerKind,
} from "./engine";
import { LEVELS } from "./levels";
import { Renderer } from "./render";
import * as sfx from "./sound";
import { isUnlocked, load, recordStars, save } from "./store";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

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
  hudGoodwill: $<HTMLElement>("hud-goodwill"),
  hudMarks: $<HTMLElement>("hud-marks"),
  hudWave: $<HTMLElement>("hud-wave"),
  btnLevels: $<HTMLButtonElement>("btn-levels"),
  btnSend: $<HTMLButtonElement>("btn-send"),
  btnPie: $<HTMLButtonElement>("btn-pie"),
  btnSpeed: $<HTMLButtonElement>("btn-speed"),
  btnPause: $<HTMLButtonElement>("btn-pause"),
  btnSound: $<HTMLButtonElement>("btn-sound"),
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
  resultNote: $<HTMLElement>("result-note"),
  resultPrimary: $<HTMLButtonElement>("result-primary"),
  resultSecondary: $<HTMLButtonElement>("result-secondary"),
};

const NAMES: Record<StoryLine["who"], string> = {
  cath: "Cath",
  mara: "Mara",
  bea: "Bea",
  tomas: "Tomas",
  sol: "Sol",
  narrator: "Marrow",
};
const cath = (expression: CathExpression) =>
  cathSvg({ framing: "face", expression, animate: true });

const data = load();
ui.hostFace.innerHTML = cath("smirk");

let game: Game | null = null;
let renderer: Renderer | null = null;
let selected: { col: number; row: number } | null = null;
let fast = false;
let paused = false;
let last = 0;
let acc = 0;
let raf = 0;
let finished = false;
let panelSig = "";

function say(text: string): void {
  ui.announce.textContent = text;
}

// ---- level select ----

// Per-act banner: sky, rolling hills and one motif, all from a palette per act.
const ACT_PALETTES: [string, string, string, string][] = [
  ["#f6d7a7", "#e9a96b", "#7fa35a", "#5c7f43"],
  ["#f3e3b0", "#e2c36e", "#8fae5d", "#6a8c47"],
  ["#cfe6ee", "#9cc7d6", "#6d9f73", "#4f7f5c"],
  ["#d9e7c4", "#b6d08c", "#7ea858", "#5a8540"],
  ["#c8d7c0", "#9fb79a", "#5f8a62", "#44694a"],
  ["#bfe0ea", "#86bfd2", "#c9b98a", "#a59866"],
  ["#d8d2e2", "#b1a6c9", "#7d8f9a", "#5d6d78"],
  ["#f2cfc4", "#e3998a", "#8a9a6a", "#687a4c"],
  ["#d3d9e6", "#a4b0cc", "#77849a", "#56627a"],
  ["#f7dc9a", "#eeb84f", "#b98a4a", "#8a6533"],
];

function actArt(n: number): string {
  const [sky, glow, hill1, hill2] = ACT_PALETTES[(n - 1) % ACT_PALETTES.length]!;
  const sun = 30 + ((n * 37) % 50);
  const posts = Array.from({ length: 4 }, (_, i) => {
    const x = 70 + i * 12 + ((n * 7 + i * 11) % 5);
    return `<rect x="${x}" y="22" width="2" height="8" fill="${hill2}"/><circle cx="${x + 1}" cy="20" r="3.5" fill="${hill2}"/>`;
  }).join("");
  return `<svg class="act-art" viewBox="0 0 120 36" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="120" height="36" fill="${sky}"/><circle cx="${sun}" cy="14" r="8" fill="${glow}" opacity=".85"/><path d="M0 26 Q30 14 60 25 T120 22 V36 H0Z" fill="${hill1}"/><path d="M0 31 Q40 24 80 31 T120 29 V36 H0Z" fill="${hill2}"/>${posts}</svg>`;
}

function renderLevels(): void {
  ui.levels.innerHTML = "";
  let lastPlace = "";
  let current: HTMLElement | null = null;
  for (const lv of LEVELS) {
    if (lv.place !== lastPlace) {
      lastPlace = lv.place;
      const h = document.createElement("li");
      h.className = "act-head";
      h.setAttribute("role", "presentation");
      const n = Math.floor((lv.id - 1) / 10) + 1;
      h.innerHTML = `${actArt(n)}<span class="act-num"></span><span class="act-place"></span>`;
      h.querySelector(".act-num")!.textContent = `Act ${n}`;
      h.querySelector(".act-place")!.textContent = lv.place;
      ui.levels.append(h);
    }
    const unlocked = isUnlocked(data, lv.id);
    const got = data.stars[String(lv.id)] ?? 0;
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "level" + (lv.id % 10 === 0 ? " level-boss" : "");
    b.disabled = !unlocked;
    b.dataset.level = String(lv.id);
    b.innerHTML = `<span class="level-num">${lv.id}</span><span><span class="level-name"></span><span class="level-sub"></span></span><span class="level-stars"></span>`;
    b.querySelector(".level-name")!.textContent = lv.name;
    b.querySelector(".level-sub")!.textContent = unlocked
      ? `${lv.waves.length} waves`
      : "Clear the level before to unlock";
    const st = b.querySelector(".level-stars") as HTMLElement;
    st.textContent = unlocked ? "★".repeat(got) + "☆".repeat(3 - got) : "";
    st.setAttribute("aria-label", `${got} of 3 stars`);
    b.addEventListener("click", () => openLevel(lv));
    li.append(b);
    ui.levels.append(li);
    if (unlocked && got === 0 && !current) current = b;
  }
  current?.scrollIntoView({ block: "center" });
}

// ---- story dialogs ----

function showStory(lines: StoryLine[], place: string, done: () => void): void {
  let i = 0;
  const show = () => {
    const line = lines[i]!;
    ui.storyPlace.textContent = place;
    ui.storyWho.textContent = NAMES[line.who];
    ui.storyText.textContent = line.text;
    ui.storyCath.hidden = line.who === "narrator";
    ui.storyCath.classList.toggle("letter", line.who !== "cath");
    if (line.who === "cath")
      ui.storyCath.innerHTML = cath(line.expression ?? "smirk");
    else
      ui.storyCath.textContent =
        line.who === "narrator" ? "" : NAMES[line.who].charAt(0);
    ui.storyNext.textContent = i === lines.length - 1 ? "Continue" : "Next";
  };
  ui.storyNext.onclick = () => {
    i++;
    if (i >= lines.length) {
      ui.dlgStory.close();
      done();
    } else show();
  };
  show();
  if (!ui.dlgStory.open) ui.dlgStory.showModal();
}

// ---- playing a level ----

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

function startLevel(lv: Level): void {
  game = newGame(lv);
  selected = null;
  finished = false;
  paused = false;
  fast = false;
  panelSig = "";
  ui.select.hidden = true;
  ui.play.hidden = false;
  ui.hudTitle.textContent = `${lv.id}. ${lv.name}`;
  renderer ??= new Renderer(ui.canvas);
  renderer.selected = null;
  renderer.cursor = { col: 0, row: 0 };
  syncControls();
  renderer.resize(game);
  updateHud();
  renderPanel();
  cancelAnimationFrame(raf);
  last = performance.now();
  acc = 0;
  raf = requestAnimationFrame(frame);
}

function leaveLevel(): void {
  cancelAnimationFrame(raf);
  game = null;
  ui.play.hidden = true;
  ui.select.hidden = false;
  renderLevels();
}

function syncControls(): void {
  ui.btnSpeed.textContent = fast ? "x2" : "x1";
  ui.btnSpeed.setAttribute("aria-pressed", String(fast));
  ui.btnSound.textContent = sfx.isMuted() ? "Sound off" : "Sound on";
  ui.btnSound.setAttribute("aria-pressed", String(!sfx.isMuted()));
  ui.btnPause.textContent = paused ? "Resume" : "Pause";
  ui.btnPause.setAttribute("aria-pressed", String(paused));
  if (!game) return;
  ui.btnPie.hidden = !pieUnlocked(game.level);
  ui.btnPie.disabled = game.phase !== "wave" || game.pieCd > 0;
  ui.btnPie.textContent =
    game.pieCd > 0 ? `Pie ${Math.ceil(game.pieCd)}s` : "Cath's pie";
  const more = game.wave < game.level.waves.length;
  ui.btnSend.disabled = game.phase !== "build" || !more;
  ui.btnSend.textContent =
    game.phase === "wave"
      ? `Wave ${game.wave} running`
      : more
        ? `Send wave ${game.wave + 1}`
        : "All waves sent";
}

function updateHud(): void {
  if (!game) return;
  ui.hudGoodwill.textContent = String(game.goodwill);
  ui.hudMarks.textContent = String(game.marks);
  ui.hudWave.textContent = `${game.wave}/${game.level.waves.length}`;
  syncControls();
  renderPanel();
}

function renderPanel(): void {
  if (!game) return;
  const sel = selected;
  const t = sel ? towerAt(game, sel.col, sel.row) : undefined;
  const sig = [sel?.col, sel?.row, t?.id, t?.tier, game.marks, game.phase].join(
    "|",
  );
  if (sig === panelSig) return;
  panelSig = sig;
  const p = ui.panel;
  p.innerHTML = "";
  const line = (text: string, cls = "") => {
    const el = document.createElement("p");
    el.textContent = text;
    if (cls) el.className = cls;
    p.append(el);
  };
  if (!sel) {
    line("Tap a plot beside the lane to build. The farmhouse is at the end.");
    return;
  }
  if (t) {
    const spec = TOWERS[t.kind];
    line(
      `${spec.name} ${"●".repeat(t.tier)}${"○".repeat(3 - t.tier)}`,
      "panel-title",
    );
    (p.lastElementChild as HTMLElement).setAttribute(
      "aria-label",
      `${spec.name}, tier ${t.tier} of 3`,
    );
    const at = (i: number) => {
      const dps = spec.damage[i]! / spec.cooldown[i]!;
      const parts = [`range ${spec.range[i]}`];
      if (spec.damage[i]) parts.push(`${dps.toFixed(1)} dmg/s`);
      if (spec.slow[i]! < 1)
        parts.push(`slows to ${Math.round(spec.slow[i]! * 100)}%`);
      if (spec.buff)
        parts.push(`+${Math.round((spec.buff[i]! - 1) * 100)}% damage nearby`);
      if (spec.income) parts.push(`+${spec.income[i]} Marks a wave`);
      return parts.join(", ");
    };
    line(
      t.tier < 3
        ? `Now: ${at(t.tier - 1)}. Next: ${at(t.tier)}.`
        : `Now: ${at(2)}.`,
      "panel-stats",
    );
    const row = document.createElement("div");
    row.className = "panel-row";
    const cost = upgradeCost(t);
    const up = document.createElement("button");
    up.type = "button";
    up.className = "btn";
    up.id = "btn-upgrade";
    up.textContent = cost === null ? "Fully grown" : `Upgrade (${cost} Marks)`;
    up.disabled = cost === null || game.marks < cost;
    up.onclick = () => {
      if (act(() => upgrade(game!, t.id))) sfx.playUpgrade();
    };
    const sl = document.createElement("button");
    sl.type = "button";
    sl.className = "btn btn-quiet";
    sl.id = "btn-sell";
    sl.textContent = `Sell (+${sellValue(t)})`;
    sl.onclick = () => {
      if (act(() => sell(game!, t.id))) sfx.playSell();
      selected = null;
      if (renderer) renderer.selected = null;
      panelSig = "";
      renderPanel();
    };
    row.append(up, sl);
    p.append(row);
    return;
  }
  if (!isPlot(game.level, sel.col, sel.row)) {
    line("That is the lane. Build on the grass beside it.");
    return;
  }
  const row = document.createElement("div");
  row.className = "panel-row";
  for (const kind of game.level.towers) {
    const spec = TOWERS[kind];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-build";
    b.dataset.kind = kind;
    b.disabled = game.marks < spec.cost;
    b.innerHTML = "<span></span><small></small>";
    b.firstElementChild!.textContent = `${spec.name} (${spec.cost})`;
    b.lastElementChild!.textContent = spec.blurb;
    b.onclick = () => {
      if (act(() => place(game!, kind as TowerKind, sel.col, sel.row)))
        sfx.playBuild();
    };
    row.append(b);
  }
  p.append(row);
}

function act(fn: () => { ok: boolean; reason?: string }): boolean {
  const r = fn();
  if (!r.ok && r.reason) say(r.reason);
  panelSig = "";
  updateHud();
  return r.ok;
}

function select(col: number, row: number): void {
  if (!game || !renderer) return;
  selected = { col, row };
  renderer.selected = selected;
  renderer.cursor = { col, row };
  panelSig = "";
  renderPanel();
}

function frame(now: number): void {
  raf = requestAnimationFrame(frame);
  if (!game || !renderer) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused && !ui.dlgStory.open && !ui.dlgResult.open) {
    acc += dt * (fast ? 2 : 1);
    let stepped = false;
    while (acc >= STEP) {
      acc -= STEP;
      stepGame(game);
      stepped = true;
    }
    if (stepped) {
      const evs = drainEvents(game);
      let shots = 0;
      for (const ev of evs) {
        if (ev.type === "shot") {
          if (shots++ < 2) sfx.playShot(ev.kind);
        } else if (ev.type === "kill") sfx.playKill();
        else if (ev.type === "leak") sfx.playLeak();
        else if (ev.type === "wave") sfx.playWave();
        else if (ev.type === "pie") sfx.playPie();
      }
      renderer.feed(evs);
      updateHud();
    }
  }
  renderer.draw(game, dt);
  if (!finished && (game.phase === "won" || game.phase === "lost")) {
    finished = true;
    if (game.phase === "won") sfx.playWin();
    else sfx.playLose();
    finish(game);
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
  const lv = g.level;
  const won = g.phase === "won";
  const n = starsOf(g);
  const idx = LEVELS.findIndex((l) => l.id === lv.id);
  const next = LEVELS[idx + 1];
  ui.resultCath.innerHTML = cath(won ? "delighted" : "worried");
  ui.resultEyebrow.textContent = `${lv.place}: ${lv.name}`;
  ui.resultTitle.textContent = won ? "The lane holds." : "They got through.";
  ui.resultStars.textContent = won ? "★".repeat(n) + "☆".repeat(3 - n) : "";
  ui.resultStars.setAttribute("aria-label", won ? `${n} of 3 stars` : "");
  ui.resultNote.textContent = won
    ? `${lv.reward}`
    : "Regroup, rebuild and try again. Hedges slow them; scarecrows finish the job.";
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
  ui.dlgResult.showModal();
}

// ---- input ----

ui.canvas.addEventListener("click", (e) => {
  if (!game || !renderer) return;
  const c = renderer.cellAt(e.clientX, e.clientY, game);
  if (c) select(c.col, c.row);
});
ui.canvas.addEventListener("keydown", (e) => {
  if (!game || !renderer) return;
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
      col: Math.min(game.level.cols - 1, Math.max(0, cur.col + m[0])),
      row: Math.min(game.level.rows - 1, Math.max(0, cur.row + m[1])),
    };
    say(`Column ${renderer.cursor.col + 1}, row ${renderer.cursor.row + 1}`);
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    select(cur.col, cur.row);
  } else if (e.key === "Escape") {
    selected = null;
    renderer.selected = null;
    panelSig = "";
    renderPanel();
  }
});
ui.btnSend.addEventListener("click", () => {
  if (!game) return;
  act(() => sendWave(game!));
});
ui.btnPie.addEventListener("click", () => {
  if (!game) return;
  act(() => throwPie(game!));
});
ui.btnSpeed.addEventListener("click", () => {
  fast = !fast;
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

renderLevels();
