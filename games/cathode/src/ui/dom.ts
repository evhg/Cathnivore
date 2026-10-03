// Tiny DOM helpers for CATHODE's menus. CSP-safe by construction: text goes in through `textContent`,
// attributes through `setAttribute`, and any per-element number through a CSS custom property set with
// the CSSOM (`el.style.setProperty`), never a `style` attribute or innerHTML with data.

const SVG_NS = "http://www.w3.org/2000/svg";

/** Makes an element with a class, optional text and an optional parent. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  parent?: Element | null,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  parent?.append(e);
  return e;
}

/** Makes a button (type="button") with a class, text and parent. */
export function button(className: string, parent?: Element | null, text?: string): HTMLButtonElement {
  const b = el("button", className, parent, text);
  b.type = "button";
  return b;
}

/** Makes an SVG element with attributes. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element | null,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.append(e);
  return e;
}

/** Sets several attributes at once. */
export function attrs(e: Element, values: Record<string, string | number | boolean>): void {
  for (const [k, v] of Object.entries(values)) {
    if (v === false) e.removeAttribute(k);
    else e.setAttribute(k, v === true ? "" : String(v));
  }
}

/** Sets a CSS custom property through the CSSOM (allowed under `style-src 'self'`). */
export function cssVar(e: HTMLElement | SVGElement, name: string, value: string | number): void {
  e.style.setProperty(name, String(value));
}

/** True when the player asked for less motion. */
export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Every focusable element inside a root, in DOM order. */
export function focusables(root: Element): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((e) => !e.closest("[hidden]") && !e.closest("[inert]"));
}

/** Keeps Tab focus inside `root`: wraps from the last focusable to the first and back. */
export function trapTab(root: HTMLElement, ev: KeyboardEvent): void {
  if (ev.key !== "Tab") return;
  const list = focusables(root);
  if (list.length === 0) return;
  const first = list[0]!;
  const last = list[list.length - 1]!;
  const active = document.activeElement;
  if (ev.shiftKey && (active === first || !root.contains(active))) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && (active === last || !root.contains(active))) {
    ev.preventDefault();
    first.focus();
  }
}

/** Formats a number with thousands separators ("12,500"). */
export function num(v: number): string {
  return Math.round(v).toLocaleString("en-GB");
}
