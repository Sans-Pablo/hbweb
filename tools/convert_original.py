"""Regenera los datos de monstruos y generadores desde el servidor ORIGINAL (HelbreathOriginal/Helbreath.ServerFiles).
    python tools/convert_original.py [RUTA_ServerFiles] [SALIDA=web/data]
- npc.json: estadísticas de Config/Npc.cfg. Columnas de la cabecera: Name Type HitDice DR HR MinBrav ExpDice ADT ADR Size Side
  ActionLmt ActionTime MR ML DoW Chat SrchRange RegTime Attr AbsM Mana MR AtkRange Gold (HG.cpp ~9400-9830).
  ExpDice se guarda multiplicado por EXPMULTIPLIER (150) y Gold por GOLDDROPMULTIPLIER (100) (GlobalDef.h:76-77; HG.cpp:9603, 9813).
  Se conservan sprite/sound/town y las fichas inventadas del port (Healer, Buffer, Aura, Guard...); no se añaden monstruos sin sprite.
- maps/*.json y arefarm.spawns.json: spot-mob-generator, maximum-object y random-mob-generator de HGServer/MAPDATA/<mapa>.txt."""
import json, os, re, sys

SF = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\sansp\Documents\HelbreathOriginal\Helbreath.ServerFiles"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "data")
EXPMULTIPLIER, GOLDDROPMULTIPLIER = 150, 100
COLS = "type hitDice defenseRatio hitRatio minBravery expDice attackDiceThrow attackDiceRange size side actionLimit actionTime resistMagic magicLevel dayOfWeek chat searchRange regenTime attribute absDamage maxMana magicHitRatio attackRange gold".split()

# tipo de spot-mob-generator -> (monstruo de Npc.cfg, prob. de habilidad especial %, tipo): tabla de convert_maps.py (switch del servidor)
SPOT = {10: ('Slime', 5, 1), 16: ('Giant-Ant', 10, 2), 14: ('Orc', 15, 1), 18: ('Zombie', 15, 3), 11: ('Skeleton', 35, 8), 6: ('Orc-Mage', 30, 7), 17: ('Scorpion', 15, 3), 12: ('Stone-Golem', 25, 5), 13: ('Cyclops', 35, 8), 22: ('Amphis', 20, 3), 23: ('Clay-Golem', 20, 5), 24: ('Guard-Aresden', 20, 1), 25: ('Guard-Elvine', 20, 1), 26: ('Guard-Neutral', 20, 1), 27: ('Hellbound', 20, 1), 29: ('Orge', 20, 1), 30: ('Liche', 30, 8), 31: ('Demon', 20, 8), 32: ('Unicorn', 35, 7), 33: ('WereWolf', 25, 1), 34: ('Dummy', 5, 1), 35: ('Attack-Dummy', 5, 1), 48: ('Stalker', 20, 3), 49: ('Hellclaw', 20, 8), 50: ('Tigerworm', 20, 8), 54: ('Dark-Elf', 20, 8), 53: ('Beholder', 20, 8), 52: ('Gagoyle', 20, 8), 57: ('Giant-Frog', 10, 2), 58: ('Mountain-Giant', 25, 1), 59: ('Ettin', 20, 8), 60: ('Cannibal-Plant', 20, 5), 61: ('Rudolph', 20, 1), 62: ('DireBoar', 20, 1), 63: ('Frost', 20, 8), 65: ('Ice-Golem', 20, 8), 66: ('Wyvern', 20, 1), 55: ('Rabbit', 20, 1), 67: ('McGaffin', 20, 1), 68: ('Perry', 20, 1), 69: ('Devlin', 20, 1), 73: ('Fire-Wyvern', 20, 1), 70: ('Barlog', 20, 1), 80: ('Tentocle', 20, 1), 71: ('Centaurus', 20, 1), 75: ('Giant-Lizard', 20, 1), 78: ('Minotaurs', 20, 1), 81: ('Abaddon', 20, 1), 72: ('Claw-Turtle', 20, 1), 74: ('Giant-Crayfish', 20, 1), 76: ('Giant-Plant', 20, 1), 77: ('MasterMage-Orc', 20, 1), 79: ('Nizie', 20, 1), 56: ('Cat', 15, 6), 28: ('Troll', 25, 3)}


