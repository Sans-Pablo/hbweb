#!/usr/bin/env python3
"""Versión IA de las hojas de los monstruos enemigos (Real-ESRGAN x4plus, ncnn-vulkan, local).
    python tools/remaster_ia.py ESRGAN_DIR [prefijo ...]      (sin prefijos: todos los enemigos de npc.json)
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

def smooth_alpha(a8, w, h, sig=3.0, minarea=4):
    """Alfa original (baja res) -> alfa x4 de contorno suave: sin escalones, sin motas sueltas ni agujeros pequeños."""
    a = cv2.resize(a8.astype(np.float32) / 255, (w, h), interpolation=cv2.INTER_CUBIC)
    a = np.clip(a, 0, 1)
    m = ((cv2.GaussianBlur(a, (0, 0), sig) > .5) | (cv2.GaussianBlur(a, (0, 0), sig / 2) > .5)).astype(np.uint8)   # el 2.º desenfoque conserva líneas de 1 px (patas finas), que con sig=3 desaparecen
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= minarea * 16
    m = keep[lab]
    n, lab, st, _ = cv2.connectedComponentsWithStats((~m).astype(np.uint8), connectivity=4)
    holes = np.zeros(n, bool); holes[1:] = st[1:, cv2.CC_STAT_AREA] < 40 * 16; holes[lab[0, 0]] = False
    m = m | holes[lab]
    sd = cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, 5) - cv2.distanceTransform((~m).astype(np.uint8), cv2.DIST_L2, 5)
    return np.clip(sd / 2.5 + .5, 0, 1)

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

def build_alpha(a8, rgb8, frames, w, h):
    """Alfa x4 de la hoja entera: limpieza por fotograma + contorno suave (smooth_alpha por fotograma, con margen)."""
    c = clean_mask(a8, rgb8, frames); out = np.zeros((h, w), np.float32); P = 6
    for f in frames:
        x, y, fw, fh = f[:4]; x0, y0, x1, y1 = max(0, x - P), max(0, y - P), min(a8.shape[1], x + fw + P), min(a8.shape[0], y + fh + P)
        own = np.zeros((y1 - y0, x1 - x0), c.dtype); own[y - y0:y - y0 + fh, x - x0:x - x0 + fw] = c[y:y + fh, x:x + fw]   # sin píxeles del fotograma vecino (dejaban tiras rectas en el borde del recuadro)
        sub = smooth_alpha(own, (x1 - x0) * K, (y1 - y0) * K)
        out[y * K:(y + fh) * K, x * K:(x + fw) * K] = sub[(y - y0) * K:(y - y0 + fh) * K, (x - x0) * K:(x - x0 + fw) * K]
    return out

def fix_alpha(only):
    """Rehace solo el alfa de las hojas ya generadas (sin repetir la IA): python tools/remaster_ia.py --alpha [prefijo ...]"""
    man = json.load(open(os.path.join(ROOT, "sprites.json"))); fp = os.path.join(ROOT, "sprites_ia.json")
    ia = json.load(open(fp))
    for k, v in ia.items():
        if only and not any(re.fullmatch(re.escape(p) + r"\d+", k) for p in only): continue
        f = os.path.join(ROOT, "sprites_ia", v["png"]); im = Image.open(f).convert("RGB")
        o = np.array(Image.open(os.path.join(ROOT, "sprites", man[k]["png"])).convert("RGBA"))
        al = build_alpha(o[..., 3], o, man[k]["frames"], im.size[0], im.size[1])
        out = Image.fromarray(np.dstack([np.array(im), (al * 255).astype(np.uint8)]))
        if v["png"].endswith(".webp"): out.save(f, "WEBP", quality=90, method=4, exact=True)
        else: out.save(f, optimize=True)
    print("alfa rehecho", flush=True)

def main():
    if sys.argv[1] == "--alpha": return fix_alpha(sys.argv[2:])
    esr, only = sys.argv[1], [x for x in sys.argv[2:] if x != "--force"]; force = "--force" in sys.argv
    man = json.load(open(os.path.join(ROOT, "sprites.json")))
    out = os.path.join(ROOT, "sprites_ia"); os.makedirs(out, exist_ok=True)
    fp = os.path.join(ROOT, "sprites_ia.json")
    ia = json.load(open(fp)) if os.path.exists(fp) else {}
    for p in only or enemies():
        keys = [k for k in man if re.fullmatch(re.escape(p) + r"\d+", k)]
        keys = [k for k in keys if force or not any(os.path.exists(os.path.join(out, k + e)) for e in (".webp", ".png"))]
        if not keys: print(p, "ya hecho"); continue
        tmp = tempfile.mkdtemp(); a, b = os.path.join(tmp, "in"), os.path.join(tmp, "out"); os.makedirs(a); os.makedirs(b)
        alpha = {k: prep(os.path.join(ROOT, "sprites", man[k]["png"]), os.path.join(a, k + ".png")) for k in keys}
        subprocess.run([os.path.join(esr, "realesrgan-ncnn-vulkan.exe"), "-i", a, "-o", b, "-n", "realesrgan-x4plus",
                        "-m", os.path.join(esr, "models"), "-s", "4", "-f", "png"], check=True, capture_output=True)
        for k in keys:
            rgb = np.array(Image.open(os.path.join(b, k + ".png")).convert("RGB"))
            h, w = rgb.shape[:2]
            o = np.array(Image.open(os.path.join(ROOT, "sprites", man[k]["png"])).convert("RGBA"))
            al = (build_alpha(o[..., 3], o, man[k]["frames"], w, h) * 255).astype(np.uint8)
            im = Image.fromarray(np.dstack([rgb, al]))
            ext = "webp" if max(im.size) <= 16383 else "png"   # límite de WebP; el cliente solo lee el nombre del manifiesto
            if ext == "webp": im.save(os.path.join(out, k + ".webp"), "WEBP", quality=90, method=4, exact=True)
            else: im.save(os.path.join(out, k + ".png"), optimize=True)
            ia[k] = {"png": k + "." + ext, "k": K, "dir": "sprites_ia"}
        shutil.rmtree(tmp)
        json.dump(ia, open(fp, "w"), separators=(",", ":"))
        print(p, len(keys), "hojas", flush=True)

if __name__ == "__main__":
    main()
