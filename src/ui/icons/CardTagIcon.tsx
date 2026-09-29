// ROADMAP 17: one small icon per card category, drawn in the same flat two-tone style as the other
// icons. Decorative only (aria-hidden): the category is always also written out in the card's label.
const PATHS: Record<string, JSX.Element> = {
  // pasture: a cow's head with horns
  pasture: (
    <>
      <path d="M3 6c0 3 2 3 3 3M21 6c0 3-2 3-3 3" fill="none" strokeWidth="1.6" />
      <rect x="6" y="7" width="12" height="11" rx="5" />
      <circle cx="10" cy="12" r="1" className="ti-eye" />
      <circle cx="14" cy="12" r="1" className="ti-eye" />
    </>
  ),
  // crop: an ear of wheat
  crop: (
    <>
      <path d="M12 21V8" fill="none" strokeWidth="1.6" />
      <ellipse cx="12" cy="6" rx="2" ry="3.2" />
      <ellipse cx="8.6" cy="10" rx="1.8" ry="3" transform="rotate(-30 8.6 10)" />
      <ellipse cx="15.4" cy="10" rx="1.8" ry="3" transform="rotate(30 15.4 10)" />
      <ellipse cx="8.6" cy="15" rx="1.8" ry="3" transform="rotate(-30 8.6 15)" />
      <ellipse cx="15.4" cy="15" rx="1.8" ry="3" transform="rotate(30 15.4 15)" />
    </>
  ),
  // coast: a sailing boat
  coast: (
    <>
      <path d="M12 3v13M12 4l7 10h-7M11 6L5 14h6" />
      <path d="M3 18h18l-2.5 3h-13z" />
    </>
  ),
  // community: a house with a heart-shaped door
  community: (
    <>
      <path d="M3 12L12 4l9 8" fill="none" strokeWidth="1.6" />
      <path d="M6 11h12v9H6z" />
      <circle cx="12" cy="15.5" r="1.8" className="ti-eye" />
    </>
  ),
  // media: a megaphone
  media: (
    <>
      <path d="M4 9h4l8-4v14l-8-4H4z" />
      <path d="M7 14l1 6h3l-1-5" />
      <path d="M19 9c1.3 1.2 1.3 4.8 0 6" fill="none" strokeWidth="1.6" />
    </>
  ),
  // science: a flask
  science: (
    <>
      <path d="M9 3h6M10 3v6l-5 10a1.5 1.5 0 0 0 1.4 2h11.2a1.5 1.5 0 0 0 1.4-2l-5-10V3" />
      <path d="M8 15h8" className="ti-eye" strokeWidth="1.4" />
    </>
  ),
}

export default function CardTagIcon({ tag }: { tag: string | undefined }) {
  const body = tag ? PATHS[tag] : undefined
  if (!body) return null
  return (
    <svg className="card-tag-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" data-tag={tag}>
      {body}
    </svg>
  )
}
