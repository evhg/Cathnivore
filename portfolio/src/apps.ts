// The apps on cathnivore.com's front page and their case studies, in the order they show. To add one,
// add an entry here: the front page cards and each /work/<id>/ page are rendered from this list at build
// time (scripts/build-site.ts), so no other file changes. A product visual is either a screenshot in
// portfolio/public/work/ ('image') or a small animated interface drawn in HTML and SVG ('ui').
//
//   status  'live'    public, the card links straight to it
//           'private' behind a password gate on this site (the case study links to the gate)
//           'lab'     in progress, no public link yet

export type AppStatus = 'live' | 'private' | 'lab'

export interface PortfolioApp {
  id: string
  name: string
  /** One short line under the name. */
  tagline: string
  /** Two or three sentences for the card. */
  blurb: string
  status: AppStatus
  /** Where the product lives. Required for live and private apps. */
  href?: string
  /** The call to action on the case study. */
  cta?: string
  /** Short labels, at most three. */
  tags: string[]
  /** The accent, one of the --accent-* tokens in tokens.css. */
  accent: 'gold' | 'lime' | 'violet' | 'teal'
  /** The card's place in the bento grid. */
  size: 'hero' | 'tall' | 'wide' | 'square'
  /** The product visual: screenshots (served from /work/) or a drawn interface. */
  visual: { kind: 'image'; src: string[]; alt: string } | { kind: 'ui'; ui: 'kicksmash' | 'sleeplab' | 'kinetiq' }
  /** The case study. */
  year: string
  problem: string
  built: string[]
  stack: string[]
  facts: Array<[string, string]>
}

export const APPS: PortfolioApp[] = [
  {
    id: 'games',
    name: 'Cathnivore Games',
    tagline: 'Four browser games, built and polished by AI around the clock',
    blurb:
      'A co-op strategy game, a daily puzzle, a 3D tower defence and NIGHT SHIFT, an 18+ noir shooter. Every one is improved by an AI build session every hour.',
    status: 'live',
    href: '/games/',
    cta: 'Play the games',
    tags: ['Games', 'WebGL', 'Daily'],
    accent: 'gold',
    size: 'hero',
    visual: {
      kind: 'image',
      src: ['/work/games-nightshift.webp', '/work/games-landing.webp', '/work/games-runnel.webp', '/work/games-nightshift-combat.webp'],
      alt: 'Screens from the games: the NIGHT SHIFT title scene in the rain, the games page with Cath, a Runnel puzzle and a NIGHT SHIFT firefight',
    },
    year: '2026',
    problem:
      'Can an AI build studio make games people return to, not demos? The bar is the best-crafted games on phones and the web.',
    built: [
      'Four games in one site: Cathnivore, Runnel, Hedgerow and NIGHT SHIFT, all free, all on phone and desktop.',
      'An autonomous loop: an AI session every hour picks the next item, builds it, screenshots it and ships it behind eight quality gates.',
      'A 3D first-person shooter with skinned enemies, armour that breaks, squad tactics, kill cams and a full district roster.',
      'Shared art and a recurring heroine, Cath, drawn entirely in code.',
    ],
    stack: ['TypeScript', 'three.js', 'React', 'WebAudio', 'Playwright', 'Vercel'],
    facts: [
      ['Games', '4'],
      ['Build sessions', '24 a day'],
      ['Quality gates', '8 per release'],
    ],
  },
  {
    id: 'kicksmash',
    name: 'Kicksmash',
    tagline: 'Padel match-ups in one link',
    blurb:
      'Create a match, share the link on WhatsApp, friends tap in. No app, no accounts, no passwords, with levels, tournaments and reminders built in.',
    status: 'live',
    href: 'https://kicksma.sh',
    cta: 'Visit kicksma.sh',
    tags: ['Sport', 'Web app', 'Open source'],
    accent: 'lime',
    size: 'tall',
    visual: { kind: 'ui', ui: 'kicksmash' },
    year: '2026',
    problem:
      'Organising a padel game still means a group chat, a spreadsheet and three people asking who is in. Every app that fixes it wants an install and an account first.',
    built: [
      'One link per match: friends enter a name once and they are in, with a waitlist, invites and an organiser link.',
      'Levels that move with results, balanced team suggestions, tournaments and push reminders an hour before.',
      'Passkeys, quiet hours and an inbox, in English, Russian and Spanish.',
      'Agent-native: a public REST API, an MCP server any assistant can add by URL, and signed webhooks.',
    ],
    stack: ['Next.js', 'Supabase Postgres', 'Drizzle', 'Web Push', 'MCP'],
    facts: [
      ['Installs needed', '0'],
      ['Languages', '3'],
      ['Licence', 'Apache-2.0'],
    ],
  },
  {
    id: 'sleeplab',
    name: 'Sleep Lab',
    tagline: 'A bedroom sleep lab on SwitchBot sensors',
    blurb:
      'Room climate, CO2 and light from SwitchBot devices, matched with sleep data from a wearable, in a home-screen dashboard with sleep-science targets.',
    status: 'live',
    href: 'https://sleep.cathnivore.com',
    cta: 'Open the demo',
    tags: ['Health', 'Home automation', 'PWA'],
    accent: 'teal',
    size: 'wide',
    visual: { kind: 'ui', ui: 'sleeplab' },
    year: '2026',
    problem:
      'Sleep trackers tell you how you slept, but not why. The bedroom itself, its air, warmth and light, is the missing half of the data.',
    built: [
      'SwitchBot hub, CO2 meter and camera feeding a Supabase backend, joined night by night with wearable sleep stages.',
      'A home-screen app with Today, Room, Body and Lab views, and sleep-science targets from verified research.',
      'A simulator that generates 90 realistic nights, so the demo runs without anyone\'s real data.',
    ],
    stack: ['Next.js', 'Supabase', 'Edge Functions', 'PWA', 'SwitchBot API'],
    facts: [
      ['Sensors', '3 in the room'],
      ['Demo data', '90 nights'],
      ['Install', 'Home screen'],
    ],
  },
  {
    id: 'kinetiq',
    name: 'Kinetiq',
    tagline: 'A padel racket brand, launching',
    blurb: 'The launch site and reservations for a premium padel racket. Shared privately while it is under NDA.',
    status: 'private',
    href: '/kinetiq',
    cta: 'Enter password',
    tags: ['Brand', 'E-commerce', '3D'],
    accent: 'violet',
    size: 'square',
    visual: { kind: 'ui', ui: 'kinetiq' },
    year: '2026',
    problem: 'A new racket brand needs a launch that feels like a flagship product, before a single racket has shipped.',
    built: [
      'A scroll-choreographed launch site with real-time 3D, an NDA gate and reservations.',
      'Details are shared privately while the brand is under NDA.',
    ],
    stack: ['Next.js', 'React Three Fiber', 'GSAP', 'Stripe'],
    facts: [
      ['Status', 'Under NDA'],
      ['Access', 'By password'],
    ],
  },
]

