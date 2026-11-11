"""Generate an original isometric 3D cutaway of a single fire bay (SVG)."""
import math, random
random.seed(3)
C30, S30 = math.cos(math.radians(30)), math.sin(math.radians(30))
S = 6.0                 # px per decimetre
OX, OY = 360, 340
L = 70                  # length of the bay along the trench (dm)


def P(x, y, z):
    # x along the trench (to the right-down), y towards the enemy (right-up), z up
    return OX + (x + y) * C30 * S, OY + (x - y) * S30 * S - z * S


def pts(seq):
    return " ".join(f"{a:.1f},{b:.1f}" for a, b in seq)


def poly(p3, **kw):
    a = " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in kw.items())
    return f'<polygon points="{pts([P(*p) for p in p3])}" {a}/>'


def line(p, q, **kw):
    a = " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in kw.items())
    (x1, y1), (x2, y2) = P(*p), P(*q)
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" {a}/>'


# Cross-section profile in (y, z), decimetres. y=0 is the rear wall, enemy is +y.
FLOOR, STEP, TOP = -18, -10, 5
profile = [
    (-34, 0), (-24, 0), (-18, TOP), (-6, TOP), (-3, 1), (0, 0),      # parados
    (0, FLOOR), (10, FLOOR),                                         # rear wall + floor
    (10, STEP), (16, STEP),                                          # fire-step
    (16, 0), (17, TOP), (30, TOP), (38, 0), (60, 0),                 # front wall + parapet
]
GROUND_BOTTOM = -25

out = []
W, H = 1400, 920
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">')
out.append('''<defs>
<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6a45"/><stop offset="1" stop-color="#b9a582"/></linearGradient>
<marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#b03a2e"/></marker>
</defs>''')
out.append(f'<rect width="{W}" height="{H}" fill="#f4f1ea"/>')
out.append('<text x="30" y="44" font-size="26" font-weight="bold" fill="#2b2b2b">Inside a fire bay: front-line trench cross-section (3D)</text>')
out.append('<text x="30" y="70" font-size="14" fill="#555">Original illustrative diagram of a typical British fire trench, about 1916–17. Proportions approximate; 1 grid square = 1 m.</text>')

# --- surfaces: extrude each profile segment along x, painter-sorted far→near ---
quads = []
for (y1, z1), (y2, z2) in zip(profile, profile[1:]):
    quad = [(0, y1, z1), (L, y1, z1), (L, y2, z2), (0, y2, z2)]
    depth = (y1 + y2) / 2 - (z1 + z2) / 2 * 0.2
    # colour by orientation
    dy, dz = y2 - y1, z2 - z1
    if dz == 0:
        col = "#a39b6c" if z1 >= 0 else ("#b08f60" if z1 == STEP else "#6b5235")
    elif dy == 0:
        col = "#7a5c3b" if dz > 0 else "#5b4430"   # walls facing rear (visible) vs enemy
    else:
        col = "#c8b48a" if (z1 > 0 or z2 > 0) else "#a39b6c"
    if z1 > 0 and z2 > 0:
        col = "#c8b48a"
    quads.append((depth, quad, col))
for d, q, col in sorted(quads, key=lambda r: -r[0]):
    out.append(poly(q, fill=col, stroke="#4a3925", stroke_width="0.8"))

# grid on the ground surface (1 m squares) behind and in front
for x in range(0, L + 1, 10):
    out.append(line((x, -34, 0), (x, -24, 0), stroke="#8f875a", stroke_width="0.6"))
    out.append(line((x, 38, 0), (x, 60, 0), stroke="#8f875a", stroke_width="0.6"))

# --- sandbags on parapet & parados (rows along x) ---
def sandbag_row(y, z, along=True, color="#d6c39a"):
    x = 0
    while x < L - 4:
        q = [(x + 0.3, y - 1.6, z), (x + 4.6, y - 1.6, z), (x + 4.6, y + 1.6, z), (x + 0.3, y + 1.6, z)]
        out.append(poly(q, fill=color, stroke="#8a7550", stroke_width="0.6"))
        x += 5
for y in (19, 22.5, 26, 29):
    sandbag_row(y, TOP)
for y in (-16, -12.5, -9, -6.5):
    sandbag_row(y, TOP, color="#cdb98f")

