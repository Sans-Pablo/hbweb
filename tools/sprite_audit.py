#!/usr/bin/env python3
"""Inventario de hojas de sprites: dimensiones, bytes en disco, bytes decodificados (RGBA = ancho*alto*4, lo que ocupa
en RAM/VRAM) y, con --deep, cuánto de la hoja es transparente. Marca las que superan el presupuesto de
tools/perf/budget.json (sección «sheets»). Solo lee cabeceras salvo con --deep, así que el modo base tarda segundos.

  python3 tools/sprite_audit.py                      resumen por carpeta + las 15 peores hojas
  python3 tools/sprite_audit.py --json out.json      inventario completo (para comparar antes/después)
  python3 tools/sprite_audit.py --deep --top 30      añade % transparente (lee los píxeles; usa todos los núcleos)
  python3 tools/sprite_audit.py --check              sale con código 1 si alguna hoja rompe el presupuesto
  python3 tools/sprite_audit.py --dir sprites_ia     solo esas carpetas (repetible)
"""
import argparse, json, os, sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "data"
DIRS = ["sprites", "sprites_hd", "sprites_ia", "sprites_mod", "equip", "fx", "ui", "ui_ia"]
EXT = {".png", ".webp", ".ktx2"}

def budget():
    return json.loads((ROOT / "tools" / "perf" / "budget.json").read_text())["sheets"]

def inspect(args):
    path, deep = args
    try:
        with Image.open(path) as im:
            w, h = im.size
            row = {"path": os.path.relpath(path, DATA), "w": w, "h": h, "disk": os.path.getsize(path), "dec": w * h * 4}
            if deep:
                a = im.convert("RGBA").getchannel("A")
                bb = a.getbbox()
                row["empty"] = round(1 - (a.point(lambda v: 255 if v else 0).histogram()[255] / (w * h)), 4)
                row["bbox"] = bb
            return row
    except Exception as e:                                   # hoja corrupta: se informa, no se oculta
        return {"path": os.path.relpath(path, DATA), "error": str(e)}

def collect(dirs):
    return [str(Path(r) / f) for d in dirs if (DATA / d).is_dir() for r, _, fs in os.walk(DATA / d) for f in fs if Path(f).suffix in EXT]

def mb(n): return f"{n / 1048576:.1f}"

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json"); ap.add_argument("--deep", action="store_true"); ap.add_argument("--check", action="store_true")
    ap.add_argument("--top", type=int, default=15); ap.add_argument("--dir", action="append")
    a = ap.parse_args()
    files = collect(a.dir or DIRS)
    with ProcessPoolExecutor() as ex:
        rows = list(ex.map(inspect, [(f, a.deep) for f in files], chunksize=32))
    bad = [r for r in rows if "error" in r]; rows = [r for r in rows if "error" not in r]
    B = budget(); over = []
    for r in rows:
        why = []
        if r["dec"] > B["max_decoded_bytes"]: why.append(f"decodificada {mb(r['dec'])} MB > {mb(B['max_decoded_bytes'])}")
        if r["disk"] > B["max_disk_bytes"]: why.append(f"disco {mb(r['disk'])} MB > {mb(B['max_disk_bytes'])}")
        if max(r["w"], r["h"]) > B["max_side"]: why.append(f"lado {max(r['w'], r['h'])} > {B['max_side']}")
        if why: r["over"] = why; over.append(r)
    per = {}
    for r in rows:
        d = r["path"].split(os.sep)[0]; s = per.setdefault(d, {"files": 0, "disk": 0, "dec": 0, "over": 0})
        s["files"] += 1; s["disk"] += r["disk"]; s["dec"] += r["dec"]; s["over"] += "over" in r
    print(f"{'carpeta':<13}{'hojas':>7}{'disco MB':>10}{'decod. MB':>11}{'> presup.':>11}")
    for d, s in sorted(per.items()): print(f"{d:<13}{s['files']:>7}{mb(s['disk']):>10}{mb(s['dec']):>11}{s['over']:>11}")
    print(f"\nPeores {a.top} por memoria decodificada:")
    for r in sorted(rows, key=lambda r: -r["dec"])[:a.top]:
        extra = f"  vacío {r['empty']:.0%}" if "empty" in r else ""
        print(f"  {r['path']:<40}{r['w']}x{r['h']:<6}{mb(r['dec']):>8} MB RAM{mb(r['disk']):>8} MB disco{extra}")
    if bad: print(f"\n⚠ {len(bad)} hojas ilegibles:", *[b['path'] for b in bad[:10]], sep="\n  ")
    print(f"\n{len(over)} de {len(rows)} hojas superan el presupuesto.")
    if a.json: Path(a.json).write_text(json.dumps({"summary": per, "sheets": rows, "unreadable": bad}, separators=(",", ":")))
    if a.check and (over or bad): sys.exit(1)

if __name__ == "__main__": main()
