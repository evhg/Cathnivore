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

/** Plan item 188: the half-length figure ends flat at the hips, so in the valley something stands in front of that
 *  cut. Plan item 329: a wooden footbridge over the stream (it was a grey drystone wall in mid-field): she leans on its
 *  handrail (`vw-cope`, above the cut), its boarded parapet (`vw-wall`) on posts, the deck's edge, the stream running
 *  under it, and the verge down to the frame. Plan item 351: the parapet is a grained top board over the cut, then
 *  open spindles and a mid rail with the valley showing between (it read as a flat brown box). */
const VALLEY_WALL = `<svg class="valley-wall" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
<path class="vw-verge" d="M0 60 L0 47 Q18 38 46 40 L154 40 Q184 38 200 47 L200 60 Z"/>
<path class="vb-water" d="M0 51 Q40 47 90 50 T200 49 L200 57 Q150 54 100 56 T0 56 Z"/>
<path class="vb-ripple" d="M24 53 q6 -2 12 0 M118 52 q6 -2 12 0 M164 53 q5 -2 10 0"/>
<path class="vw-wall" d="M13 28 L14 12 L186 12 L187 28 Z"/>
<path class="vw-joint" d="M18 17 H60 M70 21 H120 M132 16 H182 M24 24 H92 M110 25 H176"/>
<path class="vb-rail" d="M12 34 H188 V38 H12 Z"/>
<path class="vb-spindle" d="M27 28 h4 v18 h-4 Z M44 28 h4 v18 h-4 Z M61 28 h4 v18 h-4 Z M78 28 h4 v18 h-4 Z M116 28 h4 v18 h-4 Z M133 28 h4 v18 h-4 Z M150 28 h4 v18 h-4 Z M167 28 h4 v18 h-4 Z"/>
<path class="vb-deck" d="M6 45 H194 L192 51 H8 Z"/>
<path class="vb-post" d="M10 4 h8 v44 h-8 Z M96 4 h8 v44 h-8 Z M182 4 h8 v44 h-8 Z"/>
<path class="vw-cope" d="M8 10 Q8 5 14 5 L186 5 Q192 5 192 10 L192 12 L8 12 Z"/>
<path class="vw-tuft" d="M2 52 l3 -9 l2 9 l3 -10 l3 10 Z M192 52 l3 -10 l2 10 l3 -8 l2 8 Z"/>
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
    // Plan item 268: her mood as a word a test (and the CSS) can read: delighted, worried, wink or calm.
    stage.dataset.mood = expression === 'delighted' || expression === 'worried' || expression === 'wink' ? expression : 'calm'
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
      // Plan item 268: her body reacts with her face: a hand to her chin while a channel spills, a cheer as the water
      // reaches a new field, a wave on the solve; otherwise pointing along the flow once it's under way.
      const nextPose: CathPoseId = solved ? 'wave' : spilling ? 'thinking' : reached ? 'cheer' : fraction >= 0.4 ? 'point' : 'clasped'
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
