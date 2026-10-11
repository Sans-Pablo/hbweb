"""Unidades nuevas: Nizie de apoyo (Healer / Buffer / Aura), derivadas del Nizie original (nizie0..39).
    python make_nizie.py CARPETA_DATA
Conserva fotogramas, pivotes y sombreado del original; solo mueve el matiz de su piel turquesa al color de la clase
(verde Healer, dorado Buffer, azul Aura: DUMMY_COLORS del renderer) y añade un brillo suave a las zonas claras.
Escribe znz{h,b,a}0..39 en sprites/, sprites.json y units.json."""
import json, os, sys
import numpy as np
from PIL import Image
out = sys.argv[1]
man_p, units_p = os.path.join(out, "sprites.json"), os.path.join(out, "units.json")
man, units = json.load(open(man_p)), json.load(open(units_p))
BASE_H = 165 / 360                                                    # matiz del Nizie original (turquesa)
VARS = [("h", "Nizie Healer", 125 / 360, 1.05), ("b", "Nizie Buffer", 46 / 360, 1.15), ("a", "Nizie Aura", 215 / 360, 1.0)]
for suf, name, hue, sat in VARS:
    for k in range(40):
        m = man["nizie%d" % k]; im = Image.open(os.path.join(out, "sprites", m["png"])).convert("RGBA")
        hsv = np.array(im.convert("RGB").convert("HSV")).astype(float); a = np.array(im)[..., 3]
        colored = hsv[..., 1] > 40                                       # piel y alas turquesa; el pelo/adornos neutros no se tocan
        h = (hsv[..., 0] / 255 + (hue - BASE_H)) % 1
        hsv[..., 0] = np.where(colored, h * 255, hsv[..., 0])
        hsv[..., 1] = np.where(colored, np.clip(hsv[..., 1] * sat, 0, 255), hsv[..., 1])
        rgb = np.array(Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")).astype(float)
        lum = rgb @ [0.299, 0.587, 0.114] / 255
        glow = np.clip((lum - 0.55) / 0.45, 0, 1)[..., None] * colored[..., None]       # brillo en las zonas claras
        tint = np.array(__import__("colorsys").hsv_to_rgb(hue, 0.45, 1.0)) * 255
        rgb = rgb * (1 - 0.35 * glow) + tint * 0.35 * glow
        Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8), "RGBA").save(os.path.join(out, "sprites", "znz%s%d.png" % (suf, k)))
        man["znz%s%d" % (suf, k)] = {"png": "znz%s%d.png" % (suf, k), "frames": m["frames"], "u": 1}
    units[name] = {"sprite": "znz" + suf, "type": 79, "n": 40, "pak": "derivada de NIZIE"}
    print(name, "ok")
json.dump(man, open(man_p, "w"), separators=(",", ":")); json.dump(units, open(units_p, "w"), indent=1)
