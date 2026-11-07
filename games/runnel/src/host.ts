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

// (each about the same length: a practice greeting that wrapped to a third line pushed a phone's board 11 px down,
// past runnel-practice's 260 px, on one load in three)
const PRACTICE = [
  "Practice round. I'm only counting a little.",
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

/** Plan item 188: the half-length figure ends flat at the hips, so in the valley she stands behind a drystone wall
 *  on a grass verge: the wall's coping sits above that cut, and the verge runs down to the frame. */
const VALLEY_WALL = `<svg class="valley-wall" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
<path class="vw-verge" d="M0 60 L0 47 Q18 38 46 40 L154 40 Q184 38 200 47 L200 60 Z"/>
<path class="vw-wall" d="M12 48 L15 16 Q16 11 24 11 L176 11 Q184 11 185 16 L188 48 Z"/>
<path class="vw-joint" d="M15 24 H185 M14 36 H186 M40 11 V24 M78 11 V24 M120 11 V24 M158 11 V24 M24 24 V36 M60 24 V36 M100 24 V36 M140 24 V36 M174 24 V36 M42 36 V48 M82 36 V48 M122 36 V48 M162 36 V48"/>
<path class="vw-cope" d="M14 13 Q14 5 22 5 L178 5 Q186 5 186 13 Z"/>
<path class="vw-joint" d="M30 5 V12 M46 5 V12 M62 5 V12 M78 5 V12 M94 5 V12 M110 5 V12 M126 5 V12 M142 5 V12 M158 5 V12 M172 5 V12"/>
<path class="vw-tuft" d="M8 50 l4 -9 l2 9 l4 -11 l3 11 Z M30 50 l3 -7 l3 7 Z M92 50 l3 -8 l2 8 l4 -6 l2 6 Z M150 50 l3 -7 l3 7 Z M178 50 l3 -10 l3 10 l4 -8 l2 8 Z"/>
</svg>`

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
    stage.innerHTML = cathSvg({ framing: 'half', expression, pose: p, pointAt, outfit: chosenOutfit(), pin: chosenPin(), animate: true }) + VALLEY_WALL
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
