# Hedgerow v2: design note (owner's second playtest, 2026-10-02)

The owner played to level 16 and said: too easy, one strategy wins every level, every level looks the same, upgrades are unclear, the story reads as "gibberish and AI slop", the graphics feel cheap ("StarCraft 2 type visuals"), and it should be an **auto-chess type game where the player mostly watches**. This note is the source of truth for the fix. Sessions extend it; log changes in `DECISIONS.md`.

## 1. The loop: an auto-battler

- **Build, then watch.** Between waves the player places, upgrades and specialises towers. During a wave the player watches: nothing *needs* a tap.
- **Cath is autonomous.** She walks to wherever the lane is under most pressure and holds the line. The player never has to steer her. (Tap her for her stats.)
- **Abilities auto-cast** (pie, neighbours, rally) by default with sensible triggers. A setting turns auto-cast off for players who like to aim; tapping an ability still fires it.
- **Auto-continue** (a toggle that persists): the next wave starts by itself a few seconds after the build phase begins. Calling a wave early for bonus Marks stays.
- **Speed persists** across levels and visits (x1, x2, x3).
- **Clarity:** every tower card and specialisation card shows its numbers (damage a second, range, rate, special effects) and what changes from the current tier.

## 2. Every level is a different problem

Strategy comes from what the enemies *are* and from the level's **twist**, not from the map alone.

### Counters
- **Flying** enemies (drones, the Blimp) can only be hit by Scarecrows, Beehives and Cath's pie. Hedgerows, Duck Ponds, Barns and Silos are ground-only. A Radio Mast still marks flyers.
- **Armour** halves ordinary damage: Silos go straight through it.
- **Stealth** needs a Radio Mast. **Charm** needs a Clinic Tent. **Jam** (lawyers) slows towers near them. **Heal** needs focus fire. **Splitters** need splash.

### Twists (one or two per level, shown on the level card and in the briefing)
| Id | Name on screen | Rule |
|---|---|---|
| fog | Fog | Towers have 20% less range. |
| night | Night | Towers have 25% less range; vehicles are 10% faster. |
| rain | Rain | Everything on the lane is 15% slower; Beehives do half damage. |
| wind | High wind | Scarecrows and Silos do 25% less damage; drones are 30% faster. |
| drought | Drought | No Duck Ponds; slowing towers are 30% weaker. |
| tight | Tight budget | 40% fewer starting Marks; wave rewards +50%. |
| rush | Rush hour | Waves don't wait: the next one starts 6 s after the last has arrived. |
| armoured | Armoured | Every enemy has 25% more armour. |
| air | Air drop | Every wave brings extra drones (40% of its size). |
| protected | Protected land | Only half the plots can be built on (marked). |
| nocath | Cath's away | Cath isn't on the field this level. |
| noscarecrow | Scarecrow ban | No Scarecrows this level. |
| crowd | Crowds | Twice as many enemies at half health, packed close. |
| fast | Express | Enemies 25% faster; bounties +50%. |
| fortified | Fortified | Enemies have 30% more health. |
| market | Market day | Income +50% (a breather level). |

### Difficulty
- A **competent bot** (it reads the wave preview and the twist and buys counters) must win every level; a **naive bot** (Scarecrows only, no specialisations) must lose from level 8 on.
- Each level's enemy health is scaled by a per-level factor found by an offline tuner so the competent bot keeps 40-80% of its Goodwill: winnable, rarely 3 stars without thought. The table is generated into `levels.ts` and logged in `BALANCE.md`.

## 3. Looks: dark, lit, 3D

"StarCraft 2 type visuals" means real 3D: a lit, shadowed, tone-mapped battlefield with depth, materials and glowing effects. The renderer moves to WebGL with three.js (bundled, no CDN). The engine doesn't change.
- **Terrain:** a heightfield with high ground, carved lanes, water, rocks and trees, per-act palette and fog; a long-shadow sun (morning in act 1, dusk by act 7, night-fire in act 10).
- **Units:** low-poly models with proper materials: wood and straw for the farms (warm, hand-made), chrome, glass and emissive logos for the corporations (cold, over-lit). Turrets turn to their targets. Tier upgrades add parts; specialisations change silhouette and glow colour.
- **Effects:** emissive projectiles with trails, bloom, shockwaves, debris, decals, damage numbers, a camera shake on big hits.
- **Cath:** a stylised 3D figure (olive jacket, long dark hair) with her real face (shared/cath) as the head's front.
- **Phones:** portrait screens rotate the camera 90° so long maps fill the height. Pixel ratio capped at 2; half-res bloom.

## 4. Story bible

### Premise
Hollowell Group wants to run the **Marrow Corridor** through the valley: a dual carriageway lined with fulfilment sheds from Brindle Hills to Kingsmarket. The farms in the way won't sell, so Hollowell sends what it has: survey drones, delivery fleets, price wars, influencers, bulldozers, lawyers, and in the end a merger. The lanes are old, narrow and lined with hedgerows that are older than the company. Cath and her neighbours hold the lanes.

