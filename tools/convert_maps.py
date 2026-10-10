"""Convierte los mapas del servidor original (ciudad de Aresden, interiores...) para la versión web.
    python convert_maps.py CARPETA_HELBREATH CARPETA_REPO_SERVIDOR SALIDA [--server Aresden]
Salida: SALIDA/maps/<mapa>.bin (casillas, 10 bytes cada una), SALIDA/maps/<mapa>.json (tamaño, teleports, puntos
de inicio, NPC, generadores de monstruos, zonas sin ataque...) y SALIDA/maps/index.json. Los sprites de mapa que
falten se añaden a SALIDA/sprites.json y SALIDA/sprites/ (mismo índice global tNNN que arefarm)."""
import json, os, re, struct, sys
from convert import PakFolder, export, read_npc_cfg
from tile_table import locate

hb, repo, out = sys.argv[1], sys.argv[2], sys.argv[3]
servers = (sys.argv[sys.argv.index("--server") + 1] if "--server" in sys.argv else "Aresden").split(",")   # varios: Aresden,Middleland,...
only = set(sys.argv[sys.argv.index("--only") + 1].lower().split(",")) if "--only" in sys.argv else None      # solo estos mapas (p. ej. --server Elvine --only elvfarm)
os.makedirs(os.path.join(out, "maps"), exist_ok=True)


# tipo de spot-mob-generator -> (monstruo de NPC.cfg, prob. de habilidad especial %, tipo de habilidad): Game.cpp del servidor
SPOT = {10: ('Slime', 5, 1), 16: ('Giant-Ant', 10, 2), 14: ('Orc', 15, 1), 18: ('Zombie', 15, 3), 11: ('Skeleton', 35, 8), 6: ('Orc-Mage', 30, 7), 17: ('Scorpion', 15, 3), 12: ('Stone-Golem', 25, 5), 13: ('Cyclops', 35, 8), 22: ('Amphis', 20, 3), 23: ('Clay-Golem', 20, 5), 24: ('Guard-Aresden', 20, 1), 25: ('Guard-Elvine', 20, 1), 26: ('Guard-Neutral', 20, 1), 27: ('Hellbound', 20, 1), 29: ('Orge', 20, 1), 30: ('Liche', 30, 8), 31: ('Demon', 20, 8), 32: ('Unicorn', 35, 7), 33: ('WereWolf', 25, 1), 34: ('Dummy', 5, 1), 35: ('Attack-Dummy', 5, 1), 48: ('Stalker', 20, 3), 49: ('Hellclaw', 20, 8), 50: ('Tigerworm', 20, 8), 54: ('Dark-Elf', 20, 8), 53: ('Beholder', 20, 8), 52: ('Gagoyle', 20, 8), 57: ('Giant-Frog', 10, 2), 58: ('Mountain-Giant', 25, 1), 59: ('Ettin', 20, 8), 60: ('Cannibal-Plant', 20, 5), 61: ('Rudolph', 20, 1), 62: ('DireBoar', 20, 1), 63: ('Frost', 20, 8), 65: ('Ice-Golem', 20, 8), 66: ('Wyvern', 20, 1), 55: ('Rabbit', 20, 1), 67: ('McGaffin', 20, 1), 68: ('Perry', 20, 1), 69: ('Devlin', 20, 1), 73: ('Fire-Wyvern', 20, 1), 70: ('Barlog', 20, 1), 80: ('Tentocle', 20, 1), 71: ('Centaurus', 20, 1), 75: ('Giant-Lizard', 20, 1), 78: ('Minotaurs', 20, 1), 81: ('Abaddon', 20, 1), 72: ('Claw-Turtle', 20, 1), 74: ('Giant-Crayfish', 20, 1), 76: ('Giant-Plant', 20, 1), 77: ('MasterMage-Orc', 20, 1), 79: ('Nizie', 20, 1), 56: ('Cat', 15, 6), 28: ('Troll', 25, 3)}


def names():
    res = []
    for srv in servers:
        for line in open(os.path.join(repo, "Files", "GameServers", srv, "GServer.cfg"), encoding="latin-1"):
            m = re.match(r"\s*game-server-map\s*=\s*(\S+)", line.split("//")[0])
            if m:
                res.append((srv, m.group(1)))
    return res


