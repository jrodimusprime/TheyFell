# 3D model credits

All files are binary glTF (`.glb`). They use **Y up**, metres, and **+Z forward** for characters. Every file is CC0 or CC-BY 3.0. Files under CC-BY 3.0 need the attribution shown below in the game credits. CC-BY 3.0 legal code: https://creativecommons.org/licenses/by/3.0/. CC0 1.0 legal code: https://creativecommons.org/publicdomain/zero/1.0/.

## Characters (`characters/`)

All three characters share **one skeleton**: the same 66 joint names and hierarchy, and the same rest-pose orientations. Joint lengths differ, and so do the clips' pelvis translations. Any clip can therefore be played on any of the three characters, and one ragdoll mapping covers all of them.

| File | What it is | Tris | Size | Height | Source / author | Licence |
|---|---|---|---|---|---|---|
| `characters/mannequin.glb` | Quaternius UAL mannequin with 62 clips. It has two materials, `M_Main` and `M_Joints`, so you can tint it khaki or field grey. | 13,743 | 4.3 MB | 1.829 m | Mesh, rig and 50 clips: Quaternius, *Universal Animation Library* and *Universal Animation Library 2*, at https://opengameart.org/content/universal-animation-library and https://opengameart.org/content/universal-animation-library-2 (also https://quaternius.com). The 12 `Rifle_*` clips and the `rifle` bone were authored for this project on that rig. | CC0 1.0 |
| `characters/soldier_german.glb` | German infantryman: field-grey tunic, black jackboots, and a separate `Helmet` mesh (an M35-style Stahlhelm, standing in for the M1916). | 5,073 | 4.0 MB | 1.801 m (with helmet) | Mesh and texture: "Rigged Lowpoly WW2 Soldier" by **nisu**, https://opengameart.org/content/rigged-lowpoly-ww2-soldier. Skeleton and clips: Quaternius UAL (above). | CC0 1.0 |
| `characters/soldier_british.glb` | The same body recoloured as a British Tommy: khaki service dress, khaki-drab lower legs (puttee look), pale 1908 webbing, brass buttons. It has **no helmet**; build the Brodie and attach it to `Head`. | 4,827 | 4.0 MB | 1.778 m (bare head) | Same as above. | CC0 1.0 |

Changes made to the soldiers:
- **Rig.** The original Mixamo-style skeleton was replaced. The Quaternius UAL2 skeleton was fitted to the soldier's joint positions, keeping UAL2's bone orientations. The source's skin weights were then remapped onto it by bone name.
- **Texture.** The source's black uniform and red armband were recoloured, to field grey (German) and khaki (British).
- **Size.** Textures are 1024² JPEG.

Licence note: the source FBX's bone names follow the Mixamo auto-rigger convention. The uploader's skin weights were probably generated with that tool. The mesh, texture and rig were all published by their author as CC0, and no Mixamo stock character or animation is used. If you want zero Mixamo provenance, use `mannequin.glb`, which is Quaternius throughout.

### Orientation and scale (all three characters)
- **Axes:** Y up, character faces **+Z**, character's left is **+X**. Units are metres.
- **Feet:** at y = 0.
- **Root node:** `Armature`, with an identity transform.
- **Skin:** one skin, 66 joints.

### Joints (66; parent in brackets)
```
root
  pelvis (root)
    spine_01 (pelvis) > spine_02 > spine_03
      neck_01 (spine_03) > Head
      clavicle_l (spine_03) > upperarm_l > lowerarm_l > hand_l
        hand_l > index_01_l > index_02_l > index_03_l > index_04_leaf_l
        hand_l > middle_01_l > middle_02_l > middle_03_l > middle_04_leaf_l
        hand_l > ring_01_l > ring_02_l > ring_03_l > ring_04_leaf_l
        hand_l > pinky_01_l > pinky_02_l > pinky_03_l > pinky_04_leaf_l
        hand_l > thumb_01_l > thumb_02_l > thumb_03_l > thumb_04_leaf_l
      clavicle_r (spine_03) > upperarm_r > lowerarm_r > hand_r   (same finger chains with _r)
      rifle (spine_03)            <- non-deforming weapon bone (see below)
    thigh_l (pelvis) > calf_l > foot_l > ball_l > ball_leaf_l
    thigh_r (pelvis) > calf_r > foot_r > ball_r > ball_leaf_r
```

Suggested ragdoll bodies:

| Body | Joint(s) |
|---|---|
| Pelvis / hips | `pelvis` |
| Lower torso | `spine_01` |
| Chest | `spine_03` (fold `spine_02` into it) |
| Head | `Head` (`neck_01` optional) |
| Upper arm / forearm / hand | `upperarm_*` / `lowerarm_*` / `hand_*` |
| Thigh / shin / foot | `thigh_*` / `calf_*` / `foot_*` |

