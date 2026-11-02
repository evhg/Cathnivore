// Plan item 14: the talk screen. Close framing on the man she has by the collar: a portrait plate (his
// silhouette under a hard key light, his name and job), his opener as a subtitle, and her 2 to 4 choices.
// Locked choices say what they need (Nerve 30, 80 Scrip). Picking one plays his answer and names the intel.
// The rules live in sim/talk.ts; this only draws them. Escape walks away without picking.

import { el, button, trapTab } from "./dom";
import { optionState, type Intel, type Talk } from "../sim/talk";
import type { Attributes } from "../sim/types";

const APPROACH: Record<string, string> = { press: "Press", charm: "Charm", pay: "Pay", wire: "Wire" };

export function intelLine(i: Intel): string {
  if (i.kind === "waypoint") return "Intel: a stash marked on your map.";
  if (i.kind === "squad") return "Intel: one squad off the alarm.";
  return "Intel: a weakness, noted on the case board.";
}

/**
 * Each lieutenant's head and shoulders under one hard key light from the right, with a red rim from the left.
 * One frame for all five; what changes is his outline: the dock foreman's flat cap and donkey jacket, the
 * orderly's scrub cap and mask, the advance man's slick hair and tie, the security chief's close crop, earpiece
 * and blazer, the clerk's bald head and round glasses. Inline SVG, no assets.
 */
interface Look {
  /** Shoulders and collar (drawn over the neck). */
  body: string;
  /** Hair or headwear, over the head. */
  top: string;
  /** Anything on the face: glasses, a mask, an earpiece. */
  face: string;
  /** Head width and height (rx, ry). */
  head: [number, number];
}
const LOOKS: Record<string, Look> = {
  foreman: {
    head: [22, 26],
    body: `<path d="M12 150c2-32 20-44 48-46 28 2 46 14 48 46z" fill="#16171c"/><path d="M38 108l22 10 22-10-4 42H42z" fill="#202329"/><path d="M30 118l14-6 4 38M90 118l-14-6-4 38" stroke="#2c2f37" stroke-width="3" fill="none"/>`,
    top: `<path d="M36 56c2-16 12-22 24-22s23 6 25 22l9 2c-2 4-10 5-19 4-6-2-12-3-17-3s-12 1-17 3c-5-2-6-4-5-6z" fill="#262830"/><path d="M38 60h46" stroke="#33363f" stroke-width="1.5"/>`,
    face: `<path d="M40 74c2 12 10 18 20 18s18-6 20-18c-4 6-11 9-20 9s-16-3-20-9z" fill="#14161c" opacity=".55"/>`,
  },
  orderly: {
    head: [20, 26],
    body: `<path d="M18 150c2-30 18-42 42-44 24 2 40 14 42 44z" fill="#1a2a2a"/><path d="M46 106l14 16 14-16" stroke="#2c4644" stroke-width="3" fill="none"/>`,
    top: `<path d="M39 60c0-18 9-27 21-27s21 9 21 27c-6-4-13-6-21-6s-15 2-21 6z" fill="#284240"/><path d="M40 58c6-3 13-4 20-4s14 1 20 4" stroke="#355a57" stroke-width="1.5" fill="none"/>`,
    face: `<path d="M41 74c6 4 12 5 19 5s13-1 19-5c0 12-8 20-19 20s-19-8-19-20z" fill="#2e4b49"/><path d="M41 74l-6-6M79 74l6-6" stroke="#355a57" stroke-width="1.2"/>`,
  },
  advance: {
    head: [20, 26],
    body: `<path d="M18 150c2-30 18-42 42-44 24 2 40 14 42 44z" fill="#121318"/><path d="M48 106l12 44 12-44-12 8z" fill="#e8e3da" opacity=".85"/><path d="M57 114l3 30 3-30-3-4z" fill="#7a1622"/><path d="M48 106l-8 44M72 106l8 44" stroke="#22242b" stroke-width="3"/>`,
    top: `<path d="M39 62c-2-20 8-30 22-30 13 0 22 8 21 26-8-10-18-14-30-12-6 1-10 7-13 16z" fill="#0c0d11"/><path d="M48 40c10-4 22-2 30 8" stroke="#3a3d47" stroke-width="1.5" fill="none"/>`,
    face: ``,
  },
  secchief: {
    head: [19, 25],
    body: `<path d="M20 150c2-30 18-42 40-44 22 2 38 14 40 44z" fill="#15161b"/><path d="M50 106l10 12 10-12" stroke="#d8d3ca" stroke-width="2.5" fill="none" opacity=".8"/><path d="M50 106l-10 44M70 106l10 44" stroke="#24262d" stroke-width="3"/><rect x="74" y="122" width="10" height="7" rx="1" fill="#3a3d47"/>`,
    top: `<path d="M41 60c0-17 8-26 19-26s19 9 19 26c-4-8-11-12-19-12s-15 4-19 12z" fill="#0e0f13"/>`,
    face: `<path d="M80 66c4 0 6 3 6 6v6" stroke="#4a4e5a" stroke-width="2" fill="none"/><path d="M86 78c0 10-4 16-10 20" stroke="#3a3d47" stroke-width="1" fill="none"/>`,
  },
  clerk: {
    head: [21, 27],
    body: `<path d="M22 150c2-28 16-40 38-42 22 2 36 14 38 42z" fill="#17181d"/><path d="M48 104h24v10H48z" fill="#22242b"/><path d="M52 108h16" stroke="#3a3d47" stroke-width="1.5"/>`,
    top: `<path d="M41 54c3-12 10-17 19-17s16 5 19 17c-5-5-12-7-19-7s-14 2-19 7z" fill="#262933" opacity=".7"/>`,
    face: `<circle cx="52" cy="66" r="6" fill="none" stroke="#8a8f9c" stroke-width="1.6"/><circle cx="68" cy="66" r="6" fill="none" stroke="#8a8f9c" stroke-width="1.6"/><path d="M58 66h4" stroke="#8a8f9c" stroke-width="1.4"/>`,
  },
};

