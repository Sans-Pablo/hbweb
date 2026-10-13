"""Añade (sin tocar los existentes) los mapas del servidor original que aún no están en web/data/maps.
    python add_missing_maps.py CARPETA_HGSERVER SALIDA
CARPETA_HGSERVER = HelbreathOriginal/Helbreath.ServerFiles/HGServer (GServer.cfg + MAPDATA con .amd y .txt).
Reutiliza info() de convert_maps.py. No hace falta el pak de sprites: solo informa de los tiles sin sprite exportado."""
import json, os, re, struct, sys
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
hg, out = sys.argv[1:3]
src = open(os.path.join(here, "convert_maps.py"), encoding="utf-8").read()
src = src[:src.index("pak = PakFolder")]
src = src.replace("hb, repo, out = sys.argv[1], sys.argv[2], sys.argv[3]", "hb = repo = hg")
ns = {"__name__": "cm", "hg": hg, "out": out}
sys.argv = ["x", hg, hg, out]
exec(compile(src, "convert_maps", "exec"), ns)
SPOT_, parse = ns["SPOT"], ns["info"]
# info() busca MAPDATA en repo/Files/GameServers/<srv>/MAPDATA: aquí es HGServer/MAPDATA
def info(name):
    import types
    ns["repo"] = None
    code = ns["info"].__code__
    return None
manifest = json.load(open(os.path.join(out, "sprites.json")))
ip = os.path.join(out, "maps", "index.json"); index = json.load(open(ip))
mdir = os.path.join(hg, "MAPDATA"); files = {f.lower(): f for f in os.listdir(mdir)}
names = [m.group(1) for l in open(os.path.join(hg, "GServer.cfg"), encoding="latin-1") for m in [re.match(r"\s*game-server-map\s*=\s*(\S+)", l.split("//")[0])] if m]
# truco: info() lee os.path.join(repo,"Files","GameServers",srv,"MAPDATA"); lo reencaminamos con una carpeta virtual
import shutil, tempfile
tmp = tempfile.mkdtemp(); d = os.path.join(tmp, "Files", "GameServers", "S"); os.makedirs(d); os.symlink(mdir, os.path.join(d, "MAPDATA")) if hasattr(os, "symlink") and False else shutil.copytree(mdir, os.path.join(d, "MAPDATA"), ignore=shutil.ignore_patterns("*.amd"))
ns["repo"] = tmp
added, missing = [], {}
for name in names:
    key = name.lower()
    if key in index: continue
    f = files.get(key + ".amd")
    if not f: print("sin .amd:", name); continue
    raw = open(os.path.join(mdir, f), "rb").read()
    head = raw[:256].replace(b"\0", b" ").decode("latin-1")
    w = int(re.search(r"MAPSIZEX\s*=\s*(\d+)", head).group(1)); h = int(re.search(r"MAPSIZEY\s*=\s*(\d+)", head).group(1))
    body = raw[256:256 + w * h * 10]
    open(os.path.join(out, "maps", key + ".bin"), "wb").write(body)
    meta = dict(ns["info"](name, "S"), id=key, w=w, h=h)
    json.dump(meta, open(os.path.join(out, "maps", key + ".json"), "w"), separators=(",", ":"))
    index[key] = {"w": w, "h": h}; added.append(key)
    for i in range(w * h):
        ts, tf, os_, of = struct.unpack_from("<hhhh", body, i * 10)
        for t in (ts, os_):
            if t and "t%d" % t not in manifest: missing.setdefault(key, set()).add(t)
json.dump(index, open(ip, "w"), separators=(",", ":"))
print(len(added), "mapas nuevos:", " ".join(added))
for k, v in missing.items(): print("  sin sprite", k, len(v), "tiles")
shutil.rmtree(tmp, ignore_errors=True)
