// Portraits for Hedgerow's cast beside Cath (who comes from shared/cath): Mara, the bean farmer in her
// sixties; Bea, Cath's daughter, six; Tomas, who runs the Highmoor market; Sol, who broadcasts from a
// radio mast; and Marrow itself, the narrator, as a hedgerow badge. Same drawing language as Cath: soft
// shapes, ink outlines, warm skin, a little blush. SVG strings with presentation attributes only (the CSP
// forbids inline style attributes).

export type CastMember = "mara" | "bea" | "tomas" | "sol" | "narrator";

const INK = "#3A2A24";

function face(skin: string, shade: string): string {
  return `<path d="M50 78 C50 40 110 40 110 78 C110 118 94 140 80 140 C66 140 50 118 50 78Z" fill="${skin}" stroke="${INK}" stroke-width="2.5"/>
<path d="M58 112 C66 132 94 132 102 112 C96 136 64 136 58 112Z" fill="${shade}" opacity=".45"/>
<ellipse cx="62" cy="104" rx="7" ry="4" fill="#F29A93" opacity=".45"/><ellipse cx="98" cy="104" rx="7" ry="4" fill="#F29A93" opacity=".45"/>`;
}

function eyes(y: number, iris: string, lashes = false): string {
  const lash = lashes ? `<path d="M60 ${y - 6} l-4 -3 M100 ${y - 6} l4 -3" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` : "";
  return `<ellipse cx="67" cy="${y}" rx="5.5" ry="6.5" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="68" cy="${y + 1}" r="3.6" fill="${iris}"/><circle cx="69.5" cy="${y - 0.5}" r="1.2" fill="#fff"/>
<ellipse cx="93" cy="${y}" rx="5.5" ry="6.5" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="94" cy="${y + 1}" r="3.6" fill="${iris}"/><circle cx="95.5" cy="${y - 0.5}" r="1.2" fill="#fff"/>${lash}`;
}

function mara(): string {
  return `<path d="M30 190 C34 150 56 140 80 140 C104 140 126 150 130 190Z" fill="#4F7F37" stroke="${INK}" stroke-width="2.5"/>
<path d="M66 142 L80 160 L94 142" fill="#E9DFC8" stroke="${INK}" stroke-width="2"/>
<path d="M44 80 C40 40 120 40 116 80 C112 60 48 60 44 80Z" fill="#C9C4BC" stroke="${INK}" stroke-width="2.5"/>
<circle cx="80" cy="36" r="14" fill="#C9C4BC" stroke="${INK}" stroke-width="2.5"/>
${face("#E8C2A6", "#C99A80")}
<path d="M54 74 C62 56 98 56 106 74 C98 64 62 64 54 74Z" fill="#B7B0A6"/>
${eyes(92, "#4E6B3A")}
<path d="M58 82 q9 -5 17 -1 M85 81 q8 -4 17 1" stroke="#8A8178" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M60 98 q4 2 8 0 M92 98 q4 2 8 0" stroke="${INK}" stroke-width="1" fill="none" opacity=".5"/>
<path d="M78 98 q-3 10 2 12" stroke="${INK}" stroke-width="1.8" fill="none"/>
<path d="M70 120 q10 7 20 0" stroke="#A65B4E" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<circle cx="50" cy="104" r="3" fill="#D4AE58" stroke="${INK}"/><circle cx="110" cy="104" r="3" fill="#D4AE58" stroke="${INK}"/>`;
}

function bea(): string {
  return `<path d="M38 190 C42 156 60 146 80 146 C100 146 118 156 122 190Z" fill="#E8748B" stroke="${INK}" stroke-width="2.5"/>
<path d="M64 150 q16 10 32 0" stroke="#fff" stroke-width="3" fill="none"/>
<circle cx="38" cy="96" r="16" fill="#2E211C" stroke="${INK}" stroke-width="2.5"/><circle cx="122" cy="96" r="16" fill="#2E211C" stroke="${INK}" stroke-width="2.5"/>
<path d="M30 80 l10 -4 l2 10Z M130 80 l-10 -4 l-2 10Z" fill="#F2C94C" stroke="${INK}" stroke-width="1.5"/>
<path d="M52 84 C50 54 110 54 108 84 C108 120 96 144 80 144 C64 144 52 120 52 84Z" fill="#F7DCCB" stroke="${INK}" stroke-width="2.5"/>
<ellipse cx="62" cy="112" rx="8" ry="5" fill="#F29A93" opacity=".6"/><ellipse cx="98" cy="112" rx="8" ry="5" fill="#F29A93" opacity=".6"/>
<path d="M50 84 C52 50 108 50 110 84 C100 66 92 72 80 64 C70 74 60 66 50 84Z" fill="#2E211C" stroke="${INK}" stroke-width="2.5"/>
<g transform="translate(0 4)">${eyes(96, "#5A3A28")}</g>
<circle cx="64" cy="112" r="1" fill="#C98A6A"/><circle cx="70" cy="114" r="1" fill="#C98A6A"/><circle cx="90" cy="114" r="1" fill="#C98A6A"/><circle cx="96" cy="112" r="1" fill="#C98A6A"/>
<path d="M70 124 q10 10 20 0 q-10 4 -20 0Z" fill="#C9566B" stroke="${INK}" stroke-width="1.6"/>`;
}