# --- revetment on the front wall (between fire-step and ground): posts + horizontal planks ---
for x in range(2, L, 8):
    out.append(line((x, 16, STEP), (x, 16, 1), stroke="#4a331d", stroke_width="2.4"))
for z in (-8, -5, -2):
    out.append(line((0, 16, z), (L, 16, z), stroke="#9c7a49", stroke_width="1.4"))
# revetment on the lower wall (floor → fire-step): corrugated iron
for x in range(0, L, 2):
    out.append(line((x, 10, FLOOR), (x, 10, STEP), stroke="#7f8c8d", stroke_width="0.8", opacity="0.8"))

# funk hole in the front wall below the fire-step
fh = [(44, 10, FLOOR + 0.2), (54, 10, FLOOR + 0.2), (54, 10, FLOOR + 6), (44, 10, FLOOR + 6)]
out.append(poly(fh, fill="#241a10", stroke="#120d08", stroke_width="0.8"))

# --- sump + duckboards on the floor ---
sump = [(0, 4, FLOOR), (L, 4, FLOOR), (L, 6, FLOOR), (0, 6, FLOOR)]
out.append(poly(sump, fill="#5d7b7f", opacity="0.85"))
out.append(line((0, 2, FLOOR + 1), (L, 2, FLOOR + 1), stroke="#7a5a33", stroke_width="1.6"))
out.append(line((0, 8, FLOOR + 1), (L, 8, FLOOR + 1), stroke="#7a5a33", stroke_width="1.6"))
for x in [i * 2.2 for i in range(int(L / 2.2))]:
    q = [(x, 1.2, FLOOR + 1.2), (x + 1.4, 1.2, FLOOR + 1.2), (x + 1.4, 8.8, FLOOR + 1.2), (x, 8.8, FLOOR + 1.2)]
    out.append(poly(q, fill="#c19a5b", stroke="#7a5a33", stroke_width="0.5"))

# --- traverse at the far end (x from -12 to 0), a solid earth block ---
trav_top = [(-12, 0, TOP), (0, 0, TOP), (0, 16, TOP), (-12, 16, TOP)]
trav_face = [(0, 0, FLOOR), (0, 16, FLOOR), (0, 16, TOP), (0, 0, TOP)]
out.insert(len(out) - 0, "")
out.append(poly(trav_face, fill="#6e5333", stroke="#4a3925", stroke_width="0.8", opacity="0.96"))
out.append(poly(trav_top, fill="#c8b48a", stroke="#4a3925", stroke_width="0.8"))
for z in range(FLOOR + 3, TOP, 3):
    out.append(line((0, 0.5, z), (0, 15.5, z), stroke="#5a4127", stroke_width="0.7"))

# --- barbed wire in front (y 46–56) ---
for y in (46, 51, 56):
    for x in range(0, L + 1, 10):
        out.append(line((x, y, 0), (x, y, 9), stroke="#4b3b2a", stroke_width="2"))
    for x in range(0, L, 10):
        out.append(line((x, y, 8), (x + 10, y, 3), stroke="#555", stroke_width="0.9"))
        out.append(line((x, y, 3), (x + 10, y, 8), stroke="#555", stroke_width="0.9"))
        out.append(line((x, y, 5.5), (x + 10, y, 5.5), stroke="#666", stroke_width="0.7"))
for _ in range(80):
    x = random.uniform(0, L); y = random.uniform(45, 57); z = random.uniform(1, 8)
    out.append(line((x, y, z), (x + random.uniform(-3, 3), y + random.uniform(-2, 2), z + random.uniform(-2, 2)), stroke="#777", stroke_width="0.6"))

# --- end cut face (x = L): the profile as a solid section ---
face = [(L, y, z) for y, z in profile] + [(L, 60, GROUND_BOTTOM), (L, -34, GROUND_BOTTOM)]
out.append(poly(face, fill="url(#face)", stroke="#3d2f20", stroke_width="1.6"))
# sandbag courses drawn in the cut face
for (ya, yb, z0) in [(17, 30, 0), (-18, -6, 0)]:
    for row in range(2):
        z = z0 + row * 2.5
        y = ya + (1.5 if row else 0)
        while y < yb - 2:
            out.append(poly([(L, y, z), (L, y + 3, z), (L, y + 3, z + 2.3), (L, y, z + 2.3)], fill="#d6c39a", stroke="#8a7550", stroke_width="0.6"))
            y += 3.2
