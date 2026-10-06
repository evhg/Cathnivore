import { button, el } from "./dom";

/** Filter presets for photo mode: a CSS filter for the preview and the same string for the saved PNG. */
export const PHOTO_FILTERS: ReadonlyArray<{ id: string; label: string; css: string }> = [
  { id: "none", label: "As shot", css: "none" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.25) brightness(0.95)" },
  { id: "neon", label: "Neon", css: "saturate(1.7) contrast(1.1) hue-rotate(-12deg)" },
  { id: "warm", label: "Warm", css: "sepia(0.45) saturate(1.2) contrast(1.05)" },
  { id: "soft", label: "Soft", css: "blur(1.2px) brightness(1.08) saturate(1.1)" },
];

/** Copies the canvas into a PNG data URL with a filter applied (the canvas must have just been rendered). */
export function snapshot(canvas: HTMLCanvasElement, css: string): string {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.filter = css;
  ctx.drawImage(canvas, 0, 0);
  return out.toDataURL("image/png");
}

/** Photo mode (B): the world holds still, the HUD hides, and the player picks a filter and saves a PNG. Returns close. */
export function openPhotoMode(parent: Element, canvas: HTMLCanvasElement, rerender: () => void, onClose: () => void): () => void {
  const wrap = el("div", "photo-mode", parent);
  parent.classList.add("photo-on");
  const bar = el("div", "photo-bar", wrap);
  let idx = 0;
  const apply = () => {
    canvas.style.filter = PHOTO_FILTERS[idx].css;
    bar.querySelectorAll(".photo-filter").forEach((b, i) => b.setAttribute("aria-pressed", String(i === idx)));
  };
  PHOTO_FILTERS.forEach((f, i) => {
    const b = button("photo-filter", bar, f.label);
    b.addEventListener("click", () => {
      idx = i;
      apply();
    });
  });
  const save = button("photo-save", bar, "Save PNG");
  save.addEventListener("click", () => {
    rerender();
    const a = document.createElement("a");
    a.href = snapshot(canvas, PHOTO_FILTERS[idx].css);
    a.download = "cathode-photo.png";
    a.click();
  });
  const done = button("photo-done", bar, "Done");
  const close = () => {
    removeEventListener("keydown", onKey);
    canvas.style.filter = "";
    wrap.remove();
    parent.classList.remove("photo-on");
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "Escape" || e.code === "KeyB") close();
  };
  addEventListener("keydown", onKey);
  done.addEventListener("click", close);
  apply();
  return close;
}
