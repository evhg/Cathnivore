// Plan item 113: what Cath says about each chapter on the Campaign screen, in her voice (VISION.md's character
// bible: warm, wry, practical). Her expression goes with the line. Shown in her speech bubble beside her for
// the chapter picked, hovered or focused, and for the next chapter by default.
import type { CathExpression } from '../../shared/cath/cath'

export interface CampaignLine {
  line: string
  expression: CathExpression
}

export const CAMPAIGN_LINES: Record<string, CampaignLine> = {
  'fresh-meat': { line: 'Two regions and one stall. We start where the bunting is already up.', expression: 'smirk' },
  'word-of-mouth': { line: 'Keep Public Trust above nothing. People talk, so give them something kind to say.', expression: 'wink' },
  'growing-season': { line: 'Three regions of four. Plant early, sell late and mind the weather.', expression: 'determined' },
  'the-plan': { line: 'Hollowell has a plan. So do we, and ours comes with a friend.', expression: 'smirk' },
  'friends-in-low-places': { line: 'Seven rounds, three regions. Leave the capital to the suits for now.', expression: 'determined' },
  kingsmarket: { line: 'Five regions and the Kingsmarket. This is the one they will write about.', expression: 'delighted' },
}

/** Her line once every chapter is done. */
export const CAMPAIGN_DONE_LINE: CampaignLine = { line: 'Every stall in Marrow is ours. Play any of it again. I will put the kettle on.', expression: 'delighted' }

export function campaignLine(chapterId: string | undefined, allDone: boolean): CampaignLine {
  if (chapterId && CAMPAIGN_LINES[chapterId]) return CAMPAIGN_LINES[chapterId]!
  return allDone ? CAMPAIGN_DONE_LINE : CAMPAIGN_LINES['fresh-meat']!
}
