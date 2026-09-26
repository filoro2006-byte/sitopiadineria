#!/usr/bin/env python3
"""
Generatore parametrico della cover per iPhone 15 Pro.

Misure prese dal disegno dimensionale ufficiale Apple
(developer.apple.com/accessories/dimensional-drawings -> iphone-15-pro.pdf).

Sistema di riferimento (vista frontale, schermo verso di te):
  X -> destra, Y -> alto, Z -> verso lo schermo. Origine al centro del telefono.
  Tasto Azione + volumi a sinistra (X-), tasto laterale a destra (X+),
  fotocamera dietro, in alto a destra (vista frontale).

Uso:  pip install manifold3d numpy pillow usd-core   (usd-core solo per la .usdz)
      python3 genera_cover.py
"""
import math
import os
import struct
import zipfile
from datetime import date

import numpy as np
from manifold3d import CrossSection, JoinType, Manifold, OpType

OUT = os.path.dirname(os.path.abspath(__file__))
NAME = "cover_iphone15pro"

# ---------------------------------------------------------------- telefono
W, L, T = 70.60, 146.61, 8.25            # larghezza, lunghezza, spessore
HW, HL, HT = W / 2, L / 2, T / 2

# Profilo angoli (Detail A): punti (distanza dal bordo laterale, dal bordo alto)
CORNER_PTS = [(0.0, 17.24), (0.05, 12.36), (0.90, 7.58), (3.48, 3.48),
              (7.58, 0.90), (12.36, 0.05), (17.24, 0.0)]

# Profilo bordi (Detail B): (|z| dal piano medio, rientro dal filo esterno)
EDGE_PROFILE = [(2.46, 0.00), (3.07, 0.06), (3.62, 0.32), (3.99, 0.81),
                (4.06, 1.40), (HT, 2.41)]

# ---------------------------------------------------------------- cover
CLEAR_XY = 0.15     # gioco laterale telefono/cover
CLEAR_Z = 0.15      # gioco su vetro frontale e posteriore
WALL = 1.60         # spessore pareti laterali
BACK = 1.50         # spessore dorso (Apple: max 2.1 mm per MagSafe)
LIP_ABOVE = 0.85    # quanto il bordo sporge sopra il vetro (oltre al gioco)
LIP_IN = 1.30       # quanto il bordino copre lo schermo dal filo esterno
BOTTOM_R = 2.0      # raccordo bordo posteriore (stampabile a 45 gradi)
TOP_R = 1.0         # raccordo bordo frontale

OUTER = CLEAR_XY + WALL
Z_BOT = -(HT + CLEAR_Z + BACK)
Z_TOP = HT + CLEAR_Z + LIP_ABOVE
Z_GLASS = HT + CLEAR_Z

SEG = 24            # campioni per tratto di spline dell'angolo


def catmull_rom(pts, n, phase=0.0):
    """Spline Catmull-Rom centripeta passante per i punti dati.
    I punti fantasma agli estremi stanno sui lati dritti, così la curva
    parte tangente ai lati senza sporgere."""
    p = [np.array((0.0, pts[0][1] + 5.0))] + [np.array(q) for q in pts] \
        + [np.array((pts[-1][0] + 5.0, 0.0))]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        t0 = 0.0
        t1 = t0 + np.linalg.norm(p1 - p0) ** 0.5
        t2 = t1 + np.linalg.norm(p2 - p1) ** 0.5
        t3 = t2 + np.linalg.norm(p3 - p2) ** 0.5
        for j in range(n):
            t = t1 + (j + phase) * (t2 - t1) / n
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    if phase:
        out.insert(0, np.array(pts[0]))
    out.append(np.array(pts[-1]))
    return out


def phone_outline(seg=SEG, phase=0.0):
    """Contorno in pianta del telefono (angoli a curvatura continua Apple)."""
    arc = catmull_rom(CORNER_PTS, seg, phase)     # da lato verticale a lato alto
    # la spline oscilla di ~0.03 mm vicino ai punti di tangenza: non oltre i lati
    tr = [(HW - max(dx, 0.0), HL - max(dy, 0.0)) for dx, dy in arc]
    tl = [(-x, y) for x, y in reversed(tr)]
    bl = [(-x, -y) for x, y in tr]
    br = [(x, -y) for x, y in reversed(tr)]
    # antiorario: in alto a destra (dal lato dx verso l'alto) -> sx -> basso
    ring = tr + tl + bl + br
    clean = []
    for q in ring:
        if not clean or math.dist(clean[-1], q) > 1e-6:
            clean.append(tuple(q))
    if math.dist(clean[0], clean[-1]) < 1e-6:
        clean.pop()
    return CrossSection([clean])


