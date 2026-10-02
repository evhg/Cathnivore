// Hedgerow's script, rewritten from the story bible in docs/design/hedgerow-v2.md section 4.
// One entry per level: its name, the beat before it (2-4 lines) and after it (1-2 lines).

import type { StoryLine } from "../engine";

export interface Beat {
  name: string;
  before: StoryLine[];
  after: StoryLine[];
}
