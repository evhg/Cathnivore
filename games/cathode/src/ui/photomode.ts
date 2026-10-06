import type { PerspectiveCamera } from "three";
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
export function openPhotoMode(parent: Element, canvas: HTMLCanvasElement, rerender: () => void, onClose: () => void, camera?: PerspectiveCamera): () => void {
  const wrap = el("div", "photo-mode", parent);
  parent.classList.add("photo-on");
  const bar = el("div", "photo-bar", wrap);
  let idx = 0;
  const apply = () => {
    canvas.style.filter = (PHOTO_FILTERS[idx]?.css ?? "none");
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
    a.href = snapshot(canvas, (PHOTO_FILTERS[idx]?.css ?? "none"));
    a.download = "cathode-photo.png";
    a.click();
  });
  // Free camera: WASD slides, Q/E down and up, drag looks, the slider sets the field of view.
  const held = new Set<string>();
  let raf = 0;
  let free = 0;
  let dragging = false;
  const onDown = () => (dragging = true);
  const onUp = () => (dragging = false);
  const onMove = (e: MouseEvent) => {
    if (!camera || !dragging) return;
    camera.rotation.order = "YXZ";
    camera.rotation.y -= e.movementX * 0.003;
    camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x - e.movementY * 0.003));
    rerender();
  };
  const step = (t: number) => {
    const dt = Math.min(0.1, (t - free) / 1000);
    free = t;
    if (camera && held.size) {
      const f = (held.has("KeyW") ? 1 : 0) - (held.has("KeyS") ? 1 : 0);
      const r = (held.has("KeyD") ? 1 : 0) - (held.has("KeyA") ? 1 : 0);
      const u = (held.has("KeyE") ? 1 : 0) - (held.has("KeyQ") ? 1 : 0);
      const fast = held.has("ShiftLeft") ? 3 : 1;
      camera.translateZ(-f * 3 * fast * dt);
      camera.translateX(r * 3 * fast * dt);
      camera.position.y += u * 3 * fast * dt;
      rerender();
    }
    raf = requestAnimationFrame(step);
  };
  if (camera) {
    const row = el("label", "photo-fov", bar);
    row.append("Zoom ");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "20";
    slider.max = "90";
    slider.value = String(Math.round(camera.fov));
    slider.addEventListener("input", () => {
      camera.fov = Number(slider.value);
      camera.updateProjectionMatrix();
      rerender();
    });
    row.append(slider);
    canvas.addEventListener("mousedown", onDown);
    addEventListener("mouseup", onUp);
    addEventListener("mousemove", onMove);
    raf = requestAnimationFrame((t) => {
      free = t;
      step(t);
    });
  }
  const onKeyDown = (e: KeyboardEvent) => held.add(e.code);
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.code);
  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
  const done = button("photo-done", bar, "Done");
  const close = () => {
    cancelAnimationFrame(raf);
    removeEventListener("keydown", onKey);
    removeEventListener("keydown", onKeyDown);
    removeEventListener("keyup", onKeyUp);
    removeEventListener("mouseup", onUp);
    removeEventListener("mousemove", onMove);
    canvas.removeEventListener("mousedown", onDown);
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