function tomas(): string {
  return `<path d="M26 190 C30 150 54 138 80 138 C106 138 130 150 134 190Z" fill="#3F6FB5" stroke="${INK}" stroke-width="2.5"/>
<path d="M56 144 v46 M104 144 v46" stroke="#E9DFC8" stroke-width="10"/>
${face("#D9A882", "#B98361")}
<path d="M54 104 C56 140 104 140 106 104 C100 128 94 132 80 132 C66 132 60 128 54 104Z" fill="#5A3A28" stroke="${INK}" stroke-width="2"/>
<path d="M68 116 q12 -6 24 0" stroke="#5A3A28" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M74 120 q6 4 12 0" stroke="#A65B4E" stroke-width="2.2" fill="none"/>
${eyes(88, "#3A5E8A")}
<path d="M58 78 q9 -4 17 0 M85 78 q8 -4 17 0" stroke="#4A3226" stroke-width="3.4" fill="none" stroke-linecap="round"/>
<path d="M78 92 q-3 10 3 12" stroke="${INK}" stroke-width="1.8" fill="none"/>
<path d="M42 66 C46 40 116 38 120 64 L128 70 C110 72 60 72 42 70Z" fill="#6B4A2B" stroke="${INK}" stroke-width="2.5"/>
<path d="M50 60 q30 -8 64 0" stroke="#8A6545" stroke-width="2" fill="none"/>`;
}

function sol(): string {
  return `<path d="M30 190 C34 152 56 140 80 140 C104 140 126 152 130 190Z" fill="#D9822B" stroke="${INK}" stroke-width="2.5"/>
<path d="M64 140 q16 14 32 0" fill="none" stroke="${INK}" stroke-width="2"/>
${["44,62", "56,46", "74,40", "92,42", "108,52", "118,68", "40,80", "120,84"].map((p) => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="14" fill="#3A2A24"/>`).join("")}
${face("#B7835F", "#95623F")}
<path d="M52 76 C56 56 104 56 108 76 C96 66 64 66 52 76Z" fill="#3A2A24"/>
${eyes(92, "#3A2A24", true)}
<path d="M60 82 q8 -4 15 -1 M85 81 q7 -3 15 1" stroke="#2A1D18" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M78 98 q-3 9 2 11" stroke="${INK}" stroke-width="1.8" fill="none"/>
<path d="M68 118 q12 10 24 0 q-12 3 -24 0Z" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
<path d="M44 92 C40 48 120 48 116 92" fill="none" stroke="#2B2320" stroke-width="6"/>
<rect x="34" y="84" width="16" height="24" rx="6" fill="#2B2320"/><rect x="110" y="84" width="16" height="24" rx="6" fill="#2B2320"/>
<path d="M50 104 q8 16 24 16" stroke="#2B2320" stroke-width="3" fill="none"/><circle cx="76" cy="120" r="4" fill="#2B2320"/>`;
}

function narrator(): string {
  return `<circle cx="80" cy="95" r="70" fill="#6E625A" stroke="${INK}" stroke-width="3"/>
<circle cx="80" cy="95" r="58" fill="#F4EDE1"/>
<circle cx="80" cy="70" r="16" fill="#F2C94C"/>
<path d="M30 110 Q80 84 130 110 V130 Q80 150 30 130Z" fill="#7FA35A"/>
${[42, 58, 74, 90, 106, 120].map((x, i) => `<circle cx="${x}" cy="${112 - (i % 2) * 6}" r="10" fill="${i % 2 ? "#5E8F41" : "#4F7F37"}" stroke="${INK}" stroke-width="1.5"/>`).join("")}
<path d="M48 136 h64" stroke="#9A7246" stroke-width="6" stroke-linecap="round"/>`;
}

export function castSvg(who: CastMember): string {
  const body = who === "mara" ? mara() : who === "bea" ? bea() : who === "tomas" ? tomas() : who === "sol" ? sol() : narrator();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 190" aria-hidden="true" focusable="false" class="cast cast-${who}">${body}</svg>`;
}
