"""Generate an original isometric 3D cutaway of a WWI trench system (SVG)."""
import math, random

random.seed(7)
C30, S30 = math.cos(math.radians(30)), math.sin(math.radians(30))
S = 0.72            # plan scale
ZS = 1.0            # vertical scale (already exaggerated in z units)
OX, OY = 270, 500   # screen origin for (x=0,y=0,z=0)
XMAX, YMAX, ZMIN = 600, 900, -125


def P(x, y, z=0.0):
    sx = OX + (x + y) * C30 * S
    sy = OY + (x - y) * S30 * S - z * ZS * S
    return sx, sy


def pts(seq):
    return " ".join(f"{a:.1f},{b:.1f}" for a, b in seq)


def poly3(points3, **attrs):
    a = " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in attrs.items())
    return f'<polygon points="{pts([P(*p) for p in points3])}" {a}/>'


def line3(p1, p2, **attrs):
    a = " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in attrs.items())
    (x1, y1), (x2, y2) = P(*p1), P(*p2)
    return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" {a}/>'


def offset(path, d):
    """Miter offset of a 2D polyline by distance d (left side positive)."""
    out = []
    n = len(path)
    for i in range(n):
        if i == 0:
            dx, dy = path[1][0] - path[0][0], path[1][1] - path[0][1]
            L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
            out.append((path[0][0] + nx * d, path[0][1] + ny * d))
        elif i == n - 1:
            dx, dy = path[-1][0] - path[-2][0], path[-1][1] - path[-2][1]
            L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
            out.append((path[-1][0] + nx * d, path[-1][1] + ny * d))
        else:
            ax, ay = path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]
            bx, by = path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]
            La, Lb = math.hypot(ax, ay), math.hypot(bx, by)
            n1 = (-ay / La, ax / La); n2 = (-by / Lb, bx / Lb)
            mx, my = n1[0] + n2[0], n1[1] + n2[1]
            Lm = math.hypot(mx, my)
            mx, my = mx / Lm, my / Lm
            cos = mx * n1[0] + my * n1[1]
            k = d / max(cos, 0.3)
            out.append((path[i][0] + mx * k, path[i][1] + my * k))
    return out


def strip(path, w):
    left, right = offset(path, w / 2), offset(path, -w / 2)
    return left + right[::-1]


def crenel(y0, x0=0, x1=XMAX, bay=46, trav=14, amp=13):
    """Fire trench plan: square-wave of fire bays and traverses."""
    path, x, up = [(x0, y0)], x0, True
    while x < x1 - bay:
        x += bay
        path.append((x, y0 + (amp if up else 0)))
        path.append((x, y0 + (0 if up else amp)))
        x += trav
        path.append((x, y0 + (0 if up else amp)))
        path.append((x, y0 + (amp if up else 0)))
        up = not up
    path = [path[0]] + [(min(a, x1), b) for a, b in path[1:]]
    last = path[-1]
    path.append((x1, last[1]))
    # remove duplicates
    clean = [path[0]]
    for p in path[1:]:
        if math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 0.5:
            clean.append(p)
    return clean


def zigzag(x0, y0, y1, amp=16, step=34):
    path, y, s = [(x0, y0)], y0, 1
    while y + step < y1:
        y += step
        path.append((x0 + amp * s, y))
        s = -s
    path.append((x0, y1))
    return path


out = []
W, H = 1500, 1010
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">')
out.append('''<defs>
<linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#8a6a45"/><stop offset="0.25" stop-color="#7a5c3b"/>
 <stop offset="0.6" stop-color="#9c8a6a"/><stop offset="1" stop-color="#c9c0a8"/>
</linearGradient>
<linearGradient id="soil2" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#6e5333"/><stop offset="0.6" stop-color="#857457"/><stop offset="1" stop-color="#ada389"/>
</linearGradient>
<pattern id="grass" width="8" height="8" patternUnits="userSpaceOnUse">
 <rect width="8" height="8" fill="#a39b6c"/><circle cx="2" cy="3" r="0.9" fill="#8f875a"/><circle cx="6" cy="6" r="0.8" fill="#b3ab7c"/>
</pattern>
<pattern id="mud" width="10" height="10" patternUnits="userSpaceOnUse">
 <rect width="10" height="10" fill="#9a8460"/><circle cx="3" cy="4" r="1.2" fill="#8a7452"/><circle cx="8" cy="8" r="1" fill="#a8946e"/>
</pattern>
</defs>''')
out.append(f'<rect width="{W}" height="{H}" fill="#f4f1ea"/>')
out.append('<text x="30" y="44" font-size="26" font-weight="bold" fill="#2b2b2b">Anatomy of a Western Front trench system (3D cutaway)</text>')
out.append('<text x="30" y="70" font-size="14" fill="#555">Original illustrative diagram. Not to scale: depths are exaggerated about 4x so underground features are visible.</text>')

