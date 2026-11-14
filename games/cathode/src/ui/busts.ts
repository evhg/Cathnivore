// Head-and-shoulders busts of the four names on the List (plan item 9): Julian Crisp, Dr Octavia Vane,
// Councillor Marcus Pell and the Chair of the Board. They read as surveillance stills from Bea's file: warm
// greyscale lit hard from the left, film grain, and the one accent red (a pocket square, a fleck of blood, a
// rosette, a lapel pin). Inline SVG so they stay crisp at any size, on the case board and in the boss intros.

export type BustId = "crisp" | "vane" | "pell" | "chair" | "reed" | "mind";

export const BUSTS: readonly BustId[] = ["crisp", "vane", "pell", "chair", "reed", "mind"];

/** Who the bust shows, for alt text and the case board caption. */
export const BUST_NAMES: Record<BustId, string> = {
  crisp: "Julian Crisp",
  vane: "Dr Octavia Vane",
  pell: "Councillor Marcus Pell",
  chair: "The Chair of the Board",
  reed: "Tomas Reed",
  mind: "The Mind Under the River",
};

/** The case each bust is pinned to on the board (ids from `sim/casefile.ts`). */
export const BUST_FOR_CASE: Record<string, BustId> = {
  crispBoss: "crisp",
  vaneBoss: "vane",
  pellBoss: "pell",
  boardBoss: "chair",
  vaultBoss: "mind",
};

/** The bust shown under a boss intro's name (matched on the banner title). */
export function bustForBanner(title: string): BustId | null {
  if (/crisp/i.test(title)) return "crisp";
  if (/vane/i.test(title)) return "vane";
  if (/pell/i.test(title)) return "pell";
  if (/chair/i.test(title)) return "chair";
  return null;
}

// Tones: paper, three skin greys, cloth and night. One red.
const P = "#ece6da";
const SKIN = "#c7beb1";
const SKIN_MID = "#9a9186";
const SKIN_DK = "#5f5850";
const INK = "#121318";
const CLOTH = "#23262f";
const CLOTH_HI = "#3a3e4a";
const RED = "#c8102e";

let uid = 0;

/** Shared frame: a dark ground with a soft key glow behind the head, grain, a vignette. */
function frame(id: string, body: string, glow = 0.5): string {
  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" class="bust bust-${id}">
<defs>
<radialGradient id="g${id}" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="#4a4740" stop-opacity="${glow}"/><stop offset="1" stop-color="#0a0b0e" stop-opacity="0"/></radialGradient>
<radialGradient id="v${id}" cx="50%" cy="45%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
<linearGradient id="s${id}" x1="0" x2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
<filter id="n${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
</defs>
<rect width="200" height="240" fill="#0b0c10"/>
<rect width="200" height="240" fill="url(#g${id})"/>
${body}
<rect width="200" height="240" fill="url(#s${id})"/>
<rect width="200" height="240" fill="#fff" filter="url(#n${id})"/>
<rect width="200" height="240" fill="url(#v${id})"/>
</svg>`;
}

// Plan item 371: Crisp's head sculpted like Reed's: a lean, sly face with cheek planes, hooded eyes and a groomed shine.
function crisp(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
<defs><linearGradient id="ck${id}" x1="0" x2="1"><stop offset="0" stop-color="#d8d0c3"/><stop offset=".5" stop-color="${SKIN}"/><stop offset=".72" stop-color="${SKIN_MID}"/><stop offset="1" stop-color="#6e665c"/></linearGradient></defs>
<!-- double-breasted pinstripe, wide peaked lapels -->
<path d="M0 240 L4 196 C20 178 50 170 72 166 L100 182 L128 166 C150 170 180 178 196 196 L200 240 Z" fill="${CLOTH}"/>
<g stroke="${CLOTH_HI}" stroke-width=".8" opacity=".7">${[14, 26, 38, 50, 150, 162, 174, 186].map((x) => `<line x1="${x}" y1="${x < 100 ? 240 : 240}" x2="${x < 100 ? x + 8 : x - 8}" y2="182"/>`).join("")}</g>
<path d="M72 166 L100 182 L86 240 L58 240 L50 200 L64 196 Z" fill="${CLOTH_HI}"/>
<path d="M128 166 L100 182 L114 240 L142 240 L150 200 L136 196 Z" fill="#2c303a"/>
<!-- shirt, tie and pin -->
<path d="M84 160 L100 182 L116 160 L112 152 L88 152 Z" fill="${P}"/>
<path d="M96 170 L104 170 L107 240 L93 240 Z" fill="${INK}"/>
<rect x="94" y="196" width="12" height="2.4" fill="${SKIN}"/>
<!-- pocket square -->
<path d="M146 208 L160 204 L163 212 L149 216 Z" fill="${RED}"/><path d="M148 206 L152 199 L156 205 Z" fill="${RED}"/>
<!-- neck: lean, the far side in shadow -->
<path d="M87 130 L113 130 L115 158 C108 164 92 164 85 158 Z" fill="${SKIN_MID}"/>
<path d="M104 134 L113 130 L115 158 C111 161 108 162 105 162 Z" fill="${SKIN_DK}" opacity=".6"/>
<!-- ears, the near one lit -->
<path d="M72 92 C65 88 63 104 67 112 C69 117 72 116 74 112 Z" fill="${SKIN_MID}"/>
<path d="M70 97 C67 100 67 107 70 110" stroke="${SKIN_DK}" stroke-width="1.1" fill="none"/>
<path d="M128 92 C135 88 137 104 133 112 C131 117 128 116 126 112 Z" fill="${SKIN_DK}"/>
<!-- a lean face: high cheekbones, hollow cheeks, a narrow pointed chin -->
<path d="M72 88 C72 60 85 48 100 48 C115 48 128 60 128 88 C129 104 127 116 121 128 C115 140 107 150 100 151 C93 150 85 140 79 128 C73 116 71 104 72 88 Z" fill="url(#ck${id})"/>
<path d="M110 50 C122 56 128 68 128 88 C129 104 127 116 121 128 C115 140 107 150 100 151 C107 140 112 126 113 110 C114 92 115 70 110 50 Z" fill="${SKIN_DK}" opacity=".55"/>
<path d="M77 112 C80 122 86 130 92 134 C86 124 82 118 80 108 Z" fill="${SKIN_MID}" opacity=".8"/>
<path d="M123 112 C120 122 114 130 108 134 C114 124 118 118 120 108 Z" fill="${SKIN_DK}" opacity=".8"/>
<ellipse cx="82" cy="106" rx="6.5" ry="3" fill="#ece5d8" opacity=".55" transform="rotate(-24 82 106)"/>
<ellipse cx="92" cy="80" rx="12" ry="4.4" fill="#ece5d8" opacity=".4"/>
<ellipse cx="99" cy="145" rx="4.5" ry="2.2" fill="#ece5d8" opacity=".35"/>
<!-- a close shave's shadow on the jaw -->
<path d="M78 124 C84 140 92 149 100 151 C108 149 116 140 122 124 C118 140 110 148 100 149 C90 148 82 140 78 124 Z" fill="#4a4e58" opacity=".25"/>
<!-- brows: the left one cocked -->
<path d="M77 92 C82 85 90 84 97 88 C90 87.4 83 88.6 78 93 Z" fill="${INK}"/>
<path d="M103 90 C108 88 115 88 123 91 C116 90 109 90.4 103 92 Z" fill="${INK}"/>
${sculptedEye(id, 87, true)}${sculptedEye(id, 113, false)}
<!-- hoods over the eyes: half-shut, amused -->
<path d="M76 99.4 C80 95.2 94 95 98 99.6 L98 98 C94 93.6 80 94 76 98 Z" fill="${SKIN_MID}"/>
<path d="M102 99.6 C106 95.6 120 95.6 124 99.6 L124 98 C120 94 106 94 102 98 Z" fill="${SKIN_DK}"/>
<!-- a long straight nose: the lit bridge, the tip, the nostrils -->
<path d="M99 98 C98.6 106 97.6 114 96 120 C95 122 95 124 97 124.6" stroke="${SKIN_DK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
<path d="M96.4 100 C96 108 95.6 114 94.8 118" stroke="#ece5d8" stroke-width="1.8" fill="none" opacity=".6" stroke-linecap="round"/>
<path d="M102 100 C105 108 107 116 107 121 C104 124 100 124.6 98 124 Z" fill="${SKIN_MID}" opacity=".8"/>
<path d="M92 121 C92.4 124.6 95 125.6 97.6 124.4 M102.4 124.4 C105 125.6 107.6 124.6 108 121" stroke="${SKIN_DK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
<!-- the pencil moustache and the smirk, higher on his left -->
<path d="M89 129.4 C94 127.2 99 127.6 100 128.4 C101 127.6 106 127 112 128.2" stroke="${INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
<path d="M90 133.4 C95 134.6 103 134.4 108 132.4 C110 131.4 112 130 113.4 128.8" stroke="#2c2622" stroke-width="1.5" fill="none" stroke-linecap="round"/>
<path d="M92 134.6 C96 137.6 104 137.4 108 133.6 C104 135.4 96 135.6 92 134.6 Z" fill="#a39a8e"/>
<path d="M113.6 128.4 C115 127.6 116 128.4 116 129.6" stroke="${SKIN_DK}" stroke-width="1" fill="none"/>
<path d="M87 120 C85 126 85 130 87 134" stroke="${SKIN_DK}" stroke-width="1" fill="none" opacity=".5"/>
<!-- slicked hair, swept straight back: the comb's grooves and a hard shine band -->
<path d="M70 88 C66 50 82 30 104 30 C128 30 140 50 132 88 C131 76 128 70 121 68 C108 63 88 64 78 71 C73 76 71 82 70 88 Z" fill="${INK}"/>
<g stroke="#3d3f47" stroke-width="1.1" fill="none" stroke-linecap="round">${[0, 1, 2, 3, 4, 5].map((k) => `<path d="M${80 + k * 8} ${66 - k * 0.6} C${84 + k * 6} ${52 - k} ${98 + k * 3} ${40 + k * 0.4} ${116 + k * 2} ${40 + k * 1.6}"/>`).join("")}</g>
<path d="M76 56 C88 40 110 35 128 47" stroke="#8a877e" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".85"/>
<path d="M80 52 C92 43 108 40 120 44" stroke="#5a5852" stroke-width="1.2" fill="none"/>
<path d="M71 88 C70 84 70 78 72 74" stroke="#3e3f46" stroke-width="2" fill="none"/>
<!-- rim light on the lit side -->
<path d="M72.6 90 C72.4 104 74.4 118 80 128" stroke="${P}" stroke-width=".9" fill="none" opacity=".4"/>
`,
  );
}

