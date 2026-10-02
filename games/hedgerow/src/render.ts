// Canvas 2D renderer for Hedgerow. It only reads the Game; it never changes it. The painted battlefield
// (theme.ts) is cached in an offscreen canvas; every frame draws the sprites (sprites.ts) in depth order,
// then projectiles, particles, floating numbers and the overlays (cloud shadows, flashes, screen shake).
// Projectiles and particles are fed from the engine's event list: the engine is hitscan, so the flight
// times here are short and only for show.

import {
  ENEMIES,
  charmed,
  isBig,
  isRevealed,
  pointAt,
  towerAt,
  towerStats,
  type Game,
  type GameEvent,
  type TowerKind,
} from "./engine";
import { cathSvg } from "../../../shared/cath/cath";
import { paintBackground, rng, themeFor } from "./theme";
import {
  INK,
  drawEnemy,
  drawFarmhouse,
  drawHero,
  drawTower,
  enemyLift,
  enemyScale,
  star,
} from "./sprites";

interface Shot {
  kind: TowerKind;
  spec: 0 | 1 | null;
  x: number;
  y: number;
  toX: number;
  toY: number;
  age: number;
  life: number;
  crit: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  age: number;
  life: number;
  size: number;
  color: string;
  shape: "dot" | "square" | "star" | "ring" | "leaf" | "text" | "bee";
  rot: number;
  vr: number;
  text?: string;
  /** Text size multiplier. */
  big?: number;
}

interface Decal {
  x: number;
  y: number;
  r: number;
  color: string;
  age: number;
  life: number;
}

interface PieFlight {
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  landed: boolean;
}

export interface View {
  cellSize: number;
  offX: number;
  offY: number;
}

