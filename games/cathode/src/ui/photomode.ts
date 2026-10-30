import type { PerspectiveCamera } from "three";
import { WARDROBE, chosenOutfit } from "../../../../shared/cath/wardrobe";
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
export function snapshot(canvas: HTMLCanvasElement, css: string, polaroid = false): string {
  if (polaroid) return polaroidSnapshot(canvas, css);
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.filter = css;
  ctx.drawImage(canvas, 0, 0);
  return out.toDataURL("image/png");
}

/** A framed polaroid: cream border, thicker foot with a handwritten date, slight shadow margin. */
function polaroidSnapshot(canvas: HTMLCanvasElement, css: string): string {
  const w = canvas.width;
  const h = canvas.height;
  const side = Math.round(w * 0.04);
  const foot = Math.round(h * 0.16);
  const out = document.createElement("canvas");
  out.width = w + side * 2;
  out.height = h + side + foot;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.fillStyle = "#f3ecdc";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.save();
  ctx.filter = css;
  ctx.drawImage(canvas, side, side);
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = Math.max(2, side * 0.06);
  ctx.strokeRect(side, side, w, h);
  ctx.fillStyle = "#3a2f2a";
  ctx.font = `italic ${Math.round(foot * 0.32)}px "Segoe Print", "Bradley Hand", cursive`;
  ctx.textAlign = "center";
  ctx.fillText(`Night shift, ${new Date().toISOString().slice(0, 10)}`, out.width / 2, h + side + foot * 0.5);
  const worn = WARDROBE.find((w) => w.id === chosenOutfit())?.name ?? "";
  ctx.font = `italic ${Math.round(foot * 0.2)}px "Segoe Print", "Bradley Hand", cursive`;
  ctx.fillText(`Cath wore the ${worn.toLowerCase()}`, out.width / 2, h + side + foot * 0.78);
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
    bar.querySelectorAll(".photo-filter:not(.photo-frame)").forEach((b, i) => b.setAttribute("aria-pressed", String(i === idx)));
  };
  PHOTO_FILTERS.forEach((f, i) => {
    const b = button("photo-filter", bar, f.label);
    b.addEventListener("click", () => {
      idx = i;
      apply();
    });
  });
  let framed = true;
  const frame = button("photo-filter photo-frame", bar, "Polaroid");
  frame.setAttribute("aria-pressed", "true");
  frame.addEventListener("click", () => {
    framed = !framed;
    frame.setAttribute("aria-pressed", String(framed));
  });
  const save = button("photo-save", bar, "Save PNG");
  save.addEventListener("click", () => {
    rerender();
    const a = document.createElement("a");
    a.href = snapshot(canvas, (PHOTO_FILTERS[idx]?.css ?? "none"), framed);
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
