// Plan item 192: the district opener. A new case no longer cuts from the case file to play like a load: the frame
// letterboxes, a typed card writes the district, the hour and the name on The List, then the bars open and the HUD
// fades in. A tap, a click or Escape skips it at once; reduced motion gets the card whole, faded in and out.
// The HUD waits for it the way it waits for the area title (`area-arriving`, hud.css).

export interface OpenerCopy {
  /** The district, as the area title names it ("THE FISH MARKET"). */
  place: string;
  /** The hour and the weather ("02:14 · Drowned Market, low tide"). */
  time: string;
  /** The next name on The List, or null when the List is closed. */
  target: string | null;
}

export interface OpenerHandle {
  /** Resolves once the opener has gone (played out or skipped). */
  done: Promise<void>;
  skip(): void;
  /** How it ended, for tests. */
  readonly ended: "" | "played" | "skipped";
  /** performance.now() when it opened and when it went (0 while it runs), for tests. */
  readonly times: { start: number; end: number };
}

/** Total run (ms): bars in, the card typed and held, bars out. Inside item 192's 2.5-4.5 s. */
export const OPENER_MS = 3600;
const TYPE_FROM = 450;
const TYPE_MS = 1500;

/** The hour on the card: the night shift, a few minutes past two, varied by district so it isn't one stamp. */
export function openerHour(district: string | undefined): string {
  const m = { market: 14, clinic: 37, plaza: 52, tower: 9, vault: 26, office: 41 }[district ?? "market"] ?? 14;
  const h = district === "tower" || district === "vault" ? "03" : "02";
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function playOpener(host: HTMLElement, copy: OpenerCopy, opts: { still: boolean }): OpenerHandle {
  const root = document.createElement("div");
  root.className = "opener";
  root.dataset.cine = "opener";
  root.setAttribute("role", "status");
  root.toggleAttribute("data-still", opts.still);
  const lines = [copy.place, copy.time, copy.target ? `The List · ${copy.target}` : "The List is closed"];
  root.innerHTML =
    `<i class="opener-bar opener-bar-top"></i><i class="opener-bar opener-bar-bottom"></i>` +
    `<div class="opener-card">` +
    `<p class="opener-place" aria-label="${lines[0]}"></p>` +
    `<p class="opener-time" aria-label="${lines[1]}"></p>` +
    `<p class="opener-target" aria-label="${lines[2]}"></p>` +
    `<span class="opener-skip">${matchMedia("(pointer: coarse)").matches ? "Tap to skip" : "Click or Esc to skip"}</span>` +
    `</div>`;
  const slots = [...root.querySelectorAll<HTMLElement>(".opener-card p")];
  host.append(root);

  let ended: OpenerHandle["ended"] = "";
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const t0 = performance.now();
  const times = { start: t0, end: 0 };
  let raf = 0;
  const total = lines.reduce((a, l) => a + l.length, 0);

  const paint = (k: number) => {
    // The lines type in order, one character budget shared across them.
    let left = Math.round(total * k);
    lines.forEach((l, i) => {
      const n = Math.max(0, Math.min(l.length, left));
      left -= n;
      slots[i]!.textContent = l.slice(0, n);
      slots[i]!.classList.toggle("is-typing", n > 0 && n < l.length);
    });
  };

  const finish = (how: "played" | "skipped") => {
    if (ended) return;
    ended = how;
    cancelAnimationFrame(raf);
    clearTimeout(outTimer);
    clearTimeout(endTimer);
    removeEventListener("keydown", onKey, true);
    root.removeEventListener("pointerdown", onTap);
    root.dataset.ended = how;
    times.end = performance.now();
    root.remove();
    resolve();
  };

  const tick = () => {
    const t = performance.now() - t0;
    paint(opts.still ? 1 : Math.max(0, Math.min(1, (t - TYPE_FROM) / TYPE_MS)));
    if (t < TYPE_FROM + TYPE_MS + 50) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  paint(opts.still ? 1 : 0);
  void root.offsetWidth;
  root.classList.add("is-in");
  const outTimer = window.setTimeout(() => root.classList.add("is-out"), OPENER_MS - 500);
  const endTimer = window.setTimeout(() => finish("played"), OPENER_MS);

  function onKey(e: KeyboardEvent): void {
    if (e.key !== "Escape" && e.key !== "Enter" && e.key !== " ") return;
    // Escape skips the opener only: it must not also open the pause menu underneath.
    e.preventDefault();
    e.stopImmediatePropagation();
    finish("skipped");
  }
  function onTap(e: PointerEvent): void {
    e.preventDefault();
    finish("skipped");
  }
  addEventListener("keydown", onKey, true);
  root.addEventListener("pointerdown", onTap);

  return {
    done,
    skip: () => finish("skipped"),
    get ended() {
      return ended;
    },
    times,
  };
}
