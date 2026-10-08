"""HD (4x) del equipo: añade las hojas de data/equip a data/sprites_hd. python upscale_equip.py DATA"""
import json, os, sys
from multiprocessing import Pool
from PIL import Image
from hdup import upscale
data = sys.argv[1]; out = os.path.join(data, "sprites_hd")
man = json.load(open(os.path.join(data, "equip.json")))
def work(k):
    dst = os.path.join(out, k + ".webp")
    if not os.path.exists(dst):
        upscale(Image.open(os.path.join(data, "equip", man[k]["png"])).convert("RGBA"), 4).save(dst, "WEBP", quality=80, method=4)
    return k
if __name__ == "__main__":
    with Pool() as p: ks = p.map(work, list(man), chunksize=16)
    hd = json.load(open(os.path.join(data, "sprites_hd.json")))
    for k in ks: hd[k] = {"png": k + ".webp", "k": 4}
    json.dump(hd, open(os.path.join(data, "sprites_hd.json"), "w"), separators=(",", ":"))
    print(len(ks))
