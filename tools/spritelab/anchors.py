#!/usr/bin/env python3
"""Anclajes por fotograma (relativos al pivote) -> web/data/anchors.json.  Uso: anchors.py build | check <patron> [-o f.png]

Anclajes (todos [x,y] relativos al pivote, como pvx+px / pvy+py; null si el fotograma no lo tiene):
  eyes   Liche: centro de la cara. Parte alta de la capucha (mayor trazo "de tela", sin báculo ni orbe)
         + desplazamiento fijo medido en el fotograma de reposo de la misma dirección.
  orb    Liche: centroide de los píxeles violeta más altos (orbe del báculo)."""
import json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import core
from core import DATA

ART_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "art")
GROUPS = 5      # reposo, andar, atacar, daño, morir


def _cloth(fr):
    r, g, b, a = [fr[..., i].astype(int) for i in range(4)]
    return (a > 200) & (r > g + 12) & (r >= b) & ~((b > 100) & (b > g + 45))


def _violet(fr):
    r, g, b, a = [fr[..., i].astype(int) for i in range(4)]
    return (a > 200) & (b > 100) & (b > g + 45) & (r > g + 10)


def _largest(mask):
    n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8)))
    if n < 2: return None
    i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    return (lab == i) & mask


def head_top(fr):
    """(x, y_top) de la capucha en coordenadas del fotograma, o None."""
    m = _largest(_cloth(fr))
    if m is None or m.sum() < 30: return None
    ys, xs = np.nonzero(m); top = ys.min()
    sel = ys < top + 5
    return float(xs[sel].mean()), float(top)


def _white(fr):
    r, g, b, a = [fr[..., i].astype(int) for i in range(4)]
    return (a > 200) & (np.minimum(np.minimum(r, g), b) > 165) & (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b) < 40)


def face(fr, ht, off=None, tol=None):
    """Ojos (x, y) en coordenadas del fotograma. Candidatos: máscaras blancas bajo la capucha; con 'off' (desplazamiento cara-coronilla
    medido en reposo) solo vale la que cae a <= tol px de lo esperado (así no se confunde con los guantes) y, si no hay ninguna
    (cabeza agachada), se usa la posición esperada. Sin 'off' (reposo) devuelve la mejor máscara o None."""
    if ht is None: return None
    m = _white(fr).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, connectivity=8)
    H = fr.shape[0]; best = None
    ex = (ht[0] + off[0], ht[1] + off[1]) if off else (ht[0], ht[1] + 0.12 * H)
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area < 8 or w > 22 or h > 26: continue
        c = (x + w / 2, y + h * 0.42); d = abs(c[0] - ex[0]) + abs(c[1] - ex[1]) * 0.7
        if off:
            if area >= 30 and h >= w * 1.1 and abs(c[0] - ex[0]) <= 40 and abs(c[1] - ex[1]) <= 24: d = -area                       # máscara grande = cara (los guantes miden < 20 px)
            elif area < 14 or abs(c[0] - ex[0]) > tol or abs(c[1] - ex[1]) > 5: continue
        elif abs(c[0] - ht[0]) > 14 or not 0 <= y - ht[1] <= 0.4 * H: continue
        if best is None or d < best[0]: best = (d, c[0], c[1])
    if best: return float(best[1]), float(best[2])
    return (float(ex[0]), float(ex[1])) if off else None


def orb(fr):
    m = _violet(fr); ys, xs = np.nonzero(m)
    if len(ys) <= 3: return None
    sel = ys < ys.min() + 9
    return float(xs[sel].mean()), float(ys[sel].mean())


