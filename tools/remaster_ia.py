#!/usr/bin/env python3
"""Versión IA de las hojas de los monstruos enemigos (Real-ESRGAN x4plus, ncnn-vulkan, local).
    python tools/remaster_ia.py ESRGAN_DIR [prefijo ...]      (sin prefijos: todos los enemigos de npc.json)
Por hoja: el color de los bordes se extiende a lo transparente (sin halo oscuro), se reescala x4 con IA y el alfa se
rehace aparte (cubic + rampa). Misma maqueta que sprites_hd (marcos x4), así que el cliente solo cambia de carpeta.
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

def main():
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
            al = cv2.resize(alpha[k].astype(np.float32) / 255, (w, h), interpolation=cv2.INTER_CUBIC)
            al = (np.clip((al - .5) * 1.7 + .5, 0, 1) * 255).astype(np.uint8)
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
