"""Unidad nueva dibujada desde cero: Eidolon (espiritu de apoyo con tunica, halo y orbe), en tres clases: Healer / Buffer / Aura.
    python make_eidolon.py CARPETA_DATA [--test salida.png]
No parte de ningun sprite del juego: es un modelo 3D (campos de distancia) renderizado con sombreado, vista desde arriba (~30 grados)
y las 8 direcciones, igual que los sprites prerenderizados del original. 40 hojas por clase (5 acciones x 8 direcciones),
con los fotogramas por accion del Liche (4 reposo, 8 andar, 6 atacar, 5 dano, 6 morir).
Escribe eid{h,b,a}0..39 en sprites/, sprites.json y units.json."""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageFilter

W, H, SS = 72, 104, 3
PITCH = math.radians(30)
FRAMES = [4, 8, 6, 5, 6]
CLASSES = [("h", "Eidolon Healer", (90, 255, 120)), ("b", "Eidolon Buffer", (255, 210, 60)), ("a", "Eidolon Aura", (90, 170, 255))]
V = lambda *a: np.array(a, float)

def length(p): return np.sqrt((p * p).sum(-1))
def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)
def sph(p, c, r): return length(p - c) - r
def ell(p, c, r):
    q = (p - c) / r; return (length(q) - 1) * min(r)
def caps(p, a, b, r):
    pa, ba = p - a, b - a; h = np.clip((pa @ ba) / (ba @ ba), 0, 1); return length(pa - h[..., None] * ba) - r
def rcone(p, a, b, ra, rb):
    ba = b - a; l2 = ba @ ba; t = np.clip(((p - a) @ ba) / l2, 0, 1)
    return length(p - (a + t[..., None] * ba)) - (ra + (rb - ra) * t)
def torus_z(p, c, R, r):
    q = p - c; return np.sqrt((np.sqrt(q[..., 0] ** 2 + q[..., 1] ** 2) - R) ** 2 + q[..., 2] ** 2) - r
def torus_y(p, c, R, r):
    q = p - c; return np.sqrt((np.sqrt(q[..., 0] ** 2 + q[..., 2] ** 2) - R) ** 2 + q[..., 1] ** 2) - r

# materiales: 0 tunica, 1 guante, 2 interior de capucha, 3 emisivo, 4 ribete de clase
def scene(p, a):
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    ang = np.arctan2(z, x)
    fold = 1.0 * np.sin(7 * ang + y * 0.12 + a["ph"]) * np.clip((55 - y) / 40, 0.2, 1) + 0.8 * np.sin(11 * ang - a["ph"] * 1.3) * np.clip((30 - y) / 26, 0, 1)
    robe = rcone(p, V(0, 3, 0), V(0, 52, 0), 1.6, 16.5) - fold
    body = smin(robe, ell(p, V(0, 53, 0), V(15.5, 10, 10.5)), 5)
    hood = ell(p, V(0, 71, 0.5), V(11.5, 12, 12))
    hood = smin(hood, rcone(p, V(0, 70, -3), V(0, 81, -13), 9, 1.6), 6)
    hood = np.maximum(hood, -sph(p, V(0, 69.5, 8.5), 8.2))
    face = sph(p, V(0, 69.5, 2.5), 7.2)
    parts = [body, hood, face, torus_y(p, V(0, 61.5, 0), 11.2, 1.3), torus_y(p, V(0, 50.5, 0), 15.8, 1.4)]
    mats = [0, 0, 2, 4, 4]
    for s in (-1, 1):
        sh = V(s * 14, 55, 1); hand = a["hl"] if s < 0 else a["hr"]; mid = (sh + hand) * 0.5 + V(0, -3, 2)
        parts += [caps(p, sh, mid, 4.6), caps(p, mid, hand, 3.9), sph(p, hand, 3.3)]; mats += [0, 0, 1]
    parts.append(sph(p, a["orb"], a["orbr"])); mats.append(3)
    for ex in (-3.7, 3.7):
        parts.append(sph(p, V(ex, 70.5, 8.6), 1.5 * a["eye"])); mats.append(3)
    parts.append(torus_z(p, V(0, 72, -9), 17, 1.15)); mats.append(3)
    if a["cls"] == "b":
        for i in range(2):
            t = a["orbit"] + i * math.pi
            parts.append(sph(p, V(26 * math.cos(t), 58 + 4 * math.sin(t * 2), 26 * math.sin(t)), 3.0)); mats.append(3)
    if a["cls"] == "a":
        parts.append(torus_y(p, V(0, 36, 0), 25 + 1.5 * math.sin(a["orbit"]), 1.0)); mats.append(3)
        parts.append(torus_y(p, V(0, 24, 0), 20 + 1.5 * math.cos(a["orbit"]), 0.8)); mats.append(3)
    D = np.stack(parts, 0)
    return D.min(0), np.array(mats)[D.argmin(0)]

