// The Almanac: Cath's field notes on every tower, specialisation, megastructure and enemy. Towers and
// megastructures are always open; enemies and bosses unlock the first time they are met (data.seen).

import { ENEMIES, MEGAS, SPECIALISATIONS, TOWERS, isBig } from "./engine";
import type { EnemyKind, MegaId, TowerKind } from "./engine";
import { enemyIcon, img, towerIcon } from "./icons";
import type { Subject } from "./render3d/turntable";

/** Set by setupAlmanac: shows a model on the turntable (null without WebGL). */
let viewer: ((s: Subject, title: string) => void) | null = null;

export type AlmanacTab = "towers" | "megas" | "enemies" | "bosses";

const TABS: [AlmanacTab, string][] = [
  ["towers", "Towers"],
  ["megas", "Megastructures"],
  ["enemies", "Enemies"],
  ["bosses", "Bosses"],
];

export const TOWER_LORE: Partial<Record<TowerKind, string>> = {
  hedgerow: "\"Three hundred years of hawthorn. Nothing gets through that hasn't been invited.\"",
  scarecrow: "\"Pip made him from Bea's old duffel coat. He has never once blinked.\"",
  beehive: "\"They work for honey and spite, in that order.\"",
  stall: "\"A fair price, a warm smile, and every neighbour fights harder.\"",
  pond: "\"Slow things down and the rest is just arithmetic.\"",
  barn: "\"Big, red, and surprisingly good at throwing hay.\"",
  silo: "\"Armour is only a suggestion to a grain silo.\"",
  mast: "\"Radio Mast Sol hears everything, including the vans that pretend not to be there.\"",
  tent: "\"Tea, a biscuit, and no more charm. Very restorative.\"",
  court: "\"Order, order. The boss will now be quiet.\"",
  hall: "\"Solidarity: every tower on the field hits harder.\"",
  windmill: "\"Gusts of honest wind. Vans do not enjoy it.\"",
  cannon: "\"Seeds, mostly. Occasionally a surprise turnip.\"",
};

export const MEGA_LORE: Record<MegaId, string> = {
  harvester: "\"Pip built it in a weekend and has not been allowed to forget it.\"",
  honeymarsh: "\"Sweet, sticky, and entirely unfair to anything with wheels.\"",
  fortress: "\"Three hundred years of hawthorn, now with battlements.\"",
  grandmarket: "\"Everyone on the field gets a discount on courage.\"",
  tribunal: "\"Court is in session. The defendant is a van.\"",
  stormhive: "\"Do not shake it. Do not even look at it sternly.\"",
  barrage: "\"Cath calls it 'gardening, at pace'.\"",
  sanctuary: "\"Tea for the wounded, and a very firm word for the rest.\"",
};

function stat(label: string, value: string): HTMLElement {
  const s = document.createElement("span");
  s.className = "alm-stat";
  const b = document.createElement("b");
  b.textContent = value;
  s.append(label + " ", b);
  return s;
}

function card(icon: string, title: string, text: string, stats: HTMLElement[], lore?: string, subject?: Subject): HTMLElement {
  const li = document.createElement("article");
  li.className = "alm-card";
  const body = document.createElement("div");
  const h = document.createElement("h3");
  h.textContent = title;
  const p = document.createElement("p");
  p.textContent = text;
  body.append(h, p);
  if (stats.length) {
    const row = document.createElement("div");
    row.className = "alm-stats";
    row.append(...stats);
    body.append(row);
  }
  if (lore) {
    const q = document.createElement("small");
    q.className = "alm-lore";
    q.textContent = lore;
    body.append(q);
  }
  li.append(img(icon, "alm-icon"), body);
  if (subject && viewer) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "alm-view";
    b.textContent = "3D";
    b.setAttribute("aria-label", `Turn the ${title} round in 3D`);
    const show = viewer;
    b.onclick = () => show(subject, title);
    li.append(b);
  }
  return li;
}

