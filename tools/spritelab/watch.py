#!/usr/bin/env python3
"""Vigilante de arte (solo local): al cambiar art/recipes.json, art/anchors_manual.json o art/paint*/ reconstruye lo afectado
(slab.py build incremental + anchors.py build). El juego en localhost detecta el cambio (/api/dev/stamp) y se recarga solo.

  python tools/spritelab/watch.py            # deja la ventana abierta mientras editas"""
import os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(HERE, "..", "..", "art")
PY = sys.executable


def snap():
    s = {}
    for root, _, files in os.walk(ART):
        if os.path.basename(root) in ("export",) or ".cache" in root: continue
        for f in files:
            if f.endswith((".png", ".json")) and not f.startswith((".cache", "anchors_check", "sheet")):
                p = os.path.join(root, f); s[p] = os.path.getmtime(p)
    return s


def run(*a):
    r = subprocess.run([PY, *a], cwd=os.path.join(HERE, "..", ".."))
    return r.returncode == 0


if __name__ == "__main__":
    last = snap(); print("Vigilando art/ … (Ctrl+C para salir)")
    while True:
        time.sleep(1.5)
        cur = snap()
        if cur == last: continue
        time.sleep(0.8); cur = snap()                       # deja terminar de escribir
        print("cambio detectado, reconstruyendo…")
        ok = run("tools/spritelab/slab.py", "build") and run("tools/spritelab/anchors.py", "build")
        print("listo" if ok else "ERROR en la reconstrucción"); last = snap()