Rest positions (mannequin / soldiers):

| Joint | Mannequin | Soldiers |
|---|---|---|
| `pelvis` | y 0.917 | y 1.021 |
| `Head` | y 1.569 | y 1.591 |
| `hand_r` | x −0.739 | x −0.691 |
| `foot_l` | y 0.104 | y 0.070 |

The rest pose is a T-pose.

### Weapon bone and mount
- **`rifle` bone.** It is a child of `spine_03` and has no skin weights.
  - In the 12 `Rifle_*` clips it carries the weapon: the arms were IK-baked so the hands sit on it.
  - In every other clip it stays at its rest pose, which is **slung on the back**: butt behind the right hip, muzzle up past the right shoulder. Non-rifle clips such as throwing, climbing and dying therefore show a slung rifle with no extra work.
- **`RifleMount` node.** It is a child of `rifle`, sitting at the butt plate. Its local frame is:
  - origin: on the **bore axis at the butt plate**
  - **+Z**: toward the muzzle
  - **+Y**: top of the rifle (sights)
  - **+X**: the rifle's left side
- **Attaching a rifle.** Add the model as a child of `RifleMount` with no rotation, and set its position so that its butt plate and bore line land on the origin:
  - `weapons/lee_enfield.glb`: position `(-0.005, -0.069, 0.565)`
  - `weapons/kar98k.glb`: position `(-0.042, -0.053, 0.555)`. Hide its `Clip` and `Bullet1`–`Bullet5` nodes.
- **Helmet.** `gear/stahlhelm.glb` is authored relative to the soldier's `Head` joint. Add it as a child of the `Head` bone with an identity transform.

### Animation clips (62; identical names and lengths in all three files; 24 fps source, sampled on export)

**Rifle clips** (authored for this project, CC0). The hands are IK-locked to the `rifle` bone.

| Clip | Length | Description |
|---|---|---|
| `Rifle_Idle` | 2.500 s | port arms / low ready, loop |
| `Rifle_Aim` | 2.500 s | shouldered aim, loop |
| `Rifle_Shoot` | 0.583 s | aim, recoil, settle |
| `Rifle_Reload` | 3.000 s | dismount, bolt open, charger push, bolt close, remount |
| `Rifle_Walk` | 1.333 s | walking at low ready |
| `Rifle_Walk_Aim` | 1.333 s | walking while aiming |
| `Rifle_Run` | 0.917 s | jogging at low ready |
| `Rifle_Charge` | 0.667 s | sprinting with the bayonet levelled at hip/chest |
| `Rifle_Crouch_Idle` | 2.917 s | crouched, low ready |
| `Rifle_Crouch_Aim` | 2.917 s | crouched, aiming |
| `Rifle_Crouch_Walk` | 2.000 s | crouch walk, low ready |
| `Rifle_Kneel_Aim` | 1.000 s | static kneeling aim |
| `Rifle_Bayonet_Thrust` | 1.000 s | bayonet thrust |

**Quaternius UAL clips** (CC0):

| Group | Clips |
|---|---|
| Idle | `Idle_Loop` 2.500 s, `Idle_Talking_Loop` 2.917, `Idle_FoldArms_Loop` 2.500, `Idle_No_Loop` 2.500, `Idle_Rail_Loop` 2.500 (leaning on a rail: use it for the parapet), `Idle_Rail_Call` 2.500, `Yes` 2.500, `A_TPose` 2.500 |
| Locomotion | `Walk_Loop` 1.333, `Walk_Formal_Loop` 1.333, `Walk_Carry_Loop` 2.000, `Jog_Fwd_Loop` 0.917, `Sprint_Loop` 0.667, `Crouch_Idle_Loop` 2.917, `Crouch_Fwd_Loop` 2.000, `Zombie_Walk_Fwd_Loop` 1.333 (usable as a wounded stagger) |
| Hit / death | `Hit_Chest` 0.333, `Hit_Head` 0.417, `Hit_Knockback` 0.833, `Death01` 2.375, `LayToIdle` 1.500 (getting up) |
| Traversal | `ClimbUp_1m_RM` 0.667 (root motion; climbing out of the trench), `Slide_Start` 0.833, `Slide_Loop` 2.000, `Slide_Exit` 0.500, `Roll` 1.458, `Jump_Start` 1.333, `Jump_Loop` 2.500, `Jump_Land` 1.250 |
| Actions | `OverhandThrow` 1.333 (grenade), `Interact` 2.000, `PickUp_Table` 0.833, `Fixing_Kneeling` 5.167 (kneeling work: wire cutting, first aid), `Consume` 1.333 (drinking), `Push_Loop` 2.667, `Sitting_Enter` 1.292, `Sitting_Idle_Loop` 1.667, `Sitting_Exit` 1.000 |
| Melee | `Melee_Hook` 0.458, `Punch_Enter` 0.833, `Punch_Jab` 0.833, `Punch_Cross` 1.000, `Sword_Attack` 1.500 |
| Pistol (officer) | `Pistol_Idle_Loop` 1.667, `Pistol_Aim_Neutral` 0.167, `Pistol_Aim_Up` 0.167, `Pistol_Aim_Down` 0.167, `Pistol_Shoot` 0.625, `Pistol_Reload` 1.667 |

