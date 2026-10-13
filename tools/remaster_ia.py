#!/usr/bin/env python3
"""Versión IA de las hojas de los monstruos enemigos (Real-ESRGAN x4plus, ncnn-vulkan, local).
    python tools/remaster_ia.py ESRGAN_DIR [prefijo ...]      (sin prefijos: todos los enemigos de npc.json; «W» / «M»: hojas del personaje)
Por hoja: el color de los bordes se extiende a lo transparente (sin halo oscuro), se reescala x4 con IA y el alfa se
rehace aparte por fotograma (contorno suavizado, sin mugre suelta ni sombra negra del suelo). El WebP guarda el color bajo lo transparente (exact), así que --alpha corrige el contorno sin repetir la IA. Misma maqueta que sprites_hd (marcos x4), así que el cliente solo cambia de carpeta.
Salida: web/data/sprites_ia/<clave>.webp y web/data/sprites_ia.json ({clave: {png, k, dir}}). Derivados: no se versionan."""
import json, os, re, subprocess, sys, tempfile, shutil
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "data")
NOT_ENEMY = {"shk", "gnd", "how", "tom", "william", "kennedy", "mcgaffin", "perry", "devlin", "gail", "dummy", "crop",
             "uhealer", "usorceress", "ubuffer", "uguard", "uelfmaster", "utk", "ututelarangel3"}
K = 4

def enemies():
    npc = json.load(open(os.path.join(ROOT, "npc.json")))
    return sorted({v["sprite"] for v in npc.values() if v["sprite"] not in NOT_ENEMY})

def prep(src, dst):
    a = np.array(Image.open(src).convert("RGBA")); al = a[..., 3]
    idx = ndi.distance_transform_edt(~(al > 10), return_distances=False, return_indices=True)
    Image.fromarray(a[..., :3][idx[0], idx[1], :]).save(dst)
    return al

def smooth_alpha(a8, w, h, sig=3.0, minarea=4, hole=40, sg=None, erode=0):
    """Alfa original (baja res) -> alfa x4 de contorno suave: sin escalones, sin motas sueltas ni agujeros pequeños."""
    a = cv2.resize(a8.astype(np.float32) / 255, (w, h), interpolation=cv2.INTER_CUBIC)
    a = np.clip(a, 0, 1)
    m = ((cv2.GaussianBlur(a, (0, 0), sig) > .5) | (cv2.GaussianBlur(a, (0, 0), sg or sig / 2) > .5)).astype(np.uint8)   # el 2.º desenfoque conserva líneas de 1 px (patas finas), que con sig=3 desaparecen
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= minarea * 16
    m = keep[lab]
    n, lab, st, _ = cv2.connectedComponentsWithStats((~m).astype(np.uint8), connectivity=4)
    holes = np.zeros(n, bool); holes[1:] = st[1:, cv2.CC_STAT_AREA] < hole * 16; holes[lab[0, 0]] = False
    m = m | holes[lab]
    sd = cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, 5) - cv2.distanceTransform((~m).astype(np.uint8), cv2.DIST_L2, 5)
    return np.clip((sd - erode) / 2.5 + .5, 0, 1)   # erode (px x4): recorta el borde oscuro del original

def clean_mask(a8, rgb8, frames, band=14, black=0, near=5, keep=.15):
    """Alfa original binario -> sin mugre, por fotograma: quita la sombra negra del suelo (negro casi puro, solo en la franja
    baja: un umbral mayor corta tobillos) y los trozos sueltos (no tocan el cuerpo ni son una pieza grande)."""
    out = np.zeros_like(a8); lum = rgb8[..., :3].astype(np.float32) @ np.array([.3, .59, .11], np.float32)
    for f in frames:
        x, y, w, h = f[:4]; m = a8[y:y + h, x:x + w] > 0
        m[max(0, h - band):][lum[y:y + h, x:x + w][max(0, h - band):] < black] = False
        n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
        if n > 2:
            big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
            reach = cv2.dilate((lab == big).astype(np.uint8), np.ones((2 * near + 1, 2 * near + 1), np.uint8)) > 0
            ok = np.zeros(n, bool); ok[1:] = st[1:, cv2.CC_STAT_AREA] >= keep * st[big, cv2.CC_STAT_AREA]
            ok[np.unique(lab[reach])] = True; ok[0] = False
            m = ok[lab]
        out[y:y + h, x:x + w] = m * 255
    return out

