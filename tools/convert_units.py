"""Exporta las unidades que no son enemigos del juego (Crusade/Heldenian: torres, catapulta, bestias de guerra,
caballeros, golem de batalla, puerta, guardias, ángeles tutelares) para verlas en el bestiario.
    python convert_units.py CARPETA_SPRITES SALIDA
Tabla pak -> tipo de NPC: Client/Game.cpp (MakeSprite, ~línea 3150-3300). Añade las hojas a SALIDA/sprites.json y
SALIDA/sprites/ y escribe SALIDA/units.json. No toca npc.json: el juego no las usa."""
import json, os, sys
from convert import PakFolder, export

src, out = sys.argv[1:3]
pak = PakFolder(src)
sdir = os.path.join(out, "sprites")
man_path = os.path.join(out, "sprites.json")
manifest = json.load(open(man_path))
# nombre, pak, tipo de NPC.cfg (0 = sin tipo), hojas
UNITS = [
    ("Guard", "Guard", 21, 40), ("Arrow Guard Tower", "GT-Arrow", 36, 40), ("Cannon Guard Tower", "GT-Cannon", 37, 40),
    ("Mana Collector", "ManaCollector", 38, 40), ("Detector", "Detector", 39, 40), ("Energy Shield Generator", "ESG", 40, 40),
    ("Grand Magic Generator", "GMG", 41, 40), ("Mana Stone", "ManaStone", 42, 40), ("Light War Beetle", "LWB", 43, 40),
    ("God's Hand Knight", "GHK", 44, 40), ("God's Hand Knight (Battle Steed)", "GHKABS", 45, 40), ("Temple Knight", "TK", 46, 40),
    ("Battle Golem", "BG", 47, 40), ("Catapult", "Catapult", 51, 40), ("Sorceress", "Sorceress", 82, 40),
    ("TP Knight", "TPKnight", 83, 40), ("Elf Master", "ElfMaster", 84, 40), ("Dark Knight", "DarkKnight", 85, 40),
    ("Heavy Battle Tank", "HBTank", 86, 32), ("CB Turret", "CBTurret", 87, 32), ("Babarian", "Babarian", 88, 40),
    ("Arcane Cannon", "ACannon", 89, 32), ("Heldenian Gate", "Gate", 91, 24),
    ("Tutelar Angel (STR)", "TutelarAngel1", 0, 48), ("Tutelar Angel (DEX)", "TutelarAngel2", 0, 48),
    ("Tutelar Angel (INT)", "TutelarAngel3", 0, 48), ("Tutelar Angel (MAG)", "TutelarAngel4", 0, 48),
]
units = {}
for name, pk, typ, n in UNITS:
    key = "u" + pk.lower().replace("-", "")
    ok = 0
    for k in range(n):
        try:
            r = export(pak, pk, k, sdir, "%s%d" % (key, k), manifest)
            if r: manifest["%s%d" % (key, k)]["u"] = 1      # u: no entra en la carga inicial (bundles.coreKeys)
            ok += r
        except Exception as ex:      # hoja con formato distinto (p. ej. Gate.pak): se omite
            print("  no se pudo:", pk, k, type(ex).__name__)
    if not ok:
        continue
    units[name] = {"sprite": key, "type": typ, "n": n, "pak": pk}
    print(name, key, ok, "/", n)
json.dump(manifest, open(man_path, "w"), separators=(",", ":"))
json.dump(units, open(os.path.join(out, "units.json"), "w"), indent=1)