const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = "";
  private shots: Shot[] = [];
  private parts: Particle[] = [];
  private decals: Decal[] = [];
  private pies: PieFlight[] = [];
  private fired = new Map<number, number>();
  private hitAt = new Map<number, number>();
  private facing = new Map<number, 1 | -1>();
  private lastX = new Map<number, number>();
  private heroSwung = 9;
  private heroThrew = 9;
  private shake = 0;
  private flash = 0;
  private flashColor = "255,60,40";
  private clock = 0;
  private rand = rng(99);
  private face: HTMLImageElement | null = null;
  private faceWorried: HTMLImageElement | null = null;
  view: View = { cellSize: 40, offX: 0, offY: 0 };
  selected: { col: number; row: number } | null = null;
  cursor: { col: number; row: number } | null = null;
  /** Cath is selected: the next tap moves her. */
  heroSelected = false;
  /** Pie aiming: a splash preview under the pointer. */
  aim: { x: number; y: number; r: number } | null = null;
  /** The tower being considered for the selected plot: its range is previewed. */
  preview: TowerKind | null = null;
  reducedMotion = false;
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.face = svgImage(cathSvg({ framing: "face", expression: "determined" }));
    this.faceWorried = svgImage(cathSvg({ framing: "face", expression: "worried" }));
    try {
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no matchMedia */
    }
  }

  resize(game: Game): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    // Leave a margin so the scenery frames the field and tall sprites don't clip at the top.
    const cell = Math.floor(
      Math.min(rect.width / (game.level.cols + 0.3), rect.height / (game.level.rows + 0.6)),
    );
    this.view = {
      cellSize: cell,
      offX: Math.floor((rect.width - cell * game.level.cols) / 2),
      offY: Math.floor((rect.height - cell * game.level.rows) / 2 + cell * 0.15),
    };
    this.bgKey = "";
  }

  /** Clears effects when a level starts. */
  reset(): void {
    this.shots = [];
    this.parts = [];
    this.decals = [];
    this.pies = [];
    this.fired.clear();
    this.hitAt.clear();
    this.facing.clear();
    this.lastX.clear();
    this.shake = 0;
    this.flash = 0;
  }

  /** The point under the pointer, in cell units. */
  worldAt(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.view.offX) / this.view.cellSize,
      y: (clientY - rect.top - this.view.offY) / this.view.cellSize,
    };
  }

  cellAt(clientX: number, clientY: number, game: Game): { col: number; row: number } | null {
    const p = this.worldAt(clientX, clientY);
    const col = Math.floor(p.x);
    const row = Math.floor(p.y);
    if (col < 0 || row < 0 || col >= game.level.cols || row >= game.level.rows) return null;
    return { col, row };
  }

  /** Is (clientX, clientY) on Cath? */
  onHero(clientX: number, clientY: number, game: Game): boolean {
    const p = this.worldAt(clientX, clientY);
    const h = game.hero;
    return Math.abs(p.x - h.x) < 0.35 && p.y > h.y - 0.75 && p.y < h.y + 0.25;
  }

  feed(events: GameEvent[], game: Game): void {
    for (const e of events) {
      switch (e.type) {
        case "shot": {
          this.fired.set(e.tower, 0);
          this.hitAt.set(e.enemy, 0);
          const life =
            e.kind === "silo" ? 0.12 : e.kind === "beehive" ? 0.35 : e.kind === "scarecrow" && e.spec === 0 ? 0.32 : 0.22;
          this.shots.push({
            kind: e.kind,
            spec: e.spec ?? null,
            x: e.fromX,
            y: e.fromY - 0.35,
            toX: e.toX,
            toY: e.toY - 0.1,
            age: 0,
            life,
            crit: !!e.crit,
          });
          break;
        }
        case "kill":
          this.burst(e.x, e.y, isBig(e.kind) ? 2.5 : 1);
          this.float(e.x, e.y - 0.3, `+${e.bounty}`, "#ffe27a", isBig(e.kind) ? 1.6 : 1);
          if (isBig(e.kind)) {
            this.kick(0.5);
            this.flashOnce("255,240,200", 0.5);
            this.confetti(e.x, e.y);
          }
          break;
        case "split":
          this.ring(e.x, e.y, "#ffffff", 0.9);
          break;
        case "leak":
          this.kick(0.3);
          this.flashOnce("220,40,30", 0.35);
          this.float(e.x, e.y - 0.4, `-${e.lost ?? 1} Goodwill`, "#ff8f80", 1.1);
          break;
        case "pie": {
          const h = game.hero;
          this.heroThrew = 0;
          if (e.x !== undefined && e.y !== undefined)
            this.pies.push({
              fromX: h.x,
              fromY: h.y - 0.6,
              x: e.x,
              y: e.y,
              r: e.radius ?? 1.7,
              age: 0,
              life: 0.35,
              landed: false,
            });
          break;
        }
        case "swing":
          this.heroSwung = 0;
          this.impact(e.x, e.y - 0.15);
          break;
        case "heroDown":
          this.kick(0.25);
          this.float(game.hero.x, game.hero.y - 1, "Cath's winded!", "#ffd0c4", 1);
          break;
        case "heroUp":
          this.float(game.hero.x, game.hero.y - 1, "Back on her feet", "#e8ffd0", 0.9);
          this.ring(game.hero.x, game.hero.y - 0.3, "#f2c94c", 0.8);
          break;
        case "injunction":
          this.float(e.x, e.y - 0.9, "INJUNCTION!", "#fff6d6", 1.1);
          for (let i = 0; i < 6; i++)
            this.parts.push(this.particle(e.x, e.y - 0.6, "#fffdf6", "square", 0.12, 0.9));
          break;
        case "cleared": {
          const end = game.level.path[game.level.path.length - 1]!;
          this.float(end[0] + 0.5, end[1] - 0.2, `Wave cleared +${e.reward}`, "#ffe27a", 1.05);
          for (let i = 0; i < 14; i++) this.parts.push(this.particle(end[0] + 0.5, end[1] + 0.2, "#f2c94c", "star", 0.08, 1));
          break;
        }
        case "wave":
          if (e.early) {
            const h = game.hero;
            this.float(h.x, h.y - 1.1, `Early! +${e.early}`, "#ffe27a", 1.1);
          }
          break;
      }
    }
  }

  private particle(x: number, y: number, color: string, shape: Particle["shape"], size: number, life: number): Particle {
    const a = this.rand() * Math.PI * 2;
    const v = 0.6 + this.rand() * 1.8;
    return {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 1.6,
      g: 5,
      age: 0,
      life: life * (0.7 + this.rand() * 0.6),
      size: size * (0.7 + this.rand() * 0.6),
      color,
      shape,
      rot: this.rand() * 6,
      vr: (this.rand() - 0.5) * 12,
    };
  }

  private burst(x: number, y: number, scale: number): void {
    const n = Math.round(9 * scale);
    for (let i = 0; i < n; i++) this.parts.push(this.particle(x, y, i % 3 ? "#c79a62" : "#f4f6f8", "square", 0.09 * scale, 0.8));
    for (let i = 0; i < 4 * scale; i++) this.parts.push(this.particle(x, y, "#ffe27a", "star", 0.07, 0.6));
    const p = this.particle(x, y, "rgba(255,255,255,0.8)", "ring", 0.6 * scale, 0.35);
    p.vx = p.vy = p.g = 0;
    this.parts.push(p);
    this.decals.push({ x, y: y + 0.1, r: 0.22 * scale, color: "rgba(60,45,30,0.25)", age: 0, life: 6 });
  }

  private confetti(x: number, y: number): void {
    const cols = ["#c4433a", "#f2c94c", "#3f6fb5", "#5f8f3f", "#e8748b"];
    for (let i = 0; i < 40; i++) {
      const p = this.particle(x, y, cols[i % cols.length]!, "square", 0.08, 1.6);
      p.vy -= 2;
      p.g = 3;
      this.parts.push(p);
    }
  }

  private ring(x: number, y: number, color: string, size: number): void {
    const p = this.particle(x, y, color, "ring", size, 0.4);
    p.vx = p.vy = p.g = 0;
    this.parts.push(p);
  }

  private impact(x: number, y: number): void {
    const p = this.particle(x, y, "#fff6d6", "star", 0.16, 0.25);
    p.vx = p.vy = p.g = 0;
    this.parts.push(p);
    for (let i = 0; i < 3; i++) this.parts.push(this.particle(x, y, "#e8ddc8", "dot", 0.05, 0.4));
  }

  private float(x: number, y: number, text: string, color: string, big = 1): void {
    this.parts.push({ x, y, vx: 0, vy: -0.9, g: 0, age: 0, life: 1.1, size: 0.3, color, shape: "text", rot: 0, vr: 0, text, big });
  }

  private kick(amount: number): void {
    if (!this.reducedMotion) this.shake = Math.max(this.shake, amount);
  }

  private flashOnce(rgb: string, amount: number): void {
    this.flashColor = rgb;
    this.flash = Math.max(this.flash, amount);
  }

  draw(game: Game, dt: number): void {
    const { ctx } = this;
    const { cellSize: s, offX, offY } = this.view;
    this.clock += dt;
    const t = this.clock;
    const level = game.level;
    const W = this.cssW;
    const H = this.cssH;
    const X = (v: number) => offX + v * s;
    const Y = (v: number) => offY + v * s;

    // The painted field, cached.
    const key = `${level.id}:${W}x${H}:${s}:${this.dpr}`;
    if (key !== this.bgKey) {
      this.bg = document.createElement("canvas");
      this.bg.width = this.canvas.width;
      this.bg.height = this.canvas.height;
      const bctx = this.bg.getContext("2d")!;
      bctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      paintBackground(bctx, level, { width: W, height: H, cell: s, offX, offY });
      this.bgKey = key;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    if (this.shake > 0) {
      const m = this.shake * s * 0.12;
      ctx.translate((this.rand() - 0.5) * m, (this.rand() - 0.5) * m);
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
    if (this.bg) ctx.drawImage(this.bg, 0, 0, W, H);

    // Decals: crumbs, cream, scorch.
    for (const d of this.decals) {
      d.age += dt;
      ctx.globalAlpha = Math.max(0, 1 - d.age / d.life);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(X(d.x), Y(d.y), d.r * s, d.r * s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.decals = this.decals.filter((d) => d.age < d.life);

    this.drawSelection(game, X, Y, s, t);

    // Sprites in depth order.
    const items: Array<{ y: number; draw: () => void }> = [];
    const end = level.path[level.path.length - 1]!;
    items.push({
      y: end[1] + 0.84,
      draw: () => drawFarmhouse(ctx, X(end[0] + 0.5), Y(end[1] + 0.5), s, t, game.goodwill / game.maxGoodwill),
    });
    for (const tw of game.towers) {
      const since = this.fired.get(tw.id) ?? 9;
      this.fired.set(tw.id, since + dt);
      items.push({
        y: tw.row + 0.8,
        draw: () =>
          drawTower(
            ctx,
            {
              kind: tw.kind,
              tier: tw.tier,
              spec: tw.spec ?? null,
              fired: since,
              dazed: game.phase === "wave" && towerStats(tw).damage > 0 && charmed(game, tw),
            },
            X(tw.col + 0.5),
            Y(tw.row + 0.5),
            s,
            t + tw.id * 0.37,
          ),
      });
    }
    const alive = new Set<number>();
    for (const e of game.enemies) {
      alive.add(e.id);
      const p = pointAt(level.path, e.dist);
      const lx = this.lastX.get(e.id);
      if (lx !== undefined && Math.abs(p.x - lx) > 0.0005) this.facing.set(e.id, p.x > lx ? 1 : -1);
      this.lastX.set(e.id, p.x);
      const since = this.hitAt.get(e.id) ?? 9;
      this.hitAt.set(e.id, since + dt);
      const gy = p.y + 0.2;
      items.push({
        y: gy,
        draw: () => {
          drawEnemy(
            ctx,
            {
              kind: e.kind,
              facing: this.facing.get(e.id) ?? 1,
              hit: since,
              ghost: !isRevealed(game, e),
              phase: (e.id % 7) * 0.31,
            },
            X(p.x),
            Y(gy),
            s,
            e.stun > 0 || e.held ? t * 0.15 : t,
          );
          this.drawStatus(e, X(p.x), Y(gy), s, t);
        },
      });
    }
    for (const id of [...this.facing.keys()]) if (!alive.has(id)) {
      this.facing.delete(id);
      this.lastX.delete(id);
      this.hitAt.delete(id);
    }
    const h = game.hero;
    this.heroSwung += dt;
    this.heroThrew += dt;
    const walking = Math.hypot(h.tx - h.x, h.ty - h.y) > 0.03 && h.down === 0;
    items.push({
      y: h.y + 0.22,
      draw: () => {
        drawHero(
          ctx,
          {
            facing: h.facing,
            walking,
            swung: this.heroSwung,
            down: h.down > 0,
            threw: this.heroThrew,
            selected: this.heroSelected,
          },
          X(h.x),
          Y(h.y + 0.22),
          s,
          t,
          h.down > 0 ? this.faceWorried : this.face,
        );
      },
    });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // Cath's health and where she's heading.
    if (walking) this.flag(X(h.tx), Y(h.ty + 0.2), s, t);
    this.heroBar(game, X(h.x), Y(h.y + 0.22) - s * 0.98, s);

    // Health bars over sprites.
    for (const e of game.enemies) {
      const max = ENEMIES[e.kind].hp;
      if (e.hp >= max || !isRevealed(game, e)) continue;
      const p = pointAt(level.path, e.dist);
      const k = enemyScale(e.kind);
      const top = Y(p.y + 0.2) - s * (0.5 * k + enemyLift(e.kind) + 0.12);
      bar(ctx, X(p.x), top, s * 0.5 * Math.min(1.6, k), Math.max(3, s * 0.06), e.hp / max);
    }

    this.drawShots(dt, X, Y, s);
    this.drawPies(dt, X, Y, s);
    this.drawParticles(dt, X, Y, s);

    // Pie aim preview.
    if (this.aim) {
      const { x, y, r } = this.aim;
      ctx.fillStyle = "rgba(255,246,214,0.22)";
      ctx.strokeStyle = "rgba(255,246,214,0.95)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), r * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    this.ambient(W, H, s, t);

    // Boss bar.
    const boss = game.enemies.filter((e) => isBig(e.kind)).sort((a, b) => b.dist - a.dist)[0];
    if (boss) {
      const bw = Math.min(W - 32, s * level.cols * 0.9);
      const bx = W / 2;
      const by = Math.max(14, offY - s * 0.05);
      ctx.font = `700 ${Math.max(12, Math.round(s * 0.2))}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.fillStyle = "#fff";
      ctx.strokeText(ENEMIES[boss.kind].name, bx, by + s * 0.02);
      ctx.fillText(ENEMIES[boss.kind].name, bx, by + s * 0.02);
      bar(ctx, bx, by + s * 0.12, bw, Math.max(6, s * 0.1), boss.hp / ENEMIES[boss.kind].hp, true);
    }

    // Flash (leaks, boss kills).
    if (this.flash > 0) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      vg.addColorStop(0, `rgba(${this.flashColor},0)`);
      vg.addColorStop(1, `rgba(${this.flashColor},${Math.min(0.55, this.flash)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      this.flash = Math.max(0, this.flash - dt * 1.4);
    }
    ctx.restore();
  }

  private drawSelection(game: Game, X: (v: number) => number, Y: (v: number) => number, s: number, t: number): void {
    const { ctx } = this;
    const rangeRing = (cx: number, cy: number, r: number, tint: string) => {
      ctx.fillStyle = tint;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -t * 12;
      ctx.beginPath();
      ctx.arc(cx, cy, r * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (this.selected) {
      const { col, row } = this.selected;
      const tw = towerAt(game, col, row);
      if (tw) {
        const st = towerStats(tw);
        if (st.range > 0) rangeRing(X(col + 0.5), Y(row + 0.5), st.range, st.slow < 1 ? "rgba(140,220,120,0.16)" : "rgba(255,255,255,0.14)");
      } else if (this.preview) {
        const st = towerStats({ kind: this.preview, tier: 1, spec: null });
        if (st.range > 0) rangeRing(X(col + 0.5), Y(row + 0.5), st.range, "rgba(255,240,180,0.18)");
      }
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      const pad = s * 0.08;
      const pulse = (Math.sin(t * 5) + 1) * s * 0.015;
      ctx.beginPath();
      ctx.roundRect(X(col) + pad - pulse, Y(row) + pad - pulse, s - pad * 2 + pulse * 2, s - pad * 2 + pulse * 2, s * 0.14);
      ctx.stroke();
    }
    if (this.cursor && !this.selected) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      const pad = s * 0.08;
      ctx.beginPath();
      ctx.roundRect(X(this.cursor.col) + pad, Y(this.cursor.row) + pad, s - pad * 2, s - pad * 2, s * 0.14);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawStatus(e: Game["enemies"][number], x: number, y: number, s: number, t: number): void {
    const { ctx } = this;
    const k = enemyScale(e.kind);
    const top = y - s * (0.45 * k + enemyLift(e.kind));
    if (e.stun > 0) {
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = "#fff6b0";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        star(ctx, x + Math.cos(a) * s * 0.2, top + Math.sin(a) * s * 0.05, s * 0.05);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (e.slowed && e.stun <= 0) {
      ctx.strokeStyle = "rgba(90,150,60,0.9)";
      ctx.lineWidth = Math.max(1.5, s * 0.03);
      for (let i = 0; i < 3; i++) {
        const lx = x - s * 0.22 + i * s * 0.22;
        ctx.beginPath();
        ctx.moveTo(lx, y);
        ctx.quadraticCurveTo(lx + s * 0.04, y - s * 0.1, lx + s * 0.02, y - s * 0.16);
        ctx.stroke();
      }
    }
    if (e.stickyLeft && e.stickyLeft > 0) {
      ctx.fillStyle = "rgba(240,180,41,0.85)";
      for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * s * 0.15;
        const ph = (t * 1.2 + i * 0.33) % 1;
        ctx.beginPath();
        ctx.ellipse(x + dx, y - s * 0.1 + ph * s * 0.1, s * 0.025, s * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (e.poisonLeft && e.poisonLeft > 0) {
      ctx.fillStyle = "rgba(150,90,200,0.7)";
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i / 3) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.arc(x + (i - 1) * s * 0.12, top + s * 0.1 - ph * s * 0.3, s * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (e.held) {
      ctx.fillStyle = "rgba(230,220,200,0.6)";
      for (let i = 0; i < 2; i++) {
        const ph = (t * 2 + i * 0.5) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.arc(x + (i ? 1 : -1) * s * (0.2 + ph * 0.15), y - s * 0.03, s * (0.04 + ph * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  private flag(x: number, y: number, s: number, t: number): void {
    const { ctx } = this;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - s * 0.4);
    ctx.stroke();
    ctx.fillStyle = "#6E7C4B";
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.4);
    ctx.lineTo(x + s * 0.2, y - s * 0.34 + Math.sin(t * 6) * s * 0.02);
    ctx.lineTo(x, y - s * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private heroBar(game: Game, x: number, y: number, s: number): void {
    const h = game.hero;
    const { ctx } = this;
    if (h.down > 0) {
      // A ring that fills as she recovers.
      const frac = 1 - h.down / 9;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = Math.max(3, s * 0.06);
      ctx.beginPath();
      ctx.arc(x, y + s * 0.05, s * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#f2c94c";
      ctx.beginPath();
      ctx.arc(x, y + s * 0.05, s * 0.12, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (h.hp < h.maxHp) bar(ctx, x, y, s * 0.46, Math.max(3, s * 0.06), h.hp / h.maxHp, false, "#7fc46a");
  }

  private drawShots(dt: number, X: (v: number) => number, Y: (v: number) => number, s: number): void {
    const { ctx } = this;
    for (const sh of this.shots) {
      sh.age += dt;
      const k = Math.min(1, sh.age / sh.life);
      const x = sh.x + (sh.toX - sh.x) * k;
      const arc = sh.kind === "silo" ? 0 : Math.sin(k * Math.PI) * 0.45;
      const y = sh.y + (sh.toY - sh.y) * k - arc;
      ctx.lineWidth = Math.max(1.4, s * 0.025);
      ctx.strokeStyle = INK;
      switch (sh.kind) {
        case "scarecrow": {
          if (sh.spec === 1) {
            // A crow, wings beating.
            const flap = Math.sin(sh.age * 40) * s * 0.06;
            ctx.fillStyle = "#1d1b22";
            ctx.beginPath();
            ctx.ellipse(X(x), Y(y), s * 0.07, s * 0.04, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(X(x) - s * 0.1, Y(y) - flap);
            ctx.lineTo(X(x), Y(y));
            ctx.lineTo(X(x) + s * 0.1, Y(y) - flap);
            ctx.stroke();
          } else {
            const big = sh.spec === 0 ? 1.7 : 1;
            ctx.save();
            ctx.translate(X(x), Y(y));
            ctx.rotate(sh.age * 14);
            ctx.fillStyle = sh.spec === 0 ? "#e98a2b" : "#efe2f0";
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.08 * big, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (sh.spec !== 0) {
              ctx.fillStyle = "#8e4a93";
              ctx.beginPath();
              ctx.arc(0, s * 0.03, s * 0.05, 0, Math.PI);
              ctx.fill();
            }
            ctx.fillStyle = "#5f8f3f";
            ctx.beginPath();
            ctx.ellipse(0, -s * 0.09 * big, s * 0.03, s * 0.05, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          break;
        }
        case "beehive":
          for (let i = 0; i < 5; i++) {
            const bx = x + Math.sin(sh.age * 25 + i * 1.7) * 0.14;
            const by = y + Math.cos(sh.age * 21 + i * 2.1) * 0.14;
            ctx.fillStyle = sh.spec === 0 ? "#d9433a" : "#f2c94c";
            ctx.beginPath();
            ctx.ellipse(X(bx), Y(by), s * 0.035, s * 0.025, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          break;
        case "pond":
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = sh.spec === 0 ? "#f4f1ea" : "#a9d4e6";
            ctx.beginPath();
            ctx.arc(X(x + (i - 1) * 0.08), Y(y + Math.sin(i) * 0.05), s * 0.04, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case "barn":
          ctx.fillStyle = "#e2c06a";
          ctx.save();
          ctx.translate(X(x), Y(y));
          ctx.rotate(sh.age * 10);
          ctx.fillRect(-s * 0.07, -s * 0.05, s * 0.14, s * 0.1);
          ctx.strokeRect(-s * 0.07, -s * 0.05, s * 0.14, s * 0.1);
          ctx.restore();
          break;
        case "silo": {
          ctx.strokeStyle = `rgba(242,201,76,${1 - k})`;
          ctx.lineWidth = Math.max(3, s * (sh.spec === 0 ? 0.12 : 0.08));
          ctx.beginPath();
          ctx.moveTo(X(sh.x), Y(sh.y));
          ctx.lineTo(X(sh.toX), Y(sh.toY));
          ctx.stroke();
          break;
        }
        default:
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(X(x), Y(y), s * 0.05, 0, Math.PI * 2);
          ctx.fill();
      }
      if (sh.age >= sh.life) {
        // Landing.
        const color = sh.kind === "scarecrow" ? (sh.spec === 0 ? "#e98a2b" : "#efe2f0") : sh.kind === "silo" ? "#f2c94c" : sh.kind === "pond" ? "#a9d4e6" : sh.kind === "barn" ? "#e2c06a" : "#f2c94c";
        const n = sh.spec === 0 && (sh.kind === "scarecrow" || sh.kind === "silo") ? 8 : 3;
        for (let i = 0; i < n; i++) this.parts.push(this.particle(sh.toX, sh.toY, color, "dot", 0.05, 0.4));
        if (sh.kind === "scarecrow" && sh.spec === 0) this.ring(sh.toX, sh.toY, "#e98a2b", 0.95);
        if (sh.kind === "silo" && sh.spec === 1) this.ring(sh.toX, sh.toY, "#f2c94c", 1.1);
        if (sh.crit) {
          this.float(sh.toX, sh.toY - 0.4, sh.kind === "scarecrow" ? "CAW!" : "CRIT!", "#ffffff", 1.3);
          this.kick(0.08);
        }
      }
    }
    this.shots = this.shots.filter((sh) => sh.age < sh.life);
  }

  private drawPies(dt: number, X: (v: number) => number, Y: (v: number) => number, s: number): void {
    const { ctx } = this;
    for (const p of this.pies) {
      p.age += dt;
      const k = Math.min(1, p.age / p.life);
      if (k < 1) {
        const x = p.fromX + (p.x - p.fromX) * k;
        const y = p.fromY + (p.y - p.fromY) * k - Math.sin(k * Math.PI) * 1.2;
        ctx.save();
        ctx.translate(X(x), Y(y));
        ctx.rotate(p.age * 12);
        ctx.fillStyle = "#e0b26a";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.18, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff6e0";
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.03, s * 0.13, s * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (!p.landed) {
        p.landed = true;
        this.kick(0.35);
        this.flashOnce("255,246,214", 0.3);
        this.decals.push({ x: p.x, y: p.y, r: p.r * 0.6, color: "rgba(255,248,230,0.75)", age: 0, life: 5 });
        for (let i = 0; i < 26; i++) {
          const q = this.particle(p.x, p.y, i % 4 ? "#fff6e0" : "#c4433a", "dot", 0.09, 0.9);
          q.vx *= 1.6;
          this.parts.push(q);
        }
        this.ring(p.x, p.y, "#fff6e0", p.r);
        this.float(p.x, p.y - 0.5, "SPLAT!", "#fff6e0", 1.5);
      }
    }
    this.pies = this.pies.filter((p) => !p.landed);
  }

  private drawParticles(dt: number, X: (v: number) => number, Y: (v: number) => number, s: number): void {
    const { ctx } = this;
    for (const p of this.parts) {
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const k = Math.min(1, p.age / p.life);
      ctx.globalAlpha = p.shape === "text" ? Math.min(1, 2.2 * (1 - k)) : 1 - k;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.shape) {
        case "dot":
          ctx.beginPath();
          ctx.arc(X(p.x), Y(p.y), p.size * s, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "square":
          ctx.save();
          ctx.translate(X(p.x), Y(p.y));
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size * s * 0.5, -p.size * s * 0.5, p.size * s, p.size * s);
          ctx.strokeStyle = "rgba(43,35,32,0.6)";
          ctx.lineWidth = 1;
          ctx.strokeRect(-p.size * s * 0.5, -p.size * s * 0.5, p.size * s, p.size * s);
          ctx.restore();
          break;
        case "star":
          ctx.beginPath();
          star(ctx, X(p.x), Y(p.y), p.size * s);
          ctx.fill();
          break;
        case "ring":
          ctx.lineWidth = Math.max(2, s * 0.05 * (1 - k));
          ctx.beginPath();
          ctx.arc(X(p.x), Y(p.y), p.size * s * (0.3 + k * 0.7), 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "text": {
          const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.3);
          const size = Math.max(11, Math.round(s * 0.26 * (p.big ?? 1) * pop));
          ctx.font = `800 ${size}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = Math.max(3, size * 0.22);
          ctx.strokeStyle = "rgba(43,35,32,0.85)";
          ctx.lineJoin = "round";
          ctx.strokeText(p.text!, X(p.x), Y(p.y));
          ctx.fillText(p.text!, X(p.x), Y(p.y));
          break;
        }
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.age < p.life);
  }

  private ambient(W: number, H: number, s: number, t: number): void {
    if (this.reducedMotion) return;
    const { ctx } = this;
    // Cloud shadows drifting over the field.
    for (let i = 0; i < 3; i++) {
      const x = ((t * (8 + i * 3) + i * 400) % (W + 600)) - 300;
      const y = (H * (0.2 + i * 0.3)) % H;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2.4);
      g.addColorStop(0, "rgba(20,30,40,0.10)");
      g.addColorStop(1, "rgba(20,30,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, s * 2.6, s * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Butterflies.
    for (let i = 0; i < 3; i++) {
      const x = W * (0.5 + 0.45 * Math.sin(t * 0.13 + i * 2.1));
      const y = H * (0.5 + 0.4 * Math.sin(t * 0.17 + i * 1.3));
      const flap = Math.abs(Math.sin(t * 14 + i)) * s * 0.06 + s * 0.01;
      ctx.fillStyle = ["#f6f1e4", "#f2c94c", "#e8748b"][i]!;
      ctx.beginPath();
      ctx.ellipse(x - flap * 0.6, y, flap, s * 0.04, -0.4, 0, Math.PI * 2);
      ctx.ellipse(x + flap * 0.6, y, flap, s * 0.04, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function bar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  boss = false,
  color?: string,
): void {
  const f = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = "rgba(20,15,12,0.7)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 - 1, y - 1, w + 2, h + 2, h);
  ctx.fill();
  ctx.fillStyle = color ?? (boss ? "#d93a2f" : f > 0.6 ? "#7fc46a" : f > 0.3 ? "#f2c94c" : "#e5533d");
  if (f > 0) {
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y, w * f, h, h);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(cx - w / 2 + 2, y + 1, Math.max(0, w * f - 4), Math.max(1, h * 0.3));
}

function svgImage(svg: string): HTMLImageElement {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img;
}

// Keep theme exports reachable for the level-select art.
export { themeFor };
