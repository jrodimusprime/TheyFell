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


✓ respawning and resupply should come from deeper behind enemy lines - the germans will walk towards different trenches or open defence areas near targets... take your time doing this tactic. thinking through options as the current path of using the spawning areas is just bad... better they come from behind enemy lines and walk so you dont get 100 dudes spawning at one point... then push to master. germans will also need to move to take back regions at times to get back into their defensive trenches there or in open defensive zones. ensure germans can never overlap each other - their bounding boxes steop them.

✓ when you zoom in it should make pixels relative to the zoom so things are lsightly clearer if that makes sense. — done 13 Nov 2026: aiming, the pixel density rises with the zoom (x1.56 at full aim), back down when you lower the rifle


inside trenches walking past people is a bit weird you can push other players out of the way etc... make sure that is smoother if someone has a walking vector towards an AI player of the same team they kind of move aside in a trench - you may need to do some animation and spend time making that look correct.

✓ once you have taken all posts A B C D E it is game over and a stats age is displayed, asks you if oyu want to start again — done 13 Nov 2026: holding A to D at once is a British victory (no British left to send, a German one); the end card says who won and why, both sides in numbers, kills by cause, your own war, the objectives as they fell; begin again or keep watching

gennades should bounce nicely up a trench and around corners push that to master

the map looks crap in terms of quality (when you press M that map) - the directional one. take some time making that nicer. also the bottom round map should say A B C D E in the centre of the circle of the zone 

walking in trenches can make the player pop up randomly on planks etc, so lets make the walking area on the trenches just the trench floor, if they want to pop up on a standing bench whatever its called lets offer a new keyboard letter maybe T to get into trench aiming mode for defence. this will be handy later when we need to do a defensive mission

dudes look like they are half in the wall inside trenches need to make sure their bodies are in bounding boxes vs walls


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
- **Artillery as an off-map, AI-driven system only**: barrages, creeping barrages, counter-battery fire and shell effects. Players can **request** barrages (flare) but **cannot operate** guns.
- Mines, gas, wire, mud, weather, night, flares, raids, tunnelling.
- Factions: British (incl. Highland & Newfoundland), Australian, New Zealand, Canadian, German.
- **Maps are large open battlefields at true scale** (1 game unit = 1 m), built from real elevation data and georeferenced trench maps, not arena-sized sets. MAP-S02 is one 6 km × 6 km map. Distance is handled by terrain LOD, fog and culling, not by shrinking the ground (decided 12 Nov 2026).
- **Mobile is self-playing:** on phones and tablets the game plays itself. The AI controls the player through the same agent API the tests use (as in Cimmerian's "Let the AI play this level"), and the viewer watches the battle unfold with touch only for the camera, pausing and skipping. There are no on-screen twin-stick controls (decided 12 Nov 2026).


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



### 5.2 Combat

- [ ] **SYS-CMB-009** [P0] **Melee:** bayonet thrust / charge, butt-stroke, club & knife, shove; trench-width constraints
- [ ] **SYS-CMB-010** [P0] **Damage & injury model:** hit locations, bleeding, incapacitation (downed, can be bandaged or carried), death
- [ ] **SYS-CMB-011** [P0] **Suppression:** near-miss & shell-burst effects on aim, vision and movement
- [ ] **SYS-CMB-012** [P1] Concussion / blast knockback, temporary deafness (tinnitus audio filter)
- [ ] **SYS-CMB-013** [PH2] Flamethrower (German): fuel, range, burning, panic effects *(Phase 2 option PH2-A)*
- [ ] **SYS-CMB-014** [PH2] Light trench mortar (crew-served: loader + layer, range table, bombs as resource) *(Phase 2 option PH2-A)*
- [ ] **SYS-CMB-015** [P0] Friendly fire rules & penalties

### 5.3 Battlefield systems (§9–10)
- [ ] **SYS-WIRE-001** [P0] **Wire:** blocks & slows movement, snags (stuck state), damages, cut by hand (timed, noisy), by shells (gaps), marking gaps (tape)
- [ ] **SYS-WIRE-002** [P1] **Wiring party:** players / AI can lay new wire (screw pickets = silent, wooden = noisy mallet)
- [ ] **SYS-WIRE-003** [P1] Portable knife rests to block trenches & gaps
- [ ] **SYS-ART-001** [P0] **Off-map artillery system:** shell types, calibres, dispersion, flight time, impact damage & terrain deformation
- [ ] **SYS-ART-002** [P0] **Preliminary bombardment** phase (map-scripted)
- [ ] **SYS-ART-003** [P0] **Creeping barrage:** timed lifts from barrage-map data; friendly-fire risk if players run ahead (⛓ TOOL-009)
- [ ] **SYS-ART-004** [P1] **Box barrage** (for raids)
- [ ] **SYS-ART-005** [P1] **SOS barrage on request:** officer fires a flare → delayed barrage on pre-registered target zones
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

- [ ] **SYS-WTH-003** [P1] Visibility modifiers from weather (AI perception too)
- [ ] **SYS-MED-001** [P0] **Medical:** bandage self/ally, stretcher-bearers (carry with 2+ players or AI), aid post healing, evacuation scoring
- [ ] **SYS-MED-002** [P1] Trench foot / exposure (long-match status effect, P2 for multiplayer)
- [ ] **SYS-LOG-001** [P0] **Resupply:** ammo & grenade crates, carry parties, limited bombs per squad
- [ ] **SYS-LOG-002** [P1] Rations & water (long modes / campaign)
- [ ] **SYS-COM-001** [P1] **Runners:** physically carry messages (orders / barrage requests) when phones are down
- [ ] **SYS-OBS-002** [P1] Spotting / marking system (limited, historically plausible: no "magic radar")
- [ ] **SYS-SNP-001** [P1] Sniper loopholes (shuttered), sniper hide positions
- [ ] **SYS-CON-002** [P1] Digging: shell-scrapes, connecting craters into a line, filling sandbags

---


### 6.3 Actions & interactions
- [ ] **ANM-ACT-001** [P0] **Put on / take off gas mask** (PH helmet & small box respirator; German mask): fast, under stress, fumbling variant

---