// Plan item 371: Vane sculpted like Reed and Crisp: face planes, real eyes behind her wire glasses, a green-ink pen.
function vane(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
<defs><linearGradient id="vk${id}" x1="0" x2="1"><stop offset="0" stop-color="#dcd4c7"/><stop offset=".5" stop-color="${SKIN}"/><stop offset=".72" stop-color="${SKIN_MID}"/><stop offset="1" stop-color="#6e665c"/></linearGradient></defs>
<!-- white coat with a high collar over dark scrubs -->
<path d="M0 240 L6 194 C24 176 52 170 74 168 L100 196 L126 168 C148 170 176 176 194 194 L200 240 Z" fill="#b9b3a8"/>
<path d="M120 170 C148 172 176 178 194 194 L200 240 L130 240 Z" fill="#8b857b"/>
<path d="M74 168 L100 196 L92 240 L66 240 L58 196 Z" fill="#d6d0c4"/><path d="M126 168 L100 196 L108 240 L134 240 L142 196 Z" fill="#9c968b"/>
<path d="M88 160 L100 196 L112 160 Z" fill="#2f3a3a"/>
<!-- a fleck of someone's blood on the lapel -->
<circle cx="76" cy="206" r="2.6" fill="${RED}"/><circle cx="82" cy="211" r="1.3" fill="${RED}"/><circle cx="72" cy="214" r="1" fill="${RED}"/>
<!-- stethoscope -->
<path d="M70 176 C64 200 72 222 90 228 M130 176 C136 200 128 222 110 228" stroke="#2a2c33" stroke-width="2.6" fill="none"/>
<circle cx="100" cy="230" r="6" fill="#55585f"/><circle cx="100" cy="230" r="3.4" fill="#8e9097"/>
<!-- neck, mask pulled down -->
<path d="M88 134 L112 134 L114 160 C106 165 94 165 86 160 Z" fill="${SKIN_MID}"/>
<path d="M80 148 C88 160 112 160 120 148 L122 160 C110 170 90 170 78 160 Z" fill="#a9b1ad"/>
<path d="M84 156 L116 156" stroke="#86908b" stroke-width="1"/>
<!-- a green-ink pen clipped in the breast pocket -->
<path d="M131 186 L133 210" stroke="#2e3a33" stroke-width="3.2" stroke-linecap="round"/><path d="M131 186 L131.6 194" stroke="#9aa39c" stroke-width="1.2"/>
<!-- ears under the bob, the near one lit -->
<path d="M75 94 C69 92 68 104 72 110 L76 108 Z" fill="${SKIN_MID}"/>
<!-- a fine, narrow face: high cheekbones, a small pointed chin -->
<path d="M74 86 C74 58 86 44 100 44 C114 44 126 58 126 86 C126 106 122 122 114 134 C109 142 104 146 100 146 C96 146 91 142 86 134 C78 122 74 106 74 86 Z" fill="url(#vk${id})"/>
<path d="M108 46 C120 50 126 64 126 86 C126 106 122 122 114 134 C109 142 104 146 100 146 C105 138 110 126 111 110 C112 92 112 64 108 46 Z" fill="${SKIN_DK}" opacity=".5"/>
<path d="M79 108 C82 118 87 126 92 130 C87 120 84 114 82 104 Z" fill="${SKIN_MID}" opacity=".7"/>
<path d="M121 108 C118 118 113 126 108 130 C113 120 116 114 118 104 Z" fill="${SKIN_DK}" opacity=".7"/>
<ellipse cx="84" cy="104" rx="6" ry="2.8" fill="#efe8db" opacity=".55" transform="rotate(-22 84 104)"/>
<ellipse cx="99" cy="141" rx="4" ry="2" fill="#efe8db" opacity=".35"/>
<!-- thin, level brows -->
<path d="M79 82 C84 79.6 90 79.4 96 81 C90 81 84 81.6 79.6 83.4 Z" fill="${INK}"/>
<path d="M104 81 C110 79.4 116 79.6 121 82 C116 81.6 110 81 104.4 82.6 Z" fill="${INK}"/>
<!-- cold, level eyes (the shared sculpted eye, set higher in her face), a fine lash line -->
<g transform="translate(88 92) scale(.84) translate(-87 -100)">${sculptedEye(id, 87, true)}</g><g transform="translate(112 92) scale(.84) translate(-113 -100)">${sculptedEye(id, 113, false)}</g>
<path d="M78 92 l-2.4 -1.6 M122 92 l2.4 -1.6" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
<!-- a straight, fine nose -->
<path d="M100 96 C99.4 104 98.4 109 97 113 C98 115 101 115.6 103.6 114" stroke="${SKIN_DK}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<path d="M97.6 98 C97.2 104 96.8 108 96 111" stroke="#efe8db" stroke-width="1.6" fill="none" opacity=".6" stroke-linecap="round"/>
<path d="M102 98 C104.6 105 106 110 105.6 113.6 C103 115 100.6 115.2 99 114.6 Z" fill="${SKIN_MID}" opacity=".7"/>
<!-- a thin mouth in dark lipstick, the upper lip's bow, a lit lower lip -->
<path d="M89 123.6 C93 121.6 97 121.2 100 122.6 C103 121.2 107 121.6 111 123.6 C106 124.6 103 124.8 100 124.6 C97 124.8 94 124.6 89 123.6 Z" fill="#3b2a2c"/>
<path d="M90 124.2 C95 128 105 128 110 124.2 C105 125.6 95 125.6 90 124.2 Z" fill="#5a4044"/>
<path d="M95 126.4 C98 127.2 101 127.2 104 126.4" stroke="#8a7a76" stroke-width=".8" fill="none" opacity=".7"/>
<!-- severe bob with a blunt fringe: the hair's sheen and its cut edge -->
<path d="M70 132 C64 104 64 70 76 52 C86 38 114 36 126 50 C138 66 138 104 130 132 L124 132 C126 110 126 92 124 76 L76 76 C74 92 74 112 76 132 Z" fill="${INK}"/>
<path d="M74 78 C76 58 88 46 100 46 C112 46 124 56 126 78 Z" fill="${INK}"/>
<path d="M74 77 L126 77" stroke="#3b3c42" stroke-width="1.4"/>
<g stroke="#2a2b31" stroke-width="1" fill="none">${[0, 1, 2, 3, 4].map((k) => `<path d="M${80 + k * 9} 76 C${80 + k * 9} 64 ${84 + k * 7} 52 ${92 + k * 4} 46"/>`).join("")}</g>
<path d="M80 60 C88 50 104 48 116 52" stroke="#6e6b64" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path d="M68 104 C67 116 68 126 71 132" stroke="#5e5b55" stroke-width="1.4" fill="none" opacity=".8"/>
<!-- round wire glasses: the near lens catches the flash -->
<g fill="none" stroke="#b9b4aa" stroke-width="1.3"><circle cx="88" cy="92" r="9.4"/><circle cx="112" cy="92" r="9.4"/><path d="M97.4 91 C99 89 101 89 102.6 91 M78.6 90 L74 88 M121.4 90 L126 88"/></g>
<circle cx="88" cy="92" r="9.4" fill="#fff" opacity=".07"/>
<path d="M81 87 C83 85 85 84 87 84" stroke="${P}" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>
<path d="M106 87.6 C107.6 86 109 85.4 110.6 85.4" stroke="${P}" stroke-width="1" stroke-linecap="round" opacity=".5"/>
<!-- rim light on the lit side -->
<path d="M75 86 C74.6 100 77 116 84 128" stroke="${P}" stroke-width=".9" fill="none" opacity=".4"/>
`,
  );
}

// Plan item 371: Pell sculpted like Reed, Crisp and Vane: a heavy, jowly councillor in his sixties, the campaign
// smile pushing up round cheeks and creasing the eyes, a silver comb-over, the chain of office over a soft navy suit.
function pell(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
<defs><linearGradient id="pk${id}" x1="0" x2="1"><stop offset="0" stop-color="#ddd3c4"/><stop offset=".48" stop-color="${SKIN}"/><stop offset=".72" stop-color="${SKIN_MID}"/><stop offset="1" stop-color="#6a6258"/></linearGradient>
<radialGradient id="pa${id}" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#f1e9dc" stop-opacity=".75"/><stop offset="1" stop-color="#f1e9dc" stop-opacity="0"/></radialGradient></defs>
<!-- navy suit, broad and soft, notched lapels, with the chain of office across it -->
<path d="M0 240 L0 192 C18 172 48 164 72 162 L100 184 L128 162 C152 164 182 172 200 192 L200 240 Z" fill="${CLOTH}"/>
<path d="M136 166 C160 170 184 178 200 192 L200 240 L150 240 Z" fill="#1a1d24"/>
<path d="M72 162 L100 184 L88 240 L60 240 L54 198 L64 194 Z" fill="${CLOTH_HI}"/><path d="M128 162 L100 184 L112 240 L140 240 L146 198 L136 194 Z" fill="#2c303a"/>
<path d="M72 162 L64 194 L54 198" stroke="#4a4f5c" stroke-width="1" fill="none"/>
<path d="M82 156 L100 184 L118 156 C110 160 90 160 82 156 Z" fill="${P}"/><path d="M106 160 L100 184 L118 156 Z" fill="#c9c2b5"/>
<path d="M95 166 L105 166 L108 240 L92 240 Z" fill="#4b4f5c"/><path d="M95 166 L105 166 L103 174 L97 174 Z" fill="#5d6272"/>
<g stroke="#5d6272" stroke-width="1.4" opacity=".6">${[0, 1, 2, 3, 4].map((k) => `<line x1="93" y1="${182 + k * 12}" x2="107" y2="${176 + k * 12}"/>`).join("")}</g>
<g fill="#b8ad96" stroke="#5f584b" stroke-width=".6">${Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      const x = 40 + t * 120;
      const y = 186 + Math.sin(t * Math.PI) * 30;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.4" ry="3" transform="rotate(${((t - 0.5) * -50).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/><ellipse cx="${(x - 1).toFixed(1)}" cy="${(y - 1).toFixed(1)}" rx="1.6" ry="1" fill="#efe6d2" stroke="none"/>`;
    }).join("")}</g>