# ---- ground block faces ----
top = [(0, 0, 0), (XMAX, 0, 0), (XMAX, YMAX, 0), (0, YMAX, 0)]
# top: friendly side grass, no-man's-land mud
out.append(poly3(top, fill="url(#grass)", stroke="#5a4a32", stroke_width="1.2"))
nml = [(0, 470, 0), (XMAX, 470, 0), (XMAX, 735, 0), (0, 735, 0)]
out.append(poly3(nml, fill="url(#mud)", opacity="0.95"))
enemy = [(0, 735, 0), (XMAX, 735, 0), (XMAX, YMAX, 0), (0, YMAX, 0)]
out.append(poly3(enemy, fill="#a49d78", opacity="0.6"))

# craters (projected circles)
for _ in range(26):
    cx, cy, r = random.uniform(30, 570), random.uniform(480, 725), random.uniform(7, 19)
    circ = [(cx + r * math.cos(t), cy + r * math.sin(t), 0) for t in [i * math.pi / 10 for i in range(20)]]
    out.append(poly3(circ, fill="#6e5a3c", stroke="#b8a681", stroke_width="1.4"))
    inner = [(cx + r * .45 * math.cos(t), cy + r * .45 * math.sin(t), 0) for t in [i * math.pi / 8 for i in range(16)]]
    out.append(poly3(inner, fill="#5d6f6e", opacity="0.75"))
# a couple of shattered trees on enemy side
for (tx, ty) in [(80, 820), (140, 860), (380, 840), (520, 815)]:
    out.append(line3((tx, ty, 0), (tx, ty, 26), stroke="#3e3226", stroke_width="2.4"))
    out.append(line3((tx, ty, 18), (tx + 8, ty - 4, 28), stroke="#3e3226", stroke_width="1.5"))

# ---- trenches (plan) ----
TR = "#3d2f20"
LIP = "#d8c7a0"

def trench(path, w, color=TR, lip=True):
    s = strip(path, w)
    if lip:
        out.append(poly3([(a, b, 0) for a, b in strip(path, w + 10)], fill=LIP, opacity="0.9"))
    out.append(poly3([(a, b, 0) for a, b in s], fill=color, stroke="#22190f", stroke_width="0.6"))
    # inner shadow line
    inner = offset(path, -w / 4)
    out.append(f'<polyline points="{pts([P(a, b, 0) for a, b in inner])}" fill="none" stroke="#5c4730" stroke-width="1.2"/>')

reserve = [(0, 118), (120, 112), (260, 124), (420, 116), (XMAX, 120)]
support = [(0, 300), (150, 296), (300, 304), (460, 298), (XMAX, 300)]
front = crenel(408)
enemy_front = crenel(752, amp=12)
enemy_support = [(0, 878), (200, 872), (400, 880), (XMAX, 876)]
comm1 = zigzag(150, 0, 410)
comm2 = zigzag(430, 0, 410)
sap = [(300, 421), (300, 470), (318, 500), (306, 540)]
ecomm = zigzag(250, 762, YMAX)

for c in (comm1, comm2, ecomm):
    trench(c, 11)
trench(reserve, 14)
trench(support, 14)
trench(front, 15)
trench(enemy_front, 15)
trench(enemy_support, 14)
trench(sap, 9)
# listening post
lp = [(306 + 11 * math.cos(t), 545 + 11 * math.sin(t), 0) for t in [i * math.pi / 8 for i in range(16)]]
out.append(poly3(lp, fill=TR, stroke=LIP, stroke_width="2"))

