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
      { who: "cath", expression: "determined", text: "Scarecrows and bees can. Put them where they can reach the sky over the lane." },
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
      { who: "cath", expression: "determined", text: "So every truck we stop lets two drones loose. Keep scarecrows and bees behind the hedges for them." },
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
      { who: "sol", text: "Morning, Saltmarsh, this is The Salt Hour. Four hundred people with ring lights got off a coach at seven." },
      { who: "sol", text: "They're here to film our lanes, sponsored by guess who. They walk slowly and they don't look where they're going." },
      { who: "cath", text: "Saltmarsh has ponds. A duck pond slows anything that passes it. Put them where the hedges can finish the job." },
    ],
    after: [
      { who: "sol", text: "We're number one in Agriculture and number four in Comedy. I didn't enter Comedy." },
    ],
  },
  22: {
    name: "Going Live",
    before: [
      { who: "sol", text: "Two hundred influencers, packed tight. Anyone near one gets filmed, and anyone being filmed stops working. Scarecrows too." },
      { who: "cath", text: "So build back from the verge, out of shot, and let the bees reach in. Ponds hold them while we do it." },
      { who: "sol", text: "And I'm going live. If they want an audience, they can share mine." },
    ],
    after: [
      { who: "sol", text: "Nine thousand watching at the peak. Most of them came for the woman in the trench coat with the pie." },
      { who: "cath", expression: "wink", text: "Apple. Tell them it was apple." },
    ],
  },
  23: {
    name: "Beach Clean",
    before: [
      { who: "crisp", text: "'Hollowell is proud to sponsor the Saltmarsh Beach Clean. Our express fleet will carry the volunteers.'" },
      { who: "sol", text: "I cleaned that beach on Sunday. There's nothing on it. They've shut the coast road to film nothing." },
      { who: "pip", text: "I've sorted you a slipway permit, Sol, in case you need the boats. Just tell me which morning." },
      { who: "cath", text: "Express vans: quicker, and worth more stopped. Ponds early on the road, so they're slow by the time they reach us." },
    ],
    after: [
      { who: "sol", text: "Total collected by the clean-up: one crisp packet. Hollowell's own brand." },
    ],
  },
  24: {
    name: "Discount Code",
    before: [
      { who: "sol", text: "It's raining vouchers. Twenty per cent off, code SALTMARSH. There's one stuck to every ewe on the marsh." },
      { who: "cath", text: "Vouchers come by drone, and hedges can't reach drones. Hives and scarecrows along the marsh path." },
    ],
    after: [
      { who: "bea", text: "I picked up thirty-one vouchers for my project. Miss Okafor says that's a lot of evidence." },
    ],
  },
  25: {
    name: "The Unboxing",
    before: [
      { who: "sol", text: "Today's content: forty trucks, unboxed live. Extra-thick packaging for the camera, so they'll take some stopping." },
      { who: "cath", text: "Heavier trucks. Upgrade before you spread. Three strong hedges beat six thin ones." },
    ],
    after: [
      { who: "sol", text: "Every unboxing ended with a Wholesome Hollow hamper. That's our label. That's my lamb in there." },
      { who: "cath", text: "Who paid for the hampers?" },
    ],
  },
  26: {
    name: "Sea Fret",
    before: [
      { who: "sol", text: "Sea fret's in. Thirty metres of visibility. Lovely for radio. Terrible for everything else." },
      { who: "cath", text: "Like the moor. Everything reaches less. Build tight to the road and let the ponds keep them close." },
    ],
    after: [
      { who: "sol", text: "Wholesome Hollow pays us through a company called WH Holdings. Registered office: Marrow House, Kingsmarket." },
    ],
  },
  27: {
    name: "Brand Deal",
    before: [
      { who: "crisp", text: "'Sol, we love the show. Fifty thousand marks for a season, and only very small changes to the content.'" },
      { who: "sol", text: "Reading it on air. Page four: 'Talent will describe the lanes as underused.' Talent says no thank you." },
      { who: "sol", text: "Our one sponsor was the feed shop, and the feed shop got bought this morning. We're broke this week." },
      { who: "cath", text: "Then we spend like it. Cheap first, and build as the road pays out. It pays well today." },
    ],
    after: [
      { who: "crisp", text: "'We respect Mr Abara's decision, and his right to a smaller audience.'" },
    ],
  },
  28: {
    name: "Golden Hour",
    before: [
      { who: "sol", text: "Golden hour. They all want the sunset behind them, so they'll come late and fast." },
      { who: "cath", text: "And it's dark right after. Shorter reach for us, quicker vans for them. Build close and keep the ponds working." },
    ],
    after: [
      { who: "sol", text: "Marrow House is nine floors. Floor one's a dentist. Two to eight are empty. Nine is locked." },
    ],
  },
  29: {
    name: "The Blimp",
    before: [
      { who: "crisp", text: "'The Brand Ambassador will visit Saltmarsh this week to meet its many fans.'" },
      { who: "sol", text: "There's a blimp over the estuary with a forty-metre smile on the side. And the wind's got up." },
      { who: "cath", text: "High wind: drones come in quicker and scarecrows can't throw straight. Hives do the work today." },
    ],
    after: [
      { who: "sol", text: "The dentist on floor one signs for floor nine's post. I've booked a check-up." },
    ],
  },
  30: {
    name: "Brand Ambassador",
    before: [
      { who: "narrator", text: "The Brand Ambassador Blimp: a screen the size of a barn, flying low. Anyone under it stops to watch." },
      { who: "sol", text: "Only scarecrows and bees can reach it, and they'll stop to watch too if it gets close." },
      { who: "cath", expression: "determined", text: "Every hive we have, then, set a little back from its path. Close enough to sting, too far to watch." },
    ],
    after: [
      { who: "sol", text: "Check-up done. Floor nine's post says 'WH Holdings, a Hollowell Group company'. The dentist let me read it." },
      { who: "sol", text: "Wholesome Hollow is Hollowell. Every jar we've sold under that label, we sold to them. Hampers included." },
    ],
  },

  // Act 4, Rivermead: the flood.
  31: {
    name: "The River Rises",
    before: [
      { who: "cath", text: "Every farm has pulled out of Wholesome Hollow. Rivermead sells direct from today." },
      { who: "ines", text: "Ines Farrow. The river's two feet up since midnight. I've moved the herd to the top field. From there I can see the bypass." },
      { who: "ines", text: "Nine bulldozers on it, engines warm. They're waiting for the water to do the first part." },
      { who: "cath", text: "Rain slows everything on the lane, them too. But bees won't fly in it. Lean on hedges and ponds." },
    ],
    after: [
      { who: "ines", text: "The dozers turned back at the ford. I've written down all nine registrations, in case anyone asks later." },
    ],
  },
  32: {
    name: "Sandbag Sunday",
    before: [
      { who: "tomas", text: "Sandbag Sunday. Sixty-three volunteers, eleven shovels, soup for all, and Mr Ashby's ladder, returned at last." },
      { who: "ines", text: "Every mark we had went on sand. The tin's nearly empty." },
      { who: "pip", text: "Brought a van of sand from the depot. Where are you building the wall? I'll tell the lads." },
      { who: "cath", text: "Small and often, then. Cheap hedges now, and spend what the lane pays as it comes." },
    ],
    after: [
      { who: "tomas", text: "Four thousand sandbags. Mr Ashby used the ladder to stack them. He says that makes us even." },
    ],
  },
  33: {
    name: "Compulsory Purchase",
    before: [
      { who: "mara", text: "A compulsory purchase notice for Rivermead, 'for flood resilience'. I've read it twice." },
      { who: "mara", text: "The second time, I held it up to the light. Council letterhead. Hollowell watermark." },
      { who: "ines", text: "And the dozers are back, with steel on the blades." },
      { who: "cath", expression: "determined", text: "Armour halves what we hit them with. Upgrade the hedges, and save the pie for the big ones." },
    ],
    after: [
      { who: "mara", text: "Objection lodged. That buys us twenty-eight days and a hearing in Kingsmarket." },
    ],
  },
  34: {
    name: "The Ford",
    before: [
      { who: "ines", text: "The road splits at the ford. They'll send half the dozers each way and see which side we forgot." },
      { who: "cath", text: "So we don't forget either. Hedges on both roads. I'll go wherever it's worst." },
    ],
    after: [
      { who: "ines", text: "Nobody got through on either side. One driver asked me for a plaster. I'm still a doctor. I gave him two." },
    ],
  },
  35: {
    name: "Silt and Ruts",
    before: [
      { who: "ines", text: "Silt to the ankle on every field. Everything's crawling, and when they crawl, they bunch." },
      { who: "bea", text: "Is silt the same as mud?" },
      { who: "ines", text: "Finer. Rub it between your fingers and it feels like flour." },
      { who: "cath", text: "Bunched up means one hive gets six at once. Bees where the ruts are deepest." },
    ],
    after: [
      { who: "bea", text: "I asked Dr Ines what my mum does, for my project. She said, 'Arithmetic, mostly.'" },
    ],
  },
  36: {
    name: "The Barn Raising",
    before: [
      { who: "tomas", text: "Barn raising at Ferris's. Forty-one people, three hundred pegs, and stalls in the yard to pay for the timber." },
      { who: "cath", text: "Market day, so the money comes quick. A barn full of farmhands can block the lane solid. Put it on the narrowest bit." },
    ],
    after: [
      { who: "ines", text: "Forty-one people built a barn in a day. The bypass has been in planning for six years." },
    ],
  },
  37: {
    name: "Dozer Alley",
    before: [
      { who: "ines", text: "They're working through the night now. Floodlights on the bypass, clearance crews, dozers on the lane." },
      { who: "pell", text: "Graham Pell, on the radio: 'Hollowell doesn't flatten communities. We make room for them to grow.'" },
      { who: "cath", text: "Night: we see less, they move faster. Build close, and put the barn in front." },
    ],
    after: [
      { who: "mara", text: "The hearing's on Friday. The notice says 'flood resilience' nineteen times. I counted, with a highlighter." },
    ],
  },
  38: {
    name: "The Grain Silo",
    before: [
      { who: "ines", text: "The flood missed the grain store. Ten tonnes of seed in a silo, and Mr Ferris, who is very cross." },
      { who: "cath", expression: "determined", text: "Grain fired that hard goes straight through plating. Silos where the dozers slow down, and armour stops mattering." },
    ],
    after: [
      { who: "bea", text: "For my project I wrote: 'My mum gets everyone to build things, and then she says thank you.'" },
    ],
  },
  39: {
    name: "High Water",
    before: [
      { who: "ines", text: "No ponds today. The fields are already ponds. We've had enough water." },
      { who: "cath", text: "And the ground's too soft to hold anything back, so slowing them works less. Build to hit hard instead." },
    ],
    after: [
      { who: "ines", text: "River's down three inches. And there's a bulldozer on the bypass the size of the chapel." },
    ],
  },
  40: {
    name: "The Mega-Dozer",
    before: [
      { who: "narrator", text: "The Mega-Dozer: sixty tonnes, plated all over, with a blade wider than the lane." },
      { who: "pell", text: "'We're not here to knock anything down, Dr Farrow. We're here to make room.'" },
      { who: "cath", expression: "determined", text: "Plated all over. That's silo work. Everything else keeps it slow while they fire." },
    ],
    after: [
      { who: "mara", text: "Notice quashed. The judge said flood resilience rarely needs sixty tonnes. I agreed with him, quietly." },
      { who: "pell", text: "'Hollowell is stepping back from Rivermead. Our partners at Candor Health will lead on the valley's wellbeing.'" },
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
