#!/usr/bin/env python3
"""Versión IA de las hojas de los monstruos enemigos (Real-ESRGAN x4plus, ncnn-vulkan, local).
    python tools/remaster_ia.py ESRGAN_DIR [prefijo ...]      (sin prefijos: todos los enemigos de npc.json)
Por hoja: el color de los bordes se extiende a lo transparente (sin halo oscuro), se reescala x4 con IA y el alfa se
rehace aparte (contorno suavizado, sin motas ni manchas oscuras de borde). Misma maqueta que sprites_hd (marcos x4), así que el cliente solo cambia de carpeta.
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

def smooth_alpha(a8, w, h, sig=3.0, minarea=60):
    """Alfa original (baja res) -> alfa x4 de contorno suave: sin escalones, sin motas sueltas ni agujeros pequeños."""
    a = cv2.resize(a8.astype(np.float32) / 255, (w, h), interpolation=cv2.INTER_CUBIC)
    m = (cv2.GaussianBlur(np.clip(a, 0, 1), (0, 0), sig) > .5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= minarea * 16
    m = keep[lab]
    n, lab, st, _ = cv2.connectedComponentsWithStats((~m).astype(np.uint8), connectivity=4)
    holes = np.zeros(n, bool); holes[1:] = st[1:, cv2.CC_STAT_AREA] < 40 * 16; holes[lab[0, 0]] = False
    m = m | holes[lab]
    sd = cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, 5) - cv2.distanceTransform((~m).astype(np.uint8), cv2.DIST_L2, 5)
    return np.clip(sd / 2.5 + .5, 0, 1)

def clean_alpha(a8, rgb, w, h, band=9, dark=.11):
    """Además quita las manchas oscuras pegadas al borde (restos de sombra/contorno del original) antes de suavizar."""
    a = cv2.resize(a8.astype(np.float32) / 255, (w, h), interpolation=cv2.INTER_CUBIC)
    m = cv2.GaussianBlur(np.clip(a, 0, 1), (0, 0), 3) > .5
    dt = cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, 5)
    lum = cv2.GaussianBlur(rgb @ np.array([.3, .59, .11], np.float32), (0, 0), 1.5)
    bad = cv2.dilate((m & (dt < band) & (lum < dark)).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=1) > 0
    a8b = (cv2.resize((m & ~bad).astype(np.float32), (a8.shape[1], a8.shape[0]), interpolation=cv2.INTER_AREA) * 255).astype(np.uint8)
    return smooth_alpha(a8b, w, h)

def fix_alpha(only):
    """Rehace solo el alfa de las hojas ya generadas (sin repetir la IA): python tools/remaster_ia.py --alpha [prefijo ...]"""
    man = json.load(open(os.path.join(ROOT, "sprites.json"))); fp = os.path.join(ROOT, "sprites_ia.json")
    ia = json.load(open(fp))
    for k, v in ia.items():
        if only and not any(re.fullmatch(re.escape(p) + r"\d+", k) for p in only): continue
        f = os.path.join(ROOT, "sprites_ia", v["png"]); im = Image.open(f).convert("RGB")
        a8 = np.array(Image.open(os.path.join(ROOT, "sprites", man[k]["png"])).convert("RGBA"))[..., 3]
        al = clean_alpha(a8, np.array(im).astype(np.float32) / 255, im.size[0], im.size[1])
        out = Image.fromarray(np.dstack([np.array(im), (al * 255).astype(np.uint8)]))
        if v["png"].endswith(".webp"): out.save(f, "WEBP", quality=90, method=4)
        else: out.save(f, optimize=True)
    print("alfa rehecho", flush=True)

def main():
    if sys.argv[1] == "--alpha": return fix_alpha(sys.argv[2:])
    esr, only = sys.argv[1], sys.argv[2:]
    man = json.load(open(os.path.join(ROOT, "sprites.json")))
    out = os.path.join(ROOT, "sprites_ia"); os.makedirs(out, exist_ok=True)
    fp = os.path.join(ROOT, "sprites_ia.json")
    ia = json.load(open(fp)) if os.path.exists(fp) else {}
    for p in only or enemies():
        keys = [k for k in man if re.fullmatch(re.escape(p) + r"\d+", k)]
        keys = [k for k in keys if not any(os.path.exists(os.path.join(out, k + e)) for e in (".webp", ".png"))]
        if not keys: print(p, "ya hecho"); continue
        tmp = tempfile.mkdtemp(); a, b = os.path.join(tmp, "in"), os.path.join(tmp, "out"); os.makedirs(a); os.makedirs(b)
        alpha = {k: prep(os.path.join(ROOT, "sprites", man[k]["png"]), os.path.join(a, k + ".png")) for k in keys}
        subprocess.run([os.path.join(esr, "realesrgan-ncnn-vulkan.exe"), "-i", a, "-o", b, "-n", "realesrgan-x4plus",
                        "-m", os.path.join(esr, "models"), "-s", "4", "-f", "png"], check=True, capture_output=True)
        for k in keys:
            rgb = np.array(Image.open(os.path.join(b, k + ".png")).convert("RGB"))
            h, w = rgb.shape[:2]
            al = (clean_alpha(alpha[k], rgb.astype(np.float32) / 255, w, h) * 255).astype(np.uint8)
            im = Image.fromarray(np.dstack([rgb, al]))
            ext = "webp" if max(im.size) <= 16383 else "png"   # límite de WebP; el cliente solo lee el nombre del manifiesto
            if ext == "webp": im.save(os.path.join(out, k + ".webp"), "WEBP", quality=90, method=4)
            else: im.save(os.path.join(out, k + ".png"), optimize=True)
            ia[k] = {"png": k + "." + ext, "k": K, "dir": "sprites_ia"}
        shutil.rmtree(tmp)
        json.dump(ia, open(fp, "w"), separators=(",", ":"))
        print(p, len(keys), "hojas", flush=True)

if __name__ == "__main__":
    main()
