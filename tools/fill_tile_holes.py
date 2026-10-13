"""Rellena los huecos pequenos de alfa (motas negras) de hojas de terreno IA ya generadas.
    python tools/fill_tile_holes.py t300 t302 ...      (lee y escribe web/data/sprites_ia/<clave>.webp)
Un hueco = region de alfa<250 de menos de MAXA px (x4) que no toca el borde de la hoja ni de la casilla opaca grande."""
import sys, cv2, numpy as np
from PIL import Image
D = 'web/data/sprites_ia/'; MAXA = 90 * 16
for k in sys.argv[1:]:
    im = np.array(Image.open(D + k + '.webp').convert('RGBA')); a = im[..., 3]
    hole = (a < 250).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(hole, connectivity=8)
    small = np.zeros(n, bool); small[1:] = st[1:, cv2.CC_STAT_AREA] < MAXA
    m = small[lab]
    m = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (a < 255)
    before = (a < 255).mean(); a[m] = 255
    # color bajo el hueco: promedio de vecinos opacos (el WebP lo guarda exacto)
    bad = m & (im[..., :3].sum(2) < 20)
    if bad.any():
        ok = (~bad).astype(np.float32); blur = lambda x: cv2.GaussianBlur(x, (0, 0), 3)
        for c in range(3):
            im[..., c] = np.where(bad, (blur(im[..., c] * ok) / np.maximum(blur(ok), 1e-3)).astype(np.uint8), im[..., c])
    im[..., 3] = a
    Image.fromarray(im).save(D + k + '.webp', quality=92, method=4, exact=True)
    print(k, 'transparente', round(before, 4), '->', round((a < 255).mean(), 4))
