#!/usr/bin/env python3
"""Banco de rendimiento del cliente (Playwright + Chromium). Mide en el navegador real lo que el jugador nota:
tiempo hasta poder jugar, bytes descargados, memoria de imágenes decodificadas, tirones (tareas largas) y reparto de fotogramas.

  python3 tools/perf/run.py                              escenarios boot + walk + teleport, imprime tabla
  python3 tools/perf/run.py --hd off                     compara sin HD (por defecto el juego ya arranca en remastered+HD)
  python3 tools/perf/run.py --out tools/perf/results/x.json
  python3 tools/perf/run.py --check                      falla (código 1) si algo rompe tools/perf/budget.json
  python3 tools/perf/run.py --baseline tools/perf/baseline.json   falla si empeora más de regression_tolerance respecto a la base
  python3 tools/perf/run.py --scenario walk --seconds 30
Chromium headless usa GL por software: los números absolutos son PESIMISTAS. Compara siempre contra una base medida en la misma máquina
(--out al empezar, --baseline al terminar). Ver docs/sistemas/rendimiento-sprites.md.
"""
import argparse, json, platform, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from e2e import players  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
BUDGET = json.loads((Path(__file__).parent / "budget.json").read_text())

# se inyecta antes de que cargue la página: registra tareas largas y el tiempo de cada fotograma
INIT = """
window.__imgs = [];                                  // todas las imágenes que crea el juego (para medir memoria decodificada)
const __Img = window.Image; window.Image = function (w, h) { const i = new __Img(w, h); window.__imgs.push(new WeakRef(i)); return i; }; window.Image.prototype = __Img.prototype;
window.__perf = { long: [], frames: [], on: false };
try { performance.setResourceTimingBufferSize(20000); } catch (e) {}   // por defecto solo guarda 250 recursos
try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
(function tick(t){ const p = window.__perf; if (p.on) { if (p.last) p.frames.push(t - p.last); p.last = t; } else p.last = 0; requestAnimationFrame(tick); })(0);
"""
SNAP = """() => {
  const res = performance.getEntriesByType('resource').filter(r => /\\/data\\/(sprites|sprites_hd|sprites_ia|sprites_mod|equip|fx|ui|ui_ia)\\//.test(r.name));
  let dec = 0, n = 0; const seen = new Set();
  for (const w of window.__imgs) { const i = w.deref(); if (i && !seen.has(i) && i.complete && i.naturalWidth) { seen.add(i); dec += i.naturalWidth * i.naturalHeight * 4; n++; } }
  return { sheets: res.length, transfer: res.reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0), decoded: dec, decodedSheets: n,
           heap: performance.memory ? performance.memory.usedJSHeapSize : 0 };
}"""
PCT = lambda a, q: (sorted(a)[min(len(a) - 1, int(len(a) * q))] if a else 0)

def frame_stats(pg, label):
    d = pg.evaluate("() => { const p = window.__perf; const f = p.frames.slice(); p.frames.length = 0; const l = p.long.filter(x => x[1] > 50).length; return { f, l }; }")
    f = d["f"]
    return {"frames": len(f), "frame_p50_ms": round(PCT(f, .5), 1), "frame_p95_ms": round(PCT(f, .95), 1), "frame_p99_ms": round(PCT(f, .99), 1),
            "frame_max_ms": round(max(f, default=0), 1), "frames_over_50ms": sum(x > 50 for x in f), "long_tasks_over_50ms": d["l"]}