export function plateSvg(id: string): string {
  const k = LOOKS[id] ?? LOOKS.foreman!;
  const [rx, ry] = k.head;
  const g = `tk-${id}`;
  return `<svg viewBox="0 0 120 150" aria-hidden="true" focusable="false">
<defs><radialGradient id="${g}-key" cx=".72" cy=".25" r=".8"><stop offset="0" stop-color="#3a3f4d"/><stop offset="1" stop-color="#0b0d12"/></radialGradient>
<linearGradient id="${g}-rim" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ff3b55" stop-opacity=".9"/><stop offset=".25" stop-color="#ff3b55" stop-opacity="0"/></linearGradient>
<linearGradient id="${g}-lit" x1="0" y1="0" x2="1" y2="0"><stop offset=".45" stop-color="#e8e3da" stop-opacity="0"/><stop offset="1" stop-color="#e8e3da" stop-opacity=".16"/></linearGradient></defs>
<rect width="120" height="150" fill="url(#${g}-key)"/>
<path d="M50 90h20v20H50z" fill="#171a22"/>
${k.body}
<ellipse cx="60" cy="66" rx="${rx}" ry="${ry}" fill="#1d2029"/>
<ellipse cx="60" cy="66" rx="${rx}" ry="${ry}" fill="url(#${g}-lit)"/>
<path d="M52 66h6M64 66h6" stroke="#5a5f6e" stroke-width="2" stroke-linecap="round"/>
<path d="M51 61l7-1M63 60l7 1" stroke="#0e1015" stroke-width="2" stroke-linecap="round"/>
<path d="M61 68l3 9-4 1" stroke="#2f333e" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M54 84q6 2 12 0" stroke="#2f333e" stroke-width="1.8" fill="none" stroke-linecap="round"/>
${k.face}
${k.top}
<path d="M18 150c2-30 18-42 42-44 24 2 40 14 42 44z" fill="url(#${g}-rim)" opacity=".8"/>
<ellipse cx="60" cy="66" rx="${rx}" ry="${ry}" fill="url(#${g}-rim)"/>
</svg>`;
}

/**
 * Opens a talk over `parent`. `pick` applies the choice (it returns the answer to show, or null if the rules
 * refused it); `onClose` runs when she lets go of him.
 */
export function openTalk(
  parent: Element,
  talk: Talk,
  attrs: Attributes,
  scrip: number,
  pick: (optionId: string) => { reply: string; intel: Intel } | null,
  onClose: () => void = () => {},
): () => void {
  const wrap = el("div", "coach talk", parent);
  const card = el("div", "talk-card", wrap);
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", `Talk: ${talk.who}`);

  const plate = el("figure", "talk-plate", card);
  plate.innerHTML = plateSvg(talk.id);
  const cap = el("figcaption", "talk-who", plate);
  el("b", "", cap, talk.who);
  el("span", "", cap, talk.role);

  const body = el("div", "talk-body", card);
  el("p", "talk-line", body, talk.opener);
  const list = el("ol", "talk-options", body);
  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    wrap.remove();
    onClose();
  };
  const walk = button("talk-walk", body, "Walk away");
  walk.addEventListener("click", close);
  for (const o of talk.options) {
    const li = el("li", "", list);
    const st = optionState(o, attrs, scrip);
    const b = button(`talk-opt talk-${o.approach}`, li);
    b.dataset.option = o.id;
    el("span", "talk-approach", b, APPROACH[o.approach] + (o.cost ? ` · ${o.cost} Scrip` : ""));
    el("span", "talk-say", b, o.line);
    if (!st.open) {
      b.disabled = true;
      el("span", "talk-lock", b, `Needs ${st.why}`);
    }
    b.addEventListener("click", () => {
      const r = pick(o.id);
      if (!r) return;
      list.remove();
      walk.remove();
      el("p", "talk-said", body, o.line);
      el("p", "talk-line talk-reply", body, r.reply);
      el("p", "talk-intel", body, intelLine(r.intel));
      const done = button("talk-done", body, "Let him go");
      done.addEventListener("click", close);
      done.focus();
    });
  }
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      close();
    } else if (ev.key === "Tab") trapTab(card, ev);
  };
  document.addEventListener("keydown", onKey, true);
  (card.querySelector<HTMLButtonElement>(".talk-opt:not([disabled])") ?? walk).focus();
  return close;
}