# ---- barbed wire belts ----
def wire_belt(y0, y1, x0=0, x1=XMAX, step=22):
    for y in (y0, (y0 + y1) / 2, y1):
        x = x0 + random.uniform(0, 8)
        prev = None
        while x <= x1:
            out.append(line3((x, y, 0), (x, y, 7), stroke="#4b3b2a", stroke_width="1.1"))
            if prev is not None:
                out.append(line3((prev, y, 6), (x, y, 2), stroke="#555", stroke_width="0.7"))
                out.append(line3((prev, y, 2), (x, y, 6), stroke="#555", stroke_width="0.7"))
            prev = x
            x += step
    # tangle
    for _ in range(int((x1 - x0) / 5)):
        x = random.uniform(x0, x1); y = random.uniform(y0, y1)
        out.append(line3((x, y, random.uniform(1, 6)), (x + random.uniform(-9, 9), y + random.uniform(-8, 8), random.uniform(1, 6)), stroke="#666", stroke_width="0.6"))

wire_belt(440, 466)
wire_belt(708, 732)

# ---- right-hand cut face (x = XMAX): profile through every line ----
cuts = {  # y-interval of trench openings at x=XMAX
    "reserve": (113, 127), "support": (293, 307), "front": None, "efront": None, "esupport": (869, 883)}
# find actual front crossing at x = XMAX
fy = front[-1][1]; efy = enemy_front[-1][1]
cuts["front"] = (fy - 7.5, fy + 7.5)
cuts["efront"] = (efy - 7.5, efy + 7.5)
TD = 24  # trench depth in z units (exaggerated)

prof = [(XMAX, 0, 0)]
for k in ("reserve", "support", "front", "efront", "esupport"):
    a, b = cuts[k]
    prof += [(XMAX, a - 10, 0), (XMAX, a - 6, 3), (XMAX, a, 3), (XMAX, a, -TD), (XMAX, b, -TD), (XMAX, b, 4), (XMAX, b + 7, 5), (XMAX, b + 12, 0)]
prof += [(XMAX, YMAX, 0), (XMAX, YMAX, ZMIN), (XMAX, 0, ZMIN)]
out.append(poly3(prof, fill="url(#soil)", stroke="#4a3925", stroke_width="1.3"))
# strata lines
for z, col in [(-35, "#6b5235"), (-70, "#8f7f60")]:
    out.append(line3((XMAX, 0, z), (XMAX, YMAX, z), stroke=col, stroke_width="0.8", stroke_dasharray="6 5"))
# rear face (y = 0)
rear = [(0, 0, 0)]
for cx in (150, 430):
    rear += [(cx - 5.5, 0, 0), (cx - 5.5, 0, -18), (cx + 5.5, 0, -18), (cx + 5.5, 0, 0)]
rear += [(XMAX, 0, 0), (XMAX, 0, ZMIN), (0, 0, ZMIN)]
out.append(poly3(rear, fill="url(#soil2)", stroke="#4a3925", stroke_width="1.3"))
for z, col in [(-35, "#5e472d"), (-70, "#7d6e52")]:
    out.append(line3((0, 0, z), (XMAX, 0, z), stroke=col, stroke_width="0.8", stroke_dasharray="6 5"))

# sandbag courses on parapets in the cut face
for k in ("reserve", "support", "front", "efront", "esupport"):
    a, b = cuts[k]
    for i in range(3):
        y = b + 1 + i * 3.5
        out.append(poly3([(XMAX, y, 0), (XMAX, y + 3.2, 0), (XMAX, y + 3.2, 4), (XMAX, y, 4)], fill="#c8b48a", stroke="#7b6845", stroke_width="0.5"))
    # duckboard
    out.append(line3((XMAX, a + 1, -TD + 2), (XMAX, b - 1, -TD + 2), stroke="#c19a5b", stroke_width="2.2"))
    # fire-step on enemy side wall
    out.append(poly3([(XMAX, b - 4, -TD), (XMAX, b, -TD), (XMAX, b, -TD + 9), (XMAX, b - 4, -TD + 9)], fill="#6b5235"))

