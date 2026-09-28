// Cath hosts Runnel (VISION.md: she is the face of every game). She greets each day's puzzle with a line
// that changes daily, reacts as the water spreads, and celebrates the win. Lines follow SPEC 3.2's voice:
// short, specific, dry, warm, with at most the odd exclamation mark.

import { cathSvg, type CathExpression } from '../../../shared/cath/cath'

const GREETINGS = [
  "Morning. The spring's running and the fields are thirsty. Let's fix that.",
  "Bea drew today's field plan. I've kept the pipes. You keep the water moving.",
  'Market day. Nothing sells like a well-watered cabbage.',
  "Coffee's on. Channels are crooked. You know the drill.",
  "Somebody from Hollowell called this land 'underperforming'. Let's prove them wrong.",
  'Rain forecast: none. Your job: everything.',
  'A tidy runnel is a happy farm. A happy farm is a quiet Tuesday.',
  "The carrots have been very patient. They'd like a drink now, please.",
  "I timed myself on this one. I'm not telling you my time.",
  'Every field, no spills. Easy to say. Lovely to do.',
]

const PRACTICE = [
  "Practice round. No one's counting. I'm counting a little.",
  'Warm-up field. Stretch those tapping fingers.',
  'A spare field. Treat it like the real thing.',
]

export interface HostView {
  greet(daily: boolean, dayNumber: number): void
  react(fraction: number, solved: boolean): void
}

export function createHost(face: HTMLElement, line: HTMLElement): HostView {
  let current: CathExpression | null = null
  let milestone = 0
  const show = (expression: CathExpression, text: string) => {
    if (expression !== current) {
      face.innerHTML = cathSvg({ framing: 'face', expression, animate: true })
      current = expression
    }
    line.textContent = text
  }
  return {
    greet(daily, dayNumber) {
      milestone = 0
      const pool = daily ? GREETINGS : PRACTICE
      show('smirk', pool[(dayNumber - 1 + pool.length * 10) % pool.length]!)
    },
    react(fraction, solved) {
      if (solved) {
        show('delighted', 'Every field watered, not a drop spilled. Beautiful work.')
        milestone = 3
      } else if (fraction >= 0.75 && milestone < 2) {
        show('wink', "Nearly there. I can hear the lettuces cheering.")
        milestone = 2
      } else if (fraction >= 0.4 && milestone < 1) {
        show('determined', "That's the idea. Keep it flowing.")
        milestone = 1
      }
    },
  }
}

export function cathMarkup(expression: CathExpression, framing: 'face' | 'bust' | 'half' = 'bust'): string {
  return cathSvg({ framing, expression, animate: true })
}
