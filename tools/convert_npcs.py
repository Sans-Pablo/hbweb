"""Exporta los NPC de ciudad (tienda, herrero, almacén, mago) y las listas de venta de las tiendas.
    python convert_npcs.py CARPETA_HELBREATH CARPETA_SERVIDOR SALIDA
Añade a SALIDA/sprites.json y SALIDA/sprites/ los 8 sprites (uno por dirección, 8 fotogramas de reposo) de cada
NPC (Client/Game.cpp: MakeSprite("Shopkpr"...)), añade las fichas de NPC.cfg a SALIDA/npc.json con "town": true
y crea SALIDA/shops.json con CONTENTS/contents1.txt (tienda) y contents2.txt (herrero)."""
import json, os, re, sys
from convert import PakFolder, export, read_npc_cfg

hb, server, out = sys.argv[1:4]
pak = PakFolder(os.path.join(hb, "SPRITES"))
sdir = os.path.join(out, "sprites")
man_path = os.path.join(out, "sprites.json")
manifest = json.load(open(man_path))

# pak, clave de sprite, nombre en NPC.cfg
TOWN = [("Shopkpr", "shk", "ShopKeeper-W"), ("Gandlf", "gnd", "Gandlf"), ("Howard", "how", "Howard"), ("tom", "tom", "Tom")]
cfg = read_npc_cfg(os.path.join(server, "Files", "NPC.cfg"))
npc_path = os.path.join(out, "npc.json")
npcs = json.load(open(npc_path))
for pk, key, name in TOWN:
    for d in range(8):
        export(pak, pk, d, sdir, "%s%d" % (key, d), manifest)
    npcs[name] = dict(cfg[name], sprite=key, sound=0, town=True)
json.dump(manifest, open(man_path, "w"), separators=(",", ":"))
json.dump(npcs, open(npc_path, "w"), indent=1)

# nombres para mostrar
names = {}
for line in open(os.path.join(hb, "CONTENTS", "ItemName.cfg"), encoding="latin-1"):
    parts = [x for x in re.split(r"[=\r\n]+", line) if x.strip()]
    if len(parts) >= 3 and parts[0].strip() == "Item":
        names[parts[1].strip()] = parts[2].strip()

# Client/Game.cpp, __bDecodeContentsAndBuildItemForSaleList: nombre, tipo, posición, efecto, 6 valores,
# vida máx., reparaciones, sprite, fotograma, precio, peso, apariencia, velocidad, nivel
FIELDS = ["type", "equipPos", "effectType", "v1", "v2", "v3", "v4", "v5", "v6", "maxLife", "fix", "sprite", "spriteFrame",
          "price", "weight", "appr", "speed", "levelLimit"]
shops = {}
for n in (1, 2):
    rows = []
    for line in open(os.path.join(hb, "CONTENTS", "contents%d.txt" % n), encoding="latin-1"):
        m = re.match(r"\s*Item\s*=\s*(\S+)\s+(.*)", line)
        if not m:
            continue
        v = [int(x) for x in m.group(2).split()]
        if len(v) < len(FIELDS):
            continue
        row = dict(zip(FIELDS, v), name=m.group(1), display=names.get(m.group(1), m.group(1)))
        rows.append(row)
    shops[str(n)] = rows
json.dump(shops, open(os.path.join(out, "shops.json"), "w"), separators=(",", ":"))
print("NPC:", ", ".join(n for _, _, n in TOWN), "| tiendas:", {k: len(v) for k, v in shops.items()})