OUTLINE = phone_outline()
# Stesso contorno campionato diversamente: i vertici dell'apertura schermo non
# cadono sugli spigoli della cavità (evita intersezioni degeneri nelle booleane).
OUTLINE_ALT = phone_outline(SEG + 7, 0.5)
OUTLINE_FLARE = phone_outline(SEG + 13, 0.25)


def off(cs, d):
    if abs(d) < 1e-9:
        return cs
    return cs.offset(d, JoinType.Round, 2.0, 96)


def ring(cs, z):
    """Vertici del contorno `cs` portati alla quota z."""
    pts = np.vstack([np.asarray(poly) for poly in cs.to_polygons()])
    return np.column_stack([pts, np.full(len(pts), z)])


def hull(rings):
    """Inviluppo convesso di più contorni a quote diverse (niente lastre
    sottili: la mesh risultante resta pulita dopo le booleane)."""
    return Manifold.hull_points(np.vstack(rings))


def rounded_rect(x0, y0, x1, y1, r):
    rect = CrossSection.square((x1 - x0 - 2 * r, y1 - y0 - 2 * r)) \
        .translate((x0 + r, y0 + r))
    return rect.offset(r, JoinType.Round, 2.0, 128)


def stadium(length, height, n=32, phase=0.0):
    """Asola centrata nell'origine: lunga `length` (asse u), alta `height` (v).
    `phase` sfasa i campioni degli archi (per non allineare vertici tra solidi)."""
    r = height / 2
    a = max(length / 2 - r, 0.0)
    ts = [(-0.5 + (j + phase) / (n - 1)) * math.pi for j in range(n - (1 if phase else 0))]
    pts = [(a + r * math.cos(t), r * math.sin(t)) for t in ts]
    pts += [(-a - r * math.cos(t), -r * math.sin(t)) for t in ts]
    return CrossSection([pts])


# --------------------------------------------------------- volumi base
def phone_cavity():
    r = []
    for az, ins in EDGE_PROFILE:
        cs = off(OUTLINE, CLEAR_XY - ins)
        zz = az + CLEAR_Z
        r += [ring(cs, zz), ring(cs, -zz)]
    return hull(r)


def outer_body():
    r = []
    # raccordo posteriore: smusso 45 gradi che si fonde in un arco
    first = OUTER - 2 * BOTTOM_R * (1 - math.sqrt(0.5))
    r.append(ring(off(OUTLINE, first), Z_BOT))
    for k in range(0, 13):
        phi = math.radians(45 + 45 * k / 12)
        d = OUTER - BOTTOM_R + BOTTOM_R * math.sin(phi)
        z = Z_BOT + BOTTOM_R - BOTTOM_R * math.cos(phi)
        r.append(ring(off(OUTLINE, d), z))
    # raccordo frontale
    for k in range(0, 13):
        phi = math.radians(90 * k / 12)
        d = OUTER - TOP_R + TOP_R * math.cos(phi)
        z = Z_TOP - TOP_R + TOP_R * math.sin(phi)
        r.append(ring(off(OUTLINE, d), z))
    return hull(r)


def screen_opening():
    edge = off(OUTLINE_ALT, -LIP_IN)
    z_v = Z_GLASS + 0.35                     # tratto verticale del bordino
    slope = 0.45 / (Z_TOP - z_v)             # smusso: 0.45 mm in orizzontale
    # Forma concava = prisma + tronco. Il tronco parte un po' dentro il prisma
    # e finisce oltre il bordo superiore: nessuna faccia o spigolo coincidente.
    below, above = 0.1, 0.5
    prism = hull([ring(edge, Z_GLASS - 0.1), ring(edge, Z_TOP + above + 0.5)])
    flare = hull([ring(off(OUTLINE_FLARE, -(LIP_IN + slope * below)), z_v - below),
                  ring(off(OUTLINE_FLARE, -(LIP_IN - slope * (Z_TOP + above - z_v))),
                       Z_TOP + above)])
    return prism + flare