def parse_map(path):
    """spot-mob-generator = id kind x1 y1 x2 y2 mob max (HG.cpp:13514-13577), maximum-object, random-mob-generator = kind count."""
    gens, maxobj, rnd = [], None, None
    for raw in open(path, encoding="latin-1"):
        line = raw.split("//")[0].strip()
        m = re.match(r"([A-Za-z-]+)\s*=\s*(.*)", line)
        if not m:
            continue
        k, v = m.group(1).lower(), m.group(2).split()
        if k == "spot-mob-generator" and len(v) >= 8:
            gens.append([int(x) for x in v[:8]])
        elif k == "maximum-object":
            maxobj = int(v[0])
        elif k == "random-mob-generator":
            rnd = [int(x) for x in v[:2]]
    return gens, maxobj, rnd


def spawn(g):
    s = {"id": g[0], "kind": g[1], "rect": g[2:6], "mob": g[6], "max": g[7]}
    if g[6] in SPOT:
        s["name"], s["specialProb"], s["specialKind"] = SPOT[g[6]]
    return s


def read_cfg():
    out = {}
    for line in open(os.path.join(SF, "Config", "Npc.cfg"), encoding="latin-1"):
        m = re.match(r"\s*Npc\s*=\s*(\S+)\s+(.*)", line)
        if m:
            v = [int(x) for x in m.group(2).split()]
            assert len(v) == len(COLS), m.group(1)
            c = dict(zip(COLS, v))
            c["expDice"] *= EXPMULTIPLIER
            c["gold"] *= GOLDDROPMULTIPLIER
            out[m.group(1)] = c
    return out


def fill(c):
    """Campos derivados que usa el port: rango de exp (Npc.cpp:109: dice(ExpDice,4)+ExpDice) y de oro (HG.cpp:29369-29386: g±g/5)."""
    c["expMin"], c["expMax"] = 2 * c["expDice"], 5 * c["expDice"]
    g = c["gold"]
    c["goldMin"], c["goldMax"] = (g - g // 5, g + g // 5) if g > 4 else (1, g)
    return c


def main():
    cfg = read_cfg()
    path = os.path.join(OUT, "npc.json")
    npc = json.load(open(path))
    for k, old in npc.items():
        if k in cfg:
            keep = {x: old[x] for x in ("sprite", "sound", "town", "areaSize") if x in old}
            npc[k] = dict(fill(dict(cfg[k])), **keep)
    json.dump(npc, open(path, "w"), indent=1)
    print("npc.json:", sum(k in cfg for k in npc), "fichas del original;", [k for k in npc if k not in cfg], "propias del port")

    # generadores de los mapas
    mdir = os.path.join(SF, "HGServer", "MAPDATA")
    files = {f.lower(): f for f in os.listdir(mdir)}
    spot = {}
    for name in sorted(os.listdir(os.path.join(OUT, "maps"))):
        if not name.endswith(".json") or name == "index.json":
            continue
        key = name[:-5]
        f = files.get(key.lower() + ".txt")
        if not f:
            continue
        gens, maxobj, rnd = parse_map(os.path.join(mdir, f))
        mp = os.path.join(OUT, "maps", name)
        meta = json.load(open(mp))
        meta["spawns"] = [spawn(g) for g in gens]
        if maxobj is not None: meta["maxObjects"] = maxobj
        if rnd: meta["randomMob"] = {"kind": rnd[0], "count": rnd[1]}
        else: meta.pop("randomMob", None)
        json.dump(meta, open(mp, "w"), separators=(",", ":"))
        spot[key] = len(meta["spawns"])
    print("mapas:", spot)
    gens, _, _ = parse_map(os.path.join(mdir, files["arefarm.txt"]))
    json.dump([spawn(g) for g in gens], open(os.path.join(OUT, "arefarm.spawns.json"), "w"), indent=1)


main()