function towers(): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const kind of Object.keys(TOWERS) as TowerKind[]) {
    const t = TOWERS[kind];
    const stats = [stat("Cost", String(t.cost)), stat("Range", t.range.join(" / "))];
    if (t.damage[0] > 0) stats.push(stat("Damage", t.damage.join(" / ")));
    out.push(card(towerIcon(kind), t.name, t.blurb, stats, TOWER_LORE[kind], { tower: kind, tier: 3, spec: null }));
    SPECIALISATIONS[kind].forEach((s, i) => {
      const st = [stat("Cost", String(s.cost))];
      if (s.range) st.push(stat("Range", String(s.range)));
      if (s.damage) st.push(stat("Damage", String(s.damage)));
      out.push(card(towerIcon(kind, 4, i as 0 | 1), `${s.name} (${t.name}, tier 4)`, s.blurb, st, undefined, { tower: kind, tier: 4, spec: i as 0 | 1 }));
    });
  }
  return out;
}

function megas(): HTMLElement[] {
  return (Object.entries(MEGAS) as Array<[MegaId, (typeof MEGAS)[MegaId]]>).map(([id, m]) =>
    card(
      towerIcon(m.from[0], 4, 0),
      m.name,
      `${m.blurb} Built from a ${TOWERS[m.from[0]].name} and a ${TOWERS[m.from[1]].name}, side by side.`,
      [stat("Fee", String(m.cost)), ...(m.range ? [stat("Range", String(m.range))] : [])],
      MEGA_LORE[id],
      { mega: id },
    ),
  );
}

function enemies(boss: boolean, seen: Record<string, boolean>, describe: (k: EnemyKind) => string): HTMLElement[] {
  const all = (Object.keys(ENEMIES) as EnemyKind[]).filter((k) => isBig(k) === boss);
  return all.map((k) => {
    const e = ENEMIES[k];
    if (!seen[k]) {
      const c = card(enemyIcon(k), "???", "Not met yet. Cath will write it up when she does.", []);
      c.classList.add("locked");
      return c;
    }
    return card(enemyIcon(k), e.name, describe(k), [
      stat("Health", String(e.hp)),
      stat("Speed", String(e.speed)),
      stat("Bounty", String(e.bounty)),
      stat("Leak", String(e.leak)),
    ], undefined, { enemy: k });
  });
}

export function setupAlmanac(
  dlg: HTMLDialogElement,
  tabs: HTMLElement,
  list: HTMLElement,
  getSeen: () => Record<string, boolean>,
  describe: (k: EnemyKind) => string,
  view?: { box: HTMLElement; canvas: HTMLCanvasElement; caption: HTMLElement },
): () => void {
  let tab: AlmanacTab = "towers";
  if (view) {
    // The turntable (and three.js with it) loads the first time someone asks for a model.
    let table: { show: (s: Subject) => void; stop: () => void } | null = null;
    viewer = (s, title) => {
      view.box.hidden = false;
      view.caption.textContent = title;
      void import("./render3d/turntable").then(({ Turntable }) => {
        if (!Turntable.supported()) {
          view.box.hidden = true;
          return;
        }
        table ??= new Turntable(view.canvas);
        table.show(s);
      });
    };
    dlg.addEventListener("close", () => {
      table?.stop();
      view.box.hidden = true;
    });
  }
  const render = (): void => {
    tabs.replaceChildren();
    for (const [id, label] of TABS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `alm-tab${id === tab ? " on" : ""}`;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === tab));
      b.textContent = label;
      b.onclick = () => {
        tab = id;
        render();
      };
      tabs.append(b);
    }
    const seen = getSeen();
    const cards =
      tab === "towers" ? towers() : tab === "megas" ? megas() : enemies(tab === "bosses", seen, describe);
    list.replaceChildren(...cards);
    list.scrollTop = 0;
  };
  return () => {
    render();
    dlg.showModal();
  };
}
