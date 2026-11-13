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

/** A face lit from the left: base, the right-hand shadow plane, cheek and jaw modelling. */
function face(shape: string, shadow: string): string {
  return `<path d="${shape}" fill="${SKIN}"/><path d="${shadow}" fill="${SKIN_MID}"/>
<g fill="${SKIN_DK}" opacity=".13"><ellipse cx="88" cy="89" rx="10" ry="5.5"/><ellipse cx="112" cy="89" rx="10" ry="5.5"/></g>`;
}

function crisp(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
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
<!-- neck -->
<path d="M86 132 L114 132 L116 158 C108 164 92 164 84 158 Z" fill="${SKIN_MID}"/>
${face(
  "M70 86 C70 56 84 42 100 42 C116 42 130 56 130 86 C130 108 126 126 117 138 C111 146 105 150 100 150 C95 150 89 146 83 138 C74 126 70 108 70 86 Z",
  "M108 44 C122 48 130 62 130 86 C130 108 126 126 117 138 C111 146 105 150 100 150 C106 140 112 128 113 110 C114 92 114 64 108 44 Z",
)}
<path d="M74 110 C78 124 86 136 96 142" stroke="${SKIN_MID}" stroke-width="3" fill="none" opacity=".5"/>
<!-- ears -->
<path d="M70 88 C64 86 63 100 70 106" fill="${SKIN_MID}"/><path d="M130 88 C136 86 137 100 130 106" fill="${SKIN_DK}"/>
<!-- slicked hair, swept back with a shine band -->
<path d="M68 84 C64 50 80 28 104 28 C128 28 140 48 132 84 C131 70 127 62 120 60 C106 56 86 58 76 66 C71 72 69 78 68 84 Z" fill="${INK}"/>
<path d="M74 56 C86 40 110 36 128 48" stroke="#6b6860" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M80 54 C92 44 110 42 120 46" stroke="#4a4842" stroke-width="1.2" fill="none"/>
<!-- brows: one arched -->
<path d="M80 82 C86 78 92 78 96 80" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M104 80 C110 76 116 76 121 80" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<!-- hooded eyes -->
<path d="M81 90 C85 87 91 87 95 90 C91 92 85 92 81 90 Z" fill="${INK}"/><circle cx="88.5" cy="89.6" r="1.1" fill="${P}"/>
<path d="M105 90 C109 87 115 87 119 90 C115 92 109 92 105 90 Z" fill="${INK}"/><circle cx="112" cy="89.6" r="1" fill="#8d877d"/>
<path d="M81 89 C85 85 91 85 95 88" stroke="${SKIN_DK}" stroke-width="1.2" fill="none"/>
<!-- nose -->
<path d="M100 92 C99 102 96 110 95 114 C98 117 103 117 106 114" stroke="${SKIN_DK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M103 94 C106 102 108 110 107 114" fill="${SKIN_MID}" opacity=".7"/>
<!-- pencil moustache and the smirk, higher on the right -->
<path d="M89 123 C95 120 104 120 112 121" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M89 129 C96 131 104 130 113 125" stroke="${SKIN_DK}" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M92 134 C97 136 103 136 107 134" stroke="${SKIN_MID}" stroke-width="1.4" fill="none"/>
<!-- rim light on the lit side -->
<path d="M71 70 C69 92 72 116 82 136" stroke="${P}" stroke-width="1.2" fill="none" opacity=".55"/>
`,
  );
}

function vane(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
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
${face(
  "M74 86 C74 58 86 44 100 44 C114 44 126 58 126 86 C126 106 122 122 114 134 C109 142 104 146 100 146 C96 146 91 142 86 134 C78 122 74 106 74 86 Z",
  "M108 46 C120 50 126 64 126 86 C126 106 122 122 114 134 C109 142 104 146 100 146 C105 138 110 126 111 110 C112 92 112 64 108 46 Z",
)}
<!-- severe bob with a blunt fringe -->
<path d="M70 132 C64 104 64 70 76 52 C86 38 114 36 126 50 C138 66 138 104 130 132 L124 132 C126 110 126 92 124 76 L76 76 C74 92 74 112 76 132 Z" fill="${INK}"/>
<path d="M74 78 C76 58 88 46 100 46 C112 46 124 56 126 78 Z" fill="${INK}"/>
<path d="M80 60 C88 50 104 48 116 52" stroke="#5e5b55" stroke-width="2" fill="none" stroke-linecap="round"/>
<!-- round wire glasses -->
<g fill="none" stroke="#aaa59b" stroke-width="1.4"><circle cx="88" cy="92" r="9"/><circle cx="112" cy="92" r="9"/><path d="M97 91 C99 89 101 89 103 91 M79 90 L74 88 M121 90 L126 88"/></g>
<path d="M82 86 L86 84" stroke="${P}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
<!-- level, cold eyes -->
<path d="M82 85 C86 83 91 83 94 85" stroke="${INK}" stroke-width="1.8" fill="none"/>
<path d="M106 85 C109 83 114 83 118 85" stroke="${INK}" stroke-width="1.8" fill="none"/>
<path d="M83 93 C86 90.5 90 90.5 93 93 C90 94.5 86 94.5 83 93 Z" fill="${INK}"/><circle cx="88" cy="92.4" r=".9" fill="${P}"/>
<path d="M107 93 C110 90.5 114 90.5 117 93 C114 94.5 110 94.5 107 93 Z" fill="${INK}"/>
<!-- nose and a thin closed mouth, dark lipstick -->
<path d="M100 96 C99 104 97 110 96 113 C99 115 102 115 105 113" stroke="${SKIN_DK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<path d="M90 124 C95 122 105 122 110 124 C105 126.5 95 126.5 90 124 Z" fill="#3b2a2c"/>
<path d="M76 104 C78 118 84 130 94 138" stroke="${SKIN_MID}" stroke-width="2.6" fill="none" opacity=".5"/>
<path d="M75 82 C74 100 77 118 86 134" stroke="${P}" stroke-width="1" fill="none" opacity=".45"/>
`,
  );
}