# water in sump on the face + duckboard section
out.append(poly([(L, 4, FLOOR), (L, 6, FLOOR), (L, 6, FLOOR - 2.5), (L, 4, FLOOR - 2.5)], fill="#5d7b7f"))
out.append(poly([(L, 1.2, FLOOR + 1), (L, 8.8, FLOOR + 1), (L, 8.8, FLOOR + 1.6), (L, 1.2, FLOOR + 1.6)], fill="#c19a5b", stroke="#7a5a33", stroke_width="0.5"))
# strata
for z, c in [(-6, "#6b5235"), (-24, "#9c8a6a")]:
    out.append(line((L, -34, z), (L, 0, z), stroke=c, stroke_width="0.7", stroke_dasharray="5 4"))
    out.append(line((L, 16, z), (L, 60, z), stroke=c, stroke_width="0.7", stroke_dasharray="5 4"))

# --- a soldier on the fire-step (simple original silhouette, Brodie-style helmet) ---
def soldier(x, y, z, scale=1.0):
    bx, by = P(x, y, z)
    s = S * scale
    g = []
    g.append(f'<g fill="#3f4a2f" stroke="#262d1b" stroke-width="1">')
    g.append(f'<rect x="{bx - 0.9 * s:.1f}" y="{by - 9.0 * s:.1f}" width="{1.8 * s:.1f}" height="{5.0 * s:.1f}" rx="{0.4 * s:.1f}"/>')    # torso
    g.append(f'<rect x="{bx - 0.85 * s:.1f}" y="{by - 4.2 * s:.1f}" width="{0.75 * s:.1f}" height="{4.2 * s:.1f}"/>')                  # leg
    g.append(f'<rect x="{bx + 0.1 * s:.1f}" y="{by - 4.2 * s:.1f}" width="{0.75 * s:.1f}" height="{4.2 * s:.1f}"/>')                   # leg
    g.append(f'<circle cx="{bx:.1f}" cy="{by - 10.1 * s:.1f}" r="{0.85 * s:.1f}" fill="#d9b58f" stroke="#7a5a3a"/>')                  # head
    g.append(f'<ellipse cx="{bx:.1f}" cy="{by - 10.7 * s:.1f}" rx="{1.6 * s:.1f}" ry="{0.35 * s:.1f}"/>')                              # helmet brim
    g.append(f'<path d="M{bx - 0.9 * s:.1f},{by - 10.7 * s:.1f} Q{bx:.1f},{by - 12.0 * s:.1f} {bx + 0.9 * s:.1f},{by - 10.7 * s:.1f} z"/>')  # helmet crown
    g.append('</g>')
    # rifle resting over the parapet
    rx1, ry1 = bx + 0.6 * s, by - 8.4 * s
    rx2, ry2 = P(x + 1, y + 9, TOP + 1.2)
    g.append(f'<line x1="{rx1:.1f}" y1="{ry1:.1f}" x2="{rx2:.1f}" y2="{ry2:.1f}" stroke="#5a3d22" stroke-width="{0.35 * s:.1f}" stroke-linecap="round"/>')
    out.extend(g)
soldier(30, 13, STEP, 1.45)
# second soldier resting on the duckboards (sitting on the fire-step edge)
def sitter(x, y, z):
    bx, by = P(x, y, z)
    s = S * 1.45
    out.append(f'<g fill="#4a5536" stroke="#262d1b" stroke-width="1">'
               f'<rect x="{bx - 0.9 * s:.1f}" y="{by - 5.6 * s:.1f}" width="{1.8 * s:.1f}" height="{4.4 * s:.1f}" rx="{0.4 * s:.1f}"/>'
               f'<rect x="{bx - 2.4 * s:.1f}" y="{by - 1.4 * s:.1f}" width="{2.4 * s:.1f}" height="{0.8 * s:.1f}"/>'
               f'<rect x="{bx - 2.4 * s:.1f}" y="{by - 1.4 * s:.1f}" width="{0.7 * s:.1f}" height="{3.0 * s:.1f}"/>'
               f'<circle cx="{bx:.1f}" cy="{by - 6.6 * s:.1f}" r="{0.85 * s:.1f}" fill="#d9b58f" stroke="#7a5a3a"/>'
               f'<ellipse cx="{bx:.1f}" cy="{by - 7.2 * s:.1f}" rx="{1.6 * s:.1f}" ry="{0.35 * s:.1f}"/>'
               f'<path d="M{bx - 0.9 * s:.1f},{by - 7.2 * s:.1f} Q{bx:.1f},{by - 8.5 * s:.1f} {bx + 0.9 * s:.1f},{by - 7.2 * s:.1f} z"/></g>')
