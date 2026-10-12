"""HD de la Pixie (Tutelary-Angel, hojas ututelarangel*): reescalado 4x con el mismo filtro que el resto (hdup.upscale).
    python make_pixie_hd.py CARPETA_DATA        -> data/sprites_hd/ututelarangel*.webp y entradas en sprites_hd.json"""
import json, os, sys
from PIL import Image
from hdup import upscale

K = 4
data = sys.argv[1]
out = os.path.join(data, "sprites_hd"); os.makedirs(out, exist_ok=True)
man = json.load(open(os.path.join(data, "sprites.json")))
fp = os.path.join(data, "sprites_hd.json"); hd = json.load(open(fp))
n = 0
for k, v in man.items():
    if not k.startswith("ututelarangel"): continue
    upscale(Image.open(os.path.join(data, "sprites", v["png"])).convert("RGBA"), K).save(os.path.join(out, k + ".webp"), "WEBP", quality=90, method=4)
    hd[k] = {"png": k + ".webp", "k": K}; n += 1
json.dump(hd, open(fp, "w"), separators=(",", ":"))
print(n, "hojas HD de la Pixie")