function pell(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
<!-- navy suit, broad and soft, with the chain of office across it -->
<path d="M0 240 L0 192 C18 172 48 164 72 162 L100 184 L128 162 C152 164 182 172 200 192 L200 240 Z" fill="${CLOTH}"/>
<path d="M72 162 L100 184 L88 240 L60 240 L54 198 Z" fill="${CLOTH_HI}"/><path d="M128 162 L100 184 L112 240 L140 240 L146 198 Z" fill="#2c303a"/>
<path d="M82 156 L100 184 L118 156 Z" fill="${P}"/>
<path d="M95 166 L105 166 L108 240 L92 240 Z" fill="#4b4f5c"/>
<g fill="#a69c88" stroke="#5f584b" stroke-width=".6">${Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      const x = 40 + t * 120;
      const y = 186 + Math.sin(t * Math.PI) * 30;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.4" ry="3" transform="rotate(${((t - 0.5) * -50).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }).join("")}</g>
<circle cx="100" cy="222" r="9" fill="#c2b79f" stroke="#5f584b" stroke-width="1"/><circle cx="100" cy="222" r="4.5" fill="none" stroke="#5f584b" stroke-width="1"/>
<!-- the red rosette on his lapel -->
<g transform="translate(66 196)"><circle r="9" fill="${RED}"/><circle r="5.5" fill="#8c0b20"/><circle r="2.4" fill="${RED}"/><path d="M-4 7 L-7 20 L-2 16 L1 21 L3 8 Z" fill="${RED}"/></g>
<!-- thick neck and jowls -->
<path d="M82 128 L118 128 L122 156 C110 164 90 164 78 156 Z" fill="${SKIN_MID}"/>
${face(
  "M68 86 C68 54 82 40 100 40 C118 40 132 54 132 86 C132 108 130 126 122 138 C114 148 106 152 100 152 C94 152 86 148 78 138 C70 126 68 108 68 86 Z",
  "M110 42 C124 48 132 62 132 86 C132 108 130 126 122 138 C114 148 106 152 100 152 C108 142 114 128 115 110 C116 92 116 64 110 42 Z",
)}
<path d="M72 118 C76 134 88 146 100 148 M128 118 C124 134 112 146 100 148" stroke="${SKIN_DK}" stroke-width="1.6" fill="none" opacity=".55"/>
<path d="M68 88 C61 86 60 102 68 108" fill="${SKIN_MID}"/><path d="M132 88 C139 86 140 102 132 108" fill="${SKIN_DK}"/>
<!-- silver hair, side-parted and combed over, grey at the temples -->
<path d="M66 84 C64 54 80 34 102 34 C124 34 138 52 134 84 C132 70 128 62 122 58 C108 54 84 52 76 62 C70 68 67 76 66 84 Z" fill="#9b968c"/>
<path d="M84 40 C96 34 118 34 130 48 C116 44 100 44 86 50 Z" fill="#d3cec4"/>
<path d="M82 44 L84 52" stroke="#6e6a62" stroke-width="1.4"/>
<path d="M90 44 C104 40 118 42 128 50" stroke="#ece6da" stroke-width="1.2" fill="none" opacity=".7"/>
<!-- heavy brows, crinkled eyes -->
<path d="M78 80 C84 76 92 76 96 79" stroke="#5c5850" stroke-width="3.4" fill="none" stroke-linecap="round"/>
<path d="M104 79 C108 76 116 76 122 80" stroke="#5c5850" stroke-width="3.4" fill="none" stroke-linecap="round"/>
<path d="M80 90 C84 86.5 90 86.5 94 90 C90 91.5 84 91.5 80 90 Z" fill="${INK}"/><circle cx="87" cy="89.2" r="1" fill="${P}"/>
<path d="M106 90 C110 86.5 116 86.5 120 90 C116 91.5 110 91.5 106 90 Z" fill="${INK}"/>
<path d="M76 92 L72 90 M76 95 L72 96 M124 92 L128 90 M124 95 L128 96" stroke="${SKIN_DK}" stroke-width="1" />
<path d="M82 96 C86 98 90 98 93 96 M107 96 C110 98 114 98 118 96" stroke="${SKIN_DK}" stroke-width="1" fill="none"/>
<!-- broad nose -->
<path d="M100 92 C99 102 95 110 93 114 C97 119 104 119 108 114" stroke="${SKIN_DK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
<!-- the campaign smile, all teeth -->
<path d="M84 122 C92 132 108 132 116 122 C108 126 92 126 84 122 Z" fill="${P}" stroke="${SKIN_DK}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M90 124.6 L90 127.6 M96 125.4 L96 129 M102 125.4 L102 129 M108 124.8 L108 128" stroke="#b1aa9e" stroke-width=".7"/>
<path d="M80 118 C82 122 83 125 84 128 M120 118 C118 122 117 125 116 128" stroke="${SKIN_DK}" stroke-width="1.4" fill="none"/>
<path d="M69 70 C67 94 70 118 80 136" stroke="${P}" stroke-width="1.2" fill="none" opacity=".5"/>
`,
  );
}

function chair(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
<!-- backlit: a window of the Spire behind him, his face lost in shadow --><!--set-->
<rect x="22" y="14" width="156" height="150" fill="#1b1e26"/>
<g stroke="#2c303b" stroke-width="2">${[48, 74, 100, 126, 152].map((x) => `<line x1="${x}" y1="14" x2="${x}" y2="164"/>`).join("")}${[44, 74, 104, 134].map((y) => `<line x1="22" y1="${y}" x2="178" y2="${y}"/>`).join("")}</g>
<g fill="#6a645a">${[30, 58, 84, 110, 136, 162].map((x, i) => `<rect x="${x}" y="${120 + (i % 3) * 8}" width="${6 + (i % 2) * 4}" height="${44 - (i % 3) * 8}"/>`).join("")}</g>
<!--/set--><!-- high-backed chair -->
<path d="M36 240 L40 70 C40 52 52 44 68 44 L132 44 C148 44 160 52 160 70 L164 240 Z" fill="#1a1c23"/>
<path d="M44 236 L46 72 C46 58 56 52 68 52 L132 52 C144 52 154 58 154 72 L156 236" stroke="#353945" stroke-width="1.5" fill="none"/>
<!-- the man: shoulders and head in silhouette with a cold rim -->
<path d="M18 240 L22 200 C36 180 60 172 76 168 L100 180 L124 168 C140 172 164 180 178 200 L182 240 Z" fill="#08090c"/>
<path d="M86 130 L114 130 L116 168 L84 168 Z" fill="#0a0b0e"/>
<path d="M72 88 C72 58 84 44 100 44 C116 44 128 58 128 88 C128 110 124 128 116 140 C110 148 104 152 100 152 C96 152 90 148 84 140 C76 128 72 110 72 88 Z" fill="#0a0b0e"/>
<path d="M72 80 C72 56 84 44 100 44 C116 44 128 56 128 80" stroke="#a9adb6" stroke-width="1.6" fill="none" opacity=".75"/>
<path d="M128 72 C130 96 126 124 114 142" stroke="#a9adb6" stroke-width="2" fill="none" opacity=".8"/>
<path d="M120 50 C126 56 129 64 129 72" stroke="#8b8f99" stroke-width="1.4" fill="none" opacity=".6"/>
<path d="M124 168 C142 172 164 180 178 200" stroke="#6d717b" stroke-width="1.6" fill="none" opacity=".7"/>
<path d="M76 168 C60 172 36 180 22 200" stroke="#3c3f47" stroke-width="1.2" fill="none" opacity=".7"/>
<!-- only the glasses catch the light -->
<g fill="none" stroke="#3a3d45" stroke-width="1.2"><rect x="80" y="88" width="17" height="10" rx="2"/><rect x="103" y="88" width="17" height="10" rx="2"/><path d="M97 92 L103 92"/></g>
<path d="M83 90 L92 90" stroke="#d9d4ca" stroke-width="2" stroke-linecap="round"/>
<path d="M106 90 L115 90" stroke="#d9d4ca" stroke-width="2" stroke-linecap="round" opacity=".7"/>
<!-- a white collar and the Candor pin in red -->
<path d="M86 166 L100 180 L114 166" stroke="#2e3038" stroke-width="2" fill="none"/>
<path d="M70 196 L76 190 L82 196 L76 202 Z" fill="${RED}"/>
`,
    0.35,
  );
}

