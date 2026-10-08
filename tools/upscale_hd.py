"""Versión HD de los sprites de personajes, monstruos y objetos (reescalado 4x que conserva el pixel art
sin escalones: Scale2x repetido + suavizado + enfoque). No inventa detalle: solo elimina el pixelado.
    python upscale_hd.py CARPETA_DATA          (lee data/sprites.json, players.json y data/sprites/*.png)
Salida: data/sprites_hd/<clave>.webp y data/sprites_hd.json  ({clave: {png, k}})."""
import json, os, sys
from multiprocessing import Pool
from PIL import Image
from hdup import upscale

K = 4
PREFIX = ("pb", "ph", "pu", "slm", "ske", "scp", "gol", "ant", "amp", "ig", "ip")
data = sys.argv[1]
out = os.path.join(data, "sprites_hd")
os.makedirs(out, exist_ok=True)
man = json.load(open(os.path.join(data, "sprites.json")))
try: man.update(json.load(open(os.path.join(data, "players.json"))))
except FileNotFoundError: pass
keys = [k for k in man if k.startswith(PREFIX) and k[len([p for p in PREFIX if k.startswith(p)][0]):][:1].isdigit() or k.startswith(("pb", "ph", "pu"))]

def work(k):
    dst = os.path.join(out, k + ".webp")
    if os.path.exists(dst): return k, man[k]["png"]
    img = Image.open(os.path.join(data, "sprites", man[k]["png"])).convert("RGBA")
    upscale(img, K).save(dst, "WEBP", quality=88, method=4)
    return k, man[k]["png"]

if __name__ == "__main__":
    with Pool() as p: done = p.map(work, keys, chunksize=8)
    json.dump({k: {"png": k + ".webp", "k": K} for k, _ in done}, open(os.path.join(data, "sprites_hd.json"), "w"), separators=(",", ":"))
    print(len(done), "sprites HD")