def camera_cut():
    # Detail D (vista posteriore): base del plateau a 1.04 mm dai bordi,
    # 44.18 x 45.50 mm, raggio ~10.9 mm. Margine 0.5 mm per lato.
    m = 0.5
    x0, x1 = HW - 45.22 - m, HW - 1.04 + m
    y0, y1 = HL - 46.54 - m, HL - 1.04 + m
    r = 10.86 + m
    hole = rounded_rect(x0, y0, x1, y1, r)
    ch = 0.4                                 # smusso esterno a 45 gradi
    prism = hull([ring(hole, Z_BOT - 1.5), ring(hole, -2.0)])
    flare = hull([ring(off(hole, ch + 1.0), Z_BOT - 1.0),
                  ring(off(hole, -0.1), Z_BOT + ch + 0.1)])
    return prism + flare


def slot_cut(length, height, depth_face, ch, place):
    """Asola passante con smusso esterno a 45 gradi, in coordinate (u, v, w):
    w = 0 lato interno, w = depth_face faccia esterna della parete.
    `place` converte i punti (u, v, w) in (x, y, z)."""
    def rng(dl, w, n=32, phase=0.0):
        pts = np.vstack([np.asarray(p) for p in stadium(
            length + 2 * dl, height + 2 * dl, n, phase).to_polygons()])
        return place(np.column_stack([pts, np.full(len(pts), w)]))
    e = ch + 1.0
    prism = Manifold.hull_points(np.vstack([rng(0, 0.0), rng(0, depth_face + 1.5)]))
    flare = Manifold.hull_points(np.vstack([rng(-0.1, depth_face - ch - 0.1, 45, 0.5),
                                            rng(e, depth_face + 1.0, 45, 0.5)]))
    return prism + flare


def side_slot(side, yc, length, height=4.8, ch=0.45):
    """Apertura passante nella parete laterale (side=-1 sinistra, +1 destra)."""
    inner = HW - 1.5
    # (u, v, w) -> (x = side * (w + inner), y = u + yc, z = v)
    return slot_cut(length, height, HW + OUTER - inner, ch, lambda q: np.column_stack(
        [side * (q[:, 2] + inner), q[:, 0] + yc, q[:, 1]]))


def bottom_slot(xc, length, height, ch=0.4):
    """Apertura passante nel bordo inferiore (asse Y-)."""
    inner = HL - 1.5
    # (u, v, w) -> (x = u + xc, y = -(w + inner), z = v)
    return slot_cut(length, height, HL + OUTER - inner, ch, lambda q: np.column_stack(
        [q[:, 0] + xc, -(q[:, 2] + inner), q[:, 1]]))


def y_from_top(d):
    return HL - d


def build():
    case = outer_body() - phone_cavity() - screen_opening() - camera_cut()

    # Lato sinistro: tasto Azione (31.67 +-3.02) e volumi (45.22 / 59.42 +-5.60)
    act_c = y_from_top(31.67)
    vol_top, vol_bot = y_from_top(45.22 - 5.60 - 1.3), y_from_top(59.42 + 5.60 + 1.3)
    cuts = [
        side_slot(-1, act_c, 2 * 3.02 + 2.6),
        side_slot(-1, (vol_top + vol_bot) / 2, vol_top - vol_bot),
        # Lato destro: tasto laterale (56.17 +-8.85)
        side_slot(+1, y_from_top(56.17), 2 * 8.85 + 2.6),
        # Fondo: USB-C centrata (keep-out Apple 12.45 x 6.60) e griglie
        bottom_slot(0.0, 13.6, 7.2),
        bottom_slot(-HW + (19.59 + 24.10) / 2, (24.10 - 19.59) + 2.8, 2.6),
        bottom_slot(-HW + (46.50 + 55.52) / 2, (55.52 - 46.50) + 2.8, 2.6),
    ]
    case = case - Manifold.batch_boolean(cuts, OpType.Add)
    # appoggia il dorso sul piatto (z = 0) e ripulisce i triangoli degeneri
    return case.translate((0, 0, -Z_BOT)).simplify(1e-5)


# ---------------------------------------------------------------- export
def mesh_arrays(mf):
    mesh = mf.to_mesh()
    v = np.asarray(mesh.vert_properties, dtype=np.float64)[:, :3]
    f = np.asarray(mesh.tri_verts, dtype=np.int64)
    return v, f


