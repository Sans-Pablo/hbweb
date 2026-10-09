#!/usr/bin/env python3
"""Convierte a WebP sin pérdida los PNG de sprites y fx (típicamente -30..50 %).
Salida junto al PNG (.webp) y marcador data/webp.json al final. Los .webp NO se versionan (.gitignore);
el cliente los usa si existe el marcador y, si no, sirve los PNG. Uso: python3 tools/to_webp.py [web/data]"""
import sys, json, os
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

DIRS = ["sprites", "fx"]   # sprites_hd y equip ya son WebP versionados

def conv(path):
    out = path[:-4] + ".webp"
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(path):
        return os.path.getsize(path), os.path.getsize(out)
    Image.open(path).save(out, "WEBP", lossless=True, quality=100, method=4)
    return os.path.getsize(path), os.path.getsize(out)

if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "web", "data")
    files = [os.path.join(root, d, f) for d in DIRS if os.path.isdir(os.path.join(root, d)) for f in os.listdir(os.path.join(root, d)) if f.endswith(".png")]
    with ProcessPoolExecutor() as ex:
        res = list(ex.map(conv, files, chunksize=8))
    a, b = sum(r[0] for r in res), sum(r[1] for r in res)
    json.dump({"files": len(files), "png": a, "webp": b}, open(os.path.join(root, "webp.json"), "w"))
    print(f"{len(files)} imágenes: {a/1048576:.0f} MB -> {b/1048576:.0f} MB ({100*(1-b/a):.0f} % menos)")