### Cast (canon: SPEC 3.2-3.4, VISION's character bible)
- **Cath Hale:** a classy, quick, warm mum; three moves ahead; dry; never preachy. Short sentences, concrete details, one zinger at most per scene.
- **Bea:** six. Literal-minded, brave, draws everything. Her thread: a school project, "What my mum does", which she reads aloud at Kingsmarket.
- **Mara Keel:** Brindle Hills cattle rancher and former litigator. Precise, deadpan, quotes the deeds.
- **Tomas Reed:** runs the Saturday market; cheerful organiser who knows everyone's name and what they owe.
- **Sol Abara:** Saltmarsh lamb farmer with a farming podcast. Talks fast, jokes faster, owns a lot of cable.
- **Dr Ines Farrow:** Rivermead dairy farmer and country doctor. Calm, evidence first, gently devastating.
- **Pip Talbot:** a cheerful Kingsmarket market inspector who "helps"; secretly Crisp's informant (revealed at the end of act 5); comes good in act 9.
- **Graham Pell** (Hollowell CEO): genial, speaks in mission statements, never raises his voice.
- **Julian Crisp** (PR fixer for both companies): smooth, a statement for everything.
- **Dr Octavia Vane** (Candor Health): elegant, never technically lies.

### Rules for every line (the anti-slop list)
1. **Every beat sets up this level's twist or threat** in plain words ("They'll come over the hedges today: drones." / "Fog. Build closer to the lane."), so the story teaches the strategy.
2. **Specific beats general.** Names, numbers, objects, places. Never "something big is coming".
3. **Jokes come from character**, not whimsy. No personified objects ("the sea looked relieved"), no "somehow", no "which is somehow worse", no "a very expensive funeral", no ironic lore cards.
4. **People sound different.** Mara cites clauses; Tomas counts people and favours; Sol does radio; Ines does evidence; Bea asks the literal question; villains speak PR.
5. **Short.** Before a level: 2-4 lines. After: 1-2 lines. Each line under 140 characters.
6. **Cause and effect.** Each act's after-beats move the plot: a consequence, a discovery, a new ally or a worse threat.
7. Satire rules (SPEC 3.5): satirise tactics, never workers; no real brands; PG.
8. At most one exclamation mark per act from Cath.

### The arc, level by level (beat · twist)
Act 1, Brindle Hills: the land team.
1. Survey drones photograph Mara's fields; Hollowell wants to "map the opportunity". · none (tutorial)
2. Pip Talbot, the friendly market inspector, warns them a van fleet is coming up the long lane. · none
3. Cath bakes; the pie is her answer to a van that won't stop. · none (pie unlocks)
4. Bea's school beehive goes to the farm; bees for the crowded waves. · crowd
5. Hollowell offers Mara three times the land's value; she reads the offer's small print aloud. · tight
6. Bank-holiday traffic: the vans come fast and bunched. · fast
7. Someone moves the fence posts overnight to "correct the boundary"; fewer plots are legal. · protected
8. The surveyors return with drones in force. · air
9. They come at night with their lights off. · night
10. Boss: the Acquisition Van, Hollowell's buying team with a chequebook, heads for Mara's gate.

Act 2, Highmoor: the price war.
11. Tomas moves the Saturday market up to Highmoor after Oakvale's square is sold. · market
12. Crisp's trucks sell eggs at 0.99 at the market gate to empty the stalls. · fast
13. The Market Stall: Tomas's plan to make the market pay for its own defence. · tight
14. 0.99 trucks break into drones when stopped; Bea asks why. · air
15. Loyalty cards: the queue of trucks is endless and cheap. · crowd
16. Moor fog; Tomas can't see his own stall. · fog
17. Hollowell buys the auction mart and rents it back; the rent is due in vans. · fortified
18. Rain on the moor; bees stay in. · rain
19. The convoy assembles at the cattle grid; Crisp gives a statement. · armoured
20. Boss: Mr Crisp's Price-War Convoy.

Act 3, Saltmarsh: the PR war.
21. Sol's podcast mentions the lanes; the next morning, influencers arrive in Saltmarsh. · none (pond unlocks)
22. Influencers charm towers into filming instead of fighting; Sol goes live to fight back. · crowd
23. A sponsored beach clean-up blocks the coast road. · fast
24. Discount codes: drones drop vouchers over the marsh. · air
25. "The Unboxing": a parade of trucks filmed for the feed. · fortified
26. Sea fret. · fog
27. Crisp offers Sol a brand deal; Sol reads the contract on air. · tight
28. Golden hour: the influencers come at sunset, fast. · night
29. The Blimp is spotted over the estuary. · wind
30. Boss: the Brand Ambassador Blimp. After: Sol finds that Wholesome Hollow, the organic label the farms sell through, is owned by Hollowell.

