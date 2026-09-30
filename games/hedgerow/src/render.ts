// Canvas 2D renderer for Hedgerow. It only reads the Game; it never changes it. Enemies and towers differ
// by shape as well as colour (STYLE.md 2: the greyscale test). Effects (flying turnips, floating Marks) live
// here and are fed from the engine's event list.

import {
  ENEMIES,
  TOWERS,
  isRevealed,
  laneCells,
  pointAt,
  towerAt,
  type Game,
  type EnemyKind,
  type GameEvent,
  type TowerKind,
} from "./engine";

interface Fx {
  kind: "turnip" | "float" | "puff" | "swarm" | "pie";
  x: number;
  y: number;
  toX: number;
  toY: number;
  age: number;
  life: number;
  text?: string;
}

export interface View {
  cellSize: number;
  offX: number;
  offY: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private fx: Fx[] = [];
  view: View = { cellSize: 40, offX: 0, offY: 0 };
  selected: { col: number; row: number } | null = null;
  cursor: { col: number; row: number } | null = null;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize(game: Game): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    const cell = Math.floor(
      Math.min(rect.width / game.level.cols, rect.height / game.level.rows),
    );
    this.view = {
      cellSize: cell,
      offX: Math.floor((rect.width - cell * game.level.cols) / 2),
      offY: Math.floor((rect.height - cell * game.level.rows) / 2),
    };
  }

  cellAt(
    clientX: number,
    clientY: number,
    game: Game,
  ): { col: number; row: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const col = Math.floor(
      (clientX - rect.left - this.view.offX) / this.view.cellSize,
    );
    const row = Math.floor(
      (clientY - rect.top - this.view.offY) / this.view.cellSize,
    );
    if (col < 0 || row < 0 || col >= game.level.cols || row >= game.level.rows)
      return null;
    return { col, row };
  }

  feed(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type === "shot")
        this.fx.push({
          kind: e.kind === "beehive" ? "swarm" : "turnip",
          x: e.fromX,
          y: e.fromY,
          toX: e.toX,
          toY: e.toY,
          age: 0,
          life: 0.18,
        });
      else if (e.type === "pie")
        this.fx.push({
          kind: "pie",
          x: 0,
          y: 0,
          toX: 0,
          toY: 0,
          age: 0,
          life: 0.7,
        });
      else if (e.type === "kill") {
        this.fx.push({
          kind: "float",
          x: e.x,
          y: e.y,
          toX: e.x,
          toY: e.y - 0.8,
          age: 0,
          life: 0.9,
          text: `+${e.bounty}`,
        });
        this.fx.push({
          kind: "puff",
          x: e.x,
          y: e.y,
          toX: e.x,
          toY: e.y,
          age: 0,
          life: 0.35,
        });
      } else if (e.type === "leak")
        this.fx.push({
          kind: "float",
          x: e.x,
          y: e.y,
          toX: e.x,
          toY: e.y - 0.6,
          age: 0,
          life: 1,
          text: "-1",
        });
    }
  }

  draw(game: Game, dt: number): void {
    const { ctx } = this;
    const { cellSize: s, offX, offY } = this.view;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(offX, offY);
    const level = game.level;
    const px = (v: number) => v * s;

    // Meadow, in two soft greens like mown stripes.
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        ctx.fillStyle = (c + r) % 2 === 0 ? "#9dbb6c" : "#94b464";
        ctx.fillRect(px(c), px(r), s, s);
      }
    }

    // Lane: a wide dirt track with a darker rim.
    const strokeLane = (width: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.beginPath();
      level.path.forEach(([c, r], i) =>
        i === 0
          ? ctx.moveTo(px(c + 0.5), px(r + 0.5))
          : ctx.lineTo(px(c + 0.5), px(r + 0.5)),
      );
      ctx.stroke();
    };
    strokeLane(s * 0.86, "#8a6a43");
    strokeLane(s * 0.7, "#d8bd8a");

    // Plots: pale rings so you can see where to build.
    const lane = laneCells(level.path);
    ctx.lineWidth = 2;
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (lane.has(`${c},${r}`) || towerAt(game, c, r)) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.32)";
        ctx.beginPath();
        ctx.arc(px(c + 0.5), px(r + 0.5), s * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Farmhouse at the end of the lane.
    const end = level.path[level.path.length - 1]!;
    this.house(px(end[0] + 0.5), px(end[1] + 0.5), s);

    // Selected tower or plot, with its range.
    if (this.selected) {
      const { col, row } = this.selected;
      const t = towerAt(game, col, row);
      if (t) {
        const range = TOWERS[t.kind].range[t.tier - 1]!;
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px(col + 0.5), px(row + 0.5), range * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.strokeRect(px(col) + 3, px(row) + 3, s - 6, s - 6);
    }
    if (this.cursor && !this.selected) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(
        px(this.cursor.col) + 3,
        px(this.cursor.row) + 3,
        s - 6,
        s - 6,
      );
      ctx.setLineDash([]);
    }

    for (const t of game.towers)
      this.tower(t.kind, t.tier, px(t.col + 0.5), px(t.row + 0.5), s);

    for (const e of game.enemies) {
      const p = pointAt(level.path, e.dist);
      const ghost = !isRevealed(game, e);
      if (ghost) ctx.globalAlpha = 0.22;
      this.enemy(
        e.kind,
        px(p.x),
        px(p.y),
        s,
        e.hp / ENEMIES[e.kind].hp,
        e.slowed,
        e.stun > 0,
      );
      if (ghost) ctx.globalAlpha = 1;
    }

    // Effects.
    for (const f of this.fx) {
      f.age += dt;
      const t = Math.min(1, f.age / f.life);
      if (f.kind === "turnip") {
        const x = f.x + (f.toX - f.x) * t;
        const y = f.y + (f.toY - f.y) * t - Math.sin(t * Math.PI) * 0.35;
        ctx.fillStyle = "#e9d8ef";
        ctx.strokeStyle = "#7a3f7d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px(x), px(y), s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (f.kind === "pie") {
        ctx.globalAlpha = 0.5 * (1 - t);
        ctx.fillStyle = "#fff6d6";
        ctx.fillRect(0, 0, level.cols * s, level.rows * s);
        ctx.globalAlpha = 1;
      } else if (f.kind === "swarm") {
        ctx.fillStyle = "#f2c94c";
        ctx.strokeStyle = "#2b2320";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const x = f.x + (f.toX - f.x) * t + Math.sin(t * 20 + i * 1.7) * 0.12;
          const y = f.y + (f.toY - f.y) * t + Math.cos(t * 18 + i * 2.1) * 0.12;
          ctx.beginPath();
          ctx.arc(px(x), px(y), s * 0.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (f.kind === "float") {
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = f.text!.startsWith("-") ? "#8f2f22" : "#fffbe6";
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 3;
        ctx.font = `700 ${Math.round(s * 0.3)}px 'Atkinson Hyperlegible', sans-serif`;
        ctx.textAlign = "center";
        const y = px(f.y + (f.toY - f.y) * t);
        ctx.strokeText(f.text!, px(f.x), y);
        ctx.fillText(f.text!, px(f.x), y);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.6 * (1 - t);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(px(f.x), px(f.y), s * (0.15 + 0.3 * t), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    this.fx = this.fx.filter((f) => f.age < f.life);
    ctx.restore();
  }

  private house(x: number, y: number, s: number): void {
    const { ctx } = this;
    ctx.fillStyle = "#f4ede1";
    ctx.strokeStyle = "#6b4a2b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(x - s * 0.3, y - s * 0.1, s * 0.6, s * 0.4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b5523b";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.38, y - s * 0.08);
    ctx.lineTo(x, y - s * 0.4);
    ctx.lineTo(x + s * 0.38, y - s * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6b4a2b";
    ctx.fillRect(x - s * 0.06, y + s * 0.08, s * 0.12, s * 0.22);
  }

  private tower(
    kind: TowerKind,
    tier: number,
    x: number,
    y: number,
    s: number,
  ): void {
    const { ctx } = this;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#2b2320";
    if (kind === "hedgerow") {
      ctx.fillStyle = "#4c7a34";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.36, y - s * 0.24, s * 0.72, s * 0.5, s * 0.22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e8748b";
      for (let i = 0; i < tier + 1; i++) {
        ctx.beginPath();
        ctx.arc(
          x - s * 0.2 + i * s * 0.14,
          y - s * 0.02 + (i % 2) * s * 0.08,
          s * 0.05,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (kind === "stall") {
      ctx.fillStyle = "#8a5a35";
      ctx.fillRect(x - s * 0.3, y, s * 0.6, s * 0.28);
      ctx.strokeRect(x - s * 0.3, y, s * 0.6, s * 0.28);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? "#fffbe6" : "#c4433a";
        ctx.beginPath();
        ctx.rect(x - s * 0.34 + i * s * 0.17, y - s * 0.3, s * 0.17, s * 0.28);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#f2c94c";
      for (let i = 0; i < tier; i++) {
        ctx.beginPath();
        ctx.arc(
          x - s * 0.12 * (tier - 1) + i * s * 0.24,
          y + s * 0.14,
          s * 0.055,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (kind === "mast") {
      ctx.strokeStyle = "#2b2320";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y + s * 0.32);
      ctx.lineTo(x, y - s * 0.3);
      ctx.lineTo(x + s * 0.2, y + s * 0.32);
      ctx.moveTo(x - s * 0.12, y + s * 0.08);
      ctx.lineTo(x + s * 0.12, y + s * 0.08);
      ctx.stroke();
      ctx.fillStyle = "#d95f3b";
      ctx.beginPath();
      ctx.arc(x, y - s * 0.32, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(217,95,59,0.7)";
      ctx.lineWidth = 2;
      for (let i = 1; i <= tier; i++) {
        ctx.beginPath();
        ctx.arc(
          x,
          y - s * 0.32,
          s * 0.1 * i + s * 0.06,
          -0.9 * Math.PI,
          -0.1 * Math.PI,
        );
        ctx.stroke();
      }
    } else if (kind === "tent") {
      ctx.fillStyle = "#fffbe6";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.38, y + s * 0.3);
      ctx.lineTo(x, y - s * 0.34);
      ctx.lineTo(x + s * 0.38, y + s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#4fb3a9";
      ctx.fillRect(x - s * 0.06, y - s * 0.08, s * 0.12, s * 0.3);
      ctx.fillRect(x - s * 0.15, y + s * 0.01, s * 0.3, s * 0.12);
      ctx.fillStyle = "#f2c94c";
      for (let i = 0; i < tier; i++) {
        ctx.beginPath();
        ctx.arc(
          x - s * 0.12 * (tier - 1) + i * s * 0.24,
          y + s * 0.36,
          s * 0.05,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (kind === "court") {
      ctx.fillStyle = "#e8e2d0";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y - s * 0.12);
      ctx.lineTo(x, y - s * 0.4);
      ctx.lineTo(x + s * 0.4, y - s * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(
          x - s * 0.32 + i * s * 0.2,
          y - s * 0.08,
          s * 0.1,
          s * 0.4,
        );
        ctx.strokeRect(
          x - s * 0.32 + i * s * 0.2,
          y - s * 0.08,
          s * 0.1,
          s * 0.4,
        );
      }
      ctx.fillStyle = "#f2c94c";
      for (let i = 0; i < tier; i++) {
        ctx.beginPath();
        ctx.arc(
          x - s * 0.12 * (tier - 1) + i * s * 0.24,
          y + s * 0.38,
          s * 0.05,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (kind === "barn") {
      ctx.fillStyle = "#b5523b";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.36, y + s * 0.3);
      ctx.lineTo(x - s * 0.36, y - s * 0.08);
      ctx.lineTo(x, y - s * 0.36);
      ctx.lineTo(x + s * 0.36, y - s * 0.08);
      ctx.lineTo(x + s * 0.36, y + s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fffbe6";
      ctx.fillRect(x - s * 0.1, y + s * 0.02, s * 0.2, s * 0.28);
      ctx.strokeRect(x - s * 0.1, y + s * 0.02, s * 0.2, s * 0.28);
      ctx.fillStyle = "#4c7a34";
      for (let i = 0; i < tier; i++)
        ctx.fillRect(
          x - s * 0.3 + i * s * 0.14,
          y - s * 0.16,
          s * 0.08,
          s * 0.08,
        );
    } else if (kind === "silo") {
      ctx.fillStyle = "#c9ced4";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.2, y - s * 0.22, s * 0.4, s * 0.54, s * 0.05);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#d95f3b";
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.22, s * 0.2, s * 0.13, 0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#2b2320";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < tier; i++) {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.2, y - s * 0.02 + i * s * 0.12);
        ctx.lineTo(x + s * 0.2, y - s * 0.02 + i * s * 0.12);
        ctx.stroke();
      }
    } else if (kind === "pond") {
      ctx.fillStyle = "#6fb3d6";
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.04, s * 0.38, s * 0.27, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fffbe6";
      for (let i = 0; i < tier; i++) {
        const dx = (i - (tier - 1) / 2) * s * 0.22;
        ctx.beginPath();
        ctx.arc(x + dx, y + s * 0.02, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f2994a";
        ctx.fillRect(x + dx + s * 0.06, y, s * 0.06, s * 0.03);
        ctx.fillStyle = "#fffbe6";
      }
    } else if (kind === "beehive") {
      ctx.fillStyle = "#f2c94c";
      for (let i = 0; i < 3; i++) {
        const w = s * (0.44 - i * 0.1);
        ctx.beginPath();
        ctx.roundRect(
          x - w / 2,
          y + s * 0.26 - (i + 1) * s * 0.16,
          w,
          s * 0.16,
          s * 0.07,
        );
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#2b2320";
      ctx.beginPath();
      ctx.arc(x, y + s * 0.02, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffbe6";
      for (let i = 0; i < tier; i++) {
        ctx.beginPath();
        ctx.arc(
          x - s * 0.12 * (tier - 1) + i * s * 0.24,
          y + s * 0.35,
          s * 0.05,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.22);
      ctx.lineTo(x, y + s * 0.34);
      ctx.moveTo(x - s * 0.3, y - s * 0.06);
      ctx.lineTo(x + s * 0.3, y - s * 0.06);
      ctx.stroke();
      ctx.fillStyle = "#e9c98a";
      ctx.beginPath();
      ctx.arc(x, y - s * 0.24, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#6b4a2b";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.24, y - s * 0.3);
      ctx.lineTo(x, y - s * 0.55);
      ctx.lineTo(x + s * 0.24, y - s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fffbe6";
      for (let i = 0; i < tier; i++) {
        ctx.beginPath();
        ctx.arc(
          x - s * 0.12 * (tier - 1) + i * s * 0.24,
          y + s * 0.32,
          s * 0.055,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  private enemy(
    kind: EnemyKind,
    x: number,
    y: number,
    s: number,
    hp: number,
    slowed: boolean,
    stunned: boolean,
  ): void {
    const { ctx } = this;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#2b2320";
    if (kind === "truck") {
      ctx.fillStyle = "#f2c94c";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.32, y - s * 0.2, s * 0.64, s * 0.4, s * 0.09);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#c4433a";
      ctx.font = `bold ${Math.round(s * 0.2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(".99", x - s * 0.04, y);
      ctx.fillStyle = "#2b2320";
      ctx.beginPath();
      ctx.arc(x - s * 0.16, y + s * 0.2, s * 0.07, 0, Math.PI * 2);
      ctx.arc(x + s * 0.16, y + s * 0.2, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "influencer") {
      ctx.fillStyle = "#f5a3c7";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.2, y - s * 0.02, s * 0.4, s * 0.3, s * 0.08);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffe0c2";
      ctx.beginPath();
      ctx.arc(x, y - s * 0.14, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // A phone held out at arm's length, always.
      ctx.fillStyle = "#2b2320";
      ctx.fillRect(x + s * 0.2, y - s * 0.22, s * 0.1, s * 0.18);
      ctx.strokeStyle = "rgba(245,163,199,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        s * 0.42 + Math.sin(performance.now() / 300) * 2,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (kind === "blimp") {
      ctx.fillStyle = "#f5a3c7";
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.05, s * 0.5, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fffbe6";
      ctx.font = `bold ${Math.round(s * 0.2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("#BLESSED", x, y - s * 0.05);
      ctx.fillStyle = "#7fb8c8";
      ctx.fillRect(x - s * 0.12, y + s * 0.22, s * 0.24, s * 0.12);
      ctx.strokeStyle = "rgba(245,163,199,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        s * 0.7 + Math.sin(performance.now() / 300) * 3,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (kind === "bulldozer" || kind === "megadozer") {
      const k = kind === "megadozer" ? 1.5 : 1;
      ctx.fillStyle = "#f2c94c";
      ctx.beginPath();
      ctx.roundRect(
        x - s * 0.3 * k,
        y - s * 0.18 * k,
        s * 0.56 * k,
        s * 0.34 * k,
        s * 0.06,
      );
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#7fb8c8";
      ctx.fillRect(x - s * 0.1 * k, y - s * 0.3 * k, s * 0.2 * k, s * 0.14 * k);
      ctx.fillStyle = "#9aa1a8";
      ctx.beginPath();
      ctx.roundRect(
        x + s * 0.28 * k,
        y - s * 0.24 * k,
        s * 0.07 * k,
        s * 0.44 * k,
        2,
      );
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2b2320";
      ctx.fillRect(
        x - s * 0.3 * k,
        y + s * 0.16 * k,
        s * 0.56 * k,
        s * 0.1 * k,
      );
      if (kind === "megadozer") {
        ctx.fillStyle = "#c4433a";
        ctx.font = `bold ${Math.round(s * 0.16)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SYNERGY", x, y - s * 0.02);
      }
    } else if (kind === "lawyer" || kind === "swarm") {
      const k = kind === "swarm" ? 1.6 : 1;
      ctx.fillStyle = "#2b2f3a";
      ctx.beginPath();
      ctx.arc(x, y - s * 0.16 * k, s * 0.12 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2 * k, y + s * 0.3 * k);
      ctx.lineTo(x - s * 0.14 * k, y - s * 0.04 * k);
      ctx.lineTo(x + s * 0.14 * k, y - s * 0.04 * k);
      ctx.lineTo(x + s * 0.2 * k, y + s * 0.3 * k);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f4f1e8";
      ctx.fillRect(
        x + s * 0.12 * k,
        y + s * 0.06 * k,
        s * 0.16 * k,
        s * 0.2 * k,
      );
      ctx.strokeRect(
        x + s * 0.12 * k,
        y + s * 0.06 * k,
        s * 0.16 * k,
        s * 0.2 * k,
      );
    } else if (kind === "tender" || kind === "ship") {
      const k = kind === "ship" ? 1.6 : 1;
      ctx.fillStyle = kind === "ship" ? "#2f5a7a" : "#6fa0c4";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.34 * k, y - s * 0.05 * k);
      ctx.lineTo(x + s * 0.36 * k, y - s * 0.05 * k);
      ctx.lineTo(x + s * 0.26 * k, y + s * 0.2 * k);
      ctx.lineTo(x - s * 0.28 * k, y + s * 0.2 * k);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const cols = ["#c4433a", "#f2c94c", "#4c7a34"];
      const n = kind === "ship" ? 3 : 1;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = cols[i]!;
        ctx.fillRect(
          x - s * 0.28 * k + i * s * 0.19 * k,
          y - s * 0.22 * k,
          s * 0.17 * k,
          s * 0.17 * k,
        );
        ctx.strokeRect(
          x - s * 0.28 * k + i * s * 0.19 * k,
          y - s * 0.22 * k,
          s * 0.17 * k,
          s * 0.17 * k,
        );
      }
    } else if (kind === "phantom") {
      ctx.fillStyle = "#dfe3e6";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.24, y - s * 0.15, s * 0.48, s * 0.3, s * 0.07);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2b2320";
      ctx.font = `bold ${Math.round(s * 0.2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", x, y);
      ctx.beginPath();
      ctx.arc(x - s * 0.12, y + s * 0.17, s * 0.06, 0, Math.PI * 2);
      ctx.arc(x + s * 0.12, y + s * 0.17, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "clinic") {
      ctx.fillStyle = "#f7fbfb";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.46, y - s * 0.3, s * 0.92, s * 0.6, s * 0.1);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#4fb3a9";
      ctx.fillRect(x - s * 0.1, y - s * 0.22, s * 0.2, s * 0.44);
      ctx.fillRect(x - s * 0.22, y - s * 0.1, s * 0.44, s * 0.2);
      ctx.fillStyle = "#2b2320";
      ctx.beginPath();
      ctx.arc(x - s * 0.28, y + s * 0.32, s * 0.09, 0, Math.PI * 2);
      ctx.arc(x + s * 0.28, y + s * 0.32, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(79,179,169,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        s * 0.6 + Math.sin(performance.now() / 300) * 3,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (kind === "boss" || kind === "convoy") {
      ctx.fillStyle = kind === "convoy" ? "#f2c94c" : "#f3f0ea";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.46, y - s * 0.34, s * 0.92, s * 0.68, s * 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#7fb8c8";
      ctx.fillRect(x + s * 0.12, y - s * 0.26, s * 0.26, s * 0.2);
      ctx.fillStyle = "#c4433a";
      ctx.fillRect(x - s * 0.36, y - s * 0.1, s * 0.4, s * 0.1);
      ctx.fillStyle = "#2b2320";
      ctx.beginPath();
      ctx.arc(x - s * 0.24, y + s * 0.34, s * 0.09, 0, Math.PI * 2);
      ctx.arc(x + s * 0.24, y + s * 0.34, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      // A small smile on the front: the corporations always smile.
      ctx.beginPath();
      ctx.arc(x + s * 0.2, y + s * 0.1, s * 0.09, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else if (kind === "van") {
      ctx.fillStyle = "#f3f0ea";
      ctx.beginPath();
      ctx.roundRect(x - s * 0.3, y - s * 0.2, s * 0.6, s * 0.4, s * 0.09);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#7fb8c8";
      ctx.fillRect(x + s * 0.06, y - s * 0.14, s * 0.18, s * 0.14);
      ctx.fillStyle = "#2b2320";
      ctx.beginPath();
      ctx.arc(x - s * 0.15, y + s * 0.2, s * 0.07, 0, Math.PI * 2);
      ctx.arc(x + s * 0.15, y + s * 0.2, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#e9ecef";
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.2);
      ctx.lineTo(x + s * 0.2, y);
      ctx.lineTo(x, y + s * 0.2);
      ctx.lineTo(x - s * 0.2, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y - s * 0.24);
      ctx.lineTo(x + s * 0.3, y - s * 0.24);
      ctx.stroke();
    }
    if (hp < 1) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x - s * 0.3, y - s * 0.46, s * 0.6, s * 0.08);
      ctx.fillStyle = "#c4433a";
      ctx.fillRect(
        x - s * 0.3,
        y - s * 0.46,
        s * 0.6 * Math.max(0, hp),
        s * 0.08,
      );
    }
    if (stunned) {
      ctx.fillStyle = "#fffbe6";
      ctx.strokeStyle = "#2b2320";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + performance.now() / 400;
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(a) * s * 0.22,
          y - s * 0.36 + Math.sin(a) * s * 0.06,
          s * 0.045,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.stroke();
      }
    }
    if (slowed) {
      ctx.strokeStyle = "#4c7a34";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.36, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
