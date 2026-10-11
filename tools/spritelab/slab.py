#!/usr/bin/env python3
"""spritelab: mejora/genera sprites y HD en bloque a partir de recetas (art/recipes.json).

  python tools/spritelab/slab.py build [clave-glob ...]   reconstruye (incremental) mod 1x + HD
  python tools/spritelab/slab.py sheet demon[0-7] [-o f.png] [--zoom 3]   original | mod | HD en una imagen
  python tools/spritelab/slab.py list                      cobertura HD por criatura
  python tools/spritelab/slab.py export <clave> <f>        vuelca un fotograma 1x a PNG para retocarlo a mano
  python tools/spritelab/slab.py import <clave> <f> <png>  guarda solo el DELTA como capa paint

Salida: web/data/sprites_mod/ + sprites_mod.json (1x), web/data/sprites_hd/ + sprites_hd.json (HD)."""
import argparse, fnmatch, json, os, re, sys
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import core, ops as O, upscale as U
from core import DATA, ART, jload

MOD_DIR = os.path.join(DATA, "sprites_mod")
HD_DIR = os.path.join(DATA, "sprites_hd")
CACHE = os.path.join(ART, ".cache.json")


def recipes(): return jload(os.path.join(ART, "recipes.json"), {"rules": [], "hd": {}})


def _build_one(args):
    """Procesa una clave: fotogramas -> ops 1x -> (mod png) -> HD -> ops hd -> webp. Devuelve (clave, modEntry, hdEntry)."""
    key, src, entry, ops, hdp, changed_mod = args
    sheet = core.load_sheet(entry)
    frames = entry["frames"]
    imgs = core.split_frames(sheet, frames)
    base_ops = [o for o in ops if not o.get("hd")]
    hd_ops = [o for o in ops if o.get("hd")]
    imgs = [O.clean(im) for im in imgs]                    # regla base: siempre se limpian las motas sueltas
    imgs1 = [O.apply(im, base_ops, {"key": key, "src": src, "f": i, "k": 1}) for i, im in enumerate(imgs)]
    mod = None
    if True:                                               # el 1x limpio también se publica (sprites_mod)
        os.makedirs(MOD_DIR, exist_ok=True)
        Image.fromarray(core.pack_frames(imgs1, frames, 1, sheet.shape[:2])).save(os.path.join(MOD_DIR, key + ".png"), optimize=True)
        mod = {"png": key + ".png", "frames": frames}
    elif ops is not None and hd_ops:
        mod = None
    hd = None
    if hdp is not None:
        k = hdp.get("k", 4)
        up = [U.upscale(im, **hdp) for im in imgs1]
        up = [O.apply(im, hd_ops, {"key": key, "src": src, "f": i, "k": k}) for i, im in enumerate(up)]
        # paint HD sin otras ops: capas pintadas a escala HD
        os.makedirs(HD_DIR, exist_ok=True)
        Image.fromarray(core.pack_frames(up, frames, k, sheet.shape[:2])).save(
            os.path.join(HD_DIR, key + ".webp"), quality=hdp.get("quality", 92), method=6)
        hd = {"png": key + ".webp", "k": k}
    return key, mod, hd


def _sig(key, src, entry, ops, hdp, rc):
    paints = []
    for d in (False, True):
        pd = os.path.dirname(core.paint_path(src, 0, d))
        if os.path.isdir(pd):
            paints += [core.file_hash(os.path.join(pd, f)) for f in sorted(os.listdir(pd))]
    return json.dumps([core.ALGO_VERSION, core.file_hash(core.sheet_path(entry)), ops, hdp, paints], sort_keys=True)


def cmd_build(a):
    rc, base = recipes(), core.base_manifest()
    plan = core.resolve(rc, base)
    keys = {}
    for k in base: keys[k] = {"src": k, "ops": plan.get(k, {}).get("ops", [])}
    for k, v in plan.items(): keys[k] = v
    todo_keys = [k for k in keys if (not a.keys or core.match(k, a.keys))]
    cache = jload(CACHE, {}) if not a.force else {}
    jobs, sigs = [], {}
    for k in todo_keys:
        v = keys[k]; hdp = core.hd_params(rc, k)
        if not v["ops"] and hdp is None: continue          # nada que hacer
        entry = base[v["src"]]
        s = _sig(k, v["src"], entry, v["ops"], hdp, rc)
        sigs[k] = s
        if cache.get(k) == s: continue
        jobs.append((k, v["src"], entry, v["ops"], hdp, True))
    print(f"{len(jobs)} a construir de {len(todo_keys)} candidatas")
    mod_m = jload(os.path.join(DATA, "sprites_mod.json"), {})
    hd_m = jload(os.path.join(DATA, "sprites_hd.json"), {})
    with ProcessPoolExecutor() as ex:
        for i, (k, mod, hd) in enumerate(ex.map(_build_one, jobs, chunksize=8)):
            if mod: mod_m[k] = mod
            if hd: hd_m[k] = hd
            cache[k] = sigs[k]
            if i % 200 == 199: print(" ", i + 1)
    with open(os.path.join(DATA, "sprites_mod.json"), "w", encoding="utf-8", newline="\r\n") as f: json.dump(mod_m, f, separators=(",", ":"))
    with open(os.path.join(DATA, "sprites_hd.json"), "w", encoding="utf-8", newline="\r\n") as f: json.dump(hd_m, f, separators=(",", ":"))
    os.makedirs(ART, exist_ok=True)
    with open(CACHE, "w") as f: json.dump(cache, f)
    print(f"OK: mod={len(mod_m)} hd={len(hd_m)}")