<circle cx="100" cy="222" r="9" fill="#c2b79f" stroke="#5f584b" stroke-width="1"/><circle cx="100" cy="222" r="4.5" fill="none" stroke="#5f584b" stroke-width="1"/><path d="M94 217 C96 215 99 214 101 214" stroke="#f3ead6" stroke-width="1.2" fill="none"/>
<!-- the red rosette on his lapel -->
<g transform="translate(66 196)"><circle r="9" fill="${RED}"/><circle r="5.5" fill="#8c0b20"/><circle r="2.4" fill="${RED}"/><path d="M-4 7 L-7 20 L-2 16 L1 21 L3 8 Z" fill="${RED}"/></g>
<!-- a thick neck over the collar, the far side in shadow, a soft double chin -->
<path d="M80 126 L120 126 L124 156 C112 164 88 164 76 156 Z" fill="${SKIN_MID}"/>
<path d="M108 128 L120 126 L124 156 C118 160 112 161 108 161 Z" fill="${SKIN_DK}" opacity=".6"/>
<path d="M82 146 C90 156 110 156 118 146 C114 154 106 158 100 158 C94 158 86 154 82 146 Z" fill="${SKIN_DK}" opacity=".35"/>
<!-- ears, the near one lit -->
<path d="M68 86 C60 82 58 100 63 108 C65 112 69 112 70 108 Z" fill="${SKIN_MID}"/>
<path d="M66 91 C63 95 63 102 66 105" stroke="${SKIN_DK}" stroke-width="1.1" fill="none"/>
<path d="M132 86 C140 82 142 100 137 108 C135 112 131 112 130 108 Z" fill="${SKIN_DK}"/>
<!-- a broad, fleshy face: full cheeks, heavy jowls, a soft jaw -->
<path d="M68 84 C68 54 82 40 100 40 C118 40 132 54 132 84 C133 100 134 112 131 124 C128 136 120 144 110 148 C106 150 103 151 100 151 C97 151 94 150 90 148 C80 144 72 136 69 124 C66 112 67 100 68 84 Z" fill="url(#pk${id})"/>
<path d="M110 42 C124 48 132 62 132 84 C133 100 134 112 131 124 C128 136 120 144 110 148 C106 150 103 151 100 151 C108 144 114 132 116 116 C118 96 118 64 110 42 Z" fill="${SKIN_DK}" opacity=".5"/>
<!-- the jowls hanging past the smile, shaded under -->
<path d="M72 120 C74 134 82 142 92 146 C86 140 80 132 78 120 Z" fill="${SKIN_MID}" opacity=".85"/>
<path d="M128 120 C126 134 118 142 108 146 C114 140 120 132 122 120 Z" fill="${SKIN_DK}" opacity=".85"/>
<!-- the apples of the cheeks, pushed up by the smile and catching the flash -->
<ellipse cx="83" cy="106" rx="11" ry="8" fill="url(#pa${id})"/>
<ellipse cx="117" cy="106" rx="9" ry="7" fill="${SKIN_MID}" opacity=".55"/>
<path d="M74 110 C76 116 80 118 84 118" stroke="${SKIN_MID}" stroke-width="1.6" fill="none" opacity=".7"/>
<!-- the forehead's lit dome and two lines across it -->
<ellipse cx="92" cy="60" rx="15" ry="7" fill="#efe7da" opacity=".45"/>
<path d="M82 66 C92 63 104 63 116 66 M84 72 C94 69.6 104 69.6 114 72" stroke="${SKIN_MID}" stroke-width="1" fill="none" opacity=".75"/>
<!-- heavy grey brows, raised in the middle -->
<path d="M76 82 C80 76 88 74 96 78 C90 77.6 84 78.6 77 84 Z" fill="#5c5850"/>
<path d="M104 78 C112 74 120 76 124 82 C118 78.6 110 77.6 104 79.6 Z" fill="#4a463f"/>
<g stroke="#8d877c" stroke-width=".8" opacity=".8"><path d="M80 79 l3 -1.6 M86 77 l3 -1 M110 76.6 l3 1 M116 78 l3 1.6"/></g>
<!-- eyes narrowed by the smile: the shared eye under a lowered lid, crow's feet -->
<g transform="translate(87 90) scale(.9 .8) translate(-87 -100)">${sculptedEye(id, 87, true)}</g><g transform="translate(113 90) scale(.9 .8) translate(-113 -100)">${sculptedEye(id, 113, false)}</g>
<path d="M77 88.6 C81 85.6 93 85.4 97 88.6 L97 87.2 C93 84 81 84.2 77 87.4 Z" fill="${SKIN_MID}"/>
<path d="M103 88.6 C107 85.4 119 85.6 123 88.6 L123 87.4 C119 84.2 107 84 103 87.2 Z" fill="${SKIN_DK}"/>
<g stroke="${SKIN_DK}" stroke-width=".9" fill="none" opacity=".7" stroke-linecap="round"><path d="M76 90 l-5 -2.4 M76 92.4 l-5.4 .4 M76.4 94.6 l-4.6 2.6 M124 90 l5 -2.4 M124 92.4 l5.4 .4 M123.6 94.6 l4.6 2.6"/></g>
<!-- a broad, bulbous nose: the lit bridge and tip, the shadowed wing, the nostrils -->
<path d="M99 92 C98.4 100 97 106 95 110" stroke="${SKIN_DK}" stroke-width="1.1" fill="none" opacity=".7" stroke-linecap="round"/>
<path d="M96.6 94 C96.2 100 95.6 104 94.6 107" stroke="#efe7da" stroke-width="2" fill="none" opacity=".55" stroke-linecap="round"/>
<path d="M103 94 C106 102 109 108 109 113 C106 116 102 116.6 99 116 Z" fill="${SKIN_MID}" opacity=".85"/>
<ellipse cx="99" cy="112" rx="6" ry="4.6" fill="#d9cfc0"/><ellipse cx="97.6" cy="110.6" rx="2.6" ry="1.6" fill="#f1e9dc" opacity=".8"/>
<path d="M90 110 C89 114.6 92 117 95.6 116.4 M104.4 116.4 C108 117 111 114.6 110 110" stroke="${SKIN_DK}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<path d="M93.6 115.6 C95 116.6 96.6 116.6 97.4 115.8 M102.6 115.8 C103.4 116.6 105 116.6 106.4 115.6" stroke="#2c2622" stroke-width="1.3" fill="none"/>
<!-- the smile's deep folds from the nose's wings -->
<path d="M88 112 C82 118 80 124 82 130" stroke="${SKIN_DK}" stroke-width="1.6" fill="none" opacity=".65" stroke-linecap="round"/>
<path d="M112 112 C118 118 120 124 118 130" stroke="${SKIN_DK}" stroke-width="1.8" fill="none" opacity=".8" stroke-linecap="round"/>
<path d="M86.6 113 C82.6 118 81.6 123 82.4 127" stroke="#efe7da" stroke-width="1.2" fill="none" opacity=".4"/>
<!-- the campaign smile: the upper lip, all the teeth, the lower lip with its shine -->
<path d="M84 122 C92 120 97 120.6 100 121.4 C103 120.6 108 120 116 122 C110 133 90 133 84 122 Z" fill="#3a2826"/>
<path d="M86 122.6 C92 121.6 108 121.6 114 122.6 C112 125.6 88 125.6 86 122.6 Z" fill="${P}"/>
<path d="M88 124.6 C94 126 106 126 112 124.6 C109 128.4 91 128.4 88 124.6 Z" fill="#cfc7b8"/>
<g stroke="#a59d90" stroke-width=".6">${[90, 94, 98, 102, 106, 110].map((x) => `<line x1="${x}" y1="122.2" x2="${x}" y2="125"/>`).join("")}</g>
<path d="M84 122 C92 119.6 97 120 100 121 C103 120 108 119.6 116 122 C108 120.8 103 121.6 100 122.4 C97 121.6 92 120.8 84 122 Z" fill="#7c6660"/>
<path d="M86 124.6 C92 132 108 132 114 124.6 C110 133.6 90 133.6 86 124.6 Z" fill="#8f7670"/>
<path d="M93 130.6 C97 131.6 103 131.6 107 130.6" stroke="#c9b4ac" stroke-width="1" fill="none" opacity=".7" stroke-linecap="round"/>
<path d="M83 121 C82.6 123 83.4 124.6 84.6 125 M117 121 C117.4 123 116.6 124.6 115.4 125" stroke="${SKIN_DK}" stroke-width="1.2" fill="none"/>
<!-- the chin under it and its shadow -->
<ellipse cx="99" cy="141" rx="7" ry="3.4" fill="#efe7da" opacity=".35"/>
<path d="M90 136 C94 138 106 138 110 136" stroke="${SKIN_MID}" stroke-width="1.2" fill="none" opacity=".7"/>
<!-- silver hair, side-parted and combed over a thinning crown, grey at the temples -->
<path d="M66 84 C64 54 80 34 102 34 C124 34 138 52 134 84 C133 72 129 64 123 59 C110 52 88 52 78 60 C71 66 67 74 66 84 Z" fill="#8f8a80"/>
<path d="M81 49 C92 36 116 34 131 50 C126 54 120 56 112 54 C102 52 92 52 84 56 C82 54 81 52 81 49 Z" fill="#cdc8be"/>
<g stroke="#a9a397" stroke-width="1.1" fill="none" stroke-linecap="round">${[0, 1, 2, 3, 4].map((k) => `<path d="M${84 + k * 2} ${50 - k * 1.4} C${96 + k * 3} ${42 - k} ${112 + k * 2} ${42 + k * 0.4} ${128 - k} ${50 + k * 0.6}"/>`).join("")}</g>
<path d="M88 41 C100 35 116 36 126 43" stroke="#f1ece2" stroke-width="2" fill="none" opacity=".8" stroke-linecap="round"/>
<path d="M82 44 C81 47 81 50 82 53" stroke="#5f5b54" stroke-width="1.4" fill="none"/>
<path d="M67 82 C66 76 67 68 70 63" stroke="#c3beb4" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M133 82 C134 76 133 68 130 63" stroke="#6d6961" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<!-- rim light on the lit side -->
<path d="M69 70 C67 94 70 118 80 136" stroke="${P}" stroke-width="1.1" fill="none" opacity=".45"/>
`,
  );
}

// Plan item 371: the Chair sculpted like the others: a gaunt, patrician man in his seventies, white hair swept back
// from a high forehead, deep-set eyes behind rimless glasses, a long nose, a thin unsmiling mouth, a high collar and
// the Candor pin. In his own frame the Spire window backlights him and his face sinks into shadow (only the rim and
// the glasses catch the light); the booking room's flash drops that set and shows the face.
function chair(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
<defs><linearGradient id="hk${id}" x1="0" x2="1"><stop offset="0" stop-color="#d6cec2"/><stop offset=".46" stop-color="${SKIN}"/><stop offset=".7" stop-color="${SKIN_MID}"/><stop offset="1" stop-color="#5e574e"/></linearGradient></defs>
<!-- backlit: a window of the Spire behind him and the high back of his chair --><!--set-->
<rect x="22" y="14" width="156" height="150" fill="#1b1e26"/>
<g stroke="#2c303b" stroke-width="2">${[48, 74, 100, 126, 152].map((x) => `<line x1="${x}" y1="14" x2="${x}" y2="164"/>`).join("")}${[44, 74, 104, 134].map((y) => `<line x1="22" y1="${y}" x2="178" y2="${y}"/>`).join("")}</g>
<g fill="#6a645a">${[30, 58, 84, 110, 136, 162].map((x, i) => `<rect x="${x}" y="${120 + (i % 3) * 8}" width="${6 + (i % 2) * 4}" height="${44 - (i % 3) * 8}"/>`).join("")}</g>
<path d="M36 240 L40 70 C40 52 52 44 68 44 L132 44 C148 44 160 52 160 70 L164 240 Z" fill="#1a1c23"/>
<path d="M44 236 L46 72 C46 58 56 52 68 52 L132 52 C144 52 154 58 154 72 L156 236" stroke="#353945" stroke-width="1.5" fill="none"/>
<!--/set-->
<!-- a charcoal suit cut close, a high white collar, a dark silk tie -->
<path d="M18 240 L22 200 C36 180 60 172 76 168 L100 182 L124 168 C140 172 164 180 178 200 L182 240 Z" fill="#14161b"/>
<path d="M76 168 L100 182 L90 240 L64 240 L58 200 L68 196 Z" fill="#23262e"/><path d="M124 168 L100 182 L110 240 L136 240 L142 200 L132 196 Z" fill="#1b1d23"/>
<path d="M84 160 L100 182 L116 160 L114 150 L86 150 Z" fill="#ddd8ce"/><path d="M104 158 L100 182 L116 160 L114 150 Z" fill="#b8b2a7"/>
<path d="M96 170 L104 170 L106 240 L94 240 Z" fill="#2a1a22"/><path d="M96 170 L104 170 L102.4 177 L97.6 177 Z" fill="#3c2730"/>
<!-- a thin neck, its cords, the far side in shadow -->
<path d="M88 128 L112 128 L114 156 C106 160 94 160 86 156 Z" fill="${SKIN_MID}"/>
<path d="M104 130 L112 128 L114 156 C110 158 107 159 104 159 Z" fill="${SKIN_DK}" opacity=".65"/>
<path d="M93 136 C94 144 95 150 95 156" stroke="${SKIN_DK}" stroke-width="1" fill="none" opacity=".5"/>
<!-- ears, long-lobed -->
<path d="M72 86 C65 82 63 100 66 110 C68 116 72 116 74 112 Z" fill="${SKIN_MID}"/>
<path d="M70 91 C67 95 67 104 69 108" stroke="${SKIN_DK}" stroke-width="1.1" fill="none"/>
<path d="M128 86 C135 82 137 100 134 110 C132 116 128 116 126 112 Z" fill="${SKIN_DK}"/>
<!-- a long, gaunt face: a high forehead, sharp cheekbones over hollows, a long jaw -->
<path d="M72 84 C72 54 84 40 100 40 C116 40 128 54 128 84 C128 104 126 118 121 130 C116 142 108 150 100 151 C92 150 84 142 79 130 C74 118 72 104 72 84 Z" fill="url(#hk${id})"/>
<path d="M110 42 C122 48 128 62 128 84 C128 104 126 118 121 130 C116 142 108 150 100 151 C107 140 112 126 113 108 C114 88 115 62 110 42 Z" fill="${SKIN_DK}" opacity=".55"/>
<path d="M76 106 C78 118 84 128 90 132 C86 122 82 114 80 104 Z" fill="${SKIN_MID}" opacity=".9"/>
<path d="M124 106 C122 118 116 128 110 132 C114 122 118 114 120 104 Z" fill="${SKIN_DK}" opacity=".9"/>
<ellipse cx="82" cy="101" rx="7" ry="2.8" fill="#ece5d8" opacity=".6" transform="rotate(-20 82 101)"/>
<ellipse cx="94" cy="56" rx="14" ry="7" fill="#ece5d8" opacity=".45"/>
<path d="M84 62 C94 60 106 60 116 62" stroke="${SKIN_MID}" stroke-width=".9" fill="none" opacity=".7"/>
<!-- the temples sunk, deep sockets under a heavy brow ridge -->
<path d="M74 74 C76 80 76 86 74 92" stroke="${SKIN_MID}" stroke-width="2.6" fill="none" opacity=".6"/>
<ellipse cx="88" cy="93" rx="11" ry="6.4" fill="${SKIN_DK}" opacity=".32"/><ellipse cx="112" cy="93" rx="11" ry="6.4" fill="${SKIN_DK}" opacity=".45"/>
<path d="M77 84 C82 80.6 90 80.2 97 83 C90 82.6 84 83.4 78 85.6 Z" fill="#cfc9be"/>
<path d="M103 83 C110 80.2 118 80.6 123 84 C118 83.4 110 82.6 103 84.6 Z" fill="#a8a296"/>
<g transform="translate(88 93) scale(.82 .76) translate(-87 -100)">${sculptedEye(id, 87, true)}</g><g transform="translate(112 93) scale(.82 .76) translate(-113 -100)">${sculptedEye(id, 113, false)}</g>
<!-- a long, thin, hooked nose -->
<path d="M100 92 C100.6 102 101.6 110 102.4 116 C101 119.4 98 120 96 119" stroke="${SKIN_DK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
<path d="M97.6 94 C97.6 102 97.8 108 98.4 113" stroke="#ece5d8" stroke-width="1.8" fill="none" opacity=".6" stroke-linecap="round"/>
<path d="M102 94 C105 104 107 112 106 118 C104 120 101.6 120.4 100 120 Z" fill="${SKIN_MID}" opacity=".8"/>
<path d="M93.4 116.6 C93.6 119.6 96 120.6 98 119.8 M103.4 119.6 C105.4 120.4 107 119 107 116.6" stroke="${SKIN_DK}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<path d="M90 118 C87 124 87 130 89 134 M110 118 C113 124 113 130 111 134" stroke="${SKIN_DK}" stroke-width="1.1" fill="none" opacity=".55"/>
<!-- a thin, level, unsmiling mouth -->
<path d="M90 130 C94 128.8 98 128.6 100 129.2 C102 128.6 106 128.8 110 130 C106 130.8 94 130.8 90 130 Z" fill="#5c4a46"/>
<path d="M89.6 130.2 C96 131.4 104 131.4 110.4 130.2" stroke="#2a201e" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<path d="M93 132.4 C97 134 103 134 107 132.4 C103 133 97 133 93 132.4 Z" fill="#9a8a84"/>
<ellipse cx="99" cy="144" rx="5" ry="2.4" fill="#ece5d8" opacity=".35"/>
<!-- white hair swept straight back from the forehead, silver over the ears -->
<path d="M70 82 C66 52 80 32 102 32 C124 32 136 52 130 82 C129 70 126 60 120 54 C112 47 90 47 80 54 C75 60 71 70 70 82 Z" fill="#c9c5bd"/>
<g stroke="#8f8b84" stroke-width="1" fill="none" stroke-linecap="round">${[0, 1, 2, 3, 4, 5].map((k) => `<path d="M${80 + k * 7} ${52 - k * 0.6} C${82 + k * 6} ${42 - k * 0.4} ${92 + k * 4} ${35} ${104 + k * 3} ${34 + k * 0.6}"/>`).join("")}</g>
<path d="M78 46 C88 36 106 33 120 40" stroke="#f3efe6" stroke-width="2.2" fill="none" opacity=".85" stroke-linecap="round"/>
<path d="M71 80 C70 74 70 68 72 62" stroke="#9c978e" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<!-- rimless glasses: only the lenses' edges and a glint -->
<g fill="none" stroke="#7e8189" stroke-width=".9"><rect x="79" y="87" width="18" height="11" rx="2.4"/><rect x="103" y="87" width="18" height="11" rx="2.4"/><path d="M97 91 C99 89.6 101 89.6 103 91 M79 90 L73 88 M121 90 L127 88"/></g>
<rect x="79" y="87" width="18" height="11" rx="2.4" fill="#fff" opacity=".06"/>
<!-- rim light on the lit side -->
<path d="M73 78 C72.6 100 75 118 81 130" stroke="${P}" stroke-width=".9" fill="none" opacity=".4"/>
<!-- the Candor pin in red -->
<path d="M70 196 L76 190 L82 196 L76 202 Z" fill="${RED}"/>
<!--set--><!-- the window behind him throws his front into shadow: only the rim and the glasses keep the light -->
<g fill="#06070a" opacity=".9"><path d="M18 240 L22 200 C36 180 60 172 76 168 L100 182 L124 168 C140 172 164 180 178 200 L182 240 Z"/><path d="M84 124 L116 124 L118 160 L100 184 L82 160 Z"/><path d="M72 84 C72 54 84 40 100 40 C116 40 128 54 128 84 C128 104 126 118 121 130 C116 142 108 150 100 151 C92 150 84 142 79 130 C74 118 72 104 72 84 Z"/><path d="M73 84 C64 80 61 100 65 111 C67 118 74 118 76 112 Z M127 84 C136 80 139 100 135 111 C133 118 126 118 124 112 Z"/><path d="M69 84 C65 52 80 31 102 31 C124 31 137 52 131 84 Z"/></g>
<path d="M100 40 C116 40 128 54 128 84 C128 104 126 118 121 130 C116 142 108 150 100 151 C107 140 112 126 113 108 C114 88 115 62 110 42 Z" fill="#2a2f3a" opacity=".35"/>
<path d="M72 80 C72 56 84 44 100 44 C116 44 128 56 128 80" stroke="#a9adb6" stroke-width="1.6" fill="none" opacity=".75"/>
<path d="M128 72 C130 96 126 124 114 142" stroke="#a9adb6" stroke-width="2" fill="none" opacity=".8"/>
<path d="M124 168 C142 172 164 180 178 200" stroke="#6d717b" stroke-width="1.6" fill="none" opacity=".7"/>
<path d="M83 89.6 L92 89.6" stroke="#d9d4ca" stroke-width="2" stroke-linecap="round"/>
<path d="M106 89.6 L115 89.6" stroke="#d9d4ca" stroke-width="2" stroke-linecap="round" opacity=".7"/>
<path d="M70 196 L76 190 L82 196 L76 202 Z" fill="${RED}"/>
<!--/set-->
`,
    0.35,
  );
}

