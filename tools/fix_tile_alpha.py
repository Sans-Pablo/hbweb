#!/usr/bin/env python3
"""Corrige el alfa de las hojas de suelo (HD e IA): al reescalar la hoja entera, la fila de borde de cada casilla se mezclaba con la
casilla transparente vecina y dejaba una línea semitransparente (oscura sobre el fondo) cada vez que una casilla del bloque no tenía
vecina opaca. Aquí el alfa se reescala casilla a casilla (borde replicado) a partir del original. No toca el color.
  python3 tools/fix_tile_alpha.py [--dry]"""
import json, os, sys
import numpy as np, cv2
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "data")
man = json.load(open(os.path.join(ROOT, "sprites.json")))
dry = "--dry" in sys.argv
for mf, d in (("sprites_ia.json", "sprites_ia"), ("sprites_hd.json", "sprites_hd")):
    mp = os.path.join(ROOT, mf)
    if not os.path.exists(mp): continue
    for k, e in json.load(open(mp)).items():
        if k not in man or e.get("dir", d) != d: continue
        fr = [f for f in man[k]["frames"]]
        if not (len(fr) >= 100 and all(f[2] == 32 and f[3] == 32 for f in fr)): continue
        fp = os.path.join(ROOT, d, e["png"])
        if not os.path.exists(fp): continue
        o = np.array(Image.open(os.path.join(ROOT, "sprites", man[k]["png"])).convert("RGBA"))
        im = np.array(Image.open(fp).convert("RGBA")); K = e.get("k", 4)
        al = np.zeros(im.shape[:2], np.uint8); S = 32 * K
        for f in fr:
            x, y = f[0], f[1]
            if f[2] <= 0 or y + 32 > o.shape[0] or x + 32 > o.shape[1] or (y + 32) * K > im.shape[0]: continue
            al[y * K:y * K + S, x * K:x * K + S] = cv2.resize(o[y:y + 32, x:x + 32, 3], (S, S), interpolation=cv2.INTER_LINEAR)
        ch = int((al != im[..., 3]).sum())
        print(d, k, "píxeles de alfa corregidos:", ch)
        if dry or not ch: continue
        im[..., 3] = al
        Image.fromarray(im).save(fp, "WEBP", quality=90, method=4, exact=True)