def _expand(pats, keys):
    out = []
    for p in pats:
        m = re.fullmatch(r"(\D+)\[(\d+)-(\d+)\]", p)           # demon[0-7]
        if m: out += [f"{m[1]}{i}" for i in range(int(m[2]), int(m[3]) + 1)]
        else: out += [k for k in keys if fnmatch.fnmatchcase(k, p)]
    return [k for k in out if k in keys]


def _crop(path, entry, f, k):
    x, y, w, h = entry["frames"][f][:4]
    im = Image.open(path).convert("RGBA")
    return im.crop((x * k, y * k, (x + w) * k, (y + h) * k))


def cmd_sheet(a):
    base = core.base_manifest()
    mod, hd = jload(os.path.join(DATA, "sprites_mod.json"), {}), jload(os.path.join(DATA, "sprites_hd.json"), {})
    keys = _expand(a.keys, base)
    rows = []
    for key in keys:
        n = len(base[key]["frames"]); f = min(a.frame, n - 1)
        cells = [_crop(core.sheet_path(base[key]), base[key], f, 1)]
        if key in mod: cells.append(_crop(os.path.join(MOD_DIR, mod[key]["png"]), mod[key], f, 1))
        cells = [c.resize((c.width * a.zoom, c.height * a.zoom), Image.NEAREST) for c in cells]
        if key in hd:
            e = hd[key]; im = _crop(os.path.join(HD_DIR, e["png"]), base[key], f, e["k"])
            cells.append(im.resize((im.width * a.zoom // e["k"], im.height * a.zoom // e["k"]), Image.LANCZOS))
        rows.append(cells)
    if not rows: print("sin claves"); return
    W = max(sum(c.width + 8 for c in r) for r in rows); H = sum(max(c.height for c in r) + 8 for r in rows)
    out = Image.new("RGBA", (W, H), (60, 60, 70, 255)); y = 0
    for r in rows:
        x = 0
        for c in r: out.alpha_composite(c, (x, y)); x += c.width + 8
        y += max(c.height for c in r) + 8
    out.convert("RGB").save(a.o); print(a.o, out.size)


def cmd_list(a):
    base = core.base_manifest(); hd = jload(os.path.join(DATA, "sprites_hd.json"), {})
    groups = {}
    for k in base:
        g = re.sub(r"\d+$", "", k); t = groups.setdefault(g, [0, 0]); t[0] += 1; t[1] += k in hd
    for g, (n, h) in sorted(groups.items()): print(f"{g:20s} {h}/{n}")


def cmd_export(a):
    base = core.base_manifest(); e = base[a.key]
    im = core.split_frames(core.load_sheet(e), e["frames"])[a.f]
    os.makedirs(os.path.join(ART, "export"), exist_ok=True)
    p = os.path.join(ART, "export", f"{a.key}_{a.f}.png"); Image.fromarray(im).save(p); print(p)


def cmd_import(a):
    base = core.base_manifest(); e = base[a.key]
    orig = core.split_frames(core.load_sheet(e), e["frames"])[a.f]
    new = np.array(Image.open(a.png).convert("RGBA"))
    if new.shape != orig.shape: sys.exit(f"tamaño {new.shape[:2]} != {orig.shape[:2]}")
    diff = np.any(new != orig, axis=-1)
    layer = np.zeros_like(new); layer[diff] = new[diff]
    layer[diff & (new[..., 3] == 0)] = (0, 0, 0, 1)            # borrar: alfa mínimo no basta; se avisa
    p = core.paint_path(a.key, a.f); os.makedirs(os.path.dirname(p), exist_ok=True)
    Image.fromarray(layer).save(p); print(f"{int(diff.sum())} píxeles cambiados -> {p}")
    print('Añade a art/recipes.json una regla {"match":["%s"],"ops":[{"op":"paint"}]} si no existe.' % a.key)


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    b = sp.add_parser("build"); b.add_argument("keys", nargs="*"); b.add_argument("--force", action="store_true"); b.set_defaults(fn=cmd_build)
    s = sp.add_parser("sheet"); s.add_argument("keys", nargs="+"); s.add_argument("-o", default=os.path.join(ART, "sheet.png"))
    s.add_argument("--zoom", type=int, default=3); s.add_argument("--frame", type=int, default=0); s.set_defaults(fn=cmd_sheet)
    l = sp.add_parser("list"); l.set_defaults(fn=cmd_list)
    e = sp.add_parser("export"); e.add_argument("key"); e.add_argument("f", type=int); e.set_defaults(fn=cmd_export)
    i = sp.add_parser("import"); i.add_argument("key"); i.add_argument("f", type=int); i.add_argument("png"); i.set_defaults(fn=cmd_import)
    a = ap.parse_args(); a.fn(a)


if __name__ == "__main__":
    main()
