import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def scale2x(a):
    """EPX/Scale2x sobre un array (h,w,c): conserva las diagonales sin escalones."""
    P = np.pad(a, ((1,1),(1,1),(0,0)), mode='edge')
    B, D, E, F, H = P[:-2,1:-1], P[1:-1,:-2], P[1:-1,1:-1], P[1:-1,2:], P[2:,1:-1]
    eq = lambda x, y: np.all(x == y, axis=-1, keepdims=True)
    c = ~eq(B, H) & ~eq(D, F)
    E0 = np.where(c & eq(D, B), D, E); E1 = np.where(c & eq(B, F), F, E)
    E2 = np.where(c & eq(D, H), D, E); E3 = np.where(c & eq(H, F), F, E)
    h, w, ch = a.shape
    o = np.empty((h*2, w*2, ch), a.dtype)
    o[0::2,0::2], o[0::2,1::2], o[1::2,0::2], o[1::2,1::2] = E0, E1, E2, E3
    return o

def upscale(img, k=4, sharp=1.0, blur=1.7):
    a = np.array(img.convert('RGBA'))
    n = 1
    while n < k: a = scale2x(a); n *= 2
    rgb = a[..., :3].astype(np.float32); al = a[..., 3].astype(np.float32) / 255
    pm = rgb * al[..., None]
    pm = np.stack([ndi.gaussian_filter(pm[..., i], blur) for i in range(3)], -1)
    als = ndi.gaussian_filter(al, blur)
    rgb = np.where(als[..., None] > 0.02, pm / np.maximum(als[..., None], 1e-3), 0)
    base = rgb.copy()
    soft = np.stack([ndi.gaussian_filter(base[..., i], 1.6) for i in range(3)], -1)
    rgb = np.clip(base + (base - soft) * sharp, 0, 255)
    als = np.clip((als - 0.5) * 1.8 + 0.5, 0, 1)            # borde del contorno nítido y suave
    out = np.dstack([rgb, als * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

if __name__ == '__main__':
    im = Image.open('/home/claude/hbweb/web/data/sprites/pb2_0.png').convert('RGBA')
    crop = im.crop((0, 0, 128, 96))
    a = crop.resize((512, 384), Image.NEAREST); b = upscale(crop, 4)
    bg = Image.new('RGBA', (1024, 384), (70, 110, 50, 255)); bg.alpha_composite(a, (0, 0)); bg.alpha_composite(b, (512, 0)); bg.save('cmp.png')
