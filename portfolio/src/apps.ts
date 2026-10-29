// The apps on cathnivore.com's front page, in the order they show. To add one, add an entry here: the
// page is rendered from this list at build time (scripts/build-site.ts), so no other file changes.
//
//   status  'live'    public, the card links straight to it
//           'private' behind a password gate on this site (the card links to the gate)
//           'lab'     in progress, no public link yet (the card has no link)

export type AppStatus = 'live' | 'private' | 'lab'

export interface PortfolioApp {
  id: string
  name: string
  /** One short line under the name. */
  tagline: string
  /** Two or three sentences for the card. */
  blurb: string
  status: AppStatus
  /** Where the card goes. Required for live and private apps, absent for lab ones. */
  href?: string
  /** Short labels, at most three. */
  tags: string[]
  /** The card's accent, one of the --accent-* tokens in tokens.css. */
  accent: 'gold' | 'lime' | 'violet' | 'teal'
  /** One or two letters drawn as the card's mark. */
  mark: string
}

export const APPS: PortfolioApp[] = [
  {
    id: 'games',
    name: 'Cathnivore Games',
    tagline: 'Four free browser games starring Cath',
    blurb:
      'A co-op strategy game, Runnel the daily irrigation puzzle, Hedgerow the tower defence, and NIGHT SHIFT, an 18+ noir shooter. All play on phone and desktop with no install.',
    status: 'live',
    href: '/games/',
    tags: ['Games', 'Web', 'iPhone'],
    accent: 'gold',
    mark: 'C',
  },
  {
    id: 'kicksmash',
    name: 'Kicksmash',
    tagline: 'Padel match-ups in one link',
    blurb:
      'Create a match, share the link on WhatsApp, and friends tap in. No app, no accounts, no passwords, with levels, tournaments and reminders built in.',
    status: 'live',
    href: 'https://kicksma.sh',
    tags: ['Sport', 'Web app', 'Open source'],
    accent: 'lime',
    mark: 'K',
  },
  {
    id: 'kinetiq',
    name: 'Kinetiq',
    tagline: 'A padel racket brand, launching',
    blurb: 'The launch site and reservations for a premium padel racket. Shared privately while it is under NDA.',
    status: 'private',
    href: '/kinetiq',
    tags: ['Brand', 'E-commerce', '3D'],
    accent: 'violet',
    mark: 'Q',
  },
  {
    id: 'sleeplab',
    name: 'Sleep Lab',
    tagline: 'A bedroom sleep lab on SwitchBot sensors',
    blurb:
      'Room climate, CO2 and light from SwitchBot devices, matched with sleep data from a wearable, in a home-screen dashboard with sleep-science targets. The demo runs on 90 simulated nights.',
    status: 'live',
    href: 'https://sleep-lab-lac.vercel.app',
    tags: ['Health', 'Home automation', 'PWA'],
    accent: 'teal',
    mark: 'Z',
  },
]

const STATUS_LABEL: Record<AppStatus, string> = { live: 'Live', private: 'Private', lab: 'In the lab' }

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** One card's HTML. Live and private cards are links; lab cards are plain articles. */
export function cardHtml(app: PortfolioApp): string {
  const external = app.href?.startsWith('http')
  const inner = `
          <span class="mark" aria-hidden="true">${escape(app.mark)}</span>
          <span class="status status-${app.status}">${STATUS_LABEL[app.status]}${app.status === 'private' ? '<span class="lock" aria-hidden="true"></span>' : ''}</span>
          <span class="card-name">${escape(app.name)}</span>
          <span class="card-tagline">${escape(app.tagline)}</span>
          <span class="card-blurb">${escape(app.blurb)}</span>
          <span class="tags">${app.tags.map((t) => `<span class="tag">${escape(t)}</span>`).join('')}</span>
          ${app.href ? `<span class="go" aria-hidden="true">${app.status === 'private' ? 'Enter password' : external ? 'Visit' : 'Open'}</span>` : ''}`
  const cls = `card accent-${app.accent}`
  if (!app.href) return `<li><article class="${cls} card-lab" data-app="${app.id}">${inner}\n        </article></li>`
  const rel = external ? ' rel="noopener" target="_blank"' : ''
  return `<li><a class="${cls}" data-app="${app.id}" href="${escape(app.href)}"${rel}>${inner}\n        </a></li>`
}

/** Every card, for the page's <!--apps--> placeholder. */
export function appsHtml(apps: PortfolioApp[] = APPS): string {
  return apps.map(cardHtml).join('\n        ')
}
