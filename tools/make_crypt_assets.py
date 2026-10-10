"""Sprites propios del port, hechos a partir de arte original (idempotente; escribe PNG y parchea los JSON del cliente).
    python3 tools/make_crypt_assets.py
  - equip/cryptdoor.webp (+ entrada «cryptdoor» en equip.json): la entrada de dungeon de middled1n (puerta de ladrillo, hoja t303, casillas 30-34 x 29-34 junto
    a los teleports de (31,34)), recortada con bordes difuminados. La cripta la usa para TODAS sus salidas y bajadas (renderer.drawPortals).
  - ui/pet_support|pet_damage|pet_warrior.png, ui/recall_icon.png: botones de la ventana Summons y de la barra (mismo bisel).
  - ui/summons_icon.png (+ «summons_icon» en ui.json): botón «Summons» de la barra inferior. Dos fotogramas: reposo (grabado en piedra, como los
    iconos horneados de gamedialog2_6) y resalte (colores). Es una huella de garra, con el mismo bisel que el resto."""
import json, os, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, "..", "web", "data")

# ---------------------------------------------------------------- puerta
# Puerta de salida dibujada a mano (el recorte de las teselas del original quedaba como una escalera rota): arco de ladrillo con escalera.
import random
S = 3; W, H = 128, 160
rnd = random.Random(7)
im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
def R(x0, y0, x1, y1, c): dr.rectangle([x0 * S, y0 * S, x1 * S, y1 * S], fill=c)
# muro de ladrillo
wx0, wx1, wy0, wy1 = 8, 120, 14, 142
for row, y in enumerate(range(wy0, wy1, 8)):
    off = 0 if row % 2 else 8
    for x in range(wx0 - off, wx1, 16):
        k = rnd.randint(-14, 14); c = (92 + k, 52 + k // 2, 44 + k // 2, 255)
        R(max(wx0, x), y, min(wx1, x + 15), y + 6, c)
# arco: hueco oscuro con medio punto
ax0, ax1, ay0, ay1 = 36, 92, 52, 142
dr.rectangle([ax0 * S, (ay0 + 28) * S, ax1 * S, ay1 * S], fill=(6, 4, 4, 255))
dr.pieslice([ax0 * S, ay0 * S, ax1 * S, (ay0 + 56) * S], 180, 360, fill=(6, 4, 4, 255))
# dovelas claras alrededor del arco
for i in range(15):
    a0 = math.pi + i * math.pi / 14; a1 = a0 + math.pi / 14 * .86
    cx, cy, r0, r1 = 64, ay0 + 28, 28, 38
    pts = [(cx + r0 * math.cos(a0), cy + r0 * math.sin(a0)), (cx + r1 * math.cos(a0), cy + r1 * math.sin(a0)), (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1)), (cx + r0 * math.cos(a1), cy + r0 * math.sin(a1))]
    k = rnd.randint(-10, 10); dr.polygon([(x * S, y * S) for x, y in pts], fill=(138 + k, 124 + k, 108 + k, 255))
for y in range(ay0 + 28, ay1, 9):                                  # jambas de piedra
    k = rnd.randint(-8, 8)
    R(ax0 - 9, y, ax0 - 1, y + 7, (132 + k, 118 + k, 102 + k, 255)); R(ax1 + 1, y, ax1 + 9, y + 7, (132 + k, 118 + k, 102 + k, 255))
# interior: sombra y brillo cálido al fondo
inner = Image.new("RGBA", im.size, (0, 0, 0, 0)); idr = ImageDraw.Draw(inner)
for y in range(ay0 + 30, ay1 - 22):                                 # brillo cálido que sube desde el fondo
    t = (y - ay0 - 30) / (ay1 - 22 - ay0 - 30)
    idr.rectangle([(ax0 + 2) * S, y * S, (ax1 - 2) * S, (y + 1) * S], fill=(int(70 * t * t), int(34 * t * t), int(12 * t * t), int(150 * t * t)))