def write_stl(path, v, f):
    tri = v[f]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    with open(path, "wb") as fh:
        fh.write(b"Cover iPhone 15 Pro".ljust(80, b" "))
        fh.write(struct.pack("<I", len(f)))
        data = np.zeros(len(f), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)),
                                       ("a", "<u2")])
        data["n"] = n
        data["v"] = tri
        fh.write(data.tobytes())


def render_png(path, v, f, size=512, view="iso"):
    """Render semplice (z-buffer + shading) per le anteprime."""
    from PIL import Image
    c = (v.max(0) + v.min(0)) / 2
    p = v - c
    if view == "iso":
        az, el = math.radians(-35), math.radians(-60)
    else:  # "back"
        az, el = math.radians(20), math.radians(145)
    rz = np.array([[math.cos(az), -math.sin(az), 0], [math.sin(az), math.cos(az), 0], [0, 0, 1]])
    rx = np.array([[1, 0, 0], [0, math.cos(el), -math.sin(el)], [0, math.sin(el), math.cos(el)]])
    q = p @ rz.T @ rx.T
    ss = 3
    S = size * ss
    span = (q[:, :2].max(0) - q[:, :2].min(0)).max() * 1.08
    xy = (q[:, :2] / span + 0.5) * S
    xy[:, 1] = S - xy[:, 1]
    depth = q[:, 2]
    img = np.zeros((S, S, 3), np.float32)
    zb = np.full((S, S), -1e9, np.float32)
    tri = q[f]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    light = np.array([0.35, 0.45, 0.82]); light /= np.linalg.norm(light)
    base = np.array([0.93, 0.36, 0.22])
    shade = np.clip(n @ light, 0, 1) * 0.75 + 0.25
    for i, (a, b, cc) in enumerate(f):
        if n[i, 2] <= 0:
            continue
        pa, pb, pc = xy[a], xy[b], xy[cc]
        x0 = int(max(min(pa[0], pb[0], pc[0]), 0)); x1 = int(min(max(pa[0], pb[0], pc[0]) + 1, S - 1))
        y0 = int(max(min(pa[1], pb[1], pc[1]), 0)); y1 = int(min(max(pa[1], pb[1], pc[1]) + 1, S - 1))
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (pb[1] - pc[1]) * (pa[0] - pc[0]) + (pc[0] - pb[0]) * (pa[1] - pc[1])
        if abs(d) < 1e-12:
            continue
        w0 = ((pb[1] - pc[1]) * (gx - pc[0]) + (pc[0] - pb[0]) * (gy - pc[1])) / d
        w1 = ((pc[1] - pa[1]) * (gx - pc[0]) + (pa[0] - pc[0]) * (gy - pc[1])) / d
        w2 = 1 - w0 - w1
        mask = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not mask.any():
            continue
        z = w0 * depth[a] + w1 * depth[b] + w2 * depth[cc]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        upd = mask & (z > sub)
        sub[upd] = z[upd]
        img[y0:y1 + 1, x0:x1 + 1][upd] = base * shade[i]
    bg = zb < -1e8
    img[bg] = (1, 1, 1)
    alpha = (~bg).astype(np.float32)
    rgba = np.dstack([img, alpha]) * 255
    im = Image.fromarray(rgba.astype(np.uint8), "RGBA").resize((size, size), Image.LANCZOS)
    im.save(path)


def write_3mf(path, v, f, thumb_png):
    verts = "\n".join(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}"/>' for x, y, z in v)
    tris = "\n".join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in f)
    model = f"""<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="it-IT" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">Cover iPhone 15 Pro</metadata>
<metadata name="Designer">sitopiadineria</metadata>
<metadata name="Description">Cover per iPhone 15 Pro, stampare in TPU con il dorso sul piatto, senza supporti.</metadata>
<metadata name="CreationDate">{date.today().isoformat()}</metadata>
<metadata name="Application">genera_cover.py</metadata>
<resources>
<object id="1" name="Cover iPhone 15 Pro" type="model">
<mesh>
<vertices>
{verts}
</vertices>
<triangles>
{tris}
</triangles>
</mesh>
</object>
</resources>
<build>
<item objectid="1" transform="1 0 0 0 1 0 0 0 1 90 90 0" printable="1"/>
</build>
</model>
"""
    ctypes = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