/** Plan item 99: Tomas Reed, the harbour man the first case is after: a rain slicker, a knit cap, stubble. */
function reed(id: string, wrap: Wrap = frame): string {
  return wrap(
    id,
    `
<path d="M0 240 L6 194 C22 176 52 168 74 164 L100 176 L126 164 C148 168 178 176 194 194 L200 240 Z" fill="#2f3a2a"/>
<path d="M74 164 L100 176 L92 240 L64 240 L58 196 Z" fill="#3c4a35"/>
<path d="M126 164 L100 176 L108 240 L136 240 L142 196 Z" fill="#26301f"/>
<path d="M60 200 L140 200" stroke="#1a2116" stroke-width="2" opacity=".6"/>
<!-- the debt tag pinned to his slicker -->
<path d="M140 204 L160 200 L164 216 L144 220 Z" fill="${RED}"/><circle cx="144" cy="208" r="1.6" fill="#0b0c10"/>
<path d="M86 130 L114 130 L116 160 C108 166 92 166 84 160 Z" fill="${SKIN_MID}"/>
${face(
  "M72 90 C72 62 84 50 100 50 C116 50 128 62 128 90 C128 112 124 128 116 140 C110 148 105 152 100 152 C95 152 90 148 84 140 C76 128 72 112 72 90 Z",
  "M108 52 C122 56 128 68 128 90 C128 112 124 128 116 140 C110 148 105 152 100 152 C106 142 112 128 113 110 C114 92 114 68 108 52 Z",
)}
<g fill="${SKIN_DK}" opacity=".35">${Array.from({ length: 40 }, (_, i) => `<circle cx="${80 + ((i * 37) % 40)}" cy="${118 + ((i * 53) % 26)}" r=".9"/>`).join("")}</g>
<path d="M66 82 C64 52 80 36 100 36 C120 36 136 52 134 82 C126 74 114 70 100 70 C86 70 74 74 66 82 Z" fill="#5a2a24"/>
<g stroke="#43201b" stroke-width="1.4" opacity=".8">${[74, 84, 94, 104, 114, 124].map((x) => `<line x1="${x}" y1="46" x2="${x}" y2="76"/>`).join("")}</g>
<path d="M66 82 C78 74 122 74 134 82 L134 88 C122 80 78 80 66 88 Z" fill="#3d1c18"/>
<path d="M82 92 C86 90 92 90 96 92" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M104 92 C108 90 114 90 118 92" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M83 99 C87 97 92 97 95 99 C92 101 87 101 83 99 Z" fill="${INK}"/><path d="M105 99 C108 97 113 97 117 99 C113 101 108 101 105 99 Z" fill="${INK}"/>
<path d="M100 100 C99 110 97 116 96 120 C99 122 103 122 105 120" stroke="${SKIN_DK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M90 132 C96 129 104 129 111 131" stroke="${SKIN_DK}" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M73 76 C71 98 74 120 84 138" stroke="${P}" stroke-width="1.2" fill="none" opacity=".5"/>
`,
  );
}

