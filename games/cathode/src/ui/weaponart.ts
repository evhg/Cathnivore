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
  shotgun: {
    body: "M10 40 L64 30 H220 V38 H178 V46 H112 L100 50 L92 62 Q88 66 82 64 L70 58 L22 60 Q10 60 10 50 Z",
    detail: "M64 38 H220 M128 38 V46 M140 38 V46 M152 38 V46 M164 38 V46 M100 50 Q104 60 114 58 L116 50 M220 32 H228 V36 H220",
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
  launcher: {
    body: "M20 26 H210 Q216 26 216 32 V44 Q216 50 210 50 H20 Q14 50 14 44 V32 Q14 26 20 26 Z",
    detail: "M100 50 L94 70 Q92 74 86 74 H78 L84 50 M140 50 L136 64 H124 M60 26 V50 M180 26 V50 M110 16 H150 V26",
  },
  smart: {
    body: "M54 26 H186 V42 H160 L156 46 H118 L112 68 Q110 74 103 74 H86 Q79 74 80 67 L86 46 H66 Q54 46 54 36 Z",
    detail: "M118 46 Q118 58 132 58 H140 L144 46 M96 16 H134 V26 M120 34 H176 M186 30 H196 V38 H186",
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