def rotY(t): c, s = math.cos(t), math.sin(t); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rotX(t): c, s = math.cos(t), math.sin(t); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])

def pose(act, t, cls):
    tau = 2 * math.pi * t
    a = dict(cls=cls, ph=tau, orbit=tau, eye=1.0, bob=0.0, lean=0.0, fade=1.0, shift=V(0, 0, 0), scale=1.0, orbr=4.6)
    hl, hr, orb = V(-17, 45, 9), V(17, 45, 9), V(0, 47, 17)
    if act == 0:
        s = math.sin(tau); a["bob"] = 2.2 * s; orb = V(0, 47 + 1.3 * math.sin(tau + 1), 17); hl = hl + V(0, 1.2 * s, 0); hr = hr + V(0, 1.2 * math.sin(tau + .5), 0)
        a["orbr"] = 4.6 + 0.5 * s
    elif act == 1:
        s = math.sin(tau); a["bob"] = 3.2 * abs(s); a["lean"] = math.radians(9); a["ph"] = tau * 2
        hl = hl + V(0, 2 * s, 3 * s); hr = hr + V(0, -2 * s, -3 * s); orb = V(0, 46 + 1.5 * math.sin(tau * 2), 18)
    elif act == 2:
        k = math.sin(math.pi * t)
        a["lean"] = math.radians(10) * k; hl = V(-14, 52 + 10 * k, 12 + 12 * k); hr = V(14, 52 + 10 * k, 12 + 12 * k)
        orb = V(0, 50 + 8 * k, 18 + 16 * k); a["orbr"] = 4.6 + 3.2 * k; a["bob"] = 2 * k; a["eye"] = 1 + 0.5 * k
    elif act == 3:
        k = math.sin(math.pi * min(1, t * 1.15)); a["lean"] = -math.radians(16) * k; a["shift"] = V(0, 0, -3 * k)
        hl = hl + V(-4 * k, 6 * k, -4 * k); hr = hr + V(4 * k, 6 * k, -4 * k); a["eye"] = 1 - 0.5 * k; orb = V(0, 47, 17 - 5 * k)
    else:
        a["lean"] = -math.radians(6) * t; a["fade"] = 1 - 0.85 * t; a["scale"] = 1 - 0.35 * t; a["eye"] = max(0.15, 1 - t)
        hl = V(-15, 45 - 8 * t, 6); hr = V(15, 45 - 8 * t, 6); orb = V(0, 47 - 20 * t, 15); a["orbr"] = 4.6 * (1 - 0.5 * t)
    a["hl"], a["hr"], a["orb"] = hl, hr, orb
    return a

CAM_R, CAM_U, CAM_D = V(1, 0, 0), V(0, math.cos(PITCH), -math.sin(PITCH)), V(0, -math.sin(PITCH), -math.cos(PITCH))
LIGHT = V(-0.55, 0.75, 0.55); LIGHT = LIGHT / length(LIGHT)

