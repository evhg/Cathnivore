// Hedgerow's script for acts 6-10 (levels 51-100) and the finale.
// Written from the story bible in docs/design/hedgerow-v2.md section 4.
// Recurring threads: the Oakvale water inquiry (act 7), Ines standing against Pell (act 8),
// Pip's board minutes (act 9), the 1342 charter and the traders' licences (act 10),
// and Bea's school project, "What my mum does", which she reads in the finale.

import type { StoryLine } from "../engine";
import type { Beat } from "./types";

export const ACTS_6_TO_10: Record<number, Beat> = {
  // Act 6, Shingle Bay: imports by sea.
  51: {
    name: "Shingle Bay",
    before: [
      {
        who: "narrator",
        text: "Shingle Bay: six boats, one ice plant, and since Tuesday a container ship anchored a mile out with its lights off.",
      },
      {
        who: "tomas",
        text: "Dot Varley landed forty boxes of crab yesterday. The Kingsmarket fish van took none. It had bought the ship's, at half her price.",
      },
      {
        who: "cath",
        expression: "determined",
        text: "They run it ashore at night in fast tenders and drive it up the beach road. So we hold the beach road.",
      },
      {
        who: "mara",
        text: "And we hold it without telling Pip Talbot where.",
      },
    ],
    after: [
      {
        who: "cath",
        expression: "smirk",
        text: "Pip rang twice tonight to ask how it went. I said quiet. Let's see who he tells.",
      },
    ],
  },
  52: {
    name: "Low Tide",
    before: [
      {
        who: "sol",
        text: "Shingle Bay tide report: low water at 5:12. That's eight hundred yards of hard sand and no reason for a tender to slow down.",
      },
      {
        who: "cath",
        text: "Ponds at the top of the beach to take the speed off them. Every one we turn back pays the co-op tin a bit extra today.",
      },
    ],
    after: [
      {
        who: "tomas",
        text: "Eleven tenders turned round. Dot's selling crab off the sea wall and the queue's twenty deep.",
      },
    ],
  },
  53: {
    name: "Net Mending",
    before: [
      {
        who: "tomas",
        text: "After diesel, ice and Dot's new nets, the co-op tin's light. Four good things on that lane, maybe. Turn boats back and it refills.",
      },
      {
        who: "bea",
        text: "Miss Penrose says we have to find out what our mums do. For a project. What do you do?",
      },
      {
        who: "cath",
        expression: "smirk",
        text: "This week? Mostly arithmetic.",
      },
    ],
    after: [
      {
        who: "bea",
        text: "I put 'arithmetic and pies'.",
      },
      {
        who: "cath",
        text: "Close enough to hand in.",
      },
    ],
  },
  54: {
    name: "Two Slips",
    before: [
      {
        who: "sol",
        text: "Gale warning, force eight by noon. Their drones will fly with it, and the scarecrows and silos will be throwing into it.",
      },
      {
        who: "cath",
        expression: "wink",
        text: "I told Pip we'd only hold the north slip.",
      },
      {
        who: "mara",
        text: "Dot says the tenders are lining up at both: the north slip and the old lifeboat slip. Two roads up from the beach.",
      },
    ],
    after: [
      {
        who: "cath",
        expression: "smirk",
        text: "Half to each slip. Crisp only half believes him.",
      },
    ],
  },
  55: {
    name: "Ines's Tent",
    before: [
      {
        who: "narrator",
        text: "Crisp has hired six lifestyle influencers to film the imported catch as 'fresh from Shingle Bay'.",
      },
      {
        who: "sol",
        text: "Last time one walked past my scarecrow, it stopped work to be in the shot. Twenty minutes. Lovely footage.",
      },
      {
        who: "ines",
        text: "I've brought the clinic tent. Anything standing near it gets a cup of tea and a firm word, and goes back to work.",
      },
      {
        who: "cath",
        text: "Tent beside the scarecrows, then.",
      },
    ],
    after: [
      {
        who: "ines",
        text: "Nothing within twenty yards of the tent was charmed. Small sample. I'd like more data, ideally fewer influencers.",
      },
    ],
  },
  56: {
    name: "Fog Bank",
    before: [
      {
        who: "sol",
        text: "Fog's in off the water. I can't see the end of my own mic lead, and I own a lot of mic lead.",
      },
      {
        who: "cath",
        text: "Nobody can hit what they can't see. Build right up against the road.",
      },
    ],
    after: [
      {
        who: "mara",
        text: "Dot's boats went out at dawn. First time this week.",
      },
    ],
  },
  57: {
    name: "The Gale",
    before: [
      {
        who: "narrator",
        text: "The gale arrives on time. Dot hauls the boats up past the pub.",
      },
      {
        who: "sol",
        text: "Gusts of sixty. Their drones will come in fast with the wind behind them, and anything our scarecrows throw goes sideways.",
      },
      {
        who: "cath",
        text: "Hives, then. Bees keep low.",
      },
    ],
    after: [
      {
        who: "tomas",
        text: "One shed roof gone, no boats. Dot says that's a good gale.",
      },
    ],
  },
  58: {
    name: "Salvage",
    before: [
      {
        who: "narrator",
        text: "The gale has split two containers on the beach: tinned peaches, flip-flops and nine hundred phone cases.",
      },
      {
        who: "mara",
        text: "Wreck law, section four: goods left below the tide line go to the finder. Unless the owner would like to explain them in court.",
      },
      {
        who: "tomas",
        text: "Peaches on the stall at a mark a tin. Best morning's trade all year. It all goes in the tin for the lane.",
      },
    ],
    after: [
      {
        who: "bea",
        text: "I drew the peaches for my project. Are we rich?",
      },
      {
        who: "cath",
        text: "Until Thursday.",
      },
    ],
  },
  59: {
    name: "Ship in the Fog",
    before: [
      {
        who: "sol",
        text: "The ship's weighed anchor. It's coming into the bay through the fog with its horn going.",
      },
      {
        who: "mara",
        text: "Dot says the tenders it's sent ahead have steel plate bolted to the bows.",
      },
      {
        who: "cath",
        expression: "determined",
        text: "Silos go through steel. Build them close. Nobody's seeing far tonight.",
      },
    ],
    after: [
      {
        who: "narrator",
        text: "The ship drops anchor four hundred yards out. Up on the cliff road, Crisp's car is parked with its engine running.",
      },
    ],
  },
  60: {
    name: "The Container Ship",
    before: [
      {
        who: "crisp",
        text: "Statement: the vessel is a routine logistics asset bringing affordable protein to a coastal community in need.",
      },
      {
        who: "tomas",
        text: "In need. Dot's got forty boxes of crab in the ice plant.",
      },
      {
        who: "cath",
        expression: "determined",
        text: "It'll beach and break open into tenders. Silos on the hull, ponds for whatever climbs off it.",
      },
    ],
    after: [
      {
        who: "sol",
        text: "Found the manifest in the surf. Half the cargo's Hollowell fish. The other half is Candor's Oakvale Water, no labels.",
      },
      {
        who: "cath",
        expression: "smirk",
        text: "Two companies, one ship. I wonder who paid for the fuel.",
      },
    ],
  },

  // Act 7, The Rift: the companies fall out.
  61: {
    name: "The Falling-Out",
    before: [
      {
        who: "narrator",
        text: "The Oakvale water inquiry opens on Monday. Somebody has to have known about the bottles.",
      },
      {
        who: "crisp",
        text: "On behalf of Hollowell Group: Hollowell had no knowledge of Candor Health's activities in Oakvale.",
      },
      {
        who: "crisp",
        text: "On behalf of Candor Health: Candor acted under a logistics plan agreed in full with Hollowell Group.",
      },
      {
        who: "cath",
        expression: "smirk",
        text: "Both before breakfast. Now both want Ines's water samples before the inquiry sees them, and they're sending vans.",
      },
    ],
    after: [
      {
        who: "ines",
        text: "The samples went to the inquiry on the four o'clock train. I sat with them the whole way.",
      },
      {
        who: "mara",
        text: "Two letters in the afternoon post. Hollowell's says we're Candor's witnesses. Candor's says we're Hollowell's.",
      },
    ],
  },
  62: {
    name: "Two Logos",
    before: [
      {
        who: "sol",
        text: "Traffic on the Rift Road: Hollowell vans, Candor vans, racing to be first at our gates with a witness statement for us to sign.",
      },
      {
        who: "tomas",
        text: "I make it sixty in the first lot. Small ones, nose to tail.",
      },
      {
        who: "cath",
        text: "Hives and ponds. Anything that hits a crowd.",
      },
    ],
    after: [
      {
        who: "narrator",
        text: "A Hollowell van and a Candor van meet head on at the Rift bridge. By teatime, both companies have blamed the bridge.",
      },
    ],
  },
  63: {
    name: "Paperwork",
    before: [
      {
        who: "narrator",
        text: "The lawyers come in person: grey saloons, one lawyer each, a briefcase on every passenger seat.",
      },
      {
        who: "mara",
        text: "A lawyer who stops beside your scarecrow ties it up in correspondence. Stop them early, before they park by anything good.",
      },
      {
        who: "tomas",
        text: "And answering their letters has cost us forty marks a time. The tin's thin, so build cheap and make it count.",
      },
    ],
    after: [
      {
        who: "mara",
        text: "I've answered all nineteen letters with one word: 'Noted.' It's the only cheap thing in law.",
      },
    ],
  },
  64: {
    name: "Hostile Takeover",
    before: [
      {
        who: "sol",
        text: "On the business wire: Hollowell has bid for Candor. Candor's board calls it 'opportunistic'. Hollowell calls it 'a homecoming'.",
      },
      {
        who: "cath",
        text: "Neither of them can look weak this week, so everything they send will take more stopping.",
      },
      {
        who: "bea",
        text: "What's a hostile takeover?",
      },
      {
        who: "cath",
        text: "When someone buys a thing that doesn't want to be bought.",
      },
    ],
    after: [
      {
        who: "pell",
        text: "Candor's board has said no. Hollowell is disappointed, and Hollowell is patient.",
      },
    ],
  },
  65: {
    name: "Injunction",
    before: [
      {
        who: "narrator",
        text: "Mara has bought the old magistrates' court at Rift Cross for one mark. It came with a bench, a bell and a working seal.",
      },
      {
        who: "mara",
        text: "An injunction stops a named party from proceeding. I've named all their big ones in advance.",
      },
      {
        who: "cath",
        text: "Put it where the big lorries have to pass. Let the scarecrows deal with the small stuff.",
      },
    ],
    after: [
      {
        who: "mara",
        text: "Their lead lorry sat in the lane for four minutes with its engine off. In my old job that took eighteen months.",
      },
    ],
  },
  66: {
    name: "Cross-Examination",
    before: [
      {
        who: "narrator",
        text: "Day three of the inquiry. Mara has Hollowell's head of logistics in the witness chair. Outside, it's raining on the lane.",
      },
      {
        who: "mara",
        text: "Mr Ashby, the second line of the ship's manifest, please. Aloud. Slowly.",
      },
      {
        who: "cath",
        text: "Rain keeps the bees in and slows everything on the wet. Ponds and barns carry today.",
      },
    ],
    after: [
      {
        who: "ines",
        text: "He read it: 'Candor freight, Hollowell account.' Hollowell paid for the fuel.",
      },
    ],
  },
  67: {
    name: "The Merger Rumour",
    before: [
      {
        who: "sol",
        text: "Off air: my cousin drives a cab in Kingsmarket. Last night, Pell and Dr Vane, same dinner, same cab, same folder.",
      },
      {
        who: "mara",
        text: "Suing each other on Tuesday, sharing a cab on Thursday. That isn't a feud. It's a negotiation.",
      },
      {
        who: "cath",
        text: "They'll come tonight to show they still can. Short sight, quick vans. Build close to the lane.",
      },
    ],
    after: [
      {
        who: "vane",
        text: "Candor does not comment on rumours, and nothing has been agreed.",
      },
      {
        who: "cath",
        expression: "smirk",
        text: "'Nothing has been agreed.' She didn't say nothing's happening.",
      },
    ],
  },
  68: {
    name: "Small Print",
    before: [
      {
        who: "mara",
        text: "Clause nineteen of Hollowell's new bid: Candor's water rights in Oakvale pass to Hollowell. That's the wells under Tomas's fields.",
      },
      {
        who: "cath",
        text: "So we're an asset now. Assets get guarded: armoured lorries, slow ones. That's what the silos are for.",
      },
    ],
    after: [
      {
        who: "bea",
        text: "The nativity's on Friday. You said you'd come.",
      },
      {
        who: "cath",
        expression: "worried",
        text: "I did say that.",
      },
    ],
  },
  69: {
    name: "Recess",
    before: [
      {
        who: "narrator",
        text: "Friday, two o'clock, Oakvale Primary. Bea is Star Number Two.",
      },
      {
        who: "cath",
        text: "Third row, phone off. Mara has the lane, Tomas has the tin.",
      },
      {
        who: "mara",
        text: "Go. Without you on the lane, everything we put up does the whole job. I've planned for that.",
      },
    ],
    after: [
      {
        who: "bea",
        text: "I forgot my line, so I just shone.",
      },
      {
        who: "tomas",
        text: "Lane held. Mara stood in the gateway the whole time. Nobody tell her she enjoyed it.",
      },
    ],
  },
  70: {
    name: "The Lawyer Swarm",
    before: [
      {
        who: "crisp",
        text: "Statement: Hollowell and Candor have jointly instructed counsel to resolve outstanding matters with local landholders.",
      },
      {
        who: "mara",
        text: "Jointly. Two companies who sued each other on Tuesday have hired the same forty lawyers.",
      },
      {
        who: "cath",
        expression: "determined",
        text: "Courthouse on the big one. When it breaks, five lawyers get out, and each slows whatever it stands next to.",
      },
    ],
    after: [
      {
        who: "narrator",
        text: "The lawyers withdraw at dusk. By morning there's a poster on every gate in Marrow: PELL FOR COUNCIL.",
      },
      {
        who: "pell",
        text: "If Marrow won't sell, Marrow can choose.",
      },
    ],
  },

  // Act 8, The Ballot: Pell runs for council.
  71: {
    name: "The Ballot Box",
    before: [
      {
        who: "pell",
        text: "Graham Pell, for a Corridor of Opportunity: jobs, roads and convenience for every family in Marrow.",
      },
      {
        who: "tomas",
        text: "Council votes on the Corridor's planning in May. Put Pell on it and it's three seats to two.",
      },
      {
        who: "ines",
        text: "Then someone stands against him. I've told the surgery I'll be late on Thursdays.",
      },
      {
        who: "cath",
        text: "Meanwhile his vans are back on our lane with his face on the side.",
      },
    ],
    after: [
      {
        who: "tomas",
        text: "Ines needed ten nominations. I've got eighty-four, and I know where every one of them lives.",
      },
    ],
  },
  72: {
    name: "Free Tea Tent",
    before: [
      {
        who: "narrator",
        text: "Pell has put up a free tea tent every half mile along the lane. With biscuits.",
      },
      {
        who: "tomas",
        text: "People will drink his tea and vote how they like. And they're all walking past our stall to get it.",
      },
      {
        who: "cath",
        expression: "smirk",
        text: "Sell everything. The tin's about to have its best day.",
      },
    ],
    after: [
      {
        who: "sol",
        text: "Vox pop from the tea tent: 'Lovely tea. Not voting for him.' Eleven people said that. Word for word.",
      },
    ],
  },
  73: {
    name: "Doorstep Canvass",
    before: [
      {
        who: "sol",
        text: "Pell's canvass vans are doing the whole valley at thirty doors an hour, and they don't slow down for gates.",
      },
      {
        who: "cath",
        text: "Fast, then. Slow them at the top of the lane. Every one we turn back pays well today.",
      },
    ],
    after: [
      {
        who: "bea",
        text: "A man knocked and asked if Mummy was in. I said she was out defending the lane. He wrote it down.",
      },
    ],
  },
  74: {
    name: "Leaflet Drop",
    before: [
      {
        who: "narrator",
        text: "Pell has found a new use for the survey drones: ten thousand leaflets, dropped over every farm in Marrow.",
      },
      {
        who: "cath",
        text: "They come over the hedges, so the hedges won't help. Scarecrows and hives.",
      },
      {
        who: "bea",
        text: "It says 'Pell for You'. Is he?",
      },
    ],
    after: [
      {
        who: "ines",
        text: "His leaflet makes nine promises. I've costed them. They come to four times the council's budget.",
      },
    ],
  },
  75: {
    name: "Union Hall",
    before: [
      {
        who: "tomas",
        text: "The Farmers' Union Hall at Rift Cross. Shut since 1987. I've had the keys since 1988.",
      },
      {
        who: "tomas",
        text: "Campaign office, tea urn, a board for the count. Everyone on the lane fights better knowing it's open.",
      },
      {
        who: "cath",
        text: "It's dear, but it lifts everything on the lane at once, and it pays its way.",
      },
    ],
    after: [
      {
        who: "narrator",
        text: "Two hundred and six people come to the hall's first meeting. Tomas greets every one by name.",
      },
    ],
  },
  76: {
    name: "Market Day Rally",
    before: [
      {
        who: "sol",
        text: "Pell's rally in the market square at noon, free coach from every village. The coaches are queuing at the crossroads already.",
      },
      {
        who: "cath",
        text: "A lot of them, close together, none of them hard to stop. Hives and ponds.",
      },
    ],
    after: [
      {
        who: "pell",
        text: "Today Marrow came together. Tomorrow, Marrow moves forward.",
      },
      {
        who: "sol",
        text: "Attendance: three hundred. Two hundred and forty used the free coach to go shopping.",
      },
    ],
  },
  77: {
    name: "The Opinion Poll",
    before: [
      {
        who: "narrator",
        text: "The eve of the vote. At dusk, Crisp publishes a poll: Pell 58 percent, Dr Farrow 31.",
      },
      {
        who: "sol",
        text: "Four hundred people asked. It doesn't say where.",
      },
      {
        who: "cath",
        text: "It's meant to keep our lot at home. And they'll run vans tonight, fast and dark. Build close to the lane.",
      },
    ],
    after: [
      {
        who: "ines",
        text: "I found where. The Hollowell canteen. It's a very thorough survey of the Hollowell canteen.",
      },
    ],
  },
  78: {
    name: "Polling Day",
    before: [
      {
        who: "narrator",
        text: "Polling day. The village school is a polling station, and nobody may campaign within a hundred yards of it.",
      },
      {
        who: "mara",
        text: "Our scarecrows are wearing Farrow rosettes, so inside that line they count as campaigning. Build only on the plots I've marked.",
      },
      {
        who: "tomas",
        text: "I've forty cars bringing voters in. Keep the lane open till ten.",
      },
    ],
    after: [
      {
        who: "tomas",
        text: "Two thousand through the school gate by noon. I know because I waved at all of them.",
      },
    ],
  },
  79: {
    name: "Rain on Polling Day",
    before: [
      {
        who: "sol",
        text: "Rain since two. Turnout's dropping, and Pell's laid on free cars to the polls. Ours are walking.",
      },
      {
        who: "tomas",
        text: "Then ours get lifts too. Forty cars, four trips each, and every trip uses our lane.",
      },
      {
        who: "cath",
        text: "Bees stay in, and everything's slow on the wet. Ponds, barns and silos.",
      },
    ],
    after: [
      {
        who: "tomas",
        text: "Mrs Abel, ninety-one, voted at quarter past four. She told me who for. I said she shouldn't. She told me again.",
      },
    ],
  },
  80: {
    name: "Pell's Campaign Bus",
    before: [
      {
        who: "narrator",
        text: "The last hour of polling. Pell's campaign bus sets off down the lane, his face on the side and his influencers on board.",
      },
      {
        who: "pell",
        text: "Every vote is a conversation. I intend to have six thousand of them by ten o'clock.",
      },
      {
        who: "cath",
        expression: "determined",
        text: "When it stops, six influencers get off, all charming. Courthouse for the bus, the tent by the scarecrows.",
      },
    ],
    after: [
      {
        who: "narrator",
        text: "Count night at the Union Hall. Pell asks for a recount, and Mara watches all 6,140 ballots. Dr Ines Farrow wins by 212.",
      },
      {
        who: "pell",
        text: "Marrow has spoken, and Hollowell is listening.",
      },
    ],
  },

  // Act 9, The Merger.
  81: {
    name: "Two Logos, One Door",
    before: [
      {
        who: "narrator",
        text: "Nine days after the count, a press conference in Kingsmarket. Pell and Dr Vane, one lectern.",
      },
      {
        who: "vane",
        text: "Hollowell Group and Candor Health will combine as HollowCandor, to nourish and care for Marrow from field to pharmacy.",
      },
      {
        who: "cath",
        text: "They lost a vote, so they've become a bigger company. And their vans are already out with both names on.",
      },
    ],
    after: [
      {
        who: "narrator",
        text: "Pip Talbot has left Cath three messages since the announcement. The last one just says, 'Not on the phone.'",
      },
    ],
  },
  82: {
    name: "The Joint Statement",
    before: [
      {
        who: "crisp",
        text: "Joint statement: from day one, the combined fleet will serve all of Marrow by every available route.",
      },
      {
        who: "sol",
        text: "Translation: twice the vans, both roads, packed nose to tail.",
      },
      {
        who: "cath",
        text: "Two lanes, a crowd on each. Split the hives between them.",
      },
    ],
    after: [
      {
        who: "sol",
        text: "Day one of the merger, and their two fleets can't share a radio channel. I can hear both. I'm recording.",
      },
    ],
  },
  83: {
    name: "Rebrand Day",
    before: [
      {
        who: "narrator",
        text: "Overnight, every Hollowell and Candor van in Marrow has been repainted silver with one new word on the side: HollowCandor.",
      },
      {
        who: "sol",
        text: "New paint, new plates, steel in the doors. They want the new name to look like it can take a knock.",
      },
      {
        who: "cath",
        text: "Then it'll take a lot of them. Fewer pieces, built up higher.",
      },
    ],
    after: [
      {
        who: "bea",
        text: "Why is it called HollowCandor?",
      },
      {
        who: "cath",
        text: "Because 'Hollowell and Candor' didn't fit on a van.",
      },
    ],
  },
  84: {
    name: "Redundancies",
    before: [
      {
        who: "bea",
        text: "Mum, Mr Talbot's at the door. He's crying a bit but he says it's the wind.",
      },
      {
        who: "pip",
        text: "Crisp let me go this morning. 'The merger has rationalised our relationship.' I've brought you something. I should have brought it sooner.",
      },
      {
        who: "tomas",
        text: "He can wait in the kitchen. The vans can't. The election emptied the tin, so build small and let the turned-back vans pay.",
      },
    ],
    after: [
      {
        who: "cath",
        text: "Pip. You've got one cup of tea to tell me why I should read this.",
      },
      {
        who: "pip",
        text: "It's the board minutes. Page six has your farm on it. And Tomas's. And the market square in Kingsmarket.",
      },
    ],
  },
  85: {
    name: "The Minutes",
    before: [
      {
        who: "narrator",
        text: "HollowCandor board minutes, item seven: 'Acquire Kingsmarket market square as the northern end of the Marrow Corridor.'",
      },
      {
        who: "mara",
        text: "Item seven needs the shareholders' approval. So it goes to the annual general meeting.",
      },
      {
        who: "cath",
        text: "They'll guard the plan until then. Armoured lorries today. Silos.",
      },
    ],
    after: [
      {
        who: "pip",
        text: "Every board paper is on a server I still have the password for. I'll get you all of them. It's the least I can do.",
      },
    ],
  },
  86: {
    name: "Board Meeting Nine",
    before: [
      {
        who: "pip",
        text: "Board meeting nine is tonight at the Rift Cross offices. The directors come in by both roads, after dark, so nobody photographs them.",
      },
      {
        who: "sol",
        text: "I'll photograph them.",
      },
      {
        who: "cath",
        text: "Two lanes, short sight, quick cars. Build close on both.",
      },
    ],
    after: [
      {
        who: "sol",
        text: "All nine directors on camera. One of them waved. He thought I was press, which, technically, I am.",
      },
    ],
  },
  87: {
    name: "The Co-op's Bank",
    before: [
      {
        who: "tomas",
        text: "HollowCandor has bought the Marrow Mutual. That's our bank. The co-op's loan is now owed to them.",
      },
      {
        who: "mara",
        text: "Clause twelve: the lender may call in the loan on a 'material change'. They'll call it in by Friday.",
      },
      {
        who: "cath",
        text: "Then we pay it. First there's a gale: their drones will ride it, and the scarecrows will struggle. Hives.",
      },
    ],
    after: [
      {
        who: "tomas",
        text: "Eighteen thousand marks from three hundred and twelve households. It's in a biscuit tin and I'm sleeping next to it.",
      },
    ],
  },
  88: {
    name: "The Golden Parachute",
    before: [
      {
        who: "sol",
        text: "Three Hollowell directors leave HollowCandor today, each with a payoff that'd buy Shingle Bay. They're flying out from the Rift.",
      },
      {
        who: "cath",
        text: "And the drones are covering their exit, straight over our hedges. Scarecrows and hives.",
      },
      {
        who: "bea",
        text: "What's a golden parachute?",
      },
      {
        who: "cath",
        text: "A soft landing for people who've crashed something.",
      },
    ],
    after: [
      {
        who: "pip",
        text: "One of the three was Crisp's oldest client. He's had to take a desk in the HollowCandor building. A shared one.",
      },
    ],
  },
  89: {
    name: "Quarterly Results",
    before: [
      {
        who: "crisp",
        text: "Statement: HollowCandor expects to report significant progress in Marrow this quarter.",
      },
      {
        who: "mara",
        text: "The quarter ends on Friday. They have four days to make that true.",
      },
      {
        who: "cath",
        text: "So nothing will wait for us. One lot after another, no breathers. Build ahead of them.",
      },
    ],
    after: [
      {
        who: "sol",
        text: "Results are out. 'Significant progress in Marrow' has become 'continued engagement with Marrow'.",
      },
    ],
  },
  90: {
    name: "The Board of Directors",
    before: [
      {
        who: "pip",
        text: "The whole board is coming down the lane in one car to 'see the asset in person'.",
      },
      {
        who: "vane",
        text: "We are simply visiting our stakeholders.",
      },
      {
        who: "cath",
        expression: "determined",
        text: "Courthouse for the car. When it stops, five directors get out, and every one is armoured. Silos.",
      },
    ],
    after: [
      {
        who: "pell",
        text: "The board will put the purchase of Kingsmarket square to shareholders at our AGM, in Kingsmarket, on the fourteenth.",
      },
      {
        who: "cath",
        expression: "smirk",
        text: "Shareholders. Tomas, what does a share cost?",
      },
    ],
  },

  // Act 10, Kingsmarket.
  91: {
    name: "The Charter",
    before: [
      {
        who: "tomas",
        text: "Forty-one marks a share. Four hundred and twelve of us have bought one. Mrs Abel bought two.",
      },
      {
        who: "mara",
        text: "And this: a certified copy of the Kingsmarket charter of 1342. It has hung in my downstairs loo for eleven years.",
      },
      {
        who: "mara",
        text: "It says the square belongs to those who trade on it, and no lord, guild or heir may sell it.",
      },
      {
        who: "cath",
        text: "And HollowCandor knows Mara has a copy. Expect company on her lane.",
      },
    ],
    after: [
      {
        who: "pip",
        text: "Every trader's licence in Kingsmarket goes through my office. By the fourteenth, I could make all four hundred and twelve of you traders.",
      },
      {
        who: "cath",
        text: "Do that, Pip.",
      },
    ],
  },
  92: {
    name: "The Clock Tower",
    before: [
      {
        who: "narrator",
        text: "Kingsmarket, eleven days to the meeting. HollowCandor has rented every loading bay around the clock tower.",
      },
      {
        who: "sol",
        text: "They're sending vans every quarter hour, on the chime. No gaps, no breather.",
      },
      {
        who: "cath",
        text: "So build before it strikes, and keep building while it does.",
      },
    ],
    after: [
      {
        who: "tomas",
        text: "The stall never shut. Two hundred and eight sales, twelve of them to HollowCandor drivers.",
      },
    ],
  },
  93: {
    name: "Fishwives' Row",
    before: [
      {
        who: "narrator",
        text: "At dawn, six boats from Shingle Bay tie up at Fishwives' Row, packed with ice and crab.",
      },
      {
        who: "tomas",
        text: "Dot Varley says she owes us for the beach road. She's paying in crab, and the crab is selling.",
      },
      {
        who: "cath",
        expression: "delighted",
        text: "Market day, then. Every stall we open pays for the lane.",
      },
    ],
    after: [
      {
        who: "bea",
        text: "Mrs Varley let me hold a crab. It's going in my project. Not the crab. A drawing of it.",
      },
    ],
  },
  94: {
    name: "The Grain Exchange",
    before: [
      {
        who: "narrator",
        text: "HollowCandor has parked its armoured lorries in the old grain exchange on Corn Street.",
      },
      {
        who: "mara",
        text: "Booked for 'secure document storage'. Armoured lorries for paper. They're expecting a fight about paper.",
      },
      {
        who: "cath",
        expression: "smirk",
        text: "Silos. Grain through steel, at the grain exchange.",
      },
    ],
    after: [
      {
        who: "mara",
        text: "Pip got me their reply to the charter. Eighty pages. It disputes its age, its spelling and its seal. Not what it says.",
      },
    ],
  },
  95: {
    name: "Bell Lane",
    before: [
      {
        who: "pip",
        text: "There's a back way into the square up Bell Lane. I know because it's where I used to meet Mr Crisp.",
      },
      {
        who: "sol",
        text: "No streetlights on Bell Lane since the cuts, and their vans are coming up it quick.",
      },
      {
        who: "cath",
        text: "Then we hold it. Short sight tonight, so build tight to the lane.",
      },
    ],
    after: [
      {
        who: "narrator",
        text: "At two in the morning, Crisp's car turns into Bell Lane, stops at the farms' barricade, and reverses all the way down.",
      },
    ],
  },
  96: {
    name: "The Long Table",
    before: [
      {
        who: "narrator",
        text: "Sunday, three days out. One long table down the middle of Kingsmarket square, every farm in Marrow at it.",
      },
      {
        who: "tomas",
        text: "And HollowCandor has sent a crowd of its own: hundreds of little vans, packed close, to block the deliveries.",
      },
      {
        who: "cath",
        text: "Hives and ponds along the table. Nobody leaves before pudding.",
      },
    ],
    after: [
      {
        who: "bea",
        text: "I read my project to Mrs Keel. She said it was admissible.",
      },
      {
        who: "mara",
        text: "I said it was compelling. Admissible is a separate question.",
      },
    ],
  },
  97: {
    name: "The Charter Steps",
    before: [
      {
        who: "narrator",
        text: "Monday. HollowCandor's biggest shareholders arrive at the Guildhall for a private briefing. Mara is on the steps.",
      },
      {
        who: "mara",
        text: "'The square of Kingsmarket shall belong to those who trade upon it, and to no lord nor guild nor heir.' Good morning.",
      },
      {
        who: "cath",
        text: "The steps are listed, and so is half the square. Build on the plots that aren't.",
      },
    ],
    after: [
      {
        who: "narrator",
        text: "Eleven shareholders stop to listen. Two ask for a copy. One of them manages the Marrow teachers' pension fund.",
      },
    ],
  },
  98: {
    name: "Vane's Last Memo",
    before: [
      {
        who: "sol",
        text: "Leaked memo, Dr Vane to Candor staff: 'The charter is a historical document of considerable interest.' Every word true.",
      },
      {
        who: "ines",
        text: "Her researchers read it too. Eleven resigned this morning. Two are in my surgery having tea.",
      },
      {
        who: "cath",
        text: "And a river fog's come up. Their couriers will be on us before we see them. Build close.",
      },
    ],
    after: [
      {
        who: "vane",
        text: "I have accepted a new role outside Marrow. I leave HollowCandor in excellent hands.",
      },
      {
        who: "cath",
        expression: "smirk",
        text: "Every word true. Again.",
      },
    ],
  },
  99: {
    name: "The Eve of Kingsmarket",
    before: [
      {
        who: "pip",
        text: "Done. As of nine tomorrow, all four hundred and twelve of you hold a Kingsmarket trader's licence. I stamped them myself.",
      },
      {
        who: "pell",
        text: "HollowCandor will attend tomorrow's meeting with confidence, and with every resource at its disposal.",
      },
      {
        who: "cath",
        text: "Every resource tonight, then. The heaviest they've got, and each one will take a lot of stopping.",
      },
      {
        who: "bea",
        text: "Can I read my project tomorrow? Our class trip is to the square.",
      },
    ],
    after: [
      {
        who: "cath",
        text: "Yes. Stand on Tomas's crate, so the back row can hear.",
      },
    ],
  },
  100: {
    name: "HollowCandor",
    before: [
      {
        who: "narrator",
        text: "Wednesday the fourteenth. The meeting opens at ten. At nine, HollowCandor's flagship turns into the square.",
      },
      {
        who: "crisp",
        text: "Statement: HollowCandor looks forward to an orderly meeting.",
      },
      {
        who: "cath",
        expression: "determined",
        text: "Courthouse on it early: it slows anything of ours it passes. When it breaks, Candor's half mends itself. Hit it hard.",
      },
      {
        who: "cath",
        text: "Then Hollowell's half goes dark. Masts out, or we won't see it coming.",
      },
    ],
    after: [
      {
        who: "narrator",
        text: "11:40. Item seven is withdrawn. Four hundred and twelve people in the room are licensed traders of the square.",
      },
      {
        who: "pell",
        text: "HollowCandor remains committed to Marrow, and to listening.",
      },
    ],
  },
};

/** After level 100: Bea reads her school project in Kingsmarket square. */
export const FINALE: StoryLine[] = [
  {
    who: "narrator",
    text: "Thursday. Kingsmarket square, Tomas's stall. Bea stands on a crate with three pages and a drawing.",
  },
  {
    who: "bea",
    text: "What my mum does, by Bea Hale. My mum has cows. She gets up before them and she does not like it.",
  },
  {
    who: "bea",
    text: "She makes pies. Most of them are for eating. She does arithmetic and she knows what everything costs.",
  },
  {
    who: "bea",
    text: "When men in nice coats come to buy our farm, she gives them tea. Then she says no thank you.",
  },
  {
    who: "bea",
    text: "One day she missed the vans to watch me be a star. Mrs Keel did the vans. The end.",
  },
  {
    who: "narrator",
    text: "Tomas buys the drawing for a mark, the first sale of the day, and pins it to the front of the stall.",
  },
];
