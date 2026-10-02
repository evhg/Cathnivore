// Hedgerow's script for acts 1-5 (levels 1-50), written from the story bible in
// docs/design/hedgerow-v2.md section 4. Each before-beat names the level's threat or twist in world
// words, so the story teaches the build; each after-beat moves the plot.

import type { Beat } from "./types";

export const ACTS_1_TO_5: Record<number, Beat> = {
  // Act 1, Brindle Hills: the land team.
  1: {
    name: "Mara's Field",
    before: [
      { who: "mara", text: "There's a drone over my bottom field. It has taken forty photographs of one cow." },
      { who: "cath", expression: "smirk", text: "Hollowell put out a statement on Monday. They're 'mapping the opportunity' in Brindle Hills." },
      { who: "mara", text: "The opportunity is called Margaret. She's nineteen." },
      { who: "cath", expression: "determined", text: "Vans on the lane, drones overhead. Hedges stop vans. Only a scarecrow can reach anything that flies." },
    ],
    after: [
      { who: "mara", text: "Clause four of my deeds: no flying over the bottom field without consent. Drafted in 1911, for balloons." },
      { who: "cath", text: "They got their photographs, though. Next they'll want a look in person." },
    ],
  },
  2: {
    name: "The Long Lane",
    before: [
      { who: "pip", text: "Pip Talbot, market inspector. I see the depot rota, and there are twelve vans booked up your long lane after lunch." },
      { who: "mara", text: "Booked by whom?" },
      { who: "pip", text: "Couldn't say. If it were my lane, I'd put hedges on the bends. Only a suggestion." },
      { who: "cath", expression: "smirk", text: "It's a good one. Long lane, lots of corners, and vans slow down on corners." },
    ],
    after: [
      { who: "pip", text: "Textbook. Mind if I sketch where you put everything? For my report." },
      { who: "mara", text: "We're a farm, Pip. Nobody reports on us." },
    ],
  },
  3: {
    name: "Pie for the Road",
    before: [
      { who: "bea", text: "Why are you baking at six in the morning?" },
      { who: "cath", text: "A van went straight through Mara's hedge yesterday and didn't stop." },
      { who: "bea", text: "Is the pie for the driver?" },
      { who: "cath", expression: "wink", text: "The pie is for the van. Hot, heavy, thrown hard. When one gets past the hedges, I'll be there." },
    ],
    after: [
      { who: "bea", text: "We've got a project at school. It's called 'What my mum does'. Can I put pies?" },
      { who: "cath", expression: "smirk", text: "Put 'baking'. 'Throwing' gets a letter home." },
    ],
  },
  4: {
    name: "Bea's Beehive",
    before: [
      { who: "bea", text: "Miss Okafor says the school bees can stay with us for the holidays. I told her we've got clover." },
      { who: "mara", text: "Hollowell have switched to the small vans. Twice as many, half the size, nose to tail." },
      { who: "cath", expression: "determined", text: "Bees don't go after one van. They go after the lot. Put the hive where the lane bunches up." },
    ],
    after: [
      { who: "bea", text: "I counted the stings. Forty-four. Is that a lot for a van?" },
      { who: "cath", expression: "delighted", text: "For a van, it's a record." },
    ],
  },
  5: {
    name: "The Offer",
    before: [
      { who: "pell", text: "'Dear Ms Keel. Hollowell would like to offer three times your land's value, and a share in the valley's future.'" },
      { who: "mara", text: "Page six: paid in instalments, once they get planning permission. If they lose, I've sold a farm on credit." },
      { who: "mara", text: "And the bank has heard about the offer and called in my overdraft. The same week. Imagine." },
      { who: "cath", expression: "determined", text: "So we're short. Cheap hedges first. The lane pays well when we hold it, so build as the money comes in." },
    ],
    after: [
      { who: "mara", text: "I've replied. I corrected the spelling of my name and declined." },
    ],
  },
  6: {
    name: "Bank Holiday",
    before: [
      { who: "pip", text: "Bank holiday. The depot's paying a bonus for speed, so the vans won't slow for anything. Thought you'd want to know." },
      { who: "mara", text: "The limit on this lane is twenty. I wrote to the council about it in 1998. And 2004." },
      { who: "cath", text: "Faster vans, and every one we stop is worth more. Hedges early on the lane, so they're slowed before they're past." },
    ],
    after: [
      { who: "bea", text: "One went past so fast, my drawing of it is just a line." },
    ],
  },
  7: {
    name: "Crooked Fences",
    before: [
      { who: "mara", text: "My fence posts moved four metres in the night. Each one has a little Hollowell sticker on it." },
      { who: "crisp", text: "Julian Crisp, for Hollowell: 'We've corrected a historic boundary error, at our own expense. Happy to help.'" },
      { who: "mara", text: "The boundary was settled in 1911. I have the map. Until a judge reads it, half my plots aren't mine to build on." },
      { who: "cath", text: "Then we use the half that is. Fewer hedges, better placed." },
    ],
    after: [
      { who: "cath", text: "Quiz night, when the whole lane was in the Plough. Good timing, for people who've never drunk there." },
    ],
  },
  8: {
    name: "Forty Drones",
    before: [
      { who: "pell", text: "Graham Pell, Hollowell: 'We want to understand Brindle Hills properly. Today our survey team will look from above.'" },
      { who: "mara", text: "Forty drones registered for today. The flight notice is on the parish board. Laminated." },
      { who: "cath", expression: "determined", text: "Hedges can't reach them. Scarecrows and bees can. Put those on the bends and let the hedges keep the vans." },
    ],
    after: [
      { who: "bea", text: "Can I keep one? It's only a bit broken." },
      { who: "mara", text: "It's evidence, Bea. You may draw it." },
    ],
  },
  9: {
    name: "Lights Off",
    before: [
      { who: "pip", text: "Late text, sorry. Rumour at the depot: they might try something tonight. Keep the kettle on." },
      { who: "mara", text: "No headlights on the lane, and my dog's been barking at it since ten." },
      { who: "cath", expression: "determined", text: "Dark means we can't reach as far, and they'll drive faster. Build right up against the lane." },
    ],
    after: [
      { who: "cath", expression: "worried", text: "Lights off, first time on this lane, and they didn't miss one turn. Someone drew them a map." },
    ],
  },
  10: {
    name: "The Acquisition Van",
    before: [
      { who: "narrator", text: "The Acquisition Van: armour-plated, chauffeur-driven, with a buying team and a chequebook in the back." },
      { who: "pell", text: "Ms Keel, Graham Pell. I've come in person. I find people say yes more easily face to face." },
      { who: "mara", text: "I find I say no more easily face to face." },
      { who: "cath", expression: "determined", text: "It's slow and it's tough. It won't stop for one hedge, so give it every hedge we've got." },
    ],
    after: [
      { who: "pell", text: "Thank you, Ms Keel. Lovely hedges. We've had a yes from Oakvale Parish Council, so we'll start there." },
      { who: "mara", text: "They've sold Oakvale market square. Tomas has a market on Saturday and nowhere to hold it." },
    ],
  },

  // Act 2, Highmoor: the price war.
  11: {
    name: "Highmoor Market",
    before: [
      { who: "tomas", text: "Ninety-one stalls, one borrowed field on Highmoor, and everyone came. Even Mr Ashby, who still owes me a ladder." },
      { who: "bea", text: "Why can't the market stay in Oakvale?" },
      { who: "cath", text: "Somebody bought the ground under it. Busy day, Tomas: spend while the tin's filling. Vans will find the moor road by noon." },
    ],
    after: [
      { who: "tomas", text: "Three hundred and six through the gate. I always count." },
      { who: "tomas", text: "And Pip asked for a copy of the stall list, prices and all. Very thorough, Pip." },
    ],
  },
  12: {
    name: "Cheap Eggs",
    before: [
      { who: "crisp", text: "Julian Crisp, for Hollowell: 'Highmoor eggs, 0.99 a dozen, from our pop-up trucks. That's not a price war. It's a price.'" },
      { who: "tomas", text: "They're parked at our gate, selling below what it costs to keep a hen. People go in and don't come out to us." },
      { who: "cath", text: "They don't hang about: in, sell, out. Fast trucks pay more stopped. Catch them on the long run to the gate." },
    ],
    after: [
      { who: "tomas", text: "Mrs Penhale bought four dozen of ours at full price, then went and told the truck why. At length." },
    ],
  },
  13: {
    name: "The Market Stall",
    before: [
      { who: "tomas", text: "Here's the sum. A mark a pitch into the co-op tin, every stall, every week. The tin pays for the hedges." },
      { who: "mara", text: "And what's in the tin today?" },
      { who: "tomas", text: "Eleven marks and a button." },
      { who: "cath", text: "Then a stall goes up first. It earns every round and cheers on whatever's next to it. Hedges come out of what it makes." },
    ],
    after: [
      { who: "tomas", text: "Two hundred and twelve in the tin. Mr Ashby paid his pitch. He still owes me the ladder." },
    ],
  },
  14: {
    name: "Last Mile",
    before: [
      { who: "bea", text: "When you stop one of those trucks, why do drones come out of the back?" },
      { who: "tomas", text: "Last mile. The truck stops, the drones finish the delivery. Straight over the stalls." },
      { who: "cath", text: "Because the eggs are due by noon either way. Every truck we stop lets two fly: keep scarecrows behind the hedges." },
    ],
    after: [
      { who: "bea", text: "I drew a truck having babies." },
      { who: "cath", expression: "smirk", text: "Lovely. Maybe not for the school project." },
    ],
  },
  15: {
    name: "Loyalty Cards",
    before: [
      { who: "crisp", text: "'Every Highmoor home now has a Hollowell loyalty card. Ten stamps, a free dozen. Loyalty should be rewarded.'" },
      { who: "tomas", text: "Two hundred trucks booked for today. Smaller, cheaper and bumper to bumper on the moor road." },
      { who: "cath", text: "Packed that close, one hive stings six at a time. More bees today." },
    ],
    after: [
      { who: "tomas", text: "Mrs Penhale cut her loyalty card in half and posted it back. Freepost. They paid for the stamp." },
    ],
  },
  16: {
    name: "Moor Fog",
    before: [
      { who: "tomas", text: "I can't see my own stall. I know it's there because I can hear Mr Ashby complaining about it." },
      { who: "cath", text: "Fog takes a fifth off how far anything reaches. Build right on the road. Nothing hits what it can't see." },
    ],
    after: [
      { who: "tomas", text: "Pip came up in the fog to check on us. Walked the whole road twice, writing things down. Lovely man." },
    ],
  },
  17: {
    name: "The Auction Mart",
    before: [
      { who: "tomas", text: "Hollowell bought the auction mart on Thursday. On Friday they rented it back to us. Double." },
      { who: "mara", text: "Clause eleven of the lease: rent may be collected 'in person, by the landlord's agents'. That's the vans, Tomas." },
      { who: "cath", text: "Heavier vans, built for collecting. They'll take more stopping. Upgrade what we have before we spread out." },
    ],
    after: [
      { who: "mara", text: "Clause twelve: the landlord's agents may not park on the premises. Bea is writing them tickets." },
    ],
  },
  18: {
    name: "Rain on the Moor",
    before: [
      { who: "bea", text: "The bees won't come out. I asked nicely." },
      { who: "tomas", text: "Rain on the moor. Everything on the road slows to a crawl, theirs included." },
      { who: "cath", text: "Bees stay in when it's wet, so the hives do half their usual. Scarecrows and hedges carry today; the crawl helps." },
    ],
    after: [
      { who: "bea", text: "Miss Okafor says my project needs a photo of you at work. Can you stand still in a field?" },
      { who: "cath", text: "Not this month." },
    ],
  },
  19: {
    name: "The Cattle Grid",
    before: [
      { who: "crisp", text: "'Hollowell's Highmoor convoy is an investment in the community: twenty trucks, steel-plated for everyone's safety.'" },
      { who: "tomas", text: "Steel plates, the week after we beat them with hedges and bees. Somebody's been taking notes." },
      { who: "cath", expression: "determined", text: "Armour shrugs off half of every hit. Upgrade, so each hit counts, and keep them under fire the whole way." },
    ],
    after: [
      { who: "tomas", text: "Every truck's at the cattle grid with its engine running. Crisp's car is at the front." },
    ],
  },
  20: {
    name: "Mr Crisp's Convoy",
    before: [
      { who: "crisp", text: "'Mr Crisp will personally lead today's convoy, in the interests of transparency.'" },
      { who: "tomas", text: "He's reading his own statement out of the window. Through a megaphone." },
      { who: "cath", expression: "determined", text: "The big lorry is the one that matters. It breaks into trucks when it goes, so keep hedges behind it." },
    ],
    after: [
      { who: "crisp", text: "'Hollowell is pausing its Highmoor pricing. We've listened, and we'll be listening in Saltmarsh next.'" },
      { who: "tomas", text: "Sol Abara played the megaphone bit on his podcast. Eleven thousand listens. Saltmarsh is about to get busy." },
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