def liche(base, prefix="liche"):
    """Esqueleto mínimo por dirección: coronilla (head_top) por fotograma + desplazamiento cara-coronilla de esa dirección (mediana en reposo).
    Direcciones sin máscara en reposo (de espaldas) no llevan ojos."""
    out = {}
    for d in range(8):
        rest = base[f"{prefix}{d}"]; offs = []
        for fr in core.split_frames(core.load_sheet(rest), rest["frames"]):
            ht = head_top(fr); f = face(fr, ht)
            if f: offs.append((f[0] - ht[0], f[1] - ht[1]))
        off = (float(np.median([o[0] for o in offs])), float(np.median([o[1] for o in offs]))) if len(offs) >= max(2, len(rest["frames"]) // 2) else None
        for g in range(GROUPS):
            key = f"{prefix}{g * 8 + d}"; e = base[key]
            out[key] = {"eyes": [], "orb": []}
            for i, fr in enumerate(core.split_frames(core.load_sheet(e), e["frames"])):
                pvx, pvy = e["frames"][i][4], e["frames"][i][5]
                h = face(fr, head_top(fr), off, 10) if off else None
                if h and g == 4 and i >= 2: h = None                   # muriendo: cuerpo desplomado, la cara ya no se ve (los ojos se apagan)
                o = orb(fr)
                out[key]["eyes"].append([round(pvx + h[0], 1), round(pvy + h[1], 1)] if h else None)
                out[key]["orb"].append([round(pvx + o[0], 1), round(pvy + o[1], 1)] if o else None)
    return out


def demon_head(fr, pvx, off=14):
    """Demon: banda central (+-9 px del pivote) -> fila opaca mas alta (cuernos/cabeza) + desplazamiento fijo hacia abajo. Coordenadas del fotograma."""
    a = fr[..., 3] > 200; W = a.shape[1]
    x0, x1 = max(0, int(-pvx) - 9), min(W, int(-pvx) + 10)
    rows = np.nonzero(a[:, x0:x1].sum(axis=1) >= 3)[0]
    if len(rows) == 0: return None
    top = int(rows[0]); cols = np.nonzero(a[top:top + 6, x0:x1].any(axis=0))[0]
    return float(x0 + cols.mean()) if len(cols) else float(-pvx), float(top + off)


def demon_hands(fr, pvx, d):
    """Demon: manos. Pixeles rojos del cuerpo (no las alas pardas), abiertos con un kernel 5x5 para quitar la cola y los huesos de ala finos,
    y una ventana vertical bajo la cara (los muslos y las rodillas quedan fuera). De frente/espaldas: punto mas bajo del brazo a cada lado
    fuera de las piernas. De perfil/diagonal: solo la mano delantera (la mas adelantada en el sentido que mira). Devuelve [izq, der] (None si no hay)."""
    r, g, b, a = [fr[..., i].astype(int) for i in range(4)]
    m = ((a > 200) & (r > g * 1.5) & (r > 100) & (b < g + 12)).astype(np.uint8)
    mo = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)).astype(bool); m = m.astype(bool)
    h = demon_head(fr, pvx)
    if h is None: return [None, None]
    H, W = m.shape; cx = -pvx; y0, y1 = int(h[1]) + 8, int(h[1]) + 60
    win = np.zeros_like(m); win[y0:y1, :] = True
    pts = lambda sel, mm=None: np.nonzero((m if mm is None else mm) & win & sel)
    if d in (0, 4):                                                    # de frente (4) o de espaldas (0)
        out = []
        for sgn in (-1, 1):
            xs_ = np.arange(W); sel = np.tile((19 <= sgn * (xs_ - cx)) & (sgn * (xs_ - cx) <= 48), (H, 1))
            ys, xs = pts(sel, mo)
            if len(ys) < 10: out.append(None); continue
            k = ys >= ys.max() - 5; out.append((float(xs[k].mean()), float(ys[k].mean())))
        return out
    right = d in (1, 2, 3)                                             # mira a la derecha (dir 2, 3, 4 del juego) o a la izquierda
    sel = np.tile(np.arange(W) > cx + 4 if right else np.arange(W) < cx - 4, (H, 1))
    sg = 1 if right else -1; fb = (h[0] + sg * 22, h[1] + 34)           # sin punto fiable: desplazamiento fijo desde la cabeza, del lado al que mira
    ys, xs = pts(sel)
    p = fb
    if len(ys) >= 6:
        ex = xs.max() if right else xs.min(); k = np.abs(xs - ex) <= 4
        q = (float(xs[k].mean()), float(ys[k].mean()))
        if 10 <= sg * (q[0] - h[0]) <= 40 and 20 <= q[1] - h[1] <= 50: p = q   # la cola, el ala o la rodilla caen fuera de esta caja
    return [None, p] if right else [p, None]


