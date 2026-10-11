"""Variantes de color de la Sorceress para los summons de apoyo: Healer (pelo verde) y Buffer (pelo azul); el Aura conserva
el pelo amarillo original. Solo se recolorea el pelo: los píxeles amarillos muy saturados (matiz 40-65°); la piel queda intacta.
    python make_summon_sprites.py SALIDA        (SALIDA = web/data; hace falta haber corrido convert_units.py)"""
import colorsys, json, os, sys
from PIL import Image

out = sys.argv[1]
man_path = os.path.join(out, "sprites.json")
manifest = json.load(open(man_path))
HUES = {"uhealer": 125, "ubuffer": 215}      # grados
for key, hue in HUES.items():
    for k in range(40):
        src = manifest.get("usorceress%d" % k)
        if not src: continue
        im = Image.open(os.path.join(out, "sprites", src["png"])).convert("RGBA")
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if not a: continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if s > 0.55 and 40 <= h * 360 <= 65:
                    r, g, b = (round(c * 255) for c in colorsys.hsv_to_rgb(hue / 360, s, v))
                    px[x, y] = (r, g, b, a)
        name = "%s%d" % (key, k)
        im.save(os.path.join(out, "sprites", name + ".png"), optimize=True)
        manifest[name] = dict(src, png=name + ".png")
json.dump(manifest, open(man_path, "w"), separators=(",", ":"))
print("ok", list(HUES))
