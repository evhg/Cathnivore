import '../../shared/ui/base.css'
import './fonts.css'
import './tokens.css'
import './styles.css'

// The cards are already in the HTML (rendered from apps.ts at build time). This only staggers their
// entrance; with reduced motion, or without JS, they simply show.
document.querySelectorAll<HTMLElement>('.card').forEach((el, i) => el.style.setProperty('--order', String(i)))
document.documentElement.classList.add('ready')