## Weapons (`weapons/`)

On weapons the muzzle or blade tip points **+Z**, and each model is centred on its bounding box.

| File | What it is | Tris | Source | Author | Licence |
|---|---|---|---|---|---|
| `lee_enfield.glb` | Lee-Enfield, visually a No.4 (stand-in for SMLE Mk III), 1.13 m | 5,268 | https://opengameart.org/content/bolt-action-rifle-lee-enfield | Lucian Pavel | CC0 |
| `kar98k.glb` | Kar98k (stand-in for Gewehr 98), 1.11 m; nodes Body/Bolt/Trigger/Clip/Bullet1–5 | 1,108 | https://poly.pizza/m/ntijptIGIw | AdamKokrito | CC-BY 3.0 |
| `mg08_15.glb` | MG 08/15 light MG (1917; slightly anachronistic), flat colours | 967 | https://opengameart.org/content/ww1-mg0515-portable-lp | aaronw | CC0 |
| `bayonet.glb` | generic knife bayonet, 0.45 m | 240 | https://poly.pizza/m/D81P2smzCy | Quaternius | CC0 |
| `grenade_mills.glb` | pineapple frag grenade (stand-in for the Mills bomb) | 734 | https://poly.pizza/m/YWhHlmKOtx | CreativeTrio | CC0 |
| `stielhandgranate.glb` | German stick grenade; textures removed (they came from Textures.com), flat colours | 1,200 | https://opengameart.org/content/stielhandgranate | elmerenges | CC0 |

## Gear (`gear/`)

| File | What it is | Tris | Source | Author | Licence |
|---|---|---|---|---|---|
| `stahlhelm.glb` | M35-style Stahlhelm (stand-in for the M1916), flat field grey. Origin is at the soldier's `Head` joint. | 246 | extracted from https://opengameart.org/content/rigged-lowpoly-ww2-soldier | nisu | CC0 |
| `backpack.glb` | olive canvas rucksack (generic stand-in) | 1,748 | https://poly.pizza/m/2g9Jm7kvIU | Quaternius | CC0 |
| `entrenching_tool.glb` | small shovel | 322 | https://poly.pizza/m/oNBQSf87ZJ | Quaternius | CC0 |
| `gas_mask.glb` | respirator with hose and filter | 2,210 | https://poly.pizza/m/7dNxPcg8HyL | Marisha | CC-BY 3.0 |

## Props (`props/`)

