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

/** A man's head and shoulders under a single hard light: the plate behind the talk. Inline SVG, no assets. */
function plateSvg(): string {
  return `<svg viewBox="0 0 120 150" aria-hidden="true" focusable="false">
<defs><radialGradient id="tk-key" cx=".72" cy=".25" r=".8"><stop offset="0" stop-color="#3a3f4d"/><stop offset="1" stop-color="#0b0d12"/></radialGradient>
<linearGradient id="tk-rim" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ff3b55" stop-opacity=".9"/><stop offset=".25" stop-color="#ff3b55" stop-opacity="0"/></linearGradient></defs>
<rect width="120" height="150" fill="url(#tk-key)"/>
<path d="M18 150c2-30 18-42 42-44 24 2 40 14 42 44z" fill="#14161d"/>
<path d="M45 108l15 14 15-14v-12H45z" fill="#1b1e27"/>
<ellipse cx="60" cy="66" rx="21" ry="27" fill="#1d2029"/>
<path d="M39 58c0-20 10-28 21-28s22 8 22 28c-4-9-12-13-22-13s-17 4-21 13z" fill="#101218"/>
<path d="M18 150c2-30 18-42 42-44 24 2 40 14 42 44zM39 66c0-16 9-27 21-27s21 11 21 27-9 27-21 27-21-11-21-27z" fill="url(#tk-rim)"/>
<path d="M52 66h6M64 66h6" stroke="#5a5f6e" stroke-width="2" stroke-linecap="round"/>
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
  plate.innerHTML = plateSvg();
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