def render(act, t, d, cls, col):
    a = pose(act, t, cls)
    Ri = (rotY((5 - d) * math.pi / 4) @ rotX(a["lean"])).T
    off = V(0, 4, 0) + a["shift"]
    sc = 1.12 * a["scale"]
    w, h = W * SS, H * SS
    u, v = np.meshgrid((np.arange(w) + .5) / SS - W / 2, (H - 4 - (np.arange(h) + .5) / SS), indexing="xy")
    pts = (u[..., None] * CAM_R + v[..., None] * CAM_U - CAM_D * 200).reshape(-1, 3)
    n = len(pts)
    T = np.zeros(n); alive = np.ones(n, bool); hit = np.zeros(n, bool)
    def f(P):
        q = ((P - off) @ Ri.T) / sc
        dd, mm = scene(q, a)
        return dd * sc, mm, q
    for _ in range(70):
        idx = np.where(alive)[0]
        if not len(idx): break
        dd, _, _ = f(pts[idx] + CAM_D * T[idx, None])
        h_ = dd < 0.05
        hit[idx[h_]] = True
        T[idx] += np.maximum(dd, 0.05) * 0.9
        alive[idx[h_]] = False
        alive[idx[T[idx] > 400]] = False
    img = np.zeros((n, 4)); em = np.zeros(n)
    hi = np.where(hit)[0]
    cc = np.array(col, float)
    if len(hi):
        P = pts[hi] + CAM_D * T[hi, None]
        _, mm, q = f(P)
        N = np.zeros_like(P)
        for k in range(3):
            dv = np.zeros(3); dv[k] = 0.6
            N[:, k] = f(P + dv)[0] - f(P - dv)[0]
        N = N / (length(N)[:, None] + 1e-9)
        diff = np.clip(N @ LIGHT, 0, 1)
        rim = np.clip(1 - (N @ (-CAM_D)), 0, 1) ** 2.4
        hv = (LIGHT - CAM_D); hv = hv / length(hv)
        spec = np.clip(N @ hv, 0, 1) ** 24
        base = np.zeros((len(hi), 3))
        gr = 1 + 0.07 * np.sin(q[:, 0] * 2.3 + q[:, 1] * 1.7) * np.sin(q[:, 2] * 2.9 - q[:, 1] * 0.9)
        base[mm == 0] = (V(226, 222, 236) * 0.72 + cc * 0.28)[None] * (gr[mm == 0] * (0.92 + 0.08 * np.sin(q[mm == 0][:, 1] * 0.5)))[:, None]
        base[mm == 1] = V(244, 214, 188)
        base[mm == 2] = V(14, 12, 20)
        base[mm == 4] = cc * 0.85
        base[mm == 3] = np.minimum(cc * 1.1 + 70, 255)
        shade = 0.22 + 0.80 * diff + 0.22 * rim
        c = base * shade[:, None] + 38 * spec[:, None] * (mm != 3)[:, None] + (mm == 0)[:, None] * cc * 0.10 * (1 - diff)[:, None]
        c = np.where((mm == 3)[:, None], base, c)
        c = c * np.where(mm == 0, np.clip(0.55 + 0.45 * np.clip((q[:, 1] + 4) / 22, 0, 1), 0, 1), 1)[:, None]
        al = np.where(mm == 0, np.clip((q[:, 1] - 2) / 18, 0.0, 1.0) ** 0.8, 1.0) * a["fade"]
        img[hi, :3] = c; img[hi, 3] = al
        em[hi] = np.where(mm == 3, a["fade"], 0)
    img = img.reshape(h, w, 4); em = em.reshape(h, w)
    al = img[..., 3:4]; pm = img[..., :3] * al
    down = lambda x: x.reshape(H, SS, W, SS, -1).mean((1, 3))
    A = down(al)[..., 0]; Cc = down(pm) / np.maximum(A[..., None], 1e-6)
    E = np.clip(down(em[..., None])[..., 0], 0, 1)
    G = np.array(Image.fromarray((E * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.6))).astype(float) / 255 * 1.4
    out_a = np.clip(A + G * 0.55 * a["fade"], 0, 1)
    rgb = (Cc * A[..., None] + cc * G[..., None] * 0.9) / np.maximum(out_a[..., None], 1e-6)
    rgb = np.clip(rgb + 80 * E[..., None], 0, 255)
    return np.dstack([rgb, out_a * 255]).astype(np.uint8)

if __name__ == "__main__":
    out = sys.argv[1]
    if "--test" in sys.argv:
        sheet = Image.new("RGBA", (W * 8, H * 3), (60, 60, 66, 255))
        for ci, (suf, nm, col) in enumerate(CLASSES):
            for d in range(1, 9):
                sheet.alpha_composite(Image.fromarray(render(0, 0.0, d, suf, col), "RGBA"), ((d - 1) * W, ci * H))
        sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(sys.argv[sys.argv.index("--test") + 1]); sys.exit()
    man_p, units_p = os.path.join(out, "sprites.json"), os.path.join(out, "units.json")
    man, units = json.load(open(man_p)), json.load(open(units_p))
    for suf, name, col in CLASSES:
        for act, nf in enumerate(FRAMES):
            for d in range(1, 9):
                k = act * 8 + d - 1
                sheet = Image.new("RGBA", (W * nf, H), (0, 0, 0, 0))
                for fi in range(nf):
                    sheet.paste(Image.fromarray(render(act, fi / (nf - 1) if act == 4 else fi / nf, d, suf, col), "RGBA"), (fi * W, 0))
                sheet.save(os.path.join(out, "sprites", "eid%s%d.png" % (suf, k)))
                man["eid%s%d" % (suf, k)] = {"png": "eid%s%d.png" % (suf, k), "frames": [[fi * W, 0, W, H, -W // 2, -(H - 4)] for fi in range(nf)], "u": 1}
        units[name] = {"sprite": "eid" + suf, "type": 30, "n": 40, "pak": "nuevo (Eidolon)"}
        print(name, "ok", flush=True)
    json.dump(man, open(man_p, "w"), separators=(",", ":")); json.dump(units, open(units_p, "w"), indent=1)