# deep dugout under the front line (stairs from trench floor)
fa, fb = cuts["front"]
dug = [(XMAX, fa - 30, -58), (XMAX, fa + 2, -58), (XMAX, fa + 2, -76), (XMAX, fa - 30, -76)]
out.append(poly3(dug, fill="#2b2117", stroke="#1a130c", stroke_width="1"))
for i in range(4):  # bunks
    out.append(line3((XMAX, fa - 28 + i * 7, -74), (XMAX, fa - 28 + i * 7, -61), stroke="#a07d4c", stroke_width="1"))
out.append(poly3([(XMAX, fa + 2, -TD), (XMAX, fa + 8, -TD), (XMAX, fa + 8, -60), (XMAX, fa + 2, -64)], fill="#2b2117"))
for i in range(7):
    z = -TD - 5 - i * 5
    out.append(line3((XMAX, fa + 2, z), (XMAX, fa + 8, z), stroke="#8c6b40", stroke_width="0.9"))

# infantry subway (Vimy style) from rear to front line
sub = [(XMAX, 30, -84), (XMAX, fa - 34, -84), (XMAX, fa - 34, -92), (XMAX, 30, -92)]
out.append(poly3(sub, fill="#2b2117", stroke="#1a130c", stroke_width="1"))
out.append(poly3([(XMAX, 22, 0), (XMAX, 30, 0), (XMAX, 30, -92), (XMAX, 22, -92)], fill="#2b2117"))  # rear entrance shaft
for y in range(40, int(fa - 36), 22):  # lamps
    sx, sy = P(XMAX, y, -86)
    out.append(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="1.6" fill="#ffd970"/>')
out.append(poly3([(XMAX, fa - 34, -84), (XMAX, fa - 30, -76), (XMAX, fa - 26, -76), (XMAX, fa - 30, -92)], fill="#2b2117"))

# mine gallery (Messines style): shaft from support trench, gallery under no man's land
sa, sb = cuts["support"]
efa, efb = cuts["efront"]
out.append(poly3([(XMAX, sa + 3, -TD), (XMAX, sa + 9, -TD), (XMAX, sa + 9, -112), (XMAX, sa + 3, -112)], fill="#1f1810"))
out.append(poly3([(XMAX, sa + 3, -105), (XMAX, efa + 4, -105), (XMAX, efa + 4, -112), (XMAX, sa + 3, -112)], fill="#1f1810", stroke="#120d08", stroke_width="0.8"))
# charge chamber
out.append(poly3([(XMAX, efa - 6, -100), (XMAX, efb + 10, -100), (XMAX, efb + 10, -116), (XMAX, efa - 6, -116)], fill="#1f1810"))
for i in range(5):
    for j in range(2):
        y = efa - 4 + i * 5; z = -114 + j * 6
        out.append(poly3([(XMAX, y, z), (XMAX, y + 4.2, z), (XMAX, y + 4.2, z + 5), (XMAX, y, z + 5)], fill="#c0392b", stroke="#7b1f16", stroke_width="0.5"))
# german counter-mine listening gallery
out.append(poly3([(XMAX, efb + 30, -70), (XMAX, efb + 34, -70), (XMAX, efb + 34, -TD), (XMAX, efb + 30, -TD)], fill="#1f1810"))
out.append(poly3([(XMAX, efb - 25, -70), (XMAX, efb + 34, -70), (XMAX, efb + 34, -75), (XMAX, efb - 25, -75)], fill="#1f1810"))

# ---- labels with leader lines (auto layout) ----
def draw_label(px, py, tx, ty, title, sub, anchor, attach=None):
    ax, ay = attach if attach else ((tx - 2, ty - 7) if anchor == "start" else (tx + 2, ty - 7))
    out.append(f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{ax:.1f}" y2="{ay:.1f}" stroke="#333" stroke-width="0.9"/>')
    out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="3.2" fill="#b03a2e" stroke="#fff" stroke-width="1"/>')
    dx = 6 if anchor == "start" else -6
    out.append(f'<text x="{tx + dx:.1f}" y="{ty - 3:.1f}" font-size="15" font-weight="bold" fill="#222" text-anchor="{anchor}">{title}</text>')
    if sub:
        for i, s in enumerate(sub.split("|")):
            out.append(f'<text x="{tx + dx:.1f}" y="{ty + 13 + i * 14:.1f}" font-size="12.5" fill="#444" text-anchor="{anchor}">{s}</text>')

def column(items, x, ymin, gap, anchor="start"):
    items = sorted(((P(*p), t, s) for p, t, s in items), key=lambda r: r[0][1])
    y = ymin
    for (px, py), t, s in items:
        y = max(y, py)
        draw_label(px, py, x, y, t, s, anchor)
        y += gap

def row(items, y, xmin, gap):
    items = sorted(((P(*p), t, s) for p, t, s in items), key=lambda r: r[0][0])
    x = xmin
    for (px, py), t, s in items:
        n = len(s.split("|")) if s else 0
        draw_label(px, py, x, y, t, s, "start", attach=(x + 60, y + 6 + n * 14))
        x += gap

column([
    ((40, 118, 0), "Reserve line", "troops, stores, HQ dugouts"),
    ((40, 300, 0), "Support line", "a short distance behind the front"),
    ((150, 205, 0), "Communication trench", "zig-zag, so one shell or burst|can't sweep its whole length"),
    ((25, 412, 0), "Front (fire) trench", "fire bays separated by traverses"),
], 250, 250, 62, "end")
row([
    ((60, 452, 0), "Barbed-wire belts", "rows of wire on iron pickets"),
    ((110, 600, 0), "No man's land", "often 100–300 m; in places under 50 m"),
    ((306, 545, 0), "Sap &amp; listening post", "manned at night"),
    ((200, 765, 0), "Enemy wire &amp; front line", "a mirror image of our own"),
], 112, 330, 255)
column([
    ((XMAX, efb + 32, -55), "Enemy listening gallery", "counter-miners listening for digging"),
    ((XMAX, fb + 4, 3), "Parapet (sandbags)", "faces the enemy; parados at the rear"),
    ((XMAX, 560, -108), "Mine gallery + charge", "Messines 1917: 19 mines fired,|about 454 t of ammonal"),
    ((XMAX, fa - 15, -66), "Deep dugout", "shelters men during bombardment"),
    ((XMAX, 120, -88), "Infantry subway", "Vimy 1917: 11 tunnels, ~6 km,|lit, with water and aid posts"),
], 1225, 250, 72, "start")

# arrow toward the enemy along the left side of the block
ax1, ay1 = P(-38, 170, 0); ax2, ay2 = P(-38, 470, 0)
out.append(f'<line x1="{ax1:.1f}" y1="{ay1:.1f}" x2="{ax2:.1f}" y2="{ay2:.1f}" stroke="#b03a2e" stroke-width="3" marker-end="url(#ah)"/>')
out.insert(2, '<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#b03a2e"/></marker></defs>')
tx, ty = P(-58, 250, 0)
out.append(f'<text x="{tx:.1f}" y="{ty:.1f}" font-size="14" font-weight="bold" fill="#b03a2e" transform="rotate(-30 {tx:.1f} {ty:.1f})">towards the enemy</text>')

# key box
out.append('''<g transform="translate(30,850)" font-size="12" fill="#333">
<rect x="0" y="0" width="380" height="130" rx="6" fill="#fff" stroke="#bbb"/>
<text x="12" y="22" font-size="13" font-weight="bold">Key</text>
<rect x="12" y="34" width="22" height="10" fill="#3d2f20"/><text x="42" y="43">Open trench (plan view, top surface)</text>
<rect x="12" y="54" width="22" height="10" fill="#d8c7a0"/><text x="42" y="63">Parapet / parados spoil and sandbags</text>
<rect x="12" y="74" width="22" height="10" fill="#c0392b"/><text x="42" y="83">Explosive charge (mine chamber)</text>
<rect x="12" y="94" width="22" height="10" fill="#2b2117"/><text x="42" y="103">Dugouts, subways and galleries (cutaway face)</text>
<circle cx="23" cy="118" r="4" fill="#ffd970" stroke="#999"/><text x="42" y="122">Electric lamps in the subway</text>
</g>''')
out.append('</svg>')
open("images/trench-system-3d.svg", "w").write("\n".join(out))
print("ok")