/** Plan item 99: the Mind Under the River: a figure of cold light in the dark, cables where the shoulders end. */
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
  // Plan item 270: each withheld target a distinct backlit silhouette (a hat brim, a bob, a bald head with glasses, a
  // hood), its district's prop in shadow behind, cold rim light on its edge; the red bar a stamp across the eyes only.
  // (A grey head at 10% luminance on 8% read as four identical black squares.)
  const v = ((variant % 4) + 4) % 4;
  const RIM = "#9fbcd8";
  const FIG = "#08090c";
  const heads = [
    // a hat brim
    `<path d="M76 92 C76 70 86 60 100 60 C114 60 124 70 124 92 C124 114 119 132 111 143 C106 150 103 152 100 152 C97 152 94 150 89 143 C81 132 76 114 76 92 Z"/><path d="M48 70 C64 62 84 60 100 60 C116 60 136 62 152 70 C140 74 126 74 120 72 L118 40 C110 34 90 34 82 40 L80 72 C74 74 60 74 48 70 Z"/>`,
    // a bob
    `<path d="M66 108 C62 70 78 44 100 44 C122 44 138 70 134 108 C132 126 126 132 118 134 C114 146 106 152 100 152 C94 152 86 146 82 134 C74 132 68 126 66 108 Z"/>`,
    // a bald head with glasses
    `<path d="M74 86 C74 58 86 46 100 46 C114 46 126 58 126 86 C126 112 120 130 112 142 C106 150 103 152 100 152 C97 152 94 150 88 142 C80 130 74 112 74 86 Z"/>`,
    // a hood
    `<path d="M62 150 C58 110 66 66 100 36 C134 66 142 110 138 150 C126 158 112 160 100 160 C88 160 74 158 62 150 Z"/>`,
  ];
  // Plan item 321: each its own build under the head (one shared pair of shoulders made any two prints overlap
  // 0.86): a trench with its collar turned up, narrow shoulders, a heavy man's broad ones, a cloak falling from the hood.
  const bodies = [
    `<path d="M30 240 L34 200 C44 186 58 178 74 174 L68 134 L86 150 L100 160 L114 150 L132 134 L126 174 C142 178 156 186 166 200 L170 240 Z"/>`,
    `<path d="M36 240 L40 206 C52 190 74 184 88 182 L92 150 L108 150 L112 182 C126 184 148 190 160 206 L164 240 Z"/>`,
    `<path d="M0 240 L2 188 C16 170 48 162 76 158 L100 166 L124 158 C152 162 184 170 198 188 L200 240 Z"/>`,
    `<path d="M54 240 C56 206 62 178 68 150 L132 150 C138 178 144 206 146 240 Z"/>`,
  ];
  const rims = [
    `<path d="M48 70 C64 62 84 60 100 60 C116 60 136 62 152 70" stroke="${RIM}" stroke-width="2" fill="none"/><path d="M118 40 C110 34 90 34 82 40" stroke="${RIM}" stroke-width="1.6" fill="none"/>`,
    `<path d="M66 108 C62 70 78 44 100 44 C122 44 138 70 134 108" stroke="${RIM}" stroke-width="2" fill="none"/>`,
    `<path d="M74 84 C74 58 86 46 100 46 C114 46 126 58 126 84" stroke="${RIM}" stroke-width="2" fill="none"/><g stroke="${RIM}" stroke-width="1.6" fill="none"><circle cx="88" cy="96" r="8"/><circle cx="112" cy="96" r="8"/><path d="M96 96 h8"/></g>`,
    `<path d="M62 150 C58 110 66 66 100 36 C134 66 142 110 138 150" stroke="${RIM}" stroke-width="2" fill="none"/>`,
  ];
  // (by the List's order: 1 the clinic, 2 the plaza, 3 the tower, 4 the vault)
  const props = [
    // vault bars
    `<g fill="#151a21">${Array.from({ length: 7 }, (_, k) => `<rect x="${22 + k * 26}" y="20" width="7" height="200"/>`).join("")}</g>`,
    // a clinic drip stand
    `<g stroke="#151a21" stroke-width="4" fill="none"><path d="M156 200 V40 M140 40 h32"/></g><path d="M146 44 h20 v34 a10 10 0 0 1 -20 0 Z" fill="#151a21"/>`,
    // a plaza statue on its plinth
    `<g fill="#151a21"><rect x="140" y="150" width="44" height="60"/><path d="M152 150 v-40 c0 -10 6 -18 10 -18 s10 8 10 18 v40 Z"/><circle cx="162" cy="84" r="9"/><path d="M172 108 l14 -22" stroke="#151a21" stroke-width="5"/></g>`,
    // tower blinds
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