im.alpha_composite(inner)
# escalera hacia fuera (4 peldaños)
for i in range(4):
    y0 = ay1 - 22 + i * 6; x0, x1 = ax0 - 4 - i * 4, ax1 + 4 + i * 4; k = 70 + i * 22
    R(x0, y0, x1, y0 + 4, (k + 40, k + 30, k + 18, 255)); R(x0, y0 + 4, x1, y0 + 6, (k - 30, k - 36, k - 40, 255))
im = im.resize((W, H), Image.LANCZOS)
al = im.getchannel("A")
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))                    # sombra de contacto en el suelo
ImageDraw.Draw(glow).ellipse([2, H - 26, W - 2, H - 2], fill=(0, 0, 0, 110))
door = glow.filter(ImageFilter.GaussianBlur(4)); door.alpha_composite(im)
PX, PY = 64, 146
os.makedirs(os.path.join(D, "equip"), exist_ok=True)
door.save(os.path.join(D, "equip", "cryptdoor.webp"), "WEBP", lossless=True, quality=100, method=6)      # equip/ va siempre en WebP versionado (imgUrl lo exige)
eq = json.load(open(os.path.join(D, "equip.json")))
eq["cryptdoor"] = {"png": "cryptdoor.webp", "frames": [[0, 0, W, H, -PX, -PY]]}      # el suelo bajo la puerta cae en el centro de la casilla
json.dump(eq, open(os.path.join(D, "equip.json"), "w"), separators=(",", ":"))

# ---------------------------------------------------------------- icono Summons
ui = json.load(open(os.path.join(D, "ui.json")))
bar = Image.open(os.path.join(D, "ui", "gamedialog2_6.png")).convert("RGBA")
fr = ui["gamedialog2_6"]["frames"]
def paw(size, scale=6):
    s = size * scale
    m = Image.new("L", (s, s), 0); d = ImageDraw.Draw(m)
    cx, cy = s * .5, s * .62
    d.ellipse((cx - s * .24, cy - s * .12, cx + s * .24, cy + s * .26), fill=255)                  # almohadilla
    for dx, dy, r in ((-.30, -.08, .095), (-.12, -.27, .105), (.12, -.27, .105), (.30, -.08, .095)):   # dedos
        d.ellipse((cx + s * dx - s * r, cy + s * dy - s * r * 1.25, cx + s * dx + s * r, cy + s * dy + s * r * 1.25), fill=255)
    return m.resize((size, size), Image.LANCZOS)
def bevel(mask, light, dark, base_top, base_bot):
    """Grabado: relleno degradado + luz arriba-izquierda y sombra abajo-derecha + contorno oscuro."""
    w, h = mask.size
    fill = Image.new("RGBA", (w, h))
    for y in range(h):
        t = y / (h - 1); c = tuple(int(base_top[i] * (1 - t) + base_bot[i] * t) for i in range(3))
        for x in range(w): fill.putpixel((x, y), c + (255,))
    inner = mask.filter(ImageFilter.MinFilter(3))
    edge = ImageChops.subtract(mask, inner)
    hi = ImageChops.subtract(mask, ImageChops.offset(mask, 1, 1)); lo = ImageChops.subtract(mask, ImageChops.offset(mask, -1, -1))
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0)); out.paste(fill, (0, 0), mask)
    out.paste(Image.new("RGBA", (w, h), light + (255,)), (0, 0), hi)
    out.paste(Image.new("RGBA", (w, h), dark + (255,)), (0, 0), ImageChops.lighter(lo, edge))
    return out
def slot(frame_idx, box, clear):
    """casilla de piedra de la barra con el dibujo borrado: se rellena el centro con el tono de las esquinas interiores."""
    sx, sy, _, _, px, py = fr[frame_idx]
    t = bar.crop((box[0], box[1], box[0] + box[2], box[1] + box[3])).copy()
    return t