def run(args):
    out = {"env": {"platform": platform.platform(), "hd_arg": args.hd, "mobile": args.mobile, "seconds": args.seconds, "ts": int(time.time())}, "scenarios": {}}
    with players(1, mobile=args.mobile, skip_tutorial=True, query=args.query, init=INIT) as (pg,):
        # --- boot: lo que ya pasó al crear el personaje (la tabla de recursos y las tareas largas desde la navegación)
        pg.evaluate("() => { window.__perf.on = true; }")
        if args.hd != "auto": pg.evaluate("on => { hb.renderer.hdOpt = on; hb.renderer.spr.hd = on && hb.renderer.mode === 'remastered'; }", args.hd == "on")
        out["env"]["hd_effective"] = pg.evaluate("() => !!hb.renderer.spr.hd")
        pg.wait_for_timeout(3000)
        nav = pg.evaluate("() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; }")
        snap = pg.evaluate(SNAP); lt = pg.evaluate("() => window.__perf.long.filter(x => x[1] > 50).length")
        out["scenarios"]["boot"] = {"ready_ms": round(nav["load"]), "transfer_bytes": snap["transfer"], "decoded_bytes": snap["decoded"], "decoded_sheets": snap["decodedSheets"],
                                   "sheets_requested": snap["sheets"], "long_tasks_over_50ms": lt, "heap_bytes": snap["heap"]}
        pg.evaluate("() => { window.__perf.frames.length = 0; }")
        # --- walk: caminar y correr en círculos (cargan hojas nuevas al descubrir monstruos, losetas y equipo)
        if args.scenario in ("all", "walk"):
            t0 = time.time(); i = 0
            while time.time() - t0 < args.seconds:
                pg.evaluate("d => hb.conn.send({ t: 'move', dir: d, run: true })", [1, 3, 5, 7][(i // 12) % 4]); i += 1; pg.wait_for_timeout(120)
            r = frame_stats(pg, "walk"); s2 = pg.evaluate(SNAP)
            r.update({"transfer_bytes": s2["transfer"] - snap["transfer"], "decoded_bytes_delta": s2["decoded"] - snap["decoded"]}); out["scenarios"]["walk"] = r
        # --- teleport: salto largo dentro del mapa (zona nueva: hojas nuevas de golpe)
        if args.scenario in ("all", "teleport"):
            pg.evaluate("() => { window.__perf.frames.length = 0; }"); s1 = pg.evaluate(SNAP); t0 = time.time()
            pg.evaluate("() => hb.conn.send({ t: 'dbg', op: 'teleportxy', x: 200, y: 200 })"); pg.wait_for_timeout(5000)
            r = frame_stats(pg, "teleport"); s2 = pg.evaluate(SNAP)
            r.update({"ready_ms": 5000, "transfer_bytes": s2["transfer"] - s1["transfer"], "decoded_bytes_delta": s2["decoded"] - s1["decoded"]}); out["scenarios"]["teleport"] = r
        out["errors"] = pg.errors[:20]
    return out

def judge(out, base, tol, gpu=False):
    bad = []
    lims = lambda sc: {**BUDGET["scenarios"].get(sc, {}), **(BUDGET["gpu_scenarios"].get(sc, {}) if gpu else {})}
    for sc, m in out["scenarios"].items():
        for key, lim in lims(sc).items():
            met = key.rsplit("_max", 1)[0]
            if met in m and m[met] > lim: bad.append(f"[presupuesto] {sc}.{met} = {m[met]} > {lim}")
        for met, v in (base or {}).get("scenarios", {}).get(sc, {}).items():
            if isinstance(v, (int, float)) and v > 0 and met in m and met not in ("frames", "sheets_requested", "decoded_sheets") and m[met] > v * (1 + tol) + (2 if "ms" in met else 0):
                bad.append(f"[regresión] {sc}.{met}: {v} → {m[met]} (+{(m[met] / v - 1):.0%})")
    return bad

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hd", choices=["on", "off", "auto"], default="auto", help="fuerza «Sprites y terreno HD» (auto = ajuste por defecto del juego)"); ap.add_argument("--gpu", action="store_true", help="exige también los tiempos de fotograma (solo con GPU real)"); ap.add_argument("--mobile", action="store_true"); ap.add_argument("--seconds", type=int, default=20)
    ap.add_argument("--scenario", default="all", choices=["all", "boot", "walk", "teleport"]); ap.add_argument("--query", default="")
    ap.add_argument("--out"); ap.add_argument("--baseline"); ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    out = run(a)
    for sc, m in out["scenarios"].items(): print(f"{sc:9}", "  ".join(f"{k}={v}" for k, v in m.items()))
    if out["errors"]: print("errores de consola:", *out["errors"], sep="\n  ")
    if a.out: Path(a.out).parent.mkdir(parents=True, exist_ok=True); Path(a.out).write_text(json.dumps(out, indent=1))
    base = json.loads(Path(a.baseline).read_text()) if a.baseline else None
    bad = judge(out, base, BUDGET["regression_tolerance"], a.gpu) if (a.check or a.baseline) else []
    print("\n".join(bad) if bad else ("OK perf" if (a.check or a.baseline) else ""))
    sys.exit(1 if bad else 0)

if __name__ == "__main__": main()