/** Plan item 99: Tomas Reed, the harbour man the first case is after: a rain slicker, a knit cap, stubble. */
/** Plan item 371: an eye drawn as one, for the sculpted busts: the white under a heavy upper lid, iris, pupil and a
 * catchlight clipped to the opening, the lid's crease and the bag under it. Centred at (cx, 100); `lit` on the key side. */
function sculptedEye(id: string, cx: number, lit: boolean): string {
  return `
<path d="M${cx - 10} ${100} C${cx - 6} ${97} ${cx + 6} ${97} ${cx + 10} ${100} C${cx + 6} ${102.6} ${cx - 6} ${102.6} ${cx - 10} ${100} Z" fill="${lit ? "#cfc8bb" : "#a39b8f"}"/>
<clipPath id="re${id}${cx}"><path d="M${cx - 10} ${100} C${cx - 6} ${97} ${cx + 6} ${97} ${cx + 10} ${100} C${cx + 6} ${102.6} ${cx - 6} ${102.6} ${cx - 10} ${100} Z"/></clipPath>
<g clip-path="url(#re${id}${cx})"><circle cx="${cx + 0.5}" cy="100.2" r="3.4" fill="#5c5a55" stroke="#2a2a2c" stroke-width=".8"/><circle cx="${cx + 0.5}" cy="100.2" r="1.6" fill="#0d0e11"/><path d="M${cx - 10} 97 H${cx + 10} V99.4 H${cx - 10} Z" fill="#000" opacity=".22"/></g>
<circle cx="${cx - 0.6}" cy="99.2" r="${lit ? 0.8 : 0.6}" fill="#fbf8f0"/>
<path d="M${cx - 11} ${99.8} C${cx - 6} ${96.2} ${cx + 6} ${96.2} ${cx + 11} ${99.6}" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M${cx - 10} ${96.6} C${cx - 5} ${92.6} ${cx + 5} ${92.6} ${cx + 10} ${96.4}" stroke="${SKIN_DK}" stroke-width="1" fill="none" opacity=".7"/>
<path d="M${cx - 8} ${103.2} C${cx - 3} ${105.2} ${cx + 4} ${105.2} ${cx + 9} ${102.6}" stroke="${SKIN_DK}" stroke-width=".9" fill="none" opacity=".6"/>
<path d="M${cx - 7} ${107} C${cx - 2} ${109.4} ${cx + 4} ${109.2} ${cx + 8} ${106.4}" stroke="${SKIN_DK}" stroke-width=".9" fill="none" opacity=".45"/>`;
}

