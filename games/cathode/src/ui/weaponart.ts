// Plan item 112: the class pick's starting weapon as line art on the dossier sheet: a side profile per weapon
// class, drawn in one ink (currentColor) with a hairline fill, muzzle to the right. Inline SVG, no style
// attributes (the CSP), so it stays crisp at any size.

import type { WeaponClass } from "../sim/types";

/** Outline paths (a 240x80 box, muzzle right) and detail lines per weapon class. */
const ART: Record<WeaponClass, { body: string; detail: string }> = {
  pistol: {
    body: "M62 24 H176 V38 H164 L160 42 H118 L112 66 Q110 72 104 72 H86 Q79 72 80 65 L86 42 H70 Q62 42 62 34 Z",
    detail: "M118 42 Q118 56 132 56 H140 L144 42 M134 28 V34 M140 28 V34 M146 28 V34 M152 28 V34 M176 28 H184 V34 H176 M88 50 H106",
  },
  revolver: {
    body: "M70 30 L78 24 H96 V22 H104 V26 H206 Q210 26 210 30 V34 Q210 36 206 36 H140 V40 Q140 48 132 48 H112 L104 52 L96 74 Q94 78 88 78 H72 Q64 78 66 70 L74 46 Q70 42 70 36 Z",
    detail: "M104 28 H138 V46 H104 Z M110 30 V44 M121 30 V44 M132 30 V44 M112 48 Q110 60 122 62 L126 48 M200 26 V21 H205 V26 M78 52 H94 M76 60 H92",
  },
  // Plan item 423: the Butcher's Street Sweeper as a short, fat drum-fed street gun (a skeleton stock, a drum
  // under the barrel), not a long gun with the Ghost's rifle's outline.
  shotgun: {
    body: "M22 30 H38 V35 H74 V30 H196 V44 H120 L112 50 H104 L96 70 Q94 74 88 74 H78 Q72 74 74 68 L82 46 H74 V42 H38 V60 H22 Z M126 44 Q126 74 150 74 Q174 74 174 50 V44 Z",
    detail: "M30 40 V52 M74 37 H196 M150 52 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M104 50 Q106 60 114 58 M196 32 H204 V36 H196",
  },
  sniper: {
    body: "M8 42 L60 34 H226 V40 H136 V46 H102 L94 50 L88 64 Q85 68 79 66 L68 60 L24 62 Q8 62 8 52 Z",
    detail: "M96 22 H156 Q160 22 160 26 V28 Q160 32 156 32 H96 Q92 32 92 28 V26 Q92 22 96 22 Z M108 32 V34 M144 32 V34 M86 26 H92 M160 26 H168 M94 50 Q98 60 108 58 L110 46 M200 40 L188 66 M206 40 L216 66 M226 35 H234 V39 H226",
  },
  smg: {
    body: "M40 30 H180 V42 H150 V60 Q150 64 146 64 H138 Q134 64 134 60 V42 H112 L106 66 Q104 72 98 72 H84 Q78 72 79 66 L86 42 H40 Z",
    detail: "M112 42 Q112 54 124 54 L128 42 M180 33 H190 V39 H180 M48 36 H70",
  },
  rifle: {
    body: "M10 40 L56 30 H204 V40 H160 V64 Q160 68 156 68 H146 Q142 68 142 64 V40 H118 L110 64 Q108 70 102 70 H90 Q84 70 85 64 L92 44 L22 58 Q10 58 10 48 Z",
    detail: "M118 40 Q118 52 130 52 L134 40 M96 22 H140 V30 M204 33 H222 V37 H204",
  },
  // Plan item 423: the Fixer's Bargain Bin as a launcher you can't take for a bar: a fat tube with a flared venturi
  // behind and a belled muzzle, a pistol grip, a foregrip and a raised sight block.
  launcher: {
    body: "M26 26 H194 L214 18 V58 L194 50 H26 L10 56 V20 Z M90 50 L83 72 Q82 76 87 76 H97 L104 50 Z M140 50 V68 Q140 70 142 70 H150 Q152 70 152 68 V50 Z M108 26 V14 Q108 12 110 12 H134 Q136 12 136 14 V26 Z",
    detail: "M60 26 V50 M64 26 V50 M180 26 V50 M184 26 V50 M104 50 Q104 62 114 62 L118 50 M114 19 H130 M26 38 H50",
  },
  // Plan item 423: the Wirewitch's Candor Seeker as a smart SMG, not a pistol with a sight: a boxy receiver with a
  // sensor block on top and its aerial, a long magazine ahead of the grip, a short wire stock, the cable looping
  // from the stock to the sensor.
  smart: {
    body: "M44 36 Q44 30 50 30 H68 V26 H172 V34 H188 V40 H172 V48 H136 V76 H124 V48 H112 L106 70 Q104 74 98 74 H88 Q82 74 84 68 L90 48 H72 L64 54 H50 Q44 54 44 48 Z M98 26 V14 Q98 12 100 12 H140 Q142 12 142 14 V26 Z",
    detail: "M150 26 L164 6 M112 48 Q112 60 122 60 M104 19 H136 M54 36 V48 M60 36 V48 M100 14 Q80 4 70 18 Q66 26 56 30 M172 30 H180 M124 56 H136 M124 64 H136",
  },
  melee: {
    body: "M30 36 H170 L200 40 L170 44 H30 Q24 44 24 40 Q24 36 30 36 Z",
    detail: "M70 36 V44 M74 36 V44 M78 36 V44 M82 36 V44 M86 36 V44 M90 36 V44",
  },
};

/** The weapon class's profile as an SVG string (decorative; the name sits beside it as text). */
export function weaponArtSvg(cls: WeaponClass): string {
  const a = ART[cls] ?? ART.pistol;
  return `<svg class="wa wa-${cls}" viewBox="0 0 240 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<path class="wa-body" d="${a.body}" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
<path class="wa-detail" d="${a.detail}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>
</svg>`;
}

export const WEAPON_ART_CLASSES = Object.keys(ART) as WeaponClass[];