def build_alpha(a8, rgb8, frames, w, h, hole=40, sig=3.0, sg=None, keep=.15, erode=0):
    """Alfa x4 de la hoja entera: limpieza por fotograma + contorno suave (smooth_alpha por fotograma, con margen)."""
    c = clean_mask(a8, rgb8, frames, keep=keep); out = np.zeros((h, w), np.float32); P = 6
    for f in frames:
        x, y, fw, fh = f[:4]; x0, y0, x1, y1 = max(0, x - P), max(0, y - P), min(a8.shape[1], x + fw + P), min(a8.shape[0], y + fh + P)
        own = np.zeros((y1 - y0, x1 - x0), c.dtype); own[y - y0:y - y0 + fh, x - x0:x - x0 + fw] = c[y:y + fh, x:x + fw]   # sin píxeles del fotograma vecino (dejaban tiras rectas en el borde del recuadro)
        sub = smooth_alpha(own, (x1 - x0) * K, (y1 - y0) * K, hole=hole, sig=sig, sg=sg, erode=erode)
        out[y * K:(y + fh) * K, x * K:(x + fw) * K] = sub[(y - y0) * K:(y - y0 + fh) * K, (x - x0) * K:(x - x0 + fw) * K]
    return out

# Grupos de hojas de personaje (players.json): «W» = mujer (pieles 4-6, ropa interior pu1, pelo ph1); «M» = hombre (pieles 1-3, pu0, ph0)
GROUPS = {"W": r"pb[456]_\d+|pu1_\d+_\d+|ph1_\d+_\d+", "M": r"pb[123]_\d+|pu0_\d+_\d+|ph0_\d+_\d+",
          "BH": r"w1_31_\d+"}   # BH = Battle Hammer equipado en mujer (appr 31)

SIG, SG = 4.5, 3.0   # personajes: contorno más suave (los escalones del píxel se notaban «cuadrados»)
HOLE = 3   # personajes: los huecos entre brazo y torso son reales, no se rellenan (en monstruos se tapan agujeros de hasta 40 px)
PL = re.compile('|'.join(GROUPS.values()))
# Equipo visible en el personaje (equip.json): armadura/casco/etc. «EA<letra><género>» y armas «EW<género><dígito inicial del appr>» (por tandas)
for _g in "01":
    for _l in "ahlmsbo": GROUPS["EA%s%s" % (_l, _g)] = r"%s%s_\d+_\d+" % (_l, _g)
    for _d in "0123456789": GROUPS["EW%s%s" % (_g, _d)] = r"w%s_%s\d?_\d+" % (_g, _d)
EQ = re.compile(r"[ahlmsbo][01]_\d+_\d+|w[01]_\d+_\d+")

def alpha_args(k):
    if EQ.fullmatch(k): return dict(keep=0.0, hole=3, sig=2.0, sg=1.0)   # equipo: líneas finas (mangos, filos), sin quitar piezas
    if re.fullmatch(GROUPS["BH"], k): return dict(keep=0.0, hole=3, sig=2.0, sg=1.0)   # mango de 1 px: contorno poco suavizado, sin quitar piezas
    if re.fullmatch(r"(cla|gol|cyc|zom)\d+", k): return dict(keep=0.0, hole=3, sig=3.0, sg=3.0, erode=0)   # cuerpos gruesos: contorno liso y sin el borde oscuro
    if re.fullmatch(r"ske\d+", k): return dict(keep=0.0, hole=1, sig=1.0, sg=0.7)   # huesos finos: contorno casi sin suavizar
    if PL.fullmatch(k): return dict(hole=HOLE, sig=SIG, sg=SG)
    # cuerpos hechos de piezas separadas (serpiente, hormiga): no quitar los trozos «sueltos», son el animal
    # y los miembros finos (piernas del esqueleto, cíclope...) tampoco: solo el terreno conserva la limpieza fuerte
    return {} if re.fullmatch(r"t\d+", k) else dict(keep=0.0, hole=3, sig=2.0, sg=1.0)