sitter(58, 14, STEP)

# periscope above the parapet at x = 14
px0, py0 = P(14, 15, STEP + 13)
px1, py1 = P(14, 15, TOP + 4)
out.append(f'<line x1="{px0:.1f}" y1="{py0:.1f}" x2="{px1:.1f}" y2="{py1:.1f}" stroke="#3a3a3a" stroke-width="4"/>')
out.append(f'<rect x="{px1 - 4:.1f}" y="{py1 - 6:.1f}" width="8" height="7" fill="#3a3a3a"/>')

# --- labels ---
def label(p3, tx, ty, title, sub=None, anchor="start"):
    px, py = P(*p3)
    ax = tx - 4 if anchor == "start" else tx + 4
    out.append(f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{ax:.1f}" y2="{ty - 6:.1f}" stroke="#333" stroke-width="0.9"/>')
    out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="3.2" fill="#b03a2e" stroke="#fff" stroke-width="1"/>')
    out.append(f'<text x="{tx:.1f}" y="{ty - 2:.1f}" font-size="15" font-weight="bold" fill="#222" text-anchor="{anchor}">{title}</text>')
    if sub:
        for i, s_ in enumerate(sub.split("|")):
            out.append(f'<text x="{tx:.1f}" y="{ty + 14 + i * 14:.1f}" font-size="12.5" fill="#444" text-anchor="{anchor}">{s_}</text>')

label((L, 25, TOP + 2), 1150, 300, "Parapet", "sandbags and earth on the enemy side;|stops bullets, about 1.5 m above the fire-step")
label((L, -12, TOP + 2), 300, 680, "Parados", "raised rear bank: protects against blast|from behind and avoids skylining heads", anchor="end")
label((L, 13, STEP + 0.5), 1150, 450, "Fire-step", "a ledge ~0.6–0.9 m high; men stood|here to fire over the parapet")
label((L, 5, FLOOR + 1.6), 1150, 690, "Duckboards", "slatted boards over the mud;|'trench foot' was a constant danger")
label((L, 5, FLOOR - 2), 1150, 770, "Sump", "drainage channel under the boards")
label((40, 16, -4), 1150, 540, "Revetment", "timber, wire mesh or corrugated iron|holding the walls up")
label((49, 10, FLOOR + 3), 900, 850, "Funk hole", "small shelter scraped into the wall")
label((-6, 8, TOP), 300, 230, "Traverse", "earth block at each end of the bay;|contains blast and stops enfilade fire", anchor="end")
label((30, 51, 8), 900, 130, "Barbed wire", "belts several metres deep in front")
label((14, 15, TOP + 6), 560, 130, "Trench periscope", "lets a sentry look out without exposing his head", anchor="end")
label((30, 13, STEP + 10), 300, 470, "Sentry on the fire-step", "with a rifle resting on the parapet", anchor="end")

# scale & direction legend (bottom-left)
lx, ly = 50, 848
out.append(f'<rect x="{lx - 20}" y="{ly - 70}" width="300" height="122" rx="6" fill="#fff" stroke="#bbb"/>')
ex, ey = 18 * C30 * S, -18 * S30 * S
out.append(f'<line x1="{lx}" y1="{ly - 5}" x2="{lx + ex:.1f}" y2="{ly - 5 + ey:.1f}" stroke="#b03a2e" stroke-width="3" marker-end="url(#ah)"/>')
out.append(f'<text x="{lx + ex + 10:.1f}" y="{ly - 5 + ey + 5:.1f}" font-size="13" font-weight="bold" fill="#b03a2e">towards the enemy</text>')
mx, my = 10 * C30 * S, 10 * S30 * S
out.append(f'<line x1="{lx}" y1="{ly + 12}" x2="{lx + mx:.1f}" y2="{ly + 12 + my:.1f}" stroke="#222" stroke-width="3"/>')
out.append(f'<text x="{lx + mx + 10:.1f}" y="{ly + 12 + my + 4:.1f}" font-size="13" fill="#222">1 metre along the trench</text>')
out.append('</svg>')
open("images/fire-trench-section-3d.svg", "w").write("\n".join(out))
print("ok")
