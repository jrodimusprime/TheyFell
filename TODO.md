# TheyFell: Production TODO

The full production backlog for an infantry-focused WWI trench-warfare game set on the three battlefields documented in [README.md](README.md): the **Ypres Salient (Messines & Passchendaele)**, **the Somme** and **Vimy Ridge**.

Section references like **(§9.1)** point to the matching part of the README. Use it as the historical source of truth for every item below.

---

## How to read this list

| Tag | Meaning |
|---|---|
| **P0** | Needed for the **vertical slice** (one complete, polished map: *La Boisselle, 1 July 1916*) |
| **P1** | Needed for **full release** (all P1 maps and factions) |
| **P2** | Stretch goal / post-launch |
| **PH2** | **Phase 2 option:** deliberately deferred to Phase 2 (see [Phase 2 options](#phase-2-options)). Do not build in Phase 1 |
| `ID` | Unique task ID (e.g. `ART-TR-004`) for referencing in issues, commits and PRs |
| ⛓ | Depends on another task (IDs listed) |

Tick boxes as work is completed. Each item is "done" only when it is **made, integrated, historically reviewed (§11.4), and performance-checked**.

> **Playable demo:** [`game/`](game/README.md) is a browser vertical-slice demo of **MAP-S02 La Boisselle & Lochnagar**: the real terrain at true scale (6 km × 6 km from IGN lidar), the 1916 trench lines, the 07:28 mines, the 07:30 attack, AI on both sides, ragdoll deaths, frequent respawn, out-of-bounds handling and headless AI playthrough tests. Items it covers are marked *(demo)* below. Demo work is a prototype, not "done" by the rule above.

---
HIGHEST PRIORITY (in order)

✓ corpses have their arms in teh air and gun floating in air... itlooks totally weird fix that, these are the ones that must hae happened out of view... make their guns somewhere next to them and to be able to take the ammo etc — done 13 Nov 2026: the dead out of view lie in ten real poses; rifles lie flat on the ground beside them (both ends on the slope, never propped on a trench lip); E on one of your own type takes his rounds

✓ respawn map you should be able to zoom in and out of as at the moment a part of it is cut out - push to main once done — done 13 Nov 2026: wheel to zoom about the pointer, drag to pan, + / − and Whole front buttons; the countdown holds while you look

✓ german soldiers in trenches should have different modes - sometimes popping up to shoot from trenches hwith head and shoulders over the top - sometimes waiting in defence to shoot who comes down. take your time animating this properly and getting the gameplay right. take your time on this and push to master once done. some should also walk the length of the trench up and down — done 13 Nov 2026: four habits in the fire trenches (pop up over the parapet and duck, wait on the floor for whoever comes down, patrol the trench, steady at the parapet); the fire-step raised so a man on it shows his head and shoulders over the sandbags


✓ respawning and resupply should come from deeper behind enemy lines - the germans will walk towards different trenches or open defence areas near targets... take your time doing this tactic. thinking through options as the current path of using the spawning areas is just bad... better they come from behind enemy lines and walk so you dont get 100 dudes spawning at one point... then push to master. germans will also need to move to take back regions at times to get back into their defensive trenches there or in open defensive zones. ensure germans can never overlap each other - their bounding boxes steop them. — done 13 Nov 2026: both armies' reserves from three depths (docs/RESERVES.md): British from the Tara–Usna line and Albert/Bécourt; Germans from the second position in sections a German HQ marches up to trench bays or open posts, an immediate reserve in the intermediate line for bombing counter-thrusts, deliberate counter-attacks with a bombardment, withdrawals; a separation pass so no two men overlap


inside trenches walking past people is a bit weird you can push other players out of the way etc... make sure that is smoother if someone has a walking vector towards an AI player of the same team they kind of move aside in a trench - you may need to do some animation and spend time making that look correct.

once you have taken all posts A B C D E it is game over and a stats age is displayed, asks you if oyu want to start again

gennades should bounce nicely up a trench and around corners push that to master

the map looks crap in terms of quality (when you press M that map) - the directional one. take some time making that nicer. also the bottom round map should say A B C D E in the centre of the circle of the zone 

walking in trenches can make the player pop up randomly on planks etc, so lets make the walking area on the trenches just the trench floor, if they want to pop up on a standing bench whatever its called lets offer a new keyboard letter maybe T to get into trench aiming mode for defence. this will be handy later when we need to do a defensive mission


✓ attacker AI should avoid barbed wire if it can — done 12 Nov 2026: goes round a belt when he can see a way through

✓ there should be a death counter that counts deaths on both sides — done 12 Nov 2026: fallen and left, both sides, top right

✓ you should be able to press e to pick up rifle but then it is animated and bends down to swap rifles, either type of rifle german or french or english whatever — done 12 Nov 2026: E by a fallen man: stoop and swap, either nation's rifle

✓ to make it less confusing if someone fires at you their position should appear on the map as a red dot until dead — done 12 Nov 2026: red dots on the minimap and map
or you have moved away


✓ sandbags arent that stripe — done 12 Nov 2026: the bags were drawn with the planks' shader; fixed

✓ wood texture should be lower quality and less striped — done 12 Nov 2026: coarser, a few soft grain lines

✓ attacker running looks pretty lame like a strange gallop — done 12 Nov 2026: stride cut to a real jog's, bounce damped

✓ attackers should be able to jump over trenches that are narrow if they want — done 12 Nov 2026: about two in three leap at the lip

✓ i want to see total death counts as they go up on both sides — done 12 Nov 2026: top right

✓ i want to be able to select a different alive player on the map when i die — done 12 Nov 2026: click a man on the map, or random near the objective

✓ i want to see low level fog on the ground and fog further away, at the moment theres no fog — done 12 Nov 2026: patchy ground mist, haze, mist banks

✓ the horizon looks weird, the sky also looks werid no cloud map etc, no forest in the distance or something? add some variety but do it properly — done 12 Nov 2026: clouds; ridges and woods beyond the field

✓ combat inside trenches can be boring. make them use bayonets, knives, clubs with spikes, have their rifles jam also? run out of ammo, run away when you jump in…. do a combo to keep it exciting — done 12 Nov 2026: bayonets, clubs, knives (F), jams (R), out of rounds, men who run

✓ inside trenches it seems like theres 1 enemy per section maybe sometimes have none, sometimes have 5 in there — done 12 Nov 2026: clusters of 0-5 along the bays

the grenade doesn’t have an animation or much thinking in it and i cant see where it is thrown. also not seeing many others being thrown and soldiers throwing them


✓ it is really important the animation for getting out of trenches is done well, take your time looking at trenches of different height to see the characters get out, it is super important — done 12 Nov 2026: height-adaptive climb, checked at seven places


✓ review shooting accuracy and do one of those accuracy gauges for when couching standing prone and add the sway etc like all the games do — done 12 Nov 2026: ring round the crosshair; sway by stance

if we overtake an area and there is a new spawn point make sure the troops come out of a fox hole or something like that, a tunnel underground that is dark… as it looks like they’re coming otu of the air lol. also it looks like heaaaaps of troops are coming out of those just use a couple troops the rest should be coming from the back spawn points as they would in a real battle

✓ reload with a straight wrist on the right wrist, let the fingers do te work — done 13 Nov 2026: off the stock the right hand runs straight on from the forearm; it stays still over the charger while the thumb pushes the rounds down


✓ tthe enemgies seem to know where you are as soon as you jump in a trench… lets say only 1 in 10 enemies know this, the others are suprised and take half a second to turn to face you — done 12 Nov 2026: one in ten ready, the rest 0.5 s+ to turn


✓ at point 8 theres like a heap of enemies standing in one spot all shooting at the same time its totally weird fixit — done 12 Nov 2026: respawns spread through strongpoints


addmachine guns, take a lot of time to do this properly and take your time


i assume if enemies were killed outside of where i saw them or my guys they get a default body position but it looks kindof dumb… make 10 different default body positions instead and pick them randomly

✓ the player should have some weapon sway when standing, less when crouching, virtually none when lying down. the player should be able to shoot people at 200 yards at least — done 12 Nov 2026: sway by stance; 17/30 hits at 183 m standing



✓ easy one but the map should show where you are and where you're facing. it should show how many troops have died and how many are left. also when you die it should give you 10s to choose who you want to spawn into on the map or random (that is relatively close to a target, not ages away on the map) — done 12 Nov 2026: north-up map with you and your view; 10 s respawn choice

✓ enemies all stand in one exacy spot at a a defence spot but hey should spread out in defensive clusters, trenches dont seem to have many enemies — done 12 Nov 2026: clusters along the bays


## 0. Scope

### In scope
- First- and third-person **infantry** combat in trenches, tunnels, craters and no man's land.
- Player-usable **small arms**: rifles, pistols, light machine guns, **emplaced machine guns** (Vickers / MG 08), grenades, rifle grenades, melee, tools.
- **Artillery as an off-map, AI-driven system only**: barrages, creeping barrages, counter-battery fire and shell effects. Players can **request** barrages (officer + telephone or flare) but **cannot operate** guns.
- Mines, gas, wire, mud, weather, night, flares, raids, tunnelling.
- Factions: British (incl. Highland & Newfoundland), Australian, New Zealand, Canadian, German.
- **Maps are large open battlefields at true scale** (1 game unit = 1 m), built from real elevation data and georeferenced trench maps, not arena-sized sets. MAP-S02 is one 6 km × 6 km map. Distance is handled by terrain LOD, fog and culling, not by shrinking the ground (decided 12 Nov 2026).
- **Mobile is self-playing:** on phones and tablets the game plays itself. The AI controls the player through the same agent API the tests use (as in Cimmerian's "Let the AI play this level"), and the viewer watches the battle unfold with touch only for the camera, pausing and skipping. There are no on-screen twin-stick controls (decided 12 Nov 2026).
- **Respawning is frequent and normal:** death is common for a soldier, so players redeploy within seconds at a friendly trench or a taken objective, and AI reinforcements come up in waves.

### Phase 2 options
Decided on 12 Nov 2026: these are **not** part of Phase 1. They stay in the backlog tagged **PH2** so they can be picked up after launch without re-planning.

| Option | What it adds | Tasks tagged PH2 |
|---|---|---|
| **PH2-A: Light trench mortars & flamethrower** | Crew-served Stokes 3-inch / *leichter Minenwerfer*, and the German Kleif / Wex flamethrower (2-man team), as player weapons with AI teams | `ART-WPN-021`, `ART-WPN-022`, `VFX-011`, `AUD-WPN-008b`, `AUD-WPN-012`, `SYS-CMB-013`, `SYS-CMB-014`, `ANM-WPN-015`, `ANM-WPN-016`, `ANM-RCT-009`, `AI-INF-016`, `AI-INF-017` |
| **PH2-B: French faction** | French infantry 1916 (horizon blue, Adrian helmet, Lebel / Berthier, Chauchat), French voice set, and a French-sector Somme map (southern sector, 1 July 1916) | `ART-CHR-019`, `ART-CHR-033`, `ART-WPN-025`, `AUD-VO-007`, `MAP-S07` |

> In Phase 1, enemy trench-mortar fire may still appear as part of the **off-map artillery director** (incoming bombs and duds), but players and on-map AI do not operate mortars or flamethrowers.

### Out of scope (do **not** build)
- ❌ **Aircraft** of any kind (playable or AI-controlled flying units)
- ❌ **Tanks** and all other armoured or motor vehicles as playable or AI units
- ❌ **Player-operated large guns:** field guns, howitzers, railway guns, anti-aircraft guns
- ❌ Cavalry and rideable horses
- ❌ Naval content, Gallipoli and other fronts
- ❌ Any WWII-era equipment (see the date-gating table, §11.4)

> Set dressing that only *references* these (a distant artillery flash, an archival photo in a loading screen, a wrecked lorry at the edge of a map) is allowed if listed below. They are **non-interactive**.

---

## 1. Pre-production & foundations

### 1.1 Direction & documents
- [ ] **PRE-001** [P0] Write the one-page game vision & pillars (authentic trench experience, squad co-operation, respect for the fallen)
- [x] **PRE-002** [P0] ~~Choose the engine (Unreal 5 vs Unity)~~ **Decided: browser engine, pure JavaScript + WebGL2 (three.js), no build step**, following The Cimmerian (deterministic fixed tick, agent API, headless test runs). Netcode model still to choose *(demo)*
- [ ] **PRE-003** [P0] Write the Game Design Document (GDD) skeleton, linking every system in §5 of this TODO
- [ ] **PRE-004** [P0] **Art bible:** palette per battlefield (Flanders brown-grey, Somme chalk-white, Vimy snow-grey), lighting moods, material references (§3–5 photos)
- [ ] **PRE-005** [P0] **Audio bible:** realism targets, reference recordings, mix philosophy (artillery is felt more than seen)
- [ ] **PRE-006** [P0] **Historical accuracy policy:** date-gating rules (§11.4), naming conventions, sign-off process
- [ ] **PRE-007** [P0] **Sensitivity & depiction policy:** casualties, gore toggle, treatment of the dead, enemy portrayal, real unit names
- [ ] **PRE-008** [P0] Define the target platforms, minimum spec and frame-rate targets
- [ ] **PRE-009** [P0] Set performance budgets: triangles, draw calls, texture memory per map, max players & AI agents. Demo baseline: ~300 terrain tiles, 150–220 draw calls, 234 AI, 60 Hz sim at < 0.3 ms/tick (see `game/README.md`)
- [ ] **PRE-010** [P1] Write the age-rating plan (gore, gas injuries, language)
- [ ] **PRE-011** [P0] Write the scope document (Section 0 above) and get it signed off
- [x] **PRE-012** [P0] ~~Decide: are light trench mortars (and the flamethrower) player-usable?~~ **Decided: Phase 2 option PH2-A.** Not built in Phase 1
- [x] **PRE-013** [P1] ~~Decide whether to include the French faction (Somme southern sector)~~ **Decided: Phase 2 option PH2-B.** Not built in Phase 1
- [ ] **PRE-014** [P0] Define game modes for launch (see `SYS-MODE-*`)
- [ ] **PRE-015** [P1] Monetisation / DLC policy, if any (cosmetics must stay historically accurate)



## 2. Research & reference gathering

- [ ] **RES-001** [P0] Download and georeference the NLS / McMaster trench maps for every map sector (§12)
- [ ] **RES-002** [P0] Collect the barrage maps & attack plans per battle (§3–5)
- [ ] **RES-003** [P0] Build photo reference boards per battlefield (from README images + IWM/AWM/LAC archives)
- [ ] **RES-004** [P0] Uniform reference sheets per faction & year (§8)
- [ ] **RES-005** [P0] Weapon reference: museum photos, dimensions, manuals, reload procedures (§6)
- [ ] **RES-006** [P1] Visit or obtain scans of preserved sites (Vimy park, Beaumont-Hamel, Lochnagar, Hill 60, Memorial Museum Passchendaele) (§12)
- [ ] **RES-007** [P1] Record or licence authentic weapon sounds (live-fire sessions with collectors)
- [ ] **RES-008** [P1] Voice reference: period slang, regional accents (Australian, Canadian, Scottish, Newfoundland, Bavarian/Prussian German)
- [ ] **RES-009** [P1] War diaries for each mission's real timeline (Section 13 sources)
- [ ] **RES-010** [P0] Hire or consult a historical advisor; schedule review gates

---




---

## 4. Asset creation

### 4.1 Terrain & environment materials (§11.2A)
- [ ] **ART-ENV-001** [P0] Grass (healthy, trampled, burnt)
- [ ] **ART-ENV-002** [P0] **Churned mud** (dry crust, wet, liquid, puddled), blendable
- [ ] **ART-ENV-003** [P0] **Somme/Vimy chalk** (fresh white spoil, weathered, chalk-mud mix)
- [ ] **ART-ENV-004** [P1] **Flanders clay** (blue-grey, waterlogged)
- [ ] **ART-ENV-005** [P1] Snow & sleet layers (fresh, trampled, slush over mud)
- [ ] **ART-ENV-006** [P1] Ploughed / fallow field, crop field (pre-battle back areas)
- [ ] **ART-ENV-007** [P0] Roads: dirt track, cobbled *pavé*, sunken lane
- [ ] **ART-ENV-008** [P1] Plank road & corduroy road
- [ ] **ART-ENV-009** [P0] Rubble & brick debris ground
- [ ] **ART-ENV-010** [P0] Decals: craters ×3 sizes, footprints (boot types per faction), drag marks, scorch, blood (toggleable), oil, chalk splash
- [ ] **ART-ENV-011** [P0] **Water**: shell-hole water (muddy, scummy, gas-tainted tint), puddles, flooded trench floor, rain ripples
- [ ] **ART-ENV-012** [P1] Streams & marsh (Steenbeek, Ancre)
- [ ] **ART-ENV-013** [P0] Sky / atmosphere presets: dawn, overcast, rain, snow, night, fog
- [ ] **ART-ENV-014** [P0] Distant-battlefield horizon matte and gun-flash cards (non-interactive)

### 4.2 Vegetation & woodland
- [ ] **ART-VEG-001** [P0] Deciduous trees ×4 species, each with **4 damage states** (intact → stripped → shattered trunk → stump)
- [ ] **ART-VEG-002** [P0] Fallen trunks, splintered branches, root-ball craters
- [ ] **ART-VEG-003** [P0] Long grass / weeds (hides low wire), nettles
- [ ] **ART-VEG-004** [P1] Hedgerows, willow pollards (Flanders)
- [ ] **ART-VEG-005** [P1] Crops: wheat, beet
- [ ] **ART-VEG-006** [P2] Poppies & spring growth (post-battle / memorial epilogue)

### 4.3 Structures & ruins (each with intact / damaged / ruined states) (§9.5)
- [ ] **ART-STR-001** [P0] Picardy farmhouse + barn (brick & chalk)
- [ ] **ART-STR-002** [P1] Flemish farmhouse (brick, tile roof)
- [ ] **ART-STR-003** [P1] Village church (Somme style; Passchendaele church variant)
- [ ] **ART-STR-004** [P1] Château (Thiepval) + outbuildings
- [ ] **ART-STR-005** [P1] Windmill / mill foundations (Pozières, Spanbroekmolen)
- [ ] **ART-STR-006** [P0] Village terrace house modules + cellars
- [ ] **ART-STR-007** [P0] Brick wall sections, gate posts, wayside shrine / calvary
- [ ] **ART-STR-008** [P1] **German concrete pillbox (MEBU)** ×3 variants (MG post, shelter, observation), with intact / cracked / destroyed states (§9.2)
- [ ] **ART-STR-009** [P1] Concrete bunker "Gibraltar" (Pozières hero asset)
- [ ] **ART-STR-010** [P1] Railway cutting & embankment (Hill 60)
- [ ] **ART-STR-011** [P2] Memorial epilogue assets (Vimy Memorial distant silhouette, Tyne Cot cross)

### 4.4 Modular trench kit (§2, §9.2)
- [ ] **ART-TR-001** [P0] Fire-trench **bay** (straight) ×3 lengths
- [ ] **ART-TR-002** [P0] **Traverse** block (earth & sandbag)
- [ ] **ART-TR-003** [P0] Corners (inner/outer), T-junction, X-junction, dead-end, ramp
- [ ] **ART-TR-004** [P0] **Fire-step** pieces (earth, timber-faced, sandbag)
- [ ] **ART-TR-005** [P0] **Parapet** sets: sandbag, earth, chalk; damaged/breached variants
- [ ] **ART-TR-006** [P0] **Parados** sets
- [ ] **ART-TR-007** [P0] Revetment: **timber A-frame**, **corrugated iron**, expanded metal mesh, **wattle hurdle**, sandbag wall
- [ ] **ART-TR-008** [P0] **Duckboards**: straight, sloped, broken, floating (flooded), stacked spares
- [ ] **ART-TR-009** [P0] Sump pit + hand pump + drainage channel
- [ ] **ART-TR-010** [P0] Communication-trench pieces (narrower, zig-zag angles)
- [ ] **ART-TR-011** [P0] **Sap** pieces + **listening-post** pit
- [ ] **ART-TR-012** [P0] **Trench ladders** (single, double), scaling steps cut into the wall
- [ ] **ART-TR-013** [P0] **Sniper loophole plate** (steel, with shutter) + sandbag loophole
- [ ] **ART-TR-014** [P0] Trench signs (named trenches, direction boards, "Keep your head down" warnings) with a localisation-ready text system
- [ ] **ART-TR-015** [P1] **German trench variant set** (better revetting, wicker, concrete steps, wood-lined walls)
- [ ] **ART-TR-016** [P1] Collapsed / shell-blown trench sections (rubble fill, buried revetment)
- [ ] **ART-TR-017** [P1] Breastwork sections (built-up sandbag walls for waterlogged Flanders)
- [ ] **ART-TR-018** [P1] Trench bridges (foot-bridge over a trench, plank crossing)
- [ ] **ART-TR-019** [P1] Fire-trench "funk hole" alcoves
- [ ] **ART-TR-020** [P0] Gas curtain (blanket over a dugout entrance)

### 4.5 Dugouts, shelters & interiors (§9.2)
- [ ] **ART-DUG-001** [P0] British shallow dugout ("funk hole" / cut-and-cover)
- [ ] **ART-DUG-002** [P0] **German deep-dugout stair entrance** (timber-lined, 20+ steps) + landing
- [ ] **ART-DUG-003** [P0] German deep-dugout interior modules: corridor, bunk room, officer room, multi-exit junction
- [ ] **ART-DUG-004** [P1] Battalion HQ dugout (maps, telephones, desks)
- [ ] **ART-DUG-005** [P1] Regimental aid post / dressing station
- [ ] **ART-DUG-006** [P1] **Elephant-iron shelter**
- [ ] **ART-DUG-007** [P1] Nissen hut (rear areas / rehearsal ground)
- [ ] **ART-DUG-008** [P1] Cook-house, latrine, ration store
- [ ] **ART-DUG-009** [P1] Signal exchange (switchboard, cables)

### 4.6 Underground: subways & mines (§10.2)
- [ ] **ART-UG-001** [P1] **Subway** module set: straight, curve, junction, chamber, stair exit (Grange Subway, chalk)
- [ ] **ART-UG-002** [P1] Electric lights + cable, water pipe, telephone line, side chambers (aid post, ammo store)
- [ ] **ART-UG-003** [P1] **Mine shaft** (vertical, windlass) & incline
- [ ] **ART-UG-004** [P1] **Mine gallery** with timber sets (clay & chalk variants), spoil sandbags
- [ ] **ART-UG-005** [P1] **Charge chamber**: stacked ammonal tins, detonator wires, tamping sandbags
- [ ] **ART-UG-006** [P1] Listening post: geophone, "clay-kicker" work face
- [ ] **ART-UG-007** [P1] Collapsed gallery (camouflet) state
- [ ] **ART-UG-008** [P2] German gallery variant

### 4.7 Obstacles (§9.1)
- [ ] **ART-OBS-001** [P0] **Barbed wire entanglement** (tileable belt sections, 3 densities)
- [ ] **ART-OBS-002** [P0] **Double apron fence**
- [ ] **ART-OBS-003** [P0] **Low (knee-high) entanglement**
- [ ] **ART-OBS-004** [P0] **Concertina coil** (French wire)
- [ ] **ART-OBS-005** [P0] **Knife rest** (cheval de frise), portable
- [ ] **ART-OBS-006** [P1] Gooseberry & hedgehog (thrown wire balls/frames)
- [ ] **ART-OBS-007** [P0] Wooden pickets & **screw pickets**
- [ ] **ART-OBS-008** [P0] **Wire gate / trench block**
- [ ] **ART-OBS-009** [P0] Wire states: intact → cut (by hand) → shell-gapped → flattened
- [ ] **ART-OBS-010** [P0] Caught-on-wire cloth & equipment scraps (non-graphic)
- [ ] **ART-OBS-011** [P1] Felled-tree abatis

### 4.8 Props (§9, §11.2B)
- [ ] **ART-PRP-001** [P0] Ammunition boxes (.303 SAA, 7.92 mm), open/closed, bandoliers
- [ ] **ART-PRP-002** [P0] **Mills bomb box**, German stick-grenade crate
- [ ] **ART-PRP-003** [P0] Ration tins (bully beef, Maconochie), biscuit tins, jam tins
- [ ] **ART-PRP-004** [P0] Petrol-tin water cans, water bottles
- [ ] **ART-PRP-005** [P0] **Braziers**, candles, hurricane lanterns, carbide lamps
- [ ] **ART-PRP-006** [P0] **Field telephone** + cable reels + cable runs (trench wall & buried)
- [ ] **ART-PRP-007** [P0] **Trench periscopes** (box, tube, Zeiss binocular) (§9.3)
- [ ] **ART-PRP-008** [P0] **Gas gong** (shell case / oil drum) + rattle + klaxon (§9.3)
- [ ] **ART-PRP-009** [P0] **Stretchers** (canvas, wheeled stretcher carrier)
- [ ] **ART-PRP-010** [P0] Rifle racks, stacked rifles, leaning rifles
- [ ] **ART-PRP-011** [P0] Packs, greatcoats, groundsheets, haversacks, helmets (loose)
- [ ] **ART-PRP-012** [P0] Sandbag piles (full & empty), coils of wire, bundles of screw pickets
- [ ] **ART-PRP-013** [P0] Shovels, picks, entrenching tools, mallets (muffled), wire-cutters
- [ ] **ART-PRP-014** [P1] Rum jar ("SRD"), mess tins, Tommy cooker, primus stove
- [ ] **ART-PRP-015** [P1] Letters, photographs, paybooks, newspapers (readable codex items)
- [ ] **ART-PRP-016** [P1] Pigeon basket, signal lamp, signal flags, Very-light cartridges
- [ ] **ART-PRP-017** [P1] Shell cases & expended shells (dump piles, set dressing only)
- [ ] **ART-PRP-018** [P0] **Unexploded shell** (dud), mortar bomb, rifle grenade (hazard props)
- [ ] **ART-PRP-019** [P1] **OP tree** (steel camouflage tree) with interior ladder (§9.3)
- [ ] **ART-PRP-020** [P1] Camouflage netting & scrim screens, painted canvas
- [ ] **ART-PRP-021** [P1] Trench-art & personal items (crucifixes, rosaries, cigarette tins)
- [ ] **ART-PRP-022** [P2] Rats (animated), crows, lice-picking prop
- [ ] **ART-PRP-023** [P1] Gas cylinders (for cloud-release scenarios) & Livens-projector drums (static set dressing)
- [ ] **ART-PRP-024** [P2] Wrecked lorry / limber at map edges (non-interactive set dressing only)
- [ ] **ART-PRP-025** [P0] Officer's whistle, map case, compass, wristwatch (also used in first-person)

### 4.9 Characters (§8, §11.2E)

**Base bodies & heads**
- [ ] **ART-CHR-001** [P0] Base male body rig (shared skeleton for all factions)
- [ ] **ART-CHR-002** [P0] Head/face variety: ≥12 heads per faction, ageing 17–45, facial hair rules per army (moustaches common; beards rare)
- [ ] **ART-CHR-003** [P0] Mud / wet / blood (toggle) shader layers driven by gameplay

**Uniform sets** (each: summer tunic, greatcoat, winter extras, gas-mask bag, damage states)
- [ ] **ART-CHR-010** [P0] **British** infantry 1916 (Service Dress, 1908 webbing, Brodie helmet, puttees)
- [ ] **ART-CHR-011** [P1] British **Highland** variant (kilt, khaki apron, Tam o' Shanter)
- [ ] **ART-CHR-012** [P1] **Newfoundland Regiment** variant (badges)
- [ ] **ART-CHR-013** [P1] **Australian** (loose tunic, slouch hat for rear areas / Brodie in the line, Rising Sun badge, 1903 bandolier option)
- [ ] **ART-CHR-014** [P1] **New Zealand** ("lemon squeezer" hat in rear areas, Brodie in the line, puggaree colours)
- [ ] **ART-CHR-015** [P1] **Canadian** (maple-leaf badges, 1917 kit)
- [ ] **ART-CHR-016** [P0] **German** infantry 1916 (M1915 Bluse, Stahlhelm M1916, field-grey, leather equipment, grenade bags)
- [ ] **ART-CHR-017** [P1] German **Stoßtruppen** (assault troops) 1917 variant
- [ ] **ART-CHR-018** [P1] German winter / greatcoat variant
- [ ] **ART-CHR-019** [PH2] **French** 1916 horizon blue + Adrian helmet *(Phase 2 option PH2-B)*
- [ ] **ART-CHR-020** [P0] Officers per faction (British Sam Browne belt, German officer kit)
- [ ] **ART-CHR-021** [P1] Specialists: stretcher-bearer armbands (SB), RAMC, signaller arm band, tunneller (miner's kit), sniper (camouflage suit, sniper's hood)
- [ ] **ART-CHR-022** [P1] Raiding kit: blackened face, cap comforter, no badges (§9.4)

**Headgear (date-gated, §11.4)**
- [ ] **ART-CHR-030** [P0] Brodie Mk I (with and without cover), soft trench cap
- [ ] **ART-CHR-031** [P0] Stahlhelm M1916 (plain, painted camouflage 1918 optional P2), Pickelhaube (1914–15 flashbacks / rear-echelon only)
- [ ] **ART-CHR-032** [P1] Slouch hat, lemon squeezer, Glengarry / Tam o' Shanter
- [ ] **ART-CHR-033** [PH2] Adrian helmet *(Phase 2 option PH2-B)*

**Equipment**
- [ ] **ART-CHR-040** [P0] **Gas masks:** British PH helmet (1916), **small box respirator** (1916+), German *Gummimaske* with filter canister; worn / carried / in bag states
- [ ] **ART-CHR-041** [P0] Webbing & pouches per faction, bayonet frogs, entrenching tools, water bottles, haversacks, ammunition bandoliers
- [ ] **ART-CHR-042** [P1] Goatskin jerkin, leather jerkin, mufflers, gloves
- [ ] **ART-CHR-043** [P1] Body armour: German *Sappenpanzer* (MG crews, sentries)
- [ ] **ART-CHR-044** [P0] Rank insignia (sleeve chevrons, officers' cuff/shoulder rank) & unit patches

**Casualty / wounded states** (toned-down defaults, ⛓ PRE-007)
- [ ] **ART-CHR-050** [P0] Wounded (bandaged limbs, field dressing) variants
- [ ] **ART-CHR-051** [P0] Fallen soldier poses as set dressing (respectful, optional density setting)
- [ ] **ART-CHR-052** [P1] Gassed casualties (eye bandages, led-in-line tableau)

### 4.10 Player weapons (§6): each needs 1st-person model, 3rd-person model, LODs, magazine/clip/belt, bayonet (where applicable), data entry
- [ ] **ART-WPN-001** [P0] **SMLE Mk III / III\*** (+ charger clips, Pattern 1907 bayonet)
- [ ] **ART-WPN-002** [P0] **Gewehr 98** (+ stripper clips, S98/05 "butcher" bayonet)
- [ ] **ART-WPN-003** [P1] Ross Mk III (Canada, early) & Ross sniper
- [ ] **ART-WPN-004** [P1] SMLE sniper (Aldis / PPCo scope); Gewehr 98 sniper (Zeiss scope)
- [ ] **ART-WPN-005** [P1] Periscope rifle attachment (§9.3)
- [ ] **ART-WPN-006** [P0] **Lewis gun** (47-round pan, carry handle)
- [ ] **ART-WPN-007** [P1] **MG 08/15** (bipod light MG)
- [ ] **ART-WPN-008** [P0] **Vickers MG** (emplaced, tripod, water can, condenser hose, belt box)
- [ ] **ART-WPN-009** [P0] **MG 08** (sledge mount, emplaced)
- [ ] **ART-WPN-010** [P0] Webley Mk VI revolver
- [ ] **ART-WPN-011** [P0] Luger P08 (+ artillery model P2)
- [ ] **ART-WPN-012** [P1] Mauser C96
- [ ] **ART-WPN-013** [P0] **Mills bomb No. 5** (pin, lever, segmented body)
- [ ] **ART-WPN-014** [P0] **Stielhandgranate M1915/16/17** (pull cord, cap)
- [ ] **ART-WPN-015** [P1] German egg grenade (*Eierhandgranate*)
- [ ] **ART-WPN-016** [P1] Rifle grenades: Hales / No. 23 rod grenade + cup discharger; German *Gewehrgranate*
- [ ] **ART-WPN-017** [P1] Smoke & signal grenades (P bomb, phosphorus)
- [ ] **ART-WPN-018** [P0] **Trench clubs** ×3 designs, trench knife, sharpened spade, entrenching tool (melee)
- [ ] **ART-WPN-019** [P0] **Very pistol** (British No. 1, German *Leuchtpistole*) + cartridges (white / red / green)
- [ ] **ART-WPN-020** [P0] **Wire-cutters** (hand & rifle-mounted)
- [ ] **ART-WPN-021** [PH2] **Flamethrower** (German Kleif / Wex), German-only, crew of 2 *(Phase 2 option PH2-A)*
- [ ] **ART-WPN-022** [PH2] **Light trench mortars**: Stokes 3-inch + bombs; German *leichter Minenwerfer* *(Phase 2 option PH2-A)*
- [ ] **ART-WPN-023** [P2] Late-war (1918 date-gated): MP 18, Winchester 1897 trench gun, anti-tank rifle. Likely excluded since our battles end in Nov 1917
- [ ] **ART-WPN-024** [P0] Officer's whistle, binoculars, map, compass (first-person "tools")
- [ ] **ART-WPN-025** [PH2] French weapons: Lebel M1886/93, Berthier, Chauchat, French F1 grenade, Ruby pistol *(Phase 2 option PH2-B)*

### 4.11 Off-map artillery: visual assets only (players cannot operate)
- [ ] **ART-ARTY-001** [P0] Distant gun-flash cards & horizon flicker (night)
- [ ] **ART-ARTY-002** [P1] Background gun pits for rear-area set dressing (18-pdr, howitzer), **non-interactive** (rehearsal ground / map edges only)
- [ ] **ART-ARTY-003** [P0] Incoming shell projectile mesh (for rare close-ups, duds)

### 4.12 Visual effects (§10, §11.2I)
- [ ] **VFX-001** [P0] Muzzle flashes per weapon class (rifle, pistol, LMG, MG; day / night)
- [ ] **VFX-002** [P0] Bullet impacts per surface: mud, chalk, water, sandbag, timber, steel plate, flesh (toggle), wire (sparks)
- [ ] **VFX-003** [P0] **HE shell burst:** small / medium / heavy (earth fountain, debris, shock ring, smoke column)
- [ ] **VFX-004** [P0] **Shrapnel airburst** (puff, ball spray on ground)
- [ ] **VFX-005** [P0] **Mine explosion:** earth column, debris rain, dust wall, crater reveal (Lochnagar hero version)
- [ ] **VFX-006** [P1] Camouflet (surface heave, small crater collapse)
- [ ] **VFX-007** [P0] **Gas clouds:** chlorine (yellow-green), phosgene (white/faint), mustard (low, lingering, near-invisible), driven by the wind system
- [ ] **VFX-008** [P0] Gas-shell burst (soft "plop", low cloud)
- [ ] **VFX-009** [P0] **Very lights / star shells:** rising trail, flare burn, parachute drift, moving shadows, coloured signals
- [ ] **VFX-010** [P0] Grenade explosions (Mills fragmentation vs stick-grenade blast)
- [ ] **VFX-011** [PH2] Flamethrower stream, burning ground, smoke *(Phase 2 option PH2-A)*
- [ ] **VFX-012** [P0] Smoke screens (smoke shell & grenade)
- [ ] **VFX-013** [P0] **Mud splashes** (footsteps, prone, shell impacts in mud), water splashes
- [ ] **VFX-014** [P0] Weather: rain (light / heavy), sleet, snow, fog / mist banks, wind-blown debris
- [ ] **VFX-015** [P0] Dust & chalk dust (dugout shaking under bombardment)
- [ ] **VFX-016** [P0] Fire & embers (braziers, burning ruins), lamp flicker
- [ ] **VFX-017** [P1] Breath vapour (cold maps), sweat / steam
- [ ] **VFX-018** [P0] Screen effects: **gas-mask view overlay** (fogged lenses, restricted FOV), suppression blur, concussion, mud on lens (optional), blood vignette (toggle)
- [ ] **VFX-019** [P1] Tree-splinter bursts, brick dust bursts (ruins)
- [ ] **VFX-020** [P1] Barrage "wall" composite (distance version of a creeping barrage)

### 4.13 Audio (§11.2J)

**Weapons** (each: close, mid, far, interior / tunnel, mechanical foley)
- [ ] **AUD-WPN-001** [P0] SMLE: fire, bolt open/close, charger-clip load, magazine, dry fire, bayonet fix
- [ ] **AUD-WPN-002** [P0] Gewehr 98: fire, bolt, stripper clip
- [ ] **AUD-WPN-003** [P0] Lewis: fire loop, pan change, jam & clear
- [ ] **AUD-WPN-004** [P0] Vickers: fire loop, belt feed, **water boiling / steam**, traverse
- [ ] **AUD-WPN-005** [P0] MG 08: fire loop, belt, cooling
- [ ] **AUD-WPN-006** [P0] Pistols (Webley, Luger), revolver reload
- [ ] **AUD-WPN-007** [P0] Grenades: Mills pin & lever "spoon" ping, stick-grenade cord pull, throws, bounces on chalk / mud / timber, explosions
- [ ] **AUD-WPN-008** [P1] Rifle grenade launch & flight
- [ ] **AUD-WPN-008b** [PH2] Player-fired mortar "thunk", loading & bomb flight *(Phase 2 option PH2-A)*
- [ ] **AUD-WPN-009** [P0] Melee impacts, bayonet thrust, club strikes
- [ ] **AUD-WPN-010** [P0] Very pistol fire, flare hiss & burn
- [ ] **AUD-WPN-011** [P0] Wire-cutter snips, wire twang, wire snag on cloth
- [ ] **AUD-WPN-012** [PH2] Flamethrower ignition, roar, burn *(Phase 2 option PH2-A)*

**Artillery & explosions**
- [ ] **AUD-ART-001** [P0] Distant drumfire (constant rumble bed), single distant guns
- [ ] **AUD-ART-002** [P0] **Incoming shells** by calibre (whizz-bang, heavy "freight train", howitzer whine)
- [ ] **AUD-ART-003** [P0] Impacts: close / medium / far, in mud vs chalk vs water; dud thud
- [ ] **AUD-ART-004** [P0] Shrapnel airburst crack + ball patter
- [ ] **AUD-ART-005** [P0] **Mine detonation:** pre-rumble, ground shock, sustained debris rain
- [ ] **AUD-ART-006** [P0] Gas shell "plop" & hiss
- [ ] **AUD-ART-007** [P1] Creeping barrage approach & pass-over sequence

**Environment & trench life**
- [ ] **AUD-ENV-001** [P0] **Footsteps** per surface: mud (suction, deep wade), duckboard, chalk, sandbag, timber stair, water, snow, rubble, grass
- [ ] **AUD-ENV-002** [P0] Rain on ground / corrugated iron / groundsheets; wind; sleet
- [ ] **AUD-ENV-003** [P0] Dugout ambience (muffled bombardment, dripping, creaking timbers)
- [ ] **AUD-ENV-004** [P1] Tunnel ambience; **digging & listening** sounds (picks, clay-kicking, enemy tapping through the earth)
- [ ] **AUD-ENV-005** [P0] **Gas gong**, rattle, klaxon, bell
- [ ] **AUD-ENV-006** [P0] **Officers' whistles** (zero hour)
- [ ] **AUD-ENV-007** [P0] Field telephone ring, buzzer, crank
- [ ] **AUD-ENV-008** [P1] Rats, crows, larks (dawn), distant dogs
- [ ] **AUD-ENV-009** [P1] Brazier crackle, kettle, mess tins
- [ ] **AUD-ENV-010** [P0] Cloth & kit foley (webbing rattle, crawling, greatcoat, gas-mask on / off breathing)
- [ ] **AUD-ENV-011** [P0] **Breathing through a respirator**, coughing, gas choking (toned)

**Voice** (EN with accents: English regions, Scottish, Irish, Australian, NZ, Canadian, Newfoundland; DE: Prussian, Bavarian, Württemberg)
- [ ] **AUD-VO-001** [P0] Orders: advance, take cover, fix bayonets, stand to, gas, bombers forward, rapid fire, cease fire
- [ ] **AUD-VO-002** [P0] Callouts: MG, sniper, wire, grenade, flare, man down, stretcher-bearer, reloading, out of ammo
- [ ] **AUD-VO-003** [P0] Pain, effort, death (restrained), gas coughing
- [ ] **AUD-VO-004** [P1] Ambient chatter, period slang, songs hummed in the trench
- [ ] **AUD-VO-005** [P1] Surrender phrases ("Kamerad!"), prisoner handling
- [ ] **AUD-VO-006** [P1] Mission briefings / narration (letters & war-diary style)
- [ ] **AUD-VO-007** [PH2] French voice set (orders, callouts, pain, chatter) *(Phase 2 option PH2-B)*

**Music**
- [ ] **AUD-MUS-001** [P0] Main theme (original)
- [ ] **AUD-MUS-002** [P1] Per-battlefield themes (Somme, Ypres, Vimy)
- [ ] **AUD-MUS-003** [P1] Public-domain period pieces arranged (marches, hymns, music-hall songs). Verify licences ⛓ PIPE-010
- [ ] **AUD-MUS-004** [P0] Stingers: zero hour, mine blast, objective captured, defeat, victory

### 4.14 UI art (§11.2M)
- [ ] **ART-UI-001** [P0] Trench-map-styled minimap & full map (British lettered grid squares, red / blue trench colours)
- [ ] **ART-UI-002** [P0] Weapon & equipment icons (every item in 4.10)
- [ ] **ART-UI-003** [P0] Class / role icons, rank badges, faction roundels & flags, unit insignia
- [ ] **ART-UI-004** [P0] HUD elements: ammo, grenades, stamina, mud indicator, gas warning, compass, objective markers, squad list
- [ ] **ART-UI-005** [P0] Period-style fonts (licensed), paper / typewriter UI theme
- [ ] **ART-UI-006** [P1] Loading screens with PD archival photos (README images) + captions
- [ ] **ART-UI-007** [P1] Codex layout (letters, war diaries, weapon & equipment entries)
- [ ] **ART-UI-008** [P0] Main menu, server browser, loadout, settings screens

---

## 5. Game functionality (systems & mechanics)

### 5.1 Core player
- [ ] **SYS-PLY-001** [P0] First-person controller: walk, sprint (stamina), crouch, prone, lean (around traverses)
- [ ] **SYS-PLY-002** [P0] **Ladder climb**; **vault parapet / "go over the top"** context action
- [ ] **SYS-PLY-003** [P0] Jump / drop into trench, slide down crater sides
- [ ] **SYS-PLY-004** [P0] **Stamina & encumbrance** (kit weight ~30 kg; carrying wire, ammo or a stretcher)
- [ ] **SYS-PLY-005** [P0] **Mud locomotion:** speed reduction by mud depth, **getting stuck** (struggle mini-action, teammate pull-out), losing boots (P2)
- [ ] **SYS-PLY-006** [P0] Wading & **drowning risk in flooded shell holes** (stamina drain, rescue)
- [ ] **SYS-PLY-007** [P0] Third-person body awareness in first person (see own legs in mud)
- [ ] **SYS-PLY-008** [P0] Interaction system (use, pick up, carry, drag, place)
- [ ] **SYS-PLY-009** [P1] Peek-over-parapet & periscope use mode
- [ ] **SYS-PLY-010** [P1] Cold / wet exposure (stamina & accuracy penalties on Vimy snow, Passchendaele rain)

### 5.2 Combat
- [ ] **SYS-CMB-001** [P0] **Ballistics:** bullet drop, velocity, penetration by material (sandbag, timber, plate)
- [ ] **SYS-CMB-002** [P0] **Bolt-action cycling** as a timed action; clip reloads vs single-round top-up
- [ ] **SYS-CMB-003** [P0] Weapon sway, breathing, rest on parapet / sandbag (stability bonus)
- [ ] **SYS-CMB-004** [P0] **LMG:** pan / belt reloads, bipod deploy, heat
- [ ] **SYS-CMB-005** [P0] **Emplaced MG:** mount / dismount, traverse limits, belt feeding by a second crewman (faster fire), water cooling (Vickers), **jams & clearing drills**
- [ ] **SYS-CMB-006** [P0] **Weapon jams** (mud fouling raises the jam chance)
- [ ] **SYS-CMB-007** [P0] **Grenades:** Mills (pin, lever, ~4 s fuse) vs stick grenade (cord, ~4.5 s), throw arcs (stick throws further), cooking rules, bounce physics, fragmentation vs blast damage model
- [ ] **SYS-CMB-008** [P1] Rifle grenades (arc, cup discharger)
- [ ] **SYS-CMB-009** [P0] **Melee:** bayonet thrust / charge, butt-stroke, club & knife, shove; trench-width constraints
- [ ] **SYS-CMB-010** [P0] **Damage & injury model:** hit locations, bleeding, incapacitation (downed, can be bandaged or carried), death
- [ ] **SYS-CMB-011** [P0] **Suppression:** near-miss & shell-burst effects on aim, vision and movement
- [ ] **SYS-CMB-012** [P1] Concussion / blast knockback, temporary deafness (tinnitus audio filter)
- [ ] **SYS-CMB-013** [PH2] Flamethrower (German): fuel, range, burning, panic effects *(Phase 2 option PH2-A)*
- [ ] **SYS-CMB-014** [PH2] Light trench mortar (crew-served: loader + layer, range table, bombs as resource) *(Phase 2 option PH2-A)*
- [ ] **SYS-CMB-015** [P0] Friendly fire rules & penalties
- [ ] **SYS-CMB-016** [P1] Sniper scopes (glint, limited FOV), loophole plates (can be shut; AP rounds P2)

### 5.3 Battlefield systems (§9–10)
- [ ] **SYS-WIRE-001** [P0] **Wire:** blocks & slows movement, snags (stuck state), damages, cut by hand (timed, noisy), by shells (gaps), marking gaps (tape)
- [ ] **SYS-WIRE-002** [P1] **Wiring party:** players / AI can lay new wire (screw pickets = silent, wooden = noisy mallet)
- [ ] **SYS-WIRE-003** [P1] Portable knife rests to block trenches & gaps
- [ ] **SYS-ART-001** [P0] **Off-map artillery system:** shell types, calibres, dispersion, flight time, impact damage & terrain deformation
- [ ] **SYS-ART-002** [P0] **Preliminary bombardment** phase (map-scripted)
- [ ] **SYS-ART-003** [P0] **Creeping barrage:** timed lifts from barrage-map data; friendly-fire risk if players run ahead (⛓ TOOL-009)
- [ ] **SYS-ART-004** [P1] **Box barrage** (for raids)
- [ ] **SYS-ART-005** [P1] **SOS barrage on request:** officer fires a red Very light or uses the field telephone → delayed barrage on pre-registered target zones
- [ ] **SYS-ART-006** [P1] Telephone lines **cut by shellfire** → requests fail → send a runner / repair the line
- [ ] **SYS-ART-007** [P1] Duds (chance by shell type) remaining as hazards
- [ ] **SYS-ART-008** [P1] Counter-battery abstraction (enemy barrage intensity reduces over the match if "counter-battery" objectives are met)
- [ ] **SYS-DEF-001** [P0] **Terrain deformation:** craters from shells & mines (persistent per match, networked)
- [ ] **SYS-DEF-002** [P0] **Destructible trench pieces:** parapet breaches, collapsed bays, buried soldiers (dig out)
- [ ] **SYS-DEF-003** [P1] Destructible ruins & woodland damage progression
- [ ] **SYS-DEF-004** [P1] Dugout collapse / entrance blocked by direct hit
- [ ] **SYS-GAS-001** [P0] **Gas simulation:** cloud volumes advected by wind, sinking into trenches, dugouts and shell holes; dissipation by agent
- [ ] **SYS-GAS-002** [P0] **Gas masks:** put-on time, filter duration, vision & breathing penalties, damaged mask
- [ ] **SYS-GAS-003** [P0] **Gas alarms:** gong / rattle triggers (player or AI sentry), alert propagation
- [ ] **SYS-GAS-004** [P1] **Mustard persistence:** contaminated ground & water, delayed effects, blinding
- [ ] **SYS-GAS-005** [P1] Gas curtains on dugouts (protection when closed)
- [ ] **SYS-GAS-006** [P2] Cloud-release scenario from cylinders (wind can blow it back)
- [ ] **SYS-MINE-001** [P0] **Scripted mine detonations** (time-based or objective-triggered), crater spawning, kill & bury radius, global shake
- [ ] **SYS-MINE-002** [P1] **"Race for the lip"** objective after a detonation
- [ ] **SYS-MINE-003** [P1] **Tunnelling gameplay** (Hill 60): dig, listen with geophone, detect enemy galleries, counter-mine (camouflet), defend charge chambers
- [ ] **SYS-NGT-001** [P0] **Night & darkness** with light sources (lamps, braziers, flares)
- [ ] **SYS-NGT-002** [P0] **Flares:** illumination radius & duration; "freeze" mechanic (stationary = less visible); flare signals readable by both sides
- [ ] **SYS-WTH-001** [P0] **Weather system:** rain, sleet, snow, fog, wind direction & strength (feeds gas)
- [ ] **SYS-WTH-002** [P1] **Mud depth simulation:** rain raises mud depth & flooding over time; shelling churns ground into mud
- [ ] **SYS-WTH-003** [P1] Visibility modifiers from weather (AI perception too)
- [ ] **SYS-MED-001** [P0] **Medical:** bandage self/ally, stretcher-bearers (carry with 2+ players or AI), aid post healing, evacuation scoring
- [ ] **SYS-MED-002** [P1] Trench foot / exposure (long-match status effect, P2 for multiplayer)
- [ ] **SYS-LOG-001** [P0] **Resupply:** ammo & grenade crates, carry parties, limited bombs per squad
- [ ] **SYS-LOG-002** [P1] Rations & water (long modes / campaign)
- [ ] **SYS-COM-001** [P1] **Runners:** physically carry messages (orders / barrage requests) when phones are down
- [ ] **SYS-COM-002** [P1] Field telephone network (nodes, lines, repair)
- [ ] **SYS-COM-003** [P2] Signal lamps, pigeons (single-player flavour)
- [ ] **SYS-OBS-001** [P1] **Periscopes & OP tree:** spotting enemies, marking for the squad
- [ ] **SYS-OBS-002** [P1] Spotting / marking system (limited, historically plausible: no "magic radar")
- [ ] **SYS-SNP-001** [P1] Sniper loopholes (shuttered), sniper hide positions
- [ ] **SYS-CON-001** [P0] **Consolidation:** after capture, a timer to "reverse" the trench (build a new fire-step / parapet) to gain a defensive bonus
- [ ] **SYS-CON-002** [P1] Digging: shell-scrapes, connecting craters into a line, filling sandbags

### 5.4 Objectives, modes & meta
- [ ] **SYS-OBJ-001** [P0] **Frontline sector capture** (attack / defend trench by trench, as in Verdun's Frontlines) (§11.1)
- [ ] **SYS-OBJ-002** [P0] Attack waves with **zero hour**: whistles, ladders, timed advance with the barrage
- [ ] **SYS-OBJ-003** [P0] **Counter-attacks** after capture (defend the consolidated trench)
- [ ] **SYS-MODE-001** [P0] **Frontlines** (PvP / PvE): sector tug-of-war, with fast redeploy (a few seconds) at friendly trenches and taken objectives, and AI reinforcement waves *(demo)*
- [ ] **SYS-MODE-002** [P1] **Historical Operation:** scripted multi-phase battle following the real timeline (e.g. Vimy 9→12 April)
- [ ] **SYS-MODE-003** [P1] **Trench Raid** (night, small teams, prisoner snatch, box barrage)
- [ ] **SYS-MODE-004** [P1] **Squad Defence** (co-op vs AI waves)
- [ ] **SYS-MODE-005** [P2] **Tunnellers** (underground asymmetric mode, Hill 60)
- [ ] **SYS-MODE-006** [P1] **Single-player / co-op campaign** (one mission per map, briefing → mission → debrief letter)
- [ ] **SYS-MODE-007** [P0] Tutorial on the Rehearsal Ground (movement, ladders, gas drill, wire cutting, bombing, MG crew)
- [ ] **SYS-SQD-001** [P0] **Squads & roles:** section of 4–8 with roles (rifleman, bomber, Lewis gunner, officer/NCO, stretcher-bearer, sniper, signaller/runner, engineer); limits per side (e.g. MG & sniper caps, as in Isonzo)
- [ ] **SYS-SQD-002** [P0] Officer abilities: whistle (rally / advance), request barrage, mark objective, flare signals
- [ ] **SYS-SQD-003** [P1] Morale / cohesion system (near officers & comrades = steadier aim, less panic)
- [ ] **SYS-SQD-004** [P1] Surrender & prisoners (hands up, escort to the rear, score)
- [ ] **SYS-PRG-001** [P1] Progression & unlocks, **date-gated** per map / year (no Brodie in 1915 maps, etc.)
- [ ] **SYS-PRG-002** [P1] Loadout system per role & faction (data-driven)
- [ ] **SYS-PRG-003** [P2] Cosmetic regimental insignia (historically correct only)
- [ ] **SYS-SCR-001** [P0] Scoring: captures, defence, medical evacuations, resupply, wire cut, consolidation (team-play weighted)
- [ ] **SYS-CDX-001** [P1] **Codex:** unlock entries (weapons, equipment, battles) with README text & archival photos
- [ ] **SYS-CDX-002** [P2] Post-mission "historical note" screen (what really happened, casualties, memorials)

### 5.5 Technical & platform
- [ ] **SYS-NET-001** [P0] Multiplayer netcode (server-authoritative), lag compensation for ballistics
- [ ] **SYS-NET-002** [P0] Network replication of terrain deformation, wire states, gas volumes, mines
- [ ] **SYS-NET-003** [P0] Dedicated servers, server browser, matchmaking
- [ ] **SYS-NET-004** [P1] Anti-cheat, reporting, admin tools
- [ ] **SYS-NET-005** [P0] **Bots** to fill servers (⛓ AI section)
- [ ] **SYS-TEC-001** [P0] Save / load (campaign), settings, key rebinding, controller support
- [ ] **SYS-TEC-008** [P0] **Mobile = self-playing mode:** detect touch / small screens and start in autoplay. An AI pilot drives the player through `TF.step` (advance with the wave, take cover, fire, redeploy on death), with a cinematic camera (first person, over-the-shoulder, a slow orbit on death). Touch is for looking around, pause and speed (1× / 3×). Lower defaults: render scale, shadow map, tile budget, fewer AI. ⛓ PIPE-006 (agent API), AI-CORE-*
- [ ] **SYS-TEC-002** [P0] Graphics settings & scalability (foliage, gas volume quality, shadow, crater decal limits)
- [ ] **SYS-TEC-003** [P0] **Accessibility:** colour-blind modes (flare colours!), subtitles with speaker & direction, gore & casualty-density toggles, photosensitivity mode (flashes), hold-to-toggle options, aim assist (PvE)
- [ ] **SYS-TEC-004** [P1] Localisation (EN / FR / DE, + more), regional voice sets
- [ ] **SYS-TEC-005** [P1] Telemetry (heatmaps per map for balance)
- [ ] **SYS-TEC-006** [P1] Replay / spectator camera
- [ ] **SYS-TEC-007** [P2] Map editor / modding SDK

---

## 6. Animation

### 6.1 Character locomotion (3rd person; matching 1st-person body)
- [ ] **ANM-LOC-001** [P0] Idle (relaxed, alert, cold-shivering, exhausted)
- [ ] **ANM-LOC-002** [P0] Walk / jog / sprint (with rifle low, at port, slung)
- [ ] **ANM-LOC-003** [P0] Crouch-walk (in a trench: head below the parapet), crouch idle
- [ ] **ANM-LOC-004** [P0] Prone, crawl (rifle cradled), roll, prone-to-stand
- [ ] **ANM-LOC-005** [P0] **Ladder climb** (up / down, under fire), **vault the parapet**, scramble up a crater lip
- [ ] **ANM-LOC-006** [P0] Jump down into a trench / shell hole, slide down a muddy slope
- [ ] **ANM-LOC-007** [P0] **Mud wading** (knee / thigh depth), **stuck-in-mud struggle**, being pulled out (2-person paired anim)
- [ ] **ANM-LOC-008** [P0] Water wading, treading water in a shell hole, drowning (restrained)
- [ ] **ANM-LOC-009** [P0] Duckboard walking (balance), slipping / falling
- [ ] **ANM-LOC-010** [P0] **Lean** around a traverse, peek over the parapet, step up onto the fire-step
- [ ] **ANM-LOC-011** [P1] Wire snag (caught, struggling free), stepping over low wire, crawling under wire
- [ ] **ANM-LOC-012** [P1] Carry heavy load (wire coil, ammo boxes, sandbags), drag a casualty, carry a stretcher (2-person and 4-person sync)
- [ ] **ANM-LOC-013** [P1] Snow walking (Vimy), leaning into the wind
- [ ] **ANM-LOC-014** [P1] Turn-in-place, starts / stops, trench-corner pivots (motion-matching set)

### 6.2 Weapon handling (1st person + 3rd person per weapon)
- [ ] **ANM-WPN-001** [P0] **SMLE:** idle, aim, fire, **bolt cycle**, charger-clip reload (5+5), single-round top-up, empty reload, fix / unfix bayonet, inspect, sprint, melee butt
- [ ] **ANM-WPN-002** [P0] **Gewehr 98:** same set (5-round stripper clip)
- [ ] **ANM-WPN-003** [P1] Ross, sniper variants (scope in / out), periscope rifle
- [ ] **ANM-WPN-004** [P0] **Lewis:** hip / shoulder / bipod fire, **pan change**, jam clear, carry
- [ ] **ANM-WPN-005** [P1] **MG 08/15:** bipod fire, belt change, carry
- [ ] **ANM-WPN-006** [P0] **Vickers (emplaced):** mount / dismount, traverse, fire, **belt-feed (2nd crewman)**, jam drill, refill water, carry tripod & gun (2 men)
- [ ] **ANM-WPN-007** [P0] **MG 08 (sledge):** same set; drag the sledge
- [ ] **ANM-WPN-008** [P0] Webley: fire, break-open reload (with / without speedloader); Luger: toggle action, magazine change
- [ ] **ANM-WPN-009** [P0] **Mills bomb:** pull pin, hold lever, overhand throw, lob (over the traverse), underarm (into a dugout), drop / cook
- [ ] **ANM-WPN-010** [P0] **Stick grenade:** unscrew cap, pull cord, long throw, short lob
- [ ] **ANM-WPN-011** [P1] Rifle grenade: load rod / cup, angled fire from a braced rifle
- [ ] **ANM-WPN-012** [P0] **Melee:** bayonet thrust, parry, charge run, club swing, knife stab, spade strike, shove; hit reactions to each
- [ ] **ANM-WPN-013** [P0] **Very pistol:** load, fire upward, signal colours
- [ ] **ANM-WPN-014** [P0] **Wire-cutters:** cut sequence (prone & kneeling), rifle-mounted cutter
- [ ] **ANM-WPN-015** [PH2] Flamethrower 2-man team (tank carrier + nozzle man) *(Phase 2 option PH2-A)*
- [ ] **ANM-WPN-016** [PH2] Light trench mortar: drop bomb, adjust elevation, carry tube & baseplate *(Phase 2 option PH2-A)*
- [ ] **ANM-WPN-017** [P0] Weapon switching per pair, holster / sling, pick up / drop

### 6.3 Actions & interactions
- [ ] **ANM-ACT-001** [P0] **Put on / take off gas mask** (PH helmet & small box respirator; German mask): fast, under stress, fumbling variant
- [ ] **ANM-ACT-002** [P0] **Sound the gas gong / rattle**
- [ ] **ANM-ACT-003** [P0] **Blow whistle** (officer), signal "advance" arm gestures
- [ ] **ANM-ACT-004** [P0] **Use periscope** (box & tube), use binoculars, read a map
- [ ] **ANM-ACT-005** [P0] **Bandage** self & ally; **stretcher lift / carry / set down** (paired / quad sync)
- [ ] **ANM-ACT-006** [P0] Pick up / carry / drop ammo box, resupply a teammate
- [ ] **ANM-ACT-007** [P1] **Field telephone:** crank, speak; splice a cut wire
- [ ] **ANM-ACT-008** [P1] **Lay wire:** screw a picket in, run wire, muffled-mallet hammering
- [ ] **ANM-ACT-009** [P1] **Dig:** shovel, fill sandbags, place sandbags (consolidation), dig out a buried comrade
- [ ] **ANM-ACT-010** [P1] **Tunnelling:** clay-kicking, timbering, listening with a geophone, laying ammonal tins
- [ ] **ANM-ACT-011** [P1] Open / close a sniper-plate shutter, open / close a gas curtain
- [ ] **ANM-ACT-012** [P1] **Surrender** (hands up), take a prisoner, escort, search
- [ ] **ANM-ACT-013** [P1] Mark a wire gap with tape, plant a marker flag
- [ ] **ANM-ACT-014** [P0] Climb into / out of a dugout (stairs), duck under a low entrance

### 6.4 Reactions & deaths (restrained, ⛓ PRE-007)
- [ ] **ANM-RCT-001** [P0] Flinch / suppression cower (standing, crouched, prone), duck at incoming-shell sound
- [ ] **ANM-RCT-002** [P0] Hit reactions by body zone (upper, lower, limbs), stagger, fall wounded
- [ ] **ANM-RCT-003** [P0] **Downed / incapacitated** loop, crawling wounded, being dragged
- [ ] **ANM-RCT-004** [P0] Deaths: **physics ragdolls** for every death (bullet impulse at the wound, blast throw, collision with trench walls and shell holes), blended from the shot or slump pose; toned-down variants *(demo: cannon-es ragdolls on the real ground)*
- [ ] **ANM-RCT-005** [P0] **Gassed:** coughing, clutching mask, choking, blinded walk (hand on the shoulder in front)
- [ ] **ANM-RCT-006** [P1] Concussion stumble, deafened (hands to ears)
- [ ] **ANM-RCT-007** [P1] Shell-shock (tremor idle), panic flee (morale break)
- [ ] **ANM-RCT-008** [P1] Buried / partially buried struggle
- [ ] **ANM-RCT-009** [PH2] Burning reaction (flamethrower) *(Phase 2 option PH2-A)*

### 6.5 Ambient & life-in-the-trench (AI-driven, also menu diorama)
- [ ] **ANM-AMB-001** [P0] **Stand-to** at dawn (on the fire-step, rifle on the parapet)
- [ ] **ANM-AMB-002** [P0] Sentry watch with periscope, sentry dozing
- [ ] **ANM-AMB-003** [P1] Sleeping in a funk hole / on the fire-step, huddled under a groundsheet in rain
- [ ] **ANM-AMB-004** [P1] Cooking on a brazier, eating from tins, drinking tea / rum issue
- [ ] **ANM-AMB-005** [P1] Writing letters, reading, smoking, card games
- [ ] **ANM-AMB-006** [P1] Delousing ("chatting"), scraping mud off boots, cleaning a rifle, foot inspection (whale oil)
- [ ] **ANM-AMB-007** [P1] Pumping water, repairing the parapet, filling sandbags
- [ ] **ANM-AMB-008** [P2] Rats scurrying (creature anims), crows pecking

### 6.6 Environment & prop animation
- [ ] **ANM-ENV-001** [P0] Wire sway in wind, wire recoil when cut
- [ ] **ANM-ENV-002** [P0] Flare parachute descent & sway
- [ ] **ANM-ENV-003** [P0] Gas-gong swing, lamp sway & flicker
- [ ] **ANM-ENV-004** [P1] Dugout timbers shaking, dust falling (bombardment)
- [ ] **ANM-ENV-005** [P1] Gas-curtain blowing, groundsheet flapping, signs swinging
- [ ] **ANM-ENV-006** [P1] Duckboards tilting and sinking underfoot in deep mud
- [ ] **ANM-ENV-007** [P1] Tree collapse (shelled), ruin wall collapse

### 6.7 Cinematics
- [ ] **ANM-CIN-001** [P0] Zero-hour sequence: officer checks watch → whistle → ladders → over the top
- [ ] **ANM-CIN-002** [P1] Mine-detonation camera sequences (Lochnagar, Messines)
- [ ] **ANM-CIN-003** [P1] Mission intro / outro vignettes (letters read over trench scenes)
- [ ] **ANM-CIN-004** [P2] Memorial epilogue (present-day Vimy, Tyne Cot, Lochnagar)

---

## 7. AI

### 7.1 AI foundations
- [ ] **AI-CORE-001** [P0] **Navigation for trench networks:** navmesh with trench, ladder, parapet-vault and dugout-stair links; crater and mud cost layers; wire as an obstacle with a "cut" option
- [ ] **AI-CORE-002** [P0] **Perception:** sight (with light level, flares, fog, rain, smoke, gas-mask FOV), hearing (shots, footsteps on surfaces, digging, wire cutting), suppression awareness
- [ ] **AI-CORE-003** [P0] **Cover system:** fire-step positions, traverse corners, crater lips, ruins, pillbox embrasures; peek / fire / duck cycles
- [ ] **AI-CORE-004** [P0] Behaviour-tree / utility framework with shared blackboards per squad
- [ ] **AI-CORE-005** [P0] **Squad coordination:** formations for trench movement (single file), over-the-top lines / waves, leapfrogging, bombing parties
- [ ] **AI-CORE-006** [P0] **Commander AI** (per side): allocates squads to sectors, triggers attacks, counter-attacks and reinforcements, uses the barrage system
- [ ] **AI-CORE-007** [P0] Difficulty scaling (reaction time, accuracy, tactical depth) & bot fill for multiplayer
- [ ] **AI-CORE-008** [P1] Morale model shared with players (rally on officers, break under heavy shelling)
- [ ] **AI-CORE-009** [P1] Dialogue / bark system tied to AI state (callouts, orders)
- [ ] **AI-CORE-010** [P0] Debug visualisation (perception cones, cover scores, squad orders)

### 7.2 Infantry roles
- [ ] **AI-INF-001** [P0] **Rifleman:** man the fire-step, aimed fire, reload in cover, advance with the wave, take a crater, consolidate
- [ ] **AI-INF-002** [P0] **Officer / NCO:** issue orders, blow the whistle at zero hour, lead from the front, fire flares (SOS / lift barrage), call barrages via telephone, rally broken men
- [ ] **AI-INF-003** [P0] **Bomber:** clear trench bays with grenades around traverses, bombing-block defence, supply bomb carriers
- [ ] **AI-INF-004** [P0] **Lewis / LMG gunner:** suppress, displace after firing, cover the advance, set up in captured trenches
- [ ] **AI-INF-005** [P0] **Emplaced MG crew (Vickers / MG 08):** 2–3 man crew, fixed arcs, **enfilade fire** along wire gaps, belt feeding, jam drills, swapping a hot barrel / water, crew replacement on casualties
- [ ] **AI-INF-006** [P1] **Sniper:** use loopholes & OP trees, pick officers / MG crews, relocate after shots, counter-sniping
- [ ] **AI-INF-007** [P0] **Stretcher-bearers / medics:** find the wounded, bandage, carry in teams of 2–4 to the aid post, avoid shelled areas, carry under a Red Cross armband (no special immunity)
- [ ] **AI-INF-008** [P0] **Sentry:** watch via periscope, react to flares, raise the **gas alarm**, wake the stand-to
- [ ] **AI-INF-009** [P1] **Runner:** carry messages between HQ and front when phones fail; pathfind through communication trenches; replacement if killed
- [ ] **AI-INF-010** [P1] **Signaller / linesman:** follow cut telephone lines and repair them
- [ ] **AI-INF-011** [P1] **Wiring party:** night work in no man's land, freeze or drop at flares, flee under fire, repair gaps
- [ ] **AI-INF-012** [P1] **Patrol:** crawl into no man's land, listen, ambush enemy patrols, report back
- [ ] **AI-INF-013** [P1] **Raiders:** move under a box barrage, cut wire, enter the enemy trench, bomb dugouts, snatch a prisoner, withdraw on a signal
- [ ] **AI-INF-014** [P1] **Tunnellers / counter-miners:** dig, listen, detect enemy work, lay camouflets, defend galleries (Hill 60 mode)
- [ ] **AI-INF-015** [P1] **Carrying parties:** bring ammo, bombs, water and wire forward through communication trenches
- [ ] **AI-INF-016** [PH2] **Light trench-mortar team**: range on enemy MG posts, displace *(Phase 2 option PH2-A)*
- [ ] **AI-INF-017** [PH2] **German flamethrower team**: close on a trench under cover, burn bays, withdraw *(Phase 2 option PH2-A)*
- [ ] **AI-INF-018** [P1] **Stoßtruppen tactics** (German 1917): infiltration around strongpoints, bypass & isolate, heavy grenade use
- [ ] **AI-INF-019** [P1] **Pillbox garrison:** hold embrasures, sortie to counter-attack, surrender when outflanked
- [ ] **AI-INF-020** [P1] **Prisoners & surrender:** decide to surrender (isolated, outflanked, low morale), be escorted, never "fake" surrender exploits
- [ ] **AI-INF-021** [P1] **Wounded AI:** crawl to cover, call for a stretcher-bearer, self-bandage

### 7.3 Battlefield "director" AIs (systems that act like AI)
- [ ] **AI-ART-001** [P0] **Artillery director:** runs the preliminary bombardment, creeping barrage timing, harassing fire, retaliation to activity (fires on detected movement / MG positions after a delay), SOS barrages on flare / phone requests (§10.1)
- [ ] **AI-ART-002** [P1] **Counter-battery logic:** enemy barrage strength decreases if counter-battery objectives are met
- [ ] **AI-ART-003** [P1] Shell-type selection by target (shrapnel vs troops in the open, HE vs trenches, gas vs batteries / rear areas, smoke for cover)
- [ ] **AI-GAS-001** [P1] **Gas director:** scheduled / opportunistic gas shelling, cloud-release events when the wind is favourable
- [ ] **AI-EVT-001** [P0] **Event director:** mine detonations, counter-attack waves, reinforcement timing, pacing (quiet periods vs storms of fire)
- [ ] **AI-FLR-001** [P1] **Flare logic:** both sides' sentries fire flares on suspicious noise; frequency rises with alarm level

### 7.4 Ambient & creature AI
- [ ] **AI-AMB-001** [P1] **Trench-life ambient soldiers:** sleeping, cooking, letter writing, repairing (switch to combat on alarm)
- [ ] **AI-AMB-002** [P2] **Rats:** scurry along trench floors, flee light & noise, gather at dugout ration stores
- [ ] **AI-AMB-003** [P2] **Crows / larks:** flocks scatter at shellfire; larks sing at dawn on quiet maps
- [ ] **AI-AMB-004** [P2] Rear-area non-combat crowds (rehearsal ground drill squads)

### 7.5 AI per map / mode tuning
- [ ] **AI-MAP-001** [P0] La Boisselle (vertical slice) attack and defence plans
- [ ] **AI-MAP-002** [P1] Per-map commander plans for all P1 maps (sectors, MG positions, counter-attack routes)
- [ ] **AI-MAP-003** [P1] Raid-mode AI behaviours (night, stealth, flares)
- [ ] **AI-MAP-004** [P2] Tunnellers-mode AI

---

## 8. Interactive asset behaviours (state machines for assets)

| ID | Asset | States / behaviour | Pri |
|---|---|---|---|
| **INT-001** | Barbed wire | intact → snagging → cut (hand) → shell-gapped → flattened; noise on cut; marks on the map | P0 |
| **INT-002** | Screw / wooden picket | placed (silent / noisy) → knocked down | P1 |
| **INT-003** | Knife rest | carry → place → block → remove | P1 |
| **INT-004** | Sandbag parapet | intact → damaged → breached → rebuilt (consolidation) | P0 |
| **INT-005** | Trench bay | intact → partially collapsed → collapsed (buries occupants) → dug out | P1 |
| **INT-006** | Duckboard | intact → broken → sunk (in deep mud) | P1 |
| **INT-007** | Dugout entrance | open → gas curtain down → blocked by hit → cleared | P1 |
| **INT-008** | Ladder | placed → climbed → knocked down | P0 |
| **INT-009** | Sniper plate | shutter open / closed; hit sparks; penetrable by special rounds (P2) | P1 |
| **INT-010** | Periscope | use → view mode; hit by sniper (mirror shatter) | P1 |
| **INT-011** | Gas gong / rattle | strike → alarm propagation radius | P0 |
| **INT-012** | Field telephone & line | ring / call → barrage request; line cut by a shell → repair | P1 |
| **INT-013** | Very pistol / flare | fire colour → illumination + signal meaning (SOS, lift barrage, success) | P0 |
| **INT-014** | Ammo / bomb crate | full → partial → empty; resupply interaction | P0 |
| **INT-015** | Stretcher | pick up (2–4) → carry → set down at the aid post | P0 |
| **INT-016** | Brazier / lamp | lit → extinguished (light source & visibility) | P1 |
| **INT-017** | Mine charge | armed → detonated (scripted / triggered) → crater | P0 |
| **INT-018** | Crater | spawned → lip capture zone → water-filled over time (rain) | P0 |
| **INT-019** | Dud shell | inert hazard → can explode if hit again (P2) | P1 |
| **INT-020** | OP tree | enter → observe → spotted / destroyed | P2 |
| **INT-021** | Trench sign | readable (navigation aid, localised) | P1 |
| **INT-022** | Water-filled shell hole | wade → drown risk → rescue | P0 |
| **INT-023** | Mud patch | depth level → slow → stuck → freed | P0 |
| **INT-024** | Tree / ruin | damage states driven by shelling | P1 |
| **INT-025** | Gas curtain | open / closed (blocks gas into a dugout) | P1 |
| **INT-026** | Emplaced MG | mount → crewed → jammed → cleared → overheated / water low | P0 |

---

## 9. QA, historical review & release

- [ ] **QA-001** [P0] Test plan per system (§5) and per map (§3)
- [ ] **QA-002** [P0] **Historical accuracy review** of every asset against the README & the date-gating table (§11.4); log anachronisms as bugs (e.g. no MP40s, no Stahlhelm before 1916, no tanks at all in our scope)
- [ ] **QA-003** [P0] **Sensitivity review** (depiction of casualties, enemy, gas injuries, memorial content)
- [ ] **QA-004** [P0] Performance testing per map (worst case: mine detonation + barrage + gas + 64 players)
- [ ] **QA-005** [P0] Network stress tests (deformation, gas replication)
- [ ] **QA-006** [P1] Accessibility audit (colour-blind flare signals, photosensitivity, subtitles)
- [ ] **QA-007** [P1] Localisation QA (EN / FR / DE)
- [ ] **QA-008** [P1] Playtests: new-player onboarding, PvP balance, PvE difficulty
- [ ] **REL-001** [P1] Credits incl. **image & map attributions** (NLS CC-BY, IWM / AWM / LAC public domain) ⛓ PIPE-010
- [ ] **REL-002** [P1] Store page, trailer (no anachronisms!), press kit with historical notes
- [ ] **REL-003** [P1] Platform certification, age ratings
- [ ] **REL-004** [P2] Charity / remembrance tie-in (e.g. supporting a war-graves or memorial foundation)

---

## 10. Milestones

| Milestone | Contents | Key IDs |
|---|---|---|
| **M0: Pre-production** | Vision, scope sign-off, engine, pipeline, tools prototypes, art & audio bibles | PRE-*, PIPE-*, TOOL-001..006 |
| **M1: Vertical slice** | **La Boisselle (MAP-S02)** fully polished with the British & German factions; rifles, Lewis, Vickers, MG 08, grenades, melee; wire, mines, creeping barrage, gas, mud basics; core AI; Rehearsal Ground tutorial | all **P0** items |
| **M2: Alpha** | All P1 maps greyboxed; all factions; tunnels; night & flares; raids; runners & telephones; campaign structure | P1 systems, MAP-*-05 for every map |
| **M3: Beta** | All maps art-complete; full audio & VO; AI tuned per map; localisation; performance | MAP-*-16..24 |
| **M4: Release** | QA, historical & sensitivity sign-off, certification, launch | QA-*, REL-* |
| **M5: Phase 2** | **Phase 2 options:** PH2-A (light trench mortars & flamethrower) and PH2-B (French faction + French-sector map); plus P2 stretch: Tunnellers mode, Broodseinde, Vimy raids, memorial epilogue | PH2 + P2 items |

---

*Generated from the research in [README.md](README.md). Keep this list in sync when the README changes.*