const STATUS_LABEL: Record<AppStatus, string> = { live: 'Live', private: 'Private', lab: 'In the lab' }

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const esc = escapeHtml

/** The animated interface drawn for apps without screenshots. Pure HTML and SVG: CSS does the motion. */
function uiVisual(ui: 'kicksmash' | 'sleeplab' | 'kinetiq'): string {
  if (ui === 'kicksmash') {
    return `<div class="ui ui-kicksmash" aria-hidden="true">
      <div class="phone">
        <div class="ks-head"><span class="ks-logo">kicksma.sh</span><span class="ks-code">/PLAY</span></div>
        <div class="ks-card">
          <span class="ks-when">Sat · 18:00</span>
          <span class="ks-where">Padel Club, court 3</span>
          <span class="ks-level">Silver · 2.5–3.5</span>
          <span class="ks-seats"><i class="seat on"></i><i class="seat on"></i><i class="seat on"></i><i class="seat pulse"></i></span>
          <span class="ks-join">Join · 1 spot left</span>
        </div>
        <div class="ks-bubble"><b>Ana</b> joined the match</div>
        <div class="ks-bubble two"><b>Teams</b> balanced · 3.1 vs 3.0</div>
      </div>
    </div>`
  }
  if (ui === 'sleeplab') {
    // A hypnogram (sleep stages) over a night, with CO2 and temperature drawn as they rise and fall.
    return `<div class="ui ui-sleeplab" aria-hidden="true">
      <div class="sl-top"><span class="sl-score"><b>86</b> sleep score</span><span class="sl-chip">CO2 742 ppm</span><span class="sl-chip">19.4°C</span></div>
      <svg class="sl-chart" viewBox="0 0 600 200" preserveAspectRatio="none">
        <path class="sl-grid" d="M0 50H600M0 100H600M0 150H600" />
        <path class="sl-stage" d="M0 40H40V90H90V140H150V170H200V140H230V90H260V50H285V100H330V150H370V175H410V140H440V90H470V50H500V95H540V60H600" />
        <path class="sl-co2" d="M0 160C80 150 140 120 220 105S360 70 430 72 540 96 600 120" />
        <path class="sl-temp" d="M0 118C90 122 160 132 240 136S400 128 470 118 560 104 600 100" />
      </svg>
      <div class="sl-legend"><span class="k-stage">Sleep stages</span><span class="k-co2">CO2</span><span class="k-temp">Temperature</span></div>
    </div>`
  }
  return `<div class="ui ui-kinetiq" aria-hidden="true">
      <svg class="kq-racket" viewBox="0 0 200 320">
        <defs>
          <radialGradient id="kq-glow" cx="50%" cy="38%" r="60%"><stop offset="0" stop-color="currentColor" stop-opacity=".55"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>
          <pattern id="kq-holes" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="3.2" fill="currentColor" opacity=".35"/></pattern>
        </defs>
        <ellipse cx="100" cy="120" rx="96" ry="112" fill="url(#kq-glow)"/>
        <path class="kq-head" d="M100 18C150 18 178 60 178 112S156 210 118 222V300H82V222C44 210 22 164 22 112S50 18 100 18Z"/>
        <path d="M100 30C143 30 166 66 166 112S146 198 100 206 34 158 34 112 57 30 100 30Z" fill="url(#kq-holes)"/>
      </svg>
      <span class="kq-nda">Under NDA</span>
    </div>`
}