# Losetas de suelo opacas (todas 32x32): cada una se rodea de 8 px de sí misma repetida, así la IA ve continuidad en los bordes
# y las costuras entre losetas iguales no se marcan. Se recorta el centro. (Las hojas con transparencia, p. ej. rombos, van por la ruta normal.)
TP = 12
TS = 10   # sigma (px x4) del ajuste de tono: el color de baja frecuencia sale del original (continuo entre losetas vecinas), el detalle de la IA
def is_tile(frames, al):
    return len(frames) >= 100 and all(f[2] == 32 and f[3] == 32 for f in frames)

def tile_pad(rgb, frames):
    cw = 32 + 2 * TP; H, W = rgb.shape[:2]
    out = np.zeros((H // 32 * cw, W // 32 * cw, 3), np.uint8)
    for f in frames:
        x, y = f[:2]; t = np.pad(rgb[y:y + 32, x:x + 32], ((TP, TP), (TP, TP), (0, 0)), mode="wrap")
        out[y // 32 * cw:(y // 32 + 1) * cw, x // 32 * cw:(x // 32 + 1) * cw] = t
    return out

def tile_unpad(big, frames, W, H, src=None):
    if src is not None:   # ajuste de tono sobre la hoja con relleno (así el desenfoque no sale de la loseta)
        up = cv2.resize(src, (big.shape[1], big.shape[0]), interpolation=cv2.INTER_CUBIC).astype(np.float32)
        g = lambda x: cv2.GaussianBlur(x, (0, 0), TS)
        big = np.clip(big.astype(np.float32) - g(big.astype(np.float32)) + g(up), 0, 255).astype(np.uint8)
    cw = (32 + 2 * TP) * K; out = np.zeros((H * K, W * K, 3), np.uint8)
    for f in frames:
        x, y = f[:2]; c = big[y // 32 * cw + TP * K:y // 32 * cw + (TP + 32) * K, x // 32 * cw + TP * K:x // 32 * cw + (TP + 32) * K]
        out[y * K:(y + 32) * K, x * K:(x + 32) * K] = c
    return out

def review(k, orig, ia_img, frames, path):
    """Imagen de revisión: original y IA (primeras 8 losetas o el objeto entero) + prueba de costuras 4x4 de la primera loseta."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    o = Image.fromarray(orig); a = ia_img
    if all(f[2] == 32 and f[3] == 32 for f in frames):
        c = Image.new("RGBA", (8 * 96, 96 * 2 + 4 * 96 + 8), (40, 40, 40, 255))
        for i, f in enumerate(frames[:8]):
            x, y = f[:2]
            c.alpha_composite(o.crop((x, y, x + 32, y + 32)).resize((96, 96), Image.NEAREST), (i * 96, 0))
            c.alpha_composite(a.crop((x * K, y * K, (x + 32) * K, (y + 32) * K)).resize((96, 96), Image.LANCZOS), (i * 96, 96))
        x, y = max(frames[:8], key=lambda f: int((orig[f[1]:f[1] + 32, f[0]:f[0] + 32, 3] > 10).sum()))[:2]; t = a.crop((x * K, y * K, (x + 32) * K, (y + 32) * K)).resize((96, 96), Image.LANCZOS)
        for j in range(4):
            for i in range(4): c.alpha_composite(t, (i * 96, 192 + 8 + j * 96))
    else:
        x, y, w, h = next((f for f in frames if f[2] > 0 and f[3] > 0 and f[1] + f[3] <= o.height), frames[0])[:4]; w2, h2 = max(1, min(w, 400)), max(1, min(h, 400))
        c = Image.new("RGBA", (w2 * 2 + 10, h2), (60, 90, 50, 255))
        c.alpha_composite(o.crop((x, y, x + w2, y + h2)), (0, 0))
        c.alpha_composite(a.crop((x * K, y * K, (x + w2) * K, (y + h2) * K)).resize((w2, h2), Image.LANCZOS), (w2 + 10, 0))
    c.save(path)

def manifest():
    m = json.load(open(os.path.join(ROOT, "sprites.json"))); m.update(json.load(open(os.path.join(ROOT, "players.json"))))
    for k, v in json.load(open(os.path.join(ROOT, "equip.json"))).items(): m.setdefault(k, dict(v, png="../equip/" + v["png"]))   # armas equipadas (w1_31_* = Battle Hammer en W)
    return m

def prep_rgb(src):
    a = np.array(Image.open(src).convert("RGBA")); idx = ndi.distance_transform_edt(~(a[..., 3] > 10), return_distances=False, return_indices=True)
    return a[..., :3][idx[0], idx[1], :]

def keep_chroma(ia_rgb, orig_rgb):
    """Real-ESRGAN desplaza el matiz de los tonos muy oscuros y saturados (la ropa interior morada salía verde): la luminancia es de la IA, el color (Cr/Cb) del original ampliado en bicúbico."""
    h, w = ia_rgb.shape[:2]
    up = cv2.resize(orig_rgb, (w, h), interpolation=cv2.INTER_CUBIC)
    y = cv2.cvtColor(np.ascontiguousarray(ia_rgb), cv2.COLOR_RGB2YCrCb); c = cv2.cvtColor(np.ascontiguousarray(up), cv2.COLOR_RGB2YCrCb)
    y[..., 1:] = c[..., 1:]
    return cv2.cvtColor(y, cv2.COLOR_YCrCb2RGB)

SOFT = .4   # personajes: la IA sola deja facetas «cuadradas»; se mezcla con el original ampliado y suavizado

def soften(ia_rgb, orig_rgb):
    h, w = ia_rgb.shape[:2]
    up = cv2.GaussianBlur(cv2.resize(orig_rgb, (w, h), interpolation=cv2.INTER_CUBIC), (0, 0), 2.5)
    return (ia_rgb * (1 - SOFT) + up * SOFT).astype(np.uint8)

def tone(ia_rgb, orig_rgb, sig=6):
    """Monstruos: la IA oscurece y desplaza el matiz. Color (Cr/Cb) del original y brillo de baja frecuencia del original; el detalle (alta frecuencia) es de la IA. Idempotente."""
    h, w = ia_rgb.shape[:2]
    up = cv2.resize(orig_rgb, (w, h), interpolation=cv2.INTER_CUBIC)
    y = cv2.cvtColor(np.ascontiguousarray(ia_rgb), cv2.COLOR_RGB2YCrCb).astype(np.float32); c = cv2.cvtColor(np.ascontiguousarray(up), cv2.COLOR_RGB2YCrCb).astype(np.float32)
    g = lambda x: cv2.GaussianBlur(x, (0, 0), sig)
    y[..., 0] = np.clip(y[..., 0] + g(c[..., 0]) - g(y[..., 0]), 0, 255); y[..., 1:] = c[..., 1:]
    return cv2.cvtColor(y.astype(np.uint8), cv2.COLOR_YCrCb2RGB)

def darken(ia_rgb, orig_rgb, lo=30, hi=80):
    """Negros del original (hojas de espada negra, pelo oscuro, botas): la IA los vuelve grises con textura. Donde el original es oscuro, el color vuelve al original ampliado. Idempotente."""
    h, w = ia_rgb.shape[:2]
    up = cv2.resize(orig_rgb, (w, h), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    lum = up @ np.array([.3, .59, .11], np.float32)
    wt = np.clip((hi - lum) / (hi - lo), 0, 1)[..., None]
    return (ia_rgb * (1 - wt) + up * wt).astype(np.uint8)

DETAIL = 0.0   # --detail X: suelos; la IA alisa la hierba, se le devuelve la textura fina del original ampliado

def detail(ia_rgb, orig_rgb, lam, sig=1.6):
    """Terreno: Real-ESRGAN deja la hierba lisa y empastada. Se suma la alta frecuencia del original ampliado en bicúbico (original - su desenfoque) al resultado de la IA. NO es idempotente: solo sobre IA cruda (--force)."""
    h, w = ia_rgb.shape[:2]
    up = cv2.resize(orig_rgb, (w, h), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    hp = up - cv2.GaussianBlur(up, (0, 0), sig)
    return np.clip(ia_rgb.astype(np.float32) + lam * hp, 0, 255).astype(np.uint8)

def fix_dark(pats, sig=None):
    """Aplica darken a las hojas ya generadas cuya clave encaje con alguna regex: python tools/remaster_ia.py --dark REGEX ..."""
    man = manifest(); ia = json.load(open(os.path.join(ROOT, "sprites_ia.json"))); n = 0
    for k, v in ia.items():
        if not any(re.fullmatch(p, k) for p in pats) or k not in man: continue
        f = os.path.join(ROOT, "sprites_ia", v["png"]); im = np.array(Image.open(f).convert("RGBA"))
        src = prep_rgb(os.path.join(ROOT, "sprites", man[k]["png"])); rgb = darken(tone(im[..., :3], src, sig) if sig else im[..., :3], src)
        out = Image.fromarray(np.dstack([rgb, im[..., 3]]))
        if v["png"].endswith(".webp"): out.save(f, "WEBP", quality=90, method=4, exact=True)
        else: out.save(f, optimize=True)
        n += 1
    print("oscuros rehechos", n, flush=True)

def fix_chroma(only):
    """Rehace solo el color (y el suavizado) de hojas ya generadas, partiendo del resultado crudo de la IA, no de uno ya retocado: úsese una sola vez por generación. python tools/remaster_ia.py --chroma W"""
    man = manifest(); ia = json.load(open(os.path.join(ROOT, "sprites_ia.json")))
    for k, v in ia.items():
        mon = any(re.fullmatch(re.escape(p) + r"\d+", k) for p in only)   # prefijo de monstruo: ajuste de tono (idempotente)
        if not mon and not any(p in GROUPS and re.fullmatch(GROUPS[p], k) for p in only): continue
        f = os.path.join(ROOT, "sprites_ia", v["png"]); im = np.array(Image.open(f).convert("RGBA"))
        src = prep_rgb(os.path.join(ROOT, "sprites", man[k]["png"])); rgb = tone(im[..., :3], src) if mon else soften(keep_chroma(im[..., :3], src), src)
        out = Image.fromarray(np.dstack([rgb, im[..., 3]]))
        if v["png"].endswith(".webp"): out.save(f, "WEBP", quality=90, method=4, exact=True)
        else: out.save(f, optimize=True)
    print("color rehecho", flush=True)

def fix_alpha(only):
    """Rehace solo el alfa de las hojas ya generadas (sin repetir la IA): python tools/remaster_ia.py --alpha [prefijo ...]"""
    man = manifest(); fp = os.path.join(ROOT, "sprites_ia.json")
    ia = json.load(open(fp))
    for k, v in ia.items():
        if only and not any(re.fullmatch(re.escape(p) + r"\d+", k) or (p in GROUPS and re.fullmatch(GROUPS[p], k)) for p in only): continue
        f = os.path.join(ROOT, "sprites_ia", v["png"]); im = Image.open(f).convert("RGB")
        o = np.array(Image.open(os.path.join(ROOT, "sprites", man[k]["png"])).convert("RGBA"))
        al = build_alpha(o[..., 3], o, man[k]["frames"], im.size[0], im.size[1], **alpha_args(k))
        out = Image.fromarray(np.dstack([np.array(im), (al * 255).astype(np.uint8)]))
        if v["png"].endswith(".webp"): out.save(f, "WEBP", quality=90, method=4, exact=True)
        else: out.save(f, optimize=True)
    print("alfa rehecho", flush=True)

def main():
    if sys.argv[1] == "--alpha": return fix_alpha(sys.argv[2:])
    if sys.argv[1] == "--dark": return fix_dark(sys.argv[2:])
    if sys.argv[1] == "--tone": return fix_dark(sys.argv[3:], float(sys.argv[2]))   # --tone SIGMA REGEX...: tono del original + oscuros
    if sys.argv[1] == "--chroma": return fix_chroma(sys.argv[2:])
    global DETAIL
    args = sys.argv[1:]; force = "--force" in args; args = [x for x in args if x != "--force"]
    if "--detail" in args: i = args.index("--detail"); DETAIL = float(args[i + 1]); del args[i:i + 2]
    man = manifest()
    if "--status" in args:   # lista por categoría cuántas hojas de terreno tienen IA
        have = lambda k: any(os.path.exists(os.path.join(ROOT, "sprites_ia", k + e)) for e in (".webp", ".png"))
        cat = lambda n: "suelo" if n < 100 or 200 <= n < 300 or n >= 300 else "árboles" if n < 150 else "sombras" if n < 200 else "otras"
        tot = {}
        for k in man:
            if re.fullmatch(r"t\d+", k):
                c = cat(int(k[1:])); t = tot.setdefault(c, [0, 0]); t[1] += 1; t[0] += have(k)
        for c, (d, n) in tot.items(): print(c, f"{d}/{n}")
        return
    if "--map" in args:   # todas las hojas de terreno que usa un mapa (suelo, objetos y sombras de árbol obj+50)
        i = args.index("--map"); mid = args[i + 1]; del args[i:i + 2]
        raw = open(os.path.join(ROOT, "maps", mid + ".bin"), "rb").read()
        c = np.frombuffer(raw, np.uint8).reshape(-1, 10); used = set()
        for v in np.unique(np.ascontiguousarray(c[:, 0:2]).view("<i2")): used.add(int(v))
        for v in np.unique(np.ascontiguousarray(c[:, 4:6]).view("<i2")):
            used.add(int(v)); used.add(int(v) + 50) if 100 <= int(v) < 150 else None
        args += ["t%d" % n for n in sorted(used) if "t%d" % n in man]
    esr, only = args[0], args[1:]
    out = os.path.join(ROOT, "sprites_ia"); os.makedirs(out, exist_ok=True)
    fp = os.path.join(ROOT, "sprites_ia.json")
    ia = json.load(open(fp)) if os.path.exists(fp) else {}
    for p in only or enemies():
        keys = [k for k in man if (k == p or (not re.fullmatch(r"t\d+", p) and re.fullmatch(GROUPS[p] if p in GROUPS else re.escape(p) + r"\d+", k)))]   # clave exacta (p. ej. ip15) o prefijo
        keys = [k for k in keys if force or not any(os.path.exists(os.path.join(out, k + e)) for e in (".webp", ".png"))]
        if not keys: print(p, "ya hecho"); continue
        tmp = tempfile.mkdtemp(); a, b = os.path.join(tmp, "in"), os.path.join(tmp, "out"); os.makedirs(a); os.makedirs(b)
        alpha = {k: prep(os.path.join(ROOT, "sprites", man[k]["png"]), os.path.join(a, k + ".png")) for k in keys}
        tiles = {k for k in keys if is_tile(man[k]["frames"], alpha[k])}
        for k in tiles:
            src = np.array(Image.open(os.path.join(a, k + ".png")).convert("RGB")); Image.fromarray(tile_pad(src, man[k]["frames"])).save(os.path.join(a, k + ".png"))
        subprocess.run([os.path.join(esr, "realesrgan-ncnn-vulkan.exe"), "-i", a, "-o", b, "-n", "realesrgan-x4plus",
                        "-m", os.path.join(esr, "models"), "-s", "4", "-f", "png"], check=True, capture_output=True)
        for k in keys:
            rgb = np.array(Image.open(os.path.join(b, k + ".png")).convert("RGB"))
            if k in tiles: rgb = tile_unpad(rgb, man[k]["frames"], alpha[k].shape[1], alpha[k].shape[0], np.array(Image.open(os.path.join(a, k + ".png")).convert("RGB")))
            h, w = rgb.shape[:2]
            if DETAIL and k in tiles: rgb = detail(rgb, prep_rgb(os.path.join(ROOT, "sprites", man[k]["png"])), DETAIL)
            if p in GROUPS:
                src = np.array(Image.open(os.path.join(a, k + ".png")).convert("RGB")); rgb = darken(soften(keep_chroma(rgb, src), src), src)
            elif k not in tiles and not re.fullmatch(r"(ig|ip)\d+|[a-z]\d_\d+_\d+|w\d_\d+_\d+", k):
                src = np.array(Image.open(os.path.join(a, k + ".png")).convert("RGB")); rgb = tone(rgb, src)
                if re.fullmatch(r"ske\d+", k):   # huesos de 1-2 px: la IA los emborrona; se mezcla con el original ampliado
                    up = cv2.GaussianBlur(cv2.resize(src, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC), (0, 0), 1.0)
                    rgb = (rgb * .4 + up * .6).astype(np.uint8)
            elif k not in tiles:
                src = np.array(Image.open(os.path.join(a, k + ".png")).convert("RGB")); rgb = darken(rgb, src)
            o = np.array(Image.open(os.path.join(ROOT, "sprites", man[k]["png"])).convert("RGBA"))
            if k in tiles:                                      # alfa casilla a casilla: reescalar la hoja entera mezcla el borde con la casilla transparente vecina (línea oscura)
                al = np.zeros((h, w), np.uint8)
                for f in man[k]["frames"]:
                    if f[2] > 0 and f[1] + 32 <= o.shape[0] and f[0] + 32 <= o.shape[1]: al[f[1] * K:(f[1] + 32) * K, f[0] * K:(f[0] + 32) * K] = cv2.resize(o[f[1]:f[1] + 32, f[0]:f[0] + 32, 3], (32 * K, 32 * K), interpolation=cv2.INTER_LINEAR)
            else: al = (build_alpha(o[..., 3], o, [f for f in man[k]["frames"] if f[2] > 0 and f[3] > 0 and f[1] + f[3] <= o.shape[0]], w, h, **alpha_args(k)) * 255).astype(np.uint8)
            im = Image.fromarray(np.dstack([rgb, al]))
            ext = "webp" if max(im.size) <= 16383 else "png"   # límite de WebP; el cliente solo lee el nombre del manifiesto
            if ext == "webp": im.save(os.path.join(out, k + ".webp"), "WEBP", quality=90, method=4, exact=True)
            else: im.save(os.path.join(out, k + ".png"), optimize=True)
            if re.fullmatch(r"t\d+", k): review(k, o, im.convert("RGBA"), man[k]["frames"], os.path.join(out, "_review", k + ".png"))
            ia[k] = {"png": k + "." + ext, "k": K, "dir": "sprites_ia"}
        shutil.rmtree(tmp)
        json.dump(ia, open(fp, "w"), separators=(",", ":"))
        print(p, len(keys), "hojas", flush=True)

if __name__ == "__main__":
    main()