| File | What it is | Tris | Source | Author | Licence |
|---|---|---|---|---|---|
| `sandbag.glb` | single sandbag | 48 | https://opengameart.org/content/simple-sandbags | JamesWhite | CC0 |
| `sandbags_small.glb` | sandbag wall section | 1,800 | https://poly.pizza/m/iHyRewQQcN | Quaternius | CC0 |
| `sandbags_wall.glb` | taller sandbag wall | 3,000 | https://poly.pizza/m/LW3jwpPfiN | Quaternius | CC0 |
| `sandbag_pile.glb` | sandbag pile | 1,061 | https://poly.pizza/m/5JCK_lpTf4F | Jeremy Eyring | CC-BY 3.0 |
| `barbed_wire_coil.glb` | concertina coil (alpha-mask texture) | 5,360 | https://opengameart.org/content/barbed-wire | JamesWhite | CC0 |
| `barbed_wire_strand.glb` | single strand | 896 | https://opengameart.org/content/barbed-wire | JamesWhite | CC0 |
| `crate_weathered.glb` | weathered crate | 156 | https://opengameart.org/content/cc0-crates-wooden-pallet | Lucian Pavel | CC0 |
| `crate_long.glb` | long crate | 216 | https://opengameart.org/content/cc0-crates-wooden-pallet | Lucian Pavel | CC0 |
| `crate_lidded.glb` | lidded crate (base + lid meshes) | 218 | https://opengameart.org/content/cc0-crates-wooden-pallet | Lucian Pavel | CC0 |
| `pallet_weathered.glb` | pallet (duckboard stand-in) | 180 | https://opengameart.org/content/cc0-crates-wooden-pallet | Lucian Pavel | CC0 |
| `ammo_box.glb` | wooden ammo box | 2,256 | https://poly.pizza/m/4QQwW16WZZT | Carwyn Pelley | CC-BY 3.0 |
| `crate.glb` | stylised crate | 784 | https://poly.pizza/m/3VGWnZPXmG | Quaternius | CC0 |
| `pallet.glb` | pallet (duckboard stand-in) | 240 | https://poly.pizza/m/MwOFAOgOhg | Quaternius | CC0 |
| `pallet_broken.glb` | broken pallet | 258 | https://poly.pizza/m/Gp43iUyyAX | Quaternius | CC0 |
| `planks.glb` | plank stack | 150 | https://poly.pizza/m/hwQ1Fx5P8U | Quaternius | CC0 |
| `planks_scattered.glb` | scattered planks | 312 | https://poly.pizza/m/GFiJOVIPd9 | MiniPoly | CC-BY 3.0 |
| `ladder.glb` | wooden ladder, 2 m | 260 | https://poly.pizza/m/xojOfYdtYB | CircuitZ | CC0 |
| `fence_fortified.glb` | plank wall / revetment | 276 | https://poly.pizza/m/9FQPNr0sdJ | Kenney | CC0 |
| `barricade.glb` | cross-planked barricade | 122 | https://poly.pizza/m/3UZHUnkzTu | Kenney | CC0 |
| `log.glb` | log | 202 | https://poly.pizza/m/L4E32Wee6C | Quaternius | CC0 |
| `dead_tree_a.glb` | shattered trunk | 216 | https://poly.pizza/m/68VK0NzgEZ | Kay Lousberg | CC0 |
| `dead_tree_b.glb` | shattered trunk | 256 | https://poly.pizza/m/k80NkrvY2f | Kay Lousberg | CC0 |
| `dead_tree_c.glb` | shattered trunk | 184 | https://poly.pizza/m/3WKb5NPVVl | Kay Lousberg | CC0 |
| `shattered_trunk.glb` | large shattered trunk | 234 | https://poly.pizza/m/HdJ7JoEvKR | Zsky | CC-BY 3.0 |
| `dead_tree_branchy.glb` | dead tree with branches (decimated) | 2,200 | https://poly.pizza/m/Mcd2zYqyww | Quaternius | CC0 |
| `dead_pine.glb` | dead pine (decimated) | 1,999 | https://poly.pizza/m/oM95bD8buf | Quaternius | CC0 |
| `stump.glb` | tree stump | 344 | https://poly.pizza/m/esFOngb0uwl | Poly by Google | CC-BY 3.0 |
| `stump_broken.glb` | broken stump | 700 | https://poly.pizza/m/2ohXf_yaPki | Jarlan Perez | CC-BY 3.0 |
| `rock_a.glb` | rock | 162 | https://poly.pizza/m/4MUaQTcDdc | Quaternius | CC0 |
| `rocks_small.glb` | small rocks | 84 | https://poly.pizza/m/OQvi8PIZ40 | Quaternius | CC0 |
| `rocks_flat.glb` | flat rocks | 36 | https://poly.pizza/m/kTrLxUBgxU | Kay Lousberg | CC0 |
| `rubble.glb` | rubble | 152 | https://poly.pizza/m/8mnEv3ilxEP | Kyle Hickman | CC-BY 3.0 |
| `debris_pile.glb` | planks and corrugated sheet | 424 | https://poly.pizza/m/WrIiMMxyEP | Quaternius | CC0 |

## Attribution text for the game credits (CC-BY 3.0 items)

Kar98k model by AdamKokrito · gas mask by Marisha · sandbag pile by Jeremy Eyring · ammo box by Carwyn Pelley · scattered planks by MiniPoly · shattered tree by Zsky · tree stump by Poly by Google · broken stump by Jarlan Perez · rubble by Kyle Hickman. All are via poly.pizza (model pages linked in the tables above) and licensed CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Models were converted to glTF, and some were decimated or recoloured.

## Faces (`faces/`)

Photographs projected onto the soldiers' heads. Both are Australian War Memorial studio portraits, public domain (photographs taken before 1955; AWM marks them "no known copyright restrictions").

| File | Source | Licence |
|---|---|---|
| `faces/arnold.png` | "Studio portrait of 571 Private (Pte) Walter Russell Arnold, C Company, 31st Battalion, of Glen Waverley, Victoria, aged 18", AWM DA11297, via Wikimedia Commons | Public domain |
| `faces/law.png` | "Studio portrait of 1723 Private (Pte) Frank Law, 2nd Reinforcements, 21st Battalion, of Glen Waverley, Victoria, circa June 1915", AWM DA09534, via Wikimedia Commons | Public domain |
| `faces/mark.png` | "Soldier T. E. Mark, 1917", State Library of Queensland (negative 199507), via Wikimedia Commons; newspaper halftone smoothed | Public domain |
