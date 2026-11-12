# They Fell: La Boisselle & Lochnagar, 1 July 1916 (demo)

A playable browser demo of **MAP-S02** from [TODO.md](../TODO.md): one open battlefield, **6 km × 6 km at true scale** (1 unit = 1 metre), built from the real ground. Pure JavaScript and WebGL2 with no build step, after the engine approach of [The Cimmerian](https://github.com/jrodimusprime/cimmerian): fixed-tick deterministic simulation, seeded RNG, an agent API, and headless-Chrome playthroughs as regression tests.

## Run it

```sh
node game/test/serve.mjs          # then open http://localhost:8642/
```

The game fetches its terrain, so it needs a local server (opening `index.html` from disk won't work). Any static server does the job.

| Key | Action |
|---|---|
| W A S D, mouse | Move and look |
| Shift | Run (uses stamina) |
| Space | Jump. Facing a wall up to head height (a trench wall with its sandbags, a crater lip), **climb out**, moving or standing still |
| E | Climb out, as Space does. On the lip of a trench, **jump across it** |
| C / Z | Crouch / prone (toggle) |
| Left mouse | Fire (bolt-action: about one aimed shot a second) |
| Right mouse | Aim down the sights |
| R | Reload (SMLE charger clips, 5 rounds at a time) |
| G | Throw a Mills bomb (3 per life, 4 s fuse) |
| M | Trench map of the whole 6 km map, with the play boundary |
| P | Pixel size: the game renders at a fraction of screen resolution and scales up with hard pixels (34 / 50 / 70 / 100 %) |
| F3 / K / Esc | Debug and performance line / sound on or off / pause |

URL flags: `?seed=N`, `?cheat` (no damage), `?at=x,z` (start at a world position in metres), `?lowres`, `?agent` (no menu; the sim only advances through `TF.step`, for tests).

## What happens

You start in the British front-line trench opposite the **Schwabenhöhe** at **07:26:30**, with the week-long bombardment in its last minutes. At **07:28** the **Lochnagar** and **Y Sap** mines go up: the ground under the German salient becomes the real crater. At **07:30** the whistles blow and the Tyneside battalions walk forward at the historical walking pace into German rifle and machine-gun fire. The German defenders shelter in their dugouts until the barrage lifts, then race to the fire-step.

- **Objectives** (frontlines style): A Schwabenhöhe (Lochnagar), B La Boisselle, C Sausage Redoubt, D Scots Redoubt, E Contalmaison. A side holding more men inside the circle pushes the capture bar. Captured objectives become spawn points.
- **Respawn is normal.** Death is frequent, as it was. You see your body fall (ragdoll), then redeploy about 3 s later at a trench or a taken objective. AI reinforcements come up in waves (British every 20 s, German every 28 s), so the line is always fed.
- **Out of bounds.** Leave the play area (150 m inside the map edge) and the screen says *Out of bounds: return to the battlefield*. The map edge itself (5 m) cannot be crossed. Beyond it, a coarse ring of land runs to the horizon so the world doesn't end in a cliff.

## The map: real ground, real scale

| Layer | Source | How |
|---|---|---|
| Terrain | IGN **RGE ALTI** (lidar-derived bare-earth DTM, 1 m source), Licence Ouverte 2.0 | `tools/terrain/fetch_dem.mjs` fetches Lambert-93 (EPSG:2154) tiles from the Géoplateforme WMS-R as float32 and resamples to a **2.5 m grid, 2401 × 2401 samples** (`data/dem.bin`, centimetres). World x = east, z = south, origin = Lambert-93 (675000, 6994000). |
| Lochnagar crater | In the lidar (it still exists, ~100 m across) | Before 07:28 the crater is filled from the surrounding ring of ground; after the mine fires the real crater is used. Y Sap was filled in after the war, so it is stamped analytically. |
| Trenches | The 1916 sector map *Ovillers & La Boisselle sector, 1 July 1916* (Wikimedia Commons, in `tools/terrain/ref/`) | Georeferenced to the IGN map by a least-squares affine fit on five villages (residuals ~70 m). `vectorize_trenches.mjs` traces the blue German network (thinning + tracing, ~44 km). Both front lines are hand-traced (`build_map.mjs`). |
| British support, reserve and communication trenches | Not on the source map | Generated: a support line 160 m behind the front, the Tara–Usna line 650 m behind, zig-zag communication trenches every ~320 m. |
| Fire bays, traverses, fire-step, parapet, parados | §2 of the README | Every fire trench is **crenellated** at load (8.5 m bays, 3.2 m traverses). The cut is 1.65 m deep with near-vertical sides and square corners. A 0.42 m parapet sits on the enemy side, with a 0.7 m fire-step below it, and a parados behind. |
| Revetment | §9.2 | Walls are built only where solid ground meets open trench, probed every 25 cm, so openings at traverses and junctions stay open and corners close. Each wall has a 0.9 m earth core, then a face of 2-inch boards (some British bays are sandbag walls instead; communication trenches can be corrugated iron; German trenches can be woven hurdles). Posts are 4 × 4 at 1.2 m, a 4 × 6 waling beam runs along the top, and every run ends in a corner post. Floors are trodden mud under duckboards on stringers. |
| Craters | Generated (seeded) | 85,000 shell holes, densest on the German front system and in no man's land. Shells landing during play add new ones, and the ground is rebuilt around them. |
| Wire, ruins, woods | Generated from the map | German wire belts 28 m out (deep, a few gaps) and British belts 20 m out. The villages are ruined houses with walls you can't walk through. Woods are shattered by degree. |
| Roads, villages, woods positions | IGN Plan / OSM Nominatim | Albert–Bapaume road, La Boisselle, Ovillers, Contalmaison, Pozières, Fricourt, Bécourt. |

Everything south of the 1916 sheet's lower edge (world z > 4355 m, towards Fricourt) is **approximate**: the front lines there are extended by hand.

## Rendering a 6 km open battlefield

Indoor engines (Quake, Cimmerian) use BSP trees and precomputed visibility (PVS) to skip hidden rooms. That doesn't help on an open battlefield, where almost everything is in view of almost everything else. This demo uses what open-world engines use instead:

1. **Quadtree terrain LOD (CDLOD-style).** 36 root tiles of 1000 m split down to 15.6 m tiles (0.49 m vertex spacing) near the camera. Each tile is a 32 × 32 grid, so detail falls off with distance: 0.5 m within ~25 m, 1 m to ~50 m, then 2, 4, 8 … 31 m. Skirts hide the cracks between levels. Tiles build nearest-first within a few milliseconds per frame, and an LRU cache keeps about 700 of them.
2. **Fog as the far clip.** Exponential haze (half-hidden at ~250 m, gone by ~650 m), plus ground mist that pools in the valleys. Nothing past 1.6 km is drawn. The depth range is tight (0.12 m to 1.6 km), so distant surfaces don't flicker.
3. **Frustum culling** of every tile (three.js does this per mesh).
4. **Instancing everywhere.** Each soldier part, sandbag, duckboard slat, picket, wall and tree type is a single draw call. 234 soldiers cost about 24 draw calls.
5. **Streaming of near detail.** Trench dressing (revetment, fire-step, duckboards, sandbags) is rebuilt within 150 m whenever you move 18 m, and wire within 350 m.
6. **One sun shadow map** that follows the player (140 m box), snapped to a 0.5 m grid so shadows don't shimmer. The scene renders at half resolution by default, scaled up with hard pixels. GPU particles (two draw calls for up to 11,500 particles) draw shell bursts across the whole front.

Typical numbers (headless Chrome, Metal, 1280 × 720): about 300 terrain tiles, 150–220 draw calls and 45–60 fps. F3 shows them live.

## Characters, ragdolls and the dead

Soldiers are instanced rigid-part humanoids with an 11-bone rig (`js/render/soldiers.js`). British: khaki service dress, 1908 webbing and the "fighting order" pack, puttees, the Brodie Mk I helmet, SMLE. German: field grey, 1909 leather equipment with cartridge pouches, the Stahlhelm M1916 (visor and neck guard), Gewehr 98. Poses are procedural: walk, run, crouch or kneel, prone, aim, port arms, climb.

On death each part becomes a **cannon-es** physics body, joined by cone-twist constraints with limits (`js/render/ragdoll.js`). Bullets push at the wound and shell blasts throw the whole body. The ground is a heightfield patch sampled from the real terrain under the body, so men slump into trenches and roll into shell holes. Settled bodies freeze and drop out of the physics world; up to 18 are simulated at once. A rifle falls from the hand. Deaths beyond 260 m skip physics and are laid on the ground. Corpses stay on the field (up to 260).

## AI testing (after Cimmerian §11)

- **Determinism:** a fixed 60 Hz tick, a seeded PRNG (one stream per soldier), no wall clock in the sim, and an FNV-1a state hash. Ragdolls, particles and sound are cosmetic and never feed back.
- **Agent API:** `window.TF.step({forward, side, yaw, pitch, run, jump, vault, crouch, prone, fire, ads, reload, grenade, respawn}, ticks)` returns an observation with the clock, the player, every soldier, objectives, score and the hash. Also `TF.obs()`, `TF.hash()` and `TF.perf()`, plus `TF.view = {pos, look}` for a free test camera.
- **Tests:** `game/test/run.sh` runs:
  - `collision_test.mjs` (Node): a man is driven at trench walls from 16 directions, at 120 places, walking and running with jump held. He must never pass through a wall, and his 0.3 m body must stay out of them.
  - `sim_test.mjs` (Node, no browser): 6 minutes of battle, twice with the same seed (identical hash) and once with another seed (a different hash), plus tick cost, mines, zero hour, men going over the top, and casualties and respawns on both sides.
  - `assault.js` in headless Chrome: after zero hour the agent makes for the nearest German soldier, fighting what it sees. It must kill 3 once it is in the German lines (in a German trench or within 40 m of one). When killed, it respawns and goes again.
  - `playthrough.js` in headless Chrome through `cdp.mjs`: a bot waits in the trench, goes over at zero hour, crosses no man's land to the Lochnagar lip while fighting, redeploys when killed, then walks off the west edge to check the out-of-bounds warning and the hard map edge. It prints PASS/FAIL and the final hash, and saves screenshots.

## Files

| File | Purpose |
|---|---|
| `js/world/terrain.js` | The ground: DEM, Lochnagar pre-blast fill, crenellation, the trench cut, craters, raycast. Shared by sim and renderer |
| `js/world/features.js` | Wire belts, ruined houses (collision walls), woods |
| `js/sim/sim.js` | The deterministic simulation: soldiers, movement and climbing, rifles and MG 08s, AI, artillery director, mines, zero hour, objectives, respawns, hash, observation |
| `js/render/terrainView.js` | Quadtree LOD terrain, the ground map (chalk, churned earth, roads, woods), the ground shader |
| `js/render/props.js` | Instanced trench dressing, wire, ruins, trees |
| `js/render/soldiers.js`, `ragdoll.js` | Instanced soldiers and poses; cannon-es ragdolls |
| `js/render/fx.js`, `js/audio.js` | GPU particles and the sky; synthesised sound (sound travels at 343 m/s) |
| `js/main.js` | Boot, loop, input, camera, view-model, HUD, map, agent API |
| `data/` | `dem.bin` / `dem.json` (terrain), `map_laboisselle.json` (every trench, road, village, mine, objective, spawn) |
| `vendor/` | three.js r170 (MIT), cannon-es 0.20 (MIT) |
| `fonts/` | Libre Caslon Text and Display (SIL OFL, `fonts/OFL.txt`). Caslon was the standard British book and government typeface of 1916 |
| `../tools/terrain/` | The pipeline that made `data/` (fetch, georeference, vectorise, build) |

## Not done yet

- **Downloaded models:** 46 open-licence models (CC0 and CC-BY 3.0) are in `models/`; sources, licences and attribution text are in `models/CREDITS.md`.
- **In use so far:** only the first-person rifle (`weapons/lee_enfield.glb`, CC0), with the built-in rifle as a fallback.
- **Not yet wired in:** the skinned soldiers (`characters/soldier_british.glb`, `soldier_german.glb`, a shared 66-joint skeleton with 62 clips including rough two-handed rifle clips) would replace the near soldiers. Their ragdoll would map onto the joints listed in CREDITS.md. The props, gear and grenades would replace the procedural ones.
- **Still to build:** there are no open-licence Brodie Mk I helmet, true M1916 Stahlhelm, 1908 webbing, Vickers, Lewis or sled-mounted MG 08 models, so those must be made in-house.
- No Lewis gun, Vickers, or player-usable MG yet. No gas, flares, night, or dugout interiors. Grenades are simple.
- Shells deform the ground but not the trenches (no parapet breaches).
- The AI walks straight at objectives with no navmesh. It climbs out of and into trenches but doesn't fight along them bay by bay.
