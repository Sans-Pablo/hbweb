#!/usr/bin/env python3
"""Paridad visual: captura escenas fijas del juego y las compara con unas de referencia. Sirve para demostrar que un cambio
de carga/formato/renderizado NO altera lo que se ve (o para ver exactamente qué cambió).

  python3 tools/perf/visual.py --save tools/perf/results/ref        guarda la referencia (hacerlo ANTES de tocar nada)
  python3 tools/perf/visual.py --compare tools/perf/results/ref     captura y compara; escribe diff_*.png junto a la captura
Escenas: ver SCENES (posición del mapa inicial + modo). Antes de capturar espera 4 s a que lleguen las hojas (tarea de F0 del plan: cambiarlo por una señal «todo cargado» determinista).
Tolerancia: --tol (fracción de píxeles distintos, 0.005 por defecto: el agua, las nubes y el reposo del personaje animan entre capturas). Los monstruos y ciudadanos se quitan del mundo antes de capturar.
Referencia y capturas no se versionan (tools/perf/results/ está en .gitignore).
"""
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from e2e import game  # noqa: E402
from PIL import Image, ImageChops  # noqa: E402

SCENES = {"granja": (120, 120), "borde": (30, 30), "centro": (125, 125), "sur": (200, 200)}
# sesión de prueba desechable: se quitan los monstruos y ciudadanos (se mueven y harían ruido en la comparación)
FREEZE = """() => { const w = hb.world; for (const [id, e] of [...w.ents]) if (e.kind === 'npc' || e.kind === 'citizen') w.ents.delete(id); }"""

def shoot(out, mobile):
    out.mkdir(parents=True, exist_ok=True)
    with game(mobile=mobile) as pg:
        for name, (x, y) in SCENES.items():
            pg.evaluate("([x, y]) => hb.conn.send({ t: 'dbg', op: 'teleportxy', x, y })", [x, y]); pg.wait_for_timeout(1500)
            pg.evaluate(FREEZE)
            pg.wait_for_timeout(4000)                                           # deja llegar las hojas de la zona (ver TODO en la ficha: sustituir por una señal «todo cargado»)
            pg.screenshot(path=str(out / f"{name}.png"))
    return list(SCENES)

def compare(a, b, tol):
    bad = []
    for f in sorted(a.glob("*.png")):
        g = b / f.name
        if not g.exists(): bad.append(f"{f.name}: falta la captura"); continue
        x, y = Image.open(f).convert("RGB"), Image.open(g).convert("RGB")
        if x.size != y.size: bad.append(f"{f.name}: tamaño {x.size} ≠ {y.size}"); continue
        d = ImageChops.difference(x, y).convert("L").point(lambda v: 255 if v > 24 else 0)
        frac = d.histogram()[255] / (x.size[0] * x.size[1])
        if frac > tol:
            ImageChops.difference(x, y).save(b / f"diff_{f.name}"); bad.append(f"{f.name}: {frac:.2%} de píxeles distintos (> {tol:.2%}); ver diff_{f.name}")
    return bad

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--save"); ap.add_argument("--compare"); ap.add_argument("--mobile", action="store_true"); ap.add_argument("--tol", type=float, default=0.005)
    a = ap.parse_args()
    if a.save: shoot(Path(a.save), a.mobile); print("referencia guardada en", a.save)
    elif a.compare:
        cur = Path(a.compare).parent / (Path(a.compare).name + "_now"); shoot(cur, a.mobile)
        bad = compare(Path(a.compare), cur, a.tol); print("\n".join(bad) if bad else "OK visual"); sys.exit(1 if bad else 0)
    else: ap.error("usa --save o --compare")

if __name__ == "__main__": main()
