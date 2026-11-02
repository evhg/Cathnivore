// Plan item 17: the morning-after debrief, on the case board's cork. The case's polaroid from the List gets its red
// cross while you watch, a rubber stamp comes down with the grade, Scrip, XP and the visit's numbers count up, the
// best three kills hang as stills, a keepsake card shows what the case left her, and Cath has a line (with a text
// from Bea when nobody ever saw her). Reduced motion lands every number and still at once.

import {
  beaText,
  cathLine,
  clock,
  debriefGrade,
  debriefScore,
  GRADE_WORD,
  type DebriefLedger,
} from "../sim/debrief";
import { BUST_FOR_CASE, bustSvg } from "./busts";
import { button, cssVar, el, reducedMotion, trapTab } from "./dom";

export interface DebriefStill {
  /** A JPEG data URL of the frame just after the kill. */
  src: string;
  caption: string;
}

export interface DebriefInfo {
  caseId: string;
  title: string;
  district: string;
  ledger: DebriefLedger;
  stills: readonly DebriefStill[];
  keepsake: { name: string; lore: string; slot: string } | null;
}

const COUNT_MS = 1400;

/** Opens the debrief over `parent`. Returns a close function; `onClose` runs once it's gone. */
export function openDebrief(parent: Element, info: DebriefInfo, onClose: () => void = () => {}): () => void {
  const calm = reducedMotion();
  const l = info.ledger;
  const score = debriefScore(l);
  const grade = debriefGrade(score);
  const wrap = el("div", "coach case-board debrief", parent);
  wrap.classList.toggle("is-calm", calm);
  const card = el("div", "coach-card case-cork debrief-cork", wrap);
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", `Debrief: ${info.title}`);
  card.dataset.grade = grade;

  const head = el("header", "case-head", card);
  const titles = el("div", "case-titles", head);
  el("h2", "", titles, "Morning after");
  el("p", "case-eyebrow", titles, `${info.district} · case closed`);

  const top = el("div", "debrief-top", card);
  // The List print for the case, crossed out in red as the screen opens.
  const print = el("figure", "case-print debrief-print", top);
  cssVar(print, "--tilt", "-2deg");
  el("i", "case-pin", print);
  const photo = el("div", "case-photo", print);
  const who = BUST_FOR_CASE[info.caseId];
  if (who) photo.innerHTML = bustSvg(who);
  else el("span", "case-blank", photo, "?");
  photo.insertAdjacentHTML(
    "beforeend",
    `<svg class="debrief-cross" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M8 10 L92 110"/><path pathLength="1" d="M92 10 L8 110"/></svg>`,
  );
  el("figcaption", "case-name", print, info.title);

  // The stamp and the numbers.
  const sheet = el("div", "debrief-sheet", top);
  const stamp = el("div", "debrief-stamp", sheet);
  stamp.setAttribute("aria-label", `Grade ${grade}: ${GRADE_WORD[grade]}`);
  el("b", "", stamp, grade);
  el("span", "", stamp, GRADE_WORD[grade]);
  const nums = el("dl", "debrief-nums", sheet);
  const counters: Array<{ dd: HTMLElement; to: number; fmt: (v: number) => string }> = [];
  const row = (k: string, label: string, to: number, fmt: (v: number) => string = (v) => String(Math.round(v))): void => {
    const d = el("div", `debrief-num is-${k}`, nums);
    el("dt", "", d, label);
    const dd = el("dd", "", d, fmt(calm ? to : 0));
    dd.dataset.k = k;
    dd.dataset.final = String(Math.round(to));
    counters.push({ dd, to, fmt });
  };
  row("scrip", "Scrip", l.scrip, (v) => `+${Math.round(v)}`);
  row("xp", "XP", l.xp, (v) => `+${Math.round(v)}`);
  row("kills", "Down", l.kills);
  row("headshots", "Headshots", l.headshots);
  row("takedowns", "Takedowns", l.takedowns);
  row("time", "Time", l.seconds, clock);
  el("p", "debrief-seen", sheet, l.spotted ? "They saw her coming." : "Nobody saw her.");

  // The stills: her best three kills.
  if (info.stills.length > 0) {
    const reel = el("ol", "debrief-stills", card);
    reel.setAttribute("aria-label", "Best kills");
    info.stills.forEach((s, i) => {
      const li = el("li", "case-print debrief-still", reel);
      cssVar(li, "--tilt", `${[2, -3, 1][i % 3]}deg`);
      cssVar(li, "--i", i);
      el("i", "case-pin", li);
      const img = el("img", "", li);
      img.src = s.src;
      img.alt = s.caption;
      el("b", "case-name", li, s.caption);
    });
  }

  // The keepsake, and the lines.
  const foot = el("div", "debrief-foot", card);
  if (info.keepsake) {
    const k = el("div", "debrief-keep", foot);
    el("em", "case-flag", k, `New ${info.keepsake.slot}`);
    el("b", "", k, info.keepsake.name);
    el("span", "", k, info.keepsake.lore);
    el("small", "", k, "In the wardrobe at the office.");
  }
  const lines = el("div", "debrief-lines", foot);
  el("p", "debrief-cath", lines, cathLine(grade));
  const bea = beaText(l);
  if (bea) el("p", "debrief-bea", lines, bea);

  const close = (): void => {
    window.removeEventListener("keydown", onKey, true);
    cancelAnimationFrame(raf);
    wrap.remove();
    onClose();
  };
  const go = button("btn btn-primary", card, "Home to the office");
  go.addEventListener("click", close);
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === "Escape" || e.code === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.code === "Tab") trapTab(card, e);
  };
  window.addEventListener("keydown", onKey, true);
  go.focus({ preventScroll: true });

  // The count-up, after the cross and the stamp have landed.
  let raf = 0;
  if (!calm) {
    const t0 = performance.now() + 700;
    const tick = (now: number): void => {
      const u = Math.max(0, Math.min(1, (now - t0) / COUNT_MS));
      const e = 1 - Math.pow(1 - u, 3);
      for (const c of counters) c.dd.textContent = c.fmt(c.to * e);
      if (u < 1) raf = requestAnimationFrame(tick);
      else wrap.classList.add("is-counted");
    };
    raf = requestAnimationFrame(tick);
  } else wrap.classList.add("is-counted");
  return close;
}