def demon(base, prefix="demon"):
    out = {}
    for d in range(8):
        for g in range(GROUPS):
            key = f"{prefix}{g * 8 + d}"
            if key not in base: continue
            e = base[key]; out[key] = {"eyes": [], "orb": [], "hands": []}
            for i, fr in enumerate(core.split_frames(core.load_sheet(e), e["frames"])):
                pvx, pvy = e["frames"][i][4], e["frames"][i][5]
                hh = demon_hands(fr, pvx, d)
                out[key]["hands"].append([[round(pvx + p[0], 1), round(pvy + p[1], 1)] if p else None for p in hh])
                h = None if (d not in (3, 4, 5) or (g == 4 and i >= 2)) else demon_head(fr, pvx)    # de espaldas y de perfil sin ojos
                out[key]["eyes"].append([round(pvx + h[0], 1), round(pvy + h[1], 1)] if h else None)
                out[key]["orb"].append(None)
    return out


def cmd_build(_):
    base = core.base_manifest()
    path = os.path.join(DATA, "anchors.json")
    out = core.jload(path, {})
    out.update(liche(base))
    out.update(demon(base))
    man = core.jload(os.path.join(ART_DIR, "anchors_manual.json"), {})        # puntos puestos a mano (web/anclas.html): pisan a los automáticos
    for k, v in man.items():
        for i, p in enumerate(v.get("eyes", [])):
            if k in out and i < len(out[k]["eyes"]) and p is not False: out[k]["eyes"][i] = p
    with open(path, "w", encoding="utf-8", newline="\r\n") as f: json.dump(out, f, separators=(",", ":"))
    print(f"anchors.json: {len(out)} claves")


def cmd_check(a):
    """Hoja de contacto: cada fotograma con ojos (rojo) y orbe (violeta)."""
    import fnmatch
    base = core.base_manifest(); anc = core.jload(os.path.join(DATA, "anchors.json"), {})
    keys = [k for k in anc if any(fnmatch.fnmatchcase(k, p) for p in a.keys)]
    Z, cells = 3, []
    for k in keys:
        e = base[k]
        for i, fr in enumerate(core.split_frames(core.load_sheet(e), e["frames"])):
            im = Image.fromarray(fr).resize((fr.shape[1] * Z, fr.shape[0] * Z), Image.NEAREST).convert("RGBA")
            bg = Image.new("RGBA", im.size, (70, 70, 80, 255)); bg.alpha_composite(im); dr = ImageDraw.Draw(bg)
            pvx, pvy = e["frames"][i][4], e["frames"][i][5]
            for nm, col in (("eyes", (255, 0, 0)), ("orb", (0, 255, 255)), ("hands", (0, 255, 0))):
                p = anc[k].get(nm, [None] * 99)[i]
                for p in ([p] if nm != "hands" else (p or [])):
                  if p: x, y = (p[0] - pvx) * Z, (p[1] - pvy) * Z; dr.ellipse((x - 4, y - 4, x + 4, y + 4), outline=col, width=2)
            dr.text((2, 2), f"{k}:{i}", fill=(255, 255, 255)); cells.append(bg)
    cols = a.cols; rows = (len(cells) + cols - 1) // cols
    cw, ch = max(c.width for c in cells), max(c.height for c in cells)
    sheet = Image.new("RGB", (cw * cols, ch * rows), (30, 30, 36))
    for n, c in enumerate(cells): sheet.paste(c.convert("RGB"), ((n % cols) * cw, (n // cols) * ch))
    sheet.save(a.o); print(a.o, sheet.size, len(cells))


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("build").set_defaults(fn=cmd_build)
    c = sp.add_parser("check"); c.add_argument("keys", nargs="+"); c.add_argument("-o", default="art/anchors_check.png"); c.add_argument("--cols", type=int, default=8)
    c.set_defaults(fn=cmd_check)
    a = ap.parse_args(); a.fn(a)
