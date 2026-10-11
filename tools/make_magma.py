"""Unidad nueva: Magma Golem, derivada del Stone Golem original (gol0..gol39).
    python make_magma.py CARPETA_DATA
Mantiene fotogramas, pivotes y poses del original; solo cambia la paleta (basalto oscuro con brasa en las zonas claras)
y añade grietas de lava fijas respecto al pivote de cada fotograma. Escribe lgol0..39 en sprites/, sprites.json y units.json."""
import json, os, sys
import numpy as np
from PIL import Image
out = sys.argv[1]
man_p, units_p = os.path.join(out, "sprites.json"), os.path.join(out, "units.json")
man, units = json.load(open(man_p)), json.load(open(units_p))
rng = np.random.RandomState(7)
G = rng.rand(64, 64)                       # ruido base tileable
def noise(x, y, s):                        # ruido de valor suave
    x, y = x / s, y / s; xi, yi = np.floor(x).astype(int), np.floor(y).astype(int); fx, fy = x - xi, y - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = G[yi % 64, xi % 64], G[yi % 64, (xi + 1) % 64], G[(yi + 1) % 64, xi % 64], G[(yi + 1) % 64, (xi + 1) % 64]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
# rampa: luminancia -> color (basalto -> roca caliente)
RAMP = np.array([[14, 10, 10], [38, 28, 28], [72, 52, 46], [118, 84, 66], [190, 140, 100]], float)
def ramp(l):
    p = np.clip(l, 0, 1) * (len(RAMP) - 1); i = np.minimum(p.astype(int), len(RAMP) - 2); f = (p - i)[..., None]
    return RAMP[i] * (1 - f) + RAMP[i + 1] * f
# variantes: sufijo, nombre, color de la lava (clases del Dummy: DUMMY_COLORS del renderer)
VARS = [("", "Magma Golem", (255, 150, 25)), ("h", "Magma Golem · Healer", (60, 240, 90)), ("b", "Magma Golem · Buffer", (255, 215, 40)), ("a", "Magma Golem · Aura", (70, 150, 255))]
def build(suf, name, LC):
  global man, units
  LC = np.array(LC, float)
  n = 0
  for k in range(40):
      m = man["gol%d" % k]; im = np.array(Image.open(os.path.join(out, "sprites", m["png"])).convert("RGBA")).astype(float)
      rgb, a = im[..., :3], im[..., 3]
      lum = (rgb @ [0.299, 0.587, 0.114]) / 255
      lum = np.clip((lum - 0.08) * 1.15, 0, 1)
      col = ramp(lum) * 0.82 + (LC * lum[..., None]) * 0.18 if suf else ramp(lum)       # la roca toma un toque del color de la clase
      for fx, fy, w, h, px, py in m["frames"]:
          ys, xs = np.mgrid[0:h, 0:w]; X, Y = xs + px, ys + py        # coordenadas respecto al pivote: las grietas no bailan entre fotogramas
          v = np.abs(noise(X + 3.1, Y + 1.7, 7.0) - 0.5) + 0.35 * np.abs(noise(X + 11, Y + 5, 3.5) - 0.5)
          crack = np.clip(1 - v / 0.075, 0, 1) * (a[fy:fy + h, fx:fx + w] > 0)
          crack *= np.clip(0.55 + lum[fy:fy + h, fx:fx + w] * 0.0 + 0.45, 0, 1)
          glow = np.clip(1 - v / 0.16, 0, 1) * 0.45 * (a[fy:fy + h, fx:fx + w] > 0)
          c = col[fy:fy + h, fx:fx + w]
          lava = (np.stack([255 * np.ones_like(crack), 120 + 110 * crack, 20 + 90 * crack ** 3], -1) if not suf else LC * (0.8 + 0.2 * crack[..., None]) + 255 * 0.45 * crack[..., None] ** 3)
          c = c * (1 - glow[..., None]) + lava * glow[..., None]
          c = c * (1 - crack[..., None]) + lava * crack[..., None]
          col[fy:fy + h, fx:fx + w] = c
      res = np.dstack([np.clip(col, 0, 255), a]).astype(np.uint8)
      Image.fromarray(res, "RGBA").save(os.path.join(out, "sprites", "lgol%s%d.png" % (suf, k))); n += 1
      man["lgol%s%d" % (suf, k)] = {"png": "lgol%s%d.png" % (suf, k), "frames": m["frames"], "u": 1}
  units[name] = {"sprite": "lgol" + suf, "type": 12, "n": 40, "pak": "derivada de GOL"}
  print(name + ":", n, "hojas")
for v in VARS: build(*v)
json.dump(man, open(man_p, "w"), separators=(",", ":")); json.dump(units, open(units_p, "w"), indent=1)