def info(name, srv):
    """Interpreta mapa.txt (MAPDATA del servidor)."""
    mdir = os.path.join(repo, "Files", "GameServers", srv, "MAPDATA")
    f = next((x for x in os.listdir(mdir) if x.lower() == name.lower() + ".txt"), None)
    r = {"teleports": [], "initial": {}, "npcs": [], "waypoints": {}, "spawns": [], "noAttack": [], "fixedDay": None,
         "maxObjects": None, "levelLimit": 0, "upperLevelLimit": 0, "avoid": None, "location": ""}
    if not f:
        return r
    for raw in open(os.path.join(mdir, f), encoding="latin-1"):
        line = raw.split("//")[0].strip()
        m = re.match(r"([A-Za-z-]+)\s*=\s*(.*)", line)
        if not m:
            continue
        k, v = m.group(1).lower(), m.group(2).split()
        if k == "teleport-loc" and len(v) >= 6:
            r["teleports"].append({"x": int(v[0]), "y": int(v[1]), "map": v[2], "dx": int(v[3]), "dy": int(v[4]), "dir": int(v[5])})
        elif k == "initial-point":
            r["initial"][v[0]] = [int(v[1]), int(v[2])]
        elif k == "waypoint":
            r["waypoints"][v[0]] = [int(v[1]), int(v[2])]
        elif k == "npc":
            r["npcs"].append({"name": v[0], "move": int(v[1]), "wp": [int(x) for x in v[2:12] if x.lstrip("-").isdigit()][:10], "prefix": int(v[-1]) if len(v) > 12 else 0})
        elif k == "spot-mob-generator" and len(v) >= 8:
            r["spawns"].append({"id": int(v[0]), "kind": int(v[1]), "rect": [int(x) for x in v[2:6]], "mob": int(v[6]), "name": SPOT.get(int(v[6]), ("Orc", 15, 1))[0], "specialProb": SPOT.get(int(v[6]), ("Orc", 15, 1))[1], "specialKind": SPOT.get(int(v[6]), ("Orc", 15, 1))[2], "max": int(v[7])})
        elif k == "no-attack-area":
            r["noAttack"].append([int(x) for x in v[1:5]])
        elif k == "fixed-dayornight-mode":
            r["fixedDay"] = int(v[0])
        elif k == "maximum-object":
            r["maxObjects"] = int(v[0])
        elif k == "level-limit":
            r["levelLimit"] = int(v[0])
        elif k == "upper-level-limit":
            r["upperLevelLimit"] = int(v[0])
        elif k == "npc-avoidrect":
            r["avoid"] = [int(x) for x in v[1:5]]
        elif k == "map-location":
            r["location"] = v[0]
    return r


pak = PakFolder(os.path.join(hb, "SPRITES"))
sdir = os.path.join(out, "sprites")
os.makedirs(sdir, exist_ok=True)
man_path = os.path.join(out, "sprites.json")
manifest = json.load(open(man_path))
amds = {f.lower(): f for f in os.listdir(os.path.join(hb, "MAPDATA"))}
ip = os.path.join(out, "maps", "index.json")
index = json.load(open(ip)) if os.path.exists(ip) and "--server" in sys.argv else {}
used = set()
for srv, name in names():
    if only and name.lower() not in only:
        continue
    f = amds.get(name.lower() + ".amd")
    if not f:
        print("sin .amd:", name)
        continue
    raw = open(os.path.join(hb, "MAPDATA", f), "rb").read()
    head = raw[:256].replace(b"\0", b" ").decode("latin-1")
    w = int(re.search(r"MAPSIZEX\s*=\s*(\d+)", head).group(1))
    h = int(re.search(r"MAPSIZEY\s*=\s*(\d+)", head).group(1))
    body = raw[256:256 + w * h * 10]
    key = name.lower()
    open(os.path.join(out, "maps", key + ".bin"), "wb").write(body)
    meta = dict(info(name, srv), id=key, w=w, h=h)
    json.dump(meta, open(os.path.join(out, "maps", key + ".json"), "w"), separators=(",", ":"))
    index[key] = {"w": w, "h": h}
    for i in range(w * h):
        ts, tf, os_, of = struct.unpack_from("<hhhh", body, i * 10)
        used.add(ts)
        if os_:
            used.add(os_)
            if 100 <= os_ < 150:
                used.add(os_ + 50)
    print(key, w, h, len(meta["teleports"]), "teleports", len(meta["npcs"]), "npcs", len(meta["spawns"]), "spawns")
n = 0
for idx in sorted(used):
    k = "t%d" % idx
    loc = locate(idx)
    if loc and k not in manifest:
        export(pak, loc[0], loc[1], sdir, k, manifest)
        n += 1
json.dump(manifest, open(man_path, "w"), separators=(",", ":"))
json.dump(index, open(os.path.join(out, "maps", "index.json"), "w"), separators=(",", ":"))
print("sprites nuevos:", n)