/**
 * Plan item 371: Tomas Reed sculpted to Cath's standard: a weathered harbour man in his fifties with a broad jaw,
 * cheek and brow planes lit from the left (the forehead and cheekbone take the key, the temple, the hollow under
 * the cheekbone and the jaw's far side fall away), real eyes (white, iris, pupil, a catchlight, heavy upper lids and
 * the bags under them), a broken nose, grey stubble, a wool beanie with its ribs following the crown over a turned
 * cuff, and a pea coat with its collar up and anchor buttons, the debt tag pinned to it.
 */
function reed(id: string, wrap: Wrap = frame): string {
  const WOOL = "#5a2a24";
  const WOOL_DK = "#3a1915";
  const WOOL_HI = "#7a3f36";
  const COAT = "#262c36";
  const COAT_DK = "#171b22";
  const COAT_HI = "#3a4250";
  // Ribs over the crown: each one a curve from the cuff up to the crown's top, bowed with the dome.
  const ribs = Array.from({ length: 11 }, (_, i) => {
    const t = (i - 5) / 5;
    const x0 = 100 + t * 34;
    const top = 100 + t * 12;
    return `<path d="M${x0.toFixed(1)} 74 C${(x0 - t * 2).toFixed(1)} 60 ${(top + t * 6).toFixed(1)} 44 ${top.toFixed(1)} 34" stroke="${i < 4 ? WOOL_HI : WOOL_DK}" stroke-width="${i < 4 ? 1.3 : 1.6}" fill="none" opacity="${i < 4 ? 0.7 : 0.85}"/>`;
  }).join("");
  const cuffRibs = Array.from({ length: 17 }, (_, i) => {
    const x = 68 + i * 4;
    return `<line x1="${x}" y1="${76 + Math.abs(i - 8) * 0.3}" x2="${x}" y2="${88 - Math.abs(i - 8) * 0.25}" stroke="${i < 6 ? WOOL_HI : WOOL_DK}" stroke-width="1.2" opacity=".75"/>`;
  }).join("");
  // Stubble as a fine shadow over the jaw and the upper lip, flecked, not spotted.
  const stubble = Array.from({ length: 140 }, (_, i) => {
    const a = (i * 137.5 * Math.PI) / 180;
    const r = 6 + ((i * 7) % 17);
    const x = 100 + Math.cos(a) * r * 1.2;
    const y = 138 + Math.sin(a) * r * 0.5;
    const lip = y < 134 && y > 128 && Math.abs(x - 100) < 11;
    return (y > 136 && y < 152) || lip ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.35 + (i % 3) * 0.12).toFixed(2)}"/>` : "";
  }).join("");
  const eye = (cx: number, lit: boolean) => sculptedEye(id, cx, lit);
  const brow = (cx: number, dir: 1 | -1) =>
    Array.from({ length: 9 }, (_, i) => {
      const x = cx - dir * 10 + dir * i * 2.6;
      const y = 90 - Math.sin((i / 8) * Math.PI) * 2.4 + (dir === 1 ? 0 : 0);
      return `<path d="M${x.toFixed(1)} ${(y + 1.6).toFixed(1)} l${(dir * 3).toFixed(1)} -2.6" stroke="${i % 2 ? "#3b3a38" : INK}" stroke-width="1.6" stroke-linecap="round"/>`;
    }).join("");
  return wrap(
    id,
    `
<defs>
<linearGradient id="rk${id}" x1="0" x2="1"><stop offset="0" stop-color="#d6cec1"/><stop offset=".5" stop-color="${SKIN}"/><stop offset=".72" stop-color="${SKIN_MID}"/><stop offset="1" stop-color="#6e665c"/></linearGradient>
<radialGradient id="rc${id}" cx="35%" cy="40%" r="70%"><stop offset="0" stop-color="${COAT_HI}"/><stop offset="1" stop-color="${COAT_DK}"/></radialGradient>
<radialGradient id="rw${id}" cx="34%" cy="30%" r="80%"><stop offset="0" stop-color="${WOOL_HI}"/><stop offset=".6" stop-color="${WOOL}"/><stop offset="1" stop-color="${WOOL_DK}"/></radialGradient>
</defs>
<!-- pea coat: broad shoulders, the collar turned up behind the neck, wide notched lapels -->
<path d="M0 240 L4 196 C18 178 48 168 72 162 L100 178 L128 162 C152 168 182 178 196 196 L200 240 Z" fill="url(#rc${id})"/>
<path d="M70 148 C64 156 62 166 66 176 L84 168 L88 150 Z" fill="${COAT_HI}"/>
<path d="M130 148 C136 156 138 166 134 176 L116 168 L112 150 Z" fill="${COAT_DK}"/>
<path d="M72 162 L100 180 L88 240 L58 240 L50 202 L62 194 L56 184 Z" fill="${COAT_HI}"/>
<path d="M128 162 L100 180 L112 240 L142 240 L150 202 L138 194 L144 184 Z" fill="${COAT}"/>
<path d="M62 194 L56 184 L66 186 Z" fill="${COAT_DK}"/><path d="M138 194 L144 184 L134 186 Z" fill="#0f1217"/>
<path d="M72 162 L100 180 L88 240" stroke="#4c5566" stroke-width="1" fill="none" opacity=".7"/>
<path d="M30 200 C34 214 36 228 36 240 M170 200 C166 214 164 228 164 240" stroke="${COAT_DK}" stroke-width="1.4" fill="none" opacity=".8"/>
${[
  [74, 206],
  [126, 206],
  [72, 226],
  [128, 226],
]
  .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4.2" fill="${i % 2 ? "#14171d" : "#2e3542"}" stroke="#0a0c10" stroke-width="1"/><path d="M${x} ${y! - 2.4} v4.6 M${x! - 2} ${y! + 1.2} q2 2 4 0" stroke="${i % 2 ? "#3a4250" : "#69738a"}" stroke-width=".9" fill="none"/>`)
  .join("")}
