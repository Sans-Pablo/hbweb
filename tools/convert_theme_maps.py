"""Mapas de dungeon del original que dan escenario a las cámaras de los 4 reyes de la cripta (ver build_dungeon_palette.py):
    python3 tools/convert_theme_maps.py CARPETA_HELBREATH SALIDA        (SALIDA = web/data)
  fuego  -> dglv4      (dungeon con lava)
  sombra -> Toh1..Toh3 (Tower of Hell)
  hielo  -> icebound
  oro    -> maze
Escribe SALIDA/maps/<mapa>.bin y .json mínimo ({id,w,h}; NO entran en maps/index.json: no son mapas jugables) y añade a sprites.json /
sprites/ las hojas de teselas que falten (mismo índice global tNNN que el resto)."""
import json, os, re, struct, sys
from convert import PakFolder, export
from tile_table import locate

hb, out = sys.argv[1], sys.argv[2]
MAPS = ["dglv4", "Toh1", "Toh2", "Toh3", "icebound", "maze"]
pak = PakFolder(os.path.join(hb, "SPRITES"))
sdir = os.path.join(out, "sprites"); os.makedirs(sdir, exist_ok=True)
man_path = os.path.join(out, "sprites.json"); manifest = json.load(open(man_path))
amds = {f.lower(): f for f in os.listdir(os.path.join(hb, "MAPDATA"))}
used = set()
for name in MAPS:
    f = amds[name.lower() + ".amd"]
    raw = open(os.path.join(hb, "MAPDATA", f), "rb").read()
    head = raw[:256].replace(b"\0", b" ").decode("latin-1")
    w = int(re.search(r"MAPSIZEX\s*=\s*(\d+)", head).group(1)); h = int(re.search(r"MAPSIZEY\s*=\s*(\d+)", head).group(1))
    body = raw[256:256 + w * h * 10]; key = name.lower()
    p = os.path.join(out, "maps", key)
    if not os.path.exists(p + ".bin"): open(p + ".bin", "wb").write(body)
    if not os.path.exists(p + ".json"): json.dump({"id": key, "w": w, "h": h}, open(p + ".json", "w"), separators=(",", ":"))
    for i in range(w * h):
        ts, tf, os_, of = struct.unpack_from("<hhhh", body, i * 10)
        used.add(ts)
        if os_:
            used.add(os_)
            if 100 <= os_ < 150: used.add(os_ + 50)
    print(key, w, h)
n = 0
for idx in sorted(used):
    k = "t%d" % idx; loc = locate(idx)
    if loc and k not in manifest:
        export(pak, loc[0], loc[1], sdir, k, manifest); n += 1
json.dump(manifest, open(man_path, "w"), separators=(",", ":"))
print("sprites nuevos:", n)