<Default Extension="png" ContentType="image/png"/>
</Types>
"""
    rels = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
<Relationship Target="/Metadata/thumbnail.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>
</Relationships>
"""
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ctypes)
        z.writestr("_rels/.rels", rels)
        z.writestr("3D/3dmodel.model", model)
        z.write(thumb_png, "Metadata/thumbnail.png")


def smooth_normals(v, f, crease_deg=35.0):
    """Normali per vertice con spigoli vivi oltre `crease_deg` (per la USDZ)."""
    tri = v[f]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    cos_t = math.cos(math.radians(crease_deg))
    faces_of = [[] for _ in range(len(v))]
    for fi, row in enumerate(f):
        for vi in row:
            faces_of[vi].append(fi)
    out = np.zeros((len(f), 3, 3))
    for fi, row in enumerate(f):
        for k, vi in enumerate(row):
            adj = faces_of[vi]
            ns = fn[adj]
            keep = ns @ fn[fi] > cos_t
            n = ns[keep].sum(0)
            out[fi, k] = n / max(np.linalg.norm(n), 1e-12)
    return out


def write_usdz(path, v, f):
    """Modello per AR Quick Look su iPhone (in metri, asse Y verso l'alto)."""
    from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils, Vt
    usda = path[:-5] + ".usdc"
    stage = Usd.Stage.CreateNew(usda)
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
    UsdGeom.SetStageMetersPerUnit(stage, 1.0)
    root = UsdGeom.Xform.Define(stage, "/Cover")
    stage.SetDefaultPrim(root.GetPrim())
    c = (v.max(0) + v.min(0)) / 2
    p = (v - [c[0], c[1], v[:, 2].min()]) * 0.001
    pts = np.stack([p[:, 0], p[:, 2], -p[:, 1]], axis=1)     # z-up -> y-up
    mesh = UsdGeom.Mesh.Define(stage, "/Cover/Mesh")
    mesh.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(pts.astype(np.float32)))
    mesh.CreateFaceVertexCountsAttr(Vt.IntArray([3] * len(f)))
    mesh.CreateFaceVertexIndicesAttr(Vt.IntArray(f.reshape(-1).tolist()))
    mesh.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
    n = smooth_normals(v, f).reshape(-1, 3)
    n = np.stack([n[:, 0], n[:, 2], -n[:, 1]], axis=1)
    mesh.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(n.astype(np.float32)))
    mesh.SetNormalsInterpolation(UsdGeom.Tokens.faceVarying)
    mesh.CreateExtentAttr([Gf.Vec3f(*pts.min(0).tolist()), Gf.Vec3f(*pts.max(0).tolist())])
    mat = UsdShade.Material.Define(stage, "/Cover/Materiale")
    sh = UsdShade.Shader.Define(stage, "/Cover/Materiale/Surface")
    sh.CreateIdAttr("UsdPreviewSurface")
    sh.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(0.93, 0.36, 0.22))
    sh.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(0.55)
    sh.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)
    mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), "surface")
    UsdShade.MaterialBindingAPI.Apply(mesh.GetPrim()).Bind(mat)
    stage.GetRootLayer().Save()
    UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath(usda), path)
    os.remove(usda)


def main():
    case = build()
    assert case.status().name == "NoError", case.status()
    v, f = mesh_arrays(case)
    bb = v.max(0) - v.min(0)
    print(f"triangoli: {len(f)}  ingombro: {bb[0]:.2f} x {bb[1]:.2f} x {bb[2]:.2f} mm"
          f"  volume: {case.volume() / 1000:.1f} cm3  genus: {case.genus()}")
    stl = os.path.join(OUT, NAME + ".stl")
    write_stl(stl, v, f)
    thumb = os.path.join(OUT, "anteprima.png")
    render_png(thumb, v, f, 512, "iso")
    render_png(os.path.join(OUT, "anteprima_retro.png"), v, f, 512, "back")
    write_3mf(os.path.join(OUT, NAME + ".3mf"), v, f, thumb)
    print("scritti:", stl, NAME + ".3mf")
    try:
        write_usdz(os.path.join(OUT, NAME + ".usdz"), v, f)
        print("scritto:", NAME + ".usdz")
    except ImportError:
        print("USDZ saltato (pip install usd-core per generarlo)")


if __name__ == "__main__":
    main()