<!-- a knit jumper at the throat -->
<path d="M86 156 L100 178 L114 156 C108 160 92 160 86 156 Z" fill="#4a4842"/>
<g stroke="#34322e" stroke-width=".8" opacity=".8">${[90, 94, 98, 102, 106, 110].map((x) => `<line x1="${x}" y1="${158 + Math.abs(x - 100) * 0.1}" x2="${x + (x < 100 ? 1.4 : -1.4)}" y2="${166 - Math.abs(x - 100) * 0.5}"/>`).join("")}</g>
<!-- the debt tag pinned to his coat -->
<path d="M140 204 L160 200 L164 216 L144 220 Z" fill="${RED}"/><circle cx="144" cy="208" r="1.6" fill="#0b0c10"/>
<path d="M144 208 C140 202 136 200 132 200" stroke="#8d877d" stroke-width=".8" fill="none"/>
<!-- neck, the far side in shadow, a cord of the throat -->
<path d="M84 128 L116 128 L118 158 C110 165 90 165 82 158 Z" fill="${SKIN_MID}"/>
<path d="M104 132 L116 128 L118 158 C114 161 110 162 106 162 Z" fill="${SKIN_DK}" opacity=".6"/>
<path d="M92 140 C93 148 95 154 96 160" stroke="${SKIN_DK}" stroke-width="1" fill="none" opacity=".5"/>
<!-- ears: rim, the inner fold, the far one in shadow -->
<path d="M70 92 C62 88 60 104 64 112 C66 118 70 118 72 114 Z" fill="${SKIN_MID}"/>
<path d="M68 98 C65 100 65 108 68 112" stroke="${SKIN_DK}" stroke-width="1.2" fill="none"/>
<path d="M130 92 C138 88 140 104 136 112 C134 118 130 118 128 114 Z" fill="${SKIN_DK}"/>
<!-- the head: a broad weathered jaw, square at the corners -->
<path d="M70 88 C70 62 84 52 100 52 C116 52 130 62 130 88 C131 106 130 122 124 134 C119 144 110 152 100 153 C90 152 81 144 76 134 C70 122 69 106 70 88 Z" fill="url(#rk${id})"/>
<!-- planes: the shadow side, the temple, the hollow under each cheekbone, the jaw's underside -->
<path d="M110 54 C124 58 130 70 130 88 C131 106 130 122 124 134 C119 144 110 152 100 153 C108 142 114 128 115 112 C116 96 116 72 110 54 Z" fill="${SKIN_DK}" opacity=".55"/>
<path d="M72 80 C74 90 74 96 72 102" stroke="${SKIN_MID}" stroke-width="4" fill="none" opacity=".45" stroke-linecap="round"/>
<path d="M78 116 C82 124 86 128 90 130 C86 122 84 118 82 112 Z" fill="${SKIN_MID}" opacity=".7"/>
<path d="M122 116 C118 124 114 128 110 130 C114 122 116 118 118 112 Z" fill="${SKIN_DK}" opacity=".7"/>
<path d="M80 138 C88 148 112 148 120 138 C116 148 108 153 100 153 C92 153 84 148 80 138 Z" fill="${SKIN_DK}" opacity=".35"/>
<!-- lights: forehead, the lit cheekbone, the bridge, the chin -->
<ellipse cx="90" cy="80" rx="14" ry="5" fill="#ece5d8" opacity=".45"/>
<ellipse cx="82" cy="110" rx="6" ry="3.4" fill="#ece5d8" opacity=".5" transform="rotate(-20 82 110)"/>
<ellipse cx="98" cy="146" rx="6" ry="2.6" fill="#ece5d8" opacity=".3"/>
<!-- a furrowed brow and crow's feet -->
<path d="M86 84 C94 82 106 82 114 84 M90 88 C96 87 104 87 110 88" stroke="${SKIN_DK}" stroke-width=".8" fill="none" opacity=".45"/>
<path d="M98 92 L99 97 M103 92 L102 97" stroke="${SKIN_DK}" stroke-width=".9" opacity=".55"/>
<path d="M74 98 l-4 -2 M74 101 l-4 1 M126 98 l4 -2 M126 101 l4 1" stroke="${SKIN_DK}" stroke-width=".8" opacity=".5"/>
${brow(87, -1)}${brow(113, 1)}
${eye(87, true)}${eye(113, false)}
<!-- the nose, broken once: a bend in the bridge, the tip, the wings and nostrils -->
<path d="M98 100 C97 106 99 110 97 116 C96 120 94 122 94 124" stroke="${SKIN_DK}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<path d="M95 104 C94 110 96 114 94 118" stroke="#ece5d8" stroke-width="2" fill="none" opacity=".55" stroke-linecap="round"/>
<path d="M103 102 C106 110 108 116 108 121 C104 124 100 124 98 123 Z" fill="${SKIN_MID}" opacity=".8"/>
<path d="M90 122 C91 126 95 127 98 125 M102 125 C105 127 109 126 110 122" stroke="${SKIN_DK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<ellipse cx="94.6" cy="124.4" rx="1.8" ry="1" fill="${INK}" opacity=".7"/><ellipse cx="105.4" cy="124.4" rx="1.8" ry="1" fill="${INK}" opacity=".7"/>
<!-- the folds from the nose to the mouth's corners -->
<path d="M88 118 C85 124 84 130 86 136 M112 118 C115 124 116 130 114 136" stroke="${SKIN_DK}" stroke-width="1.1" fill="none" opacity=".55"/>
<!-- the mouth: set and turned down, a thin upper lip over a fuller lower one -->
<path d="M88 135 C93 133 97 133.6 100 134.4 C103 133.6 107 133 112 135 C107 136 103 136.4 100 136.2 C97 136.4 93 136 88 135 Z" fill="#6a5f55"/>
<path d="M88 135.4 C94 136.8 106 136.8 112 135.4" stroke="#2c2622" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<path d="M90 137 C95 140.6 105 140.6 110 137 C105 139 95 139 90 137 Z" fill="#a39a8e"/>
<path d="M87 136.4 l-1.6 1.8 M113 136.4 l1.6 1.8" stroke="${SKIN_DK}" stroke-width="1" opacity=".7"/>
<!-- grey stubble over the jaw and the lip -->
<path d="M82 138 C88 150 112 150 118 138 C114 148 108 152 100 152 C92 152 86 148 82 138 Z" fill="#5a544c" opacity=".22"/>
<g fill="#4f4a44" opacity=".45">${stubble}</g>
<!-- the beanie: a slouched crown of ribbed wool over a turned cuff -->
<path d="M66 80 C62 46 80 30 100 30 C120 30 138 46 134 80 Z" fill="url(#rw${id})"/>
${ribs}
<path d="M64 76 C78 70 122 70 136 76 L136 90 C122 84 78 84 64 90 Z" fill="${WOOL}"/>
<path d="M64 76 C78 70 122 70 136 76" stroke="${WOOL_HI}" stroke-width="1.4" fill="none" opacity=".8"/>
${cuffRibs}
<path d="M64 90 C78 84 122 84 136 90" stroke="${WOOL_DK}" stroke-width="2" fill="none"/>
<path d="M66 90 C78 85.6 122 85.6 134 90 L134 92 C122 88 78 88 66 92 Z" fill="#1a0c0a" opacity=".5"/>
<!-- the key's rim along his lit cheek and the wool -->
<path d="M70.6 92 C70.4 108 72.6 124 79 136" stroke="${P}" stroke-width=".9" fill="none" opacity=".35"/>
<path d="M68 70 C68 52 80 36 96 32" stroke="#a65d52" stroke-width="1.4" fill="none" opacity=".6"/>
`,
  );
}

function mind(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
<g stroke="#3a3f44" stroke-width="2" fill="none" opacity=".7">${[30, 52, 74, 126, 148, 170].map((x, i) => `<path d="M${x} 240 C${x + (i < 3 ? 10 : -10)} 210 ${x + (i < 3 ? 30 : -30)} 196 ${i < 3 ? 80 : 120} 176"/>`).join("")}</g>
<path d="M60 240 L66 196 C76 182 88 176 100 176 C112 176 124 182 134 196 L140 240 Z" fill="#121418"/>
<path d="M76 90 C76 62 86 48 100 48 C114 48 124 62 124 90 C124 112 120 128 112 140 C107 147 103 150 100 150 C97 150 93 147 88 140 C80 128 76 112 76 90 Z" fill="#15171b"/>
<path d="M76 90 C76 62 86 48 100 48 C114 48 124 62 124 90" stroke="#cfd6d8" stroke-width="1.6" fill="none" opacity=".8"/>
<path d="M124 84 C126 106 122 126 112 140" stroke="#cfd6d8" stroke-width="1.4" fill="none" opacity=".6"/>
<circle cx="100" cy="160" r="3" fill="${RED}"/>
<path d="M84 96 L96 96 M104 96 L116 96" stroke="#eef1f2" stroke-width="3" stroke-linecap="round"/>
<g fill="#cfd6d8" opacity=".55">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${86 + i * 5}" y="${112 + (i % 2) * 3}" width="2" height="${6 + (i % 3) * 3}"/>`).join("")}</g>
`,
    0.25,
  );
}

const DRAW: Record<BustId, (id: string, wrap?: Wrap) => string> = { crisp, vane, pell, chair, reed, mind };

type Wrap = (id: string, body: string, glow?: number) => string;

/**
 * Plan item 321: a named target's print is a booking photo, not a flat drawing: the bust stands against a pale wall
 * with a height chart, lit by one hard flash a little left of the lens, so the face takes a lit cheek and a deep
 * shadow side and the head throws a hard shadow on the wall beside it; the frame sits at a slight dutch angle, with
 * the flash's falloff into the corners and film grain. (The named cast has no 3D models of its own: in the game every
 * boss fights in a scaled Enforcer rig, so a render of "the real model" would print the same helmet five times.)
 */
function booking(id: string, who: BustId, small: boolean, slateG: string): string {
  // A bust's own set (the Chair's Spire window) stays out of the booking room.
  const body = DRAW[who](id, (_i, b) => b).replace(/<!--set-->[\s\S]*?<!--\/set-->/g, "");
  // Feet and inches up the wall: a line every 18 units (half a foot), heavier and lettered at each foot.
  const chart = Array.from({ length: 13 }, (_, i) => {
    const y = 6 + i * 18;
    const foot = i % 2 === 0;
    const label = 7 - i / 2;
    return `<line x1="0" y1="${y}" x2="200" y2="${y}" stroke="#4a4740" stroke-width="${foot ? 1.1 : 0.5}" opacity="${foot ? 0.5 : 0.32}"/>${
      foot && !small && label > 0 ? `<text x="6" y="${y - 2}" font-family="Archivo, system-ui, sans-serif" font-size="7" font-weight="700" fill="#3c3a34" opacity=".7">${label}'</text><text x="194" y="${y - 2}" text-anchor="end" font-family="Archivo, system-ui, sans-serif" font-size="7" font-weight="700" fill="#3c3a34" opacity=".7">${label}'</text>` : ""
    }`;
  }).join("");
  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" class="mugshot mugshot-${who}" data-booking="1">
<defs>
<radialGradient id="w${id}" cx="44%" cy="36%" r="78%"><stop offset="0" stop-color="#e4e0d4"/><stop offset=".5" stop-color="#b3aea1"/><stop offset="1" stop-color="#4b4842"/></radialGradient>
<linearGradient id="d${id}" x1="0" x2="1"><stop offset=".36" stop-color="#000" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity=".42"/><stop offset=".85" stop-color="#000" stop-opacity=".62"/></linearGradient>
<radialGradient id="h${id}" cx="41%" cy="37%" r="24%"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="v${id}" cx="46%" cy="40%" r="74%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>
<filter id="c${id}" x="-10%" y="-10%" width="130%" height="130%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.6"/><feOffset dx="10" dy="5" result="o"/><feFlood flood-color="#17161a" flood-opacity=".62"/><feComposite in2="o" operator="in"/></filter>
<filter id="f${id}"><feComponentTransfer><feFuncR type="linear" slope="1.28" intercept="-.07"/><feFuncG type="linear" slope="1.28" intercept="-.07"/><feFuncB type="linear" slope="1.28" intercept="-.07"/></feComponentTransfer></filter>
<filter id="a${id}"><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>
<mask id="m${id}"><use href="#b${id}" filter="url(#a${id})"/></mask>
<filter id="n${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .2 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
</defs>
<rect width="200" height="240" fill="#0b0c10"/>
<g transform="translate(100 120) rotate(-2.4) scale(1.07) translate(-100 -120)">
<rect width="200" height="240" fill="url(#w${id})"/>
${chart}
<use href="#b${id}" filter="url(#c${id})"/>
<g id="b${id}" filter="url(#f${id})">${body}</g>
<g mask="url(#m${id})"><rect width="200" height="240" fill="url(#d${id})"/><rect width="200" height="240" fill="url(#h${id})"/></g>
${slateG}
</g>
<rect width="200" height="240" fill="#fff" filter="url(#n${id})"/>
<rect width="200" height="240" fill="url(#v${id})"/>
</svg>`;
}

