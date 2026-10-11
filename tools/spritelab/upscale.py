"""Reescalado HD que conserva el pixel art: Scale2x repetido + suavizado + enfoque (como el hdup.py original,
pero por fotograma con borde replicado: sin sangrado entre fotogramas vecinos y sin scipy)."""
import cv2, numpy as np


def scale2x(a):
    P = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode="edge")
    B, D, E, F, H = P[:-2, 1:-1], P[1:-1, :-2], P[1:-1, 1:-1], P[1:-1, 2:], P[2:, 1:-1]
    eq = lambda x, y: np.all(x == y, axis=-1, keepdims=True)
    c = ~eq(B, H) & ~eq(D, F)
    E0 = np.where(c & eq(D, B), D, E); E1 = np.where(c & eq(B, F), F, E)
    E2 = np.where(c & eq(D, H), D, E); E3 = np.where(c & eq(H, F), F, E)
    h, w, ch = a.shape
    o = np.empty((h * 2, w * 2, ch), a.dtype)
    o[0::2, 0::2], o[0::2, 1::2], o[1::2, 0::2], o[1::2, 1::2] = E0, E1, E2, E3
    return o


def _g(x, s): return cv2.GaussianBlur(x, (0, 0), s)


def upscale(frame, k=4, blur=1.7, sharp=1.0, edge=1.8, **_):
    """frame RGBA uint8 -> RGBA uint8 de k veces el tamaño. blur/sharp/edge como en hdup.py (blur en px HD, a k=4)."""
    pad = 2
    a = np.pad(frame, ((pad, pad), (pad, pad), (0, 0)), mode="edge")
    n = 1
    while n < k: a = scale2x(a); n *= 2
    s = k / 4
    rgb = a[..., :3].astype(np.float32); al = a[..., 3].astype(np.float32) / 255
    pm = rgb * al[..., None]
    pm = np.stack([_g(pm[..., i], blur * s) for i in range(3)], -1)
    als = _g(al, blur * s)
    rgb = np.where(als[..., None] > 0.02, pm / np.maximum(als[..., None], 1e-3), 0)
    soft = np.stack([_g(rgb[..., i], 1.6 * s) for i in range(3)], -1)
    rgb = np.clip(rgb + (rgb - soft) * sharp, 0, 255)
    als = np.clip((als - 0.5) * edge + 0.5, 0, 1)
    out = np.dstack([rgb, als * 255]).astype(np.uint8)
    p = pad * k
    return out[p:-p, p:-p]
