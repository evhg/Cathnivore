// Gate 7 (2026-11-27): the production build renders with Preact (vite.config.ts aliases react to preact/compat;
// dev and the unit tests keep React). Where the two libraries write the DOM differently, this hook makes Preact
// write what React does. Import it before anything renders (main.tsx). Under React it installs a hook nothing calls.
import { options, type VNode } from 'preact'

const previous = options.vnode
options.vnode = (vnode: VNode) => {
  const props = vnode.props as Record<string, unknown> | null
  if (typeof vnode.type === 'string' && props && 'tabIndex' in props) {
    // React writes `tabindex`; Preact sets an SVG element's props with setAttribute under their own name, and an
    // attribute spelt `tabIndex` doesn't make the board's hexes (<g tabIndex={0}>) focusable.
    props.tabindex = props.tabIndex
    delete props.tabIndex
  }
  previous?.(vnode)
}