/**
 * Plan item 99: a mugshot. The bust in front of a height chart, with the slate held at the chest; a withheld
 * target (null) is a grey silhouette behind a red REDACTED bar and a case stamp, never a black square.
 * Plan item 107: a `small` print (the List's 64-112 px frames) carries no words: at that scale they drew at 4-5 px,
 * so the slate, the bar and the stamp stay as shapes and the caption under the print names it. Plan item 121: the
 * small slate carries chalk strokes, so it reads as a lettered slate, not an empty black bar.
 */
export function mugshotSvg(who: BustId | null, slate: string, small = false, variant = 0): string {
  uid += 1;
  const id = `mug${uid}`;
  const chart = `<g stroke="#5d5a52" stroke-width="1" opacity=".55">${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${14 + i * 18}" x2="${i % 3 === 0 ? 26 : 14}" y2="${14 + i * 18}"/><line x1="200" y1="${14 + i * 18}" x2="${i % 3 === 0 ? 174 : 186}" y2="${14 + i * 18}"/>`).join("")}</g>`;
  const esc = slate.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const slateG = `<g><rect x="54" y="196" width="92" height="30" rx="2" fill="#101114" stroke="#d9d4ca" stroke-width="1.2"/>${small ? `<g stroke="#e8e2d6" stroke-width="3.2" stroke-linecap="round" opacity=".8"><line x1="66" y1="211" x2="88" y2="211"/><line x1="96" y1="211" x2="104" y2="211"/><line x1="112" y1="211" x2="134" y2="211"/></g>` : `<text x="100" y="215" text-anchor="middle" font-family="Archivo, system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="1" fill="#e8e2d6">${esc}</text>`}</g>`;
  if (who) return booking(id, who, small, slateG);
  // Plan item 270: each withheld target a distinct backlit silhouette (a hat brim, and
  // since item 371 Vane's bob, Pell's broad head and the Chair in his high-backed chair), its district's prop in shadow behind, cold rim light on its edge; the red bar a stamp across the eyes only.
  // (A grey head at 10% luminance on 8% read as four identical black squares.)
  const v = ((variant % 4) + 4) % 4;
  const RIM = "#9fbcd8";
  const FIG = "#08090c";
  const heads = [
    // a hat brim
    `<path d="M76 92 C76 70 86 60 100 60 C114 60 124 70 124 92 C124 114 119 132 111 143 C106 150 103 152 100 152 C97 152 94 150 89 143 C81 132 76 114 76 92 Z"/><path d="M48 70 C64 62 84 60 100 60 C116 60 136 62 152 70 C140 74 126 74 120 72 L118 40 C110 34 90 34 82 40 L80 72 C74 74 60 74 48 70 Z"/>`,
    // Plan item 371: the three below are cut from the sculpted heads. Vane: her blunt bob over a narrow chin.
    `<path d="M70 132 C64 104 64 70 76 52 C86 38 114 36 126 50 C138 66 138 104 130 132 L114 134 C109 142 104 146 100 146 C96 146 91 142 86 134 Z"/>`,
    // Pell: a broad, jowly head, the comb-over's swell, his ears
    `<path d="M66 84 C64 54 80 34 102 34 C124 34 138 52 134 84 C133 100 134 112 131 124 C128 136 120 144 110 148 C106 150 103 151 100 151 C97 151 94 150 90 148 C80 144 72 136 69 124 C66 112 67 100 66 84 Z"/><path d="M68 86 C60 82 58 100 63 108 C65 112 69 112 70 108 Z M132 86 C140 82 142 100 137 108 C135 112 131 112 130 108 Z"/>`,
    // the Chair: a long, gaunt head with its hair swept back high off the forehead
    `<path d="M70 82 C66 52 80 30 102 30 C124 30 136 52 130 82 C128 104 126 118 121 130 C116 142 108 150 100 151 C92 150 84 142 79 130 C74 118 72 104 70 82 Z"/><path d="M73 84 C66 80 64 100 67 110 C69 116 74 116 76 112 Z M127 84 C134 80 136 100 133 110 C131 116 126 116 124 112 Z"/>`,
  ];
  // Plan item 321: each its own build under the head (one shared pair of shoulders made any two prints overlap
  // 0.86): a trench with its collar turned up, narrow shoulders, a heavy man's broad ones, a cloak falling from the hood.
  const bodies = [
    `<path d="M30 240 L34 200 C44 186 58 178 74 174 L68 134 L86 150 L100 160 L114 150 L132 134 L126 174 C142 178 156 186 166 200 L170 240 Z"/>`,
    `<path d="M36 240 L40 206 C52 190 74 184 88 182 L92 150 L108 150 L112 182 C126 184 148 190 160 206 L164 240 Z"/>`,
    `<path d="M0 240 L2 188 C16 170 48 162 76 158 L80 126 L120 126 L124 158 C152 162 184 170 198 188 L200 240 Z"/>`,
    `<path d="M42 240 L46 64 C46 46 58 38 74 38 L126 38 C142 38 154 46 154 64 L158 240 Z"/><path d="M10 240 L14 224 C30 208 62 200 86 196 L88 128 L112 128 L114 196 C138 200 170 208 186 224 L190 240 Z"/>`,
  ];
  const rims = [
    `<path d="M48 70 C64 62 84 60 100 60 C116 60 136 62 152 70" stroke="${RIM}" stroke-width="2" fill="none"/><path d="M118 40 C110 34 90 34 82 40" stroke="${RIM}" stroke-width="1.6" fill="none"/>`,
    // Vane's bob and the wire rims of her glasses catching the light
    `<path d="M70 132 C64 104 64 70 76 52 C86 38 114 36 126 50 C138 66 138 104 130 132" stroke="${RIM}" stroke-width="2" fill="none"/><g stroke="${RIM}" stroke-width="1.2" fill="none" opacity=".8"><circle cx="88" cy="92" r="9.4"/><circle cx="112" cy="92" r="9.4"/></g>`,
    // Pell's comb-over, his ears and the links of his chain of office
    `<path d="M66 84 C64 54 80 34 102 34 C124 34 138 52 134 84" stroke="${RIM}" stroke-width="2" fill="none"/><path d="M84 46 C96 40 116 40 130 50" stroke="${RIM}" stroke-width="1.2" fill="none" opacity=".7"/><g fill="${RIM}" opacity=".75">${Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      return `<ellipse cx="${(40 + t * 120).toFixed(1)}" cy="${(186 + Math.sin(t * Math.PI) * 30).toFixed(1)}" rx="3.4" ry="2.2"/>`;
    }).join("")}</g>`,
    // the Chair's swept hair and, as in his own file, only the glasses catch the light
    `<path d="M46 120 L46 64 C46 46 58 38 74 38 L126 38 C142 38 154 46 154 64 L154 120" stroke="${RIM}" stroke-width="2" fill="none" opacity=".8"/><path d="M70 82 C72 104 74 118 79 130 C84 142 92 150 100 151" stroke="${RIM}" stroke-width="1.2" fill="none" opacity=".45"/><path d="M70 82 C66 52 80 30 102 30 C124 30 136 52 130 82" stroke="${RIM}" stroke-width="2" fill="none"/><path d="M130 82 C129 106 125 124 114 142" stroke="${RIM}" stroke-width="1.4" fill="none" opacity=".7"/><g stroke="#e6eef6" stroke-width="2" stroke-linecap="round"><path d="M83 89.6 L92 89.6"/><path d="M106 89.6 L115 89.6" opacity=".7"/></g>`,
  ];
  // (by the List's order: 1 the clinic, 2 the plaza, 3 the tower, 4 the vault)
  const props = [
    // vault bars
    `<g fill="#151a21">${Array.from({ length: 7 }, (_, k) => `<rect x="${22 + k * 26}" y="20" width="7" height="200"/>`).join("")}</g>`,
    // a clinic drip stand
    `<g stroke="#151a21" stroke-width="4" fill="none"><path d="M156 200 V40 M140 40 h32"/></g><path d="M146 44 h20 v34 a10 10 0 0 1 -20 0 Z" fill="#151a21"/>`,
    // a plaza statue on its plinth
    `<g fill="#151a21"><rect x="140" y="150" width="44" height="60"/><path d="M152 150 v-40 c0 -10 6 -18 10 -18 s10 8 10 18 v40 Z"/><circle cx="162" cy="84" r="9"/><path d="M172 108 l14 -22" stroke="#151a21" stroke-width="5"/></g>`,
    // tower blinds (his chair's high back is part of his silhouette)
    `<g fill="#151a21">${Array.from({ length: 9 }, (_, k) => `<rect x="28" y="${30 + k * 14}" width="144" height="8"/>`).join("")}</g>`,
  ];
  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" class="mugshot mugshot-withheld" data-silhouette="${v}">
<defs><radialGradient id="r${id}" cx="50%" cy="36%" r="62%"><stop offset="0" stop-color="#7f93a8"/><stop offset=".6" stop-color="#3e4a58"/><stop offset="1" stop-color="#0e1014"/></radialGradient></defs>
<rect width="200" height="240" fill="#0e1014"/>
<g transform="translate(100 120) rotate(${v % 2 ? 2.2 : -2.2}) scale(1.07) translate(-100 -120)">
<rect width="200" height="240" fill="url(#r${id})"/>${props[v]}${chart}
<g fill="${FIG}">${bodies[v]}${heads[v]}</g>
${rims[v]}
<g transform="rotate(-6 100 95)"><rect x="62" y="86" width="76" height="18" fill="#b3122a" opacity=".92"/><rect x="62" y="86" width="76" height="18" fill="none" stroke="#f3ede2" stroke-width="1.2" opacity=".55"/></g>
${small ? "" : `<text x="100" y="99" text-anchor="middle" font-family="Archivo, system-ui, sans-serif" font-size="10" font-weight="800" letter-spacing="2" fill="#f3ede2" transform="rotate(-6 100 95)">REDACTED</text>
<g transform="rotate(12 156 150)"><rect x="128" y="136" width="58" height="26" rx="3" fill="none" stroke="#b3122a" stroke-width="2" opacity=".85"/><text x="157" y="153" text-anchor="middle" font-family="Archivo, system-ui, sans-serif" font-size="9" font-weight="800" letter-spacing="1" fill="#b3122a" opacity=".9">CASE OPEN</text></g>`}
${slateG}
</g>
</svg>`;
}

/** The bust as an inline SVG string; every call gets its own ids so several can share a page. */
export function bustSvg(who: BustId): string {
  uid += 1;
  return DRAW[who](`${who}${uid}`);
}