def build(mask, name):
    global ui
    # reposo: se toma la casilla del libro de hechizos de la barra (x 484..521, y 554-548+67) y se borra el dibujo
    ox, oy, w, h = 484 + 90, 67 + 6, 37, 41                 # la barra (800 px) se dibuja a +90 de las coordenadas de los iconos (gui.js)
    base = bar.crop((ox, oy, ox + w, oy + h)).copy()
    cx0, cy0, cx1, cy1 = 4, 5, 33, 36
    ref = [base.getpixel((x, y)) for x in (5, 31) for y in (6, 35)]
    avg = tuple(sum(p[i] for p in ref) // 4 for i in range(3)) + (255,)
    random.seed(7)
    for y in range(cy0, cy1):
        for x in range(cx0, cx1):
            n = random.randint(-9, 9); base.putpixel((x, y), tuple(max(0, min(255, avg[i] + n)) for i in range(3)) + (255,))
    base = base.filter(ImageFilter.GaussianBlur(0.4)) if False else base
    g = bevel(mask, (214, 214, 214), (46, 46, 52), (172, 172, 178), (96, 96, 104))
    base.alpha_composite(g, (cx0, cy0 + 1))
    # resalte: casilla coloreada (hover) con la misma limpieza
    hv = fr[8]; hx, hy, hw, hh = hv[0], hv[1], hv[2], hv[3]
    hov = bar.crop((hx, hy, hx + hw, hy + hh)).copy()
    ref = [hov.getpixel((x, y)) for x in (4, hw - 5) for y in (5, hh - 6)]
    avg = tuple(sum(p[i] for p in ref) // 4 for i in range(3)) + (255,)
    for y in range(6, hh - 7):
        for x in range(4, hw - 4):
            n = random.randint(-8, 8); hov.putpixel((x, y), tuple(max(0, min(255, avg[i] + n)) for i in range(3)) + (255,))
    g2 = bevel(mask, (255, 235, 150), (110, 50, 10), (255, 190, 60), (214, 110, 20))
    hov.alpha_composite(g2, (6, 8))
    sheet2 = Image.new("RGBA", (w + hw, max(h, hh)), (0, 0, 0, 0))
    sheet2.alpha_composite(base, (0, 0)); sheet2.alpha_composite(hov, (w, 0))
    sheet2.save(os.path.join(D, "ui", name + ".png"))
    ui[name] = {"png": name + ".png", "frames": [[0, 0, w, h, 0, 0], [w, 0, hw, hh, 0, 0]]}
    json.dump(ui, open(os.path.join(D, "ui.json"), "w"), separators=(",", ":"))


# ---------------------------------------------------------------- hueco de bajada (la entrada de la granja)
# La entrada original de la cripta en Aresfarm (arefarm, casillas 78-86 x 68-73 de la hoja t301): escalera de ladrillo y losa de piedra. Se compone con
# el mapa, se quita la hierba (pixeles verdes) y se difumina el borde. La bajada de cada nivel la dibuja con este sprite (renderer.drawPortals).
import struct
from PIL import ImageFilter
sp301 = json.load(open(os.path.join(D, "sprites.json")))["t301"]
sh301 = Image.open(os.path.join(D, "sprites", sp301["png"])).convert("RGBA")
fm = json.load(open(os.path.join(D, "maps", "arefarm.json"))); fb = open(os.path.join(D, "maps", "arefarm.bin"), "rb").read()
X0, Y0, X1, Y1 = 76, 68, 88, 75
pit = Image.new("RGBA", ((X1 - X0) * 32 + 64, (Y1 - Y0) * 32 + 64), (0, 0, 0, 0))
for yy in range(Y0, Y1):
    for xx in range(X0, X1):
        s_, f_, o_, of_, fl_ = struct.unpack_from("<hhhhB", fb, (yy * fm["w"] + xx) * 10)
        if s_ != 301 or not (xx >= 78): continue
        sx, sy, w, h, px, py = sp301["frames"][f_]
        pit.alpha_composite(sh301.crop((sx, sy, sx + w, sy + h)), ((xx - X0) * 32 + px + 32, (yy - Y0) * 32 + py + 32))
pa = pit.load(); PW, PH = pit.size
mk = Image.new("L", pit.size, 0); mp = mk.load()
for yy in range(PH):
    for xx in range(PW):
        r_, g_, b_, a_ = pa[xx, yy]
        mp[xx, yy] = 255 if a_ and not (g_ > r_ + 6 and g_ > b_ + 8) else 0              # piedra, ladrillo y sombra; fuera la hierba
mk = mk.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MinFilter(3))
mk = mk.filter(ImageFilter.GaussianBlur(1.2))
pit.putalpha(ImageChops.multiply(pit.getchannel("A"), mk))
bb = pit.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
pit = pit.crop(bb)
cxp, cyp = 193 - bb[0], 158 - bb[1]                       # centro del hueco en la imagen recortada
pit.save(os.path.join(D, "equip", "cryptpit.webp"), "WEBP", lossless=True, quality=100, method=6)
eq = json.load(open(os.path.join(D, "equip.json")))
eq["cryptpit"] = {"png": "cryptpit.webp", "frames": [[0, 0, pit.width, pit.height, -cxp, -cyp]]}
json.dump(eq, open(os.path.join(D, "equip.json"), "w"), separators=(",", ":"))
print("pit", pit.size, bb)

import random
def ring_arrow(size, scale=6):
    """Recall: flecha circular de retorno (arco casi completo con punta)."""
    s = size * scale; m = Image.new("L", (s, s), 0); d = ImageDraw.Draw(m); c = s / 2; r = s * .34; wd = int(s * .11)
    d.arc((c - r, c - r, c + r, c + r), start=-50, end=270 - 50 - 40, fill=255, width=wd)
    ang = math.radians(-50); px, py = c + r * math.cos(ang), c + r * math.sin(ang)           # extremo del arco: punta de flecha
    tip = (px + s * .17 * math.cos(ang + math.pi / 2) , py + s * .17 * math.sin(ang + math.pi / 2))
    d.polygon([(px - s * .15, py - s * .02), (px + s * .15, py - s * .02), (px, py + s * .20)], fill=255)
    d.ellipse((c - s * .07, c - s * .07, c + s * .07, c + s * .07), fill=255)
    return m.resize((size, size), Image.LANCZOS)
def cross(size, scale=6):
    """Support: cruz de curación."""
    s = size * scale; m = Image.new("L", (s, s), 0); d = ImageDraw.Draw(m); c = s / 2; a = s * .13; L = s * .36
    d.rectangle((c - a, c - L, c + a, c + L), fill=255); d.rectangle((c - L, c - a, c + L, c + a), fill=255)
    return m.resize((size, size), Image.LANCZOS)
def sword(size, scale=6):
    """Damage: espada en diagonal."""
    s = size * scale; m = Image.new("L", (s, s), 0); d = ImageDraw.Draw(m)
    d.polygon([(s * .80, s * .12), (s * .88, s * .20), (s * .40, s * .66), (s * .30, s * .56)], fill=255)          # hoja
    d.polygon([(s * .20, s * .52), (s * .48, s * .80), (s * .42, s * .86), (s * .14, s * .58)], fill=255)          # guarda
    d.polygon([(s * .34, s * .66), (s * .40, s * .72), (s * .20, s * .90), (s * .12, s * .88), (s * .10, s * .80)], fill=255)   # empuñadura
    return m.resize((size, size), Image.LANCZOS)
def shield(size, scale=6):
    """Warrior: escudo."""
    s = size * scale; m = Image.new("L", (s, s), 0); d = ImageDraw.Draw(m)
    d.polygon([(s * .16, s * .14), (s * .50, s * .06), (s * .84, s * .14), (s * .84, s * .52), (s * .50, s * .94), (s * .16, s * .52)], fill=255)
    d.polygon([(s * .50, s * .20), (s * .50, s * .80), (s * .26, s * .50), (s * .26, s * .26)], fill=0)           # hendidura de relieve
    return m.resize((size, size), Image.LANCZOS)
build(paw(26), "summons_icon")
build(cross(26), "pet_support"); build(sword(26), "pet_damage"); build(shield(26), "pet_warrior")
build(ring_arrow(26), "recall_icon")
json.dump(ui, open(os.path.join(D, "ui.json"), "w"), separators=(",", ":"))
print("ok")
