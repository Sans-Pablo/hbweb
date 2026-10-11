"""Núcleo de spritelab: manifiestos, recorte/empaquetado de fotogramas y recetas.

Convención: las hojas originales (web/data/sprites/*.png) NO se tocan nunca. Todo cambio vive en `art/`
(recetas + capas pintadas) y se reconstruye a `web/data/sprites_mod` (1x) y `web/data/sprites_hd` (HD)."""
import fnmatch, hashlib, json, os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "web", "data")
ART = os.path.join(ROOT, "art")
ALGO_VERSION = "2"          # súbelo si cambias el algoritmo de upscale/ops: invalida la caché


def jload(p, default=None):
    try:
        with open(p, encoding="utf-8") as f: return json.load(f)
    except FileNotFoundError: return default


def base_manifest():
    """sprites.json + players.json: {clave: {png, frames}}. (equip/fx quedan fuera: tienen su propio flujo.)"""
    m = jload(os.path.join(DATA, "sprites.json"), {})
    m.update(jload(os.path.join(DATA, "players.json"), {}))
    return m


def match(key, patterns):
    return any(fnmatch.fnmatchcase(key, p) for p in patterns)


def sheet_path(entry): return os.path.join(DATA, "sprites", entry["png"])


def load_sheet(entry):
    return np.array(Image.open(sheet_path(entry)).convert("RGBA"))


def split_frames(sheet, frames):
    return [sheet[fy:fy + fh, fx:fx + fw].copy() for fx, fy, fw, fh, *_ in frames]


def pack_frames(frames_img, frames, k, shape):
    """Coloca cada fotograma en su celda (x*k, y*k) de una hoja del tamaño original*k."""
    H, W = shape
    out = np.zeros((H * k, W * k, 4), np.uint8)
    for im, (fx, fy, fw, fh, *_) in zip(frames_img, frames):
        out[fy * k:(fy + fh) * k, fx * k:(fx + fw) * k] = im
    return out


def paint_path(key, f, hd=False):
    return os.path.join(ART, "paint_hd" if hd else "paint", key, f"{f}.png")


def file_hash(p):
    try:
        with open(p, "rb") as f: return hashlib.sha1(f.read()).hexdigest()[:12]
    except FileNotFoundError: return "-"


def rename(key, prefix_from, prefix_to):
    return prefix_to + key[len(prefix_from):] if key.startswith(prefix_from) else key


def resolve(recipes, base):
    """Aplica las reglas 'rules' en orden. Devuelve {clave_destino: {"src": clave_origen, "ops": [...]}}.
    Una regla con "as":[desde,hasta] CLONA (clave nueva); sin "as" modifica en sitio."""
    plan = {}
    for rule in recipes.get("rules", []):
        pats = rule.get("match", [])
        candidates = list(base) + [t for t in plan if t not in base]
        for s in [c for c in candidates if match(c, pats)]:
            if "as" in rule:
                t = rename(s, *rule["as"])
                if t == s: raise ValueError(f"regla 'as' {rule['as']} no cambia la clave {s}")
                plan[t] = {"src": plan[s]["src"] if s in plan else s,
                           "ops": list(plan[s]["ops"]) if s in plan else []}
                plan[t]["ops"] += rule.get("ops", [])
            else:
                plan.setdefault(s, {"src": s, "ops": []})["ops"] += rule.get("ops", [])
    return plan


def hd_params(recipes, key):
    """Parámetros HD de una clave, o None si queda excluida."""
    hd = recipes.get("hd", {})
    if hd.get("include") and not match(key, hd["include"]): return None
    if match(key, hd.get("exclude", [])): return None
    p = dict(hd.get("default", {}))
    for o in hd.get("overrides", []):
        if match(key, o["match"]): p.update({k: v for k, v in o.items() if k != "match"})
    return p
