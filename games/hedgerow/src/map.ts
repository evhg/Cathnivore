// The level select as a journey across Marrow: one painted scene per act, then its ten levels as stops on
// a winding trail (two rows of five, the second running back the other way), the boss at the end. Cath
// stands on the next level to play. Buttons keep the `level` class and `data-level` for tests.

import { cathSvg } from "../../../shared/cath/cath";
import type { Level } from "./engine";
import { isUnlocked, type SaveData } from "./store";
import { THEMES } from "./theme";

const MOTIFS = [
  "oaks",
  "moor",
  "marsh",
  "river",
  "forest",
  "bay",
  "rift",
  "town",
  "city",
  "castle",
] as const;

export function actScene(n: number): string {
  const th = THEMES[(n - 1) % THEMES.length]!;
  const motif = MOTIFS[(n - 1) % MOTIFS.length]!;
  const dusk = n >= 7;
  const sky0 = dusk ? (n === 10 ? "#3a2340" : n === 9 ? "#5b6b80" : "#6b4a6e") : n === 3 || n === 6 ? "#bfe0ea" : "#f6e3b4";
  const sky1 = dusk ? (n === 10 ? "#e0784a" : n === 9 ? "#c9d3dc" : "#f09a6a") : n === 3 || n === 6 ? "#eef6f2" : "#fbf2dc";
  const sun = dusk ? "#ffd27a" : "#fff3c4";
  const g0 = th.grass[0];
  const g1 = th.grass[1];
  const ink = "#2b2320";
  let m = "";
  switch (motif) {
    case "oaks":
      m = [40, 70, 250, 285].map((x, i) => `<rect x="${x - 2}" y="${52 - (i % 2) * 4}" width="4" height="12" fill="#6b4a2b"/><circle cx="${x}" cy="${46 - (i % 2) * 4}" r="${11 + (i % 2) * 2}" fill="#5e8f41" stroke="${ink}" stroke-width="1.2"/>`).join("") +
        `<g transform="translate(180 50)"><rect x="-8" y="-6" width="16" height="12" fill="#f4ede1" stroke="${ink}"/><path d="M-11 -5 0 -14 11 -5Z" fill="#b5523b" stroke="${ink}"/></g>`;
      break;
    case "moor":
      m = `<path d="M20 60 l20 -6 l14 6Z M230 60 l26 -9 l18 9Z" fill="#a9a296" stroke="${ink}" stroke-width="1"/>` +
        Array.from({ length: 18 }, (_, i) => `<circle cx="${10 + i * 17}" cy="${66 + (i % 3)}" r="3" fill="${i % 2 ? "#9c6fb2" : "#b583c6"}"/>`).join("");
      break;
    case "marsh":
      m = `<ellipse cx="90" cy="64" rx="60" ry="6" fill="#7fb3c4"/><ellipse cx="250" cy="66" rx="50" ry="5" fill="#7fb3c4"/>` +
        Array.from({ length: 14 }, (_, i) => `<path d="M${20 + i * 21} 68 q2 -12 ${i % 2 ? 4 : -2} -18" stroke="#6b7f3a" stroke-width="1.6" fill="none"/>`).join("");
      break;
    case "river":
      m = `<path d="M0 62 C80 52 140 74 220 60 S300 56 320 60 V70 H0Z" fill="#6ea6c2"/><path d="M60 40 q12 -16 24 0 v20 h-24Z" fill="#86a94a" stroke="${ink}" stroke-width="1"/>`;
      break;
    case "forest":
      m = Array.from({ length: 12 }, (_, i) => `<circle cx="${12 + i * 27}" cy="${48 + (i % 3) * 3}" r="${12 + (i % 2) * 3}" fill="${i % 2 ? "#4f7f37" : "#3f6a3a"}" stroke="${ink}" stroke-width="1"/>`).join("");
      break;
    case "bay":
      m = `<rect x="0" y="60" width="320" height="10" fill="#5d9cbf"/>` +
        ["#e46a5a", "#5b8fd1", "#f2c94c", "#7fbf9a"].map((c, i) => `<rect x="${170 + i * 28}" y="44" width="16" height="16" fill="${c}" stroke="${ink}"/><path d="M${167 + i * 28} 44 l11 -8 l11 8Z" fill="#6b4a2b" stroke="${ink}"/>`).join("");
      break;
    case "rift":
      m = `<path d="M150 70 l6 -10 l-4 -6 l8 -8 l-3 -6" stroke="${ink}" stroke-width="2" fill="none"/>` +
        [40, 260].map((x) => `<path d="M${x} 66 v-22 l-8 -8 M${x} 52 l8 -8" stroke="#5b4636" stroke-width="3" fill="none"/>`).join("") +
        `<path d="M100 66 l5 -12 l5 12Z M210 66 l5 -12 l5 12Z" fill="#f08a3c" stroke="${ink}"/>`;
      break;
    case "town":
      m = `<path d="M10 30 Q160 50 310 30" stroke="${ink}" fill="none"/>` +
        Array.from({ length: 12 }, (_, i) => `<path d="M${22 + i * 25} ${33 + Math.sin(i / 2) * 4} l5 8 l5 -8Z" fill="${["#c4433a", "#f2c94c", "#3f6fb5"][i % 3]}"/>`).join("") +
        `<rect x="120" y="40" width="80" height="22" rx="3" fill="#1f8a8a" stroke="${ink}"/><text x="160" y="55" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="sans-serif">VOTE PELL</text>`;
      break;
    case "city":
      m = [20, 60, 230, 270].map((x, i) => `<rect x="${x}" y="${18 + (i % 2) * 10}" width="30" height="${50 - (i % 2) * 10}" fill="#8fa3b4" stroke="${ink}"/>`).join("") +
        `<path d="M150 66 V20 H190 M190 20 v10" stroke="#d9a13a" stroke-width="3" fill="none"/>`;
      break;
    case "castle":
      m = `<path d="M90 66 V36 h8 v-6 h8 v6 h8 v-6 h8 v6 h8 V66Z M200 66 V30 h10 v-6 h10 v6 h10 V66Z" fill="#cfc5af" stroke="${ink}"/>` +
        [40, 150, 270].map((x) => `<rect x="${x}" y="54" width="20" height="12" fill="#8a5a35"/><path d="M${x - 3} 54 h26 l-3 -8 h-20Z" fill="#c4433a" stroke="${ink}"/>`).join("");
      break;
  }
  return `<svg class="act-scene" viewBox="0 0 320 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><linearGradient id="sky${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky0}"/><stop offset="1" stop-color="${sky1}"/></linearGradient></defs>
<rect width="320" height="80" fill="url(#sky${n})"/>
<circle cx="${60 + ((n * 53) % 200)}" cy="${dusk ? 30 : 22}" r="11" fill="${sun}" opacity=".95"/>
<path d="M0 54 Q60 34 130 50 T260 44 T320 46 V80 H0Z" fill="${g1}" opacity=".8"/>
<path d="M0 64 Q80 52 160 62 T320 58 V80 H0Z" fill="${g0}"/>
${m}
</svg>`;
}

