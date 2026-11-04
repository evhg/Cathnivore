// Cath hosts Runnel (VISION.md: she is the face of every game). She greets each day's puzzle with a line
// that changes daily, reacts as the water spreads, and celebrates the win. Lines follow SPEC 3.2's voice:
// short, specific, dry, warm, with at most the odd exclamation mark.

import { cathSvg, type CathExpression, type CathPoseId } from '../../../shared/cath/cath'
import { cathSceneSvg, type CathMoment } from '../../../shared/cath/scene'
import { chosenOutfit } from '../../../shared/cath/wardrobe'
import { chosenPin } from '../../../shared/cath/pins'

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
  /** After a tap: the share of the board that is wet, whether it is solved, and (plan item 122) how many
   *  fields are watered and whether any channel spills, so her face follows the water. */
  react(fraction: number, solved: boolean, fields?: number, spilling?: boolean): void
  /** A line of her own (the first-visit lesson). */
  say(expression: CathExpression, text: string): void
  /** Plan item 122: the angle (SVG degrees) from the valley figure's shoulder to the glowing tile; with
   *  `always`, she points at it whatever the water is doing (the lesson's target). */
  aim(degrees: number | null, always?: boolean): void
}

export function createHost(face: HTMLElement, line: HTMLElement, stage?: HTMLElement | null, onLine?: () => void): HostView {
  let current: CathExpression | null = null
  let fieldsWet = 0
  let milestone = 0
  let shown = ''
  let wet = 0
  let pose: CathPoseId = 'clasped'
  let aimAt: number | null = null
  let aimAlways = false
  // Plan item 70: Cath stands in the valley too, half length by the stream. She looks round when the water
  // reaches a new field, and waves at a solve.
  const drawStage = (expression: CathExpression) => {
    if (!stage) return
    const p: CathPoseId = aimAlways && aimAt !== null && pose !== 'wave' ? 'point' : pose
    stage.dataset.expression = expression
    stage.dataset.pose = p
    const pointAt = p === 'point' && aimAt !== null ? aimAt : undefined
    // What the art draws (cath.ts clamps the arm to -85..15 degrees), so a test reads the real aim.
    stage.dataset.aim = pointAt === undefined ? '' : Math.min(Math.max(pointAt, -85), 15).toFixed(1)
    stage.innerHTML = cathSvg({ framing: 'half', expression, pose: p, pointAt, outfit: chosenOutfit(), pin: chosenPin(), animate: true })
  }
  const look = () => {
    if (!stage) return
    stage.classList.remove('look')
    void stage.offsetWidth
    stage.classList.add('look')
  }
  const show = (expression: CathExpression, text: string) => {
    if (expression !== current) {
      face.innerHTML = cathSvg({ framing: 'face', expression, outfit: chosenOutfit(), pin: chosenPin(), animate: true })
      current = expression
      drawStage(expression)
    }
    line.textContent = text
    if (text !== shown && shown) {
      face.classList.remove('perk')
      void face.offsetWidth
      face.classList.add('perk')
    }
    shown = text
    onLine?.()
  }
  // Plan item 122: the valley figure's face follows the water between her lines: a smirk on a tap, delight as
  // the front reaches a new field, worry while a channel spills, a wink on the solve.
  const mood = (expression: CathExpression) => {
    if (expression === current) return
    current = expression
    face.innerHTML = cathSvg({ framing: 'face', expression, outfit: chosenOutfit(), pin: chosenPin(), animate: true })
    drawStage(expression)
  }
  return {
    greet(daily, dayNumber) {
      milestone = 0
      wet = 0
      fieldsWet = 0
      pose = 'clasped'
      current = null
      const pool = daily ? GREETINGS : PRACTICE
      show('smirk', pool[(dayNumber - 1 + pool.length * 10) % pool.length]!)
    },
    say(expression, text) {
      show(expression, text)
    },
    aim(degrees, always = false) {
      const moved = degrees === null || aimAt === null ? degrees !== aimAt : Math.abs(degrees - aimAt) > 3
      if (!moved && always === aimAlways) return
      aimAt = degrees
      aimAlways = always
      if (pose === 'point' || always) drawStage(current ?? 'smirk')
    },
    react(fraction, solved, fields = 0, spilling = false) {
      if (fraction > wet && !solved) look()
      wet = fraction
      const reached = fields > fieldsWet
      fieldsWet = fields
      const nextPose: CathPoseId = solved ? 'wave' : fraction >= 0.4 ? 'point' : 'clasped'
      if (nextPose !== pose) {
        pose = nextPose
        drawStage(current ?? 'smirk')
      }
      if (solved) {
        show('wink', 'Every field watered, not a drop spilled. Beautiful work.')
        milestone = 3
      } else if (fraction >= 0.75 && milestone < 2) {
        show(spilling ? 'worried' : 'delighted', "Nearly there. I can hear the lettuces cheering.")
        milestone = 2
      } else if (fraction >= 0.4 && milestone < 1) {
        show(spilling ? 'worried' : 'determined', "That's the idea. Keep it flowing.")
        milestone = 1
      } else {
        mood(spilling ? 'worried' : reached ? 'delighted' : 'smirk')
      }
    },
  }
}

export function cathMarkup(expression: CathExpression, framing: 'face' | 'bust' | 'half' = 'bust'): string {
  return cathSvg({ framing, expression, outfit: chosenOutfit(), pin: chosenPin(), animate: true })
}

/** Cath posed for a moment (win card hop, etc.) in the player's chosen outfit. */
export function cathMoment(moment: CathMoment, framing: 'face' | 'bust' | 'half' = 'bust'): string {
  return cathSceneSvg(moment, { framing, outfit: chosenOutfit() })
}
