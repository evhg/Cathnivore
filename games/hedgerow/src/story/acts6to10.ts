// Hedgerow's script for acts 6-10 (levels 51-100) and the finale. Rewritten 2026-10-03 to the clarity
// rules in docs/design/hedgerow-v2.md section 7: every scene says what's happening, why it matters and
// what to build, and makes sense on its own.

import type { StoryLine } from "../engine";
import type { Beat } from "./types";

export const ACTS_6_TO_10: Record<number, Beat> = {
  // Act 6, Shingle Bay: imports by sea.
  51: {
    name: "Shingle Bay",
    before: [
      { who: "narrator", text: "Shingle Bay, a fishing village. A huge container ship has anchored offshore, full of cheap imports." },
      { who: "tomas", text: "The fish van stopped buying from our boats. It buys the ship's catch now, at half the price." },
      { who: "cath", expression: "determined", text: "They land it at night in fast boats and drive it up the beach road. So we hold the beach road." },
      { who: "mara", text: "And this time, nobody tells Pip Talbot our plans." },
    ],
    after: [
      { who: "cath", expression: "smirk", text: "Pip rang twice to ask how it went. I told him it was quiet. Let's see what Hollowell does with that." },
    ],
  },
  52: {
    name: "Low Tide",
    before: [
      { who: "sol", text: "Low tide this morning. The beach is long, flat and hard, so their boats can race straight up it." },
      { who: "cath", expression: "determined", text: "Fast boats get past quickly. Put duck ponds at the top of the beach to slow them, then hit them. Fast ones pay extra." },
    ],
    after: [
      { who: "tomas", text: "Eleven boats turned back. Our fishermen are selling crab on the sea wall, and the queue is huge." },
    ],
  },
  53: {
    name: "Net Mending",
    before: [
      { who: "tomas", text: "The fishing co-op spent everything mending nets this week. There's hardly any money for towers." },
      { who: "cath", expression: "determined", text: "Then start cheap: a few hedges and ponds. Each wave we hold pays for the next tower." },
    ],
    after: [
      { who: "tomas", text: "The nets are fixed and the boats are going out again tomorrow." },
    ],
  },
  54: {
    name: "Two Slips",
    before: [
      { who: "sol", text: "Storm warning. They're landing on two slipways at once, and the wind is wild." },
      { who: "cath", text: "Scarecrows and silos can't aim well in this wind, and their drones fly faster." },
      { who: "cath", expression: "determined", text: "Cover both roads with bees, ponds and windmills. Windmills love a gale." },
    ],
    after: [
      { who: "sol", text: "Both slipways held, in the worst storm this year. The village is proud of itself." },
    ],
  },
  55: {
    name: "Ines's Tent",
    before: [
      { who: "ines", text: "I've set up a clinic tent by the road. Influencers keep turning up to film the beach." },
      { who: "cath", text: "When an influencer stands near a tower, it stops to watch them. Ines's tent stops that." },
      { who: "cath", expression: "determined", text: "Towers near the tent ignore the influencers and fire faster too. Put it among your best towers." },
    ],
    after: [
      { who: "ines", text: "Lots of tea, a few plasters, and not one tower distracted. A good day's work." },
    ],
  },
  56: {
    name: "Fog Bank",
    before: [
      { who: "sol", text: "A fog bank has rolled in off the sea. You can't see the end of the pier." },
      { who: "cath", expression: "determined", text: "In fog the towers can't reach as far. Build close to the road, and watch the red rings for ambushes." },
    ],
    after: [
      { who: "tomas", text: "The fog's lifting, and the ship is still out there, waiting." },
    ],
  },
  57: {
    name: "The Gale",
    before: [
      { who: "sol", text: "Full gale. Even the gulls have given up." },
      { who: "cath", text: "Wind spoils the aim of scarecrows and silos, and speeds the drones up." },
      { who: "cath", expression: "determined", text: "Bees, ponds and windmills carry the day. Spread them out." },
    ],
    after: [
      { who: "sol", text: "Three of their boats were blown back out to sea. The weather is on our side for once." },
    ],
  },
  58: {
    name: "Salvage",
    before: [
      { who: "tomas", text: "Crates from the ship keep washing up, and by law whatever lands on the beach is ours to sell." },
      { who: "cath", expression: "determined", text: "Market day: the money comes in fast. They're coming two ways, so spend quickly and cover both roads." },
    ],
    after: [
      { who: "tomas", text: "We sold the salvage at the market. The fishing co-op has never had so much money." },
    ],
  },
  59: {
    name: "Ship in the Fog",
    before: [
      { who: "sol", text: "Fog again, and this time their boats are armour-plated." },
      { who: "cath", text: "The towers can't see far, and armour soaks up weak hits." },
      { who: "cath", expression: "determined", text: "Build close to the road and upgrade. Silos fire straight through armour, if the wind lets them." },
    ],
    after: [
      { who: "sol", text: "The ship is pulling up its anchor. It's coming in itself." },
    ],
  },
  60: {
    name: "The Container Ship",
    before: [
      { who: "narrator", text: "The Container Ship: a floating warehouse. It drops fast boats as it comes, and more pour out when it breaks." },
      { who: "pell", text: "Graham Pell. Shingle Bay can have everything cheaper, forever. All it costs is your boats." },
      { who: "cath", expression: "determined", text: "Keep towers all along the road. When the ship breaks up, its boats come out fighting." },
    ],
    after: [
      { who: "tomas", text: "The ship's gone and the fish van is buying from our boats again!" },
      { who: "sol", text: "And I hear Hollowell and Candor are blaming each other for Oakvale. Their partnership is cracking." },
    ],
  },
  // Act 7, The Rift: the companies fall out.
  61: {
    name: "The Falling-Out",
    before: [
      { who: "narrator", text: "The Rift. Hollowell and Candor have fallen out, and both companies' lawyers are on our lanes." },
      { who: "mara", text: "Their lawyers are serving papers on every farm. Anywhere near a lawyer, a tower drowns in paperwork." },
      { who: "cath", expression: "determined", text: "Towers near a lawyer fire at half speed. Stop them early, before they get close to the towers." },
    ],
    after: [
      { who: "mara", text: "Not one paper got served. I used to be a lawyer myself, you know. I know how they think." },
    ],
  },
  62: {
    name: "Two Logos",
    before: [
      { who: "sol", text: "Both companies are racing each other up our lanes. Two fleets, two roads, packed close." },
      { who: "cath", expression: "determined", text: "Packed close is perfect for bees. Cover both roads." },
    ],
    after: [
      { who: "sol", text: "They spent half the day getting in each other's way. It helped." },
    ],
  },
  63: {
    name: "Paperwork",
    before: [
      { who: "mara", text: "They've frozen our bank account with paperwork. We're starting with almost nothing." },
      { who: "cath", expression: "determined", text: "Cheap towers first. There's a swing bridge on the lane: when it's up, they queue in front of it. Hit the queue." },
    ],
    after: [
      { who: "mara", text: "Account unfrozen. A judge called their paperwork 'creative'. It wasn't a compliment." },
    ],
  },
  64: {
    name: "Hostile Takeover",
    before: [
      { who: "mara", text: "Hollowell is trying to buy Candor, and Candor is fighting back. Our lane is in the middle." },
      { who: "cath", text: "Both sides sent their toughest vehicles today. They'll take a lot of hits." },
      { who: "cath", expression: "determined", text: "Upgrade before you build more. Strong towers beat lots of weak ones." },
    ],
    after: [
      { who: "mara", text: "Neither company won. Their shareholders are getting nervous." },
    ],
  },
  65: {
    name: "Injunction",
    before: [
      { who: "mara", text: "I've built us a courthouse. It serves an injunction on any boss in reach: a court order that stops it dead." },
      { who: "cath", expression: "determined", text: "Put the courthouse where the biggest enemies pass. A frozen boss is an easy target." },
    ],
    after: [
      { who: "mara", text: "Every boss we meet from now on gets a court order. I've missed this." },
    ],
  },
  66: {
    name: "Cross-Examination",
    before: [
      { who: "mara", text: "Rain, and they're coming up both roads. The bees will stay in today." },
      { who: "cath", expression: "determined", text: "Rain slows them down. Lean on hedges, ponds and scarecrows, and cover both roads." },
    ],
    after: [
      { who: "mara", text: "In court today their own witness admitted the Oakvale water study was a sham." },
    ],
  },
  67: {
    name: "The Merger Rumour",
    before: [
      { who: "sol", text: "Rumour: the two companies are about to make up and merge. And there's a power cut. No lights at all tonight." },
      { who: "cath", text: "In the dark, we can only see what's near a tower or near me. Anything else can't be hit." },
      { who: "cath", expression: "determined", text: "Line the lane with towers so there's light all the way along." },
    ],
    after: [
      { who: "sol", text: "The rumour's true. Hollowell and Candor are merging. Together they'll be bigger than ever." },
    ],
  },
  68: {
    name: "Small Print",
    before: [
      { who: "mara", text: "The merger papers have armoured lorries carrying them. Slow, heavy and full of small print." },
      { who: "cath", expression: "determined", text: "Armour soaks up weak hits. Silos fire straight through, so put them where the lorries crawl." },
    ],
    after: [
      { who: "mara", text: "I've read the small print. They plan to buy the whole valley in one go." },
    ],
  },
  69: {
    name: "Recess",
    before: [
      { who: "bea", text: "Mum, it's my nativity play tonight. I'm the star. You promised you'd come." },
      { who: "cath", expression: "delighted", text: "And I will. Mara, can you hold the lane without me?" },
      { who: "mara", text: "Go and watch your star. The towers will have to do it alone tonight, so build plenty." },
    ],
    after: [
      { who: "bea", text: "You came! I saw you in the second row!" },
      { who: "mara", text: "And the lane held. Not one van got through." },
    ],
  },
  70: {
    name: "The Lawyer Swarm",
    before: [
      { who: "narrator", text: "The Lawyer Swarm: a bus of lawyers. More jump out every few seconds, and the rest pour out when it stops." },
      { who: "mara", text: "Every tower near them slows down with paperwork. Keep them away from your towers if you can." },
      { who: "cath", expression: "determined", text: "Use the courthouse to freeze the bus, and bees for the crowd that spills out." },
    ],
    after: [
      { who: "mara", text: "They've withdrawn every case. We beat the lawyers." },
      { who: "tomas", text: "Pell's not giving up, though. He's standing for election to the valley council." },
    ],
  },
  // Act 8, The Ballot: Pell runs for council.
  71: {
    name: "The Ballot Box",
    before: [
      { who: "narrator", text: "Election time. Graham Pell is standing for the valley council. If he wins, he can approve his own motorway." },
      { who: "tomas", text: "His campaign vans are everywhere, covering the valley in posters." },
      { who: "cath", expression: "determined", text: "Then they don't get up our lanes. Watch the red rings: some are already waiting halfway." },
    ],
    after: [
      { who: "tomas", text: "Ines is standing against him. She says somebody has to." },
    ],
  },
  72: {
    name: "Free Tea Tent",
    before: [
      { who: "tomas", text: "Pell's set up free tea tents along the lane to win votes. People are queuing for them." },
      { who: "cath", expression: "determined", text: "Market day for us too: money comes in fast. Spend it as it arrives." },
    ],
    after: [
      { who: "ines", text: "I gave a speech next to his tea tent. People listened, and kept the tea." },
    ],
  },
  73: {
    name: "Doorstep Canvass",
    before: [
      { who: "tomas", text: "Pell's campaigners are racing door to door in fast vans." },
      { who: "cath", expression: "determined", text: "Fast vans: slow them early with hedges and ponds. Every fast one we stop pays extra." },
    ],
    after: [
      { who: "ines", text: "I knocked on doors too, on foot. People like a doctor who listens." },
    ],
  },
  74: {
    name: "Leaflet Drop",
    before: [
      { who: "sol", text: "Pell is dropping leaflets by drone over the whole valley. Two roads, and the sky full." },
      { who: "cath", expression: "determined", text: "Lots of drones: scarecrows, bees and windmills along both roads." },
    ],
    after: [
      { who: "bea", text: "I caught a leaflet. There's a picture of Mr Pell smiling. It looks like it hurts." },
    ],
  },
  75: {
    name: "Union Hall",
    before: [
      { who: "tomas", text: "I've opened the Farmers' Union Hall. Every farm in the valley meets there now." },
      { who: "cath", text: "The hall makes every tower on the map hit harder, and it earns money every wave." },
      { who: "cath", expression: "determined", text: "It doesn't need to be near the lane, so put it on a spare plot and keep the good spots for towers." },
    ],
    after: [
      { who: "tomas", text: "Two hundred people came to the first meeting. The valley is standing together." },
    ],
  },
  76: {
    name: "Market Day Rally",
    before: [
      { who: "tomas", text: "Pell's holding a rally in the market square, with crowds of supporters on buses." },
      { who: "cath", expression: "determined", text: "Big crowds packed close: bees and cannons. Lots of them." },
    ],
    after: [
      { who: "tomas", text: "His rally was half empty by the end. People came for our market instead." },
    ],
  },
  77: {
    name: "The Opinion Poll",
    before: [
      { who: "sol", text: "Tonight's poll says it's neck and neck. Pell's vans are out all night." },
      { who: "cath", expression: "determined", text: "At night the towers can't see as far. Build close to the lane, and watch for ambushes." },
    ],
    after: [
      { who: "sol", text: "Ines is two points ahead. Two points!" },
    ],
  },
  78: {
    name: "Polling Day",
    before: [
      { who: "mara", text: "It's polling day. Pell's people have fenced off half our fields as 'car parks for voters'." },
      { who: "cath", expression: "determined", text: "So we can only build on half the plots, and they're coming two ways. Every tower has to count." },
    ],
    after: [
      { who: "mara", text: "I'm watching every ballot box until the count. Nobody's touching them." },
    ],
  },
  79: {
    name: "Rain on Polling Day",
    before: [
      { who: "tomas", text: "Pouring rain. Pell's sending buses to drive his voters in, and to keep ours at home." },
      { who: "cath", expression: "determined", text: "Rain slows everything and keeps the bees in. Hedges, ponds and scarecrows today." },
    ],
    after: [
      { who: "tomas", text: "Our people walked to the polls in the rain anyway. Every single one." },
    ],
  },
  80: {
    name: "Pell's Campaign Bus",
    before: [
      { who: "narrator", text: "Pell's Campaign Bus, full of influencers, with his lobbyists, his drone carriers and Pell himself on a quad bike." },
      { who: "pell", text: "The count is tonight. Let's make sure the right people get there." },
      { who: "cath", text: "The lobbyists switch off a tower's special upgrade, and Pell will try to ram me. Keep him busy." },
      { who: "cath", expression: "determined", text: "When the bus breaks, influencers pour out. Ines's tents keep the towers from staring at them." },
    ],
    after: [
      { who: "tomas", text: "Ines has won! By two hundred and twelve votes!" },
      { who: "ines", text: "The motorway is cancelled. Now let's see what Pell does next." },
    ],
  },
  // Act 9, The Merger.
  81: {
    name: "Two Logos, One Door",
    before: [
      { who: "narrator", text: "Pell lost the vote. Now Hollowell and Candor have merged into one giant company, HollowCandor." },
      { who: "tomas", text: "One company, twice the vans. They're coming to buy whatever the council can't protect." },
      { who: "cath", expression: "determined", text: "Same as always: slow them, stop them, don't let them reach the farm." },
    ],
    after: [
      { who: "tomas", text: "Their new logo is both old logos stuck together. Bea says it looks like a sandwich." },
    ],
  },
  82: {
    name: "The Joint Statement",
    before: [
      { who: "sol", text: "Their first joint statement: 'One company, one valley.' And both fleets, on two roads, packed close." },
      { who: "cath", expression: "determined", text: "Crowds on two roads: bees on both. Lots of them." },
    ],
    after: [
      { who: "sol", text: "I read their statement out on the podcast, very slowly. It sounded even worse." },
    ],
  },
  83: {
    name: "Rebrand Day",
    before: [
      { who: "tomas", text: "They repainted every truck overnight, and added armour while they were at it." },
      { who: "cath", expression: "determined", text: "Tougher trucks today. Upgrade your best towers before building new ones." },
    ],
    after: [
      { who: "tomas", text: "New paint, same trucks. And they still turned back." },
    ],
  },
  84: {
    name: "Redundancies",
    before: [
      { who: "pip", text: "Cath. It's Pip. They've sacked me. I'm sorry for everything I did." },
      { who: "pip", text: "I've brought something to make up for it: a copy of their secret board meeting notes." },
      { who: "cath", expression: "determined", text: "Thank you, Pip. Money's tight today, so we build cheap and let the waves pay." },
    ],
    after: [
      { who: "mara", text: "These notes are real. Pip has given us exactly what we need." },
    ],
  },
  85: {
    name: "The Minutes",
    before: [
      { who: "mara", text: "The notes say their real plan is to buy Kingsmarket's market square, the heart of the whole valley." },
      { who: "pip", text: "And they're moving the money in armoured trucks today." },
      { who: "cath", expression: "determined", text: "Silos fire straight through armour. Put them where the trucks go slowest." },
    ],
    after: [
      { who: "mara", text: "Next, they meet to vote on it. We need to be ready." },
    ],
  },
  86: {
    name: "Board Meeting Nine",
    before: [
      { who: "pip", text: "The board meets tonight. They've cut the street lights so nobody sees them coming." },
      { who: "cath", text: "In the dark, we only see what's near a tower or near me. And they're coming two ways." },
      { who: "cath", expression: "determined", text: "Line both roads with towers so the whole lane is lit." },
    ],
    after: [
      { who: "pip", text: "They voted to buy the square. The sale goes through at their meeting in Kingsmarket." },
    ],
  },
  87: {
    name: "The Co-op's Bank",
    before: [
      { who: "tomas", text: "They're trying to buy the bank that lends money to all our farms. And there's a gale blowing." },
      { who: "cath", expression: "determined", text: "Wind spoils the aim of scarecrows and silos. Bees, ponds and windmills today." },
    ],
    after: [
      { who: "tomas", text: "The bank said no. It's a co-op too: it belongs to the farmers." },
    ],
  },
  88: {
    name: "The Golden Parachute",
    before: [
      { who: "sol", text: "Their bosses are flying out by helicopter and drone, with bags of money." },
      { who: "cath", expression: "determined", text: "The sky's full of drones today. Scarecrows, bees and windmills." },
    ],
    after: [
      { who: "sol", text: "Half their managers have quit. The rest are packing for Kingsmarket." },
    ],
  },
  89: {
    name: "Quarterly Results",
    before: [
      { who: "pip", text: "They need a win before their shareholders meet, so they're sending everything. No breaks between waves." },
      { who: "cath", expression: "determined", text: "No time to build between waves. Build everything first, and save the pie for when they pile up." },
    ],
    after: [
      { who: "pip", text: "Their results are terrible. The board is coming to deal with us in person." },
    ],
  },
  90: {
    name: "The Board of Directors",
    before: [
      { who: "narrator", text: "The Board of Directors in one armoured limousine. It takes over our best tower, and directors spill out when it stops." },
      { who: "pell", text: "Graham Pell, chairman of HollowCandor. Every farm has a price. We're here to pay it." },
      { who: "cath", expression: "determined", text: "It's armoured, so bring silos and the courthouse. Spread your towers so a takeover doesn't hurt." },
    ],
    after: [
      { who: "mara", text: "The board turned back. But they've called a shareholders' meeting in Kingsmarket, to buy the square." },
      { who: "cath", expression: "determined", text: "Then that's where we're going. All of us." },
    ],
  },
  // Act 10, Kingsmarket.
  91: {
    name: "The Charter",
    before: [
      { who: "narrator", text: "Kingsmarket, the valley's old market town. HollowCandor's meeting is in the square they want to buy." },
      { who: "mara", text: "This is the town charter, from the 1300s. It says the square belongs to the traders, forever." },
      { who: "cath", expression: "determined", text: "Then we keep their trucks out of the square until Mara can read it to them." },
    ],
    after: [
      { who: "mara", text: "They can't buy what was never for sale. I just have to say it in front of the shareholders." },
    ],
  },
  92: {
    name: "The Clock Tower",
    before: [
      { who: "tomas", text: "When the clock strikes, they all come at once. No gaps between waves." },
      { who: "cath", expression: "determined", text: "Build everything you can before the first wave. Save the pie for when they bunch up." },
    ],
    after: [
      { who: "tomas", text: "The clock struck twelve and we're still here." },
    ],
  },
  93: {
    name: "Fishwives' Row",
    before: [
      { who: "sol", text: "The boats from Shingle Bay have sailed in to help, and they've brought fish to sell." },
      { who: "cath", expression: "delighted", text: "Market day, then. The money comes in fast, so spend it as it arrives." },
    ],
    after: [
      { who: "tomas", text: "Every farm and every boat in the valley is in Kingsmarket now." },
    ],
  },
  94: {
    name: "The Grain Exchange",
    before: [
      { who: "ines", text: "They're sending armoured trucks through the old grain exchange." },
      { who: "cath", expression: "determined", text: "Armour soaks up weak hits. Silos and upgraded towers." },
    ],
    after: [
      { who: "ines", text: "The exchange held. The traders have locked its doors for us." },
    ],
  },
  95: {
    name: "Bell Lane",
    before: [
      { who: "sol", text: "Night on Bell Lane, and they're hiding in the side streets." },
      { who: "cath", expression: "determined", text: "At night the towers can't see as far. Build tight to the lane, and watch the red rings." },
    ],
    after: [
      { who: "sol", text: "Every bell in Kingsmarket is ringing for us tonight." },
    ],
  },
  96: {
    name: "The Long Table",
    before: [
      { who: "tomas", text: "Every farm in the valley is eating together at one long table in the square." },
      { who: "tomas", text: "And HollowCandor has sent crowds to break it up." },
      { who: "cath", expression: "determined", text: "Big crowds: bees and cannons. Nobody spoils this dinner." },
    ],
    after: [
      { who: "bea", text: "Mrs Keel let me sit next to her. She said I'm brave." },
    ],
  },
  97: {
    name: "The Charter Steps",
    before: [
      { who: "mara", text: "I'm reading the charter on the steps today. They've fenced off half the plots to stop us." },
      { who: "cath", expression: "determined", text: "Half the plots, so every tower counts. Put them on the bends." },
    ],
    after: [
      { who: "mara", text: "I read it out. The shareholders went very quiet." },
    ],
  },
  98: {
    name: "Vane's Last Memo",
    before: [
      { who: "vane", text: "Octavia Vane. I've resigned from HollowCandor. Here's every memo I sent. I'm sorry." },
      { who: "sol", text: "Fog's rolling in, and they're coming two ways." },
      { who: "cath", expression: "determined", text: "In fog the towers can't see as far. Build close to both roads." },
    ],
    after: [
      { who: "vane", text: "Those memos prove they knew their water study was fake. Use them." },
    ],
  },
  99: {
    name: "The Eve of Kingsmarket",
    before: [
      { who: "tomas", text: "The vote is tomorrow. Tonight they're sending their toughest vehicles." },
      { who: "cath", expression: "determined", text: "Upgrade your best towers, and merge them into megastructures if you can." },
    ],
    after: [
      { who: "cath", text: "Tomorrow it all ends, one way or another. Get some sleep, everyone." },
    ],
  },
  100: {
    name: "HollowCandor",
    before: [
      { who: "narrator", text: "HollowCandor itself, in one giant machine. It jams towers, heals itself, and breaks into smaller pieces when hit." },
      { who: "pell", text: "Ms Hale. One signature, and every farm in the valley is rich. Why fight it?" },
      { who: "cath", expression: "determined", text: "Because it isn't for sale, Mr Pell. It never was." },
      { who: "cath", expression: "determined", text: "Everything we've got, everyone. Silos and the courthouse for the big one, masts for the hidden pieces." },
    ],
    after: [
      { who: "narrator", text: "The machine breaks apart in the square. The shareholders vote to sell nothing, and to go home." },
      { who: "mara", text: "The square belongs to the traders. The valley belongs to the people who farm it." },
      { who: "cath", expression: "delighted", text: "Then let's eat. Bea has something she wants to read to everyone." },
    ],
  },
};

export const FINALE: StoryLine[] = [
  { who: "narrator", text: "Kingsmarket square, the next morning. Bea stands on a crate in front of the whole valley." },
  { who: "bea", text: "My school project, by Bea Hale. It's called 'What my mum does'." },
  { who: "bea", text: "My mum gets up very early. She bakes pies, and sometimes she throws them at vans." },
  { who: "bea", text: "When people tried to take our farms, she didn't shout. She just got everybody to help each other." },
  { who: "bea", text: "Mrs Keel says my mum is the bravest person she knows. I think so too. The end." },
  { who: "narrator", text: "The whole square claps. Tomas pins Bea's drawing to the front of his stall, where it stays." },
];