/** The product visual for a card (the first three screens, fanned) or a case study (every screen). */
export function visualHtml(app: PortfolioApp, where: 'card' | 'case'): string {
  if (app.visual.kind === 'ui') return uiVisual(app.visual.ui)
  const alt = app.visual.alt
  const imgs = where === 'case' ? app.visual.src : app.visual.src.slice(0, 3)
  return `<div class="shots shots-${imgs.length}">${imgs
    .map(
      (src, i) =>
        `<img src="${esc(src)}" alt="${i === 0 ? esc(alt) : ''}" width="1440" height="900" ${i === 0 && where === 'case' ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`,
    )
    .join('')}</div>`
}

const statusChip = (app: PortfolioApp) =>
  `<span class="status status-${app.status}">${STATUS_LABEL[app.status]}${app.status === 'private' ? '<span class="lock" aria-hidden="true"></span>' : ''}</span>`

/** One bento card. Every card opens its case study; the case study links out to the product. */
export function cardHtml(app: PortfolioApp): string {
  return `<li class="cell cell-${app.size}">
          <a class="card accent-${app.accent}" data-app="${app.id}" href="/work/${app.id}/">
            <span class="visual" data-vt="${app.id}">${visualHtml(app, 'card')}</span>
            <span class="card-body">
              <span class="card-top">${statusChip(app)}<span class="tags">${app.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span></span>
              <span class="card-name">${esc(app.name)}</span>
              <span class="card-tagline">${esc(app.tagline)}</span>
              <span class="card-blurb">${esc(app.blurb)}</span>
              <span class="go" aria-hidden="true">Case study</span>
            </span>
          </a>
        </li>`
}

/** Every card, for the page's <!--apps--> placeholder. */
export function appsHtml(apps: PortfolioApp[] = APPS): string {
  return apps.map(cardHtml).join('\n        ')
}

/** The body of /work/<id>/: hero visual (shared element with the card), story, stack and facts. */
export function caseHtml(app: PortfolioApp): string {
  const i = APPS.findIndex((a) => a.id === app.id)
  const next = APPS[(i + 1) % APPS.length]!
  const external = app.href?.startsWith('http')
  const link = app.href
    ? `<a class="btn btn-primary" href="${esc(app.href)}"${external ? ' rel="noopener" target="_blank"' : ''}>${esc(app.cta ?? 'Open')}</a>`
    : ''
  return `<article class="case accent-${app.accent}" data-app="${app.id}">
        <a class="back" href="/#portfolio">All products</a>
        <header class="case-head">
          <p class="eyebrow">${statusChip(app)} <span>${esc(app.year)}</span></p>
          <h1>${esc(app.name)}</h1>
          <p class="lede">${esc(app.tagline)}</p>
          ${link}
        </header>
        <div class="case-visual visual" data-vt="${app.id}">${visualHtml(app, 'case')}</div>
        <div class="case-grid">
          <section class="case-block reveal">
            <h2>The problem</h2>
            <p>${esc(app.problem)}</p>
          </section>
          <section class="case-block reveal">
            <h2>What we built</h2>
            <ul>${app.built.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
          </section>
          <aside class="case-side reveal">
            <dl class="facts">${app.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
            <h2>Built with</h2>
            <p class="stack">${app.stack.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</p>
          </aside>
        </div>
        <a class="next" href="/work/${next.id}/"><span>Next</span> ${esc(next.name)}</a>
      </article>`
}
