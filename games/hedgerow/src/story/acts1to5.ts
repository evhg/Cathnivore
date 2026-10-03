// Hedgerow's script for acts 1-5 (levels 1-50), written from the story bible in
// docs/design/hedgerow-v2.md section 4. Each before-beat names the level's threat or twist in world
// words, so the story teaches the build; each after-beat moves the plot.

import type { Beat } from "./types";

export const ACTS_1_TO_5: Record<number, Beat> = {
  // Act 1, Brindle Hills: the land team. (Rewritten 2026-10-03 to the clarity rules in
  // docs/design/hedgerow-v2.md section 7: every scene says what's happening, why it matters and what to do.)
  1: {
    name: "Mara's Field",
    before: [
      { who: "narrator", text: "Brindle Hills. Hollowell, a giant delivery company, wants to pave this valley for a motorway of warehouses." },
      { who: "mara", text: "Cath! It's Mara, from the farm next door. Hollowell vans are coming up my lane to measure my fields for the sale." },
      { who: "cath", expression: "determined", text: "Your farm isn't for sale. So let's make sure their vans never reach your gate." },
      { who: "cath", expression: "smirk", text: "Plant a hedge beside the lane to slow them down, and a scarecrow to chase them off." },
    ],
    after: [
      { who: "mara", text: "They turned round! My grandfather planted those hedges. I never thought they'd save the farm." },
      { who: "cath", text: "They'll be back, and with more vans. We'll be ready." },
    ],
  },
  2: {
    name: "The Long Lane",
    before: [
      { who: "pip", text: "Hello! Pip Talbot, the market inspector. I heard at the depot that twelve vans are heading up your lane today." },
      { who: "cath", text: "Twelve? Thank you, Pip. The lane is long, with plenty of bends." },
      { who: "cath", expression: "determined", text: "And I'll be out in the lane myself, holding up any van that slips past the hedges." },
    ],
    after: [
      { who: "pip", text: "Well done! I'll let you know if I hear anything else at the depot." },
    ],
  },
  3: {
    name: "Pie for the Road",
    before: [
      { who: "bea", text: "Mum, why are you baking at six in the morning?" },
      { who: "cath", text: "Because yesterday a van drove straight through Mara's hedge, Bea. Today I've got a surprise for the next one." },
      { who: "cath", expression: "wink", text: "When a crowd of vans comes, tap the pie and tap the lane. A hot pie stops them all for a few seconds." },
    ],
    after: [
      { who: "bea", text: "The vans were covered in apple pie! Can I tell my class?" },
      { who: "cath", expression: "smirk", text: "Tell them I bake. Leave out the throwing." },
    ],
  },
  4: {
    name: "Bea's Beehive",
    before: [
      { who: "bea", text: "My school is lending us its beehive for the holidays! The bees can live on the farm." },
      { who: "mara", text: "Good timing. Hollowell have switched to small vans, lots of them, driving close together." },
      { who: "cath", expression: "determined", text: "Bees sting everything near their target, so they're perfect for a crowd. Put the hive where the lane bunches up." },
    ],
    after: [
      { who: "bea", text: "The bees chased off a whole line of vans at once!" },
      { who: "cath", expression: "delighted", text: "They did. Remember that whenever the vans come in a crowd." },
    ],
  },
  5: {
    name: "The Offer",
    before: [
      { who: "mara", text: "Hollowell sent me a letter: three times what my farm is worth, if I sign this week." },
      { who: "mara", text: "But they only pay if they win planning permission. If they lose, I've given my farm away for nothing." },
      { who: "cath", expression: "determined", text: "Then don't sign. Money's tight today, so build cheap hedges first and add more as the waves pay out." },
      { who: "cath", text: "Some vans are wrapped in bubble wrap. Single shots barely dent it, but bees burst it straight away." },
    ],
    after: [
      { who: "mara", text: "I've written back. The answer is no." },
    ],
  },
  6: {
    name: "Bank Holiday",
    before: [
      { who: "pip", text: "Warning from the depot: it's a bank holiday, and Hollowell are paying the drivers extra to go fast today." },
      { who: "cath", text: "Fast vans get past before the towers can do much." },
      { who: "cath", expression: "determined", text: "Put hedges early in the lane to slow them down. Good news: every fast van we stop pays more." },
    ],
    after: [
      { who: "bea", text: "They went past so fast my drawing of them is just a line!" },
    ],
  },
  7: {
    name: "Crooked Fences",
    before: [
      { who: "mara", text: "Cath, someone moved my fence posts in the night. Hollowell says half my field belongs to them now." },
      { who: "mara", text: "It's a lie, and I'll prove it in court. But until then, we can only build on half the plots." },
      { who: "cath", expression: "determined", text: "Then every tower has to count. Fewer of them, in the best spots by the bends." },
    ],
    after: [
      { who: "cath", expression: "worried", text: "They moved those posts on the one night everyone was at the pub quiz. Someone told them when." },
    ],
  },
  8: {
    name: "Forty Drones",
    before: [
      { who: "mara", text: "Look up. Hollowell are sending forty drones over the farm to film it for their buyers." },
      { who: "cath", text: "Drones fly over the hedges, and over me too. Hedges can't touch them." },
      { who: "cath", expression: "determined", text: "Scarecrows and bees can. And the old windmill can be rebuilt: its gusts blow everything back down the lane." },
    ],
    after: [
      { who: "bea", text: "One fell in the garden. Can I keep it?" },
      { who: "mara", text: "It's evidence, Bea. You can draw it, though." },
    ],
  },
  9: {
    name: "Lights Off",
    before: [
      { who: "pip", text: "Sorry it's late. I heard they're coming tonight, with their headlights off so nobody sees them." },
      { who: "cath", text: "In the dark, the towers can't see as far, and the vans will be quicker than usual." },
      { who: "cath", expression: "determined", text: "Build close to the lane tonight, so every tower can reach it." },
    ],
    after: [
      { who: "cath", expression: "worried", text: "They drove those bends in the dark without one wrong turn. Someone gave them a map of our lane." },
    ],
  },
  10: {
    name: "The Acquisition Van",
    before: [
      { who: "narrator", text: "Hollowell's boss, Graham Pell, has come himself, in an armoured van full of lawyers and contracts." },
      { who: "pell", text: "Ms Keel, I've come to buy your farm in person. Everyone has a price." },
      { who: "mara", text: "I don't. Turn around and go home, Mr Pell." },
      { who: "cath", expression: "determined", text: "His van is slow and very tough, and it calls in more vans. Line the whole lane with towers." },
    ],
    after: [
      { who: "pell", text: "Fine. If Brindle Hills won't sell, Oakvale's council will. We've just bought their market square." },
      { who: "mara", text: "That's Tomas's market. Every Saturday for forty years. Where will he go now?" },
    ],
  },

  // Act 2, Highmoor: the price war.
  11: {
    name: "Highmoor Market",
    before: [
      { who: "narrator", text: "Highmoor. Hollowell bought Oakvale's market square, so the Saturday market has moved up onto the moor." },
      { who: "tomas", text: "Tomas Reed, I run the market. Ninety stalls in a borrowed field, and they still came. I could cry." },
      { who: "cath", text: "Hollowell will send vans to scare the customers off. Today's a market day, so the towers earn extra." },
      { who: "cath", expression: "determined", text: "Spend as the money comes in, and keep the lane to the field gate clear." },
    ],
    after: [
      { who: "tomas", text: "Three hundred people through the gate! The market's alive, Cath." },
    ],
  },
  12: {
    name: "Cheap Eggs",
    before: [
      { who: "crisp", text: "Julian Crisp, for Hollowell. Our trucks are selling eggs at the market gate today, for 99p a dozen." },
      { who: "tomas", text: "That's less than it costs to keep the hens! They want to bankrupt our farmers, then put prices back up." },
      { who: "cath", expression: "determined", text: "Their trucks are fast: in, sell, out. Slow them early with hedges, then hit them hard." },
      { who: "tomas", text: "And some are hiding behind the walls halfway up the road. Watch for the red ring: that's where they'll jump out." },
    ],
    after: [
      { who: "tomas", text: "People bought our eggs anyway. They know what Hollowell is up to." },
    ],
  },
  13: {
    name: "The Market Stall",
    before: [
      { who: "tomas", text: "Money's tight, so here's my idea: a market stall by the lane. It earns money every wave." },
      { who: "tomas", text: "And the cheering crowd makes the towers next to it hit harder." },
      { who: "cath", text: "Build the stall first and put your strongest towers beside it. It pays for the rest." },
    ],
    after: [
      { who: "tomas", text: "The stall paid for three new hedges today. We can afford to fight now." },
    ],
  },
  14: {
    name: "Last Mile",
    before: [
      { who: "bea", text: "Mum, when you stop one of those trucks, drones fly out of the back. Why?" },
      { who: "tomas", text: "It's their backup plan. If a truck is stopped, the drones fly the parcels the rest of the way." },
      { who: "cath", expression: "determined", text: "So every truck we stop lets two drones loose, and they're coming up two roads today. Cover both." },
    ],
    after: [
      { who: "bea", text: "I drew the truck with the drones coming out. It looks like it's sneezing." },
    ],
  },
  15: {
    name: "Loyalty Cards",
    before: [
      { who: "crisp", text: "Every home on Highmoor has a free Hollowell loyalty card. Today, we deliver to all of them." },
      { who: "tomas", text: "Look at the road. Hundreds of little trucks, bumper to bumper." },
      { who: "cath", expression: "determined", text: "When they're packed this close, bees sting a whole group at once. Build more hives." },
    ],
    after: [
      { who: "tomas", text: "Mrs Penhale cut her loyalty card in half and posted it back to them. Good for her." },
    ],
  },
  16: {
    name: "Moor Fog",
    before: [
      { who: "tomas", text: "I can't see my own stall in this fog." },
      { who: "cath", text: "The towers can't see far either: fog cuts their reach." },
      { who: "cath", expression: "determined", text: "Build right next to the road today, so they can still hit what goes by." },
    ],
    after: [
      { who: "tomas", text: "Pip came up in the fog to check on us. He walked the whole road, making notes. Kind of him." },
    ],
  },
  17: {
    name: "The Auction Mart",
    before: [
      { who: "tomas", text: "Hollowell bought the auction mart where we sell our cattle. Now they're doubling our rent." },
      { who: "tomas", text: "And they're sending their toughest trucks to collect it." },
      { who: "cath", expression: "determined", text: "Tougher trucks take more hits. Upgrade the towers you have before you build new ones." },
    ],
    after: [
      { who: "tomas", text: "Not one rent truck got through. We'll pay what's fair, and not a penny more." },
    ],
  },
  18: {
    name: "Rain on the Moor",
    before: [
      { who: "bea", text: "The bees won't come out. I asked them nicely." },
      { who: "cath", text: "Bees hide from the rain, so beehives only do half their damage today." },
      { who: "cath", expression: "determined", text: "The rain slows the trucks down too. Lean on scarecrows and hedges this time." },
    ],
    after: [
      { who: "bea", text: "The bees came out when the sun did. They missed everything." },
    ],
  },
  19: {
    name: "The Cattle Grid",
    before: [
      { who: "tomas", text: "Hollowell have put steel plates on their trucks. They've been watching how we beat them." },
      { who: "cath", text: "Armour blocks part of every hit, so weak hits barely scratch them." },
      { who: "cath", expression: "determined", text: "Upgrade your towers so each hit lands hard, and keep the trucks under fire the whole way." },
    ],
    after: [
      { who: "tomas", text: "They're lining up at the cattle grid for one last push. Crisp himself is leading it." },
    ],
  },
  20: {
    name: "Mr Crisp's Convoy",
    before: [
      { who: "narrator", text: "Julian Crisp leads Hollowell's price-war convoy: a giant lorry with smaller trucks inside it." },
      { who: "crisp", text: "Shut the market today and Hollowell will look after all your shopping. Forever." },
      { who: "cath", expression: "determined", text: "When the big lorry breaks, trucks spill out. Keep plenty of towers behind it to catch them." },
    ],
    after: [
      { who: "tomas", text: "The convoy's gone! Highmoor market stays open." },
      { who: "cath", text: "And Sol, the podcaster down in Saltmarsh, says they're heading his way next." },
    ],
  },

  // Act 3, Saltmarsh: the PR war.
  21: {
    name: "On Air",
    before: [
      { who: "narrator", text: "Saltmarsh, on the coast. Sol Abara keeps sheep here and runs a farming podcast called The Salt Hour." },
      { who: "sol", text: "Cath! A coachload of influencers just arrived. Hollowell paid them to film our lanes and say they're empty." },
      { who: "cath", text: "Then let's keep them slow. Duck ponds slow everything that passes, and we've got water everywhere here." },
      { who: "cath", expression: "determined", text: "Some of them are already hiding down the lane. Watch the red rings." },
    ],
    after: [
      { who: "sol", text: "I told the whole story on the podcast. People are sharing it. Hollowell won't like that." },
    ],
  },
  22: {
    name: "Going Live",
    before: [
      { who: "sol", text: "Two coachloads today, on two roads. When an influencer stands near a tower, it stops to watch them." },
      { who: "cath", text: "So build a little back from the road, out of their shot, and let the bees reach in." },
      { who: "cath", expression: "determined", text: "They come packed together, which bees love. Cover both roads." },
    ],
    after: [
      { who: "sol", text: "I filmed the whole thing live. Nine thousand people watched them run from the bees." },
    ],
  },
  23: {
    name: "Beach Clean",
    before: [
      { who: "sol", text: "Hollowell are 'cleaning the beach' for the cameras. They've closed the coast road and sent their fastest vans." },
      { who: "sol", text: "I cleaned that beach myself on Sunday. There's nothing on it." },
      { who: "cath", expression: "determined", text: "Fast vans: put ponds early on the road to slow them. Every fast one we stop pays extra." },
    ],
    after: [
      { who: "sol", text: "Their big clean-up found one crisp packet. Hollowell's own brand." },
    ],
  },
  24: {
    name: "Discount Code",
    before: [
      { who: "sol", text: "Drones are dropping Hollowell discount vouchers all over the marsh. They're stuck to my sheep." },
      { who: "cath", text: "Lots of drones today. Hedges and ponds can't reach anything in the air." },
      { who: "cath", expression: "determined", text: "Scarecrows, bees and windmills can. Spread them along the marsh path." },
    ],
    after: [
      { who: "bea", text: "I collected thirty vouchers for my school project. My teacher says that's evidence." },
    ],
  },
  25: {
    name: "The Unboxing",
    before: [
      { who: "sol", text: "They're filming a parade of delivery trucks for the internet. Extra-tough trucks, so they look impressive." },
      { who: "cath", text: "Tougher trucks take more hits to stop." },
      { who: "cath", expression: "determined", text: "Upgrade before you build more. Three strong towers beat six weak ones today." },
    ],
    after: [
      { who: "sol", text: "Every truck carried a 'Wholesome Hollow' hamper. That's the organic label we sell our lamb through." },
      { who: "cath", expression: "worried", text: "Why would Hollowell be giving away our label's hampers?" },
    ],
  },
  26: {
    name: "Sea Fret",
    before: [
      { who: "sol", text: "Thick sea fog, and they're coming up two roads at once." },
      { who: "cath", text: "In fog the towers can't see as far. Build close to the roads." },
      { who: "pip", text: "And I've brought you something from the market: a seed cannon. It lobs sacks of seed potatoes a very long way." },
    ],
    after: [
      { who: "sol", text: "I looked up Wholesome Hollow. It's owned by a company in Kingsmarket called WH Holdings." },
    ],
  },
  27: {
    name: "Brand Deal",
    before: [
      { who: "crisp", text: "Sol, Hollowell would love to sponsor your podcast. Fifty thousand. You'd just say nice things about us." },
      { who: "sol", text: "No thanks. But they bought my only sponsor this morning, so we're broke this week." },
      { who: "cath", expression: "determined", text: "Then build cheap and let the waves pay. The swing bridge stops the vans while it's up: hit them while they wait." },
    ],
    after: [
      { who: "crisp", text: "We respect Mr Abara's choice. And his much smaller audience." },
    ],
  },
  28: {
    name: "Golden Hour",
    before: [
      { who: "sol", text: "The influencers want sunset in their videos, so they're coming late and fast." },
      { who: "cath", text: "And then it gets dark. The towers can't see as far at night." },
      { who: "cath", expression: "determined", text: "Build right beside the road, and keep the ponds slowing them." },
    ],
    after: [
      { who: "sol", text: "WH Holdings is on the top floor of Marrow House in Kingsmarket. The floor is locked. I'm going to find out why." },
    ],
  },
  29: {
    name: "The Blimp",
    before: [
      { who: "sol", text: "There's a giant Hollowell blimp over the estuary, and the wind's blowing a gale." },
      { who: "cath", text: "Scarecrows can't throw in this wind, so they're no use today. Drones will fly faster, too." },
      { who: "cath", expression: "determined", text: "Bees, ponds and windmills, then. Spread the hives along the road." },
    ],
    after: [
      { who: "sol", text: "The blimp is coming down the coast road tomorrow. It's huge, and it flies." },
    ],
  },
  30: {
    name: "Brand Ambassador",
    before: [
      { who: "narrator", text: "Hollowell's Brand Ambassador blimp: a flying TV screen. Anyone under it stops to watch the adverts." },
      { who: "sol", text: "Only things that can hit the sky can reach it. Scarecrows, bees, windmills." },
      { who: "cath", expression: "determined", text: "Build them a little back from its path: close enough to hit it, far enough not to stare." },
    ],
    after: [
      { who: "sol", text: "I got into Marrow House. WH Holdings is Hollowell. Wholesome Hollow, our organic label, belongs to them." },
      { who: "cath", expression: "worried", text: "So every jar we sold under that label made Hollowell money. We have to tell everyone." },
    ],
  },

  // Act 4, Rivermead: the flood.
  31: {
    name: "The River Rises",
    before: [
      { who: "narrator", text: "Rivermead, a valley of dairy farms. Every farm has quit Hollowell's fake organic label and sells direct now." },
      { who: "ines", text: "Dr Ines Farrow: I'm the village doctor and I farm cows. The river's flooding, and bulldozers are waiting on the bypass." },
      { who: "ines", text: "They want to flatten the farms while we're busy with the water." },
      { who: "cath", expression: "determined", text: "Rain slows them down, but it keeps the bees in. Hedges and ponds do the work today." },
    ],
    after: [
      { who: "ines", text: "The bulldozers turned back at the river. They'll try again when the water drops." },
    ],
  },
  32: {
    name: "Sandbag Sunday",
    before: [
      { who: "tomas", text: "Sandbag Sunday! The whole village is out filling bags to hold back the river." },
      { who: "ines", text: "We spent nearly all our money on sand. There's very little left for towers." },
      { who: "cath", expression: "determined", text: "Then start cheap, with hedges, and build more as each wave pays out." },
    ],
    after: [
      { who: "tomas", text: "Four thousand sandbags, and the farmhouses are dry. What a day." },
    ],
  },
  33: {
    name: "Compulsory Purchase",
    before: [
      { who: "mara", text: "The council has ordered Rivermead's farms to be sold, 'to protect against floods'. Hollowell wrote that order." },
      { who: "ines", text: "And the bulldozers are back, with steel plates on them." },
      { who: "cath", expression: "determined", text: "Armour soaks up weak hits. Upgrade your towers so every hit is a big one." },
    ],
    after: [
      { who: "mara", text: "I've challenged the order in court. The hearing is in Kingsmarket in four weeks." },
    ],
  },
  34: {
    name: "The Ford",
    before: [
      { who: "ines", text: "The road splits at the ford, so they're coming two ways at once." },
      { who: "ines", text: "And the river will flood the fields by the ford halfway through. Anything built there gets washed out." },
      { who: "cath", expression: "determined", text: "Cover both roads, and only put duck ponds by the ford. They don't mind getting wet." },
    ],
    after: [
      { who: "ines", text: "Not one bulldozer got across. The river did half the work for us." },
    ],
  },
  35: {
    name: "Silt and Ruts",
    before: [
      { who: "ines", text: "The flood left thick mud everywhere. Everything crawls through it, so the bulldozers bunch up." },
      { who: "bea", text: "Can I jump in it?" },
      { who: "cath", expression: "determined", text: "Not today, Bea. Bunched-up bulldozers are perfect for bees. Put hives where it's muddiest." },
    ],
    after: [
      { who: "bea", text: "I drew the bulldozers stuck in the mud with bees all over them." },
    ],
  },
  36: {
    name: "The Barn Raising",
    before: [
      { who: "tomas", text: "The whole village is building a new barn today, and the market's open to pay for the wood." },
      { who: "cath", text: "A barn full of farmhands can step into the lane and block it. It's very strong on the narrow bits." },
      { who: "cath", expression: "determined", text: "Market day means money comes in fast. Build the barn where the lane is tightest." },
    ],
    after: [
      { who: "ines", text: "Forty people built a barn in a day. Hollowell's bypass has taken six years and isn't finished." },
    ],
  },
  37: {
    name: "Dozer Alley",
    before: [
      { who: "ines", text: "They're working through the night now, with floodlights and bulldozers." },
      { who: "pell", text: "Graham Pell here. Hollowell doesn't flatten communities. We make room for them to grow." },
      { who: "cath", expression: "determined", text: "At night the towers can't see as far, and the bulldozers go faster. Build close, barn in front." },
    ],
    after: [
      { who: "mara", text: "The court hearing is this Friday. I've got all the evidence we need." },
    ],
  },
  38: {
    name: "The Grain Silo",
    before: [
      { who: "ines", text: "The flood missed our grain store. Mr Ferris says we can fire his grain at the bulldozers." },
      { who: "cath", text: "A silo fires grain so hard it goes straight through armour. Perfect for plated bulldozers." },
      { who: "cath", expression: "determined", text: "The river floods the fields by the ford again halfway through. Keep the silos on high ground." },
    ],
    after: [
      { who: "bea", text: "For my project I wrote: 'My mum gets everyone to build things, and then she says thank you.'" },
    ],
  },
  39: {
    name: "High Water",
    before: [
      { who: "ines", text: "The fields are under water, so we can't dig duck ponds today." },
      { who: "cath", text: "And the soft ground means hedges and slowing towers work less well." },
      { who: "cath", expression: "determined", text: "So hit hard instead: silos, scarecrows and cannons." },
    ],
    after: [
      { who: "ines", text: "The river's going down. But there's a bulldozer on the bypass as big as the chapel." },
    ],
  },
  40: {
    name: "The Mega-Dozer",
    before: [
      { who: "narrator", text: "The Mega-Dozer: sixty tonnes of plated steel, with a blade wider than the lane." },
      { who: "pell", text: "We're not here to knock anything down, Dr Farrow. We're here to make room." },
      { who: "cath", expression: "determined", text: "It's armoured all over, so silos do the real damage. Everything else keeps it slow while they fire." },
    ],
    after: [
      { who: "mara", text: "We won in court! The judge threw out the order. Rivermead's farms stay with the farmers." },
      { who: "pell", text: "Hollowell is stepping back. Our friends at Candor Health will look after the valley now." },
    ],
  },

  // Act 5, Oakvale: Candor arrives.
  41: {
    name: "Oakvale Water",
    before: [
      { who: "vane", text: "Octavia Vane, Candor Health. Oakvale Water is free, for everyone, for as long as our wellness study runs." },
      { who: "tomas", text: "There's a lorry on Oakvale green handing out bottles. No label. Just a sign-up form taped to each one." },
      { who: "ines", text: "The form asks for your date of birth and your address. You need neither to drink water." },
      { who: "cath", text: "And the lorries come up our lane to do it. Hedges for the road, scarecrows for anything that flies." },
    ],
    after: [
      { who: "vane", text: "'Nobody has to take part. We're simply making it easier to say yes.'" },
    ],
  },
  42: {
    name: "No Livery",
    before: [
      { who: "sol", text: "Unmarked couriers, no livery, no lights, and they've waited for fog. I can hear them on the scanner. Can't see them." },
      { who: "sol", text: "Give me a week and an antenna and they'll light up like a fairground." },
      { who: "cath", text: "Until then, fog cuts our reach. Build tight to the lane and stop everything we can see, early." },
    ],
    after: [
      { who: "ines", text: "Three got through. Every doorstep on Mill Row has a bottle on it and a form underneath." },
    ],
  },
  43: {
    name: "Under Review",
    before: [
      { who: "tomas", text: "Leaflet through every door: 'Oakvale's well water is under review.' Half the market's stopped buying cordial." },
      { who: "ines", text: "Under review by whom? It doesn't say. I've tested that well every spring for nine years. I'll test it again." },
      { who: "cath", text: "Nobody's buying, so the tin's thin. Cheap first, and let the lane pay us." },
    ],
    after: [
      { who: "vane", text: "'The leaflet says the water is under review. It is. We're reviewing it.'" },
      { who: "ines", text: "My results: the same as every year. They're pinned to the church door." },
    ],
  },
  44: {
    name: "Unlabelled",
    before: [
      { who: "ines", text: "Vans with no names on them, after dark, parked outside the school." },
      { who: "cath", expression: "worried", text: "Night. They're quicker and we see less. Build close to the lane. Nobody goes home early." },
    ],
    after: [
      { who: "bea", text: "Miss Okafor got a free crate of water for our class. The box says 'Thank you for taking part.'" },
      { who: "cath", text: "Bring a bottle home for Dr Ines. She'll want to test it." },
    ],
  },
  45: {
    name: "Sol's Mast",
    before: [
      { who: "sol", text: "Forty metres of scaffold, two car batteries and every cable I own. Ladies and gentlemen: the mast." },
      { who: "sol", text: "Anything inside its signal shows up on my screen, couriers included, and whatever it marks gets hit harder." },
      { who: "pip", text: "Smashing. How far does it reach, Sol? Roughly? Only for the planning form." },
      { who: "cath", text: "Put it where they've been slipping through, with hedges round it." },
    ],
    after: [
      { who: "sol", text: "Fourteen couriers spotted, fourteen stopped. They really don't like being on the radio." },
    ],
  },
  46: {
    name: "Static",
    before: [
      { who: "sol", text: "Static on every channel. Drones are flying circles round the mast, right at the edge of its range." },
      { who: "cath", expression: "determined", text: "Right at the edge. Someone measured. Scarecrows and hives by the mast: bring the drones down and the signal comes back." },
    ],
    after: [
      { who: "sol", text: "Signal's back. I never broadcast the range, you know. Not once." },
    ],
  },
  47: {
    name: "Two Glasses",
    before: [
      { who: "ines", text: "Noon, Oakvale square. Two glasses: one from the well, one from their bottles. Same lab. I'll read out both results." },
      { who: "vane", text: "'Candor welcomes an open debate. We've arranged for a great many people to attend it.'" },
      { who: "cath", text: "Hundreds of them, packed close and none of them sturdy. That's work for the bees." },
    ],
    after: [
      { who: "ines", text: "I read the results to two hundred people. Forty stayed to the end. Thirty-nine asked for a copy." },
    ],
  },
  48: {
    name: "Cold Chain",
    before: [
      { who: "tomas", text: "Refrigerated trucks for the new clinic. Insulated walls, steel doors, about five miles an hour." },
      { who: "ines", text: "A clinic, in my district. Nobody has asked the district's doctor." },
      { who: "cath", text: "Armoured and slow: silo work. Put the silos where the trucks spend longest." },
    ],
    after: [
      { who: "ines", text: "The clinic opens Monday. The staff are on two-week contracts. The study runs for two weeks." },
    ],
  },
  49: {
    name: "The Night Before",
    before: [
      { who: "sol", text: "Scanner says every van they've got is rolling tonight, back to back. They won't wait for each other." },
      { who: "cath", expression: "determined", text: "No gaps, then. Build everything before the first one, and keep the pie for when they stack up." },
      { who: "pip", text: "Big day tomorrow. What time will you lot be up? I'll bring coffee." },
      { who: "cath", expression: "smirk", text: "Early, Pip." },
    ],
    after: [
      { who: "bea", text: "Page one of my project is done. It's you in the dark with a pie. Miss Okafor says it's very atmospheric." },
    ],
  },
  50: {
    name: "Clinic-in-a-Box",
    before: [
      { who: "narrator", text: "Vane's Clinic-in-a-Box: a clinic on a flatbed, with its own staff patching it up as it drives." },
      { who: "vane", text: "'We'll be offering free wellness checks. We're not saying anyone needs one. We're saying they're free.'" },
      { who: "cath", expression: "determined", text: "It mends itself on the move. Hit it with everything at once, so the patching can't keep up." },
    ],
    after: [
      { who: "sol", text: "Photo from the clinic car park: Pip Talbot, getting into the back of Julian Crisp's car. He's laughing." },
      { who: "cath", expression: "worried", text: "The depot rota. The stall list. The mast's range. He's been passing on every plan since the long lane." },
    ],
  },
};
