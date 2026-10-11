"""Operaciones sobre un fotograma RGBA uint8 (H,W,4). Cada una: op(img, p, ctx) -> img.
ctx = {"key", "src", "f", "k"} (k = factor de escala del fotograma actual: 1 en la fase de píxel, K en la HD).
Una op va a la fase HD con "hd": true en la receta. Registrar nuevas con @op("nombre")."""
import cv2, numpy as np
from PIL import Image
from core import paint_path

OPS = {}
def op(name):
    def deco(fn): OPS[name] = fn; return fn
    return deco


def hexrgb(c):
    c = c.lstrip("#"); return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def _select(img, p):
    """Máscara de píxeles afectados: opacos y dentro de 'where' (tono 0-360, sat/val en 0-1)."""
    m = img[..., 3] > 0
    w = p.get("where")
    if w:
        hsv = cv2.cvtColor(np.ascontiguousarray(img[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
        h, s, v = hsv[..., 0] * 360 / 256, hsv[..., 1] / 255, hsv[..., 2] / 255
        if "hue" in w:
            lo, hi = w["hue"]
            m &= ((h >= lo) & (h <= hi)) if lo <= hi else ((h >= lo) | (h <= hi))
        m &= (s >= w.get("sat_min", 0)) & (s <= w.get("sat_max", 1)) & (v >= w.get("val_min", 0)) & (v <= w.get("val_max", 1))
    return m


def _blend(img, new_rgb, m, amount=1.0):
    out = img.copy()
    mix = img[..., :3].astype(np.float32) * (1 - amount) + new_rgb * amount
    out[..., :3] = np.where(m[..., None], np.clip(mix, 0, 255), img[..., :3]).astype(np.uint8)
    return out


@op("hue")
def hue(img, p, ctx):
    """Cambia tono (grados), saturación y valor (multiplicadores) de los píxeles elegidos."""
    m = _select(img, p)
    hsv = cv2.cvtColor(np.ascontiguousarray(img[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
    hsv[..., 0] = (hsv[..., 0] + p.get("shift", 0) * 256 / 360) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * p.get("sat", 1), 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * p.get("val", 1), 0, 255)
    rgb = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB_FULL).astype(np.float32)
    return _blend(img, rgb, m, p.get("amount", 1.0))


@op("tint")
def tint(img, p, ctx):
    """Mezcla un color con los píxeles elegidos (multiplicativo si "mode":"multiply")."""
    m, c = _select(img, p), hexrgb(p["color"])
    base = img[..., :3].astype(np.float32)
    new = base * c / 255 if p.get("mode") == "multiply" else np.broadcast_to(c, base.shape)
    return _blend(img, new, m, p.get("amount", 0.3))


@op("levels")
def levels(img, p, ctx):
    """gamma (<1 aclara), contrast, brightness (-1..1)."""
    m = _select(img, p)
    x = (img[..., :3].astype(np.float32) / 255) ** p.get("gamma", 1.0)
    x = (x - 0.5) * p.get("contrast", 1.0) + 0.5 + p.get("brightness", 0.0)
    return _blend(img, np.clip(x, 0, 1) * 255, m)


@op("remap")
def remap(img, p, ctx):
    """Sustituye un color (con tolerancia) por otro; con "keep_luma" conserva la luminosidad relativa."""
    src, dst, tol = hexrgb(p["from"]), hexrgb(p["to"]), p.get("tol", 24)
    d = np.sqrt(((img[..., :3].astype(np.float32) - src) ** 2).sum(-1))
    m = (img[..., 3] > 0) & (d <= tol)
    new = np.broadcast_to(dst, img[..., :3].shape).copy()
    if p.get("keep_luma"):
        new = np.clip(new * img[..., :3].astype(np.float32).mean(-1, keepdims=True) / max(src.mean(), 1), 0, 255)
    return _blend(img, new, m)


@op("outline")
def outline(img, p, ctx):
    """Contorno exterior de 'width' px (se multiplica por k salvo "scaled": false) con color y opacidad."""
    w = max(1, int(p.get("width", 1) * (ctx["k"] if p.get("scaled", True) else 1)))
    a = (img[..., 3] > 127).astype(np.uint8)
    ring = cv2.dilate(a, np.ones((2 * w + 1, 2 * w + 1), np.uint8)) & (1 - a)
    out = img.copy()
    out[ring > 0, :3] = hexrgb(p.get("color", "#000000")).astype(np.uint8)
    out[ring > 0, 3] = int(255 * p.get("alpha", 1.0))
    return out


@op("shade")
def shade(img, p, ctx):
    """Luz direccional suave a lo largo de 'dir' (top, bottom, left, right): aclara el lado de la luz."""
    H, W = img.shape[:2]
    axis, sign = {"top": (0, 1), "bottom": (0, -1), "left": (1, 1), "right": (1, -1)}[p.get("dir", "top")]
    g = np.linspace(1, -1, H if axis == 0 else W, dtype=np.float32) * sign
    g = g[:, None] if axis == 0 else g[None, :]
    k = 1 + g * p.get("amount", 0.15)
    return _blend(img, np.clip(img[..., :3].astype(np.float32) * k[..., None], 0, 255), _select(img, p))


@op("glow")
def glow(img, p, ctx):
    """Halo aditivo alrededor de los píxeles elegidos (p. ej. ojos); radius en px de la escala actual."""
    m = _select(img, p).astype(np.float32)
    r = max(1, p.get("radius", 2) * (ctx["k"] if p.get("scaled", True) else 1))
    g = cv2.GaussianBlur(m, (0, 0), r) * p.get("strength", 0.8)
    out = img.copy()
    out[..., :3] = np.clip(img[..., :3].astype(np.float32) + g[..., None] * hexrgb(p.get("color", "#ff4020")), 0, 255).astype(np.uint8)
    out[..., 3] = np.maximum(img[..., 3], (np.clip(g, 0, 1) * 255 * p.get("alpha", 0.5)).astype(np.uint8))
    return out


@op("paint")
def paint(img, p, ctx):
    """Compone encima art/paint[_hd]/<clave>/<fotograma>.png (mismo tamaño que el fotograma en esa fase).
    "from" permite reutilizar la capa de otra clave."""
    path = paint_path(p.get("from", ctx["src"]), ctx["f"], hd=ctx["k"] > 1)
    try: layer = np.array(Image.open(path).convert("RGBA"))
    except FileNotFoundError: return img
    if layer.shape != img.shape:
        raise ValueError(f"{path}: {layer.shape[:2]} != fotograma {img.shape[:2]}")
    a = layer[..., 3:4].astype(np.float32) / 255
    out = img.copy()
    out[..., :3] = (layer[..., :3] * a + img[..., :3] * (1 - a)).astype(np.uint8)
    out[..., 3] = np.maximum(img[..., 3], layer[..., 3])
    return out


def clean(img, max_area=6, gap=2):
    """Regla base (siempre activa): borra motas sueltas (grupos de <= max_area px aislados a más de 'gap' px del cuerpo).
    Quita el ruido de los sprites originales para obtener modelos más limpios."""
    a = (img[..., 3] > 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(a, np.ones((2 * gap + 1, 2 * gap + 1), np.uint8)), connectivity=8)
    out = img.copy()
    for i in range(1, n):
        comp = (lab == i) & (a > 0)
        if comp.sum() <= max_area: out[comp] = 0
    return out


@op("despeckle")
def despeckle(img, p, ctx):
    """Limpieza manual con otros umbrales: {"op":"despeckle","max_area":12,"gap":3}."""
    return clean(img, p.get("max_area", 6), p.get("gap", 2))


def apply(img, ops, ctx):
    for o in ops:
        o = dict(o); name = o.pop("op"); o.pop("hd", None)
        img = OPS[name](img, o, ctx)
    return img
