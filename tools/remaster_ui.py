#!/usr/bin/env python3
"""Versión IA de las hojas de la interfaz (cuadros de diálogo: bolsa, personaje, tiendas…). Real-ESRGAN x4plus local.
    python tools/remaster_ui.py ESRGAN_DIR [clave ...] [--force]     (sin claves: todas menos las fuentes de texto)
Entrada: web/data/ui.json + web/data/ui/*.png. Salida: web/data/ui_ia/<clave>.webp y web/data/ui_ia.json ({clave:{png,k}}).
Mismos fotogramas que la hoja original (coordenadas x4), así que gui.js solo cambia de imagen y factor. Derivados: no se versionan."""
import json, os, re, subprocess, sys, tempfile, shutil
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "data")
K = 4
SKIP = r"sprfonts_\d+|dialogtext_\d+"        # texto: se queda nítido con la hoja original

def main():
    args = [a for a in sys.argv[1:] if a != "--force"]; force = "--force" in sys.argv
    esr, only = args[0], args[1:]
    man = json.load(open(os.path.join(ROOT, "ui.json")))
    out = os.path.join(ROOT, "ui_ia"); os.makedirs(out, exist_ok=True)
    fp = os.path.join(ROOT, "ui_ia.json"); ia = json.load(open(fp)) if os.path.exists(fp) else {}
    keys = [k for k in man if (k in only if only else not re.fullmatch(SKIP, k))]
    keys = [k for k in keys if force or not os.path.exists(os.path.join(out, k + ".webp"))]
    if not keys: print("ya hecho"); return
    tmp = tempfile.mkdtemp(); a, b = os.path.join(tmp, "in"), os.path.join(tmp, "out"); os.makedirs(a); os.makedirs(b)
    orig = {}
    for k in keys:
        o = np.array(Image.open(os.path.join(ROOT, "ui", man[k]["png"])).convert("RGBA")); orig[k] = o
        idx = ndi.distance_transform_edt(~(o[..., 3] > 10), return_distances=False, return_indices=True)   # el color de los bordes cubre lo transparente (sin halo)
        Image.fromarray(o[..., :3][idx[0], idx[1], :]).save(os.path.join(a, k + ".png"))
    subprocess.run([os.path.join(esr, "realesrgan-ncnn-vulkan.exe"), "-i", a, "-o", b, "-n", "realesrgan-x4plus",
                    "-m", os.path.join(esr, "models"), "-s", "4", "-f", "png"], check=True, capture_output=True)
    for k in keys:
        rgb = np.array(Image.open(os.path.join(b, k + ".png")).convert("RGB")); h, w = rgb.shape[:2]
        src = cv2.resize(orig[k][..., :3], (w, h), interpolation=cv2.INTER_CUBIC)
        # la IA inventa tono: se conserva el brillo medio local del original para no cambiar el aspecto de los marcos
        lo = lambda x: cv2.GaussianBlur(x.astype(np.float32), (0, 0), 6)
        rgb = np.clip(rgb.astype(np.float32) + lo(src) - lo(rgb), 0, 255).astype(np.uint8)
        al = np.clip(cv2.resize(orig[k][..., 3], (w, h), interpolation=cv2.INTER_CUBIC), 0, 255).astype(np.uint8)
        Image.fromarray(np.dstack([rgb, al])).save(os.path.join(out, k + ".webp"), "WEBP", quality=92, method=4, exact=True)
        ia[k] = {"png": k + ".webp", "k": K}
        print(k, rgb.shape[1], "x", rgb.shape[0], flush=True)
    shutil.rmtree(tmp)
    json.dump(ia, open(fp, "w"), separators=(",", ":"))

if __name__ == "__main__":
    main()
