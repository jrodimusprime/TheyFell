"""Expand [[IMG ...]] and [[ROW ...]] tags in README.tmpl.md into Wikimedia Commons image HTML."""
import hashlib, re, sys
from urllib.parse import quote

# Originals wider than 1280 px: serve the 1280 px thumbnail instead of the multi-MB original.
BIG = {
    "Map_of_the_Somme_Front_(GSGS_3317)_Fall_of_1916.jpg", "Morning_a_Passchendaele._Frank_Hurley.jpg",
    "Canadian_Pioneers_laying_tape.jpg", "Vickers_machine_gun_in_the_Battle_of_Passchendaele_-_September_1917.jpg",
    "Second_Battle_of_Passchendaele_-_Field_of_Mud.jpg", "Second_Battle_of_Passchendaele_-_First_Stage_(October_26)_Barrage_Map.jpg",
    "QF18pdrMkIIHydropneumaticRecuperatorIWM3April2008.jpg", "AIF_Slouch_hat_SLNSW_FL1517275.jpg",
    "Lee-Enfield_Mk_III_(No_1_Mk_3)_-_AM.032056.jpg", "Reproduction_of_captured_German_trench_map_(20_Sept_1917).jpg",
    "A_Mark_IV_(Male)_tank_of_'H'_Battalion,_'Hyacinth',_ditched_in_a_German_trench_while_supporting_1st_Battalion,_Leicestershire_Regiment_near_Ribecourt_during_the_Battle_of_Cambrai,_20_November_1917._Q6432.jpg",
    "Bundesarchiv_Bild_183-R05148,_Westfront,_deutscher_Soldat_(higher_res).jpg",
    "Sopwith_Camel_at_the_Imperial_War_Museum.jpg",
    "The_British_Army_on_the_Western_Front,_1914-1918_Q8436.jpg", "Chateau_Wood_Ypres_1917.jpg",
    "1st_Division_laying_duckboards_over_the_muddy_ground_in_Passchendaele_(AWM_E00837).jpg",
    "German_trench_Delville_Wood_September_1916.jpg", "Periscope_tranchée_française.jpg",
    "A_German_observer_jumping_from_his_observation_balloon,_1917-1918_(49797430512).png",
    "Crudely_shaped_trench_club_from_World_War_One_-_YORCM1960_145_8.JPG",
    "A_team_of_stretcher_bearers_struggle_through_deep_mud_to_carry_a_wounded_man_to_safety_near_Boesinghe_on_1_August_1917_during_the_Third_Battle_of_Ypres._Q5935.jpg",
    "A._Y._Jackson_-_Gas_Attack,_Lievin.jpeg", "Daily_Mail_Postcard_-_An_attack_-_A_wiring_party_going_forward.jpg",
}
SAFE = "()_-.'"
used = []


def urls(name):
    name = name.strip().replace(" ", "_")
    name = name[0].upper() + name[1:]
    h = hashlib.md5(name.encode("utf-8")).hexdigest()
    q = quote(name, safe=SAFE)
    base = "https://upload.wikimedia.org/wikipedia/commons"
    if name.endswith(".svg"):
        src = f"{base}/thumb/{h[0]}/{h[:2]}/{q}/1280px-{q}.png"
    elif name in BIG:
        src = f"{base}/thumb/{h[0]}/{h[:2]}/{q}/1280px-{q}"
    else:
        src = f"{base}/{h[0]}/{h[:2]}/{q}"
    page = f"https://commons.wikimedia.org/wiki/File:{q}"
    used.append((name, src, page))
    return src, page


def esc(s):
    return s.replace('"', "&quot;")


def img_tag(name, cap, width):
    src, page = urls(name)
    alt = re.sub(r"[*_\"]", "", cap)[:140]
    return (f'<p align="center"><img src="{src}" alt="{esc(alt)}" width="{width}"><br>'
            f'<sub>{md_inline(cap)} · <a href="{page}">Wikimedia Commons</a></sub></p>')


def md_inline(s):
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"\*(.+?)\*", r"<i>\1</i>", s)
    return s.strip()


def row_tag(cells):
    tds = []
    for cell in cells:
        name, cap = [c.strip() for c in cell.split("|", 1)]
        src, page = urls(name)
        alt = re.sub(r"[*_\"]", "", cap)[:140]
        tds.append(f'<td width="50%" align="center" valign="top"><img src="{src}" alt="{esc(alt)}" width="100%"><br>'
                   f'<sub>{md_inline(cap)} · <a href="{page}">Commons</a></sub></td>')
    return "<table>\n<tr>\n" + "\n".join(tds) + "\n</tr>\n</table>"


src = open("tools/README.tmpl.md", encoding="utf-8").read()


def sub(m):
    kind, body = m.group(1), m.group(2)
    if kind == "IMG":
        parts = [p.strip() for p in body.split("|")]
        return img_tag(parts[0], parts[1], parts[2] if len(parts) > 2 else 720)
    return row_tag([c for c in body.split(";;")])


out = re.sub(r"\[\[(IMG|ROW) (.+?)\]\]", sub, src, flags=re.S)
assert "[[" not in out, "unexpanded tag"
open("README.md", "w", encoding="utf-8").write(out)
open("tools/image_manifest.tsv", "w", encoding="utf-8").write("\n".join("\t".join(u) for u in used) + "\n")
print(len(used), "images")