Act 4, Rivermead: the flood.
31. The river rises; Ines moves her herd and sees bulldozers waiting on the bypass. · rain
32. Sandbag Sunday: the whole village on the lane. · tight
33. A compulsory purchase notice, citing "flood resilience". Mara reads it twice. · armoured
34. Two lanes at the ford: the dozers split up. · none (fork)
35. Silt and ruts: everything crawls, so the dozers bunch. · crowd
36. The barn raising: the Co-op Barn. · market
37. Dozer Alley: the clearance crews work by floodlight. · night
38. The Grain Silo goes up; armour stops mattering. · armoured
39. High water: no ponds, the fields are already ponds. · drought (inverted joke: Ines: "We've had enough water.")
40. Boss: the Mega-Dozer.

Act 5, Oakvale: Candor arrives.
41. Dr Vane launches Oakvale Water: free bottles, a wellness study, no labels. · none
42. Unbranded couriers you can't see; Sol's antenna will. · fog
43. A leaflet says the well water is "under review". Ines asks: reviewed by whom? · tight
44. Unlabelled vans by night. · night
45. Sol builds the Radio Mast; stealth ends where its signal reaches. · none (mast unlocks)
46. Static on every channel: drones jam the mast's view. · air
47. Ines holds two glasses up in the square; Vane sends a crowd. · crowd
48. Cold chain: refrigerated trucks, armoured and slow. · armoured
49. The night before the clinic opens. · rush
50. Boss: Vane's Clinic-in-a-Box. After: Pip Talbot is seen getting into Crisp's car; he's been reporting every plan.

Act 6, Shingle Bay: imports by sea.
51. The bay's fishing boats are undercut by container imports landed overnight. · none
52. Low tide: the tenders race up the shingle. · fast
53. Net mending: the co-op can't afford much this week. · tight
54. A storm warning; two landing slips. · wind (fork)
55. Ines's Clinic Tent: the cure for charm. · none (tent unlocks)
56. Fog bank. · fog
57. The gale. · wind
58. Salvage: the farms keep whatever washes up; bounties are good. · market
59. The ship in the fog. · fog + armoured
60. Boss: the Container Ship.

Act 7, The Rift: the companies fall out.
61. Hollowell blames Candor for Oakvale; their lawyers turn on each other, and on the farms. · none
62. Two logos, one lane: both companies' fleets at once. · crowd
63. Paperwork: lawyers jam towers. · tight
64. A hostile takeover bid between the two; the lane is the battleground. · fortified
65. Mara's Courthouse: injunctions for bosses. · none (court unlocks)
66. Cross-examination in the rain. · rain
67. The merger rumour. · night
68. Small print: armoured and slow. · armoured
69. Recess: Cath sits this one out at Bea's nativity play. · nocath
70. Boss: the Lawyer Swarm.

Act 8, The Ballot: Pell runs for council.
71. Pell stands for Marrow council on a "Corridor of Opportunity" ticket. · none
72. Free tea tents along the lane. · market
73. Doorstep canvass: fast and everywhere. · fast
74. Leaflet drop from the air. · air
75. Tomas opens the Union Hall. · none (hall unlocks)
76. Market-day rally. · crowd
77. Exit poll at dusk. · night
78. The recount: Mara watches every ballot. · protected
79. The campaign trail, in the rain. · rain
80. Boss: Pell's Campaign Bus. After: Pell loses by 212 votes.

Act 9, The Merger.
81. Having lost the vote, Hollowell and Candor announce they'll merge. · none
82. The joint statement: two fleets, one lane. · crowd (fork)
83. Rebrand day: every truck repainted overnight. · fortified
84. Redundancies: Pip Talbot is let go and comes to Cath's door with the board minutes. · tight
85. The minutes: the merged company plans to buy Kingsmarket's market square. · armoured
86. Board meeting nine, by night. · night (fork)
87. Hostile takeover of the co-op's bank. · wind
88. The golden parachute: executives leave by air. · air
89. Quarterly results: they need a win before the AGM. · rush
90. Boss: the Board of Directors.

Act 10, Kingsmarket.
91. The AGM is at Kingsmarket; the square's 1300s charter says it belongs to the traders. Mara has a copy. · none
92. The clock tower: everything comes at once. · rush
93. Fishwives' Row: the Shingle Bay boats arrive to help. · market
94. The grain exchange. · armoured
95. Bell Lane by night. · night
96. The long table: every farm in Marrow eats together before the vote. · crowd
97. The charter steps: Mara reads the charter to the shareholders. · protected
98. Vane's last memo: Candor's people quit. · fog
99. The eve of Kingsmarket. · fortified
100. Boss: HollowCandor. Finale: Bea reads "What my mum does".