export function renderMap(list: HTMLElement, levels: Level[], data: SaveData, open: (lv: Level) => void): void {
  list.replaceChildren();
  const acts = new Map<number, Level[]>();
  for (const lv of levels) {
    const n = Math.floor((lv.id - 1) / 10) + 1;
    if (!acts.has(n)) acts.set(n, []);
    acts.get(n)!.push(lv);
  }
  let current: HTMLElement | null = null;
  const nextId = levels.find((lv) => isUnlocked(data, lv.id) && !data.stars[String(lv.id)])?.id ?? null;
  for (const [n, lvs] of acts) {
    const li = document.createElement("li");
    li.className = "act";
    const firstUnlocked = isUnlocked(data, lvs[0]!.id);
    if (!firstUnlocked) li.classList.add("act-locked");
    const got = lvs.reduce((a, lv) => a + (data.stars[String(lv.id)] ?? 0), 0);
    const head = document.createElement("div");
    head.className = "act-head";
    head.innerHTML = actScene(n);
    const title = document.createElement("div");
    title.className = "act-title";
    const num = document.createElement("span");
    num.className = "act-num";
    num.textContent = `Act ${n}`;
    const place = document.createElement("span");
    place.className = "act-place";
    place.textContent = lvs[0]!.place;
    const tally = document.createElement("span");
    tally.className = "act-tally";
    tally.textContent = `★ ${got}/${lvs.length * 3}`;
    tally.setAttribute("aria-label", `${got} of ${lvs.length * 3} stars`);
    title.append(num, place, tally);
    head.append(title);
    li.append(head);

    const trail = document.createElement("ol");
    trail.className = "trail";
    const svgNS = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(svgNS, "svg");
    path.setAttribute("class", "trail-path");
    path.setAttribute("viewBox", "0 0 100 100");
    path.setAttribute("preserveAspectRatio", "none");
    path.setAttribute("aria-hidden", "true");
    const pts: string[] = [];
    lvs.forEach((_, i) => {
      const row = Math.floor(i / 5);
      const col = row % 2 === 0 ? i % 5 : 4 - (i % 5);
      pts.push(`${(col + 0.5) * 20},${row === 0 ? 30 : 76}`);
    });
    const pl = document.createElementNS(svgNS, "polyline");
    pl.setAttribute("points", pts.join(" "));
    pl.setAttribute("vector-effect", "non-scaling-stroke");
    path.append(pl);
    trail.append(path);

    lvs.forEach((lv, i) => {
      const row = Math.floor(i / 5);
      const col = row % 2 === 0 ? i % 5 : 4 - (i % 5);
      const unlocked = isUnlocked(data, lv.id);
      const stars = data.stars[String(lv.id)] ?? 0;
      const item = document.createElement("li");
      item.className = `stop c${col + 1} r${row + 1}`;
      const b = document.createElement("button");
      b.type = "button";
      const boss = lv.id % 10 === 0;
      b.className = `level node${boss ? " level-boss" : ""}${stars ? " cleared" : ""}`;
      b.disabled = !unlocked;
      b.dataset.level = String(lv.id);
      b.setAttribute(
        "aria-label",
        unlocked
          ? `Level ${lv.id}, ${lv.name}${boss ? ", boss" : ""}. ${lv.waves.length} waves. ${stars} of 3 stars.`
          : `Level ${lv.id}, ${lv.name}. Locked: clear level ${lv.id - 1} first.`,
      );
      const numEl = document.createElement("span");
      numEl.className = "level-num";
      numEl.textContent = String(lv.id);
      const st = document.createElement("span");
      st.className = "level-stars";
      st.textContent = unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) : "";
      const name = document.createElement("span");
      name.className = "level-name";
      name.textContent = lv.name;
      b.append(numEl, st, name);
      if (lv.id === nextId) {
        b.classList.add("next");
        const me = document.createElement("span");
        me.className = "you";
        me.setAttribute("aria-hidden", "true");
        me.innerHTML = cathSvg({ framing: "face", expression: "smirk" });
        b.append(me);
        current = b;
      }
      b.addEventListener("click", () => open(lv));
      item.append(b);
      trail.append(item);
    });
    li.append(trail);
    list.append(li);
  }
  (current as HTMLElement | null)?.scrollIntoView({ block: "center" });
}
